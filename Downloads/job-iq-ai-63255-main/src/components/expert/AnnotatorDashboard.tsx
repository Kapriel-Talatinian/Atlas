import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  CheckCircle2, 
  Clock,
  DollarSign,
  FileCheck,
  AlertTriangle
} from "lucide-react";
import { AnnotatorTaskQueue } from "./AnnotatorTaskQueue";

interface AnnotatorDashboardProps {
  expertId: string;
  annotatorId?: string;
}

interface AnnotatorStats {
  totalPending: number;
  totalPaid: number;
  annotationsCount: number;
  flaggedCount: number;
}

interface AnnotatorProfile {
  id: string;
  is_qualified: boolean;
  is_active: boolean;
  warnings_count: number;
  suspended_until: string | null;
  total_annotations: number;
  reliability_score: number;
}

export function AnnotatorDashboard({ expertId, annotatorId }: AnnotatorDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AnnotatorProfile | null>(null);
  const [stats, setStats] = useState<AnnotatorStats | null>(null);

  useEffect(() => {
    loadData();
  }, [expertId, annotatorId]);

  async function loadData() {
    try {
      // Load annotator profile
      let query = supabase.from('annotator_profiles').select('*');
      
      if (annotatorId) {
        query = query.eq('id', annotatorId);
      } else {
        query = query.eq('expert_id', expertId);
      }
      
      const { data: annotator } = await query.single();

      setProfile(annotator);

      if (annotator) {
        // Load payment stats
        const { data: statsData } = await supabase.functions.invoke('process-annotation-payment', {
          body: { action: 'get_stats', annotatorId: annotator.id },
        });
        
        if (statsData) {
          setStats(statsData);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Profil annotateur non trouvé</p>
        </CardContent>
      </Card>
    );
  }

  const isSuspended = profile.suspended_until && new Date(profile.suspended_until) > new Date();

  return (
    <div className="space-y-6">
      {/* Status Card - Simplifié */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Statut Annotateur
              </CardTitle>
              <CardDescription>
                {profile.is_qualified 
                  ? "Vous êtes qualifié pour annoter" 
                  : "En attente de qualification"
                }
              </CardDescription>
            </div>
            <Badge variant={profile.is_qualified ? "default" : "secondary"}>
              {profile.is_qualified ? "Qualifié" : "Non qualifié"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isSuspended && (
            <div className="flex items-center gap-2 text-destructive mb-4 p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Compte suspendu jusqu'au {new Date(profile.suspended_until!).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {profile.total_annotations || 0}
              </div>
              <div className="text-sm text-muted-foreground">Annotations</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-success">
                {((profile.reliability_score || 1) * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Fiabilité</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-warning">
                {profile.warnings_count || 0}
              </div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <DollarSign className="h-5 w-5" />
                {stats?.totalPending?.toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-muted-foreground">En attente</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Info - Simplifié */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Paiements
            </CardTitle>
            <CardDescription>
              Le paiement est effectué manuellement après la vente des datasets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <Clock className="h-5 w-5 mx-auto mb-2 text-warning" />
                <div className="text-xl font-bold">${stats.totalPending.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">En attente</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-success" />
                <div className="text-xl font-bold">${stats.totalPaid.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Payé</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-destructive" />
                <div className="text-xl font-bold">{stats.flaggedCount}</div>
                <div className="text-sm text-muted-foreground">Flagged</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              💡 1$ par annotation validée. Les annotations flagged sont vérifiées manuellement.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Task Queue */}
      {profile.is_qualified && !isSuspended && (
        <Card>
          <CardHeader>
            <CardTitle>Tâches assignées</CardTitle>
            <CardDescription>
              Vos tâches d'annotation en attente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnnotatorTaskQueue annotatorId={profile.id} expertId={expertId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
