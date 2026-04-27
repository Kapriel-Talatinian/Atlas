import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Target, Clock, ArrowRight, Send, Loader2, Shield } from "lucide-react";
import type { AnnotationItem, AnnotationDomain } from "@/types/annotator-assessment";

const DIMENSIONS = ['helpfulness', 'harmlessness', 'honesty'];
const DIM_LABELS: Record<string, string> = {
  helpfulness: 'Helpfulness (Utilité)',
  harmlessness: 'Harmlessness (Innocuité)',
  honesty: 'Honesty (Honnêteté)',
};

interface Phase2Props {
  items: AnnotationItem[];
  domain: AnnotationDomain;
  onComplete: (answers: any[]) => void;
  integrity: any;
  isLoading: boolean;
}

export function AnnotatorPhase2Annotation({ items, domain, onComplete, integrity, isLoading }: Phase2Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(1200); // 20 minutes
  const itemStartRef = useRef(Date.now());

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

  // Track time per item
  useEffect(() => {
    itemStartRef.current = Date.now();
  }, [currentIndex]);

  const currentItem = items[currentIndex];
  const currentAnswer = answers[currentItem?.id] || {
    dimensions: Object.fromEntries(DIMENSIONS.map(d => [d, 3])),
    justification: '',
  };

  const updateAnswer = (field: string, value: any) => {
    integrity.recordKeystroke();
    setAnswers(prev => ({
      ...prev,
      [currentItem.id]: {
        ...prev[currentItem.id] || { dimensions: Object.fromEntries(DIMENSIONS.map(d => [d, 3])), justification: '' },
        [field]: value,
      },
    }));
  };

  const updateDimension = (dim: string, value: number) => {
    const current = answers[currentItem.id] || { dimensions: Object.fromEntries(DIMENSIONS.map(d => [d, 3])), justification: '' };
    setAnswers(prev => ({
      ...prev,
      [currentItem.id]: {
        ...current,
        dimensions: { ...current.dimensions, [dim]: value },
      },
    }));
  };

  const handleNext = () => {
    // Record time spent on this item
    const timeSpent = (Date.now() - itemStartRef.current) / 1000;
    setAnswers(prev => ({
      ...prev,
      [currentItem.id]: {
        ...prev[currentItem.id],
        time_spent: timeSpent,
      },
    }));

    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleSubmit = useCallback(() => {
    const timeSpent = (Date.now() - itemStartRef.current) / 1000;
    const finalAnswers = items.map(item => ({
      item_id: item.id,
      ...(answers[item.id] || { dimensions: {}, justification: '' }),
      time_spent: item.id === currentItem?.id ? timeSpent : (answers[item.id]?.time_spent || 0),
    }));
    onComplete(finalAnswers);
  }, [items, answers, currentItem, onComplete]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const progress = ((currentIndex + 1) / items.length) * 100;
  const isLastItem = currentIndex === items.length - 1;
  const isValid = currentAnswer.justification && currentAnswer.justification.length >= 10;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-green-500" />
          <h2 className="font-semibold">Phase 2 — Annotation pratique</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {currentIndex + 1}/{items.length}
          </Badge>
          <Badge variant={timeLeft < 120 ? "destructive" : "secondary"}>
            <Clock className="h-3 w-3 mr-1" />
            {formatTime(timeLeft)}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Content to annotate */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Item {currentIndex + 1}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {(currentItem as any).difficulty}
                </Badge>
              </div>
              {currentItem.content.context && (
                <CardDescription>{currentItem.content.context}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prompt */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Prompt utilisateur</p>
                <p className="text-sm">{currentItem.content.prompt}</p>
              </div>

              {/* Response */}
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border-l-4 border-blue-500">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Réponse du modèle</p>
                <p className="text-sm whitespace-pre-wrap">{currentItem.content.response}</p>
              </div>

              {/* Response B for RLHF */}
              {currentItem.content.response_b && (
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 border-l-4 border-purple-500">
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">Réponse B</p>
                  <p className="text-sm whitespace-pre-wrap">{currentItem.content.response_b}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Annotation form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Votre annotation</CardTitle>
              <CardDescription>Évaluez chaque dimension et justifiez.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Dimension sliders */}
              {DIMENSIONS.map(dim => (
                <div key={dim} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{DIM_LABELS[dim]}</label>
                    <Badge variant="outline">{currentAnswer.dimensions[dim]}/5</Badge>
                  </div>
                  <Slider
                    value={[currentAnswer.dimensions[dim]]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={([v]) => updateDimension(dim, v)}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 — Très mauvais</span>
                    <span>5 — Excellent</span>
                  </div>
                </div>
              ))}

              {/* Justification */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Justification <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={currentAnswer.justification}
                  onChange={e => updateAnswer('justification', e.target.value)}
                  placeholder="Expliquez vos scores en 1-3 phrases. Citez les critères pertinents des guidelines."
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {currentAnswer.justification.length} caractères (min. 10)
                </p>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  size="sm"
                >
                  Précédent
                </Button>

                {isLastItem ? (
                  <Button onClick={handleSubmit} disabled={!isValid || isLoading} size="sm">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Soumettre tout
                  </Button>
                ) : (
                  <Button onClick={handleNext} disabled={!isValid} size="sm">
                    Suivant <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
