import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnnotationWrapper, useAnnotationShortcuts } from "./AnnotationWrapper";

interface Props {
  taskId: string;
  domain: string;
  content: { prompt: string; response_a: string; response_b: string; dimensions: string[] };
  onSubmit: (data: any, timeSpent: number) => Promise<void>;
}

const dimLabels: Record<string, string> = {
  correctness: "Exactitude", safety: "Sécurité", completeness: "Complétude",
  reasoning_depth: "Raisonnement", source_reliability: "Sources", communication_clarity: "Clarté",
};

export function ComparisonABInterface({ taskId, domain, content, onSubmit }: Props) {
  const dims = content.dimensions || ["correctness", "safety", "completeness", "reasoning_depth"];
  const [scoresA, setScoresA] = useState<Record<string, number>>({});
  const [scoresB, setScoresB] = useState<Record<string, number>>({});
  const [preference, setPreference] = useState<"A" | "B" | "TIE" | "">("");
  const [strength, setStrength] = useState<"weak" | "strong">("weak");
  const [reasoning, setReasoning] = useState("");

  useAnnotationShortcuts({ "1": () => setPreference("A"), "2": () => setPreference("TIE"), "3": () => setPreference("B") });

  const scoreColor = (v: number) => v <= 1 ? "text-destructive" : v <= 3 ? "text-amber-500" : "text-emerald-500";

  const renderScoreButtons = (scores: Record<string, number>, setScores: (s: Record<string, number>) => void, dim: string) => (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          onClick={() => setScores({ ...scores, [dim]: v })}
          className={cn(
            "w-7 h-7 text-[11px] font-mono rounded",
            scores[dim] === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );

  return (
    <AnnotationWrapper
      taskId={taskId} taskType="comparison_ab" domain={domain} minTimeSeconds={180}
      onSubmitAnnotation={async (_, timeSpent) => {
        if (Object.keys(scoresA).length < dims.length || Object.keys(scoresB).length < dims.length)
          throw new Error("Veuillez scorer toutes les dimensions pour les deux réponses.");
        if (!preference) throw new Error("Veuillez choisir une préférence.");
        if (reasoning.length < 80) throw new Error("Le raisonnement comparatif doit faire au moins 80 caractères.");
        await onSubmit({ scores_a: scoresA, scores_b: scoresB, preference, preference_strength: strength, reasoning, time_spent_seconds: timeSpent }, timeSpent);
      }}
    >
      {() => (
        <div className="px-4 py-6 space-y-6">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Prompt</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{content.prompt}</p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            {(["A", "B"] as const).map((side) => {
              const scores = side === "A" ? scoresA : scoresB;
              const setScores = side === "A" ? (s: Record<string, number>) => setScoresA(s) : (s: Record<string, number>) => setScoresB(s);
              return (
                <Card key={side} className={cn(preference === side && "border-primary ring-1 ring-primary/20")}>
                  <CardContent className="p-4 space-y-4">
                    <p className="text-sm font-semibold">Réponse {side}</p>
                    <div className="max-h-[300px] overflow-y-auto">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{side === "A" ? content.response_a : content.response_b}</p>
                    </div>
                    <div className="border-t border-border pt-3 space-y-2">
                      {dims.map((dim) => (
                        <div key={dim} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{dimLabels[dim] || dim}</span>
                          <div className="flex items-center gap-2">
                            {renderScoreButtons(scores, setScores, dim)}
                            <span className={cn("font-mono text-xs w-4", scores[dim] !== undefined ? scoreColor(scores[dim]) : "text-muted-foreground")}>
                              {scores[dim] ?? "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">Préférence globale</p>
            <div className="grid grid-cols-3 gap-3">
              {([ { v: "A" as const, l: "A est meilleure" }, { v: "TIE" as const, l: "Égalité" }, { v: "B" as const, l: "B est meilleure" } ]).map((o) => (
                <Button key={o.v} variant={preference === o.v ? "default" : "outline"} onClick={() => setPreference(o.v)} className="h-10">{o.l}</Button>
              ))}
            </div>
            {preference && preference !== "TIE" && (
              <Select value={strength} onValueChange={(v) => setStrength(v as any)}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weak">Légèrement meilleure</SelectItem>
                  <SelectItem value="strong">Nettement meilleure</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)} placeholder="Comparez les deux réponses. Qu'est-ce qui rend l'une meilleure que l'autre ?" rows={4} className="resize-none" />
            <p className="text-[11px] text-muted-foreground">{reasoning.length}/80 caractères minimum</p>
          </div>
        </div>
      )}
    </AnnotationWrapper>
  );
}
