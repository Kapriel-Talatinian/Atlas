import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Clock, AlertCircle, Download, Receipt, Banknote } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { ClientDashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "Acompte",
  intermediate: "Intermédiaire",
  final: "Solde final",
};

const PAYMENT_TYPE_COLORS: Record<string, string> = {
  deposit: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  intermediate: "bg-primary/10 text-primary border-primary/20",
  final: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

type StatusFilter = "all" | "paid" | "pending" | "overdue";

const BillingPage = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data: client } = useQuery({
    queryKey: ["client-record"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data } = await supabase.from("clients").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      return data?.[0] ?? null;
    },
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["client-invoices-full", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", client!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Projects list for filter
  const projects = invoices
    ? Array.from(new Map(invoices.map(i => [i.project_id, { id: i.project_id, name: i.project_name }])).values())
    : [];

  // Filter
  const filtered = (invoices || []).filter(inv => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (projectFilter !== "all" && inv.project_id !== projectFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // KPIs
  const totalPaid = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.invoice_amount_ttc, 0) || 0;
  const totalPending = invoices?.filter(i => i.status === "pending").reduce((s, i) => s + i.invoice_amount_ttc, 0) || 0;
  const totalOverdue = invoices?.filter(i => i.status === "overdue").reduce((s, i) => s + i.invoice_amount_ttc, 0) || 0;

  const [wireDialogOpen, setWireDialogOpen] = useState(false);
  const [selectedWireInvoice, setSelectedWireInvoice] = useState<any>(null);

  const { data: bankSettings } = useQuery({
    queryKey: ["bank-settings-client"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["bank_account_holder", "bank_iban", "bank_bic", "bank_name"]);
      const map: Record<string, string> = {};
      data?.forEach(s => { map[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value); });
      return map;
    },
  });

  const showWireInstructions = (inv: any) => {
    setSelectedWireInvoice(inv);
    setWireDialogOpen(true);
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

  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <ClientDashboardLayout userName={client?.company_name}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Facturation</h1>
          <p className="text-sm text-muted-foreground mt-1">Retrouvez l'ensemble de vos factures et paiements.</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total payé</p>
                  <p className="text-xl font-bold font-mono text-emerald-600">{fmt(totalPaid)} USD</p>
                  <p className="text-[11px] text-muted-foreground">depuis votre inscription</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">En attente de paiement</p>
                  <p className={cn("text-xl font-bold font-mono", totalPending > 0 ? "text-amber-600" : "text-muted-foreground")}>
                    {fmt(totalPending)} USD
                  </p>
                  <p className="text-[11px] text-muted-foreground">factures dues</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">En retard</p>
                    <p className={cn("text-xl font-bold font-mono", totalOverdue > 0 ? "text-destructive" : "text-muted-foreground")}>
                      {fmt(totalOverdue)} USD
                    </p>
                    <p className="text-[11px] text-muted-foreground">retard de paiement</p>
                  </div>
                  {totalOverdue > 0 && (
                    <Badge variant="destructive" className="text-[10px] animate-pulse">Action requise</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            {(["all", "paid", "pending", "overdue"] as StatusFilter[]).map(s => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatusFilter(s); setPage(0); }}
                className="text-xs"
              >
                {s === "all" ? "Toutes" : s === "paid" ? "Payées" : s === "pending" ? "En attente" : "En retard"}
              </Button>
            ))}
          </div>
          <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue placeholder="Tous les projets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les projets</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Invoices table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : !invoices?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune facture pour le moment</p>
              <p className="text-xs text-muted-foreground mt-1">Les factures apparaîtront après la création de votre premier projet.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">N° facture</TableHead>
                        <TableHead>Projet</TableHead>
                        <TableHead className="w-[140px]">Type</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Montant HT</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">TVA</TableHead>
                        <TableHead className="text-right">Montant TTC</TableHead>
                        <TableHead className="w-[130px]">Statut</TableHead>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="text-right w-[160px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((inv, i) => (
                        <motion.tr
                          key={inv.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                          <TableCell>
                            <button
                              onClick={() => navigate(`/client/projects?id=${inv.project_id}`)}
                              className="text-sm hover:text-primary transition-colors text-left"
                            >
                              {inv.project_name}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px] border", PAYMENT_TYPE_COLORS[inv.payment_type])}>
                              {PAYMENT_TYPE_LABELS[inv.payment_type]} ({inv.percentage}%)
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                            {fmt(inv.invoice_amount_ht)} USD
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground hidden lg:table-cell">
                            {inv.tva_rate > 0
                              ? `${fmt(inv.tva_amount)} USD (${inv.tva_rate}%)`
                              : inv.tva_regime === "eu_autoliquidation" ? "Autoliquidation" : "Exonéré"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {fmt(inv.invoice_amount_ttc)} USD
                          </TableCell>
                          <TableCell>
                            {inv.status === "paid" && (
                              <div>
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Payée</Badge>
                                {inv.paid_at && <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(inv.paid_at).toLocaleDateString("fr-FR")}</p>}
                              </div>
                            )}
                            {inv.status === "pending" && (
                              <div>
                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">En attente</Badge>
                                {inv.due_date && <p className="text-[10px] text-muted-foreground mt-0.5">Dû le {new Date(inv.due_date).toLocaleDateString("fr-FR")}</p>}
                              </div>
                            )}
                            {inv.status === "overdue" && (
                              <div>
                                <Badge variant="destructive" className="text-[10px] animate-pulse">En retard</Badge>
                                {inv.due_date && (
                                  <p className="text-[10px] text-destructive mt-0.5">
                                    {Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)} jours
                                  </p>
                                )}
                              </div>
                            )}
                            {inv.status === "cancelled" && (
                              <Badge variant="secondary" className="text-[10px] line-through">Annulée</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(inv.issued_at).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1.5 justify-end">
                              {(inv.status === "pending" || inv.status === "overdue") && (
                                <Button
                                  size="sm"
                                  variant={inv.status === "overdue" ? "destructive" : "default"}
                                  className="text-xs h-7"
                                  onClick={() => showWireInstructions(inv)}
                                >
                                  <Banknote className="w-3 h-3 mr-1" />Virement
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7"
                                onClick={() => handleDownload(inv.id)}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">{new Date(inv.issued_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                        {inv.status === "paid" && <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]">Payée</Badge>}
                        {inv.status === "pending" && <Badge className="bg-amber-500/10 text-amber-600 text-[10px]">En attente</Badge>}
                        {inv.status === "overdue" && <Badge variant="destructive" className="text-[10px] animate-pulse">En retard</Badge>}
                        {inv.status === "cancelled" && <Badge variant="secondary" className="text-[10px]">Annulée</Badge>}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inv.project_name}</p>
                        <Badge variant="outline" className={cn("text-[10px] mt-1", PAYMENT_TYPE_COLORS[inv.payment_type])}>
                          {PAYMENT_TYPE_LABELS[inv.payment_type]} ({inv.percentage}%)
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="font-mono text-lg font-bold">{fmt(inv.invoice_amount_ttc)} USD</p>
                      </div>
                      <div className="flex gap-2">
                        {(inv.status === "pending" || inv.status === "overdue") && (
                          <Button
                            size="sm"
                            variant={inv.status === "overdue" ? "destructive" : "default"}
                            className="flex-1 text-xs"
                            onClick={() => showWireInstructions(inv)}
                          >
                            <Banknote className="w-3 h-3 mr-1" />Virement
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleDownload(inv.id)}>
                          <Download className="w-3 h-3 mr-1" />PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{filtered.length} facture{filtered.length > 1 ? "s" : ""}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Suivant</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Wire transfer instructions dialog */}
      <Dialog open={wireDialogOpen} onOpenChange={setWireDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Instructions de virement</DialogTitle>
          </DialogHeader>
          {selectedWireInvoice && (
            <div className="space-y-4 pt-2">
              <div className="text-sm space-y-1">
                <p>Facture : <strong className="font-mono">{selectedWireInvoice.invoice_number}</strong></p>
                <p>Montant TTC : <strong className="font-mono">{fmt(selectedWireInvoice.invoice_amount_ttc)} USD</strong></p>
                {selectedWireInvoice.due_date && (
                  <p>Date d'échéance : <strong>{new Date(selectedWireInvoice.due_date).toLocaleDateString("fr-FR")}</strong></p>
                )}
              </div>
              <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                <p className="text-sm font-semibold">Coordonnées bancaires</p>
                <div className="grid grid-cols-[100px_1fr] gap-1 text-sm">
                  <span className="text-muted-foreground">Titulaire</span>
                  <span className="font-mono">{bankSettings?.bank_account_holder?.replace(/"/g, "") || "—"}</span>
                  <span className="text-muted-foreground">IBAN</span>
                  <span className="font-mono">{bankSettings?.bank_iban?.replace(/"/g, "") || "—"}</span>
                  <span className="text-muted-foreground">BIC</span>
                  <span className="font-mono">{bankSettings?.bank_bic?.replace(/"/g, "") || "—"}</span>
                  <span className="text-muted-foreground">Banque</span>
                  <span>{bankSettings?.bank_name?.replace(/"/g, "") || "—"}</span>
                </div>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm">
                  <strong>Référence obligatoire :</strong>{" "}
                  <span className="font-mono text-primary">{selectedWireInvoice.invoice_number}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Indiquez cette référence dans le libellé de votre virement pour un traitement rapide.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Votre projet sera activé dès réception et confirmation du virement par notre équipe (sous 24-48h ouvrées).
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleDownload(selectedWireInvoice.id)} size="sm">
                  <Download className="w-3 h-3 mr-1" />Télécharger la facture
                </Button>
                <Button onClick={() => setWireDialogOpen(false)} size="sm">Compris</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ClientDashboardLayout>
  );
};

export default BillingPage;
