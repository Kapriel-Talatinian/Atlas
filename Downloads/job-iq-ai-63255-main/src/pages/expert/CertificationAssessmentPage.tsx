import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  CheckCircle2, XCircle, ArrowRight, Clock, LogOut, ChevronDown, ChevronUp,
  Stethoscope, Scale, TrendingUp, Code2, AlertTriangle, Loader2, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Domain config ──────────────────────────────────────────
const domainMeta: Record<string, { label: string; icon: any; color: string }> = {
  medical: { label: "Médecine", icon: Stethoscope, color: "#3B82F6" },
  legal: { label: "Droit", icon: Scale, color: "#F59E0B" },
  finance: { label: "Finance", icon: TrendingUp, color: "#10B981" },
  code: { label: "Code", icon: Code2, color: "#7B6FF0" },
  red_teaming: { label: "Red Teaming", icon: Shield, color: "#EF4444" },
};

const SCORING_DIMENSIONS_DEFAULT = [
  { key: "correctness", label: "Exactitude factuelle" },
  { key: "safety", label: "Sécurité" },
  { key: "completeness", label: "Complétude" },
  { key: "reasoning_depth", label: "Profondeur du raisonnement" },
  { key: "source_reliability", label: "Fiabilité des sources" },
  { key: "communication_clarity", label: "Clarté de la communication" },
];

const SCORING_DIMENSIONS_RED_TEAMING = [
  { key: "attack_success", label: "Succès de l'attaque (1=résisté, 5=échoué)" },
  { key: "severity", label: "Sévérité de la faille" },
  { key: "robustness", label: "Robustesse des garde-fous" },
  { key: "response_quality", label: "Qualité de la réponse" },
  { key: "documentation_quality", label: "Qualité de la documentation" },
];

const getScoringDimensions = (d?: string) =>
  d === "red_teaming" ? SCORING_DIMENSIONS_RED_TEAMING : SCORING_DIMENSIONS_DEFAULT;

interface CertQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty: string;
}

interface GoldTask {
  id: string;
  prompt: string;
  response: string;
  gold_scores: Record<string, number>;
  gold_reasoning: string;
  explanation: string;
}

type Phase = "loading" | "phase1" | "phase2a" | "phase2b" | "results_p1" | "results_p2a" | "results_p2b" | "results_final";

export default function CertificationAssessmentPage() {
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const meta = domain ? domainMeta[domain] : null;

  // ─── State ──────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("loading");
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Phase 1 — QCM
  const [qcmQuestions, setQcmQuestions] = useState<CertQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showP1Detail, setShowP1Detail] = useState(false);

  // Phase 2A — Gold tasks
  const [goldTasks, setGoldTasks] = useState<GoldTask[]>([]);
  const [currentGold, setCurrentGold] = useState(0);
  const [reasoning, setReasoning] = useState("");
  const SCORING_DIMENSIONS = getScoringDimensions(domain);
  const [scores, setScores] = useState<number[]>(Array(SCORING_DIMENSIONS.length).fill(3));
  const [goldAnswers, setGoldAnswers] = useState<{ scores: number[]; reasoning: string }[]>([]);

  // Phase 2B — Ethics
  const [ethicsQuestions, setEthicsQuestions] = useState<CertQuestion[]>([]);
  const [currentEthics, setCurrentEthics] = useState(0);
  const [ethicsSelectedAnswer, setEthicsSelectedAnswer] = useState<number | null>(null);
  const [ethicsAnswers, setEthicsAnswers] = useState<Record<number, number>>({});

  // Anti-cheat
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // Persistence guard — fire exactly once when phase reaches results_p2b
  const persistedRef = useRef(false);

  // Timer
  useEffect(() => {
    if (phase === "loading") return;
    setTimer(0);
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Tab switch detection
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        setTabSwitchCount(c => {
          const next = c + 1;
          if (next >= 5) {
            toast.error("Assessment annulé — trop de changements d'onglet.");
            navigate("/expert/certification");
          } else if (next >= 3) {
            toast.warning("Veuillez rester sur cette page pendant l'assessment.");
          }
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [navigate]);

  // ─── Load questions from DB ────────────────────────────
  useEffect(() => {
    if (!domain) return;
    loadQuestions();
  }, [domain]);

  const loadQuestions = async () => {
    try {
      // Get expert profile to check previously answered questions
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: expertProfile } = await supabase
        .from("expert_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const expertId = expertProfile?.id;

      // Get previously answered question IDs
      let answeredIds: string[] = [];
      if (expertId) {
        const { data: prevAnswers } = await supabase
          .from("certification_answers")
          .select("question_id")
          .eq("expert_id", expertId);
        answeredIds = (prevAnswers || []).map(a => a.question_id).filter(Boolean) as string[];
      }

      // Load Phase 1 QCM questions (20 random from domain)
      let qcmQuery = supabase
        .from("certification_questions")
        .select("id, question, options, correct_answer, explanation, difficulty")
        .eq("domain", domain)
        .eq("phase", "phase1_qcm")
        .eq("active", true);

      if (answeredIds.length > 0) {
        qcmQuery = qcmQuery.not("id", "in", `(${answeredIds.join(",")})`);
      }

      const { data: qcmData } = await qcmQuery;

      let qcmPool = (qcmData || []) as any[];

      // If not enough unseen questions, recycle all
      if (qcmPool.length < 20) {
        const { data: allQcm } = await supabase
          .from("certification_questions")
          .select("id, question, options, correct_answer, explanation, difficulty")
          .eq("domain", domain)
          .eq("phase", "phase1_qcm")
          .eq("active", true);
        qcmPool = (allQcm || []) as any[];
      }

      // Shuffle and take 20
      const shuffled = qcmPool.sort(() => Math.random() - 0.5).slice(0, 20);
      setQcmQuestions(shuffled.map(q => ({
        ...q,
        options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
      })));

      // Load Phase 2A Gold Tasks (5 random from domain)
      const { data: goldData } = await supabase
        .from("certification_gold_tasks")
        .select("id, prompt, response, gold_scores, gold_reasoning, explanation")
        .eq("domain", domain)
        .eq("active", true);

      const goldShuffled = (goldData || []).sort(() => Math.random() - 0.5).slice(0, 5);
      setGoldTasks(goldShuffled.map(g => ({
        ...g,
        gold_scores: typeof g.gold_scores === "string" ? JSON.parse(g.gold_scores) : g.gold_scores,
      })) as GoldTask[]);

      // Load Phase 2B Ethics questions (10 random from domain)
      const { data: ethicsData } = await supabase
        .from("certification_questions")
        .select("id, question, options, correct_answer, explanation, difficulty")
        .eq("domain", domain)
        .eq("phase", "phase2_ethics")
        .eq("active", true);

      const ethicsShuffled = (ethicsData || []).sort(() => Math.random() - 0.5).slice(0, 10);
      setEthicsQuestions(ethicsShuffled.map(q => ({
        ...q,
        options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
      })));

      if (shuffled.length === 0) {
        toast.error("Pas assez de questions disponibles pour ce domaine.");
        navigate("/expert/certification");
        return;
      }

      setPhase("phase1");
    } catch (err) {
      console.error("Failed to load certification questions:", err);
      toast.error("Erreur lors du chargement des questions.");
      navigate("/expert/certification");
    }
  };

  if (!meta) {
    navigate("/expert/certification");
    return null;
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ─── Phase 1 logic ─────────────────────────────────────
  const p1Score = Object.entries(answers).filter(([i, a]) => a === qcmQuestions[Number(i)]?.correct_answer).length;
  const p1Total = qcmQuestions.length;
  const p1Threshold = Math.ceil(p1Total * 0.8); // 80%
  const p1Passed = p1Score >= p1Threshold;

  const handleValidateQ = () => {
    if (selectedAnswer === null) return;
    setAnswers(prev => ({ ...prev, [currentQ]: selectedAnswer }));
    if (currentQ < qcmQuestions.length - 1) {
      setSelectedAnswer(answers[currentQ + 1] ?? null);
      setCurrentQ(currentQ + 1);
    } else {
      setPhase("results_p1");
    }
  };

  // ─── Phase 2A logic ────────────────────────────────────
  const handleSubmit2A = () => {
    if (reasoning.length < 100) {
      toast.error("Le raisonnement doit contenir au moins 100 caractères.");
      return;
    }
    const currentAnswer = { scores: [...scores], reasoning };
    const updated = [...goldAnswers, currentAnswer];
    setGoldAnswers(updated);

    if (currentGold < goldTasks.length - 1) {
      setCurrentGold(currentGold + 1);
      setReasoning("");
      setScores(Array(6).fill(3));
    } else {
      // Evaluate all gold answers
      setPhase("results_p2a");
    }
  };

  // Evaluate Phase 2A results
  const evaluatePhase2A = () => {
    if (goldTasks.length === 0) return { passed: true, avgDeviation: 0, deviations: [] as any[] };
    
    const deviations = goldAnswers.map((ans, idx) => {
      const gold = goldTasks[idx]?.gold_scores || {};
      const dimDeviations: Record<string, number> = {};
      let totalDev = 0;
      let count = 0;
      SCORING_DIMENSIONS.forEach((dim, i) => {
        const goldVal = gold[dim.key] ?? 3;
        const candidateVal = ans.scores[i];
        const dev = Math.abs(candidateVal - goldVal);
        dimDeviations[dim.key] = dev;
        totalDev += dev;
        count++;
      });
      return { taskIdx: idx, avgDev: count > 0 ? totalDev / count : 0, dimDeviations };
    });

    const overallAvgDev = deviations.reduce((s, d) => s + d.avgDev, 0) / deviations.length;
    return { passed: overallAvgDev <= 0.5, avgDeviation: overallAvgDev, deviations };
  };

  // ─── Phase 2B logic ────────────────────────────────────
  const handleValidateEthics = () => {
    if (ethicsSelectedAnswer === null) return;
    setEthicsAnswers(prev => ({ ...prev, [currentEthics]: ethicsSelectedAnswer }));
    if (currentEthics < ethicsQuestions.length - 1) {
      setEthicsSelectedAnswer(ethicsAnswers[currentEthics + 1] ?? null);
      setCurrentEthics(currentEthics + 1);
    } else {
      setPhase("results_p2b");
    }
  };

  const ethicsScore = Object.entries(ethicsAnswers).filter(([i, a]) => a === ethicsQuestions[Number(i)]?.correct_answer).length;
  const ethicsTotal = ethicsQuestions.length;
  const ethicsThreshold = Math.ceil(ethicsTotal * 0.9); // 90%
  const ethicsPassed = ethicsScore >= ethicsThreshold;

  const Icon = meta.icon;

  // ─── Time limits (in seconds) ──────────────────────────
  const timeLimits: Record<string, number> = { phase1: 1800, phase2a: 1800, phase2b: 900 };
  const currentTimeLimit = timeLimits[phase] || Infinity;
  const timeWarning = timer > currentTimeLimit * 0.8;

  // Auto-submit on timeout
  useEffect(() => {
    if (phase === "phase1" && timer >= 1800) {
      setPhase("results_p1");
    } else if (phase === "phase2b" && timer >= 900) {
      setPhase("results_p2b");
    }
  }, [timer, phase]);

  // ─── Persist results when assessment ends ─────────────────────
  // Single point of truth: writes session log + (on pass) certification +
  // ensures the annotator_profiles row exists & is qualified so the
  // distribute-tasks engine can pick this user up immediately.
  useEffect(() => {
    if (phase !== "results_p2b") return;
    if (persistedRef.current) return;
    if (!domain) return;
    persistedRef.current = true;

    const persist = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: expertProfile } = await supabase
          .from("expert_profiles")
          .select("id, full_name, country, primary_skills, secondary_skills")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!expertProfile?.id) {
          toast.error("Profil expert introuvable. Contactez le support.");
          return;
        }

        // Recompute scores at persistence time to avoid stale closures.
        const p1ScoreLocal = Object.entries(answers)
          .filter(([i, a]) => a === qcmQuestions[Number(i)]?.correct_answer).length;
        const p1Total = qcmQuestions.length;
        const p1PassedLocal = p1ScoreLocal >= Math.ceil(p1Total * 0.8);

        // Phase 2A deviation
        const p2aDevs = goldAnswers.map((ans, idx) => {
          const gold = goldTasks[idx]?.gold_scores || {};
          let totalDev = 0;
          let count = 0;
          SCORING_DIMENSIONS.forEach((dim, i) => {
            const goldVal = gold[dim.key] ?? 3;
            totalDev += Math.abs(ans.scores[i] - goldVal);
            count++;
          });
          return count > 0 ? totalDev / count : 0;
        });
        const p2aAvg = p2aDevs.length ? p2aDevs.reduce((a, b) => a + b, 0) / p2aDevs.length : 0;
        const p2aPassedLocal = p2aDevs.length === 0 ? true : p2aAvg <= 0.5;

        const ethicsScoreLocal = Object.entries(ethicsAnswers)
          .filter(([i, a]) => a === ethicsQuestions[Number(i)]?.correct_answer).length;
        const ethicsTotal = ethicsQuestions.length;
        const ethicsPassedLocal = ethicsScoreLocal >= Math.ceil(ethicsTotal * 0.9);

        const allPassed = p1PassedLocal && p2aPassedLocal && ethicsPassedLocal;

        // Composite score: weighted sum mapped to 0-100
        const p1Pct = p1Total > 0 ? p1ScoreLocal / p1Total : 0;
        const p2aPct = p2aDevs.length === 0 ? 1 : Math.max(0, 1 - p2aAvg / 4); // 4 = max deviation on 1-5 scale
        const ethicsPct = ethicsTotal > 0 ? ethicsScoreLocal / ethicsTotal : 0;
        const compositeScore = Math.round((p1Pct * 0.4 + p2aPct * 0.4 + ethicsPct * 0.2) * 100);

        // 1. Log the session (used for cooldown + audit trail)
        const { data: session } = await supabase
          .from("annotator_assessment_sessions")
          .insert({
            user_id: user.id,
            expert_id: expertProfile.id,
            domain: domain as any,
            status: allPassed ? "completed" : "failed",
            current_phase: 4,
            started_at: new Date(Date.now() - timer * 1000).toISOString(),
            completed_at: new Date().toISOString(),
            phase1_completed_at: new Date().toISOString(),
            phase1_answers: answers as any,
            phase1_score: p1Pct,
            phase1_passed: p1PassedLocal,
            phase2_completed_at: new Date().toISOString(),
            phase2_answers: goldAnswers as any,
            phase2_scores: { avg_deviation: p2aAvg } as any,
          })
          .select("id")
          .single();

        if (!allPassed) return;

        // 2. Insert the domain certification (the gate to receive tasks)
        await supabase
          .from("annotator_domain_certifications")
          .upsert(
            {
              user_id: user.id,
              expert_id: expertProfile.id,
              domain: domain as any,
              tier: "qualified" as any,
              score: compositeScore,
              session_id: session?.id || null,
              status: "valid",
              issued_at: new Date().toISOString(),
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: "expert_id,domain,status" }
          );

        // 3. Ensure annotator_profiles exists & is qualified+active so
        //    distribute-tasks selects this user.
        const anonId = `ANN-${expertProfile.id.slice(0, 8)}`;
        await supabase
          .from("annotator_profiles")
          .upsert(
            {
              expert_id: expertProfile.id,
              anonymized_id: anonId,
              role: "annotator",
              seniority: "mid",
              experience_years: 0,
              country: expertProfile.country || "FR",
              languages: ["fr"],
              consent_given_at: new Date().toISOString(),
              consent_version: "v1.0",
              is_active: true,
              is_qualified: true,
              qualified_at: new Date().toISOString(),
            } as any,
            { onConflict: "expert_id" }
          );
      } catch (err: any) {
        console.error("Certification persistence failed:", err);
        toast.error("Erreur d'enregistrement de la certification : " + (err?.message || "inconnue"));
      }
    };

    persist();
  }, [phase, domain, answers, qcmQuestions, goldAnswers, goldTasks, ethicsAnswers, ethicsQuestions, SCORING_DIMENSIONS, timer]);

  // ─── Assessment Bar ────────────────────────────────────
  const AssessmentBar = () => {
    const phaseNum = phase.startsWith("phase1") || phase === "results_p1" ? 1 :
      phase.startsWith("phase2a") || phase === "results_p2a" ? 2 :
      phase.startsWith("phase2b") || phase === "results_p2b" ? 2 : 3;
    const subPhase = phase.includes("2b") || phase === "results_p2b" ? "B" : phase.includes("2a") || phase === "results_p2a" ? "A" : "";
    
    return (
      <div className="sticky top-0 z-50 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center px-4 md:px-6">
        <span className="font-bold tracking-wider text-foreground text-sm mr-4">STEF</span>
        <Badge variant="outline" className="mr-4 text-xs" style={{ borderColor: meta.color, color: meta.color }}>
          {meta.label}
        </Badge>
        <div className="flex-1 flex items-center justify-center gap-2">
          {["Phase 1 — QCM", "Phase 2A — Technique", "Phase 2B — Éthique"].map((label, n) => (
            <div key={n} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                (n === 0 && (phase === "results_p1" || phase.startsWith("phase2"))) ||
                (n === 1 && (phase === "results_p2a" || phase.startsWith("phase2b"))) ||
                (n === 2 && phase === "results_p2b")
                  ? "bg-emerald-500 text-white"
                  : (n === 0 && phase === "phase1") || (n === 1 && phase === "phase2a") || (n === 2 && phase === "phase2b")
                    ? "bg-primary text-primary-foreground animate-pulse"
                    : "bg-muted text-muted-foreground"
              }`}>
                {(n === 0 && (phase !== "phase1" && phase !== "results_p1" && phase !== "loading")) ||
                 (n === 1 && (phase === "phase2b" || phase === "results_p2b" || phase === "results_final"))
                  ? <CheckCircle2 className="w-4 h-4" /> : n + 1}
              </div>
              <span className="text-xs hidden lg:inline text-muted-foreground">{label}</span>
              {n < 2 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className={`font-mono text-sm ${timeWarning ? "text-destructive" : "text-muted-foreground"}`}>
            {formatTime(timer)}
          </span>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => setShowQuitDialog(true)}>
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Quitter
          </Button>
        </div>
      </div>
    );
  };

  // ─── Scoring Panel ─────────────────────────────────────
  const ScoringPanel = ({ scoresState, setScoresState, reasoningState, setReasoningState, onSubmit, submitLabel }: {
    scoresState: number[]; setScoresState: (s: number[]) => void;
    reasoningState: string; setReasoningState: (s: string) => void;
    onSubmit: () => void; submitLabel: string;
  }) => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Raisonnement</Label>
        <p className="text-xs text-muted-foreground mb-2">Rédigez votre analyse avant d'attribuer les scores (min. 100 caractères).</p>
        <Textarea
          value={reasoningState}
          onChange={e => setReasoningState(e.target.value)}
          placeholder="Décrivez les erreurs identifiées, les points forts et les faiblesses de cette réponse..."
          className="min-h-[120px] text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">{reasoningState.length}/100 caractères minimum</p>
      </div>
      <div className="space-y-3">
        {SCORING_DIMENSIONS.map((dim, i) => (
          <div key={dim.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{dim.label}</Label>
              <span className="font-mono text-xs font-bold text-primary">{scoresState[i]}/5</span>
            </div>
            <Slider
              value={[scoresState[i]]}
              onValueChange={([v]) => { const s = [...scoresState]; s[i] = v; setScoresState(s); }}
              min={0} max={5} step={0.5}
              className="w-full"
            />
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={onSubmit} disabled={reasoningState.length < 100}>{submitLabel}</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AssessmentBar />

      {/* Quit dialog */}
      <Dialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitter l'assessment ?</DialogTitle>
            <DialogDescription>Votre progression sera perdue. Vous devrez recommencer depuis le début.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuitDialog(false)}>Continuer</Button>
            <Button variant="destructive" onClick={() => navigate("/expert/certification")}>Quitter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-[700px] mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* ═══ LOADING ═══ */}
          {phase === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement des questions {meta.label}...</p>
            </motion.div>
          )}

          {/* ═══ PHASE 1 — QCM ═══ */}
          {phase === "phase1" && qcmQuestions.length > 0 && (
            <motion.div key="phase1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Question {currentQ + 1} / {qcmQuestions.length}</span>
                  <Badge variant="outline" className="text-xs">{qcmQuestions[currentQ]?.difficulty}</Badge>
                </div>
                <Progress value={((currentQ + 1) / qcmQuestions.length) * 100} className="h-1.5" />

                <div className="text-base text-foreground leading-relaxed">{qcmQuestions[currentQ]?.question}</div>

                <div className="space-y-3">
                  {(qcmQuestions[currentQ]?.options || []).map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedAnswer(idx)}
                      className={`w-full text-left p-4 rounded-lg border transition-all text-sm ${
                        selectedAnswer === idx
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-muted-foreground/30 bg-card"
                      }`}
                    >
                      <span className="font-mono font-bold mr-3 text-muted-foreground">{"ABCD"[idx]}.</span>
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => { if (currentQ > 0) { setCurrentQ(currentQ - 1); setSelectedAnswer(answers[currentQ - 1] ?? null); } }} disabled={currentQ === 0}>
                    Précédent
                  </Button>
                  <Button onClick={handleValidateQ} disabled={selectedAnswer === null} className="gap-1.5">
                    {currentQ < qcmQuestions.length - 1 ? "Valider" : "Terminer la Phase 1"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ RESULTS PHASE 1 ═══ */}
          {phase === "results_p1" && (
            <motion.div key="results_p1" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${p1Passed ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                {p1Passed ? <CheckCircle2 className="w-10 h-10 text-emerald-500" /> : <XCircle className="w-10 h-10 text-destructive" />}
              </div>
              <h2 className="text-xl font-bold text-foreground">{p1Passed ? "Phase 1 réussie" : "Phase 1 non validée"}</h2>
              <p className="text-lg font-mono font-bold">{p1Score}/{p1Total}</p>
              <p className="text-sm text-muted-foreground">Seuil requis : {p1Threshold}/{p1Total} (80%)</p>

              {!p1Passed && (
                <p className="text-sm text-muted-foreground">Vous pourrez réessayer dans 7 jours.</p>
              )}

              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setShowP1Detail(!showP1Detail)}>
                {showP1Detail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Détail des réponses
              </Button>
              {showP1Detail && (
                <div className="space-y-2 text-left">
                  {qcmQuestions.map((q, i) => {
                    const userAns = answers[i];
                    const correct = userAns === q.correct_answer;
                    return (
                      <div key={i} className={`p-3 rounded-lg border text-sm ${correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {correct ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                          <span className="font-medium">Q{i + 1}</span>
                          {!correct && <span className="text-xs text-muted-foreground ml-auto">Votre réponse : {"ABCD"[userAns]} · Correcte : {"ABCD"[q.correct_answer]}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{q.explanation}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4">
                {p1Passed ? (
                  <Button className="gap-1.5" onClick={() => setPhase(goldTasks.length > 0 ? "phase2a" : "phase2b")}>
                    Continuer vers la Phase 2
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => navigate("/expert/certification")}>Retour aux certifications</Button>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ PHASE 2A — Technical Gold Tasks ═══ */}
          {phase === "phase2a" && goldTasks.length > 0 && (
            <motion.div key="phase2a" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="space-y-2 mb-6">
                <Badge variant="outline" className="text-xs">Exercice technique — Tâche {currentGold + 1}/{goldTasks.length}</Badge>
                <Progress value={((currentGold + 1) / goldTasks.length) * 100} className="h-1.5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold text-sm text-foreground">Prompt utilisateur</h3>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        {goldTasks[currentGold]?.prompt}
                      </p>
                      <h3 className="font-semibold text-sm text-foreground">Réponse du modèle IA</h3>
                      <div className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg border-l-2 border-primary leading-relaxed whitespace-pre-wrap">
                        {goldTasks[currentGold]?.response}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="md:col-span-2">
                  <ScoringPanel
                    scoresState={scores}
                    setScoresState={setScores}
                    reasoningState={reasoning}
                    setReasoningState={setReasoning}
                    onSubmit={handleSubmit2A}
                    submitLabel={currentGold < goldTasks.length - 1 ? "Tâche suivante" : "Soumettre l'évaluation technique"}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ RESULTS PHASE 2A ═══ */}
          {phase === "results_p2a" && (() => {
            const result = evaluatePhase2A();
            return (
              <motion.div key="results_p2a" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${result.passed ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                  {result.passed ? <CheckCircle2 className="w-10 h-10 text-emerald-500" /> : <XCircle className="w-10 h-10 text-destructive" />}
                </div>
                <h2 className="text-xl font-bold text-foreground">{result.passed ? "Phase 2A réussie" : "Phase 2A non validée"}</h2>
                <p className="text-sm text-muted-foreground">Écart moyen : <span className="font-mono font-bold">{result.avgDeviation.toFixed(2)}</span> (seuil : ≤ 0.50)</p>

                {/* Detail per task */}
                <div className="space-y-3 text-left">
                  {result.deviations.map((dev, idx) => (
                    <Card key={idx}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Tâche {idx + 1}</span>
                          <span className={`font-mono text-xs ${dev.avgDev <= 0.5 ? "text-emerald-500" : "text-destructive"}`}>
                            Δ {dev.avgDev.toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {SCORING_DIMENSIONS.map(dim => {
                            const goldVal = goldTasks[idx]?.gold_scores?.[dim.key] ?? 0;
                            const candVal = goldAnswers[idx]?.scores?.[SCORING_DIMENSIONS.indexOf(dim)] ?? 0;
                            const gap = Math.abs(candVal - goldVal);
                            return (
                              <div key={dim.key} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground truncate">{dim.label}</span>
                                <span className={gap <= 0.5 ? "text-emerald-500" : gap <= 1 ? "text-amber-500" : "text-destructive"}>
                                  {candVal} vs {goldVal}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="pt-4">
                  {result.passed ? (
                    <Button className="gap-1.5" onClick={() => setPhase("phase2b")}>
                      Continuer vers la Phase 2B — Éthique
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Vous pourrez réessayer dans 14 jours.</p>
                      <Button variant="outline" onClick={() => navigate("/expert/certification")}>Retour aux certifications</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* ═══ PHASE 2B — Ethics QCM ═══ */}
          {phase === "phase2b" && ethicsQuestions.length > 0 && (
            <motion.div key="phase2b" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">Éthique — Question {currentEthics + 1}/{ethicsQuestions.length}</Badge>
                  <Badge variant="outline" className="text-xs">{ethicsQuestions[currentEthics]?.difficulty}</Badge>
                </div>
                <Progress value={((currentEthics + 1) / ethicsQuestions.length) * 100} className="h-1.5" />

                <div className="text-base text-foreground leading-relaxed">{ethicsQuestions[currentEthics]?.question}</div>

                <div className="space-y-3">
                  {(ethicsQuestions[currentEthics]?.options || []).map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setEthicsSelectedAnswer(idx)}
                      className={`w-full text-left p-4 rounded-lg border transition-all text-sm ${
                        ethicsSelectedAnswer === idx
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-muted-foreground/30 bg-card"
                      }`}
                    >
                      <span className="font-mono font-bold mr-3 text-muted-foreground">{"ABCD"[idx]}.</span>
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => { if (currentEthics > 0) { setCurrentEthics(currentEthics - 1); setEthicsSelectedAnswer(ethicsAnswers[currentEthics - 1] ?? null); } }} disabled={currentEthics === 0}>
                    Précédent
                  </Button>
                  <Button onClick={handleValidateEthics} disabled={ethicsSelectedAnswer === null} className="gap-1.5">
                    {currentEthics < ethicsQuestions.length - 1 ? "Valider" : "Terminer la Phase 2B"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ RESULTS PHASE 2B / FINAL ═══ */}
          {phase === "results_p2b" && (() => {
            const p2aResult = evaluatePhase2A();
            const allPassed = p1Passed && p2aResult.passed && ethicsPassed;
            return (
              <motion.div key="results_final" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center py-8">
                <div className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center border-4 ${allPassed ? "border-emerald-500 bg-emerald-500/10" : "border-destructive bg-destructive/10"}`}>
                  {allPassed ? <CheckCircle2 className="w-14 h-14 text-emerald-500" /> : <XCircle className="w-14 h-14 text-destructive" />}
                </div>

                <h2 className="text-2xl font-bold text-foreground">
                  {allPassed ? "Certification obtenue" : "Certification non obtenue"}
                </h2>

                {/* Summary */}
                <div className="space-y-2 text-left max-w-md mx-auto">
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${p1Passed ? "border-emerald-500/30" : "border-destructive/30"}`}>
                    <span className="text-sm">Phase 1 — QCM</span>
                    <span className="font-mono text-sm font-bold">{p1Score}/{p1Total} ({p1Passed ? "✓" : "✗"})</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${p2aResult.passed ? "border-emerald-500/30" : "border-destructive/30"}`}>
                    <span className="text-sm">Phase 2A — Technique</span>
                    <span className="font-mono text-sm font-bold">Δ {p2aResult.avgDeviation.toFixed(2)} ({p2aResult.passed ? "✓" : "✗"})</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${ethicsPassed ? "border-emerald-500/30" : "border-destructive/30"}`}>
                    <span className="text-sm">Phase 2B — Éthique</span>
                    <span className="font-mono text-sm font-bold">{ethicsScore}/{ethicsTotal} ({ethicsPassed ? "✓" : "✗"})</span>
                  </div>
                </div>

                {allPassed ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Domaine : {meta.label}</p>
                    <p className="text-sm text-muted-foreground">Valide jusqu'au {new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR")}</p>
                    <p className="text-sm text-muted-foreground">Vous pouvez maintenant accéder aux tâches d'annotation {meta.label.toLowerCase()}.</p>
                    <div className="pt-4">
                      <Button className="gap-1.5" onClick={() => navigate("/expert/tasks")}>
                        Voir les tâches disponibles
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {!ethicsPassed
                        ? "Le seuil éthique est de 90%. Vous pourrez réessayer dans 7 jours."
                        : "Vous pourrez réessayer dans 14 jours."}
                    </p>
                    <div className="pt-4">
                      <Button variant="outline" onClick={() => navigate("/expert/certification")}>Retour aux certifications</Button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}
