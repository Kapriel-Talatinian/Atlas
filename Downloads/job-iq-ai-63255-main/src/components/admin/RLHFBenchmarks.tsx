import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart3,
  Users,
  FileCheck,
  TrendingUp,
  Clock,
  Target,
  Award,
  Loader2,
  RefreshCw,
  Globe,
  Zap,
  Brain,
  Languages
} from "lucide-react";

interface DatasetStats {
  totalFeedback: number;
  validatedFeedback: number;
  totalAnnotators: number;
  avgAgreementScore: number;
  byLanguage: Record<string, number>;
  byTaskType: Record<string, number>;
  byTier: Record<string, number>;
  goldTaskAccuracy: number;
  avgScores: {
    clarity: number;
    relevance: number;
    difficulty: number;
    realism: number;
    bias: number;
  };
  disagreementRate: number;
  seniorOverrideRate: number;
}

export function RLHFBenchmarks() {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const [feedbackRes, annotatorsRes, disagreementsRes] = await Promise.all([
        supabase.from("rlhf_feedback").select("*"),
        supabase.from("annotator_profiles").select("*"),
        supabase.from("rlhf_disagreements").select("*")
      ]);

      if (feedbackRes.error) throw feedbackRes.error;

      const feedback = feedbackRes.data || [];
      const annotators = annotatorsRes.data || [];
      const disagreements = disagreementsRes.data || [];

      // Calculate language distribution
      const byLanguage: Record<string, number> = {};
      feedback.forEach((f: any) => {
        const lang = f.language || "fr";
        byLanguage[lang] = (byLanguage[lang] || 0) + 1;
      });

      // Calculate task type distribution
      const byTaskType: Record<string, number> = {};
      feedback.forEach((f: any) => {
        const type = f.task_type || "unknown";
        byTaskType[type] = (byTaskType[type] || 0) + 1;
      });

      // Calculate tier distribution
      const byTier: Record<string, number> = {};
      annotators.forEach((a: any) => {
        const tier = a.tier || "expert";
        byTier[tier] = (byTier[tier] || 0) + 1;
      });

      // Calculate average scores
      const scoresSum = { clarity: 0, relevance: 0, difficulty: 0, realism: 0, bias: 0 };
      let scoresCount = 0;
      feedback.forEach((f: any) => {
        if (f.scores) {
          scoresCount++;
          scoresSum.clarity += f.scores.clarity || 0;
          scoresSum.relevance += f.scores.relevance || 0;
          scoresSum.difficulty += f.scores.difficulty_alignment || 0;
          scoresSum.realism += f.scores.job_realism || 0;
          scoresSum.bias += f.scores.bias_risk || 0;
        }
      });

      // Calculate gold task accuracy
      const goldAnnotators = annotators.filter((a: any) => a.gold_tasks_completed > 0);
      const goldAccuracy = goldAnnotators.length > 0
        ? goldAnnotators.reduce((acc: number, a: any) => acc + (a.gold_tasks_passed / a.gold_tasks_completed), 0) / goldAnnotators.length
        : 0;

      // Calculate disagreement and override rates
      const resolvedDisagreements = disagreements.filter((d: any) => d.is_resolved);
      const seniorOverrides = resolvedDisagreements.filter((d: any) => d.senior_resolution);

      setStats({
        totalFeedback: feedback.length,
        validatedFeedback: feedback.filter((f: any) => f.qa_status === "validated").length,
        totalAnnotators: annotators.length,
        avgAgreementScore: feedback.reduce((acc: number, f: any) => acc + (f.agreement_score || 0), 0) / Math.max(feedback.length, 1),
        byLanguage,
        byTaskType,
        byTier,
        goldTaskAccuracy: goldAccuracy * 100,
        avgScores: scoresCount > 0 ? {
          clarity: scoresSum.clarity / scoresCount,
          relevance: scoresSum.relevance / scoresCount,
          difficulty: scoresSum.difficulty / scoresCount,
          realism: scoresSum.realism / scoresCount,
          bias: scoresSum.bias / scoresCount
        } : { clarity: 0, relevance: 0, difficulty: 0, realism: 0, bias: 0 },
        disagreementRate: feedback.length > 0 ? (disagreements.length / feedback.length) * 100 : 0,
        seniorOverrideRate: resolvedDisagreements.length > 0 ? (seniorOverrides.length / resolvedDisagreements.length) * 100 : 0
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const validationRate = stats.totalFeedback > 0 
    ? (stats.validatedFeedback / stats.totalFeedback) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Statistiques & Benchmarks
          </h2>
          <p className="text-muted-foreground">
            Métriques du dataset RLHF pour pitch et monétisation
          </p>
        </div>
        <Button variant="outline" onClick={loadStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-primary/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.totalFeedback.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Feedback Units</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Target className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{validationRate.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Taux de validation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.totalAnnotators}</p>
                <p className="text-sm text-muted-foreground">Annotateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <Award className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.goldTaskAccuracy.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Gold Task Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Métriques de Qualité
          </CardTitle>
          <CardDescription>
            Scores moyens et indicateurs de fiabilité du dataset
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Bars */}
          <div className="space-y-4">
            {[
              { key: "clarity", label: "Clarté", value: stats.avgScores.clarity, color: "bg-blue-500" },
              { key: "relevance", label: "Pertinence", value: stats.avgScores.relevance, color: "bg-green-500" },
              { key: "difficulty", label: "Difficulté", value: stats.avgScores.difficulty, color: "bg-amber-500" },
              { key: "realism", label: "Réalisme métier", value: stats.avgScores.realism, color: "bg-purple-500" },
              { key: "bias", label: "Risque de biais (inversé)", value: 5 - stats.avgScores.bias, color: "bg-red-500" }
            ].map((score) => (
              <div key={score.key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{score.label}</span>
                  <span className="font-medium">{score.value.toFixed(1)}/5</span>
                </div>
                <Progress value={(score.value / 5) * 100} className="h-2" />
              </div>
            ))}
          </div>

          <Separator />

          {/* Reliability Metrics */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Taux de désaccord</span>
              </div>
              <p className="text-2xl font-bold">{stats.disagreementRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Inter-tier disagreements</p>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="font-medium">Override Senior</span>
              </div>
              <p className="text-2xl font-bold">{stats.seniorOverrideRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Résolutions par Seniors</p>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Agreement Score</span>
              </div>
              <p className="text-2xl font-bold">{(stats.avgAgreementScore * 100).toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Moyenne inter-annotateurs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Language Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Languages className="h-5 w-5" />
              Par Langue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.byLanguage).map(([lang, count]) => (
                <div key={lang} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="uppercase">
                      {lang}
                    </Badge>
                    <span className="text-sm">{lang === "fr" ? "Français" : lang === "en" ? "English" : lang}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(stats.byLanguage).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="h-5 w-5" />
              Par Type de Tâche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.byTaskType).slice(0, 5).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm truncate max-w-[150px]" title={type}>
                    {type.replace(/_/g, " ")}
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
              {Object.keys(stats.byTaskType).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Par Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { tier: "student", label: "Students", color: "bg-blue-500" },
                { tier: "expert", label: "Experts", color: "bg-green-500" },
                { tier: "senior", label: "Seniors", color: "bg-amber-500" }
              ].map(({ tier, label, color }) => (
                <div key={tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-sm">{label}</span>
                  </div>
                  <span className="font-medium">{stats.byTier[tier] || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Value Proposition Card */}
      <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">Valeur du Dataset</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Estimation basée sur les métriques de qualité et le volume de données
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-background/50 border">
                  <p className="text-xs text-muted-foreground">Prix/Unit (Bronze)</p>
                  <p className="text-lg font-bold">$5-8</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border">
                  <p className="text-xs text-muted-foreground">Prix/Unit (Gold)</p>
                  <p className="text-lg font-bold">$12-15</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border">
                  <p className="text-xs text-muted-foreground">Prix/Unit (Diamond)</p>
                  <p className="text-lg font-bold">$18-25</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
