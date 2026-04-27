import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Rate limiter
const _rl = new Map<string, { c: number; r: number }>();
function checkRateLimit(ip: string, max: number, windowMs = 60000): boolean {
  const now = Date.now(); const e = _rl.get(ip);
  if (!e || now > e.r) { _rl.set(ip, { c: 1, r: now + windowMs }); return true; }
  if (e.c >= max) return false; e.c++; return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIp, 10)) {
    return new Response(JSON.stringify({ error: "Trop de requêtes" }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  try {
    // === Body size check ===
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 100_000) {
      return new Response(JSON.stringify({ error: 'Request too large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Authentication - Expert required ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has expert role
    const { data: roleData } = await supabase
      .from('user_roles').select('role')
      .eq('user_id', userId);
    const roles = roleData?.map(r => r.role) || [];
    if (!roles.some(r => ['expert', 'admin'].includes(r))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Business Logic ===
    const QualifySchema = z.object({
      action: z.enum(["check_eligibility", "get_qualification_test", "submit_qualification"]),
      expertId: z.string().uuid(),
      qualificationResponses: z.array(z.object({
        taskId: z.string().uuid(),
        rating: z.string().max(50),
        issues: z.array(z.string().max(100)).optional(),
      })).max(20).optional(),
    });
    const rawBody = await req.json();
    const parseResult = QualifySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Données invalides", details: parseResult.error.issues.map(i => i.message) }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { action, expertId, qualificationResponses } = parseResult.data;

    // Verify expert owns this profile (unless admin)
    if (!roles.includes('admin')) {
      const { data: expertProfile } = await supabase
        .from('expert_profiles').select('id').eq('user_id', userId).eq('id', expertId).single();
      if (!expertProfile) {
        return new Response(JSON.stringify({ error: 'Forbidden - not your profile' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'check_eligibility') {
      console.log(`[qualify-annotator] Checking eligibility for expert: ${expertId}`);
      
      const { data: expert, error: expertError } = await supabase
        .from('expert_profiles').select('*').eq('id', expertId).single();
      if (expertError || !expert) {
        return new Response(JSON.stringify({ error: 'Expert profile not found', eligible: false }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: certifications } = await supabase
        .from('certifications').select('score, status')
        .eq('expert_id', expertId).eq('status', 'valid').gte('score', 80);
      const hasCertification = certifications && certifications.length > 0;

      const profileFields = [expert.title, expert.bio && expert.bio.length > 20, expert.primary_skills?.length > 0, expert.years_of_experience > 0, expert.city, expert.country];
      const profileComplete = profileFields.filter(Boolean).length / profileFields.length * 100 >= 70;

      const experienceYears = expert.years_of_experience || 0;
      const hasExperience = experienceYears >= 1;

      const { data: annotator } = await supabase
        .from('annotator_profiles').select('consent_given_at').eq('expert_id', expertId).maybeSingle();
      const hasConsent = !!annotator?.consent_given_at;

      const missing: string[] = [];
      if (!hasCertification) missing.push('certification');
      if (!profileComplete) missing.push('profile_incomplete');
      if (!hasExperience) missing.push('insufficient_experience');
      if (!hasConsent) missing.push('consent_not_given');

      return new Response(JSON.stringify({
        eligible: missing.length === 0, missing,
        details: { hasCertification, profileComplete, experienceYears, hasConsent },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_qualification_test') {
      const { data: goldTasks, error: goldError } = await supabase
        .from('rlhf_gold_tasks').select('id, task_type, job_role, job_level, ai_output')
        .eq('is_active', true).limit(5);
      if (goldError || !goldTasks || goldTasks.length < 3) {
        return new Response(JSON.stringify({ error: 'Not enough gold tasks', available: goldTasks?.length || 0 }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const selectedTasks = goldTasks.sort(() => Math.random() - 0.5).slice(0, Math.min(5, goldTasks.length));
      return new Response(JSON.stringify({
        tasks: selectedTasks.map(t => ({ id: t.id, task_type: t.task_type, job_role: t.job_role, job_level: t.job_level, ai_output: t.ai_output })),
        totalTasks: selectedTasks.length, passingThreshold: 0.70,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'submit_qualification') {
      if (!qualificationResponses || !Array.isArray(qualificationResponses)) {
        return new Response(JSON.stringify({ error: 'Missing qualification responses' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const taskIds = qualificationResponses.map(r => r.taskId);
      const { data: goldTasks, error: goldError } = await supabase
        .from('rlhf_gold_tasks').select('id, expected_rating, expected_issues, min_agreement_threshold')
        .in('id', taskIds);
      if (goldError || !goldTasks) {
        return new Response(JSON.stringify({ error: 'Failed to fetch gold tasks' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const taskResults = qualificationResponses.map(response => {
        const goldTask = goldTasks.find(t => t.id === response.taskId);
        if (!goldTask) return { taskId: response.taskId, passed: false, score: 0 };
        const ratingMatch = response.rating === goldTask.expected_rating;
        const expectedIssues = goldTask.expected_issues || [];
        const submittedIssues = response.issues || [];
        let issueOverlap = 1.0;
        if (expectedIssues.length > 0) {
          const expectedSet = new Set(expectedIssues);
          issueOverlap = submittedIssues.filter(i => expectedSet.has(i)).length / expectedIssues.length;
        }
        const score = (ratingMatch ? 0.6 : 0) + (issueOverlap * 0.4);
        return { taskId: response.taskId, passed: score >= (goldTask.min_agreement_threshold || 0.7), score, expectedRating: goldTask.expected_rating, submittedRating: response.rating, issueOverlap };
      });

      const totalScore = taskResults.reduce((sum, r) => sum + r.score, 0) / taskResults.length;
      const passRate = taskResults.filter(r => r.passed).length / taskResults.length;
      const qualified = passRate >= 0.70;

      if (qualified) {
        await supabase.from('annotator_profiles').update({
          tier: 'gold', qualification_score: totalScore,
          qualified_at: new Date().toISOString(), is_active: true, is_qualified: true,
        }).eq('expert_id', expertId);
      } else {
        await supabase.from('annotator_profiles').update({
          last_qualification_attempt: new Date().toISOString(), is_qualified: false,
        }).eq('expert_id', expertId);
      }

      return new Response(JSON.stringify({ success: qualified, qualified, score: totalScore, taskResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[qualify-annotator] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
