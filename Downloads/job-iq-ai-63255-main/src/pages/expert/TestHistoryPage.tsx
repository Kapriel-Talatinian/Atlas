import { useNavigate } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { ErrorRetry } from "@/components/expert/ErrorRetry";
import { 
  Brain, Clock, CheckCircle, AlertTriangle,
  FileText, Trophy
} from "lucide-react";

interface TestSubmission {
  id: string;
  test_score: number | null;
  cv_score: number | null;
  final_score: number | null;
  submitted_at: string | null;
  feedback: Record<string, unknown> | null;
  cheat_indicators: Record<string, number | boolean> | null;
  job_offer: {
    id: string;
    title: string;
    company_id: string;
  } | null;
}

export default function TestHistoryPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["test-history"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); throw new Error("Not authenticated"); }

      const { data: profile } = await supabase
        .from("expert_profiles")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile) { navigate("/expert/onboarding"); throw new Error("No profile"); }

      const { data: subs, error } = await supabase
        .from("test_submissions")
        .select(`id, test_score, cv_score, final_score, submitted_at, feedback, cheat_indicators, job_offer_id, job_offers:job_offer_id (id, title, company_id)`)
        .eq("expert_id", profile.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      return ((subs || []) as unknown[]).map((sub: any) => ({
        ...sub,
        job_offer: sub.job_offers
      })) as TestSubmission[];
    },
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  const submissions = data || [];

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number | null) => {
    if (!score) return { variant: "secondary" as const, label: "N/A" };
    if (score >= 80) return { variant: "default" as const, label: t('testHistory.excellent') };
    if (score >= 60) return { variant: "secondary" as const, label: t('testHistory.good') };
    if (score >= 40) return { variant: "outline" as const, label: t('testHistory.passable') };
    return { variant: "destructive" as const, label: t('testHistory.insufficient') };
  };

  const averageScore = submissions.length > 0
    ? Math.round(submissions.reduce((sum, s) => sum + (s.final_score || 0), 0) / submissions.length)
    : 0;

  const passedCount = submissions.filter(s => (s.final_score || 0) >= 60).length;

  return (
    <ExpertDashboardLayout>
      <div className="px-4 md:px-8 py-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('testHistory.title')}</h1>
        <p className="text-muted-foreground mb-6">{t('testHistory.subtitle')}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{submissions.length}</p>
                  <p className="text-xs text-muted-foreground">{t('testHistory.testsTaken')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{passedCount}</p>
                  <p className="text-xs text-muted-foreground">{t('testHistory.passed')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Trophy className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(averageScore)}`}>{averageScore}%</p>
                  <p className="text-xs text-muted-foreground">{t('testHistory.averageScore')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('testHistory.yourSubmissions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : isError ? (
              <ErrorRetry onRetry={() => refetch()} />
            ) : submissions.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-2">{t('testHistory.noTests')}</p>
                <p className="text-sm text-muted-foreground mb-4">{t('testHistory.applyToOffers')}</p>
                <Button onClick={() => navigate("/expert/explore")}>{t('testHistory.exploreOffers')}</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission) => {
                  const scoreBadge = getScoreBadge(submission.final_score);
                  const hasCheatIndicators = submission.cheat_indicators && (
                    (submission.cheat_indicators.tab_switches as number) > 3 ||
                    (submission.cheat_indicators.copy_attempts as number) > 0 ||
                    (submission.cheat_indicators.paste_attempts as number) > 0
                  );

                  return (
                    <div key={submission.id} className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{submission.job_offer?.title || t('testHistory.technicalTest')}</h3>
                            <Badge variant={scoreBadge.variant}>{scoreBadge.label}</Badge>
                            {hasCheatIndicators && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {t('testHistory.anomalies')}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {submission.submitted_at
                                ? format(new Date(submission.submitted_at), "d MMM yyyy", { locale: dateLocale })
                                : t('testHistory.unknownDate')
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-6 mt-3">
                            <div>
                              <p className="text-xs text-muted-foreground">{t('testHistory.testScore')}</p>
                              <p className={`font-semibold ${getScoreColor(submission.test_score)}`}>{submission.test_score ?? "-"}/100</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t('testHistory.cvScore')}</p>
                              <p className={`font-semibold ${getScoreColor(submission.cv_score)}`}>{submission.cv_score ?? "-"}/100</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t('testHistory.finalScore')}</p>
                              <p className={`font-bold text-lg ${getScoreColor(submission.final_score)}`}>{submission.final_score ?? "-"}/100</p>
                            </div>
                          </div>

                          {(submission.feedback as any)?.comments && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                              <p className="text-xs font-medium mb-1">{t('testHistory.aiFeedback')}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2">{(submission.feedback as any).comments}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 relative">
                            <svg className="w-16 h-16 transform -rotate-90">
                              <circle className="text-muted stroke-current" strokeWidth="4" fill="transparent" r="28" cx="32" cy="32" />
                              <circle
                                className={`stroke-current ${
                                  (submission.final_score || 0) >= 80 ? "text-green-500" :
                                  (submission.final_score || 0) >= 60 ? "text-blue-500" :
                                  (submission.final_score || 0) >= 40 ? "text-yellow-500" : "text-red-500"
                                }`}
                                strokeWidth="4" strokeLinecap="round" fill="transparent" r="28" cx="32" cy="32"
                                strokeDasharray={`${(submission.final_score || 0) * 1.76} 176`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-lg font-bold ${getScoreColor(submission.final_score)}`}>{submission.final_score ?? "?"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ExpertDashboardLayout>
  );
}
