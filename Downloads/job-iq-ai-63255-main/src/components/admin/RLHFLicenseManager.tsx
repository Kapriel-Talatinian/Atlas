import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Scale,
  Plus,
  FileText,
  Globe,
  Clock,
  Building2,
  Shield,
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle
} from "lucide-react";

interface License {
  id: string;
  licensee_name: string;
  licensee_type: "ai_lab" | "enterprise" | "research" | "edtech";
  license_type: "non_exclusive" | "exclusive" | "evaluation";
  dataset_version: string;
  sectors_allowed: string[];
  territories: string[];
  duration_months: number;
  fee_amount: number;
  fee_currency: string;
  usage_rights: string[];
  restrictions: string[];
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "expired" | "revoked";
  created_at: string;
}

const LICENSE_TEMPLATE = `CONTRAT DE LICENCE NON-EXCLUSIVE - DONNÉES RLHF

Entre :
STEF Technologies SAS ("Le Concédant")
et
[LICENSEE_NAME] ("Le Licencié")

ARTICLE 1 - OBJET
Le Concédant concède au Licencié une licence non-exclusive d'utilisation du dataset RLHF version [VERSION].

ARTICLE 2 - DROITS CONCÉDÉS
2.1. Le Licencié peut utiliser les données pour :
[USAGE_RIGHTS]

2.2. Restrictions :
[RESTRICTIONS]

ARTICLE 3 - TERRITOIRES
Cette licence est valable pour les territoires suivants : [TERRITORIES]

ARTICLE 4 - SECTEURS AUTORISÉS
L'utilisation est limitée aux secteurs suivants : [SECTORS]

ARTICLE 5 - DURÉE
La licence est valable pour une durée de [DURATION] mois à compter du [START_DATE].

ARTICLE 6 - REDEVANCE
Le Licencié s'engage à payer la somme de [FEE] [CURRENCY].

ARTICLE 7 - GARANTIES
Le Concédant garantit :
- La qualité des annotations (taux de validation > 90%)
- L'anonymisation des contributeurs
- La conformité RGPD
- Les droits de cession obtenus auprès des contributeurs

ARTICLE 8 - RESPONSABILITÉ
Le Concédant ne garantit pas l'absence totale de biais dans les données.
Le Licencié est responsable de l'utilisation éthique des données.

Fait en deux exemplaires originaux.

Pour le Concédant :                    Pour le Licencié :
_________________                      _________________
STEF Technologies                      [LICENSEE_NAME]
Date : [DATE]                          Date : [DATE]`;

const SECTORS = [
  "AI/ML Research",
  "Healthcare Tech",
  "Financial Services",
  "EdTech",
  "HR Tech",
  "Legal Tech",
  "General Enterprise",
  "Government",
  "Defense"
];

const USAGE_RIGHTS = [
  "Model Training (Fine-tuning)",
  "Model Evaluation",
  "Benchmarking",
  "Academic Research",
  "Commercial Products",
  "Internal Tools",
  "API Services"
];

const RESTRICTIONS = [
  "No redistribution to third parties",
  "No reverse engineering of anonymization",
  "No use for discriminatory purposes",
  "Attribution required in publications",
  "Notification of derived works"
];

export function RLHFLicenseManager() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [copied, setCopied] = useState(false);
  
  const [newLicense, setNewLicense] = useState({
    licensee_name: "",
    licensee_type: "enterprise" as License["licensee_type"],
    license_type: "non_exclusive" as License["license_type"],
    dataset_version: "v1.0",
    sectors_allowed: [] as string[],
    territories: ["Worldwide"],
    duration_months: 12,
    fee_amount: 50000,
    fee_currency: "EUR",
    usage_rights: ["Model Training (Fine-tuning)", "Model Evaluation"],
    restrictions: ["No redistribution to third parties", "No reverse engineering of anonymization"]
  });

  // Simulated licenses for demo
  useEffect(() => {
    setLicenses([
      {
        id: "1",
        licensee_name: "Mistral AI",
        licensee_type: "ai_lab",
        license_type: "non_exclusive",
        dataset_version: "v1.0",
        sectors_allowed: ["AI/ML Research"],
        territories: ["EU", "US"],
        duration_months: 24,
        fee_amount: 150000,
        fee_currency: "EUR",
        usage_rights: ["Model Training (Fine-tuning)", "Model Evaluation", "Benchmarking"],
        restrictions: ["No redistribution to third parties"],
        start_date: "2024-01-01",
        end_date: "2025-12-31",
        status: "active",
        created_at: new Date().toISOString()
      }
    ]);
  }, []);

  function generateLicenseText(): string {
    return LICENSE_TEMPLATE
      .replace("[LICENSEE_NAME]", newLicense.licensee_name || "[LICENSEE_NAME]")
      .replace("[VERSION]", newLicense.dataset_version)
      .replace("[USAGE_RIGHTS]", newLicense.usage_rights.map(r => `- ${r}`).join("\n"))
      .replace("[RESTRICTIONS]", newLicense.restrictions.map(r => `- ${r}`).join("\n"))
      .replace("[TERRITORIES]", newLicense.territories.join(", "))
      .replace("[SECTORS]", newLicense.sectors_allowed.join(", ") || "Tous secteurs")
      .replace("[DURATION]", newLicense.duration_months.toString())
      .replace("[START_DATE]", new Date().toLocaleDateString("fr-FR"))
      .replace("[FEE]", newLicense.fee_amount.toLocaleString())
      .replace("[CURRENCY]", newLicense.fee_currency)
      .replace(/\[DATE\]/g, new Date().toLocaleDateString("fr-FR"));
  }

  function handlePreview() {
    setPreviewContent(generateLicenseText());
    setShowPreview(true);
  }

  function handleCopy() {
    navigator.clipboard.writeText(previewContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Contrat copié dans le presse-papiers");
  }

  function handleCreate() {
    const newId = Date.now().toString();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + newLicense.duration_months);

    const license: License = {
      id: newId,
      ...newLicense,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: "draft",
      created_at: new Date().toISOString()
    };

    setLicenses([license, ...licenses]);
    setShowCreate(false);
    toast.success("Licence créée avec succès");
  }

  function handleDownload(license: License) {
    const content = LICENSE_TEMPLATE
      .replace("[LICENSEE_NAME]", license.licensee_name)
      .replace("[VERSION]", license.dataset_version)
      .replace("[USAGE_RIGHTS]", license.usage_rights.map(r => `- ${r}`).join("\n"))
      .replace("[RESTRICTIONS]", license.restrictions.map(r => `- ${r}`).join("\n"))
      .replace("[TERRITORIES]", license.territories.join(", "))
      .replace("[SECTORS]", license.sectors_allowed.join(", ") || "Tous secteurs")
      .replace("[DURATION]", license.duration_months.toString())
      .replace("[START_DATE]", new Date(license.start_date).toLocaleDateString("fr-FR"))
      .replace("[FEE]", license.fee_amount.toLocaleString())
      .replace("[CURRENCY]", license.fee_currency)
      .replace(/\[DATE\]/g, new Date().toLocaleDateString("fr-FR"));

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `license_${license.licensee_name.replace(/\s+/g, "_")}_${license.dataset_version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalRevenue = licenses.filter(l => l.status === "active").reduce((acc, l) => acc + l.fee_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Gestion des Licences
          </h2>
          <p className="text-muted-foreground">
            Licences non-exclusives pour la monétisation du dataset
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle Licence
        </Button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{licenses.length}</p>
                <p className="text-sm text-muted-foreground">Licences</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{licenses.filter(l => l.status === "active").length}</p>
                <p className="text-sm text-muted-foreground">Actives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Building2 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{new Set(licenses.map(l => l.licensee_name)).size}</p>
                <p className="text-sm text-muted-foreground">Licenciés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">€{(totalRevenue / 1000).toFixed(0)}K</p>
                <p className="text-sm text-muted-foreground">Revenu total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* License Type Info */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Shield className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Licence Non-Exclusive Standard</h3>
              <p className="text-sm text-muted-foreground">
                Notre modèle de licence permet la vente du même dataset à plusieurs acheteurs simultanément.
                Chaque licence peut être personnalisée par secteur, territoire et durée.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline">Multi-acheteurs</Badge>
                <Badge variant="outline">Secteur limité</Badge>
                <Badge variant="outline">Territoire défini</Badge>
                <Badge variant="outline">Durée fixe</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Licenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Licences émises</CardTitle>
          <CardDescription>Historique des contrats de licence</CardDescription>
        </CardHeader>
        <CardContent>
          {licenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune licence émise</p>
              <p className="text-sm">Créez votre première licence pour commencer la monétisation</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Licencié</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{license.licensee_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{license.licensee_type.replace("_", " ")}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {license.license_type.replace("_", "-")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{license.dataset_version}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{license.duration_months} mois</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      €{license.fee_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        license.status === "active" ? "bg-green-500" :
                        license.status === "expired" ? "bg-gray-500" :
                        license.status === "revoked" ? "bg-red-500" :
                        "bg-amber-500"
                      }>
                        {license.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(license)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create License Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouvelle Licence Non-Exclusive
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Licensee Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="licensee_name">Nom du licencié *</Label>
                <Input
                  id="licensee_name"
                  placeholder="ex: Mistral AI"
                  value={newLicense.licensee_name}
                  onChange={(e) => setNewLicense(prev => ({ ...prev, licensee_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Type de licencié</Label>
                <Select
                  value={newLicense.licensee_type}
                  onValueChange={(v) => setNewLicense(prev => ({ ...prev, licensee_type: v as License["licensee_type"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai_lab">AI Lab</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="research">Research Institution</SelectItem>
                    <SelectItem value="edtech">EdTech</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* License Terms */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Version Dataset</Label>
                <Input
                  value={newLicense.dataset_version}
                  onChange={(e) => setNewLicense(prev => ({ ...prev, dataset_version: e.target.value }))}
                />
              </div>
              <div>
                <Label>Durée (mois)</Label>
                <Input
                  type="number"
                  value={newLicense.duration_months}
                  onChange={(e) => setNewLicense(prev => ({ ...prev, duration_months: parseInt(e.target.value) || 12 }))}
                />
              </div>
              <div>
                <Label>Montant (€)</Label>
                <Input
                  type="number"
                  value={newLicense.fee_amount}
                  onChange={(e) => setNewLicense(prev => ({ ...prev, fee_amount: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Sectors */}
            <div>
              <Label className="mb-2 block">Secteurs autorisés</Label>
              <div className="grid grid-cols-3 gap-2">
                {SECTORS.map((sector) => (
                  <div key={sector} className="flex items-center gap-2">
                    <Checkbox
                      id={sector}
                      checked={newLicense.sectors_allowed.includes(sector)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewLicense(prev => ({ ...prev, sectors_allowed: [...prev.sectors_allowed, sector] }));
                        } else {
                          setNewLicense(prev => ({ ...prev, sectors_allowed: prev.sectors_allowed.filter(s => s !== sector) }));
                        }
                      }}
                    />
                    <Label htmlFor={sector} className="text-sm cursor-pointer">{sector}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage Rights */}
            <div>
              <Label className="mb-2 block">Droits d'usage</Label>
              <div className="grid grid-cols-2 gap-2">
                {USAGE_RIGHTS.map((right) => (
                  <div key={right} className="flex items-center gap-2">
                    <Checkbox
                      id={right}
                      checked={newLicense.usage_rights.includes(right)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewLicense(prev => ({ ...prev, usage_rights: [...prev.usage_rights, right] }));
                        } else {
                          setNewLicense(prev => ({ ...prev, usage_rights: prev.usage_rights.filter(r => r !== right) }));
                        }
                      }}
                    />
                    <Label htmlFor={right} className="text-sm cursor-pointer">{right}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button variant="secondary" onClick={handlePreview}>
              <FileText className="h-4 w-4 mr-2" />
              Prévisualiser
            </Button>
            <Button onClick={handleCreate} disabled={!newLicense.licensee_name}>
              Créer la Licence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Prévisualisation du Contrat</DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[60vh] border rounded-lg p-4 bg-muted/30">
            <pre className="whitespace-pre-wrap text-sm font-mono">{previewContent}</pre>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Fermer
            </Button>
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copié!" : "Copier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
