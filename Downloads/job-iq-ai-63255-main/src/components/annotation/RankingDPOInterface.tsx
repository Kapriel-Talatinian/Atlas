import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnnotationWrapper, useAnnotationShortcuts } from "./AnnotationWrapper";

interface Props {
  taskId: string;
  domain: string;
  content: { prompt: string; response_a: string; response_b: string; metadata?: any };
  onSubmit: (data: any, timeSpent: number) => Promise<void>;
}

export function RankingDPOInterface({ taskId, domain, content, onSubmit }: Props) {
  const [preference, setPreference] = useState<"A" | "B" | "TIE" | "">("");
  const [strength, setStrength] = useState<"weak" | "strong">("weak");
  const [reasoning, setReasoning] = useState("");

  useAnnotationShortcuts({
    "1": () => setPreference("A"),
    "2": () => setPreference("TIE"),
    "3": () => setPreference("B"),
  });

  const buildData = useCallback(() => ({
    preference,
    preference_strength: preference === "TIE" ? undefined : strength,
    reasoning,
  }), [preference, strength, reasoning]);

  const validate = () => {
    if (!preference) throw new Error("Veuillez choisir une préférence.");
    if (reasoning.length < 50) throw new Error("La justification doit faire au moins 50 caractères.");
  };

  return (
    <AnnotationWrapper
      taskId={taskId}
      taskType="ranking_dpo"
      domain={domain}
      minTimeSeconds={60}
      onSubmitAnnotation={async (_, timeSpent) => {
        validate();
        await onSubmit({ ...buildData(), time_spent_seconds: timeSpent }, timeSpent);
      }}
    >
      {({ onSubmit: handleSubmit }) => {
        // Auto-save draft on change
        useEffect(() => {
          const wrapper = document.querySelector("[data-draft]");
        }, [preference, strength, reasoning]);

        return (
          <div className="px-4 py-6 space-y-6">
            {/* Prompt */}
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Prompt</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content.prompt}</p>
              </CardContent>
            </Card>

            {/* Responses A/B */}
            <div className="grid md:grid-cols-2 gap-4">
              {(["A", "B"] as const).map((side) => (
                <Card
                  key={side}
                  className={cn(
                    "transition-all",
                    preference === side && "border-primary ring-1 ring-primary/20"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground">Réponse {side}</p>
                      {content.metadata?.[`model_${side.toLowerCase()}`] && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {content.metadata[`model_${side.toLowerCase()}`]}
                        </span>
                      )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {side === "A" ? content.response_a : content.response_b}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Choice */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "A" as const, label: "A est meilleure", shortcut: "1" },
                  { value: "TIE" as const, label: "Égalité", shortcut: "2" },
                  { value: "B" as const, label: "B est meilleure", shortcut: "3" },
                ]).map((opt) => (
                  <Button
                    key={opt.value}
                    variant={preference === opt.value ? "default" : "outline"}
                    className="h-12 relative"
                    onClick={() => setPreference(opt.value)}
                  >
                    {opt.label}
                    <span className="absolute top-1 right-2 text-[10px] opacity-40">{opt.shortcut}</span>
                  </Button>
                ))}
              </div>

              {preference && preference !== "TIE" && (
                <Select value={strength} onValueChange={(v) => setStrength(v as any)}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weak">Légèrement meilleure</SelectItem>
                    <SelectItem value="strong">Nettement meilleure</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <div>
                <p className="text-sm font-medium text-foreground mb-1.5">Justification</p>
                <Textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Expliquez pourquoi cette réponse est meilleure. Quels critères ont guidé votre choix ?"
                  rows={5}
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">{reasoning.length}/50 caractères minimum</p>
              </div>
            </div>
          </div>
        );
      }}
    </AnnotationWrapper>
  );
}
