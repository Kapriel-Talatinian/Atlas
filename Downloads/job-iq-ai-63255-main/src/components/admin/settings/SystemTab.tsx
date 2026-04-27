import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import { TASK_TYPES, TASK_TYPE_LABELS } from "./settingsConstants";
import { cn } from "@/lib/utils";

interface SystemTabProps {
  onDirtyChange: (dirty: boolean) => void;
}

const DEFAULT_MIN_TIMES: Record<string, number> = {
  scoring: 120, preference_dpo: 60, comparison_ab: 180, fact_checking: 120,
  red_teaming: 300, text_generation: 180, span_annotation: 90, extraction: 90, conversation_rating: 180,
};

export function SystemTab({ onDirtyChange }: SystemTabProps) {
  const [trustThreshold, setTrustThreshold] = useState(40);
  const [minTimes, setMinTimes] = useState<Record<string, number>>({ ...DEFAULT_MIN_TIMES });
  const [dailyLimit, setDailyLimit] = useState(50);
  const [timeoutHours, setTimeoutHours] = useState(2);
  const [weights, setWeights] = useState({ alpha: 40, availability: 30, seniority: 10, diversity: 20 });
  const [cooldownDays, setCooldownDays] = useState(14);
  const [validityMonths, setValidityMonths] = useState(12);
  const [phase3Alpha, setPhase3Alpha] = useState(0.75);
  const [optimizeEvery, setOptimizeEvery] = useState(100);
  const [contactEmail, setContactEmail] = useState("contact@steftalent.fr");
  const [noreplyEmail, setNoreplyEmail] = useState("noreply@steftalent.fr");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [bankBic, setBankBic] = useState("");
  const [bankName, setBankName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const loadSettings = async () => {
    const { data } = await supabase.from("platform_settings" as any).select("key, value");
    if (data) {
      for (const row of data as any[]) {
        const v = row.value;
        switch (row.key) {
          case "trust_score_suspension_threshold": setTrustThreshold(parseFloat(String(v))); break;
          case "min_time_per_task": setMinTimes(typeof v === "object" ? v : JSON.parse(v)); break;
          case "task_daily_limit": setDailyLimit(parseFloat(String(v))); break;
          case "assignment_timeout_hours": setTimeoutHours(parseFloat(String(v))); break;
          case "distribution_weights": setWeights(typeof v === "object" ? v : JSON.parse(v)); break;
          case "certification_cooldown_days": setCooldownDays(parseFloat(String(v))); break;
          case "certification_validity_months": setValidityMonths(parseFloat(String(v))); break;
          case "certification_phase3_alpha": setPhase3Alpha(parseFloat(String(v))); break;
          case "prompt_optimize_every_n": setOptimizeEvery(parseFloat(String(v))); break;
          case "contact_email": setContactEmail(typeof v === "string" ? v : String(v)); break;
          case "noreply_email": setNoreplyEmail(typeof v === "string" ? v : String(v)); break;
          case "maintenance_mode": setMaintenanceMode(v === true || v === "true"); break;
          case "maintenance_message": setMaintenanceMessage(typeof v === "string" ? v : ""); break;
          case "bank_account_holder": setBankHolder(typeof v === "string" ? v : String(v ?? "")); break;
          case "bank_iban": setBankIban(typeof v === "string" ? v : String(v ?? "")); break;
          case "bank_bic": setBankBic(typeof v === "string" ? v : String(v ?? "")); break;
          case "bank_name": setBankName(typeof v === "string" ? v : String(v ?? "")); break;
        }
      }
    }
    setLoading(false);
  };

  const totalWeights = weights.alpha + weights.availability + weights.seniority + weights.diversity;
  const weightsValid = totalWeights === 100;

  const updateWeight = (key: keyof typeof weights, val: number) => {
    setWeights(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    const updates: Record<string, any> = {
      trust_score_suspension_threshold: trustThreshold.toString(),
      min_time_per_task: minTimes,
      task_daily_limit: dailyLimit.toString(),
      assignment_timeout_hours: timeoutHours.toString(),
      distribution_weights: weights,
      certification_cooldown_days: cooldownDays.toString(),
      certification_validity_months: validityMonths.toString(),
      certification_phase3_alpha: phase3Alpha.toString(),
      prompt_optimize_every_n: optimizeEvery.toString(),
      contact_email: contactEmail,
      noreply_email: noreplyEmail,
      maintenance_mode: maintenanceMode,
      maintenance_message: maintenanceMessage,
      bank_account_holder: bankHolder,
      bank_iban: bankIban,
      bank_bic: bankBic,
      bank_name: bankName,
    };
    for (const [key, value] of Object.entries(updates)) {
      await (supabase.from("platform_settings" as any) as any).update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    }
    setDirty(false);
    setConfirmOpen(false);
    toast.success("Paramètres système mis à jour.");
  };

  const markDirty = () => setDirty(true);

  if (loading) return <div className="text-muted-foreground text-sm py-8">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Paramètres système</h2>
        <p className="text-sm text-muted-foreground mt-1">Configuration technique de la plateforme.</p>
      </div>

      {/* Anti-fraud */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Anti-fraude</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Seuil de suspension automatique (Trust Score)</Label>
            <p className="text-xs text-muted-foreground">Si le trust score d'un expert descend en dessous de cette valeur, son compte est automatiquement suspendu.</p>
            <Input type="number" step={5} min={10} max={80} value={trustThreshold} onChange={e => { setTrustThreshold(parseInt(e.target.value) || 0); markDirty(); }} className="max-w-[150px] font-mono" />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Temps minimum par type de tâche (secondes)</Label>
            <p className="text-xs text-muted-foreground">En dessous de ce temps, une violation de vitesse est enregistrée.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TASK_TYPES.map(tt => (
                <div key={tt} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{TASK_TYPE_LABELS[tt]}</span>
                  <div className="flex items-center gap-1">
                    <Input type="number" step={10} min={10} value={minTimes[tt] || 60}
                      onChange={e => { setMinTimes(prev => ({ ...prev, [tt]: parseInt(e.target.value) || 0 })); markDirty(); }}
                      className="w-[80px] h-7 text-right font-mono text-sm" />
                    <span className="text-xs text-muted-foreground">s</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Limite quotidienne de tâches par expert</Label>
            <Input type="number" step={5} min={10} max={200} value={dailyLimit} onChange={e => { setDailyLimit(parseInt(e.target.value) || 0); markDirty(); }} className="max-w-[150px] font-mono" />
          </div>
        </CardContent>
      </Card>

      {/* Distribution */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Distribution de tâches</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Durée avant expiration d'une assignation</Label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <Input type="number" step={0.5} min={0.5} max={24} value={timeoutHours} onChange={e => { setTimeoutHours(parseFloat(e.target.value) || 0.5); markDirty(); }} className="font-mono" />
              <span className="text-sm text-muted-foreground">heures</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Poids de l'algorithme de distribution</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.keys(weights) as Array<keyof typeof weights>).map(key => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground capitalize">{key === "alpha" ? "Alpha personnel" : key === "availability" ? "Disponibilité" : key === "seniority" ? "Ancienneté" : "Diversité"}</span>
                    <span className="text-xs font-mono font-medium">{weights[key]}</span>
                  </div>
                  <Slider value={[weights[key]]} min={0} max={100} step={5} onValueChange={v => updateWeight(key, v[0])} />
                </div>
              ))}
            </div>
            <p className={cn("text-xs font-medium", weightsValid ? "text-emerald-600" : "text-destructive")}>
              Total : {totalWeights}%{!weightsValid && " — Les poids doivent totaliser 100%."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Certification */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Certification</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Délai avant de repasser une certification après un échec</Label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <Input type="number" step={1} min={1} max={90} value={cooldownDays} onChange={e => { setCooldownDays(parseInt(e.target.value) || 1); markDirty(); }} className="font-mono" />
              <span className="text-sm text-muted-foreground">jours</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Durée de validité d'une certification</Label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <Input type="number" step={1} min={3} max={36} value={validityMonths} onChange={e => { setValidityMonths(parseInt(e.target.value) || 3); markDirty(); }} className="font-mono" />
              <span className="text-sm text-muted-foreground">mois</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Seuil Krippendorff Alpha pour la Phase 3 de certification</Label>
            <Input type="number" step={0.01} min={0.5} max={1} value={phase3Alpha} onChange={e => { setPhase3Alpha(parseFloat(e.target.value) || 0.5); markDirty(); }} className="max-w-[150px] font-mono" />
          </div>
        </CardContent>
      </Card>

      {/* Prompt optimization */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Optimisation des prompts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ré-optimiser les prompts tous les</Label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <Input type="number" step={50} min={50} max={1000} value={optimizeEvery} onChange={e => { setOptimizeEvery(parseInt(e.target.value) || 50); markDirty(); }} className="font-mono" />
              <span className="text-sm text-muted-foreground">annotations</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Actif</Badge>
            <span className="text-xs text-muted-foreground">Version courante : v1</span>
          </div>
        </CardContent>
      </Card>

      {/* Coordonnées bancaires */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Coordonnées bancaires (factures)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Ces informations apparaissent sur les factures envoyées aux clients.</p>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Titulaire du compte</Label>
            <Input value={bankHolder} onChange={e => { setBankHolder(e.target.value); markDirty(); }} placeholder="STEF SAS" className="max-w-[400px]" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">IBAN</Label>
            <Input value={bankIban} onChange={e => { setBankIban(e.target.value); markDirty(); }} placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" className="max-w-[400px] font-mono" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[400px]">
            <div className="space-y-2">
              <Label className="text-sm font-medium">BIC / SWIFT</Label>
              <Input value={bankBic} onChange={e => { setBankBic(e.target.value); markDirty(); }} placeholder="XXXXXXXXX" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Banque</Label>
              <Input value={bankName} onChange={e => { setBankName(e.target.value); markDirty(); }} placeholder="Nom de la banque" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emails */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Emails</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Adresse d'expédition</Label>
            <Input type="email" value={noreplyEmail} disabled className="max-w-[300px] opacity-60" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Adresse de contact</Label>
            <Input type="email" value={contactEmail} onChange={e => { setContactEmail(e.target.value); markDirty(); }} className="max-w-[300px]" />
          </div>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Maintenance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between max-w-[300px]">
            <Label className="text-sm font-medium">Mode maintenance</Label>
            <Switch checked={maintenanceMode} onCheckedChange={v => { setMaintenanceMode(v); markDirty(); }} />
          </div>
          <p className="text-xs text-muted-foreground">Quand activé, la plateforme affiche un message de maintenance à tous les utilisateurs. Seuls les admins peuvent accéder aux dashboards.</p>
          {maintenanceMode && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Message de maintenance</Label>
              <Textarea value={maintenanceMessage} onChange={e => { setMaintenanceMessage(e.target.value); markDirty(); }} placeholder="La plateforme est en cours de maintenance..." className="max-w-[500px]" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || !weightsValid}>
          Enregistrer les paramètres système
        </Button>
      </div>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={handleSave}
        title="Modifier les paramètres système ?"
        description="Ces modifications impactent immédiatement le comportement de la plateforme."
      />
    </div>
  );
}
