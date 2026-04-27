import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { AnnotationWrapper, useAnnotationShortcuts } from "./AnnotationWrapper";
import { Check, AlertTriangle, X, HelpCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Source { url: string; description: string; }

interface Props {
  taskId: string;
  domain: string;
  content: { prompt?: string; claim: string; context?: string };
  onSubmit: (data: any, timeSpent: number) => Promise<void>;
}

const verdicts = [
  { value: "true", label: "Vrai", icon: Check, color: "border-emerald-500 bg-emerald-500/5 text-emerald-500" },
  { value: "partially_true", label: "Partiellement vrai", icon: AlertTriangle, color: "border-amber-500 bg-amber-500/5 text-amber-500" },
  { value: "false", label: "Faux", icon: X, color: "border-destructive bg-destructive/5 text-destructive" },
  { value: "unverifiable", label: "Invérifiable", icon: HelpCircle, color: "border-muted-foreground bg-muted text-muted-foreground" },
];

export function FactCheckingInterface({ taskId, domain, content, onSubmit }: Props) {
  const [verdict, setVerdict] = useState("");
  const [confidence, setConfidence] = useState([3]);
  const [justification, setJustification] = useState("");
  const [sources, setSources] = useState<Source[]>([{ url: "", description: "" }]);
  const [correction, setCorrection] = useState("");

  useAnnotationShortcuts({
    "1": () => setVerdict("true"),
    "2": () => setVerdict("partially_true"),
    "3": () => setVerdict("false"),
    "4": () => setVerdict("unverifiable"),
  });

  const addSource = () => setSources([...sources, { url: "", description: "" }]);
  const removeSource = (i: number) => setSources(sources.filter((_, j) => j !== i));
  const updateSource = (i: number, field: keyof Source, value: string) => {
    const n = [...sources]; n[i] = { ...n[i], [field]: value }; setSources(n);
  };

  return (
    <AnnotationWrapper
      taskId={taskId} taskType="fact_checking" domain={domain} minTimeSeconds={120}
      onSubmitAnnotation={async (_, timeSpent) => {
        if (!verdict) throw new Error("Veuillez choisir un verdict.");
        if (justification.length < 80) throw new Error("La justification doit faire au moins 80 caractères.");
        if (verdict !== "unverifiable" && !sources.some(s => s.url.trim())) throw new Error("Au moins une source est requise.");
        if (verdict !== "true" && correction.length < 10) throw new Error("Une correction est requise.");
        await onSubmit({
          verdict, confidence: confidence[0], justification,
          sources: sources.filter(s => s.url.trim()),
          correction: verdict !== "true" ? correction : null,
          time_spent_seconds: timeSpent,
        }, timeSpent);
      }}
    >
      {() => (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-7rem)]">
          {/* Left */}
          <div className="lg:w-[60%] p-4 lg:p-6 overflow-y-auto border-r border-border space-y-4">
            {content.prompt && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <p className="font-medium mb-1">Contexte du prompt</p>
                <p>{content.prompt}</p>
              </div>
            )}
            <Card className="border-l-4 border-l-primary bg-primary/[0.02]">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Affirmation à vérifier</p>
                <p className="text-base font-medium text-foreground leading-relaxed">{content.claim}</p>
              </CardContent>
            </Card>
            {content.context && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Contexte source</p>
                  <p className="text-sm whitespace-pre-wrap">{content.context}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right */}
          <div className="lg:w-[40%] p-4 lg:p-6 overflow-y-auto space-y-5">
            <div>
              <p className="text-sm font-medium mb-2">Verdict</p>
              <div className="grid grid-cols-2 gap-2">
                {verdicts.map((v) => {
                  const Icon = v.icon;
                  return (
                    <button key={v.value} onClick={() => setVerdict(v.value)}
                      className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all",
                        verdict === v.value ? v.color : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      )}>
                      <Icon className="w-4 h-4" /> {v.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Niveau de confiance</p>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground">Incertain</span>
                <Slider min={1} max={5} step={1} value={confidence} onValueChange={setConfidence} className="flex-1" />
                <span className="text-[11px] text-muted-foreground">Certain</span>
                <span className="font-mono text-sm w-4">{confidence[0]}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Justification</p>
              <Textarea value={justification} onChange={(e) => setJustification(e.target.value)}
                placeholder="Expliquez votre verdict. Si partiellement vrai, précisez ce qui est correct et ce qui ne l'est pas."
                rows={4} className="resize-none" />
              <p className="text-[11px] text-muted-foreground mt-1">{justification.length}/80 min</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Sources</p>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addSource}><Plus className="w-3 h-3" /> Ajouter</Button>
              </div>
              <div className="space-y-2">
                {sources.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={s.url} onChange={(e) => updateSource(i, "url", e.target.value)} placeholder="https://..." className="flex-1 text-xs" />
                    <Input value={s.description} onChange={(e) => updateSource(i, "description", e.target.value)} placeholder="Description" className="flex-1 text-xs" />
                    {sources.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeSource(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {verdict && verdict !== "true" && (
              <div>
                <p className="text-sm font-medium mb-1">Correction</p>
                <Textarea value={correction} onChange={(e) => setCorrection(e.target.value)}
                  placeholder="Quelle est l'information correcte ?" rows={3} className="resize-none" />
              </div>
            )}
          </div>
        </div>
      )}
    </AnnotationWrapper>
  );
}
