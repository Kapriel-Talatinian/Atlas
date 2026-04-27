import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

async function adminAction(action: string, payload: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Non authentifié");
  const res = await supabase.functions.invoke("admin-api", {
    body: { action, ...payload },
  });
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function AdminClientsPage() {
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      const clientIds = data?.map(c => c.id) || [];
      const { data: projects } = await supabase.from("annotation_projects").select("id, client_id, status, total_items").in("client_id", clientIds);
      const projectIds = projects?.map(p => p.id) || [];
      const { data: payments } = projectIds.length > 0
        ? await supabase.from("project_payments").select("project_id, amount, status").in("project_id", projectIds).eq("status", "paid")
        : { data: [] };
      const projectClientMap: Record<string, string> = {};
      projects?.forEach(p => { if (p.client_id) projectClientMap[p.id] = p.client_id; });
      return data?.map(c => ({
        ...c,
        projectCount: projects?.filter(p => p.client_id === c.id).length || 0,
        activeProjects: projects?.filter(p => p.client_id === c.id && (p.status === "active" || p.status === "pilot")).length || 0,
        totalSpend: (payments || []).filter(pay => projectClientMap[pay.project_id] === c.id).reduce((s, pay) => s + (pay.amount || 0), 0),
      })) || [];
    },
    staleTime: 30_000,
  });

  if (selectedClient) {
    return <ClientDetailView clientId={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  const filtered = clients?.filter(c =>
    !search || c.company_name?.toLowerCase().includes(search.toLowerCase()) || c.contact_email?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Rechercher par nom ou email" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">Aucun client trouvé</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">Entreprise</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Contact</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Projets</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Actifs</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Dépense totale</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Inscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedClient(c.id)}>
                    <TableCell className="text-sm font-medium">{c.company_name}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{c.contact_email}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{c.projectCount}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{c.activeProjects}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{c.totalSpend.toFixed(0)} EUR</TableCell>
                    <TableCell className="text-[13px] font-mono text-muted-foreground">{new Date(c.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientDetailView({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: "", contact_name: "", contact_email: "" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-client-detail", clientId],
    queryFn: async () => {
      const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
      const { data: projects } = await supabase.from("annotation_projects").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      const projectIds = projects?.map(p => p.id) || [];
      const { data: payments } = projectIds.length > 0
        ? await supabase.from("project_payments").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
        : { data: [] };
      const totalSpend = (payments || []).filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
      return { client, projects: projects || [], payments: payments || [], totalSpend };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 rounded-xl" /></div>;
  if (!data?.client) return null;

  const openEdit = () => {
    setEditForm({
      company_name: data.client.company_name || "",
      contact_name: data.client.contact_name || "",
      contact_email: data.client.contact_email || "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAction("update_client", { client_id: clientId, updates: editForm });
      toast.success("Client mis à jour");
      setEditOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-clients-list"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await adminAction("delete_client", { client_id: clientId, confirmation_name: deleteConfirm });
      toast.success("Client supprimé");
      setDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-clients-list"] });
      onBack();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la suppression");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-foreground">{data.client.company_name}</h1>
            <p className="text-sm text-muted-foreground">{data.client.contact_email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="w-4 h-4 mr-1" /> Modifier
          </Button>
          <Button variant="destructive" size="sm" onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}>
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniKpi label="Projets" value={String(data.projects.length)} />
        <MiniKpi label="Actifs" value={String(data.projects.filter(p => p.status === "active" || p.status === "pilot").length)} />
        <MiniKpi label="Tâches totales" value={String(data.projects.reduce((s, p) => s + p.total_items, 0))} />
        <MiniKpi label="Dépense totale" value={`${data.totalSpend.toFixed(0)} EUR`} />
      </div>

      {/* Projects table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Projets</CardTitle></CardHeader>
        <CardContent>
          {data.projects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">Nom</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Domaine</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.projects.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.domain}</TableCell>
                    <TableCell className="text-sm">{p.type}</TableCell>
                    <TableCell><span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{p.status}</span></TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.total_items}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun projet</p>
          )}
        </CardContent>
      </Card>

      {/* Payments table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Paiements</CardTitle></CardHeader>
        <CardContent>
          {data.payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px] uppercase tracking-wider">Projet</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider text-right">Montant</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Statut</TableHead>
                  <TableHead className="text-[12px] uppercase tracking-wider">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((pay: any) => (
                  <TableRow key={pay.id}>
                    <TableCell className="text-sm font-mono">{pay.project_id?.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{pay.payment_type}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{pay.amount?.toFixed(2)} USD</TableCell>
                    <TableCell><span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{pay.status}</span></TableCell>
                    <TableCell className="text-[13px] font-mono text-muted-foreground">{new Date(pay.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun paiement</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom de l'entreprise</Label>
              <Input value={editForm.company_name} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nom du contact</Label>
              <Input value={editForm.contact_name} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email de contact</Label>
              <Input type="email" value={editForm.contact_email} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les projets, tâches et données associés seront supprimés.
              <br /><br />
              Tapez <strong>{data.client.company_name}</strong> pour confirmer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder={data.client.company_name}
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirm !== data.client.company_name || saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
