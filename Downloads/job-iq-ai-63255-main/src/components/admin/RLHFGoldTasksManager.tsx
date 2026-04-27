import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  Sparkles, Plus, Edit, Trash2, RefreshCw, 
  ThumbsUp, ThumbsDown, Minus, Target, CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface GoldTask {
  id: string;
  task_type: string;
  job_role: string;
  job_level: string;
  ai_output: any;
  expected_rating: string;
  expected_issues: string[] | null;
  min_agreement_threshold: number | null;
  is_active: boolean;
  created_at: string;
}

const ISSUES_OPTIONS = [
  { value: "too_theoretical", label: "Trop théorique" },
  { value: "too_practical", label: "Trop pratique" },
  { value: "not_job_representative", label: "Non représentatif" },
  { value: "too_easy", label: "Trop facile" },
  { value: "too_hard", label: "Trop difficile" },
  { value: "unclear_questions", label: "Questions floues" },
  { value: "biased_content", label: "Contenu biaisé" },
  { value: "outdated_tech", label: "Tech obsolètes" },
  { value: "missing_context", label: "Contexte manquant" },
  { value: "time_unrealistic", label: "Temps irréaliste" },
];

const JOB_LEVELS = ["junior", "mid", "senior", "lead", "principal"];

export function RLHFGoldTasksManager() {
  const [goldTasks, setGoldTasks] = useState<GoldTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GoldTask | null>(null);
  
  // Form state
  const [taskType, setTaskType] = useState("technical_test_question");
  const [jobRole, setJobRole] = useState("");
  const [jobLevel, setJobLevel] = useState("mid");
  const [aiOutput, setAiOutput] = useState("");
  const [expectedRating, setExpectedRating] = useState("up");
  const [expectedIssues, setExpectedIssues] = useState<string[]>([]);
  const [minThreshold, setMinThreshold] = useState(0.7);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadGoldTasks();
  }, []);

  async function loadGoldTasks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rlhf_gold_tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoldTasks(data || []);
    } catch (error) {
      console.error("Error loading gold tasks:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTaskType("technical_test_question");
    setJobRole("");
    setJobLevel("mid");
    setAiOutput("");
    setExpectedRating("up");
    setExpectedIssues([]);
    setMinThreshold(0.7);
    setIsActive(true);
    setEditingTask(null);
  }

  function openEditDialog(task: GoldTask) {
    setEditingTask(task);
    setTaskType(task.task_type);
    setJobRole(task.job_role);
    setJobLevel(task.job_level);
    setAiOutput(JSON.stringify(task.ai_output, null, 2));
    setExpectedRating(task.expected_rating);
    setExpectedIssues(task.expected_issues || []);
    setMinThreshold(task.min_agreement_threshold || 0.7);
    setIsActive(task.is_active);
    setDialogOpen(true);
  }

  async function saveGoldTask() {
    try {
      let parsedOutput;
      try {
        parsedOutput = JSON.parse(aiOutput);
      } catch {
        toast.error("AI Output doit être un JSON valide");
        return;
      }

      const taskData = {
        task_type: taskType,
        job_role: jobRole,
        job_level: jobLevel,
        ai_output: parsedOutput,
        expected_rating: expectedRating,
        expected_issues: expectedIssues.length > 0 ? expectedIssues : null,
        min_agreement_threshold: minThreshold,
        is_active: isActive,
      };

      if (editingTask) {
        const { error } = await supabase
          .from("rlhf_gold_tasks")
          .update(taskData)
          .eq("id", editingTask.id);
        if (error) throw error;
        toast.success("Gold Task mise à jour");
      } else {
        const { error } = await supabase
          .from("rlhf_gold_tasks")
          .insert(taskData);
        if (error) throw error;
        toast.success("Gold Task créée");
      }

      setDialogOpen(false);
      resetForm();
      loadGoldTasks();
    } catch (error) {
      console.error("Error saving gold task:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  }

  async function deleteGoldTask(id: string) {
    if (!confirm("Supprimer cette Gold Task ?")) return;
    
    try {
      const { error } = await supabase
        .from("rlhf_gold_tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Gold Task supprimée");
      loadGoldTasks();
    } catch (error) {
      console.error("Error deleting gold task:", error);
      toast.error("Erreur lors de la suppression");
    }
  }

  async function toggleActive(task: GoldTask) {
    try {
      const { error } = await supabase
        .from("rlhf_gold_tasks")
        .update({ is_active: !task.is_active })
        .eq("id", task.id);
      if (error) throw error;
      loadGoldTasks();
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  }

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case "up": return <ThumbsUp className="h-4 w-4 text-success" />;
      case "down": return <ThumbsDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-warning" />;
    }
  };

  const activeCount = goldTasks.filter(t => t.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            Gold Tasks (Calibration)
          </h2>
          <p className="text-muted-foreground">
            Tâches de référence pour calibrer la fiabilité des annotateurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg py-1">
            <Target className="h-4 w-4 mr-1" />
            {activeCount} actives
          </Badge>
          <Button variant="outline" onClick={loadGoldTasks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle Gold Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTask ? "Modifier Gold Task" : "Créer une Gold Task"}
                </DialogTitle>
                <DialogDescription>
                  Définissez une tâche de calibration avec la réponse attendue
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type de tâche</Label>
                    <Select value={taskType} onValueChange={setTaskType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical_test_question">Question technique</SelectItem>
                        <SelectItem value="job_offer_summary">Résumé d'offre</SelectItem>
                        <SelectItem value="interview_question">Question d'entretien</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Niveau</Label>
                    <Select value={jobLevel} onValueChange={setJobLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_LEVELS.map(level => (
                          <SelectItem key={level} value={level} className="capitalize">
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Input
                    placeholder="ex: Full Stack Developer"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>AI Output (JSON)</Label>
                  <Textarea
                    placeholder='{"question": "...", "expected_answer": "..."}'
                    value={aiOutput}
                    onChange={(e) => setAiOutput(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rating attendu</Label>
                    <Select value={expectedRating} onValueChange={setExpectedRating}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="up">👍 Positif</SelectItem>
                        <SelectItem value="neutral">😐 Neutre</SelectItem>
                        <SelectItem value="down">👎 Négatif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Seuil d'accord min</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={minThreshold}
                      onChange={(e) => setMinThreshold(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Problèmes attendus</Label>
                  <div className="flex flex-wrap gap-2">
                    {ISSUES_OPTIONS.map(issue => (
                      <Badge
                        key={issue.value}
                        variant={expectedIssues.includes(issue.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setExpectedIssues(prev =>
                            prev.includes(issue.value)
                              ? prev.filter(i => i !== issue.value)
                              : [...prev, issue.value]
                          );
                        }}
                      >
                        {issue.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="active">Activer cette Gold Task</Label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={saveGoldTask} disabled={!jobRole || !aiOutput}>
                  {editingTask ? "Mettre à jour" : "Créer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Target className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold">Comment ça marche ?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Les Gold Tasks sont injectées aléatoirement (5% des tests) pour mesurer la fiabilité des annotateurs.
                Un annotateur qui répond correctement aux Gold Tasks obtient un score de fiabilité plus élevé,
                ce qui augmente la valeur de ses annotations dans le dataset final.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statut</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Rating attendu</TableHead>
                <TableHead>Problèmes</TableHead>
                <TableHead>Seuil</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : goldTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucune Gold Task. Créez-en une pour commencer la calibration.
                  </TableCell>
                </TableRow>
              ) : (
                goldTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Switch
                        checked={task.is_active}
                        onCheckedChange={() => toggleActive(task)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {task.task_type}
                    </TableCell>
                    <TableCell className="font-medium">{task.job_role}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{task.job_level}</Badge>
                    </TableCell>
                    <TableCell>{getRatingIcon(task.expected_rating)}</TableCell>
                    <TableCell>
                      {task.expected_issues?.length || 0}
                    </TableCell>
                    <TableCell>{((task.min_agreement_threshold || 0.7) * 100).toFixed(0)}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(task)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteGoldTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default RLHFGoldTasksManager;
