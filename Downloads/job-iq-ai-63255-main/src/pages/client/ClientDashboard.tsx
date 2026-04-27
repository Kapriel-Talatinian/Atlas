import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, FileText, ArrowRight, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ClientDashboardLayout } from "@/components/layout/DashboardLayout";
import { CreateProjectDialog } from "@/components/client/CreateProjectDialog";
import { ProjectCard } from "@/components/client/ProjectCard";
import { ProjectDetailView } from "@/components/client/ProjectDetailView";
import { motion } from "framer-motion";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client-record"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: rows } = await supabase.from("clients").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      if (rows && rows.length > 0) return rows[0];

      const { data: profile } = await supabase.from("profiles").select("full_name, email, company_name").eq("user_id", user.id).single();
      const { data: created, error } = await supabase.from("clients").insert({
        user_id: user.id,
        company_name: profile?.company_name || "Mon Entreprise",
        contact_name: profile?.full_name || "Contact",
        contact_email: profile?.email || user.email || "",
      }).select("*").single();
      if (error) throw error;
      return created;
    },
  });

  const { data: projects, refetch: refetchProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ["client-projects", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("annotation_projects").select("*").eq("client_id", client!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allItemStats } = useQuery({
    queryKey: ["client-all-item-stats", projects?.map(p => p.id)],
    enabled: !!projects?.length,
    queryFn: async () => {
      const projectIds = projects!.map(p => p.id);
      const { data, error, count } = await supabase.from("annotation_items").select("project_id, status", { count: "exact" }).in("project_id", projectIds);
      if (error) throw error;
      // If we hit the 1000-row limit, fetch counts per project individually
      const allData = data || [];
      if (count && count > 1000) {
        // Use individual count queries for accuracy
        const statsMap: Record<string, { completed: number; inProgress: number; queued: number }> = {};
        await Promise.all(projectIds.map(async (id) => {
          const [qRes, cRes, pRes] = await Promise.all([
            supabase.from("annotation_items").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "queued"),
            supabase.from("annotation_items").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "completed"),
            supabase.from("annotation_items").select("id", { count: "exact", head: true }).eq("project_id", id).in("status", ["assigned", "in_progress", "in_review", "submitted"]),
          ]);
          statsMap[id] = {
            queued: qRes.count || 0,
            completed: cRes.count || 0,
            inProgress: pRes.count || 0,
          };
        }));
        return statsMap;
      }
      const statsMap: Record<string, { completed: number; inProgress: number; queued: number }> = {};
      projectIds.forEach(id => { statsMap[id] = { completed: 0, inProgress: 0, queued: 0 }; });
      allData.forEach(item => {
        const s = statsMap[item.project_id];
        if (!s) return;
        if (item.status === "completed") s.completed++;
        else if (item.status === "queued") s.queued++;
        else if (item.status === "assigned" || item.status === "in_progress" || item.status === "in_review" || item.status === "submitted") s.inProgress++;
        else s.queued++;
      });
      return statsMap;
    },
  });

  if (clientLoading) {
    return (
      <ClientDashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </div>
      </ClientDashboardLayout>
    );
  }

  if (selectedProject) {
    return (
      <ClientDashboardLayout userName={client?.company_name}>
        <ProjectDetailView projectId={selectedProject} onBack={() => setSelectedProject(null)} />
      </ClientDashboardLayout>
    );
  }

  const totalItems = projects?.reduce((s, p) => s + p.total_items, 0) || 0;
  const totalCompleted = allItemStats ? Object.values(allItemStats).reduce((s, v) => s + v.completed, 0) : 0;
  const activeProjects = projects?.filter(p => p.status === "active" || p.status === "pilot").length || 0;

  return (
    <ClientDashboardLayout userName={client?.company_name}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground">Tableau de bord</h1>
            <p className="text-muted-foreground text-sm mt-1">{client?.company_name}</p>
          </div>
          <Button onClick={() => navigate("/client/projects/new")} className="gap-2">
            <Plus className="w-4 h-4" /> Nouveau projet
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Projets" value={String(projects?.length || 0)} />
          <KpiCard label="Actifs" value={String(activeProjects)} highlight />
          <KpiCard label="Items totaux" value={totalItems.toLocaleString()} />
          <KpiCard label="Complétés" value={totalCompleted.toLocaleString()} highlight />
        </div>

        {/* Projects */}
        <div>
          <p className="text-[13px] font-medium text-muted-foreground mb-4">Projets</p>
          {projectsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : projects?.length ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project, i) => (
                <motion.div key={project.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}>
                  <ProjectCard
                    project={project}
                    stats={allItemStats?.[project.id] || { completed: 0, inProgress: 0, queued: 0 }}
                    onRefresh={() => refetchProjects()}
                    onSelect={setSelectedProject}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border p-12 text-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">Aucun projet</p>
              <p className="text-sm text-muted-foreground mb-6">Créez votre premier projet d'annotation RLHF</p>
              <Button onClick={() => navigate("/client/projects/new")} className="gap-2">
                <Plus className="w-4 h-4" /> Nouveau projet
              </Button>
            </div>
          )}
        </div>
      </div>
    </ClientDashboardLayout>
  );
};

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className={`font-mono text-2xl font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
        <p className="text-[12px] text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

export default ClientDashboard;
