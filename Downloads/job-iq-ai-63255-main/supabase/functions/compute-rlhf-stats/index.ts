import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[compute-rlhf-stats] Starting computation...");

    // Parallel queries for performance
    const [
      totalRes, activeRes, agreementRes, datasetsRes,
      validatedRes, pendingRes, rejectedRes,
      piiRes, lockedRes, preferenceRes, reasoningRes, slaRes
    ] = await Promise.all([
      supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }),
      supabase.from("annotator_profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("rlhf_feedback").select("agreement_score").not("agreement_score", "is", null),
      supabase.from("rlhf_dataset_versions").select("*", { count: "exact", head: true }).eq("is_published", true),
      supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }).eq("qa_status", "validated"),
      supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }).eq("qa_status", "pending"),
      supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }).eq("qa_status", "rejected"),
      supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }).eq("pii_present", false),
      supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }).eq("is_locked", true),
      supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }).not("chosen_output", "is", null),
      supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }).not("reasoning_steps", "is", null),
      supabase.from("rlhf_sla_tracking").select("sla_met").not("sla_met", "is", null),
    ]);

    const totalAnnotations = totalRes.count || 0;
    const activeAnnotators = activeRes.count || 0;
    const datasetsDelivered = datasetsRes.count || 0;
    const validatedAnnotations = validatedRes.count || 0;
    const pendingQA = pendingRes.count || 0;
    const rejectedAnnotations = rejectedRes.count || 0;
    const piiFreeFeedback = piiRes.count || 0;
    const lockedFeedback = lockedRes.count || 0;
    const preferenceCount = preferenceRes.count || 0;
    const reasoningCount = reasoningRes.count || 0;

    // Agreement rate
    let avgAgreement = 0;
    if (agreementRes.data && agreementRes.data.length > 0) {
      const sum = agreementRes.data.reduce((acc: number, f: any) => acc + Number(f.agreement_score), 0);
      avgAgreement = Math.round((sum / agreementRes.data.length) * 100);
    }

    // SLA compliance rate
    let slaComplianceRate = 0;
    if (slaRes.data && slaRes.data.length > 0) {
      const metCount = slaRes.data.filter((s: any) => s.sla_met === true).length;
      slaComplianceRate = Math.round((metCount / slaRes.data.length) * 100);
    }

    // Update platform_stats
    const statsToUpdate = [
      { stat_key: "total_annotations", stat_value: totalAnnotations },
      { stat_key: "active_annotators", stat_value: activeAnnotators },
      { stat_key: "avg_agreement_rate", stat_value: avgAgreement },
      { stat_key: "datasets_delivered", stat_value: datasetsDelivered },
    ];

    for (const stat of statsToUpdate) {
      const { error } = await supabase
        .from("platform_stats")
        .update({ stat_value: stat.stat_value, updated_at: new Date().toISOString() })
        .eq("stat_key", stat.stat_key);
      if (error) console.error(`Failed to update ${stat.stat_key}:`, error);
    }

    const result = {
      success: true,
      computed_at: new Date().toISOString(),
      stats: {
        total_annotations: totalAnnotations,
        active_annotators: activeAnnotators,
        avg_agreement_rate: avgAgreement,
        datasets_delivered: datasetsDelivered,
        validated_annotations: validatedAnnotations,
        pending_qa: pendingQA,
        rejected_annotations: rejectedAnnotations,
        pii_free_feedback: piiFreeFeedback,
        locked_feedback: lockedFeedback,
        with_preference_comparison: preferenceCount,
        with_reasoning_traces: reasoningCount,
        sla_compliance_rate: slaComplianceRate,
      },
      pipeline_breakdown: {
        raw: totalAnnotations,
        annotated: totalAnnotations - pendingQA,
        qa_reviewed: validatedAnnotations + rejectedAnnotations,
        validated: validatedAnnotations,
        locked: lockedFeedback,
      },
      scoring_dimensions: [
        "correctness", "readability", "performance", "security",
        "best_practices", "testing", "scalability", "architecture",
        "problem_solving", "documentation",
      ],
    };

    console.log("[compute-rlhf-stats] Done:", result.stats);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[compute-rlhf-stats] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
