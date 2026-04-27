import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action } = body;

    // ─── ACTION: assign_batch ─────────────────────────────────
    if (action === "assign_batch") {
      const { project_id, batch_id } = body;
      if (!project_id) throw new Error("project_id required");

      // Get project config
      const { data: project } = await supabase
        .from("annotation_projects")
        .select("*")
        .eq("id", project_id)
        .single();
      if (!project) throw new Error("Project not found");

      const qualityConfig = project.quality_config as any;
      const annotationsPerItem = qualityConfig?.annotations_per_item || 1;

      // Get queued items
      let itemsQuery = supabase
        .from("annotation_items")
        .select("id, complexity_level")
        .eq("project_id", project_id)
        .eq("status", "queued")
        .limit(100);
      if (batch_id) itemsQuery = itemsQuery.eq("batch_id", batch_id);

      const { data: items } = await itemsQuery;
      if (!items || items.length === 0) {
        return jsonResponse({ success: true, assigned: 0, message: "No items to assign" });
      }

      // Get eligible annotators (certified on this project, active)
      const { data: certifiedAnnotators } = await supabase
        .from("project_onboarding")
        .select("annotator_id")
        .eq("project_id", project_id)
        .eq("status", "certified");

      if (!certifiedAnnotators || certifiedAnnotators.length === 0) {
        return jsonResponse({ success: false, error: "No certified annotators available" });
      }

      const annotatorIds = certifiedAnnotators.map(c => c.annotator_id);

      // Get annotator profiles for scoring
      const { data: annotators } = await supabase
        .from("annotator_profiles")
        .select("id, tier, overall_accuracy, reliability_score, current_daily_count, daily_quota, max_concurrent_items")
        .in("id", annotatorIds)
        .eq("is_active", true);

      if (!annotators || annotators.length === 0) {
        return jsonResponse({ success: false, error: "No active annotators" });
      }

      // Get current assignments to check load
      const { data: currentAssignments } = await supabase
        .from("item_assignments")
        .select("annotator_id")
        .in("annotator_id", annotatorIds)
        .in("status", ["pending", "accepted", "in_progress"]);

      const loadMap: Record<string, number> = {};
      for (const a of currentAssignments || []) {
        loadMap[a.annotator_id] = (loadMap[a.annotator_id] || 0) + 1;
      }

      // Assignment algorithm
      const assignments: any[] = [];
      for (const item of items) {
        // Filter annotators by tier access and load
        const eligible = annotators.filter(a => {
          const load = loadMap[a.id] || 0;
          const maxLoad = a.max_concurrent_items || 10;
          if (load >= maxLoad) return false;

          // Tier access: junior=L1, standard=L1-2, senior+=all
          const tierAccess: Record<string, number[]> = {
            junior: [1], standard: [1, 2], senior: [1, 2, 3],
            expert: [1, 2, 3], adjudicator: [1, 2, 3],
          };
          const allowed = tierAccess[a.tier || "junior"] || [1];
          return allowed.includes(item.complexity_level);
        });

        if (eligible.length === 0) continue;

        // Score and select annotators
        const scored = eligible.map(a => ({
          annotator: a,
          score: computeAssignmentScore(a, loadMap[a.id] || 0),
        })).sort((a, b) => b.score - a.score);

        // Select top N with some randomization for diversity
        const n = Math.min(annotationsPerItem, scored.length);
        const poolSize = Math.min(n * 3, scored.length);
        const pool = scored.slice(0, poolSize);
        const selected = weightedSample(pool, n);

        for (const { annotator } of selected) {
          const deadline = new Date();
          deadline.setHours(deadline.getHours() + 24);

          assignments.push({
            item_id: item.id,
            annotator_id: annotator.id,
            project_id,
            status: "pending",
            deadline: deadline.toISOString(),
          });
          loadMap[annotator.id] = (loadMap[annotator.id] || 0) + 1;
        }
      }

      // Insert assignments
      if (assignments.length > 0) {
        await supabase.from("item_assignments").insert(assignments);
        // Update item statuses
        const itemIds = [...new Set(assignments.map(a => a.item_id))];
        await supabase
          .from("annotation_items")
          .update({ status: "assigned" })
          .in("id", itemIds);
      }

      return jsonResponse({ success: true, assigned: assignments.length, items_affected: items.length });
    }

    // ─── ACTION: auto_annotate ────────────────────────────────
    if (action === "auto_annotate") {
      const { project_id, item_ids, force_auto } = body;
      if (!project_id) throw new Error("project_id required");

      const { data: project } = await supabase
        .from("annotation_projects")
        .select("*")
        .eq("id", project_id)
        .single();
      if (!project) throw new Error("Project not found");

      const autoConfig = project.automation_config as any;
      // Allow force_auto for complexity 1 items from distribute-tasks pipeline
      if (!autoConfig?.enabled && !force_auto) {
        return jsonResponse({ success: false, error: "Automation not enabled for this project" });
      }

      // Get items to auto-annotate
      let query = supabase
        .from("annotation_items")
        .select("*")
        .eq("project_id", project_id)
        .eq("status", "queued");
      if (item_ids?.length) query = query.in("id", item_ids);
      query = query.limit(50);

      const { data: items } = await query;
      if (!items || items.length === 0) {
        return jsonResponse({ success: true, auto_annotated: 0 });
      }

      // Get guidelines for prompt context
      const guidelines = project.guidelines as any;
      const guidelinesContent = guidelines?.content || project.description;

      let autoAnnotated = 0;
      let routedToHuman = 0;
      let totalCost = 0;

      for (const item of items) {
        try {
          const content = item.content as any;
          const complexity = item.complexity_level || 1;

          // ── Multi-model routing by complexity ──
          const modelConfig = selectModelForComplexity(complexity, autoConfig);

          // Niveau 3 with assist_only → skip auto-annotation entirely
          if (complexity === 3 && (autoConfig.strategy === "assist_only" || !autoConfig.strategy)) {
            routedToHuman++;
            continue;
          }

          const prompt = buildAutoAnnotationPrompt(
            project.type,
            guidelinesContent,
            content,
            project.annotation_schema as any
          );

          const startTime = Date.now();
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: modelConfig.model,
              messages: [
                { role: "system", content: modelConfig.systemPrompt },
                { role: "user", content: prompt },
              ],
              temperature: modelConfig.temperature,
            }),
          });
          const latencyMs = Date.now() - startTime;

          if (!response.ok) {
            if (response.status === 429) {
              console.warn("Rate limited — pausing auto-annotation batch");
              break;
            }
            if (response.status === 402) {
              return jsonResponse({ success: false, error: "AI credits exhausted", auto_annotated: autoAnnotated });
            }
            console.error(`Auto-annotation AI error: ${response.status}`);
            routedToHuman++;
            continue;
          }

          const aiResponse = await response.json();
          const aiContent = aiResponse.choices?.[0]?.message?.content;
          if (!aiContent) { routedToHuman++; continue; }

          const jsonStr = extractJson(aiContent);
          if (!jsonStr) { routedToHuman++; continue; }
          const annotationValue = JSON.parse(jsonStr);

          // Estimate confidence from response structure
          const confidence = annotationValue.confidence || modelConfig.defaultConfidence;
          const strategy = autoConfig.strategy || "pre_annotation";
          const itemCost = modelConfig.estimatedCostPerItem;
          totalCost += itemCost;

          // Budget guard
          if (autoConfig.max_total_budget && totalCost > autoConfig.max_total_budget) {
            console.warn("Budget limit reached for auto-annotation");
            routedToHuman++;
            break;
          }

          const autoAnnotationPayload = {
            model_id: modelConfig.model,
            model_version: modelConfig.version,
            value: annotationValue,
            confidence,
            latency: latencyMs,
            cost: itemCost,
            validated_by_human: false,
            complexity_routed: complexity,
          };

          if (strategy === "full_auto" && confidence >= (autoConfig.confidence_threshold || 0.95) && complexity <= 1) {
            // Full auto only for Level 1 with high confidence
            const needsQASample = Math.random() < (autoConfig.human_review_sample_rate || 0.05);
            await supabase.from("annotation_items").update({
              status: needsQASample ? "in_review" : "auto_annotated",
              auto_annotation: autoAnnotationPayload,
              completed_at: needsQASample ? null : new Date().toISOString(),
            }).eq("id", item.id);
            autoAnnotated++;
          } else if (strategy === "pre_annotation" || complexity === 2) {
            // Pre-annotate for human validation (default for Level 2)
            await supabase.from("annotation_items").update({
              auto_annotation: autoAnnotationPayload,
            }).eq("id", item.id);
            routedToHuman++;
          } else {
            // Low confidence or complex → route to human
            await supabase.from("annotation_items").update({
              auto_annotation: complexity <= 2 ? autoAnnotationPayload : null,
            }).eq("id", item.id);
            routedToHuman++;
          }
        } catch (err) {
          console.error(`Error auto-annotating item ${item.id}:`, err);
          routedToHuman++;
        }
      }

      return jsonResponse({
        success: true,
        auto_annotated: autoAnnotated,
        routed_to_human: routedToHuman,
        total_cost: Math.round(totalCost * 1000) / 1000,
        model_routing: "multi_model",
      });
    }

    // ─── ACTION: compute_quality ──────────────────────────────
    if (action === "compute_quality") {
      const { project_id } = body;
      if (!project_id) throw new Error("project_id required");

      // Get completed annotations for IAA
      const { data: completedItems } = await supabase
        .from("annotation_items")
        .select("id, is_gold_standard, gold_annotation")
        .eq("project_id", project_id)
        .in("status", ["completed", "auto_annotated"])
        .limit(500);

      const itemIds = (completedItems || []).map(i => i.id);

      const { data: annotations } = await supabase
        .from("annotations")
        .select("item_id, annotator_id, value, agrees_with_gold")
        .in("item_id", itemIds);

      // Compute IAA (simplified: percent agreement)
      const itemAnnotations: Record<string, any[]> = {};
      for (const ann of annotations || []) {
        if (!itemAnnotations[ann.item_id]) itemAnnotations[ann.item_id] = [];
        itemAnnotations[ann.item_id].push(ann);
      }

      let agreementSum = 0;
      let agreementCount = 0;
      for (const [, anns] of Object.entries(itemAnnotations)) {
        if (anns.length < 2) continue;
        // Pairwise agreement
        for (let i = 0; i < anns.length; i++) {
          for (let j = i + 1; j < anns.length; j++) {
            const agree = JSON.stringify(anns[i].value) === JSON.stringify(anns[j].value);
            agreementSum += agree ? 1 : 0;
            agreementCount++;
          }
        }
      }
      const percentAgreement = agreementCount > 0 ? agreementSum / agreementCount : 0;

      // Gold standard accuracy
      const goldItems = (completedItems || []).filter(i => i.is_gold_standard);
      const goldAnnotations = (annotations || []).filter(a =>
        goldItems.some(g => g.id === a.item_id)
      );
      const goldCorrect = goldAnnotations.filter(a => a.agrees_with_gold === true).length;
      const goldAccuracy = goldAnnotations.length > 0 ? goldCorrect / goldAnnotations.length : 0;

      // Adjudication rate
      const { count: adjudicatedCount } = await supabase
        .from("annotation_items")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id)
        .eq("status", "adjudication");

      const adjudicationRate = (completedItems?.length || 0) > 0
        ? (adjudicatedCount || 0) / (completedItems?.length || 1)
        : 0;

      // Drift detection (compare last 100 vs previous 100)
      let driftStatus = "stable";
      if (annotations && annotations.length > 200) {
        const recent = annotations.slice(-100);
        const historical = annotations.slice(-200, -100);
        const recentTime = recent.reduce((s, a: any) => s + (a.time_spent || 0), 0) / recent.length;
        const historicalTime = historical.reduce((s, a: any) => s + (a.time_spent || 0), 0) / historical.length;
        if (Math.abs(recentTime - historicalTime) / (historicalTime || 1) > 0.25) {
          driftStatus = "warning";
        }
      }

      // Interpretation
      let interpretation = "excellent";
      if (percentAgreement < 0.4) interpretation = "poor";
      else if (percentAgreement < 0.6) interpretation = "fair";
      else if (percentAgreement < 0.8) interpretation = "substantial";

      // Save report
      await supabase.from("annotation_quality_reports").insert({
        project_id,
        report_type: "iaa",
        metrics: {
          percent_agreement: Math.round(percentAgreement * 100) / 100,
          gold_accuracy: Math.round(goldAccuracy * 100) / 100,
          adjudication_rate: Math.round(adjudicationRate * 100) / 100,
          drift_status: driftStatus,
        },
        interpretation,
        sample_size: annotations?.length || 0,
        drifted: driftStatus === "drifted",
        recommendations: generateRecommendations(percentAgreement, goldAccuracy, driftStatus),
      });

      return jsonResponse({
        success: true,
        quality: {
          iaa: Math.round(percentAgreement * 100) / 100,
          gold_accuracy: Math.round(goldAccuracy * 100) / 100,
          adjudication_rate: Math.round(adjudicationRate * 100) / 100,
          drift_status: driftStatus,
          interpretation,
        },
      });
    }

    // ─── ACTION: check_escalation ─────────────────────────────
    if (action === "check_escalation") {
      const { project_id } = body;
      if (!project_id) throw new Error("project_id required");

      const { data: project } = await supabase
        .from("annotation_projects")
        .select("quality_config")
        .eq("id", project_id)
        .single();

      const qc = project?.quality_config as any;
      const alerts: any[] = [];

      // Check annotators' gold accuracy
      const { data: annotators } = await supabase
        .from("annotator_profiles")
        .select("id, gold_tasks_passed, gold_tasks_completed, is_active")
        .eq("is_active", true);

      for (const ann of annotators || []) {
        const goldAcc = (ann.gold_tasks_completed || 0) > 0
          ? (ann.gold_tasks_passed || 0) / ann.gold_tasks_completed
          : 1;

        if (goldAcc < 0.60 && (ann.gold_tasks_completed || 0) >= 10) {
          alerts.push({
            project_id,
            rule_name: "Gold Accuracy Critical",
            severity: "critical",
            message: `Annotateur ${ann.id}: accuracy gold ${Math.round(goldAcc * 100)}% — mis en pause`,
            annotator_id: ann.id,
            action_taken: "pause_annotator",
          });
          // Pause the annotator
          await supabase.from("annotator_profiles").update({ is_active: false, suspension_reason: "Gold accuracy < 60%" }).eq("id", ann.id);
        } else if (goldAcc < 0.70 && (ann.gold_tasks_completed || 0) >= 10) {
          alerts.push({
            project_id,
            rule_name: "Gold Accuracy Low",
            severity: "warning",
            message: `Annotateur ${ann.id}: accuracy gold ${Math.round(goldAcc * 100)}% — recalibration nécessaire`,
            annotator_id: ann.id,
            action_taken: "recalibrate",
          });
        }
      }

      if (alerts.length > 0) {
        await supabase.from("annotation_alerts").insert(alerts);
      }

      return jsonResponse({ success: true, alerts_triggered: alerts.length, alerts });
    }

    // ─── ACTION: adjudicate_item ──────────────────────────────
    if (action === "adjudicate_item") {
      const { item_id } = body;
      if (!item_id) throw new Error("item_id required");

      const { data: item } = await supabase
        .from("annotation_items")
        .select("*, annotations(*)")
        .eq("id", item_id)
        .single();
      if (!item) throw new Error("Item not found");

      const annotations = (item as any).annotations || [];
      if (annotations.length < 2) {
        return jsonResponse({ success: false, error: "Need at least 2 annotations to adjudicate" });
      }

      // Try auto-resolution: weighted majority
      const voteMap: Record<string, { weight: number; annotation: any }> = {};
      for (const ann of annotations) {
        const key = JSON.stringify(ann.value);
        if (!voteMap[key]) voteMap[key] = { weight: 0, annotation: ann };
        // Weight by annotator quality (simplified)
        voteMap[key].weight += 1;
      }

      const sorted = Object.values(voteMap).sort((a, b) => b.weight - a.weight);
      const totalWeight = sorted.reduce((s, v) => s + v.weight, 0);
      const topConfidence = sorted[0].weight / totalWeight;

      if (topConfidence >= 0.7) {
        // Auto-resolve
        await supabase.from("adjudications").insert({
          item_id,
          adjudicator_id: annotations[0].annotator_id,
          original_annotation_ids: annotations.map((a: any) => a.id),
          final_value: sorted[0].annotation.value,
          method: "weighted_majority",
          justification: `Résolution automatique par majorité pondérée (confiance: ${Math.round(topConfidence * 100)}%)`,
          confidence: topConfidence,
        });

        await supabase.from("annotation_items").update({
          status: "completed",
          final_annotation_id: sorted[0].annotation.id,
          completed_at: new Date().toISOString(),
        }).eq("id", item_id);

        return jsonResponse({ success: true, method: "weighted_majority", confidence: topConfidence });
      }

      // Route to adjudicator
      await supabase.from("annotation_items").update({ status: "adjudication" }).eq("id", item_id);
      return jsonResponse({ success: true, method: "needs_human_adjudicator" });
    }

    // ─── ACTION: export_project ───────────────────────────────
    if (action === "export_project") {
      const { project_id, format = "jsonl" } = body;
      if (!project_id) throw new Error("project_id required");

      // Get completed items with annotations
      const { data: items } = await supabase
        .from("annotation_items")
        .select("*, annotations(*)")
        .eq("project_id", project_id)
        .in("status", ["completed", "auto_annotated"])
        .limit(1000);

      if (!items || items.length === 0) {
        return jsonResponse({ success: false, error: "No completed items to export" });
      }

      let humanAnnotated = 0;
      let autoAnnotated = 0;
      let adjudicated = 0;

      const exportData = items.map((item: any) => {
        if (item.status === "auto_annotated") autoAnnotated++;
        else humanAnnotated++;
        if (item.final_annotation_id) adjudicated++;

        const finalAnnotation = item.final_annotation_id
          ? item.annotations.find((a: any) => a.id === item.final_annotation_id)
          : item.annotations[0];

        return {
          id: item.id,
          content: item.content,
          annotation: finalAnnotation?.value || item.auto_annotation?.value,
          auto_annotation: item.auto_annotation?.value,
          metadata: {
            complexity: item.complexity_level,
            is_gold: item.is_gold_standard,
            annotation_count: item.annotations.length,
            completed_at: item.completed_at,
          },
        };
      });

      // Get latest quality report
      const { data: qualityReport } = await supabase
        .from("annotation_quality_reports")
        .select("metrics, interpretation")
        .eq("project_id", project_id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .single();

      const deliveryReport = {
        project_id,
        delivered_at: new Date().toISOString(),
        total_items_delivered: items.length,
        human_annotated: humanAnnotated,
        auto_annotated: autoAnnotated,
        adjudicated,
        quality: qualityReport?.metrics || {},
        format,
      };

      // Save export record
      await supabase.from("annotation_exports").insert({
        project_id,
        format,
        total_items: items.length,
        human_annotated: humanAnnotated,
        auto_annotated: autoAnnotated,
        adjudicated,
        quality_report: qualityReport?.metrics || {},
        delivery_report: deliveryReport,
      });

      return jsonResponse({ success: true, export: { items: exportData, report: deliveryReport } });
    }

    // ─── ACTION: tier_check ───────────────────────────────────
    if (action === "tier_check") {
      const { annotator_id } = body;
      if (!annotator_id) throw new Error("annotator_id required");

      const { data: annotator } = await supabase
        .from("annotator_profiles")
        .select("*")
        .eq("id", annotator_id)
        .single();
      if (!annotator) throw new Error("Annotator not found");

      const totalItems = annotator.total_annotations || 0;
      const accuracy = annotator.overall_accuracy || 0;
      const iaa = annotator.inter_annotator_agreement || 0;
      const flagRate = annotator.flag_rate || 0;

      let newTier = "junior";
      if (totalItems >= 5000 && accuracy >= 0.92) newTier = "expert";
      else if (totalItems >= 2000 && accuracy >= 0.88 && iaa >= 0.82 && flagRate < 0.05) newTier = "senior";
      else if (totalItems >= 500 && accuracy >= 0.80 && iaa >= 0.75) newTier = "standard";

      if (newTier !== annotator.tier) {
        await supabase.from("annotator_profiles").update({ tier: newTier }).eq("id", annotator_id);
        return jsonResponse({ success: true, previous_tier: annotator.tier, new_tier: newTier, promoted: true });
      }

      return jsonResponse({ success: true, current_tier: annotator.tier, promoted: false });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Annotation engine error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ─── HELPERS ─────────────────────────────────────────────────

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── MULTI-MODEL ROUTING ────────────────────────────────────
// Routes each complexity level to the optimal model for cost/quality balance.
// Level 1 (simple): Fast & cheap model — classification, detection, extraction
// Level 2 (intermediate): Balanced model — nuanced analysis, scoring, NER
// Level 3 (complex): Premium model — RLHF, red-teaming, code review (human-first)

interface ModelRouteConfig {
  model: string;
  version: string;
  temperature: number;
  defaultConfidence: number;
  estimatedCostPerItem: number;
  systemPrompt: string;
}

const MODEL_ROUTES: Record<number, ModelRouteConfig> = {
  1: {
    model: "google/gemini-2.5-flash-lite",
    version: "gemini-2.5-flash-lite",
    temperature: 0.1,
    defaultConfidence: 0.90,
    estimatedCostPerItem: 0.01,
    systemPrompt:
      "Tu es un annotateur automatique rapide et précis. Classifie ou catégorise l'item selon les guidelines. Réponds UNIQUEMENT en JSON valide. Inclus un champ 'confidence' entre 0 et 1.",
  },
  2: {
    model: "google/gemini-2.5-flash",
    version: "gemini-2.5-flash",
    temperature: 0.2,
    defaultConfidence: 0.80,
    estimatedCostPerItem: 0.04,
    systemPrompt:
      "Tu es un annotateur expert en analyse fine de texte. Pré-annote l'item avec nuance et rigueur en suivant les guidelines. Ta pré-annotation sera validée par un humain. Réponds UNIQUEMENT en JSON valide. Inclus un champ 'confidence' entre 0 et 1.",
  },
  3: {
    model: "google/gemini-2.5-pro",
    version: "gemini-2.5-pro",
    temperature: 0.3,
    defaultConfidence: 0.70,
    estimatedCostPerItem: 0.12,
    systemPrompt:
      "Tu es un assistant d'annotation pour des tâches complexes (RLHF, red-teaming, évaluation qualitative). Fournis une aide contextuelle : résumé, analyse, suggestions. L'annotateur humain prend la décision finale. Réponds UNIQUEMENT en JSON valide. Inclus un champ 'confidence' entre 0 et 1.",
  },
};

function selectModelForComplexity(
  complexity: number,
  autoConfig: any
): ModelRouteConfig {
  // Allow per-project model override
  if (autoConfig.model?.model_id && autoConfig.model?.provider === "custom") {
    return {
      ...MODEL_ROUTES[complexity] || MODEL_ROUTES[1],
      model: autoConfig.model.model_id,
      version: autoConfig.model.model_id,
    };
  }
  // Allow per-level overrides from project config
  const levelOverrides = autoConfig.model_overrides as Record<string, string> | undefined;
  const route = { ...(MODEL_ROUTES[complexity] || MODEL_ROUTES[1]) };
  if (levelOverrides?.[String(complexity)]) {
    route.model = levelOverrides[String(complexity)];
    route.version = levelOverrides[String(complexity)];
  }
  return route;
}

function computeAssignmentScore(annotator: any, currentLoad: number): number {
  const quality = annotator.overall_accuracy || 0.5;
  const availability = 1.0 - (currentLoad / (annotator.max_concurrent_items || 10));
  const reliability = annotator.reliability_score || 0.5;

  return quality * 0.35 + availability * 0.25 + reliability * 0.25 + Math.random() * 0.15;
}

function weightedSample(pool: any[], n: number): any[] {
  const result: any[] = [];
  const available = [...pool];
  for (let i = 0; i < n && available.length > 0; i++) {
    const totalScore = available.reduce((s, p) => s + p.score, 0);
    let random = Math.random() * totalScore;
    for (let j = 0; j < available.length; j++) {
      random -= available[j].score;
      if (random <= 0) {
        result.push(available[j]);
        available.splice(j, 1);
        break;
      }
    }
  }
  return result;
}

function extractJson(input: string): string | null {
  const start = input.indexOf("{");
  if (start === -1) return null;
  let inString = false, escaped = false, depth = 0;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === '"') { inString = false; continue; }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth--; if (depth === 0) return input.slice(start, i + 1); }
  }
  return null;
}

function buildAutoAnnotationPrompt(
  taskType: string,
  guidelines: string,
  content: any,
  schema: any
): string {
  const typeInstructions: Record<string, string> = {
    classification: 'Classifie cet item. Retourne: {"type":"classification","labels":["label"],"confidence":0.95}',
    ranking: 'Ordonne les alternatives. Retourne: {"type":"ranking","order":["A","B","C"],"justification":"...","confidence":0.9}',
    rating: 'Note sur les dimensions. Retourne: {"type":"rating","dimensions":[{"name":"...","score":4,"justification":"..."}],"confidence":0.85}',
    comparison: 'Compare les réponses. Retourne: {"type":"comparison","preferred":"A","reasoning":"...","margin":"clear","confidence":0.9}',
    extraction: 'Extrais les informations. Retourne: {"type":"extraction","fields":{...},"confidence":0.9}',
  };

  return `## GUIDELINES
${(guidelines || "").slice(0, 2000)}

## ITEM À ANNOTER
Type de contenu: ${content?.type || "text"}
Contenu principal: ${(content?.primary || "").slice(0, 3000)}
${content?.secondary ? `Contenu secondaire: ${content.secondary.slice(0, 2000)}` : ""}
${content?.alternatives ? `Alternatives: ${JSON.stringify(content.alternatives).slice(0, 2000)}` : ""}

## INSTRUCTION
${typeInstructions[taskType] || "Annote cet item selon les guidelines."}`;
}

function generateRecommendations(iaa: number, goldAcc: number, drift: string): string[] {
  const recs: string[] = [];
  if (iaa < 0.6) recs.push("IAA faible — clarifier les guidelines et organiser une session de calibration");
  if (iaa < 0.8) recs.push("IAA insuffisant — ajouter des exemples et contre-exemples aux guidelines");
  if (goldAcc < 0.7) recs.push("Accuracy gold basse — identifier et recalibrer les annotateurs sous-performants");
  if (drift === "warning" || drift === "drifted") recs.push("Dérive détectée — vérifier les données récentes et relancer une calibration");
  if (recs.length === 0) recs.push("Qualité satisfaisante. Continuer le monitoring régulier.");
  return recs;
}
