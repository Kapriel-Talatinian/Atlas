import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  GraduationCap,
  UserCheck,
  Crown,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TierStats {
  student: { total: number; active: number; avgReliability: number };
  expert: { total: number; active: number; avgReliability: number };
  senior: { total: number; active: number; avgReliability: number };
}

interface FeedbackWithTiers {
  id: string;
  job_role: string;
  job_level_targeted: string;
  created_at: string;
  qa_status: string;
  tier_complete: any;
  annotator_id: string;
  overall_rating: string;
}

const TIER_CONFIG = {
  student: { 
    label: "Student", 
    icon: GraduationCap, 
    color: "bg-blue-500", 
    textColor: "text-blue-500",
    description: "Junior signal, learning annotations"
  },
  expert: { 
    label: "Expert", 
    icon: UserCheck, 
    color: "bg-purple-500", 
    textColor: "text-purple-500",
    description: "Correctness & methodology validation"
  },
  senior: { 
    label: "Senior", 
    icon: Crown, 
    color: "bg-amber-500", 
    textColor: "text-amber-500",
    description: "Optimization, trade-offs, final authority"
  }
};

export function RLHFMultiTierManager() {
  const [tierStats, setTierStats] = useState<TierStats>({
    student: { total: 0, active: 0, avgReliability: 0 },
    expert: { total: 0, active: 0, avgReliability: 0 },
    senior: { total: 0, active: 0, avgReliability: 0 }
  });
  const [feedbacks, setFeedbacks] = useState<FeedbackWithTiers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackWithTiers | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [annotatorRes, feedbackRes] = await Promise.all([
        supabase.from("annotator_profiles").select("*"),
        supabase.from("rlhf_feedback").select("*").order("created_at", { ascending: false }).limit(100)
      ]);

      if (annotatorRes.error) throw annotatorRes.error;
      if (feedbackRes.error) throw feedbackRes.error;

      const annotators = annotatorRes.data || [];
      
      // Calculate tier stats
      const stats: TierStats = {
        student: { total: 0, active: 0, avgReliability: 0 },
        expert: { total: 0, active: 0, avgReliability: 0 },
        senior: { total: 0, active: 0, avgReliability: 0 }
      };

      annotators.forEach((a: any) => {
        const tier = a.tier || 'expert';
        if (stats[tier as keyof TierStats]) {
          stats[tier as keyof TierStats].total++;
          if (a.is_active !== false) {
            stats[tier as keyof TierStats].active++;
          }
          stats[tier as keyof TierStats].avgReliability += (a.reliability_score || 1);
        }
      });

      // Calculate averages
      Object.keys(stats).forEach(tier => {
        const t = tier as keyof TierStats;
        if (stats[t].total > 0) {
          stats[t].avgReliability = stats[t].avgReliability / stats[t].total;
        }
      });

      setTierStats(stats);
      setFeedbacks(feedbackRes.data as FeedbackWithTiers[]);
    } catch (error) {
      console.error("Error loading tier data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  async function assignToTier(feedbackId: string, tier: 'student' | 'expert' | 'senior') {
    setAssigning(true);
    try {
      // Find available annotator of the specified tier
      const { data: annotators, error } = await supabase
        .from("annotator_profiles")
        .select("*")
        .eq("tier", tier)
        .eq("is_active", true)
        .order("reliability_score", { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!annotators || annotators.length === 0) {
        toast.error(`Aucun annotateur ${tier} disponible`);
        return;
      }

      // Random selection among top 5
      const selected = annotators[Math.floor(Math.random() * annotators.length)];

      // Create tier annotation entry
      const { error: insertError } = await supabase
        .from("rlhf_tier_annotations")
        .insert({
          feedback_id: feedbackId,
          annotator_id: selected.anonymized_id,
          tier: tier,
          scores: {},
          overall_rating: 'neutral'
        });

      if (insertError) throw insertError;

      // Update tier_complete on feedback
      const feedback = feedbacks.find(f => f.id === feedbackId);
      const currentTiers = feedback?.tier_complete || { student: false, expert: false, senior: false };
      
      await supabase
        .from("rlhf_feedback")
        .update({
          tier_complete: { ...currentTiers, [tier]: true }
        })
        .eq("id", feedbackId);

      toast.success(`Assigné à ${selected.anonymized_id} (${tier})`);
      loadData();
    } catch (error: any) {
      console.error("Error assigning tier:", error);
      toast.error("Erreur lors de l'assignation");
    } finally {
      setAssigning(false);
    }
  }

  function getTierCompletionBadge(tierComplete: any) {
    if (!tierComplete) return <Badge variant="outline">Non assigné</Badge>;
    
    const completed = [
      tierComplete.student && 'S',
      tierComplete.expert && 'E', 
      tierComplete.senior && 'Sr'
    ].filter(Boolean);

    if (completed.length === 0) return <Badge variant="outline">0/3</Badge>;
    if (completed.length === 3) return <Badge className="bg-green-500">{completed.join(' → ')}</Badge>;
    return <Badge variant="secondary">{completed.join(' → ')}</Badge>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tier Overview Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {(Object.keys(TIER_CONFIG) as Array<keyof typeof TIER_CONFIG>).map((tier) => {
          const config = TIER_CONFIG[tier];
          const stats = tierStats[tier];
          return (
            <Card key={tier} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${config.color}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <config.icon className={`h-5 w-5 ${config.textColor}`} />
                    <CardTitle className="text-lg">{config.label}</CardTitle>
                  </div>
                  <Badge variant="outline">{stats.active} actifs</Badge>
                </div>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Total annotateurs</span>
                  <span className="font-bold">{stats.total}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Fiabilité moyenne</span>
                    <span className="font-bold">{(stats.avgReliability * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={stats.avgReliability * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Multi-Tier Workflow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Workflow Multi-Tier
          </CardTitle>
          <CardDescription>
            Chaque test passe par Student → Expert → Senior pour maximiser la qualité des données
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                <GraduationCap className="h-8 w-8 text-blue-500" />
              </div>
              <p className="font-medium">Student</p>
              <p className="text-xs text-muted-foreground">Signal junior</p>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                <UserCheck className="h-8 w-8 text-purple-500" />
              </div>
              <p className="font-medium">Expert</p>
              <p className="text-xs text-muted-foreground">Validation</p>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
                <Crown className="h-8 w-8 text-amber-500" />
              </div>
              <p className="font-medium">Senior</p>
              <p className="text-xs text-muted-foreground">Résolution finale</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Assignations Multi-Tier</CardTitle>
            <CardDescription>Gérer les annotations par niveau d'expertise</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Role</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Tiers Complétés</TableHead>
                <TableHead>Statut QA</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedbacks.slice(0, 20).map((feedback) => (
                <TableRow key={feedback.id}>
                  <TableCell className="font-medium">{feedback.job_role}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{feedback.job_level_targeted}</Badge>
                  </TableCell>
                  <TableCell>{getTierCompletionBadge(feedback.tier_complete)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={feedback.qa_status === 'validated' ? 'default' : 'secondary'}
                      className={feedback.qa_status === 'validated' ? 'bg-green-500' : ''}
                    >
                      {feedback.qa_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {!feedback.tier_complete?.student && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => assignToTier(feedback.id, 'student')}
                          disabled={assigning}
                          className="h-8 px-2"
                        >
                          <GraduationCap className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
                      {!feedback.tier_complete?.expert && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => assignToTier(feedback.id, 'expert')}
                          disabled={assigning}
                          className="h-8 px-2"
                        >
                          <UserCheck className="h-4 w-4 text-purple-500" />
                        </Button>
                      )}
                      {!feedback.tier_complete?.senior && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => assignToTier(feedback.id, 'senior')}
                          disabled={assigning}
                          className="h-8 px-2"
                        >
                          <Crown className="h-4 w-4 text-amber-500" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setSelectedFeedback(feedback)}
                        className="h-8 px-2"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails Feedback Multi-Tier</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Job Role</p>
                  <p className="font-medium">{selectedFeedback.job_role}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Niveau ciblé</p>
                  <p className="font-medium">{selectedFeedback.job_level_targeted}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Progression Tiers</p>
                <div className="flex gap-2">
                  {(['student', 'expert', 'senior'] as const).map(tier => {
                    const config = TIER_CONFIG[tier];
                    const complete = selectedFeedback.tier_complete?.[tier];
                    return (
                      <div 
                        key={tier}
                        className={`flex-1 p-3 rounded-lg border ${complete ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}
                      >
                        <div className="flex items-center gap-2">
                          <config.icon className={`h-4 w-4 ${complete ? 'text-green-500' : config.textColor}`} />
                          <span className="font-medium">{config.label}</span>
                          {complete && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
