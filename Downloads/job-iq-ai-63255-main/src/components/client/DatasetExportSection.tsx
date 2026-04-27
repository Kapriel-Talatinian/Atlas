import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Lock, CheckCircle2, Loader2, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  project: any;
  completedTasks: number;
  totalTasks: number;
  globalAlpha?: number | null;
}

function useExportTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  return elapsed;
}

function formatEta(elapsedSec: number, totalItems: number): string {
  // Estimate ~0.5s per 100 items based on benchmarks
  const estimatedTotal = Math.max(Math.ceil(totalItems / 100) * 0.5 + 3, 5);
  const remaining = Math.max(Math.ceil(estimatedTotal - elapsedSec), 1);
  if (remaining <= 1) return "Finalisation...";
  if (remaining < 60) return `~${remaining}s restantes`;
  return `~${Math.ceil(remaining / 60)}min restantes`;
}

export const DatasetExportSection = ({ projectId, project, completedTasks, totalTasks, globalAlpha }: Props) => {
  const [format, setFormat] = useState("jsonl");
  const [minAlpha, setMinAlpha] = useState("0.80");
  const [includeReasoning, setIncludeReasoning] = useState(false);
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportPhase, setExportPhase] = useState<string>("");

  const elapsed = useExportTimer(exporting);

  const isCompleted = project.status === "completed";
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleExport = async () => {
    setExporting(true);
    setDownloadUrl(null);
    setExportPhase("Initialisation de l'export...");

    try {
      const { data, error } = await supabase.functions.invoke("client-api", {
        body: {
          path: `/projects/${projectId}/export`,
          method: "POST",
          body: {
            format,
            min_alpha: parseFloat(minAlpha),
            include_reasoning: includeReasoning,
            include_raw_annotations: includeDimensions,
          },
        },
      });

      if (error) throw error;

      if (data?.error) {
        setExportPhase("");
        setExporting(false);
        toast.error(data.error.message || data.error);
        return;
      }

      if (!data?.export_id) {
        setExportPhase("");
        setExporting(false);
        toast.error("Impossible de démarrer l'export");
        return;
      }

      setExportPhase("Collecte des items validés...");

      void (async () => {
        try {
          for (let i = 0; i < 60; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            if (i === 2) setExportPhase("Vérification des scores Alpha...");
            if (i === 5) setExportPhase("Formatage du dataset...");
            if (i === 10) setExportPhase("Upload vers le stockage sécurisé...");
            if (i === 20) setExportPhase("Génération de l'URL signée...");

            const { data: exportData, error: statusError } = await supabase.functions.invoke("export-dataset", {
              body: { action: "get_download_url", export_id: data.export_id },
            });

            if (statusError) {
              if (i === 59) throw statusError;
              continue;
            }

            if (exportData?.status === "ready" && exportData?.download_url) {
              setDownloadUrl(exportData.download_url);
              setExportPhase("");
              toast.success("Dataset prêt au téléchargement !");
              return;
            }

            if (exportData?.status === "failed") {
              setExportPhase("");
              toast.error(exportData.error_message || "L'export a échoué");
              return;
            }
          }

          setExportPhase("");
          toast.error("L'export a pris trop de temps. Veuillez réessayer.");
        } catch (pollError: any) {
          setExportPhase("");
          toast.error(pollError.message || "Erreur lors du suivi de l'export");
        } finally {
          setExporting(false);
        }
      })();
    } catch (err: any) {
      setExportPhase("");
      setExporting(false);
      toast.error(err.message || "Erreur lors de l'export");
    }
  };

  const handleDownloadReport = async () => {
    setGeneratingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-delivery-report", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: "text/html; charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success("Rapport généré — utilisez Ctrl+P pour sauvegarder en PDF");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la génération du rapport");
    } finally {
      setGeneratingReport(false);
    }
  };

  // LOCKED state
  if (!isCompleted) {
    return (
      <Card className="opacity-80 border-border">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Dataset final</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Votre dataset sera disponible au téléchargement une fois l'ensemble des tâches annotées et validées par le contrôle qualité.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Avancement : {completedTasks} / {totalTasks} tâches validées ({completionPercent}%)
              </span>
            </div>
            <Progress value={completionPercent} className="h-2" />
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button disabled className="gap-2 cursor-not-allowed opacity-50">
                  <Download className="w-4 h-4" /> Exporter le dataset
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Disponible quand 100% des tâches sont validées.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <p className="text-xs text-muted-foreground">
            Le dataset ne peut être exporté qu'après validation complète du projet pour garantir la cohérence des données.
          </p>
        </CardContent>
      </Card>
    );
  }

  // UNLOCKED state
  return (
    <Card className="border-l-[3px] border-l-success">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <h3 className="font-semibold text-foreground">Dataset final</h3>
          </div>
          <Badge className="bg-success/10 text-success border-success/20">Prêt</Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          {completedTasks} / {totalTasks} tâches validées
          {globalAlpha != null && ` · Alpha moyen : ${globalAlpha.toFixed(2)}`}
        </p>

        {/* Format selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Format d'export :</p>
          <div className="flex gap-3">
            {[
              { value: "jsonl", label: "JSONL (.jsonl)" },
              { value: "parquet", label: "Parquet (.parquet)" },
              { value: "huggingface", label: "HuggingFace Dataset" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={(e) => setFormat(e.target.value)}
                  className="accent-primary"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Alpha threshold */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Seuil alpha minimum :</span>
          <select
            value={minAlpha}
            onChange={(e) => setMinAlpha(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-sm"
          >
            <option value="0.75">0.75</option>
            <option value="0.80">0.80</option>
            <option value="0.85">0.85</option>
            <option value="0.90">0.90</option>
          </select>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeReasoning} onChange={(e) => setIncludeReasoning(e.target.checked)} className="accent-primary" />
            <span className="text-sm">Inclure les raisonnements des annotateurs</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeDimensions} onChange={(e) => setIncludeDimensions(e.target.checked)} className="accent-primary" />
            <span className="text-sm">Inclure les scores par dimension</span>
          </label>
        </div>

        {/* Export status */}
        {exporting && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{exportPhase || "Traitement..."}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {formatEta(elapsed, totalTasks)} · {elapsed}s écoulées
              </p>
            </div>
          </div>
        )}

        {/* Export buttons */}
        <div className="flex flex-wrap gap-3">
          {downloadUrl ? (
            <Button className="gap-2 bg-success hover:bg-success/90" onClick={() => window.open(downloadUrl, "_blank")}>
              <Download className="w-4 h-4" /> Télécharger le dataset
            </Button>
          ) : (
            <Button className="gap-2" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? formatEta(elapsed, totalTasks) : "Exporter le dataset"}
            </Button>
          )}

          <Button variant="outline" className="gap-2" onClick={handleDownloadReport} disabled={generatingReport}>
            {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generatingReport ? "Génération..." : "Rapport de livraison"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
