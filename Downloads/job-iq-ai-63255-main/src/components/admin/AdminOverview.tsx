import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface AdminOverviewProps {
  onNavigate: (section: string) => void;
}

const TASK_TYPE_COLORS: Record<string, string> = {
  red_teaming: "hsl(var(--destructive))",
  preference_dpo: "hsl(var(--primary))",
  scoring: "hsl(var(--success))",
  fact_checking: "hsl(248, 60%, 55%)",
};

const DOMAIN_COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(38, 92%, 50%)", "hsl(217, 91%, 60%)"];

export function AdminOverview({ onNavigate }: AdminOverviewProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-overview-v2", period],
    queryFn: async () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - period * 24 * 60 * 60 * 1000).toISOString();
      const prevPeriodStart = new Date(now.getTime() - period * 2 * 24 * 60 * 60 * 1000).toISOString();

      const [
        invoicesThisMonth, invoicesPrevMonth,
        tasksCompleted, tasksPrevCompleted,
        expertsActive, clientsActive,
        alphaReports, pendingQa,
        allTasks, recentActivity,
        tasksByDomain,
      ] = await Promise.all([
        supabase.from("invoices").select("invoice_amount_ttc").gte("created_at", periodStart),
        supabase.from("invoices").select("invoice_amount_ttc").gte("created_at", prevPeriodStart).lt("created_at", periodStart),
        supabase.from("annotation_tasks").select("*", { count: "exact", head: true }).in("status", ["completed", "auto_annotated"]).or(`completed_at.gte.${periodStart},and(completed_at.is.null,created_at.gte.${periodStart})`),
        supabase.from("annotation_tasks").select("*", { count: "exact", head: true }).in("status", ["completed", "auto_annotated"]).or(`completed_at.gte.${prevPeriodStart},and(completed_at.is.null,created_at.gte.${prevPeriodStart})`).or(`completed_at.lt.${periodStart},and(completed_at.is.null,created_at.lt.${periodStart})`),
        supabase.from("annotator_profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("alpha_reports").select("overall_alpha").order("computed_at", { ascending: false }).limit(100),
        supabase.from("annotation_items").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("annotation_tasks").select("source_type, domain, status, completed_at, created_at").gte("created_at", periodStart),
        supabase.from("audit_logs").select("action, entity_type, created_at, user_id").order("created_at", { ascending: false }).limit(10),
        supabase.from("annotation_tasks").select("domain").gte("created_at", periodStart),
      ]);
      const totalItemsRes = await supabase.from("annotation_items").select("*", { count: "exact", head: true });
      const queuedItemsRes = await supabase.from("annotation_items").select("*", { count: "exact", head: true }).eq("status", "queued");
      const distributedTasksRes = await supabase.from("annotation_tasks").select("*", { count: "exact", head: true });

      const revenueNow = invoicesThisMonth.data?.reduce((s, i) => s + (i.invoice_amount_ttc || 0), 0) || 0;
      const revenuePrev = invoicesPrevMonth.data?.reduce((s, i) => s + (i.invoice_amount_ttc || 0), 0) || 0;
      const revenueDelta = revenuePrev > 0 ? ((revenueNow - revenuePrev) / revenuePrev * 100) : 0;

      const tasksNow = tasksCompleted.count || 0;
      const tasksPrev = tasksPrevCompleted.count || 0;
      const tasksDelta = tasksPrev > 0 ? ((tasksNow - tasksPrev) / tasksPrev * 100) : 0;

      const alphaValues = alphaReports.data?.map(r => r.overall_alpha).filter(Boolean) || [];
      const avgAlpha = alphaValues.length > 0 ? alphaValues.reduce((a, b) => a + b, 0) / alphaValues.length : 0;

      // Generate daily chart data
      const dailyData: any[] = [];
      for (let d = 0; d < Math.min(period, 30); d++) {
        const date = new Date(now.getTime() - (Math.min(period, 30) - 1 - d) * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0];
        const dayLabel = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        const dayTasks = allTasks.data?.filter(t => t.completed_at?.startsWith(dateStr)) || [];
        dailyData.push({
          date: dayLabel,
          completed: dayTasks.length,
          red_teaming: dayTasks.filter(t => t.source_type === "red_teaming").length,
          preference_dpo: dayTasks.filter(t => t.source_type === "preference_dpo").length,
          scoring: dayTasks.filter(t => t.source_type === "scoring").length,
          fact_checking: dayTasks.filter(t => t.source_type === "fact_checking").length,
        });
      }

      // Alpha trend
      const alphaTrend = alphaValues.slice(0, 20).reverse().map((v, i) => ({ batch: `B${i + 1}`, alpha: Number(v.toFixed(3)) }));

      // Domain distribution
      const domainCounts: Record<string, number> = {};
      tasksByDomain.data?.forEach((t: any) => {
        domainCounts[t.domain] = (domainCounts[t.domain] || 0) + 1;
      });
      const domainData = Object.entries(domainCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }));

      return {
        revenueNow, revenueDelta, tasksNow, tasksDelta,
        expertsActive: expertsActive.count || 0,
        clientsActive: clientsActive.count || 0,
        avgAlpha: Number(avgAlpha.toFixed(3)),
        pendingQa: pendingQa.count || 0,
        dailyData, alphaTrend, domainData,
        recentActivity: recentActivity.data || [],
        totalItems: totalItemsRes.count || 0,
        queuedItems: queuedItemsRes.count || 0,
        distributedTasks: distributedTasksRes.count || 0,
      };
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const alphaColor = data.avgAlpha >= 0.80 ? "text-success" : data.avgAlpha >= 0.67 ? "text-yellow-500" : "text-destructive";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Vue d'ensemble</h1>
        <div className="flex items-center gap-2">
          <PeriodToggle value={period} onChange={setPeriod} />
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Revenus" value={`${data.revenueNow.toLocaleString("fr-FR")} EUR`} delta={data.revenueDelta} />
        <KpiCard label="Tâches complétées" value={String(data.tasksNow)} delta={data.tasksDelta} />
        <KpiCard label="Experts actifs" value={String(data.expertsActive)} />
        <KpiCard label="Clients actifs" value={String(data.clientsActive)} />
        <KpiCard label="Alpha moyen" value={String(data.avgAlpha)} className={alphaColor} />
        <KpiCard label="En attente QA" value={String(data.pendingQa)} />
      </div>

      {/* Items pipeline */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Items totaux (uploadés)" value={String(data.totalItems)} />
        <KpiCard label="En file d'attente" value={String(data.queuedItems)} />
        <KpiCard label="Distribués (annotation_tasks)" value={String(data.distributedTasks)} />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tasks by day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Tâches complétées par jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.dailyData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 13 }} />
                <Bar dataKey="scoring" stackId="a" fill={TASK_TYPE_COLORS.scoring} radius={[0, 0, 0, 0]} />
                <Bar dataKey="preference_dpo" stackId="a" fill={TASK_TYPE_COLORS.preference_dpo} />
                <Bar dataKey="red_teaming" stackId="a" fill={TASK_TYPE_COLORS.red_teaming} />
                <Bar dataKey="fact_checking" stackId="a" fill={TASK_TYPE_COLORS.fact_checking} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alpha trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Krippendorff Alpha (glissant)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.alphaTrend}>
                <defs>
                  <linearGradient id="alphaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="batch" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 13 }} />
                {/* Threshold lines */}
                <Area type="monotone" dataKey="alpha" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#alphaGrad)" dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue chart placeholder */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenus et coûts</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 13 }} />
                <Line type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Activité" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Domain distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Répartition par domaine</CardTitle>
          </CardHeader>
          <CardContent>
            {data.domainData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={data.domainData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {data.domainData.map((_, i) => <Cell key={i} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {data.domainData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DOMAIN_COLORS[i % DOMAIN_COLORS.length] }} />
                      <span className="text-sm text-muted-foreground">{d.name}</span>
                      <span className="text-sm font-medium font-mono ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Activité récente</CardTitle>
            <Button variant="ghost" size="sm" className="text-sm text-muted-foreground" onClick={() => onNavigate("logs")}>
              Voir tout
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Action</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Entité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentActivity.map((log: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-[13px] font-mono text-muted-foreground">{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-[13px]">{log.action}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{log.entity_type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune activité récente</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, delta, className }: { label: string; value: string; delta?: number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className={cn("font-mono text-[28px] font-bold leading-none", className || "text-foreground")}>{value}</p>
        <p className="text-[13px] text-muted-foreground mt-2">{label}</p>
        {delta !== undefined && delta !== 0 && (
          <div className={cn("flex items-center gap-1 mt-1 text-[12px] font-medium", delta > 0 ? "text-success" : "text-destructive")}>
            {delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PeriodToggle({ value, onChange }: { value: number; onChange: (v: 7 | 30 | 90) => void }) {
  return (
    <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
      {([7, 30, 90] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "px-3 py-1 rounded-md text-[13px] font-medium transition-colors",
            value === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {p}j
        </button>
      ))}
    </div>
  );
}
