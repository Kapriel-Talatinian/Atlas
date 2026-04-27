import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Eye, 
  FileCheck, 
  User,
  Home,
  Camera,
  Loader2,
  Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KYCDocument {
  type: "government_id" | "proof_of_address" | "selfie_with_id";
  fileName: string;
  uploadedAt: string;
  url: string;
}

interface ExpertWithKYC {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  country: string;
  kyc_status: "pending" | "submitted" | "verified" | "rejected";
  kyc_submitted_at?: string;
  kyc_documents?: KYCDocument[];
}

const documentTypeLabels: Record<string, { label: string; icon: typeof User }> = {
  government_id: { label: "Pièce d'identité", icon: User },
  proof_of_address: { label: "Justificatif de domicile", icon: Home },
  selfie_with_id: { label: "Selfie avec ID", icon: Camera }
};

export default function KYCManagement() {
  const [experts, setExperts] = useState<ExpertWithKYC[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpert, setSelectedExpert] = useState<ExpertWithKYC | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("submitted");

  useEffect(() => {
    loadExperts();
  }, []);

  const loadExperts = async () => {
    try {
      const { data, error } = await supabase
        .from("expert_profiles")
        .select("id, user_id, full_name, email, country, kyc_status, kyc_submitted_at, kyc_documents")
        .neq("kyc_status", "pending")
        .order("kyc_submitted_at", { ascending: false });

      if (error) throw error;
      setExperts((data || []) as unknown as ExpertWithKYC[]);
    } catch (error) {
      console.error("Error loading experts:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedExpert) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from("expert_profiles")
        .update({
          kyc_status: "verified",
          kyc_verified_at: new Date().toISOString(),
          kyc_rejection_reason: null
        })
        .eq("id", selectedExpert.id);

      if (error) throw error;

      // Create notification for expert
      await supabase.from("notifications").insert({
        user_id: selectedExpert.user_id,
        title: "KYC approuvé !",
        message: "Votre identité a été vérifiée avec succès. Vous pouvez maintenant postuler aux offres d'emploi.",
        type: "success",
        link: "/expert/profile"
      });

      toast.success("KYC approuvé");
      setReviewDialogOpen(false);
      loadExperts();
    } catch (error) {
      console.error("Error approving KYC:", error);
      toast.error("Erreur lors de l'approbation");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedExpert || !rejectionReason.trim()) {
      toast.error("Veuillez indiquer une raison de rejet");
      return;
    }
    setProcessing(true);

    try {
      const { error } = await supabase
        .from("expert_profiles")
        .update({
          kyc_status: "rejected",
          kyc_rejection_reason: rejectionReason
        })
        .eq("id", selectedExpert.id);

      if (error) throw error;

      // Create notification for expert
      await supabase.from("notifications").insert({
        user_id: selectedExpert.user_id,
        title: "KYC rejeté",
        message: `Votre vérification d'identité a été rejetée: ${rejectionReason}`,
        type: "error",
        link: "/expert/profile"
      });

      toast.success("KYC rejeté");
      setReviewDialogOpen(false);
      setRejectionReason("");
      loadExperts();
    } catch (error) {
      console.error("Error rejecting KYC:", error);
      toast.error("Erreur lors du rejet");
    } finally {
      setProcessing(false);
    }
  };

  const openReviewDialog = (expert: ExpertWithKYC) => {
    setSelectedExpert(expert);
    setRejectionReason("");
    setReviewDialogOpen(true);
  };

  const getDocumentUrl = async (path: string) => {
    const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const filteredExperts = experts.filter(e => {
    const matchesSearch = e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         e.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "all" || e.kyc_status === activeTab;
    return matchesSearch && matchesTab;
  });

  const counts = {
    submitted: experts.filter(e => e.kyc_status === "submitted").length,
    verified: experts.filter(e => e.kyc_status === "verified").length,
    rejected: experts.filter(e => e.kyc_status === "rejected").length
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Gestion KYC
          </CardTitle>
          <CardDescription>
            Vérification des documents d'identité des experts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un expert..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="submitted" className="gap-2">
                <Clock className="h-4 w-4" />
                En attente ({counts.submitted})
              </TabsTrigger>
              <TabsTrigger value="verified" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Approuvés ({counts.verified})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2">
                <XCircle className="h-4 w-4" />
                Rejetés ({counts.rejected})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredExperts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun expert trouvé
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expert</TableHead>
                      <TableHead>Pays</TableHead>
                      <TableHead>Date de soumission</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExperts.map((expert) => (
                      <TableRow key={expert.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{expert.full_name}</p>
                            <p className="text-sm text-muted-foreground">{expert.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{expert.country}</TableCell>
                        <TableCell>
                          {expert.kyc_submitted_at 
                            ? new Date(expert.kyc_submitted_at).toLocaleDateString("fr-FR")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {(expert.kyc_documents || []).length} / 3
                        </TableCell>
                        <TableCell>
                          {expert.kyc_status === "verified" && (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Vérifié
                            </Badge>
                          )}
                          {expert.kyc_status === "submitted" && (
                            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                              <Clock className="w-3 h-3 mr-1" /> En attente
                            </Badge>
                          )}
                          {expert.kyc_status === "rejected" && (
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                              <XCircle className="w-3 h-3 mr-1" /> Rejeté
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openReviewDialog(expert)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Examiner
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vérification KYC - {selectedExpert?.full_name}</DialogTitle>
            <DialogDescription>
              {selectedExpert?.email} • {selectedExpert?.country}
            </DialogDescription>
          </DialogHeader>

          {selectedExpert && (
            <div className="space-y-4">
              <div className="grid gap-3">
                {(selectedExpert.kyc_documents || []).map((doc) => {
                  const docInfo = documentTypeLabels[doc.type];
                  const Icon = docInfo?.icon || FileCheck;
                  return (
                    <div key={doc.type} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{docInfo?.label || doc.type}</p>
                          <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => getDocumentUrl(doc.url)}>
                        <Download className="w-4 h-4 mr-2" />
                        Voir
                      </Button>
                    </div>
                  );
                })}
              </div>

              {selectedExpert.kyc_status === "submitted" && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Raison du rejet (obligatoire si rejeté)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {selectedExpert?.kyc_status === "submitted" && (
              <>
                <Button variant="destructive" onClick={handleReject} disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Rejeter
                </Button>
                <Button onClick={handleApprove} disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Approuver
                </Button>
              </>
            )}
            {selectedExpert?.kyc_status !== "submitted" && (
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Fermer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
