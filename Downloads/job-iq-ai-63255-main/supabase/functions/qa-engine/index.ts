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

// ─── Krippendorff Alpha (single-item proxy, interval scale) ─────
//
// Krippendorff α requires multiple units to compute De across the full
// dataset. For a per-task / per-dimension agreement signal we use a
// variance-based proxy on the assumed 1-5 Likert scale:
//
//     α ≈ 1 - σ²(scores) / σ²_max(1..5)
//
// where σ²_max = ((scale_max - scale_min) / 2)² = 4 for 1-5.
//
//   • All N coders identical  → variance = 0 → α = 1
//   • Half give 1 / half give 5 → variance = 4 → α = 0
//   • Anything in between maps linearly into [0, 1].
//
// Returns null for fewer than 2 valid scores. Clamped to [-1, 1].
function krippendorffAlpha(scores: number[]): number | null {
  const valid = scores.filter(
    (s): s is number => s !== null && s !== undefined && typeof s === "number" && !Number.isNaN(s),
  );
  const n = valid.length;
  if (n < 2) return null;

  const mean = valid.reduce((a, b) => a + b, 0) / n;
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / n;

  // 1-5 Likert scale assumed (matches SCORING_DIMENSIONS in the client).
  const SCALE_RANGE = 4; // 5 - 1
  const maxVariance = (SCALE_RANGE / 2) ** 2; // = 4

  if (maxVariance === 0) return 1.0;

  const alpha = 1 - variance / maxVariance;
  const clamped = Math.max(-1, Math.min(1, alpha));
  return Math.round(clamped * 10000) / 10000;
}

// ─── Compute Alpha for a task across dimensions ─────────────────

interface AlphaReport {
  overall_alpha: number;
  dimensions: Record<string, { alpha: number | null; interpretation: string }>;
  flag_reasons: string[];
}

function computeAlphaForTask(
  annotations: any[],
  taskType: string
): AlphaReport {
  const dimensionAlphas: Record<
    string,
    { alpha: number | null; interpretation: string }
  > = {};
  const flagReasons: string[] = [];

  // Extract dimension scores from annotations
  const allDimensions = new Set<string>();
  for (const ann of annotations) {
    const dims =
      ann.dimensions ||
      ann.annotation_data?.dimensions ||
      ann.annotation_data?.scores_a;
    if (dims && typeof dims === "object") {
      Object.keys(dims).forEach((k) => allDimensions.add(k));
    }
  }

  if (allDimensions.size === 0) {
    // For non-dimensional types (preference, verdict), use agreement rate
    if (taskType === "preference_dpo" || taskType === "fact_checking") {
      const values = annotations.map(
        (a) =>
          a.preference ||
          a.verdict ||
          a.annotation_data?.preference ||
          a.annotation_data?.verdict
      );
      const unique = [...new Set(values)];
      const agreement = unique.length === 1 ? 1.0 : values.length <= 2 ? 0.5 : 0.3;

      return {
        overall_alpha: agreement,
        dimensions: {
          agreement: {
            alpha: agreement,
            interpretation: interpretAlpha(agreement),
          },
        },
        flag_reasons:
          agreement < 0.67 ? ["Désaccord sur le verdict/préférence"] : [],
      };
    }

    return {
      overall_alpha: 0.5,
      dimensions: {},
      flag_reasons: ["Pas de dimensions scorées"],
    };
  }

  // Compute alpha per dimension
  const alphaValues: number[] = [];

  for (const dim of allDimensions) {
    const scores: number[] = [];
    for (const ann of annotations) {
      const dims =
        ann.dimensions ||
        ann.annotation_data?.dimensions ||
        ann.annotation_data?.scores_a;
      if (dims && dims[dim] !== undefined) {
        const score =
          typeof dims[dim] === "object" ? dims[dim].score : dims[dim];
        if (typeof score === "number") scores.push(score);
      }
    }

    const alpha = scores.length >= 2 ? krippendorffAlpha(scores) : null;
    const interpretation = interpretAlpha(alpha);

    dimensionAlphas[dim] = { alpha, interpretation };

    if (alpha !== null) {
      alphaValues.push(alpha);
      if (interpretation === "unreliable") {
        flagReasons.push(`${dim}: α=${alpha} (insuffisant)`);
      }
    }
  }

  const overallAlpha =
    alphaValues.length > 0
      ? Math.round(
          (alphaValues.reduce((a, b) => a + b, 0) / alphaValues.length) * 10000
        ) / 10000
      : 0;

  return {
    overall_alpha: overallAlpha,
    dimensions: dimensionAlphas,
    flag_reasons: flagReasons,
  };
}

function interpretAlpha(alpha: number | null): string {
  if (alpha === null) return "insufficient_data";
  if (alpha >= 0.8) return "reliable";
  if (alpha >= 0.67) return "acceptable";
  return "unreliable";
}

// ─── Consensus computation ──────────────────────────────────────

function computeWeightedConsensus(annotations: any[], taskType: string): any {
  if (taskType === "preference_dpo" || taskType === "fact_checking") {
    // Majority vote
    const votes: Record<string, number> = {};
    for (const ann of annotations) {
      const vote =
        ann.preference ||
        ann.verdict ||
        ann.annotation_data?.preference ||
        ann.annotation_data?.verdict;
      if (vote) votes[vote] = (votes[vote] || 0) + 1;
    }
    const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { ...(annotations[0].annotation_data || {}), preference: winner, verdict: winner };
  }

  if (
    ["scoring", "comparison_ab", "conversation_rating"].includes(taskType)
  ) {
    // Average scores per dimension
    const dimensions: Record<string, number[]> = {};
    for (const ann of annotations) {
      const dims =
        ann.dimensions ||
        ann.annotation_data?.dimensions;
      if (dims) {
        for (const [key, val] of Object.entries(dims)) {
          if (!dimensions[key]) dimensions[key] = [];
          const score = typeof val === "object" ? (val as any).score : val;
          if (typeof score === "number") dimensions[key].push(score);
        }
      }
    }

    const averaged: Record<string, number> = {};
    for (const [key, scores] of Object.entries(dimensions)) {
      averaged[key] =
        Math.round(
          (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
        ) / 10;
    }

    return {
      dimensions: averaged,
      reasoning: annotations[0]?.reasoning || annotations[0]?.annotation_data?.reasoning,
    };
  }

  // Default: take first annotation
  return annotations[0]?.annotation_data || {};
}

// ─── LLM Adjudication ──────────────────────────────────────────

async function adjudicateWithLLM(
  task: any,
  annotations: any[],
  taskType: string
): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    // Fallback to weighted consensus if no AI available
    return computeWeightedConsensus(annotations, taskType);
  }

  const systemPrompt = `Tu es l'adjudicateur IA de STEF. Tu reçois une tâche d'annotation et les annotations de plusieurs experts humains.
Ton rôle: analyser les annotations, identifier les points de consensus et de divergence, et produire l'annotation finale optimale.

Règles:
- Privilégie la justesse factuelle sur le consensus
- Si les experts divergent, choisis la réponse la mieux argumentée
- Produis un JSON avec la structure exacte d'une annotation pour ce type de tâche (${taskType})
- Ajoute un champ "adjudication_reasoning" expliquant ton choix`;

  const userPrompt = `## Tâche
${JSON.stringify(task.task_content || task, null, 2)}

## Annotations des experts (${annotations.length})
${annotations
    .map(
      (a, i) =>
        `### Expert ${i + 1}\n${JSON.stringify(a.annotation_data || a, null, 2)}`
    )
    .join("\n\n")}

Produis l'annotation finale en JSON.`;

  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.0,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!response.ok) {
      console.error("Adjudication LLM error:", response.status);
      return computeWeightedConsensus(annotations, taskType);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}

    return computeWeightedConsensus(annotations, taskType);
  } catch (e) {
    console.error("Adjudication failed:", e);
    return computeWeightedConsensus(annotations, taskType);
  }
}

// ─── Post-QA actions ────────────────────────────────────────────

async function confirmExpertPayment(expertId: string, taskId: string) {
  try {
    const supabase = getServiceClient();
    await supabase
      .from("annotation_payments")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("annotator_id", expertId)
      .eq("task_id", taskId)
      .eq("status", "pending");
  } catch (e) {
    console.error("Failed to confirm payment:", e);
  }
}

async function updateExpertTrustScore(expertId: string) {
  try {
    const supabase = getServiceClient();

    // Count recent QA results for this expert
    const { data: recentAnnotations } = await supabase
      .from("expert_annotations")
      .select("task_id")
      .eq("expert_id", expertId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!recentAnnotations || recentAnnotations.length === 0) return;

    const taskIds = recentAnnotations.map((a) => a.task_id);

    // Get alpha reports for these tasks
    const { data: alphaReports } = await supabase
      .from("alpha_reports")
      .select("overall_alpha")
      .in("task_id", taskIds);

    if (!alphaReports || alphaReports.length === 0) return;

    const avgAlpha =
      alphaReports.reduce((sum, r) => sum + (r.overall_alpha || 0), 0) /
      alphaReports.length;

    // Update trust score (scaled 0-100)
    const trustScore = Math.round(Math.min(avgAlpha * 100, 100));

    await supabase
      .from("annotator_profiles")
      .update({
        trust_score: trustScore,
        trust_score_updated_at: new Date().toISOString(),
      })
      .eq("id", expertId);
  } catch (e) {
    console.error("Failed to update trust score:", e);
  }
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { action, task_id } = body;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let isAdmin = false;

    // Service role calls (from triggers/cron) are always allowed
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceCall = token === serviceKey || token === anonKey;

    if (isServiceCall) {
      isAdmin = true;
    } else if (authHeader?.startsWith("Bearer ey")) {
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id || null;
      if (userId) {
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .single();
        isAdmin = !!role;
      }
    }

    switch (action) {
      // ═══════════════════════════════════════════════════════════
      // RUN_QA: Full QA pipeline for a task
      // ═══════════════════════════════════════════════════════════
      case "run_qa":
      case "rerun_qa": {
        if (!task_id)
          return jsonError("task_id is required", 400);

        // Get all annotations
        const { data: annotations } = await supabase
          .from("expert_annotations")
          .select("*")
          .eq("task_id", task_id);

        if (!annotations || annotations.length < 2) {
          return jsonError(
            "Minimum 2 annotations requises pour le QA",
            400
          );
        }

        // Get task info
        const { data: task } = await supabase
          .from("annotation_tasks")
          .select("*")
          .eq("id", task_id)
          .single();

        if (!task) return jsonError("Tâche introuvable", 404);

        // Resolve project type: from task_content or by looking up the project
        let taskType = "scoring";
        const taskContent = task.task_content as any;
        if (taskContent?.annotation_type) {
          taskType = taskContent.annotation_type;
        } else if (task.source_id) {
          // Try looking up via annotation_items -> annotation_projects
          const { data: item } = await supabase
            .from("annotation_items")
            .select("project_id, annotation_projects(type)")
            .eq("id", task.source_id)
            .single();
          if (item?.annotation_projects) {
            taskType = (item.annotation_projects as any).type || "scoring";
          }
        }

        // ── Step 1: Compute Krippendorff Alpha ──
        const alphaReport = computeAlphaForTask(annotations, taskType);

        // ── Step 2: Adjudication ──
        let finalAnnotation: any;
        let resolutionMethod: string;

        if (alphaReport.overall_alpha >= 0.8) {
          finalAnnotation = computeWeightedConsensus(annotations, taskType);
          resolutionMethod = "unanimous";
        } else if (alphaReport.overall_alpha >= 0.67) {
          finalAnnotation = await adjudicateWithLLM(
            task,
            annotations,
            taskType
          );
          resolutionMethod = "adjudicated";
        } else {
          finalAnnotation = await adjudicateWithLLM(
            task,
            annotations,
            taskType
          );
          resolutionMethod = "flagged";
        }

        const qaStatus =
          alphaReport.overall_alpha >= 0.67 ? "qa_passed" : "qa_failed";

        // ── Step 3: Store results ──
        await supabase
          .from("annotation_tasks")
          .update({
            status: qaStatus === "qa_passed" ? "completed" : "qa_failed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", task_id);

        // Resolve the linked annotation_item id for downstream export.
        // task.source_id stores the item id when source_type='annotation_item'.
        const linkedItemId =
          task.source_type === "annotation_item"
            ? task.source_id
            : (task.task_content as any)?.item_id || null;

        await supabase.from("alpha_reports").upsert(
          {
            task_id,
            item_id: linkedItemId,
            overall_alpha: alphaReport.overall_alpha,
            dimension_alphas: alphaReport.dimensions,
            flag_human_review: alphaReport.overall_alpha < 0.67,
            flag_reasons: alphaReport.flag_reasons,
          },
          { onConflict: "task_id" }
        );

        // Mark the source annotation_item as completed so export-dataset
        // can pick it up. Only on QA pass — failed items stay open.
        if (qaStatus === "qa_passed" && linkedItemId) {
          await supabase
            .from("annotation_items")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", linkedItemId);
        }

        await supabase.from("final_annotations").upsert(
          {
            task_id,
            final_data: finalAnnotation,
            resolution_method: resolutionMethod,
            alpha: alphaReport.overall_alpha,
            source_annotation_ids: annotations.map((a: any) => a.id),
          },
          { onConflict: "task_id" }
        );

        // ── Step 4: Post-QA actions ──
        if (qaStatus === "qa_passed") {
          for (const ann of annotations) {
            await confirmExpertPayment(ann.expert_id, task_id);
          }
          await supabase.rpc("increment_completed_tasks", {
            p_project_id: task.source_id,
          });
        } else {
          await supabase.from("human_review_queue").upsert(
            {
              task_id,
              reason: alphaReport.flag_reasons,
              alpha: alphaReport.overall_alpha,
              priority:
                alphaReport.overall_alpha < 0.5 ? "high" : "medium",
              status: "pending",
            },
            { onConflict: "task_id" }
          );
        }

        // Update expert trust scores
        for (const ann of annotations) {
          await updateExpertTrustScore(ann.expert_id);
        }

        return jsonOk({
          task_id,
          qa_status: qaStatus,
          alpha: alphaReport.overall_alpha,
          dimensions: alphaReport.dimensions,
          resolution_method: resolutionMethod,
          flag_human_review: alphaReport.overall_alpha < 0.67,
        });
      }

      // ═══════════════════════════════════════════════════════════
      // MANUAL_VALIDATE: Admin validates a flagged task
      // ═══════════════════════════════════════════════════════════
      case "manual_validate": {
        if (!isAdmin && !isServiceCall)
          return jsonError("Admin access required", 403);

        await supabase
          .from("annotation_tasks")
          .update({ status: "completed" })
          .eq("id", task_id);

        await supabase
          .from("human_review_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("task_id", task_id);

        const { data: annotations } = await supabase
          .from("expert_annotations")
          .select("expert_id")
          .eq("task_id", task_id);

        for (const ann of annotations || []) {
          await confirmExpertPayment(ann.expert_id, task_id);
        }

        return jsonOk({ validated: true });
      }

      // ═══════════════════════════════════════════════════════════
      // MANUAL_REJECT: Admin rejects and re-queues a task
      // ═══════════════════════════════════════════════════════════
      case "manual_reject": {
        if (!isAdmin && !isServiceCall)
          return jsonError("Admin access required", 403);

        await supabase
          .from("annotation_tasks")
          .update({ status: "pending" })
          .eq("id", task_id);

        await supabase
          .from("human_review_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("task_id", task_id);

        await supabase
          .from("expert_annotations")
          .delete()
          .eq("task_id", task_id);

        return jsonOk({ rejected: true, redistributed: true });
      }

      default:
        return jsonError("Action inconnue", 400);
    }
  } catch (error: any) {
    console.error("[qa-engine] Error:", error);
    return jsonError(error.message || "Erreur interne", 500);
  }
});

// ─── Helpers ────────────────────────────────────────────────────

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
