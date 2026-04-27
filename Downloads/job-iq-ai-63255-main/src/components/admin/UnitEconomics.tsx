import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Clock, 
  Target,
  Plus,
  Save,
  RefreshCw
} from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UnitEconomicsData {
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  paybackPeriod: number;
  monthlyChurnRate: number;
  grossMargin: number;
  avgRevenuePerClient: number;
  avgClientLifetime: number;
}

interface MarketingSpend {
  id: string;
  month: string;
  channel: string;
  spend_amount: number;
  leads_generated: number;
  clients_acquired: number;
}

export function UnitEconomics() {
  const [data, setData] = useState<UnitEconomicsData>({
    cac: 0,
    ltv: 0,
    ltvCacRatio: 0,
    paybackPeriod: 0,
    monthlyChurnRate: 0,
    grossMargin: 0,
    avgRevenuePerClient: 0,
    avgClientLifetime: 12,
  });
  const [marketingSpends, setMarketingSpends] = useState<MarketingSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSpend, setNewSpend] = useState({
    month: new Date().toISOString().slice(0, 7),
    channel: "google_ads",
    spend_amount: 0,
    leads_generated: 0,
    clients_acquired: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load marketing spends
      const { data: spends } = await supabase
        .from("marketing_spend")
        .select("*")
        .order("month", { ascending: false })
        .limit(12);
      
      setMarketingSpends(spends || []);

      // Calculate unit economics
      await calculateMetrics(spends || []);
    } catch (error) {
      console.error("Error loading unit economics:", error);
    } finally {
      setLoading(false);
    }
  }

  async function calculateMetrics(spends: MarketingSpend[]) {
    setCalculating(true);
    try {
      // Get total marketing spend and clients acquired
      const totalSpend = spends.reduce((sum, s) => sum + Number(s.spend_amount), 0);
      const totalClientsAcquired = spends.reduce((sum, s) => sum + s.clients_acquired, 0);
      
      // Calculate CAC
      const cac = totalClientsAcquired > 0 ? totalSpend / totalClientsAcquired : 0;

      // Get placements for revenue estimation
      const { data: activePlacements } = await supabase
        .from("placements")
        .select("expert_daily_rate, client_id")
        .eq("status", "active");

      // Get client count
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      // Get placements for churn calculation
      const { data: placements } = await supabase
        .from("placements")
        .select("id, status, start_date, end_date, client_id");

      // Calculate total revenue from active placements
      const totalRevenue = (activePlacements || []).reduce((sum, p) => sum + (Number(p.expert_daily_rate || 0) * 220), 0);
      const commission = totalRevenue * 0.20; // 20% commission

      // Calculate average revenue per client
      const avgRevenuePerClient = clientCount && clientCount > 0 ? commission / clientCount : 0;
      const monthlyRevenuePerClient = avgRevenuePerClient / 12;

      // Estimate client lifetime (in months)
      const avgClientLifetime = 24; // Assume 24 months average

      // Calculate LTV
      const ltv = monthlyRevenuePerClient * avgClientLifetime;

      // LTV:CAC Ratio
      const ltvCacRatio = cac > 0 ? ltv / cac : 0;

      // Payback Period (months)
      const paybackPeriod = monthlyRevenuePerClient > 0 ? cac / monthlyRevenuePerClient : 0;

      // Churn rate calculation
      const endedPlacements = (placements || []).filter(p => p.status === "ended" || p.end_date).length;
      const totalPlacements = (placements || []).length;
      const monthlyChurnRate = totalPlacements > 0 ? (endedPlacements / totalPlacements) * 100 / 12 : 0;

      // Gross margin (commission rate)
      const grossMargin = 60; // 60% gross margin on commission

      setData({
        cac,
        ltv,
        ltvCacRatio,
        paybackPeriod,
        monthlyChurnRate,
        grossMargin,
        avgRevenuePerClient,
        avgClientLifetime,
      });

      // Store metrics in history
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("platform_metrics_history").upsert([
        { metric_date: today, metric_type: "cac", metric_value: cac },
        { metric_date: today, metric_type: "ltv", metric_value: ltv },
        { metric_date: today, metric_type: "churn_rate", metric_value: monthlyChurnRate },
      ], { onConflict: "metric_date,metric_type" });

    } catch (error) {
      console.error("Error calculating metrics:", error);
    } finally {
      setCalculating(false);
    }
  }

  async function addMarketingSpend() {
    try {
      const { error } = await supabase.from("marketing_spend").insert({
        month: `${newSpend.month}-01`,
        channel: newSpend.channel,
        spend_amount: newSpend.spend_amount,
        leads_generated: newSpend.leads_generated,
        clients_acquired: newSpend.clients_acquired,
      });

      if (error) throw error;

      toast.success("Dépense marketing ajoutée");
      setDialogOpen(false);
      setNewSpend({
        month: new Date().toISOString().slice(0, 7),
        channel: "google_ads",
        spend_amount: 0,
        leads_generated: 0,
        clients_acquired: 0,
      });
      loadData();
    } catch (error) {
      console.error("Error adding marketing spend:", error);
      toast.error("Erreur lors de l'ajout");
    }
  }

  function getRatioColor(ratio: number) {
    if (ratio >= 3) return "text-green-600 bg-green-100";
    if (ratio >= 2) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  }

  function getRatioLabel(ratio: number) {
    if (ratio >= 3) return "Excellent";
    if (ratio >= 2) return "Acceptable";
    return "À améliorer";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Unit Economics</h2>
          <p className="text-muted-foreground">Métriques clés pour les investisseurs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={calculating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${calculating ? "animate-spin" : ""}`} />
            Recalculer
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter dépense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une dépense marketing</DialogTitle>
                <DialogDescription>
                  Enregistrez vos dépenses marketing pour calculer le CAC
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Mois</Label>
                    <Input
                      type="month"
                      value={newSpend.month}
                      onChange={(e) => setNewSpend({ ...newSpend, month: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Canal</Label>
                    <Select
                      value={newSpend.channel}
                      onValueChange={(value) => setNewSpend({ ...newSpend, channel: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google_ads">Google Ads</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="organic">Organic</SelectItem>
                        <SelectItem value="events">Events</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Montant dépensé (€)</Label>
                  <Input
                    type="number"
                    value={newSpend.spend_amount}
                    onChange={(e) => setNewSpend({ ...newSpend, spend_amount: Number(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Leads générés</Label>
                    <Input
                      type="number"
                      value={newSpend.leads_generated}
                      onChange={(e) => setNewSpend({ ...newSpend, leads_generated: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Clients acquis</Label>
                    <Input
                      type="number"
                      value={newSpend.clients_acquired}
                      onChange={(e) => setNewSpend({ ...newSpend, clients_acquired: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <Button onClick={addMarketingSpend} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CAC */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              CAC (Coût d'Acquisition)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.cac.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Coût pour acquérir un client
            </p>
          </CardContent>
        </Card>

        {/* LTV */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              LTV (Valeur Vie Client)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.ltv.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Revenu total par client
            </p>
          </CardContent>
        </Card>

        {/* LTV:CAC Ratio */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Ratio LTV:CAC
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold">
                {data.ltvCacRatio.toFixed(1)}:1
              </div>
              <Badge className={getRatioColor(data.ltvCacRatio)}>
                {getRatioLabel(data.ltvCacRatio)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Cible: 3:1 minimum
            </p>
          </CardContent>
        </Card>

        {/* Payback Period */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Payback Period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.paybackPeriod.toFixed(1)} mois
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Temps de récupération du CAC
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taux de Churn Mensuel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{data.monthlyChurnRate.toFixed(2)}%</div>
              {data.monthlyChurnRate < 5 ? (
                <TrendingDown className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingUp className="h-5 w-5 text-red-500" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">Cible: {"<"}5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Marge Brute</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.grossMargin}%</div>
            <p className="text-sm text-muted-foreground">Sur commission (20%)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenu Moyen par Client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.avgRevenuePerClient.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </div>
            <p className="text-sm text-muted-foreground">Annuel</p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Spend History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Dépenses Marketing</CardTitle>
          <CardDescription>12 derniers mois</CardDescription>
        </CardHeader>
        <CardContent>
          {marketingSpends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune dépense marketing enregistrée. Ajoutez vos dépenses pour calculer le CAC.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Mois</th>
                    <th className="text-left py-2">Canal</th>
                    <th className="text-right py-2">Dépense</th>
                    <th className="text-right py-2">Leads</th>
                    <th className="text-right py-2">Clients</th>
                    <th className="text-right py-2">CAC</th>
                  </tr>
                </thead>
                <tbody>
                  {marketingSpends.map((spend) => (
                    <tr key={spend.id} className="border-b">
                      <td className="py-2">{new Date(spend.month).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</td>
                      <td className="py-2 capitalize">{spend.channel.replace("_", " ")}</td>
                      <td className="py-2 text-right">{Number(spend.spend_amount).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</td>
                      <td className="py-2 text-right">{spend.leads_generated}</td>
                      <td className="py-2 text-right">{spend.clients_acquired}</td>
                      <td className="py-2 text-right">
                        {spend.clients_acquired > 0 
                          ? (Number(spend.spend_amount) / spend.clients_acquired).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
