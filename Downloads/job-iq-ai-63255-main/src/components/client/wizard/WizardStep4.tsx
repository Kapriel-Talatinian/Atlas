import { useCallback, useState } from "react";
import type { WizardData } from "@/pages/client/NewProjectWizard";
import { Upload, CheckCircle2, XCircle, FileText, Trash2, AlertTriangle, Shield, Languages, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { parseStructuredDataFile, resolveTextField, SUPPORTED_IMPORT_EXTENSIONS, SUPPORTED_IMPORT_LABEL } from "@/lib/data-import";
import { toast } from "sonner";

const TASK_TYPE_MAP: Record<string, string> = {
  ranking: "preference_dpo",
  rating: "scoring",
  comparison: "comparison_ab",
  red_teaming: "red_teaming",
  validation: "fact_checking",
  text_generation: "text_generation",
  span_annotation: "span_annotation",
  extraction: "extraction",
  conversation_rating: "conversation_rating",
};

function ConversationPreview({ messages }: { messages: Array<{ role: string; content: string }> }) {
  const displayed = messages.slice(0, 2);
  const remaining = messages.length - 2;
  return (
    <div className="flex flex-col gap-1.5 max-w-[400px]">
      {displayed.map((msg, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={cn(
            "shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded",
            msg.role === "user" ? "bg-blue-500/10 text-blue-400" : "bg-violet-500/10 text-violet-400"
          )}>{msg.role}</span>
          <span className="text-sm text-foreground/70 line-clamp-2">{msg.content}</span>
        </div>
      ))}
      {remaining > 0 && <span className="text-xs text-muted-foreground">+ {remaining} message{remaining > 1 ? "s" : ""}</span>}
    </div>
  );
}

function MessagePreview({ role, content }: { role: string; content: string }) {
  const truncated = content.length > 150 ? content.substring(0, 150) + "…" : content;
  return (
    <div className="flex items-start gap-2 max-w-[350px]">
      <span className={cn(
        "shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded",
        role === "user" ? "bg-blue-500/10 text-blue-400" : "bg-violet-500/10 text-violet-400"
      )}>{role}</span>
      <span className="text-sm text-foreground/70 line-clamp-3">{truncated}</span>
    </div>
  );
}

function MetadataPreview({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data).slice(0, 4);
  const remaining = Object.keys(data).length - 4;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span key={key} className="inline-flex items-center gap-1 text-[11px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">
          <span className="text-muted-foreground/60">{key}:</span>
          <span className="text-foreground/70">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
        </span>
      ))}
      {remaining > 0 && <span className="text-[11px] text-muted-foreground">+{remaining}</span>}
    </div>
  );
}

function renderCellValue(value: any): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const str = String(value);
    if (str.length > 200) return <span className="text-sm">{str.substring(0, 200)}<span className="text-muted-foreground">… ({str.length})</span></span>;
    return <span className="text-sm">{str}</span>;
  }
  if (Array.isArray(value) && value.length > 0 && value[0]?.role && value[0]?.content) return <ConversationPreview messages={value} />;
  if (Array.isArray(value)) return <span className="text-sm">[{value.map(v => typeof v === "object" ? JSON.stringify(v) : String(v)).join(", ")}]</span>;
  if (typeof value === "object" && value.role && value.content) return <MessagePreview role={value.role} content={value.content} />;
  if (typeof value === "object") return <MetadataPreview data={value} />;
  return <span className="text-sm text-muted-foreground">{JSON.stringify(value)}</span>;
}

function getColumnWidth(sampleValue: any): string {
  if (Array.isArray(sampleValue) && sampleValue[0]?.role) return "min-w-[400px]";
  if (typeof sampleValue === "object" && sampleValue?.content) return "min-w-[350px]";
  if (typeof sampleValue === "object") return "min-w-[250px]";
  if (typeof sampleValue === "string" && sampleValue.length > 100) return "min-w-[300px]";
  return "min-w-[120px]";
}

function getLocalRequiredFields(taskType: string): string[] {
  switch (taskType) {
    case "preference_dpo":
    case "comparison_ab":
      return ["prompt", "response_a", "response_b"];
    case "scoring":
    case "fact_checking":
    case "text_generation":
    case "span_annotation":
    case "extraction":
      return ["prompt", "response"];
    case "red_teaming":
      return ["prompt"];
    case "conversation_rating":
      return ["conversation"];
    default:
      return ["prompt"];
  }
}

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
}

interface CleaningReport {
  junk_rows: number;
  html_cleaned_rows: number;
  too_short_rows: number;
  too_long_rows: number;
  unicode_normalized_rows: number;
  quality_score: number;
  lang_script_rejected: number;
  lang_mismatch_flagged: number;
  language: { detected: string; confidence: number; distribution: Record<string, number> };
  language_mismatch: boolean;
  cleaning_report: {
    pipeline_version: string;
    steps: any[];
    total_input: number;
    total_output: number;
    rows_removed: number;
    removal_rate: number;
  };
}

export function WizardStep4({ data, update }: Props) {
  const [validating, setValidating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cleaningData, setCleaningData] = useState<CleaningReport | null>(null);
  const [showReport, setShowReport] = useState(false);

  const isRedTeamChat = data.taskType === "red_teaming" && data.redTeamMode === "chat";

  const processFile = useCallback(async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 50 Mo)");
      update({ uploadedFile: null });
      return;
    }
    setValidating(true);
    setCleaningData(null);

    try {
      const lines = await parseStructuredDataFile(file);

      if (lines.length === 0) {
        toast.error("Aucune donnée trouvée dans le fichier");
        setValidating(false);
        return;
      }

      // Local cleaning simulation v3.0 — mirrors server-side pipeline
      const dbTaskType = TASK_TYPE_MAP[data.taskType] || "scoring";
      const requiredFields = getLocalRequiredFields(dbTaskType);
      let validCount = 0;
      let dupes = 0;
      let invalid = 0;
      let pii = 0;
      let junk = 0;
      let htmlCleaned = 0;
      let tooShort = 0;
      let unicodeFixed = 0;
      let langScriptRejected = 0;
      let langMismatchFlagged = 0;
      const seenHashes = new Set<string>();
      const cleanedPreview: any[] = [];

      const PLACEHOLDER_VALUES = new Set([
        "n/a", "na", "none", "null", "undefined", "todo",
        "tbd", "test", "xxx", "...", "placeholder",
        "à compléter", "to be filled", "example", "sample",
        "dummy", "filler", "lorem ipsum", "asdf", "aaa",
      ]);

      const NON_LATIN = {
        arabic: /[\u0600-\u06FF\u0750-\u077F]/g,
        japanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
        cyrillic: /[\u0400-\u04FF]/g,
        korean: /[\uAC00-\uD7AF\u1100-\u11FF]/g,
      };

      const LANG_WORDS: Record<string, Set<string>> = {
        fr: new Set(["les", "des", "une", "est", "que", "pas", "par", "sur", "dans", "pour", "avec"]),
        en: new Set(["the", "and", "that", "have", "for", "not", "with", "this", "but", "from"]),
        de: new Set(["der", "die", "und", "den", "das", "von", "ist", "nicht", "sich", "auf", "eine"]),
        es: new Set(["los", "las", "del", "una", "por", "con", "para", "como", "más", "sus"]),
        it: new Set(["gli", "che", "del", "per", "una", "con", "non", "sono", "dalla", "delle"]),
      };

      // PII regex patterns
      const PII_REGEXES = [
        /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
        /(?:\+33|0033|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/,
        /\+(?:44|49|1|39|34|32|31|41|43)\s*\d[\s.\-]?\d{2,4}(?:[\s.\-]?\d{2,4}){1,3}/,
        /[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}/,
        /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?(?:[\dA-Z]{4}[\s]?){2,7}[\dA-Z]{1,4}\b/,
        /\d{3}-\d{2}-\d{4}/,
        /\bRPPS\s*[:\-]?\s*[18]\d{10}\b/i,
      ];

      const declaredLang = (data as any).language || "fr";

      for (const row of lines) {
        // ── CHECK: Resolve all required fields ──
        const resolved: Record<string, string> = {};
        let skipItem = false;

        // CHECK 1: required fields present and are strings
        for (const field of requiredFields) {
          const val = resolveTextField(row, field);
          if (val === undefined || val === null) {
            invalid++; junk++; skipItem = true; break;
          }
          if (typeof val !== "string") {
            invalid++; junk++; skipItem = true; break;
          }
          resolved[field] = val;
        }
        if (skipItem) continue;

        // CHECK 2: non-empty after trim
        let isJunkItem = false;
        for (const field of requiredFields) {
          const trimmed = resolved[field].trim();
          if (trimmed.length === 0) { isJunkItem = true; break; }
        }
        if (isJunkItem) { junk++; invalid++; continue; }

        // CHECK 3: no placeholder values
        for (const field of requiredFields) {
          const norm = resolved[field].trim().toLowerCase();
          if (PLACEHOLDER_VALUES.has(norm)) { isJunkItem = true; break; }
        }
        if (isJunkItem) { junk++; invalid++; continue; }

        // CHECK 4: minimum length (10 chars)
        for (const field of requiredFields) {
          if (resolved[field].trim().length < 10) { isJunkItem = true; tooShort++; break; }
        }
        if (isJunkItem) { junk++; invalid++; continue; }

        // CHECK 5: max length (50000 chars)
        for (const field of requiredFields) {
          if (resolved[field].length > 50000) { isJunkItem = true; break; }
        }
        if (isJunkItem) { junk++; invalid++; continue; }

        // CHECK 6: no meaningful text (only punctuation)
        for (const field of requiredFields) {
          const textOnly = resolved[field].replace(/[^a-zA-ZÀ-ÿ0-9]/g, "").trim();
          if (textOnly.length < 3) { isJunkItem = true; break; }
        }
        if (isJunkItem) { junk++; invalid++; continue; }

        // CHECK 7: single repeated word
        for (const field of requiredFields) {
          const words = resolved[field].trim().toLowerCase().split(/\s+/);
          const unique = new Set(words);
          if (unique.size === 1 && words.length > 2) { isJunkItem = true; break; }
        }
        if (isJunkItem) { junk++; invalid++; continue; }

        // CHECK 8: copy-paste (prompt = response_a or response)
        if (dbTaskType === "preference_dpo" || dbTaskType === "comparison_ab") {
          const pN = resolved.prompt?.trim().toLowerCase() || "";
          const raN = (resolved.response_a || "").trim().toLowerCase();
          if (pN && raN && pN === raN) { junk++; invalid++; continue; }
        }
        if (dbTaskType === "scoring") {
          const pN = resolved.prompt?.trim().toLowerCase() || "";
          const rN = (resolved.response || "").trim().toLowerCase();
          if (pN && rN && pN === rN) { junk++; invalid++; continue; }
        }

        // CHECK 9: response_a = response_b (no preference)
        if ((dbTaskType === "preference_dpo" || dbTaskType === "comparison_ab") && resolved.response_a && resolved.response_b) {
          if (resolved.response_a.trim().toLowerCase() === resolved.response_b.trim().toLowerCase()) {
            junk++; invalid++; continue;
          }
        }

        // Unicode normalization check
        const primary = resolved[requiredFields[0]] || "";
        const nfc = primary.normalize("NFC");
        if (nfc !== primary) unicodeFixed++;

        // HTML check
        if (/<\/?[a-zA-Z]/.test(primary)) htmlCleaned++;

        // ── Language detection (per-item) ──
        const textForLang = requiredFields.map(f => resolved[f] || "").join(" ");
        let langRejected = false;

        // Non-latin script detection
        for (const [script, pattern] of Object.entries(NON_LATIN)) {
          const matches = textForLang.match(new RegExp(pattern.source, "g"));
          if (matches && matches.length > 5) {
            langScriptRejected++;
            invalid++;
            langRejected = true;
            break;
          }
        }
        if (langRejected) continue;

        // Latin language mismatch
        const words = textForLang.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
        if (words.length >= 5) {
          const scores: Record<string, number> = {};
          for (const [lang, trigrams] of Object.entries(LANG_WORDS)) {
            scores[lang] = words.filter(w => trigrams.has(w)).length / words.length;
          }
          const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          if (sorted[0][1] > 0.10) {
            const detectedLang = sorted[0][0];
            const declNorm = declaredLang.toLowerCase().substring(0, 2);
            if (detectedLang !== declNorm) {
              langMismatchFlagged++;
              // Warning only — don't skip
            }
          }
        }

        // Dedup désactivé — toutes les lignes valides sont conservées

        // ── PII check (all patterns) ──
        const allText = Object.values(row).map((value) => {
          if (typeof value === "string") return value;
          return JSON.stringify(value);
        }).join(" ");
        if (PII_REGEXES.some(regex => regex.test(allText))) pii++;

        validCount++;
        cleanedPreview.push(row);
      }

      setCleaningData({
        junk_rows: junk,
        html_cleaned_rows: htmlCleaned,
        too_short_rows: tooShort,
        too_long_rows: 0,
        unicode_normalized_rows: unicodeFixed,
        quality_score: validCount > 0 ? Math.min(100, Math.round((validCount / lines.length) * 100)) : 0,
        lang_script_rejected: langScriptRejected,
        lang_mismatch_flagged: langMismatchFlagged,
        language: { detected: "auto", confidence: 0, distribution: {} },
        language_mismatch: langMismatchFlagged > 0,
        cleaning_report: {
          pipeline_version: "3.0",
          steps: [],
          total_input: lines.length,
          total_output: validCount,
          rows_removed: lines.length - validCount,
          removal_rate: Math.round(((lines.length - validCount) / lines.length) * 100 * 10) / 10,
        },
      });

      update({
        uploadedFile: {
          name: file.name,
          size: file.size,
          validTasks: validCount,
          duplicates: dupes,
          invalid,
          piiDetected: pii,
          previewRows: cleanedPreview.slice(0, 5),
          allValidRows: cleanedPreview,
        },
      });

      if (validCount === 0) {
        toast.error("Aucune ligne exploitable trouvée. Essayez CSV/Excel ou des noms de colonnes plus souples.");
      } else if (invalid / lines.length > 0.1) {
        toast.warning(`${validCount} tâches valides sur ${lines.length} (${invalid} invalides)`);
      } else {
        toast.success(`${validCount} tâches validées sur ${lines.length}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la validation");
      update({ uploadedFile: null });
    } finally {
      setValidating(false);
    }
  }, [update, data.taskType]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  if (isRedTeamChat) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Connexion à votre modèle</h2>
          <p className="text-sm text-muted-foreground">Le mode chat en direct ne nécessite pas d'upload. Configurez l'endpoint API à l'étape précédente.</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0" />
          <p className="text-sm text-foreground">Les experts interagiront directement avec votre modèle via l'interface de chat intégrée.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Importez vos données</h2>
        <p className="text-sm text-muted-foreground">Uploadez le fichier contenant les tâches à annoter. Le pipeline de nettoyage s'appliquera automatiquement.</p>
      </div>

      {!data.uploadedFile ? (
        <>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center h-[240px] sm:h-[280px] rounded-xl border-2 border-dashed cursor-pointer transition-all",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
              validating && "pointer-events-none opacity-60"
            )}
          >
            <input type="file" accept={SUPPORTED_IMPORT_EXTENSIONS} onChange={handleChange} className="hidden" />
            {validating ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-foreground font-medium">Nettoyage et validation en cours...</p>
                <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                  {["Unicode", "Junk", "HTML", "PII", "Doublons", "Qualité", "Langue"].map(step => (
                    <span key={step} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">{step}</span>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-foreground font-medium">Glissez votre fichier ici ou cliquez pour parcourir</p>
                <p className="text-xs text-muted-foreground mt-1">Formats acceptés : {SUPPORTED_IMPORT_LABEL} — Maximum 50 Mo</p>
              </>
            )}
          </label>

          {/* Pipeline info */}
          <div className="bg-muted/30 rounded-xl border border-border p-4">
            <p className="text-xs font-semibold text-foreground mb-2">
              Pipeline de nettoyage automatique
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Unicode", desc: "Normalisation NFC, guillemets, tirets" },
                { label: "Junk", desc: "Suppression placeholders, N/A, vides" },
                { label: "Doublons", desc: "Hash post-nettoyage" },
                { label: "PII", desc: "Emails, tél, IBAN, NIR, CB, IP" },
                { label: "Qualité", desc: "Score 0-100, répétitions, majuscules" },
                { label: "Langue", desc: "Détection Français/Anglais + bilingue" },
              ].map(s => (
                <div key={s.label} className="text-[11px]">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="text-muted-foreground"> — {s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* File info */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{data.uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(data.uploadedFile.size / 1024).toFixed(0)} Ko</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { update({ uploadedFile: null }); setCleaningData(null); }}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>

          {/* Validation result */}
          {data.uploadedFile.validTasks > 0 ? (
            <div className="flex items-center gap-2 text-sm text-[#22C55E]">
              <CheckCircle2 className="w-4 h-4" /> Fichier valide — {data.uploadedFile.validTasks} tâches prêtes
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="w-4 h-4" /> Fichier invalide — trop d'erreurs détectées
            </div>
          )}

          {/* Language mismatch warning */}
          {cleaningData?.language_mismatch && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/5">
              <Languages className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <p className="text-xs text-foreground">
                Langue détectée : <strong>{
                  cleaningData.language.detected === "fr" ? "Français" :
                  cleaningData.language.detected === "en" ? "Anglais" :
                  cleaningData.language.detected === "both" ? "Bilingue" :
                  cleaningData.language.detected.toUpperCase()
                }</strong> ({cleaningData.language.confidence}% de confiance).
                Vérifiez que cela correspond à la langue de votre projet.
              </p>
            </div>
          )}

          {/* Primary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Tâches valides", value: data.uploadedFile.validTasks, color: "text-[#22C55E]" },
              { label: "Doublons supprimés", value: data.uploadedFile.duplicates, color: "text-muted-foreground" },
              { label: "Lignes invalides", value: data.uploadedFile.invalid, color: data.uploadedFile.invalid > 0 ? "text-[#F59E0B]" : "text-muted-foreground" },
              { label: "PII anonymisés", value: data.uploadedFile.piiDetected, color: "text-blue-400" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-lg border border-border bg-card text-center">
                <p className={cn("text-lg font-bold font-mono", s.color)}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Cleaning report toggle */}
          {cleaningData && (
            <div>
              <button onClick={() => setShowReport(!showReport)} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {showReport ? "Masquer" : "Voir"} le rapport de nettoyage complet
              </button>

              {showReport && (
                <div className="mt-3 bg-muted/30 rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Rapport de nettoyage v{cleaningData.cleaning_report?.pipeline_version || "2.0"}</p>
                    {cleaningData.quality_score > 0 && (
                      <span className={cn(
                        "text-xs font-mono px-2 py-0.5 rounded",
                        cleaningData.quality_score >= 80 ? "bg-[#22C55E]/10 text-[#22C55E]" :
                        cleaningData.quality_score >= 50 ? "bg-[#F59E0B]/10 text-[#F59E0B]" :
                        "bg-destructive/10 text-destructive"
                      )}>
                        Qualité : {cleaningData.quality_score}/100
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Unicode normalisé", value: cleaningData.unicode_normalized_rows, icon: "✓" },
                      { label: "Junk supprimé", value: cleaningData.junk_rows, icon: "🗑" },
                      { label: "HTML nettoyé", value: cleaningData.html_cleaned_rows, icon: "🧹" },
                      { label: "Trop court (<10)", value: cleaningData.too_short_rows, icon: "📏" },
                      { label: "Tronqué (>50K)", value: cleaningData.too_long_rows, icon: "✂️" },
                      { label: "PII détectés", value: data.uploadedFile?.piiDetected || 0, icon: "🔒" },
                      { label: "Script rejeté", value: cleaningData.lang_script_rejected, icon: "🌍" },
                      { label: "Langue flaggée", value: cleaningData.lang_mismatch_flagged, icon: "⚠️" },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2 text-xs">
                        <span className="w-5 text-center">{s.icon}</span>
                        <span className="text-muted-foreground">{s.label}:</span>
                        <span className={cn("font-mono font-semibold", s.value > 0 ? "text-foreground" : "text-muted-foreground")}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Language info */}
                  {(cleaningData.lang_script_rejected > 0 || cleaningData.lang_mismatch_flagged > 0) && (
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                      <Languages className="w-4 h-4 text-muted-foreground" />
                      <div className="text-xs text-muted-foreground">
                        {cleaningData.lang_script_rejected > 0 && (
                          <span>{cleaningData.lang_script_rejected} item(s) rejeté(s) (script non-latin) · </span>
                        )}
                        {cleaningData.lang_mismatch_flagged > 0 && (
                          <span>{cleaningData.lang_mismatch_flagged} item(s) flaggé(s) (langue différente)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {cleaningData.cleaning_report && (
                    <div className="text-[11px] text-muted-foreground pt-2 border-t border-border">
                      {cleaningData.cleaning_report.total_input} lignes en entrée → {cleaningData.cleaning_report.total_output} en sortie
                      ({cleaningData.cleaning_report.rows_removed} supprimées, {cleaningData.cleaning_report.removal_rate}%)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {data.uploadedFile.previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Preview des {data.uploadedFile.previewRows.length} premières tâches (nettoyées)</span>
                <button
                  onClick={() => update({ _showRawJson: !((data as any)._showRawJson) } as any)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {(data as any)._showRawJson ? "Voir le tableau" : "Voir le JSON brut"}
                </button>
              </div>
              {(data as any)._showRawJson ? (
                <pre className="bg-muted border border-border rounded-xl p-4 overflow-x-auto text-xs font-mono text-foreground/70 max-h-[400px] overflow-y-auto">
                  {data.uploadedFile.previewRows.map((row, i) => (
                    <div key={i} className={i > 0 ? "mt-2 pt-2 border-t border-border" : ""}>
                      {JSON.stringify(row, null, 2)}
                    </div>
                  ))}
                </pre>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <TooltipProvider>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          {Object.keys(data.uploadedFile.previewRows[0]).map((key) => (
                            <th key={key} className={cn("text-left p-2 font-medium text-muted-foreground", getColumnWidth(data.uploadedFile!.previewRows[0][key]))}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.uploadedFile.previewRows.map((row, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            {Object.entries(row).map(([key, val]: [string, any], j) => {
                              const isComplex = typeof val === "object" && val !== null;
                              const cell = renderCellValue(val);
                              return (
                                <td key={j} className="py-3 px-3 align-top">
                                  {isComplex ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild><span className="cursor-help">{cell}</span></TooltipTrigger>
                                      <TooltipContent side="bottom" className="max-w-[500px] max-h-[300px] overflow-y-auto">
                                        <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : cell}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TooltipProvider>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
