import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Clock, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

interface Certification {
  domain: string;
  tier: string;
  score: number;
  status: string;
  issued_at: string;
  valid_until: string;
}

interface CertificationsSectionProps {
  certifications: Certification[];
  cooldowns?: Record<string, string>;
}

const allDomains = ["medical", "juridique_fr", "finance", "code_tech", "generaliste", "rlhf_preference", "red_teaming_safety"];
const domainLabels: Record<string, string> = {
  medical: "Médical",
  juridique_fr: "Juridique",
  finance: "Finance",
  code_tech: "Code",
  generaliste: "Généraliste",
  rlhf_preference: "RLHF Preference",
  red_teaming_safety: "Red Team Safety",
};
const domainColors: Record<string, string> = {
  medical: "border-blue-500/30 bg-blue-500/5",
  juridique_fr: "border-amber-500/30 bg-amber-500/5",
  finance: "border-emerald-500/30 bg-emerald-500/5",
  code_tech: "border-primary/30 bg-primary/5",
  generaliste: "border-muted-foreground/30 bg-muted/40",
  rlhf_preference: "border-violet-500/30 bg-violet-500/5",
  red_teaming_safety: "border-rose-500/30 bg-rose-500/5",
};
const domainIconColors: Record<string, string> = {
  medical: "text-blue-500",
  juridique_fr: "text-amber-500",
  finance: "text-emerald-500",
  code_tech: "text-primary",
  generaliste: "text-muted-foreground",
  rlhf_preference: "text-violet-500",
  red_teaming_safety: "text-rose-500",
};

export function CertificationsSection({ certifications, cooldowns = {} }: CertificationsSectionProps) {
  const certMap = Object.fromEntries(certifications.map((c) => [c.domain, c]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {allDomains.map((domain) => {
        const cert = certMap[domain];
        const cooldownDate = cooldowns[domain];
        const inCooldown = cooldownDate && new Date(cooldownDate) > new Date();

        if (cert && cert.status === "valid") {
          const issuedDate = new Date(cert.issued_at);
          const validUntil = new Date(cert.valid_until);
          const now = new Date();
          const totalDays = (validUntil.getTime() - issuedDate.getTime()) / (1000 * 60 * 60 * 24);
          const daysRemaining = Math.max(0, (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const progressPct = Math.round((1 - daysRemaining / totalDays) * 100);
          const nearExpiry = daysRemaining < 60;

          return (
            <Card key={domain} className={`border ${domainColors[domain]}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className={`w-5 h-5 ${domainIconColors[domain]}`} />
                    <span className="font-medium text-foreground">{domainLabels[domain]}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{cert.tier}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Certifié depuis le {issuedDate.toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expire le {validUntil.toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Validité</span>
                    <span className="font-mono">{Math.round(daysRemaining)}j restants</span>
                  </div>
                  <Progress value={progressPct} className="h-1.5" />
                </div>
                <p className="text-xs font-mono text-muted-foreground">
                  Score : {cert.score}/100
                </p>
                {nearExpiry && (
                  <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
                    <Link to={`/expert/certification?domain=${domain}`}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Renouveler
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={domain} className="border border-border opacity-60">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">{domainLabels[domain]}</span>
              </div>
              <p className="text-sm text-muted-foreground">Non certifié</p>
              {inCooldown ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-500">
                  <Clock className="w-3.5 h-3.5" />
                  Prochaine tentative le {new Date(cooldownDate!).toLocaleDateString("fr-FR")}
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={`/expert/certification?domain=${domain}`}>Passer la certification</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
