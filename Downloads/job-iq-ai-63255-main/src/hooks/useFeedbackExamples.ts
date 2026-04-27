import { supabase } from "@/integrations/supabase/client";

interface FeedbackExample {
  input_context: Record<string, unknown>;
  ai_output: Record<string, unknown>;
  is_positive: boolean;
  human_correction: string | null;
}

export const useFeedbackExamples = () => {
  const getFeedbackExamples = async (
    functionName: string,
    limit: number = 5
  ): Promise<FeedbackExample[]> => {
    try {
      const { data, error } = await supabase
        .from("ai_feedback")
        .select("input_context, ai_output, is_positive, human_correction")
        .eq("function_name", functionName)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching feedback examples:", error);
        return [];
      }

      return (data || []) as FeedbackExample[];
    } catch (error) {
      console.error("Error in getFeedbackExamples:", error);
      return [];
    }
  };

  const formatExamplesForPrompt = (examples: FeedbackExample[]): string => {
    if (examples.length === 0) return "";

    const positiveExamples = examples.filter(e => e.is_positive);
    const negativeExamples = examples.filter(e => !e.is_positive);

    let promptSection = "\n\n--- FEEDBACK HUMAIN (RLHF) ---\n";
    
    if (positiveExamples.length > 0) {
      promptSection += "\nExemples de bonnes réponses validées par les utilisateurs:\n";
      positiveExamples.slice(0, 3).forEach((ex, i) => {
        promptSection += `${i + 1}. Contexte: ${JSON.stringify(ex.input_context).slice(0, 200)}...\n`;
        promptSection += `   Réponse approuvée: ${JSON.stringify(ex.ai_output).slice(0, 300)}...\n\n`;
      });
    }

    if (negativeExamples.length > 0) {
      promptSection += "\nExemples de réponses à éviter (feedback négatif):\n";
      negativeExamples.slice(0, 2).forEach((ex, i) => {
        promptSection += `${i + 1}. Contexte: ${JSON.stringify(ex.input_context).slice(0, 200)}...\n`;
        promptSection += `   Réponse problématique: ${JSON.stringify(ex.ai_output).slice(0, 200)}...\n`;
        if (ex.human_correction) {
          promptSection += `   Correction suggérée: ${ex.human_correction}\n`;
        }
        promptSection += "\n";
      });
    }

    promptSection += "Utilise ces exemples pour améliorer la qualité de tes réponses.\n";
    promptSection += "--- FIN FEEDBACK RLHF ---\n";

    return promptSection;
  };

  return { getFeedbackExamples, formatExamplesForPrompt };
};
