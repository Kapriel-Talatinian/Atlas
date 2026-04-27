import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Shield, 
  FileCheck, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  RefreshCw,
  Eye,
  Lock,
  Users,
  Database,
  Server
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ComplianceItem {
  id: string;
  category: string;
  title: string;
  description: string;
  status: "complete" | "in_progress" | "pending";
  evidence?: string;
}

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  ip_address: string;
}

export function ComplianceDashboard() {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [gdprItems, setGdprItems] = useState<ComplianceItem[]>([
    {
      id: "gdpr-1",
      category: "GDPR",
      title: "Politique de confidentialité",
      description: "Document décrivant le traitement des données personnelles",
      status: "complete",
      evidence: "privacy-policy-v2.pdf"
    },
    {
      id: "gdpr-2",
      category: "GDPR",
      title: "Registre des traitements",
      description: "Liste de tous les traitements de données personnelles",
      status: "complete",
    },
    {
      id: "gdpr-3",
      category: "GDPR",
      title: "Consentement utilisateurs",
      description: "Mécanisme de recueil et gestion des consentements",
      status: "complete",
    },
    {
      id: "gdpr-4",
      category: "GDPR",
      title: "Droit à l'effacement",
      description: "Processus de suppression des données sur demande",
      status: "in_progress",
    },
    {
      id: "gdpr-5",
      category: "GDPR",
      title: "DPA avec sous-traitants",
      description: "Accords de traitement de données signés",
      status: "complete",
    },
    {
      id: "gdpr-6",
      category: "GDPR",
      title: "Notification de violation",
      description: "Procédure de notification en cas de breach",
      status: "pending",
    },
  ]);

  const [soc2Items, setSoc2Items] = useState<ComplianceItem[]>([
    {
      id: "soc2-1",
      category: "SOC 2",
      title: "Contrôle d'accès",
      description: "Authentification multi-facteur et gestion des accès",
      status: "complete",
    },
    {
      id: "soc2-2",
      category: "SOC 2",
      title: "Chiffrement des données",
      description: "Données chiffrées au repos et en transit",
      status: "complete",
    },
    {
      id: "soc2-3",
      category: "SOC 2",
      title: "Journalisation des accès",
      description: "Logs de toutes les actions administratives",
      status: "complete",
    },
    {
      id: "soc2-4",
      category: "SOC 2",
      title: "Gestion des incidents",
      description: "Processus de réponse aux incidents de sécurité",
      status: "in_progress",
    },
    {
      id: "soc2-5",
      category: "SOC 2",
      title: "Sauvegarde et récupération",
      description: "Plan de backup et de disaster recovery",
      status: "complete",
    },
    {
      id: "soc2-6",
      category: "SOC 2",
      title: "Tests de pénétration",
      description: "Audits de sécurité réguliers",
      status: "pending",
    },
  ]);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      setAuditLogs(data || []);
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "complete":
        return <Badge className="bg-green-100 text-green-700">Complété</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-100 text-yellow-700">En cours</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-700">À faire</Badge>;
    }
  }

  function calculateProgress(items: ComplianceItem[]) {
    const complete = items.filter(i => i.status === "complete").length;
    return Math.round((complete / items.length) * 100);
  }

  function toggleStatus(items: ComplianceItem[], setItems: React.Dispatch<React.SetStateAction<ComplianceItem[]>>, id: string) {
    setItems(items.map(item => {
      if (item.id === id) {
        const statusOrder: ("pending" | "in_progress" | "complete")[] = ["pending", "in_progress", "complete"];
        const currentIndex = statusOrder.indexOf(item.status);
        const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
        return { ...item, status: nextStatus };
      }
      return item;
    }));
    toast.success("Statut mis à jour");
  }

  function renderComplianceChecklist(items: ComplianceItem[], setItems: React.Dispatch<React.SetStateAction<ComplianceItem[]>>, title: string, icon: React.ReactNode) {
    const progress = calculateProgress(items);
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle>{title}</CardTitle>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {progress}%
            </Badge>
          </div>
          <CardDescription>
            {items.filter(i => i.status === "complete").length} / {items.length} éléments complétés
          </CardDescription>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item) => (
              <div 
                key={item.id} 
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => toggleStatus(items, setItems, item.id)}
              >
                {getStatusIcon(item.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{item.title}</h4>
                    {getStatusBadge(item.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  {item.evidence && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                      <FileCheck className="h-3 w-3" />
                      {item.evidence}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Conformité & Sécurité
          </h2>
          <p className="text-muted-foreground">
            Suivi GDPR, SOC 2 et audit trail
          </p>
        </div>
        <Button variant="outline" onClick={loadAuditLogs}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Lock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{calculateProgress(gdprItems)}%</div>
                <p className="text-sm text-muted-foreground">GDPR Conforme</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Server className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{calculateProgress(soc2Items)}%</div>
                <p className="text-sm text-muted-foreground">SOC 2 Préparation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{auditLogs.length}</div>
                <p className="text-sm text-muted-foreground">Logs d'audit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">0</div>
                <p className="text-sm text-muted-foreground">Demandes GDPR</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="gdpr">
        <TabsList>
          <TabsTrigger value="gdpr">GDPR</TabsTrigger>
          <TabsTrigger value="soc2">SOC 2</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="gdpr" className="mt-4">
          {renderComplianceChecklist(
            gdprItems, 
            setGdprItems, 
            "Conformité GDPR",
            <Shield className="h-5 w-5 text-primary" />
          )}
        </TabsContent>

        <TabsContent value="soc2" className="mt-4">
          {renderComplianceChecklist(
            soc2Items, 
            setSoc2Items, 
            "Préparation SOC 2 (non certifié)",
            <Server className="h-5 w-5 text-primary" />
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Journal d'Audit</CardTitle>
              <CardDescription>
                Historique des actions administratives (50 dernières entrées)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune entrée dans le journal d'audit
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Action</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">ID Entité</th>
                        <th className="text-left py-2 px-2">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b">
                          <td className="py-2 px-2 text-sm">
                            {new Date(log.created_at).toLocaleString("fr-FR")}
                          </td>
                          <td className="py-2 px-2">
                            <Badge variant="outline">{log.action}</Badge>
                          </td>
                          <td className="py-2 px-2 text-sm">{log.entity_type}</td>
                          <td className="py-2 px-2 text-sm font-mono text-xs">
                            {log.entity_id?.slice(0, 8)}...
                          </td>
                          <td className="py-2 px-2 text-sm">{log.ip_address || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Security Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Lock className="h-8 w-8 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-2">Sécurité des Données</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Chiffrement AES-256 au repos</li>
                <li>✅ TLS 1.3 pour les données en transit</li>
                <li>✅ Authentification JWT avec refresh tokens</li>
                <li>✅ Row Level Security (RLS) sur toutes les tables</li>
                <li>✅ Hébergé sur infrastructure SOC 2 Type II certifiée (Supabase/AWS)</li>
                <li>⚠️ STEF n'est pas certifié SOC 2 Type II — conçu selon les principes SOC 2</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
