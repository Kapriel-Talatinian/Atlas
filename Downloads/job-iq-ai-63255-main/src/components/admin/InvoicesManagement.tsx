import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, Euro, Download } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface InvoicesManagementProps {
  onRefresh: () => void;
}

const PAGE_SIZE = 50;

const InvoicesManagement = ({ onRefresh }: InvoicesManagementProps) => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ["admin-invoices", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("invoices")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { invoices: data || [], totalCount: count || 0 };
    },
  });

  const invoices = queryData?.invoices || [];
  const totalCount = queryData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    onRefresh();
  };

  const updateInvoiceStatus = async (id: string, status: string) => {
    try {
      const updateData: Record<string, any> = { status };
      if (status === "paid") updateData.paid_at = new Date().toISOString();
      const { error } = await supabase.from("invoices").update(updateData).eq("id", id);
      if (error) throw error;
      toast.success("Statut mis à jour");
      invalidate();
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "En attente" },
      paid: { variant: "default", label: "Payée" },
      overdue: { variant: "destructive", label: "En retard" },
      cancelled: { variant: "secondary", label: "Annulée" },
    };
    const { variant, label } = config[status] || { variant: "outline" as const, label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const PAYMENT_TYPE_LABELS: Record<string, string> = {
    deposit: "Acompte",
    intermediate: "Intermédiaire",
    final: "Solde final",
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Factures</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucune facture émise.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">HT</TableHead>
                  <TableHead className="text-right">TVA</TableHead>
                  <TableHead className="text-right">TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{inv.client_name}</TableCell>
                    <TableCell className="text-sm">{inv.project_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {PAYMENT_TYPE_LABELS[inv.payment_type] || inv.payment_type} ({inv.percentage}%)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{inv.invoice_amount_ht.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {inv.tva_rate > 0 ? inv.tva_amount.toFixed(2) : inv.tva_regime === "eu_autoliquidation" ? "Autoliq." : "Exonéré"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{inv.invoice_amount_ttc.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right">
                      <Select value={inv.status} onValueChange={(v) => updateInvoiceStatus(inv.id, v)}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="paid">Payée</SelectItem>
                          <SelectItem value="overdue">En retard</SelectItem>
                          <SelectItem value="cancelled">Annulée</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} / {totalPages} ({totalCount} factures)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><Euro className="h-5 w-5" />Résumé</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{invoices.filter(i => i.status === "pending").length}</p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </div>
            <div className="text-center p-4 bg-emerald-500/10 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">
                {invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.invoice_amount_ttc, 0).toFixed(0)} USD
              </p>
              <p className="text-sm text-muted-foreground">Encaissé</p>
            </div>
            <div className="text-center p-4 bg-amber-500/10 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">
                {invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.invoice_amount_ttc, 0).toFixed(0)} USD
              </p>
              <p className="text-sm text-muted-foreground">À encaisser</p>
            </div>
            <div className="text-center p-4 bg-destructive/10 rounded-lg">
              <p className="text-2xl font-bold text-destructive">
                {invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.invoice_amount_ttc, 0).toFixed(0)} USD
              </p>
              <p className="text-sm text-muted-foreground">En retard</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default InvoicesManagement;
