import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Building, Shield, Copy, Eye, EyeOff, RefreshCw, Key, Globe, Bell,
  Lock, AlertTriangle, Trash2, Plus, TestTube, Pencil, X, Check
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClientDashboardLayout } from "@/components/layout/DashboardLayout";
import { toast } from "sonner";

// ─── Helpers ───────────────────────────────────────────────
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "stef_live_";
  for (let i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateWebhookSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "whsec_";
  for (let i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

const COUNTRIES = [
  { code: "FR", label: "France" }, { code: "DE", label: "Allemagne" }, { code: "BE", label: "Belgique" },
  { code: "CA", label: "Canada" }, { code: "CH", label: "Suisse" }, { code: "ES", label: "Espagne" },
  { code: "GB", label: "Royaume-Uni" }, { code: "IT", label: "Italie" }, { code: "LU", label: "Luxembourg" },
  { code: "MA", label: "Maroc" }, { code: "NL", label: "Pays-Bas" }, { code: "PT", label: "Portugal" },
  { code: "SN", label: "Sénégal" }, { code: "TN", label: "Tunisie" }, { code: "US", label: "États-Unis" },
  { code: "AT", label: "Autriche" }, { code: "IE", label: "Irlande" }, { code: "SE", label: "Suède" },
  { code: "DK", label: "Danemark" }, { code: "FI", label: "Finlande" }, { code: "PL", label: "Pologne" },
  { code: "CZ", label: "Tchéquie" }, { code: "RO", label: "Roumanie" }, { code: "HU", label: "Hongrie" },
  { code: "BG", label: "Bulgarie" }, { code: "HR", label: "Croatie" }, { code: "SK", label: "Slovaquie" },
  { code: "SI", label: "Slovénie" }, { code: "LT", label: "Lituanie" }, { code: "LV", label: "Lettonie" },
  { code: "EE", label: "Estonie" }, { code: "CY", label: "Chypre" }, { code: "MT", label: "Malte" },
  { code: "GR", label: "Grèce" },
].sort((a, b) => a.label.localeCompare(b.label));

const WEBHOOK_EVENTS = [
  { value: "project.started", label: "Projet démarré" },
  { value: "project.completed", label: "Projet complété" },
  { value: "payment.due", label: "Milestone de paiement" },
  { value: "export.ready", label: "Export prêt" },
  { value: "task.flagged", label: "Tâche flaggée" },
  { value: "quality.alert", label: "Alerte qualité" },
];

// ─── Section: Company Info ──────────────────────────────────
function CompanyInfoSection({ client, refetch }: { client: any; refetch: () => void }) {
  const [form, setForm] = useState({
    companyName: "", contactName: "", contactEmail: "",
    address: "", addressLine2: "", postalCode: "", city: "", country: "FR",
    siret: "", tvaNumber: "", billingEmail: "",
  });
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (client && !initialized) {
      setForm({
        companyName: client.company_name || "",
        contactName: client.contact_name || "",
        contactEmail: client.contact_email || "",
        address: client.address || "",
        addressLine2: client.address_line2 || "",
        postalCode: client.postal_code || "",
        city: client.city || "",
        country: client.country || "FR",
        siret: client.siret || "",
        tvaNumber: client.tva_number || "",
        billingEmail: client.billing_email || "",
      });
      setInitialized(true);
    }
  }, [client, initialized]);

  const completion = useMemo(() => {
    const required = [
      form.companyName, form.address, form.city, form.postalCode, form.country,
      ...(form.country === "FR" ? [form.siret] : []),
    ];
    const filled = required.filter(v => v && v.trim().length > 0).length;
    return Math.round((filled / required.length) * 100);
  }, [form]);

  const handleSave = async () => {
    if (!client?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("clients").update({
        company_name: form.companyName,
        contact_name: form.contactName,
        contact_email: form.contactEmail,
        address: form.address,
        address_line2: form.addressLine2,
        postal_code: form.postalCode,
        city: form.city,
        country: form.country,
        siret: form.siret,
        tva_number: form.tvaNumber,
        billing_email: form.billingEmail,
        profile_completion: completion,
      }).eq("id", client.id);
      if (error) throw error;
      toast.success("Paramètres mis à jour");
      refetch();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building className="w-4 h-4" />
          Informations entreprise
        </CardTitle>
        <CardDescription>Ces informations apparaissent sur vos factures et communications.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Completion bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Complétude du profil</span>
            <span className="font-mono">{completion}%</span>
          </div>
          <Progress value={completion} className="h-1" />
          {completion < 100 && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-600 dark:text-yellow-400">
              Complétez vos informations pour pouvoir recevoir des factures conformes.
            </div>
          )}
        </div>

        {/* Basic info */}
        <div className="space-y-2">
          <Label>Nom de l'entreprise</Label>
          <Input value={form.companyName} onChange={e => update("companyName", e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom du contact</Label>
            <Input value={form.contactName} onChange={e => update("contactName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email de contact</Label>
            <Input type="email" value={form.contactEmail} onChange={e => update("contactEmail", e.target.value)} />
          </div>
        </div>

        {/* Address */}
        <Separator />
        <div className="space-y-2">
          <Label>Adresse</Label>
          <Input placeholder="Rue, numéro" value={form.address} onChange={e => update("address", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Complément</Label>
          <Input placeholder="Bâtiment, étage (optionnel)" value={form.addressLine2} onChange={e => update("addressLine2", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Code postal</Label>
            <Input placeholder="75001" value={form.postalCode} onChange={e => update("postalCode", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ville</Label>
            <Input placeholder="Paris" value={form.city} onChange={e => update("city", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Pays</Label>
            <Select value={form.country} onValueChange={v => update("country", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fiscal */}
        <Separator />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Numéro SIRET</Label>
            <Input placeholder="XXX XXX XXX XXXXX" value={form.siret} onChange={e => update("siret", e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Obligatoire pour la facturation en France.</p>
          </div>
          <div className="space-y-1">
            <Label>N° TVA intracommunautaire</Label>
            <Input placeholder="FR XX XXXXXXXXX" value={form.tvaNumber} onChange={e => update("tvaNumber", e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Permet l'autoliquidation pour les clients UE. Laissez vide si non applicable.</p>
          </div>
        </div>

        {/* Billing email */}
        <div className="space-y-1">
          <Label>Email de facturation</Label>
          <Input type="email" placeholder="Si différent de l'email de contact" value={form.billingEmail} onChange={e => update("billingEmail", e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Les factures et rappels de paiement seront envoyés à cette adresse.</p>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section: API Key ───────────────────────────────────────
function ApiKeySection({ client, refetch }: { client: any; refetch: () => void }) {
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const hasKey = !!client?.api_key_hash;

  const handleGenerateApiKey = async () => {
    if (!client?.id) return;
    if (hasKey && !confirm("Êtes-vous sûr ? L'ancienne clé sera révoquée et ne fonctionnera plus.")) return;
    setGeneratingKey(true);
    try {
      const rawKey = generateApiKey();
      const keyHash = await hashKey(rawKey);
      const prefix = rawKey.slice(10, 18);
      const { error } = await supabase.from("clients").update({
        api_key_hash: keyHash, api_key_prefix: prefix, api_key_created_at: new Date().toISOString(),
      }).eq("id", client.id);
      if (error) throw error;
      setNewApiKey(rawKey);
      setShowKey(true);
      toast.success(hasKey ? "Clé API regénérée avec succès" : "Clé API générée avec succès");
      refetch();
    } catch { toast.error("Erreur lors de la génération de la clé"); }
    finally { setGeneratingKey(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" />Clé API</CardTitle>
        <CardDescription>Utilisez cette clé pour accéder à l'API STEF. La clé complète n'est affichée qu'une seule fois.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {newApiKey ? (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Key className="w-4 h-4" />Votre nouvelle clé API — copiez-la maintenant
            </div>
            <div className="flex items-center gap-2">
              <Input readOnly value={showKey ? newApiKey : "•".repeat(50)} className="font-mono text-xs bg-background" />
              <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(newApiKey); toast.success("Clé copiée"); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Cette clé ne sera plus jamais affichée. Conservez-la en lieu sûr.</p>
          </div>
        ) : hasKey ? (
          <div className="space-y-2">
            <Label>Clé actuelle</Label>
            <Input readOnly value={`stef_live_${client?.api_key_prefix}${"•".repeat(32)}`} className="font-mono text-sm" />
            <p className="text-[12px] text-muted-foreground">
              Créée le {client?.api_key_created_at ? new Date(client.api_key_created_at).toLocaleDateString("fr-FR") : "—"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-center space-y-3">
            <Key className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune clé API générée</p>
          </div>
        )}
        <Button variant={hasKey ? "outline" : "default"} onClick={handleGenerateApiKey} disabled={generatingKey} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${generatingKey ? "animate-spin" : ""}`} />
          {hasKey ? "Regénérer la clé" : "Générer une clé API"}
        </Button>
        {hasKey && (
          <p className="text-[11px] text-muted-foreground">
            La regénération révoque immédiatement l'ancienne clé. Toute intégration utilisant l'ancienne clé cessera de fonctionner.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Webhooks ──────────────────────────────────────
function WebhooksSection({ client }: { client: any }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: webhooks = [] } = useQuery({
    queryKey: ["client-webhooks", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data } = await supabase.from("client_webhooks").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const openModal = () => {
    setNewUrl("");
    setNewEvents([]);
    setGeneratedSecret(generateWebhookSecret());
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!newUrl.startsWith("https://")) { toast.error("L'URL doit commencer par https://"); return; }
    if (newEvents.length === 0) { toast.error("Sélectionnez au moins un événement"); return; }
    if (webhooks.length >= 5) { toast.error("Maximum 5 webhooks par client"); return; }
    setCreating(true);
    try {
      const secretH = await hashKey(generatedSecret);
      const { error } = await supabase.from("client_webhooks").insert({
        client_id: client.id, url: newUrl, events: newEvents, secret_hash: secretH, active: true,
      });
      if (error) throw error;
      toast.success("Webhook créé");
      setShowModal(false);
      qc.invalidateQueries({ queryKey: ["client-webhooks"] });
    } catch { toast.error("Erreur lors de la création"); }
    finally { setCreating(false); }
  };

  const handleTest = async (wh: any) => {
    setTestingId(wh.id);
    try {
      const res = await fetch(wh.url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "test.ping", timestamp: new Date().toISOString(), data: { message: "STEF webhook test" } }),
      });
      if (res.ok) toast.success(`Ping réussi (${res.status})`);
      else toast.error(`Échec du ping (${res.status})`);
    } catch { toast.error("Impossible de joindre l'URL"); }
    finally { setTestingId(null); }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from("client_webhooks").delete().eq("id", id);
      toast.success("Webhook supprimé");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["client-webhooks"] });
    } catch { toast.error("Erreur"); }
  };

  const toggleEvent = (ev: string) => {
    setNewEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Webhooks</CardTitle>
          <CardDescription>Recevez des notifications en temps réel quand des événements se produisent sur vos projets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhooks.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-8 text-center space-y-3">
              <Globe className="w-12 h-12 mx-auto text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Aucun webhook configuré.</p>
              <Button onClick={openModal} className="gap-2"><Plus className="w-4 h-4" />Ajouter un webhook</Button>
            </div>
          ) : (
            <>
              {webhooks.map((wh: any) => (
                <div key={wh.id} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                  <p className="font-mono text-sm text-foreground truncate">{wh.url}</p>
                  <p className="text-xs text-muted-foreground">
                    Événements : {(wh.events || []).map((e: string) => WEBHOOK_EVENTS.find(we => we.value === e)?.label || e).join(", ")}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${wh.active ? "bg-emerald-500" : "bg-red-500"}`} />
                      {wh.active ? "Actif" : "Inactif"}
                    </span>
                    {wh.last_triggered_at && <span>Dernier ping : {new Date(wh.last_triggered_at).toLocaleString("fr-FR")}</span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => handleTest(wh)} disabled={testingId === wh.id}>
                      <TestTube className="w-3.5 h-3.5 mr-1" />{testingId === wh.id ? "..." : "Tester"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingId(wh.id)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" />Supprimer
                    </Button>
                  </div>
                </div>
              ))}
              {webhooks.length < 5 && (
                <Button variant="outline" onClick={openModal} className="gap-2"><Plus className="w-4 h-4" />Ajouter un webhook</Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create webhook modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouveau webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input placeholder="https://" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Événements</Label>
              <div className="grid gap-2">
                {WEBHOOK_EVENTS.map(ev => (
                  <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={newEvents.includes(ev.value)} onCheckedChange={() => toggleEvent(ev.value)} />
                    <span className="text-sm">{ev.label} <span className="text-muted-foreground">({ev.value})</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secret</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={generatedSecret} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(generatedSecret); toast.success("Secret copié"); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Ce secret ne sera plus jamais affiché. Copiez-le maintenant.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Création..." : "Créer le webhook"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Supprimer ce webhook ?</DialogTitle>
            <DialogDescription>Les notifications ne seront plus envoyées à cette URL.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deletingId && handleDelete(deletingId)}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Section: Notifications ─────────────────────────────────
const NOTIF_GROUPS = [
  {
    title: "Projets", items: [
      { key: "project_started", label: "Projet démarré" },
      { key: "project_completed", label: "Projet complété" },
      { key: "quality_alert", label: "Alerte qualité (alpha < 0.70)" },
    ],
  },
  {
    title: "Paiements", items: [
      { key: "invoice_issued", label: "Facture émise" },
      { key: "payment_reminder", label: "Rappel de paiement" },
      { key: "payment_confirmed", label: "Paiement confirmé" },
    ],
  },
  {
    title: "Données", items: [
      { key: "export_ready", label: "Export prêt" },
      { key: "task_flagged", label: "Tâche flaggée pour review" },
    ],
  },
  {
    title: "Produit", items: [
      { key: "product_updates", label: "Mises à jour produit" },
      { key: "new_features", label: "Nouvelles fonctionnalités" },
    ],
  },
];

function NotificationsSection({ client }: { client: any }) {
  const qc = useQueryClient();
  const { data: prefs, isLoading } = useQuery({
    queryKey: ["client-notif-prefs", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data } = await supabase.from("client_notification_preferences").select("*").eq("client_id", client.id).maybeSingle();
      if (!data) {
        // Create default prefs
        const { data: newData } = await supabase.from("client_notification_preferences").insert({ client_id: client.id }).select("*").single();
        return newData;
      }
      return data;
    },
  });

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = useCallback((key: string, checked: boolean) => {
    // Optimistic update
    qc.setQueryData(["client-notif-prefs", client?.id], (old: any) => old ? { ...old, [key]: checked } : old);
    
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[0] = setTimeout(async () => {
      try {
        await supabase.from("client_notification_preferences").update({ [key]: checked, updated_at: new Date().toISOString() }).eq("client_id", client.id);
        toast.success("Préférences mises à jour");
      } catch { toast.error("Erreur"); }
    }, 500);
  }, [client?.id, qc]);

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" />Notifications</CardTitle>
        <CardDescription>Choisissez quels emails vous souhaitez recevoir.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {NOTIF_GROUPS.map(group => (
          <div key={group.title} className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</p>
            {group.items.map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{item.label}</span>
                <Switch checked={!!(prefs as any)?.[item.key]} onCheckedChange={v => handleToggle(item.key, v)} />
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Section: Security ──────────────────────────────────────
function SecuritySection() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const pwStrength = useMemo(() => {
    if (!newPw) return { level: 0, label: "", color: "" };
    const hasDigit = /\d/.test(newPw);
    const hasUpper = /[A-Z]/.test(newPw);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPw);
    if (newPw.length < 8 || !hasDigit || !hasUpper) return { level: 1, label: "Faible", color: "bg-red-500" };
    if (newPw.length >= 12 && hasSpecial) return { level: 3, label: "Fort", color: "bg-emerald-500" };
    return { level: 2, label: "Moyen", color: "bg-orange-500" };
  }, [newPw]);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { toast.error("Les mots de passe ne correspondent pas"); return; }
    if (pwStrength.level < 1) { toast.error("Mot de passe trop faible"); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Mot de passe modifié");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) { toast.error(err.message || "Erreur"); }
    finally { setChangingPw(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4" />Sécurité</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Mot de passe actuel</Label>
          <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nouveau mot de passe</Label>
          <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          {newPw && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${pwStrength.color}`} style={{ width: `${(pwStrength.level / 3) * 100}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{pwStrength.label}</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Confirmer le nouveau mot de passe</Label>
          <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
        </div>
        <Button onClick={handleChangePassword} disabled={changingPw || !newPw || !confirmPw}>
          {changingPw ? "Modification..." : "Modifier le mot de passe"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Section: Danger Zone ───────────────────────────────────
function DangerZoneSection({ client }: { client: any }) {
  const [showDisable, setShowDisable] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleDisable = async () => {
    if (disableConfirm !== "DÉSACTIVER") return;
    setProcessing(true);
    try {
      await supabase.from("clients").update({
        is_active: false, disabled_at: new Date().toISOString(), disabled_reason: "Désactivé par le client",
      }).eq("id", client.id);
      toast.success("Compte désactivé");
      setShowDisable(false);
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch { toast.error("Erreur"); }
    finally { setProcessing(false); }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== client?.company_name || !deleteChecked) return;
    setProcessing(true);
    try {
      await supabase.from("clients").update({
        is_active: false, disabled_at: new Date().toISOString(), disabled_reason: "Suppression demandée par le client",
      }).eq("id", client.id);
      toast.success("Demande de suppression enregistrée");
      setShowDelete(false);
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch { toast.error("Erreur"); }
    finally { setProcessing(false); }
  };

  return (
    <>
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />Zone de danger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Disable */}
          <div className="space-y-2">
            <p className="text-sm text-foreground font-medium">Désactiver le compte</p>
            <p className="text-xs text-muted-foreground">
              Désactiver temporairement votre compte. Vos projets seront mis en pause et votre clé API sera invalidée. Vous pourrez réactiver votre compte à tout moment en nous contactant.
            </p>
            <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setShowDisable(true)}>
              Désactiver mon compte
            </Button>
          </div>

          <Separator />

          {/* Delete */}
          <div className="space-y-2">
            <p className="text-sm text-foreground font-medium">Supprimer le compte</p>
            <p className="text-xs text-muted-foreground">
              Supprimer définitivement votre compte et toutes vos données. Cette action est irréversible. Les factures seront conservées pendant 10 ans conformément aux obligations comptables.
            </p>
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              Supprimer mon compte et mes données
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Disable modal */}
      <Dialog open={showDisable} onOpenChange={setShowDisable}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Désactiver votre compte ?</DialogTitle>
            <DialogDescription>
              Tous vos projets en cours seront mis en pause. Votre clé API sera immédiatement invalidée. Vos données seront conservées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Tapez DÉSACTIVER pour confirmer</Label>
            <Input value={disableConfirm} onChange={e => setDisableConfirm(e.target.value)} placeholder="DÉSACTIVER" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDisable(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDisable} disabled={disableConfirm !== "DÉSACTIVER" || processing}>
              {processing ? "..." : "Désactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete modal */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Supprimer définitivement votre compte ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Toutes vos données seront supprimées : projets, tâches, annotations, exports, webhooks, et paramètres. Les factures seront conservées conformément à la loi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tapez le nom de votre entreprise pour confirmer</Label>
              <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={client?.company_name || ""} />
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={deleteChecked} onCheckedChange={v => setDeleteChecked(!!v)} className="mt-0.5" />
              <span className="text-xs text-muted-foreground">Je comprends que cette action est irréversible et que toutes mes données seront supprimées.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDelete(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirm !== client?.company_name || !deleteChecked || processing}>
              {processing ? "..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────
const SettingsPage = () => {
  const { data: client, isLoading, refetch } = useQuery({
    queryKey: ["client-record"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data } = await supabase.from("clients").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      return data?.[0] ?? null;
    },
  });

  if (isLoading) {
    return (
      <ClientDashboardLayout>
        <div className="space-y-6 max-w-3xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </ClientDashboardLayout>
    );
  }

  return (
    <ClientDashboardLayout userName={client?.company_name}>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez les informations de votre compte</p>
        </div>

        <CompanyInfoSection client={client} refetch={refetch} />
        <ApiKeySection client={client} refetch={refetch} />
        {client && <WebhooksSection client={client} />}
        {client && <NotificationsSection client={client} />}
        <SecuritySection />
        {client && <DangerZoneSection client={client} />}
      </div>
    </ClientDashboardLayout>
  );
};

export default SettingsPage;
