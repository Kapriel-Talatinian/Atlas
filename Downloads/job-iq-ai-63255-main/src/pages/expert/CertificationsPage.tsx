import { useNavigate } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, ExternalLink, Copy, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { ErrorRetry } from "@/components/expert/ErrorRetry";
import { useUserDisplayName } from "@/hooks/useUserDisplayName";

interface Certification {
  id: string;
  certificate_id: string;
  first_name: string;
  last_name: string;
  role_title: string;
  level: string;
  score: number;
  assessment_name: string;
  issued_at: string;
  valid_until: string | null;
  status: string;
}

export default function CertificationsPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { data: displayName } = useUserDisplayName("expert");

  const { data: certifications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["certifications"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase
        .from("certifications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("issued_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Certification[];
    },
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valid":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t('certifications.valid')}
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="w-3 h-3 mr-1" />
            {t('certifications.expired')}
          </Badge>
        );
      case "revoked":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="w-3 h-3 mr-1" />
            {t('certifications.revoked')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      associate: "Associate",
      professional: "Professional",
      expert: "Expert"
    };
    return labels[level] || level;
  };

  const copyVerificationLink = (certificateId: string) => {
    const url = `${window.location.origin}/verify/${certificateId}`;
    navigator.clipboard.writeText(url);
    toast.success(t('certifications.linkCopied'));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <ExpertDashboardLayout userName={displayName || undefined}>
      <div className="px-3 sm:px-4 md:px-8 py-4 sm:py-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
              {t('certifications.title')}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {t('certifications.subtitle')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorRetry onRetry={() => refetch()} />
        ) : certifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {t('certifications.noCerts')}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {t('certifications.noCertsDesc')}
              </p>
              <Button onClick={() => navigate("/expert/explore")}>
                {t('certifications.discoverEvals')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {certifications.map((cert) => (
              <Card key={cert.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className={`w-full md:w-2 h-2 md:h-auto ${
                      cert.status === 'valid' ? 'bg-green-500' : 
                      cert.status === 'expired' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    
                    <div className="flex-1 p-4 md:p-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                              <Award className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{cert.role_title}</h3>
                              <p className="text-sm text-muted-foreground">{cert.assessment_name}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mt-3">
                            {getStatusBadge(cert.status)}
                            <Badge variant="outline">{getLevelLabel(cert.level)}</Badge>
                            <Badge variant="secondary">Score: {cert.score}%</Badge>
                          </div>
                          
                          <div className="mt-3 text-sm text-muted-foreground">
                            <span>{t('certifications.issuedOn')} {formatDate(cert.issued_at)}</span>
                            {cert.valid_until && (
                              <span> · {t('certifications.validUntil')} {formatDate(cert.valid_until)}</span>
                            )}
                          </div>
                          
                          <p className="mt-2 text-xs text-muted-foreground font-mono">
                            ID: {cert.certificate_id}
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/expert/certifications/${cert.certificate_id}`)}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            {t('common.view')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyVerificationLink(cert.certificate_id)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            {t('certifications.copyLink')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground text-center">
            {t('certifications.legalNotice')}
          </p>
        </div>
      </div>
    </ExpertDashboardLayout>
  );
}
