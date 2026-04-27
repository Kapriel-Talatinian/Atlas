import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

const ANNOTATION_TYPES = [
  { value: "classification", label: "Classification" },
  { value: "ranking", label: "Ranking / DPO" },
  { value: "rating", label: "Scoring multi-dimensions" },
  { value: "comparison", label: "Comparaison A/B" },
  { value: "red_teaming", label: "Red Teaming" },
  { value: "validation", label: "Fact-checking" },
  { value: "text_generation", label: "Génération de texte" },
  { value: "span_annotation", label: "Annotation de spans" },
  { value: "extraction", label: "Extraction" },
  { value: "conversation_rating", label: "Notation de conversation" },
] as const;

const DOMAINS = [
  { value: "medical", label: "🏥 Médical" },
  { value: "legal", label: "⚖️ Juridique" },
  { value: "finance", label: "💰 Finance" },
  { value: "code", label: "💻 Code" },
  { value: "general", label: "📝 Général" },
];

interface CreateProjectDialogProps {
  clientId: string;
  onCreated: () => void;
}

export const CreateProjectDialog = ({ clientId, onCreated }: CreateProjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "rating" as string,
    domain: "code",
    complexity_level: 2,
    languages: ["fr"],
    priority_level: "standard",
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom du projet est requis");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("annotation_projects").insert({
        client_id: clientId,
        name: form.name,
        description: form.description || "Projet d'annotation RLHF",
        type: form.type as any,
        complexity_level: form.complexity_level,
        domain: form.domain,
        languages: form.languages,
        priority_level: form.priority_level,
        status: "draft" as any,
        total_items: 0,
        estimated_cost: 0,
        guidelines: { version: "1.0", content: "", examples: [], counter_examples: [], edge_cases: [], faq: [], last_updated: new Date().toISOString(), change_log: [] },
        workflow: { annotations_per_item: 2, adjudication_enabled: true, auto_assign: true, require_justification: true, allow_skip: false, max_items_per_session: 50, forced_break_interval_minutes: 120 },
        quality_config: { annotations_per_item: 2, adjudication_threshold: 0.7, gold_standard_rate: 0.1, gold_failure_action: "warn", qa_review_rate: 0.05, target_iaa: 0.80, target_accuracy: 0.85, drift_check_interval: 100, drift_threshold: 0.05, escalation_rules: [] },
        automation_config: { enabled: false, strategy: "assist_only", model: { provider: "lovable_ai", model_id: "google/gemini-2.5-flash" }, confidence_threshold: 0.9, human_review_sample_rate: 0.1, max_cost_per_item: 0.5, max_total_budget: 1000, fallback_to_human: true, max_retries: 2, pre_annotation_visible: false },
        pricing_model: { type: "per_item", base_rate: 0.15, complexity_multipliers: { "1": 1, "2": 1.5, "3": 2.5 }, rush_surcharge: 1.5 },
      });
      if (error) throw error;
      toast.success("Projet créé !");
      setOpen(false);
      setForm({ name: "", description: "", type: "rating", domain: "code", complexity_level: 2, languages: ["fr"], priority_level: "standard" });
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" />Nouveau projet</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un projet d'annotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nom du projet *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: RLHF Medical v2" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrivez l'objectif du projet..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type d'annotation</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANNOTATION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Domaine</Label>
              <Select value={form.domain} onValueChange={v => setForm(f => ({ ...f, domain: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOMAINS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Complexité (1-3)</Label>
              <Select value={String(form.complexity_level)} onValueChange={v => setForm(f => ({ ...f, complexity_level: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Simple</SelectItem>
                  <SelectItem value="2">2 — Moyen</SelectItem>
                  <SelectItem value="3">3 — Complexe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={form.priority_level} onValueChange={v => setForm(f => ({ ...f, priority_level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="rush">Rush (+50%)</SelectItem>
                  <SelectItem value="critical">Critique (+100%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCreate} className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</> : "Créer le projet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
