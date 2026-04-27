import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AnnotationWrapper } from "./AnnotationWrapper";
import { Info } from "lucide-react";

interface Props {
  taskId: string;
  domain: string;
  content: { prompt: string; response: string; dimensions: string[] };
  onSubmit: (data: any, timeSpent: number) => Promise<void>;
}

const dimensionDescriptions: Record<string, string> = {
  correctness: "La réponse est-elle factuellement correcte ?",
  safety: "La réponse est-elle sûre et sans danger ?",
  completeness: "La réponse couvre-t-elle tous les aspects ?",
  reasoning_depth: "Le raisonnement est-il profond et structuré ?",
  source_reliability: "Les informations sont-elles vérifiables ?",
  communication_clarity: "La réponse est-elle claire et bien formulée ?",
  code_quality: "Le code est-il propre et maintenable ?",
  error_handling: "Les erreurs sont-elles bien gérées ?",
  performance_awareness: "Les aspects de performance sont-ils pris en compte ?",
  edge_case_handling: "Les cas limites sont-ils considérés ?",
  clinical_accuracy: "Les informations cliniques sont-elles précises ?",
  patient_safety: "La sécurité du patient est-elle préservée ?",
  legal_precision: "Les termes juridiques sont-ils précis ?",
  quantitative_accuracy: "Les chiffres et calculs sont-ils corrects ?",
};

const dimensionLabels: Record<string, string> = {
  correctness: "Exactitude",
  safety: "Sécurité",
  completeness: "Complétude",
  reasoning_depth: "Profondeur du raisonnement",
  source_reliability: "Fiabilité des sources",
  communication_clarity: "Clarté",
  code_quality: "Qualité du code",
  error_handling: "Gestion des erreurs",
  performance_awareness: "Performance",
  edge_case_handling: "Cas limites",
  clinical_accuracy: "Précision clinique",
  patient_safety: "Sécurité patient",
  legal_precision: "Précision juridique",
  quantitative_accuracy: "Exactitude quantitative",
};

export function ScoringInterface({ taskId, domain, content, onSubmit }: Props) {
  const dims = content.dimensions || ["correctness", "safety", "completeness", "reasoning_depth", "source_reliability", "communication_clarity"];
  const [reasoning, setReasoning] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const reasoningValid = reasoning.length >= 100;

  const scoreColor = (v: number) => v <= 1 ? "text-destructive" : v <= 3 ? "text-amber-500" : "text-emerald-500";
  const scoreBg = (v: number) => v <= 1 ? "bg-destructive" : v <= 3 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <AnnotationWrapper
      taskId={taskId}
      taskType="scoring"
      domain={domain}
      minTimeSeconds={120}
      onSubmitAnnotation={async (_, timeSpent) => {
        if (!reasoningValid) throw new Error("Le raisonnement doit faire au moins 100 caractères.");
        if (Object.keys(scores).length < dims.length) throw new Error("Veuillez scorer toutes les dimensions.");
        const allSame = new Set(Object.values(scores)).size === 1 && Object.keys(scores).length === dims.length;
        if (allSame) throw new Error("Tous les scores sont identiques. Veuillez différencier votre évaluation.");
        await onSubmit({
          reasoning,
          dimensions: Object.fromEntries(dims.map(d => [d, { score: scores[d], note: notes[d] || null }])),
          time_spent_seconds: timeSpent,
        }, timeSpent);
      }}
    >
      {() => (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-7rem)]">
          {/* Left: prompt + response */}
          <div className="lg:w-[60%] p-4 lg:p-6 overflow-y-auto border-r border-border">
            <Card className="border-l-4 border-l-primary mb-4">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Prompt</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content.prompt}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Réponse du modèle</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content.response}</p>
              </CardContent>
            </Card>
          </div>

          {/* Right: scoring panel */}
          <div className="lg:w-[40%] p-4 lg:p-6 overflow-y-auto">
            <h3 className="text-base font-semibold text-foreground mb-1">Évaluation</h3>
            <p className="text-xs text-muted-foreground mb-4">Raisonnez d'abord, scorez ensuite.</p>

            {/* Reasoning first */}
            <div className="mb-6">
              <div className="border-l-4 border-l-emerald-500 pl-3">
                <p className="text-sm font-medium text-foreground mb-1">Raisonnement global</p>
                <Textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Analysez la réponse en détail avant d'attribuer vos scores. Identifiez les points forts et les faiblesses."
                  rows={5}
                  className="resize-none"
                />
                <p className={cn("text-[11px] mt-1", reasoningValid ? "text-emerald-500" : "text-muted-foreground")}>
                  {reasoning.length}/100 caractères minimum
                </p>
              </div>
            </div>

            {/* Dimensions */}
            <div className="space-y-4">
              {dims.map((dim) => (
                <div key={dim} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{dimensionLabels[dim] || dim}</span>
                    <Tooltip>
                      <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs max-w-[200px]">{dimensionDescriptions[dim] || dim}</p></TooltipContent>
                    </Tooltip>
                    <span className={cn("ml-auto font-mono text-sm font-semibold", scores[dim] !== undefined ? scoreColor(scores[dim]) : "text-muted-foreground")}>
                      {scores[dim] !== undefined ? scores[dim].toFixed(1) : "—"}
                    </span>
                  </div>

                  {!reasoningValid ? (
                    <p className="text-[11px] text-amber-500">Rédigez votre raisonnement avant d'attribuer vos scores.</p>
                  ) : (
                    <>
                      <div className="flex gap-1">
                        {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
                          <button
                            key={v}
                            onClick={() => setScores((p) => ({ ...p, [dim]: v }))}
                            className={cn(
                              "h-7 min-w-[28px] px-1 text-[11px] font-mono rounded transition-colors",
                              scores[dim] === v
                                ? `${scoreBg(v)} text-white`
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                          >
                            {v % 1 === 0 ? v : ""}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setExpandedNotes((p) => ({ ...p, [dim]: !p[dim] }))}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {expandedNotes[dim] ? "Masquer note" : "+ Note"}
                      </button>
                      {expandedNotes[dim] && (
                        <input
                          type="text"
                          value={notes[dim] || ""}
                          onChange={(e) => setNotes((p) => ({ ...p, [dim]: e.target.value }))}
                          placeholder="Note optionnelle..."
                          className="w-full h-8 text-xs bg-muted/50 border border-border rounded-md px-2"
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AnnotationWrapper>
  );
}
