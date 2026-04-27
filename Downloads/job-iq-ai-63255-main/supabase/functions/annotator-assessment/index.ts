import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PHASE_WEIGHTS = { phase1: 0.20, phase2: 0.50, phase3: 0.20, phase4: 0.10 };
const PHASE1_PASS_THRESHOLD = 7; // out of 10
const COOLDOWN_DAYS = 14;

const ActionSchema = z.object({
  action: z.enum([
    "start_assessment",
    "submit_phase1",
    "get_phase2_items",
    "submit_phase2",
    "get_phase3_items",
    "submit_phase3",
    "submit_phase4",
    "compute_results",
    "get_session",
    "get_guidelines",
    "check_eligibility",
  ]),
  session_id: z.string().uuid().optional(),
  domain: z.string().optional(),
  expert_id: z.string().uuid().optional(),
  answers: z.any().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResp({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResp({ error: 'Invalid token' }, 401);
    }
    const userId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    const parseResult = ActionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return jsonResp({ error: "Invalid request", details: parseResult.error.issues }, 400);
    }
    const { action, session_id, domain, expert_id, answers } = parseResult.data;

    // ─── CHECK ELIGIBILITY ───────────────────────────
    if (action === "check_eligibility") {
      if (!domain || !expert_id) return jsonResp({ error: "Missing domain/expert_id" }, 400);

      // Check cooldown
      const { data: lastSession } = await supabase
        .from('annotator_assessment_sessions')
        .select('completed_at, status')
        .eq('expert_id', expert_id)
        .eq('domain', domain)
        .in('status', ['completed', 'failed'])
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let cooldownUntil: string | null = null;
      if (lastSession?.completed_at) {
        const cd = new Date(lastSession.completed_at);
        cd.setDate(cd.getDate() + COOLDOWN_DAYS);
        if (cd > new Date()) cooldownUntil = cd.toISOString();
      }

      // Check existing valid cert
      const { data: existingCert } = await supabase
        .from('annotator_domain_certifications')
        .select('tier, score, valid_until')
        .eq('expert_id', expert_id)
        .eq('domain', domain)
        .eq('status', 'valid')
        .gte('valid_until', new Date().toISOString())
        .maybeSingle();

      // Check in-progress session
      const { data: activeSession } = await supabase
        .from('annotator_assessment_sessions')
        .select('id, current_phase, started_at')
        .eq('expert_id', expert_id)
        .eq('domain', domain)
        .eq('status', 'in_progress')
        .maybeSingle();

      return jsonResp({
        eligible: !cooldownUntil && !activeSession,
        cooldownUntil,
        existingCert,
        activeSession: activeSession ? { id: activeSession.id, phase: activeSession.current_phase } : null,
      });
    }

    // ─── GET GUIDELINES ──────────────────────────────
    if (action === "get_guidelines") {
      if (!domain) return jsonResp({ error: "Missing domain" }, 400);

      const { data: guidelines, error } = await supabase
        .from('annotation_guidelines')
        .select('*')
        .eq('domain', domain)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !guidelines) {
        return jsonResp({ error: "No guidelines found for this domain" }, 404);
      }
      return jsonResp({ guidelines });
    }

    // ─── START ASSESSMENT ────────────────────────────
    if (action === "start_assessment") {
      if (!domain || !expert_id) return jsonResp({ error: "Missing domain/expert_id" }, 400);

      // Select phase 1 items (10 guidelines quiz questions)
      const { data: p1Items } = await supabase
        .from('annotation_test_items')
        .select('id')
        .eq('domain', domain)
        .eq('item_type', 'guidelines_quiz')
        .eq('is_active', true);

      if (!p1Items || p1Items.length < 10) {
        return jsonResp({ error: "Not enough test items for this domain", available: p1Items?.length || 0 }, 400);
      }

      const shuffled1 = p1Items.sort(() => Math.random() - 0.5).slice(0, 10);

      // Create session
      const { data: session, error: sessErr } = await supabase
        .from('annotator_assessment_sessions')
        .insert({
          user_id: userId,
          expert_id,
          domain,
          status: 'in_progress',
          current_phase: 1,
          phase1_started_at: new Date().toISOString(),
          phase1_item_ids: shuffled1.map(i => i.id),
        })
        .select()
        .single();

      if (sessErr) return jsonResp({ error: sessErr.message }, 500);

      // Fetch items content (without gold annotations)
      const { data: items } = await supabase
        .from('annotation_test_items')
        .select('id, content, difficulty, tags')
        .in('id', shuffled1.map(i => i.id));

      return jsonResp({
        session_id: session.id,
        phase: 1,
        items: items?.map(i => ({ id: i.id, content: i.content, difficulty: i.difficulty })) || [],
      });
    }

    // ─── SUBMIT PHASE 1 ─────────────────────────────
    if (action === "submit_phase1") {
      if (!session_id || !answers) return jsonResp({ error: "Missing session_id/answers" }, 400);

      const { data: session } = await supabase
        .from('annotator_assessment_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (!session) return jsonResp({ error: "Session not found" }, 404);
      if (session.current_phase !== 1) return jsonResp({ error: "Wrong phase" }, 400);

      // Fetch gold answers
      const { data: goldItems } = await supabase
        .from('annotation_test_items')
        .select('id, gold_annotation, scoring_rubric')
        .in('id', session.phase1_item_ids || []);

      // Score phase 1
      let correct = 0;
      const gradedAnswers = (answers as any[]).map((ans: any) => {
        const gold = goldItems?.find(g => g.id === ans.item_id);
        if (!gold) return { ...ans, correct: false };
        const expected = (gold.gold_annotation as any)?.correct_answer;
        const isCorrect = ans.answer === expected;
        if (isCorrect) correct++;
        return { ...ans, correct: isCorrect, expected };
      });

      const passed = correct >= PHASE1_PASS_THRESHOLD;
      const score = (correct / 10) * 100;

      if (!passed) {
        // Fail - end session
        await supabase
          .from('annotator_assessment_sessions')
          .update({
            phase1_completed_at: new Date().toISOString(),
            phase1_answers: gradedAnswers,
            phase1_score: score,
            phase1_passed: false,
            status: 'failed',
            completed_at: new Date().toISOString(),
            global_score: score * PHASE_WEIGHTS.phase1,
            feedback: {
              phase1: {
                score,
                correct,
                total: 10,
                passed: false,
                message: "Score insuffisant en compréhension de guidelines. Relisez les guidelines et les cas limites avant de retenter dans 14 jours.",
                details: gradedAnswers,
              }
            }
          })
          .eq('id', session_id);

        return jsonResp({ passed: false, score, correct, total: 10, details: gradedAnswers });
      }

      // Pass - prepare phase 2
      const { data: p2Items } = await supabase
        .from('annotation_test_items')
        .select('id, difficulty')
        .eq('domain', session.domain)
        .eq('item_type', 'annotation')
        .eq('is_active', true);

      // Select 5 easy, 5 intermediate, 5 hard
      const easy = (p2Items || []).filter(i => i.difficulty === 'easy').sort(() => Math.random() - 0.5).slice(0, 5);
      const inter = (p2Items || []).filter(i => i.difficulty === 'intermediate').sort(() => Math.random() - 0.5).slice(0, 5);
      const hard = (p2Items || []).filter(i => i.difficulty === 'hard').sort(() => Math.random() - 0.5).slice(0, 5);
      const p2Selected = [...easy, ...inter, ...hard].sort(() => Math.random() - 0.5);

      await supabase
        .from('annotator_assessment_sessions')
        .update({
          phase1_completed_at: new Date().toISOString(),
          phase1_answers: gradedAnswers,
          phase1_score: score,
          phase1_passed: true,
          current_phase: 2,
          phase2_started_at: new Date().toISOString(),
          phase2_item_ids: p2Selected.map(i => i.id),
        })
        .eq('id', session_id);

      return jsonResp({ passed: true, score, correct, total: 10 });
    }

    // ─── GET PHASE 2 ITEMS ──────────────────────────
    if (action === "get_phase2_items") {
      if (!session_id) return jsonResp({ error: "Missing session_id" }, 400);

      const { data: session } = await supabase
        .from('annotator_assessment_sessions')
        .select('phase2_item_ids, domain, current_phase')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (!session || session.current_phase !== 2) return jsonResp({ error: "Invalid session state" }, 400);

      const { data: items } = await supabase
        .from('annotation_test_items')
        .select('id, content, difficulty, tags')
        .in('id', session.phase2_item_ids || []);

      return jsonResp({
        items: items?.map(i => ({ id: i.id, content: i.content, difficulty: i.difficulty })) || [],
        domain: session.domain,
        timeLimit: 1200, // 20 minutes
      });
    }

    // ─── SUBMIT PHASE 2 ─────────────────────────────
    if (action === "submit_phase2") {
      if (!session_id || !answers) return jsonResp({ error: "Missing data" }, 400);

      const { data: session } = await supabase
        .from('annotator_assessment_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (!session || session.current_phase !== 2) return jsonResp({ error: "Invalid state" }, 400);

      // Fetch gold standards
      const { data: goldItems } = await supabase
        .from('annotation_test_items')
        .select('id, gold_annotation, scoring_rubric, difficulty')
        .in('id', session.phase2_item_ids || []);

      // Score each item
      const scoredAnswers = await scorePhase2WithLLM(supabase, answers as any[], goldItems || [], session.domain);

      const avgScore = scoredAnswers.reduce((s: number, a: any) => s + a.score, 0) / scoredAnswers.length;
      const avgTime = scoredAnswers.reduce((s: number, a: any) => s + (a.time_spent || 0), 0) / scoredAnswers.length;

      // Prepare phase 3 items
      const { data: p3Items } = await supabase
        .from('annotation_test_items')
        .select('id')
        .eq('domain', session.domain)
        .eq('item_type', 'error_detection')
        .eq('is_active', true);

      const p3Selected = (p3Items || []).sort(() => Math.random() - 0.5).slice(0, 8);

      await supabase
        .from('annotator_assessment_sessions')
        .update({
          phase2_completed_at: new Date().toISOString(),
          phase2_answers: scoredAnswers,
          phase2_scores: { average: avgScore, byDifficulty: groupScoresByDifficulty(scoredAnswers) },
          phase2_avg_time_per_item: avgTime,
          current_phase: 3,
          phase3_started_at: new Date().toISOString(),
          phase3_item_ids: p3Selected.map(i => i.id),
        })
        .eq('id', session_id);

      return jsonResp({ score: avgScore, avgTime, itemCount: scoredAnswers.length });
    }

    // ─── GET PHASE 3 ITEMS ──────────────────────────
    if (action === "get_phase3_items") {
      if (!session_id) return jsonResp({ error: "Missing session_id" }, 400);

      const { data: session } = await supabase
        .from('annotator_assessment_sessions')
        .select('phase3_item_ids, domain, current_phase')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (!session || session.current_phase !== 3) return jsonResp({ error: "Invalid state" }, 400);

      const { data: items } = await supabase
        .from('annotation_test_items')
        .select('id, content')
        .in('id', session.phase3_item_ids || []);

      return jsonResp({
        items: items?.map(i => ({ id: i.id, content: i.content })) || [],
        timeLimit: 420, // 7 minutes
      });
    }

    // ─── SUBMIT PHASE 3 ─────────────────────────────
    if (action === "submit_phase3") {
      if (!session_id || !answers) return jsonResp({ error: "Missing data" }, 400);

      const { data: session } = await supabase
        .from('annotator_assessment_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (!session || session.current_phase !== 3) return jsonResp({ error: "Invalid state" }, 400);

      const { data: goldItems } = await supabase
        .from('annotation_test_items')
        .select('id, gold_annotation, scoring_rubric')
        .in('id', session.phase3_item_ids || []);

      // Score error detection
      let totalPoints = 0;
      const maxPoints = 12; // 8 items, 1pt status + bonus for description = max 12
      const scoredP3 = (answers as any[]).map((ans: any) => {
        const gold = goldItems?.find(g => g.id === ans.item_id);
        if (!gold) return { ...ans, points: 0 };
        const goldData = gold.gold_annotation as any;
        const hasError = goldData?.has_error === true;
        const statusCorrect = ans.has_error === hasError;
        let pts = statusCorrect ? 1 : 0;
        if (statusCorrect && hasError && ans.error_description) {
          // Bonus point for good description
          const keywords = goldData?.error_keywords || [];
          const descLower = (ans.error_description || '').toLowerCase();
          const matched = keywords.filter((k: string) => descLower.includes(k.toLowerCase()));
          if (matched.length >= 1) pts += 1;
        }
        totalPoints += pts;
        return { ...ans, points: pts, expected_has_error: hasError };
      });

      const p3Score = (totalPoints / maxPoints) * 100;

      // Prepare phase 4 items
      const { data: p4Items } = await supabase
        .from('annotation_test_items')
        .select('id')
        .eq('domain', session.domain)
        .eq('item_type', 'ethical_judgment')
        .eq('is_active', true);

      const p4Selected = (p4Items || []).sort(() => Math.random() - 0.5).slice(0, 3);

      await supabase
        .from('annotator_assessment_sessions')
        .update({
          phase3_completed_at: new Date().toISOString(),
          phase3_answers: scoredP3,
          phase3_score: p3Score,
          current_phase: 4,
          phase4_started_at: new Date().toISOString(),
          phase4_item_ids: p4Selected.map(i => i.id),
        })
        .eq('id', session_id);

      return jsonResp({ score: p3Score, totalPoints, maxPoints });
    }

    // ─── SUBMIT PHASE 4 ─────────────────────────────
    if (action === "submit_phase4") {
      if (!session_id || !answers) return jsonResp({ error: "Missing data" }, 400);

      const { data: session } = await supabase
        .from('annotator_assessment_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (!session || session.current_phase !== 4) return jsonResp({ error: "Invalid state" }, 400);

      const { data: goldItems } = await supabase
        .from('annotation_test_items')
        .select('id, gold_annotation, scoring_rubric')
        .in('id', session.phase4_item_ids || []);

      // Score ethical judgment using LLM
      const p4Scored = await scorePhase4WithLLM(answers as any[], goldItems || []);
      const p4Score = p4Scored.reduce((s: number, a: any) => s + a.score, 0) / p4Scored.length * 100;

      // Compute global score
      const p1Score = session.phase1_score || 0;
      const p2Score = (session.phase2_scores as any)?.average || 0;
      const p3Score = session.phase3_score || 0;

      const globalScore = 
        p1Score * PHASE_WEIGHTS.phase1 +
        p2Score * PHASE_WEIGHTS.phase2 +
        p3Score * PHASE_WEIGHTS.phase3 +
        p4Score * PHASE_WEIGHTS.phase4;

      // Determine tier
      let tier: string | null = null;
      if (globalScore >= 90) tier = 'expert';
      else if (globalScore >= 80) tier = 'senior';
      else if (globalScore >= 65) tier = 'standard';
      else if (globalScore >= 50) tier = 'junior';

      const feedback = {
        phase1: { score: p1Score, weight: PHASE_WEIGHTS.phase1, weighted: p1Score * PHASE_WEIGHTS.phase1 },
        phase2: { score: p2Score, weight: PHASE_WEIGHTS.phase2, weighted: p2Score * PHASE_WEIGHTS.phase2 },
        phase3: { score: p3Score, weight: PHASE_WEIGHTS.phase3, weighted: p3Score * PHASE_WEIGHTS.phase3 },
        phase4: { score: p4Score, weight: PHASE_WEIGHTS.phase4, weighted: p4Score * PHASE_WEIGHTS.phase4, details: p4Scored },
        globalScore,
        tier,
        passed: globalScore >= 50,
      };

      await supabase
        .from('annotator_assessment_sessions')
        .update({
          phase4_completed_at: new Date().toISOString(),
          phase4_answers: p4Scored,
          phase4_score: p4Score,
          global_score: globalScore,
          tier_awarded: tier,
          status: globalScore >= 50 ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          feedback,
        })
        .eq('id', session_id);

      // If passed, create/update domain certification
      if (tier) {
        // Supersede existing cert
        await supabase
          .from('annotator_domain_certifications')
          .update({ status: 'superseded' })
          .eq('expert_id', session.expert_id)
          .eq('domain', session.domain)
          .eq('status', 'valid');

        await supabase
          .from('annotator_domain_certifications')
          .insert({
            user_id: userId,
            expert_id: session.expert_id,
            domain: session.domain,
            tier,
            score: globalScore,
            session_id,
          });

        // Update annotator_profiles tier if this is their best
        const { data: bestCert } = await supabase
          .from('annotator_domain_certifications')
          .select('tier')
          .eq('expert_id', session.expert_id)
          .eq('status', 'valid')
          .order('score', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (bestCert) {
          await supabase
            .from('annotator_profiles')
            .update({
              tier: bestCert.tier,
              is_qualified: true,
              qualified_at: new Date().toISOString(),
              qualification_score: globalScore,
            })
            .eq('expert_id', session.expert_id);
        }
      }

      return jsonResp(feedback);
    }

    // ─── GET SESSION ─────────────────────────────────
    if (action === "get_session") {
      if (!session_id) return jsonResp({ error: "Missing session_id" }, 400);

      const { data: session } = await supabase
        .from('annotator_assessment_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();

      if (!session) return jsonResp({ error: "Session not found" }, 404);
      return jsonResp({ session });
    }

    return jsonResp({ error: 'Invalid action' }, 400);

  } catch (error) {
    console.error('[annotator-assessment] Error:', error);
    return jsonResp({ error: (error as Error).message }, 500);
  }
});

// ─── Helper functions ────────────────────────────────

function jsonResp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function groupScoresByDifficulty(items: any[]) {
  const groups: Record<string, number[]> = {};
  for (const item of items) {
    const d = item.difficulty || 'unknown';
    if (!groups[d]) groups[d] = [];
    groups[d].push(item.score);
  }
  return Object.fromEntries(
    Object.entries(groups).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length])
  );
}

async function scorePhase2WithLLM(_supabase: any, answers: any[], goldItems: any[], domain: string): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const scored = [];

  for (const ans of answers) {
    const gold = goldItems.find((g: any) => g.id === ans.item_id);
    if (!gold) { scored.push({ ...ans, score: 0 }); continue; }

    const goldData = gold.gold_annotation as any;
    let totalScore = 0;
    let maxScore = 0;

    // Score numeric dimensions (tolerance ±1)
    const dimensions = goldData?.dimensions || {};
    const ansDimensions = ans.dimensions || {};
    for (const [dim, expectedVal] of Object.entries(dimensions)) {
      maxScore += 1;
      const ansVal = ansDimensions[dim];
      if (ansVal !== undefined) {
        const diff = Math.abs((ansVal as number) - (expectedVal as number));
        if (diff === 0) totalScore += 1;
        else if (diff === 1) totalScore += 0.7;
        else if (diff === 2) totalScore += 0.2;
      }
    }

    // Score categorical choices
    if (goldData?.choice && ans.choice) {
      maxScore += 1;
      if (ans.choice === goldData.choice) totalScore += 1;
      else if (gold.difficulty === 'hard') totalScore += 0.3;
    }

    // Score justification with LLM or keyword fallback
    maxScore += 1;
    let justScore = 0;
    if (ans.justification && ans.justification.length >= 10) {
      if (LOVABLE_API_KEY) {
        try {
          const llmResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `Évaluateur expert d'annotations IA. Domaine: ${domain}.` },
                { role: "user", content: `Scores attendus: ${JSON.stringify(dimensions)}\nScores donnés: ${JSON.stringify(ansDimensions)}\nMots-clés: ${JSON.stringify(goldData?.justification_keywords || [])}\nJustification: "${ans.justification}"\n\nScore 0.0-1.0 la qualité.` }
              ],
              tools: [{ type: "function", function: { name: "score_justification", description: "Score", parameters: { type: "object", properties: { score: { type: "number" }, feedback: { type: "string" } }, required: ["score", "feedback"] } } }],
              tool_choice: { type: "function", function: { name: "score_justification" } }
            })
          });
          if (llmResp.ok) {
            const d = await llmResp.json();
            const tc = d.choices?.[0]?.message?.tool_calls?.[0];
            if (tc) { const p = JSON.parse(tc.function.arguments); justScore = Math.max(0, Math.min(1, p.score || 0)); ans.llm_feedback = p.feedback; }
          }
        } catch (e) { console.error('[phase2-llm]', e); }
      }
      // Keyword fallback
      if (justScore === 0) {
        const keywords = goldData?.justification_keywords || [];
        const justLower = ans.justification.toLowerCase();
        const hits = keywords.filter((k: string) => justLower.includes(k.toLowerCase())).length;
        const ratio = keywords.length > 0 ? hits / keywords.length : 0.5;
        justScore = ans.justification.length < 30 ? 0.3 * (ratio > 0 ? 1 : 0.5) : Math.min(1, 0.5 + ratio * 0.5);
      }
    }
    totalScore += justScore;

    scored.push({ ...ans, score: maxScore > 0 ? (totalScore / maxScore) * 100 : 0, difficulty: gold.difficulty, maxScore, totalScore });
  }
  return scored;
}

async function scorePhase4WithLLM(answers: any[], goldItems: any[]): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const scored = [];

  for (const ans of answers) {
    const gold = goldItems.find((g: any) => g.id === ans.item_id);
    if (!gold) { scored.push({ ...ans, score: 0 }); continue; }

    const rubric = gold.scoring_rubric as any;
    const expectedActions = rubric?.expected_actions || [];
    const redFlags = rubric?.red_flags || [];
    let finalScore = 0;

    if (LOVABLE_API_KEY && ans.response && ans.response.length > 20) {
      try {
        const llmResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: `Évalue la réponse éthique d'un annotateur. Critères: conscience professionnelle, compréhension chaîne qualité, humilité.` },
              { role: "user", content: `Attendu: ${JSON.stringify((gold.gold_annotation as any)?.ideal_response_summary || '')}\nActions: ${JSON.stringify(expectedActions)}\nRed flags: ${JSON.stringify(redFlags)}\nRéponse: "${ans.response}"\nScore 0.0-1.0.` }
            ],
            tools: [{ type: "function", function: { name: "score_ethics", description: "Score", parameters: { type: "object", properties: { score: { type: "number" }, feedback: { type: "string" } }, required: ["score", "feedback"] } } }],
            tool_choice: { type: "function", function: { name: "score_ethics" } }
          })
        });
        if (llmResp.ok) {
          const d = await llmResp.json();
          const tc = d.choices?.[0]?.message?.tool_calls?.[0];
          if (tc) { const p = JSON.parse(tc.function.arguments); finalScore = Math.max(0, Math.min(1, p.score || 0)); ans.llm_feedback = p.feedback; }
        }
      } catch (e) { console.error('[phase4-llm]', e); }
    }

    // Keyword fallback
    if (finalScore === 0 && ans.response) {
      const rLower = ans.response.toLowerCase();
      const hits = expectedActions.filter((a: string) => rLower.includes(a.toLowerCase())).length;
      const ratio = expectedActions.length > 0 ? hits / expectedActions.length : 0;
      const flags = redFlags.filter((f: string) => rLower.includes(f.toLowerCase())).length;
      finalScore = Math.min(1, Math.max(0, ratio - flags * 0.3) + (ans.response.length > 100 ? 0.1 : 0));
    }

    scored.push({ ...ans, score: finalScore, actionsCovered: expectedActions.filter((a: string) => (ans.response || '').toLowerCase().includes(a.toLowerCase())).length, totalExpected: expectedActions.length });
  }
  return scored;
}
