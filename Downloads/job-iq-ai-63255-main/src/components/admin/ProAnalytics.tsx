import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Euro, Users, Briefcase, CheckCircle,
  Calendar, Target, Award, Clock, Building2, Globe
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "#8b5cf6", "#06b6d4"];

interface MonthlyData {
  month: string;
  revenue: number;
  margin: number;
  placements: number;
  experts: number;
}

interface ExpertPerformance {
  name: string;
  score: number;
  placements: number;
  revenue: number;
}

interface CountryData {
  country: string;
  experts: number;
  placements: number;
}

const ProAnalytics = () => {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [expertPerformance, setExpertPerformance] = useState<ExpertPerformance[]>([]);
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalMargin: 0,
    avgDailyRate: 0,
    conversionRate: 0,
    verifiedExperts: 0,
    activeClients: 0,
    growthRate: 0,
    avgPlacementDuration: 0
  });

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      // Fetch all data in parallel
      const [
        placementsRes,
        timesheetsRes,
        expertsRes,
        testSubmissionsRes,
        clientsRes,
        invoicesRes
      ] = await Promise.all([
        supabase.from("placements").select("*"),
        supabase.from("timesheets").select("*, placement:placements(client_daily_rate, stef_margin, expert_daily_rate)"),
        supabase.from("expert_profiles").select("*"),
        supabase.from("test_submissions").select("*"),
        supabase.from("clients").select("*"),
        supabase.from("invoices").select("*")
      ]);

      const placements = placementsRes.data || [];
      const timesheets = timesheetsRes.data || [];
      const experts = expertsRes.data || [];
      const testSubmissions = testSubmissionsRes.data || [];
      const clients = clientsRes.data || [];
      const invoices = invoicesRes.data || [];

      // Calculate Monthly Data (last 6 months)
      const monthlyStats: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        const monthNum = date.getMonth() + 1;
        const yearNum = date.getFullYear();

        const monthTimesheets = timesheets.filter(ts => 
          ts.month === monthNum && ts.year === yearNum && 
          (ts.status === "approved" || ts.status === "invoiced")
        );

        let revenue = 0;
        let margin = 0;
        monthTimesheets.forEach((ts: any) => {
          if (ts.placement) {
            revenue += ts.days_worked * (ts.placement.client_daily_rate || 0);
            margin += ts.days_worked * (ts.placement.stef_margin || 0);
          }
        });

        const monthPlacements = placements.filter(p => {
          const startDate = new Date(p.start_date);
          return startDate >= monthStart && startDate <= monthEnd;
        });

        const monthExperts = experts.filter(e => {
          const created = new Date(e.created_at || "");
          return created >= monthStart && created <= monthEnd && e.onboarding_completed;
        });

        monthlyStats.push({
          month: format(date, "MMM yy", { locale: fr }),
          revenue,
          margin,
          placements: monthPlacements.length,
          experts: monthExperts.length
        });
      }
      setMonthlyData(monthlyStats);

      // Calculate Expert Performance (top 10)
      const expertStats: ExpertPerformance[] = experts
        .filter(e => e.onboarding_completed)
        .map(expert => {
          const expertPlacements = placements.filter(p => p.expert_id === expert.id);
          const expertTimesheets = timesheets.filter(ts => ts.expert_id === expert.id);
          const submission = testSubmissions.find(s => s.candidate_id === expert.id);
          
          let revenue = 0;
          expertTimesheets.forEach((ts: any) => {
            if (ts.placement) {
              revenue += ts.days_worked * (ts.placement.client_daily_rate || 0);
            }
          });

          return {
            name: expert.full_name,
            score: submission?.test_score || 0,
            placements: expertPlacements.length,
            revenue
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      setExpertPerformance(expertStats);

      // Calculate Country Distribution
      const countryStats: Record<string, { experts: number; placements: number }> = {};
      experts.filter(e => e.onboarding_completed).forEach(expert => {
        const country = expert.country || "Non spécifié";
        if (!countryStats[country]) {
          countryStats[country] = { experts: 0, placements: 0 };
        }
        countryStats[country].experts++;
        const expertPlacements = placements.filter(p => p.expert_id === expert.id);
        countryStats[country].placements += expertPlacements.length;
      });
      setCountryData(Object.entries(countryStats).map(([country, data]) => ({
        country,
        ...data
      })).sort((a, b) => b.experts - a.experts).slice(0, 6));

      // Calculate Placement Status
      const statusCounts: Record<string, number> = {};
      placements.forEach(p => {
        const status = p.status || "unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      setStatusData(Object.entries(statusCounts).map(([name, value]) => ({
        name: name === "active" ? "Actif" : name === "completed" ? "Terminé" : name === "pending" ? "En attente" : name,
        value
      })));

      // Calculate KPIs
      const totalRevenue = monthlyStats.reduce((sum, m) => sum + m.revenue, 0);
      const totalMargin = monthlyStats.reduce((sum, m) => sum + m.margin, 0);
      const currentMonthRevenue = monthlyStats[monthlyStats.length - 1]?.revenue || 0;
      const lastMonthRevenue = monthlyStats[monthlyStats.length - 2]?.revenue || 0;
      const growthRate = lastMonthRevenue > 0 ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;
      
      const verifiedExperts = testSubmissions.filter(s => (s.test_score || 0) >= 80).length;
      const avgDailyRate = placements.length > 0 
        ? placements.reduce((sum, p) => sum + (p.client_daily_rate || 0), 0) / placements.length 
        : 0;
      const conversionRate = experts.length > 0 
        ? (experts.filter(e => placements.some(p => p.expert_id === e.id)).length / experts.length) * 100 
        : 0;

      setKpis({
        totalRevenue,
        totalMargin,
        avgDailyRate,
        conversionRate,
        verifiedExperts,
        activeClients: clients.filter(c => c.is_active).length,
        growthRate,
        avgPlacementDuration: 0
      });

    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `${value.toLocaleString()}€`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Euro className="h-5 w-5 text-primary" />
              {kpis.growthRate >= 0 ? (
                <Badge variant="default" className="bg-green-500/20 text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{kpis.growthRate.toFixed(1)}%
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-500/20 text-red-600">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {kpis.growthRate.toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">CA Total (6 mois)</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <Badge variant="outline" className="text-green-600">
                {((kpis.totalMargin / (kpis.totalRevenue || 1)) * 100).toFixed(1)}%
              </Badge>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(kpis.totalMargin)}</p>
            <p className="text-xs text-muted-foreground">Marge Totale</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Award className="h-5 w-5 text-purple-500" />
              <Badge variant="outline" className="text-purple-600">
                IA Vérifié
              </Badge>
            </div>
            <p className="text-2xl font-bold">{kpis.verifiedExperts}</p>
            <p className="text-xs text-muted-foreground">Experts Vérifiés</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-5 w-5 text-amber-500" />
              <Badge variant="outline" className="text-amber-600">
                Conversion
              </Badge>
            </div>
            <p className="text-2xl font-bold">{kpis.conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Taux de placement</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="revenue">Revenus</TabsTrigger>
          <TabsTrigger value="placements">Placements</TabsTrigger>
          <TabsTrigger value="experts">Experts</TabsTrigger>
          <TabsTrigger value="geography">Géographie</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  Évolution CA & Marge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      name="CA"
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="margin" 
                      name="Marge"
                      stroke="hsl(var(--success))" 
                      fillOpacity={1} 
                      fill="url(#colorMargin)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Statut des Placements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {statusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Placements Tab */}
        <TabsContent value="placements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Nouveaux Placements & Experts par Mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar dataKey="placements" name="Placements" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="experts" name="Nouveaux Experts" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Experts Tab */}
        <TabsContent value="experts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top 10 Experts par CA Généré
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={expertPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name) => [
                      name === "revenue" ? formatCurrency(value) : value,
                      name === "revenue" ? "CA" : name === "score" ? "Score IA" : "Placements"
                    ]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="CA Généré" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scores IA des Top Experts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expertPerformance.slice(0, 5).map((expert, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium truncate max-w-[150px]">{expert.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {expert.score >= 80 && (
                          <Badge variant="default" className="bg-green-500/20 text-green-600 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Vérifié
                          </Badge>
                        )}
                        <span className="font-bold">{expert.score}/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métriques Clés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">TJM Moyen Client</span>
                    <span className="font-bold">{formatCurrency(kpis.avgDailyRate)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Clients Actifs</span>
                    <span className="font-bold">{kpis.activeClients}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Taux de Placement</span>
                    <span className="font-bold">{kpis.conversionRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Experts Vérifiés IA</span>
                    <span className="font-bold">{kpis.verifiedExperts}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Geography Tab */}
        <TabsContent value="geography" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Distribution par Pays
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={countryData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="country" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Bar dataKey="experts" name="Experts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="placements" name="Placements" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Détail par Pays</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {countryData.map((country, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{country.country}</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-muted-foreground">
                          <Users className="h-3 w-3 inline mr-1" />
                          {country.experts}
                        </span>
                        <span className="text-muted-foreground">
                          <Briefcase className="h-3 w-3 inline mr-1" />
                          {country.placements}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProAnalytics;
