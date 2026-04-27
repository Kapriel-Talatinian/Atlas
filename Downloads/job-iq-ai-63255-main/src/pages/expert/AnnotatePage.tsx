import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ErrorBoundary";
import { RankingDPOInterface } from "@/components/annotation/RankingDPOInterface";
import { ScoringInterface } from "@/components/annotation/ScoringInterface";
import { ComparisonABInterface } from "@/components/annotation/ComparisonABInterface";
import { RedTeamingInterface } from "@/components/annotation/RedTeamingInterface";
import { FactCheckingInterface } from "@/components/annotation/FactCheckingInterface";
import { TextGenerationInterface } from "@/components/annotation/TextGenerationInterface";
import { SpanAnnotationInterface } from "@/components/annotation/SpanAnnotationInterface";
import { ExtractionInterface } from "@/components/annotation/ExtractionInterface";
import { ConversationRatingInterface } from "@/components/annotation/ConversationRatingInterface";

export default function AnnotatePage() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const { data: task, isLoading } = useQuery({
    queryKey: ["annotation-task", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotation_tasks")
        .select("*")
        .eq("id", taskId)
        .single();
      if (error) throw error;

      // Fetch actual item content from annotation_items if task_content has item_id
      const tc = (data.task_content || {}) as any;
      if (tc.item_id) {
        const { data: item } = await supabase
          .from("annotation_items")
          .select("content")
          .eq("id", tc.item_id)
          .single();
        if (item?.content) {
          const itemContent = item.content as any;
          // Merge item content into task_content so interfaces can read it
          data.task_content = {
            ...tc,
            prompt: itemContent.primary || itemContent.prompt || tc.prompt || "",
            response: itemContent.secondary || itemContent.response || tc.response || "",
            response_a: itemContent.response_a || tc.response_a || "",
            response_b: itemContent.response_b || tc.response_b || "",
            claim: itemContent.claim || tc.claim || "",
            text: itemContent.text || itemContent.primary || tc.text || "",
            conversation: itemContent.conversation || tc.conversation || null,
            context: itemContent.context || tc.context || "",
            metadata: itemContent.metadata || tc.metadata || null,
          };
        }
      }

      return data;
    },
    enabled: !!taskId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-3xl mx-auto px-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Tâche introuvable.</p>
          <Button variant="outline" onClick={() => navigate("/expert/tasks")}>Retour aux tâches</Button>
        </div>
      </div>
    );
  }

  const rawType = task.source_type || "scoring";
  const taskContent = (task.task_content || {}) as any;
  const taskConfig = ((task as any).task_config || {}) as any;
  const domain = task.domain || "general";

  // Resolve actual annotation type from source_type or content shape
  const resolveTaskType = (type: string, content: any): string => {
    // Known annotation types pass through
    const knownTypes = ["ranking", "preference_dpo", "rating", "scoring", "comparison", "red_teaming", "validation", "fact_checking", "text_generation", "span_annotation", "extraction", "conversation_rating"];
    if (knownTypes.includes(type)) return type;
    // For "manual", "gold_task", "test_submission" etc., infer from content
    if (content.response_a && content.response_b) return "comparison";
    if (content.response || content.response_a) return "scoring";
    if (content.claim) return "fact_checking";
    if (content.conversation) return "conversation_rating";
    if (content.text) return "span_annotation";
    return "scoring"; // default fallback
  };

  const taskType = resolveTaskType(rawType, taskContent);

  // Common submit handler
  const handleSubmit = async (data: any, timeSpent: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Non authentifié");

    const { data: expertProfile } = await supabase
      .from("expert_profiles")
      .select("id")
      .eq("user_id", session.user.id)
      .single();
    if (!expertProfile?.id) throw new Error("Profil expert introuvable.");

    const { data: annotatorProfile } = await supabase
      .from("annotator_profiles")
      .select("id")
      .eq("expert_id", expertProfile.id)
      .maybeSingle();

    const itemId = taskContent?.item_id || task.source_id;
    const projectId = taskContent?.project_id || null;

    // ─── 1. CRITICAL — write expert_annotations ─────────────────
    // This is the ROW that fires the check_and_trigger_qa trigger,
    // which in turn invokes qa-engine when the threshold is met.
    // Without this insert, no QA, no alpha, no dataset.
    const dimensionsPayload =
      data.dimensions ||
      data.global_scores ||
      data.scores_a ||
      data.scores ||
      null;
    const reasoningText =
      data.reasoning ||
      data.justification ||
      data.global_reasoning ||
      data.summary ||
      null;

    const { error: expertInsertErr } = await supabase
      .from("expert_annotations")
      .insert({
        task_id: taskId!,
        expert_id: expertProfile.id,
        annotation_type: taskType,
        annotation_data: data,
        dimensions: dimensionsPayload,
        reasoning: reasoningText,
        preference: data.preference || null,
        preference_reasoning: data.preference_reasoning || data.reasoning || null,
        verdict: data.verdict || null,
        justification: data.justification || null,
        sources: data.sources || null,
        flaw_category: data.flaw_category || null,
        flaw_severity: data.flaw_severity || null,
        time_spent_seconds: timeSpent,
      });
    if (expertInsertErr) {
      throw new Error("Impossible d'enregistrer l'annotation : " + expertInsertErr.message);
    }

    // ─── 2. Mark this annotator's task_assignment as completed ──
    // The shared annotation_tasks row stays open until qa-engine
    // (triggered by step 1) decides to close or flag it.
    await supabase
      .from("task_assignments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("task_id", taskId!)
      .eq("expert_id", expertProfile.id);

    // ─── 3. Best-effort RLHF feedback log ──────────────────────
    // Non-blocking: feeds the historical RLHF feedback table for analytics.
    // Note: rejected_output now correctly reflects the rejected response.
    if (taskType === "ranking" || taskType === "preference_dpo" || taskType === "comparison") {
      const chosenIsA = data.preference === "A";
      const chosenIsB = data.preference === "B";
      supabase.from("rlhf_feedback").insert({
        annotator_id: String(expertProfile.id),
        expert_id: expertProfile.id,
        generated_output: { response: taskContent.response_a || taskContent.response || "" },
        prompt_used: taskContent.prompt || "",
        overall_rating: chosenIsA ? "up" : chosenIsB ? "down" : "neutral",
        scores: dimensionsPayload,
        comparison_rationale: reasoningText || "",
        chosen_output: chosenIsA
          ? { response: taskContent.response_a }
          : chosenIsB
            ? { response: taskContent.response_b }
            : null,
        rejected_output: chosenIsA
          ? { response: taskContent.response_b }
          : chosenIsB
            ? { response: taskContent.response_a }
            : null,
        time_spent_seconds: timeSpent,
        task_type: taskType,
        job_role: domain,
        job_level_targeted: task.complexity_level || "mid",
        country_context: "FR",
        reasoning_steps: { annotation_data: data },
        free_text_comment: data.comments || data.edit_notes || null,
      }).then(({ error }) => {
        if (error) console.error("rlhf_feedback insert error:", error);
      });
    }

    // ─── 4. Legacy annotations table (analytics compat, non-blocking) ──
    if (annotatorProfile?.id && itemId && projectId) {
      supabase.from("annotations").insert({
        annotator_id: annotatorProfile.id,
        item_id: itemId,
        project_id: projectId,
        value: { dimensions: dimensionsPayload, raw: data },
        time_spent: timeSpent,
        confidence: data.confidence || "medium",
        guidelines_version: "1.0",
      }).then(({ error }) => {
        if (error) console.error("annotations insert error:", error);
      });
    }

    navigate("/expert/tasks");
  };

  return (
    <ErrorBoundary>
      {taskType === "ranking" || taskType === "preference_dpo" ? (
        <RankingDPOInterface
          taskId={taskId!}
          domain={domain}
          content={{
            prompt: taskContent.prompt || "",
            response_a: taskContent.response_a || "",
            response_b: taskContent.response_b || "",
            metadata: taskContent.metadata,
          }}
          onSubmit={handleSubmit}
        />
      ) : taskType === "rating" || taskType === "scoring" ? (
        <ScoringInterface
          taskId={taskId!}
          domain={domain}
          content={{
            prompt: taskContent.prompt || "",
            response: taskContent.response || taskContent.response_a || "",
            dimensions: taskConfig.dimensions || taskContent.dimensions || ["correctness", "safety", "completeness", "reasoning_depth", "source_reliability", "communication_clarity"],
          }}
          onSubmit={handleSubmit}
        />
      ) : taskType === "comparison" ? (
        <ComparisonABInterface
          taskId={taskId!}
          domain={domain}
          content={{
            prompt: taskContent.prompt || "",
            response_a: taskContent.response_a || "",
            response_b: taskContent.response_b || "",
            dimensions: taskConfig.dimensions || ["correctness", "safety", "completeness", "reasoning_depth"],
          }}
          onSubmit={handleSubmit}
        />
      ) : taskType === "red_teaming" ? (
        <RedTeamingInterface
          taskId={taskId!}
          domain={domain}
          content={{
            prompt: taskContent.prompt || "",
            response: taskContent.response || "",
            mode: taskConfig.mode || "review",
          }}
          onSubmit={handleSubmit}
        />
      ) : taskType === "validation" || taskType === "fact_checking" ? (
        <FactCheckingInterface
          taskId={taskId!}
          domain={domain}
          content={{
            prompt: taskContent.prompt,
            claim: taskContent.claim || taskContent.response || "",
            context: taskContent.context,
          }}
          onSubmit={handleSubmit}
        />
      ) : taskType === "text_generation" ? (
        <TextGenerationInterface
          taskId={taskId!}
          domain={domain}
          content={{
            prompt: taskContent.prompt || "",
            model_response: taskContent.model_response || taskContent.response,
            instructions: taskContent.instructions || taskConfig.instructions,
            target_length: taskConfig.target_length,
            target_tone: taskConfig.target_tone,
          }}
          onSubmit={handleSubmit}
        />
      ) : taskType === "span_annotation" ? (
        <SpanAnnotationInterface
          item={{ id: taskId!, content: { primary: taskContent.text || taskContent.response || "" } }}
          labels={(taskConfig.label_set || ["correct", "minor_error", "major_error", "hallucination"]).map((l: string, i: number) => ({
            key: l, label: l.replace(/_/g, " "), color: ["#10B981","#F59E0B","#EF4444","#7B6FF0","#3B82F6","#EC4899"][i % 6]
          }))}
          onSubmit={(value) => handleSubmit({ spans: value.spans }, 0)}
          onFlag={(reason) => console.log("flagged:", reason)}
          progress={{ current: 1, total: 1 }}
          sessionDuration={0}
        />
      ) : taskType === "extraction" ? (
        <ExtractionInterface
          taskId={taskId!}
          domain={domain}
          content={{
            text: taskContent.text || taskContent.response || "",
            extraction_schema: taskConfig.extraction_schema || { fields: [] },
            instructions: taskConfig.instructions,
          }}
          onSubmit={handleSubmit}
        />
      ) : taskType === "conversation_rating" ? (
        <ConversationRatingInterface
          taskId={taskId!}
          domain={domain}
          content={{
            conversation: taskConfig.conversation || taskContent.conversation || [],
            system_prompt: taskConfig.system_prompt,
            dimensions: taskConfig.dimensions || ["helpfulness", "coherence", "safety", "instruction_following", "tone"],
            evaluate_per_turn: taskConfig.evaluate_per_turn !== false,
          }}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Type de tâche non supporté : {taskType}</p>
            <Button variant="outline" onClick={() => navigate("/expert/tasks")}>Retour aux tâches</Button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
