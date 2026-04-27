import { useState } from "react";
import type { WizardData } from "@/pages/client/NewProjectWizard";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_DIMENSIONS = [
  { key: "correctness", label: "Correction factuelle", desc: "La réponse est-elle correcte ?" },
  { key: "safety", label: "Sécurité", desc: "La réponse est-elle sûre et responsable ?" },
  { key: "completeness", label: "Complétude", desc: "La réponse couvre-t-elle tous les aspects ?" },
  { key: "reasoning_depth", label: "Profondeur de raisonnement", desc: "Le raisonnement est-il approfondi ?" },
  { key: "source_reliability", label: "Fiabilité des sources", desc: "Les informations sont-elles vérifiables ?" },
  { key: "communication_clarity", label: "Clarté de communication", desc: "La réponse est-elle bien formulée ?" },
];

const DOMAIN_DIMENSIONS: Record<string, { key: string; label: string; desc: string }[]> = {
  code: [
    { key: "code_quality", label: "Qualité du code", desc: "Le code est-il propre et maintenable ?" },
    { key: "error_handling", label: "Gestion des erreurs", desc: "Les cas d'erreur sont-ils gérés ?" },
    { key: "performance_awareness", label: "Performance", desc: "La solution est-elle performante ?" },
    { key: "edge_case_handling", label: "Cas limites", desc: "Les edge cases sont-ils traités ?" },
  ],
  medical: [
    { key: "clinical_accuracy", label: "Précision clinique", desc: "L'information clinique est-elle exacte ?" },
  ],
  legal: [
    { key: "regulatory_compliance", label: "Conformité réglementaire", desc: "Les règles juridiques sont-elles respectées ?" },
  ],
  finance: [
    { key: "regulatory_compliance", label: "Conformité réglementaire", desc: "Les normes financières sont-elles respectées ?" },
  ],
};

const DEFAULT_LABELS: Record<string, { name: string; color: string }[]> = {
  code: [
    { name: "correct", color: "#22C55E" }, { name: "minor_error", color: "#F59E0B" },
    { name: "major_error", color: "#EF4444" }, { name: "hallucination", color: "#7B6FF0" },
    { name: "security_flaw", color: "#EC4899" }, { name: "performance_issue", color: "#3B82F6" },
  ],
  medical: [
    { name: "accurate", color: "#22C55E" }, { name: "inaccurate", color: "#EF4444" },
    { name: "potentially_dangerous", color: "#DC2626" }, { name: "outdated", color: "#F59E0B" },
    { name: "unsupported_claim", color: "#7B6FF0" },
  ],
  legal: [
    { name: "legally_correct", color: "#22C55E" }, { name: "legally_incorrect", color: "#EF4444" },
    { name: "jurisdiction_error", color: "#F59E0B" }, { name: "missing_nuance", color: "#3B82F6" },
  ],
  finance: [
    { name: "factually_correct", color: "#22C55E" }, { name: "calculation_error", color: "#EF4444" },
    { name: "risk_understated", color: "#F59E0B" }, { name: "regulatory_gap", color: "#7B6FF0" },
  ],
};

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
}

export function WizardStep3({ data, update }: Props) {
  const [newDimName, setNewDimName] = useState("");
  const [newDimDesc, setNewDimDesc] = useState("");
  const [newLabelName, setNewLabelName] = useState("");

  const hasDimensions = ["rating", "scoring", "comparison", "conversation_rating"].includes(data.taskType);
  const hasLabels = data.taskType === "span_annotation";
  const hasExtraction = data.taskType === "extraction";
  const hasRedTeam = data.taskType === "red_teaming";
  const hasTextGen = data.taskType === "text_generation";
  const hasConversation = data.taskType === "conversation_rating";
  const isSimple = ["ranking", "validation"].includes(data.taskType);

  const domainDims = DOMAIN_DIMENSIONS[data.domain] || [];
  const allDims = [...BASE_DIMENSIONS, ...domainDims];

  const toggleDim = (key: string) => {
    update({
      dimensions: data.dimensions.includes(key)
        ? data.dimensions.filter((d) => d !== key)
        : [...data.dimensions, key],
    });
  };

  const addCustomDim = () => {
    if (!newDimName.trim()) return;
    update({ customDimensions: [...data.customDimensions, { name: newDimName.trim(), description: newDimDesc.trim() }] });
    setNewDimName("");
    setNewDimDesc("");
  };

  const addLabel = () => {
    if (!newLabelName.trim()) return;
    const colors = ["#22C55E", "#F59E0B", "#EF4444", "#7B6FF0", "#3B82F6", "#EC4899", "#14B8A6"];
    update({ labels: [...data.labels, { name: newLabelName.trim(), color: colors[data.labels.length % colors.length] }] });
    setNewLabelName("");
  };

  const addExtractionField = () => {
    update({
      extractionFields: [...data.extractionFields, { name: "", type: "string", required: false, description: "" }],
    });
  };

  const updateField = (index: number, partial: Partial<WizardData["extractionFields"][0]>) => {
    const updated = [...data.extractionFields];
    updated[index] = { ...updated[index], ...partial };
    update({ extractionFields: updated });
  };

  // Initialize labels for span annotation if empty
  if (hasLabels && data.labels.length === 0) {
    const defaults = DEFAULT_LABELS[data.domain] || DEFAULT_LABELS.code;
    update({ labels: defaults });
  }

  // ---- SIMPLE TYPES ----
  if (isSimple) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Configuration</h2>
          <p className="text-sm text-muted-foreground">
            {data.taskType === "ranking"
              ? "Le ranking DPO ne nécessite pas de configuration supplémentaire. Les experts compareront deux réponses et justifieront leur choix."
              : "La vérification factuelle ne nécessite pas de configuration supplémentaire. Les experts vérifieront chaque affirmation avec des sources."}
          </p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card text-sm text-muted-foreground leading-relaxed">
          {data.taskType === "ranking"
            ? "Pour chaque tâche, l'expert recevra un prompt et deux réponses. Il choisira la meilleure, indiquera la force de sa préférence et rédigera une justification détaillée (minimum 50 caractères)."
            : "Pour chaque tâche, l'expert recevra une affirmation à vérifier. Il rendra un verdict (vrai, partiellement vrai, faux, invérifiable), fournira des sources et rédigera une correction si nécessaire."}
        </div>
      </div>
    );
  }

  // ---- DIMENSIONS ----
  if (hasDimensions) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Configurez votre annotation</h2>
          <p className="text-sm text-muted-foreground">Choisissez les dimensions sur lesquelles vos données seront évaluées.</p>
        </div>

        {hasConversation && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
            <div>
              <p className="text-sm font-medium text-foreground">Évaluer chaque tour individuellement</p>
              <p className="text-xs text-muted-foreground mt-0.5">L'expert notera chaque réponse de l'assistant en plus de la note globale</p>
            </div>
            <Switch checked={data.evaluatePerTurn} onCheckedChange={(v) => update({ evaluatePerTurn: v })} />
          </div>
        )}

        <div className="space-y-2">
          {allDims.map((dim) => (
            <label
              key={dim.key}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                data.dimensions.includes(dim.key) ? "border-primary/30 bg-primary/5" : "border-border hover:border-border/80"
              )}
            >
              <Checkbox
                checked={data.dimensions.includes(dim.key)}
                onCheckedChange={() => toggleDim(dim.key)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{dim.label}</p>
                <p className="text-xs text-muted-foreground">{dim.desc}</p>
              </div>
            </label>
          ))}
          {data.customDimensions.map((cd, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Checkbox checked disabled className="mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{cd.name} <Badge variant="outline" className="text-[10px] ml-1">Custom</Badge></p>
                {cd.description && <p className="text-xs text-muted-foreground">{cd.description}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => update({ customDimensions: data.customDimensions.filter((_, j) => j !== i) })}>
                <X className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input value={newDimName} onChange={(e) => setNewDimName(e.target.value)} placeholder="Nom de la dimension" className="h-9 text-sm" />
          <Input value={newDimDesc} onChange={(e) => setNewDimDesc(e.target.value)} placeholder="Description (optionnel)" className="h-9 text-sm" />
          <Button size="sm" variant="outline" onClick={addCustomDim} disabled={!newDimName.trim()} className="shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">Minimum 2 dimensions sélectionnées pour continuer.</p>
      </div>
    );
  }

  // ---- SPAN ANNOTATION ----
  if (hasLabels) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Définissez vos labels</h2>
          <p className="text-sm text-muted-foreground">Les experts utiliseront ces labels pour annoter les portions de texte.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.labels.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name.replace(/_/g, " ")}
              <button onClick={() => update({ labels: data.labels.filter((_, j) => j !== i) })} className="ml-1 text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="Nom du label" className="h-9 text-sm" />
          <Button size="sm" variant="outline" onClick={addLabel} disabled={!newLabelName.trim()} className="shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Minimum 2 labels pour continuer.</p>
      </div>
    );
  }

  // ---- EXTRACTION ----
  if (hasExtraction) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Définissez le schéma d'extraction</h2>
          <p className="text-sm text-muted-foreground">Les experts extrairont ces informations depuis vos textes.</p>
        </div>
        <div className="space-y-3">
          {data.extractionFields.map((field, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-end p-3 rounded-lg border border-border">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-[11px]">Nom *</Label>
                <Input value={field.name} onChange={(e) => updateField(i, { name: e.target.value })} placeholder="Ex: medication_name" className="h-9 text-sm mt-1" />
              </div>
              <div className="w-[120px]">
                <Label className="text-[11px]">Type</Label>
                <Select value={field.type} onValueChange={(v) => updateField(i, { type: v })}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">Texte</SelectItem>
                    <SelectItem value="number">Nombre</SelectItem>
                    <SelectItem value="boolean">Booléen</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="array_string">Liste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={field.required} onCheckedChange={(v) => updateField(i, { required: v })} />
                <span className="text-[11px] text-muted-foreground">Requis</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => update({ extractionFields: data.extractionFields.filter((_, j) => j !== i) })}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addExtractionField}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un champ
        </Button>
      </div>
    );
  }

  // ---- RED TEAMING ----
  if (hasRedTeam) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Configurez le test adversarial</h2>
          <p className="text-sm text-muted-foreground">Choisissez comment les experts interagiront avec votre modèle.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: "chat", label: "Chat en direct", desc: "Nos experts interagissent avec votre modèle via API" },
            { key: "review", label: "Revue de réponses", desc: "Nos experts analysent des réponses pré-générées" },
          ].map((mode) => (
            <button
              key={mode.key}
              onClick={() => update({ redTeamMode: mode.key })}
              className={cn(
                "relative text-left p-4 rounded-xl border transition-all",
                data.redTeamMode === mode.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 bg-card"
              )}
            >
              {data.redTeamMode === mode.key && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <p className="text-sm font-semibold text-foreground">{mode.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- TEXT GENERATION ----
  if (hasTextGen) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Configurez la génération</h2>
          <p className="text-sm text-muted-foreground">Définissez les paramètres de rédaction pour vos experts.</p>
        </div>
        <div className="space-y-5">
          <div>
            <Label className="text-sm font-medium">Longueur cible</Label>
            <Select value={data.targetLength} onValueChange={(v) => update({ targetLength: v })}>
              <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Courte (50-150 mots)</SelectItem>
                <SelectItem value="medium">Moyenne (150-400 mots)</SelectItem>
                <SelectItem value="long">Longue (400-1000 mots)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Ton</Label>
            <Select value={data.targetTone} onValueChange={(v) => update({ targetTone: v })}>
              <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formel</SelectItem>
                <SelectItem value="neutral">Neutre</SelectItem>
                <SelectItem value="casual">Décontracté</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
            <div>
              <p className="text-sm font-medium text-foreground">Mode réécriture</p>
              <p className="text-xs text-muted-foreground mt-0.5">Le client fournit une réponse modèle à améliorer</p>
            </div>
            <Switch checked={data.rewriteMode} onCheckedChange={(v) => update({ rewriteMode: v })} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
