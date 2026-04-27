import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Search, MoreVertical, Pause, Play, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

async function adminAction(action: string, params: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action, ...params }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur");
  return json;
}

type ModalState =
  | { type: "pause"; project: any }
  | { type: "reactivate"; project: any }
  | { type: "delete"; project: any }
  | { type: "edit"; project: any }
  | null;

export function AdminProjectsPage() {
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [reason, setReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [editData, setEditData] = useState({ name: "", description: "" });
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["admin-projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("annotation_projects").select("*, clients(company_name)").order("created_at", { ascending: false });
      return data?.map(p => ({
        ...p,
        clientName: (p as any).clients?.company_name || "—",
      })) || [];
    },
    staleTime: 30_000,
  });

  const pauseMut = useMutation({
    mutationFn: (p: { id: string; reason: string }) => adminAction("pause_project", { project_id: p.id, reason: p.reason }),
    onSuccess: () => { toast.success("Projet mis en pause"); queryClient.invalidateQueries({ queryKey: ["admin-projects-list"] }); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => adminAction("reactivate_project", { project_id: id }),
    onSuccess: () => { toast.success("Projet réactivé"); queryClient.invalidateQueries({ queryKey: ["admin-projects-list"] }); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (p: { id: string; name: string }) => adminAction("delete_project", { project_id: p.id, confirmation_name: p.name }),
    onSuccess: () => { toast.success("Projet supprimé"); queryClient.invalidateQueries({ queryKey: ["admin-projects-list"] }); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (p: { id: string; updates: any }) => adminAction("update_project", { project_id: p.id, updates: p.updates }),
    onSuccess: () => { toast.success("Projet modifié"); queryClient.invalidateQueries({ queryKey: ["admin-projects-list"] }); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  if (selectedProject) {
    return <ProjectDetailView projectId={selectedProject} onBack={() => setSelectedProject(null)} />;
  }

  const filtered = projects?.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Projets</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} projet{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Rechercher par nom ou client" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">Projet</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Client</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Domaine</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Tâches</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="text-sm font-medium" onClick={() => setSelectedProject(p.id)}>{p.name}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground" onClick={() => setSelectedProject(p.id)}>{p.clientName}</TableCell>
                    <TableCell onClick={() => setSelectedProject(p.id)}><span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{p.domain}</span></TableCell>
                    <TableCell onClick={() => setSelectedProject(p.id)}>
                      <span className={cn("text-[11px] px-1.5 py-0.5 rounded",
                        p.status === "active" ? "bg-success/10 text-success" :
                        p.status === "paused" ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-muted text-muted-foreground"
                      )}>{p.status}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm" onClick={() => setSelectedProject(p.id)}>
                      {p.completed_tasks || 0}/{p.total_items || 0}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {p.status === "active" && (
                            <DropdownMenuItem onClick={() => { setReason(""); setModal({ type: "pause", project: p }); }}>
                              <Pause className="w-4 h-4 mr-2" /> Mettre en pause
                            </DropdownMenuItem>
                          )}
                          {p.status === "paused" && (
                            <DropdownMenuItem onClick={() => setModal({ type: "reactivate", project: p })}>
                              <Play className="w-4 h-4 mr-2" /> Réactiver
                            </DropdownMenuItem>
                          )}
                          {(p.status === "draft" || p.status === "paused") && (
                            <DropdownMenuItem onClick={() => { setEditData({ name: p.name, description: p.description || "" }); setModal({ type: "edit", project: p }); }}>
                              <Pencil className="w-4 h-4 mr-2" /> Modifier
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => { setConfirmName(""); setModal({ type: "delete", project: p }); }}>
                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      <Dialog open={modal?.type === "pause"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre en pause le projet ?</DialogTitle>
            <DialogDescription>L'annotation sera interrompue. Les tâches assignées seront libérées. Le client sera notifié.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Motif (min 20 caractères)" value={reason} onChange={e => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button className="bg-yellow-600 hover:bg-yellow-700" disabled={reason.length < 20 || pauseMut.isPending}
              onClick={() => pauseMut.mutate({ id: modal?.type === "pause" ? modal.project.id : "", reason })}>
              {pauseMut.isPending ? "..." : "Confirmer la pause"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Modal */}
      <Dialog open={modal?.type === "reactivate"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réactiver ce projet ?</DialogTitle>
            <DialogDescription>L'annotation reprendra et les tâches seront redistribuées.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button onClick={() => modal?.type === "reactivate" && reactivateMut.mutate(modal.project.id)} disabled={reactivateMut.isPending}>
              {reactivateMut.isPending ? "..." : "Réactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={modal?.type === "delete"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer définitivement ce projet ?</DialogTitle>
            <DialogDescription>Cette action est irréversible. Toutes les données seront supprimées.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            Si des paiements ont déjà été effectués, un remboursement devra être traité manuellement.
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tapez <span className="font-mono font-bold text-foreground">{modal?.type === "delete" ? modal.project.name : ""}</span> pour confirmer :</p>
            <Input value={confirmName} onChange={e => setConfirmName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="destructive"
              disabled={confirmName !== (modal?.type === "delete" ? modal.project.name : "") || deleteMut.isPending}
              onClick={() => modal?.type === "delete" && deleteMut.mutate({ id: modal.project.id, name: modal.project.name })}>
              {deleteMut.isPending ? "..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={modal?.type === "edit"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nom</label>
              <Input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea value={editData.description} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button disabled={!editData.name || updateMut.isPending}
              onClick={() => modal?.type === "edit" && updateMut.mutate({ id: modal.project.id, updates: editData })}>
              {updateMut.isPending ? "..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectDetailView({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-project-detail", projectId],
    queryFn: async () => {
      const { data: project } = await supabase.from("annotation_projects").select("*, clients(company_name)").eq("id", projectId).single();
      const { data: items } = await supabase.from("annotation_items").select("id, status").eq("project_id", projectId);
      const completed = items?.filter(i => i.status === "completed").length || 0;
      const total = items?.length || project?.total_items || 0;
      return { project, clientName: (project as any)?.clients?.company_name || "—", completed, total };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 rounded-xl" /></div>;
  if (!data?.project) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-foreground">{data.project.name}</h1>
          <p className="text-sm text-muted-foreground">{data.clientName} · {data.project.domain} · {data.project.type}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniKpi label="Complétés" value={`${data.completed}/${data.total}`} />
        <MiniKpi label="Statut" value={data.project.status} />
        <MiniKpi label="SLA" value={data.project.sla_tier || "standard"} />
        <MiniKpi label="Coût estimé" value={`${data.project.estimated_cost} USD`} />
      </div>
    </div>
  );
}

function MiniKpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card><CardContent className="p-4">
      <p className={cn("font-mono text-lg font-semibold", highlight ? "text-success" : "text-foreground")}>{value}</p>
      <p className="text-[12px] text-muted-foreground mt-1">{label}</p>
    </CardContent></Card>
  );
}
