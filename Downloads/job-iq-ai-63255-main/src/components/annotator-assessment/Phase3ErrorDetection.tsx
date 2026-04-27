import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, Clock, ArrowRight, Send, Loader2, Shield, CheckCircle, XCircle } from "lucide-react";
import type { ErrorDetectionItem } from "@/types/annotator-assessment";

interface Phase3Props {
  items: ErrorDetectionItem[];
  onComplete: (answers: any[]) => void;
  integrity: any;
  isLoading: boolean;
}

export function AnnotatorPhase3ErrorDetection({ items, onComplete, integrity, isLoading }: Phase3Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { has_error: boolean | null; error_description: string }>>({});
  const [timeLeft, setTimeLeft] = useState(420); // 7 minutes

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
  const currentAnswer = answers[currentItem?.id] || { has_error: null, error_description: '' };
  const progress = ((currentIndex + 1) / items.length) * 100;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const updateAnswer = (field: string, value: any) => {
    integrity.recordKeystroke();
    setAnswers(prev => ({
      ...prev,
      [currentItem.id]: { ...prev[currentItem.id] || { has_error: null, error_description: '' }, [field]: value },
    }));
  };

  const handleSubmit = useCallback(() => {
    const formatted = items.map(item => ({
      item_id: item.id,
      ...(answers[item.id] || { has_error: false, error_description: '' }),
    }));
    onComplete(formatted);
  }, [items, answers, onComplete]);

  const isLastItem = currentIndex === items.length - 1;
  const isValid = currentAnswer.has_error !== null && (currentAnswer.has_error === false || currentAnswer.error_description.length >= 10);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold">Phase 3 — Détection d'erreurs</h2>
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
            <CardTitle className="text-base">Annotation existante #{currentIndex + 1}</CardTitle>
            <CardDescription>
              Un annotateur a produit cette annotation. Est-elle correcte ou contient-elle une erreur ?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Original content */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Prompt</p>
              <p className="text-sm">{(currentItem.content as any).prompt}</p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border-l-4 border-blue-500">
              <p className="text-xs font-medium text-blue-600 mb-1">Réponse du modèle</p>
              <p className="text-sm whitespace-pre-wrap">{(currentItem.content as any).response}</p>
            </div>

            {/* Existing annotation to review */}
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">📝 Annotation à vérifier</p>
              {(currentItem.content as any).existing_annotation?.dimensions && (
                <div className="flex gap-4 mb-2 text-sm">
                  {Object.entries((currentItem.content as any).existing_annotation.dimensions).map(([k, v]) => (
                    <span key={k}><strong>{k}:</strong> {v as string}/5</span>
                  ))}
                </div>
              )}
              <p className="text-sm italic">
                "{(currentItem.content as any).existing_annotation?.justification}"
              </p>
            </div>

            {/* Verdict */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Cette annotation est-elle correcte ?</p>
              <div className="flex gap-3">
                <Button
                  variant={currentAnswer.has_error === false ? "default" : "outline"}
                  onClick={() => updateAnswer('has_error', false)}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Correcte
                </Button>
                <Button
                  variant={currentAnswer.has_error === true ? "destructive" : "outline"}
                  onClick={() => updateAnswer('has_error', true)}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Contient une erreur
                </Button>
              </div>

              {currentAnswer.has_error && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Décrivez l'erreur</label>
                  <Textarea
                    value={currentAnswer.error_description}
                    onChange={e => updateAnswer('error_description', e.target.value)}
                    placeholder="Quelle est l'erreur ? Qu'aurait-il fallu faire ?"
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Navigation */}
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
                  Soumettre
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
