import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Clock, ArrowRight, Send, Loader2, Shield } from "lucide-react";
import type { EthicalJudgmentItem } from "@/types/annotator-assessment";

interface Phase4Props {
  items: EthicalJudgmentItem[];
  onComplete: (answers: any[]) => void;
  integrity: any;
  isLoading: boolean;
}

export function AnnotatorPhase4EthicalJudgment({ items, onComplete, integrity, isLoading }: Phase4Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentItem = items[currentIndex];
  const progress = ((currentIndex + 1) / items.length) * 100;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSubmit = useCallback(() => {
    const formatted = items.map(item => ({
      item_id: item.id,
      response: answers[item.id] || '',
    }));
    onComplete(formatted);
  }, [items, answers, onComplete]);

  const isLastItem = currentIndex === items.length - 1;
  const currentResponse = answers[currentItem?.id] || '';
  const isValid = currentResponse.length >= 30;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          <h2 className="font-semibold">Phase 4 — Jugement éthique</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{currentIndex + 1}/{items.length}</Badge>
          <Badge variant={timeLeft < 60 ? "destructive" : "secondary"}>
            <Clock className="h-3 w-3 mr-1" />{formatTime(timeLeft)}
          </Badge>
        </div>
      </div>

      <Progress value={progress} className="mb-4" />

      {integrity.warningCount > 0 && (
        <Alert variant={integrity.isFlagged ? "destructive" : "default"} className="mb-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>{integrity.warningCount} avertissement(s).</AlertDescription>
        </Alert>
      )}

      {currentItem && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scénario {currentIndex + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-purple-500">
              <p className="text-sm whitespace-pre-wrap">{currentItem.content.scenario}</p>
              {currentItem.content.context && (
                <p className="text-sm text-muted-foreground mt-2 italic">{currentItem.content.context}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Que faites-vous ? Décrivez votre réaction et vos actions concrètes.
              </label>
              <Textarea
                value={currentResponse}
                onChange={e => {
                  integrity.recordKeystroke();
                  setAnswers(prev => ({ ...prev, [currentItem.id]: e.target.value }));
                }}
                placeholder="Décrivez les étapes concrètes que vous prendriez dans cette situation..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                {currentResponse.length} caractères (min. 30)
              </p>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              >
                Précédent
              </Button>
              {isLastItem ? (
                <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Terminer l'assessment
                </Button>
              ) : (
                <Button onClick={() => setCurrentIndex(prev => prev + 1)} disabled={!isValid}>
                  Suivant <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
