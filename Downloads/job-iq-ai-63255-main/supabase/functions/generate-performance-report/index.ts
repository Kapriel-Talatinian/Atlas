import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { project_id, client_id } = body;

    if (!project_id || !client_id) {
      return new Response(JSON.stringify({ error: "project_id and client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();

    // Get project
    const { data: project } = await supabase
      .from("annotation_projects")
      .select("*")
      .eq("id", project_id)
      .eq("client_id", client_id)
      .single();

    if (!project) {
      return new Response(JSON.stringify({ error: "Projet non trouvé" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get completed task count
    const { count: completedTasks } = await supabase
      .from("annotation_tasks")
      .select("id", { count: "exact", head: true })
      .eq("source_id", project_id)
      .eq("status", "completed");

    if (!completedTasks || completedTasks === 0) {
      return new Response(JSON.stringify({
        error: "Aucune tâche validée. Le rapport sera disponible après la première tâche.",
        code: "NO_DATA",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get total task count
    const { count: totalTasks } = await supabase
      .from("annotation_tasks")
      .select("id", { count: "exact", head: true })
      .eq("source_id", project_id);

    // Get completed task IDs
    const { data: completedTaskRows } = await supabase
      .from("annotation_tasks")
      .select("id")
      .eq("source_id", project_id)
      .eq("status", "completed")
      .limit(1000);

    const completedIds = completedTaskRows?.map((t) => t.id) || [];

    // Get alpha reports for completed tasks
    const { data: alphaData } = await supabase
      .from("alpha_reports")
      .select("task_id, overall_alpha, dimension_alphas, flag_human_review")
      .in("task_id", completedIds.length > 0 ? completedIds : ["00000000-0000-0000-0000-000000000000"]);

    const alphas = alphaData || [];
    const globalAlphas = alphas.map((a) => a.overall_alpha).filter((v) => v != null);

    // Compute dimension averages
    const dimAccum: Record<string, number[]> = {};
    for (const a of alphas) {
      const dims = a.dimension_alphas as Record<string, any>;
      if (!dims) continue;
      for (const [dim, val] of Object.entries(dims)) {
        const score = typeof val === "object" ? val?.alpha : val;
        if (typeof score === "number") {
          if (!dimAccum[dim]) dimAccum[dim] = [];
          dimAccum[dim].push(score);
        }
      }
    }
    const dimensionAlphas: Record<string, number> = {};
    for (const [dim, scores] of Object.entries(dimAccum)) {
      dimensionAlphas[dim] = Math.round(avg(scores) * 10000) / 10000;
    }

    // QA decisions
    const autoValidated = alphas.filter((a) => !a.flag_human_review && a.overall_alpha >= 0.80).length;
    const flagged = alphas.filter((a) => a.flag_human_review).length;
    const adjudicated = alphas.length - autoValidated - flagged;

    const consensusRate = alphas.length > 0 ? Math.round((autoValidated / alphas.length) * 100) : 0;

    // Average annotation time
    const { data: annotations } = await supabase
      .from("annotations")
      .select("time_spent")
      .in("item_id", completedIds.length > 0 ? completedIds : ["00000000-0000-0000-0000-000000000000"]);

    const times = (annotations || []).map((a) => a.time_spent).filter((t) => t != null && t > 0);
    const avgTime = times.length > 0 ? Math.round(avg(times)) : 0;

    // Anonymized expert stats
    const { data: expertStats } = await supabase.rpc("get_anonymized_expert_stats", {
      p_project_id: project_id,
    });

    // Problematic tasks
    const problematicTasks = alphas
      .filter((a) => a.overall_alpha < 0.80)
      .sort((a, b) => a.overall_alpha - b.overall_alpha)
      .slice(0, 50)
      .map((a) => ({
        task_id: a.task_id,
        alpha: a.overall_alpha,
        decision: a.flag_human_review ? "flagged" : a.overall_alpha >= 0.67 ? "adjudicated" : "flagged",
        dimension_alphas: a.dimension_alphas,
      }));

    // Alpha timeline (group by batches of 50)
    const batchSize = 50;
    const alphaTimeline: { batch: number; alpha: number; count: number }[] = [];
    for (let i = 0; i < globalAlphas.length; i += batchSize) {
      const slice = globalAlphas.slice(i, i + batchSize);
      alphaTimeline.push({
        batch: Math.floor(i / batchSize) + 1,
        alpha: Math.round(avg(slice) * 10000) / 10000,
        count: slice.length,
      });
    }

    // LLM costs (if available)
    const { data: llmCosts } = await supabase
      .from("llm_call_logs")
      .select("purpose, tokens_in, tokens_out, cost_usd")
      .eq("project_id", project_id);

    const llmByPurpose: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const l of llmCosts || []) {
      const purpose = l.purpose || "other";
      if (!llmByPurpose[purpose]) llmByPurpose[purpose] = { calls: 0, tokens: 0, cost: 0 };
      llmByPurpose[purpose].calls += 1;
      llmByPurpose[purpose].tokens += (l.tokens_in || 0) + (l.tokens_out || 0);
      llmByPurpose[purpose].cost += l.cost_usd || 0;
    }

    const metrics = {
      global_alpha: globalAlphas.length > 0 ? Math.round(avg(globalAlphas) * 10000) / 10000 : null,
      tasks_completed: completedTasks,
      tasks_total: totalTasks || project.total_items || 0,
      consensus_rate: consensusRate,
      avg_annotation_time_seconds: avgTime,
      dimension_alphas: dimensionAlphas,
      qa_decisions: {
        auto_validated: autoValidated,
        adjudicated: adjudicated,
        flagged: flagged,
      },
      annotator_stats: expertStats || [],
      problematic_tasks: problematicTasks,
      alpha_timeline: alphaTimeline,
      llm_costs: llmByPurpose,
      project_domain: project.domain,
      project_type: project.type,
      project_languages: project.languages,
      sla_tier: project.sla_tier,
    };

    const reportType = project.status === "completed" ? "final" : "intermediate";

    // Save to DB
    const { data: report } = await supabase
      .from("performance_reports")
      .insert({
        project_id,
        client_id,
        report_type: reportType,
        metrics,
      })
      .select("id")
      .single();

    return new Response(JSON.stringify({
      report_id: report?.id,
      report_type: reportType,
      metrics,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[generate-performance-report] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
