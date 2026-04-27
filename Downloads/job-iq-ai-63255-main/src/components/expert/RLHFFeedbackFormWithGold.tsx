import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Minus, Loader2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { AnnotatorQualification } from "./AnnotatorQualification";
import { useGoldTaskInjection } from "@/hooks/useGoldTaskInjection";

interface TaskContext {
  task_type: string;
  job_role: string;
  job_level_targeted: string;
  language: string;
  country_context: string;
  prompt_used?: string;
  constraints?: {
    duration_minutes?: number;
    difficulty_expected?: string;
    format_expected?: string;
  };
}

interface AIOutput {
  model_type?: string;
  generated_output: Record<string, unknown>;
  test_id?: string;
  job_offer_id?: string;
}

interface RLHFFeedbackFormWithGoldProps {
  taskContext: TaskContext;
  aiOutput: AIOutput;
  expertId: string;
  onSubmitted: () => void;
}

interface Scores {
  correctness: number;
  readability: number;
  performance: number;
  security: number;
  best_practices: number;
  testing: number;
  scalability: number;
  architecture: number;
  problem_solving: number;
  documentation: number;
}

// Normalized issues list - Extended with reasoning/comment issues
const ISSUES_LIST = [
  { id: "too_theoretical", label: "Trop théorique" },
  { id: "too_practical", label: "Trop pratique" },
  { id: "not_job_representative", label: "Ne représente pas le poste" },
  { id: "too_easy", label: "Trop facile" },
  { id: "too_hard", label: "Trop difficile" },
  { id: "unclear_questions", label: "Questions pas claires" },
  { id: "biased_content", label: "Contenu biaisé" },
  { id: "outdated_tech", label: "Technologies obsolètes" },
  { id: "missing_context", label: "Contexte manquant" },
  { id: "time_unrealistic", label: "Temps irréaliste" },
  { id: "missing_explanation", label: "Pas d'explication de l'approche" },
  { id: "uncommented_code", label: "Code sans commentaires" },
  { id: "unjustified_decisions", label: "Décisions non justifiées" },
  { id: "shallow_reasoning", label: "Raisonnement superficiel" },
];

const SCORE_LABELS = {
  correctness: "Exactitude technique",
  readability: "Clarté et lisibilité",
  performance: "Optimisation / Performance",
  security: "Sécurité",
  best_practices: "Bonnes pratiques",
  testing: "Couverture de tests",
  scalability: "Passage à l'échelle",
  architecture: "Architecture du code",
  problem_solving: "Raisonnement logique",
  documentation: "Documentation / Commentaires",
};

interface ExpertProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  city: string;
  title: string;
  bio: string | null;
  primary_skills: string[];
  secondary_skills: string[] | null;
  languages: string[] | null;
  years_of_experience: number;
  daily_rate: number | null;
  availability: string;
  work_type: string[];
  contract_types: string[];
  cv_url: string | null;
  cv_filename: string | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  referral_code: string | null;
  avatar_url: string | null;
  kyc_status: string;
  kyc_verified_at: string | null;
  onboarding_completed: boolean | null;
  profile_visible: boolean | null;
  email_notifications: boolean | null;
  sms_notifications: boolean | null;
  notify_job_matches: boolean | null;
  notify_application_updates: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

function calculateAccountAgeDays(createdAt: string | null): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateProfileCompleteness(profile: ExpertProfile): number {
  let score = 0;
  const checks = [
    !!profile.title,
    !!profile.bio && profile.bio.length > 50,
    profile.primary_skills.length > 0,
    profile.secondary_skills && profile.secondary_skills.length > 0,
    profile.languages && profile.languages.length > 0,
    profile.years_of_experience > 0,
    !!profile.daily_rate,
    !!profile.city,
    !!profile.country,
    !!profile.cv_url,
    !!profile.linkedin_url,
    !!profile.github_url,
    !!profile.portfolio_url,
    !!profile.avatar_url,
    profile.kyc_status === 'verified',
  ];
  
  checks.forEach(check => { if (check) score++; });
  return Math.round((score / checks.length) * 100);
}

function buildExpertProfileSnapshot(profile: ExpertProfile | null) {
  if (!profile) return null;
  
  return {
    title: profile.title,
    bio: profile.bio,
    primary_skills: profile.primary_skills,
    secondary_skills: profile.secondary_skills,
    languages: profile.languages,
    years_of_experience: profile.years_of_experience,
    work_type: profile.work_type,
    contract_types: profile.contract_types,
    daily_rate: profile.daily_rate,
    availability: profile.availability,
    city: profile.city,
    country: profile.country,
    has_linkedin: !!profile.linkedin_url,
    has_github: !!profile.github_url,
    has_portfolio: !!profile.portfolio_url,
    has_cv: !!profile.cv_url,
    kyc_status: profile.kyc_status,
    kyc_verified: !!profile.kyc_verified_at,
    onboarding_completed: profile.onboarding_completed,
    profile_visible: profile.profile_visible,
    account_age_days: calculateAccountAgeDays(profile.created_at),
    email_notifications: profile.email_notifications,
    sms_notifications: profile.sms_notifications,
    notify_job_matches: profile.notify_job_matches,
    notify_application_updates: profile.notify_application_updates,
    profile_completeness: calculateProfileCompleteness(profile),
  };
}

export function RLHFFeedbackFormWithGold({ 
  taskContext, 
  aiOutput, 
  expertId, 
  onSubmitted 
}: RLHFFeedbackFormWithGoldProps) {
  const [showQualification, setShowQualification] = useState(false);
  const [annotatorProfile, setAnnotatorProfile] = useState<{ anonymized_id: string } | null>(null);
  const [expertProfile, setExpertProfile] = useState<ExpertProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  
  // Gold Task injection hook
  const {
    loading: goldTaskLoading,
    isGoldTask,
    goldTask,
    taskContext: injectedTaskContext,
    aiOutput: injectedAiOutput,
    calculateGoldTaskAgreement,
  } = useGoldTaskInjection({
    expertId,
    originalTaskContext: taskContext,
    originalAiOutput: aiOutput,
  });
  
  // Form state
  const [overallRating, setOverallRating] = useState<"up" | "down" | "neutral" | null>(null);
  const [scores, setScores] = useState<Scores>({
    correctness: 3,
    readability: 3,
    performance: 3,
    security: 3,
    best_practices: 3,
    testing: 3,
    scalability: 3,
    architecture: 3,
    problem_solving: 3,
    documentation: 3,
  });
  const [issuesDetected, setIssuesDetected] = useState<string[]>([]);
  const [freeTextComment, setFreeTextComment] = useState("");
  const [preferredAction, setPreferredAction] = useState<"accept" | "regenerate" | "edit" | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [goldTaskResult, setGoldTaskResult] = useState<{ passed: boolean; details: string } | null>(null);

  // Check if annotator profile exists and load expert profile
  useEffect(() => {
    loadProfiles();
  }, [expertId]);

  async function loadProfiles() {
    try {
      const [annotatorRes, expertRes] = await Promise.all([
        supabase
          .from("annotator_profiles")
          .select("anonymized_id")
          .eq("expert_id", expertId)
          .maybeSingle(),
        supabase
          .from("expert_profiles")
          .select("*")
          .eq("id", expertId)
          .maybeSingle()
      ]);

      if (annotatorRes.error) throw annotatorRes.error;
      if (expertRes.error) throw expertRes.error;
      
      if (annotatorRes.data) {
        setAnnotatorProfile(annotatorRes.data);
      } else {
        setShowQualification(true);
      }
      
      if (expertRes.data) {
        setExpertProfile(expertRes.data as ExpertProfile);
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
    } finally {
      setCheckingProfile(false);
    }
  }

  function handleQualificationComplete(profile: { anonymized_id: string }) {
    setAnnotatorProfile(profile);
    setShowQualification(false);
  }

  function toggleIssue(issueId: string) {
    setIssuesDetected(prev => 
      prev.includes(issueId) 
        ? prev.filter(i => i !== issueId)
        : [...prev, issueId]
    );
  }

  function updateScore(key: keyof Scores, value: number[]) {
    setScores(prev => ({ ...prev, [key]: value[0] }));
  }

  async function updateAnnotatorReliability(passed: boolean) {
    if (!annotatorProfile) return;
    
    try {
      // Get current stats
      const { data: currentProfile } = await supabase
        .from("annotator_profiles")
        .select("gold_tasks_completed, gold_tasks_passed, reliability_score")
        .eq("expert_id", expertId)
        .maybeSingle();
      
      if (!currentProfile) return;
      
      const newCompleted = (currentProfile.gold_tasks_completed || 0) + 1;
      const newPassed = (currentProfile.gold_tasks_passed || 0) + (passed ? 1 : 0);
      const newReliability = newCompleted > 0 ? newPassed / newCompleted : 1.0;
      
      await supabase
        .from("annotator_profiles")
        .update({
          gold_tasks_completed: newCompleted,
          gold_tasks_passed: newPassed,
          reliability_score: newReliability,
        })
        .eq("expert_id", expertId);
        
      console.log(`[GoldTask] Annotator reliability updated: ${(newReliability * 100).toFixed(1)}%`);
    } catch (error) {
      console.error("Error updating reliability:", error);
    }
  }

  async function handleSubmit() {
    if (!overallRating) {
      toast.error("Veuillez donner un avis global (👍, 👎, ou ➖)");
      return;
    }

    if (overallRating === "down" && freeTextComment.length < 20) {
      toast.error("Pour un avis négatif, veuillez fournir un commentaire d'au moins 20 caractères");
      return;
    }

    if (!annotatorProfile) {
      toast.error("Profil annotateur requis");
      setShowQualification(true);
      return;
    }

    if (!injectedTaskContext || !injectedAiOutput) {
      toast.error("Contexte de tâche manquant");
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate gold task agreement if applicable
      let goldAgreement = null;
      if (isGoldTask && goldTask) {
        goldAgreement = calculateGoldTaskAgreement(overallRating, issuesDetected);
        setGoldTaskResult({ passed: goldAgreement.passed, details: goldAgreement.details });
        
        // Update annotator reliability score
        await updateAnnotatorReliability(goldAgreement.passed);
      }

      const expertProfileSnapshot = buildExpertProfileSnapshot(expertProfile);

      const feedbackData = {
        // Task context (injected or original)
        task_type: injectedTaskContext.task_type,
        job_role: injectedTaskContext.job_role,
        job_level_targeted: injectedTaskContext.job_level_targeted,
        language: injectedTaskContext.language,
        country_context: injectedTaskContext.country_context,
        prompt_used: taskContext.prompt_used,
        constraints: taskContext.constraints,
        
        // AI output (injected or original)
        model_type: injectedAiOutput.model_type,
        generated_output: injectedAiOutput.generated_output,
        generation_timestamp: new Date().toISOString(),
        test_id: aiOutput.test_id,
        job_offer_id: aiOutput.job_offer_id,
        
        // Human feedback
        overall_rating: overallRating,
        scores,
        issues_detected: issuesDetected,
        free_text_comment: freeTextComment || null,
        preferred_action: preferredAction,
        
        // Annotator
        annotator_id: annotatorProfile.anonymized_id,
        expert_id: expertId,
        expert_profile_snapshot: expertProfileSnapshot,
        
        // Gold Task tracking
        gold_task: isGoldTask,
        gold_task_id: goldTask?.id || null,
        agreement_score: goldAgreement?.agreementScore || null,
        
        // QA
        is_duplicate_annotation: false,
        qa_status: isGoldTask ? "gold_calibration" : "pending",
        
        // Legal
        rights_assigned: true,
        pii_present: false,
        consent_version: "v1.0",
        
        // Metadata
        platform_version: "web_v1",
        session_id: `sess_${Date.now()}`,
      };

      const { error } = await supabase
        .from("rlhf_feedback")
        .insert(feedbackData as never);

      if (error) throw error;

      setSubmitted(true);
      
      if (isGoldTask && goldAgreement) {
        if (goldAgreement.passed) {
          toast.success("Excellent ! Tâche de calibration réussie 🎯");
        } else {
          toast.info("Merci pour votre feedback. Continuez pour améliorer votre score de fiabilité.");
        }
      } else {
        toast.success("Merci pour votre feedback !");
      }
      
      onSubmitted();
    } catch (error) {
      console.error("Error submitting RLHF feedback:", error);
      toast.error("Erreur lors de l'envoi du feedback");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Loading states
  if (checkingProfile || goldTaskLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-3 mt-4">
              <Skeleton className="h-14 flex-1" />
              <Skeleton className="h-14 flex-1" />
              <Skeleton className="h-14 flex-1" />
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showQualification) {
    return (
      <AnnotatorQualification
        expertId={expertId}
        onComplete={handleQualificationComplete}
      />
    );
  }

  if (submitted) {
    return (
      <Card className={`border-2 ${goldTaskResult?.passed ? "border-success/50 bg-success/5" : isGoldTask ? "border-warning/50 bg-warning/5" : "border-success/50 bg-success/5"}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            {isGoldTask ? (
              <Sparkles className={`h-6 w-6 ${goldTaskResult?.passed ? "text-success" : "text-warning"}`} />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-success" />
            )}
            <div>
              <p className="font-medium">
                {isGoldTask 
                  ? goldTaskResult?.passed 
                    ? "🎯 Tâche de calibration réussie !" 
                    : "📊 Calibration enregistrée"
                  : "Feedback enregistré"
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {isGoldTask 
                  ? "Cette tâche était une calibration pour mesurer votre précision."
                  : "Votre contribution aide à améliorer notre IA"
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use injected context for display
  const displayContext = injectedTaskContext || taskContext;

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧠 Votre avis sur l'évaluation IA
          {/* Hidden indicator for debugging - remove in production */}
        </CardTitle>
        <CardDescription>
          Évaluez ce test pour <strong>{displayContext.job_role}</strong> (niveau {displayContext.job_level_targeted})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section 1: Overall Rating */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            1. Avis global sur l'évaluation IA <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-3">
            <Button
              type="button"
              variant={overallRating === "up" ? "default" : "outline"}
              className={`flex-1 h-14 ${overallRating === "up" ? "bg-success hover:bg-success/90" : ""}`}
              onClick={() => setOverallRating("up")}
            >
              <ThumbsUp className="h-5 w-5 mr-2" />
              Satisfait
            </Button>
            <Button
              type="button"
              variant={overallRating === "neutral" ? "default" : "outline"}
              className={`flex-1 h-14 ${overallRating === "neutral" ? "bg-muted-foreground hover:bg-muted-foreground/90" : ""}`}
              onClick={() => setOverallRating("neutral")}
            >
              <Minus className="h-5 w-5 mr-2" />
              Neutre
            </Button>
            <Button
              type="button"
              variant={overallRating === "down" ? "default" : "outline"}
              className={`flex-1 h-14 ${overallRating === "down" ? "bg-destructive hover:bg-destructive/90" : ""}`}
              onClick={() => setOverallRating("down")}
            >
              <ThumbsDown className="h-5 w-5 mr-2" />
              Insatisfait
            </Button>
          </div>
        </div>

        {/* Section 2: Detailed Scores */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">
            2. Évaluation détaillée (1-5)
          </Label>
          <div className="grid gap-4">
            {(Object.keys(SCORE_LABELS) as Array<keyof Scores>).map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{SCORE_LABELS[key]}</span>
                  <Badge variant="outline">{scores[key]}/5</Badge>
                </div>
                <Slider
                  value={[scores[key]]}
                  onValueChange={(v) => updateScore(key, v)}
                  min={1}
                  max={5}
                  step={1}
                  className="cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Issues Detected */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            3. Problèmes détectés (optionnel)
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {ISSUES_LIST.map((issue) => (
              <div key={issue.id} className="flex items-center space-x-2">
                <Checkbox
                  id={issue.id}
                  checked={issuesDetected.includes(issue.id)}
                  onCheckedChange={() => toggleIssue(issue.id)}
                />
                <label
                  htmlFor={issue.id}
                  className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {issue.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Free Text Comment */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-base font-semibold">
              4. Commentaire libre {overallRating === "down" && <span className="text-destructive">*</span>}
            </Label>
            <span className="text-xs text-muted-foreground">
              {freeTextComment.length}/20 caractères min.
            </span>
          </div>
          <Textarea
            value={freeTextComment}
            onChange={(e) => setFreeTextComment(e.target.value)}
            placeholder="Décrivez ce qui pourrait être amélioré ou ce qui était particulièrement bien..."
            className="min-h-[80px]"
          />
          {overallRating === "down" && freeTextComment.length < 20 && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Un commentaire de 20+ caractères est requis pour les avis négatifs
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Section 5: Preferred Action */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            5. Action préférée
          </Label>
          <RadioGroup
            value={preferredAction || ""}
            onValueChange={(v) => setPreferredAction(v as "accept" | "regenerate" | "edit")}
            className="grid grid-cols-3 gap-2"
          >
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="accept" id="accept" />
              <label htmlFor="accept" className="text-sm cursor-pointer">
                ✅ Accepter
              </label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="regenerate" id="regenerate" />
              <label htmlFor="regenerate" className="text-sm cursor-pointer">
                🔄 Régénérer
              </label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="edit" id="edit" />
              <label htmlFor="edit" className="text-sm cursor-pointer">
                ✏️ Modifier
              </label>
            </div>
          </RadioGroup>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !overallRating}
          className="w-full h-12 text-base"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            "Soumettre mon feedback"
          )}
        </Button>

        {/* Legal notice */}
        <p className="text-xs text-muted-foreground text-center">
          En soumettant ce feedback, vous acceptez que vos réponses soient utilisées 
          pour améliorer nos algorithmes d'IA de manière anonymisée.
        </p>
      </CardContent>
    </Card>
  );
}

export default RLHFFeedbackFormWithGold;
