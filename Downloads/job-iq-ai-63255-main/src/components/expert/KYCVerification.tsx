import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileCheck, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle,
  User,
  Home,
  Camera,
  Loader2,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KYCDocument {
  type: "government_id" | "proof_of_address" | "selfie_with_id";
  fileName: string;
  uploadedAt: string;
  url: string;
}

interface KYCVerificationProps {
  profile: {
    id: string;
    user_id: string;
    kyc_status: "pending" | "submitted" | "verified" | "rejected";
    kyc_submitted_at?: string;
    kyc_verified_at?: string;
    kyc_rejection_reason?: string;
    kyc_documents?: KYCDocument[];
  };
  onUpdate: () => void;
}

const documentTypes = [
  {
    type: "government_id" as const,
    title: "Pièce d'identité",
    description: "Passeport ou carte d'identité nationale",
    icon: User,
    accept: "image/*,.pdf"
  },
  {
    type: "proof_of_address" as const,
    title: "Justificatif de domicile",
    description: "Facture de moins de 3 mois ou relevé bancaire",
    icon: Home,
    accept: "image/*,.pdf"
  },
  {
    type: "selfie_with_id" as const,
    title: "Selfie avec pièce d'identité",
    description: "Photo de vous tenant votre pièce d'identité",
    icon: Camera,
    accept: "image/*"
  }
];

export function KYCVerification({ profile, onUpdate }: KYCVerificationProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const documents = (profile.kyc_documents || []) as KYCDocument[];
  const uploadedTypes = documents.map(d => d.type);
  const allDocumentsUploaded = documentTypes.every(dt => uploadedTypes.includes(dt.type));
  const progress = (uploadedTypes.length / documentTypes.length) * 100;

  const handleFileUpload = async (type: string, file: File) => {
    if (!file) return;

    setUploading(type);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.user_id}/${type}-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get the URL
      const { data: urlData } = supabase.storage
        .from("kyc-documents")
        .getPublicUrl(fileName);

      // Update documents array
      const newDoc: KYCDocument = {
        type: type as KYCDocument["type"],
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        url: fileName // Store the path, not public URL since bucket is private
      };

      const updatedDocs = [
        ...documents.filter(d => d.type !== type),
        newDoc
      ];

      // Save to profile
      const { error } = await supabase
        .from("expert_profiles")
        .update({
          kyc_documents: JSON.parse(JSON.stringify(updatedDocs)),
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Document téléchargé avec succès");
      onUpdate();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveDocument = async (type: string) => {
    try {
      const doc = documents.find(d => d.type === type);
      if (doc) {
        // Delete from storage
        await supabase.storage.from("kyc-documents").remove([doc.url]);
      }

      // Update documents array
      const updatedDocs = documents.filter(d => d.type !== type);

      const { error } = await supabase
        .from("expert_profiles")
        .update({
          kyc_documents: JSON.parse(JSON.stringify(updatedDocs)),
          kyc_status: "pending",
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Document supprimé");
      onUpdate();
    } catch (error) {
      console.error("Error removing document:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSubmitKYC = async () => {
    if (!allDocumentsUploaded) {
      toast.error("Veuillez télécharger tous les documents requis");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("expert_profiles")
        .update({
          kyc_status: "submitted",
          kyc_submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Documents soumis pour vérification");
      onUpdate();
    } catch (error) {
      console.error("Error submitting KYC:", error);
      toast.error("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    switch (profile.kyc_status) {
      case "verified":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Vérifié</Badge>;
      case "submitted":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="w-3 h-3 mr-1" /> En cours de vérification</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" /> Rejeté</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" /> Non vérifié</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Vérification d'identité (KYC)
              </CardTitle>
              <CardDescription>
                Vérifiez votre identité pour postuler aux offres d'emploi
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          {profile.kyc_status === "verified" ? (
            <Alert className="border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700">
                Votre identité a été vérifiée le {new Date(profile.kyc_verified_at!).toLocaleDateString("fr-FR")}.
                Vous pouvez maintenant postuler aux offres d'emploi.
              </AlertDescription>
            </Alert>
          ) : profile.kyc_status === "rejected" ? (
            <Alert className="border-red-500/20 bg-red-500/5">
              <XCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700">
                <strong>Raison du rejet:</strong> {profile.kyc_rejection_reason || "Non spécifiée"}
                <br />
                Veuillez corriger les documents et soumettre à nouveau.
              </AlertDescription>
            </Alert>
          ) : profile.kyc_status === "submitted" ? (
            <Alert className="border-yellow-500/20 bg-yellow-500/5">
              <Clock className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-700">
                Vos documents sont en cours de vérification. Ce processus peut prendre 24 à 48 heures.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progression</span>
                  <span>{uploadedTypes.length}/{documentTypes.length} documents</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Upload */}
      {profile.kyc_status !== "verified" && (
        <div className="grid gap-4 md:grid-cols-3">
          {documentTypes.map((docType) => {
            const uploaded = documents.find(d => d.type === docType.type);
            const isUploading = uploading === docType.type;
            const Icon = docType.icon;

            return (
              <Card key={docType.type} className={uploaded ? "border-green-500/30 bg-green-500/5" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${uploaded ? "bg-green-500/10" : "bg-muted"}`}>
                      <Icon className={`w-5 h-5 ${uploaded ? "text-green-500" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{docType.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{docType.description}</p>
                      
                      {uploaded ? (
                        <div className="mt-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-xs truncate text-green-600">{uploaded.fileName}</span>
                          {profile.kyc_status !== "submitted" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => handleRemoveDocument(docType.type)}
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3">
                          <input
                            ref={(el) => (fileInputRefs.current[docType.type] = el)}
                            type="file"
                            accept={docType.accept}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(docType.type, file);
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRefs.current[docType.type]?.click()}
                            disabled={isUploading || profile.kyc_status === "submitted"}
                          >
                            {isUploading ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {isUploading ? "Téléchargement..." : "Télécharger"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Submit Button */}
      {profile.kyc_status === "pending" && allDocumentsUploaded && (
        <Button onClick={handleSubmitKYC} disabled={submitting} className="w-full">
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FileCheck className="w-4 h-4 mr-2" />
          )}
          Soumettre pour vérification
        </Button>
      )}

      {profile.kyc_status === "rejected" && (
        <Button onClick={handleSubmitKYC} disabled={submitting || !allDocumentsUploaded} className="w-full">
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FileCheck className="w-4 h-4 mr-2" />
          )}
          Soumettre à nouveau
        </Button>
      )}
    </div>
  );
}
