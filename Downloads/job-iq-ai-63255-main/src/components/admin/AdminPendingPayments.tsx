import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banknote, Check, Bell } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export function AdminPendingPayments() {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [receivedDate, setReceivedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [transferRef, setTransferRef] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: pendingInvoices, isLoading } = useQuery({
    queryKey: ["admin-pending-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .in("status", ["pending", "overdue"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleConfirmPayment = async () => {
    if (!selectedInvoice) return;
    setProcessing(true);
    try {
      // Update invoice
      const { error: invError } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: receivedDate,
          bank_transfer_reference: transferRef || null,
          manually_confirmed_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedInvoice.id);
      if (invError) throw invError;

      // Update project_payment if linked
      if (selectedInvoice.payment_id) {
        await supabase
          .from("project_payments" as any)
          .update({ status: "paid", paid_at: receivedDate })
          .eq("id", selectedInvoice.payment_id);

        // Check if it's a deposit → activate project
        const { data: payment } = await supabase
          .from("project_payments" as any)
          .select("payment_type, project_id")
          .eq("id", selectedInvoice.payment_id)
          .single();

        if (payment && (payment as any).payment_type === "deposit" && selectedInvoice.project_id) {
          await supabase
            .from("annotation_projects")
            .update({ status: "active" })
            .eq("id", selectedInvoice.project_id);
        }
      }

      toast.success("Paiement confirmé");
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-invoices"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setProcessing(false);
    }
  };

  const handleReminder = async (invoice: any) => {
    try {
      await supabase
        .from("invoices")
        .update({ reminders_sent: (invoice.reminders_sent || 0) + 1 } as any)
        .eq("id", invoice.id);
      toast.success("Relance envoyée");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-invoices"] });
    } catch {
      toast.error("Erreur lors de l'envoi");
    }
  };

  const openConfirm = (invoice: any) => {
    setSelectedInvoice(invoice);
    setAmountReceived(invoice.invoice_amount_ttc?.toFixed(2) || "0");
    setReceivedDate(format(new Date(), "yyyy-MM-dd"));
    setTransferRef("");
    setNotes("");
    setConfirmOpen(true);
  };

  const totalPending = pendingInvoices?.reduce((s, i) => s + (i.invoice_amount_ttc || 0), 0) || 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Virements clients en attente
            </CardTitle>
            {(pendingInvoices?.length || 0) > 0 && (
              <Badge variant="destructive">{pendingInvoices?.length} — {totalPending.toFixed(0)} USD</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Chargement...</p>
          ) : !pendingInvoices?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun paiement en attente</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">N° Facture</TableHead>
                  <TableHead className="text-[11px]">Client</TableHead>
                  <TableHead className="text-[11px]">Projet</TableHead>
                  <TableHead className="text-[11px] text-right">Montant TTC</TableHead>
                  <TableHead className="text-[11px]">Statut</TableHead>
                  <TableHead className="text-[11px]">Relances</TableHead>
                  <TableHead className="text-[11px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{inv.client_name}</TableCell>
                    <TableCell className="text-sm">{inv.project_name}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{inv.invoice_amount_ttc?.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "overdue" ? "destructive" : "outline"}>
                        {inv.status === "overdue" ? "En retard" : "En attente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(inv as any).reminders_sent || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" className="text-xs h-7" onClick={() => openConfirm(inv)}>
                          <Check className="w-3 h-3 mr-1" />Marquer payé
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleReminder(inv)}>
                          <Bell className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm payment dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer la réception du paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-sm space-y-1">
              <p>Facture : <strong className="font-mono">{selectedInvoice?.invoice_number}</strong></p>
              <p>Client : <strong>{selectedInvoice?.client_name}</strong></p>
              <p>Montant attendu : <strong className="font-mono">{selectedInvoice?.invoice_amount_ttc?.toFixed(2)} USD TTC</strong></p>
            </div>
            <div>
              <Label className="text-xs">Montant reçu *</Label>
              <Input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="font-mono mt-1" step="0.01" />
            </div>
            <div>
              <Label className="text-xs">Date de réception *</Label>
              <Input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Référence virement (optionnel)</Label>
              <Input value={transferRef} onChange={e => setTransferRef(e.target.value)} placeholder="VIR-20260331-..." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Notes (optionnel)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={processing}>Annuler</Button>
              <Button onClick={handleConfirmPayment} disabled={processing}>
                {processing ? "Traitement..." : "Confirmer le paiement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
