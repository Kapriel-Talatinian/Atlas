import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, ChevronRight, ChevronLeft, Loader2, X, User, Scale, FileCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ContributorAgreement } from "@/components/expert/ContributorAgreement";
import { KYCVerification } from "@/components/expert/KYCVerification";

type Step = 1 | 2 | 3;

interface ExpertSnapshot {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  country: string;
  city: string;
  title: string;
  bio: string | null;
  years_of_experience: number;
  primary_skills: string[];
  kyc_status: "pending" | "submitted" | "verified" | "rejected";
  kyc_documents?: any[];
}

interface AnnotatorSnapshot {
  id: string;
  expert_id: string;
}

const STEP_META: Record<Step, { label: string; icon: typeof User; description: string }> = {
  1: { label: "Profil", icon: User, description: "Vos informations professionnelles." },
  2: { label: "Accord contributeur", icon: Scale, description: "Cadre RLHF et droits sur vos annotations." },
  3: { label: "Vérification KYC", icon: FileCheck, description: "Trois documents pour valider votre identité." },
};

const SENIORITY_OPTIONS = [
  { value: "junior", label: "Junior (0-2 ans)" },
  { value: "mid", label: "Mid (3-5 ans)" },
  { value: "senior", label: "Senior (6-10 ans)" },
  { value: "lead", label: "Lead (11-15 ans)" },
  { value: "principal", label: "Principal (15+ ans)" },
];

const COMMON_LANGUAGES = ["fr", "en", "es", "de", "it", "ar", "zh", "pt"];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expert, setExpert] = useState<ExpertSnapshot | null>(null);
  const [annotator, setAnnotator] = useState<AnnotatorSnapshot | null>(null);
  const [agreementSigned, setAgreementSigned] = useState(false);

  // Step 1 form state
  const [form, setForm] = useState({
    full_name: "",
    country: "FR",
    city: "",
    title: "",
    years_of_experience: 0,
    seniority: "mid",
    languages: ["fr"],
    primary_skills: [] as string[],
    bio: "",
  });
  const [skillInput, setSkillInput] = useState("");

  // ─── Initial load ───────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      const { data: ep } = await supabase
        .from("expert_profiles")
        .select("id, user_id, full_name, email, country, city, title, bio, years_of_experience, primary_skills, kyc_status, kyc_documents, onboarding_completed_at")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!ep) {
        // Trigger should have created this; if not, surface the error.
        toast.error("Profil expert introuvable. Reconnectez-vous.");
        navigate("/auth");
        return;
      }

      // If already onboarded, skip ahead.
      if ((ep as any).onboarding_completed_at) {
        navigate("/expert/home", { replace: true });
        return;
      }

      setExpert(ep as any);
      setForm((f) => ({
        ...f,
        full_name: ep.full_name || "",
        country: ep.country || "FR",
        city: ep.city || "",
        title: ep.title === "Expert" ? "" : (ep.title || ""),
        years_of_experience: ep.years_of_experience || 0,
        primary_skills: ep.primary_skills || [],
        bio: ep.bio || "",
      }));

      // Check if annotator_profiles already exists (resume case)
      const { data: ap } = await supabase
        .from("annotator_profiles")
        .select("id, expert_id")
        .eq("expert_id", ep.id)
        .maybeSingle();
      if (ap) setAnnotator(ap as any);

      // Check if agreement already signed (resume case)
      let hasAgreement = false;
      if (ap?.id) {
        const { data: existingAgreement } = await supabase
          .from("rlhf_contributor_agreements")
          .select("id")
          .eq("annotator_id", ap.id)
          .eq("is_active", true)
          .maybeSingle();
        if (existingAgreement) {
          hasAgreement = true;
          setAgreementSigned(true);
        }
      }

      // Resume at the furthest step the user has reached
      if (ap && hasAgreement) {
        setStep(3);
      } else if (ap) {
        setStep(2);
      }

      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Step 1: Profile submit ─────────────────────────────
  const validateStep1 = (): string | null => {
    if (!form.full_name.trim()) return "Renseignez votre nom complet.";
    if (!form.country.trim()) return "Sélectionnez votre pays.";
    if (!form.city.trim()) return "Renseignez votre ville.";
    if (!form.title.trim()) return "Renseignez votre titre professionnel.";
    if (form.years_of_experience < 0 || form.years_of_experience > 60) return "Années d'expérience invalides.";
    if (form.primary_skills.length < 3) return "Listez au moins 3 compétences principales.";
    if (form.languages.length < 1) return "Sélectionnez au moins une langue.";
    return null;
  };

  const handleSubmitStep1 = async () => {
    const err = validateStep1();
    if (err) { toast.error(err); return; }
    if (!expert) return;

    setSaving(true);
    try {
      // 1. Upsert expert_profiles with the real data
      const { error: epErr } = await supabase
        .from("expert_profiles")
        .update({
          full_name: form.full_name.trim(),
          country: form.country,
          city: form.city.trim(),
          title: form.title.trim(),
          bio: form.bio.trim() || null,
          years_of_experience: form.years_of_experience,
          primary_skills: form.primary_skills,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expert.id);
      if (epErr) throw epErr;

      // 2. Upsert annotator_profiles (one row per expert).
      //    is_qualified stays false until first certification passes.
      const anonId = `ANN-${expert.id.slice(0, 8)}`;
      const { data: ap, error: apErr } = await supabase
        .from("annotator_profiles")
        .upsert(
          {
            expert_id: expert.id,
            anonymized_id: anonId,
            role: form.title.trim(),
            seniority: form.seniority,
            experience_years: form.years_of_experience,
            country: form.country,
            languages: form.languages,
            consent_given_at: new Date().toISOString(),
            consent_version: "v1.0",
          } as any,
          { onConflict: "expert_id" }
        )
        .select("id, expert_id")
        .single();
      if (apErr) throw apErr;

      setExpert((e) => e ? { ...e, full_name: form.full_name, city: form.city, title: form.title } : e);
      setAnnotator(ap as any);
      setStep(2);
    } catch (err: any) {
      console.error("Onboarding step 1 error:", err);
      toast.error("Erreur lors de l'enregistrement : " + (err?.message || "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  // ─── Step 2: Agreement signed ───────────────────────────
  const handleAgreementSigned = () => {
    setAgreementSigned(true);
    setStep(3);
    toast.success("Accord signé. Dernière étape : KYC.");
  };

  // ─── Step 3: KYC done → finalise onboarding ─────────────
  const refreshExpert = async () => {
    if (!expert?.id) return;
    const { data } = await supabase
      .from("expert_profiles")
      .select("id, user_id, full_name, email, country, city, title, bio, years_of_experience, primary_skills, kyc_status, kyc_documents")
      .eq("id", expert.id)
      .maybeSingle();
    if (data) setExpert(data as any);
  };

  const canFinish = expert && (expert.kyc_status === "submitted" || expert.kyc_status === "verified");

  const handleFinish = async () => {
    if (!expert?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("expert_profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", expert.id);
      if (error) throw error;
      toast.success("Onboarding terminé. Place à la certification.");
      navigate("/expert/certification", { replace: true });
    } catch (err: any) {
      console.error("Onboarding finalise error:", err);
      toast.error("Erreur : " + (err?.message || "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  // ─── Step nav guards ────────────────────────────────────
  const canGoStep2 = !!annotator;
  const canGoStep3 = canGoStep2 && agreementSigned;

  // ─── Helpers ────────────────────────────────────────────
  const addSkill = () => {
    const v = skillInput.trim();
    if (!v) return;
    if (form.primary_skills.includes(v)) { setSkillInput(""); return; }
    setForm((f) => ({ ...f, primary_skills: [...f.primary_skills, v] }));
    setSkillInput("");
  };
  const removeSkill = (s: string) => {
    setForm((f) => ({ ...f, primary_skills: f.primary_skills.filter((x) => x !== s) }));
  };
  const toggleLanguage = (lang: string) => {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(lang)
        ? f.languages.filter((l) => l !== lang)
        : [...f.languages, lang],
    }));
  };

  // ─── Render ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Bienvenue chez STEF</h1>
          <p className="text-muted-foreground">
            Trois étapes pour activer votre compte expert. Vous pouvez ensuite passer la certification dans votre domaine et recevoir des tâches.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <Progress value={progressPct} className="h-2 mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => {
              const meta = STEP_META[n as Step];
              const Icon = meta.icon;
              const isActive = step === n;
              const isDone = step > n;
              return (
                <div
                  key={n}
                  className={`p-3 rounded-lg border transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : isDone
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                    <span className="text-[11px] font-mono text-muted-foreground">Étape {n}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1 — Profile */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Votre profil professionnel</CardTitle>
              <CardDescription>{STEP_META[1].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="full_name">Nom complet *</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Marie Dupont"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Pays *</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="FR"
                    maxLength={2}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Code ISO 2 lettres</p>
                </div>
                <div>
                  <Label htmlFor="city">Ville *</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="title">Titre professionnel *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Médecin généraliste / Avocat fiscaliste / Senior Backend Developer"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="years">Années d'expérience *</Label>
                  <Input
                    id="years"
                    type="number"
                    min={0}
                    max={60}
                    value={form.years_of_experience}
                    onChange={(e) => setForm({ ...form, years_of_experience: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="seniority">Niveau de séniorité *</Label>
                  <Select
                    value={form.seniority}
                    onValueChange={(v) => setForm({ ...form, seniority: v })}
                  >
                    <SelectTrigger id="seniority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SENIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Compétences principales (3 minimum) *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    placeholder="Ex: Cardiologie, Droit fiscal, Python"
                  />
                  <Button type="button" variant="outline" onClick={addSkill}>Ajouter</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.primary_skills.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <button type="button" onClick={() => removeSkill(s)} aria-label={`Retirer ${s}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Langues maîtrisées *</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {COMMON_LANGUAGES.map((lang) => {
                    const active = form.languages.includes(lang);
                    return (
                      <button
                        type="button"
                        key={lang}
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase border transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-muted-foreground/40"
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio (optionnel)</Label>
                <Textarea
                  id="bio"
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Décrivez votre expertise, vos publications, vos projets…"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSubmitStep1} disabled={saving} size="lg">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Suivant
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Contributor Agreement */}
        {step === 2 && annotator && expert && (
          <div className="space-y-4">
            <ContributorAgreement
              annotatorId={annotator.id}
              expertId={expert.id}
              onSigned={handleAgreementSigned}
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Retour
              </Button>
              {agreementSigned && (
                <Button onClick={() => setStep(3)}>
                  Continuer
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — KYC */}
        {step === 3 && expert && (
          <div className="space-y-6">
            <KYCVerification
              profile={{
                id: expert.id,
                user_id: expert.user_id,
                kyc_status: expert.kyc_status,
                kyc_documents: expert.kyc_documents,
              } as any}
              onUpdate={refreshExpert}
            />

            <Card className={canFinish ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
              <CardContent className="p-5">
                {canFinish ? (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-foreground">Documents reçus.</p>
                      <p className="text-sm text-muted-foreground">
                        La vérification finale par notre équipe prend 24-48h. Vous pouvez déjà passer votre première certification.
                      </p>
                    </div>
                    <Button onClick={handleFinish} disabled={saving} size="lg">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Terminer l'onboarding
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Téléchargez les 3 documents puis cliquez sur <span className="font-medium text-foreground">Soumettre pour vérification</span> ci-dessus pour activer ce dernier bouton.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={saving}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Retour
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
