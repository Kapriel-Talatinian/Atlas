import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import { DOMAINS, DOMAIN_LABELS, TASK_TYPES, TASK_TYPE_LABELS, DEFAULT_EXPERT_PAYOUTS, DEFAULT_CLIENT_PRICES } from "./settingsConstants";
import { cn } from "@/lib/utils";

interface ExpertPayTabProps {
  onDirtyChange: (dirty: boolean) => void;
}

export function ExpertPayTab({ onDirtyChange }: ExpertPayTabProps) {
  const [payouts, setPayouts] = useState<Record<string, Record<string, number>>>(structuredClone(DEFAULT_EXPERT_PAYOUTS));
  const [origPayouts, setOrigPayouts] = useState<Record<string, Record<string, number>>>(structuredClone(DEFAULT_EXPERT_PAYOUTS));
  const [clientPrices, setClientPrices] = useState<Record<string, Record<string, number>>>(structuredClone(DEFAULT_CLIENT_PRICES));
  const [minWithdrawal, setMinWithdrawal] = useState(50);
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(true);
  const [autoPayoutFrequency, setAutoPayoutFrequency] = useState("biweekly");
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const loadData = async () => {
    const { data: pricingData } = await supabase.from("task_pricing" as any).select("*").eq("active", true);
    if (pricingData && (pricingData as any[]).length > 0) {
      const p: Record<string, Record<string, number>> = {};
      const c: Record<string, Record<string, number>> = {};
      for (const row of pricingData as any[]) {
        if (!p[row.task_type]) p[row.task_type] = {};
        if (!c[row.task_type]) c[row.task_type] = {};
        p[row.task_type][row.domain] = row.expert_payout;
        c[row.task_type][row.domain] = row.client_unit_price;
      }
      if (Object.keys(p).length > 0) { setPayouts(prev => ({ ...prev, ...p })); setOrigPayouts(prev => ({ ...prev, ...p })); }
      if (Object.keys(c).length > 0) setClientPrices(prev => ({ ...prev, ...c }));
    }

    const { data: settings } = await supabase.from("platform_settings" as any).select("key, value").in("key", ["expert_min_withdrawal", "auto_payout_enabled", "auto_payout_frequency"]);
    if (settings) {
      for (const row of settings as any[]) {
        switch (row.key) {
          case "expert_min_withdrawal": setMinWithdrawal(parseFloat(String(row.value))); break;
          case "auto_payout_enabled": setAutoPayoutEnabled(row.value === true || row.value === "true"); break;
          case "auto_payout_frequency": setAutoPayoutFrequency(typeof row.value === "string" ? row.value : String(row.value)); break;
        }
      }
    }
    setLoading(false);
  };

  const updatePayout = (tt: string, d: string, val: number) => {
    setPayouts(prev => ({ ...prev, [tt]: { ...prev[tt], [d]: val } }));
    setDirty(true);
  };

  const isModified = (tt: string, d: string) => payouts[tt]?.[d] !== origPayouts[tt]?.[d];

  const errors = useMemo(() => {
    const errs: { tt: string; d: string; msg: string }[] = [];
    for (const tt of TASK_TYPES) {
      for (const d of DOMAINS) {
        const payout = payouts[tt]?.[d] || 0;
        const price = clientPrices[tt]?.[d] || 0;
        if (payout > price && price > 0) {
          errs.push({ tt, d, msg: `Le payout expert (${payout}) dépasse le prix client (${price}) pour ${DOMAIN_LABELS[d]} / ${TASK_TYPE_LABELS[tt]}.` });
        }
      }
    }
    return errs;
  }, [payouts, clientPrices]);

  const hasError = (tt: string, d: string) => errors.some(e => e.tt === tt && e.d === d);

  const handleSave = async () => {
    for (const tt of TASK_TYPES) {
      for (const d of DOMAINS) {
        await (supabase.from("task_pricing" as any) as any)
          .update({ expert_payout: payouts[tt]?.[d] || 0 })
          .eq("task_type", tt).eq("domain", d).eq("active", true);
      }
    }
    const settingsUpdates = [
      { key: "expert_min_withdrawal", value: minWithdrawal.toString() },
      { key: "auto_payout_enabled", value: autoPayoutEnabled },
      { key: "auto_payout_frequency", value: autoPayoutFrequency },
    ];
    for (const u of settingsUpdates) {
      await (supabase.from("platform_settings" as any) as any).update({ value: u.value, updated_at: new Date().toISOString() }).eq("key", u.key);
    }
    setOrigPayouts(structuredClone(payouts));
    setDirty(false);
    setConfirmOpen(false);
    toast.success("Rémunération experts mise à jour.");
  };

  if (loading) return <div className="text-muted-foreground text-sm py-8">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Rémunération experts</h2>
        <p className="text-sm text-muted-foreground mt-1">Montant versé aux experts par tâche complétée et validée (QA passé), en USD.</p>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Type de tâche</th>
                {DOMAINS.map(d => (
                  <th key={d} className="text-right py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold min-w-[90px]">{DOMAIN_LABELS[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TASK_TYPES.map(tt => (
                <tr key={tt} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-foreground text-sm">{TASK_TYPE_LABELS[tt]}</td>
                  {DOMAINS.map(d => (
                    <td key={d} className="py-1 px-1">
                      <Input
                        type="number" step={0.50} min={0}
                        value={payouts[tt]?.[d] ?? 0}
                        onChange={e => updatePayout(tt, d, parseFloat(e.target.value) || 0)}
                        className={cn(
                          "text-right font-mono h-8 text-sm border-transparent focus:border-primary",
                          isModified(tt, d) && "bg-primary/5",
                          hasError(tt, d) && "border-destructive bg-destructive/5"
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {errors.length > 0 && (
            <div className="mt-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">{e.msg}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment settings */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Montant minimum de retrait</Label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <Input type="number" step={5} min={10} max={500} value={minWithdrawal} onChange={e => { setMinWithdrawal(parseInt(e.target.value) || 0); setDirty(true); }} className="font-mono" />
              <span className="text-muted-foreground text-sm">USD</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between max-w-[300px]">
              <Label className="text-sm font-medium">Paiement automatique</Label>
              <Switch checked={autoPayoutEnabled} onCheckedChange={v => { setAutoPayoutEnabled(v); setDirty(true); }} />
            </div>
            {autoPayoutEnabled && (
              <div className="space-y-2 max-w-[300px]">
                <Label className="text-xs text-muted-foreground">Fréquence</Label>
                <Select value={autoPayoutFrequency} onValueChange={v => { setAutoPayoutFrequency(v); setDirty(true); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Toutes les semaines</SelectItem>
                    <SelectItem value="biweekly">Tous les 15 jours</SelectItem>
                    <SelectItem value="monthly">Tous les mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Commission plateforme sur les paiements experts</Label>
            <p className="text-xs text-muted-foreground">Pourcentage retenu par Stripe sur chaque virement (frais Stripe Connect).</p>
            <Input value="2.9% + 0.30 USD" disabled className="max-w-[200px] font-mono opacity-60" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || errors.length > 0}>
          Enregistrer la rémunération
        </Button>
      </div>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={handleSave}
        title="Modifier la rémunération experts ?"
        description="Les nouveaux montants s'appliqueront aux tâches complétées à partir de maintenant."
      />
    </div>
  );
}
