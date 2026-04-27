import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Brain, ThumbsUp, ThumbsDown, Download, TrendingUp, 
  BarChart3, MessageSquare, Sparkles, RefreshCw, FileJson,
  Users, AlertTriangle, CheckCircle, Star, Award, Shield,
  PieChart as PieChartIcon, Activity, Target, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend
} from "recharts";

interface RLHFFeedback {
  id: string;
  task_type: string;
  job_role: string;
  job_level_targeted: string;
  language: string;
  country_context: string;
  overall_rating: string;
  scores: {
    clarity?: number;
    relevance?: number;
    difficulty_alignment?: number;
    job_realism?: number;
    bias_risk?: number;
  } | null;
  issues_detected: string[] | null;
  free_text_comment: string | null;
  preferred_action: string | null;
  annotator_id: string;
  expert_id: string | null;
  qa_status: string;
  agreement_score: number | null;
  created_at: string;
}

interface AnnotatorProfile {
  id: string;
  anonymized_id: string;
  role: string;
  seniority: string;
  experience_years: number;
  country: string;
  languages: string[];
}

interface AnnotatorStats {
  annotator_id: string;
  total_feedbacks: number;
  avg_scores: { [key: string]: number };
  rating_distribution: { up: number; down: number; neutral: number };
  avg_agreement_score: number | null;
  common_issues: string[];
  qa_validation_rate: number;
}

// Normalized issues for display
const ISSUES_LABELS: Record<string, string> = {
  "too_theoretical": "Trop théorique",
  "too_practical": "Trop pratique",
  "not_job_representative": "Non représentatif du poste",
  "too_easy": "Trop facile",
  "too_hard": "Trop difficile",
  "unclear_questions": "Questions floues",
  "biased_content": "Contenu biaisé",
  "outdated_tech": "Technologies obsolètes",
  "missing_context": "Contexte manquant",
  "time_unrealistic": "Temps irréaliste",
};

const SCORE_LABELS = {
  clarity: "Clarté",
  relevance: "Pertinence",
  difficulty_alignment: "Difficulté",
  job_realism: "Réalisme",
  bias_risk: "Biais",
};

const COLORS = {
  primary: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  destructive: "#ef4444",
  muted: "#6b7280",
  purple: "#8b5cf6",
};

const RATING_COLORS = {
  up: COLORS.success,
  neutral: COLORS.warning,
  down: COLORS.destructive,
};

export function RLHFAdvancedDashboard() {
  const [feedbacks, setFeedbacks] = useState<RLHFFeedback[]>([]);
  const [annotatorProfiles, setAnnotatorProfiles] = useState<AnnotatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30d");
  const [selectedTab, setSelectedTab] = useState("overview");

  useEffect(() => {
    loadData();
  }, [dateRange]);

  async function loadData() {
    setLoading(true);
    try {
      const daysAgo = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const startDate = subDays(new Date(), daysAgo).toISOString();

      const [feedbackRes, annotatorRes] = await Promise.all([
        supabase
          .from("rlhf_feedback")
          .select("*")
          .gte("created_at", startDate)
          .order("created_at", { ascending: false }),
        supabase
          .from("annotator_profiles")
          .select("*")
      ]);

      if (feedbackRes.error) throw feedbackRes.error;
      if (annotatorRes.error) throw annotatorRes.error;

      setFeedbacks((feedbackRes.data as RLHFFeedback[]) || []);
      setAnnotatorProfiles((annotatorRes.data as AnnotatorProfile[]) || []);
    } catch (error) {
      console.error("Error loading RLHF data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }

  // Calculate statistics
  const stats = {
    total: feedbacks.length,
    byRating: {
      up: feedbacks.filter(f => f.overall_rating === "up").length,
      neutral: feedbacks.filter(f => f.overall_rating === "neutral").length,
      down: feedbacks.filter(f => f.overall_rating === "down").length,
    },
    byQAStatus: {
      pending: feedbacks.filter(f => f.qa_status === "pending").length,
      validated: feedbacks.filter(f => f.qa_status === "validated").length,
      rejected: feedbacks.filter(f => f.qa_status === "rejected").length,
    },
    withComments: feedbacks.filter(f => f.free_text_comment && f.free_text_comment.length > 0).length,
    avgScores: calculateAvgScores(feedbacks),
    issuesFrequency: calculateIssuesFrequency(feedbacks),
    byLanguage: countBy(feedbacks, f => f.language),
    byCountry: countBy(feedbacks, f => f.country_context),
    byJobLevel: countBy(feedbacks, f => f.job_level_targeted),
    byPreferredAction: countBy(feedbacks, f => f.preferred_action || "none"),
  };

  const annotatorStats = calculateAnnotatorStats(feedbacks, annotatorProfiles);
  const satisfactionRate = stats.total > 0 ? Math.round((stats.byRating.up / stats.total) * 100) : 0;
  const qaValidationRate = (stats.byQAStatus.validated + stats.byQAStatus.rejected) > 0
    ? Math.round((stats.byQAStatus.validated / (stats.byQAStatus.validated + stats.byQAStatus.rejected)) * 100)
    : 0;

  // Chart data
  const ratingPieData = [
    { name: "Positif", value: stats.byRating.up, color: COLORS.success },
    { name: "Neutre", value: stats.byRating.neutral, color: COLORS.warning },
    { name: "Négatif", value: stats.byRating.down, color: COLORS.destructive },
  ].filter(d => d.value > 0);

  const issuesBarData = Object.entries(stats.issuesFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([issue, count]) => ({
      issue: ISSUES_LABELS[issue] || issue,
      count,
      percentage: Math.round((count / stats.total) * 100),
    }));

  const scoresRadarData = Object.entries(stats.avgScores).map(([key, value]) => ({
    subject: SCORE_LABELS[key as keyof typeof SCORE_LABELS] || key,
    score: value,
    fullMark: 5,
  }));

  const actionPieData = Object.entries(stats.byPreferredAction)
    .filter(([key]) => key !== "none")
    .map(([action, count], idx) => ({
      name: action === "accept" ? "Accepter" : action === "regenerate" ? "Régénérer" : "Modifier",
      value: count,
      color: [COLORS.success, COLORS.primary, COLORS.warning][idx % 3],
    }));

  const dailyData = calculateDailyData(feedbacks);

  async function exportGoldStandard() {
    try {
      const { data, error } = await supabase.functions.invoke("export-rlhf-gold", {
        body: { format: "jsonl", limit: 5000 }
      });

      if (error) throw error;

      if (data.data) {
        const blob = new Blob([data.data], { type: "application/jsonl" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `rlhf_gold_${Date.now()}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${data.count} feedbacks exportés au format Gold Standard`);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erreur lors de l'export");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Dashboard RLHF Avancé
          </h2>
          <p className="text-muted-foreground">
            Qualité des annotateurs, distribution des scores, issues fréquentes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
              <SelectItem value="90d">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={exportGoldStandard} className="gap-2">
            <FileJson className="h-4 w-4" />
            Export Gold
          </Button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Total Feedbacks</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Satisfaction</p>
                <p className="text-2xl font-bold text-success">{satisfactionRate}%</p>
              </div>
              <ThumbsUp className="h-8 w-8 text-success opacity-50" />
            </div>
            <Progress value={satisfactionRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Annotateurs</p>
                <p className="text-2xl font-bold">{annotatorProfiles.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Taux QA</p>
                <p className="text-2xl font-bold text-primary">{qaValidationRate}%</p>
              </div>
              <Shield className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Avec commentaires</p>
                <p className="text-2xl font-bold">{stats.withComments}</p>
              </div>
              <Sparkles className="h-8 w-8 text-warning opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="scores">Scores détaillés</TabsTrigger>
          <TabsTrigger value="issues">Issues fréquentes</TabsTrigger>
          <TabsTrigger value="annotators">Qualité annotateurs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Rating Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Distribution des avis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ratingPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={ratingPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {ratingPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Pas de données
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Évolution quotidienne
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(d) => format(new Date(d), "dd/MM")}
                        fontSize={11}
                      />
                      <YAxis fontSize={11} />
                      <Tooltip labelFormatter={(d) => format(new Date(d), "dd MMM")} />
                      <Area type="monotone" dataKey="up" stackId="1" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.6} name="Positif" />
                      <Area type="monotone" dataKey="neutral" stackId="1" stroke={COLORS.warning} fill={COLORS.warning} fillOpacity={0.6} name="Neutre" />
                      <Area type="monotone" dataKey="down" stackId="1" stroke={COLORS.destructive} fill={COLORS.destructive} fillOpacity={0.6} name="Négatif" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Pas de données
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Distribution & Language/Country */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Actions préférées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.byPreferredAction).map(([action, count]) => (
                    <div key={action} className="flex items-center justify-between">
                      <span className="text-sm capitalize">
                        {action === "accept" ? "✅ Accepter" : 
                         action === "regenerate" ? "🔄 Régénérer" : 
                         action === "edit" ? "✏️ Modifier" : "⏳ Non spécifié"}
                      </span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Par langue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.byLanguage).slice(0, 5).map(([lang, count]) => (
                    <div key={lang} className="flex items-center justify-between">
                      <span className="text-sm">{lang.toUpperCase()}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Par niveau</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.byJobLevel).map(([level, count]) => (
                    <div key={level} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{level}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scores Tab */}
        <TabsContent value="scores" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Radar Chart for scores */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Profil des scores moyens
                </CardTitle>
                <CardDescription>
                  Moyenne des scores sur 5 dimensions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scoresRadarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={scoresRadarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" fontSize={12} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} />
                      <Radar 
                        name="Score moyen" 
                        dataKey="score" 
                        stroke={COLORS.primary} 
                        fill={COLORS.primary} 
                        fillOpacity={0.5} 
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Pas de données de scores
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Détail des scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.avgScores).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{SCORE_LABELS[key as keyof typeof SCORE_LABELS] || key}</span>
                        <span className="font-medium">{value.toFixed(2)}/5</span>
                      </div>
                      <Progress value={(value / 5) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Score Distribution by Rating */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scores par type de rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {["up", "neutral", "down"].map((rating) => {
                  const ratingFeedbacks = feedbacks.filter(f => f.overall_rating === rating);
                  const avgScores = calculateAvgScores(ratingFeedbacks);
                  return (
                    <div key={rating} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-3">
                        {rating === "up" && <ThumbsUp className="h-5 w-5 text-success" />}
                        {rating === "neutral" && <span className="text-xl">➖</span>}
                        {rating === "down" && <ThumbsDown className="h-5 w-5 text-destructive" />}
                        <span className="font-medium capitalize">
                          {rating === "up" ? "Positif" : rating === "neutral" ? "Neutre" : "Négatif"}
                        </span>
                        <Badge variant="secondary" className="ml-auto">{ratingFeedbacks.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(avgScores).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{SCORE_LABELS[key as keyof typeof SCORE_LABELS]}</span>
                            <span className="font-medium">{value.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Issues Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Issues les plus fréquentes
                </CardTitle>
                <CardDescription>
                  Problèmes identifiés par les annotateurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {issuesBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={issuesBarData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="issue" type="category" width={150} fontSize={11} />
                      <Tooltip formatter={(value) => [`${value} occurrences`, "Fréquence"]} />
                      <Bar dataKey="count" fill={COLORS.warning} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    Aucune issue détectée
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Issues Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Détails des issues</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issuesBarData.map((item) => (
                      <TableRow key={item.issue}>
                        <TableCell className="font-medium">{item.issue}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.percentage > 20 ? "destructive" : item.percentage > 10 ? "outline" : "secondary"}>
                            {item.percentage}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {issuesBarData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Aucune issue détectée
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Issues by Rating */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Issues par type de feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {["up", "neutral", "down"].map((rating) => {
                  const ratingFeedbacks = feedbacks.filter(f => f.overall_rating === rating);
                  const issues = calculateIssuesFrequency(ratingFeedbacks);
                  const topIssues = Object.entries(issues).sort((a, b) => b[1] - a[1]).slice(0, 3);
                  
                  return (
                    <div key={rating} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-3">
                        {rating === "up" && <ThumbsUp className="h-4 w-4 text-success" />}
                        {rating === "neutral" && <span>➖</span>}
                        {rating === "down" && <ThumbsDown className="h-4 w-4 text-destructive" />}
                        <span className="font-medium text-sm">
                          {rating === "up" ? "Feedbacks positifs" : rating === "neutral" ? "Feedbacks neutres" : "Feedbacks négatifs"}
                        </span>
                      </div>
                      {topIssues.length > 0 ? (
                        <div className="space-y-2">
                          {topIssues.map(([issue, count]) => (
                            <div key={issue} className="flex justify-between text-xs">
                              <span className="text-muted-foreground truncate">{ISSUES_LABELS[issue] || issue}</span>
                              <Badge variant="outline" className="ml-2">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Aucune issue</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Annotators Tab */}
        <TabsContent value="annotators" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Annotators */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-warning" />
                  Top Annotateurs
                </CardTitle>
                <CardDescription>
                  Classement par nombre de feedbacks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {annotatorStats.slice(0, 10).map((annotator, idx) => (
                    <div key={annotator.annotator_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx < 3 ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{annotator.annotator_id}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            {annotator.rating_distribution.up}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <ThumbsDown className="h-3 w-3 mr-1" />
                            {annotator.rating_distribution.down}
                          </Badge>
                        </div>
                      </div>
                      <Badge>{annotator.total_feedbacks}</Badge>
                    </div>
                  ))}
                  {annotatorStats.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun annotateur
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Annotator Quality */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-warning" />
                  Qualité des annotateurs
                </CardTitle>
                <CardDescription>
                  Scores moyens et taux de validation QA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Annotateur</TableHead>
                      <TableHead className="text-center">Score moyen</TableHead>
                      <TableHead className="text-center">Validation QA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annotatorStats.slice(0, 10).map((annotator) => {
                      const avgScore = Object.values(annotator.avg_scores).length > 0
                        ? Object.values(annotator.avg_scores).reduce((a, b) => a + b, 0) / Object.values(annotator.avg_scores).length
                        : 0;
                      return (
                        <TableRow key={annotator.annotator_id}>
                          <TableCell className="font-medium text-sm">{annotator.annotator_id}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-3 w-3 text-warning fill-warning" />
                              <span>{avgScore.toFixed(1)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={annotator.qa_validation_rate >= 80 ? "default" : annotator.qa_validation_rate >= 50 ? "outline" : "destructive"}>
                              {annotator.qa_validation_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Annotator Demographics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profil des annotateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                {/* By Role */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium mb-3">Par rôle</p>
                  {Object.entries(countBy(annotatorProfiles, p => p.role)).slice(0, 5).map(([role, count]) => (
                    <div key={role} className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground truncate">{role.replace(/_/g, " ")}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
                
                {/* By Seniority */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium mb-3">Par séniorité</p>
                  {Object.entries(countBy(annotatorProfiles, p => p.seniority)).map(([level, count]) => (
                    <div key={level} className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground capitalize">{level}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>

                {/* By Country */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium mb-3">Par pays</p>
                  {Object.entries(countBy(annotatorProfiles, p => p.country)).slice(0, 5).map(([country, count]) => (
                    <div key={country} className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground truncate">{country}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>

                {/* Avg Experience */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm font-medium mb-3">Expérience</p>
                  <div className="text-center py-4">
                    <p className="text-3xl font-bold text-primary">
                      {annotatorProfiles.length > 0 
                        ? (annotatorProfiles.reduce((s, p) => s + p.experience_years, 0) / annotatorProfiles.length).toFixed(1)
                        : 0}
                    </p>
                    <p className="text-xs text-muted-foreground">années en moyenne</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper functions
function calculateAvgScores(feedbacks: RLHFFeedback[]): Record<string, number> {
  const scoreKeys = ["clarity", "relevance", "difficulty_alignment", "job_realism", "bias_risk"];
  const totals: Record<string, { sum: number; count: number }> = {};
  
  scoreKeys.forEach(key => {
    totals[key] = { sum: 0, count: 0 };
  });

  feedbacks.forEach(f => {
    if (f.scores) {
      scoreKeys.forEach(key => {
        const score = f.scores?.[key as keyof typeof f.scores];
        if (typeof score === "number") {
          totals[key].sum += score;
          totals[key].count += 1;
        }
      });
    }
  });

  const result: Record<string, number> = {};
  scoreKeys.forEach(key => {
    result[key] = totals[key].count > 0 ? totals[key].sum / totals[key].count : 0;
  });

  return result;
}

function calculateIssuesFrequency(feedbacks: RLHFFeedback[]): Record<string, number> {
  const frequency: Record<string, number> = {};
  
  feedbacks.forEach(f => {
    if (f.issues_detected && Array.isArray(f.issues_detected)) {
      f.issues_detected.forEach(issue => {
        frequency[issue] = (frequency[issue] || 0) + 1;
      });
    }
  });

  return frequency;
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function calculateAnnotatorStats(feedbacks: RLHFFeedback[], profiles: AnnotatorProfile[]): AnnotatorStats[] {
  const byAnnotator: Record<string, RLHFFeedback[]> = {};
  
  feedbacks.forEach(f => {
    if (!byAnnotator[f.annotator_id]) {
      byAnnotator[f.annotator_id] = [];
    }
    byAnnotator[f.annotator_id].push(f);
  });

  return Object.entries(byAnnotator)
    .map(([annotator_id, fbs]) => {
      const validated = fbs.filter(f => f.qa_status === "validated").length;
      const reviewed = fbs.filter(f => f.qa_status === "validated" || f.qa_status === "rejected").length;
      
      return {
        annotator_id,
        total_feedbacks: fbs.length,
        avg_scores: calculateAvgScores(fbs),
        rating_distribution: {
          up: fbs.filter(f => f.overall_rating === "up").length,
          neutral: fbs.filter(f => f.overall_rating === "neutral").length,
          down: fbs.filter(f => f.overall_rating === "down").length,
        },
        avg_agreement_score: null,
        common_issues: Object.entries(calculateIssuesFrequency(fbs))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([issue]) => issue),
        qa_validation_rate: reviewed > 0 ? Math.round((validated / reviewed) * 100) : 100,
      };
    })
    .sort((a, b) => b.total_feedbacks - a.total_feedbacks);
}

function calculateDailyData(feedbacks: RLHFFeedback[]): { date: string; up: number; neutral: number; down: number }[] {
  const byDay: Record<string, { up: number; neutral: number; down: number }> = {};
  
  feedbacks.forEach(f => {
    const day = format(new Date(f.created_at), "yyyy-MM-dd");
    if (!byDay[day]) {
      byDay[day] = { up: 0, neutral: 0, down: 0 };
    }
    if (f.overall_rating === "up") byDay[day].up++;
    if (f.overall_rating === "neutral") byDay[day].neutral++;
    if (f.overall_rating === "down") byDay[day].down++;
  });

  return Object.entries(byDay)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default RLHFAdvancedDashboard;