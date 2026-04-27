import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { DataUploadDialog } from "./DataUploadDialog";
import { BarChart3 } from "lucide-react";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string;
    type: string;
    domain: string;
    status: string;
    total_items: number;
    complexity_level: number;
    priority_level: string;
    created_at: string;
    estimated_cost: number;
  };
  stats: {
    completed: number;
    inProgress: number;
    queued: number;
  };
  onRefresh: () => void;
  onSelect: (id: string) => void;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  guidelines_review: { label: "En revue", variant: "outline" },
  pilot: { label: "Pilote", variant: "outline" },
  active: { label: "Actif", variant: "default" },
  paused: { label: "Pausé", variant: "destructive" },
  completed: { label: "Terminé", variant: "default" },
  archived: { label: "Archivé", variant: "secondary" },
};

const DOMAIN_EMOJI: Record<string, string> = {
  medical: "🏥",
  legal: "⚖️",
  finance: "💰",
  code: "💻",
  general: "📝",
};

export const ProjectCard = ({ project, stats, onRefresh, onSelect }: ProjectCardProps) => {
  const actualItems = stats.completed + stats.inProgress + stats.queued;
  const itemsMissing = project.total_items > 0 && actualItems === 0;
  const completionRate = actualItems > 0 ? Math.round((stats.completed / actualItems) * 100) : 0;
  const statusInfo = STATUS_MAP[project.status] || { label: project.status, variant: "secondary" as const };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(project.id)}>
      <CardHeader className="pb-3 px-4 sm:px-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg sm:text-xl shrink-0">{DOMAIN_EMOJI[project.domain] || "📝"}</span>
            <CardTitle className="text-base sm:text-lg truncate">{project.name}</CardTitle>
          </div>
          <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
            {project.priority_level !== "standard" && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                {project.priority_level === "rush" ? "RUSH" : "CRITIQUE"}
              </Badge>
            )}
            <Badge variant={statusInfo.variant} className="text-[10px] px-1.5 py-0.5">{statusInfo.label}</Badge>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-1">{project.description}</p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 sm:px-6">
        {itemsMissing && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            ⚠ {project.total_items} items déclarés mais non importés en base. Réimportez vos données.
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs sm:text-sm">Progression</span>
          <span className="font-medium text-xs sm:text-sm">{completionRate}%</span>
        </div>
        <Progress value={completionRate} className="h-2" />

        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          <div className="bg-muted/50 rounded-lg p-1.5 sm:p-2">
            <p className="text-base sm:text-lg font-bold text-foreground">{stats.queued}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">En attente</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-1.5 sm:p-2">
            <p className="text-base sm:text-lg font-bold text-primary">{stats.inProgress}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">En cours</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-1.5 sm:p-2">
            <p className="text-base sm:text-lg font-bold text-primary">{stats.completed}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Terminés</p>
          </div>
        </div>

        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          {["draft", "active", "in_progress", "pilot"].includes(project.status) && (
            <DataUploadDialog projectId={project.id} onUploaded={onRefresh} />
          )}
          <Button variant="ghost" size="sm" className="gap-1 ml-auto text-xs" onClick={() => onSelect(project.id)}>
            <BarChart3 className="w-3.5 h-3.5" />Détails
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
