import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const GOLD_TASK_PROBABILITY = 0.05; // 5% injection rate

interface GoldTask {
  id: string;
  task_type: string;
  job_role: string;
  job_level: string;
  ai_output: Record<string, unknown>;
  expected_rating: "up" | "down" | "neutral";
  expected_issues: string[] | null;
  min_agreement_threshold: number | null;
}

interface GoldTaskInjectionResult {
  isGoldTask: boolean;
  goldTask: GoldTask | null;
  taskContext: {
    task_type: string;
    job_role: string;
    job_level_targeted: string;
    language: string;
    country_context: string;
  } | null;
  aiOutput: {
    generated_output: Record<string, unknown>;
    model_type: string;
  } | null;
}

interface UseGoldTaskInjectionOptions {
  expertId: string;
  originalTaskContext: {
    task_type: string;
    job_role: string;
    job_level_targeted: string;
    language: string;
    country_context: string;
  };
  originalAiOutput: {
    generated_output: Record<string, unknown>;
    model_type?: string;
    test_id?: string;
    job_offer_id?: string;
  };
}

export function useGoldTaskInjection({
  expertId,
  originalTaskContext,
  originalAiOutput,
}: UseGoldTaskInjectionOptions) {
  const [injectionResult, setInjectionResult] = useState<GoldTaskInjectionResult>({
    isGoldTask: false,
    goldTask: null,
    taskContext: null,
    aiOutput: null,
  });
  const [loading, setLoading] = useState(true);
  const [injectionDecided, setInjectionDecided] = useState(false);

  // Decide on injection once per mount
  useEffect(() => {
    if (injectionDecided) return;
    
    const shouldInject = Math.random() < GOLD_TASK_PROBABILITY;
    
    if (shouldInject) {
      injectGoldTask();
    } else {
      // Use original task
      setInjectionResult({
        isGoldTask: false,
        goldTask: null,
        taskContext: originalTaskContext,
        aiOutput: {
          generated_output: originalAiOutput.generated_output,
          model_type: originalAiOutput.model_type || "lovable_ai_v1",
        },
      });
      setLoading(false);
    }
    
    setInjectionDecided(true);
  }, [expertId, injectionDecided]);

  async function injectGoldTask() {
    try {
      // Fetch active gold tasks matching the job level if possible
      const { data: goldTasks, error } = await supabase
        .from("rlhf_gold_tasks")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;

      if (!goldTasks || goldTasks.length === 0) {
        // No gold tasks available, use original
        console.log("[GoldTask] No active gold tasks, using original");
        setInjectionResult({
          isGoldTask: false,
          goldTask: null,
          taskContext: originalTaskContext,
          aiOutput: {
            generated_output: originalAiOutput.generated_output,
            model_type: originalAiOutput.model_type || "lovable_ai_v1",
          },
        });
        setLoading(false);
        return;
      }

      // Try to find a matching gold task by level, otherwise random
      let matchingTasks = goldTasks.filter(
        (gt) => gt.job_level === originalTaskContext.job_level_targeted
      );
      
      if (matchingTasks.length === 0) {
        matchingTasks = goldTasks;
      }

      // Select random gold task
      const selectedTask = matchingTasks[Math.floor(Math.random() * matchingTasks.length)];

      console.log("[GoldTask] Injecting gold task:", selectedTask.id);

      // Build injected context (blend with original to maintain realism)
      const injectedContext = {
        task_type: selectedTask.task_type,
        job_role: selectedTask.job_role,
        job_level_targeted: selectedTask.job_level,
        language: originalTaskContext.language, // Keep original language
        country_context: originalTaskContext.country_context, // Keep original country
      };

      const injectedOutput = {
        generated_output: selectedTask.ai_output as Record<string, unknown>,
        model_type: "gold_task_reference",
      };

      setInjectionResult({
        isGoldTask: true,
        goldTask: selectedTask as GoldTask,
        taskContext: injectedContext,
        aiOutput: injectedOutput,
      });
    } catch (error) {
      console.error("[GoldTask] Injection failed:", error);
      // Fallback to original
      setInjectionResult({
        isGoldTask: false,
        goldTask: null,
        taskContext: originalTaskContext,
        aiOutput: {
          generated_output: originalAiOutput.generated_output,
          model_type: originalAiOutput.model_type || "lovable_ai_v1",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  // Calculate agreement score after submission
  const calculateGoldTaskAgreement = useCallback(
    (
      submittedRating: "up" | "down" | "neutral",
      submittedIssues: string[]
    ): { passed: boolean; agreementScore: number; details: string } => {
      if (!injectionResult.isGoldTask || !injectionResult.goldTask) {
        return { passed: true, agreementScore: 1.0, details: "Not a gold task" };
      }

      const goldTask = injectionResult.goldTask;
      let ratingMatch = submittedRating === goldTask.expected_rating;
      let issueOverlap = 1.0;
      let details = "";

      // Check rating
      if (!ratingMatch) {
        details += `Rating mismatch: expected ${goldTask.expected_rating}, got ${submittedRating}. `;
      }

      // Check issues overlap
      const expectedIssues = goldTask.expected_issues || [];
      if (expectedIssues.length > 0) {
        const submittedSet = new Set(submittedIssues);
        const expectedSet = new Set(expectedIssues);
        const overlap = [...expectedSet].filter((i) => submittedSet.has(i)).length;
        issueOverlap = overlap / expectedSet.size;
        
        if (issueOverlap < 0.5) {
          details += `Issue overlap too low: ${(issueOverlap * 100).toFixed(0)}% (min 50%). `;
        }
      }

      // Passed if rating matches AND issue overlap >= 50%
      const passed = ratingMatch && issueOverlap >= 0.5;
      
      // Calculate weighted agreement score
      const agreementScore = (ratingMatch ? 0.6 : 0) + (issueOverlap >= 0.5 ? 0.4 * issueOverlap : 0);

      return {
        passed,
        agreementScore,
        details: passed ? "Gold task passed successfully" : details.trim(),
      };
    },
    [injectionResult]
  );

  return {
    loading,
    isGoldTask: injectionResult.isGoldTask,
    goldTask: injectionResult.goldTask,
    taskContext: injectionResult.taskContext,
    aiOutput: injectionResult.aiOutput,
    calculateGoldTaskAgreement,
    injectionRate: GOLD_TASK_PROBABILITY,
  };
}

export type { GoldTask, GoldTaskInjectionResult };
