import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, TrendingDown, Clock, Users, Target, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  project: any;
}

export const ProjectPerformanceTab = ({ projectId, project }: Props) => {
  const [downloading, setDownloading] = useState(false);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["project-performance", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-performance-report", {
        body: { project_id: projectId, client_id: project.client_id },
      });
      if (error) throw error;
      return data?.metrics || null;
    },
    enabled: !!project?.client_id,
    staleTime: 60_000,
  });

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      toast.info("Génération du rapport PDF en cours...");
      // For now, generate a JSON report download
      const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `rapport_performance_${project.name}_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      toast.success("Rapport téléchargé");
    } catch {
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Pas encore de données de performance</p>
          <p className="text-sm">Les métriques apparaîtront après la première tâche validée</p>
        </CardContent>
      </Card>
    );
  }

  const completionPercent = metrics.tasks_total > 0
    ? Math.round((metrics.tasks_completed / metrics.tasks_total) * 100)
    : 0;

  const slaAlpha = project.sla_tier === "express" ? 0.85 : project.sla_tier === "priority" ? 0.80 : 0.75;

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m} min ${s.toString().padStart(2, "0")} s`;
  };

  // Dimension alphas for bar chart
  const dimData = Object.entries(metrics.dimension_alphas || {})
    .map(([dim, alpha]) => ({
      dimension: dim.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      alpha: alpha as number,
      fill: (alpha as number) >= 0.80 ? "hsl(var(--success))" : (alpha as number) >= 0.67 ? "hsl(var(--warning, 38 92% 50%))" : "hsl(var(--destructive))",
    }))
    .sort((a, b) => b.alpha - a.alpha);

  // QA pie data
  const qaData = [
    { name: "Consensus direct", value: metrics.qa_decisions?.auto_validated || 0, color: "hsl(var(--success))" },
    { name: "Adjudication LLM", value: metrics.qa_decisions?.adjudicated || 0, color: "hsl(var(--primary))" },
    { name: "Review humain", value: metrics.qa_decisions?.flagged || 0, color: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  // Timeline data
  const timelineData = (metrics.alpha_timeline || []).map((b: any) => ({
    name: `Batch ${b.batch}`,
    alpha: b.alpha,
    count: b.count,
  }));

  // LLM costs
  const llmCosts: Record<string, { calls: number; tokens: number; cost: number }> = metrics.llm_costs || {};
  const totalLLMCost = Object.values(llmCosts).reduce((s, v) => s + (v?.cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header + Download */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Performance du projet</h3>
        <Button variant="ghost" size="sm" className="gap-2" onClick={handleDownloadPDF} disabled={downloading}>
          <Download className="w-4 h-4" />
          Télécharger le rapport
        </Button>
      </div>

      {/* Section 1 — KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold font-mono">
              {metrics.tasks_completed} / {metrics.tasks_total}
            </p>
            <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", completionPercent >= 80 ? "bg-success" : completionPercent >= 50 ? "bg-amber-500" : "bg-muted-foreground")}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tâches validées</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold font-mono">
              {metrics.global_alpha?.toFixed(2) || "—"}
            </p>
            <Badge variant={metrics.global_alpha >= slaAlpha ? "default" : "secondary"} className="mt-1 text-[10px]">
              {metrics.global_alpha >= slaAlpha ? "✓ SLA respecté" : "⚠ Sous le seuil"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Alpha moyen</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold font-mono">{metrics.consensus_rate}%</p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              des tâches validées par consensus
            </p>
            <p className="text-xs text-muted-foreground">Taux de consensus</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold font-mono">
              {metrics.avg_annotation_time_seconds > 0 ? formatTime(metrics.avg_annotation_time_seconds) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Temps moyen</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 2 — Alpha par dimension */}
      {dimData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Alpha par dimension</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={dimData.length * 40 + 20}>
              <BarChart data={dimData} layout="vertical" margin={{ left: 120, right: 40 }}>
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="dimension" tick={{ fontSize: 11 }} width={110} />
                <ReferenceLine x={0.80} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "0.80", position: "top", fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(4)} />
                <Bar dataKey="alpha" radius={[0, 4, 4, 0]} barSize={16}>
                  {dimData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Section 3 — Alpha timeline */}
      {timelineData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Évolution de l'alpha</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timelineData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0.5, 1]} tick={{ fontSize: 11 }} />
                <ReferenceLine y={0.80} stroke="hsl(var(--success))" strokeDasharray="4 4" />
                <ReferenceLine y={0.67} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                <Tooltip formatter={(v: number) => v.toFixed(4)} />
                <Line type="monotone" dataKey="alpha" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Section 4 — QA Decisions Pie */}
      {qaData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Répartition des décisions QA</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={qaData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {qaData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {qaData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span>{d.name}</span>
                  <span className="font-mono text-muted-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 6 — Annotateurs anonymisés */}
      {(metrics.annotator_stats?.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Annotateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2">Annotateur</th>
                    <th className="text-right py-2">Tâches</th>
                    <th className="text-right py-2">Alpha moyen</th>
                    <th className="text-right py-2">Temps moyen</th>
                    <th className="text-right py-2">Consensus</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.annotator_stats.map((s: any, i: number) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", s.avg_alpha >= 0.80 ? "bg-success" : "bg-amber-500")} />
                        {s.expert_alias}
                      </td>
                      <td className="text-right font-mono">{s.tasks_completed}</td>
                      <td className="text-right font-mono">{s.avg_alpha?.toFixed(2)}</td>
                      <td className="text-right font-mono">{s.avg_time_seconds > 0 ? formatTime(s.avg_time_seconds) : "—"}</td>
                      <td className="text-right font-mono">{s.consensus_rate?.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 7 — Tâches problématiques */}
      {(metrics.problematic_tasks?.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tâches problématiques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2">Tâche</th>
                    <th className="text-right py-2">Alpha</th>
                    <th className="text-center py-2">Décision</th>
                    <th className="text-left py-2">Dimensions</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.problematic_tasks.slice(0, 20).map((t: any, i: number) => {
                    const lowDims = Object.entries(t.dimension_alphas || {})
                      .filter(([, val]: any) => {
                        const v = typeof val === "object" ? val?.alpha : val;
                        return typeof v === "number" && v < 0.80;
                      })
                      .map(([dim, val]: any) => `${dim} (${(typeof val === "object" ? val?.alpha : val)?.toFixed(2)})`);

                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">#{t.task_id?.slice(0, 8)}</td>
                        <td className="text-right font-mono text-destructive">{t.alpha?.toFixed(2)}</td>
                        <td className="text-center">
                          <Badge variant={t.decision === "flagged" ? "destructive" : "secondary"} className="text-[10px]">
                            {t.decision === "flagged" ? "Review humain" : "Adjudication"}
                          </Badge>
                        </td>
                        <td className="text-xs text-muted-foreground">{lowDims.join(", ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 8 — Coûts LLM */}
      {Object.keys(llmCosts).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Coûts IA du projet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2">Composant</th>
                    <th className="text-right py-2">Appels</th>
                    <th className="text-right py-2">Tokens</th>
                    <th className="text-right py-2">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(llmCosts).map(([purpose, data]) => {
                    const d = data as { calls: number; tokens: number; cost: number };
                    return (
                      <tr key={purpose} className="border-b border-border/50">
                        <td className="py-2 capitalize">{purpose.replace(/_/g, " ")}</td>
                        <td className="text-right font-mono">{d.calls}</td>
                        <td className="text-right font-mono">{(d.tokens / 1000).toFixed(1)}K</td>
                        <td className="text-right font-mono">{d.cost.toFixed(2)} USD</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="py-2">Total</td>
                    <td className="text-right font-mono">{Object.values(llmCosts).reduce((s, v) => s + v.calls, 0)}</td>
                    <td className="text-right font-mono">{(Object.values(llmCosts).reduce((s, v) => s + v.tokens, 0) / 1000).toFixed(1)}K</td>
                    <td className="text-right font-mono">{totalLLMCost.toFixed(2)} USD</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Inclus dans le prix du projet, non facturé séparément.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
