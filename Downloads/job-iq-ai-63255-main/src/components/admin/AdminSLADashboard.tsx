import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AlertTriangle, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminSLADashboard() {
  const { data: tracking, isLoading } = useQuery({
    queryKey: ["admin-sla-tracking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_tracking")
        .select("*, annotation_projects(name, status, domain, type)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const activeProjects = tracking?.filter((t: any) => !t.actual_completion_date) || [];
  const completedProjects = tracking?.filter((t: any) => t.actual_completion_date) || [];
  const atRiskProjects = activeProjects.filter((t: any) => t.at_risk);

  const slaOnTimeRate = completedProjects.length > 0
    ? Math.round((completedProjects.filter((t: any) => t.delivery_on_time).length / completedProjects.length) * 100)
    : 100;

  const slaAlphaRate = completedProjects.length > 0
    ? Math.round((completedProjects.filter((t: any) => t.alpha_on_target).length / completedProjects.length) * 100)
    : 100;

  // Mock historical compliance data
  const complianceData = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2026, i - 11).toLocaleDateString("fr-FR", { month: "short" }),
    rate: Math.min(100, Math.max(70, 85 + Math.floor(Math.random() * 15))),
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Suivi SLA</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs text-muted-foreground mb-1">Projets actifs avec SLA</p>
            <p className="text-2xl font-bold font-mono">{activeProjects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs text-muted-foreground mb-1">Projets à risque</p>
            <p className={cn("text-2xl font-bold font-mono", atRiskProjects.length > 0 && "text-destructive")}>
              {atRiskProjects.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs text-muted-foreground mb-1">Taux de livraison à temps</p>
            <p className={cn("text-2xl font-bold font-mono", slaOnTimeRate >= 90 ? "text-emerald-600" : "text-amber-600")}>
              {slaOnTimeRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs text-muted-foreground mb-1">Taux alpha respecté</p>
            <p className={cn("text-2xl font-bold font-mono", slaAlphaRate >= 90 ? "text-emerald-600" : "text-amber-600")}>
              {slaAlphaRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Compliance SLA dans le temps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.1)"
                  strokeWidth={2}
                  name="Compliance %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* At risk projects */}
      {atRiskProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Projets à risque ({atRiskProjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Alpha actuel</TableHead>
                  <TableHead>Raison</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRiskProjects.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">
                      {t.annotation_projects?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{t.sla_tier}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {t.committed_delivery_date}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {t.current_alpha?.toFixed(2) || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {t.at_risk_reason || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent completed */}
      {completedProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Projets terminés récemment</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Livraison</TableHead>
                  <TableHead>Alpha</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedProjects.slice(0, 10).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">
                      {t.annotation_projects?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{t.sla_tier}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.delivery_on_time ? (
                        <div className="flex items-center gap-1 text-sm text-emerald-600">
                          <Check className="h-3 w-3" /> À temps
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-destructive">
                          <Clock className="h-3 w-3" /> En retard
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.alpha_on_target ? (
                        <div className="flex items-center gap-1 text-sm text-emerald-600">
                          <Check className="h-3 w-3" /> OK
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Sous seuil
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.delivery_on_time && t.alpha_on_target ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-xs">Conforme</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Non conforme</Badge>
                      )}
                    </TableCell>
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
