import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProfileProgressProps {
  profile: {
    full_name?: string;
    title?: string;
    bio?: string;
    primary_skills?: string[];
    years_of_experience?: number;
    cv_url?: string;
    linkedin_url?: string;
    avatar_url?: string;
    phone?: string;
    country?: string;
    city?: string;
  };
}

interface ProgressItem {
  key: string;
  labelFr: string;
  labelEn: string;
  completed: boolean;
  weight: number;
}

export const ProfileProgress = ({ profile }: ProfileProgressProps) => {
  const { language } = useLanguage();
  
  const progressItems: ProgressItem[] = [
    { 
      key: "full_name", 
      labelFr: "Nom complet", 
      labelEn: "Full name",
      completed: !!profile.full_name && profile.full_name.length > 2, 
      weight: 10 
    },
    { 
      key: "title", 
      labelFr: "Titre professionnel", 
      labelEn: "Professional title",
      completed: !!profile.title && profile.title.length > 3, 
      weight: 15 
    },
    { 
      key: "bio", 
      labelFr: "Biographie", 
      labelEn: "Biography",
      completed: !!profile.bio && profile.bio.length > 50, 
      weight: 15 
    },
    { 
      key: "skills", 
      labelFr: "Compétences", 
      labelEn: "Skills",
      completed: profile.primary_skills && profile.primary_skills.length >= 3, 
      weight: 20 
    },
    { 
      key: "experience", 
      labelFr: "Années d'expérience", 
      labelEn: "Years of experience",
      completed: !!profile.years_of_experience && profile.years_of_experience > 0, 
      weight: 10 
    },
    { 
      key: "cv", 
      labelFr: "CV/Resume", 
      labelEn: "CV/Resume",
      completed: !!profile.cv_url, 
      weight: 15 
    },
    { 
      key: "linkedin", 
      labelFr: "LinkedIn", 
      labelEn: "LinkedIn",
      completed: !!profile.linkedin_url, 
      weight: 10 
    },
    { 
      key: "location", 
      labelFr: "Localisation", 
      labelEn: "Location",
      completed: !!profile.country && !!profile.city, 
      weight: 5 
    },
  ];

  const totalWeight = progressItems.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = progressItems
    .filter(item => item.completed)
    .reduce((sum, item) => sum + item.weight, 0);
  const percentage = Math.round((completedWeight / totalWeight) * 100);

  const getProgressColor = () => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getStatusIcon = () => {
    if (percentage >= 80) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (percentage >= 50) return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    return <AlertCircle className="w-5 h-5 text-orange-500" />;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-sm">
            {language === 'fr' ? 'Profil complété' : 'Profile completed'}
          </span>
        </div>
        <span className="text-sm font-bold text-primary">{percentage}%</span>
      </div>
      
      <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-4">
        <div 
          className={`absolute left-0 top-0 h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="space-y-2">
        {progressItems.map((item) => (
          <div key={item.key} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {item.completed ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={item.completed ? "text-muted-foreground" : "text-foreground"}>
                {language === 'fr' ? item.labelFr : item.labelEn}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">+{item.weight}%</span>
          </div>
        ))}
      </div>

      {percentage < 80 && (
        <p className="text-xs text-muted-foreground mt-4 bg-primary/5 p-3 rounded-lg">
          {language === 'fr' 
            ? "💡 Plus votre profil est complet, plus vous recevrez d'offres correspondant à vos compétences."
            : "💡 The more complete your profile, the more job offers matching your skills you'll receive."
          }
        </p>
      )}
    </div>
  );
};
