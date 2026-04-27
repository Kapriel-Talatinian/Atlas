import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import { SLA_DEFAULTS } from "./settingsConstants";
import { cn } from "@/lib/utils";

interface SLATier {
  id?: string;
  tier_name: string;
  price_multiplier: number;
  guaranteed_min_alpha: number;
  min_annotators_per_task: number;
  max_delivery_multiplier: number;
  active: boolean;
}

interface SLATabProps {
  onDirtyChange: (dirty: boolean) => void;
}

const TIER_LABELS: Record<string, string> = { standard: "Standard", priority: "Prioritaire", express: "Express" };

export function SLATab({ onDirtyChange }: SLATabProps) {
  const [tiers, setTiers] = useState<SLATier[]>(SLA_DEFAULTS.map(s => ({ ...s })));
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const loadData = async () => {
    const { data } = await supabase.from("sla_tiers" as any).select("*").order("price_multiplier", { ascending: true });
    if (data && (data as any[]).length > 0) {
      setTiers((data as any[]).map((d: any) => ({
        id: d.id, tier_name: d.tier_name, price_multiplier: d.price_multiplier,
        guaranteed_min_alpha: d.guaranteed_min_alpha, min_annotators_per_task: d.min_annotators_per_task,
        max_delivery_multiplier: d.max_delivery_multiplier, active: d.active,
      })));
    }
    setLoading(false);
  };

  const updateTier = (index: number, field: keyof SLATier, value: any) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
    setDirty(true);
  };

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].price_multiplier <= tiers[i - 1].price_multiplier) errs.push("Les multiplicateurs prix doivent être croissants.");
      if (tiers[i].guaranteed_min_alpha <= tiers[i - 1].guaranteed_min_alpha) errs.push("Les alpha garantis doivent être croissants.");
      if (tiers[i].max_delivery_multiplier >= tiers[i - 1].max_delivery_multiplier) errs.push("Les multiplicateurs délai doivent être décroissants.");
    }
    return [...new Set(errs)];
  }, [tiers]);

  const handleSave = async () => {
    for (const t of tiers) {
      if (t.id) {
        await (supabase.from("sla_tiers" as any) as any).update({
          price_multiplier: t.price_multiplier, guaranteed_min_alpha: t.guaranteed_min_alpha,
          min_annotators_per_task: t.min_annotators_per_task, max_delivery_multiplier: t.max_delivery_multiplier, active: t.active,
        }).eq("id", t.id);
      }
    }
    setDirty(false);
    setConfirmOpen(false);
    toast.success("Niveaux de service mis à jour.");
  };

  // Preview example: 1000 tasks Scoring Medical, base price = 35
  const basePrice = 35;
  const baseDays = 14;
  const preview = tiers.map(t => ({
    name: TIER_LABELS[t.tier_name] || t.tier_name,
    pricePerTask: (basePrice * t.price_multiplier).toFixed(2),
    total: (basePrice * t.price_multiplier * 1000).toLocaleString("fr-FR"),
    alpha: t.guaranteed_min_alpha,
    annotators: t.min_annotators_per_task,
    days: Math.max(3, Math.ceil(baseDays * t.max_delivery_multiplier)),
  }));

  if (loading) return <div className="text-muted-foreground text-sm py-8">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Niveaux de service</h2>
        <p className="text-sm text-muted-foreground mt-1">Configuration des 3 niveaux de SLA proposés aux clients.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map((t, i) => (
          <Card key={t.tier_name} className={cn(!t.active && "opacity-50")}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{TIER_LABELS[t.tier_name] || t.tier_name}</CardTitle>
                {t.tier_name === "priority" && <Badge variant="secondary" className="text-xs">Recommandé</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Multiplicateur prix</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" step={0.1} min={1} max={5} value={t.price_multiplier}
                    onChange={e => updateTier(i, "price_multiplier", parseFloat(e.target.value) || 1)}
                    className="w-[80px] h-7 text-right font-mono text-sm" />
                  <span className="text-xs text-muted-foreground">×</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Alpha minimum garanti</Label>
                <Input type="number" step={0.01} min={0.5} max={1} value={t.guaranteed_min_alpha}
                  onChange={e => updateTier(i, "guaranteed_min_alpha", parseFloat(e.target.value) || 0.5)}
                  className="w-[80px] h-7 text-right font-mono text-sm" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Annotateurs par tâche</Label>
                <Input type="number" step={1} min={1} max={5} value={t.min_annotators_per_task}
                  onChange={e => updateTier(i, "min_annotators_per_task", parseInt(e.target.value) || 1)}
                  className="w-[80px] h-7 text-right font-mono text-sm" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Multiplicateur délai</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" step={0.1} min={0.1} max={2} value={t.max_delivery_multiplier}
                    onChange={e => updateTier(i, "max_delivery_multiplier", parseFloat(e.target.value) || 0.1)}
                    className="w-[80px] h-7 text-right font-mono text-sm" />
                  <span className="text-xs text-muted-foreground">×</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Label className="text-xs text-muted-foreground">Actif</Label>
                <Switch checked={t.active} onCheckedChange={v => updateTier(i, "active", v)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {validationErrors.length > 0 && (
        <div className="space-y-1">
          {validationErrors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
        </div>
      )}

      {/* Preview */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Exemple : 1 000 tâches de Scoring Médical</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground font-semibold"></th>
                {preview.map(p => <th key={p.name} className="text-right py-2 px-3 text-xs text-muted-foreground font-semibold">{p.name}</th>)}
              </tr>
            </thead>
            <tbody className="text-foreground">
              <tr className="border-b border-border/30">
                <td className="py-2 text-muted-foreground">Prix/tâche</td>
                {preview.map(p => <td key={p.name} className="text-right py-2 px-3 font-mono">{p.pricePerTask}</td>)}
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2 text-muted-foreground">Total</td>
                {preview.map(p => <td key={p.name} className="text-right py-2 px-3 font-mono">{p.total}</td>)}
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2 text-muted-foreground">Alpha garanti</td>
                {preview.map(p => <td key={p.name} className="text-right py-2 px-3 font-mono">≥ {p.alpha}</td>)}
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2 text-muted-foreground">Annotateurs</td>
                {preview.map(p => <td key={p.name} className="text-right py-2 px-3">{p.annotators}</td>)}
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Délai estimé</td>
                {preview.map(p => <td key={p.name} className="text-right py-2 px-3">{p.days} jours</td>)}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || validationErrors.length > 0}>
          Enregistrer les niveaux de service
        </Button>
      </div>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={handleSave}
        title="Modifier les niveaux de service ?"
        description="Les modifications impactent immédiatement les prix et les engagements de qualité pour tous les nouveaux projets."
      />
    </div>
  );
}
