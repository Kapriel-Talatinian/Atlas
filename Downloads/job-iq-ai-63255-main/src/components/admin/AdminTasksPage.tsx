import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["all", "queued", "pending", "assigned", "in_progress", "completed", "flagged"] as const;
type ViewMode = "items" | "tasks";

export function AdminTasksPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("items");

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ["admin-items-list", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("annotation_items")
        .select("id, project_id, status, complexity_level, created_at, completed_at, is_gold_standard, is_calibration, batch_id")
        .order("created_at", { ascending: false })
        .limit(500);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: viewMode === "items",
    staleTime: 15_000,
  });

  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["admin-tasks-list", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("annotation_tasks")
        .select("id, domain, source_type, complexity_level, status, created_at, completed_at, assigned_annotator_id, source_id")
        .order("created_at", { ascending: false })
        .limit(500);

      if (statusFilter !== "all" && statusFilter !== "flagged") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: viewMode === "tasks",
    staleTime: 15_000,
  });

  if (selectedTask) {
    return <TaskDetailView taskId={selectedTask} onBack={() => setSelectedTask(null)} />;
  }

  const isLoading = viewMode === "items" ? loadingItems : loadingTasks;
  const currentData = viewMode === "items" ? items : tasks;

  const filtered = currentData?.filter((t: any) =>
    !search || t.id.includes(search) || (t.domain && t.domain.includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Tâches</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} {viewMode === "items" ? "item" : "tâche"}{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* View mode toggle */}
        <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
          {(["items", "tasks"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setViewMode(m); setStatusFilter("all"); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                viewMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "items" ? "Items (uploadés)" : "Tâches (distribuées)"}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher par ID ou domaine" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "all" ? "Tous" : s === "flagged" ? "Flaggés" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">Aucune tâche trouvée</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">ID</TableHead>
                  {viewMode === "items" ? (
                    <>
                      <TableHead className="text-[12px] uppercase tracking-wider">Projet</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wider">Complexité</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wider">Gold / Calib</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-[12px] uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wider">Domaine</TableHead>
                      <TableHead className="text-[12px] uppercase tracking-wider">Complexité</TableHead>
                    </>
                  )}
                  <TableHead className="text-[12px] uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t: any) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => viewMode === "tasks" && setSelectedTask(t.id)}>
                    <TableCell className="text-[13px] font-mono">{t.id.slice(0, 8)}</TableCell>
                    {viewMode === "items" ? (
                      <>
                        <TableCell className="text-[13px] font-mono">{t.project_id?.slice(0, 8) || "—"}</TableCell>
                        <TableCell className="text-sm">{t.complexity_level}</TableCell>
                        <TableCell className="text-[11px]">
                          {t.is_gold_standard && <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 mr-1">Gold</span>}
                          {t.is_calibration && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">Calib</span>}
                          {!t.is_gold_standard && !t.is_calibration && "—"}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell><span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{t.source_type}</span></TableCell>
                        <TableCell><span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{t.domain}</span></TableCell>
                        <TableCell className="text-sm">{t.complexity_level}</TableCell>
                      </>
                    )}
                    <TableCell>
                      <span className={cn(
                        "text-[11px] px-1.5 py-0.5 rounded",
                        t.status === "completed" ? "bg-success/10 text-success" :
                        t.status === "queued" ? "bg-muted text-muted-foreground" :
                        t.status === "pending" ? "bg-muted" :
                        "bg-primary/10 text-primary"
                      )}>{t.status}</span>
                    </TableCell>
                    <TableCell className="text-[13px] font-mono text-muted-foreground">{new Date(t.created_at!).toLocaleDateString("fr-FR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskDetailView({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-task-detail", taskId],
    queryFn: async () => {
      const { data: task } = await supabase.from("annotation_tasks").select("*").eq("id", taskId).single();
      const { data: feedback } = await supabase.from("rlhf_feedback").select("*").eq("annotator_id", task?.assigned_annotator_id || "").limit(5);
      return { task, feedback: feedback || [] };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 rounded-xl" /></div>;
  if (!data?.task) return null;

  const content = data.task.task_content as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-foreground">Tâche {data.task.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">{data.task.source_type} · {data.task.domain} · {data.task.status}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Prompt</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content?.prompt || "N/A"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Réponse</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content?.response || content?.response_a || "N/A"}</p>
          </CardContent>
        </Card>
      </div>

      {data.feedback.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Annotations</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">Rating</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Temps</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.feedback.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="text-sm font-mono">{f.overall_rating}</TableCell>
                    <TableCell className="text-sm">{f.task_type}</TableCell>
                    <TableCell className="text-sm font-mono">{f.time_spent_seconds}s</TableCell>
                    <TableCell className="text-[13px] font-mono text-muted-foreground">{new Date(f.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
