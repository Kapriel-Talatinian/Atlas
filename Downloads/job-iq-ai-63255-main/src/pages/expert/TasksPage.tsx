import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { useUserDisplayName } from "@/hooks/useUserDisplayName";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Clock, CheckCircle, ArrowRight, Shield, BarChart3, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const taskTypeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  red_teaming: { label: "Red-teaming", icon: Shield },
  preference_dpo: { label: "Préférences DPO", icon: BarChart3 },
  scoring: { label: "Scoring", icon: ClipboardList },
  fact_checking: { label: "Fact-checking", icon: Search },
};

export default function TasksPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const { data: displayName } = useUserDisplayName("expert");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["expert-tasks", tab],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      // Resolve the expert profile (one task may have N assignments — we
      // filter by expert_id, not annotator_id, since task_assignments uses it).
      const { data: expert } = await supabase
        .from("expert_profiles")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!expert) return [];

      const assignmentStatuses = tab === "pending" ? ["assigned"] : ["completed"];

      const { data: assignments } = await supabase
        .from("task_assignments")
        .select("task_id, status, completed_at, assigned_at, timeout_at")
        .eq("expert_id", expert.id)
        .in("status", assignmentStatuses)
        .order("assigned_at", { ascending: false })
        .limit(50);
      if (!assignments?.length) return [];

      const taskIds = assignments.map(a => a.task_id);
      const { data: rawTasks } = await supabase
        .from("annotation_tasks")
        .select("id, domain, source_type, complexity_level, status, created_at, deadline, task_content")
        .in("id", taskIds)
        .order("created_at", { ascending: false });
      return rawTasks || [];
    },
    staleTime: 15_000,
  });

  return (
    <ExpertDashboardLayout userName={displayName || undefined}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground">Tâches d'annotation</h1>
            <p className="text-muted-foreground text-sm mt-1">Annotez des réponses IA dans votre domaine d'expertise</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 border border-border rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("pending")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="w-4 h-4" />
            En attente
          </button>
          <button
            onClick={() => setTab("completed")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === "completed" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckCircle className="w-4 h-4" />
            Complétées
          </button>
        </div>

        {/* Task list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : tasks?.length === 0 ? (
          <div className="rounded-xl border border-border p-12 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {tab === "pending" ? "Aucune tâche en attente" : "Aucune tâche complétée"}
            </p>
            {tab === "pending" && (
              <p className="text-sm text-muted-foreground mt-1">De nouvelles tâches seront assignées bientôt.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks?.map((task: any, i: number) => {
              const type = task.source_type || "scoring";
              const config = taskTypeConfig[type] || taskTypeConfig.scoring;
              const Icon = config.icon;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                >
                  <Card
                    className={cn(
                      "transition-colors cursor-pointer",
                      tab === "pending" && "hover:border-primary/30"
                    )}
                    onClick={() => tab === "pending" && navigate(`/expert/annotate/${task.id}`)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{config.label}</span>
                          <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{task.domain}</span>
                          <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{task.complexity_level}</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          {new Date(task.created_at).toLocaleDateString("fr-FR")}
                          {task.deadline && (
                            <span className="text-destructive ml-2">
                              Deadline: {new Date(task.deadline).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </p>
                      </div>
                      {tab === "pending" && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                      {tab === "completed" && <CheckCircle className="w-4 h-4 text-success shrink-0" />}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </ExpertDashboardLayout>
  );
}
