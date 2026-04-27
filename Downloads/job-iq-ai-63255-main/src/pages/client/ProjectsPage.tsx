import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FolderOpen, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ClientDashboardLayout } from "@/components/layout/DashboardLayout";
import { ProjectDetailView } from "@/components/client/ProjectDetailView";
import { motion } from "framer-motion";

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  active: "Actif",
  in_progress: "En cours",
  completed: "Terminé",
  paused: "En pause",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  paused: "bg-muted text-muted-foreground",
};

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const { data: client } = useQuery({
    queryKey: ["client-record"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data } = await supabase.from("clients").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      return data?.[0] ?? null;
    },
  });

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ["client-projects", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotation_projects")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (selectedProject) {
    return (
      <ClientDashboardLayout userName={client?.company_name}>
        <ProjectDetailView
          projectId={selectedProject}
          onBack={() => setSelectedProject(null)}
        />
      </ClientDashboardLayout>
    );
  }

  return (
    <ClientDashboardLayout userName={client?.company_name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projets</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez vos projets d'annotation
            </p>
          </div>
          <Button onClick={() => navigate("/client/projects/new")} className="gap-2">
            <Plus className="w-4 h-4" /> Nouveau projet
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : !projects?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Aucun projet pour le moment</p>
              <Button onClick={() => navigate("/client/projects/new")} className="gap-2">
                <Plus className="w-4 h-4" /> Créer un projet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:border-primary/20 transition-colors"
                  onClick={() => setSelectedProject(project.id)}
                >
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-foreground">{project.name}</h3>
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${statusColors[project.status] || "bg-muted text-muted-foreground"}`}>
                          {statusLabels[project.status] || project.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {project.domain} · {project.type} · {project.total_items} tâches
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </ClientDashboardLayout>
  );
};

export default ProjectsPage;
