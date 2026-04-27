import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Shield,
  Flag,
  ShieldCheck,
  Copy,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Certification {
  id: string;
  certificate_id: string;
  first_name: string;
  last_name: string;
  role_title: string;
  level: string;
  score: number;
  issued_at: string;
  valid_until: string | null;
  status: string;
  signature_hash: string | null;
  signed_at: string | null;
  percentile_rank: number | null;
  min_samples_met: boolean | null;
}

export default function VerifyCertificate() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [certification, setCertification] = useState<Certification | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (certificateId) {
      verifyCertificate();
    }
  }, [certificateId]);

  const verifyCertificate = async () => {
    try {
      const { data, error } = await supabase
        .from("certifications")
        .select("id, certificate_id, first_name, last_name, role_title, level, score, issued_at, valid_until, status, signature_hash, signed_at, percentile_rank, min_samples_met")
        .eq("certificate_id", certificateId)
        .single();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      setCertification(data);

      // Log public view event
      await supabase.from("certificate_events").insert({
        certification_id: data.id,
        event_type: "viewed_public"
      });
    } catch (error) {
      console.error("Error verifying certificate:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      associate: "Associate",
      professional: "Professional",
      expert: "Expert"
    };
    return labels[level] || level;
  };

  const formatSignatureHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 6)}`;
  };

  const copySignature = () => {
    if (certification?.signature_hash) {
      navigator.clipboard.writeText(certification.signature_hash);
      toast.success("Signature copiée");
    }
  };

  const verifyUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/verify/${certificateId}` 
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Certificat introuvable</h1>
          <p className="text-muted-foreground mb-6">
            Aucun certificat ne correspond à cet identifiant. 
            Vérifiez que le lien est correct.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à l'accueil
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={`mailto:contact@steftalent.ai?subject=Signalement certificat`}>
                <Flag className="w-4 h-4 mr-2" />
                Signaler un problème
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!certification) return null;

  const isValid = certification.status === 'valid';
  const isExpired = certification.status === 'expired';
  const isRevoked = certification.status === 'revoked';
  const hasSignature = !!certification.signature_hash;
  const showPercentile = certification.percentile_rank && certification.min_samples_met && certification.percentile_rank <= 25;

  const getStatusConfig = () => {
    if (isValid) {
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        icon: CheckCircle2,
        label: 'VALIDE'
      };
    }
    if (isExpired) {
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        icon: Clock,
        label: 'EXPIRÉ'
      };
    }
    return {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      icon: XCircle,
      label: 'RÉVOQUÉ'
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto">
        
        {/* Header */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          
          {/* Top bar with logo and status */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Award className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-primary">STEF</span>
            </div>
            
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${statusConfig.bg}`}>
              <StatusIcon className={`w-4 h-4 ${statusConfig.text}`} />
              <span className={`text-sm font-semibold ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="px-6 py-6 border-b">
            <h1 className="text-xl font-bold text-foreground mb-1">
              Vérification de certificat
            </h1>
            <p className="text-sm text-muted-foreground">
              Ce document confirme l'authenticité d'un certificat STEF via ID unique et signature.
            </p>
          </div>

          {/* Details Grid */}
          <div className="px-6 py-5 space-y-4 border-b">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Titulaire</p>
                <p className="font-semibold text-foreground">
                  {certification.first_name} {certification.last_name}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Certification</p>
                <p className="font-semibold text-foreground">
                  {certification.role_title} ({getLevelLabel(certification.level)})
                </p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Score</p>
                <p className="font-semibold text-foreground">
                  {certification.score} / 100
                </p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Certificat ID</p>
                <p className="font-mono text-sm font-medium text-foreground">
                  {certification.certificate_id}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Émis le</p>
                <p className="font-medium text-foreground">
                  {formatDate(certification.issued_at)}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Valide jusqu'au</p>
                <p className="font-medium text-foreground">
                  {certification.valid_until ? formatDate(certification.valid_until) : 'Illimité'}
                </p>
              </div>

              {showPercentile && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Positionnement</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    Top {certification.percentile_rank}%
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Verification Link */}
          <div className="px-6 py-4 border-b bg-muted/20">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">Lien de vérification</p>
                <p className="text-sm font-mono text-primary truncate">
                  {verifyUrl}
                </p>
              </div>
              <a 
                href={`mailto:contact@steftalent.ai?subject=Report%20Abuse%20${certification.certificate_id}`}
                className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap"
              >
                Signaler un abus
              </a>
            </div>
          </div>

          {/* Signature Section */}
          <div className="px-6 py-5 border-b">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                hasSignature ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
              }`}>
                {hasSignature ? (
                  <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Shield className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground mb-1">
                  {hasSignature ? 'Signed by STEF' : 'Non signé'}
                </p>
                
                {hasSignature && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">Signature:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        {formatSignatureHash(certification.signature_hash!)}
                      </code>
                      <button 
                        onClick={copySignature}
                        className="text-xs text-primary hover:underline"
                      >
                        Copier
                      </button>
                    </div>
                    {certification.signed_at && (
                      <p className="text-xs text-muted-foreground">
                        Signé le: {formatDate(certification.signed_at)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
              Certification interne basée sur une évaluation de compétences. Ne constitue pas un diplôme d'État.
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-muted/30 text-center">
            <p className="text-xs text-muted-foreground">
              STEF · steftalent.fr
            </p>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-8 space-y-4">
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-1">Qu'est-ce que STEF ?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              STEF évalue et certifie les compétences techniques des développeurs via un assessment standardisé de 45 minutes.{" "}
              <Link to="/process" className="text-primary hover:underline">En savoir plus</Link>.
            </p>

            <h2 className="font-semibold text-foreground mb-1">Vous êtes recruteur ?</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Accédez à notre catalogue de talents certifiés.
            </p>
            <Button asChild>
              <Link to="/entreprises">
                Accéder aux talents
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
