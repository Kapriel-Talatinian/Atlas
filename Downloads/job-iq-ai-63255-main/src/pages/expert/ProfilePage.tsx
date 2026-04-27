import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileSidebar } from "@/components/expert/profile/ProfileSidebar";
import { PersonalInfoSection } from "@/components/expert/profile/PersonalInfoSection";
import { PerformanceSection } from "@/components/expert/profile/PerformanceSection";
import { CertificationsSection } from "@/components/expert/profile/CertificationsSection";
import { SanctionsSection } from "@/components/expert/profile/SanctionsSection";
import { RevenueSection } from "@/components/expert/profile/RevenueSection";
import { SettingsSection } from "@/components/expert/profile/SettingsSection";
import { AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState, useRef } from "react";

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editRef = useRef<HTMLDivElement>(null);
  const [scrollToEdit, setScrollToEdit] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { navigate("/auth"); return null; }
      return data.session;
    },
  });

  const userId = session?.user?.id;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["expert-profile-full", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Expert profile
      const { data: ep } = await supabase
        .from("expert_profiles")
        .select("id, full_name, email, created_at, payment_method_connected")
        .eq("user_id", userId!)
        .single();

      // Annotator profile
      const { data: ap } = await supabase
        .from("annotator_profiles")
        .select("*")
        .eq("expert_id", ep?.id || "")
        .maybeSingle();

      // Certifications
      const { data: certs } = await supabase
        .from("annotator_domain_certifications")
        .select("domain, tier, score, status, issued_at, valid_until")
        .eq("user_id", userId!)
        .eq("status", "valid");

      // Experience
      const { data: experience } = await (supabase as any)
        .from("expert_experience")
        .select("*")
        .eq("expert_id", userId!)
        .order("sort_order", { ascending: true });

      // Education
      const { data: education } = await (supabase as any)
        .from("expert_education")
        .select("*")
        .eq("expert_id", userId!)
        .order("sort_order", { ascending: true });

      // Languages
      const { data: languages } = await (supabase as any)
        .from("expert_languages")
        .select("*")
        .eq("expert_id", userId!);

      // Weekly schedule
      const { data: scheduleData } = await (supabase as any)
        .from("expert_weekly_schedule")
        .select("*")
        .eq("expert_id", userId!)
        .maybeSingle();

      // Warnings
      const { data: warnings } = await supabase
        .from("annotation_warnings")
        .select("*")
        .eq("annotator_id", ap?.id || "")
        .order("created_at", { ascending: false })
        .limit(10);

      // Payments summary
      const { data: payments } = await supabase
        .from("annotation_payments")
        .select("final_amount, status, created_at")
        .eq("annotator_id", ap?.id || "")
        .order("created_at", { ascending: false });

      const totalEarned = payments?.filter(p => p.status === "paid").reduce((s, p) => s + (p.final_amount || 0), 0) || 0;
      const pendingQA = payments?.filter(p => p.status === "pending").reduce((s, p) => s + (p.final_amount || 0), 0) || 0;

      // Balance
      const { data: balance } = await supabase
        .from("expert_balances")
        .select("available_balance")
        .eq("expert_id", userId!)
        .maybeSingle();

      // Compute profile completion
      let completionSteps = 0;
      let totalSteps = 5;
      if (ep?.full_name) completionSteps++;
      if ((experience || []).length > 0) completionSteps++;
      if ((education || []).length > 0) completionSteps++;
      if ((languages || []).length > 0) completionSteps++;
      if (scheduleData?.schedule && Object.keys(scheduleData.schedule).length > 0) completionSteps++;

      return {
        annotatorProfile: ap,
        expertProfile: ep,
        certifications: certs || [],
        experience: experience || [],
        education: education || [],
        languages: languages || [],
        timezone: scheduleData?.timezone || "Europe/Paris",
        schedule: (scheduleData?.schedule || {}) as Record<string, string[]>,
        warnings: warnings || [],
        totalEarned,
        pendingQA,
        availableBalance: balance?.available_balance || 0,
        completionPct: Math.round((completionSteps / totalSteps) * 100),
        weeklyEarnings: [] as { week: string; amount: number }[],
      };
    },
  });

  const handleEdit = () => {
    setScrollToEdit(true);
    setTimeout(() => {
      editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["expert-profile-full"] });
  };

  if (isLoading) {
    return (
      <ExpertDashboardLayout>
        <div className="space-y-6">
          <div className="flex gap-8">
            <div className="w-80 shrink-0 space-y-4">
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
              <Skeleton className="h-6 w-40 mx-auto" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          </div>
        </div>
      </ExpertDashboardLayout>
    );
  }

  if (!profile?.expertProfile) {
    return (
      <ExpertDashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">Profil non trouvé</h2>
          <p className="text-muted-foreground text-sm">Votre profil expert n'a pas été trouvé.</p>
        </div>
      </ExpertDashboardLayout>
    );
  }

  const ap = profile.annotatorProfile;
  const ep = profile.expertProfile;
  const name = ep.full_name || "Expert";
  const email = ep.email || "";
  const suspensionStatus = ap?.suspended_until && new Date(ap.suspended_until) > new Date() ? "suspended" : ap?.is_active === false ? "banned" : (ap?.warnings_count || 0) > 0 ? "warned" : "active";
  const isIncomplete = profile.completionPct < 100;

  return (
    <ExpertDashboardLayout userName={name}>
      {/* Incomplete banner */}
      {isIncomplete && (
        <div className="mb-6 border border-amber-500/20 bg-amber-500/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Complétez votre profil pour être assigné aux meilleures tâches.</p>
            <span className="text-xs font-mono text-muted-foreground">{profile.completionPct}%</span>
          </div>
          <Progress value={profile.completionPct} className="h-1.5" />
        </div>
      )}

      {/* Suspended banner */}
      {suspensionStatus === "suspended" && ap?.suspended_until && (
        <div className="mb-6 bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <p className="text-sm font-medium text-destructive">
            Votre compte est suspendu jusqu'au {new Date(ap.suspended_until).toLocaleDateString("fr-FR")}.
            {ap.suspension_reason && ` Motif : ${ap.suspension_reason}`}
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="lg:sticky lg:top-8">
            <ProfileSidebar
              name={name}
              email={email}
              suspensionStatus={suspensionStatus}
              certifications={profile.certifications}
              trustScore={ap?.trust_score || 0}
              alphaAvg={ap?.overall_accuracy || null}
              totalTasks={ap?.total_annotations || 0}
              tasksThisMonth={ap?.current_daily_count || 0}
              memberSince={ep.created_at ? new Date(ep.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—"}
              onEdit={handleEdit}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Section 1 - Personal Info */}
          <section ref={editRef} className="border-b border-border pb-8">
            <PersonalInfoSection
              userId={userId!}
              experience={profile.experience}
              education={profile.education}
              languages={profile.languages}
              timezone={profile.timezone}
              schedule={profile.schedule}
              onRefresh={refresh}
            />
          </section>

          {/* Section 2 - Performance */}
          <section className="border-b border-border pb-8">
            <h3 className="text-base font-semibold text-foreground mb-4">Performance</h3>
            {profile.certifications.length > 0 ? (
              <PerformanceSection data={null} />
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucune certification valide trouvée pour ce compte.
                </p>
              </div>
            )}
          </section>

          {/* Section 3 - Certifications */}
          <section className="border-b border-border pb-8">
            <h3 className="text-base font-semibold text-foreground mb-4">Certifications</h3>
            <CertificationsSection certifications={profile.certifications} />
          </section>

          {/* Section 4 - Sanctions */}
          <section className="border-b border-border pb-8">
            <h3 className="text-base font-semibold text-foreground mb-4">Historique de conformité</h3>
            <SanctionsSection
              warnings={profile.warnings}
              suspendedUntil={ap?.suspended_until}
              suspensionReason={ap?.suspension_reason}
            />
          </section>

          {/* Section 5 - Revenue */}
          <section className="border-b border-border pb-8">
            <h3 className="text-base font-semibold text-foreground mb-4">Revenus</h3>
            <RevenueSection
              availableBalance={profile.availableBalance}
              pendingQA={profile.pendingQA}
              totalEarned={profile.totalEarned}
              weeklyEarnings={profile.weeklyEarnings}
              canWithdraw={profile.availableBalance >= 50}
            />
          </section>

          {/* Section 6 - Settings */}
          <section className="pb-8">
            <h3 className="text-base font-semibold text-foreground mb-4">Paramètres</h3>
            <SettingsSection email={email} />
          </section>
        </div>
      </div>
    </ExpertDashboardLayout>
  );
}
