import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPTIMIZER_MODEL = "google/gemini-2.5-pro";

const SYSTEM_PROMPT_OPTIMIZER = `Tu es l'optimiseur de prompts du pipeline STEF, inspiré de DSPy.

Tu reçois:
1. Le prompt annotateur actuel
2. Des exemples gold (tâche + réponse + annotation humaine de référence)
3. Les métriques d'écart agrégées

Tu produis un prompt optimisé qui minimise l'écart avec les annotations gold.

Méthodologie:
1. Identifier les dimensions à écart systématiquement élevé
2. Identifier les patterns d'erreur (sur/sous-scoring, incohérences)
3. Ajuster les descriptions de scoring, ajouter des clarifications
4. Sélectionner les meilleurs exemples ICL

RÈGLES:
- Ne JAMAIS modifier le format JSON de sortie du prompt annotateur
- Conserver les dimensions existantes
- Prioriser les exemples ICL couvrant les cas problématiques
- Le prompt optimisé doit être auto-suffisant

Réponds en JSON:
{"optimization_reasoning":"...","changes_made":["..."],"optimized_prompt":"<prompt complet>","selected_icl_examples":[{"task":"...","response":"...","annotation":{},"selection_reason":"..."}],"expected_improvement":{"target_dimensions":["..."],"estimated_error_reduction":"..."}}`;

// ─── Helpers ────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function generateVersion(): string {
  const now = new Date();
  return `v2.${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.${Date.now() % 10000}`;
}

async function callLLM(
  apiKey: string,
  system: string,
  user: string
): Promise<any> {
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPTIMIZER_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.0,
        max_tokens: 16384,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM error ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Extract JSON robustly
  try {
    return JSON.parse(content);
  } catch {
    /* continue */
  }
  const match = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = content.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") depth--;
      if (depth === 0) return JSON.parse(content.slice(start, i + 1));
    }
  }
  throw new Error("No valid JSON in optimizer response");
}

function computeAggregateMetrics(
  goldItems: any[]
): Record<string, any> {
  const alphas = goldItems
    .map((i) => i.predicted_alpha)
    .filter((a) => a != null && a !== undefined);

  return {
    mean_alpha: alphas.length
      ? Math.round(
          (alphas.reduce((a: number, b: number) => a + b, 0) / alphas.length) *
            10000
        ) / 10000
      : 0,
    min_alpha: alphas.length ? Math.min(...alphas) : 0,
    max_alpha: alphas.length ? Math.max(...alphas) : 0,
    total_samples: goldItems.length,
    low_alpha_count: alphas.filter((a) => a < 0.67).length,
  };
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();

    // Auth: admin or service role only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Verify admin
    const token = authHeader.slice(7);
    const isServiceRole = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!isServiceRole) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const { data: { user }, error: authError } =
        await supabaseAuth.auth.getUser(token);
      if (authError || !user) return jsonError("Invalid token", 401);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) return jsonError("Admin access required", 403);
    }

    // ── 1. Fetch gold annotations (manually validated) ──
    const { data: reviewed } = await supabase
      .from("final_annotations")
      .select("*, annotation_tasks(task_content)")
      .eq("resolution_method", "manual")
      .order("created_at", { ascending: false })
      .limit(50);

    // Also fetch items from human_review_queue that are completed
    const { data: reviewedQueue } = await supabase
      .from("human_review_queue")
      .select("*")
      .eq("status", "completed")
      .not("alpha", "is", null)
      .order("completed_at", { ascending: false })
      .limit(50);

    const goldItems = [
      ...(reviewed || []).map((item: any) => ({
        task_content: item.annotation_tasks?.task_content,
        gold: item.final_data,
        predicted_alpha: item.alpha,
      })),
      ...(reviewedQueue || []).map((item: any) => ({
        task_id: item.task_id,
        gold: item.reason,
        predicted_alpha: item.alpha,
      })),
    ];

    if (goldItems.length < 5) {
      return jsonOk({
        status: "skipped",
        reason: "Not enough gold data for optimization (need ≥5)",
        gold_count: goldItems.length,
      });
    }

    // ── 2. Get current active prompt ──
    const { data: activePrompt } = await supabase
      .from("prompt_versions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentPrompt =
      activePrompt?.prompt_text || "Default annotator prompt v2.0";

    // ── 3. Compute aggregate metrics ──
    const metrics = computeAggregateMetrics(goldItems);

    // ── 4. Get ICL candidates ──
    const { data: iclPool } = await supabase
      .from("adjudications")
      .select("*")
      .gte("confidence", 0.9)
      .order("created_at", { ascending: false })
      .limit(30);

    // ── 5. Call optimizer ──
    const optimizerInput = {
      current_prompt: currentPrompt,
      gold_examples: goldItems.slice(0, 20),
      aggregate_metrics: metrics,
      icl_candidate_pool: (iclPool || []).slice(0, 15),
      target_icl_count: 10,
    };

    const optimizedResult = await callLLM(
      LOVABLE_API_KEY,
      SYSTEM_PROMPT_OPTIMIZER,
      JSON.stringify(optimizerInput)
    );

    // ── 6. Store new prompt version ──
    const version = generateVersion();
    const { error: insertError } = await supabase
      .from("prompt_versions")
      .insert({
        version,
        prompt_text: optimizedResult.optimized_prompt || currentPrompt,
        icl_examples: optimizedResult.selected_icl_examples || [],
        optimization_reasoning:
          optimizedResult.optimization_reasoning || "",
        changes_made: optimizedResult.changes_made || [],
        status: "candidate",
        performance_metrics: metrics,
      });

    if (insertError) throw insertError;

    return jsonOk({
      status: "optimized",
      version,
      changes_made: optimizedResult.changes_made?.length || 0,
      overall_metrics: metrics,
      expected_improvement: optimizedResult.expected_improvement,
      message:
        "Nouveau prompt candidat généré. Lancez un A/B test pour valider.",
    });
  } catch (e: any) {
    console.error("optimize-annotation-prompts error:", e);
    return jsonError(e.message || "Internal error", 500);
  }
});

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
