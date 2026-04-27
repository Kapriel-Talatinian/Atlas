import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";

interface CohortData {
  cohort: string;
  month0: number;
  month1: number;
  month3: number;
  month6: number;
  month12: number;
  totalUsers: number;
}

export function CohortAnalysis() {
  const [expertCohorts, setExpertCohorts] = useState<CohortData[]>([]);
  const [clientCohorts, setClientCohorts] = useState<CohortData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCohortData();
  }, []);

  async function loadCohortData() {
    setLoading(true);
    try {
      // Load expert profiles for cohort analysis
      const { data: experts } = await supabase
        .from("expert_profiles")
        .select("id, created_at, onboarding_completed, kyc_status")
        .order("created_at", { ascending: true });

      // Load clients
      const { data: clients } = await supabase
        .from("clients")
        .select("id, created_at")
        .order("created_at", { ascending: true });

      // Load placements to track activity
      const { data: placements } = await supabase
        .from("placements")
        .select("id, expert_id, client_id, start_date, end_date, status");

      // Load job applications for expert activity
      const { data: applications } = await supabase
        .from("job_applications")
        .select("id, expert_id, created_at");

      // Calculate expert cohorts
      const expertCohortData = calculateCohorts(
        experts || [],
        applications || [],
        "expert"
      );
      setExpertCohorts(expertCohortData);

      // Calculate client cohorts
      const clientCohortData = calculateCohorts(
        clients || [],
        placements || [],
        "client"
      );
      setClientCohorts(clientCohortData);

    } catch (error) {
      console.error("Error loading cohort data:", error);
    } finally {
      setLoading(false);
    }
  }

  function calculateCohorts(
    users: any[],
    activities: any[],
    type: "expert" | "client"
  ): CohortData[] {
    const cohorts: Record<string, CohortData> = {};
    const now = new Date();

    users.forEach((user) => {
      const createdAt = new Date(user.created_at);
      const cohortKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;

      if (!cohorts[cohortKey]) {
        cohorts[cohortKey] = {
          cohort: cohortKey,
          month0: 0,
          month1: 0,
          month3: 0,
          month6: 0,
          month12: 0,
          totalUsers: 0,
        };
      }

      cohorts[cohortKey].totalUsers++;

      // Check retention at different periods
      const monthsSinceSignup = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      // Month 0 - all users are retained at signup
      cohorts[cohortKey].month0++;

      // Check activity for retention
      const userActivities = activities.filter((a) =>
        type === "expert" ? a.expert_id === user.id : a.client_id === user.id
      );

      if (userActivities.length > 0) {
        const lastActivity = new Date(
          Math.max(...userActivities.map((a) => new Date(a.created_at || a.start_date).getTime()))
        );
        const monthsSinceActivity = Math.floor(
          (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        // User is retained if active within the period
        if (monthsSinceSignup >= 1 && monthsSinceActivity <= 1) cohorts[cohortKey].month1++;
        if (monthsSinceSignup >= 3 && monthsSinceActivity <= 3) cohorts[cohortKey].month3++;
        if (monthsSinceSignup >= 6 && monthsSinceActivity <= 6) cohorts[cohortKey].month6++;
        if (monthsSinceSignup >= 12 && monthsSinceActivity <= 12) cohorts[cohortKey].month12++;
      }
    });

    return Object.values(cohorts)
      .sort((a, b) => b.cohort.localeCompare(a.cohort))
      .slice(0, 12);
  }

  function getRetentionColor(rate: number): string {
    if (rate >= 80) return "bg-green-500";
    if (rate >= 60) return "bg-green-400";
    if (rate >= 40) return "bg-yellow-400";
    if (rate >= 20) return "bg-orange-400";
    return "bg-red-400";
  }

  function renderCohortTable(cohorts: CohortData[]) {
    if (cohorts.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Pas assez de données pour l'analyse de cohortes
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-2">Cohorte</th>
              <th className="text-center py-3 px-2">Utilisateurs</th>
              <th className="text-center py-3 px-2">Mois 0</th>
              <th className="text-center py-3 px-2">Mois 1</th>
              <th className="text-center py-3 px-2">Mois 3</th>
              <th className="text-center py-3 px-2">Mois 6</th>
              <th className="text-center py-3 px-2">Mois 12</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.cohort} className="border-b">
                <td className="py-3 px-2 font-medium">
                  {new Date(cohort.cohort + "-01").toLocaleDateString("fr-FR", {
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="py-3 px-2 text-center">{cohort.totalUsers}</td>
                {[
                  cohort.month0,
                  cohort.month1,
                  cohort.month3,
                  cohort.month6,
                  cohort.month12,
                ].map((value, idx) => {
                  const rate = cohort.totalUsers > 0 ? (value / cohort.totalUsers) * 100 : 0;
                  return (
                    <td key={idx} className="py-3 px-2">
                      <div
                        className={`rounded px-2 py-1 text-center text-white text-sm ${getRetentionColor(rate)}`}
                      >
                        {rate.toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyse de Cohortes</CardTitle>
        <CardDescription>
          Rétention des utilisateurs par mois d'inscription
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="experts">
          <TabsList className="mb-4">
            <TabsTrigger value="experts">Experts</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
          </TabsList>
          <TabsContent value="experts">
            {renderCohortTable(expertCohorts)}
          </TabsContent>
          <TabsContent value="clients">
            {renderCohortTable(clientCohorts)}
          </TabsContent>
        </Tabs>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 text-sm">
          <span className="text-muted-foreground">Rétention:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>80%+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-400" />
            <span>60-79%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-yellow-400" />
            <span>40-59%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-400" />
            <span>20-39%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-400" />
            <span>{"<"}20%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
