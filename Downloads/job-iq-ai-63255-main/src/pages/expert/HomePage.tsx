import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, ArrowRight, ClipboardList, CheckCircle, DollarSign, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const DOMAINS: Record<string, string> = {
  medical: "Médical",
  legal: "Juridique",
  finance: "Finance",
  code: "Code",
};

// ─── Animated Counter ────────────────────────────────────────
function AnimatedEuro({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (Math.abs(diff) < 0.01) { setDisplay(value); ref.current = value; return; }
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

  return <span>{display.toFixed(2)} EUR</span>;
}

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prevEarningsRef = useRef<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["expert-home-dashboard"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .single();

      const { data: certs } = await supabase
        .from("annotator_domain_certifications")
        .select("domain, tier, status, score")
        .eq("user_id", session.user.id)
        .eq("status", "valid");

      const { data: annotatorProfile } = await supabase
        .from("annotator_profiles")
        .select("id")
        .eq("expert_id", (await supabase.from("expert_profiles").select("id").eq("user_id", session.user.id).maybeSingle()).data?.id || "")
        .maybeSingle();

      const annotatorId = annotatorProfile?.id;

      const { count: pendingTasks } = annotatorId ? await supabase
        .from("annotation_tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_annotator_id", annotatorId)
        .in("status", ["assigned", "pending"]) : { count: 0 };

      const { count: completedTasks } = annotatorId ? await supabase
        .from("annotation_tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_annotator_id", annotatorId)
        .eq("status", "completed") : { count: 0 };

      // Fetch balance for real-time earnings
      const { data: balanceRow } = await supabase
        .from("expert_balances")
        .select("available_balance, pending_balance, total_earned")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const totalEarnings = balanceRow?.total_earned || 0;
      const availableBalance = balanceRow?.available_balance || 0;
      const pendingBalance = balanceRow?.pending_balance || 0;

      return {
        userName: profile?.full_name?.split(" ")[0] || "Expert",
        certifications: certs || [],
        pendingTasks: pendingTasks || 0,
        completedTasks: completedTasks || 0,
        totalEarnings,
        availableBalance,
        pendingBalance,
        hasCertification: (certs?.length || 0) > 0,
      };
    },
    staleTime: 10_000,
  });

  // Show toast when earnings increase (task just completed)
  useEffect(() => {
    if (data?.totalEarnings !== undefined) {
      if (prevEarningsRef.current !== null && data.totalEarnings > prevEarningsRef.current) {
        const diff = data.totalEarnings - prevEarningsRef.current;
        toast.success(`+${diff.toFixed(2)} EUR crédité !`, {
          description: "Votre tâche a été validée et le paiement est en cours de traitement.",
          duration: 5000,
        });
      }
      prevEarningsRef.current = data.totalEarnings;
    }
  }, [data?.totalEarnings]);

  // Realtime: refresh dashboard when tasks/payments/balances change
  useEffect(() => {
    const channel = supabase
      .channel("home-realtime-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "annotation_tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["expert-home-dashboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "annotation_payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["expert-home-dashboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expert_balances" }, () => {
        queryClient.invalidateQueries({ queryKey: ["expert-home-dashboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expert_transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["expert-home-dashboard"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return (
    <ExpertDashboardLayout userName={data?.userName} pendingCount={data?.pendingTasks}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <h1 className="text-foreground">Bonjour, {data?.userName}</h1>
          )}
          <p className="text-muted-foreground mt-1">Votre espace d'annotation RLHF</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {isLoading ? (
            [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <KpiCard label="Tâches en attente" value={String(data?.pendingTasks || 0)} icon={ClipboardList} />
              <KpiCard label="Complétées" value={String(data?.completedTasks || 0)} icon={CheckCircle} />
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono text-lg font-semibold text-foreground leading-none">
                        <AnimatedEuro value={data?.totalEarnings || 0} />
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-1">Gains totaux</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <KpiCard label="Disponible" value={`${(data?.availableBalance || 0).toFixed(2)} €`} icon={TrendingUp} />
              <KpiCard label="Domaines certifiés" value={String(data?.certifications.length || 0)} icon={Award} />
            </>
          )}
        </div>

        {/* Certification CTA or Status */}
        {!isLoading && !data?.hasCertification && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-foreground mb-1">Obtenez votre certification</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Passez l'assessment de votre domaine pour accéder aux tâches d'annotation et commencer à être rémunéré.
                    </p>
                    <Button size="sm" onClick={() => navigate("/expert/certification")}>
                      Passer la certification
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!isLoading && data?.hasCertification && (
          <Card>
            <CardContent className="p-6">
              <p className="text-[13px] font-medium text-muted-foreground mb-3">Certifications actives</p>
              <div className="flex flex-wrap gap-2">
                {data.certifications.map((cert: any) => (
                  <span key={cert.domain} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-success/10 text-success text-sm font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {DOMAINS[cert.domain] || cert.domain}
                  </span>
                ))}
              </div>
              <button onClick={() => navigate("/expert/certification")} className="text-sm text-primary font-medium mt-3 hover:underline">
                Ajouter un domaine
              </button>
            </CardContent>
          </Card>
        )}

        {/* Available tasks prompt */}
        {!isLoading && data?.hasCertification && data.pendingTasks > 0 && (
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-foreground mb-1">
                  {data.pendingTasks} tâche{data.pendingTasks > 1 ? "s" : ""} disponible{data.pendingTasks > 1 ? "s" : ""}
                </h3>
                <p className="text-sm text-muted-foreground">
                  De nouvelles annotations vous attendent dans votre file de tâches.
                </p>
              </div>
              <Button onClick={() => navigate("/expert/tasks")}>
                Commencer
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && data?.hasCertification && data.pendingTasks === 0 && (
          <div className="rounded-xl border border-border p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Aucune tâche disponible pour le moment. De nouvelles tâches sont ajoutées régulièrement.
            </p>
          </div>
        )}
      </div>
    </ExpertDashboardLayout>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-mono text-lg font-semibold text-foreground leading-none">{value}</p>
            <p className="text-[12px] text-muted-foreground mt-1">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
