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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Minus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AnnotatorQualification } from "./AnnotatorQualification";

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
  generated_output: any;
  test_id?: string;
  job_offer_id?: string;
}

interface RLHFFeedbackFormProps {
  taskContext: TaskContext;
  aiOutput: AIOutput;
  expertId: string;
  onSubmitted: () => void;
}

interface Scores {
  clarity: number;
  relevance: number;
  difficulty_alignment: number;
  job_realism: number;
  bias_risk: number;
}

// Normalized issues list
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
];

const SCORE_LABELS = {
  clarity: "Clarté des questions",
  relevance: "Pertinence par rapport au poste",
  difficulty_alignment: "Alignement de la difficulté",
  job_realism: "Réalisme métier",
  bias_risk: "Risque de biais (1=élevé, 5=faible)",
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

function buildExpertProfileSnapshot(profile: ExpertProfile | null) {
  if (!profile) return null;
  
  return {
    // Professional Identity
    title: profile.title,
    bio: profile.bio,
    
    // Skills & Expertise
    primary_skills: profile.primary_skills,
    secondary_skills: profile.secondary_skills,
    languages: profile.languages,
    years_of_experience: profile.years_of_experience,
    
    // Work Preferences
    work_type: profile.work_type,
    contract_types: profile.contract_types,
    daily_rate: profile.daily_rate,
    availability: profile.availability,
    
    // Location
    city: profile.city,
    country: profile.country,
    
    // Professional Presence
    has_linkedin: !!profile.linkedin_url,
    has_github: !!profile.github_url,
    has_portfolio: !!profile.portfolio_url,
    has_cv: !!profile.cv_url,
    
    // Platform Engagement
    kyc_status: profile.kyc_status,
    kyc_verified: !!profile.kyc_verified_at,
    onboarding_completed: profile.onboarding_completed,
    profile_visible: profile.profile_visible,
    account_age_days: calculateAccountAgeDays(profile.created_at),
    
    // Notification Preferences
    email_notifications: profile.email_notifications,
    sms_notifications: profile.sms_notifications,
    notify_job_matches: profile.notify_job_matches,
    notify_application_updates: profile.notify_application_updates,
    
    // Profile Completeness Score
    profile_completeness: calculateProfileCompleteness(profile),
  };
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

export function RLHFFeedbackForm({ 
  taskContext, 
  aiOutput, 
  expertId, 
  onSubmitted 
}: RLHFFeedbackFormProps) {
  const [showQualification, setShowQualification] = useState(false);
  const [annotatorProfile, setAnnotatorProfile] = useState<any>(null);
  const [expertProfile, setExpertProfile] = useState<ExpertProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  
  // Form state
  const [overallRating, setOverallRating] = useState<"up" | "down" | "neutral" | null>(null);
  const [scores, setScores] = useState<Scores>({
    clarity: 3,
    relevance: 3,
    difficulty_alignment: 3,
    job_realism: 3,
    bias_risk: 3,
  });
  const [issuesDetected, setIssuesDetected] = useState<string[]>([]);
  const [freeTextComment, setFreeTextComment] = useState("");
  const [preferredAction, setPreferredAction] = useState<"accept" | "regenerate" | "edit" | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Check if annotator profile exists and load expert profile
  useEffect(() => {
    loadProfiles();
  }, [expertId]);

  async function loadProfiles() {
    try {
      // Load both annotator profile and expert profile in parallel
      const [annotatorRes, expertRes] = await Promise.all([
        supabase
          .from("annotator_profiles")
          .select("*")
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

  function handleQualificationComplete(profile: any) {
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

  async function handleSubmit() {
    if (!overallRating) {
      toast.error("Veuillez donner un avis global (👍, 👎, ou ➖)");
      return;
    }

    // Validate minimum comment length for negative feedback
    if (overallRating === "down" && freeTextComment.length < 20) {
      toast.error("Pour un avis négatif, veuillez fournir un commentaire d'au moins 20 caractères");
      return;
    }

    if (!annotatorProfile) {
      toast.error("Profil annotateur requis");
      setShowQualification(true);
      return;
    }

    setIsSubmitting(true);
    try {
      // 10% chance of double annotation
      const isDoubleAnnotation = Math.random() < 0.10;
      
      // Build complete expert profile snapshot
      const expertProfileSnapshot = buildExpertProfileSnapshot(expertProfile);

      const feedbackData = {
        // Task context
        task_type: taskContext.task_type,
        job_role: taskContext.job_role,
        job_level_targeted: taskContext.job_level_targeted,
        language: taskContext.language,
        country_context: taskContext.country_context,
        prompt_used: taskContext.prompt_used,
        constraints: taskContext.constraints,
        
        // AI output
        model_type: aiOutput.model_type || "lovable_ai_v1",
        generated_output: aiOutput.generated_output,
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
        
        // NEW: Complete expert profile snapshot
        expert_profile_snapshot: expertProfileSnapshot,
        
        // QA
        gold_task: false,
        is_duplicate_annotation: false,
        qa_status: "pending",
        
        // Legal
        rights_assigned: true,
        pii_present: false,
        consent_version: "v1.0",
        
        // Metadata
        platform_version: "web_v1",
        session_id: `sess_${Date.now()}`,
      };

      const { data: feedback, error } = await supabase
        .from("rlhf_feedback")
        .insert(feedbackData as any)
        .select()
        .single();

      if (error) throw error;

      // If this should be double annotated, add to pending QA
      if (isDoubleAnnotation && feedback) {
        await supabase.from("rlhf_pending_qa").insert({
          original_feedback_id: feedback.id,
          requires_second_annotator: true,
        });
      }

      setSubmitted(true);
      toast.success("Merci pour votre feedback ! Votre contribution améliore notre IA.");
      onSubmitted();
    } catch (error: any) {
      console.error("Error submitting RLHF feedback:", error);
      toast.error("Erreur lors de l'envoi du feedback");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (checkingProfile) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
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
      <Card className="border-success/50 bg-success/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-success">
            <CheckCircle2 className="h-6 w-6" />
            <div>
              <p className="font-medium">Feedback enregistré</p>
              <p className="text-sm text-muted-foreground">Votre contribution aide à améliorer notre IA</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧠 Votre avis sur l'évaluation IA
        </CardTitle>
        <CardDescription>
          Ce feedback est essentiel pour améliorer nos tests. Il sera utilisé pour entraîner et perfectionner notre IA.
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

// Re-export the enhanced version with Gold Task injection
export { RLHFFeedbackFormWithGold } from "./RLHFFeedbackFormWithGold";