import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  MessageSquare,
  RefreshCw,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Scale
} from "lucide-react";

interface Disagreement {
  id: string;
  feedback_id: string;
  tier_1: string;
  tier_2: string;
  disagreement_type: string;
  severity: string;
  description: string;
  senior_resolution: string | null;
  senior_annotator_id: string | null;
  resolved_rating: string | null;
  resolved_at: string | null;
  resolution_rationale: string | null;
  is_resolved: boolean;
  created_at: string;
}

const SEVERITY_CONFIG = {
  minor: { color: "bg-blue-500", label: "Mineur" },
  moderate: { color: "bg-yellow-500", label: "Modéré" },
  major: { color: "bg-orange-500", label: "Majeur" },
  critical: { color: "bg-red-500", label: "Critique" }
};

const DISAGREEMENT_TYPES = [
  { value: "rating", label: "Désaccord sur le rating global" },
  { value: "score", label: "Écart significatif sur les scores" },
  { value: "issues", label: "Problèmes détectés différents" },
  { value: "methodology", label: "Approche méthodologique" },
  { value: "other", label: "Autre" }
];

export function RLHFDisagreementCapture() {
  const [disagreements, setDisagreements] = useState<Disagreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDisagreement, setSelectedDisagreement] = useState<Disagreement | null>(null);
  const [resolving, setResolving] = useState(false);
  
  // Resolution form state
  const [resolution, setResolution] = useState("");
  const [resolvedRating, setResolvedRating] = useState<string>("");
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    loadDisagreements();
  }, []);

  async function loadDisagreements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rlhf_disagreements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDisagreements(data as Disagreement[] || []);
    } catch (error) {
      console.error("Error loading disagreements:", error);
      toast.error("Erreur lors du chargement des désaccords");
    } finally {
      setLoading(false);
    }
  }

  async function resolveDisagreement() {
    if (!selectedDisagreement || !resolution || !resolvedRating) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setResolving(true);
    try {
      const { error } = await supabase
        .from("rlhf_disagreements")
        .update({
          senior_resolution: resolution,
          resolved_rating: resolvedRating,
          resolution_rationale: rationale,
          resolved_at: new Date().toISOString(),
          is_resolved: true,
          senior_annotator_id: "admin_resolver" // Would be actual admin ID in production
        })
        .eq("id", selectedDisagreement.id);

      if (error) throw error;

      toast.success("Désaccord résolu avec succès");
      setSelectedDisagreement(null);
      setResolution("");
      setResolvedRating("");
      setRationale("");
      loadDisagreements();
    } catch (error) {
      console.error("Error resolving disagreement:", error);
      toast.error("Erreur lors de la résolution");
    } finally {
      setResolving(false);
    }
  }

  const pendingCount = disagreements.filter(d => !d.is_resolved).length;
  const resolvedCount = disagreements.filter(d => d.is_resolved).length;
  const criticalCount = disagreements.filter(d => !d.is_resolved && d.severity === 'critical').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resolvedCount}</p>
                <p className="text-sm text-muted-foreground">Résolus</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
                <p className="text-sm text-muted-foreground">Critiques</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disagreements.length > 0 
                    ? ((resolvedCount / disagreements.length) * 100).toFixed(0) 
                    : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Taux résolution</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* High Value Signal Banner */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Crown className="h-6 w-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Signal Haute Valeur</h3>
              <p className="text-sm text-muted-foreground">
                Les désaccords entre annotateurs sont un signal RLHF premium. Chaque désaccord résolu 
                par un Senior crée une donnée d'entraînement de très haute qualité pour l'alignement IA.
                <br/>
                <span className="text-amber-600 font-medium">Valeur estimée: $25-40 par désaccord résolu</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disagreements Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Désaccords Inter-Tiers
            </CardTitle>
            <CardDescription>
              Conflits d'évaluation entre annotateurs de différents niveaux
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadDisagreements}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent>
          {disagreements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun désaccord enregistré</p>
              <p className="text-sm">Les désaccords seront créés automatiquement lors des annotations multi-tier</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>Sévérité</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disagreements.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="font-medium">
                        {DISAGREEMENT_TYPES.find(t => t.value === d.disagreement_type)?.label || d.disagreement_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{d.tier_1}</Badge>
                        <span className="text-muted-foreground">vs</span>
                        <Badge variant="outline">{d.tier_2}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={SEVERITY_CONFIG[d.severity as keyof typeof SEVERITY_CONFIG]?.color || 'bg-gray-500'}>
                        {SEVERITY_CONFIG[d.severity as keyof typeof SEVERITY_CONFIG]?.label || d.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      {d.is_resolved ? (
                        <Badge className="bg-green-500">Résolu</Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          En attente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={d.is_resolved ? "ghost" : "default"}
                        onClick={() => setSelectedDisagreement(d)}
                      >
                        {d.is_resolved ? "Voir" : "Résoudre"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      <Dialog open={!!selectedDisagreement} onOpenChange={() => setSelectedDisagreement(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              {selectedDisagreement?.is_resolved ? "Détails Résolution" : "Résolution Senior"}
            </DialogTitle>
          </DialogHeader>

          {selectedDisagreement && (
            <div className="space-y-6">
              {/* Disagreement Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Type de désaccord</p>
                  <p className="font-medium">
                    {DISAGREEMENT_TYPES.find(t => t.value === selectedDisagreement.disagreement_type)?.label}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sévérité</p>
                  <Badge className={SEVERITY_CONFIG[selectedDisagreement.severity as keyof typeof SEVERITY_CONFIG]?.color}>
                    {SEVERITY_CONFIG[selectedDisagreement.severity as keyof typeof SEVERITY_CONFIG]?.label}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{selectedDisagreement.description || "Pas de description"}</p>
                </div>
              </div>

              {selectedDisagreement.is_resolved ? (
                /* View resolved */
                <div className="space-y-4">
                  <div>
                    <Label>Résolution Senior</Label>
                    <p className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                      {selectedDisagreement.senior_resolution}
                    </p>
                  </div>
                  <div>
                    <Label>Rating Final</Label>
                    <div className="flex gap-2 mt-2">
                      <Badge className={
                        selectedDisagreement.resolved_rating === 'up' ? 'bg-green-500' :
                        selectedDisagreement.resolved_rating === 'down' ? 'bg-red-500' : 'bg-gray-500'
                      }>
                        {selectedDisagreement.resolved_rating === 'up' && <ThumbsUp className="h-4 w-4 mr-1" />}
                        {selectedDisagreement.resolved_rating === 'down' && <ThumbsDown className="h-4 w-4 mr-1" />}
                        {selectedDisagreement.resolved_rating === 'neutral' && <Minus className="h-4 w-4 mr-1" />}
                        {selectedDisagreement.resolved_rating}
                      </Badge>
                    </div>
                  </div>
                  {selectedDisagreement.resolution_rationale && (
                    <div>
                      <Label>Justification</Label>
                      <p className="p-3 bg-muted rounded-lg">{selectedDisagreement.resolution_rationale}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Resolution form */
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="resolution">Résolution Senior *</Label>
                    <Textarea
                      id="resolution"
                      placeholder="Décrivez la résolution du désaccord..."
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Rating Final *</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant={resolvedRating === 'up' ? 'default' : 'outline'}
                        className={resolvedRating === 'up' ? 'bg-green-500 hover:bg-green-600' : ''}
                        onClick={() => setResolvedRating('up')}
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Positif
                      </Button>
                      <Button
                        type="button"
                        variant={resolvedRating === 'neutral' ? 'default' : 'outline'}
                        onClick={() => setResolvedRating('neutral')}
                      >
                        <Minus className="h-4 w-4 mr-2" />
                        Neutre
                      </Button>
                      <Button
                        type="button"
                        variant={resolvedRating === 'down' ? 'default' : 'outline'}
                        className={resolvedRating === 'down' ? 'bg-red-500 hover:bg-red-600' : ''}
                        onClick={() => setResolvedRating('down')}
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Négatif
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="rationale">Justification (optionnel)</Label>
                    <Textarea
                      id="rationale"
                      placeholder="Expliquez votre raisonnement..."
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDisagreement(null)}>
              Fermer
            </Button>
            {selectedDisagreement && !selectedDisagreement.is_resolved && (
              <Button onClick={resolveDisagreement} disabled={resolving}>
                {resolving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Résoudre le désaccord
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
