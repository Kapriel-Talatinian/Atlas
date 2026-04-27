import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, Brain, Code, Eye, Trophy, AlertTriangle, 
  Clock, Loader2, CheckCircle, XCircle, ArrowRight,
  TrendingUp, Award, Linkedin, Download, ChevronDown, ChevronUp,
  Target, BookOpen, Lightbulb, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phase1Quiz } from "@/components/assessment/Phase1Quiz";
import { Phase2Coding } from "@/components/assessment/Phase2Coding";
import { Phase3CodeReview } from "@/components/assessment/Phase3CodeReview";
import { useIntegrityMonitor } from "@/hooks/useIntegrityMonitor";
import type { 
  TechStack, AssessmentSession, QuizResult, 
  ChallengeResult, CodeReviewResult, GlobalScore,
  QuizQuestion, CodingChallenge, CodeReviewChallenge 
} from "@/types/assessment";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

const SUPPORTED_STACKS: { value: TechStack; label: string }[] = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "csharp", label: "C#" },
  { value: "rust", label: "Rust" },
  { value: "kotlin", label: "Kotlin" },
];

const DIMENSION_LABELS: Record<string, string> = {
  fundamentals: "Fondamentaux",
  problemSolving: "Résolution de problèmes",
  codeQuality: "Qualité de code",
  architecture: "Architecture",
  debugging: "Debugging",
};

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  junior: { label: "Junior", color: "bg-zinc-500" },
  mid: { label: "Mid-Level", color: "bg-blue-500" },
  senior: { label: "Senior", color: "bg-amber-500" },
  expert: { label: "Expert", color: "bg-emerald-500" },
};

type PageState = "setup" | "phase1" | "phase2" | "phase3" | "results" | "loading" | "error";

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pageState, setPageState] = useState<PageState>("setup");
  const [selectedStack, setSelectedStack] = useState<TechStack>("typescript");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [cooldownDaysLeft, setCooldownDaysLeft] = useState<number>(0);

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [codingChallenge, setCodingChallenge] = useState<CodingChallenge | null>(null);
  const [codeReviewChallenge, setCodeReviewChallenge] = useState<CodeReviewChallenge | null>(null);
  const [globalScore, setGlobalScore] = useState<GlobalScore | null>(null);

  const [phase1Result, setPhase1Result] = useState<QuizResult | null>(null);
  const [phase2Result, setPhase2Result] = useState<ChallengeResult | null>(null);
  const [phase3Result, setPhase3Result] = useState<CodeReviewResult | null>(null);

  // Results extras
  const [percentileData, setPercentileData] = useState<{ percentile: number; total: number } | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [explanations, setExplanations] = useState<any[]>([]);
  const [showExplanations, setShowExplanations] = useState(false);
  const [resultsTab, setResultsTab] = useState("overview");

  const integrity = useIntegrityMonitor(sessionId);
  const [expertId, setExpertId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("expert_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (profile) {
        setExpertId(profile.id);
        
        const { data: lastSession } = await supabase
          .from("assessment_sessions")
          .select("completed_at")
          .eq("candidate_id", profile.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .single();
        
        if (lastSession?.completed_at) {
          const completedDate = new Date(lastSession.completed_at);
          const cooldownEnd = new Date(completedDate);
          cooldownEnd.setDate(cooldownEnd.getDate() + 30);
          if (cooldownEnd > new Date()) {
            setCooldownUntil(cooldownEnd);
            setCooldownDaysLeft(Math.ceil((cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          }
        }
      }
    };
    getProfile();
  }, [navigate]);

  const startAssessment = useCallback(async () => {
    if (!expertId || !userId) { toast.error("Profil expert requis"); return; }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data: session, error: sessErr } = await supabase
        .from("assessment_sessions")
        .insert({
          candidate_id: expertId,
          user_id: userId,
          stack: selectedStack,
          status: "in_progress",
          current_phase: 1,
          phase1_started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessErr) throw sessErr;
      setSessionId(session.id);

      const { data: quizData, error: quizErr } = await supabase.functions.invoke("assessment-engine", {
        body: { action: "generate_quiz", stack: selectedStack, expert_id: expertId },
      });
      if (quizErr) throw quizErr;

      const questionIds = quizData?.question_ids || [];
      if (questionIds.length > 0) {
        // Store question IDs in session for post-test review
        await supabase
          .from("assessment_sessions")
          .update({ quiz_question_ids: questionIds })
          .eq("id", session.id);

        const { data: questions } = await supabase
          .from("quiz_questions")
          .select("*")
          .in("id", questionIds.slice(0, 20));
        setQuizQuestions((questions || []) as unknown as QuizQuestion[]);
      }

      const [challengeRes, reviewRes] = await Promise.all([
        supabase.functions.invoke("assessment-engine", {
          body: { action: "generate_coding_challenge", stack: selectedStack },
        }),
        supabase.functions.invoke("assessment-engine", {
          body: { action: "generate_code_review", stack: selectedStack },
        }),
      ]);

      if (challengeRes.data?.challenge) {
        setCodingChallenge(challengeRes.data.challenge as unknown as CodingChallenge);
      }
      if (reviewRes.data?.review) {
        setCodeReviewChallenge(reviewRes.data.review as unknown as CodeReviewChallenge);
      }

      setPageState("phase1");
    } catch (err) {
      console.error("Start assessment error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Erreur lors du démarrage");
      toast.error("Erreur lors du démarrage de l'évaluation");
    } finally {
      setIsLoading(false);
    }
  }, [expertId, userId, selectedStack]);

  // Phase completions
  const handlePhase1Complete = useCallback(async (result: QuizResult) => {
    setPhase1Result(result);

    if (sessionId) {
      await supabase
        .from("assessment_sessions")
        .update({
          phase1_result: result as any,
          phase1_completed_at: new Date().toISOString(),
          current_phase: 2,
          phase2_started_at: new Date().toISOString(),
          integrity_flags: integrity.flags as any,
        })
        .eq("id", sessionId);

      // Detect quiz anti-patterns (A2.13)
      supabase.functions.invoke("assessment-engine", {
        body: { action: "detect_quiz_patterns", answers: result.answers },
      }).then(({ data }) => {
        if (data?.flagged) {
          for (const p of data.patterns || []) {
            integrity.addFlag({
              type: p.type === "sequential_pattern" ? "typing_anomaly" : "idle_then_burst",
              severity: p.severity as any,
              details: p.details,
            });
          }
        }
      }).catch(() => {});
    }

    toast.success(`Phase 1 terminée ! Score calibré: ${result.calibrated_score}%`);
    setPageState("phase2");
  }, [sessionId, integrity]);

  const handlePhase2Complete = useCallback(async (result: ChallengeResult) => {
    setPhase2Result(result);

    if (sessionId) {
      // Evaluate code via AI before storing
      let enrichedResult = result;
      try {
        const { data: evalData } = await supabase.functions.invoke("assessment-engine", {
          body: {
            action: "evaluate_code",
            code: result.code_submitted,
            challenge_id: codingChallenge?.id,
            stack: selectedStack,
          },
        });
        if (evalData?.evaluation) {
          const ev = evalData.evaluation;
          enrichedResult = {
            ...result,
            weighted_score: ev.weighted_score || result.weighted_score,
            criteria_scores: ev.criteria_scores || result.criteria_scores,
            step_scores: ev.step_scores || result.step_scores,
            tests_passed: ev.tests_passed_estimate || result.tests_passed,
          };
        }
      } catch (evalErr) {
        console.error("Code evaluation error:", evalErr);
      }

      setPhase2Result(enrichedResult);

      await supabase
        .from("assessment_sessions")
        .update({
          phase2_result: enrichedResult as any,
          phase2_code: enrichedResult.code_submitted,
          phase2_completed_at: new Date().toISOString(),
          current_phase: 3,
          phase3_started_at: new Date().toISOString(),
          integrity_flags: integrity.flags as any,
        })
        .eq("id", sessionId);
    }

    toast.success(`Phase 2 terminée ! ${result.steps_completed.length}/4 étapes complétées`);
    setPageState("phase3");
  }, [sessionId, integrity, codingChallenge, selectedStack]);

  const handlePhase3Complete = useCallback(async (result: CodeReviewResult) => {
    setPhase3Result(result);

    if (sessionId) {
      await supabase
        .from("assessment_sessions")
        .update({
          phase3_result: result as any,
          phase3_answers: result.answers as any,
          phase3_completed_at: new Date().toISOString(),
          integrity_flags: integrity.flags as any,
          integrity_warning_count: integrity.warningCount,
          integrity_critical_count: integrity.criticalCount,
        })
        .eq("id", sessionId);

      // Compute global score (auto-certifies + generates improvement axes)
      const { data: scoreData, error: scoreErr } = await supabase.functions.invoke("assessment-engine", {
        body: { action: "compute_global_score", session_id: sessionId },
      });

      if (!scoreErr && scoreData?.global_score) {
        setGlobalScore(scoreData.global_score as GlobalScore);
      }

      // Fetch extras in parallel
      Promise.all([
        supabase.functions.invoke("assessment-engine", {
          body: { action: "get_percentile", session_id: sessionId },
        }),
        supabase.functions.invoke("assessment-engine", {
          body: { action: "get_history", expert_id: expertId },
        }),
        supabase.functions.invoke("assessment-engine", {
          body: { action: "get_explanations", session_id: sessionId },
        }),
      ]).then(([percRes, histRes, explRes]) => {
        if (percRes.data?.success) {
          setPercentileData({ percentile: percRes.data.percentile, total: percRes.data.total_candidates });
        }
        if (histRes.data?.sessions) {
          setHistoryData(histRes.data.sessions);
        }
        if (explRes.data?.explanations) {
          setExplanations(explRes.data.explanations);
        }
      }).catch(() => {});
    }

    toast.success("Évaluation terminée !");
    setPageState("results");
  }, [sessionId, integrity, expertId]);

  // Integrity termination
  useEffect(() => {
    if (integrity.isTerminated && pageState !== "setup" && pageState !== "results") {
      toast.error("Session terminée : violation critique de l'intégrité détectée");
      setPageState("results");
    }
  }, [integrity.isTerminated, pageState]);

  // Share on LinkedIn
  const shareOnLinkedIn = () => {
    if (!globalScore) return;
    const level = LEVEL_LABELS[globalScore.level]?.label || globalScore.level;
    const text = encodeURIComponent(
      `Je viens d'être certifié ${level} en ${selectedStack} sur STEF ! Score: ${globalScore.overall}/100 🚀\n\n#STEFTalent #ProofOfSkillFirst #${selectedStack}`
    );
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://steftalent.ai")}&summary=${text}`, "_blank");
  };

  // ─── RENDER ────────────────────────────────────────────────

  const IntegrityBanner = () => {
    if (integrity.warningCount === 0) return null;
    return (
      <Alert variant={integrity.isFlagged ? "destructive" : "default"} className="mb-4">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          {integrity.isFlagged
            ? `⚠️ Session sous surveillance : ${integrity.warningCount} avertissements détectés.`
            : `${integrity.warningCount} avertissement(s). ${3 - integrity.warningCount} restant(s) avant signalement.`
          }
        </AlertDescription>
      </Alert>
    );
  };

  // Setup page
  if (pageState === "setup") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="border-2">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Évaluation technique complète</CardTitle>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Cette évaluation en 3 phases (45 min) mesure l'ensemble de vos compétences techniques : 
              fondamentaux, résolution de problèmes, qualité de code, architecture et debugging.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Brain, color: "text-blue-500", title: "Phase 1", time: "10 min", desc: "20 QCM adaptatifs couvrant 5 domaines." },
                { icon: Code, color: "text-green-500", title: "Phase 2", time: "30 min", desc: "Mini-projet en 4 étapes dans un éditeur Monaco." },
                { icon: Eye, color: "text-orange-500", title: "Phase 3", time: "5 min", desc: "Code Review inversée : identifier 5 problèmes." },
              ].map(({ icon: Icon, color, title, time, desc }) => (
                <div key={title} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <h3 className="font-semibold">{title}</h3>
                    <Badge variant="secondary">{time}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Choisissez votre stack technique</label>
              <Select value={selectedStack} onValueChange={(v) => setSelectedStack(v as TechStack)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_STACKS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Intégrité :</strong> Système anti-triche multicouche actif. 3 avertissements = session signalée. 1 violation critique = session terminée.
              </AlertDescription>
            </Alert>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {cooldownUntil && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cooldown actif.</strong> Prochain passage dans{" "}
                  <strong>{cooldownDaysLeft} jour{cooldownDaysLeft > 1 ? "s" : ""}</strong>.
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={startAssessment} disabled={isLoading || !!cooldownUntil} className="w-full" size="lg">
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Génération de l'évaluation...</>
              ) : cooldownUntil ? (
                <><Clock className="h-4 w-4 mr-2" />Disponible dans {cooldownDaysLeft} jour{cooldownDaysLeft > 1 ? "s" : ""}</>
              ) : (
                <>Commencer l'évaluation <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phase 1
  if (pageState === "phase1") {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <IntegrityBanner />
        <Phase1Quiz questions={quizQuestions} onComplete={handlePhase1Complete} onKeystroke={integrity.recordKeystroke} />
      </div>
    );
  }

  // Phase 2
  if (pageState === "phase2" && codingChallenge) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <IntegrityBanner />
        <Phase2Coding challenge={codingChallenge} onComplete={handlePhase2Complete} onKeystroke={integrity.recordKeystroke} />
      </div>
    );
  }

  // Phase 3
  if (pageState === "phase3" && codeReviewChallenge) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <IntegrityBanner />
        <Phase3CodeReview challenge={codeReviewChallenge} onComplete={handlePhase3Complete} onKeystroke={integrity.recordKeystroke} />
      </div>
    );
  }

  // ─── RESULTS ───────────────────────────────────────────────
  if (pageState === "results") {
    const levelInfo = LEVEL_LABELS[globalScore?.level || "junior"];
    const improvementAxes = (globalScore as any)?.improvement_axes;

    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        {/* Header Card */}
        <Card className="border-2 overflow-hidden">
          <div className={`h-2 ${levelInfo?.color || "bg-muted"}`} />
          <CardHeader className="text-center space-y-4">
            <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
              integrity.isTerminated ? "bg-destructive/10" : "bg-primary/10"
            }`}>
              {integrity.isTerminated ? (
                <XCircle className="h-10 w-10 text-destructive" />
              ) : (
                <Trophy className="h-10 w-10 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {integrity.isTerminated ? "Session terminée" : "Résultats de l'évaluation"}
            </CardTitle>
            {globalScore && (
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Badge className="text-xl px-5 py-1.5">{globalScore.overall}/100</Badge>
                <Badge variant="outline" className="text-xl px-5 py-1.5 capitalize">
                  {levelInfo?.label || globalScore.level}
                </Badge>
                {percentileData && percentileData.total >= 10 && (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    <TrendingUp className="h-3.5 w-3.5 mr-1" />
                    Top {100 - percentileData.percentile}% sur {percentileData.total} candidats
                  </Badge>
                )}
              </div>
            )}
            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={shareOnLinkedIn}>
                <Linkedin className="h-4 w-4 mr-1.5" />
                Partager sur LinkedIn
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/expert/certifications")}>
                <Award className="h-4 w-4 mr-1.5" />
                Voir mes certificats
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/expert/test-history")}>
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Historique
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <Tabs value={resultsTab} onValueChange={setResultsTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="improvements">Axes d'amélioration</TabsTrigger>
            <TabsTrigger value="review">Révision QCM</TabsTrigger>
            <TabsTrigger value="history">Progression</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Radar Chart */}
            {globalScore?.radar_chart && (
              <Card>
                <CardContent className="pt-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={globalScore.radar_chart.map(d => ({
                        ...d,
                        dimension: DIMENSION_LABELS[d.dimension] || d.dimension,
                      }))}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="dimension" className="text-xs" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Phase breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Phase 1 — QCM</span>
                  </div>
                  {phase1Result ? (
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">{phase1Result.calibrated_score}%</div>
                      <div className="text-sm text-muted-foreground">
                        {phase1Result.correct_answers}/{phase1Result.total_questions} correct
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Niveau max: {phase1Result.max_difficulty_reached}/5
                      </div>
                      {/* Domain mini-bars */}
                      <div className="space-y-1 pt-2">
                        {Object.entries(phase1Result.domain_scores).map(([domain, score]) => (
                          <div key={domain} className="flex items-center gap-2 text-xs">
                            <span className="w-24 truncate text-muted-foreground">
                              {DIMENSION_LABELS[domain] || domain}
                            </span>
                            <Progress value={score} className="h-1.5 flex-1" />
                            <span className="w-8 text-right">{score}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <span className="text-sm text-muted-foreground">Non complétée</span>}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Code className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Phase 2 — Code</span>
                  </div>
                  {phase2Result ? (
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">{phase2Result.weighted_score || 0}%</div>
                      <div className="text-sm text-muted-foreground">
                        {phase2Result.steps_completed.length}/4 étapes • {phase2Result.tests_passed}/{phase2Result.tests_total} tests
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(phase2Result.time_taken_seconds / 60)} min
                      </div>
                      {phase2Result.criteria_scores && (
                        <div className="space-y-1 pt-2">
                          {Object.entries(phase2Result.criteria_scores).slice(0, 4).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2 text-xs">
                              <span className="w-24 truncate text-muted-foreground">{key.replace(/_/g, " ")}</span>
                              <Progress value={val} className="h-1.5 flex-1" />
                              <span className="w-8 text-right">{Math.round(val)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : <span className="text-sm text-muted-foreground">Non complétée</span>}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Phase 3 — Review</span>
                  </div>
                  {phase3Result ? (
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">{phase3Result.score}%</div>
                      <div className="text-sm text-muted-foreground">
                        {phase3Result.problems_found}/{phase3Result.problems_total} problèmes identifiés
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(phase3Result.time_taken_seconds / 60)} min
                      </div>
                    </div>
                  ) : <span className="text-sm text-muted-foreground">Non complétée</span>}
                </CardContent>
              </Card>
            </div>

            {/* Integrity flags */}
            {integrity.flags.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4" />
                    Signaux d'intégrité ({integrity.flags.length})
                  </h3>
                  <div className="space-y-1">
                    {integrity.flags.slice(0, 10).map((flag, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant={flag.severity === "critical" ? "destructive" : flag.severity === "warning" ? "default" : "secondary"} className="text-xs">
                          {flag.severity}
                        </Badge>
                        <span className="text-muted-foreground">{flag.details}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* IMPROVEMENTS TAB */}
          <TabsContent value="improvements" className="space-y-4">
            {improvementAxes ? (
              <>
                {improvementAxes.summary && (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-muted-foreground">{improvementAxes.summary}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {(improvementAxes.axes || []).map((axis: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold">{axis.title}</h3>
                        </div>
                        <Badge variant={axis.priority === "high" ? "destructive" : axis.priority === "medium" ? "default" : "secondary"}>
                          {axis.priority === "high" ? "Priorité haute" : axis.priority === "medium" ? "Moyenne" : "Basse"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{axis.description}</p>
                      {axis.dimension && (
                        <Badge variant="outline" className="text-xs">
                          {DIMENSION_LABELS[axis.dimension] || axis.dimension}
                        </Badge>
                      )}
                      {axis.resources && axis.resources.length > 0 && (
                        <div className="space-y-1 pt-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ressources recommandées</span>
                          {axis.resources.map((r: any, j: number) => (
                            <div key={j} className="flex items-center gap-2 text-sm">
                              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              {r.url ? (
                                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {r.title}
                                </a>
                              ) : (
                                <span>{r.title}</span>
                              )}
                              <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Génération des axes d'amélioration...
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* REVIEW TAB (A2.15) */}
          <TabsContent value="review" className="space-y-4">
            {explanations.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Révisez vos réponses au QCM avec les explications détaillées.
                </p>
                {explanations.map((exp, i) => (
                  <Card key={exp.question_id} className={`border-l-4 ${exp.was_correct ? "border-l-green-500" : "border-l-destructive"}`}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {exp.was_correct ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">
                            Q{i + 1} — {DIMENSION_LABELS[exp.domain] || exp.domain}
                          </span>
                          <Badge variant="outline" className="text-xs">Niv. {exp.difficulty}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round((exp.time_spent_ms || 0) / 1000)}s
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{exp.question}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {(exp.options || []).map((opt: any) => {
                          const isCorrect = opt.key === exp.correct_answer;
                          const isSelected = opt.key === exp.candidate_answer;
                          return (
                            <div key={opt.key} className={`text-xs px-2 py-1.5 rounded border ${
                              isCorrect ? "border-green-500 bg-green-500/10" :
                              isSelected ? "border-destructive bg-destructive/10" : "border-border"
                            }`}>
                              <span className="font-medium mr-1">{opt.key}.</span> {opt.text}
                            </div>
                          );
                        })}
                      </div>
                      {exp.explanation && (
                        <div className="bg-muted/50 rounded p-2 text-xs text-muted-foreground">
                          <strong>Explication :</strong> {exp.explanation}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Chargement des explications...
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* HISTORY TAB (A5.12) */}
          <TabsContent value="history" className="space-y-4">
            {historyData.length > 1 ? (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-medium mb-4">Progression dans le temps</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData.map(s => ({
                          date: new Date(s.completed_at).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
                          score: s.overall,
                          stack: s.stack,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Dimension comparison */}
                {historyData.length >= 2 && (
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <h3 className="font-medium">Comparaison avec le passage précédent</h3>
                      {(() => {
                        const current = historyData[historyData.length - 1];
                        const previous = historyData[historyData.length - 2];
                        const diff = current.overall - previous.overall;
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className={`h-4 w-4 ${diff >= 0 ? "text-green-500" : "text-destructive"}`} />
                              <span className="font-medium">
                                {diff >= 0 ? "+" : ""}{diff.toFixed(1)} points
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({previous.overall.toFixed(1)} → {current.overall.toFixed(1)})
                              </span>
                            </div>
                            {current.breakdown && previous.breakdown && (
                              <div className="space-y-1">
                                {Object.keys(current.breakdown).map(dim => {
                                  const d = (current.breakdown[dim] || 0) - (previous.breakdown[dim] || 0);
                                  return (
                                    <div key={dim} className="flex items-center gap-2 text-sm">
                                      <span className="w-36 text-muted-foreground">{DIMENSION_LABELS[dim] || dim}</span>
                                      <span className={d >= 0 ? "text-green-600" : "text-destructive"}>
                                        {d >= 0 ? "+" : ""}{d.toFixed(0)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Premier passage ! Revenez dans 30 jours pour voir votre progression.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Button onClick={() => navigate("/expert/dashboard")} variant="outline" className="w-full">
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  // Loading
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Préparation de l'évaluation...</p>
      </div>
    </div>
  );
}
