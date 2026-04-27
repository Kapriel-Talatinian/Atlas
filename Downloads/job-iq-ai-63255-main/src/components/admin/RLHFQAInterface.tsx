import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, XCircle, Eye, RefreshCw, Filter, Search,
  ThumbsUp, ThumbsDown, Minus, Shield, AlertTriangle,
  ChevronLeft, ChevronRight, Sparkles, Brain, Zap,
  AlertOctagon, UserCheck, FileWarning
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AIQAScores {
  ai_qa_effort?: number;
  ai_qa_coherence?: number;
  ai_qa_comment_quality?: number;
  ai_qa_risk?: number;
  ai_qa_role_match?: "match" | "adjacent" | "mismatch";
  ai_qa_triage?: "low_risk" | "medium_risk" | "high_risk";
}

interface RLHFFeedback {
  id: string;
  task_type: string;
  job_role: string;
  job_level_targeted: string;
  language: string;
  country_context: string;
  overall_rating: string;
  scores: (AIQAScores & Record<string, any>) | null;
  issues_detected: string[] | null;
  free_text_comment: string | null;
  preferred_action: string | null;
  annotator_id: string;
  qa_status: string | null;
  agreement_score: number | null;
  gold_task: boolean | null;
  created_at: string;
  generated_output: any;
  expert_profile_snapshot: any;
  time_spent_seconds?: number;
}

const ISSUES_LABELS: Record<string, string> = {
  "too_theoretical": "Trop théorique",
  "too_practical": "Trop pratique",
  "not_job_representative": "Non représentatif",
  "too_easy": "Trop facile",
  "too_hard": "Trop difficile",
  "unclear_questions": "Questions floues",
  "biased_content": "Contenu biaisé",
  "outdated_tech": "Tech obsolètes",
  "missing_context": "Contexte manquant",
  "time_unrealistic": "Temps irréaliste",
  "missing_explanation": "Explication manquante",
  "uncommented_code": "Code non commenté",
  "unjustified_decisions": "Décisions injustifiées",
  "shallow_reasoning": "Raisonnement superficiel",
};

export function RLHFQAInterface() {
  const [feedbacks, setFeedbacks] = useState<RLHFFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<RLHFFeedback | null>(null);
  const [qaStatus, setQaStatus] = useState<"pending" | "validated" | "rejected" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [qaNotes, setQaNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [runningStrictQA, setRunningStrictQA] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    loadFeedbacks();
  }, [qaStatus, languageFilter, page]);

  async function loadFeedbacks() {
    setLoading(true);
    try {
      let query = supabase
        .from("rlhf_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (qaStatus !== "all") {
        query = query.eq("qa_status", qaStatus);
      }
      if (languageFilter !== "all") {
        query = query.eq("language", languageFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setFeedbacks((data as unknown as RLHFFeedback[]) || []);
    } catch (error) {
      console.error("Error loading feedbacks:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  async function runStrictQATriage(feedbackId: string) {
    setRunningStrictQA(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-rlhf-qa", {
        body: { action: "strict_qa_triage", feedback_id: feedbackId }
      });

      if (error) throw error;
      
      toast.success(`Triage QA: ${data.qa_recommendation}`);
      loadFeedbacks();
    } catch (error) {
      console.error("Error running strict QA:", error);
      toast.error("Erreur lors du triage QA");
    } finally {
      setRunningStrictQA(false);
    }
  }

  async function runBatchStrictQA() {
    const pendingFeedbacks = feedbacks.filter(f => 
      f.qa_status === "pending" && !f.scores?.ai_qa_risk
    );
    
    if (pendingFeedbacks.length === 0) {
      toast.info("Aucun feedback à traiter");
      return;
    }

    setRunningStrictQA(true);
    let processed = 0;
    
    for (const feedback of pendingFeedbacks.slice(0, 10)) { // Limit to 10 at a time
      try {
        await supabase.functions.invoke("process-rlhf-qa", {
          body: { action: "strict_qa_triage", feedback_id: feedback.id }
        });
        processed++;
      } catch (error) {
        console.error("Error processing feedback:", feedback.id, error);
      }
    }

    toast.success(`${processed} feedbacks traités`);
    setRunningStrictQA(false);
    loadFeedbacks();
  }

  async function validateFeedback(feedbackId: string, status: "validated" | "rejected") {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("rlhf_feedback")
        .update({
          qa_status: status,
          qa_reviewer_id: user?.id,
          qa_reviewed_at: new Date().toISOString(),
          qa_notes: qaNotes || null,
        })
        .eq("id", feedbackId);

      if (error) throw error;

      toast.success(status === "validated" ? "Feedback validé ✓" : "Feedback rejeté");
      setSelectedFeedback(null);
      setQaNotes("");
      loadFeedbacks();
    } catch (error) {
      console.error("Error validating feedback:", error);
      toast.error("Erreur lors de la validation");
    } finally {
      setProcessing(false);
    }
  }

  async function triggerSecondAnnotation(feedbackId: string) {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-rlhf-qa", {
        body: { action: "assign_second_annotator", feedback_id: feedbackId }
      });

      if (error) throw error;
      toast.success("Second annotateur assigné");
      loadFeedbacks();
    } catch (error) {
      console.error("Error triggering second annotation:", error);
      toast.error("Erreur lors de l'assignation");
    } finally {
      setProcessing(false);
    }
  }

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case "up": return <ThumbsUp className="h-4 w-4 text-success" />;
      case "down": return <ThumbsDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-warning" />;
    }
  };

  const getQABadge = (status: string | null) => {
    switch (status) {
      case "validated":
        return <Badge className="bg-success/20 text-success">Validé</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejeté</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const getRiskBadge = (triage?: string, risk?: number) => {
    if (!triage) return null;
    
    switch (triage) {
      case "low_risk":
        return (
          <Badge className="bg-success/20 text-success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Low {risk ? `${(risk * 100).toFixed(0)}%` : ""}
          </Badge>
        );
      case "medium_risk":
        return (
          <Badge className="bg-warning/20 text-warning">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Medium {risk ? `${(risk * 100).toFixed(0)}%` : ""}
          </Badge>
        );
      case "high_risk":
        return (
          <Badge variant="destructive">
            <AlertOctagon className="h-3 w-3 mr-1" />
            High {risk ? `${(risk * 100).toFixed(0)}%` : ""}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getRoleMatchBadge = (roleMatch?: string) => {
    if (!roleMatch) return null;
    
    switch (roleMatch) {
      case "match":
        return <Badge className="bg-success/20 text-success"><UserCheck className="h-3 w-3 mr-1" />Match</Badge>;
      case "adjacent":
        return <Badge variant="outline"><UserCheck className="h-3 w-3 mr-1" />Adjacent</Badge>;
      case "mismatch":
        return <Badge variant="destructive"><FileWarning className="h-3 w-3 mr-1" />Mismatch</Badge>;
      default:
        return null;
    }
  };

  const stats = {
    pending: feedbacks.filter(f => f.qa_status === "pending").length,
    validated: feedbacks.filter(f => f.qa_status === "validated").length,
    rejected: feedbacks.filter(f => f.qa_status === "rejected").length,
    highRisk: feedbacks.filter(f => f.scores?.ai_qa_triage === "high_risk").length,
    lowRisk: feedbacks.filter(f => f.scores?.ai_qa_triage === "low_risk").length,
  };

  const filteredFeedbacks = feedbacks.filter(f => {
    const matchesSearch = searchTerm === "" || 
      f.job_role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.annotator_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRisk = riskFilter === "all" || 
      f.scores?.ai_qa_triage === riskFilter;
    
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Validation QA RLHF
            <Badge variant="outline" className="ml-2">STRICT MODE</Badge>
          </h2>
          <p className="text-muted-foreground">
            Triage automatique + validation humaine pour le dataset Gold Standard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            onClick={runBatchStrictQA} 
            disabled={runningStrictQA}
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            <Brain className={`h-4 w-4 mr-2 ${runningStrictQA ? "animate-pulse" : ""}`} />
            {runningStrictQA ? "Analyse..." : "Triage AI Batch"}
          </Button>
          <Button variant="outline" onClick={() => loadFeedbacks()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setQaStatus("pending")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">En attente</p>
                <p className="text-2xl font-bold text-warning">{stats.pending}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setQaStatus("validated")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Validés</p>
                <p className="text-2xl font-bold text-success">{stats.validated}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setQaStatus("rejected")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Rejetés</p>
                <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setRiskFilter("high_risk")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">High Risk</p>
                <p className="text-2xl font-bold text-destructive">{stats.highRisk}</p>
              </div>
              <AlertOctagon className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-success/50 transition-colors" onClick={() => setRiskFilter("low_risk")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Low Risk</p>
                <p className="text-2xl font-bold text-success">{stats.lowRisk}</p>
              </div>
              <Zap className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={qaStatus} onValueChange={(v: any) => setQaStatus(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="validated">Validés</SelectItem>
                  <SelectItem value="rejected">Rejetés</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Langue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">Anglais</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Niveau de risque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous risques</SelectItem>
                <SelectItem value="low_risk">Low Risk</SelectItem>
                <SelectItem value="medium_risk">Medium Risk</SelectItem>
                <SelectItem value="high_risk">High Risk</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par rôle ou annotateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
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
                <TableHead>Date</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>AI Risk</TableHead>
                <TableHead>Effort</TableHead>
                <TableHead>Cohérence</TableHead>
                <TableHead>Statut QA</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredFeedbacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Aucun feedback trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredFeedbacks.map((feedback) => (
                  <TableRow key={feedback.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="text-sm">
                      {format(new Date(feedback.created_at), "dd MMM HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="font-medium">{feedback.job_role}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{feedback.job_level_targeted}</Badge>
                    </TableCell>
                    <TableCell>{getRatingIcon(feedback.overall_rating)}</TableCell>
                    <TableCell>
                      {getRiskBadge(feedback.scores?.ai_qa_triage, feedback.scores?.ai_qa_risk)}
                    </TableCell>
                    <TableCell>
                      {feedback.scores?.ai_qa_effort !== undefined ? (
                        <div className="w-16">
                          <Progress 
                            value={feedback.scores.ai_qa_effort * 100} 
                            className={`h-2 ${feedback.scores.ai_qa_effort < 0.5 ? "[&>div]:bg-destructive" : "[&>div]:bg-success"}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {(feedback.scores.ai_qa_effort * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {feedback.scores?.ai_qa_coherence !== undefined ? (
                        <div className="w-16">
                          <Progress 
                            value={feedback.scores.ai_qa_coherence * 100} 
                            className={`h-2 ${feedback.scores.ai_qa_coherence < 0.6 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {(feedback.scores.ai_qa_coherence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getQABadge(feedback.qa_status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedFeedback(feedback)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!feedback.scores?.ai_qa_risk && feedback.qa_status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => runStrictQATriage(feedback.id)}
                            disabled={runningStrictQA}
                          >
                            <Brain className="h-4 w-4" />
                          </Button>
                        )}
                        {feedback.qa_status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-success hover:text-success"
                              onClick={() => validateFeedback(feedback.id, "validated")}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => validateFeedback(feedback.id, "rejected")}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page + 1} • {filteredFeedbacks.length} résultats
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={filteredFeedbacks.length < pageSize}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Détail du Feedback
              {selectedFeedback?.gold_task && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Gold Task
                </Badge>
              )}
              {selectedFeedback?.scores?.ai_qa_triage && (
                getRiskBadge(selectedFeedback.scores.ai_qa_triage, selectedFeedback.scores.ai_qa_risk)
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedFeedback?.job_role} • {selectedFeedback?.job_level_targeted} • {selectedFeedback?.language.toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              {/* AI QA Analysis */}
              {selectedFeedback.scores?.ai_qa_risk !== undefined && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      AI STRICT MODE Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Effort Score</p>
                        <Progress 
                          value={(selectedFeedback.scores.ai_qa_effort || 0) * 100} 
                          className={`h-3 ${(selectedFeedback.scores.ai_qa_effort || 0) < 0.5 ? "[&>div]:bg-destructive" : "[&>div]:bg-success"}`}
                        />
                        <p className="text-sm font-medium">{((selectedFeedback.scores.ai_qa_effort || 0) * 100).toFixed(0)}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Coherence Score</p>
                        <Progress 
                          value={(selectedFeedback.scores.ai_qa_coherence || 0) * 100} 
                          className={`h-3 ${(selectedFeedback.scores.ai_qa_coherence || 0) < 0.6 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
                        />
                        <p className="text-sm font-medium">{((selectedFeedback.scores.ai_qa_coherence || 0) * 100).toFixed(0)}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Comment Quality</p>
                        <Progress 
                          value={(selectedFeedback.scores.ai_qa_comment_quality || 0) * 100} 
                          className={`h-3 ${(selectedFeedback.scores.ai_qa_comment_quality || 0) < 0.4 ? "[&>div]:bg-destructive" : "[&>div]:bg-success"}`}
                        />
                        <p className="text-sm font-medium">{((selectedFeedback.scores.ai_qa_comment_quality || 0) * 100).toFixed(0)}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Risk Score</p>
                        <Progress 
                          value={(selectedFeedback.scores.ai_qa_risk || 0) * 100} 
                          className={`h-3 ${(selectedFeedback.scores.ai_qa_risk || 0) >= 0.4 ? "[&>div]:bg-destructive" : (selectedFeedback.scores.ai_qa_risk || 0) >= 0.2 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
                        />
                        <p className="text-sm font-medium">{((selectedFeedback.scores.ai_qa_risk || 0) * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Role Match</p>
                        {getRoleMatchBadge(selectedFeedback.scores.ai_qa_role_match)}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Triage Decision</p>
                        {getRiskBadge(selectedFeedback.scores.ai_qa_triage, selectedFeedback.scores.ai_qa_risk)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rating & Scores */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Avis global</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    {getRatingIcon(selectedFeedback.overall_rating)}
                    <span className="capitalize">{selectedFeedback.overall_rating}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Action préférée</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline">
                      {selectedFeedback.preferred_action === "accept" ? "✅ Accepter" :
                       selectedFeedback.preferred_action === "regenerate" ? "🔄 Régénérer" :
                       selectedFeedback.preferred_action === "edit" ? "✏️ Modifier" : "—"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Human Scores */}
              {selectedFeedback.scores && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Scores détaillés (Humain)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                      {Object.entries(selectedFeedback.scores as Record<string, any>)
                        .filter(([key]) => !key.startsWith("ai_qa_"))
                        .map(([key, value]) => (
                          <div key={key} className="text-center p-2 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                            <p className="text-lg font-bold">{typeof value === "number" ? value : "—"}/5</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Issues */}
              {selectedFeedback.issues_detected && selectedFeedback.issues_detected.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Problèmes détectés</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedFeedback.issues_detected.map((issue) => (
                        <Badge key={issue} variant="secondary">
                          {ISSUES_LABELS[issue] || issue}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Comment */}
              {selectedFeedback.free_text_comment && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Commentaire</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">
                      {selectedFeedback.free_text_comment}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedFeedback.free_text_comment.length} caractères
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Expert Profile Snapshot */}
              {selectedFeedback.expert_profile_snapshot && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Profil Expert (snapshot)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">TJM:</span>{" "}
                        {selectedFeedback.expert_profile_snapshot.work_preferences?.daily_rate_eur || "—"}€
                      </div>
                      <div>
                        <span className="text-muted-foreground">KYC:</span>{" "}
                        <Badge variant={selectedFeedback.expert_profile_snapshot.platform_engagement?.kyc_status === "verified" ? "default" : "secondary"}>
                          {selectedFeedback.expert_profile_snapshot.platform_engagement?.kyc_status || "pending"}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Complétude:</span>{" "}
                        {selectedFeedback.expert_profile_snapshot.platform_engagement?.profile_completeness || 0}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* QA Notes */}
              {selectedFeedback.qa_status === "pending" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes QA (optionnel)</label>
                  <Textarea
                    placeholder="Ajoutez des notes pour la validation..."
                    value={qaNotes}
                    onChange={(e) => setQaNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedFeedback?.qa_status === "pending" && (
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => triggerSecondAnnotation(selectedFeedback.id)}
                  disabled={processing}
                >
                  Demander 2e annotation
                </Button>
                {!selectedFeedback.scores?.ai_qa_risk && (
                  <Button
                    variant="outline"
                    onClick={() => runStrictQATriage(selectedFeedback.id)}
                    disabled={runningStrictQA}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Analyser AI
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  variant="destructive"
                  onClick={() => validateFeedback(selectedFeedback.id, "rejected")}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeter
                </Button>
                <Button
                  onClick={() => validateFeedback(selectedFeedback.id, "validated")}
                  disabled={processing}
                  className="bg-success hover:bg-success/90"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Valider
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RLHFQAInterface;
