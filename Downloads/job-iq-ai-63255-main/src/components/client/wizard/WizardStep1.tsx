import type { WizardData } from "@/pages/client/NewProjectWizard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, Beaker, Scale, Banknote, Code } from "lucide-react";

const DOMAINS = [
  { key: "medical", label: "Médecine", desc: "Réponses médicales, diagnostics, pharmacologie", icon: Beaker, color: "text-blue-400" },
  { key: "legal", label: "Droit", desc: "Raisonnement juridique, conformité, analyse légale", icon: Scale, color: "text-amber-400" },
  { key: "finance", label: "Finance", desc: "Analyse financière, risques, marchés, réglementation", icon: Banknote, color: "text-emerald-400" },
  { key: "code", label: "Code", desc: "Code review, debugging, architecture, sécurité", icon: Code, color: "text-primary" },
];

const LANGUAGES = [
  { key: "fr", label: "Français" },
  { key: "en", label: "Anglais" },
  { key: "both", label: "Français + Anglais" },
];

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
}

export function WizardStep1({ data, update }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Décrivez votre projet</h2>
        <p className="text-sm text-muted-foreground">Ces informations nous aident à organiser votre travail.</p>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium">Nom du projet *</Label>
          <Input
            value={data.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Ex : Évaluation Modèle Médical v3"
            maxLength={100}
            className="mt-1.5 h-11"
          />
          {data.name.length > 0 && data.name.trim().length < 3 && (
            <p className="text-xs text-destructive mt-1">3 caractères minimum</p>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium">Description</Label>
          <Textarea
            value={data.description}
            onChange={(e) => update({ description: e.target.value.slice(0, 500) })}
            placeholder="Décrivez brièvement l'objectif de ce projet d'annotation..."
            rows={3}
            className="mt-1.5 resize-none"
          />
          <p className="text-[11px] text-muted-foreground text-right mt-1">{data.description.length}/500</p>
        </div>
      </div>

      {/* Domain cards */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Domaine d'expertise *</Label>
        <div className="grid grid-cols-2 gap-3">
          {DOMAINS.map((d) => {
            const selected = data.domain === d.key;
            return (
              <button
                key={d.key}
                onClick={() => update({ domain: d.key })}
                className={cn(
                  "relative text-left p-4 rounded-xl border transition-all duration-150",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 bg-card"
                )}
              >
                {selected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <d.icon className={cn("w-5 h-5 mb-2", d.color)} />
                <p className="text-sm font-semibold text-foreground">{d.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{d.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Language chips */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Langue *</Label>
        <div className="flex gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.key}
              onClick={() => update({ language: l.key })}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-150",
                data.language === l.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
