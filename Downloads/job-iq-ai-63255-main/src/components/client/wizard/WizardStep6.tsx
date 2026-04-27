import { useEffect, useState } from "react";
import type { WizardData } from "@/pages/client/NewProjectWizard";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DOMAIN_LABELS: Record<string, string> = { medical: "Médecine", legal: "Droit", finance: "Finance", code: "Code" };
const LANG_LABELS: Record<string, string> = { fr: "Français", en: "Anglais", both: "Français + Anglais" };
const TYPE_LABELS: Record<string, string> = {
  ranking: "Ranking / DPO", rating: "Scoring multi-dimensionnel", comparison: "Comparaison A/B",
  red_teaming: "Red-teaming", validation: "Vérification factuelle", text_generation: "Génération de texte",
  span_annotation: "Annotation de spans", extraction: "Extraction", conversation_rating: "Notation de conversation",
};
const SLA_LABELS: Record<string, string> = { standard: "Standard", priority: "Prioritaire", express: "Express" };
const SLA_ALPHA: Record<string, string> = { standard: "0.75", priority: "0.80", express: "0.85" };
const SLA_MULT: Record<string, number> = { standard: 1.0, priority: 1.4, express: 2.2 };
const SLA_ANNOTATORS: Record<string, number> = { standard: 2, priority: 2, express: 3 };
const SOVEREIGN_MULT = 1.20;

/** Map wizard keys → DB task_type */
const TASK_TYPE_MAP: Record<string, string> = {
  ranking: "preference_dpo",
  rating: "scoring",
  comparison: "comparison_ab",
  red_teaming: "red_teaming",
  validation: "fact_checking",
  text_generation: "text_generation",
  span_annotation: "span_annotation",
  extraction: "extraction",
  conversation_rating: "conversation_rating",
};

const LANG_MAP: Record<string, string> = { fr: "fr", en: "en", both: "fr_en" };

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
  goToStep: (step: number) => void;
}

function Section({ title, step, goToStep, children }: { title: string; step: number; goToStep: (s: number) => void; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <button onClick={() => goToStep(step)} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
          <Pencil className="w-3 h-3" /> Modifier
        </button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

export function WizardStep6({ data, update, goToStep }: Props) {
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [volumeDiscount, setVolumeDiscount] = useState(0);

  const taskCount = data.uploadedFile?.validTasks || 0;
  const slaMult = SLA_MULT[data.sla] || 1.0;
  const sovereignMult = data.llmMode === "sovereign" ? SOVEREIGN_MULT : 1.0;
  const annotators = SLA_ANNOTATORS[data.sla] || 2;

  const computedTotal = basePrice !== null
    ? Math.round(Math.round(basePrice * slaMult * sovereignMult * 100) / 100 * (1 - volumeDiscount / 100) * taskCount * 100) / 100
    : 0;

  // Sync computedTotal to parent immediately when pricing changes
  useEffect(() => {
    if (basePrice !== null && computedTotal > 0 && data.computedTotal !== computedTotal) {
      update({ computedTotal });
    }
  }, [computedTotal, basePrice, data.computedTotal, update]);

  // Reset computedTotal when key pricing inputs change (domain, taskType, language, SLA, file)
  useEffect(() => {
    update({ computedTotal: undefined });
  }, [data.domain, data.taskType, data.language, data.sla, data.llmMode, taskCount]);

  useEffect(() => {
    async function fetchPricing() {
      setLoading(true);
      const dbTaskType = TASK_TYPE_MAP[data.taskType] || "scoring";
      const dbLang = LANG_MAP[data.language] || "fr";

      // Fetch base unit price
      const { data: pricing } = await supabase
        .from("task_pricing")
        .select("client_unit_price")
        .eq("domain", data.domain || "code")
        .eq("task_type", dbTaskType)
        .eq("language", dbLang)
        .eq("active", true)
        .limit(1)
        .single();

      setBasePrice(pricing?.client_unit_price ?? 20);

      // Fetch volume discount
      const { data: discount } = await supabase
        .from("volume_discounts")
        .select("discount_percent")
        .lte("min_tasks", taskCount)
        .eq("active", true)
        .order("min_tasks", { ascending: false })
        .limit(1)
        .single();

      setVolumeDiscount(discount?.discount_percent ?? 0);
      setLoading(false);
    }
    fetchPricing();
  }, [data.domain, data.taskType, data.language, taskCount]);

  if (loading || basePrice === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unitPriceWithSla = Math.round(basePrice * slaMult * sovereignMult * 100) / 100;
  const discountedUnit = Math.round(unitPriceWithSla * (1 - volumeDiscount / 100) * 100) / 100;
  const total = Math.round(discountedUnit * taskCount * 100) / 100;

  // Payment terms
  const isLargeProject = total >= 5000;
  const deposit = Math.round((isLargeProject ? total * 0.40 : total * 0.50) * 100) / 100;
  const intermediate = isLargeProject ? Math.round(total * 0.30 * 100) / 100 : 0;
  const finalPayment = isLargeProject ? Math.round(total * 0.30 * 100) / 100 : Math.round(total * 0.50 * 100) / 100;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Récapitulatif de votre projet</h2>
        <p className="text-sm text-muted-foreground">Vérifiez les détails avant de lancer.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <Section title="Projet" step={1} goToStep={goToStep}>
          <Row label="Nom" value={data.name} />
          <Row label="Description" value={data.description || "—"} />
          <Row label="Domaine" value={DOMAIN_LABELS[data.domain] || data.domain} />
          <Row label="Langue" value={LANG_LABELS[data.language] || data.language} />
        </Section>

        <Section title="Annotation" step={2} goToStep={goToStep}>
          <Row label="Type" value={TYPE_LABELS[data.taskType] || data.taskType} />
          {(data.dimensions.length > 0 || data.customDimensions.length > 0) && (
            <Row label="Dimensions" value={[...data.dimensions, ...data.customDimensions.map((d) => d.name)].join(", ")} />
          )}
          {data.labels.length > 0 && (
            <Row label="Labels" value={data.labels.map((l) => l.name).join(", ")} />
          )}
          {data.taskType === "red_teaming" && (
            <Row label="Mode" value={data.redTeamMode === "chat" ? "Chat en direct" : "Revue de réponses"} />
          )}
        </Section>

        <Section title="Données" step={4} goToStep={goToStep}>
          <Row label="Tâches valides" value={String(taskCount)} />
          {data.uploadedFile && <Row label="Fichier" value={data.uploadedFile.name} />}
        </Section>

        <Section title="Service" step={5} goToStep={goToStep}>
          <Row label="Niveau" value={SLA_LABELS[data.sla] || data.sla} />
          <Row label="Annotateurs par tâche" value={String(annotators)} />
          <Row label="Qualité garantie" value={`α ≥ ${SLA_ALPHA[data.sla]}`} />
          <Row label="Hébergement IA" value={data.llmMode === "sovereign" ? "Souverain UE (Mistral)" : "Standard (Gemini + GPT)"} />
        </Section>

        <div className="pt-4 mt-2 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Prix unitaire base</span>
            <span className="text-sm font-mono text-foreground">{basePrice.toFixed(2)} USD</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Multiplicateur SLA ({SLA_LABELS[data.sla]})</span>
            <span className="text-sm font-mono text-foreground">×{slaMult}</span>
          </div>
          {data.llmMode === "sovereign" && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Option souveraine UE</span>
              <span className="text-sm font-mono text-foreground">×{SOVEREIGN_MULT}</span>
            </div>
          )}
          {volumeDiscount > 0 && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Remise volume ({taskCount} tâches)</span>
              <span className="text-sm font-mono text-[hsl(var(--chart-2))]">-{volumeDiscount}%</span>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Prix unitaire final</span>
            <span className="text-sm font-mono text-foreground">{discountedUnit.toFixed(2)} USD</span>
          </div>
          <div className="flex items-baseline justify-between pt-2 border-t border-border/50">
            <span className="text-sm font-semibold text-foreground">Total estimé ({taskCount} tâches)</span>
            <span className="text-xl font-bold font-mono text-primary">{total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
          </div>
        </div>
      </div>

      {/* Payment terms */}
      {total > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Conditions de paiement</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-2.5 text-muted-foreground">Acompte à la confirmation</td>
                <td className="py-2.5 text-center font-semibold text-foreground">{isLargeProject ? "40" : "50"}%</td>
                <td className="py-2.5 text-right font-mono font-medium text-foreground">{deposit.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</td>
              </tr>
              {isLargeProject && (
                <tr className="border-b border-border/50">
                  <td className="py-2.5 text-muted-foreground">Paiement intermédiaire (à 50%)</td>
                  <td className="py-2.5 text-center font-semibold text-foreground">30%</td>
                  <td className="py-2.5 text-right font-mono font-medium text-foreground">{intermediate.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</td>
                </tr>
              )}
              <tr className="border-b border-border/50">
                <td className="py-2.5 text-muted-foreground">Solde à la livraison</td>
                <td className="py-2.5 text-center font-semibold text-foreground">{isLargeProject ? "30" : "50"}%</td>
                <td className="py-2.5 text-right font-mono font-medium text-foreground">{finalPayment.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-foreground">Total</td>
                <td className="py-3 text-center font-semibold text-foreground">100%</td>
                <td className="py-3 text-right font-mono font-bold text-primary">{total.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            L'annotation démarre après réception de l'acompte.
            {isLargeProject && " Le paiement intermédiaire est déclenché automatiquement quand 50% des tâches sont complétées."}
          </p>
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={data.agreedTerms}
          onCheckedChange={(v) => update({ agreedTerms: !!v })}
          className="mt-0.5"
        />
        <span className="text-sm text-muted-foreground leading-relaxed">
          J'ai lu et j'accepte les{" "}
          <a href="/legal/cgv-clients" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Conditions Générales de Vente
          </a>
        </span>
      </label>
    </div>
  );
}
