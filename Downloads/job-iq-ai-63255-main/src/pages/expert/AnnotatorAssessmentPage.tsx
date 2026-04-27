import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Clock, Loader2, CheckCircle, XCircle, ArrowRight,
  Trophy, BookOpen, Eye, Brain, AlertTriangle, FileCheck,
  Target, ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIntegrityMonitor } from "@/hooks/useIntegrityMonitor";
import type {
  AnnotationDomain, AnnotatorTier,
  GuidelinesQuizItem, AnnotationItem, ErrorDetectionItem, EthicalJudgmentItem,
} from "@/types/annotator-assessment";
import { DOMAIN_LABELS, TIER_LABELS, PHASE_WEIGHTS } from "@/types/annotator-assessment";
import { AnnotatorPhase1Guidelines } from "@/components/annotator-assessment/Phase1Guidelines";
import { AnnotatorPhase2Annotation } from "@/components/annotator-assessment/Phase2Annotation";
import { AnnotatorPhase3ErrorDetection } from "@/components/annotator-assessment/Phase3ErrorDetection";
import { AnnotatorPhase4EthicalJudgment } from "@/components/annotator-assessment/Phase4EthicalJudgment";
import { AnnotatorAssessmentResults } from "@/components/annotator-assessment/AssessmentResults";

type PageState = "domain_select" | "guidelines_reading" | "phase1" | "phase2" | "phase3" | "phase4" | "results" | "loading";

export default function AnnotatorAssessmentPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("domain_select");
  const [selectedDomain, setSelectedDomain] = useState<AnnotationDomain | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expertId, setExpertId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Guidelines
  const [guidelines, setGuidelines] = useState<any>(null);
  const [guidelinesReadTime, setGuidelinesReadTime] = useState(0);

  // Phase items
  const [phase1Items, setPhase1Items] = useState<GuidelinesQuizItem[]>([]);
  const [phase2Items, setPhase2Items] = useState<AnnotationItem[]>([]);
  const [phase3Items, setPhase3Items] = useState<ErrorDetectionItem[]>([]);
  const [phase4Items, setPhase4Items] = useState<EthicalJudgmentItem[]>([]);

  // Results
  const [results, setResults] = useState<any>(null);

  // Eligibility
  const [eligibility, setEligibility] = useState<any>(null);
  const [existingCerts, setExistingCerts] = useState<any[]>([]);

  const integrity = useIntegrityMonitor(sessionId);

  // Load user profile
  useEffect(() => {
    const init = async () => {
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

        // Load existing certifications
        const { data: certs } = await supabase
          .from("annotator_domain_certifications")
          .select("*")
          .eq("expert_id", profile.id)
          .eq("status", "valid");

        setExistingCerts(certs || []);
      }
    };
    init();
  }, [navigate]);

  // Check eligibility when domain selected
  const checkEligibility = useCallback(async (domain: AnnotationDomain) => {
    if (!expertId) return;
    const { data, error } = await supabase.functions.invoke("annotator-assessment", {
      body: { action: "check_eligibility", domain, expert_id: expertId },
    });
    if (!error && data) setEligibility(data);
  }, [expertId]);

  // Start assessment
  const startAssessment = useCallback(async () => {
    if (!selectedDomain || !expertId) return;
    setIsLoading(true);

    try {
      // Get guidelines first
      const { data: guidelinesData } = await supabase.functions.invoke("annotator-assessment", {
        body: { action: "get_guidelines", domain: selectedDomain },
      });

      if (guidelinesData?.guidelines) {
        setGuidelines(guidelinesData.guidelines);
        setPageState("guidelines_reading");
      } else {
        toast.error("Aucune guideline disponible pour ce domaine");
      }
    } catch (err) {
      toast.error("Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDomain, expertId]);

  // After reading guidelines, start the actual test
  const startTest = useCallback(async () => {
    if (!selectedDomain || !expertId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("annotator-assessment", {
        body: { action: "start_assessment", domain: selectedDomain, expert_id: expertId },
      });

      if (error) throw error;
      setSessionId(data.session_id);
      setPhase1Items(data.items || []);
      setPageState("phase1");
    } catch (err) {
      toast.error("Erreur lors du démarrage");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDomain, expertId]);

  // Phase 1 complete
  const handlePhase1Complete = useCallback(async (answers: any[]) => {
    if (!sessionId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("annotator-assessment", {
        body: { action: "submit_phase1", session_id: sessionId, answers },
      });

      if (error) throw error;

      if (data.passed) {
        toast.success(`Phase 1 réussie ! ${data.correct}/10`);
        // Load phase 2 items
        const { data: p2 } = await supabase.functions.invoke("annotator-assessment", {
          body: { action: "get_phase2_items", session_id: sessionId },
        });
        setPhase2Items(p2?.items || []);
        setPageState("phase2");
      } else {
        toast.error(`Phase 1 échouée. ${data.correct}/10 (minimum: 7/10)`);
        setResults({ ...data, phase1Failed: true });
        setPageState("results");
      }
    } catch (err) {
      toast.error("Erreur lors de la soumission");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Phase 2 complete
  const handlePhase2Complete = useCallback(async (answers: any[]) => {
    if (!sessionId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("annotator-assessment", {
        body: { action: "submit_phase2", session_id: sessionId, answers },
      });

      if (error) throw error;
      toast.success("Phase 2 terminée !");

      // Load phase 3 items
      const { data: p3 } = await supabase.functions.invoke("annotator-assessment", {
        body: { action: "get_phase3_items", session_id: sessionId },
      });
      setPhase3Items(p3?.items || []);
      setPageState("phase3");
    } catch (err) {
      toast.error("Erreur lors de la soumission");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Phase 3 complete
  const handlePhase3Complete = useCallback(async (answers: any[]) => {
    if (!sessionId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("annotator-assessment", {
        body: { action: "submit_phase3", session_id: sessionId, answers },
      });

      if (error) throw error;
      toast.success("Phase 3 terminée !");

      // Load phase 4 items
      const { data: session } = await supabase.functions.invoke("annotator-assessment", {
        body: { action: "get_session", session_id: sessionId },
      });
      const p4Ids = session?.session?.phase4_item_ids || [];

      // Fetch items directly since we're authenticated
      if (p4Ids.length > 0) {
        const { data: p4Data } = await supabase.functions.invoke("annotator-assessment", {
          body: { action: "get_session", session_id: sessionId },
        });
        // For phase 4 we need to fetch items from the session
        setPhase4Items(
          p4Ids.map((id: string, i: number) => ({
            id,
            content: { scenario: `Scénario ${i + 1}`, context: '' },
          }))
        );
      }
      setPageState("phase4");
    } catch (err) {
      toast.error("Erreur lors de la soumission");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Phase 4 complete
  const handlePhase4Complete = useCallback(async (answers: any[]) => {
    if (!sessionId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("annotator-assessment", {
        body: { action: "submit_phase4", session_id: sessionId, answers },
      });

      if (error) throw error;
      setResults(data);
      setPageState("results");
      
      if (data.passed) {
        toast.success(`🎉 Certification obtenue ! Tier: ${TIER_LABELS[data.tier as AnnotatorTier]?.label || data.tier}`);
      } else {
        toast.error("Score insuffisant pour la certification. Vous pouvez retenter dans 14 jours.");
      }
    } catch (err) {
      toast.error("Erreur lors de la soumission");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Integrity termination
  useEffect(() => {
    if (integrity.isTerminated && !["domain_select", "results", "loading"].includes(pageState)) {
      toast.error("Session terminée : violation critique détectée");
      setPageState("results");
    }
  }, [integrity.isTerminated, pageState]);

  // Loading state
  if (isLoading && pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Domain Selection ──────────────────────────────
  if (pageState === "domain_select") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <FileCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Assessment Annotateur STEF</h1>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            Test de qualification pour devenir annotateur sur la plateforme Human Data.
            40 minutes, 4 phases. Choisissez votre domaine d'expertise.
          </p>
        </div>

        {/* Existing certifications */}
        {existingCerts.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Vos certifications annotateur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {existingCerts.map((cert: any) => (
                  <Badge key={cert.id} className={TIER_LABELS[cert.tier as AnnotatorTier]?.color}>
                    {DOMAIN_LABELS[cert.domain as AnnotationDomain]?.icon}{' '}
                    {DOMAIN_LABELS[cert.domain as AnnotationDomain]?.label} — {TIER_LABELS[cert.tier as AnnotatorTier]?.label}
                    {' '}({Math.round(cert.score)}%)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase overview */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: BookOpen, title: "Phase 1", time: "8 min", desc: "Compréhension de guidelines", color: "text-blue-500" },
                { icon: Target, title: "Phase 2", time: "20 min", desc: "Annotation pratique (15 items)", color: "text-green-500" },
                { icon: Eye, title: "Phase 3", time: "7 min", desc: "Détection d'erreurs (8 items)", color: "text-orange-500" },
                { icon: Brain, title: "Phase 4", time: "5 min", desc: "Jugement éthique (3 scénarios)", color: "text-purple-500" },
              ].map(({ icon: Icon, title, time, desc, color }) => (
                <div key={title} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="font-semibold text-sm">{title}</span>
                    <Badge variant="secondary" className="text-xs">{time}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Domain grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.entries(DOMAIN_LABELS) as [AnnotationDomain, typeof DOMAIN_LABELS[AnnotationDomain]][]).map(([key, domain]) => {
            const existingCert = existingCerts.find((c: any) => c.domain === key);
            const isSelected = selectedDomain === key;

            return (
              <Card
                key={key}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  isSelected ? 'border-primary ring-2 ring-primary/20' : ''
                } ${key === 'generaliste' ? 'border-primary/30' : ''}`}
                onClick={() => {
                  setSelectedDomain(key);
                  checkEligibility(key);
                }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{domain.icon}</span>
                        <h3 className="font-semibold">{domain.label}</h3>
                        {key === 'generaliste' && (
                          <Badge variant="outline" className="text-xs">Obligatoire</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{domain.description}</p>
                      {domain.requiresExperience && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">{domain.requiresExperience}</p>
                      )}
                    </div>
                    {existingCert && (
                      <Badge className={TIER_LABELS[existingCert.tier as AnnotatorTier]?.color}>
                        {TIER_LABELS[existingCert.tier as AnnotatorTier]?.label}
                      </Badge>
                    )}
                  </div>
                  {isSelected && (
                    <div className="mt-3 flex items-center gap-2 text-primary text-sm">
                      <CheckCircle className="h-4 w-4" />
                      Sélectionné
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Eligibility & Start */}
        {selectedDomain && (
          <div className="mt-6 space-y-4">
            {eligibility?.cooldownUntil && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cooldown actif.</strong> Vous pourrez retenter le{' '}
                  {new Date(eligibility.cooldownUntil).toLocaleDateString('fr-FR')}.
                </AlertDescription>
              </Alert>
            )}

            {eligibility?.activeSession && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Une session est déjà en cours (Phase {eligibility.activeSession.phase}).
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Intégrité :</strong> Système anti-triche actif. Changement d'onglet, copier-coller et anomalies de frappe sont surveillés.
              </AlertDescription>
            </Alert>

            <Button
              onClick={startAssessment}
              disabled={isLoading || !!eligibility?.cooldownUntil || !!eligibility?.activeSession}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Commencer l'assessment — {DOMAIN_LABELS[selectedDomain]?.label}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── Guidelines Reading ────────────────────────────
  if (pageState === "guidelines_reading") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  Phase 1 — Lecture des guidelines
                </CardTitle>
                <CardDescription>
                  Lisez attentivement ces guidelines. Vous aurez 10 questions de compréhension ensuite.
                </CardDescription>
              </div>
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                8 min
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {guidelines && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h2>{(guidelines.content as any)?.title || guidelines.title}</h2>
                
                {/* Task description */}
                <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-primary">
                  <h3 className="mt-0">Description de la tâche</h3>
                  <p>{(guidelines.content as any)?.task_description}</p>
                </div>

                {/* Scoring criteria */}
                <h3>Critères d'évaluation</h3>
                {((guidelines.content as any)?.criteria || []).map((c: any, i: number) => (
                  <div key={i} className="mb-4">
                    <h4 className="font-semibold">{c.name} (1-5)</h4>
                    <ul>
                      {(c.levels || []).map((l: any, j: number) => (
                        <li key={j}><strong>{l.score}</strong> — {l.description}</li>
                      ))}
                    </ul>
                  </div>
                ))}

                {/* Examples */}
                <h3>Exemples annotés</h3>
                {((guidelines.examples as any[]) || []).map((ex: any, i: number) => (
                  <div key={i} className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 mb-3 border-l-4 border-green-500">
                    <p className="font-medium">✅ Exemple {i + 1}</p>
                    <p className="text-sm">{ex.description}</p>
                    {ex.scores && (
                      <div className="flex gap-4 mt-2 text-sm">
                        {Object.entries(ex.scores).map(([k, v]) => (
                          <span key={k}><strong>{k}:</strong> {v as string}/5</span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm mt-2 italic">{ex.justification}</p>
                  </div>
                ))}

                {/* Counter-examples */}
                <h3>Contre-exemples</h3>
                {((guidelines.counter_examples as any[]) || []).map((ex: any, i: number) => (
                  <div key={i} className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 mb-3 border-l-4 border-red-500">
                    <p className="font-medium">❌ Contre-exemple {i + 1}</p>
                    <p className="text-sm">{ex.description}</p>
                    <p className="text-sm mt-2 italic text-red-700 dark:text-red-400">{ex.why_wrong}</p>
                  </div>
                ))}

                {/* Edge cases */}
                <h3>Cas limites</h3>
                {((guidelines.edge_cases as any[]) || []).map((ec: any, i: number) => (
                  <div key={i} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 mb-3 border-l-4 border-amber-500">
                    <p className="font-medium">⚠️ Cas limite {i + 1}</p>
                    <p className="text-sm">{ec.situation}</p>
                    <p className="text-sm mt-2"><strong>Décision attendue :</strong> {ec.decision}</p>
                    <p className="text-sm italic">{ec.reasoning}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={startTest} disabled={isLoading} size="lg">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                J'ai lu les guidelines — Commencer le test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Phase 1 ───────────────────────────────────────
  if (pageState === "phase1") {
    return (
      <AnnotatorPhase1Guidelines
        items={phase1Items}
        onComplete={handlePhase1Complete}
        integrity={integrity}
        isLoading={isLoading}
      />
    );
  }

  // ─── Phase 2 ───────────────────────────────────────
  if (pageState === "phase2") {
    return (
      <AnnotatorPhase2Annotation
        items={phase2Items}
        domain={selectedDomain!}
        onComplete={handlePhase2Complete}
        integrity={integrity}
        isLoading={isLoading}
      />
    );
  }

  // ─── Phase 3 ───────────────────────────────────────
  if (pageState === "phase3") {
    return (
      <AnnotatorPhase3ErrorDetection
        items={phase3Items}
        onComplete={handlePhase3Complete}
        integrity={integrity}
        isLoading={isLoading}
      />
    );
  }

  // ─── Phase 4 ───────────────────────────────────────
  if (pageState === "phase4") {
    return (
      <AnnotatorPhase4EthicalJudgment
        items={phase4Items}
        onComplete={handlePhase4Complete}
        integrity={integrity}
        isLoading={isLoading}
      />
    );
  }

  // ─── Results ───────────────────────────────────────
  if (pageState === "results") {
    return (
      <AnnotatorAssessmentResults
        results={results}
        domain={selectedDomain!}
        onRetry={() => {
          setPageState("domain_select");
          setResults(null);
          setSessionId(null);
        }}
      />
    );
  }

  return null;
}
