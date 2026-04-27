import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";
import { X, Plus } from "lucide-react";

const ALL_DIMENSIONS = [
  "correctness", "safety", "security", "code_quality", "reasoning_depth",
  "edge_case_handling", "documentation_quality", "performance_awareness",
  "error_handling", "communication_clarity",
];

interface QualityTabProps {
  onDirtyChange: (dirty: boolean) => void;
}

export function QualityTab({ onDirtyChange }: QualityTabProps) {
  const [autoValidate, setAutoValidate] = useState(0.80);
  const [flag, setFlag] = useState(0.67);
  const [criticalDims, setCriticalDims] = useState<string[]>(["correctness", "safety"]);
  const [driftThreshold, setDriftThreshold] = useState(0.05);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("platform_settings" as any)
      .select("key, value")
      .in("key", ["alpha_auto_validate", "alpha_flag", "critical_dimensions", "drift_threshold"]);
    if (data) {
      for (const row of data as any[]) {
        const val = row.value;
        switch (row.key) {
          case "alpha_auto_validate": setAutoValidate(parseFloat(typeof val === "string" ? val : String(val))); break;
          case "alpha_flag": setFlag(parseFloat(typeof val === "string" ? val : String(val))); break;
          case "critical_dimensions": setCriticalDims(Array.isArray(val) ? val : JSON.parse(val)); break;
          case "drift_threshold": setDriftThreshold(parseFloat(typeof val === "string" ? val : String(val))); break;
        }
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const updates = [
      { key: "alpha_auto_validate", value: JSON.stringify(autoValidate.toString()) },
      { key: "alpha_flag", value: JSON.stringify(flag.toString()) },
      { key: "critical_dimensions", value: JSON.stringify(criticalDims) },
      { key: "drift_threshold", value: JSON.stringify(driftThreshold.toString()) },
    ];
    for (const u of updates) {
      await (supabase.from("platform_settings" as any) as any).update({ value: JSON.parse(u.value), updated_at: new Date().toISOString() }).eq("key", u.key);
    }
    setDirty(false);
    setConfirmOpen(false);
    toast.success("Seuils de qualité mis à jour.");
  };

  const flagError = flag >= autoValidate;
  const availableDims = ALL_DIMENSIONS.filter(d => !criticalDims.includes(d));

  const getAlphaBadge = (val: number) => {
    if (val >= 0.80) return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Strict</Badge>;
    if (val >= 0.70) return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Modéré</Badge>;
    return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Permissif — risque de qualité</Badge>;
  };

  const markDirty = () => setDirty(true);

  if (loading) return <div className="text-muted-foreground text-sm py-8">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Seuils de qualité</h2>
        <p className="text-sm text-muted-foreground mt-1">Ces seuils déterminent quand une annotation est automatiquement validée ou flaggée pour revue humaine.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Auto-validation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Seuil d'auto-validation (Krippendorff's Alpha)</Label>
              {getAlphaBadge(autoValidate)}
            </div>
            <p className="text-xs text-muted-foreground">Les items avec un Alpha supérieur ou égal à ce seuil sont automatiquement validés et entrent dans le dataset final.</p>
            <Input
              type="number" step={0.01} min={0.50} max={1.00}
              value={autoValidate}
              onChange={e => { setAutoValidate(parseFloat(e.target.value) || 0); markDirty(); }}
              className="max-w-[200px] font-mono"
            />
          </div>

          {/* Flag */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Seuil de flag pour revue humaine</Label>
              {getAlphaBadge(flag)}
            </div>
            <p className="text-xs text-muted-foreground">Les items en dessous de ce seuil sont automatiquement ajoutés à la file de revue humaine.</p>
            <Input
              type="number" step={0.01} min={0.30} max={0.80}
              value={flag}
              onChange={e => { setFlag(parseFloat(e.target.value) || 0); markDirty(); }}
              className="max-w-[200px] font-mono"
            />
            {flagError && (
              <p className="text-xs text-destructive">Le seuil de flag doit être inférieur au seuil d'auto-validation.</p>
            )}
          </div>

          {/* Critical dimensions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Dimensions critiques</Label>
            <p className="text-xs text-muted-foreground">
              Ces dimensions sont flaggées dès que leur Alpha est inférieur au seuil d'auto-validation, indépendamment de l'Alpha global.
            </p>
            <div className="flex flex-wrap gap-2">
              {criticalDims.map(d => (
                <Badge key={d} variant="secondary" className="gap-1 pr-1">
                  {d}
                  <button onClick={() => { setCriticalDims(prev => prev.filter(x => x !== d)); markDirty(); }} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {availableDims.length > 0 && (
                <select
                  className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
                  value=""
                  onChange={e => { if (e.target.value) { setCriticalDims(prev => [...prev, e.target.value]); markDirty(); } }}
                >
                  <option value="">Ajouter...</option>
                  {availableDims.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Drift */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Seuil de détection de dérive</Label>
            <p className="text-xs text-muted-foreground">Si l'Alpha moyen baisse de plus de cette valeur entre deux batches consécutifs, une alerte est déclenchée.</p>
            <Input
              type="number" step={0.01} min={0.01} max={0.20}
              value={driftThreshold}
              onChange={e => { setDriftThreshold(parseFloat(e.target.value) || 0); markDirty(); }}
              className="max-w-[200px] font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* Impact preview */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Impact actuel de ces seuils</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">—</div>
              <div className="text-xs text-muted-foreground mt-1">Items auto-validés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">—</div>
              <div className="text-xs text-muted-foreground mt-1">Zone grise</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">—</div>
              <div className="text-xs text-muted-foreground mt-1">Items flaggés</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || flagError}>
          Enregistrer les seuils de qualité
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleSave}
        title="Modifier les seuils de qualité ?"
        description="Ces modifications impactent immédiatement la validation automatique et le flagging des annotations sur toute la plateforme."
      />
    </div>
  );
}
