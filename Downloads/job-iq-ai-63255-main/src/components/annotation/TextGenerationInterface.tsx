import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AnnotationWrapper } from "./AnnotationWrapper";
import { Copy } from "lucide-react";

interface Props {
  taskId: string;
  domain: string;
  content: { prompt: string; model_response?: string; instructions?: string; target_length?: string; target_tone?: string };
  onSubmit: (data: any, timeSpent: number) => Promise<void>;
}

const lengthTargets: Record<string, { min: number; max: number; minTime: number }> = {
  short: { min: 50, max: 150, minTime: 180 },
  medium: { min: 150, max: 400, minTime: 300 },
  long: { min: 400, max: 1000, minTime: 480 },
};

export function TextGenerationInterface({ taskId, domain, content, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [quality, setQuality] = useState("");
  const isRewrite = !!content.model_response;
  const target = lengthTargets[content.target_length || "medium"] || lengthTargets.medium;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const progress = Math.min((wordCount / target.max) * 100, 100);

  return (
    <AnnotationWrapper
      taskId={taskId} taskType="text_generation" domain={domain}
      minTimeSeconds={target.minTime}
      onSubmitAnnotation={async (_, timeSpent) => {
        if (wordCount < target.min) throw new Error(`Le texte doit contenir au moins ${target.min} mots (actuellement ${wordCount}).`);
        if (isRewrite && editNotes.length < 30) throw new Error("Décrivez vos modifications (min 30 caractères).");
        await onSubmit({
          generated_text: text, word_count: wordCount,
          edit_notes: isRewrite ? editNotes : null,
          self_quality_assessment: quality || null,
          time_spent_seconds: timeSpent,
        }, timeSpent);
      }}
    >
      {() => (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-7rem)]">
          {/* Left */}
          <div className="lg:w-1/2 p-4 lg:p-6 overflow-y-auto border-r border-border space-y-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Prompt</p>
                <p className="text-sm whitespace-pre-wrap">{content.prompt}</p>
              </CardContent>
            </Card>
            {content.instructions && (
              <Card className="border-l-4 border-l-amber-500 bg-amber-500/[0.03]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-amber-500 uppercase tracking-wider mb-1">Instructions du client</p>
                  <p className="text-sm whitespace-pre-wrap">{content.instructions}</p>
                </CardContent>
              </Card>
            )}
            {content.model_response && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Réponse actuelle du modèle</p>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setText(content.model_response!)}>
                      <Copy className="w-3 h-3" /> Copier
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{content.model_response}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: editor */}
          <div className="lg:w-1/2 p-4 lg:p-6 space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">{isRewrite ? "Votre version améliorée" : "Votre réponse"}</p>
              <Textarea
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder={isRewrite ? "Améliorez la réponse du modèle..." : "Rédigez la réponse idéale au prompt..."}
                rows={16} className="resize-none font-sans"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 flex-1">
                  <Progress value={progress} className="h-1.5 flex-1 max-w-[200px]" />
                  <span className="text-[11px] text-muted-foreground">{wordCount} mots</span>
                </div>
                <span className="text-[11px] text-muted-foreground">Cible : {target.min}–{target.max}</span>
              </div>
            </div>

            {isRewrite && (
              <div>
                <p className="text-sm font-medium mb-1">Notes sur les modifications</p>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Qu'avez-vous changé et pourquoi ?" rows={3} className="resize-none" />
                <p className="text-[11px] text-muted-foreground mt-1">{editNotes.length}/30 min</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-1">Auto-évaluation (optionnel)</p>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellente</SelectItem>
                  <SelectItem value="good">Bonne</SelectItem>
                  <SelectItem value="acceptable">Acceptable</SelectItem>
                  <SelectItem value="uncertain">Difficile — j'ai des doutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </AnnotationWrapper>
  );
}
