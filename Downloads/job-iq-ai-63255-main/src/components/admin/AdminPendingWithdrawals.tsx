import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDownToLine, Check, X, Eye, Copy } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export function AdminPendingWithdrawals() {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [transferDate, setTransferDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [transferRef, setTransferRef] = useState("");
  const [rejectReason, setRejectReason] = useState("iban_invalid");
  const [rejectDetail, setRejectDetail] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["admin-pending-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests" as any)
        .select("*, profiles!withdrawal_requests_expert_id_fkey(name, email)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const handleConfirmWithdrawal = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("withdrawal_requests" as any)
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          transfer_date: transferDate,
          transfer_reference: transferRef || null,
        })
        .eq("id", selected.id);
      if (error) throw error;

      toast.success("Virement confirmé");
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-withdrawals"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectWithdrawal = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      const REASONS: Record<string, string> = {
        iban_invalid: "IBAN invalide ou incomplet",
        identity: "Problème de vérification d'identité",
        balance_contested: "Solde contesté (annotation en cours de review)",
        other: rejectDetail || "Autre motif",
      };

      // Re-credit balance
      await supabase.rpc("credit_expert_balance" as any, {
        p_expert_id: selected.expert_id,
        p_amount: selected.amount,
      });

      const { error } = await supabase
        .from("withdrawal_requests" as any)
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          rejection_reason: REASONS[rejectReason],
        })
        .eq("id", selected.id);
      if (error) throw error;

      toast.success("Retrait rejeté, solde re-crédité");
      setRejectOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-withdrawals"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setProcessing(false);
    }
  };

  const copyIban = (iban: string) => {
    navigator.clipboard.writeText(iban);
    toast.success("IBAN copié");
  };

  const maskIban = (iban: string) => {
    if (!iban || iban.length < 6) return iban;
    return `${iban.slice(0, 4)} •••• ${iban.slice(-2)}`;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4" /> Retraits experts en attente
            </CardTitle>
            {(withdrawals?.length || 0) > 0 && (
              <Badge variant="destructive">{withdrawals?.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Chargement...</p>
          ) : !withdrawals?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun retrait en attente</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Expert</TableHead>
                  <TableHead className="text-[11px] text-right">Montant</TableHead>
                  <TableHead className="text-[11px]">IBAN</TableHead>
                  <TableHead className="text-[11px]">Demandé le</TableHead>
                  <TableHead className="text-[11px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((wr: any) => (
                  <TableRow key={wr.id}>
                    <TableCell className="text-sm">{wr.profiles?.name || wr.expert_id}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{wr.amount.toFixed(2)} USD</TableCell>
                    <TableCell className="font-mono text-xs">{maskIban(wr.iban_snapshot)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {wr.created_at ? new Date(wr.created_at).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-xs h-7"><Eye className="w-3 h-3" /></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72">
                            <div className="space-y-2 text-sm">
                              <p><strong>Titulaire :</strong> {wr.account_holder_snapshot}</p>
                              <p><strong>IBAN :</strong> <span className="font-mono text-xs">{wr.iban_snapshot}</span></p>
                              <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => copyIban(wr.iban_snapshot)}>
                                <Copy className="w-3 h-3 mr-1" />Copier l'IBAN
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" className="text-xs h-7" onClick={() => { setSelected(wr); setConfirmOpen(true); }}>
                          <Check className="w-3 h-3 mr-1" />Viré
                        </Button>
                        <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => { setSelected(wr); setRejectOpen(true); }}>
                          <X className="w-3 h-3" />
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

      {/* Confirm withdrawal dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmer le virement</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-sm space-y-1">
              <p>Expert : <strong>{selected?.profiles?.name || selected?.account_holder_snapshot}</strong></p>
              <p>Montant : <strong className="font-mono">{selected?.amount?.toFixed(2)} USD</strong></p>
              <p>IBAN : <span className="font-mono text-xs">{maskIban(selected?.iban_snapshot || "")}</span></p>
            </div>
            <div>
              <Label className="text-xs">Date du virement *</Label>
              <Input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Référence virement (optionnel)</Label>
              <Input value={transferRef} onChange={e => setTransferRef(e.target.value)} placeholder="VIR-STEF-..." className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={processing}>Annuler</Button>
              <Button onClick={handleConfirmWithdrawal} disabled={processing}>
                {processing ? "Traitement..." : "Confirmer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject withdrawal dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rejeter le retrait</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Label className="text-sm">Pourquoi rejeter ce retrait ?</Label>
            <RadioGroup value={rejectReason} onValueChange={setRejectReason} className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="iban_invalid" id="rr1" />
                <Label htmlFor="rr1" className="text-sm cursor-pointer">IBAN invalide ou incomplet</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="identity" id="rr2" />
                <Label htmlFor="rr2" className="text-sm cursor-pointer">Problème de vérification d'identité</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="balance_contested" id="rr3" />
                <Label htmlFor="rr3" className="text-sm cursor-pointer">Solde contesté (annotation en cours de review)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="other" id="rr4" />
                <Label htmlFor="rr4" className="text-sm cursor-pointer">Autre</Label>
              </div>
            </RadioGroup>
            {rejectReason === "other" && (
              <Input value={rejectDetail} onChange={e => setRejectDetail(e.target.value)} placeholder="Motif détaillé" />
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={processing}>Annuler</Button>
              <Button variant="destructive" onClick={handleRejectWithdrawal} disabled={processing}>
                {processing ? "Traitement..." : "Rejeter le retrait"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
