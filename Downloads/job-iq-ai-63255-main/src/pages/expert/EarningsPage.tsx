import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Banknote, Clock, Calendar, CheckCircle, ArrowRight, Download,
  BarChart3, ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Minus,
  CircleCheck, CircleAlert, CircleX
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string | null;
  description: string | null;
  created_at: string | null;
  task_id: string | null;
}

interface BalanceData {
  available_balance: number;
  pending_balance: number;
  total_earned: number;
}

interface EarningsState {
  balance: BalanceData;
  transactions: Transaction[];
  hasBankAccount: boolean;
  isSuspended: boolean;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  thisMonthTasks: number;
  lastMonthTasks: number;
  domainBreakdown: { domain: string; amount: number }[];
  taskTypeBreakdown: { type: string; amount: number }[];
  avgTimePerTask: number;
  firstActivityDate: string | null;
}

type PeriodType = "7d" | "30d" | "90d" | "12m" | "all";
type FilterType = "all" | "credits" | "withdrawals";
type PeriodFilter = "month" | "3months" | "6months" | "year" | "all";

const DOMAIN_COLORS: Record<string, string> = {
  medical: "#3B82F6",
  legal: "#F59E0B",
  finance: "#10B981",
  code: "#7B6FF0",
};

const DOMAIN_LABELS: Record<string, string> = {
  medical: "Médical",
  legal: "Juridique",
  finance: "Finance",
  code: "Code",
};

const TYPE_LABELS: Record<string, string> = {
  task_credit: "Tâche validée",
  withdrawal: "Retrait",
  adjustment: "Ajustement",
  reversal: "Annulation",
  referral: "Parrainage",
};

// ─── Animated Counter ────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 2 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    const duration = 600;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(animate);
      else ref.current = value;
    }
    requestAnimationFrame(animate);
  }, [value]);

  return <span>{prefix}{display.toFixed(decimals)}{suffix}</span>;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

async function fetchEarningsData(): Promise<EarningsState> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const userId = session.user.id;

  // Fetch expert profile
  const { data: expertProfile } = await supabase
    .from("expert_profiles")
    .select("id, payment_method_connected")
    .eq("user_id", userId)
    .single();

  const expertId = expertProfile?.id;

  // Fetch balance
  const { data: balanceRow } = await supabase
    .from("expert_balances")
    .select("available_balance, pending_balance, total_earned")
    .eq("user_id", userId)
    .maybeSingle();

  const balance: BalanceData = {
    available_balance: balanceRow?.available_balance || 0,
    pending_balance: balanceRow?.pending_balance || 0,
    total_earned: balanceRow?.total_earned || 0,
  };

  // Fetch transactions
  const { data: txData } = await supabase
    .from("expert_transactions")
    .select("id, amount, type, status, description, created_at, task_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const transactions = txData || [];

  // This month calculations
  const now = new Date();
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const thisMonthTx = transactions.filter(t => t.created_at && new Date(t.created_at) >= monthStart && t.type === "task_credit");
  const lastMonthTx = transactions.filter(t => t.created_at && new Date(t.created_at) >= lastMonthStart && new Date(t.created_at) <= lastMonthEnd && t.type === "task_credit");

  const thisMonthEarnings = thisMonthTx.reduce((s, t) => s + Math.abs(t.amount), 0);
  const lastMonthEarnings = lastMonthTx.reduce((s, t) => s + Math.abs(t.amount), 0);
  const thisMonthTasks = thisMonthTx.length;
  const lastMonthTasks = lastMonthTx.length;

  // Domain & type breakdown from annotation_payments
  let domainBreakdown: { domain: string; amount: number }[] = [];
  let taskTypeBreakdown: { type: string; amount: number }[] = [];
  let avgTimePerTask = 0;

  if (expertId) {
    const { data: annotatorProfile } = await supabase
      .from("annotator_profiles")
      .select("id")
      .eq("expert_id", expertId)
      .maybeSingle();

    if (annotatorProfile) {
      const { data: payments } = await supabase
        .from("annotation_payments")
        .select("final_amount, task_id, time_spent_seconds")
        .eq("annotator_id", annotatorProfile.id)
        .in("status", ["paid", "pending"]);

      if (payments && payments.length > 0) {
        const taskIds = payments.map(p => p.task_id).filter(Boolean);

        // Fetch tasks for domain/type
        if (taskIds.length > 0) {
          const { data: tasks } = await supabase
            .from("annotation_tasks")
            .select("id, domain, source_type")
            .in("id", taskIds.slice(0, 100));

          if (tasks) {
            const taskMap = new Map(tasks.map(t => [t.id, t]));
            const domainMap = new Map<string, number>();
            const typeMap = new Map<string, number>();

            for (const p of payments) {
              const task = taskMap.get(p.task_id);
              if (task && p.final_amount) {
                domainMap.set(task.domain, (domainMap.get(task.domain) || 0) + p.final_amount);
                typeMap.set(task.source_type, (typeMap.get(task.source_type) || 0) + p.final_amount);
              }
            }

            domainBreakdown = Array.from(domainMap).map(([domain, amount]) => ({ domain, amount })).sort((a, b) => b.amount - a.amount);
            taskTypeBreakdown = Array.from(typeMap).map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount);
          }
        }

        const totalTime = payments.reduce((s, p) => s + (p.time_spent_seconds || 0), 0);
        avgTimePerTask = payments.length > 0 ? totalTime / payments.length : 0;
      }
    }
  }

  // Check suspension
  const { data: annotatorCheck } = expertId
    ? await supabase.from("annotator_profiles").select("suspended_until").eq("expert_id", expertId).maybeSingle()
    : { data: null };

  const isSuspended = !!(annotatorCheck?.suspended_until && new Date(annotatorCheck.suspended_until) > now);

  const firstTx = transactions.length > 0 ? transactions[transactions.length - 1].created_at : null;

  return {
    balance,
    transactions,
    hasBankAccount: expertProfile?.payment_method_connected || false,
    isSuspended,
    thisMonthEarnings,
    lastMonthEarnings,
    thisMonthTasks,
    lastMonthTasks,
    domainBreakdown,
    taskTypeBreakdown,
    avgTimePerTask,
    firstActivityDate: firstTx,
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EarningsPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodType>("30d");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month");
  const [txPage, setTxPage] = useState(0);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawMode, setWithdrawMode] = useState<"all" | "custom">("all");
  const [customAmount, setCustomAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [productivityOpen, setProductivityOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["expert-earnings-full"],
    queryFn: fetchEarningsData,
    staleTime: 30_000,
  });

  // Realtime: refresh earnings when transactions/payments change
  useEffect(() => {
    const channel = supabase
      .channel("earnings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "expert_transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["expert-earnings-full"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "annotation_payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["expert-earnings-full"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expert_balances" }, () => {
        queryClient.invalidateQueries({ queryKey: ["expert-earnings-full"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const balance = data?.balance || { available_balance: 0, pending_balance: 0, total_earned: 0 };
  const transactions = data?.transactions || [];
  const hasBankAccount = data?.hasBankAccount || false;
  const isSuspended = data?.isSuspended || false;

  // ─── Deltas ─────────────────────────────────────────────────────────────────
  const availableDelta = data ? data.thisMonthEarnings - data.lastMonthEarnings : 0;
  const tasksDelta = data ? data.thisMonthTasks - data.lastMonthTasks : 0;
  const monthPctDelta = data && data.lastMonthEarnings > 0
    ? ((data.thisMonthEarnings - data.lastMonthEarnings) / data.lastMonthEarnings) * 100 : 0;

  // ─── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!transactions.length) return [];
    const now = new Date();
    let start: Date;
    switch (period) {
      case "7d": start = subDays(now, 7); break;
      case "30d": start = subDays(now, 30); break;
      case "90d": start = subDays(now, 90); break;
      case "12m": start = subMonths(now, 12); break;
      case "all": start = data?.firstActivityDate ? new Date(data.firstActivityDate) : subMonths(now, 12); break;
      default: start = subDays(now, 30);
    }

    const useWeeks = period === "90d";
    const useMonths = period === "12m" || period === "all";

    if (useMonths) {
      const months = eachMonthOfInterval({ start, end: now });
      return months.map(m => {
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        const paid = transactions.filter(t => t.created_at && new Date(t.created_at) >= mStart && new Date(t.created_at) <= mEnd && t.status === "completed" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const pending = transactions.filter(t => t.created_at && new Date(t.created_at) >= mStart && new Date(t.created_at) <= mEnd && t.status === "pending" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
        return { date: format(m, "MMM yy", { locale: fr }), paid, pending };
      });
    }

    if (useWeeks) {
      const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });
      return weeks.map((w, i) => {
        const wEnd = i < weeks.length - 1 ? weeks[i + 1] : now;
        const paid = transactions.filter(t => t.created_at && new Date(t.created_at) >= w && new Date(t.created_at) < wEnd && t.status === "completed" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const pending = transactions.filter(t => t.created_at && new Date(t.created_at) >= w && new Date(t.created_at) < wEnd && t.status === "pending" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
        return { date: format(w, "d MMM", { locale: fr }), paid, pending };
      });
    }

    const days = eachDayOfInterval({ start, end: now });
    return days.map(d => {
      const ds = format(d, "yyyy-MM-dd");
      const paid = transactions.filter(t => t.created_at && format(new Date(t.created_at), "yyyy-MM-dd") === ds && t.status === "completed" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const pending = transactions.filter(t => t.created_at && format(new Date(t.created_at), "yyyy-MM-dd") === ds && t.status === "pending" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
      return { date: format(d, "d MMM", { locale: fr }), paid, pending };
    });
  }, [transactions, period, data?.firstActivityDate]);

  const hasChartData = chartData.some(d => d.paid > 0 || d.pending > 0);

  // ─── Filtered transactions ──────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    let filtered = [...transactions];
    if (filterType === "credits") filtered = filtered.filter(t => t.amount > 0);
    if (filterType === "withdrawals") filtered = filtered.filter(t => t.amount < 0 || t.type === "withdrawal");

    const now = new Date();
    if (periodFilter === "month") filtered = filtered.filter(t => t.created_at && new Date(t.created_at) >= startOfMonth(now));
    else if (periodFilter === "3months") filtered = filtered.filter(t => t.created_at && new Date(t.created_at) >= subMonths(now, 3));
    else if (periodFilter === "6months") filtered = filtered.filter(t => t.created_at && new Date(t.created_at) >= subMonths(now, 6));
    else if (periodFilter === "year") filtered = filtered.filter(t => t.created_at && new Date(t.created_at) >= subMonths(now, 12));

    return filtered;
  }, [transactions, filterType, periodFilter]);

  const txPerPage = 20;
  const totalTxPages = Math.max(1, Math.ceil(filteredTx.length / txPerPage));
  const paginatedTx = filteredTx.slice(txPage * txPerPage, (txPage + 1) * txPerPage);

  // ─── Withdrawal ─────────────────────────────────────────────────────────────
  const withdrawAmount = withdrawMode === "all" ? balance.available_balance : parseFloat(customAmount) || 0;

  const canWithdraw = hasBankAccount && !isSuspended && balance.available_balance >= 50;

  const handleWithdraw = async () => {
    if (withdrawAmount < 50) { toast.error("Le minimum de retrait est de 50 USD"); return; }
    if (withdrawAmount > balance.available_balance) { toast.error("Montant supérieur au solde disponible"); return; }
    setWithdrawing(true);
    try {
      const { error } = await supabase.functions.invoke("expert-payout", {
        body: { action: "request_withdrawal", amount: withdrawAmount },
      });
      if (error) throw error;
      toast.success(`Demande de retrait de ${withdrawAmount.toFixed(2)} USD enregistrée. Traitement sous 48 heures ouvrées.`);
      setWithdrawOpen(false);
      queryClient.invalidateQueries({ queryKey: ["expert-earnings-full"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du retrait");
    } finally {
      setWithdrawing(false);
    }
  };

  // ─── CSV Export ─────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = ["Date", "Description", "Type", "Montant", "Statut"];
    const rows = filteredTx.map(t => [
      t.created_at ? format(new Date(t.created_at), "dd/MM/yyyy HH:mm") : "",
      t.description || "-",
      TYPE_LABELS[t.type] || t.type,
      t.amount.toFixed(2),
      t.status || "",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stef-revenus-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Export CSV téléchargé");
  }, [filteredTx]);

  // ─── Productivity metrics ───────────────────────────────────────────────────
  const productivity = useMemo(() => {
    if (!data) return null;
    const creditTx = transactions.filter(t => t.type === "task_credit" && t.amount > 0);
    const totalTasks = creditTx.length;
    const totalEarned = creditTx.reduce((s, t) => s + t.amount, 0);
    const avgPerTask = totalTasks > 0 ? totalEarned / totalTasks : 0;
    const totalTimeHours = (data.avgTimePerTask * totalTasks) / 3600;
    const avgPerHour = totalTimeHours > 0 ? totalEarned / totalTimeHours : 0;
    const activeDays = data.firstActivityDate ? Math.max(1, differenceInDays(new Date(), new Date(data.firstActivityDate))) : 1;
    const tasksPerDay = totalTasks / activeDays;

    // Best month
    const monthMap = new Map<string, number>();
    for (const t of creditTx) {
      if (!t.created_at) continue;
      const key = format(new Date(t.created_at), "yyyy-MM");
      monthMap.set(key, (monthMap.get(key) || 0) + t.amount);
    }
    let bestMonth = { label: "-", amount: 0 };
    for (const [k, v] of monthMap) {
      if (v > bestMonth.amount) bestMonth = { label: format(new Date(k + "-01"), "MMMM yyyy", { locale: fr }), amount: v };
    }

    return { avgPerTask, avgPerHour, tasksPerDay, bestMonth };
  }, [data, transactions]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <ExpertDashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="w-10 h-10 text-destructive mb-4" />
          <p className="text-foreground font-medium mb-2">Erreur de chargement</p>
          <Button variant="outline" onClick={() => refetch()}>Réessayer</Button>
        </div>
      </ExpertDashboardLayout>
    );
  }

  return (
    <ExpertDashboardLayout>
      <div className="space-y-6 max-w-[1000px] mx-auto">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Revenus</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Total gagné depuis votre inscription :{" "}
              <span className="font-mono font-semibold text-foreground">{balance.total_earned.toFixed(2)} USD</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!hasBankAccount ? (
              <Button className="bg-orange-500 hover:bg-orange-600 text-white" asChild>
                <a href="/expert/profile">Configurer le paiement</a>
              </Button>
            ) : isSuspended ? (
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button disabled>Retirer</Button>
                  </TooltipTrigger>
                  <TooltipContent>Les retraits sont suspendus pendant la durée de la suspension.</TooltipContent>
                </UITooltip>
              </TooltipProvider>
            ) : balance.available_balance < 50 ? (
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button disabled>Retirer</Button>
                  </TooltipTrigger>
                  <TooltipContent>Minimum de retrait : 50 USD</TooltipContent>
                </UITooltip>
              </TooltipProvider>
            ) : (
              <Button onClick={() => setWithdrawOpen(true)}>Retirer</Button>
            )}
          </div>
        </div>

        {/* Bank account status line */}
        {isLoading ? (
          <Skeleton className="h-6 w-64" />
        ) : hasBankAccount ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Coordonnées bancaires enregistrées</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Aucune coordonnée bancaire enregistrée</span>
            <Button variant="outline" size="sm" className="ml-2 text-orange-500 border-orange-500/30 hover:bg-orange-500/10" asChild>
              <a href="/expert/profile">Configurer</a>
            </Button>
          </div>
        )}

        {/* No bank account banner */}
        {!isLoading && !hasBankAccount && (
          <div className="border-l-[3px] border-orange-500 bg-orange-500/5 rounded-r-lg px-4 py-3">
            <p className="text-sm text-foreground">Renseignez vos coordonnées bancaires pour pouvoir demander un retrait.</p>
            <Button size="sm" className="mt-2 bg-orange-500 hover:bg-orange-600 text-white" asChild>
              <a href="/expert/profile">Configurer maintenant</a>
            </Button>
          </div>
        )}

        {/* Zero earnings encouragement */}
        {!isLoading && balance.total_earned === 0 && transactions.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Complétez vos premières tâches pour commencer à gagner.{" "}
              <Link to="/expert/tasks" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                Voir les tâches disponibles <ArrowRight className="w-3 h-3" />
              </Link>
            </p>
          </div>
        )}

        {/* ── Section 1: KPIs ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading ? (
            [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <KpiCard
                label="Disponible"
                value={balance.available_balance}
                prefix="$"
                decimals={2}
                icon={Banknote}
                color="text-green-500"
                delta={availableDelta}
                deltaLabel="vs mois précédent"
              />
              <KpiCard
                label="En attente de QA"
                value={balance.pending_balance}
                prefix="$"
                decimals={2}
                icon={Clock}
                color="text-primary"
                tooltip="Ce montant sera transféré vers votre solde disponible une fois les annotations validées par le contrôle qualité."
              />
              <KpiCard
                label="Ce mois"
                value={data?.thisMonthEarnings || 0}
                prefix="$"
                decimals={2}
                icon={Calendar}
                delta={monthPctDelta}
                deltaLabel="%"
                deltaIsPercent
              />
              <KpiCard
                label="Tâches ce mois"
                value={data?.thisMonthTasks || 0}
                decimals={0}
                icon={CheckCircle}
                delta={tasksDelta}
                deltaLabel="vs mois précédent"
                subtitle={data && data.thisMonthTasks > 0 ? `soit ~${(data.thisMonthEarnings / data.thisMonthTasks).toFixed(2)} USD / tâche` : undefined}
              />
            </>
          )}
        </div>

        {/* ── Section 2: Revenue Chart ───────────────────────────────────── */}
        <Card className="border border-border">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Évolution des revenus</h2>
              <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
                {(["7d", "30d", "90d", "12m", "all"] as PeriodType[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {p === "7d" ? "7j" : p === "30d" ? "30j" : p === "90d" ? "90j" : p === "12m" ? "12m" : "Tout"}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !hasChartData ? (
              <div className="h-64 flex flex-col items-center justify-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Les données de revenus apparaîtront ici après vos premières tâches validées.</p>
              </div>
            ) : (
              <>
                <div className="h-52 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gPending" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7B6FF0" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#7B6FF0" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.05} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 7))} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }}
                        formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name === "paid" ? "Payé" : "En attente"]}
                      />
                      <Area type="monotone" dataKey="paid" stackId="1" stroke="#22C55E" fill="url(#gPaid)" strokeWidth={2} />
                      <Area type="monotone" dataKey="pending" stackId="1" stroke="#7B6FF0" fill="url(#gPending)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />Payé</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-primary" />En attente</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Revenue Breakdown ───────────────────────────────── */}
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (data?.domainBreakdown.length || 0) > 0 || (data?.taskTypeBreakdown.length || 0) > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By domain */}
            <Card className="border border-border">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Par domaine</h3>
                {data!.domainBreakdown.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <div className="w-40 h-40 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data!.domainBreakdown}
                            dataKey="amount"
                            nameKey="domain"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            strokeWidth={2}
                            stroke="hsl(var(--card))"
                          >
                            {data!.domainBreakdown.map((d, i) => (
                              <Cell key={i} fill={DOMAIN_COLORS[d.domain] || "#666"} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2.5 flex-1">
                      {data!.domainBreakdown.map(d => {
                        const total = data!.domainBreakdown.reduce((s, x) => s + x.amount, 0);
                        const pct = total > 0 ? ((d.amount / total) * 100).toFixed(0) : "0";
                        return (
                          <div key={d.domain} className="flex items-center gap-2 text-sm">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DOMAIN_COLORS[d.domain] || "#666" }} />
                            <span className="text-foreground flex-1">{DOMAIN_LABELS[d.domain] || d.domain}</span>
                            <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
                            <span className="font-mono text-xs font-medium text-foreground">${d.amount.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Pas de données par domaine</p>
                )}
              </CardContent>
            </Card>

            {/* By task type */}
            <Card className="border border-border">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Par type de tâche</h3>
                {data!.taskTypeBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {data!.taskTypeBreakdown.map((t, i) => {
                      const maxAmount = data!.taskTypeBreakdown[0].amount;
                      const widthPct = maxAmount > 0 ? (t.amount / maxAmount) * 100 : 0;
                      const opacity = 1 - (i * 0.15);
                      return (
                        <div key={t.type} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-24 shrink-0 truncate capitalize">{t.type.replace(/_/g, " ")}</span>
                          <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${widthPct}%`, backgroundColor: `rgba(123, 111, 240, ${Math.max(0.3, opacity)})` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-medium text-foreground w-16 text-right">${t.amount.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Pas de données par type</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border border-border">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">La répartition de vos revenus apparaîtra après vos premières tâches.</p>
            </CardContent>
          </Card>
        )}

        {/* ── Section 4: Transactions ────────────────────────────────────── */}
        <Card className="border border-border">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-foreground">Transactions</h2>
              <Button variant="ghost" size="sm" onClick={exportCSV} className="gap-1.5 text-muted-foreground">
                <Download className="w-3.5 h-3.5" />
                Exporter CSV
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
                {([["all", "Tout"], ["credits", "Crédits"], ["withdrawals", "Retraits"]] as [FilterType, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => { setFilterType(val); setTxPage(0); }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterType === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={periodFilter}
                onChange={e => { setPeriodFilter(e.target.value as PeriodFilter); setTxPage(0); }}
                className="text-xs bg-transparent border border-border rounded-lg px-2.5 py-1.5 text-muted-foreground"
              >
                <option value="month">Ce mois</option>
                <option value="3months">3 derniers mois</option>
                <option value="6months">6 derniers mois</option>
                <option value="year">Cette année</option>
                <option value="all">Tout</option>
              </select>
            </div>

            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : filteredTx.length === 0 ? (
              <div className="py-12 text-center">
                <Banknote className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Aucune transaction pour le moment.</p>
                <p className="text-xs text-muted-foreground">Vos crédits apparaîtront ici après la validation de vos premières annotations.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider pb-2 px-2">Date</th>
                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider pb-2 px-2">Description</th>
                        <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider pb-2 px-2">Type</th>
                        <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider pb-2 px-2">Montant</th>
                        <th className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider pb-2 px-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {paginatedTx.map(tx => (
                        <TxRow key={tx.id} tx={tx} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-2">
                  {paginatedTx.map(tx => (
                    <TxCard key={tx.id} tx={tx} />
                  ))}
                </div>

                {/* Pagination */}
                {totalTxPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <Button variant="ghost" size="sm" disabled={txPage === 0} onClick={() => setTxPage(p => p - 1)}>Précédent</Button>
                    <span className="text-xs text-muted-foreground">Page {txPage + 1} sur {totalTxPages}</span>
                    <Button variant="ghost" size="sm" disabled={txPage >= totalTxPages - 1} onClick={() => setTxPage(p => p + 1)}>Suivant</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Section 5: Productivity (collapsible) ──────────────────────── */}
        {!isLoading && productivity && transactions.length > 0 && (
          <Collapsible open={productivityOpen} onOpenChange={setProductivityOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3 hover:bg-muted/20 transition-colors">
                <span className="text-sm font-medium text-foreground">Vos statistiques de productivité</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${productivityOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <StatCard label="Revenu moyen par tâche" value={`${productivity.avgPerTask.toFixed(2)} USD`} />
                <StatCard label="Revenu moyen par heure" value={productivity.avgPerHour > 0 ? `${productivity.avgPerHour.toFixed(2)} USD` : "N/A"} />
                <StatCard label="Tâches par jour (moy.)" value={productivity.tasksPerDay.toFixed(1)} />
                <StatCard label="Meilleur mois" value={productivity.bestMonth.amount > 0 ? `${productivity.bestMonth.label} — ${productivity.bestMonth.amount.toFixed(0)} USD` : "-"} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── Withdrawal Modal ───────────────────────────────────────────── */}
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Retirer des fonds</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Solde disponible</p>
                <p className="font-mono text-2xl font-bold text-green-500">{balance.available_balance.toFixed(2)} USD</p>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Montant à retirer</Label>
                <RadioGroup value={withdrawMode} onValueChange={(v) => setWithdrawMode(v as "all" | "custom")} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="all" id="w-all" />
                    <Label htmlFor="w-all" className="text-sm cursor-pointer">Retirer tout ({balance.available_balance.toFixed(2)} USD)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="w-custom" />
                    <Label htmlFor="w-custom" className="text-sm cursor-pointer">Montant personnalisé</Label>
                  </div>
                </RadioGroup>
                {withdrawMode === "custom" && (
                  <div className="mt-2">
                    <Input
                      type="number"
                      placeholder="50.00"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      className="font-mono"
                      min={50}
                      max={balance.available_balance}
                      step={0.01}
                    />
                    {parseFloat(customAmount) > 0 && parseFloat(customAmount) < 50 && (
                      <p className="text-xs text-destructive mt-1">Le minimum est de 50 USD</p>
                    )}
                    {parseFloat(customAmount) > balance.available_balance && (
                      <p className="text-xs text-destructive mt-1">Montant supérieur au solde disponible</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-sm text-muted-foreground border-t border-border pt-3">
                <div className="flex justify-between text-foreground font-medium"><span>Montant du virement</span><span className="font-mono">{withdrawAmount.toFixed(2)} USD</span></div>
              </div>

              <p className="text-xs text-muted-foreground">Délai : 48 heures ouvrées</p>

              <Button
                className="w-full"
                onClick={handleWithdraw}
                disabled={withdrawing || withdrawAmount < 50 || withdrawAmount > balance.available_balance}
              >
                {withdrawing ? "Traitement…" : "Demander le retrait"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Mobile sticky withdraw button */}
        {!isLoading && canWithdraw && (
          <div className="sm:hidden fixed bottom-16 left-0 right-0 p-3 bg-background/95 backdrop-blur-sm border-t border-border z-20" style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}>
            <Button className="w-full" onClick={() => setWithdrawOpen(true)}>
              Retirer {balance.available_balance.toFixed(2)} USD
            </Button>
          </div>
        )}
      </div>
    </ExpertDashboardLayout>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, prefix = "", suffix = "", decimals = 2, icon: Icon, color, delta, deltaLabel, deltaIsPercent, tooltip, subtitle
}: {
  label: string; value: number; prefix?: string; suffix?: string; decimals?: number;
  icon: React.ElementType; color?: string; delta?: number; deltaLabel?: string;
  deltaIsPercent?: boolean; tooltip?: string; subtitle?: string;
}) {
  const card = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border border-border relative overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[12px] text-muted-foreground">{label}</p>
              <p className={`font-mono text-xl sm:text-2xl font-bold leading-none ${color || "text-foreground"}`}>
                <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
              </p>
              {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
              {delta !== undefined && (
                <div className="flex items-center gap-1 mt-1.5">
                  {delta > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : delta < 0 ? <TrendingDown className="w-3 h-3 text-destructive" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                  <span className={`text-[11px] font-medium ${delta > 0 ? "text-green-500" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {delta > 0 ? "+" : ""}{deltaIsPercent ? `${delta.toFixed(1)}%` : `${delta.toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>
            <Icon className="w-5 h-5 text-muted-foreground/30 shrink-0 mt-0.5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <UITooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
        </UITooltip>
      </TooltipProvider>
    );
  }
  return card;
}

function TxRow({ tx }: { tx: Transaction }) {
  const isPositive = tx.amount > 0;
  return (
    <tr className="hover:bg-muted/10 transition-colors">
      <td className="px-2 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {tx.created_at ? format(new Date(tx.created_at), "d MMM yyyy, HH:mm", { locale: fr }) : "-"}
      </td>
      <td className="px-2 py-3 text-sm text-foreground">{tx.description || TYPE_LABELS[tx.type] || tx.type}</td>
      <td className="px-2 py-3">
        <TxTypeBadge type={tx.type} />
      </td>
      <td className={`px-2 py-3 text-right font-mono text-sm font-medium ${isPositive ? "text-green-500" : "text-destructive"}`}>
        {isPositive ? "+" : "−"}${Math.abs(tx.amount).toFixed(2)}
      </td>
      <td className="px-2 py-3 text-center">
        <TxStatusBadge status={tx.status} />
      </td>
    </tr>
  );
}

function TxCard({ tx }: { tx: Transaction }) {
  const isPositive = tx.amount > 0;
  return (
    <div className="rounded-lg border border-border p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{tx.created_at ? format(new Date(tx.created_at), "d MMM yyyy, HH:mm", { locale: fr }) : "-"}</span>
        <TxStatusBadge status={tx.status} />
      </div>
      <p className="text-sm text-foreground">{tx.description || TYPE_LABELS[tx.type] || tx.type}</p>
      <div className="flex items-center justify-between">
        <TxTypeBadge type={tx.type} />
        <span className={`font-mono text-sm font-semibold ${isPositive ? "text-green-500" : "text-destructive"}`}>
          {isPositive ? "+" : "−"}${Math.abs(tx.amount).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function TxTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    task_credit: "bg-green-500/10 text-green-600 dark:text-green-400",
    withdrawal: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    adjustment: "bg-muted text-muted-foreground",
    reversal: "bg-destructive/10 text-destructive",
    referral: "bg-primary/10 text-primary",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${styles[type] || "bg-muted text-muted-foreground"}`}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function TxStatusBadge({ status }: { status: string | null }) {
  if (status === "completed") return <span className="inline-flex items-center gap-1 text-[11px] text-green-500"><CircleCheck className="w-3 h-3" />Complété</span>;
  if (status === "pending") return <span className="inline-flex items-center gap-1 text-[11px] text-orange-500"><CircleAlert className="w-3 h-3" />En cours</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-1 text-[11px] text-destructive"><CircleX className="w-3 h-3" />Échoué</span>;
  return <span className="text-[11px] text-muted-foreground">{status || "-"}</span>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className="font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
