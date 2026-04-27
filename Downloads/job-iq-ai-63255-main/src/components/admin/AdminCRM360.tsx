import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Building2, Activity, DollarSign, ClipboardList, Search,
  CheckCircle, Clock, AlertTriangle, XCircle, ArrowUpRight, Globe,
  Smartphone, RefreshCw, Eye, TrendingUp, Zap, ShieldCheck, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────
interface CRMData {
  // KPIs
  totalExperts: number;
  activeExperts: number;
  totalClients: number;
  activeClients: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalRevenue: number;
  paidRevenue: number;
  unpaidRevenue: number;
  avgAlpha: number;
  // Live feed
  recentAnnotations: AnnotationActivity[];
  recentPayments: PaymentActivity[];
  recentApiCalls: ApiCallActivity[];
  // Expert activity
  expertActivity: ExpertRow[];
  // Client activity
  clientActivity: ClientRow[];
  // Payments
  paymentSummary: PaymentRow[];
  // Acquisition
  clientAcquisition: AcquisitionEntry[];
}

interface AnnotationActivity {
  id: string;
  annotator_name: string;
  domain: string;
  task_type: string;
  status: string;
  completed_at: string | null;
  time_spent: number;
}

interface PaymentActivity {
  id: string;
  project_name: string;
  amount: number;
  status: string;
  payment_type: string;
  created_at: string;
}

interface ApiCallActivity {
  endpoint: string;
  method: string;
  status_code: number;
  latency_ms: number;
  created_at: string;
  client_name: string;
}

interface ExpertRow {
  id: string;
  name: string;
  domain: string;
  tier: string;
  tasks_completed: number;
  accuracy: number;
  trust_score: number;
  total_earned: number;
  last_active: string | null;
  status: string;
}

interface ClientRow {
  id: string;
  company_name: string;
  total_projects: number;
  active_projects: number;
  total_spent: number;
  pending_payments: number;
  acquisition: string;
  last_active: string | null;
}

interface PaymentRow {
  id: string;
  project_name: string;
  client_name: string;
  payment_type: string;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
}

interface AcquisitionEntry {
  source: string;
  count: number;
}

const DOMAIN_LABELS: Record<string, string> = {
  medical: "Médical", legal: "Juridique", finance: "Finance", code: "Code",
};
const DOMAIN_COLORS: Record<string, string> = {
  medical: "#3B82F6", legal: "#F59E0B", finance: "#10B981", code: "#7B6FF0",
};
const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Payé", variant: "default" },
  pending: { label: "En attente", variant: "secondary" },
  overdue: { label: "En retard", variant: "destructive" },
  completed: { label: "Complété", variant: "default" },
  active: { label: "Actif", variant: "default" },
  draft: { label: "Brouillon", variant: "outline" },
  suspended: { label: "Suspendu", variant: "destructive" },
};

// ─── Data Fetching ────────────────────────────────────────────
async function fetchCRMData(): Promise<CRMData> {
  const [
    expertsRes, activeExpertsRes, clientsRes, activeClientsRes,
    tasksRes, completedTasksRes, pendingTasksRes,
    paymentsRes, alphaRes,
    recentTasksRes, projectPaymentsRes, apiLogsRes,
    expertDetailsRes, clientDetailsRes,
    projectPaymentListRes, acquisitionRes,
  ] = await Promise.all([
    supabase.from("annotator_profiles").select("*", { count: "exact", head: true }),
    supabase.from("annotator_profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("annotation_tasks").select("*", { count: "exact", head: true }),
    supabase.from("annotation_tasks").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("annotation_tasks").select("*", { count: "exact", head: true }).in("status", ["assigned", "pending", "in_progress"]),
    supabase.from("project_payments").select("amount, status"),
    supabase.from("alpha_reports").select("overall_alpha").order("computed_at", { ascending: false }).limit(50),
    // Recent annotations
    supabase.from("annotation_tasks")
      .select("id, domain, source_type, status, completed_at, assigned_annotator_id")
      .order("updated_at", { ascending: false }).limit(20),
    // Recent project payments
    supabase.from("project_payments")
      .select("id, amount, status, payment_type, created_at, paid_at, due_date, project_id")
      .order("created_at", { ascending: false }).limit(20),
    // API logs
    supabase.from("api_request_logs")
      .select("endpoint, method, status_code, latency_ms, created_at, client_id")
      .order("created_at", { ascending: false }).limit(15),
    // Expert details
    supabase.from("annotator_profiles")
      .select("id, expert_id, tier, overall_accuracy, trust_score, total_annotations, is_active, suspended_until")
      .order("total_annotations", { ascending: false }).limit(50),
    // Client details
    supabase.from("clients")
      .select("id, company_name, is_active, created_at, user_id")
      .order("created_at", { ascending: false }).limit(50),
    // Payment list
    supabase.from("project_payments")
      .select("id, project_id, amount, status, payment_type, due_date, paid_at, created_at")
      .order("created_at", { ascending: false }).limit(50),
    // Acquisition source
    supabase.from("user_acquisition")
      .select("utm_source")
      .not("utm_source", "is", null),
  ]);

  // Revenue calculations
  const totalRevenue = paymentsRes.data?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
  const paidRevenue = paymentsRes.data?.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0) || 0;
  const unpaidRevenue = totalRevenue - paidRevenue;

  // Alpha
  const alphaValues = alphaRes.data?.map(r => r.overall_alpha).filter(Boolean) || [];
  const avgAlpha = alphaValues.length > 0 ? alphaValues.reduce((a, b) => a + b, 0) / alphaValues.length : 0;

  // Map expert profiles to expert names
  const expertIds = (expertDetailsRes.data || []).map(e => e.expert_id).filter(Boolean);
  const { data: expertNames } = expertIds.length > 0
    ? await supabase.from("expert_profiles").select("id, full_name, user_id").in("id", expertIds.slice(0, 50))
    : { data: [] };
  const expertNameMap = new Map((expertNames || []).map(e => [e.id, e.full_name || "Expert"]));

  // Map annotator IDs to names for recent tasks
  const annotatorIds = (recentTasksRes.data || []).map(t => t.assigned_annotator_id).filter(Boolean);
  const { data: annotatorNames } = annotatorIds.length > 0
    ? await supabase.from("annotator_profiles").select("id, expert_id").in("id", [...new Set(annotatorIds)].slice(0, 50))
    : { data: [] };
  const annotatorExpertIds = (annotatorNames || []).map(a => a.expert_id).filter(Boolean);
  const { data: annotatorExpertNames } = annotatorExpertIds.length > 0
    ? await supabase.from("expert_profiles").select("id, full_name").in("id", annotatorExpertIds.slice(0, 50))
    : { data: [] };
  const annotatorToExpertMap = new Map((annotatorNames || []).map(a => [a.id, a.expert_id]));
  const expertIdToNameMap = new Map((annotatorExpertNames || []).map(e => [e.id, e.full_name || "Expert"]));

  // Map project IDs for payments
  const projectIds = [...new Set([
    ...(projectPaymentsRes.data || []).map(p => p.project_id),
    ...(projectPaymentListRes.data || []).map(p => p.project_id),
  ])].filter(Boolean);
  const { data: projectNames } = projectIds.length > 0
    ? await supabase.from("annotation_projects").select("id, name, client_id").in("id", projectIds.slice(0, 50))
    : { data: [] };
  const projectMap = new Map((projectNames || []).map(p => [p.id, p]));

  // Map client IDs for API logs
  const clientIds = [...new Set((apiLogsRes.data || []).map(l => l.client_id).filter(Boolean))];
  const { data: clientNameData } = clientIds.length > 0
    ? await supabase.from("clients").select("id, company_name").in("id", clientIds.slice(0, 50))
    : { data: [] };
  const clientNameMap = new Map((clientNameData || []).map(c => [c.id, c.company_name]));

  // Build recent annotations
  const recentAnnotations: AnnotationActivity[] = (recentTasksRes.data || []).map(t => {
    const expertId = t.assigned_annotator_id ? annotatorToExpertMap.get(t.assigned_annotator_id) : null;
    return {
      id: t.id,
      annotator_name: expertId ? expertIdToNameMap.get(expertId) || "Expert" : "Non assigné",
      domain: t.domain,
      task_type: t.source_type,
      status: t.status || "pending",
      completed_at: t.completed_at,
      time_spent: 0,
    };
  });

  // Build payment activity
  const recentPayments: PaymentActivity[] = (projectPaymentsRes.data || []).map(p => ({
    id: p.id,
    project_name: projectMap.get(p.project_id)?.name || "Projet",
    amount: p.amount,
    status: p.status,
    payment_type: p.payment_type,
    created_at: p.created_at,
  }));

  // Build API call activity
  const recentApiCalls: ApiCallActivity[] = (apiLogsRes.data || []).map(l => ({
    endpoint: l.endpoint,
    method: l.method,
    status_code: l.status_code,
    latency_ms: l.latency_ms || 0,
    created_at: l.created_at || "",
    client_name: l.client_id ? clientNameMap.get(l.client_id) || "Client" : "Anonyme",
  }));

  // Expert rows
  const expertBalancesRes = await supabase.from("expert_balances").select("user_id, total_earned").limit(100);
  const balanceMap = new Map((expertBalancesRes.data || []).map(b => [b.user_id, b.total_earned || 0]));

  // Build expert activity rows
  const expertActivity: ExpertRow[] = (expertDetailsRes.data || []).map(e => {
    const name = e.expert_id ? expertNameMap.get(e.expert_id) || "Expert" : "Expert";
    const expertProfile = (expertNames || []).find(ep => ep.id === e.expert_id);
    const earned = expertProfile ? balanceMap.get(expertProfile.user_id) || 0 : 0;
    return {
      id: e.id,
      name,
      domain: "", // multiple domains possible
      tier: e.tier || "junior",
      tasks_completed: e.total_annotations || 0,
      accuracy: e.overall_accuracy || 0,
      trust_score: e.trust_score || 0,
      total_earned: earned,
      last_active: null,
      status: e.suspended_until && new Date(e.suspended_until) > new Date() ? "suspended" : e.is_active ? "active" : "inactive",
    };
  });

  // Client rows
  const clientProjectsRes = await supabase
    .from("annotation_projects")
    .select("client_id, status")
    .in("client_id", (clientDetailsRes.data || []).map(c => c.id).filter(Boolean));

  const clientProjectMap = new Map<string, { total: number; active: number }>();
  (clientProjectsRes.data || []).forEach(p => {
    const existing = clientProjectMap.get(p.client_id!) || { total: 0, active: 0 };
    existing.total++;
    if (p.status === "active" || (p.status as string) === "in_progress") existing.active++;
    clientProjectMap.set(p.client_id!, existing);
  });

  const clientPaymentMap = new Map<string, { spent: number; pending: number }>();
  (projectPaymentListRes.data || []).forEach(p => {
    const proj = projectMap.get(p.project_id);
    if (!proj?.client_id) return;
    const existing = clientPaymentMap.get(proj.client_id) || { spent: 0, pending: 0 };
    if (p.status === "paid") existing.spent += p.amount;
    else existing.pending += p.amount;
    clientPaymentMap.set(proj.client_id, existing);
  });

  const clientActivity: ClientRow[] = (clientDetailsRes.data || []).map(c => {
    const projects = clientProjectMap.get(c.id) || { total: 0, active: 0 };
    const payments = clientPaymentMap.get(c.id) || { spent: 0, pending: 0 };
    return {
      id: c.id,
      company_name: c.company_name || "Client",
      total_projects: projects.total,
      active_projects: projects.active,
      total_spent: payments.spent,
      pending_payments: payments.pending,
      acquisition: "site",
      last_active: c.created_at,
    };
  });

  // Payment summary
  const paymentSummary: PaymentRow[] = (projectPaymentListRes.data || []).map(p => {
    const proj = projectMap.get(p.project_id);
    const clientForProj = (clientDetailsRes.data || []).find(c => c.id === proj?.client_id);
    return {
      id: p.id,
      project_name: proj?.name || "Projet",
      client_name: clientForProj?.company_name || "Client",
      payment_type: p.payment_type,
      amount: p.amount,
      status: p.status,
      due_date: p.due_date,
      paid_at: p.paid_at,
    };
  });

  // Acquisition
  const acqMap = new Map<string, number>();
  (acquisitionRes.data || []).forEach(a => {
    const src = a.utm_source || "direct";
    acqMap.set(src, (acqMap.get(src) || 0) + 1);
  });
  const clientAcquisition = Array.from(acqMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

  return {
    totalExperts: expertsRes.count || 0,
    activeExperts: activeExpertsRes.count || 0,
    totalClients: clientsRes.count || 0,
    activeClients: activeClientsRes.count || 0,
    totalTasks: tasksRes.count || 0,
    completedTasks: completedTasksRes.count || 0,
    pendingTasks: pendingTasksRes.count || 0,
    totalRevenue,
    paidRevenue,
    unpaidRevenue,
    avgAlpha: Number(avgAlpha.toFixed(3)),
    recentAnnotations,
    recentPayments,
    recentApiCalls,
    expertActivity,
    clientActivity,
    paymentSummary,
    clientAcquisition,
  };
}

// ─── Main Component ──────────────────────────────────────────
export function AdminCRM360() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-crm-360"],
    queryFn: fetchCRMData,
    staleTime: 30_000,
  });

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("feed");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">CRM 360°</h1>
          <p className="text-sm text-muted-foreground mt-1">Vision unifiée de toute l'activité STEF</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-9 w-9">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CrmKpi icon={Users} label="Experts" value={`${data.activeExperts}/${data.totalExperts}`} sub="actifs" color="text-primary" />
        <CrmKpi icon={Building2} label="Clients" value={`${data.activeClients}/${data.totalClients}`} sub="actifs" color="text-blue-500" />
        <CrmKpi icon={ClipboardList} label="Tâches" value={data.completedTasks.toLocaleString("fr-FR")} sub={`${data.pendingTasks} en cours`} color="text-success" />
        <CrmKpi icon={DollarSign} label="Revenus" value={`${data.paidRevenue.toLocaleString("fr-FR")} €`} sub={`${data.unpaidRevenue.toLocaleString("fr-FR")} € en attente`} color="text-amber-500" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CrmKpi icon={ShieldCheck} label="Alpha moyen" value={String(data.avgAlpha)} sub={data.avgAlpha >= 0.80 ? "Fiable" : data.avgAlpha >= 0.67 ? "Acceptable" : "Attention"} color={data.avgAlpha >= 0.80 ? "text-success" : data.avgAlpha >= 0.67 ? "text-yellow-500" : "text-destructive"} />
        <CrmKpi icon={Zap} label="Tâches totales" value={data.totalTasks.toLocaleString("fr-FR")} sub="créées" color="text-primary" />
        <CrmKpi icon={Activity} label="Appels API" value={data.recentApiCalls.length > 0 ? `${data.recentApiCalls.length}` : "0"} sub="dernières requêtes" color="text-blue-400" />
        <CrmKpi icon={TrendingUp} label="Revenu total" value={`${data.totalRevenue.toLocaleString("fr-FR")} €`} sub="facturé" color="text-emerald-500" />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher expert, client, projet..."
          className="pl-10 h-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="feed" className="text-[13px]">
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Fil d'activité
          </TabsTrigger>
          <TabsTrigger value="experts" className="text-[13px]">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Experts
          </TabsTrigger>
          <TabsTrigger value="clients" className="text-[13px]">
            <Building2 className="w-3.5 h-3.5 mr-1.5" /> Clients
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-[13px]">
            <DollarSign className="w-3.5 h-3.5 mr-1.5" /> Paiements
          </TabsTrigger>
          <TabsTrigger value="api" className="text-[13px]">
            <Globe className="w-3.5 h-3.5 mr-1.5" /> API
          </TabsTrigger>
          <TabsTrigger value="acquisition" className="text-[13px]">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Acquisition
          </TabsTrigger>
        </TabsList>

        {/* Feed */}
        <TabsContent value="feed" className="space-y-6 mt-6">
          <ActivityFeed
            annotations={data.recentAnnotations}
            payments={data.recentPayments}
            apiCalls={data.recentApiCalls}
            search={search}
          />
        </TabsContent>

        {/* Experts */}
        <TabsContent value="experts" className="mt-6">
          <ExpertsTable data={data.expertActivity} search={search} />
        </TabsContent>

        {/* Clients */}
        <TabsContent value="clients" className="mt-6">
          <ClientsTable data={data.clientActivity} search={search} />
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments" className="mt-6">
          <PaymentsTable data={data.paymentSummary} search={search} />
        </TabsContent>

        {/* API */}
        <TabsContent value="api" className="mt-6">
          <ApiLogsTable data={data.recentApiCalls} search={search} />
        </TabsContent>

        {/* Acquisition */}
        <TabsContent value="acquisition" className="mt-6">
          <AcquisitionView data={data.clientAcquisition} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function CrmKpi({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", color.replace("text-", "bg-") + "/10")}>
            <Icon className={cn("w-4 h-4", color)} />
          </div>
        </div>
        <p className="font-mono text-xl font-bold text-foreground mt-3 leading-none">{value}</p>
        <p className="text-[12px] text-muted-foreground mt-1.5">{label}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_BADGES[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant} className="text-[11px]">{config.label}</Badge>;
}

// ─── Activity Feed ──────────────────────────────────────────
function ActivityFeed({ annotations, payments, apiCalls, search }: {
  annotations: AnnotationActivity[];
  payments: PaymentActivity[];
  apiCalls: ApiCallActivity[];
  search: string;
}) {
  type FeedItem = { type: "annotation" | "payment" | "api"; time: string; data: any };

  const items: FeedItem[] = useMemo(() => {
    const all: FeedItem[] = [
      ...annotations.map(a => ({ type: "annotation" as const, time: a.completed_at || "", data: a })),
      ...payments.map(p => ({ type: "payment" as const, time: p.created_at, data: p })),
      ...apiCalls.map(c => ({ type: "api" as const, time: c.created_at, data: c })),
    ];
    return all
      .filter(i => i.time)
      .filter(i => {
        if (!search) return true;
        const s = search.toLowerCase();
        if (i.type === "annotation") return i.data.annotator_name?.toLowerCase().includes(s) || i.data.domain?.includes(s);
        if (i.type === "payment") return i.data.project_name?.toLowerCase().includes(s);
        if (i.type === "api") return i.data.endpoint?.toLowerCase().includes(s) || i.data.client_name?.toLowerCase().includes(s);
        return true;
      })
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 30);
  }, [annotations, payments, apiCalls, search]);

  if (items.length === 0) {
    return <div className="text-center py-16 text-muted-foreground text-sm">Aucune activité récente</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
            item.type === "annotation" ? "bg-primary/10" :
            item.type === "payment" ? "bg-amber-500/10" : "bg-blue-500/10"
          )}>
            {item.type === "annotation" && <ClipboardList className="w-3.5 h-3.5 text-primary" />}
            {item.type === "payment" && <DollarSign className="w-3.5 h-3.5 text-amber-500" />}
            {item.type === "api" && <Globe className="w-3.5 h-3.5 text-blue-500" />}
          </div>
          <div className="flex-1 min-w-0">
            {item.type === "annotation" && (
              <>
                <p className="text-sm text-foreground">
                  <span className="font-medium">{item.data.annotator_name}</span>
                  {" "}{item.data.status === "completed" ? "a complété" : "travaille sur"}{" "}
                  une tâche <span className="font-medium">{item.data.task_type}</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{DOMAIN_LABELS[item.data.domain] || item.data.domain}</Badge>
                  <StatusBadge status={item.data.status} />
                </div>
              </>
            )}
            {item.type === "payment" && (
              <>
                <p className="text-sm text-foreground">
                  Paiement <span className="font-medium">{item.data.payment_type}</span>
                  {" "}de <span className="font-mono font-semibold">{item.data.amount.toLocaleString("fr-FR")} €</span>
                  {" "}pour <span className="font-medium">{item.data.project_name}</span>
                </p>
                <div className="mt-1">
                  <StatusBadge status={item.data.status} />
                </div>
              </>
            )}
            {item.type === "api" && (
              <>
                <p className="text-sm text-foreground">
                  <span className="font-medium">{item.data.client_name}</span>
                  {" "}<code className="text-[12px] bg-muted px-1.5 py-0.5 rounded">{item.data.method} {item.data.endpoint}</code>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={item.data.status_code < 400 ? "default" : "destructive"} className="text-[10px] font-mono">
                    {item.data.status_code}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">{item.data.latency_ms}ms</span>
                </div>
              </>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {item.time ? formatDistanceToNow(new Date(item.time), { addSuffix: true, locale: fr }) : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Experts Table ──────────────────────────────────────────
function ExpertsTable({ data, search }: { data: ExpertRow[]; search: string }) {
  const filtered = data.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px]">Expert</TableHead>
                <TableHead className="text-[12px]">Tier</TableHead>
                <TableHead className="text-[12px] text-right">Tâches</TableHead>
                <TableHead className="text-[12px] text-right">Précision</TableHead>
                <TableHead className="text-[12px] text-right">Trust</TableHead>
                <TableHead className="text-[12px] text-right">Gains</TableHead>
                <TableHead className="text-[12px]">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun expert</TableCell></TableRow>
              ) : filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-[13px] font-medium">{e.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{e.tier}</Badge>
                  </TableCell>
                  <TableCell className="text-[13px] font-mono text-right">{e.tasks_completed}</TableCell>
                  <TableCell className="text-[13px] font-mono text-right">{(e.accuracy * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-[13px] font-mono text-right">{e.trust_score}</TableCell>
                  <TableCell className="text-[13px] font-mono text-right">{e.total_earned.toFixed(2)} €</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Clients Table ──────────────────────────────────────────
function ClientsTable({ data, search }: { data: ClientRow[]; search: string }) {
  const filtered = data.filter(c =>
    !search || c.company_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px]">Client</TableHead>
                <TableHead className="text-[12px] text-right">Projets</TableHead>
                <TableHead className="text-[12px] text-right">Actifs</TableHead>
                <TableHead className="text-[12px] text-right">Dépensé</TableHead>
                <TableHead className="text-[12px] text-right">En attente</TableHead>
                <TableHead className="text-[12px]">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun client</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-[13px] font-medium">{c.company_name}</TableCell>
                  <TableCell className="text-[13px] font-mono text-right">{c.total_projects}</TableCell>
                  <TableCell className="text-[13px] font-mono text-right">{c.active_projects}</TableCell>
                  <TableCell className="text-[13px] font-mono text-right">{c.total_spent.toLocaleString("fr-FR")} €</TableCell>
                  <TableCell className="text-[13px] font-mono text-right text-amber-500">{c.pending_payments.toLocaleString("fr-FR")} €</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{c.acquisition}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Payments Table ──────────────────────────────────────────
function PaymentsTable({ data, search }: { data: PaymentRow[]; search: string }) {
  const filtered = data.filter(p =>
    !search || p.project_name.toLowerCase().includes(search.toLowerCase()) || p.client_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px]">Projet</TableHead>
                <TableHead className="text-[12px]">Client</TableHead>
                <TableHead className="text-[12px]">Type</TableHead>
                <TableHead className="text-[12px] text-right">Montant</TableHead>
                <TableHead className="text-[12px]">Échéance</TableHead>
                <TableHead className="text-[12px]">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun paiement</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-[13px] font-medium max-w-[200px] truncate">{p.project_name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{p.client_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{p.payment_type}</Badge>
                  </TableCell>
                  <TableCell className="text-[13px] font-mono text-right font-semibold">{p.amount.toLocaleString("fr-FR")} €</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground font-mono">
                    {p.due_date ? format(new Date(p.due_date), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── API Logs Table ─────────────────────────────────────────
function ApiLogsTable({ data, search }: { data: ApiCallActivity[]; search: string }) {
  const filtered = data.filter(l =>
    !search || l.endpoint.toLowerCase().includes(search.toLowerCase()) || l.client_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px]">Client</TableHead>
                <TableHead className="text-[12px]">Endpoint</TableHead>
                <TableHead className="text-[12px]">Méthode</TableHead>
                <TableHead className="text-[12px] text-right">Status</TableHead>
                <TableHead className="text-[12px] text-right">Latence</TableHead>
                <TableHead className="text-[12px]">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun appel API</TableCell></TableRow>
              ) : filtered.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="text-[13px] font-medium">{l.client_name}</TableCell>
                  <TableCell><code className="text-[12px] bg-muted px-1.5 py-0.5 rounded">{l.endpoint}</code></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-mono">{l.method}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Badge variant={l.status_code < 400 ? "default" : "destructive"} className="text-[10px] font-mono">{l.status_code}</Badge>
                  </TableCell>
                  <TableCell className="text-[13px] font-mono text-right">{l.latency_ms}ms</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {l.created_at ? formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: fr }) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Acquisition View ───────────────────────────────────────
function AcquisitionView({ data }: { data: AcquisitionEntry[] }) {
  const COLORS = ["hsl(var(--primary))", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Sources d'acquisition</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="count" nameKey="source">
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée d'acquisition</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Détail par source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.map((d, i) => (
              <div key={d.source} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-foreground flex-1">{d.source}</span>
                <span className="text-sm font-mono font-semibold">{d.count}</span>
                <span className="text-[11px] text-muted-foreground w-12 text-right">
                  {total > 0 ? ((d.count / total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
            {data.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
