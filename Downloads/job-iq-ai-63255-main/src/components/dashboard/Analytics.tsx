import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, CheckCircle, XCircle } from "lucide-react";

interface AnalyticsProps {
  applications: any[];
}

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1"];

export const Analytics = ({ applications }: AnalyticsProps) => {
  // Calculate statistics
  const totalApplications = applications.length;
  const avgTestScore = applications.reduce((acc, app) => acc + (app.test_score || 0), 0) / totalApplications || 0;
  const avgCvScore = applications.reduce((acc, app) => acc + (app.cv_score || 0), 0) / totalApplications || 0;
  const avgFinalScore = applications.reduce((acc, app) => acc + (app.final_score || 0), 0) / totalApplications || 0;

  // Score distribution data
  const scoreRanges = [
    { range: "0-20", count: applications.filter(a => (a.final_score || 0) <= 20).length },
    { range: "21-40", count: applications.filter(a => (a.final_score || 0) > 20 && (a.final_score || 0) <= 40).length },
    { range: "41-60", count: applications.filter(a => (a.final_score || 0) > 40 && (a.final_score || 0) <= 60).length },
    { range: "61-80", count: applications.filter(a => (a.final_score || 0) > 60 && (a.final_score || 0) <= 80).length },
    { range: "81-100", count: applications.filter(a => (a.final_score || 0) > 80).length },
  ];

  // Timeline data (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
      applications: applications.filter(app => {
        const appDate = new Date(app.submitted_at);
        return appDate.toDateString() === date.toDateString();
      }).length,
    };
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Candidatures</p>
                <p className="text-2xl font-bold">{totalApplications}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score Test Moyen</p>
                <p className="text-2xl font-bold">{avgTestScore.toFixed(1)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score CV Moyen</p>
                <p className="text-2xl font-bold">{avgCvScore.toFixed(1)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score Final Moyen</p>
                <p className="text-2xl font-bold">{avgFinalScore.toFixed(1)}</p>
              </div>
              <XCircle className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution des Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreRanges}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Candidatures (7 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="applications" stroke="hsl(var(--success))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
