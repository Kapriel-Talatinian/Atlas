import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowRight } from "lucide-react";

interface RevenueSectionProps {
  availableBalance: number;
  pendingQA: number;
  totalEarned: number;
  weeklyEarnings: { week: string; amount: number }[];
  canWithdraw: boolean;
}

export function RevenueSection({ availableBalance, pendingQA, totalEarned, weeklyEarnings, canWithdraw }: RevenueSectionProps) {
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="font-mono text-xl font-bold text-foreground">{availableBalance.toFixed(2)} €</p>
            <p className="text-xs text-muted-foreground mt-1">Solde disponible</p>
            {canWithdraw && (
              <Button size="sm" className="mt-2 h-7 text-xs">Retirer</Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="font-mono text-xl font-bold text-foreground">{pendingQA.toFixed(2)} €</p>
            <p className="text-xs text-muted-foreground mt-1">En attente de QA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="font-mono text-xl font-bold text-foreground">{totalEarned.toFixed(2)} €</p>
            <p className="text-xs text-muted-foreground mt-1">Total gagné</p>
          </CardContent>
        </Card>
      </div>

      {/* Mini Chart */}
      {weeklyEarnings.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground mb-3">Gains par semaine</p>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyEarnings}>
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`${value.toFixed(2)} €`, "Gains"]}
                  />
                  <Bar dataKey="amount" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
        <Link to="/expert/earnings">
          Voir le détail complet
          <ArrowRight className="w-4 h-4" />
        </Link>
      </Button>
    </div>
  );
}
