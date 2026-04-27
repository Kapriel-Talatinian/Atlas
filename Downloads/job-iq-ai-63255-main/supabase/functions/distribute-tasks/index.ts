import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================================
// DISTRIBUTE-TASKS v3 — Production-grade task distribution
// ============================================================================

const DistributeSchema = z.object({
  action: z.enum([
    "distribute_items", "auto_distribute", "get_available", "claim",
    "release", "cleanup_expired", "reset_daily_quotas", "check_fraud",
    "triage_submission", "distribute_pending",
  ]),
  project_id: z.string().uuid().optional(),
  submissionId: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  expert_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).default(50),
});

// Priority scoring: alpha 40%, availability 30%, seniority 10%, diversity 20%
function computePriorityScore(
  annotator: any,
  projectId: string,
  projectDomain: string,
): number {
  // Alpha (40%) — avg alpha on last 50 annotations
  const alpha = annotator.overall_accuracy || 0.7;
  const alphaScore = alpha * 0.4;

  // Availability (30%) — remaining quota today
  const dailyQuota = annotator.daily_quota || 50;
  const todayCount = annotator.current_daily_count || 0;
  const availability = Math.max(0, (dailyQuota - todayCount) / dailyQuota);
  const availabilityScore = availability * 0.3;

  // Seniority (10%) — days since qualification
  const qualifiedAt = annotator.qualified_at ? new Date(annotator.qualified_at) : new Date();
  const daysSinceCert = (Date.now() - qualifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  const seniority = Math.min(daysSinceCert / 365, 1);
  const seniorityScore = seniority * 0.1;

  // Diversity (20%) — hasn't worked on this project = 1.0, has = 0.5
  // We approximate this with the annotation count for this project
  const diversityScore = 0.2; // Default — can be refined with per-project lookup

  return Math.round((alphaScore + availabilityScore + seniorityScore + diversityScore) * 1000) / 1000;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 50_000) {
      return new Response(JSON.stringify({ error: 'Request too large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    
    // Detect cron/service calls (anon key or service role key used as bearer)
    const isCronCall = token === supabaseAnonKey || token === supabaseServiceKey;
    
    let isAdmin = false;
    let isExpert = false;
    let userId: string | null = null;

    if (isCronCall) {
      // Cron/service calls are treated as admin
      isAdmin = true;
    } else {
      // Regular user JWT auth
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: userError } = await authClient.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;

      const { data: userRoles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      const roles = userRoles?.map(r => r.role) || [];
      isAdmin = roles.includes('admin');
      isExpert = roles.includes('expert');
    }

    const rawBody = await req.json();
    const parseResult = DistributeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { action, project_id, submissionId, task_id, expert_id, limit } = parseResult.data;

    // Admin-only actions
    if (['distribute_items', 'auto_distribute', 'cleanup_expired', 'reset_daily_quotas', 'check_fraud', 'triage_submission', 'distribute_pending'].includes(action) && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // distribute_items — assign annotation_items to certified annotators
    // ========================================================================
    if (action === 'distribute_items') {
      if (!project_id) {
        return new Response(JSON.stringify({ error: 'project_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: project } = await supabase
        .from('annotation_projects').select('*').eq('id', project_id).single();
      if (!project) {
        return new Response(JSON.stringify({ error: 'Project not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: queuedItems } = await supabase
        .from('annotation_items')
        .select('id, complexity_level, is_gold_standard, is_calibration')
        .eq('project_id', project_id).eq('status', 'queued')
        .order('created_at', { ascending: true }).limit(limit);

      if (!queuedItems?.length) {
        return new Response(JSON.stringify({ distributed: 0, message: 'No queued items' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: annotators } = await supabase
        .from('annotator_profiles')
        .select('id, expert_id, tier, overall_accuracy, inter_annotator_agreement, throughput_per_hour, current_daily_count, daily_quota, qualified_at')
        .eq('is_active', true).eq('is_qualified', true)
        .or('suspended_until.is.null,suspended_until.lt.' + new Date().toISOString());

      if (!annotators?.length) {
        return new Response(JSON.stringify({ distributed: 0, message: 'No available annotators' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Filter by domain certification ──
      // Only annotators with a valid annotator_domain_certifications row for this
      // project's domain may receive its tasks (e.g. medical experts only see
      // medical tasks). The check is bypassed if the table is empty (bootstrap).
      const expertIds = annotators.map(a => a.expert_id).filter(Boolean) as string[];
      let certifiedExpertIds = new Set<string>();
      if (expertIds.length > 0) {
        const { data: certs } = await supabase
          .from('annotator_domain_certifications')
          .select('expert_id')
          .in('expert_id', expertIds)
          .eq('domain', project.domain)
          .eq('status', 'valid');
        certifiedExpertIds = new Set((certs || []).map(c => c.expert_id));
      }
      const certifiedAnnotators = annotators.filter(a => a.expert_id && certifiedExpertIds.has(a.expert_id));

      if (!certifiedAnnotators.length) {
        return new Response(JSON.stringify({
          distributed: 0,
          message: `No annotators certified for domain "${project.domain}"`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Filter and score annotators
      const scored = certifiedAnnotators
        .filter(a => (a.current_daily_count || 0) < (a.daily_quota || 50))
        .map(a => ({
          id: a.id,
          expert_id: a.expert_id as string,
          score: computePriorityScore(a, project_id, project.domain),
          currentLoad: a.current_daily_count || 0,
        }))
        .sort((a, b) => b.score - a.score);

      if (!scored.length) {
        return new Response(JSON.stringify({ distributed: 0, message: 'All annotators at capacity' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const workflowConfig = project.workflow as any;
      const annotationsPerItem = workflowConfig?.annotations_per_item || (project.domain === 'medical' ? 3 : 2);
      let distributed = 0;
      const countMap: Record<string, number> = {};
      let annotatorIdx = 0;

      // ── ONE task per item, N task_assignments per task ──
      // This is the canonical model: qa-engine aggregates expert_annotations
      // by task_id, so all annotators must share the same task_id.
      for (const item of queuedItems) {
        const chosen: { annId: string; expertId: string }[] = [];
        for (let i = 0; i < annotationsPerItem && scored.length > 0; i++) {
          const s = scored[(annotatorIdx + i) % scored.length];
          chosen.push({ annId: s.id, expertId: s.expert_id });
        }
        if (!chosen.length) break;

        const complexityMap: Record<number, string> = { 1: 'junior', 2: 'mid', 3: 'senior', 4: 'lead' };
        const mappedComplexity = complexityMap[item.complexity_level] || 'mid';

        // 1. Create the shared annotation_task (no assigned_annotator_id —
        //    multi-annotator tasks are tracked via task_assignments)
        const { data: insertedTask, error: insertErr } = await supabase
          .from('annotation_tasks')
          .insert({
            source_type: 'annotation_item', source_id: item.id,
            complexity_level: mappedComplexity, domain: project.domain,
            language: project.languages?.[0] || 'fr', status: 'assigned',
            assigned_at: new Date().toISOString(),
            deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            task_content: { project_id, item_id: item.id, annotation_type: project.type, is_gold: item.is_gold_standard },
          })
          .select('id')
          .single();

        if (insertErr || !insertedTask) {
          console.error('[distribute-tasks] Task insert error:', JSON.stringify(insertErr));
          continue;
        }

        // 2. Create one task_assignments row per chosen annotator
        const assignmentRows = chosen.map(({ expertId }) => ({
          task_id: insertedTask.id,
          expert_id: expertId,
          status: 'assigned',
          timeout_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        }));
        const { error: assignErr } = await supabase
          .from('task_assignments')
          .insert(assignmentRows);
        if (assignErr) {
          console.error('[distribute-tasks] Assignment insert error:', JSON.stringify(assignErr));
        } else {
          for (const { annId } of chosen) {
            countMap[annId] = (countMap[annId] || 0) + 1;
          }
        }

        await supabase.from('annotation_items').update({ status: 'assigned' as any }).eq('id', item.id);
        distributed++;
        annotatorIdx = (annotatorIdx + chosen.length) % scored.length;
      }

      // Update daily counts
      for (const [annId, count] of Object.entries(countMap)) {
        const current = annotators.find(a => a.id === annId);
        await supabase.from('annotator_profiles')
          .update({ current_daily_count: (current?.current_daily_count || 0) + count })
          .eq('id', annId);
      }

      return new Response(JSON.stringify({
        distributed, total_assignments: Object.values(countMap).reduce((s, v) => s + v, 0),
        annotators_used: Object.keys(countMap).length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================================================================
    // auto_distribute — distribute across all active projects
    // ========================================================================
    if (action === 'auto_distribute') {
      const { data: activeProjects } = await supabase
        .from('annotation_projects').select('id').eq('status', 'active');

      let totalDistributed = 0;
      let totalAutoAnnotated = 0;

      for (const project of activeProjects || []) {
        const { data: queuedItems } = await supabase
          .from('annotation_items').select('id, complexity_level')
          .eq('project_id', project.id).eq('status', 'queued').limit(50);
        if (!queuedItems?.length) continue;

        const { data: proj } = await supabase
          .from('annotation_projects').select('domain, complexity_level, workflow, type, languages, automation_config')
          .eq('id', project.id).single();
        if (!proj) continue;

        // ── Phase 1: Auto-annotate complexity 1 items via annotation-engine ──
        const autoConfig = proj.automation_config as any;
        const complexity1Items = queuedItems.filter(i => i.complexity_level === 1);
        const humanItems = queuedItems.filter(i => i.complexity_level > 1);

        if (complexity1Items.length > 0) {
          // Auto-annotate complexity 1 regardless of automation_config.enabled
          // These are simple classification tasks that don't need humans
          try {
            const autoItemIds = complexity1Items.map(i => i.id);
            const fnUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/annotation-engine';
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

            const autoResp = await fetch(fnUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                action: 'auto_annotate',
                project_id: project.id,
                item_ids: autoItemIds,
                force_auto: true, // bypass automation_config.enabled check
              }),
            });
            const autoResult = await autoResp.json();
            totalAutoAnnotated += autoResult.auto_annotated || 0;

            // Items that were routed_to_human by auto_annotate (low confidence)
            // will still be in 'queued' status and picked up below
          } catch (autoErr: any) {
            console.error(`Auto-annotate failed for project ${project.id}:`, autoErr.message);
            // On failure, treat complexity 1 items as human items
            humanItems.push(...complexity1Items);
          }
        }

        // ── Phase 2: Distribute remaining items to human annotators ──
        // Re-fetch queued items (some may have been auto-annotated)
        const { data: remainingItems } = await supabase
          .from('annotation_items').select('id, complexity_level')
          .eq('project_id', project.id).eq('status', 'queued').limit(50);
        if (!remainingItems?.length) continue;

        const { data: annotators } = await supabase
          .from('annotator_profiles')
          .select('id, expert_id, tier, overall_accuracy, inter_annotator_agreement, throughput_per_hour, current_daily_count, daily_quota, qualified_at')
          .eq('is_active', true).eq('is_qualified', true)
          .or('suspended_until.is.null,suspended_until.lt.' + new Date().toISOString());
        if (!annotators?.length) continue;

        // Filter by domain certification
        const expertIds = annotators.map(a => a.expert_id).filter(Boolean) as string[];
        let certifiedSet = new Set<string>();
        if (expertIds.length > 0) {
          const { data: certs } = await supabase
            .from('annotator_domain_certifications')
            .select('expert_id')
            .in('expert_id', expertIds)
            .eq('domain', proj.domain)
            .eq('status', 'valid');
          certifiedSet = new Set((certs || []).map(c => c.expert_id));
        }
        const certified = annotators.filter(a => a.expert_id && certifiedSet.has(a.expert_id));
        const available = certified.filter(a => (a.current_daily_count || 0) < (a.daily_quota || 50));
        if (!available.length) continue;

        const scored = available
          .map(a => ({ id: a.id, expert_id: a.expert_id as string, score: computePriorityScore(a, project.id, proj.domain) }))
          .sort((a, b) => b.score - a.score);

        const requiredAnnotators = (proj.workflow as any)?.annotations_per_item || (proj.domain === 'medical' ? 3 : 2);
        let idx = 0;

        for (const item of remainingItems) {
          const chosen: { annId: string; expertId: string }[] = [];
          for (let i = 0; i < requiredAnnotators && scored.length > 0; i++) {
            const s = scored[(idx + i) % scored.length];
            chosen.push({ annId: s.id, expertId: s.expert_id });
          }
          if (!chosen.length) continue;

          const cMap: Record<number, string> = { 1: 'junior', 2: 'mid', 3: 'senior', 4: 'lead' };

          // 1. ONE task per item
          const { data: insertedTask, error: insertErr } = await supabase
            .from('annotation_tasks')
            .insert({
              source_type: 'annotation_item', source_id: item.id,
              complexity_level: cMap[item.complexity_level] || 'mid', domain: proj.domain,
              language: proj.languages?.[0] || 'fr', status: 'assigned',
              assigned_at: new Date().toISOString(),
              deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              task_content: { project_id: project.id, item_id: item.id, annotation_type: proj.type },
            })
            .select('id')
            .single();
          if (insertErr || !insertedTask) {
            console.error('[distribute-tasks/auto] Task insert error:', JSON.stringify(insertErr));
            continue;
          }

          // 2. N task_assignments per task
          const rows = chosen.map(({ expertId }) => ({
            task_id: insertedTask.id,
            expert_id: expertId,
            status: 'assigned',
            timeout_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          }));
          await supabase.from('task_assignments').insert(rows);

          await supabase.from('annotation_items').update({ status: 'assigned' as any }).eq('id', item.id);
          totalDistributed++;
          idx = (idx + chosen.length) % scored.length;
        }
      }

      return new Response(JSON.stringify({ distributed: totalDistributed, auto_annotated: totalAutoAnnotated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // get_available — tasks available for an expert (pull mode)
    // ========================================================================
    if (action === 'get_available') {
      if (!isExpert && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ownExpert } = await supabase
        .from('expert_profiles').select('id').eq('user_id', userId).single();
      if (!ownExpert) {
        return new Response(JSON.stringify({ error: 'Expert not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: certs } = await supabase
        .from('annotator_domain_certifications').select('domain')
        .eq('expert_id', ownExpert.id).eq('status', 'valid');
      const certifiedDomains = certs?.map(c => c.domain) || [];
      if (!certifiedDomains.length) {
        return new Response(JSON.stringify({ tasks: [], message: 'No active certifications' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tasks } = await supabase
        .from('annotation_tasks')
        .select('id, domain, complexity_level, source_type, created_at, deadline, task_content')
        .eq('status', 'pending').is('assigned_annotator_id', null)
        .order('created_at', { ascending: true }).limit(20);

      const filtered = tasks?.filter(t =>
        certifiedDomains.some(d => t.domain?.includes(d))
      ) || [];

      return new Response(JSON.stringify({ tasks: filtered }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // claim — expert claims a task (pull mode)
    // ========================================================================
    if (action === 'claim') {
      if (!isExpert && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'task_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ownExpert } = await supabase
        .from('expert_profiles').select('id').eq('user_id', userId).single();
      if (!ownExpert) {
        return new Response(JSON.stringify({ error: 'Expert not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: task } = await supabase
        .from('annotation_tasks').select('*').eq('id', task_id).eq('status', 'pending').single();
      if (!task) {
        return new Response(JSON.stringify({ error: 'Task not available' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('annotation_tasks').update({
        assigned_annotator_id: ownExpert.id,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }).eq('id', task_id);

      await supabase.from('task_assignments').insert({
        task_id, expert_id: ownExpert.id,
        timeout_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }).onConflict('task_id,expert_id').ignore();

      return new Response(JSON.stringify({ success: true, task_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // release — expert releases a task
    // ========================================================================
    if (action === 'release') {
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'task_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('annotation_tasks').update({
        assigned_annotator_id: null, assigned_at: null, status: 'pending',
      }).eq('id', task_id);

      await supabase.from('task_assignments')
        .update({ status: 'skipped' }).eq('task_id', task_id).eq('status', 'assigned');

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // cleanup_expired — revert expired assignments
    // ========================================================================
    if (action === 'cleanup_expired') {
      const { data: expired } = await supabase
        .from('task_assignments').select('id, task_id')
        .eq('status', 'assigned').lt('timeout_at', new Date().toISOString());

      let cleaned = 0;
      for (const a of expired || []) {
        await supabase.from('task_assignments').update({ status: 'expired' }).eq('id', a.id);
        await supabase.from('annotation_tasks').update({
          assigned_annotator_id: null, assigned_at: null, status: 'pending',
        }).eq('id', a.task_id);
        cleaned++;
      }

      return new Response(JSON.stringify({ cleaned }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // reset_daily_quotas
    // ========================================================================
    if (action === 'reset_daily_quotas') {
      await supabase.from('annotator_profiles').update({
        current_daily_count: 0, last_quota_reset: new Date().toISOString(),
      }).eq('is_active', true);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // check_fraud — detect and suspend suspicious annotators
    // ========================================================================
    if (action === 'check_fraud') {
      // Get recent annotation data grouped by annotator
      const { data: recentAnnotations } = await supabase
        .from('annotations')
        .select('annotator_id, time_spent, value, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      const annotatorStats: Record<string, {
        totalAnnotations: number;
        tooFastCount: number;
        avgTimeSpent: number;
        reasonings: string[];
      }> = {};

      for (const a of recentAnnotations || []) {
        if (!annotatorStats[a.annotator_id]) {
          annotatorStats[a.annotator_id] = { totalAnnotations: 0, tooFastCount: 0, avgTimeSpent: 0, reasonings: [] };
        }
        const stats = annotatorStats[a.annotator_id];
        stats.totalAnnotations++;
        stats.avgTimeSpent += a.time_spent || 0;
        if ((a.time_spent || 0) < 30) stats.tooFastCount++;

        const reasoning = (a.value as any)?.reasoning || "";
        if (reasoning) stats.reasonings.push(reasoning);
      }

      const suspensions: string[] = [];
      const flags: string[] = [];

      for (const [annotatorId, stats] of Object.entries(annotatorStats)) {
        stats.avgTimeSpent = stats.totalAnnotations > 0 ? stats.avgTimeSpent / stats.totalAnnotations : 0;

        // Rule 1: avg time < 60s
        if (stats.avgTimeSpent < 60 && stats.totalAnnotations >= 10) {
          flags.push(`${annotatorId}: avg time ${Math.round(stats.avgTimeSpent)}s`);
        }

        // Rule 2: > 10 tasks in < 30s in a day
        if (stats.tooFastCount > 10) {
          await supabase.from('annotator_profiles').update({
            is_active: false,
            suspended_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            suspension_reason: `Auto-suspended: ${stats.tooFastCount} tasks completed in <30s`,
          }).eq('id', annotatorId);
          suspensions.push(annotatorId);
        }

        // Rule 3: duplicate reasonings (3+ consecutive identical)
        if (stats.reasonings.length >= 3) {
          for (let i = 2; i < stats.reasonings.length; i++) {
            if (stats.reasonings[i] === stats.reasonings[i-1] && stats.reasonings[i] === stats.reasonings[i-2] && stats.reasonings[i].length > 20) {
              flags.push(`${annotatorId}: identical reasoning detected (${stats.reasonings[i].slice(0, 50)}...)`);
              break;
            }
          }
        }
      }

      return new Response(JSON.stringify({ suspensions, flags, annotators_checked: Object.keys(annotatorStats).length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // LEGACY: triage_submission
    // ========================================================================
    if (action === 'triage_submission') {
      if (!submissionId) {
        return new Response(JSON.stringify({ error: 'submissionId required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: submission } = await supabase
        .from('test_submissions').select('*, expert_profiles(*)').eq('id', submissionId).single();
      if (!submission) {
        return new Response(JSON.stringify({ error: 'Submission not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const answers = submission.answers || {};
      const triageNotes: string[] = [];
      let isNoise = false;
      const answerValues = Object.values(answers);
      const emptyAnswers = answerValues.filter((a: any) => !a || (typeof a === 'string' && a.length < 20)).length;
      if (emptyAnswers > answerValues.length * 0.5) { isNoise = true; triageNotes.push('Too many empty answers'); }

      const expertExp = submission.expert_profiles?.years_of_experience || 0;
      let complexityLevel = 'junior';
      if (expertExp >= 8) complexityLevel = 'senior';
      else if (expertExp >= 4) complexityLevel = 'mid';

      if (!isNoise) {
        await supabase.from('annotation_tasks').insert({
          source_type: 'test_submission', source_id: submissionId, complexity_level: complexityLevel,
          domain: submission.expert_profiles?.primary_skills?.[0] || 'general', language: 'fr', status: 'pending',
          ai_triage_notes: triageNotes.join('; ') || null,
          task_content: { submission_id: submissionId, test_id: submission.test_id },
          deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });
      }

      return new Response(JSON.stringify({ processed: true, isNoise, triageNotes, complexityLevel }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // LEGACY: distribute_pending
    // ========================================================================
    if (action === 'distribute_pending') {
      const { data: pendingTasks } = await supabase
        .from('annotation_tasks').select('*').eq('status', 'pending')
        .is('assigned_annotator_id', null).order('created_at', { ascending: true }).limit(limit);

      if (!pendingTasks?.length) {
        return new Response(JSON.stringify({ distributed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: annotators } = await supabase
        .from('annotator_profiles').select('*').eq('is_active', true).eq('is_qualified', true)
        .or('suspended_until.is.null,suspended_until.lt.' + new Date().toISOString());

      let distributed = 0;
      for (const task of pendingTasks) {
        const available = annotators?.find(a => (a.current_daily_count || 0) < (a.daily_quota || 50));
        if (!available) break;
        const { error } = await supabase.from('annotation_tasks').update({
          assigned_annotator_id: available.id, assigned_at: new Date().toISOString(), status: 'assigned',
        }).eq('id', task.id);
        if (!error) {
          await supabase.from('annotator_profiles').update({
            current_daily_count: (available.current_daily_count || 0) + 1,
          }).eq('id', available.id);
          distributed++;
          available.current_daily_count = (available.current_daily_count || 0) + 1;
        }
      }

      return new Response(JSON.stringify({ distributed, pending: (pendingTasks?.length || 0) - distributed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[distribute-tasks] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
