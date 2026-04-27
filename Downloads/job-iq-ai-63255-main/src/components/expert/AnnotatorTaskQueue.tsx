import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  Clock, 
  Play,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ArrowRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface AnnotationTask {
  id: string;
  source_type: string;
  complexity_level: string;
  domain: string;
  language: string;
  status: string;
  deadline: string;
  assigned_at: string;
  task_content: {
    submission_id?: string;
    test_id?: string;
    expert_context?: {
      title?: string;
      experience?: number;
      skills?: string[];
    };
  };
}

interface AnnotatorTaskQueueProps {
  annotatorId: string;
  expertId: string;
}

const COMPLEXITY_COLORS = {
  junior: 'bg-green-500',
  mid: 'bg-blue-500',
  senior: 'bg-purple-500',
  lead: 'bg-orange-500',
};

const STATUS_LABELS = {
  assigned: { label: 'Assignée', color: 'bg-blue-500' },
  in_progress: { label: 'En cours', color: 'bg-yellow-500' },
  completed: { label: 'Terminée', color: 'bg-green-500' },
  expired: { label: 'Expirée', color: 'bg-red-500' },
};

export function AnnotatorTaskQueue({ annotatorId, expertId }: AnnotatorTaskQueueProps) {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<AnnotationTask[]>([]);
  const [startingTask, setStartingTask] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, [annotatorId]);

  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from('annotation_tasks')
        .select('*')
        .eq('assigned_annotator_id', annotatorId)
        .in('status', ['assigned', 'in_progress'])
        .order('deadline', { ascending: true });

      if (error) throw error;
      setTasks((data || []) as AnnotationTask[]);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  }

  async function startTask(taskId: string) {
    setStartingTask(taskId);
    try {
      const { error } = await supabase
        .from('annotation_tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId);

      if (error) throw error;

      // Navigate to annotation interface
      toast.success('Tâche démarrée');
      // TODO: Navigate to RLHFFeedbackForm with task context
      window.location.href = `/expert/annotate/${taskId}`;
    } catch (error) {
      console.error('Failed to start task:', error);
      toast.error('Erreur lors du démarrage');
    } finally {
      setStartingTask(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Chargement des tâches...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium">Aucune tâche en attente</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Les nouvelles tâches vous seront assignées automatiquement
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const deadlineDate = new Date(task.deadline);
        const isUrgent = deadlineDate.getTime() - Date.now() < 6 * 60 * 60 * 1000; // <6h
        const statusConfig = STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] || STATUS_LABELS.assigned;
        const complexityColor = COMPLEXITY_COLORS[task.complexity_level as keyof typeof COMPLEXITY_COLORS] || 'bg-gray-500';

        return (
          <Card 
            key={task.id} 
            className={`${isUrgent ? 'border-warning' : ''} hover:border-primary/50 transition-colors`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    {task.task_content?.expert_context?.title || 'Annotation de test'}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Badge className={complexityColor + ' text-white'}>
                    {task.complexity_level}
                  </Badge>
                  <Badge variant="outline" className={statusConfig.color + ' text-white'}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
              <CardDescription className="flex items-center gap-4 mt-1">
                <span>{task.domain}</span>
                <span>•</span>
                <span>{task.language.toUpperCase()}</span>
                {task.task_content?.expert_context?.experience && (
                  <>
                    <span>•</span>
                    <span>{task.task_content.expert_context.experience} ans exp.</span>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 text-sm ${isUrgent ? 'text-warning' : 'text-muted-foreground'}`}>
                  {isUrgent && <AlertCircle className="h-4 w-4" />}
                  <Clock className="h-4 w-4" />
                  <span>
                    Deadline: {formatDistanceToNow(deadlineDate, { addSuffix: true, locale: fr })}
                  </span>
                </div>
                <Button
                  onClick={() => startTask(task.id)}
                  disabled={startingTask === task.id}
                  size="sm"
                >
                  {startingTask === task.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : task.status === 'in_progress' ? (
                    <>
                      Continuer
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Commencer
                    </>
                  )}
                </Button>
              </div>

              {/* Skills preview */}
              {task.task_content?.expert_context?.skills && (
                <div className="flex gap-1 mt-3 flex-wrap">
                  {task.task_content.expert_context.skills.slice(0, 5).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
