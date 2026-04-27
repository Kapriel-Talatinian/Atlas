import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Euro, 
  TrendingUp, 
  TrendingDown,
  Building2,
  Users,
  Loader2,
  Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

interface MonthlyRevenue {
  month: string;
  revenue: number;
  margin: number;
  placements: number;
}

interface ClientRevenue {
  id: string;
  company_name: string;
  revenue: number;
  margin: number;
  placements: number;
}

export default function RevenueAnalytics() {
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [clientData, setClientData] = useState<ClientRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [totals, setTotals] = useState({
    revenue: 0,
    margin: 0,
    mtdRevenue: 0,
    mtdMargin: 0,
    avgMarginPercent: 0
  });

  useEffect(() => {
    loadRevenueData();
  }, [year]);

  const loadRevenueData = async () => {
    setLoading(true);
    try {
      // Get all approved timesheets with placement data for the year
      const { data: timesheets, error } = await supabase
        .from("timesheets")
        .select(`
          month,
          year,
          days_worked,
          placement:placements(
            client_daily_rate,
            expert_daily_rate,
            stef_margin,
            client:clients(id, company_name)
          )
        `)
        .eq("year", parseInt(year))
        .in("status", ["approved", "invoiced"]);

      if (error) throw error;

      // Process monthly data
      const monthlyMap = new Map<string, { revenue: number; margin: number; placements: Set<string> }>();
      const clientMap = new Map<string, { company_name: string; revenue: number; margin: number; placements: Set<string> }>();

      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

      // Initialize all months
      for (let i = 0; i < 12; i++) {
        monthlyMap.set(monthNames[i], { revenue: 0, margin: 0, placements: new Set() });
      }

      timesheets?.forEach((ts: any) => {
        if (!ts.placement) return;

        const monthKey = monthNames[ts.month - 1];
        const revenue = ts.days_worked * (ts.placement.client_daily_rate || 0);
        const margin = ts.days_worked * (ts.placement.stef_margin || 0);

        // Update monthly
        const monthData = monthlyMap.get(monthKey)!;
        monthData.revenue += revenue;
        monthData.margin += margin;

        // Update client
        if (ts.placement.client) {
          const clientId = ts.placement.client.id;
          if (!clientMap.has(clientId)) {
            clientMap.set(clientId, {
              company_name: ts.placement.client.company_name,
              revenue: 0,
              margin: 0,
              placements: new Set()
            });
          }
          const clientData = clientMap.get(clientId)!;
          clientData.revenue += revenue;
          clientData.margin += margin;
        }
      });

      // Convert to arrays
      const monthly: MonthlyRevenue[] = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        revenue: Math.round(data.revenue),
        margin: Math.round(data.margin),
        placements: data.placements.size
      }));

      const clients: ClientRevenue[] = Array.from(clientMap.entries())
        .map(([id, data]) => ({
          id,
          company_name: data.company_name,
          revenue: Math.round(data.revenue),
          margin: Math.round(data.margin),
          placements: data.placements.size
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Calculate totals
      const totalRevenue = monthly.reduce((sum, m) => sum + m.revenue, 0);
      const totalMargin = monthly.reduce((sum, m) => sum + m.margin, 0);
      const currentMonth = new Date().getMonth();
      const mtdRevenue = monthly[currentMonth]?.revenue || 0;
      const mtdMargin = monthly[currentMonth]?.margin || 0;
      const avgMarginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

      setMonthlyData(monthly);
      setClientData(clients);
      setTotals({
        revenue: totalRevenue,
        margin: totalMargin,
        mtdRevenue,
        mtdMargin,
        avgMarginPercent: Math.round(avgMarginPercent)
      });
    } catch (error) {
      console.error("Error loading revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(y => y.toString());

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Year Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Analyse des revenus</h2>
          <p className="text-sm text-muted-foreground">Vue détaillée de la performance financière</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[120px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Euro className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">CA annuel</span>
            </div>
            <p className="text-2xl font-bold">{totals.revenue.toLocaleString()}€</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-500" />
              <span className="text-sm text-muted-foreground">Marge annuelle</span>
            </div>
            <p className="text-2xl font-bold">{totals.margin.toLocaleString()}€</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Euro className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">CA MTD</span>
            </div>
            <p className="text-2xl font-bold">{totals.mtdRevenue.toLocaleString()}€</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Marge MTD</span>
            </div>
            <p className="text-2xl font-bold">{totals.mtdMargin.toLocaleString()}€</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Marge moyenne</span>
            </div>
            <p className="text-2xl font-bold">{totals.avgMarginPercent}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Chiffre d'affaires mensuel</CardTitle>
            <CardDescription>Évolution du CA et de la marge</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => `${value.toLocaleString()}€`}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="CA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="margin" name="Marge" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tendance des revenus</CardTitle>
            <CardDescription>Courbe d'évolution mensuelle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => `${value.toLocaleString()}€`}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="CA" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                  <Line type="monotone" dataKey="margin" name="Marge" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={{ fill: 'hsl(142 76% 36%)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Top clients par CA
          </CardTitle>
          <CardDescription>Classement des clients par chiffre d'affaires généré</CardDescription>
        </CardHeader>
        <CardContent>
          {clientData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune donnée disponible pour cette période
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rang</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead className="text-right">Marge %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientData.slice(0, 10).map((client, index) => {
                  const marginPercent = client.revenue > 0 
                    ? Math.round((client.margin / client.revenue) * 100) 
                    : 0;
                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                          {index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{client.company_name}</TableCell>
                      <TableCell className="text-right">{client.revenue.toLocaleString()}€</TableCell>
                      <TableCell className="text-right">{client.margin.toLocaleString()}€</TableCell>
                      <TableCell className="text-right">
                        <Badge className={marginPercent >= 20 ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}>
                          {marginPercent}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
