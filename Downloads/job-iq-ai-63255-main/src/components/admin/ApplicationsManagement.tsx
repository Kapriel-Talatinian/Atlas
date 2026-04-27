import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, CheckCircle, XCircle, Clock, FileText, User, Briefcase, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Application {
  id: string;
  status: string;
  applied_at: string;
  notes: string | null;
  job_offer: { id: string; title: string; company_id: string } | null;
  expert: { id: string; full_name: string; email: string; title: string; primary_skills: string[] } | null;
  test_submission?: { test_score: number | null; final_score: number | null } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  applying: { label: "En cours", color: "bg-blue-100 text-blue-700", icon: Clock },
  test_pending: { label: "Test en attente", color: "bg-yellow-100 text-yellow-700", icon: FileText },
  test_passed: { label: "Test réussi", color: "bg-green-100 text-green-700", icon: CheckCircle },
  test_failed: { label: "Test échoué", color: "bg-red-100 text-red-700", icon: XCircle },
  interview: { label: "Entretien", color: "bg-purple-100 text-purple-700", icon: User },
  accepted: { label: "Accepté", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  rejected: { label: "Rejeté", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

const PAGE_SIZE = 50;

const ApplicationsManagement = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ["admin-applications", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("job_applications")
        .select(`id, status, applied_at, notes, job_offer:job_offers(id, title, company_id), expert:expert_profiles(id, full_name, email, title, primary_skills)`, { count: "exact" })
        .order("applied_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const expertIds = (data || []).map((app: any) => app.expert?.id).filter(Boolean);
      const { data: allScores } = expertIds.length > 0
        ? await supabase.from("test_submissions").select("expert_id, test_score, final_score").in("expert_id", expertIds).not("test_score", "is", null).order("submitted_at", { ascending: false })
        : { data: [] };

      const scoreMap = new Map<string, { test_score: number | null; final_score: number | null }>();
      (allScores || []).forEach((s: any) => {
        if (s.expert_id && !scoreMap.has(s.expert_id)) scoreMap.set(s.expert_id, { test_score: s.test_score, final_score: s.final_score });
      });

      return {
        applications: (data || []).map((app: any) => ({ ...app, test_submission: app.expert?.id ? scoreMap.get(app.expert.id) || null : null })) as Application[],
        totalCount: count || 0,
      };
    },
  });

  const applications = queryData?.applications || [];
  const totalCount = queryData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const updateApplicationStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("job_applications").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Statut mis à jour");
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch = app.expert?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.expert?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.job_offer?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-700", icon: Clock };
    const Icon = config.icon;
    return <Badge className={`${config.color} flex items-center gap-1`}><Icon className="h-3 w-3" />{config.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Gestion des Candidatures</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom, email ou poste..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrer par statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(statusConfig).map(([key, { label }]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-applications"] })}>Actualiser</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-blue-50 border-blue-200"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-700">{applications.filter(a => a.status === "applying").length}</p><p className="text-sm text-blue-600">En cours</p></CardContent></Card>
          <Card className="bg-green-50 border-green-200"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-700">{applications.filter(a => a.status === "test_passed").length}</p><p className="text-sm text-green-600">Tests réussis</p></CardContent></Card>
          <Card className="bg-purple-50 border-purple-200"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-purple-700">{applications.filter(a => a.status === "interview").length}</p><p className="text-sm text-purple-600">Entretiens</p></CardContent></Card>
          <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-700">{applications.filter(a => a.status === "accepted").length}</p><p className="text-sm text-emerald-600">Acceptés</p></CardContent></Card>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expert</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Score Test</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Chargement...</TableCell></TableRow>
              ) : filteredApplications.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune candidature trouvée</TableCell></TableRow>
              ) : (
                filteredApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{app.expert?.full_name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">{app.expert?.email}</p>
                        <p className="text-xs text-muted-foreground">{app.expert?.title}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <p className="font-medium truncate">{app.job_offer?.title || "N/A"}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {app.expert?.primary_skills?.slice(0, 3).map((skill) => (<Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.test_submission?.test_score ? (
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-primary" />
                          <span className={`font-bold ${app.test_submission.test_score >= 80 ? "text-green-600" : app.test_submission.test_score >= 60 ? "text-blue-600" : "text-red-600"}`}>
                            {app.test_submission.test_score}%
                          </span>
                        </div>
                      ) : (<span className="text-muted-foreground text-sm">Pas de test</span>)}
                    </TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                    <TableCell><span className="text-sm text-muted-foreground">{format(new Date(app.applied_at), "dd MMM yyyy", { locale: fr })}</span></TableCell>
                    <TableCell>
                      <Select value={app.status} onValueChange={(value) => updateApplicationStatus(app.id, value)}>
                        <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(statusConfig).map(([key, { label }]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page + 1} / {totalPages} ({totalCount} candidatures)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Suivant</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApplicationsManagement;