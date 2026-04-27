import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, CheckCircle, XCircle, ChevronRight, Brain, Zap } from "lucide-react";
import type { QuizQuestion, QuizDomain, QuizResult } from "@/types/assessment";

interface Phase1QuizProps {
  questions: QuizQuestion[];
  onComplete: (result: QuizResult) => void;
  onKeystroke?: () => void;
}

// CAT (Computerized Adaptive Testing) algorithm
function getNextDifficulty(
  currentDifficulty: number,
  wasCorrect: boolean
): number {
  if (wasCorrect) {
    return Math.min(5, currentDifficulty + 1);
  } else {
    return Math.max(1, currentDifficulty - 1);
  }
}

export function Phase1Quiz({ questions, onComplete, onKeystroke }: Phase1QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentDifficulty, setCurrentDifficulty] = useState(3);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totalTimeUsed, setTotalTimeUsed] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [answers, setAnswers] = useState<QuizResult["answers"]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [phaseStartTime] = useState(Date.now());

  // Sort questions by difficulty to enable adaptive selection
  const questionPool = useMemo(() => {
    const pool: Record<number, QuizQuestion[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const q of questions) {
      pool[q.difficulty]?.push(q);
    }
    // Shuffle each pool
    for (const key of Object.keys(pool)) {
      pool[Number(key)] = pool[Number(key)].sort(() => Math.random() - 0.5);
    }
    return pool;
  }, [questions]);

  // Select adaptive questions
  const [selectedQuestions, setSelectedQuestions] = useState<QuizQuestion[]>([]);
  const usedIds = useMemo(() => new Set(selectedQuestions.map(q => q.id)), [selectedQuestions]);

  useEffect(() => {
    // Pick first question at difficulty 3
    const firstQ = questionPool[3]?.[0] || questions[0];
    if (firstQ) setSelectedQuestions([firstQ]);
  }, [questionPool, questions]);

  const currentQuestion = selectedQuestions[currentIndex];
  const totalQuestions = Math.min(20, questions.length);
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  // Timer per question
  useEffect(() => {
    if (!currentQuestion || isTransitioning) return;
    setTimeLeft(currentQuestion.timeLimit || 30);
    setQuestionStartTime(Date.now());

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-submit with no answer
          handleAnswer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, currentQuestion, isTransitioning]);

  const handleAnswer = useCallback((answer: string | null) => {
    if (!currentQuestion || isTransitioning) return;
    setIsTransitioning(true);

    const timeSpent = Date.now() - questionStartTime;
    const isCorrect = answer === currentQuestion.correctAnswer;
    const newDifficulty = getNextDifficulty(currentDifficulty, isCorrect);

    const newAnswer = {
      question_id: currentQuestion.id,
      selected: answer || "",
      correct: isCorrect,
      difficulty: currentQuestion.difficulty,
      time_spent_ms: timeSpent,
    };

    setAnswers(prev => [...prev, newAnswer]);
    setTotalTimeUsed(prev => prev + timeSpent);
    setCurrentDifficulty(newDifficulty);
    setSelectedAnswer(answer);

    // Transition delay to show correct/incorrect
    setTimeout(() => {
      if (currentIndex + 1 >= totalQuestions) {
        // Complete phase
        const allAnswers = [...answers, newAnswer];
        const domainScores = computeDomainScores(allAnswers, selectedQuestions.concat(currentQuestion ? [currentQuestion] : []));
        const rawScore = (allAnswers.filter(a => a.correct).length / allAnswers.length) * 100;

        // Calibrated score accounts for difficulty level reached
        const avgDifficultyReached = allAnswers.reduce((s, a) => s + a.difficulty, 0) / allAnswers.length;
        const calibratedScore = Math.min(100, rawScore * (0.7 + avgDifficultyReached * 0.06));

        onComplete({
          total_questions: allAnswers.length,
          correct_answers: allAnswers.filter(a => a.correct).length,
          raw_score: Math.round(rawScore),
          calibrated_score: Math.round(calibratedScore),
          max_difficulty_reached: Math.max(...allAnswers.map(a => a.difficulty)),
          domain_scores: domainScores,
          time_taken_seconds: Math.round((Date.now() - phaseStartTime) / 1000),
          answers: allAnswers,
        });
        return;
      }

      // Pick next question at the new difficulty
      const nextQ = pickNextQuestion(questionPool, newDifficulty, usedIds);
      if (nextQ) {
        setSelectedQuestions(prev => [...prev, nextQ]);
      }
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsTransitioning(false);
    }, 800);
  }, [currentQuestion, currentIndex, isTransitioning, answers, currentDifficulty, questionPool, totalQuestions, usedIds, phaseStartTime, onComplete, questionStartTime, selectedQuestions]);

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-3 text-muted-foreground">Chargement des questions...</span>
      </div>
    );
  }

  const timerColor = timeLeft <= 5 ? "text-destructive" : timeLeft <= 10 ? "text-yellow-500" : "text-foreground";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold">Phase 1 — Diagnostic rapide</span>
          <Badge variant="outline">
            Q{currentIndex + 1}/{totalQuestions}
          </Badge>
          <Badge variant={currentDifficulty >= 4 ? "destructive" : currentDifficulty >= 3 ? "default" : "secondary"}>
            Niveau {currentDifficulty}/5
          </Badge>
        </div>
        <div className={`flex items-center gap-2 font-mono text-lg ${timerColor}`}>
          <Clock className="h-5 w-5" />
          {timeLeft}s
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      {/* Question Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Zap className="h-4 w-4" />
            {getDomainLabel(currentQuestion.domain)}
          </div>
          <CardTitle className="text-lg whitespace-pre-wrap">
            {currentQuestion.question}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedAnswer === option.key;
            const isCorrect = isTransitioning && option.key === currentQuestion.correctAnswer;
            const isWrong = isTransitioning && isSelected && !isCorrect;

            return (
              <button
                key={option.key}
                onClick={() => {
                  if (!isTransitioning) {
                    onKeystroke?.();
                    handleAnswer(option.key);
                  }
                }}
                disabled={isTransitioning}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isCorrect
                    ? "border-green-500 bg-green-500/10"
                    : isWrong
                    ? "border-destructive bg-destructive/10"
                    : isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                } disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 font-semibold text-sm shrink-0">
                    {option.key}
                  </span>
                  <span className="whitespace-pre-wrap">{option.text}</span>
                  {isCorrect && <CheckCircle className="h-5 w-5 text-green-500 ml-auto shrink-0" />}
                  {isWrong && <XCircle className="h-5 w-5 text-destructive ml-auto shrink-0" />}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Score bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Correct: {answers.filter(a => a.correct).length}/{answers.length}
        </span>
        <span>•</span>
        <span>Difficulté max atteinte: {Math.max(3, ...answers.map(a => a.difficulty))}</span>
      </div>
    </div>
  );
}

function getDomainLabel(domain: QuizDomain): string {
  const labels: Record<QuizDomain, string> = {
    fundamentals: "Fondamentaux",
    algorithms: "Algorithmique",
    architecture: "Architecture",
    ecosystem: "Écosystème & Tooling",
    best_practices: "Bonnes pratiques",
  };
  return labels[domain] || domain;
}

function pickNextQuestion(
  pool: Record<number, QuizQuestion[]>,
  targetDifficulty: number,
  usedIds: Set<string>
): QuizQuestion | null {
  // Try exact difficulty first, then adjacent
  for (const diff of [targetDifficulty, targetDifficulty - 1, targetDifficulty + 1, targetDifficulty - 2, targetDifficulty + 2]) {
    if (diff < 1 || diff > 5) continue;
    const available = pool[diff]?.filter(q => !usedIds.has(q.id));
    if (available && available.length > 0) {
      return available[0];
    }
  }
  return null;
}

function computeDomainScores(
  answers: QuizResult["answers"],
  questions: QuizQuestion[]
): Record<QuizDomain, number> {
  const qMap = new Map(questions.map(q => [q.id, q]));
  const domainResults: Record<string, { correct: number; total: number }> = {
    fundamentals: { correct: 0, total: 0 },
    algorithms: { correct: 0, total: 0 },
    architecture: { correct: 0, total: 0 },
    ecosystem: { correct: 0, total: 0 },
    best_practices: { correct: 0, total: 0 },
  };

  for (const answer of answers) {
    const q = qMap.get(answer.question_id);
    if (q) {
      domainResults[q.domain].total++;
      if (answer.correct) domainResults[q.domain].correct++;
    }
  }

  const scores: Record<string, number> = {};
  for (const [domain, result] of Object.entries(domainResults)) {
    scores[domain] = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 50;
  }
  return scores as Record<QuizDomain, number>;
}
