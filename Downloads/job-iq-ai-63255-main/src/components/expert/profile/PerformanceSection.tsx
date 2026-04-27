import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PerformanceData {
  alphaHistory: { date: string; alpha: number; tasks: number }[];
  tasksByDay: { date: string; scoring: number; dpo: number; fact_checking: number; red_teaming: number }[];
  weeklyTasks: number;
  weeklyAlpha: number;
  weeklyTasksDelta: number;
  weeklyAlphaDelta: number;
  avgTimePerTask: number;
  bestDomain: string;
}

const periods = [
  { label: "7j", value: 7 },
  { label: "30j", value: 30 },
  { label: "90j", value: 90 },
  { label: "Tout", value: 365 },
];

export function PerformanceSection({ data }: { data: PerformanceData | null }) {
  const [period, setPeriod] = useState(30);

  if (!data || data.alphaHistory.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground text-sm">
          Pas encore de données. Complétez vos premières tâches.
        </p>
      </div>
    );
  }

  const filteredAlpha = data.alphaHistory.slice(-period);
  const filteredTasks = data.tasksByDay.slice(-period);

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex items-center justify-end gap-1">
        {periods.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Alpha Chart */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-foreground mb-4">Krippendorff Alpha dans le temps</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredAlpha}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString("fr-FR")}
                  formatter={(value: number) => [value.toFixed(3), "Alpha"]}
                />
                <ReferenceArea y1={0.8} y2={1} fill="hsl(142, 71%, 45%)" fillOpacity={0.05} />
                <ReferenceArea y1={0.67} y2={0.8} fill="hsl(38, 92%, 50%)" fillOpacity={0.05} />
                <ReferenceArea y1={0} y2={0.67} fill="hsl(0, 84%, 60%)" fillOpacity={0.05} />
                <ReferenceLine y={0.8} stroke="hsl(142, 71%, 45%)" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="alpha"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Bar Chart */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-foreground mb-4">Tâches par jour</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredTasks}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="scoring" name="Scoring" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="dpo" name="DPO" stackId="a" fill="#3B82F6" />
                <Bar dataKey="fact_checking" name="Fact-checking" stackId="a" fill="#F59E0B" />
                <Bar dataKey="red_teaming" name="Red-teaming" stackId="a" fill="#EF4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Tâches cette semaine" value={String(data.weeklyTasks)} delta={data.weeklyTasksDelta} />
        <KpiCard label="Alpha cette semaine" value={data.weeklyAlpha.toFixed(3)} delta={data.weeklyAlphaDelta} isAlpha />
        <KpiCard label="Temps moyen / tâche" value={formatTime(data.avgTimePerTask)} />
        <KpiCard label="Meilleur domaine" value={data.bestDomain || "—"} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, isAlpha }: { label: string; value: string; delta?: number; isAlpha?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-lg font-semibold text-foreground">{value}</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {delta !== undefined && delta !== 0 && (
            <span className={`inline-flex items-center text-[11px] font-medium ${delta > 0 ? "text-emerald-500" : "text-destructive"}`}>
              {delta > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {isAlpha ? (delta > 0 ? "+" : "") + delta.toFixed(3) : (delta > 0 ? "+" : "") + delta}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
