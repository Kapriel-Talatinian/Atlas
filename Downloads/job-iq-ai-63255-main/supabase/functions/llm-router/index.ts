import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Constants ──────────────────────────────────────────────────

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MISTRAL_DEFAULT_URL = "https://api.mistral.ai/v1/chat/completions";

// ─── Interfaces ─────────────────────────────────────────────────

interface ModelConfig {
  mode: string;
  tier: number;
  provider: string;
  model_id: string;
  display_name: string;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  max_tokens: number;
  temperature: number;
  timeout_ms: number;
}

interface LLMRequest {
  action: "call" | "call_multiple" | "triage";
  system_prompt: string;
  user_prompt: string;
  complexity_level?: 1 | 2 | 3;
  model_id?: string;
  tier?: number;
  response_format?: "json" | "text";
  temperature?: number;
  max_tokens?: number;
  metadata?: {
    task_id?: string;
    project_id?: string;
    purpose: string;
  };
}

interface LLMResponse {
  model_id: string;
  model_name: string;
  provider: string;
  mode: string;
  content: string;
  parsed_json?: any;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  latency_ms: number;
  cached: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ─── Static fallback configs (used when DB is unreachable) ─────

const STATIC_CONFIGS: Record<string, ModelConfig[]> = {
  standard: [
    { mode: "standard", tier: 1, provider: "google", model_id: "google/gemini-2.5-flash-lite", display_name: "Gemini Flash Lite", cost_per_1k_input: 0.0001, cost_per_1k_output: 0.0004, max_tokens: 8192, temperature: 0.0, timeout_ms: 15000 },
    { mode: "standard", tier: 2, provider: "google", model_id: "google/gemini-2.5-flash", display_name: "Gemini Flash", cost_per_1k_input: 0.00025, cost_per_1k_output: 0.001, max_tokens: 16384, temperature: 0.0, timeout_ms: 30000 },
    { mode: "standard", tier: 3, provider: "google", model_id: "google/gemini-2.5-pro", display_name: "Gemini Pro", cost_per_1k_input: 0.00125, cost_per_1k_output: 0.005, max_tokens: 16384, temperature: 0.0, timeout_ms: 60000 },
    { mode: "standard", tier: 4, provider: "openai", model_id: "openai/gpt-5", display_name: "GPT-5", cost_per_1k_input: 0.005, cost_per_1k_output: 0.015, max_tokens: 16384, temperature: 0.0, timeout_ms: 60000 },
  ],
  sovereign: [
    { mode: "sovereign", tier: 1, provider: "mistral", model_id: "mistral-small-latest", display_name: "Mistral Small", cost_per_1k_input: 0.0002, cost_per_1k_output: 0.0006, max_tokens: 8192, temperature: 0.0, timeout_ms: 15000 },
    { mode: "sovereign", tier: 2, provider: "mistral", model_id: "mistral-medium-latest", display_name: "Mistral Medium", cost_per_1k_input: 0.0009, cost_per_1k_output: 0.0027, max_tokens: 16384, temperature: 0.0, timeout_ms: 30000 },
    { mode: "sovereign", tier: 3, provider: "mistral", model_id: "mistral-large-latest", display_name: "Mistral Large", cost_per_1k_input: 0.002, cost_per_1k_output: 0.006, max_tokens: 16384, temperature: 0.0, timeout_ms: 60000 },
    { mode: "sovereign", tier: 4, provider: "mistral", model_id: "mistral-large-latest", display_name: "Mistral Large", cost_per_1k_input: 0.002, cost_per_1k_output: 0.006, max_tokens: 16384, temperature: 0.0, timeout_ms: 60000 },
  ],
};

const TIER_ROUTING: Record<number, number[]> = {
  1: [1],
  2: [1, 2],
  3: [2, 3, 4],
};

// ─── Model config resolution ───────────────────────────────────

async function getProjectMode(supabase: any, projectId?: string): Promise<string> {
  if (!projectId) return "standard";
  try {
    const { data } = await supabase
      .from("annotation_projects")
      .select("llm_mode")
      .eq("id", projectId)
      .single();
    return data?.llm_mode || "standard";
  } catch {
    return "standard";
  }
}

async function getModelConfig(supabase: any, mode: string, tier: number): Promise<ModelConfig> {
  try {
    const { data } = await supabase
      .from("llm_model_config")
      .select("*")
      .eq("mode", mode)
      .eq("tier", tier)
      .eq("active", true)
      .single();
    if (data) return data as ModelConfig;
  } catch { /* fall through to static */ }

  const staticList = STATIC_CONFIGS[mode] || STATIC_CONFIGS.standard;
  const found = staticList.find((c) => c.tier === tier);
  if (!found) throw new Error(`No model config for mode=${mode} tier=${tier}`);
  return found;
}

// ─── Provider-specific callers ──────────────────────────────────

async function callLovableGateway(
  config: ModelConfig,
  messages: any[],
  temperature: number,
  maxTokens: number,
  responseFormat?: string,
): Promise<{ content: string; usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const body: any = {
    model: config.model_id,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(LOVABLE_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout_ms),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Lovable Gateway ${config.model_id} error ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
    },
  };
}

async function callMistralDirect(
  config: ModelConfig,
  messages: any[],
  temperature: number,
  maxTokens: number,
  responseFormat?: string,
): Promise<{ content: string; usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) throw new Error("MISTRAL_API_KEY not configured. Cannot use sovereign mode.");

  const apiUrl = Deno.env.get("MISTRAL_API_URL") || MISTRAL_DEFAULT_URL;

  const body: any = {
    model: config.model_id,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeout_ms),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mistral API ${config.model_id} error ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
    },
  };
}

// ─── Unified caller with provider dispatch ──────────────────────

async function callProvider(
  mode: string,
  config: ModelConfig,
  messages: any[],
  temperature: number,
  maxTokens: number,
  responseFormat?: string,
) {
  if (mode === "sovereign" || config.provider === "mistral") {
    return callMistralDirect(config, messages, temperature, maxTokens, responseFormat);
  }
  return callLovableGateway(config, messages, temperature, maxTokens, responseFormat);
}

// ─── Fallback logic (NEVER cross-mode in sovereign) ─────────────

async function callWithFallback(
  supabase: any,
  mode: string,
  config: ModelConfig,
  messages: any[],
  temperature: number,
  maxTokens: number,
  responseFormat?: string,
): Promise<{ result: any; usedConfig: ModelConfig; fallbackUsed: boolean }> {
  try {
    const result = await callProvider(mode, config, messages, temperature, maxTokens, responseFormat);
    return { result, usedConfig: config, fallbackUsed: false };
  } catch (primaryError) {
    console.error(`[LLM Router] Primary ${mode}/${config.model_id} failed:`, primaryError);

    // Try next tier in SAME mode
    if (config.tier < 4) {
      try {
        const fallbackConfig = await getModelConfig(supabase, mode, config.tier + 1);
        console.warn(`[LLM Router] Falling back to ${fallbackConfig.model_id}`);
        const result = await callProvider(mode, fallbackConfig, messages, temperature, maxTokens, responseFormat);
        return { result, usedConfig: fallbackConfig, fallbackUsed: true };
      } catch (fallbackError) {
        console.error(`[LLM Router] Fallback also failed:`, fallbackError);
      }
    }

    // CRITICAL: sovereign mode NEVER falls back to standard
    if (mode === "sovereign") {
      throw new Error(
        "Tous les modèles Mistral sont indisponibles. " +
        "Le mode souverain ne permet pas de basculer vers des modèles non-UE. " +
        "Réessayez dans quelques minutes.",
      );
    }

    throw primaryError;
  }
}

// ─── JSON parsing helper ────────────────────────────────────────

function safeParseJSON(content: string): any {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ─── Logging ────────────────────────────────────────────────────

async function logCall(
  supabase: any,
  config: ModelConfig,
  request: LLMRequest,
  mode: string,
  usage: { input_tokens: number; output_tokens: number },
  latencyMs: number,
  costUsd: number,
  success: boolean,
  fallbackUsed: boolean,
  errorMessage?: string,
) {
  try {
    await supabase.from("llm_call_logs").insert({
      model_id: config.model_id,
      model_name: config.display_name,
      provider: config.provider,
      mode,
      tier: config.tier,
      purpose: request.metadata?.purpose || "unknown",
      task_id: request.metadata?.task_id || null,
      project_id: request.metadata?.project_id || null,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      temperature: request.temperature ?? 0.0,
      success,
      error_message: errorMessage || null,
      metadata: { fallback_used: fallbackUsed },
    });
  } catch (e) {
    console.error("Failed to log LLM call:", e);
  }
}

// ─── Core call function ─────────────────────────────────────────

async function callSingleModel(
  supabase: any,
  request: LLMRequest,
  mode: string,
): Promise<LLMResponse> {
  const tier = request.tier || (request.complexity_level ? TIER_ROUTING[request.complexity_level][0] : 1);
  const config = await getModelConfig(supabase, mode, tier);

  const messages = [
    { role: "system", content: request.system_prompt },
    { role: "user", content: request.user_prompt },
  ];
  const temperature = request.temperature ?? config.temperature;
  const maxTokens = request.max_tokens || config.max_tokens;
  const startTime = Date.now();

  try {
    const { result, usedConfig, fallbackUsed } = await callWithFallback(
      supabase, mode, config, messages, temperature, maxTokens, request.response_format,
    );
    const latency = Date.now() - startTime;
    const cost =
      (result.usage.input_tokens / 1000) * usedConfig.cost_per_1k_input +
      (result.usage.output_tokens / 1000) * usedConfig.cost_per_1k_output;

    await logCall(supabase, usedConfig, request, mode, result.usage, latency, cost, true, fallbackUsed);

    return {
      model_id: usedConfig.model_id,
      model_name: usedConfig.display_name,
      provider: usedConfig.provider,
      mode,
      content: result.content,
      parsed_json: request.response_format === "json" ? safeParseJSON(result.content) : undefined,
      usage: { input_tokens: result.usage.input_tokens, output_tokens: result.usage.output_tokens, cost_usd: cost },
      latency_ms: latency,
      cached: false,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    await logCall(supabase, config, request, mode, { input_tokens: 0, output_tokens: 0 }, latency, 0, false, false, error.message);
    throw error;
  }
}

async function callMultipleModels(
  supabase: any,
  request: LLMRequest,
  mode: string,
): Promise<LLMResponse[]> {
  const tiers = TIER_ROUTING[request.complexity_level || 2] || [2, 3];

  const results = await Promise.allSettled(
    tiers.map((tier) =>
      callSingleModel(supabase, { ...request, tier }, mode),
    ),
  );

  const successful = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<LLMResponse>).value);

  if (successful.length === 0) {
    throw new Error(
      mode === "sovereign"
        ? "Tous les modèles Mistral sont indisponibles. Le mode souverain ne permet pas de basculer vers des modèles non-UE."
        : "All models failed",
    );
  }

  return successful;
}

// ─── Input validation ───────────────────────────────────────────

const RequestSchema = z.object({
  action: z.enum(["call", "call_multiple", "triage"]),
  system_prompt: z.string().min(1).max(100000),
  user_prompt: z.string().min(1).max(200000),
  complexity_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  model_id: z.string().optional(),
  tier: z.number().int().min(1).max(4).optional(),
  response_format: z.enum(["json", "text"]).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(32768).optional(),
  metadata: z.object({
    task_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    purpose: z.string(),
  }).optional(),
});

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = parsed.data as LLMRequest;
    const supabase = getServiceClient();

    // Determine mode from project
    const mode = await getProjectMode(supabase, body.metadata?.project_id);

    let result: any;

    switch (body.action) {
      case "call": {
        result = await callSingleModel(supabase, body, mode);
        break;
      }
      case "call_multiple": {
        result = await callMultipleModels(supabase, body, mode);
        break;
      }
      case "triage": {
        const triageResponse = await callSingleModel(
          supabase,
          {
            ...body,
            tier: 1,
            system_prompt:
              "You are a task complexity classifier. Analyze the task and return a JSON object with a single field 'complexity' set to 1 (simple), 2 (moderate), or 3 (complex).",
            response_format: "json",
            metadata: { ...body.metadata, purpose: "triage" } as any,
          },
          mode,
        );
        const complexity = triageResponse.parsed_json?.complexity || 2;
        result = await callSingleModel(
          supabase,
          { ...body, complexity_level: complexity },
          mode,
        );
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[LLM Router] Error:", error);
    const status = error.message?.includes("sovereign") ? 503 : 500;
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// Export for use by other edge functions
export { callSingleModel, callMultipleModels, safeParseJSON, getProjectMode, getModelConfig };
export type { LLMRequest, LLMResponse, ModelConfig };
