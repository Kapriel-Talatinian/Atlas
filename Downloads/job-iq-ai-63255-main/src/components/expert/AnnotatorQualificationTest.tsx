import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  ThumbsUp, 
  ThumbsDown, 
  Minus,
  CheckCircle2,
  XCircle,
  Trophy,
  AlertCircle
} from "lucide-react";

interface GoldTask {
  id: string;
  task_type: string;
  job_role: string;
  job_level: string;
  ai_output: Record<string, unknown>;
}

interface TaskResponse {
  taskId: string;
  rating: "up" | "down" | "neutral";
  issues: string[];
}

// Résultat simplifié: pass/fail uniquement
interface QualificationResult {
  success: boolean;
  qualified: boolean;
  score: number;
  taskResults: any[];
}

interface AnnotatorQualificationTestProps {
  expertId: string;
  onComplete: (result: QualificationResult) => void;
}

const ISSUES_LIST = [
  { id: "too_theoretical", label: "Trop théorique" },
  { id: "too_practical", label: "Trop pratique" },
  { id: "not_job_representative", label: "Ne représente pas le poste" },
  { id: "too_easy", label: "Trop facile" },
  { id: "too_hard", label: "Trop difficile" },
  { id: "unclear_questions", label: "Questions pas claires" },
  { id: "biased_content", label: "Contenu biaisé" },
  { id: "missing_explanation", label: "Pas d'explication" },
  { id: "uncommented_code", label: "Code sans commentaires" },
];

export function AnnotatorQualificationTest({ expertId, onComplete }: AnnotatorQualificationTestProps) {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<GoldTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [responses, setResponses] = useState<TaskResponse[]>([]);
  const [currentRating, setCurrentRating] = useState<"up" | "down" | "neutral" | null>(null);
  const [currentIssues, setCurrentIssues] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QualificationResult | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    loadQualificationTest();
  }, [expertId]);

  async function loadQualificationTest() {
    try {
      const { data, error } = await supabase.functions.invoke('qualify-annotator', {
        body: { action: 'get_qualification_test', expertId },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return;
      }

      setTasks(data.tasks || []);
    } catch (err: any) {
      console.error('Failed to load qualification test:', err);
      toast.error('Erreur lors du chargement du test');
    } finally {
      setLoading(false);
    }
  }

  function handleNextTask() {
    if (!currentRating) {
      toast.error("Veuillez donner un avis");
      return;
    }

    const currentTask = tasks[currentTaskIndex];
    const newResponse: TaskResponse = {
      taskId: currentTask.id,
      rating: currentRating,
      issues: currentIssues,
    };

    const newResponses = [...responses, newResponse];
    setResponses(newResponses);

    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
      setCurrentRating(null);
      setCurrentIssues([]);
      startTimeRef.current = Date.now();
    } else {
      submitQualification(newResponses);
    }
  }

  async function submitQualification(allResponses: TaskResponse[]) {
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('qualify-annotator', {
        body: { 
          action: 'submit_qualification', 
          expertId,
          qualificationResponses: allResponses,
        },
      });

      if (error) throw error;

      setResult(data as QualificationResult);
      onComplete(data);

      if (data.qualified) {
        toast.success('Félicitations ! Vous êtes qualifié comme annotateur');
      } else {
        toast.info("Vous pouvez retenter dans 30 jours");
      }
    } catch (err: any) {
      console.error('Qualification submission failed:', err);
      toast.error('Erreur lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleIssue(issueId: string) {
    setCurrentIssues(prev => 
      prev.includes(issueId) 
        ? prev.filter(i => i !== issueId)
        : [...prev, issueId]
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Chargement du test de qualification...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Résultat simplifié: pass/fail
  if (result) {
    return (
      <Card className={result.qualified ? "border-success/50" : "border-destructive/50"}>
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">{result.qualified ? '✅' : '❌'}</div>
          <CardTitle className="flex items-center justify-center gap-2">
            {result.qualified ? (
              <CheckCircle2 className="h-6 w-6 text-success" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            {result.qualified ? 'Qualification réussie !' : 'Non qualifié'}
          </CardTitle>
          <CardDescription>
            Score: {(result.score * 100).toFixed(0)}% (minimum: 70%)
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {result.qualified ? (
            <>
              <Badge className="bg-primary text-primary-foreground text-lg px-4 py-2">
                Annotateur Qualifié
              </Badge>
              <p className="text-muted-foreground">
                Vous pouvez maintenant recevoir des tâches d'annotation.
                Le paiement sera effectué manuellement après la vente des datasets.
              </p>
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Score minimum requis: 70%. Vous pouvez retenter dans 30 jours.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="border-warning/50">
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Pas assez de tâches de calibration disponibles. Veuillez réessayer plus tard.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const currentTask = tasks[currentTaskIndex];
  const progress = ((currentTaskIndex) / tasks.length) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Test de Qualification
            </CardTitle>
            <CardDescription>
              Évaluez {tasks.length} sorties IA pour démontrer vos capacités d'annotation
            </CardDescription>
          </div>
          <Badge variant="outline">
            {currentTaskIndex + 1}/{tasks.length}
          </Badge>
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Task context */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">{currentTask.job_role}</Badge>
            <Badge variant="outline">{currentTask.job_level}</Badge>
            <Badge variant="outline">{currentTask.task_type}</Badge>
          </div>
        </div>

        {/* AI Output preview */}
        <div className="p-4 bg-card border rounded-lg max-h-64 overflow-y-auto">
          <h4 className="font-medium mb-2">Sortie IA à évaluer</h4>
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
            {JSON.stringify(currentTask.ai_output, null, 2).slice(0, 500)}...
          </pre>
        </div>

        {/* Rating */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Votre évaluation globale</Label>
          <div className="flex gap-3">
            {[
              { value: "up" as const, icon: ThumbsUp, label: "Positif", color: "border-success text-success" },
              { value: "neutral" as const, icon: Minus, label: "Neutre", color: "border-warning text-warning" },
              { value: "down" as const, icon: ThumbsDown, label: "Négatif", color: "border-destructive text-destructive" },
            ].map(({ value, icon: Icon, label, color }) => (
              <Button
                key={value}
                variant="outline"
                className={`flex-1 h-16 flex-col gap-1 ${
                  currentRating === value ? color + " bg-muted" : ""
                }`}
                onClick={() => setCurrentRating(value)}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Issues */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Problèmes détectés (optionnel)</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ISSUES_LIST.map((issue) => (
              <div
                key={issue.id}
                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  currentIssues.includes(issue.id)
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:border-muted-foreground"
                }`}
                onClick={() => toggleIssue(issue.id)}
              >
                <Checkbox 
                  checked={currentIssues.includes(issue.id)}
                  className="pointer-events-none"
                />
                <span className="text-sm">{issue.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button 
          className="w-full" 
          onClick={handleNextTask}
          disabled={!currentRating || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Envoi...
            </>
          ) : currentTaskIndex < tasks.length - 1 ? (
            <>
              Tâche suivante ({currentTaskIndex + 2}/{tasks.length})
            </>
          ) : (
            "Terminer le test"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
