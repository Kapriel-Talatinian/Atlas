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
const RATE_LIMIT = { max: 20, windowMs: 60_000 };

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

// ── Input validation ────────────────────────────────────────
const RequestBody = z.object({
  task_id: z.string().uuid(),
  task_prompt: z.string().min(10).max(50_000),
  candidate_response: z.string().min(1).max(100_000),
  candidate_id: z.string().uuid(),
  force_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
  project_id: z.string().uuid().optional(),
});

// ── System annotator profile IDs for AI models (FK-safe) ────
const MODEL_ANNOTATOR_IDS: Record<string, string> = {
  // Standard (Lovable Gateway)
  "google/gemini-2.5-flash-lite": "a0000000-0000-0000-0000-000000000001",
  "google/gemini-2.5-flash": "a0000000-0000-0000-0000-000000000002",
  "google/gemini-2.5-pro": "a0000000-0000-0000-0000-000000000003",
  "openai/gpt-5": "a0000000-0000-0000-0000-000000000004",
  // Sovereign (Mistral)
  "mistral-small-latest": "a0000000-0000-0000-0000-000000000005",
  "mistral-medium-latest": "a0000000-0000-0000-0000-000000000006",
  "mistral-large-latest": "a0000000-0000-0000-0000-000000000007",
};

const PIPELINE_CONFIG = {
  auto_validate_confidence: 0.95,
  min_alpha_threshold: 0.67,
};

// ── System prompts ──────────────────────────────────────────

const SYSTEM_PROMPT_PII = `Tu es le scanner PII du pipeline STEF. Analyse le texte et identifie toute information personnelle identifiable.

CATÉGORIES: NOM, EMAIL, TÉLÉPHONE, ADRESSE, IDENTIFIANT, FINANCIER, URL_PERSO, ENTREPRISE, DATE_NAISSANCE

RÈGLES:
- Ne PAS anonymiser les noms de technologies, frameworks ou langages
- Ne PAS anonymiser les noms d'entreprises utilisés comme contexte technique (ex: "l'API de Stripe")

Réponds UNIQUEMENT en JSON:
{"pii_detected":boolean,"items":[{"category":"...","original":"...","replacement":"...","confidence":0.0-1.0}],"sanitized_text":"..."}`;

const SYSTEM_PROMPT_TRIAGE = `Tu es le routeur de complexité du pipeline STEF.

NIVEAU 1 (Simple): QCM, questions factuelles, syntaxe simple → tier 1
NIVEAU 2 (Intermédiaire): Réponse courte avec raisonnement, code <20 lignes → tier 1+2
NIVEAU 3 (Complexe): Code review >20 lignes, architecture, sécurité → tier 2+3+4

En cas de doute, niveau supérieur. Sécurité = TOUJOURS niveau 3.

Réponds UNIQUEMENT en JSON:
{"complexity_level":1|2|3,"reasoning":"...","tiers_to_use":[1]|[1,2]|[2,3,4],"require_adjudication":boolean,"estimated_annotation_cost_usd":float}`;

const SYSTEM_PROMPT_ANNOTATOR = `Tu es un annotateur expert STEF pour le dataset RLHF.

Évalue sur 10 dimensions (0-5 chacune):
1. correctness — Techniquement correct ?
2. security — Sécurité considérée ?
3. code_quality — Propre, lisible, maintenable ?
4. reasoning_depth — Raisonnement approfondi ?
5. edge_case_handling — Cas limites traités ?
6. documentation_quality — Bien documenté ?
7. performance_awareness — Performance considérée ?
8. error_handling — Erreurs gérées ?
9. communication_clarity — Explication claire ?
10. overall_preference_dpo — "A" (cette réponse), "B" (alternative), ou "TIE"

RÈGLES:
- Raisonne AVANT de scorer (chain-of-thought)
- Jamais 5/5 partout ni 0/5 partout (sauf réponse vide)
- Confiance: 0.95+ = évident, 0.7-0.95 = clair, <0.7 = incertain
- Cohérence: correctness=5 ≠ error_handling=0

Réponds UNIQUEMENT en JSON:
{"reasoning":"<min 3 phrases>","dimensions":{"correctness":0-5,"security":0-5,"code_quality":0-5,"reasoning_depth":0-5,"edge_case_handling":0-5,"documentation_quality":0-5,"performance_awareness":0-5,"error_handling":0-5,"communication_clarity":0-5,"overall_preference_dpo":"A|B|TIE"},"confidence":0.0-1.0}`;

const SYSTEM_PROMPT_ADJUDICATOR = `Tu es l'adjudicateur principal du pipeline RLHF STEF.

Tu reçois N annotations de modèles différents sur la même tâche. Tu dois:
1. Analyser concordances/divergences
2. Pondérer par confiance: score_final = Σ(score_i × conf_i) / Σ(conf_i)
3. Calculer Krippendorff's alpha simplifié
4. Résoudre les désaccords

Méthode:
- Unanime (écart=0) → conserver
- Accord fort (écart≤1) → moyenne pondérée
- Désaccord modéré (écart=2) → analyser raisonnements, trancher
- Désaccord fort (écart≥3) → flag human review

Flag human_review si α < 0.67 ou désaccord fort sur correctness/security.

Réponds UNIQUEMENT en JSON:
{"adjudication_reasoning":"<min 5 phrases>","final_dimensions":{...},"agreement_scores":{...},"krippendorff_alpha":float,"resolution_method":"unanimous|majority|adjudicated","flag_human_review":boolean,"flag_reasons":["..."]}`;

// ── LLM caller via router ───────────────────────────────────

async function callLLMViaRouter(
  supabaseUrl: string,
  serviceKey: string,
  tier: number,
  systemPrompt: string,
  userMessage: string,
  projectId?: string,
  purpose: string = "annotation",
): Promise<any> {
  const routerUrl = `${supabaseUrl}/functions/v1/llm-router`;

  const response = await fetch(routerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "call",
      tier,
      system_prompt: systemPrompt,
      user_prompt: userMessage,
      temperature: 0.0,
      max_tokens: 16384,
      response_format: "json",
      metadata: {
        project_id: projectId,
        purpose,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM Router error ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json();

  // Parse JSON from content
  if (data.parsed_json) return { ...data.parsed_json, _model: data.model_id, _provider: data.provider };

  const content = data.content || "";
  return { ...extractJSON(content), _model: data.model_id, _provider: data.provider };
}

function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch { /* continue */ }
  }
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON found in LLM response");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    if (depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { throw new Error("Invalid JSON in LLM response"); }
    }
  }
  throw new Error("Unclosed JSON in LLM response");
}

function getAnnotatorId(modelId: string): string {
  return MODEL_ANNOTATOR_IDS[modelId] || MODEL_ANNOTATOR_IDS["google/gemini-2.5-flash"];
}

function getTiersForLevel(level: number): number[] {
  switch (level) {
    case 1: return [1];
    case 2: return [1, 2];
    case 3: return [2, 3, 4];
    default: return [2, 3];
  }
}

// ── Main handler ────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = RequestBody.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { task_id, task_prompt, candidate_response, candidate_id, force_level, project_id } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve project_id for mode routing
    const effectiveProjectId = project_id || task_id;

    // ── STEP 1: PII Scan (tier 1) ──
    let cleanResponse = candidate_response;
    try {
      const piiResult = await callLLMViaRouter(
        supabaseUrl, supabaseServiceKey, 1,
        SYSTEM_PROMPT_PII, candidate_response,
        effectiveProjectId, "pii_scan",
      );

      if (piiResult.pii_detected) {
        cleanResponse = piiResult.sanitized_text || candidate_response;
        await supabase.from("pii_logs").insert({
          task_id,
          candidate_id,
          items_count: piiResult.items?.length || 0,
          categories: piiResult.items?.map((i: any) => i.category) || [],
        });
      }
    } catch (e) {
      console.error("PII scan failed, proceeding with original:", e);
    }

    // ── STEP 2: Triage (tier 1) ──
    let complexityLevel: number;
    let tiersToUse: number[];
    let requireAdjudication: boolean;

    if (force_level) {
      complexityLevel = force_level;
      tiersToUse = getTiersForLevel(force_level);
      requireAdjudication = force_level >= 2;
    } else {
      try {
        const triageResult = await callLLMViaRouter(
          supabaseUrl, supabaseServiceKey, 1,
          SYSTEM_PROMPT_TRIAGE,
          JSON.stringify({ task_prompt, candidate_response: cleanResponse.slice(0, 2000) }),
          effectiveProjectId, "triage",
        );
        complexityLevel = triageResult.complexity_level || 2;
        tiersToUse = triageResult.tiers_to_use || getTiersForLevel(complexityLevel);
        requireAdjudication = triageResult.require_adjudication ?? complexityLevel >= 2;
      } catch (e) {
        console.error("Triage failed, defaulting to level 2:", e);
        complexityLevel = 2;
        tiersToUse = getTiersForLevel(2);
        requireAdjudication = true;
      }
    }

    // ── STEP 3: Multi-model annotation via router ──
    const annotatorInput = `## TÂCHE\n${task_prompt}\n\n## RÉPONSE DU CANDIDAT\n${cleanResponse}\n\nAnalyse cette réponse et produis ton annotation en JSON.`;

    const annotationPromises = tiersToUse.map(async (tier) => {
      try {
        const result = await callLLMViaRouter(
          supabaseUrl, supabaseServiceKey, tier,
          SYSTEM_PROMPT_ANNOTATOR, annotatorInput,
          effectiveProjectId, "annotation",
        );
        return {
          model_id: result._model || `tier_${tier}`,
          system_annotator_id: getAnnotatorId(result._model || ""),
          task_id,
          dimensions: result.dimensions,
          confidence: result.confidence || 0.5,
          reasoning: result.reasoning || "",
          timestamp: new Date().toISOString(),
        };
      } catch (e) {
        console.error(`Annotation failed for tier ${tier}:`, e);
        return null;
      }
    });

    const annotationResults = (await Promise.all(annotationPromises)).filter(Boolean);

    if (annotationResults.length === 0) {
      return new Response(
        JSON.stringify({ error: "All annotation models failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── STEP 3B: Auto-validation for level 1 ──
    if (
      complexityLevel === 1 &&
      annotationResults.length === 1 &&
      annotationResults[0]!.confidence >= PIPELINE_CONFIG.auto_validate_confidence
    ) {
      const annotation = annotationResults[0]!;
      await supabase.from("annotations").insert({
        item_id: task_id,
        annotator_id: annotation.system_annotator_id,
        project_id: task_id,
        value: {
          type: "rating",
          dimensions: Object.entries(annotation.dimensions)
            .filter(([k]) => k !== "overall_preference_dpo")
            .map(([name, score]) => ({ name, score: score as number })),
        },
        confidence: "high",
        time_spent: 0,
        flagged: false,
        guidelines_version: "v2.0-auto",
        comment: annotation.reasoning,
      });

      return new Response(
        JSON.stringify({
          status: "auto_validated",
          complexity_level: complexityLevel,
          models_used: 1,
          annotation: annotation.dimensions,
          confidence: annotation.confidence,
          human_review_flagged: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── STEP 4: Adjudication (tier 3) ──
    const adjInput = {
      task_id,
      task_prompt,
      candidate_response: cleanResponse.slice(0, 10000),
      annotations: annotationResults,
    };

    const adjResult = await callLLMViaRouter(
      supabaseUrl, supabaseServiceKey, 3,
      SYSTEM_PROMPT_ADJUDICATOR, JSON.stringify(adjInput),
      effectiveProjectId, "adjudication",
    );

    // ── STEP 5: Store final annotation ──
    const adjudicatorAnnotatorId = getAnnotatorId(adjResult._model || "google/gemini-2.5-pro");
    await supabase.from("adjudications").insert({
      item_id: task_id,
      adjudicator_id: adjudicatorAnnotatorId,
      final_value: adjResult.final_dimensions || {},
      method: adjResult.resolution_method || "adjudicated",
      justification: adjResult.adjudication_reasoning || "",
      confidence: adjResult.krippendorff_alpha || 0,
      original_annotation_ids: annotationResults.map((a) => a!.system_annotator_id),
    });

    // ── STEP 6: Flag for human review if needed ──
    if (adjResult.flag_human_review) {
      await supabase.from("human_review_queue").insert({
        task_id,
        candidate_id,
        reason: adjResult.flag_reasons || [],
        alpha: adjResult.krippendorff_alpha || 0,
        priority: (adjResult.krippendorff_alpha || 0) < 0.5 ? "high" : "medium",
        status: "pending",
      });
    }

    return new Response(
      JSON.stringify({
        status: "adjudicated",
        complexity_level: complexityLevel,
        models_used: tiersToUse.length,
        final_dimensions: adjResult.final_dimensions,
        krippendorff_alpha: adjResult.krippendorff_alpha,
        resolution_method: adjResult.resolution_method,
        human_review_flagged: adjResult.flag_human_review || false,
        agreement_scores: adjResult.agreement_scores,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("annotation-engine-v2 error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
