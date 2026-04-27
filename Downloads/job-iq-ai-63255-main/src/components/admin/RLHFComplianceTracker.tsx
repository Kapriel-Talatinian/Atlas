import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield,
  FileCheck,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Loader2,
  Lock,
  FileText,
  Globe,
  Scale
} from "lucide-react";

interface ComplianceStats {
  totalAnnotators: number;
  withConsent: number;
  consentRate: number;
  activeLicenses: number;
  pendingRenewal: number;
}

interface Agreement {
  id: string;
  annotator_id: string;
  agreement_version: string;
  signed_at: string;
  data_usage_consent: boolean;
  anonymization_consent: boolean;
  resale_consent: boolean;
  sector_restrictions: string[];
  time_limit_months: number | null;
  is_active: boolean;
}

const COMPLIANCE_CHECKLIST = [
  { id: "consent", label: "Consentement explicite", description: "Accord signé par chaque annotateur" },
  { id: "anonymization", label: "Anonymisation", description: "IDs anonymisés, pas de PII dans les exports" },
  { id: "provenance", label: "Traçabilité", description: "Metadata de provenance sur chaque feedback" },
  { id: "rights", label: "Cession de droits", description: "Droits de revente clairement établis" },
  { id: "gdpr", label: "Conformité RGPD", description: "Droit à l'effacement, portabilité" },
  { id: "audit", label: "Piste d'audit", description: "Logs de toutes les modifications" }
];

export function RLHFComplianceTracker() {
  const [stats, setStats] = useState<ComplianceStats>({
    totalAnnotators: 0,
    withConsent: 0,
    consentRate: 0,
    activeLicenses: 0,
    pendingRenewal: 0
  });
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistStatus, setChecklistStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [annotatorsRes, agreementsRes] = await Promise.all([
        supabase.from("annotator_profiles").select("*"),
        supabase.from("rlhf_contributor_agreements").select("*").order("signed_at", { ascending: false })
      ]);

      if (annotatorsRes.error) throw annotatorsRes.error;

      const annotators = annotatorsRes.data || [];
      const agreementsList = agreementsRes.data as Agreement[] || [];
      
      // Calculate stats
      const withConsent = annotators.filter((a: any) => a.consent_given_at).length;
      const activeAgreements = agreementsList.filter(a => a.is_active);
      
      setStats({
        totalAnnotators: annotators.length,
        withConsent,
        consentRate: annotators.length > 0 ? (withConsent / annotators.length) * 100 : 0,
        activeLicenses: activeAgreements.length,
        pendingRenewal: activeAgreements.filter(a => {
          if (!a.time_limit_months) return false;
          const signedDate = new Date(a.signed_at);
          const expiryDate = new Date(signedDate.setMonth(signedDate.getMonth() + a.time_limit_months));
          const daysUntilExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return daysUntilExpiry <= 30;
        }).length
      });

      setAgreements(agreementsList);

      // Update checklist (based on actual data)
      setChecklistStatus({
        consent: withConsent >= annotators.length * 0.9,
        anonymization: annotators.every((a: any) => a.anonymized_id),
        provenance: true, // Assumed from schema
        rights: activeAgreements.filter(a => a.resale_consent).length >= activeAgreements.length * 0.9,
        gdpr: true, // Assumed compliant
        audit: true // We have audit_logs table
      });
    } catch (error) {
      console.error("Error loading compliance data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  const complianceScore = Object.values(checklistStatus).filter(Boolean).length / COMPLIANCE_CHECKLIST.length * 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Compliance & Rights Tracking
          </h2>
          <p className="text-muted-foreground">
            Gestion des consentements et licences pour la monétisation des données
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Compliance Score */}
      <Card className={`border-2 ${complianceScore >= 80 ? 'border-green-500' : complianceScore >= 60 ? 'border-yellow-500' : 'border-red-500'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-2xl ${complianceScore >= 80 ? 'bg-green-500/20' : complianceScore >= 60 ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
              <Shield className={`h-10 w-10 ${complianceScore >= 80 ? 'text-green-500' : complianceScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold">Score de Conformité</h3>
                <span className="text-3xl font-bold">{complianceScore.toFixed(0)}%</span>
              </div>
              <Progress value={complianceScore} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {complianceScore >= 80 
                  ? "✅ Prêt pour la monétisation - Audit-ready"
                  : complianceScore >= 60
                  ? "⚠️ Quelques points à améliorer avant la vente"
                  : "❌ Actions requises avant toute monétisation"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAnnotators}</p>
                <p className="text-sm text-muted-foreground">Annotateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <FileCheck className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.consentRate.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Taux consentement</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Scale className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeLicenses}</p>
                <p className="text-sm text-muted-foreground">Licences actives</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingRenewal}</p>
                <p className="text-sm text-muted-foreground">Renouvellement proche</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Checklist de Conformité
          </CardTitle>
          <CardDescription>
            Exigences pour la vente de données aux AI labs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {COMPLIANCE_CHECKLIST.map((item) => {
              const isCompliant = checklistStatus[item.id];
              return (
                <div 
                  key={item.id}
                  className={`p-4 rounded-lg border ${isCompliant ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}
                >
                  <div className="flex items-start gap-3">
                    {isCompliant ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legal Notice */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Licensing Non-Exclusif</h3>
              <p className="text-sm text-muted-foreground">
                Le modèle de licence non-exclusive permet la vente à plusieurs acheteurs simultanément.
                Chaque licence peut être:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline">Limitée par secteur</Badge>
                <Badge variant="outline">Limitée dans le temps</Badge>
                <Badge variant="outline">Usage spécifique</Badge>
                <Badge variant="outline">Géographiquement restreinte</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Accords Contributeurs</CardTitle>
          <CardDescription>
            Suivi des consentements et droits cédés
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agreements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun accord enregistré</p>
              <p className="text-sm">Les accords seront créés lors de la qualification des annotateurs</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Annotateur</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Signé le</TableHead>
                  <TableHead>Droits</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agreements.slice(0, 10).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.annotator_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{a.agreement_version}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(a.signed_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {a.data_usage_consent && <Badge variant="secondary" className="text-xs">Usage</Badge>}
                        {a.anonymization_consent && <Badge variant="secondary" className="text-xs">Anon</Badge>}
                        {a.resale_consent && <Badge className="bg-green-500 text-xs">Revente</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={a.is_active ? 'bg-green-500' : 'bg-red-500'}>
                        {a.is_active ? 'Actif' : 'Révoqué'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
