import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WizardStep1 } from "@/components/client/wizard/WizardStep1";
import { WizardStep2 } from "@/components/client/wizard/WizardStep2";
import { WizardStep3 } from "@/components/client/wizard/WizardStep3";
import { WizardStep4 } from "@/components/client/wizard/WizardStep4";
import { WizardStep5 } from "@/components/client/wizard/WizardStep5";
import { WizardStep6 } from "@/components/client/wizard/WizardStep6";

const STORAGE_KEY = "stef-wizard-draft";

const STEPS = [
  { num: 1, label: "Projet" },
  { num: 2, label: "Type" },
  { num: 3, label: "Config" },
  { num: 4, label: "Données" },
  { num: 5, label: "Service" },
  { num: 6, label: "Récap" },
];

export interface WizardData {
  name: string;
  description: string;
  domain: string;
  language: string;
  taskType: string;
  dimensions: string[];
  customDimensions: { name: string; description: string }[];
  labels: { name: string; color: string }[];
  extractionFields: { name: string; type: string; required: boolean; description: string }[];
  evaluatePerTurn: boolean;
  redTeamMode: string;
  targetLength: string;
  targetTone: string;
  rewriteMode: boolean;
  uploadedFile: { name: string; size: number; validTasks: number; duplicates: number; invalid: number; piiDetected: number; previewRows: any[]; allValidRows?: any[] } | null;
  sla: string;
  llmMode: "standard" | "sovereign";
  agreedTerms: boolean;
  computedTotal?: number;
}

const DEFAULT_DATA: WizardData = {
  name: "",
  description: "",
  domain: "",
  language: "fr",
  taskType: "",
  dimensions: ["correctness", "safety", "completeness", "reasoning_depth"],
  customDimensions: [],
  labels: [],
  extractionFields: [],
  evaluatePerTurn: true,
  redTeamMode: "review",
  targetLength: "medium",
  targetTone: "formal",
  rewriteMode: false,
  uploadedFile: null,
  sla: "standard",
  llmMode: "standard",
  agreedTerms: false,
  computedTotal: undefined,
};

export default function NewProjectWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [creating, setCreating] = useState(false);

  const [data, setData] = useState<WizardData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Always clear computedTotal from restored draft to force recalculation in Step 6
      return saved ? { ...DEFAULT_DATA, ...JSON.parse(saved), computedTotal: undefined } : DEFAULT_DATA;
    } catch {
      return DEFAULT_DATA;
    }
  });

  const { data: client } = useQuery({
    queryKey: ["client-record-wizard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // Auto-save
  useEffect(() => {
    const { agreedTerms, ...rest } = data;
    // Exclude allValidRows from localStorage to avoid quota issues
    const toStore = { ...rest };
    if (toStore.uploadedFile) {
      toStore.uploadedFile = { ...toStore.uploadedFile, allValidRows: undefined };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }, [data]);

  const update = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const isStepValid = useCallback((s: number): boolean => {
    switch (s) {
      case 1: return data.name.trim().length >= 3 && !!data.domain && !!data.language;
      case 2: return !!data.taskType;
      case 3: {
        if (["rating", "scoring", "comparison"].includes(data.taskType)) {
          return (data.dimensions.length + data.customDimensions.length) >= 2;
        }
        if (data.taskType === "span_annotation") return data.labels.length >= 2;
        if (data.taskType === "extraction") return data.extractionFields.length >= 1;
        return true;
      }
      case 4: {
        if (data.taskType === "red_teaming" && data.redTeamMode === "chat") return true;
        return !!data.uploadedFile && data.uploadedFile.validTasks > 0;
      }
      case 5: return !!data.sla;
      case 6: return data.agreedTerms;
      default: return false;
    }
  }, [data]);

  const goNext = useCallback(() => {
    if (step < 6 && isStepValid(step)) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }, [step, isStepValid]);

  const goPrev = useCallback(() => {
    if (step > 1) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const goToStep = useCallback((target: number) => {
    if (target < step) {
      setDirection(-1);
      setStep(target);
    } else if (target === step) return;
    else {
      for (let i = step; i < target; i++) {
        if (!isStepValid(i)) return;
      }
      setDirection(1);
      setStep(target);
    }
  }, [step, isStepValid]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter" && isStepValid(step)) goNext();
      if (e.key === "Escape") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, isStepValid, goNext, goPrev]);

  const handleCreate = async () => {
    if (!client?.id) {
      toast.error("Aucun compte client trouvé. Veuillez vous reconnecter.");
      return;
    }
    setCreating(true);
    try {
      const allDimensions = [
        ...data.dimensions,
        ...data.customDimensions.map((d) => d.name),
      ];

      const taskConfig: any = {};
      if (["rating", "scoring", "comparison"].includes(data.taskType)) {
        taskConfig.dimensions = allDimensions;
      }
      if (data.taskType === "span_annotation") {
        taskConfig.label_set = data.labels.map((l) => l.name);
      }
      if (data.taskType === "extraction") {
        taskConfig.extraction_schema = { fields: data.extractionFields };
      }
      if (data.taskType === "conversation_rating") {
        taskConfig.evaluate_per_turn = data.evaluatePerTurn;
        taskConfig.dimensions = allDimensions;
      }
      if (data.taskType === "red_teaming") {
        taskConfig.mode = data.redTeamMode;
      }
      if (data.taskType === "text_generation") {
        taskConfig.target_length = data.targetLength;
        taskConfig.target_tone = data.targetTone;
        taskConfig.rewrite_mode = data.rewriteMode;
      }

      const slaTier = data.sla;
      const annotatorsPerItem = slaTier === "express" ? 3 : 2;

      // Use the correctly computed total from Step 6 (fetched from task_pricing table)
      const totalCost = data.computedTotal;
      if (!totalCost || totalCost <= 0) {
        toast.error("Le coût total n'a pas pu être calculé. Revenez à l'étape Récapitulatif.");
        setCreating(false);
        return;
      }

      // Derive complexity from task type
      const complexityByType: Record<string, number> = {
        classification: 1, validation: 1,
        rating: 2, scoring: 2, span_annotation: 2, extraction: 2,
        ranking: 3, comparison: 3, red_teaming: 3, text_generation: 3, conversation_rating: 3,
      };
      const projectComplexity = complexityByType[data.taskType] || 2;

      // Create project with pending_payment status
      const { data: project, error } = await supabase.from("annotation_projects").insert({
        client_id: client.id,
        name: data.name,
        description: data.description || "Projet d'annotation RLHF",
        type: data.taskType as any,
        complexity_level: projectComplexity,
        domain: data.domain,
        languages: data.language === "both" ? ["fr", "en"] : [data.language],
        priority_level: slaTier === "express" ? "critical" : slaTier === "priority" ? "rush" : "standard",
        status: "draft" as any,
        total_items: data.uploadedFile?.validTasks || 0,
        estimated_cost: totalCost,
        sla_tier: slaTier,
        llm_mode: data.llmMode || "standard",
        guidelines: { version: "1.0", content: "", examples: [], counter_examples: [], edge_cases: [], faq: [], last_updated: new Date().toISOString(), change_log: [] },
        workflow: { annotations_per_item: annotatorsPerItem, adjudication_enabled: true, auto_assign: true, require_justification: true, allow_skip: false, max_items_per_session: 50, forced_break_interval_minutes: 120 },
        quality_config: { annotations_per_item: annotatorsPerItem, adjudication_threshold: 0.7, gold_standard_rate: 0.1, gold_failure_action: "warn", qa_review_rate: 0.05, target_iaa: slaTier === "express" ? 0.85 : slaTier === "priority" ? 0.80 : 0.75, target_accuracy: 0.85, drift_check_interval: 100, drift_threshold: 0.05, escalation_rules: [] },
        automation_config: { enabled: false, strategy: "assist_only", model: { provider: "lovable_ai", model_id: "google/gemini-2.5-flash" }, confidence_threshold: 0.9, human_review_sample_rate: 0.1, max_cost_per_item: 0.5, max_total_budget: 1000, fallback_to_human: true, max_retries: 2, pre_annotation_visible: false },
        pricing_model: { type: "per_item", base_rate: totalCost / Math.max(data.uploadedFile?.validTasks || 1, 1), complexity_multipliers: { "1": 1, "2": 1.5, "3": 2.5 }, rush_surcharge: 1 },
        annotation_schema: taskConfig,
      }).select("id").single();

      if (error) throw error;

      // Create annotation_items from uploaded data
      const allRows = data.uploadedFile?.allValidRows || [];
      if (allRows.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < allRows.length; i += BATCH) {
          const chunk = allRows.slice(i, i + BATCH);
          const items = chunk.map((row: any) => ({
            project_id: project.id,
            content: {
              type: row.response_a && row.response_b ? "text_pair" : "text",
              primary: row.prompt || row.claim || row.instruction || "",
              secondary: row.response || row.output || undefined,
              alternatives: row.response_a && row.response_b ? [row.response_a, row.response_b] : undefined,
              conversation: row.conversation || undefined,
            },
            complexity_level: projectComplexity,
            status: "queued" as const,
            is_gold_standard: false,
            is_calibration: false,
          }));
          const { error: insertErr } = await supabase.from("annotation_items").insert(items);
          if (insertErr) console.error("Insert batch error:", insertErr);
        }
      }

      // Create payment schedule
      await supabase.rpc("create_project_payments", {
        p_project_id: project.id,
        p_client_id: client.id,
        p_total_amount: totalCost,
      });

      // TEST MODE: Auto-validate all payments and activate project
      const { data: allPayments } = await supabase
        .from("project_payments" as any)
        .select("id")
        .eq("project_id", project.id);

      if (allPayments && allPayments.length > 0) {
        for (const p of allPayments) {
          await supabase.from("project_payments" as any).update({
            status: "paid",
            paid_at: new Date().toISOString(),
            triggered: true,
            triggered_at: new Date().toISOString(),
          }).eq("id", (p as any).id);
        }
      }

      // Activate project directly
      await supabase.from("annotation_projects").update({
        status: "active" as any,
      }).eq("id", project.id);

      localStorage.removeItem(STORAGE_KEY);
      toast.success("Projet créé et tous les paiements validés (mode test).");
      navigate(`/client/projects`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const hasDraft = data.name.trim().length > 0 || !!data.taskType;

  const handleCancel = () => {
    if (hasDraft && !confirm("Vous avez un projet en cours. Abandonner la création ?")) return;
    localStorage.removeItem(STORAGE_KEY);
    navigate("/client/projects");
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground">Nouveau projet</h1>
          <button onClick={handleCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Annuler
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="border-b border-border bg-background">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const completed = step > s.num;
              const active = step === s.num;
              return (
                <button
                  key={s.num}
                  onClick={() => goToStep(s.num)}
                  className={cn(
                    "flex items-center gap-2 text-xs font-medium transition-colors",
                    completed ? "text-[#22C55E] cursor-pointer" : active ? "text-primary" : "text-muted-foreground/50",
                    !completed && !active && "cursor-default"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all",
                    completed ? "bg-[#22C55E] border-[#22C55E] text-white" :
                    active ? "border-primary bg-primary/10 text-primary" :
                    "border-border text-muted-foreground/40"
                  )}>
                    {completed ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {step === 1 && <WizardStep1 data={data} update={update} />}
              {step === 2 && <WizardStep2 data={data} update={update} />}
              {step === 3 && <WizardStep3 data={data} update={update} />}
              {step === 4 && <WizardStep4 data={data} update={update} />}
              {step === 5 && <WizardStep5 data={data} update={update} />}
              {step === 6 && <WizardStep6 data={data} update={update} goToStep={goToStep} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-border bg-background/95 backdrop-blur sticky bottom-0 z-40">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={step === 1 ? handleCancel : goPrev}
            className="gap-1.5 text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? "Annuler" : "Retour"}
          </Button>
          {step < 6 ? (
            <Button onClick={goNext} disabled={!isStepValid(step)} className="gap-1.5">
              Continuer <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={!isStepValid(6) || creating} className="gap-1.5">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Traitement...</> : (() => {
                const t = data.computedTotal || 0;
                const dep = t >= 5000 ? t * 0.40 : t * 0.50;
                return `Confirmer et payer l'acompte (${dep.toFixed(2)} USD)`;
              })()}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
