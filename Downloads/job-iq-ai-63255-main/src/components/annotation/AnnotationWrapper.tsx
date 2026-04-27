import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Clock, Send, SkipForward, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnnotationWrapperProps {
  taskId: string;
  taskType: string;
  domain: string;
  currentIndex?: number;
  totalTasks?: number;
  minTimeSeconds: number;
  children: (props: { timeSpent: number; onSubmit: (data: any) => void }) => ReactNode;
  onSubmitAnnotation: (data: any, timeSpent: number) => Promise<void>;
}

export function AnnotationWrapper({
  taskId,
  taskType,
  domain,
  currentIndex = 1,
  totalTasks = 1,
  minTimeSeconds,
  children,
  onSubmitAnnotation,
}: AnnotationWrapperProps) {
  const navigate = useNavigate();
  const startTime = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const draftRef = useRef<any>(null);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-save every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      if (draftRef.current) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await (supabase as any).from("annotation_drafts").upsert(
            { task_id: taskId, annotator_id: session.user.id, draft_data: draftRef.current, updated_at: new Date().toISOString() },
            { onConflict: "task_id,annotator_id" }
          );
          setLastSaved(new Date());
        } catch {}
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [taskId]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSubmit = useCallback(async (data: any) => {
    const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
    if (timeSpent < minTimeSeconds) {
      toast.error(`Temps minimum requis : ${formatTime(minTimeSeconds)}. Vous n'avez passé que ${formatTime(timeSpent)}.`);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitAnnotation(data, timeSpent);
      // Clean draft
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await (supabase as any).from("annotation_drafts").delete().eq("task_id", taskId).eq("annotator_id", session.user.id);
      }
      toast.success("Annotation soumise");
      navigate("/expert/tasks");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  }, [minTimeSeconds, onSubmitAnnotation, taskId, navigate]);

  const saveDraft = useCallback((data: any) => {
    draftRef.current = data;
  }, []);

  const progress = totalTasks > 0 ? (currentIndex / totalTasks) * 100 : 0;
  const belowMinTime = elapsed < minTimeSeconds;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{taskType.replace(/_/g, " ")}</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">{domain}</span>
            {totalTasks > 1 && (
              <span className="text-xs text-muted-foreground">{currentIndex}/{totalTasks}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Save className="w-3 h-3" /> Brouillon
              </span>
            )}
            <div className={cn(
              "flex items-center gap-1.5 text-sm font-mono",
              belowMinTime ? "text-amber-500" : "text-muted-foreground"
            )}>
              <Clock className="w-3.5 h-3.5" />
              {formatTime(elapsed)}
            </div>
          </div>
        </div>
        {totalTasks > 1 && <Progress value={progress} className="h-0.5" />}
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {children({ timeSpent: elapsed, onSubmit: handleSubmit })}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-30 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => navigate("/expert/tasks")}>
            <SkipForward className="w-4 h-4" /> Passer
          </Button>
          <div className="flex items-center gap-2">
            {belowMinTime && (
              <span className="text-[11px] text-amber-500">Min : {formatTime(minTimeSeconds)}</span>
            )}
            <Button
              onClick={() => handleSubmit(draftRef.current)}
              disabled={submitting || belowMinTime}
              className="gap-1.5"
            >
              {submitting ? "Envoi..." : "Soumettre"}
              {!submitting && <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for keyboard shortcuts
export function useAnnotationShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const key = e.key;
      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
