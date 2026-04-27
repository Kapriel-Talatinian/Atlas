import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserCircle, Shield } from "lucide-react";

interface AnnotatorQualificationProps {
  expertId: string;
  onComplete: (profile: any) => void;
}

const ROLES = [
  { value: "backend_developer", label: "Développeur Backend" },
  { value: "frontend_developer", label: "Développeur Frontend" },
  { value: "fullstack_developer", label: "Développeur Full Stack" },
  { value: "mobile_developer", label: "Développeur Mobile" },
  { value: "devops_engineer", label: "DevOps / SRE" },
  { value: "data_engineer", label: "Data Engineer" },
  { value: "data_scientist", label: "Data Scientist" },
  { value: "ml_engineer", label: "ML / AI Engineer" },
  { value: "qa_engineer", label: "QA Engineer" },
  { value: "security_engineer", label: "Security Engineer" },
  { value: "architect", label: "Architecte Logiciel" },
  { value: "tech_lead", label: "Tech Lead" },
  { value: "engineering_manager", label: "Engineering Manager" },
  { value: "product_manager", label: "Product Manager" },
  { value: "designer", label: "UX/UI Designer" },
  { value: "other", label: "Autre" },
];

const SENIORITY_LEVELS = [
  { value: "junior", label: "Junior (0-2 ans)", years: "0-2" },
  { value: "mid", label: "Mid-level (2-5 ans)", years: "2-5" },
  { value: "senior", label: "Senior (5-10 ans)", years: "5-10" },
  { value: "lead", label: "Lead / Principal (10+ ans)", years: "10+" },
  { value: "principal", label: "Principal / Staff (15+ ans)", years: "15+" },
];

const REGIONS = [
  { value: "africa", label: "Afrique" },
  { value: "europe", label: "Europe" },
  { value: "north_america", label: "Amérique du Nord" },
  { value: "south_america", label: "Amérique du Sud" },
  { value: "asia", label: "Asie" },
  { value: "oceania", label: "Océanie" },
  { value: "middle_east", label: "Moyen-Orient" },
];

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
  { value: "de", label: "Allemand" },
  { value: "pt", label: "Portugais" },
  { value: "ar", label: "Arabe" },
  { value: "zh", label: "Chinois" },
  { value: "other", label: "Autre" },
];

export function AnnotatorQualification({ expertId, onComplete }: AnnotatorQualificationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingExpertData, setLoadingExpertData] = useState(true);
  const [expertData, setExpertData] = useState<any>(null);
  const [consent, setConsent] = useState(false);

  // Pre-fill from expert profile
  useEffect(() => {
    loadExpertData();
  }, [expertId]);

  // Auto-detect role from expert title
  function inferRoleFromTitle(title: string): string {
    const titleLower = (title || "").toLowerCase();
    if (titleLower.includes("backend")) return "backend_developer";
    if (titleLower.includes("frontend")) return "frontend_developer";
    if (titleLower.includes("full") && titleLower.includes("stack")) return "fullstack_developer";
    if (titleLower.includes("mobile") || titleLower.includes("ios") || titleLower.includes("android")) return "mobile_developer";
    if (titleLower.includes("devops") || titleLower.includes("sre")) return "devops_engineer";
    if (titleLower.includes("data engineer")) return "data_engineer";
    if (titleLower.includes("data scientist") || titleLower.includes("data science")) return "data_scientist";
    if (titleLower.includes("ml") || titleLower.includes("machine learning") || titleLower.includes("ai")) return "ml_engineer";
    if (titleLower.includes("qa") || titleLower.includes("test")) return "qa_engineer";
    if (titleLower.includes("security") || titleLower.includes("cyber")) return "security_engineer";
    if (titleLower.includes("architect")) return "architect";
    if (titleLower.includes("lead")) return "tech_lead";
    if (titleLower.includes("manager")) return "engineering_manager";
    if (titleLower.includes("product")) return "product_manager";
    if (titleLower.includes("design") || titleLower.includes("ux") || titleLower.includes("ui")) return "designer";
    if (titleLower.includes("python") || titleLower.includes("developer") || titleLower.includes("engineer")) return "backend_developer";
    return "fullstack_developer";
  }

  // Infer seniority from experience
  function inferSeniority(years: number): string {
    if (years < 2) return "junior";
    if (years < 5) return "mid";
    if (years < 10) return "senior";
    if (years < 15) return "lead";
    return "principal";
  }

  // Infer region from country
  function inferRegion(country: string): string {
    const countryLower = (country || "").toLowerCase();
    if (["france", "germany", "uk", "spain", "italy", "belgium", "switzerland", "netherlands", "portugal"].some(c => countryLower.includes(c))) {
      return "europe";
    }
    if (["cameroon", "cameroun", "nigeria", "senegal", "morocco", "maroc", "tunisia", "tunisie", "algeria", "algérie", "egypt", "south africa", "kenya", "côte d'ivoire", "mali", "ghana"].some(c => countryLower.includes(c))) {
      return "africa";
    }
    if (["usa", "united states", "canada", "états-unis"].some(c => countryLower.includes(c))) {
      return "north_america";
    }
    if (["brazil", "brésil", "argentina", "mexico", "colombie", "chile"].some(c => countryLower.includes(c))) {
      return "south_america";
    }
    if (["china", "chine", "japan", "japon", "india", "inde", "vietnam", "thailand", "indonesia"].some(c => countryLower.includes(c))) {
      return "asia";
    }
    return "africa";
  }

  async function loadExpertData() {
    try {
      const { data: expert, error } = await supabase
        .from("expert_profiles")
        .select("*")
        .eq("id", expertId)
        .single();

      if (error) throw error;
      setExpertData(expert);
    } catch (error) {
      console.error("Error loading expert data:", error);
    } finally {
      setLoadingExpertData(false);
    }
  }

  async function handleQuickSubmit() {
    if (!consent) {
      toast.error("Veuillez accepter le consentement RLHF");
      return;
    }

    if (!expertData) {
      toast.error("Données expert non chargées");
      return;
    }

    setIsSubmitting(true);
    try {
      const role = inferRoleFromTitle(expertData.title);
      const seniority = inferSeniority(expertData.years_of_experience || 0);
      const region = inferRegion(expertData.country);
      const languages = expertData.languages?.length > 0 ? expertData.languages : ["fr"];

      const profileData = {
        expert_id: expertId,
        role,
        seniority,
        experience_years: expertData.years_of_experience || 0,
        region,
        country: expertData.country || "Cameroun",
        languages,
        consent_given_at: new Date().toISOString(),
        consent_version: "v1.0",
      };

      const { data, error } = await supabase
        .from("annotator_profiles")
        .insert(profileData as any)
        .select()
        .single();

      if (error) throw error;

      toast.success("Profil annotateur créé !");
      onComplete(data);
    } catch (error: any) {
      console.error("Error creating annotator profile:", error);
      toast.error("Erreur lors de la création du profil");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadingExpertData) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const detectedRole = expertData ? inferRoleFromTitle(expertData.title) : "";
  const detectedSeniority = expertData ? inferSeniority(expertData.years_of_experience || 0) : "";
  const detectedRegion = expertData ? inferRegion(expertData.country) : "";
  const roleLabel = ROLES.find(r => r.value === detectedRole)?.label || detectedRole;
  const seniorityLabel = SENIORITY_LEVELS.find(s => s.value === detectedSeniority)?.label || detectedSeniority;
  const regionLabel = REGIONS.find(r => r.value === detectedRegion)?.label || detectedRegion;

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader className="text-center pb-4">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
          <UserCircle className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-lg">Confirmation rapide</CardTitle>
        <CardDescription className="text-sm">
          Vos informations sont pré-remplies. Confirmez pour continuer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-detected info summary */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Rôle :</span>
              <p className="font-medium">{roleLabel}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Niveau :</span>
              <p className="font-medium">{seniorityLabel}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Pays :</span>
              <p className="font-medium">{expertData?.country || "Non spécifié"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Région :</span>
              <p className="font-medium">{regionLabel}</p>
            </div>
          </div>
        </div>

        {/* Quick Consent */}
        <div className="p-3 bg-primary/5 rounded-lg">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked as boolean)}
              className="mt-0.5"
            />
            <label
              htmlFor="consent"
              className="text-sm cursor-pointer leading-relaxed"
            >
              <Shield className="inline h-4 w-4 text-primary mr-1" />
              J'accepte que mes feedbacks anonymisés soient utilisés pour l'entraînement IA
            </label>
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleQuickSubmit}
          disabled={isSubmitting || !consent}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Création...
            </>
          ) : (
            "Confirmer et continuer"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}