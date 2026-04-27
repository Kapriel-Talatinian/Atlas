import { useNavigate } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Award, CheckCircle2, ArrowRight, Clock, RefreshCw,
  Stethoscope, Scale, TrendingUp, Code2, AlertTriangle, Play, Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

const domainConfigs = [
  {
    key: "medical",
    label: "Médecine",
    icon: Stethoscope,
    color: "#3B82F6",
    description: "Évaluez les réponses IA sur la terminologie médicale, la sécurité patient et la fiabilité des sources.",
    skills: ["Terminologie", "Sécurité patient", "Sources médicales", "Détection d'erreurs IA"],
    phases: [
      { name: "QCM Domaine", duration: "20 min" },
      { name: "Évaluation IA", duration: "20 min" },
      { name: "Annotation", duration: "20 min" },
    ],
  },
  {
    key: "legal",
    label: "Droit",
    icon: Scale,
    color: "#F59E0B",
    description: "Évaluez les réponses IA sur les concepts juridiques, les nuances entre juridictions et le raisonnement.",
    skills: ["Concepts fondamentaux", "Juridictions", "Raisonnement juridique", "Détection d'erreurs IA"],
    phases: [
      { name: "QCM Domaine", duration: "20 min" },
      { name: "Évaluation IA", duration: "20 min" },
      { name: "Annotation", duration: "20 min" },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: TrendingUp,
    color: "#10B981",
    description: "Évaluez les réponses IA sur les marchés financiers, la réglementation, les risques et la compliance.",
    skills: ["Marchés financiers", "Réglementation", "Risques", "Raisonnement quantitatif"],
    phases: [
      { name: "QCM Domaine", duration: "20 min" },
      { name: "Évaluation IA", duration: "20 min" },
      { name: "Annotation", duration: "20 min" },
    ],
  },
  {
    key: "code",
    label: "Code",
    icon: Code2,
    color: "#7B6FF0",
    description: "Évaluez du code généré par IA : bugs, failles de sécurité, performance et qualité générale.",
    skills: ["Qualité de code", "Sécurité", "Performance", "Détection de bugs"],
    phases: [
      { name: "QCM Domaine", duration: "20 min" },
      { name: "Évaluation IA", duration: "20 min" },
      { name: "Annotation", duration: "20 min" },
    ],
  },
  {
    key: "red_teaming",
    label: "Red Team Safety",
    icon: Shield,
    color: "#EF4444",
    description: "Testez la robustesse des modèles IA face aux prompts adversariaux, biais, contenus dangereux et désinformation.",
    skills: ["Prompts adversariaux", "Détection de biais", "Contenu dangereux", "Désinformation"],
    phases: [
      { name: "QCM Domaine", duration: "20 min" },
      { name: "Évaluation IA", duration: "20 min" },
      { name: "Annotation", duration: "20 min" },
    ],
  },
];

type CertStatus = "certified" | "expiring" | "failed" | "in_progress" | "not_started" | "expired";

interface CertInfo {
  status: CertStatus;
  score?: number;
  tier?: string;
  validUntil?: string;
  nextAttempt?: string;
  currentPhase?: number;
}

export default function CertificationPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["expert-certifications-full"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: certs } = await supabase
        .from("annotator_domain_certifications")
        .select("*")
        .eq("user_id", session.user.id);

      const { data: sessions } = await supabase
        .from("annotator_assessment_sessions")
        .select("domain, status, current_phase, completed_at, started_at")
        .eq("user_id", session.user.id)
        .order("started_at", { ascending: false });

      return { certifications: certs || [], sessions: sessions || [] };
    },
    staleTime: 30_000,
  });

  const getCertInfo = (domain: string): CertInfo => {
    const domainAliases: Record<string, string[]> = {
      medical: ["medical"],
      legal: ["legal", "juridique_fr"],
      finance: ["finance"],
      code: ["code", "code_tech"],
      red_teaming: ["red_teaming", "red_teaming_safety"],
    };
    const acceptedDomains = domainAliases[domain] || [domain];
    const cert = data?.certifications.find((c: any) => acceptedDomains.includes(c.domain) && c.status === "valid");
    if (cert) {
      const validUntil = new Date(cert.valid_until);
      const daysRemaining = Math.max(0, (validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 0) return { status: "expired" };
      if (daysRemaining < 60) return { status: "expiring", score: cert.score, tier: cert.tier, validUntil: cert.valid_until };
      return { status: "certified", score: cert.score, tier: cert.tier, validUntil: cert.valid_until };
    }

    const activeSession = data?.sessions.find((s: any) => s.domain === domain && s.status === "in_progress");
    if (activeSession) return { status: "in_progress", currentPhase: activeSession.current_phase };

    const failedSession = data?.sessions.find((s: any) => s.domain === domain && s.status === "failed");
    if (failedSession) {
      const nextAttempt = new Date(failedSession.completed_at || failedSession.started_at);
      nextAttempt.setDate(nextAttempt.getDate() + 14);
      if (nextAttempt > new Date()) {
        return { status: "failed", nextAttempt: nextAttempt.toISOString() };
      }
    }

    return { status: "not_started" };
  };

  const activeCerts = data?.certifications.filter((c: any) => c.status === "valid" && new Date(c.valid_until) > new Date()) || [];
  const nextExpiring = activeCerts.length > 0
    ? activeCerts.reduce((earliest: any, c: any) => new Date(c.valid_until) < new Date(earliest.valid_until) ? c : earliest)
    : null;

  const StatusBadge = ({ info }: { info: CertInfo }) => {
    switch (info.status) {
      case "certified":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 text-xs"><CheckCircle2 className="w-3 h-3" />Certifié</Badge>;
      case "expiring":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 text-xs"><AlertTriangle className="w-3 h-3" />Expire bientôt</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1 text-xs"><AlertTriangle className="w-3 h-3" />Échoué</Badge>;
      case "in_progress":
        return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs"><Play className="w-3 h-3" />En cours</Badge>;
      case "expired":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1 text-xs"><Clock className="w-3 h-3" />Expiré</Badge>;
      default:
        return <Badge variant="outline" className="text-xs text-muted-foreground gap-1"><Clock className="w-3 h-3" />Non passé</Badge>;
    }
  };

  return (
    <ExpertDashboardLayout>
      <div className="px-4 md:px-8 py-6 max-w-[900px] mx-auto space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Certifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Obtenez une certification pour accéder aux tâches d'annotation rémunérées dans le domaine de votre choix.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Chaque certification comprend 3 phases et dure environ 45 à 60 minutes. Le résultat est immédiat.
          </p>
        </div>

        {!isLoading && activeCerts.length > 0 && (
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border">
            {activeCerts.length} certification{activeCerts.length > 1 ? "s" : ""} active{activeCerts.length > 1 ? "s" : ""} sur {domainConfigs.length}
            {nextExpiring && (
              <span> · Prochaine expiration : {domainConfigs.find(d => d.key === nextExpiring.domain)?.label} le {new Date(nextExpiring.valid_until).toLocaleDateString("fr-FR")}</span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domainConfigs.map((domain, i) => {
              const info = getCertInfo(domain.key);
              const Icon = domain.icon;
              const isCooldown = info.status === "failed" && info.nextAttempt && new Date(info.nextAttempt) > new Date();

              return (
                <motion.div
                  key={domain.key}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card
                    className="relative overflow-hidden transition-all duration-150 hover:scale-[1.01] cursor-pointer group"
                    style={{ borderLeftWidth: 3, borderLeftColor: domain.color }}
                    onClick={() => {
                      if (info.status === "certified") return;
                      if (isCooldown) return;
                      navigate(`/expert/certification/${domain.key}`);
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none rounded-xl"
                      style={{ border: `1px solid ${domain.color}30` }}
                    />
                    <CardContent className="p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: `${domain.color}10` }}>
                            <Icon className="w-6 h-6" style={{ color: domain.color }} />
                          </div>
                          <h3 className="font-semibold text-foreground text-lg">{domain.label}</h3>
                        </div>
                        <StatusBadge info={info} />
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed">{domain.description}</p>

                      {/* Phase timeline */}
                      <div className="flex gap-2">
                        {domain.phases.map((phase, pi) => {
                          const isComplete = info.status === "in_progress" && info.currentPhase && pi < (info.currentPhase - 1);
                          const isCurrent = info.status === "in_progress" && info.currentPhase === pi + 1;
                          return (
                            <div
                              key={pi}
                              className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs transition-colors ${
                                isComplete
                                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"
                                  : isCurrent
                                    ? "border-primary/50 bg-primary/5 text-primary animate-pulse"
                                    : "border-border bg-muted/30 text-muted-foreground"
                              }`}
                            >
                              <div className="font-medium">Phase {pi + 1}</div>
                              <div className="text-[10px] mt-0.5 opacity-80">{phase.name}</div>
                              <div className="text-[10px] opacity-60">{phase.duration}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Skills */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Compétences testées</p>
                        <div className="flex flex-wrap gap-1.5">
                          {domain.skills.map(skill => (
                            <span key={skill} className="text-[11px] px-2 py-0.5 rounded-md bg-muted border border-border text-muted-foreground">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="pt-1">
                        {info.status === "certified" && (
                          <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Certifié jusqu'au {new Date(info.validUntil!).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                        {info.status === "expiring" && (
                          <div className="space-y-2">
                            <p className="text-sm text-amber-600 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4" />
                              Expire le {new Date(info.validUntil!).toLocaleDateString("fr-FR")}
                            </p>
                            <Button
                              size="sm"
                              className="w-full gap-1.5"
                              onClick={(e) => { e.stopPropagation(); navigate(`/expert/certification/${domain.key}`); }}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Renouveler
                            </Button>
                          </div>
                        )}
                        {info.status === "expired" && (
                          <Button
                            size="sm"
                            className="w-full gap-1.5"
                            onClick={(e) => { e.stopPropagation(); navigate(`/expert/certification/${domain.key}`); }}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Renouveler
                          </Button>
                        )}
                        {info.status === "in_progress" && (
                          <Button
                            size="sm"
                            className="w-full gap-1.5"
                            onClick={(e) => { e.stopPropagation(); navigate(`/expert/certification/${domain.key}`); }}
                          >
                            <Play className="w-3.5 h-3.5" />
                            Reprendre
                          </Button>
                        )}
                        {info.status === "not_started" && (
                          <Button
                            size="sm"
                            className="w-full gap-1.5"
                            onClick={(e) => { e.stopPropagation(); navigate(`/expert/certification/${domain.key}`); }}
                          >
                            Commencer
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {info.status === "failed" && isCooldown && (
                          <Button size="sm" className="w-full" disabled>
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            Disponible le {new Date(info.nextAttempt!).toLocaleDateString("fr-FR")}
                          </Button>
                        )}
                        {info.status === "failed" && !isCooldown && (
                          <Button
                            size="sm"
                            className="w-full gap-1.5"
                            onClick={(e) => { e.stopPropagation(); navigate(`/expert/certification/${domain.key}`); }}
                          >
                            Réessayer
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </ExpertDashboardLayout>
  );
}
