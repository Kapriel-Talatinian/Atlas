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

// ─── Format Helpers ─────────────────────────────────────────────

function formatItemRow(item: any, alpha: number | null, config: any): Record<string, unknown> {
  const content = item.content || {};
  const taskType = config.task_type || "scoring";

  const base: any = {
    id: item.id,
    domain: config.domain,
    language: config.language,
    task_type: taskType,
    alpha: alpha != null ? Math.round(alpha * 10000) / 10000 : null,
  };

  // Use annotation value if available, otherwise use item content
  const annValue = item.merged_annotation || {};
  const dims = annValue.dimensions || {};

  switch (taskType) {
    case "preference_dpo":
      return {
        ...base,
        prompt: content.primary || content.prompt || "",
        chosen: annValue.preference === "A" ? (content.response_a || content.secondary) : (content.response_b || ""),
        rejected: annValue.preference === "A" ? (content.response_b || "") : (content.response_a || content.secondary),
        ...(config.include_reasoning ? { reasoning: annValue.reasoning || "" } : {}),
      };
    case "scoring":
    case "rating":
      return {
        ...base,
        prompt: content.primary || content.prompt || "",
        response: content.secondary || content.response || "",
        scores: dims,
        ...(config.include_reasoning ? { reasoning: annValue.reasoning || "" } : {}),
      };
    case "fact_checking":
      return {
        ...base,
        claim: content.claim || content.primary || "",
        verdict: annValue.verdict || null,
        justification: annValue.justification || "",
        sources: annValue.sources || [],
      };
    case "red_teaming":
      return {
        ...base,
        prompt: content.primary || "",
        response: content.secondary || "",
        flaws: annValue.flaws || [],
        overall_safety_score: annValue.overall_safety_score || null,
      };
    case "text_generation":
      return { ...base, prompt: content.primary || "", expert_response: annValue.generated_text || "" };
    case "span_annotation":
      return { ...base, text: content.primary || "", spans: annValue.spans || [], comments: annValue.comments || "" };
    case "extraction":
      return { ...base, text: content.primary || "", extractions: annValue.extractions || {} };
    case "conversation_rating":
      return {
        ...base,
        conversation: content.conversation || [],
        per_turn_scores: annValue.per_turn_scores || {},
        global_scores: annValue.global_scores || {},
        ...(config.include_reasoning ? { reasoning: annValue.global_reasoning || "" } : {}),
      };
    case "comparison_ab":
      return {
        ...base,
        prompt: content.primary || "",
        response_a: content.response_a || content.secondary || "",
        response_b: content.response_b || "",
        scores_a: annValue.scores_a || {},
        scores_b: annValue.scores_b || {},
        preference: annValue.preference || null,
        ...(config.include_reasoning ? { reasoning: annValue.reasoning || "" } : {}),
      };
    default:
      return { ...base, content: content, annotation: annValue };
  }
}

function formatAsJSONL(items: any[], alphaMap: Record<string, number>, config: any): string {
  return items.map((item) => JSON.stringify(formatItemRow(item, alphaMap[item.id] ?? null, config))).join("\n");
}

function formatAsHuggingFace(items: any[], alphaMap: Record<string, number>, config: any): string {
  const alphaValues = Object.values(alphaMap).filter(v => v != null);
  const meanAlpha = alphaValues.length > 0 ? alphaValues.reduce((a, b) => a + b, 0) / alphaValues.length : 0;
  const datasetInfo = {
    _dataset_info: {
      name: `stef_${config.domain}_${config.task_type}`,
      description: `Dataset annotated by STEF — ${config.domain} — ${config.task_type}`,
      version: "1.0.0",
      license: "proprietary",
      source: "steftalent.fr",
      annotation_quality: {
        method: "multi_annotator_adjudication",
        metric: "krippendorff_alpha",
        min_alpha: config.min_alpha,
        mean_alpha: Math.round(meanAlpha * 10000) / 10000,
      },
      size: items.length,
      language: config.language,
      created_at: new Date().toISOString(),
    },
  };
  return JSON.stringify(datasetInfo) + "\n" + formatAsJSONL(items, alphaMap, config);
}

// ─── Core Export Generator ──────────────────────────────────────

async function generateExport(exportId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: exportConfig } = await supabase
    .from("dataset_exports")
    .select("*")
    .eq("id", exportId)
    .single();

  if (!exportConfig) return;

  try {
    const { data: project } = await supabase
      .from("annotation_projects")
      .select("id, domain, type, languages, status, total_items, completed_tasks, client_id")
      .eq("id", exportConfig.project_id)
      .single();

    if (!project) {
      await supabase.from("dataset_exports").update({
        status: "failed",
        export_blocked_reason: "PROJECT_NOT_FOUND",
        error_message: "Projet introuvable.",
      }).eq("id", exportId);
      return;
    }

    if (project.status !== "completed") {
      await supabase.from("dataset_exports").update({
        status: "failed",
        export_blocked_reason: "PROJECT_NOT_COMPLETED",
        error_message: `Statut actuel : ${project.status}. ${project.completed_tasks || 0}/${project.total_items} tâches.`,
      }).eq("id", exportId);
      return;
    }

    // ── Fetch completed items in batches (bypass 1000-row limit) ──
    const PAGE_SIZE = 500;
    let allItems: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from("annotation_items")
        .select("id, content")
        .eq("project_id", exportConfig.project_id)
        .eq("status", "completed")
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!batch || batch.length === 0) { hasMore = false; break; }
      allItems = allItems.concat(batch);
      if (batch.length < PAGE_SIZE) hasMore = false;
      offset += PAGE_SIZE;
    }

    console.log(`[export] Found ${allItems.length} completed items`);

    if (allItems.length === 0) {
      await supabase.from("dataset_exports").update({
        status: "failed",
        error_message: "Aucun item complété trouvé.",
      }).eq("id", exportId);
      return;
    }

    // ── Fetch alpha reports for these items ──
    // alpha_reports.item_id is the bridge: qa-engine populates it on each
    // run_qa with task.source_id (the annotation_item.id). We key the
    // alphaMap by item.id so the filter below can match directly.
    const ALPHA_CHUNK = 100;
    const alphaMap: Record<string, number> = {};

    for (let i = 0; i < allItems.length; i += ALPHA_CHUNK) {
      const chunk = allItems.slice(i, i + ALPHA_CHUNK).map((it: any) => it.id);
      const { data: alphas, error: alphaErr } = await supabase
        .from("alpha_reports")
        .select("item_id, overall_alpha")
        .in("item_id", chunk);

      if (alphaErr) {
        console.error(`[export] Alpha fetch error at chunk ${i}:`, alphaErr.message);
      }
      if (alphas) {
        for (const a of alphas) {
          if (a.item_id) alphaMap[a.item_id] = a.overall_alpha;
        }
      }
    }

    console.log(`[export] Alpha map has ${Object.keys(alphaMap).length} entries`);

    // Filter by min_alpha
    const minAlpha = exportConfig.min_alpha || 0.8;
    const filteredItems = allItems.filter((item: any) => {
      const alpha = alphaMap[item.id];
      return alpha != null && alpha >= minAlpha;
    });

    console.log(`[export] ${filteredItems.length} items pass α ≥ ${minAlpha}`);

    if (filteredItems.length === 0) {
      await supabase.from("dataset_exports").update({
        status: "failed",
        error_message: `Aucun item avec α ≥ ${minAlpha}. Alpha map: ${Object.keys(alphaMap).length} entries.`,
      }).eq("id", exportId);
      return;
    }

    // ── Fetch merged annotations (best annotation per item) ──
    // Get one annotation value per item for enrichment
    for (let i = 0; i < filteredItems.length; i += PAGE_SIZE) {
      const chunk = filteredItems.slice(i, i + PAGE_SIZE);
      const chunkIds = chunk.map(it => it.id);
      const { data: anns } = await supabase
        .from("annotations")
        .select("item_id, value")
        .in("item_id", chunkIds);

      if (anns) {
        const annMap: Record<string, any> = {};
        for (const a of anns) {
          // Keep first (or overwrite — last wins)
          annMap[a.item_id] = a.value;
        }
        for (const item of chunk) {
          item.merged_annotation = annMap[item.id] || {};
        }
      }
    }

    const config = {
      domain: project.domain || "finance",
      task_type: project.type || "scoring",
      language: project.languages?.[0] || "fr",
      min_alpha: minAlpha,
      include_reasoning: exportConfig.include_reasoning ?? true,
    };

    let content: string;
    let fileName: string;

    switch (exportConfig.format) {
      case "huggingface":
        content = formatAsHuggingFace(filteredItems, alphaMap, config);
        fileName = `stef_export_${exportId}_hf.jsonl`;
        break;
      case "jsonl":
      default:
        content = formatAsJSONL(filteredItems, alphaMap, config);
        fileName = `stef_export_${exportId}.jsonl`;
        break;
    }

    const encoded = new TextEncoder().encode(content);

    // Upload to Storage
    const filePath = `exports/${exportConfig.client_id}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("datasets")
      .upload(filePath, encoded, {
        contentType: "application/jsonlines",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = await supabase.storage
      .from("datasets")
      .createSignedUrl(filePath, 7 * 24 * 60 * 60);

    await supabase.from("dataset_exports").update({
      status: "ready",
      file_path: filePath,
      file_size_bytes: encoded.length,
      total_items: filteredItems.length,
      download_url: urlData?.signedUrl,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", exportId);

  } catch (error: any) {
    console.error("[export-dataset] Error:", error);
    await supabase.from("dataset_exports").update({
      status: "failed",
      error_message: error.message,
    }).eq("id", exportId);
  }
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, export_id } = body;

    switch (action) {
      case "generate": {
        if (!export_id) {
          return new Response(JSON.stringify({ error: "export_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await generateExport(export_id);
        return new Response(JSON.stringify({ status: "completed", export_id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_download_url": {
        const supabase = getServiceClient();
        const statusSelect = "download_url, status, expires_at, total_items, format, export_blocked_reason, error_message";

        let { data } = await supabase
          .from("dataset_exports")
          .select(statusSelect)
          .eq("id", export_id)
          .single();

        if (!data) {
          return new Response(JSON.stringify({ error: "Export not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (data.status === "generating") {
          const { data: claimed } = await supabase
            .from("dataset_exports")
            .update({ status: "processing" })
            .eq("id", export_id)
            .eq("status", "generating")
            .select("id")
            .maybeSingle();

          if (claimed) {
            await generateExport(export_id);
          }

          const { data: refreshed } = await supabase
            .from("dataset_exports")
            .select(statusSelect)
            .eq("id", export_id)
            .single();

          if (refreshed) {
            data = refreshed;
          }
        }

        if (data.status === "ready" && data.expires_at && new Date(data.expires_at) < new Date()) {
          const { data: exportRecord } = await supabase
            .from("dataset_exports")
            .select("file_path")
            .eq("id", export_id)
            .single();

          if (exportRecord?.file_path) {
            const { data: urlData } = await supabase.storage
              .from("datasets")
              .createSignedUrl(exportRecord.file_path, 7 * 24 * 60 * 60);

            await supabase.from("dataset_exports").update({
              download_url: urlData?.signedUrl,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            }).eq("id", export_id);

            data.download_url = urlData?.signedUrl || null;
          }
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("[export-dataset] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
