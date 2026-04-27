import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  Shield,
  Lock,
  Globe,
  Check,
  Loader2,
  AlertTriangle,
  Scale
} from "lucide-react";

interface ContributorAgreementProps {
  annotatorId: string;
  expertId?: string;
  onSigned: () => void;
}

const AGREEMENT_VERSION = "v2.0";

export function ContributorAgreement({ annotatorId, expertId, onSigned }: ContributorAgreementProps) {
  const [consents, setConsents] = useState({
    dataUsage: false,
    anonymization: false,
    resale: false,
    termsRead: false
  });
  const [signing, setSigning] = useState(false);

  const allConsentsGiven = consents.dataUsage && consents.anonymization && consents.resale && consents.termsRead;

  async function handleSign() {
    if (!allConsentsGiven) {
      toast.error("Veuillez accepter tous les termes");
      return;
    }

    setSigning(true);
    try {
      const { error } = await supabase
        .from("rlhf_contributor_agreements")
        .insert({
          annotator_id: annotatorId,
          expert_id: expertId,
          agreement_version: AGREEMENT_VERSION,
          data_usage_consent: consents.dataUsage,
          anonymization_consent: consents.anonymization,
          resale_consent: consents.resale,
          is_active: true,
          signed_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success("Accord contributeur signé avec succès");
      onSigned();
    } catch (error) {
      console.error("Error signing agreement:", error);
      toast.error("Erreur lors de la signature");
    } finally {
      setSigning(false);
    }
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader className="text-center border-b">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-primary/10 rounded-2xl">
            <Scale className="h-10 w-10 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">Accord Contributeur RLHF</CardTitle>
        <CardDescription>
          Version {AGREEMENT_VERSION} • Cession de droits pour données d'entraînement IA
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Agreement Text */}
        <ScrollArea className="h-64 rounded-lg border p-4 bg-muted/30">
          <div className="space-y-4 text-sm">
            <h3 className="font-bold text-lg">CONTRAT DE CESSION DE DROITS - DONNÉES RLHF</h3>
            
            <p className="text-muted-foreground">
              Entre STEF Technologies SAS ("l'Entreprise") et le Contributeur identifié ci-dessous.
            </p>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Article 1 - Objet</h4>
              <p className="text-muted-foreground">
                Le présent accord définit les conditions de cession des annotations, évaluations et 
                feedbacks produits par le Contributeur dans le cadre de la plateforme RLHF STEF.
                Ces données seront utilisées pour l'entraînement, l'évaluation et le benchmark 
                de modèles d'intelligence artificielle.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Article 2 - Droits cédés</h4>
              <p className="text-muted-foreground">
                Le Contributeur cède à l'Entreprise, de manière non-exclusive et pour le monde entier :
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Le droit de reproduction et d'utilisation des données annotées</li>
                <li>Le droit de modification et d'adaptation pour l'entraînement IA</li>
                <li>Le droit de distribution et de commercialisation à des tiers</li>
                <li>Le droit d'agrégation avec d'autres datasets</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Article 3 - Anonymisation</h4>
              <p className="text-muted-foreground">
                Toutes les données seront strictement anonymisées avant export ou vente :
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Remplacement de l'identité par un ID anonyme (format: anon_XXXXXXXX)</li>
                <li>Suppression de toute PII (Personally Identifiable Information)</li>
                <li>Agrégation des données démographiques par région/rôle uniquement</li>
                <li>Aucun lien vers le profil personnel dans les exports</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Article 4 - Rémunération</h4>
              <p className="text-muted-foreground">
                Le Contributeur est rémunéré selon le barème en vigueur pour chaque annotation validée.
                La cession de droits est incluse dans cette rémunération et ne donne lieu à aucune
                royalty supplémentaire en cas de revente des données.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Article 5 - Durée</h4>
              <p className="text-muted-foreground">
                La cession est consentie pour une durée illimitée. Le Contributeur peut révoquer
                son accord pour les futures annotations, mais les données déjà cédées restent
                la propriété de l'Entreprise.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Article 6 - Conformité RGPD</h4>
              <p className="text-muted-foreground">
                Conformément au RGPD, le Contributeur dispose d'un droit d'accès, de rectification
                et de portabilité de ses données personnelles (distinctes des annotations).
                Contact DPO : privacy@stef-tech.com
              </p>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground italic">
              En signant cet accord, vous confirmez avoir lu et compris l'intégralité des termes ci-dessus.
            </p>
          </div>
        </ScrollArea>

        {/* Key Points Summary */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Anonymisation</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Vos données sont anonymisées avant tout export
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm">Non-Exclusif</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Vous pouvez contribuer à d'autres projets
              </p>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-sm">RGPD Compliant</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Vos droits personnels sont protégés
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Consent Checkboxes */}
        <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
          <div className="flex items-start gap-3">
            <Checkbox
              id="dataUsage"
              checked={consents.dataUsage}
              onCheckedChange={(checked) => 
                setConsents(prev => ({ ...prev, dataUsage: checked === true }))
              }
            />
            <div className="flex-1">
              <Label htmlFor="dataUsage" className="font-medium cursor-pointer">
                J'accepte l'utilisation de mes annotations pour l'entraînement IA
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Mes feedbacks seront utilisés pour améliorer des modèles d'intelligence artificielle
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="anonymization"
              checked={consents.anonymization}
              onCheckedChange={(checked) => 
                setConsents(prev => ({ ...prev, anonymization: checked === true }))
              }
            />
            <div className="flex-1">
              <Label htmlFor="anonymization" className="font-medium cursor-pointer">
                J'accepte l'anonymisation de mes contributions
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Mon identité sera remplacée par un identifiant anonyme dans tous les exports
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="resale"
              checked={consents.resale}
              onCheckedChange={(checked) => 
                setConsents(prev => ({ ...prev, resale: checked === true }))
              }
            />
            <div className="flex-1">
              <Label htmlFor="resale" className="font-medium cursor-pointer">
                J'autorise la revente des données anonymisées à des tiers
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                STEF peut licencier le dataset à des labs IA, entreprises et chercheurs
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <Checkbox
              id="termsRead"
              checked={consents.termsRead}
              onCheckedChange={(checked) => 
                setConsents(prev => ({ ...prev, termsRead: checked === true }))
              }
            />
            <div className="flex-1">
              <Label htmlFor="termsRead" className="font-medium cursor-pointer">
                J'ai lu et compris l'intégralité de l'accord
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Je confirme avoir pris connaissance de tous les articles ci-dessus
              </p>
            </div>
          </div>
        </div>

        {/* Warning */}
        {!allConsentsGiven && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-600">
              Vous devez accepter tous les termes pour continuer à contribuer
            </p>
          </div>
        )}

        {/* Sign Button */}
        <Button
          className="w-full"
          size="lg"
          disabled={!allConsentsGiven || signing}
          onClick={handleSign}
        >
          {signing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Signer l'Accord Contributeur
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          En signant, vous acceptez les termes de l'accord version {AGREEMENT_VERSION}
          <br />
          Une copie vous sera envoyée par email
        </p>
      </CardContent>
    </Card>
  );
}
