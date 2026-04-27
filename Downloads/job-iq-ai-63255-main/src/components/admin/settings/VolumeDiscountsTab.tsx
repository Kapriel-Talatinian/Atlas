import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import { Plus, X } from "lucide-react";

interface Tier {
  id?: string;
  min_tasks: number;
  max_tasks: number | null;
  discount_percent: number;
}

const DEFAULT_TIERS: Tier[] = [
  { min_tasks: 1, max_tasks: 499, discount_percent: 0 },
  { min_tasks: 500, max_tasks: 1999, discount_percent: 5 },
  { min_tasks: 2000, max_tasks: 4999, discount_percent: 10 },
  { min_tasks: 5000, max_tasks: 9999, discount_percent: 15 },
  { min_tasks: 10000, max_tasks: null, discount_percent: 20 },
];

interface VolumeDiscountsTabProps {
  onDirtyChange: (dirty: boolean) => void;
}

export function VolumeDiscountsTab({ onDirtyChange }: VolumeDiscountsTabProps) {
  const [tiers, setTiers] = useState<Tier[]>(structuredClone(DEFAULT_TIERS));
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [simTasks, setSimTasks] = useState(1000);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const loadData = async () => {
    const { data } = await supabase.from("volume_discounts" as any).select("*").eq("active", true).order("min_tasks", { ascending: true });
    if (data && (data as any[]).length > 0) {
      setTiers((data as any[]).map((d: any) => ({ id: d.id, min_tasks: d.min_tasks, max_tasks: d.max_tasks, discount_percent: d.discount_percent })));
    }
    setLoading(false);
  };

  const updateTier = (index: number, field: keyof Tier, value: number | null) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
    setDirty(true);
  };

  const addTier = () => {
    const lastReal = tiers[tiers.length - 2];
    const newMin = (lastReal?.max_tasks || 0) + 1;
    const infinityTier = tiers[tiers.length - 1];
    const newTier: Tier = { min_tasks: newMin, max_tasks: newMin + 999, discount_percent: (lastReal?.discount_percent || 0) + 5 };
    const updated = [...tiers.slice(0, -1), newTier, { ...infinityTier, min_tasks: newMin + 1000 }];
    setTiers(updated);
    setDirty(true);
  };

  const removeTier = (index: number) => {
    if (index === tiers.length - 1) return;
    setTiers(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].discount_percent < tiers[i - 1].discount_percent) {
        errs.push("Les remises doivent être croissantes.");
        break;
      }
    }
    for (const t of tiers) {
      if (t.discount_percent > 50) { errs.push("La remise maximale est 50%."); break; }
    }
    return errs;
  }, [tiers]);

  const simDiscount = useMemo(() => {
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (simTasks >= tiers[i].min_tasks) return tiers[i].discount_percent;
    }
    return 0;
  }, [simTasks, tiers]);

  const handleSave = async () => {
    // Deactivate old, insert new
    await (supabase.from("volume_discounts" as any) as any).update({ active: false }).eq("active", true);
    for (const t of tiers) {
      await (supabase.from("volume_discounts" as any) as any).insert({
        min_tasks: t.min_tasks,
        max_tasks: t.max_tasks,
        discount_percent: t.discount_percent,
        active: true,
      });
    }
    setDirty(false);
    setConfirmOpen(false);
    toast.success("Remises volume mises à jour.");
  };

  if (loading) return <div className="text-muted-foreground text-sm py-8">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Remises volume</h2>
        <p className="text-sm text-muted-foreground mt-1">Réductions automatiques appliquées au prix client en fonction du nombre total de tâches dans un projet.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs uppercase text-muted-foreground font-semibold">À partir de</th>
                <th className="text-left py-2 text-xs uppercase text-muted-foreground font-semibold">Jusqu'à</th>
                <th className="text-left py-2 text-xs uppercase text-muted-foreground font-semibold">Remise</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-2">
                    <Input type="number" min={0} value={t.min_tasks}
                      onChange={e => updateTier(i, "min_tasks", parseInt(e.target.value) || 0)}
                      className="h-8 font-mono w-[120px]" />
                  </td>
                  <td className="py-2 pr-2">
                    {t.max_tasks === null ? (
                      <span className="text-muted-foreground font-mono text-sm px-3">∞</span>
                    ) : (
                      <Input type="number" min={0} value={t.max_tasks}
                        onChange={e => updateTier(i, "max_tasks", parseInt(e.target.value) || 0)}
                        className="h-8 font-mono w-[120px]" />
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} max={50} step={1}
                        value={t.discount_percent}
                        onChange={e => updateTier(i, "discount_percent", parseFloat(e.target.value) || 0)}
                        className="h-8 font-mono w-[80px]" />
                      <span className="text-muted-foreground text-sm">%</span>
                    </div>
                  </td>
                  <td className="py-2">
                    {i < tiers.length - 1 && (
                      <button onClick={() => removeTier(i)} className="text-muted-foreground hover:text-destructive p-1">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button variant="outline" size="sm" className="mt-3" onClick={addTier}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter un palier
          </Button>
          {validationErrors.map((e, i) => (
            <p key={i} className="text-xs text-destructive mt-2">{e}</p>
          ))}
        </CardContent>
      </Card>

      {/* Simulator */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Simulateur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Nombre de tâches :</Label>
              <Input type="number" min={1} value={simTasks} onChange={e => setSimTasks(parseInt(e.target.value) || 1)} className="w-[120px] h-8 font-mono" />
            </div>
            <div className="text-sm text-muted-foreground">
              Remise applicable : <span className="font-semibold text-foreground">{simDiscount}%</span>
              {" — "}Prix unitaire après remise : <span className="font-semibold text-foreground font-mono">{(25 * (1 - simDiscount / 100)).toFixed(2)} USD</span>
              <span className="text-xs"> (ex. Scoring Code Standard)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || validationErrors.length > 0}>
          Enregistrer les remises
        </Button>
      </div>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={handleSave}
        title="Modifier les remises volume ?"
        description="Les nouveaux paliers s'appliqueront immédiatement aux devis et factures."
      />
    </div>
  );
}
