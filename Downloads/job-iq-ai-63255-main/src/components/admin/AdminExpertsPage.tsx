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
import { ArrowLeft, Search, MoreVertical, Ban, ShieldCheck, Trash2, RefreshCw } from "lucide-react";
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
  | { type: "ban"; expert: any }
  | { type: "lift"; expert: any }
  | { type: "delete"; expert: any }
  | { type: "reassign"; expert: any }
  | { type: "suspend"; expert: any }
  | null;

export function AdminExpertsPage() {
  const [search, setSearch] = useState("");
  const [selectedExpert, setSelectedExpert] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [suspendDays, setSuspendDays] = useState("7");
  const queryClient = useQueryClient();

  const { data: experts, isLoading } = useQuery({
    queryKey: ["admin-experts-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("annotator_profiles")
        .select("id, anonymized_id, country, seniority, tier, is_active, is_qualified, overall_accuracy, total_annotations, languages, suspended_until, suspension_reason, expert_id")
        .order("created_at", { ascending: false }).limit(200);

      const expertIds = data?.filter(a => a.expert_id).map(a => a.expert_id!) || [];
      let nameMap: Record<string, { name: string; email: string }> = {};
      if (expertIds.length > 0) {
        const { data: profiles } = await supabase.from("expert_profiles").select("id, full_name, email").in("id", expertIds);
        profiles?.forEach(p => { nameMap[p.id] = { name: p.full_name || "", email: p.email || "" }; });
      }

      const { data: certs } = await supabase.from("annotator_domain_certifications").select("expert_id, domain, tier, status").eq("status", "active");

      // Count actual tasks per annotator from annotation_tasks
      const annotatorIds = data?.map(a => a.id) || [];
      const { data: taskCounts } = await supabase.from("annotation_tasks").select("assigned_annotator_id").in("assigned_annotator_id", annotatorIds);
      const taskCountMap: Record<string, number> = {};
      taskCounts?.forEach(t => {
        if (t.assigned_annotator_id) {
          taskCountMap[t.assigned_annotator_id] = (taskCountMap[t.assigned_annotator_id] || 0) + 1;
        }
      });

      return data?.map(a => ({
        ...a,
        actualTaskCount: taskCountMap[a.id] || a.total_annotations || 0,
        name: a.expert_id ? nameMap[a.expert_id]?.name || a.anonymized_id : a.anonymized_id,
        email: a.expert_id ? nameMap[a.expert_id]?.email || "" : "",
        domains: certs?.filter(c => c.expert_id === a.id).map(c => c.domain) || [],
        isSuspended: a.suspended_until ? new Date(a.suspended_until) > new Date() : false,
        isBanned: !a.is_active && !a.suspended_until && a.suspension_reason,
      })) || [];
    },
    staleTime: 30_000,
  });

  const banMut = useMutation({
    mutationFn: (p: { id: string; reason: string }) => adminAction("ban_expert", { expert_id: p.id, reason: p.reason }),
    onSuccess: () => { toast.success("Expert banni"); queryClient.invalidateQueries({ queryKey: ["admin-experts-list"] }); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const liftMut = useMutation({
    mutationFn: (id: string) => adminAction("lift_suspension", { expert_id: id }),
    onSuccess: () => { toast.success("Suspension levée"); queryClient.invalidateQueries({ queryKey: ["admin-experts-list"] }); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (p: { id: string; email: string }) => adminAction("delete_expert", { expert_id: p.id, confirmation_email: p.email }),
    onSuccess: () => { toast.success("Expert supprimé"); queryClient.invalidateQueries({ queryKey: ["admin-experts-list"] }); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const reassignMut = useMutation({
    mutationFn: (id: string) => adminAction("reassign_expert_tasks", { expert_id: id }),
    onSuccess: () => { toast.success("Tâches réassignées"); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const suspendMut = useMutation({
    mutationFn: (p: { id: string; days: number; reason: string }) => adminAction("suspend_expert", { expert_id: p.id, duration_days: p.days, reason: p.reason }),
    onSuccess: () => { toast.success("Expert suspendu"); queryClient.invalidateQueries({ queryKey: ["admin-experts-list"] }); setModal(null); },
    onError: (e: any) => toast.error(e.message),
  });

  if (selectedExpert) {
    return <ExpertDetailView expertId={selectedExpert} onBack={() => setSelectedExpert(null)} />;
  }

  const filtered = experts?.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Experts</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} expert{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Rechercher par nom ou email" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">Nom</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Domaines</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Tâches</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Alpha</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => setSelectedExpert(e.id)}>
                      <p className="text-sm font-medium">{e.name}</p>
                      <p className="text-[12px] text-muted-foreground">{e.email}</p>
                    </TableCell>
                    <TableCell onClick={() => setSelectedExpert(e.id)}>
                      <div className="flex gap-1 flex-wrap">
                        {e.domains.length > 0 ? e.domains.map((d: string) => (
                          <span key={d} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{d}</span>
                        )) : <span className="text-[12px] text-muted-foreground">Aucun</span>}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedExpert(e.id)}>
                      {e.isBanned ? (
                        <span className="text-[12px] text-destructive font-medium">Banni</span>
                      ) : e.isSuspended ? (
                        <span className="text-[12px] text-yellow-500 font-medium">Suspendu</span>
                      ) : e.is_qualified ? (
                        <span className="text-[12px] text-success font-medium">Certifié</span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">En attente</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm" onClick={() => setSelectedExpert(e.id)}>{e.actualTaskCount || 0}</TableCell>
                    <TableCell className="text-right font-mono text-sm" onClick={() => setSelectedExpert(e.id)}>
                      {e.overall_accuracy?.toFixed(2) || "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!e.isBanned && !e.isSuspended && (
                            <DropdownMenuItem onClick={() => { setReason(""); setSuspendDays("7"); setModal({ type: "suspend", expert: e }); }}>
                              <Ban className="w-4 h-4 mr-2" /> Suspendre
                            </DropdownMenuItem>
                          )}
                          {(e.isSuspended && !e.isBanned) && (
                            <DropdownMenuItem onClick={() => setModal({ type: "lift", expert: e })}>
                              <ShieldCheck className="w-4 h-4 mr-2" /> Lever la suspension
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setModal({ type: "reassign", expert: e })}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Réassigner les tâches
                          </DropdownMenuItem>
                          {!e.isBanned && (
                            <DropdownMenuItem className="text-destructive" onClick={() => { setReason(""); setConfirmText(""); setModal({ type: "ban", expert: e }); }}>
                              <Ban className="w-4 h-4 mr-2" /> Bannir
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => { setConfirmText(""); setModal({ type: "delete", expert: e }); }}>
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

      {/* Suspend Modal */}
      <Dialog open={modal?.type === "suspend"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspendre cet expert ?</DialogTitle>
            <DialogDescription>L'expert ne pourra pas annoter pendant la durée de la suspension.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Durée (jours)</label>
              <Input type="number" value={suspendDays} onChange={e => setSuspendDays(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Motif</label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif de la suspension..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button className="bg-yellow-600 hover:bg-yellow-700" disabled={!reason || suspendMut.isPending}
              onClick={() => modal?.type === "suspend" && suspendMut.mutate({ id: modal.expert.id, days: parseInt(suspendDays), reason })}>
              {suspendMut.isPending ? "..." : "Suspendre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Modal */}
      <Dialog open={modal?.type === "ban"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bannir définitivement cet expert ?</DialogTitle>
            <DialogDescription>L'expert ne pourra plus se connecter, annoter, ni recevoir de paiements. Cette action est permanente.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif du bannissement..." />
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tapez <span className="font-mono font-bold text-foreground">BANNIR</span> pour confirmer :</p>
            <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="destructive" disabled={confirmText !== "BANNIR" || !reason || banMut.isPending}
              onClick={() => modal?.type === "ban" && banMut.mutate({ id: modal.expert.id, reason })}>
              {banMut.isPending ? "..." : "Bannir définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lift Suspension Modal */}
      <Dialog open={modal?.type === "lift"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lever la suspension ?</DialogTitle>
            <DialogDescription>L'expert pourra immédiatement accéder aux tâches.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button onClick={() => modal?.type === "lift" && liftMut.mutate(modal.expert.id)} disabled={liftMut.isPending}>
              {liftMut.isPending ? "..." : "Lever la suspension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Modal */}
      <Dialog open={modal?.type === "reassign"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réassigner toutes les tâches ?</DialogTitle>
            <DialogDescription>Toutes les tâches assignées à cet expert seront libérées et redistribuées.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button onClick={() => modal?.type === "reassign" && reassignMut.mutate(modal.expert.id)} disabled={reassignMut.isPending}>
              {reassignMut.isPending ? "..." : "Réassigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={modal?.type === "delete"} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce compte expert ?</DialogTitle>
            <DialogDescription>Cette action est irréversible. Les annotations seront anonymisées mais conservées.</DialogDescription>
          </DialogHeader>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tapez l'email de l'expert pour confirmer :</p>
            <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={modal?.type === "delete" ? modal.expert.email : ""} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="destructive"
              disabled={confirmText !== (modal?.type === "delete" ? modal.expert.email : "") || deleteMut.isPending}
              onClick={() => modal?.type === "delete" && deleteMut.mutate({ id: modal.expert.id, email: modal.expert.email })}>
              {deleteMut.isPending ? "..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpertDetailView({ expertId, onBack }: { expertId: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-expert-detail", expertId],
    queryFn: async () => {
      const { data: profile } = await supabase.from("annotator_profiles").select("*").eq("id", expertId).single();
      let name = profile?.anonymized_id || expertId;
      let email = "";
      if (profile?.expert_id) {
        const { data: ep } = await supabase.from("expert_profiles").select("full_name, email").eq("id", profile.expert_id).single();
        name = ep?.full_name || name;
        email = ep?.email || "";
      }
      const { data: certs } = await supabase.from("annotator_domain_certifications").select("domain, tier, status, score").eq("expert_id", expertId).eq("status", "active");
      const { data: recentTasks } = await supabase.from("annotation_tasks").select("id, domain, source_type, status, completed_at").eq("assigned_annotator_id", expertId).order("created_at", { ascending: false }).limit(20);
      return { profile, name, email, certs: certs || [], recentTasks: recentTasks || [] };
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-foreground">{data.name}</h1>
          <p className="text-sm text-muted-foreground">{data.email}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniKpi label="Tâches" value={String(data.profile?.total_annotations || 0)} />
        <MiniKpi label="Alpha" value={data.profile?.overall_accuracy?.toFixed(3) || "—"} />
        <MiniKpi label="Trust Score" value={String(data.profile?.trust_score || 0)} />
        <MiniKpi label="Tier" value={data.profile?.tier || "—"} />
      </div>
      {data.certs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {data.certs.map((c: any) => (
            <span key={c.domain} className="px-3 py-1 rounded-lg bg-success/10 text-success text-sm font-medium">{c.domain} ({c.tier})</span>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="font-mono text-lg font-semibold text-foreground">{value}</p>
      <p className="text-[12px] text-muted-foreground mt-1">{label}</p>
    </CardContent></Card>
  );
}
