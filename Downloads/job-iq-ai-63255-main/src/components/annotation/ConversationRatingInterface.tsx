import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnnotationWrapper } from "./AnnotationWrapper";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Turn { role: string; content: string; }
interface Props {
  taskId: string;
  domain: string;
  content: {
    conversation: Turn[];
    system_prompt?: string;
    dimensions: string[];
    evaluate_per_turn: boolean;
  };
  onSubmit: (data: any, timeSpent: number) => Promise<void>;
}

const dimLabels: Record<string, string> = {
  helpfulness: "Utilité", coherence: "Cohérence", safety: "Sécurité",
  instruction_following: "Suivi des instructions", tone: "Ton",
};

export function ConversationRatingInterface({ taskId, domain, content, onSubmit }: Props) {
  const assistantTurns = content.conversation
    .map((t, i) => ({ ...t, index: i }))
    .filter((t) => t.role === "assistant");
  const dims = content.dimensions || ["helpfulness", "coherence", "safety", "instruction_following", "tone"];

  const [perTurnScores, setPerTurnScores] = useState<Record<number, Record<string, number>>>({});
  const [globalScores, setGlobalScores] = useState<Record<string, number>>({});
  const [globalReasoning, setGlobalReasoning] = useState("");
  const [coherenceMaintained, setCoherenceMaintained] = useState("");
  const [systemPromptFollowed, setSystemPromptFollowed] = useState("");
  const [activeTurn, setActiveTurn] = useState<number | null>(null);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const setTurnScore = (turnIdx: number, dim: string, value: number) => {
    setPerTurnScores((p) => ({
      ...p,
      [turnIdx]: { ...(p[turnIdx] || {}), [dim]: value },
    }));
  };

  const allTurnsEvaluated = content.evaluate_per_turn
    ? assistantTurns.every((t) => {
        const scores = perTurnScores[t.index];
        return scores && Object.keys(scores).length >= dims.length;
      })
    : true;

  const ScoreRow = ({ dim, scores, setScore }: { dim: string; scores: Record<string, number>; setScore: (d: string, v: number) => void }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{dimLabels[dim] || dim}</span>
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <button key={v} onClick={() => setScore(dim, v)}
            className={cn("w-6 h-6 text-[10px] font-mono rounded",
              scores[dim] === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}>{v}</button>
        ))}
      </div>
    </div>
  );

  return (
    <AnnotationWrapper
      taskId={taskId} taskType="conversation_rating" domain={domain}
      minTimeSeconds={180 + assistantTurns.length * 30}
      onSubmitAnnotation={async (_, timeSpent) => {
        if (content.evaluate_per_turn && !allTurnsEvaluated) throw new Error("Tous les tours d'assistant doivent être évalués.");
        if (Object.keys(globalScores).length < dims.length) throw new Error("Veuillez scorer toutes les dimensions globales.");
        if (globalReasoning.length < 80) throw new Error("L'évaluation globale doit faire au moins 80 caractères.");
        await onSubmit({
          per_turn_scores: content.evaluate_per_turn
            ? assistantTurns.map((t) => ({ turn_index: t.index, scores: perTurnScores[t.index] || {} }))
            : null,
          global_scores: globalScores,
          global_reasoning: globalReasoning,
          coherence_maintained: coherenceMaintained || null,
          system_prompt_followed: systemPromptFollowed || null,
          time_spent_seconds: timeSpent,
        }, timeSpent);
      }}
    >
      {() => (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-7rem)]">
          {/* Left: conversation */}
          <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
            {content.system_prompt && (
              <div className="mb-4">
                <button onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                  className="text-xs text-muted-foreground hover:text-foreground">
                  {showSystemPrompt ? "Masquer" : "Afficher"} le prompt système
                </button>
                {showSystemPrompt && (
                  <Card className="mt-2 bg-muted/50"><CardContent className="p-3 text-xs text-muted-foreground font-mono">{content.system_prompt}</CardContent></Card>
                )}
              </div>
            )}

            <div className="space-y-3">
              {content.conversation.map((turn, i) => {
                const isAssistant = turn.role === "assistant";
                const turnNum = isAssistant ? assistantTurns.findIndex((t) => t.index === i) + 1 : null;
                const isEvaluated = isAssistant && perTurnScores[i] && Object.keys(perTurnScores[i]).length >= dims.length;
                const isActive = activeTurn === i;

                return (
                  <div key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap",
                        turn.role === "user"
                          ? "bg-primary/10 text-foreground"
                          : "bg-muted text-foreground border border-border",
                        isAssistant && content.evaluate_per_turn && "cursor-pointer hover:ring-1 hover:ring-primary/30",
                        isActive && "ring-2 ring-primary"
                      )}
                      onClick={() => isAssistant && content.evaluate_per_turn && setActiveTurn(isActive ? null : i)}
                    >
                      {isAssistant && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-muted-foreground">Tour {turnNum}</span>
                          {isEvaluated && <Check className="w-3 h-3 text-emerald-500" />}
                        </div>
                      )}
                      {turn.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: scoring panel */}
          <div className="lg:w-[340px] p-4 lg:p-6 border-l border-border overflow-y-auto space-y-5">
            {/* Per-turn scoring */}
            {content.evaluate_per_turn && activeTurn !== null && (
              <Card className="border-primary/30">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Tour {assistantTurns.findIndex((t) => t.index === activeTurn) + 1}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={activeTurn <= 0}
                        onClick={() => {
                          const idx = assistantTurns.findIndex((t) => t.index === activeTurn);
                          if (idx > 0) setActiveTurn(assistantTurns[idx - 1].index);
                        }}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => {
                          const idx = assistantTurns.findIndex((t) => t.index === activeTurn);
                          if (idx < assistantTurns.length - 1) setActiveTurn(assistantTurns[idx + 1].index);
                        }}><ChevronRight className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  {dims.map((dim) => (
                    <ScoreRow key={dim} dim={dim}
                      scores={perTurnScores[activeTurn] || {}}
                      setScore={(d, v) => setTurnScore(activeTurn, d, v)} />
                  ))}
                </CardContent>
              </Card>
            )}

            {content.evaluate_per_turn && activeTurn === null && (
              <p className="text-xs text-amber-500">Cliquez sur un tour d'assistant pour l'évaluer.</p>
            )}

            {/* Global scoring */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">Évaluation globale</p>
                {dims.map((dim) => (
                  <ScoreRow key={dim} dim={dim} scores={globalScores}
                    setScore={(d, v) => setGlobalScores((p) => ({ ...p, [d]: v }))} />
                ))}
              </CardContent>
            </Card>

            <Textarea value={globalReasoning} onChange={(e) => setGlobalReasoning(e.target.value)}
              placeholder="Évaluation globale de la conversation..." rows={4} className="resize-none" />
            <p className="text-[11px] text-muted-foreground">{globalReasoning.length}/80 min</p>

            <div className="space-y-2">
              <Select value={coherenceMaintained} onValueChange={setCoherenceMaintained}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Cohérence maintenue ?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Oui</SelectItem>
                  <SelectItem value="partially">Partiellement</SelectItem>
                  <SelectItem value="no">Non</SelectItem>
                </SelectContent>
              </Select>
              <Select value={systemPromptFollowed} onValueChange={setSystemPromptFollowed}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Prompt système suivi ?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Oui</SelectItem>
                  <SelectItem value="partially">Partiellement</SelectItem>
                  <SelectItem value="no">Non</SelectItem>
                  <SelectItem value="none">Pas de prompt système</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </AnnotationWrapper>
  );
}
