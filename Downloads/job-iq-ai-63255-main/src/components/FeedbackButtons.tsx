import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FeedbackButtonsProps {
  functionName: string;
  inputContext: Record<string, unknown>;
  aiOutput: Record<string, unknown>;
  userId?: string;
  expertId?: string;
  jobOfferId?: string;
  onFeedbackSubmitted?: () => void;
  size?: "sm" | "md";
}

export const FeedbackButtons = ({
  functionName,
  inputContext,
  aiOutput,
  userId,
  expertId,
  jobOfferId,
  onFeedbackSubmitted,
  size = "sm"
}: FeedbackButtonsProps) => {
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState("");
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = async (isPositive: boolean, humanCorrection?: string) => {
    if (feedbackGiven !== null) return;
    
    setIsSubmitting(true);
    try {
      const feedbackData = {
        function_name: functionName,
        input_context: inputContext as unknown,
        ai_output: aiOutput as unknown,
        is_positive: isPositive,
        human_rating: isPositive ? 5 : 1,
        human_correction: humanCorrection || null,
        user_id: userId || null,
        expert_id: expertId || null,
        job_offer_id: jobOfferId || null
      };

      const { error } = await supabase.from("ai_feedback").insert(feedbackData as any);

      setFeedbackGiven(isPositive);
      setShowCorrection(false);
      toast.success("Merci pour votre feedback !");
      onFeedbackSubmitted?.();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Erreur lors de l'envoi du feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNegativeFeedback = () => {
    if (showCorrection) {
      submitFeedback(false, correction);
    } else {
      setShowCorrection(true);
    }
  };

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-6 w-6" : "h-8 w-8";

  if (feedbackGiven !== null) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        {feedbackGiven ? (
          <ThumbsUp className={`${iconSize} text-green-500`} />
        ) : (
          <ThumbsDown className={`${iconSize} text-red-500`} />
        )}
        <span>Merci !</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={`${buttonSize} hover:bg-green-100 hover:text-green-600`}
          onClick={() => submitFeedback(true)}
          disabled={isSubmitting}
          title="Réponse utile"
        >
          <ThumbsUp className={iconSize} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`${buttonSize} hover:bg-red-100 hover:text-red-600`}
          onClick={handleNegativeFeedback}
          disabled={isSubmitting}
          title="Réponse à améliorer"
        >
          <ThumbsDown className={iconSize} />
        </Button>
        {!showCorrection && (
          <Button
            variant="ghost"
            size="icon"
            className={`${buttonSize} hover:bg-muted`}
            onClick={() => setShowCorrection(true)}
            disabled={isSubmitting}
            title="Ajouter un commentaire"
          >
            <MessageSquare className={iconSize} />
          </Button>
        )}
      </div>
      
      {showCorrection && (
        <div className="flex flex-col gap-2 p-2 bg-muted/50 rounded-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Qu'est-ce qui pourrait être amélioré ?</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setShowCorrection(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="Votre suggestion..."
            className="min-h-[60px] text-sm"
          />
          <Button
            size="sm"
            onClick={() => submitFeedback(false, correction)}
            disabled={isSubmitting}
            className="self-end"
          >
            Envoyer
          </Button>
        </div>
      )}
    </div>
  );
};
