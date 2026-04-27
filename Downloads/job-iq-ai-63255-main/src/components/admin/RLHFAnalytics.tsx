import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, ThumbsUp, ThumbsDown, Download, TrendingUp, 
  BarChart3, MessageSquare, Sparkles, RefreshCw, FileJson
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

interface FeedbackItem {
  id: string;
  function_name: string;
  input_context: any;
  ai_output: any;
  is_positive: boolean | null;
  human_correction: string | null;
  human_rating: number | null;
  created_at: string;
  expert_id: string | null;
  job_offer_id: string | null;
}

interface Stats {
  total: number;
  positive: number;
  negative: number;
  withCorrections: number;
  byFunction: Record<string, { total: number; positive: number; negative: number }>;
  byDay: { date: string; positive: number; negative: number; total: number }[];
}

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

const RLHFAnalytics = () => {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<string>("all");
  const [dateRange, setDateRange] = useState("7d");

  useEffect(() => {
    loadData();
  }, [selectedFunction, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const daysAgo = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const startDate = subDays(new Date(), daysAgo).toISOString();

      let query = supabase
        .from("ai_feedback")
        .select("*")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false });

      if (selectedFunction !== "all") {
        query = query.eq("function_name", selectedFunction);
      }

      const { data, error } = await query;
      if (error) throw error;

      setFeedback(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error("Error loading feedback:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: FeedbackItem[]) => {
    const positive = data.filter(f => f.is_positive === true).length;
    const negative = data.filter(f => f.is_positive === false).length;
    const withCorrections = data.filter(f => f.human_correction).length;

    // Stats by function
    const byFunction: Record<string, { total: number; positive: number; negative: number }> = {};
    data.forEach(f => {
      if (!byFunction[f.function_name]) {
        byFunction[f.function_name] = { total: 0, positive: 0, negative: 0 };
      }
      byFunction[f.function_name].total++;
      if (f.is_positive === true) byFunction[f.function_name].positive++;
      if (f.is_positive === false) byFunction[f.function_name].negative++;
    });

    // Stats by day
    const byDayMap: Record<string, { positive: number; negative: number; total: number }> = {};
    data.forEach(f => {
      const day = format(new Date(f.created_at), "yyyy-MM-dd");
      if (!byDayMap[day]) {
        byDayMap[day] = { positive: 0, negative: 0, total: 0 };
      }
      byDayMap[day].total++;
      if (f.is_positive === true) byDayMap[day].positive++;
      if (f.is_positive === false) byDayMap[day].negative++;
    });

    const byDay = Object.entries(byDayMap)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setStats({
      total: data.length,
      positive,
      negative,
      withCorrections,
      byFunction,
      byDay
    });
  };

  const exportJSONL = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("ai_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Format for Mistral/OpenAI fine-tuning
      const jsonlLines = (data || []).map(f => {
        // Format as conversation for fine-tuning
        const messages = [];
        
        // System message based on function
        const systemMessage = {
          role: "system",
          content: getSystemPromptForFunction(f.function_name)
        };
        messages.push(systemMessage);

        // User message (input context)
        messages.push({
          role: "user",
          content: JSON.stringify(f.input_context)
        });

        // Assistant message (AI output or human correction if negative)
        const assistantContent = f.is_positive === false && f.human_correction
          ? f.human_correction
          : JSON.stringify(f.ai_output);
        
        messages.push({
          role: "assistant",
          content: assistantContent
        });

        return JSON.stringify({ messages });
      });

      const blob = new Blob([jsonlLines.join("\n")], { type: "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rlhf-training-data-${format(new Date(), "yyyy-MM-dd")}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${data?.length || 0} exemples exportés au format JSONL`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const getSystemPromptForFunction = (functionName: string): string => {
    const prompts: Record<string, string> = {
      "evaluate-test": "Tu es un évaluateur technique expert. Évalue les réponses des candidats de manière juste et constructive.",
      "match-experts": "Tu es un système de matching expert. Évalue la compatibilité entre experts et offres d'emploi.",
      "match-jobs": "Tu es un système de recommandation d'emplois. Suggère les meilleures offres pour chaque expert.",
      "generate-test": "Tu es un générateur de tests techniques. Crée des questions pertinentes et progressives.",
      "chat-support": "Tu es un assistant support. Aide les utilisateurs avec leurs questions sur la plateforme."
    };
    return prompts[functionName] || "Tu es un assistant IA utile.";
  };

  const satisfactionRate = stats ? 
    stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0 
    : 0;

  const pieData = stats ? [
    { name: "Positif", value: stats.positive, color: "#22c55e" },
    { name: "Négatif", value: stats.negative, color: "#ef4444" },
    { name: "Non évalué", value: stats.total - stats.positive - stats.negative, color: "#6b7280" }
  ].filter(d => d.value > 0) : [];

  const functionData = stats ? Object.entries(stats.byFunction).map(([name, data]) => ({
    name: name.replace(/-/g, " "),
    positive: data.positive,
    negative: data.negative,
    total: data.total,
    rate: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0
  })) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Analytics RLHF
          </h2>
          <p className="text-muted-foreground">
            Analyse des feedbacks pour l'amélioration continue de l'IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
              <SelectItem value="90d">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedFunction} onValueChange={setSelectedFunction}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Toutes les fonctions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les fonctions</SelectItem>
              <SelectItem value="evaluate-test">Évaluation tests</SelectItem>
              <SelectItem value="match-experts">Matching experts</SelectItem>
              <SelectItem value="match-jobs">Matching jobs</SelectItem>
              <SelectItem value="generate-test">Génération tests</SelectItem>
              <SelectItem value="chat-support">Chat support</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={exportJSONL} disabled={exporting} className="gap-2">
            <FileJson className="h-4 w-4" />
            {exporting ? "Export..." : "Export JSONL"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Feedbacks</p>
                <p className="text-3xl font-bold">{stats?.total || 0}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux de satisfaction</p>
                <p className="text-3xl font-bold text-green-600">{satisfactionRate}%</p>
              </div>
              <ThumbsUp className="h-8 w-8 text-green-600 opacity-50" />
            </div>
            <Progress value={satisfactionRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Feedbacks négatifs</p>
                <p className="text-3xl font-bold text-red-600">{stats?.negative || 0}</p>
              </div>
              <ThumbsDown className="h-8 w-8 text-red-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Corrections humaines</p>
                <p className="text-3xl font-bold text-primary">{stats?.withCorrections || 0}</p>
              </div>
              <Sparkles className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Evolution over time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Évolution des feedbacks</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byDay && stats.byDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={stats.byDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(d) => format(new Date(d), "dd/MM", { locale: fr })}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    labelFormatter={(d) => format(new Date(d), "dd MMM yyyy", { locale: fr })}
                  />
                  <Area type="monotone" dataKey="positive" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Positif" />
                  <Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Négatif" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Pas de données pour cette période
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribution by type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition des feedbacks</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Pas de données
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By function */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance par fonction IA</CardTitle>
        </CardHeader>
        <CardContent>
          {functionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={functionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} fontSize={12} />
                <Tooltip />
                <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positif" />
                <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Négatif" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Pas de données
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent corrections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Corrections humaines récentes</CardTitle>
          <CardDescription>
            Ces corrections sont utilisées pour améliorer les réponses de l'IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedback.filter(f => f.human_correction).length > 0 ? (
            <div className="space-y-4">
              {feedback
                .filter(f => f.human_correction)
                .slice(0, 5)
                .map((f) => (
                  <div key={f.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{f.function_name}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(f.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-muted-foreground mb-1">Correction :</p>
                      <p className="bg-muted/50 p-2 rounded">{f.human_correction}</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune correction humaine pour cette période
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RLHFAnalytics;
