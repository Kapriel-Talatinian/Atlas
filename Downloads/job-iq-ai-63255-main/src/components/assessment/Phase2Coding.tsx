import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Code, Play, CheckCircle, AlertTriangle, Send } from "lucide-react";
import Editor from "@monaco-editor/react";
import type { CodingChallenge, ChallengeResult, ChallengeStepId, ScoringCriteria } from "@/types/assessment";

interface Phase2CodingProps {
  challenge: CodingChallenge;
  onComplete: (result: ChallengeResult) => void;
  onKeystroke?: () => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  go: "go",
  php: "php",
  ruby: "ruby",
  csharp: "csharp",
  rust: "rust",
  swift: "swift",
  kotlin: "kotlin",
};

export function Phase2Coding({ challenge, onComplete, onKeystroke }: Phase2CodingProps) {
  const [code, setCode] = useState(challenge.starter_code || "");
  const [currentStep, setCurrentStep] = useState<ChallengeStepId>("A");
  const [completedSteps, setCompletedSteps] = useState<ChallengeStepId[]>([]);
  const [timeLeft, setTimeLeft] = useState(challenge.max_duration || 1800);
  const [phaseStartTime] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<"instructions" | "tests">("instructions");
  const [output, setOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);

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

  const currentStepData = challenge.steps?.find(s => s.id === currentStep);
  const stepIndex = ["A", "B", "C", "D"].indexOf(currentStep);
  const progress = ((stepIndex + 1) / 4) * 100;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setOutput("▶ Exécution en cours...\n");
    
    // Simulate test execution (in a real implementation, this would call an edge function)
    setTimeout(() => {
      const visibleTests = challenge.visible_tests || [];
      let passed = 0;
      let outputStr = "";

      for (const test of visibleTests) {
        const testPassed = Math.random() > 0.3; // Simulated
        if (testPassed) passed++;
        outputStr += `${testPassed ? "✅" : "❌"} ${test.name}\n`;
      }

      outputStr += `\n─────────────────────\n`;
      outputStr += `${passed}/${visibleTests.length} tests réussis\n`;
      setOutput(outputStr);
      setIsRunning(false);
    }, 1500);
  }, [challenge.visible_tests]);

  const handleNextStep = useCallback(() => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    const steps: ChallengeStepId[] = ["A", "B", "C", "D"];
    const nextIndex = steps.indexOf(currentStep) + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  }, [currentStep, completedSteps]);

  const handleSubmit = useCallback(() => {
    const timeTaken = Math.round((Date.now() - phaseStartTime) / 1000);
    const allSteps = [...new Set([...completedSteps, currentStep])];

    const result: ChallengeResult = {
      weighted_score: 0, // Will be computed by the backend
      step_scores: {
        A: allSteps.includes("A") ? 70 : 0,
        B: allSteps.includes("B") ? 65 : 0,
        C: allSteps.includes("C") ? 60 : 0,
        D: allSteps.includes("D") ? 55 : 0,
      },
      criteria_scores: {
        tests_pass: 0,
        code_quality: 0,
        structure: 0,
        error_handling: 0,
        naming_readability: 0,
        efficiency: 0,
        completeness: (allSteps.length / 4) * 100,
      },
      code_submitted: code,
      tests_passed: 0,
      tests_total: (challenge.visible_tests?.length || 0) + (challenge.hidden_tests?.length || 0),
      time_taken_seconds: timeTaken,
      steps_completed: allSteps,
    };

    onComplete(result);
  }, [code, completedSteps, currentStep, phaseStartTime, challenge, onComplete]);

  const timerColor = timeLeft <= 120 ? "text-destructive" : timeLeft <= 300 ? "text-yellow-500" : "text-foreground";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Code className="h-5 w-5 text-primary" />
          <span className="font-semibold">Phase 2 — Challenge pratique</span>
          <Badge variant="outline">{challenge.title}</Badge>
        </div>
        <div className={`flex items-center gap-2 font-mono text-lg ${timerColor}`}>
          <Clock className="h-5 w-5" />
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2">
        {(["A", "B", "C", "D"] as ChallengeStepId[]).map((step) => (
          <button
            key={step}
            onClick={() => setCurrentStep(step)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              step === currentStep
                ? "bg-primary text-primary-foreground"
                : completedSteps.includes(step)
                ? "bg-green-500/10 text-green-600 border border-green-500/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {completedSteps.includes(step) && <CheckCircle className="h-3.5 w-3.5" />}
            Étape {step}
          </button>
        ))}
      </div>

      <Progress value={progress} className="h-1.5" />

      {/* Main layout: editor + panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[500px]">
        {/* Monaco Editor */}
        <Card className="overflow-hidden border-2">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
              <span className="text-sm font-medium">Éditeur de code</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRun}
                  disabled={isRunning}
                >
                  <Play className="h-3.5 w-3.5 mr-1" />
                  {isRunning ? "Exécution..." : "Exécuter"}
                </Button>
                <Button size="sm" onClick={handleSubmit}>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Soumettre
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-[400px]">
              <Editor
                height="100%"
                language={LANGUAGE_MAP[challenge.stack] || "typescript"}
                value={code}
                onChange={(value) => {
                  setCode(value || "");
                  onKeystroke?.();
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  tabSize: 2,
                  padding: { top: 8 },
                }}
              />
            </div>
            {/* Output terminal */}
            {output && (
              <div className="border-t bg-zinc-900 text-zinc-100 p-3 font-mono text-sm max-h-40 overflow-auto whitespace-pre-wrap">
                {output}
              </div>
            )}
          </div>
        </Card>

        {/* Instructions / Tests panel */}
        <Card className="overflow-hidden border-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="border-b px-3 py-1">
              <TabsList className="bg-transparent h-auto p-0 gap-4">
                <TabsTrigger value="instructions" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2">
                  Instructions
                </TabsTrigger>
                <TabsTrigger value="tests" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2">
                  Tests
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="instructions" className="p-4 overflow-auto max-h-[500px] m-0">
              {currentStepData ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    Étape {currentStepData.id} — {currentStepData.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    ⏱ Temps estimé : {currentStepData.estimated_minutes || 8} min
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {currentStepData.instructions}
                  </div>
                  <Button onClick={handleNextStep} variant="outline" className="mt-4">
                    Étape suivante <CheckCircle className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{challenge.title}</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {challenge.scenario}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tests" className="p-4 overflow-auto max-h-[500px] m-0">
              <div className="space-y-3">
                <h3 className="font-semibold">Tests visibles</h3>
                {(challenge.visible_tests || []).map((test: any, i: number) => (
                  <div key={test.id || i} className="border rounded-lg p-3 text-sm space-y-1">
                    <div className="font-medium">{test.name}</div>
                    {test.input && (
                      <div className="text-muted-foreground">
                        <span className="font-medium">Input:</span> <code className="bg-muted px-1 rounded">{test.input}</code>
                      </div>
                    )}
                    {test.expected_output && (
                      <div className="text-muted-foreground">
                        <span className="font-medium">Expected:</span> <code className="bg-muted px-1 rounded">{test.expected_output}</code>
                      </div>
                    )}
                  </div>
                ))}
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Des tests supplémentaires cachés seront exécutés lors de la soumission finale.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
