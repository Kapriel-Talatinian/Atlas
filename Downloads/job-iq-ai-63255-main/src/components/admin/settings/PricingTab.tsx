import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import { DOMAINS, DOMAIN_LABELS, TASK_TYPES, TASK_TYPE_LABELS, DEFAULT_CLIENT_PRICES, DEFAULT_EXPERT_PAYOUTS, SLA_DEFAULTS } from "./settingsConstants";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingTabProps {
  onDirtyChange: (dirty: boolean) => void;
}

export function PricingTab({ onDirtyChange }: PricingTabProps) {
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>(structuredClone(DEFAULT_CLIENT_PRICES));
  const [origPrices, setOrigPrices] = useState<Record<string, Record<string, number>>>(structuredClone(DEFAULT_CLIENT_PRICES));
  const [bilingualSurcharge, setBilingualSurcharge] = useState(20);
  const [origBilingual, setOrigBilingual] = useState(20);
  const [expertPayouts, setExpertPayouts] = useState<Record<string, Record<string, number>>>(structuredClone(DEFAULT_EXPERT_PAYOUTS));
  const [slaMultipliers, setSlaMultipliers] = useState(SLA_DEFAULTS.map(s => ({ name: s.tier_name, multiplier: s.price_multiplier })));
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slaOpen, setSlaOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const loadData = async () => {
    const { data: pricingData } = await supabase.from("task_pricing" as any).select("*").eq("active", true);
    if (pricingData && (pricingData as any[]).length > 0) {
      const p: Record<string, Record<string, number>> = {};
      const e: Record<string, Record<string, number>> = {};
      for (const row of pricingData as any[]) {
        if (!p[row.task_type]) p[row.task_type] = {};
        if (!e[row.task_type]) e[row.task_type] = {};
        p[row.task_type][row.domain] = row.client_unit_price;
        e[row.task_type][row.domain] = row.expert_payout;
      }
      if (Object.keys(p).length > 0) {
        setPrices(prev => ({ ...prev, ...p }));
        setOrigPrices(prev => ({ ...prev, ...p }));
      }
      if (Object.keys(e).length > 0) setExpertPayouts(prev => ({ ...prev, ...e }));
    }

    const { data: slaData } = await supabase.from("sla_tiers" as any).select("*").eq("active", true);
    if (slaData && (slaData as any[]).length > 0) {
      setSlaMultipliers((slaData as any[]).map((s: any) => ({ name: s.tier_name, multiplier: s.price_multiplier })));
    }

    const { data: settingData } = await supabase.from("platform_settings" as any).select("key, value").eq("key", "bilingual_surcharge_percent");
    if (settingData && (settingData as any[]).length > 0) {
      const val = parseFloat(String((settingData as any[])[0].value));
      setBilingualSurcharge(val);
      setOrigBilingual(val);
    }

    setLoading(false);
  };

  const updatePrice = (taskType: string, domain: string, value: number) => {
    setPrices(prev => ({ ...prev, [taskType]: { ...prev[taskType], [domain]: value } }));
    setDirty(true);
  };

  const isModified = (taskType: string, domain: string) => {
    return prices[taskType]?.[domain] !== origPrices[taskType]?.[domain];
  };

  const margins = useMemo(() => {
    const result: Record<string, number> = {};
    for (const domain of DOMAINS) {
      let totalClient = 0, totalExpert = 0, count = 0;
      for (const tt of TASK_TYPES) {
        const cp = prices[tt]?.[domain] || 0;
        const ep = expertPayouts[tt]?.[domain] || 0;
        if (cp > 0) {
          totalClient += cp;
          totalExpert += ep;
          count++;
        }
      }
      result[domain] = totalClient > 0 ? ((totalClient - totalExpert) / totalClient) * 100 : 0;
    }
    return result;
  }, [prices, expertPayouts]);

  const handleSave = async () => {
    for (const tt of TASK_TYPES) {
      for (const domain of DOMAINS) {
        await (supabase.from("task_pricing" as any) as any)
          .update({ client_unit_price: prices[tt]?.[domain] || 0 })
          .eq("task_type", tt)
          .eq("domain", domain)
          .eq("active", true);
      }
    }
    await (supabase.from("platform_settings" as any) as any)
      .update({ value: bilingualSurcharge.toString(), updated_at: new Date().toISOString() })
      .eq("key", "bilingual_surcharge_percent");

    setOrigPrices(structuredClone(prices));
    setOrigBilingual(bilingualSurcharge);
    setDirty(false);
    setConfirmOpen(false);
    toast.success("Tarification mise à jour.");
  };

  if (loading) return <div className="text-muted-foreground text-sm py-8">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Tarification client</h2>
        <p className="text-sm text-muted-foreground mt-1">Prix facturé aux clients par tâche, en USD. Prix Standard (SLA ×1.0). Les multiplicateurs SLA s'appliquent automatiquement.</p>
      </div>

      {/* Pricing grid */}
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Type de tâche</th>
                {DOMAINS.map(d => (
                  <th key={d} className="text-right py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold min-w-[90px]">
                    {DOMAIN_LABELS[d]}
                  </th>
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
                        type="number" step={0.50} min={1}
                        value={prices[tt]?.[d] ?? 0}
                        onChange={e => updatePrice(tt, d, parseFloat(e.target.value) || 0)}
                        className={cn(
                          "text-right font-mono h-8 text-sm border-transparent focus:border-primary",
                          isModified(tt, d) && "bg-primary/5"
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Bilingual surcharge */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Surcoût bilingue (FR+EN)</Label>
            <p className="text-xs text-muted-foreground">Pourcentage ajouté au prix de base quand le client choisit français + anglais.</p>
            <div className="flex items-center gap-2 max-w-[200px]">
              <Input
                type="number" step={1} min={0} max={50}
                value={bilingualSurcharge}
                onChange={e => { setBilingualSurcharge(parseInt(e.target.value) || 0); setDirty(true); }}
                className="font-mono"
              />
              <span className="text-muted-foreground text-sm">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SLA preview */}
      <Collapsible open={slaOpen} onOpenChange={setSlaOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Voir les prix avec SLA</CardTitle>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", slaOpen && "rotate-180")} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-semibold">Tâche — Domaine</th>
                    {slaMultipliers.map(s => (
                      <th key={s.name} className="text-right py-2 px-2 text-muted-foreground font-semibold capitalize">
                        {s.name} (×{s.multiplier})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TASK_TYPES.slice(0, 4).map(tt =>
                    DOMAINS.map(d => (
                      <tr key={`${tt}-${d}`} className="border-b border-border/30">
                        <td className="py-1.5 pr-4 text-foreground">{TASK_TYPE_LABELS[tt]} — {DOMAIN_LABELS[d]}</td>
                        {slaMultipliers.map(s => (
                          <td key={s.name} className="text-right py-1.5 px-2 font-mono text-muted-foreground">
                            {((prices[tt]?.[d] || 0) * s.multiplier).toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Margins */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Marges estimées</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {DOMAINS.map(d => {
              const m = margins[d];
              const color = m >= 60 ? "text-emerald-600" : m >= 40 ? "text-amber-600" : "text-red-600";
              return (
                <div key={d} className="text-center">
                  <div className={cn("text-xl font-bold font-mono", color)}>{m.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground mt-1">{DOMAIN_LABELS[d]}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setConfirmOpen(true)} disabled={!dirty}>
          Enregistrer la tarification
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleSave}
        title="Modifier la tarification ?"
        description="Les nouveaux prix s'appliqueront immédiatement à tous les nouveaux projets."
      />
    </div>
  );
}
