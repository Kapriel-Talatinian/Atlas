import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Search, Shield, Brain, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Expert {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  title: string;
  country: string;
  city: string;
  primary_skills: string[];
  daily_rate: number | null;
  years_of_experience: number;
  availability: string;
  onboarding_completed: boolean;
  profile_visible: boolean;
  created_at: string;
  test_score?: number | null;
}

const PAGE_SIZE = 50;

const ExpertsManagement = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expertToDelete, setExpertToDelete] = useState<Expert | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ["admin-experts", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const [{ data, error, count }, { data: allScores }] = await Promise.all([
        supabase
          .from("expert_profiles")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to),
        supabase
          .from("test_submissions")
          .select("expert_id, test_score")
          .not("test_score", "is", null)
          .order("submitted_at", { ascending: false }),
      ]);

      if (error) throw error;

      const scoreMap = new Map<string, number>();
      (allScores || []).forEach((s) => {
        if (s.expert_id && !scoreMap.has(s.expert_id)) {
          scoreMap.set(s.expert_id, s.test_score!);
        }
      });

      return {
        experts: (data || []).map((expert) => ({
          ...expert,
          test_score: scoreMap.get(expert.id) ?? null,
        })) as Expert[],
        totalCount: count || 0,
      };
    },
  });

  const experts = queryData?.experts || [];
  const totalCount = queryData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-experts"] });

  const toggleVisibility = async (expert: Expert) => {
    try {
      const { error } = await supabase
        .from("expert_profiles")
        .update({ profile_visible: !expert.profile_visible })
        .eq("id", expert.id);
      if (error) throw error;
      toast.success(expert.profile_visible ? "Profil masqué" : "Profil visible");
      invalidate();
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const openDeleteDialog = (expert: Expert) => {
    setExpertToDelete(expert);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!expertToDelete) return;
    setDeleting(true);
    try {
      await supabase.from("job_applications").delete().eq("expert_id", expertToDelete.id);
      await supabase.from("test_submissions").delete().eq("expert_id", expertToDelete.id);
      await supabase.from("timesheets").delete().eq("expert_id", expertToDelete.id);
      await supabase.from("expert_payouts").delete().eq("expert_id", expertToDelete.id);
      await supabase.from("expert_availability").delete().eq("expert_id", expertToDelete.id);
      await supabase.from("expert_referrals").delete().eq("referrer_id", expertToDelete.id);
      await supabase.from("annotator_profiles").delete().eq("expert_id", expertToDelete.id);
      await supabase.from("anonymized_candidates").delete().eq("expert_id", expertToDelete.id);
      await supabase.from("rlhf_feedback").delete().eq("expert_id", expertToDelete.id);

      const { error } = await supabase.from("expert_profiles").delete().eq("id", expertToDelete.id);
      if (error) throw error;

      toast.success(`Le compte de ${expertToDelete.full_name} a été supprimé`);
      setDeleteDialogOpen(false);
      setExpertToDelete(null);
      invalidate();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Erreur lors de la suppression du compte");
    } finally {
      setDeleting(false);
    }
  };

  const filteredExperts = experts.filter(
    (expert) =>
      expert.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expert.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expert.primary_skills.some((skill) => skill.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAvailabilityBadge = (availability: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      immediate: "default", "2_weeks": "secondary", "1_month": "outline", "2_months": "outline", not_available: "outline",
    };
    const labels: Record<string, string> = {
      immediate: "Immédiat", "2_weeks": "2 semaines", "1_month": "1 mois", "2_months": "2 mois", not_available: "Non disponible",
    };
    return <Badge variant={variants[availability] || "outline"}>{labels[availability] || availability}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Gestion des Experts ({experts.length})
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : filteredExperts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "Aucun expert trouvé" : "Aucun expert inscrit"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expert</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Compétences</TableHead>
                <TableHead>Score IA</TableHead>
                <TableHead>Expérience</TableHead>
                <TableHead>TJM</TableHead>
                <TableHead>Disponibilité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExperts.map((expert) => (
                <TableRow key={expert.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{expert.full_name}</p>
                      <p className="text-sm text-muted-foreground">{expert.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{expert.title}</TableCell>
                  <TableCell>{expert.city}, {expert.country}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-48">
                      {expert.primary_skills.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                      ))}
                      {expert.primary_skills.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{expert.primary_skills.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {expert.test_score !== null ? (
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${
                          expert.test_score >= 80 ? "text-green-600" :
                          expert.test_score >= 60 ? "text-blue-600" :
                          expert.test_score >= 40 ? "text-yellow-600" : "text-red-600"
                        }`}>{expert.test_score}/100</span>
                        {expert.test_score >= 80 && (
                          <Badge className="bg-green-500 text-white text-xs">
                            <Shield className="w-3 h-3 mr-1" />Vérifié
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs"><Brain className="w-3 h-3 mr-1" />Non testé</Badge>
                    )}
                  </TableCell>
                  <TableCell>{expert.years_of_experience} ans</TableCell>
                  <TableCell>{expert.daily_rate ? `${expert.daily_rate}€` : "-"}</TableCell>
                  <TableCell>{getAvailabilityBadge(expert.availability)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={expert.onboarding_completed ? "default" : "secondary"}>
                        {expert.onboarding_completed ? "Validé" : "En cours"}
                      </Badge>
                      {!expert.profile_visible && <Badge variant="outline">Masqué</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => toggleVisibility(expert)}>
                        {expert.profile_visible ? "Masquer" : "Afficher"}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog(expert)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-6 grid grid-cols-5 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold">{experts.length}</p>
            <p className="text-sm text-muted-foreground">Total experts</p>
          </div>
          <div className="text-center p-4 bg-green-500/10 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{experts.filter((e) => e.onboarding_completed).length}</p>
            <p className="text-sm text-muted-foreground">Profils validés</p>
          </div>
          <div className="text-center p-4 bg-emerald-500/10 rounded-lg">
            <p className="text-2xl font-bold text-emerald-600">{experts.filter((e) => e.test_score && e.test_score >= 80).length}</p>
            <p className="text-sm text-muted-foreground">Vérifiés IA</p>
          </div>
          <div className="text-center p-4 bg-blue-500/10 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{experts.filter((e) => e.availability === "immediate").length}</p>
            <p className="text-sm text-muted-foreground">Disponibles</p>
          </div>
          <div className="text-center p-4 bg-purple-500/10 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{experts.filter((e) => e.profile_visible).length}</p>
            <p className="text-sm text-muted-foreground">Profils visibles</p>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page + 1} / {totalPages} ({totalCount} experts)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Suivant</Button>
            </div>
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />Supprimer ce compte ?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>Vous êtes sur le point de supprimer le compte de <strong>{expertToDelete?.full_name}</strong> ({expertToDelete?.email}).</p>
                <p>Cette action est <strong>irréversible</strong> et supprimera :</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Le profil expert et toutes ses informations</li>
                  <li>Toutes les candidatures en cours</li>
                  <li>L'historique des tests et évaluations</li>
                  <li>Les timesheets et paiements associés</li>
                  <li>Les données d'annotation RLHF</li>
                </ul>
                <p className="text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  ⚠️ Les données seront supprimées immédiatement de la base de données.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Suppression...</>) : "Supprimer le compte"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default ExpertsManagement;