import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Rate limiter ────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = { max: 30, windowMs: 60_000 };

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT.max;
}

// ── Types ───────────────────────────────────────────────────

interface AlphaResult {
  alpha: number;
  interpretation: "reliable" | "acceptable" | "unreliable" | "insufficient_data";
  observed_disagreement: number;
  expected_disagreement: number;
  n_annotators: number;
  n_items: number;
  n_valid_pairs: number;
}

interface DimensionAlphaReport {
  task_id: string;
  timestamp: string;
  overall_alpha: number;
  dimensions: Record<string, AlphaResult>;
  flag_human_review: boolean;
  flag_reasons: string[];
}

const STEF_DIMENSIONS = [
  "correctness", "security", "code_quality", "reasoning_depth",
  "edge_case_handling", "documentation_quality", "performance_awareness",
  "error_handling", "communication_clarity", "overall_preference_dpo",
] as const;

const THRESHOLDS = {
  reliable: 0.80,
  acceptable: 0.67,
  unreliable: 0.67,
  critical_dimensions: ["correctness", "security"],
};

// ── Input validation ────────────────────────────────────────

const TaskAlphaSchema = z.object({
  action: z.literal("task_alpha"),
  task_id: z.string().uuid(),
});

const BatchAlphaSchema = z.object({
  action: z.literal("batch_alpha"),
  limit: z.number().int().min(1).max(1000).optional().default(100),
});

const DriftMonitorSchema = z.object({
  action: z.literal("drift_monitor"),
  window_size: z.number().int().min(10).max(500).optional().default(50),
});

const RequestSchema = z.discriminatedUnion("action", [
  TaskAlphaSchema,
  BatchAlphaSchema,
  DriftMonitorSchema,
]);

// ── Krippendorff's Alpha Algorithm ──────────────────────────

function computeKrippendorffAlpha(
  data: (number | null)[][],
  metric: "nominal" | "ordinal" | "interval" | "ratio" = "ordinal"
): AlphaResult {
  const nAnnotators = data.length;
  const nItems = data[0]?.length ?? 0;

  if (nAnnotators < 2 || nItems < 1) {
    return {
      alpha: 0, interpretation: "insufficient_data",
      observed_disagreement: 0, expected_disagreement: 0,
      n_annotators: nAnnotators, n_items: nItems, n_valid_pairs: 0,
    };
  }

  const itemValues: number[][] = [];
  for (let item = 0; item < nItems; item++) {
    const values: number[] = [];
    for (let ann = 0; ann < nAnnotators; ann++) {
      const val = data[ann][item];
      if (val !== null && val !== undefined) values.push(val);
    }
    itemValues.push(values);
  }

  const allValues = itemValues.flat();
  const totalPairable = allValues.length;

  if (totalPairable < 2) {
    return {
      alpha: 0, interpretation: "insufficient_data",
      observed_disagreement: 0, expected_disagreement: 0,
      n_annotators: nAnnotators, n_items: nItems, n_valid_pairs: 0,
    };
  }

  function distanceFunction(v1: number, v2: number): number {
    switch (metric) {
      case "nominal": return v1 === v2 ? 0 : 1;
      case "ordinal":
      case "interval": return (v1 - v2) ** 2;
      case "ratio": {
        const denom = v1 + v2;
        return denom === 0 ? 0 : ((v1 - v2) / denom) ** 2;
      }
    }
  }

  let totalObservedPairs = 0;
  let Do_normalized = 0;

  for (let item = 0; item < nItems; item++) {
    const values = itemValues[item];
    const mu = values.length;
    if (mu < 2) continue;

    let itemDo = 0;
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        itemDo += distanceFunction(values[i], values[j]);
        totalObservedPairs++;
      }
    }
    Do_normalized += (1 / (mu - 1)) * itemDo * 2;
  }
  Do_normalized = Do_normalized / totalPairable;

  const valueCounts: Record<number, number> = {};
  for (const v of allValues) {
    valueCounts[v] = (valueCounts[v] || 0) + 1;
  }

  let De = 0;
  const valueList = Object.keys(valueCounts).map(Number);
  for (let i = 0; i < valueList.length; i++) {
    for (let j = i + 1; j < valueList.length; j++) {
      De += valueCounts[valueList[i]] * valueCounts[valueList[j]] * distanceFunction(valueList[i], valueList[j]);
    }
  }
  De = (2 * De) / (totalPairable * (totalPairable - 1));

  let alpha: number;
  if (De === 0) {
    alpha = 1.0;
  } else {
    alpha = 1 - (Do_normalized / De);
  }
  alpha = Math.max(-1, Math.min(1, alpha));

  let interpretation: AlphaResult["interpretation"];
  if (totalObservedPairs < 3) interpretation = "insufficient_data";
  else if (alpha >= THRESHOLDS.reliable) interpretation = "reliable";
  else if (alpha >= THRESHOLDS.acceptable) interpretation = "acceptable";
  else interpretation = "unreliable";

  return {
    alpha: Math.round(alpha * 10000) / 10000,
    interpretation,
    observed_disagreement: Math.round(Do_normalized * 10000) / 10000,
    expected_disagreement: Math.round(De * 10000) / 10000,
    n_annotators: nAnnotators,
    n_items: nItems,
    n_valid_pairs: totalObservedPairs,
  };
}

// ── Dimension Alpha Report ──────────────────────────────────

function computeDimensionAlphaReport(
  task_id: string,
  annotations: Array<{ annotator_id: string; dimensions: Record<string, number> }>
): DimensionAlphaReport {
  const dimensionResults: Record<string, AlphaResult> = {};
  const flagReasons: string[] = [];
  let alphaSum = 0;
  let alphaCount = 0;

  const numericDimensions = STEF_DIMENSIONS.filter(d => d !== "overall_preference_dpo");

  for (const dim of numericDimensions) {
    const data: (number | null)[][] = annotations.map(ann => [ann.dimensions[dim] ?? null]);
    const result = computeKrippendorffAlpha(data, "ordinal");
    dimensionResults[dim] = result;

    if (result.interpretation !== "insufficient_data") {
      alphaSum += result.alpha;
      alphaCount++;
    }

    if (THRESHOLDS.critical_dimensions.includes(dim) && result.alpha < THRESHOLDS.reliable) {
      flagReasons.push(`${dim}: α=${result.alpha} (< ${THRESHOLDS.reliable})`);
    }
    if (result.alpha < THRESHOLDS.unreliable) {
      flagReasons.push(`${dim}: α=${result.alpha} — unreliable`);
    }
  }

  // DPO nominal
  const dpoData: (number | null)[][] = annotations.map(ann => {
    const dpo = ann.dimensions["overall_preference_dpo"];
    if (dpo === undefined || dpo === null) return [null];
    const encoded = typeof dpo === "string"
      ? ({ A: 0, B: 1, TIE: 2 } as Record<string, number>)[dpo as string] ?? null
      : dpo;
    return [encoded];
  });
  dimensionResults["overall_preference_dpo"] = computeKrippendorffAlpha(dpoData, "nominal");

  const overallAlpha = alphaCount > 0 ? alphaSum / alphaCount : 0;

  return {
    task_id,
    timestamp: new Date().toISOString(),
    overall_alpha: Math.round(overallAlpha * 10000) / 10000,
    dimensions: dimensionResults,
    flag_human_review: flagReasons.length > 0 || overallAlpha < THRESHOLDS.unreliable,
    flag_reasons: flagReasons,
  };
}

// ── Batch Alpha ─────────────────────────────────────────────

function computeBatchAlpha(
  tasks: Array<{ task_id: string; annotations: Array<{ annotator_id: string; dimensions: Record<string, number> }> }>
): Record<string, AlphaResult> {
  const results: Record<string, AlphaResult> = {};
  const numericDimensions = STEF_DIMENSIONS.filter(d => d !== "overall_preference_dpo");

  for (const dim of numericDimensions) {
    const allAnnotatorIds = [...new Set(tasks.flatMap(t => t.annotations.map(a => a.annotator_id)))];
    const data: (number | null)[][] = allAnnotatorIds.map(annId =>
      tasks.map(task => {
        const ann = task.annotations.find(a => a.annotator_id === annId);
        return ann?.dimensions[dim] ?? null;
      })
    );
    results[dim] = computeKrippendorffAlpha(data, "ordinal");
  }
  return results;
}

// ── Main handler ────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (parsed.data.action) {
      // ─── ACTION 1: Task Alpha ───
      case "task_alpha": {
        const { task_id } = parsed.data;

        const { data: annotations, error } = await supabase
          .from("annotations")
          .select("annotator_id, value")
          .eq("item_id", task_id);

        if (error) throw new Error(`DB error: ${error.message}`);
        if (!annotations || annotations.length < 2) {
          return new Response(JSON.stringify({
            error: "Minimum 2 annotations requises",
            annotations_count: annotations?.length ?? 0,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Extract dimensions from annotation value
        const mappedAnnotations = annotations.map((a: any) => ({
          annotator_id: a.annotator_id,
          dimensions: (typeof a.value === "object" && a.value?.dimensions)
            ? Object.fromEntries(
                (a.value.dimensions as any[]).map((d: any) => [d.name, d.score])
              )
            : {},
        }));

        const report = computeDimensionAlphaReport(task_id, mappedAnnotations);

        await supabase.from("alpha_reports").upsert({
          task_id,
          overall_alpha: report.overall_alpha,
          dimension_alphas: report.dimensions,
          flag_human_review: report.flag_human_review,
          flag_reasons: report.flag_reasons,
          computed_at: report.timestamp,
        }, { onConflict: "task_id" });

        if (report.flag_human_review) {
          await supabase.from("human_review_queue").upsert({
            task_id,
            reason: report.flag_reasons,
            alpha: report.overall_alpha,
            priority: report.overall_alpha < 0.5 ? "high" : "medium",
            status: "pending",
          });
        }

        return new Response(JSON.stringify(report), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── ACTION 2: Batch Alpha ───
      case "batch_alpha": {
        const { limit } = parsed.data;

        const { data: recentItems, error } = await supabase
          .from("annotation_items")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw new Error(`DB error: ${error.message}`);
        if (!recentItems || recentItems.length === 0) {
          return new Response(JSON.stringify({ error: "Aucune annotation trouvée" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const taskIds = recentItems.map((i: any) => i.id);
        const { data: allAnnotations, error: annError } = await supabase
          .from("annotations")
          .select("item_id, annotator_id, value")
          .in("item_id", taskIds);

        if (annError) throw new Error(`DB error: ${annError.message}`);

        const taskMap = new Map<string, Array<{ annotator_id: string; dimensions: Record<string, number> }>>();
        for (const a of (allAnnotations || [])) {
          const dims = (typeof a.value === "object" && (a.value as any)?.dimensions)
            ? Object.fromEntries(
                ((a.value as any).dimensions as any[]).map((d: any) => [d.name, d.score])
              )
            : {};
          if (!taskMap.has(a.item_id)) taskMap.set(a.item_id, []);
          taskMap.get(a.item_id)!.push({ annotator_id: a.annotator_id, dimensions: dims });
        }

        const tasks = [...taskMap.entries()]
          .filter(([_, anns]) => anns.length >= 2)
          .map(([task_id, annotations]) => ({ task_id, annotations }));

        const batchResults = computeBatchAlpha(tasks);

        const alphas = Object.values(batchResults)
          .filter(r => r.interpretation !== "insufficient_data")
          .map(r => r.alpha);
        const meanAlpha = alphas.length > 0
          ? alphas.reduce((a, b) => a + b, 0) / alphas.length
          : 0;

        const response = {
          batch_size: tasks.length,
          mean_alpha: Math.round(meanAlpha * 10000) / 10000,
          dimensions: batchResults,
          computed_at: new Date().toISOString(),
        };

        await supabase.from("alpha_history").insert({
          batch_size: tasks.length,
          mean_alpha: meanAlpha,
          dimension_alphas: batchResults,
          computed_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── ACTION 3: Drift Monitor ───
      case "drift_monitor": {
        const { data: history, error } = await supabase
          .from("alpha_history")
          .select("*")
          .order("computed_at", { ascending: false })
          .limit(2);

        if (error) throw new Error(`DB error: ${error.message}`);
        if (!history || history.length < 2) {
          return new Response(JSON.stringify({
            status: "insufficient_history",
            message: "Besoin d'au moins 2 points de mesure",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const [current, previous] = history;
        const drift: Record<string, { current: number; previous: number; delta: number; drifting: boolean }> = {};
        let hasDrift = false;

        for (const dim of Object.keys(current.dimension_alphas || {})) {
          const cur = (current.dimension_alphas as any)?.[dim]?.alpha ?? 0;
          const prev = (previous.dimension_alphas as any)?.[dim]?.alpha ?? 0;
          const delta = cur - prev;
          const drifting = delta < -0.05;
          drift[dim] = { current: cur, previous: prev, delta, drifting };
          if (drifting) hasDrift = true;
        }

        const response = {
          status: hasDrift ? "drift_detected" : "stable",
          current_mean_alpha: current.mean_alpha,
          previous_mean_alpha: previous.mean_alpha,
          delta: current.mean_alpha - previous.mean_alpha,
          dimensions: drift,
          recommendation: hasDrift
            ? "Recalibration recommandée. Lancer optimize-annotation-prompts."
            : "Pipeline stable. Aucune action requise.",
          computed_at: new Date().toISOString(),
        };

        if (hasDrift) {
          await supabase.from("drift_alerts").insert({
            mean_alpha_current: current.mean_alpha,
            mean_alpha_previous: previous.mean_alpha,
            drifting_dimensions: Object.entries(drift)
              .filter(([_, v]) => v.drifting)
              .map(([k]) => k),
            created_at: new Date().toISOString(),
          });
        }

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Action inconnue" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("compute-krippendorff-alpha error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
