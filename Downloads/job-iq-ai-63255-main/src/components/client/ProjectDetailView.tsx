import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataUploadDialog } from "./DataUploadDialog";
import { ProjectPerformanceTab } from "./ProjectPerformanceTab";
import { DatasetExportSection } from "./DatasetExportSection";
import { ArrowLeft, Download, FileText, BarChart3, Shield, AlertTriangle, CreditCard, Check, Clock, AlertCircle, Activity } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ProjectDetailViewProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectDetailView = ({ projectId, onBack }: ProjectDetailViewProps) => {
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotation_projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: itemStats, refetch: refetchItems } = useQuery({
    queryKey: ["project-items-stats", projectId],
    queryFn: async () => {
      // Use count queries to avoid the 1000-row limit
      const [totalRes, queuedRes, inProgressRes, completedRes, submittedRes] = await Promise.all([
        supabase.from("annotation_items").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        supabase.from("annotation_items").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "queued"),
        supabase.from("annotation_items").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", ["assigned", "in_progress"]),
        supabase.from("annotation_items").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "completed"),
        supabase.from("annotation_items").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", ["submitted", "in_review"]),
      ]);
      return {
        total: totalRes.count ?? 0,
        queued: queuedRes.count ?? 0,
        in_progress: inProgressRes.count ?? 0,
        completed: completedRes.count ?? 0,
        submitted: submittedRes.count ?? 0,
      };
    },
  });

  const { data: qualityReports } = useQuery({
    queryKey: ["project-quality", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotation_quality_reports")
        .select("*")
        .eq("project_id", projectId)
        .order("computed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["project-alerts", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotation_alerts")
        .select("*")
        .eq("project_id", projectId)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: batches } = useQuery({
    queryKey: ["project-batches", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotation_batches")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleExport = async (format: "jsonl" | "csv") => {
    try {
      const { data: items, error } = await supabase
        .from("annotation_items")
        .select("id, content, status, complexity_level, completed_at, auto_annotation, final_annotation_id")
        .eq("project_id", projectId)
        .eq("status", "completed");
      if (error) throw error;
      if (!items?.length) {
        toast.error("Aucun item complété à exporter");
        return;
      }

      let content: string;
      let mimeType: string;
      let ext: string;

      if (format === "jsonl") {
        content = items.map(i => JSON.stringify(i)).join("\n");
        mimeType = "application/jsonl";
        ext = "jsonl";
      } else {
        const headers = ["id", "prompt", "status", "complexity_level", "completed_at"];
        const rows = items.map(i => [
          i.id,
          `"${((i.content as any)?.primary || "").replace(/"/g, '""')}"`,
          i.status,
          i.complexity_level,
          i.completed_at || "",
        ].join(","));
        content = [headers.join(","), ...rows].join("\n");
        mimeType = "text/csv";
        ext = "csv";
      }

      const blob = new Blob([content], { type: mimeType });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${project?.name || "export"}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      link.click();
      toast.success(`Export ${format.toUpperCase()} réussi — ${items.length} items`);
    } catch (err: any) {
      toast.error("Erreur lors de l'export");
    }
  };

  if (!project) return null;

  const realTotal = itemStats?.total ?? project.total_items ?? 0;
  const completionRate = realTotal > 0 ? Math.round(((itemStats?.completed || 0) / realTotal) * 100) : 0;
  const latestAlpha = qualityReports?.[0]?.metrics as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.description}</p>
        </div>
        <Badge variant={project.status === "active" ? "default" : "secondary"}>{project.status}</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{realTotal}</p>
            <p className="text-xs text-muted-foreground">Items totaux</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-primary">{completionRate}%</p>
            <p className="text-xs text-muted-foreground">Complétion</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{latestAlpha?.iaa?.toFixed(2) || "—"}</p>
            <p className="text-xs text-muted-foreground">Alpha (α)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{alerts?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Alertes actives</p>
          </CardContent>
        </Card>
      </div>

      <Progress value={completionRate} className="h-3" />

      {/* Payment section */}
      <ProjectPaymentsSection projectId={projectId} projectStatus={project.status} />

      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data" className="gap-1"><FileText className="w-3.5 h-3.5" />Données</TabsTrigger>
          <TabsTrigger value="performance" className="gap-1"><Activity className="w-3.5 h-3.5" />Performance</TabsTrigger>
          <TabsTrigger value="quality" className="gap-1"><Shield className="w-3.5 h-3.5" />Qualité</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1"><AlertTriangle className="w-3.5 h-3.5" />Alertes</TabsTrigger>
          <TabsTrigger value="export" className="gap-1"><Download className="w-3.5 h-3.5" />Export</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Données importées</h3>
            <DataUploadDialog projectId={projectId} onUploaded={() => refetchItems()} />
          </div>

          {/* Items summary */}
          {(itemStats?.total ?? 0) > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{itemStats?.total ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">Items totaux</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">{itemStats?.queued ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">En attente</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{(itemStats?.in_progress ?? 0) + (itemStats?.submitted ?? 0)}</p>
                    <p className="text-[11px] text-muted-foreground">En cours</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{itemStats?.completed ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">Terminés</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Batches */}
          {batches?.length ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Lots ({batches.length})</h4>
              {batches.map(b => (
                <Card key={b.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.total_items} items — {new Date(b.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Badge variant="outline">{b.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (itemStats?.total ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Aucune donnée importée</p>
                <p className="text-sm">Importez un fichier CSV, JSON ou JSONL pour commencer</p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <ProjectPerformanceTab projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="quality" className="mt-4 space-y-4">
          {qualityReports?.length ? (
            qualityReports.map(report => (
              <Card key={report.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant={report.drifted ? "destructive" : "default"}>
                      {report.drifted ? "Dérive détectée" : "Stable"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(report.computed_at).toLocaleString("fr-FR")}</span>
                  </div>
                  <p className="text-sm">Interprétation: <strong>{report.interpretation || "—"}</strong></p>
                  {report.recommendations?.length > 0 && (
                    <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4">
                      {report.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Pas encore de rapports qualité</p>
                <p className="text-sm">Les métriques apparaîtront après les premières annotations</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="mt-4 space-y-4">
          {alerts?.length ? (
            alerts.map(alert => (
              <Card key={alert.id} className={alert.severity === "critical" ? "border-destructive/50" : ""}>
                <CardContent className="py-3 flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${alert.severity === "critical" ? "text-destructive" : "text-yellow-500"}`} />
                  <div>
                    <p className="text-sm font-medium">{alert.rule_name}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(alert.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <Badge variant={alert.severity === "critical" ? "destructive" : "outline"} className="ml-auto shrink-0">
                    {alert.severity}
                  </Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Aucune alerte active</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <DatasetExportSection
            projectId={projectId}
            project={project}
            completedTasks={itemStats?.completed || 0}
            totalTasks={realTotal}
            globalAlpha={latestAlpha?.iaa || null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// === Payment section component ===
const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "Acompte",
  intermediate: "Intermédiaire",
  final: "Solde final",
};

function ProjectPaymentsSection({ projectId, projectStatus }: { projectId: string; projectStatus: string }) {
  const [paying, setPaying] = useState(false);

  const { data: paymentsData } = useQuery({
    queryKey: ["project-payments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_payments" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["project-invoices", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  if (!paymentsData?.length) return null;

  const totalAll = paymentsData.reduce((s: number, p: any) => s + p.amount, 0);

  // Segmented progress
  const paidPercent = paymentsData
    .filter((p: any) => p.status === "paid")
    .reduce((s: number, p: any) => s + p.percentage, 0);
  const duePercent = paymentsData
    .filter((p: any) => ["triggered", "overdue"].includes(p.status))
    .reduce((s: number, p: any) => s + p.percentage, 0);

  const handleDownloadInvoice = async (paymentId: string) => {
    const invoice = getInvoiceForPayment(paymentId);
    if (!invoice) { toast.error("Aucune facture disponible"); return; }
    handleDownload(invoice.id);
  };

  const handleDownload = async (invoiceId: string) => {
    try {
      toast.info("Génération du PDF en cours...");
      const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoice_id: invoiceId },
      });
      if (error || !data?.download_url) throw new Error("Erreur de génération");
      window.open(data.download_url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Erreur de téléchargement");
    }
  };

  const hasOverdue = paymentsData.some((p: any) => p.status === "overdue");
  const overduePayment = paymentsData.find((p: any) => p.status === "overdue");
  const overdueDays = overduePayment?.overdue_since
    ? Math.floor((Date.now() - new Date(overduePayment.overdue_since).getTime()) / 86400000)
    : 0;

  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Find invoice for a payment
  const getInvoiceForPayment = (paymentId: string) =>
    invoicesData?.find(inv => inv.payment_id === paymentId);

  return (
    <div className="space-y-3">
      {/* Pending payment banner */}
      {hasOverdue && (
        <div className="rounded-lg border-l-[3px] border-l-destructive bg-destructive/5 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              {projectStatus === "paused" ? "Ce projet est en pause" : "Paiement en retard"}
            </p>
            <p className="text-xs text-destructive/80 mt-1">
              Le paiement {PAYMENT_TYPE_LABELS[overduePayment?.payment_type] || ""} de {fmt(overduePayment?.amount || 0)} USD est en retard depuis {overdueDays} jour{overdueDays > 1 ? "s" : ""}.
              {projectStatus === "paused" && " L'annotation est suspendue jusqu'à réception du paiement."}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Effectuez un virement bancaire avec la référence indiquée sur votre facture.</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Paiements
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Segmented progress bar */}
          <div>
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              {paidPercent > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${paidPercent}%` }}
                />
              )}
              {duePercent > 0 && (
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${duePercent}%` }}
                />
              )}
            </div>
            <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Payé</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />En attente</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted" />À venir</span>
            </div>
          </div>

          {/* Payment rows with TVA */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 font-medium">Étape</th>
                  <th className="text-center py-2 font-medium">%</th>
                  <th className="text-right py-2 font-medium">Montant HT</th>
                  <th className="text-right py-2 font-medium hidden sm:table-cell">TVA</th>
                  <th className="text-right py-2 font-medium hidden sm:table-cell">TTC</th>
                  <th className="text-center py-2 font-medium">Statut</th>
                  <th className="text-right py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {paymentsData.map((p: any) => {
                  const isPaid = p.status === "paid";
                  const isOverdue = p.status === "overdue";
                  const isTriggered = p.status === "triggered";
                  const isPending = p.status === "pending";
                  const invoice = getInvoiceForPayment(p.id);
                  const tvaAmount = invoice?.tva_amount || 0;
                  const ttcAmount = invoice?.invoice_amount_ttc || p.amount;

                  return (
                    <tr key={p.id} className={cn("border-b border-border/50", isPending && "opacity-50")}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                            isPaid && "bg-emerald-500/10 text-emerald-600",
                            isOverdue && "bg-destructive/10 text-destructive",
                            isTriggered && "bg-amber-500/10 text-amber-600",
                            isPending && "bg-muted text-muted-foreground",
                          )}>
                            {isPaid ? <Check className="w-2.5 h-2.5" /> :
                             isOverdue ? <AlertCircle className="w-2.5 h-2.5" /> :
                             <Clock className="w-2.5 h-2.5" />}
                          </div>
                          <span className="font-medium">{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</span>
                        </div>
                      </td>
                      <td className="text-center font-mono text-xs">{p.percentage}%</td>
                      <td className="text-right font-mono">{fmt(p.amount)}</td>
                      <td className="text-right font-mono text-muted-foreground hidden sm:table-cell">
                        {invoice ? (invoice.tva_rate > 0 ? fmt(tvaAmount) : "—") : "—"}
                      </td>
                      <td className="text-right font-mono font-semibold hidden sm:table-cell">{fmt(ttcAmount)}</td>
                      <td className="text-center">
                        {isPaid && (
                          <div>
                            <span className="text-emerald-600 text-xs font-medium">✓ Payé</span>
                            {p.paid_at && <p className="text-[10px] text-muted-foreground">{new Date(p.paid_at).toLocaleDateString("fr-FR")}</p>}
                          </div>
                        )}
                        {isTriggered && <span className="text-amber-600 text-xs">Dû</span>}
                        {isOverdue && <Badge variant="destructive" className="text-[10px]">Retard</Badge>}
                        {isPending && (
                          <span className="text-[10px] text-muted-foreground">
                            {p.trigger_condition === "at_50_percent" ? "Dû à 50%" : "Dû à la livraison"}
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          {(isTriggered || isOverdue) && (
                            <span className="text-xs text-amber-600">Virement attendu</span>
                          )}
                          {invoice && (
                            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleDownload(invoice.id)}>
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="font-semibold">
                  <td className="py-2.5">Total</td>
                  <td className="text-center font-mono text-xs">100%</td>
                  <td className="text-right font-mono">{fmt(totalAll)}</td>
                  <td className="text-right font-mono hidden sm:table-cell">
                    {fmt(invoicesData?.reduce((s, i) => s + i.tva_amount, 0) || 0)}
                  </td>
                  <td className="text-right font-mono hidden sm:table-cell">
                    {fmt(invoicesData?.reduce((s, i) => s + i.invoice_amount_ttc, 0) || totalAll)}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
