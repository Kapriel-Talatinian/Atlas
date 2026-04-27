import type { WizardData } from "@/pages/client/NewProjectWizard";
import { cn } from "@/lib/utils";
import { Check, Shield, Globe } from "lucide-react";


const PLANS = [
  {
    key: "standard",
    label: "Standard",
    fixedPrice: 29,
    features: [
      "α ≥ 0.75 garanti",
      "2 annotateurs par tâche",
      "Livraison estimée : 5 jours",
      "Support email",
      "Tous formats d'export",
      "Rapport de performance basique",
    ],
  },
  {
    key: "priority",
    label: "Prioritaire",
    fixedPrice: 40,
    recommended: true,
    features: [
      "α ≥ 0.80 garanti",
      "2 annotateurs par tâche",
      "Livraison estimée : 3 jours",
      "Support email prioritaire",
      "Tous formats d'export",
      "Rapport de performance complet",
    ],
  },
  {
    key: "express",
    label: "Express",
    fixedPrice: 63,
    features: [
      "α ≥ 0.85 garanti",
      "3 annotateurs par tâche",
      "Livraison estimée : 1-2 jours",
      "Support dédié + call de debriefing",
      "Tous formats d'export",
      "Rapport de performance complet + call",
      "SLA contractuel avec pénalités",
    ],
  },
];

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
}

export function WizardStep5({ data, update }: Props) {

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Choisissez votre niveau de service</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez le niveau de qualité et de rapidité souhaité.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const selected = data.sla === plan.key;

          return (
            <button
              key={plan.key}
              onClick={() => update({ sla: plan.key })}
              className={cn(
                "relative text-left p-5 rounded-xl border transition-all duration-150 flex flex-col",
                selected
                  ? "border-primary bg-primary/5"
                  : plan.recommended
                  ? "border-primary/30 hover:border-primary/50 bg-card"
                  : "border-border hover:border-primary/30 bg-card"
              )}
            >
              {selected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              {plan.recommended && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary self-start mb-3">
                  Recommandé
                </span>
              )}
              <h3 className="text-base font-bold text-foreground">{plan.label}</h3>
              <p className="text-sm font-mono text-primary mt-1">
                À partir de {plan.fixedPrice} USD <span className="text-xs text-muted-foreground font-sans">/ tâche</span>
              </p>
              <div className="mt-4 space-y-2 flex-1">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-muted-foreground leading-relaxed">{f}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* LLM Mode - Sovereign Option */}
      <div className="mt-8">
        <h3 className="text-base font-bold text-foreground mb-1">Hébergement IA</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Dans les deux modes, les données sont anonymisées par le scan PII avant tout appel IA.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => update({ llmMode: "standard" })}
            className={cn(
              "relative text-left p-5 rounded-xl border transition-all duration-150",
              data.llmMode === "standard"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30 bg-card"
            )}
          >
            {data.llmMode === "standard" && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <Globe className="w-5 h-5 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">Standard</p>
            <p className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary inline-block mt-1 mb-2">Recommandé</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Gemini + GPT via infrastructure sécurisée. Contrats de non-rétention avec chaque fournisseur.
            </p>
          </button>

          <button
            onClick={() => update({ llmMode: "sovereign" })}
            className={cn(
              "relative text-left p-5 rounded-xl border transition-all duration-150",
              data.llmMode === "sovereign"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30 bg-card"
            )}
          >
            {data.llmMode === "sovereign" && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <Shield className="w-5 h-5 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">Souverain — UE uniquement</p>
            <p className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 inline-block mt-1 mb-2">+20%</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mistral AI hébergé en France. Aucune donnée ne quitte l'Union Européenne.
            </p>
          </button>
        </div>
      </div>

      <p className="text-[13px] text-muted-foreground text-center mt-6">
        Remises volume disponibles dès 500 tâches. Le prix varie selon le domaine et le type de tâche.
      </p>
    </div>
  );
}
