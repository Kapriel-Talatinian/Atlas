import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  Diamond,
  Gem,
  Crown,
  Trophy,
  Star,
  Users,
  Brain,
  Globe,
  Languages,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Target,
  Shield,
  Award,
  Zap,
  BarChart3,
  Database
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface HarvestingStats {
  totalFeedbacks: number;
  validatedFeedbacks: number;
  totalAnnotators: number;
  seniorAnnotators: number;
  languageDistribution: Record<string, number>;
  countryDistribution: Record<string, number>;
  avgAgreementScore: number;
  dailyGrowth: { date: string; count: number; value: number }[];
}

const GRADE_COLORS = {
  diamond: "#B9F2FF",
  platinum: "#E5E4E2",
  gold: "#FFD700",
  silver: "#C0C0C0"
};

const QUALITY_TIERS = [
  {
    name: "Diamond Grade",
    icon: Diamond,
    color: "from-cyan-400 to-blue-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    criteria: [
      "Senior/Lead/Principal annotators",
      "Agreement score > 90%",
      "Complete 5-dimension scoring",
      "Validated by QA team"
    ],
    pricePerUnit: "$15-25",
    marketDemand: "Very High"
  },
  {
    name: "Platinum Grade",
    icon: Crown,
    color: "from-slate-300 to-slate-500",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    criteria: [
      "Mid-Senior annotators",
      "Agreement score > 80%",
      "French + English bilingual",
      "Technical domain expertise"
    ],
    pricePerUnit: "$10-15",
    marketDemand: "High"
  },
  {
    name: "Gold Grade",
    icon: Trophy,
    color: "from-yellow-400 to-amber-600",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    criteria: [
      "All verified developers",
      "Agreement score > 70%",
      "Complete feedback",
      "Real hiring context"
    ],
    pricePerUnit: "$8-12",
    marketDemand: "Medium-High"
  }
];

const UNIQUE_VALUE_PROPS = [
  {
    icon: Globe,
    title: "African French-Speaking Devs",
    description: "Ultra-rare demographic in AI training data",
    highlight: "<1% of global RLHF datasets"
  },
  {
    icon: Target,
    title: "Real Hiring Context",
    description: "Not synthetic tasks - actual job applications",
    highlight: "10x more authentic"
  },
  {
    icon: Shield,
    title: "100% GDPR Compliant",
    description: "Explicit consent, anonymized IDs, audit trail",
    highlight: "Enterprise-ready"
  },
  {
    icon: Brain,
    title: "Verified Expertise",
    description: "Technical tests validate actual skill level",
    highlight: "No fake annotations"
  }
];

export function RLHFHarvesting() {
  const [stats, setStats] = useState<HarvestingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const [feedbackRes, annotatorRes] = await Promise.all([
        supabase.from("rlhf_feedback").select("*"),
        supabase.from("annotator_profiles").select("*")
      ]);

      const feedbacks = feedbackRes.data || [];
      const annotators = annotatorRes.data || [];

      // Calculate distributions
      const languageDistribution: Record<string, number> = {};
      const countryDistribution: Record<string, number> = {};
      
      feedbacks.forEach((f: any) => {
        languageDistribution[f.language] = (languageDistribution[f.language] || 0) + 1;
        countryDistribution[f.country_context] = (countryDistribution[f.country_context] || 0) + 1;
      });

      // Calculate daily growth (last 30 days)
      const dailyGrowth: { date: string; count: number; value: number }[] = [];
      const last30Days = [...Array(30)].map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return date.toISOString().split('T')[0];
      });

      last30Days.forEach(date => {
        const count = feedbacks.filter((f: any) => 
          f.created_at?.startsWith(date)
        ).length;
        dailyGrowth.push({ 
          date: date.slice(5), 
          count, 
          value: count * 12 // Average $12 per feedback
        });
      });

      // Calculate average agreement score
      const validScores = feedbacks.filter((f: any) => f.agreement_score != null);
      const avgAgreementScore = validScores.length > 0
        ? validScores.reduce((acc: number, f: any) => acc + parseFloat(f.agreement_score || 0), 0) / validScores.length
        : 0;

      setStats({
        totalFeedbacks: feedbacks.length,
        validatedFeedbacks: feedbacks.filter((f: any) => f.qa_status === 'validated').length,
        totalAnnotators: annotators.length,
        seniorAnnotators: annotators.filter((a: any) => 
          ['senior', 'lead', 'principal'].includes(a.seniority)
        ).length,
        languageDistribution,
        countryDistribution,
        avgAgreementScore: avgAgreementScore * 100,
        dailyGrowth
      });
    } catch (error) {
      console.error("Error loading harvesting stats:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate projected values
  const projectedMonthlyFeedbacks = (stats?.totalFeedbacks || 0) * 4; // Assuming weekly is 1/4 of monthly
  const avgPricePerFeedback = 12;
  const monthlyDataValue = projectedMonthlyFeedbacks * avgPricePerFeedback;
  const annualDataValue = monthlyDataValue * 12;

  // Calculate grade distribution (mock based on annotator seniority)
  const gradeDistribution = [
    { name: "Diamond", value: stats?.seniorAnnotators || 0, color: GRADE_COLORS.diamond },
    { name: "Platinum", value: Math.floor((stats?.totalAnnotators || 0) * 0.3), color: GRADE_COLORS.platinum },
    { name: "Gold", value: Math.floor((stats?.totalAnnotators || 0) * 0.5), color: GRADE_COLORS.gold }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Gem className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">RLHF Data Harvesting</h1>
              <p className="text-white/80">Highest Quality Grade • African French-Speaking Developers</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 text-white/70 mb-1">
                <Database className="h-4 w-4" />
                <span className="text-sm">Total Feedbacks</span>
              </div>
              <p className="text-3xl font-bold">{stats?.totalFeedbacks.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 text-white/70 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Validated</span>
              </div>
              <p className="text-3xl font-bold">{stats?.validatedFeedbacks.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 text-white/70 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Annotators</span>
              </div>
              <p className="text-3xl font-bold">{stats?.totalAnnotators}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 text-white/70 mb-1">
                <Award className="h-4 w-4" />
                <span className="text-sm">Senior+</span>
              </div>
              <p className="text-3xl font-bold">{stats?.seniorAnnotators}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Tiers */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Quality Grade Tiers
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {QUALITY_TIERS.map((tier, index) => (
            <Card key={tier.name} className={`relative overflow-hidden ${tier.bgColor} ${tier.borderColor} border-2`}>
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tier.color}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <tier.icon className="h-6 w-6" style={{ color: Object.values(GRADE_COLORS)[index] }} />
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">{tier.marketDemand}</Badge>
                </div>
                <CardDescription className="text-lg font-semibold text-foreground">
                  {tier.pricePerUnit} / feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {tier.criteria.map((criterion, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {criterion}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Unique Value Propositions */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Why Our Data is Premium
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {UNIQUE_VALUE_PROPS.map((prop) => (
            <Card key={prop.title} className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-xl w-fit mb-4">
                  <prop.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{prop.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{prop.description}</p>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30">
                  {prop.highlight}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Data Value & Growth */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Projection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Data Asset Valuation
            </CardTitle>
            <CardDescription>Projected market value of RLHF dataset</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Monthly Value</p>
                <p className="text-2xl font-bold text-green-600">
                  ${monthlyDataValue.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  ~{projectedMonthlyFeedbacks} feedbacks × ${avgPricePerFeedback}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Annual Value</p>
                <p className="text-2xl font-bold text-green-600">
                  ${annualDataValue.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Projected at current growth
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Agreement Score Quality</span>
                <span className="text-sm font-bold">{stats?.avgAgreementScore.toFixed(1)}%</span>
              </div>
              <Progress value={stats?.avgAgreementScore || 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Industry benchmark: 75% • Our target: 85%+
              </p>
            </div>

            <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="font-semibold">Target Buyers</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["OpenAI", "Anthropic", "Mistral AI", "Google DeepMind", "Meta AI"].map(buyer => (
                  <Badge key={buyer} variant="secondary">{buyer}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Daily Harvesting Trend
            </CardTitle>
            <CardDescription>Feedback collection over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.dailyGrowth || []}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'count' ? value : `$${value}`,
                      name === 'count' ? 'Feedbacks' : 'Value'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorCount)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <Separator className="my-4" />

            {/* Grade Distribution */}
            <div>
              <h4 className="text-sm font-medium mb-3">Grade Distribution</h4>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gradeDistribution}
                        innerRadius={25}
                        outerRadius={40}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {gradeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {gradeDistribution.map((grade) => (
                    <div key={grade.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: grade.color }}
                        />
                        <span className="text-sm">{grade.name}</span>
                      </div>
                      <span className="text-sm font-medium">{grade.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="bg-gradient-to-r from-primary/5 via-transparent to-accent/5 border-primary/20">
        <CardContent className="py-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <Star className="h-4 w-4" />
              <span className="text-sm font-medium">Enterprise Data Licensing</span>
            </div>
            <h3 className="text-2xl font-bold mb-2">
              Access Premium RLHF Data
            </h3>
            <p className="text-muted-foreground mb-6">
              Our dataset represents the only source of French-speaking African developer feedback 
              at this quality level. Contact our data partnerships team for licensing options.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" className="gap-2">
                <Diamond className="h-4 w-4" />
                Request Data Sample
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2"
                onClick={() => window.open('https://stef-pitchdeck.com/investors', '_blank')}
              >
                <TrendingUp className="h-4 w-4" />
                View Investor Deck
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
