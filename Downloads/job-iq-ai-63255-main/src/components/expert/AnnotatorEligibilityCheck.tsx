import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Award, 
  User, 
  Clock,
  FileCheck,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EligibilityDetails {
  hasCertification: boolean;
  profileComplete: boolean;
  experienceYears: number;
  hasConsent: boolean;
}

interface EligibilityResult {
  eligible: boolean;
  missing: string[];
  details: EligibilityDetails;
}

interface AnnotatorEligibilityCheckProps {
  expertId: string;
  onEligible: () => void;
}

// Critères simplifiés - SANS KYC
const CRITERIA = [
  { 
    key: 'hasCertification', 
    label: 'Certification valide (≥80%)',
    icon: Award,
    missingKey: 'certification',
    fixPath: '/expert/test',
    fixLabel: 'Passer le test',
  },
  { 
    key: 'profileComplete', 
    label: 'Profil complet (≥70%)',
    icon: User,
    missingKey: 'profile_incomplete',
    fixPath: '/expert/profile',
    fixLabel: 'Compléter le profil',
  },
  { 
    key: 'experienceYears', 
    label: 'Expérience ≥1 an',
    icon: Clock,
    missingKey: 'insufficient_experience',
    fixPath: '/expert/profile',
    fixLabel: 'Mettre à jour',
  },
  { 
    key: 'hasConsent', 
    label: 'Accord contributeur signé',
    icon: FileCheck,
    missingKey: 'consent_not_given',
    fixPath: null,
    fixLabel: null,
  },
];

export function AnnotatorEligibilityCheck({ expertId, onEligible }: AnnotatorEligibilityCheckProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkEligibility();
  }, [expertId]);

  async function checkEligibility() {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('qualify-annotator', {
        body: { action: 'check_eligibility', expertId },
      });

      if (fnError) throw fnError;
      
      setResult(data as EligibilityResult);
      
      if (data.eligible) {
        onEligible();
      }
    } catch (err: any) {
      console.error('Eligibility check failed:', err);
      setError(err.message || 'Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Vérification de l'éligibilité...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <XCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button onClick={checkEligibility} variant="outline" className="mt-4">
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const completedCount = CRITERIA.filter(c => {
    if (c.key === 'experienceYears') {
      return result.details.experienceYears >= 1;
    }
    return result.details[c.key as keyof EligibilityDetails];
  }).length;

  const progress = (completedCount / CRITERIA.length) * 100;

  return (
    <Card className={result.eligible ? "border-success/50" : "border-warning/50"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {result.eligible ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Éligible au programme Annotateur
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-warning" />
                  Critères d'éligibilité
                </>
              )}
            </CardTitle>
            <CardDescription>
              {result.eligible 
                ? "Vous remplissez tous les critères pour devenir annotateur RLHF"
                : "Complétez les critères ci-dessous pour postuler"
              }
            </CardDescription>
          </div>
          <Badge variant={result.eligible ? "default" : "secondary"}>
            {completedCount}/{CRITERIA.length}
          </Badge>
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {CRITERIA.map((criteria) => {
          const isMet = criteria.key === 'experienceYears' 
            ? result.details.experienceYears >= 1
            : result.details[criteria.key as keyof EligibilityDetails];
          
          const Icon = criteria.icon;

          return (
            <div 
              key={criteria.key}
              className={`flex items-center justify-between p-3 rounded-lg ${
                isMet ? 'bg-success/10' : 'bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isMet ? 'text-success' : 'text-muted-foreground'}`} />
                <span className={isMet ? 'text-foreground' : 'text-muted-foreground'}>
                  {criteria.label}
                  {criteria.key === 'experienceYears' && !isMet && (
                    <span className="text-xs ml-1">
                      (actuel: {result.details.experienceYears} ans)
                    </span>
                  )}
                </span>
              </div>
              {isMet ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : criteria.fixPath ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(criteria.fixPath!)}
                >
                  {criteria.fixLabel}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        })}

        {result.eligible && (
          <div className="pt-4">
            <Button className="w-full" size="lg" onClick={onEligible}>
              Passer le test de qualification
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
