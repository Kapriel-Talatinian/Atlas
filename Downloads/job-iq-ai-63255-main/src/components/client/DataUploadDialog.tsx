import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { parseStructuredDataFile, resolveTextField, SUPPORTED_IMPORT_EXTENSIONS, SUPPORTED_IMPORT_LABEL } from "@/lib/data-import";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface DataUploadDialogProps {
  projectId: string;
  onUploaded: () => void;
}

interface ParsedItem {
  prompt: string;
  response_a?: string;
  response_b?: string;
  response?: string;
  metadata?: Record<string, any>;
}

export const DataUploadDialog = ({ projectId, onUploaded }: DataUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedCount, setParsedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(0);
    setParsedCount(0);

    try {
      const rows = await parseStructuredDataFile(file);
      const items = rows.reduce<ParsedItem[]>((acc, row) => {
        const prompt = resolveTextField(row, "prompt");
        if (!prompt) return acc;

        acc.push({
          prompt,
          response_a: resolveTextField(row, "response_a"),
          response_b: resolveTextField(row, "response_b"),
          response: resolveTextField(row, "response"),
          metadata: row,
        });

        return acc;
      }, []);

      if (items.length === 0) throw new Error("Aucun item trouvé dans le fichier");
      if (items.length > 10000) throw new Error("Maximum 10 000 items par upload");

      setParsedCount(items.length);

      // Create a batch
      const { data: batch, error: batchErr } = await supabase
        .from("annotation_batches")
        .insert({ project_id: projectId, name: file.name, total_items: items.length, status: "active" })
        .select("id")
        .single();
      if (batchErr) throw batchErr;

      // Fetch project complexity level
      const { data: proj } = await supabase
        .from("annotation_projects")
        .select("complexity_level")
        .eq("id", projectId)
        .single();
      const itemComplexity = proj?.complexity_level || 2;

      // Insert items in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const rows = chunk.map(item => {
          // Derive complexity from metadata if available
          const metaComplexity = item.metadata?.complexity_level ?? item.metadata?.complexity ?? item.metadata?.difficulty;
          const parsedComplexity = metaComplexity != null ? parseInt(String(metaComplexity), 10) : NaN;
          const finalComplexity = !isNaN(parsedComplexity) && parsedComplexity >= 1 && parsedComplexity <= 3 ? parsedComplexity : itemComplexity;

          return {
            project_id: projectId,
            batch_id: batch.id,
            content: {
              type: item.response_a && item.response_b ? "text_pair" : "text",
              primary: item.prompt,
              secondary: item.response || undefined,
              alternatives: item.response_a && item.response_b ? [item.response_a, item.response_b] : undefined,
              metadata: item.metadata,
            },
            complexity_level: finalComplexity,
            status: "queued" as const,
            is_gold_standard: false,
            is_calibration: false,
          };
        });

        const { error: insertErr } = await supabase.from("annotation_items").insert(rows);
        if (insertErr) throw insertErr;
        setProgress(Math.round(((i + chunkSize) / items.length) * 100));
      }

      // Update project total_items
      const { data: currentProject } = await supabase
        .from("annotation_projects")
        .select("total_items")
        .eq("id", projectId)
        .single();

      await supabase
        .from("annotation_projects")
        .update({ total_items: (currentProject?.total_items || 0) + items.length })
        .eq("id", projectId);

      // Upload raw file to storage
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.storage
          .from("annotation-uploads")
          .upload(`${user.id}/${projectId}/${file.name}`, file, { upsert: true });
      }

      toast.success(`${items.length} items importés avec succès !`);
      setOpen(false);
      onUploaded();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'import");
      toast.error(err.message || "Erreur lors de l'import");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Upload className="w-4 h-4" />Importer des données</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer des données</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
            {uploading ? (
              <div className="space-y-4">
                <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Import en cours… {parsedCount} items</p>
                <Progress value={progress} className="h-2" />
              </div>
            ) : error ? (
              <div className="space-y-3">
                <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => { setError(null); fileRef.current?.click(); }}>Réessayer</Button>
              </div>
            ) : (
              <>
                <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Glissez ou sélectionnez un fichier</p>
                 <p className="text-xs text-muted-foreground mb-4">{SUPPORTED_IMPORT_LABEL} — max 10 000 items</p>
                <Button variant="outline" onClick={() => fileRef.current?.click()}>Choisir un fichier</Button>
              </>
            )}
            <input ref={fileRef} type="file" accept={SUPPORTED_IMPORT_EXTENSIONS} onChange={handleFile} className="hidden" />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-xs space-y-2">
            <p className="font-medium text-foreground">Format attendu :</p>
            <div className="space-y-1 text-muted-foreground">
              <p><strong>CSV / Excel :</strong> prompt, input, question, output, response_a, response_b…</p>
              <p><strong>JSON/JSONL :</strong> {`{"prompt": "...", "response_a": "...", "response_b": "..."}`}</p>
              <p>Pour le scoring simple : prompt, response</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
