import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle2, 
  Circle, 
  User, 
  FileText, 
  Briefcase, 
  CreditCard,
  Award,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface OnboardingProgressProps {
  profile: any;
  compact?: boolean;
}

interface Mission {
  id: string;
  icon: any;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  completed: boolean;
  action?: () => void;
  weight: number;
}

export const OnboardingProgress = ({ profile, compact = false }: OnboardingProgressProps) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const missions: Mission[] = [
    {
      id: "photo",
      icon: User,
      titleFr: "Ajouter une photo",
      titleEn: "Add a photo",
      descFr: "Les profils avec photo ont 3x plus de chances",
      descEn: "Profiles with photos get 3x more views",
      completed: !!profile?.avatar_url,
      action: () => navigate("/expert/profile"),
      weight: 15,
    },
    {
      id: "bio",
      icon: FileText,
      titleFr: "Compléter votre bio",
      titleEn: "Complete your bio",
      descFr: "Décrivez votre expertise en quelques lignes",
      descEn: "Describe your expertise in a few lines",
      completed: profile?.bio && profile.bio.length > 50,
      action: () => navigate("/expert/profile"),
      weight: 15,
    },
    {
      id: "cv",
      icon: FileText,
      titleFr: "Télécharger votre CV",
      titleEn: "Upload your CV",
      descFr: "Un CV à jour augmente vos chances",
      descEn: "An updated CV increases your chances",
      completed: !!profile?.cv_url,
      action: () => navigate("/expert/profile"),
      weight: 20,
    },
    {
      id: "skills",
      icon: Award,
      titleFr: "Ajouter vos compétences",
      titleEn: "Add your skills",
      descFr: "Listez au moins 3 compétences principales",
      descEn: "List at least 3 main skills",
      completed: profile?.primary_skills && profile.primary_skills.length >= 3,
      action: () => navigate("/expert/profile"),
      weight: 15,
    },
    {
      id: "apply",
      icon: Briefcase,
      titleFr: "Postuler à une offre",
      titleEn: "Apply to a job",
      descFr: "Faites le premier pas vers votre prochaine mission",
      descEn: "Take the first step towards your next mission",
      completed: false, // Will be updated based on applications
      action: () => navigate("/expert/explore"),
      weight: 20,
    },
    {
      id: "payment",
      icon: CreditCard,
      titleFr: "Configurer le paiement",
      titleEn: "Setup payment",
      descFr: "Ajoutez vos coordonnées pour être payé",
      descEn: "Add your details to get paid",
      completed: !!profile?.payment_method_connected,
      action: () => navigate("/expert/earnings"),
      weight: 15,
    },
  ];

  const completedWeight = missions
    .filter(m => m.completed)
    .reduce((sum, m) => sum + m.weight, 0);
  
  const percentage = Math.round(completedWeight);
  const incompleteMissions = missions.filter(m => !m.completed);

  if (percentage === 100) {
    return null; // Hide when complete
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 rounded-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{percentage}%</span>
        </div>
        <Progress value={percentage} className="flex-1 h-2" />
        <Badge variant="secondary" className="text-xs">
          {incompleteMissions.length} {language === 'fr' ? 'restant' : 'left'}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">
              {language === 'fr' ? "Complétez votre profil" : "Complete your profile"}
            </h3>
          </div>
          <Badge variant="outline" className="font-bold">
            {percentage}%
          </Badge>
        </div>

        <Progress value={percentage} className="h-3 mb-6" />

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            {language === 'fr' 
              ? `${incompleteMissions.length} mission${incompleteMissions.length > 1 ? 's' : ''} restante${incompleteMissions.length > 1 ? 's' : ''} pour optimiser votre profil`
              : `${incompleteMissions.length} mission${incompleteMissions.length > 1 ? 's' : ''} left to optimize your profile`
            }
          </p>

          {incompleteMissions.slice(0, 3).map((mission) => {
            const Icon = mission.icon;
            return (
              <div
                key={mission.id}
                onClick={mission.action}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10">
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {language === 'fr' ? mission.titleFr : mission.titleEn}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {language === 'fr' ? mission.descFr : mission.descEn}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            );
          })}

          {incompleteMissions.length > 3 && (
            <Button 
              variant="ghost" 
              className="w-full text-sm"
              onClick={() => navigate("/expert/profile")}
            >
              {language === 'fr' 
                ? `Voir ${incompleteMissions.length - 3} autres missions`
                : `See ${incompleteMissions.length - 3} more missions`
              }
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
