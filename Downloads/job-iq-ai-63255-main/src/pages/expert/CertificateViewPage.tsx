import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ExpertDashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Download, 
  Copy,
  Linkedin,
  ShieldCheck,
  ExternalLink,
  ImageIcon,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { 
  getLinkedInShareUrl, 
  getLinkedInPostText,
  getLinkedInCredentialFields,
  getLevelLabel
} from "@/utils/generateLinkedInBadge";

interface Certification {
  id: string;
  certificate_id: string;
  first_name: string;
  last_name: string;
  country: string | null;
  role_title: string;
  level: string;
  score: number;
  assessment_name: string;
  issued_at: string;
  valid_until: string | null;
  status: string;
  signature_hash: string | null;
  signed_at: string | null;
  percentile_rank: number | null;
  min_samples_met: boolean | null;
}

export default function CertificateViewPage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const navigate = useNavigate();
  const [certification, setCertification] = useState<Certification | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingCert, setSigningCert] = useState(false);
  const [generatingBadge, setGeneratingBadge] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (certificateId) {
      loadCertification();
    }
  }, [certificateId]);

  const loadCertification = async () => {
    try {
      const { data, error } = await supabase
        .from("certifications")
        .select("*")
        .eq("certificate_id", certificateId)
        .single();

      if (error) throw error;
      setCertification(data);

      if (data && !data.signature_hash && data.status === 'valid') {
        await signCertificate(data.id);
      }

      await supabase.from("certificate_events").insert({
        certification_id: data.id,
        event_type: "downloaded"
      });
    } catch (error) {
      console.error("Error loading certification:", error);
      toast.error("Certification introuvable");
      navigate("/expert/certifications");
    } finally {
      setLoading(false);
    }
  };

  const signCertificate = async (certId: string) => {
    setSigningCert(true);
    try {
      const { data, error } = await supabase.functions.invoke('sign-certificate', {
        body: { certification_id: certId }
      });

      if (error) throw error;
      
      if (data?.success) {
        setCertification(prev => prev ? {
          ...prev,
          signature_hash: data.signature_hash,
          signed_at: data.signed_at
        } : null);
      }
    } catch (error) {
      console.error("Error signing certificate:", error);
    } finally {
      setSigningCert(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(verificationUrl);
    toast.success("Lien de vérification copié !");
  };

  const handleCopyLinkedInText = () => {
    if (!certification) return;
    const text = getLinkedInPostText({
      roleTitle: certification.role_title,
      level: certification.level,
      score: certification.score,
      verificationUrl
    });
    navigator.clipboard.writeText(text);
    toast.success("Texte copié pour LinkedIn !");
  };

  const handleShareLinkedIn = () => {
    window.open(getLinkedInShareUrl(verificationUrl), '_blank');
  };

  const handleDownloadBadge = async () => {
    if (!certification || certification.status !== 'valid') {
      toast.error("Seuls les certificats valides peuvent être exportés");
      return;
    }

    setGeneratingBadge(true);
    try {
      const blob = await generateBadgeCanvas();
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stef-badge-${certification.certificate_id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Badge LinkedIn téléchargé !");
    } catch (error) {
      console.error("Error generating badge:", error);
      toast.error("Erreur lors de la génération du badge");
    } finally {
      setGeneratingBadge(false);
    }
  };

  const generateBadgeCanvas = async (): Promise<Blob> => {
    if (!certification) throw new Error("No certification");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const scale = 2;
    const size = 1200;
    canvas.width = size * scale;
    canvas.height = size * scale;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, size - 80, size - 80);

    // Inner accent line
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, size - 100, size - 100);

    // STEF Logo area
    ctx.fillStyle = '#0b1c2d';
    ctx.beginPath();
    ctx.roundRect(100, 100, 120, 120, 20);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEF', 160, 160);

    // "STEF Skills Validated" header
    ctx.fillStyle = '#0b1c2d';
    ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STEF Skills Validated', size / 2, 300);

    // Divider
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(300, 360);
    ctx.lineTo(size - 300, 360);
    ctx.stroke();

    // Role title with word wrap
    ctx.fillStyle = '#0b1c2d';
    ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
    
    const maxWidth = size - 200;
    const words = certification.role_title.split(' ');
    let lines: string[] = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width < maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);

    let yPos = 440;
    for (const line of lines) {
      ctx.fillText(line, size / 2, yPos);
      yPos += 56;
    }

    // Level badge
    const levelY = yPos + 40;
    const levelText = `Level: ${getLevelLabel(certification.level)}`;
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    const levelWidth = ctx.measureText(levelText).width + 60;
    
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.roundRect(size / 2 - levelWidth / 2, levelY - 25, levelWidth, 50, 25);
    ctx.fill();
    
    ctx.fillStyle = '#4f46e5';
    ctx.fillText(levelText, size / 2, levelY + 5);

    // Score
    const scoreY = levelY + 90;
    ctx.fillStyle = '#6b7280';
    ctx.font = '32px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Score: ${certification.score}/100`, size / 2, scoreY);

    // Name
    ctx.fillStyle = '#374151';
    ctx.font = '36px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${certification.first_name} ${certification.last_name}`, size / 2, 880);

    // QR Code
    const qrSize = 140;
    const qrX = size - 180;
    const qrY = size - 220;
    
    if (qrRef.current) {
      const svg = qrRef.current.querySelector('svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, qrX - qrSize / 2, qrY - qrSize / 2, qrSize, qrSize);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.src = url;
        });
      }
    }

    // Certificate ID
    ctx.fillStyle = '#9ca3af';
    ctx.font = '22px monospace';
    ctx.fillText(certification.certificate_id, size / 2, size - 80);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0);
    });
  };

  const handleCopyCredentials = () => {
    if (!certification) return;
    const fields = getLinkedInCredentialFields({
      roleTitle: certification.role_title,
      certificateId: certification.certificate_id,
      issuedAt: certification.issued_at,
      validUntil: certification.valid_until,
      verificationUrl
    });
    
    const text = `Certification: ${fields.name}
Organisation: ${fields.issuingOrganization}
Date d'émission: ${fields.issueDate}
${fields.expirationDate ? `Date d'expiration: ${fields.expirationDate}` : ''}
ID: ${fields.credentialId}
URL: ${fields.credentialUrl}`;
    
    navigator.clipboard.writeText(text);
    toast.success("Informations copiées !");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatSignatureHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 6)}`;
  };

  if (loading) {
    return (
      <ExpertDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ExpertDashboardLayout>
    );
  }

  if (!certification) {
    return null;
  }

  const verificationUrl = `${window.location.origin}/verify/${certification.certificate_id}`;
  const isValid = certification.status === 'valid';

  return (
    <ExpertDashboardLayout>
      {/* Action bar - hidden in print */}
      <div className="print:hidden px-4 md:px-8 py-4 border-b bg-background sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/expert/certifications")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Copy className="w-4 h-4 mr-2" />
              Copier lien
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:grid lg:grid-cols-3 gap-6">
          
          {/* Certificate - Main area (A4 Landscape) */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div
              id="certificate-container"
              className="bg-white rounded-lg shadow-lg print:shadow-none print:rounded-none overflow-hidden"
              style={{ 
                width: '100%',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                color: '#0b1220'
              }}
            >
              <div className="p-4 sm:p-6 md:p-8 lg:p-10 xl:p-14">
                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-6 sm:mb-8 md:mb-10 lg:mb-14">
                  <div 
                    className="text-lg sm:text-xl md:text-[22px] font-black tracking-[0.18em]"
                    style={{ color: '#0b1c2d' }}
                  >
                    STEF
                  </div>
                  <div className="text-left sm:text-right text-[10px] sm:text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                    <div>Certificate ID: {certification.certificate_id}</div>
                    <div>Issued on {formatDate(certification.issued_at)}</div>
                    <div>Valid until {certification.valid_until ? formatDate(certification.valid_until) : 'Unlimited'}</div>
                  </div>
                </header>

                {/* Title */}
                <h1 
                  className="text-xl sm:text-2xl md:text-3xl lg:text-[40px] font-black mb-2 sm:mb-3 md:mb-4"
                  style={{ color: '#0b1c2d' }}
                >
                  Attestation of Technical Skills
                </h1>
                <p 
                  className="text-xs sm:text-sm md:text-base leading-relaxed mb-6 sm:mb-8 md:mb-10 lg:mb-12 max-w-[720px]"
                  style={{ color: '#6b7280' }}
                >
                  This document attests that the individual named below has successfully
                  completed a practical technical evaluation. This is NOT an official diploma 
                  and does not guarantee employment.
                </p>

                {/* Recipient */}
                <div className="mb-6 sm:mb-8 md:mb-10">
                  <div 
                    className="text-[10px] sm:text-xs uppercase tracking-[0.12em] mb-1 sm:mb-2"
                    style={{ color: '#6b7280' }}
                  >
                    Awarded to
                  </div>
                  <h2 
                    className="text-lg sm:text-xl md:text-2xl lg:text-[30px] font-black m-0"
                    style={{ color: '#0b1c2d' }}
                  >
                    {certification.first_name} {certification.last_name}
                  </h2>
                  <p className="text-xs sm:text-sm md:text-base mt-1 sm:mt-2">
                    Validated skills in{' '}
                    <strong style={{ color: '#4f46e5' }}>{certification.role_title}</strong>
                  </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 lg:gap-6 mb-6 sm:mb-8 md:mb-10">
                  <div className="border p-2 sm:p-3 md:p-4 lg:p-5" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                    <div 
                      className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-[0.12em] mb-1"
                      style={{ color: '#6b7280' }}
                    >
                      Score
                    </div>
                    <div 
                      className="text-lg sm:text-xl md:text-2xl lg:text-[32px] font-black"
                      style={{ color: '#4f46e5' }}
                    >
                      {certification.score}<span className="text-sm sm:text-base md:text-lg lg:text-xl"> / 100</span>
                    </div>
                  </div>
                  
                  <div className="border p-2 sm:p-3 md:p-4 lg:p-5" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                    <div 
                      className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-[0.12em] mb-1"
                      style={{ color: '#6b7280' }}
                    >
                      Level
                    </div>
                    <div className="text-sm sm:text-base md:text-lg font-bold truncate">
                      {getLevelLabel(certification.level)}
                    </div>
                  </div>
                  
                  <div className="border p-2 sm:p-3 md:p-4 lg:p-5" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                    <div 
                      className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-[0.12em] mb-1"
                      style={{ color: '#6b7280' }}
                    >
                      Evaluation
                    </div>
                    <div className="text-xs sm:text-sm md:text-base lg:text-lg font-bold">
                      Practical Case
                    </div>
                  </div>
                  
                  <div className="border p-2 sm:p-3 md:p-4 lg:p-5" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                    <div 
                      className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-[0.12em] mb-1"
                      style={{ color: '#6b7280' }}
                    >
                      Standard
                    </div>
                    <div className="text-xs sm:text-sm md:text-base lg:text-lg font-bold">
                      STEF Talent
                    </div>
                  </div>
                </div>

                {/* Verification */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-6 mt-6 sm:mt-8 md:mt-10 lg:mt-12">
                  <div 
                    className="text-[10px] sm:text-[11px] md:text-[13px] leading-relaxed max-w-full sm:max-w-[400px] md:max-w-[520px]"
                    style={{ color: '#6b7280' }}
                  >
                    <p className="mb-1">
                      This certificate is <strong style={{ color: '#0b1220' }}>publicly verifiable</strong>.
                    </p>
                    <p>Verify authenticity at:</p>
                    <p className="font-medium break-all" style={{ color: '#4f46e5' }}>{verificationUrl}</p>
                  </div>
                  
                  <div 
                    ref={qrRef}
                    className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-40 lg:h-40 border flex items-center justify-center bg-white flex-shrink-0"
                    style={{ borderColor: 'rgba(0,0,0,.08)' }}
                  >
                    <QRCode
                      value={verificationUrl}
                      size={100}
                      level="M"
                      className="w-full h-full p-1"
                    />
                  </div>
                </div>

                {/* Footer */}
                <footer 
                  className="mt-6 sm:mt-8 md:mt-10 pt-3 sm:pt-4 border-t text-[8px] sm:text-[9px] md:text-[11px] leading-relaxed flex flex-col sm:flex-row justify-between gap-2 sm:gap-0"
                  style={{ borderColor: 'rgba(0,0,0,.08)', color: '#6b7280' }}
                >
                  <div>
                    <strong style={{ color: '#0b1220' }}>STEF</strong> – AI-powered talent evaluation platform
                  </div>
                  <div className="sm:text-right">
                    This certification is an internal skills assessment and not a state-recognized diploma.
                  </div>
                </footer>
              </div>
            </div>
          </div>

          {/* Sidebar - Actions & Verification */}
          <div className="print:hidden space-y-4 order-1 lg:order-2">
            {/* Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Statut
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {certification.status === 'valid' ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-semibold">Valide</span>
                    </div>
                  ) : certification.status === 'expired' ? (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <Clock className="w-5 h-5" />
                      <span className="font-semibold">Expiré</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="w-5 h-5" />
                      <span className="font-semibold">Révoqué</span>
                    </div>
                  )}
                </div>

                {certification.signature_hash && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Signature numérique</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                      {formatSignatureHash(certification.signature_hash)}
                    </code>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* LinkedIn Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-[#0077B5]" />
                  LinkedIn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                  <Button 
                    variant="outline" 
                    className="justify-start text-sm" 
                    size="sm"
                    onClick={handleDownloadBadge}
                    disabled={!isValid || generatingBadge}
                  >
                    <ImageIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{generatingBadge ? "..." : "Badge PNG"}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="justify-start text-sm" 
                    size="sm"
                    onClick={handleCopyLinkedInText}
                    disabled={!isValid}
                  >
                    <Copy className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Copier texte</span>
                  </Button>
                  
                  <Button 
                    className="justify-start bg-[#0077B5] hover:bg-[#006699] text-sm" 
                    size="sm"
                    onClick={handleShareLinkedIn}
                    disabled={!isValid}
                  >
                    <Linkedin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Partager</span>
                    <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0" />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    className="justify-start text-muted-foreground text-sm" 
                    size="sm"
                    onClick={handleCopyCredentials}
                  >
                    <Copy className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Credentials</span>
                  </Button>
                </div>

                {!isValid && (
                  <p className="text-xs text-amber-600 mt-2">
                    Export désactivé
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Download Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Télécharger
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={handlePrint}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Utilisez "Enregistrer en PDF" dans la boîte de dialogue
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          #certificate-container,
          #certificate-container * {
            visibility: visible;
          }
          #certificate-container {
            position: fixed;
            left: 0;
            top: 0;
            width: 1123px !important;
            height: 794px !important;
            max-width: none !important;
            background: white;
            border: none;
            box-shadow: none;
            border-radius: 0;
          }
          #certificate-container > div {
            padding: 56px 64px !important;
          }
          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `}</style>
    </ExpertDashboardLayout>
  );
}
