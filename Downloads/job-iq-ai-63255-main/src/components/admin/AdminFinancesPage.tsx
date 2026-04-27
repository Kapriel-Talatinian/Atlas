import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { AdminPendingPayments } from "./AdminPendingPayments";
import { AdminPendingWithdrawals } from "./AdminPendingWithdrawals";

export function AdminFinancesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-finances"],
    queryFn: async () => {
      const { data: invoices } = await supabase.from("invoices").select("*, clients(company_name)").order("created_at", { ascending: false });
      const { data: payments } = await supabase.from("annotation_payments").select("annotator_id, final_amount, status, created_at").order("created_at", { ascending: false });

      const totalRevenue = invoices?.reduce((s, i) => s + ((i as any).invoice_amount_ttc || 0), 0) || 0;
      const totalCosts = payments?.filter(p => p.status === "paid").reduce((s, p) => s + (p.final_amount || 0), 0) || 0;

      // Monthly P&L
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthRevenue = invoices?.filter(i => new Date(i.created_at) >= currentMonthStart).reduce((s, i) => s + ((i as any).invoice_amount_ttc || 0), 0) || 0;
      const monthCosts = payments?.filter(p => p.status === "paid" && new Date(p.created_at) >= currentMonthStart).reduce((s, p) => s + (p.final_amount || 0), 0) || 0;

      // Monthly chart data (last 6 months)
      const monthlyData: any[] = [];
      for (let m = 5; m >= 0; m--) {
        const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
        const label = start.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
        const rev = invoices?.filter(i => { const d = new Date(i.created_at); return d >= start && d < end; }).reduce((s, i) => s + ((i as any).invoice_amount_ttc || 0), 0) || 0;
        const cost = payments?.filter(p => p.status === "paid" && (() => { const d = new Date(p.created_at); return d >= start && d < end; })()).reduce((s, p) => s + (p.final_amount || 0), 0) || 0;
        monthlyData.push({ month: label, revenus: Math.round(rev), couts: Math.round(cost) });
      }

      // Per-client revenue
      const clientRevenue: Record<string, { name: string; total: number }> = {};
      invoices?.forEach(i => {
        const name = (i as any).clients?.company_name || "Inconnu";
        if (!clientRevenue[i.client_id]) clientRevenue[i.client_id] = { name, total: 0 };
        clientRevenue[i.client_id!].total += (i as any).invoice_amount_ttc || 0;
      });

      return {
        totalRevenue, totalCosts, monthRevenue, monthCosts,
        margin: totalRevenue - totalCosts,
        marginPct: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue * 100) : 0,
        monthlyData,
        clientRevenue: Object.values(clientRevenue).sort((a, b) => b.total - a.total),
        invoices: invoices?.slice(0, 20) || [],
      };
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-foreground">Finances</h1>

      {/* Pending payments & withdrawals */}
      <div className="grid md:grid-cols-1 gap-6">
        <AdminPendingPayments />
        <AdminPendingWithdrawals />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <FinKpi label="Revenus du mois" value={`${data.monthRevenue.toFixed(0)} EUR`} />
        <FinKpi label="Revenus total" value={`${data.totalRevenue.toFixed(0)} EUR`} />
        <FinKpi label="Coûts experts (mois)" value={`${data.monthCosts.toFixed(0)} EUR`} />
        <FinKpi label="Marge brute" value={`${data.margin.toFixed(0)} EUR`} className={data.margin >= 0 ? "text-success" : "text-destructive"} />
        <FinKpi label="Marge %" value={`${data.marginPct.toFixed(1)}%`} className={data.marginPct >= 0 ? "text-success" : "text-destructive"} />
      </div>

      {/* P&L chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">P&L mensuel</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.monthlyData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenus" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenus" />
              <Bar dataKey="couts" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Coûts experts" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by client */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Revenus par client</CardTitle></CardHeader>
          <CardContent>
            {data.clientRevenue.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[12px] uppercase tracking-wider">Client</TableHead>
                    <TableHead className="text-[12px] uppercase tracking-wider text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.clientRevenue.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{c.total.toFixed(0)} EUR</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun revenu</p>
            )}
          </CardContent>
        </Card>

        {/* Recent invoices */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Factures récentes</CardTitle></CardHeader>
          <CardContent>
            {data.invoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[12px] uppercase tracking-wider">Numéro</TableHead>
                    <TableHead className="text-[12px] uppercase tracking-wider text-right">Montant</TableHead>
                    <TableHead className="text-[12px] uppercase tracking-wider">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-[13px] font-mono">{inv.invoice_number}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{inv.total?.toFixed(2)} EUR</TableCell>
                      <TableCell><span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{inv.status}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune facture</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinKpi({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className={cn("font-mono text-xl font-bold leading-none", className || "text-foreground")}>{value}</p>
      <p className="text-[12px] text-muted-foreground mt-2">{label}</p>
    </CardContent></Card>
  );
}
