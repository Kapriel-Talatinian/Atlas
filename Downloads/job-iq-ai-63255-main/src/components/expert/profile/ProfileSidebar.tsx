import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Award, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { TrustScoreCircle } from "./TrustScoreCircle";

interface Certification {
  domain: string;
  tier: string;
  issued_at: string;
}

interface ProfileSidebarProps {
  name: string;
  email: string;
  suspensionStatus?: string;
  certifications: Certification[];
  trustScore: number;
  alphaAvg: number | null;
  totalTasks: number;
  tasksThisMonth: number;
  memberSince: string;
  onEdit: () => void;
}

const domainColors: Record<string, string> = {
  medical: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  legal: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  finance: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  code: "bg-primary/10 text-primary border-primary/20",
};

const domainLabels: Record<string, string> = {
  medical: "Médical",
  legal: "Juridique",
  finance: "Finance",
  code: "Code",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-emerald-500 text-white" },
  warned: { label: "Averti", className: "bg-amber-500 text-white" },
  suspended: { label: "Suspendu", className: "bg-destructive text-white" },
  banned: { label: "Banni", className: "bg-foreground text-background" },
};

export function ProfileSidebar({
  name,
  email,
  suspensionStatus = "active",
  certifications,
  trustScore,
  alphaAvg,
  totalTasks,
  tasksThisMonth,
  memberSince,
  onEdit,
}: ProfileSidebarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const status = statusConfig[suspensionStatus] || statusConfig.active;

  const alphaColor =
    alphaAvg === null
      ? "text-muted-foreground"
      : alphaAvg >= 0.8
      ? "text-emerald-500"
      : alphaAvg >= 0.67
      ? "text-amber-500"
      : "text-destructive";

  return (
    <div className="space-y-6">
      {/* Avatar & Name */}
      <div className="flex flex-col items-center text-center gap-3">
        <Avatar className="w-20 h-20">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-lg font-bold text-foreground">{name}</h2>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${status.className}`}>
              {status.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{email}</p>
        </div>
      </div>

      {/* Certifications */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Certifications</p>
        {certifications.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {certifications.map((c) => (
              <span
                key={c.domain}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${
                  domainColors[c.domain] || "bg-muted text-muted-foreground border-border"
                }`}
              >
                <Award className="w-3 h-3" />
                {domainLabels[c.domain] || c.domain}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">Aucune certification.</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/expert/certification">Passer un assessment</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Trust Score */}
      <div className="flex items-center justify-center gap-6">
        <TrustScoreCircle score={trustScore} size={120} label="Score de confiance" />
        <TrustScoreCircle
          score={alphaAvg !== null ? alphaAvg * 100 : 0}
          size={80}
          label="α moyen"
          className={alphaColor}
        />
      </div>
      {alphaAvg !== null && (
        <p className={`text-center font-mono text-sm font-semibold ${alphaColor}`}>
          α = {alphaAvg.toFixed(3)}
        </p>
      )}

      {/* Quick Stats */}
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Tâches complétées</span>
          <span className="font-mono font-medium text-foreground">{totalTasks}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Ce mois</span>
          <span className="font-mono font-medium text-foreground">{tasksThisMonth}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Membre depuis</span>
          <span className="text-sm text-foreground">{memberSince}</span>
        </div>
      </div>

      {/* Edit Button */}
      <Button variant="outline" className="w-full gap-2" onClick={onEdit}>
        <Pencil className="w-4 h-4" />
        Modifier mon profil
      </Button>
    </div>
  );
}
