import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Severity → action mapping
const SANCTION_MAP: Record<string, string> = {
  low: "warning",
  medium: "warning",
  high: "suspension_7d",
  critical: "suspension_30d",
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

    const { data: userRoles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = userRoles?.some(r => r.role === "admin");

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BodySchema = z.object({
      action: z.enum(["check_expert", "auto_scan", "apply_sanction", "get_report", "dismiss"]),
      expert_id: z.string().optional(),
      event_id: z.string().uuid().optional(),
      sanction: z.string().optional(),
      reason: z.string().optional(),
    });

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, expert_id, event_id, sanction, reason } = parsed.data;

    // ====== CHECK EXPERT ======
    if (action === "check_expert") {
      if (!expert_id) {
        return new Response(JSON.stringify({ error: "expert_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const report = await runFraudCheck(supabase, expert_id);

      return new Response(JSON.stringify(report), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== AUTO SCAN ======
    if (action === "auto_scan") {
      const { data: activeExperts } = await supabase
        .from("annotator_profiles")
        .select("id")
        .eq("is_active", true);

      const results: any[] = [];
      for (const expert of activeExperts || []) {
        const report = await runFraudCheck(supabase, expert.id);
        if (report.flags.length > 0) {
          results.push(report);
        }
      }

      return new Response(JSON.stringify({ scanned: activeExperts?.length || 0, flagged: results.length, reports: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== APPLY SANCTION ======
    if (action === "apply_sanction") {
      if (!expert_id || !sanction) {
        return new Response(JSON.stringify({ error: "expert_id and sanction required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const suspensionDays = sanction === "suspension_7d" ? 7
        : sanction === "suspension_30d" ? 30
        : sanction === "ban" ? 36500
        : 0;

      if (suspensionDays > 0) {
        await supabase.from("annotator_profiles").update({
          is_active: false,
          suspended_until: new Date(Date.now() + suspensionDays * 86400000).toISOString(),
          suspension_reason: reason || `Sanction: ${sanction}`,
        }).eq("id", expert_id);
      }

      await supabase.from("fraud_events").insert({
        expert_id,
        event_type: "manual_flag",
        severity: sanction === "ban" ? "critical" : sanction.includes("30") ? "high" : "medium",
        details: { reason, applied_by: userId },
        action_taken: sanction,
      });

      return new Response(JSON.stringify({ success: true, sanction }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== GET REPORT ======
    if (action === "get_report") {
      if (!expert_id) {
        return new Response(JSON.stringify({ error: "expert_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: events } = await supabase
        .from("fraud_events")
        .select("*")
        .eq("expert_id", expert_id)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: profile } = await supabase
        .from("annotator_profiles")
        .select("trust_score, suspended_until, suspension_reason, is_active")
        .eq("id", expert_id)
        .single();

      return new Response(JSON.stringify({ profile, events }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== DISMISS ======
    if (action === "dismiss") {
      if (!event_id) {
        return new Response(JSON.stringify({ error: "event_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("fraud_events").update({
        action_taken: "dismissed",
        resolved: true,
        resolved_by: userId,
      }).eq("id", event_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[fraud-detection] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================================================
// FRAUD CHECK ENGINE
// ============================================================================

async function runFraudCheck(supabase: any, expertId: string) {
  const flags: any[] = [];

  // Get recent annotations
  const { data: recentAnnotations } = await supabase
    .from("annotations")
    .select("id, value, time_spent, confidence, comment, created_at")
    .eq("annotator_id", expertId)
    .order("created_at", { ascending: false })
    .limit(50);

  const annotations = recentAnnotations || [];

  // 1. Speed violations
  const tooFast = annotations.filter((a: any) => a.time_spent && a.time_spent < 30);
  if (tooFast.length >= 3) {
    flags.push({
      type: "speed_violation",
      severity: tooFast.length >= 10 ? "high" : "medium",
      details: { count: tooFast.length, avg_time: Math.round(tooFast.reduce((s: number, a: any) => s + a.time_spent, 0) / tooFast.length) },
    });
  }

  // 2. Monotone scoring
  const scoredAnnotations = annotations.filter((a: any) => a.value?.dimensions);
  if (scoredAnnotations.length >= 10) {
    const allScores = scoredAnnotations.flatMap((a: any) => {
      const dims = a.value.dimensions;
      return typeof dims === "object" ? Object.values(dims).map(Number).filter(n => !isNaN(n)) : [];
    });
    if (allScores.length > 5) {
      const mean = allScores.reduce((s: number, v: number) => s + v, 0) / allScores.length;
      const variance = allScores.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / allScores.length;
      if (variance < 0.1) {
        flags.push({
          type: "monotone_scoring",
          severity: "medium",
          details: { variance: Math.round(variance * 1000) / 1000, sample_size: allScores.length },
        });
      }
    }
  }

  // 3. Duplicate reasoning
  const comments = annotations.filter((a: any) => a.comment && a.comment.length > 10).map((a: any) => a.comment.trim());
  const commentCounts: Record<string, number> = {};
  for (const c of comments) {
    commentCounts[c] = (commentCounts[c] || 0) + 1;
  }
  const duplicates = Object.entries(commentCounts).filter(([, count]) => count >= 3);
  if (duplicates.length > 0) {
    flags.push({
      type: "duplicate_reasoning",
      severity: "high",
      details: {
        count: duplicates[0][1],
        sample: duplicates[0][0].substring(0, 100),
      },
    });
  }

  // 4. Preference bias (for DPO)
  const prefAnnotations = annotations.filter((a: any) => a.value?.preference);
  if (prefAnnotations.length >= 20) {
    const aCount = prefAnnotations.filter((a: any) => a.value.preference === "A").length;
    const bCount = prefAnnotations.filter((a: any) => a.value.preference === "B").length;
    const total = prefAnnotations.length;
    if (aCount / total > 0.85 || bCount / total > 0.85) {
      flags.push({
        type: "preference_bias",
        severity: "medium",
        details: { total, a_count: aCount, b_count: bCount, bias_ratio: Math.max(aCount, bCount) / total },
      });
    }
  }

  // Get trust score
  const { data: profile } = await supabase
    .from("annotator_profiles")
    .select("trust_score, suspended_until, is_active")
    .eq("id", expertId)
    .single();

  // 5. Low alpha check
  const { data: alphaReports } = await supabase
    .from("alpha_reports")
    .select("overall_alpha")
    .order("computed_at", { ascending: false })
    .limit(20);

  if (alphaReports && alphaReports.length >= 5) {
    const avgAlpha = alphaReports.reduce((s: number, r: any) => s + (r.overall_alpha || 0), 0) / alphaReports.length;
    if (avgAlpha < 0.50) {
      flags.push({
        type: "low_alpha",
        severity: "high",
        details: { avg_alpha: Math.round(avgAlpha * 100) / 100, sample_size: alphaReports.length },
      });
    }
  }

  // Determine recommended action
  let recommendedAction = "none";
  const highFlags = flags.filter(f => f.severity === "high" || f.severity === "critical");
  if (highFlags.length >= 2) recommendedAction = "suspension_30d";
  else if (highFlags.length === 1) recommendedAction = "suspension_7d";
  else if (flags.length > 0) recommendedAction = "warning";

  // Get history
  const { data: history } = await supabase
    .from("fraud_events")
    .select("id, action_taken, created_at")
    .eq("expert_id", expertId);

  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
  const suspensions6m = (history || []).filter(
    (e: any) => e.created_at > sixMonthsAgo && e.action_taken?.includes("suspension")
  ).length;

  if (suspensions6m >= 3) recommendedAction = "ban";

  // Auto-insert fraud events for detected flags
  for (const flag of flags) {
    await supabase.from("fraud_events").insert({
      expert_id: expertId,
      event_type: flag.type,
      severity: flag.severity,
      details: flag.details,
      action_taken: SANCTION_MAP[flag.severity] || "none",
    });
  }

  // Update trust score
  if (flags.length > 0 && profile) {
    const penalty = flags.reduce((s: number, f: any) => {
      return s + (f.severity === "critical" ? 30 : f.severity === "high" ? 20 : f.severity === "medium" ? 10 : 5);
    }, 0);
    const newScore = Math.max(0, (profile.trust_score || 70) - penalty);
    await supabase.from("annotator_profiles").update({
      trust_score: newScore,
      trust_score_updated_at: new Date().toISOString(),
    }).eq("id", expertId);
  }

  return {
    expert_id: expertId,
    trust_score: profile?.trust_score || 70,
    flags,
    recommended_action: recommendedAction,
    history: {
      total_events: history?.length || 0,
      suspensions_6m: suspensions6m,
    },
  };
}
