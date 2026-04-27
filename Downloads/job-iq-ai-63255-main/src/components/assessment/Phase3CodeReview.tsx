import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Eye, AlertTriangle, Send, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { CodeReviewChallenge, CodeReviewResult, CodeReviewAnswer, CodeProblemType } from "@/types/assessment";

interface Phase3CodeReviewProps {
  challenge: CodeReviewChallenge;
  onComplete: (result: CodeReviewResult) => void;
  onKeystroke?: () => void;
}

const PROBLEM_TYPE_LABELS: Record<CodeProblemType, string> = {
  bug: "🐛 Bug fonctionnel",
  security: "🔒 Faille de sécurité",
  performance: "⚡ Problème de performance",
  readability: "📖 Lisibilité",
  architecture: "🏗️ Architecture",
};

export function Phase3CodeReview({ challenge, onComplete, onKeystroke }: Phase3CodeReviewProps) {
  const [timeLeft, setTimeLeft] = useState(challenge.max_duration || 300);
  const [phaseStartTime] = useState(Date.now());
  const [answers, setAnswers] = useState<CodeReviewAnswer[]>([
    { problem_type: "bug", line_start: 1, line_end: 1, description: "" },
  ]);

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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const addAnswer = useCallback(() => {
    if (answers.length < 8) {
      setAnswers(prev => [
        ...prev,
        { problem_type: "bug" as CodeProblemType, line_start: 1, line_end: 1, description: "" },
      ]);
    }
  }, [answers.length]);

  const removeAnswer = useCallback((index: number) => {
    setAnswers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateAnswer = useCallback((index: number, updates: Partial<CodeReviewAnswer>) => {
    setAnswers(prev => prev.map((a, i) => i === index ? { ...a, ...updates } : a));
  }, []);

  const handleSubmit = useCallback(() => {
    const validAnswers = answers.filter(a => a.description.trim().length > 0);
    const timeTaken = Math.round((Date.now() - phaseStartTime) / 1000);

    // Simple scoring: check how many problems were identified
    const problemsFound = validAnswers.length;
    const problemsTotal = challenge.problems?.length || 5;
    const score = Math.round((Math.min(problemsFound, problemsTotal) / problemsTotal) * 100);

    onComplete({
      score,
      answers: validAnswers,
      problems_found: problemsFound,
      problems_total: problemsTotal,
      time_taken_seconds: timeTaken,
    });
  }, [answers, phaseStartTime, challenge, onComplete]);

  const codeLines = (challenge.code || "").split("\n");
  const timerColor = timeLeft <= 30 ? "text-destructive" : timeLeft <= 60 ? "text-yellow-500" : "text-foreground";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-primary" />
          <span className="font-semibold">Phase 3 — Code Review inversée</span>
          <Badge variant="outline">5 problèmes à identifier</Badge>
        </div>
        <div className={`flex items-center gap-2 font-mono text-lg ${timerColor}`}>
          <Clock className="h-5 w-5" />
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Code to review */}
        <Card className="border-2 overflow-hidden">
          <CardHeader className="py-3 border-b bg-muted/50">
            <CardTitle className="text-sm">Code à analyser ({codeLines.length} lignes)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <tbody>
                  {codeLines.map((line, i) => (
                    <tr key={i} className="hover:bg-accent/50 group">
                      <td className="text-right px-3 py-0.5 text-muted-foreground select-none w-12 border-r font-mono text-xs">
                        {i + 1}
                      </td>
                      <td className="px-4 py-0.5 font-mono text-xs whitespace-pre">
                        {line || " "}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Answers panel */}
        <Card className="border-2 overflow-hidden">
          <CardHeader className="py-3 border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Problèmes identifiés ({answers.filter(a => a.description.trim()).length}/5)
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addAnswer} disabled={answers.length >= 8}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 overflow-auto max-h-[500px] space-y-4">
            {answers.map((answer, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-3 bg-background">
                <div className="flex items-center justify-between gap-2">
                  <Select
                    value={answer.problem_type}
                    onValueChange={(v) => updateAnswer(index, { problem_type: v as CodeProblemType })}
                  >
                    <SelectTrigger className="w-48 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROBLEM_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Lignes</span>
                    <Input
                      type="number"
                      min={1}
                      max={codeLines.length}
                      value={answer.line_start}
                      onChange={(e) => updateAnswer(index, { line_start: parseInt(e.target.value) || 1 })}
                      className="w-16 h-8"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      min={answer.line_start}
                      max={codeLines.length}
                      value={answer.line_end}
                      onChange={(e) => updateAnswer(index, { line_end: parseInt(e.target.value) || 1 })}
                      className="w-16 h-8"
                    />
                  </div>

                  {answers.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeAnswer(index)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>

                <Textarea
                  placeholder="Décrivez le problème identifié et proposez une correction..."
                  value={answer.description}
                  onChange={(e) => {
                    updateAnswer(index, { description: e.target.value });
                    onKeystroke?.();
                  }}
                  rows={3}
                  className="text-sm"
                />
              </div>
            ))}

            <Button onClick={handleSubmit} className="w-full mt-4" size="lg">
              <Send className="h-4 w-4 mr-2" />
              Soumettre l'analyse
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
