import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  UserCheck,
  FileCheck,
  ClipboardCheck,
  Briefcase,
  MessagesSquare,
  Target,
  TrendingUp,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface FunnelStep {
  key: string;
  label: string;
  icon: React.ElementType;
  value: number;
  colorClass: string;
  bgClass: string;
  ringClass: string;
}

export default function FunnelAnalytics() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-funnel"],
    queryFn: async () => {
      const [
        signupsRes,
        onboardingRes,
        kycRes,
        testRes,
        appsRes,
        interviewRes,
        placedRes,
      ] = await Promise.all([
        supabase.from("user_roles").select("*", { count: "exact", head: true }),
        supabase.from("expert_profiles").select("*", { count: "exact", head: true }).eq("onboarding_completed", true),
        supabase.from("expert_profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "verified"),
        supabase.from("test_submissions").select("expert_id"),
        supabase.from("job_applications").select("expert_id"),
        supabase.from("job_applications").select("*", { count: "exact", head: true }).eq("status", "interview"),
        supabase.from("placements").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);

      return {
        signups: signupsRes.count || 0,
        onboardingCompleted: onboardingRes.count || 0,
        kycVerified: kycRes.count || 0,
        testCompleted: new Set(testRes.data?.map((t) => t.expert_id)).size,
        applied: new Set(appsRes.data?.map((a) => a.expert_id)).size,
        interviewed: interviewRes.count || 0,
        placed: placedRes.count || 0,
      };
    },
  });

  const conv = (from: number, to: number) => (from === 0 ? 0 : Math.round((to / from) * 100));

  const d = data || { signups: 0, onboardingCompleted: 0, kycVerified: 0, testCompleted: 0, applied: 0, interviewed: 0, placed: 0 };

  const steps: FunnelStep[] = [
    { key: "signups", label: "Inscriptions", icon: Users, value: d.signups, colorClass: "text-primary", bgClass: "bg-primary/10", ringClass: "ring-primary/20" },
    { key: "onboarding", label: "Onboarding", icon: UserCheck, value: d.onboardingCompleted, colorClass: "text-[hsl(280,70%,50%)]", bgClass: "bg-[hsl(280,70%,50%)]/10", ringClass: "ring-[hsl(280,70%,50%)]/20" },
    { key: "kyc", label: "KYC vérifié", icon: FileCheck, value: d.kycVerified, colorClass: "text-[hsl(210,80%,50%)]", bgClass: "bg-[hsl(210,80%,50%)]/10", ringClass: "ring-[hsl(210,80%,50%)]/20" },
    { key: "test", label: "Test passé", icon: ClipboardCheck, value: d.testCompleted, colorClass: "text-[hsl(330,70%,50%)]", bgClass: "bg-[hsl(330,70%,50%)]/10", ringClass: "ring-[hsl(330,70%,50%)]/20" },
    { key: "applied", label: "Candidatures", icon: Briefcase, value: d.applied, colorClass: "text-[hsl(25,90%,55%)]", bgClass: "bg-[hsl(25,90%,55%)]/10", ringClass: "ring-[hsl(25,90%,55%)]/20" },
    { key: "interview", label: "Entretiens", icon: MessagesSquare, value: d.interviewed, colorClass: "text-[hsl(45,90%,50%)]", bgClass: "bg-[hsl(45,90%,50%)]/10", ringClass: "ring-[hsl(45,90%,50%)]/20" },
    { key: "placed", label: "Placés", icon: Target, value: d.placed, colorClass: "text-[hsl(var(--success))]", bgClass: "bg-[hsl(var(--success))]/10", ringClass: "ring-[hsl(var(--success))]/20" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Funnel de conversion
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            De l'inscription au placement — {conv(d.signups, d.placed)}% de conversion globale
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualiser
        </Button>
      </div>

      {/* Funnel Steps — responsive grid with connector arrows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const prevVal = i > 0 ? steps[i - 1].value : step.value;
          const stepConv = i > 0 ? conv(prevVal, step.value) : 100;
          const totalConv = i > 0 ? conv(d.signups, step.value) : 100;
          const barPct = d.signups > 0 ? Math.max(8, (step.value / d.signups) * 100) : (i === 0 ? 100 : 8);

          return (
            <div key={step.key} className="relative flex flex-col items-center">
              {/* Conversion badge between steps (desktop) */}
              {i > 0 && (
                <div className="hidden xl:flex absolute -left-3 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10">
                  <span className="text-[10px] font-semibold text-muted-foreground bg-background border border-border rounded-full px-1.5 py-0.5 shadow-sm">
                    {stepConv}%
                  </span>
                </div>
              )}
              {/* Mobile/tablet: small arrow between cards */}
              {i > 0 && (
                <div className="flex xl:hidden items-center justify-center -mt-1 -mb-1">
                  <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                </div>
              )}

              <Card className={`w-full ring-1 ${step.ringClass} border-0 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow`}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  {/* Icon */}
                  <div className={`p-2.5 rounded-xl ${step.bgClass}`}>
                    <Icon className={`h-5 w-5 ${step.colorClass}`} />
                  </div>

                  {/* Value */}
                  <p className="text-2xl font-bold tabular-nums">{step.value}</p>

                  {/* Label */}
                  <p className="text-xs font-medium text-muted-foreground leading-tight">{step.label}</p>

                  {/* Mini bar */}
                  <div className="w-full h-1.5 rounded-full bg-muted mt-1">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${step.bgClass.replace("/10", "")}`}
                      style={{ width: `${barPct}%`, background: `hsl(var(--primary) / ${1 - i * 0.1})` }}
                    />
                  </div>

                  {/* Conversion from previous */}
                  {i > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {stepConv}% étape préc. · {totalConv}% total
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Key conversion rates */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Inscription → Onboarding", value: conv(d.signups, d.onboardingCompleted), good: 60 },
          { label: "Onboarding → KYC", value: conv(d.onboardingCompleted, d.kycVerified), good: 50 },
          { label: "KYC → Test", value: conv(d.kycVerified, d.testCompleted), good: 40 },
          { label: "Test → Candidature", value: conv(d.testCompleted, d.applied), good: 30 },
          { label: "Entretien → Placement", value: conv(d.interviewed, d.placed), good: 25 },
        ].map((metric) => (
          <Card key={metric.label} className="border-0 shadow-[var(--shadow-sm)]">
            <CardContent className="p-4 text-center">
              <p
                className={`text-xl font-bold tabular-nums ${
                  metric.value >= metric.good
                    ? "text-[hsl(var(--success))]"
                    : metric.value >= metric.good * 0.5
                    ? "text-[hsl(45,90%,45%)]"
                    : "text-destructive"
                }`}
              >
                {metric.value}%
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
