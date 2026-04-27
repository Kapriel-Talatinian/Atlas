import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";

export function AdminQualityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-quality-dashboard"],
    queryFn: async () => {
      const { data: alphas } = await supabase
        .from("alpha_reports")
        .select("task_id, overall_alpha, dimension_alphas, flag_human_review, flag_reasons, computed_at")
        .order("computed_at", { ascending: false })
        .limit(500);

      const vals = alphas?.map(a => a.overall_alpha).filter(Boolean) || [];
      const avgAlpha = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const autoValidated = vals.filter(v => v >= 0.80).length;
      const flagged = vals.filter(v => v < 0.67).length;
      const totalAlerts = alphas?.filter(a => a.flag_human_review).length || 0;

      // Alpha trend (last 30 entries)
      const trend = (alphas || []).slice(0, 30).reverse().map((a, i) => ({
        batch: `${i + 1}`,
        alpha: Number(a.overall_alpha?.toFixed(3) || 0),
      }));

      // Dimension averages
      const dimAgg: Record<string, number[]> = {};
      alphas?.forEach(a => {
        if (a.dimension_alphas && typeof a.dimension_alphas === "object") {
          Object.entries(a.dimension_alphas as Record<string, any>).forEach(([dim, val]) => {
            const alpha = typeof val === "object" ? val.alpha : val;
            if (typeof alpha === "number") {
              (dimAgg[dim] = dimAgg[dim] || []).push(alpha);
            }
          });
        }
      });
      const dimData = Object.entries(dimAgg)
        .map(([dim, v]) => ({ dimension: dim.replace(/_/g, " "), alpha: Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)) }))
        .sort((a, b) => b.alpha - a.alpha);

      // Flagged items
      const flaggedItems = alphas?.filter(a => a.overall_alpha < 0.67).slice(0, 20) || [];

      // Drift alerts
      const { data: driftData } = await supabase.from("alpha_history").select("*").order("computed_at", { ascending: false }).limit(10);

      return {
        avgAlpha: Number(avgAlpha.toFixed(3)),
        autoValidatedPct: vals.length > 0 ? Number((autoValidated / vals.length * 100).toFixed(1)) : 0,
        flaggedPct: vals.length > 0 ? Number((flagged / vals.length * 100).toFixed(1)) : 0,
        totalAlerts,
        trend, dimData, flaggedItems,
        driftHistory: driftData || [],
      };
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const alphaColor = data.avgAlpha >= 0.80 ? "text-success" : data.avgAlpha >= 0.67 ? "text-yellow-500" : "text-destructive";

  return (
    <div className="space-y-8">
      <h1 className="text-foreground">Monitoring qualité</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QualityKpi label="Alpha moyen global" value={String(data.avgAlpha)} className={alphaColor} />
        <QualityKpi label="Auto-validées" value={`${data.autoValidatedPct}%`} className="text-success" />
        <QualityKpi label="Flaggées" value={`${data.flaggedPct}%`} className={data.flaggedPct > 10 ? "text-destructive" : "text-foreground"} />
        <QualityKpi label="Alertes de dérive" value={String(data.totalAlerts)} className={data.totalAlerts > 0 ? "text-destructive" : "text-foreground"} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Alpha trend */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Alpha glissant</CardTitle></CardHeader>
          <CardContent>
            {data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.trend}>
                  <defs>
                    <linearGradient id="qualAlphaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="batch" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 13 }} />
                  <Area type="monotone" dataKey="alpha" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#qualAlphaGrad)" dot={{ r: 3, fill: "hsl(var(--primary))" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Données insuffisantes</p>
            )}
          </CardContent>
        </Card>

        {/* Alpha by dimension */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Alpha par dimension</CardTitle></CardHeader>
          <CardContent>
            {data.dimData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.dimData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="dimension" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={100} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 13 }} />
                  <Bar dataKey="alpha" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Données insuffisantes</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Flagged items */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Items flaggés récents (Alpha &lt; 0.67)</CardTitle></CardHeader>
        <CardContent>
          {data.flaggedItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">Item ID</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Alpha</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Raisons</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.flaggedItems.map((item: any) => (
                  <TableRow key={item.task_id}>
                    <TableCell className="text-[13px] font-mono">{item.task_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-destructive">{item.overall_alpha?.toFixed(3)}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground max-w-xs truncate">
                      {Array.isArray(item.flag_reasons) ? item.flag_reasons.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-[13px] font-mono text-muted-foreground">{new Date(item.computed_at).toLocaleDateString("fr-FR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun item flaggé</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QualityKpi({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className={cn("font-mono text-[28px] font-bold leading-none", className)}>{value}</p>
      <p className="text-[13px] text-muted-foreground mt-2">{label}</p>
    </CardContent></Card>
  );
}
