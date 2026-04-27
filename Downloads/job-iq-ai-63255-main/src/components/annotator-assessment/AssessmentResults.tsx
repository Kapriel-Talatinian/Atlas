import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy, XCircle, ArrowRight, BookOpen, Target, Eye, Brain,
  RotateCcw, CheckCircle
} from "lucide-react";
import type { AnnotationDomain, AnnotatorTier } from "@/types/annotator-assessment";
import { DOMAIN_LABELS, TIER_LABELS, PHASE_WEIGHTS } from "@/types/annotator-assessment";

interface ResultsProps {
  results: any;
  domain: AnnotationDomain;
  onRetry: () => void;
}

export function AnnotatorAssessmentResults({ results, domain, onRetry }: ResultsProps) {
  if (!results) return null;

  const passed = results.passed || results.tier;
  const tier = results.tier as AnnotatorTier | null;
  const globalScore = results.globalScore || 0;
  const phase1Failed = results.phase1Failed;

  const phaseScores = [
    { key: 'phase1', label: 'Compréhension', icon: BookOpen, color: 'text-blue-500', weight: PHASE_WEIGHTS.phase1, score: results.phase1?.score || results.score || 0 },
    { key: 'phase2', label: 'Annotation', icon: Target, color: 'text-green-500', weight: PHASE_WEIGHTS.phase2, score: results.phase2?.score || 0 },
    { key: 'phase3', label: 'Détection d\'erreurs', icon: Eye, color: 'text-orange-500', weight: PHASE_WEIGHTS.phase3, score: results.phase3?.score || 0 },
    { key: 'phase4', label: 'Jugement éthique', icon: Brain, color: 'text-purple-500', weight: PHASE_WEIGHTS.phase4, score: results.phase4?.score || 0 },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      {/* Main result card */}
      <Card className={`border-2 ${passed ? 'border-green-500/30' : 'border-red-500/30'}`}>
        <CardHeader className="text-center space-y-4">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            passed ? 'bg-green-100 dark:bg-green-950/50' : 'bg-red-100 dark:bg-red-950/50'
          }`}>
            {passed ? (
              <Trophy className="h-10 w-10 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            )}
          </div>

          <div>
            <CardTitle className="text-2xl">
              {phase1Failed
                ? "Phase 1 non validée"
                : passed
                  ? `Certification obtenue !`
                  : "Score insuffisant"
              }
            </CardTitle>
            <CardDescription className="mt-2">
              {DOMAIN_LABELS[domain]?.icon} {DOMAIN_LABELS[domain]?.label}
            </CardDescription>
          </div>

          {/* Score display */}
          <div className="text-center">
            <div className="text-5xl font-bold">
              {Math.round(globalScore || results.score || 0)}
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
            {tier && (
              <Badge className={`mt-3 text-lg px-4 py-1 ${TIER_LABELS[tier]?.color}`}>
                {TIER_LABELS[tier]?.label}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Tier description */}
          {tier && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Tier {TIER_LABELS[tier]?.label} :</strong> {TIER_LABELS[tier]?.description}
              </AlertDescription>
            </Alert>
          )}

          {/* Phase breakdown */}
          {!phase1Failed && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Détail par phase</h3>
              {phaseScores.map(({ key, label, icon: Icon, color, weight, score }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span>{label}</span>
                      <span className="text-xs text-muted-foreground">({Math.round(weight * 100)}%)</span>
                    </div>
                    <span className="font-mono font-semibold">{Math.round(score)}%</span>
                  </div>
                  <Progress value={score} className="h-2" />
                </div>
              ))}
            </div>
          )}

          {/* Phase 1 failure specific feedback */}
          {phase1Failed && results.details && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Détail des réponses</h3>
              <div className="space-y-2">
                {(results.details as any[]).map((d: any, i: number) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded text-sm ${
                    d.correct ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
                  }`}>
                    {d.correct ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span>Question {i + 1}</span>
                    {!d.correct && d.expected && (
                      <span className="text-xs text-muted-foreground ml-auto">Attendu: {d.expected}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retry info */}
          {!passed && (
            <Alert>
              <AlertDescription>
                {phase1Failed
                  ? "Relisez attentivement les guidelines et les cas limites avant de retenter dans 14 jours."
                  : "Vous pouvez retenter dans 14 jours. Concentrez-vous sur les phases où votre score est le plus bas."
                }
              </AlertDescription>
            </Alert>
          )}

          {/* CTA */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onRetry} className="flex-1">
              <RotateCcw className="h-4 w-4 mr-2" />
              Retour aux domaines
            </Button>
            {passed && (
              <Button className="flex-1" onClick={() => window.location.href = '/expert/home'}>
                Voir mon dashboard <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
