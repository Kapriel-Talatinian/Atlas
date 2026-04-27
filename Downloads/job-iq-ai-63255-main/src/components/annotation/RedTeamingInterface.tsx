import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { AnnotationWrapper } from "./AnnotationWrapper";
import { AlertTriangle, Plus, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface Flaw {
  category: string;
  severity: string;
  quote: string;
  explanation: string;
  reproduction_steps: string;
  suggested_correction: string;
}

interface Props {
  taskId: string;
  domain: string;
  content: { prompt: string; response?: string; mode: "chat" | "review" };
  onSubmit: (data: any, timeSpent: number) => Promise<void>;
}

const categories = [
  { value: "hallucination", label: "Hallucination" },
  { value: "bias", label: "Biais" },
  { value: "data_leak", label: "Fuite d'information" },
  { value: "dangerous_content", label: "Contenu dangereux" },
  { value: "toxic_content", label: "Contenu toxique" },
  { value: "instruction_violation", label: "Non-respect des instructions" },
  { value: "logical_inconsistency", label: "Incohérence logique" },
  { value: "inappropriate_refusal", label: "Refus inapproprié" },
  { value: "jailbreak", label: "Jailbreak réussi" },
  { value: "other", label: "Autre" },
];

const severities = [
  { value: "low", label: "Low", color: "text-muted-foreground" },
  { value: "medium", label: "Medium", color: "text-amber-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "critical", label: "Critical", color: "text-destructive" },
];

const emptyFlaw = (): Flaw => ({
  category: "", severity: "", quote: "", explanation: "", reproduction_steps: "", suggested_correction: "",
});

export function RedTeamingInterface({ taskId, domain, content, onSubmit }: Props) {
  const [flaws, setFlaws] = useState<Flaw[]>([]);
  const [safetyScore, setSafetyScore] = useState([3]);
  const [summary, setSummary] = useState("");

  const addFlaw = () => setFlaws([...flaws, emptyFlaw()]);
  const removeFlaw = (i: number) => setFlaws(flaws.filter((_, j) => j !== i));
  const updateFlaw = (i: number, field: keyof Flaw, value: string) => {
    const n = [...flaws]; n[i] = { ...n[i], [field]: value }; setFlaws(n);
  };

  return (
    <AnnotationWrapper
      taskId={taskId} taskType="red_teaming" domain={domain} minTimeSeconds={300}
      onSubmitAnnotation={async (_, timeSpent) => {
        if (summary.length < 50) throw new Error("Le résumé doit faire au moins 50 caractères.");
        for (const f of flaws) {
          if (!f.category) throw new Error("Chaque faille doit avoir une catégorie.");
          if (!f.severity) throw new Error("Chaque faille doit avoir une sévérité.");
          if (f.explanation.length < 50) throw new Error("L'explication de chaque faille doit faire au moins 50 caractères.");
        }
        await onSubmit({
          mode: content.mode || "review",
          flaws,
          overall_safety_score: safetyScore[0],
          summary,
          time_spent_seconds: timeSpent,
        }, timeSpent);
      }}
    >
      {() => (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-7rem)]">
          {/* Left: content */}
          <div className="lg:w-[60%] p-4 lg:p-6 overflow-y-auto border-r border-border">
            <Card className="border-l-4 border-l-primary mb-4">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Prompt</p>
                <p className="text-sm whitespace-pre-wrap">{content.prompt}</p>
              </CardContent>
            </Card>
            {content.response && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Réponse du modèle</p>
                  <p className="text-sm whitespace-pre-wrap">{content.response}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: report */}
          <div className="lg:w-[40%] p-4 lg:p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-destructive" /> Rapport de sécurité
              </h3>
              <Button variant="outline" size="sm" className="gap-1" onClick={addFlaw}>
                <Plus className="w-3.5 h-3.5" /> Signaler une faille
              </Button>
            </div>

            {flaws.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucune faille signalée. Cliquez sur "Signaler une faille" pour commencer.
              </p>
            )}

            {flaws.map((flaw, i) => (
              <Card key={i} className="border-destructive/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Faille #{i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFlaw(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                  <Select value={flaw.category} onValueChange={(v) => updateFlaw(i, "category", v)}>
                    <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    {severities.map((s) => (
                      <Button key={s.value} variant={flaw.severity === s.value ? "default" : "outline"} size="sm"
                        className={cn("flex-1 text-xs", flaw.severity === s.value && s.value === "critical" && "bg-destructive")}
                        onClick={() => updateFlaw(i, "severity", s.value)}>{s.label}</Button>
                    ))}
                  </div>
                  <Textarea value={flaw.quote} onChange={(e) => updateFlaw(i, "quote", e.target.value)} placeholder="Citation exacte du modèle..." rows={2} className="resize-none text-xs" />
                  <Textarea value={flaw.explanation} onChange={(e) => updateFlaw(i, "explanation", e.target.value)} placeholder="Pourquoi c'est une faille (min 50 car.)..." rows={3} className="resize-none text-xs" />
                  <Textarea value={flaw.suggested_correction} onChange={(e) => updateFlaw(i, "suggested_correction", e.target.value)} placeholder="Correction suggérée (optionnel)..." rows={2} className="resize-none text-xs" />
                </CardContent>
              </Card>
            ))}

            <div className="border-t border-border pt-4 space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Score de sécurité global (0-5)</p>
                <div className="flex items-center gap-3">
                  <Slider min={0} max={5} step={1} value={safetyScore} onValueChange={setSafetyScore} className="flex-1" />
                  <span className="font-mono text-sm w-4">{safetyScore[0]}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Résumé</p>
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Résumez les problèmes de sécurité identifiés..." rows={4} className="resize-none" />
                <p className="text-[11px] text-muted-foreground mt-1">{summary.length}/50 min</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AnnotationWrapper>
  );
}
