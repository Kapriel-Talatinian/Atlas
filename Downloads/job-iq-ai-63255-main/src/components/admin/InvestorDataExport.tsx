import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Loader2,
  Users,
  Building2,
  TrendingUp,
  DollarSign,
  Shield
} from "lucide-react";

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  format: "csv" | "json";
  category: "financial" | "operational" | "compliance";
}

export function InvestorDataExport() {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportOptions: ExportOption[] = [
    {
      id: "revenue",
      title: "Données Financières",
      description: "Revenus, marges, GMV par mois et par client",
      icon: <DollarSign className="h-5 w-5" />,
      format: "csv",
      category: "financial",
    },
    {
      id: "unit-economics",
      title: "Unit Economics",
      description: "CAC, LTV, payback period, churn rate",
      icon: <TrendingUp className="h-5 w-5" />,
      format: "csv",
      category: "financial",
    },
    {
      id: "clients",
      title: "Liste Clients",
      description: "Tous les clients avec revenus et placements",
      icon: <Building2 className="h-5 w-5" />,
      format: "csv",
      category: "operational",
    },
    {
      id: "experts",
      title: "Pool d'Experts",
      description: "Distribution des compétences, pays, scores",
      icon: <Users className="h-5 w-5" />,
      format: "csv",
      category: "operational",
    },
    {
      id: "placements",
      title: "Historique Placements",
      description: "Tous les placements avec détails et durées",
      icon: <FileSpreadsheet className="h-5 w-5" />,
      format: "csv",
      category: "operational",
    },
    {
      id: "compliance",
      title: "Audit Trail",
      description: "Journal des actions administratives",
      icon: <Shield className="h-5 w-5" />,
      format: "csv",
      category: "compliance",
    },
  ];

  async function exportData(optionId: string) {
    setExporting(optionId);
    try {
      let data: any[] = [];
      let filename = "";

      switch (optionId) {
        case "revenue":
          const { data: placements } = await supabase
            .from("placements")
            .select("*, clients(company_name), expert_profiles(full_name)")
            .order("created_at", { ascending: false });
          
          data = (placements || []).map(p => ({
            date: p.created_at,
            client: p.clients?.company_name || "N/A",
            expert: p.expert_profiles?.full_name || "N/A",
            daily_rate: p.expert_daily_rate,
            status: p.status,
            start_date: p.start_date,
            end_date: p.end_date,
          }));
          filename = "revenue_data.csv";
          break;

        case "unit-economics":
          const { data: metrics } = await supabase
            .from("platform_metrics_history")
            .select("*")
            .order("metric_date", { ascending: false });
          
          data = (metrics || []).map(m => ({
            date: m.metric_date,
            metric_type: m.metric_type,
            value: m.metric_value,
            segment: m.segment || "all",
          }));
          filename = "unit_economics.csv";
          break;

        case "clients":
          const { data: clients } = await supabase
            .from("clients")
            .select("*, placements(id, status)")
            .order("created_at", { ascending: false });
          
          data = (clients || []).map(c => ({
            id: c.id,
            company_name: c.company_name,
            contact_name: c.contact_name,
            contact_email: c.contact_email,
            created_at: c.created_at,
            total_placements: c.placements?.length || 0,
            active_placements: c.placements?.filter((p: any) => p.status === "active").length || 0,
          }));
          filename = "clients_list.csv";
          break;

        case "experts":
          const { data: experts } = await supabase
            .from("expert_profiles")
            .select("*")
            .order("created_at", { ascending: false });
          
          data = (experts || []).map(e => ({
            id: e.id,
            full_name: e.full_name,
            email: e.email,
            title: e.title,
            years_of_experience: e.years_of_experience,
            primary_skills: Array.isArray(e.primary_skills) ? e.primary_skills.join(", ") : "",
            country: e.country,
            kyc_status: e.kyc_status,
            onboarding_completed: e.onboarding_completed,
            created_at: e.created_at,
          }));
          filename = "experts_pool.csv";
          break;

        case "placements":
          const { data: placementsData } = await supabase
            .from("placements")
            .select("*, clients(company_name), expert_profiles(full_name)")
            .order("start_date", { ascending: false });
          
          data = (placementsData || []).map(p => ({
            id: p.id,
            client: p.clients?.company_name || "N/A",
            expert: p.expert_profiles?.full_name || "N/A",
            title: p.title,
            expert_daily_rate: p.expert_daily_rate,
            start_date: p.start_date,
            end_date: p.end_date,
            status: p.status,
            created_at: p.created_at,
          }));
          filename = "placements_history.csv";
          break;

        case "compliance":
          const { data: auditLogs } = await supabase
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1000);
          
          data = (auditLogs || []).map(log => ({
            timestamp: log.created_at,
            user_id: log.user_id,
            action: log.action,
            entity_type: log.entity_type,
            entity_id: log.entity_id,
            ip_address: log.ip_address,
          }));
          filename = "audit_trail.csv";
          break;
      }

      // Convert to CSV
      if (data.length === 0) {
        toast.info("Aucune donnée à exporter");
        return;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(","),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes
            if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? "";
          }).join(",")
        )
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Export ${filename} téléchargé`);

    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(null);
    }
  }

  async function exportAllData() {
    setExporting("all");
    try {
      for (const option of exportOptions) {
        await exportData(option.id);
        // Small delay between exports
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      toast.success("Tous les exports téléchargés");
    } catch (error) {
      console.error("Export all error:", error);
      toast.error("Erreur lors de l'export complet");
    } finally {
      setExporting(null);
    }
  }

  function getCategoryColor(category: string) {
    switch (category) {
      case "financial": return "bg-green-100 text-green-700";
      case "operational": return "bg-blue-100 text-blue-700";
      case "compliance": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Export Due Diligence</h2>
          <p className="text-muted-foreground">
            Téléchargez toutes les données nécessaires pour les investisseurs
          </p>
        </div>
        <Button onClick={exportAllData} disabled={exporting !== null} size="lg">
          {exporting === "all" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Tout exporter
        </Button>
      </div>

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportOptions.map((option) => (
          <Card key={option.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-muted rounded-lg">
                  {option.icon}
                </div>
                <Badge className={getCategoryColor(option.category)}>
                  {option.category === "financial" ? "Financier" :
                   option.category === "operational" ? "Opérationnel" : "Conformité"}
                </Badge>
              </div>
              <CardTitle className="text-lg mt-3">{option.title}</CardTitle>
              <CardDescription>{option.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => exportData(option.id)}
                disabled={exporting !== null}
              >
                {exporting === option.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Exporter CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Box */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-1">À propos des exports</h4>
              <p className="text-sm text-muted-foreground">
                Ces exports contiennent toutes les données nécessaires pour la due diligence 
                investisseur. Les fichiers sont au format CSV et peuvent être ouverts avec 
                Excel, Google Sheets ou tout autre tableur. Pour un rapport PDF complet, 
                utilisez l'export depuis le tableau de bord investisseur.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
