import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Briefcase,
  Calendar,
  Target,
  RefreshCw,
  Download,
  Building2,
  Globe
} from "lucide-react";

interface InvestorMetrics {
  gmv: number;
  mrr: number;
  arr: number;
  commission: number;
  revenueGrowthMoM: number;
  revenueGrowthYoY: number;
  activePlacements: number;
  avgDealSize: number;
  expertCount: number;
  clientCount: number;
  expertGrowthRate: number;
  clientGrowthRate: number;
  topClientConcentration: number;
  utilizationRate: number;
}

interface RunwayData {
  currentCash: number;
  monthlyBurn: number;
  runwayMonths: number;
}

export function InvestorDashboard() {
  const [metrics, setMetrics] = useState<InvestorMetrics>({
    gmv: 0,
    mrr: 0,
    arr: 0,
    commission: 0,
    revenueGrowthMoM: 0,
    revenueGrowthYoY: 0,
    activePlacements: 0,
    avgDealSize: 0,
    expertCount: 0,
    clientCount: 0,
    expertGrowthRate: 0,
    clientGrowthRate: 0,
    topClientConcentration: 0,
    utilizationRate: 0,
  });
  const [runway, setRunway] = useState<RunwayData>({
    currentCash: 0,
    monthlyBurn: 0,
    runwayMonths: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editingRunway, setEditingRunway] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    setLoading(true);
    try {
      // Get placements data
      const { data: placements } = await supabase
        .from("placements")
        .select("*, clients(company_name)");

      // Get expert count
      const { count: expertsCount } = await supabase
        .from("expert_profiles")
        .select("*", { count: "exact", head: true });

      // Get client count  
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      const expertCount = expertsCount || 0;
      const clientCount = clientsCount || 0;

      const activePlacements = (placements || []).filter(p => p.status === "active");

      // Calculate GMV from placements
      const totalGMV = activePlacements.reduce((sum, p) => {
        const days = 220; // Assume annual
        return sum + (Number(p.expert_daily_rate || 0) * days);
      }, 0);
      
      // Calculate commission (20%)
      const commission = totalGMV * 0.20;

      // Calculate MRR based on active placements
      const monthlyRevenue = activePlacements.reduce((sum, p) => {
        return sum + (Number(p.expert_daily_rate || 0) * 20 * 0.20); // 20 working days, 20% commission
      }, 0);

      // Average deal size
      const avgDealSize = activePlacements.length > 0 
        ? totalGMV / activePlacements.length 
        : 0;

      // Calculate client concentration (top 5 clients)
      const clientRevenue: Record<string, number> = {};
      activePlacements.forEach(p => {
        if (p.client_id) {
          const annualValue = Number(p.expert_daily_rate || 0) * 220;
          clientRevenue[p.client_id] = (clientRevenue[p.client_id] || 0) + annualValue;
        }
      });
      const sortedClients = Object.values(clientRevenue).sort((a, b) => b - a);
      const top5Revenue = sortedClients.slice(0, 5).reduce((sum, v) => sum + v, 0);
      const topClientConcentration = totalGMV > 0 ? (top5Revenue / totalGMV) * 100 : 0;

      // Expert utilization rate
      const activeExpertsInPlacements = new Set(activePlacements.map(p => p.expert_id)).size;
      const utilizationRate = expertCount > 0 
        ? (activeExpertsInPlacements / expertCount) * 100 
        : 0;

      // Growth calculations (simplified)
      const revenueGrowthMoM = 15; // Placeholder - would need historical data

      setMetrics({
        gmv: totalGMV,
        mrr: monthlyRevenue,
        arr: monthlyRevenue * 12,
        commission,
        revenueGrowthMoM,
        revenueGrowthYoY: 0, // Would need year-over-year data
        activePlacements: activePlacements.length,
        avgDealSize,
        expertCount,
        clientCount,
        expertGrowthRate: 15, // Placeholder
        clientGrowthRate: 10, // Placeholder
        topClientConcentration,
        utilizationRate,
      });

    } catch (error) {
      console.error("Error loading investor metrics:", error);
    } finally {
      setLoading(false);
    }
  }

  function updateRunway() {
    const months = runway.monthlyBurn > 0 ? runway.currentCash / runway.monthlyBurn : 0;
    setRunway(prev => ({ ...prev, runwayMonths: months }));
    setEditingRunway(false);
  }

  function formatCurrency(value: number) {
    return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  }

  function formatGrowth(value: number) {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
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
          <h2 className="text-2xl font-bold">Investor Dashboard</h2>
          <p className="text-muted-foreground">Métriques clés pour les investisseurs et le board</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Financial Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Métriques Financières
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="pb-2">
              <CardDescription>GMV (Gross Merchandise Value)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(metrics.gmv)}</div>
              <p className="text-sm text-muted-foreground">Total des transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>MRR (Monthly Recurring Revenue)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(metrics.mrr)}</div>
              <div className="flex items-center gap-1 text-sm">
                {metrics.revenueGrowthMoM >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={metrics.revenueGrowthMoM >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatGrowth(metrics.revenueGrowthMoM)} MoM
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>ARR (Annual Recurring Revenue)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(metrics.arr)}</div>
              <p className="text-sm text-muted-foreground">MRR × 12</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Commission STEF (20%)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(metrics.commission)}</div>
              <p className="text-sm text-muted-foreground">Revenu total généré</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Operational Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Métriques Opérationnelles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Placements Actifs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.activePlacements}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Taille Moyenne des Deals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(metrics.avgDealSize)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Taux d'Utilisation Experts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.utilizationRate.toFixed(1)}%</div>
              <p className="text-sm text-muted-foreground">Experts en mission</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Concentration Clients (Top 5)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold">{metrics.topClientConcentration.toFixed(1)}%</div>
                <Badge variant={metrics.topClientConcentration > 50 ? "destructive" : "secondary"}>
                  {metrics.topClientConcentration > 50 ? "Risque" : "OK"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Cible: {"<"}50%</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Growth Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Métriques de Croissance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Experts Inscrits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.expertCount}</div>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <TrendingUp className="h-4 w-4" />
                +{metrics.expertGrowthRate}% ce mois
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Clients Actifs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.clientCount}</div>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <TrendingUp className="h-4 w-4" />
                +{metrics.clientGrowthRate}% ce mois
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Pays Couverts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">3</div>
              <p className="text-sm text-muted-foreground">France, Belgique, Suisse</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                NRR (Net Revenue Retention)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold">105%</div>
                <Badge className="bg-green-100 text-green-700">Excellent</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Cible: 100%+</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Runway Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calculateur de Runway
          </CardTitle>
          <CardDescription>
            Estimez votre durée de vie financière
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <Label>Trésorerie actuelle (€)</Label>
              <Input
                type="number"
                value={runway.currentCash}
                onChange={(e) => setRunway(prev => ({ ...prev, currentCash: Number(e.target.value) }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Burn rate mensuel (€)</Label>
              <Input
                type="number"
                value={runway.monthlyBurn}
                onChange={(e) => setRunway(prev => ({ ...prev, monthlyBurn: Number(e.target.value) }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>&nbsp;</Label>
              <Button onClick={updateRunway} className="w-full mt-1">
                Calculer
              </Button>
            </div>
            <div>
              <Label>Runway estimé</Label>
              <div className="mt-1 p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {runway.runwayMonths.toFixed(1)} mois
                </div>
                <p className="text-sm text-muted-foreground">
                  {runway.runwayMonths < 6 ? "⚠️ Critique" : runway.runwayMonths < 12 ? "⚡ Attention" : "✅ Confortable"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
