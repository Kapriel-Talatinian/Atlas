import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, Clock, ArrowRight, Loader2, Shield } from "lucide-react";
import type { GuidelinesQuizItem } from "@/types/annotator-assessment";

interface Phase1Props {
  items: GuidelinesQuizItem[];
  onComplete: (answers: { item_id: string; answer: string }[]) => void;
  integrity: any;
  isLoading: boolean;
}

export function AnnotatorPhase1Guidelines({ items, onComplete, integrity, isLoading }: Phase1Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(480); // 8 minutes

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentItem = items[currentIndex];
  const progress = ((currentIndex + 1) / items.length) * 100;

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentItem.id]: value }));
    integrity.recordKeystroke();
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleSubmit = useCallback(() => {
    const formattedAnswers = items.map(item => ({
      item_id: item.id,
      answer: answers[item.id] || '',
    }));
    onComplete(formattedAnswers);
  }, [items, answers, onComplete]);

  const isLastQuestion = currentIndex === items.length - 1;
  const allAnswered = items.every(item => answers[item.id]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" />
          <h2 className="font-semibold">Phase 1 — Compréhension de guidelines</h2>
        </div>
        <Badge variant={timeLeft < 60 ? "destructive" : "secondary"}>
          <Clock className="h-3 w-3 mr-1" />
          {formatTime(timeLeft)}
        </Badge>
      </div>

      <Progress value={progress} className="mb-4" />
      <p className="text-sm text-muted-foreground mb-4">
        Question {currentIndex + 1} sur {items.length}
      </p>

      {/* Integrity banner */}
      {integrity.warningCount > 0 && (
        <Alert variant={integrity.isFlagged ? "destructive" : "default"} className="mb-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            {integrity.warningCount} avertissement(s) détecté(s).
          </AlertDescription>
        </Alert>
      )}

      {/* Question */}
      {currentItem && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Question {currentIndex + 1}</CardTitle>
            {currentItem.content.scenario && (
              <CardDescription className="text-base mt-2 bg-muted/50 p-3 rounded-lg">
                {currentItem.content.scenario}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium">{currentItem.content.question}</p>

            <RadioGroup
              value={answers[currentItem.id] || ''}
              onValueChange={handleAnswer}
              className="space-y-3"
            >
              {(currentItem.content.options || []).map((opt) => (
                <div
                  key={opt.key}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${answers[currentItem.id] === opt.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}
                  `}
                >
                  <RadioGroupItem value={opt.key} id={`q-${currentItem.id}-${opt.key}`} />
                  <Label htmlFor={`q-${currentItem.id}-${opt.key}`} className="cursor-pointer flex-1">
                    {opt.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              >
                Précédent
              </Button>

              {isLastQuestion ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!allAnswered || isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Soumettre ({Object.keys(answers).length}/{items.length})
                </Button>
              ) : (
                <Button onClick={handleNext} disabled={!answers[currentItem.id]}>
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
