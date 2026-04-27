import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA_ENUMS = {
  seniority: ["junior", "mid", "senior", "lead", "principal"],
  preferred_action: ["approve", "edit", "regenerate", "reject"],
  qa_status: ["pending", "validated", "rejected"],
  issues_detected: [
    "unclear_instructions", "ambiguous_question", "missing_rubric", "rubric_misaligned",
    "difficulty_too_high", "difficulty_too_low", "wrong_level", "time_insufficient",
    "too_theoretical", "not_job_representative", "outdated_tech", "biased_assumption",
    "language_quality_issue", "duplicate_question", "requires_external_resources",
    "security_risk", "unrealistic_constraints",
    "missing_explanation", "uncommented_code", "unjustified_decisions", "shallow_reasoning"
  ],
  job_role: [
    "frontend_developer", "backend_developer", "fullstack_developer",
    "data_analyst", "data_engineer", "data_scientist", "ml_engineer", "devops_engineer"
  ],
  // 10 scoring dimensions matching frontend
  scoring_dimensions: [
    "correctness", "readability", "performance", "security",
    "best_practices", "testing", "scalability", "architecture",
    "problem_solving", "documentation"
  ],
  evaluation_criteria_weights: {
    code_quality: 0.50, reasoning: 0.25, comments: 0.15, justification: 0.10
  }
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GoldExportSchema = z.object({
      format: z.enum(["jsonl", "csv", "json", "parquet"]).default("jsonl"),
      limit: z.number().int().min(1).max(10000).default(1000),
      only_validated: z.boolean().default(false),
      task_type: z.string().max(100).optional(),
      include_enums: z.boolean().default(true),
      batch_id: z.string().max(100).optional(),
    });
    const rawBody = await req.json();
    const parseResult = GoldExportSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Données invalides", details: parseResult.error.issues.map(i => i.message) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { format, limit, only_validated, task_type, include_enums, batch_id } = parseResult.data;

    const exportBatchId = batch_id || `batch_${new Date().toISOString().slice(0, 10)}_${Date.now().toString(36)}`;

    let query = supabase
      .from("rlhf_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (only_validated) query = query.eq("qa_status", "validated");
    if (task_type) query = query.eq("task_type", task_type);

    const { data: feedbacks, error } = await query;
    if (error) throw new Error(`Database error: ${error.message}`);

    if (!feedbacks || feedbacks.length === 0) {
      return new Response(JSON.stringify({
        success: true, count: 0, data: "", filename: `rlhf_gold_${Date.now()}.${format}`, message: "No data found",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Transform to Gold Standard v1.1
    const goldStandardData = feedbacks.map((fb: any) => transformToGoldStandard(fb, exportBatchId));

    const stats = computeStats(feedbacks, exportBatchId);

    let exportData: string;
    let filename: string;

    switch (format) {
      case "jsonl":
        exportData = goldStandardData.map((item: any) => JSON.stringify(item)).join("\n");
        filename = `rlhf_gold_${exportBatchId}.jsonl`;
        break;
      case "csv":
        exportData = generateCSV(goldStandardData);
        filename = `rlhf_gold_${exportBatchId}.csv`;
        break;
      case "parquet":
        // Parquet-compatible columnar JSON with schema metadata
        exportData = generateParquetCompatible(goldStandardData, exportBatchId);
        filename = `rlhf_gold_${exportBatchId}.parquet.json`;
        break;
      case "json":
      default: {
        const exportPayload: any = {
          export_metadata: {
            schema_version: "rlhf_hiring_v1.1",
            export_batch_id: exportBatchId,
            exported_at: new Date().toISOString(),
            total_records: goldStandardData.length,
            statistics: stats,
          },
          data: goldStandardData,
        };
        if (include_enums) exportPayload.enums = SCHEMA_ENUMS;
        exportData = JSON.stringify(exportPayload, null, 2);
        filename = `rlhf_gold_${exportBatchId}.json`;
        break;
      }
    }

    console.log(`Exported ${feedbacks.length} RLHF entries in ${format} format (batch: ${exportBatchId})`);

    return new Response(JSON.stringify({
      success: true,
      count: feedbacks.length,
      statistics: stats,
      filename,
      format,
      schema_version: "rlhf_hiring_v1.1",
      export_batch_id: exportBatchId,
      data: exportData,
      ...(include_enums && format !== "json" ? { enums: SCHEMA_ENUMS } : {}),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Error in export-rlhf-gold:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Transform single feedback to Gold Standard v1.1 ───
function transformToGoldStandard(fb: any, exportBatchId: string) {
  const profileSnapshot = fb.expert_profile_snapshot || {};
  const jobContext = fb.job_context || {};
  const constraints = fb.constraints || {};
  const scores = fb.scores || {};

  return {
    schema_version: "rlhf_hiring_v1.1",
    rlhf_id: fb.id,
    export_batch_id: exportBatchId,

    task: {
      task_type: fb.task_type || "ai_hiring_test_evaluation",
      job_context: {
        job_id: fb.job_offer_id || null,
        title: jobContext.title || fb.job_role?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "Unknown",
        job_role: fb.job_role || "unknown",
        job_level_targeted: fb.job_level_targeted || "mid",
        language: fb.language || "fr",
        market_context: fb.country_context || "FR",
        remote: jobContext.remote ?? true,
        industry: jobContext.industry || null,
        stack: jobContext.stack || [],
        responsibilities: jobContext.responsibilities || [],
      },
      generation_prompt: fb.prompt_used || null,
      generation_constraints: {
        time_limit_minutes: constraints.time_limit_minutes || 60,
        max_questions: constraints.max_questions || 4,
        allowed_question_types: constraints.allowed_question_types || ["code", "system_design", "debugging", "mcq", "essay"],
        difficulty_expected: fb.job_level_targeted || "mid",
      },
      evaluation_instructions_version: "eval_guidelines_v3",
    },

    ai_output: {
      generator: fb.generator || "lovable_ai",
      model_name: fb.model_type || "lovable_ai",
      model_version: fb.model_version || "unknown",
      generation_timestamp: fb.generation_timestamp || fb.created_at,
      test_content: fb.generated_output || {},
      content_hash: fb.content_hash || null,
    },

    // NEW: Preference comparison (DPO/RLHF reward model)
    preference: fb.chosen_output ? {
      chosen_output: fb.chosen_output,
      rejected_output: fb.rejected_output,
      comparison_rationale: fb.comparison_rationale || null,
    } : null,

    human_feedback: {
      overall_rating: fb.overall_rating,
      // All 10 scoring dimensions
      scores: {
        correctness: scores.correctness ?? scores.clarity ?? null,
        readability: scores.readability ?? scores.relevance ?? null,
        performance: scores.performance ?? null,
        security: scores.security ?? scores.bias_risk ?? null,
        best_practices: scores.best_practices ?? null,
        testing: scores.testing ?? null,
        scalability: scores.scalability ?? null,
        architecture: scores.architecture ?? null,
        problem_solving: scores.problem_solving ?? scores.difficulty_alignment ?? null,
        documentation: scores.documentation ?? scores.job_realism ?? null,
      },
      issues_detected: fb.issues_detected || [],
      free_text_comment: fb.free_text_comment || null,
      preferred_action: fb.preferred_action || null,
    },

    // NEW: Structured reasoning traces
    reasoning_trace: fb.reasoning_steps ? {
      steps: fb.reasoning_steps,
      step_count: Array.isArray(fb.reasoning_steps) ? fb.reasoning_steps.length : 0,
    } : null,

    evaluation_criteria: {
      code_quality_weight: 0.50,
      reasoning_weight: 0.25,
      comments_weight: 0.15,
      justification_weight: 0.10,
      scoring_rules: {
        perfect_code_no_explanation_max: 50,
        partial_code_with_reasoning_max: 75,
        full_score_with_explanation: 100,
        uncommented_code_penalty: -20,
      },
    },

    annotator: {
      annotator_id: fb.annotator_id,
      role: profileSnapshot.title?.toLowerCase().replace(/\s+/g, "_") || "unknown",
      seniority: mapExperienceToSeniority(profileSnapshot.years_of_experience || 0),
      experience_years: profileSnapshot.years_of_experience || 0,
      country: profileSnapshot.country || fb.country_context,
      region: mapCountryToRegion(profileSnapshot.country || fb.country_context),
      languages: profileSnapshot.languages || [fb.language],
      verification_status: profileSnapshot.kyc_verified ? "verified" : (profileSnapshot.kyc_status || "pending"),
    },

    quality_control: {
      qa_status: fb.qa_status || "pending",
      gold_task: fb.gold_task || false,
      agreement_score: fb.agreement_score || null,
      time_spent_seconds: fb.time_spent_seconds || null,
      attention_check_passed: fb.attention_check_passed ?? null,
      comment_length: fb.free_text_comment?.length || 0,
    },

    legal: {
      rights_assigned: fb.rights_assigned ?? true,
      pii_present: fb.pii_present ?? false,
      consent_version: fb.consent_version || "v2.0",
      data_retention_policy: fb.data_retention_policy || "standard_12_months",
    },

    metadata: {
      platform_version: fb.platform_version || "web_v1",
      session_id: fb.session_id || null,
      client: { device_type: fb.device_type || "desktop", user_agent: fb.user_agent_info || null },
      timestamp: fb.created_at,
    },
  };
}

// ─── Compute export statistics ───
function computeStats(feedbacks: any[], exportBatchId: string) {
  return {
    total: feedbacks.length,
    export_batch_id: exportBatchId,
    schema_version: "rlhf_hiring_v1.1",
    by_rating: {
      up: feedbacks.filter((f: any) => f.overall_rating === "up").length,
      down: feedbacks.filter((f: any) => f.overall_rating === "down").length,
      neutral: feedbacks.filter((f: any) => f.overall_rating === "neutral").length,
    },
    by_qa_status: {
      pending: feedbacks.filter((f: any) => f.qa_status === "pending").length,
      validated: feedbacks.filter((f: any) => f.qa_status === "validated").length,
      rejected: feedbacks.filter((f: any) => f.qa_status === "rejected").length,
    },
    with_preference: feedbacks.filter((f: any) => f.chosen_output).length,
    with_reasoning_steps: feedbacks.filter((f: any) => f.reasoning_steps).length,
    by_language: feedbacks.reduce((acc: any, f: any) => { acc[f.language] = (acc[f.language] || 0) + 1; return acc; }, {}),
    by_job_level: feedbacks.reduce((acc: any, f: any) => { acc[f.job_level_targeted] = (acc[f.job_level_targeted] || 0) + 1; return acc; }, {}),
    by_job_role: feedbacks.reduce((acc: any, f: any) => { acc[f.job_role] = (acc[f.job_role] || 0) + 1; return acc; }, {}),
    issues_frequency: feedbacks.reduce((acc: any, f: any) => {
      if (f.issues_detected) f.issues_detected.forEach((issue: string) => { acc[issue] = (acc[issue] || 0) + 1; });
      return acc;
    }, {}),
  };
}

// ─── Parquet-compatible columnar format ───
function generateParquetCompatible(data: any[], exportBatchId: string) {
  // Apache Parquet cannot be generated natively in Deno,
  // so we output a columnar JSON with Parquet-compatible schema metadata.
  // Clients can convert this to .parquet using pyarrow/pandas:
  //   import pandas as pd; df = pd.read_json("file.parquet.json"); df.to_parquet("output.parquet")

  const columns: Record<string, any[]> = {
    rlhf_id: [], schema_version: [], export_batch_id: [],
    task_type: [], job_role: [], job_level: [], language: [], market_context: [],
    generator: [], model_name: [], model_version: [],
    overall_rating: [],
    score_correctness: [], score_readability: [], score_performance: [],
    score_security: [], score_best_practices: [], score_testing: [],
    score_scalability: [], score_architecture: [], score_problem_solving: [], score_documentation: [],
    issues_detected: [], free_text_comment: [], preferred_action: [],
    has_preference: [], comparison_rationale: [],
    has_reasoning_steps: [], reasoning_step_count: [],
    annotator_id: [], annotator_seniority: [], annotator_country: [],
    qa_status: [], gold_task: [], agreement_score: [], time_spent_seconds: [],
    pii_present: [], consent_version: [], timestamp: [],
  };

  for (const item of data) {
    columns.rlhf_id.push(item.rlhf_id);
    columns.schema_version.push(item.schema_version);
    columns.export_batch_id.push(item.export_batch_id);
    columns.task_type.push(item.task.task_type);
    columns.job_role.push(item.task.job_context.job_role);
    columns.job_level.push(item.task.job_context.job_level_targeted);
    columns.language.push(item.task.job_context.language);
    columns.market_context.push(item.task.job_context.market_context);
    columns.generator.push(item.ai_output.generator);
    columns.model_name.push(item.ai_output.model_name);
    columns.model_version.push(item.ai_output.model_version);
    columns.overall_rating.push(item.human_feedback.overall_rating);
    columns.score_correctness.push(item.human_feedback.scores.correctness);
    columns.score_readability.push(item.human_feedback.scores.readability);
    columns.score_performance.push(item.human_feedback.scores.performance);
    columns.score_security.push(item.human_feedback.scores.security);
    columns.score_best_practices.push(item.human_feedback.scores.best_practices);
    columns.score_testing.push(item.human_feedback.scores.testing);
    columns.score_scalability.push(item.human_feedback.scores.scalability);
    columns.score_architecture.push(item.human_feedback.scores.architecture);
    columns.score_problem_solving.push(item.human_feedback.scores.problem_solving);
    columns.score_documentation.push(item.human_feedback.scores.documentation);
    columns.issues_detected.push((item.human_feedback.issues_detected || []).join(";"));
    columns.free_text_comment.push(item.human_feedback.free_text_comment);
    columns.preferred_action.push(item.human_feedback.preferred_action);
    columns.has_preference.push(!!item.preference);
    columns.comparison_rationale.push(item.preference?.comparison_rationale || null);
    columns.has_reasoning_steps.push(!!item.reasoning_trace);
    columns.reasoning_step_count.push(item.reasoning_trace?.step_count || 0);
    columns.annotator_id.push(item.annotator.annotator_id);
    columns.annotator_seniority.push(item.annotator.seniority);
    columns.annotator_country.push(item.annotator.country);
    columns.qa_status.push(item.quality_control.qa_status);
    columns.gold_task.push(item.quality_control.gold_task);
    columns.agreement_score.push(item.quality_control.agreement_score);
    columns.time_spent_seconds.push(item.quality_control.time_spent_seconds);
    columns.pii_present.push(item.legal.pii_present);
    columns.consent_version.push(item.legal.consent_version);
    columns.timestamp.push(item.metadata.timestamp);
  }

  const parquetSchema = {
    type: "struct",
    fields: Object.keys(columns).map(name => ({
      name,
      type: inferParquetType(name),
      nullable: true,
    })),
  };

  return JSON.stringify({
    format: "parquet_compatible_columnar_v1",
    conversion_hint: "Use: pd.DataFrame(data['columns']).to_parquet('output.parquet')",
    export_batch_id: exportBatchId,
    schema: parquetSchema,
    num_rows: data.length,
    num_columns: Object.keys(columns).length,
    columns,
  }, null, 2);
}

function inferParquetType(name: string): string {
  if (name.startsWith("score_") || name === "agreement_score" || name === "time_spent_seconds" || name === "reasoning_step_count") return "DOUBLE";
  if (name === "gold_task" || name === "pii_present" || name === "has_preference" || name === "has_reasoning_steps") return "BOOLEAN";
  return "UTF8";
}

// ─── CSV generator with all 10 dimensions ───
function generateCSV(data: any[]): string {
  const headers = [
    "rlhf_id", "schema_version", "export_batch_id",
    "task_type", "job_role", "job_level_targeted", "language", "market_context",
    "generator", "model_name", "model_version", "generation_timestamp",
    "overall_rating",
    "correctness", "readability", "performance", "security",
    "best_practices", "testing", "scalability", "architecture",
    "problem_solving", "documentation",
    "issues_detected", "free_text_comment", "preferred_action",
    "has_preference", "comparison_rationale",
    "has_reasoning_steps", "reasoning_step_count",
    "annotator_id", "annotator_seniority", "experience_years",
    "annotator_country", "annotator_region", "verification_status",
    "qa_status", "gold_task", "agreement_score", "time_spent_seconds",
    "pii_present", "consent_version", "data_retention_policy",
    "platform_version", "timestamp",
  ];

  const csvRows = [headers.join(",")];

  for (const item of data) {
    const s = item.human_feedback.scores;
    const row = [
      item.rlhf_id, item.schema_version, item.export_batch_id,
      item.task.task_type, item.task.job_context.job_role, item.task.job_context.job_level_targeted,
      item.task.job_context.language, item.task.job_context.market_context,
      item.ai_output.generator, item.ai_output.model_name, item.ai_output.model_version,
      item.ai_output.generation_timestamp,
      item.human_feedback.overall_rating,
      s.correctness ?? "", s.readability ?? "", s.performance ?? "", s.security ?? "",
      s.best_practices ?? "", s.testing ?? "", s.scalability ?? "", s.architecture ?? "",
      s.problem_solving ?? "", s.documentation ?? "",
      `"${(item.human_feedback.issues_detected || []).join("; ")}"`,
      `"${(item.human_feedback.free_text_comment || "").replace(/"/g, '""')}"`,
      item.human_feedback.preferred_action || "",
      !!item.preference, item.preference?.comparison_rationale || "",
      !!item.reasoning_trace, item.reasoning_trace?.step_count || 0,
      item.annotator.annotator_id, item.annotator.seniority, item.annotator.experience_years,
      item.annotator.country, item.annotator.region, item.annotator.verification_status,
      item.quality_control.qa_status, item.quality_control.gold_task,
      item.quality_control.agreement_score ?? "", item.quality_control.time_spent_seconds ?? "",
      item.legal.pii_present, item.legal.consent_version, item.legal.data_retention_policy,
      item.metadata.platform_version, item.metadata.timestamp,
    ];
    csvRows.push(row.join(","));
  }

  return csvRows.join("\n");
}

function mapExperienceToSeniority(years: number): string {
  if (years < 2) return "junior";
  if (years < 5) return "mid";
  if (years < 8) return "senior";
  if (years < 12) return "lead";
  return "principal";
}

function mapCountryToRegion(country: string): string {
  const regionMap: Record<string, string> = {
    CM: "Africa", NG: "Africa", KE: "Africa", ZA: "Africa", GH: "Africa",
    SN: "Africa", CI: "Africa", MA: "Africa", EG: "Africa", TN: "Africa",
    FR: "Europe", DE: "Europe", GB: "Europe", ES: "Europe", IT: "Europe",
    NL: "Europe", BE: "Europe", CH: "Europe", PT: "Europe", PL: "Europe",
    US: "Americas", CA: "Americas", BR: "Americas", MX: "Americas", AR: "Americas",
    IN: "Asia", CN: "Asia", JP: "Asia", KR: "Asia", SG: "Asia", PH: "Asia",
    AE: "Middle East", SA: "Middle East", IL: "Middle East",
  };
  return regionMap[country] || "Other";
}
