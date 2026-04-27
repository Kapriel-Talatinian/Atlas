import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Award, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Ban,
  Eye,
  Copy
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  user_id: string;
}

interface ExpertProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  country: string;
}

const TRACK_OPTIONS = [
  { value: "FE", label: "Frontend" },
  { value: "BE", label: "Backend" },
  { value: "FS", label: "Fullstack" },
  { value: "DS", label: "Data Science" },
  { value: "DEVOPS", label: "DevOps" },
  { value: "MOBILE", label: "Mobile" },
  { value: "AI", label: "AI/ML" },
];

const LEVEL_OPTIONS = [
  { value: "associate", label: "Associate" },
  { value: "professional", label: "Professional" },
  { value: "expert", label: "Expert" },
];

export function CertificationsManagement() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);

  // Form state
  const [selectedExpert, setSelectedExpert] = useState<string>("");
  const [roleTitle, setRoleTitle] = useState("");
  const [level, setLevel] = useState<string>("associate");
  const [score, setScore] = useState<string>("75");
  const [assessmentName, setAssessmentName] = useState("");
  const [track, setTrack] = useState<string>("FS");
  const [validMonths, setValidMonths] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load certifications
      const { data: certsData, error: certsError } = await supabase
        .from("certifications")
        .select("*")
        .order("issued_at", { ascending: false });

      if (certsError) throw certsError;
      setCertifications(certsData || []);

      // Load experts for the dropdown
      const { data: expertsData, error: expertsError } = await supabase
        .from("expert_profiles")
        .select("id, user_id, full_name, email, country")
        .eq("onboarding_completed", true);

      if (expertsError) throw expertsError;
      setExperts(expertsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const issueCertificate = async () => {
    if (!selectedExpert || !roleTitle || !assessmentName) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIssuing(true);
    try {
      const expert = experts.find(e => e.id === selectedExpert);
      if (!expert) throw new Error("Expert non trouvé");

      const nameParts = expert.full_name.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const { data, error } = await supabase.rpc("issue_certificate", {
        p_user_id: expert.user_id,
        p_expert_id: expert.id,
        p_first_name: firstName,
        p_last_name: lastName,
        p_country: expert.country,
        p_role_title: roleTitle,
        p_level: level as "associate" | "professional" | "expert",
        p_score: parseInt(score),
        p_assessment_name: assessmentName,
        p_track: track,
        p_valid_months: validMonths ? parseInt(validMonths) : null
      });

      if (error) throw error;

      // Sign the certificate
      if (data) {
        try {
          await supabase.functions.invoke('sign-certificate', {
            body: { certification_id: data }
          });
        } catch (signError) {
          console.error("Warning: Could not sign certificate:", signError);
        }
      }

      toast.success("Certification délivrée avec succès");
      setIsIssueDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error issuing certificate:", error);
      toast.error("Erreur lors de la délivrance");
    } finally {
      setIssuing(false);
    }
  };

  const updateStatus = async (id: string, newStatus: "valid" | "expired" | "revoked") => {
    try {
      const { error } = await supabase
        .from("certifications")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Log event
      const eventType = newStatus === 'revoked' ? 'revoked' : 'expired';
      await supabase.from("certificate_events").insert({
        certification_id: id,
        event_type: eventType
      });

      toast.success(`Statut mis à jour: ${newStatus}`);
      loadData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const resetForm = () => {
    setSelectedExpert("");
    setRoleTitle("");
    setLevel("associate");
    setScore("75");
    setAssessmentName("");
    setTrack("FS");
    setValidMonths("");
  };

  const copyLink = (certificateId: string) => {
    const url = `${window.location.origin}/verify/${certificateId}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié !");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valid":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Valide
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            Expirée
          </Badge>
        );
      case "revoked":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Révoquée
          </Badge>
        );
      default:
        return null;
    }
  };

  const filteredCertifications = certifications.filter(cert =>
    cert.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.certificate_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.role_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6" />
            Gestion des Certifications
          </h2>
          <p className="text-muted-foreground">
            Délivrer, révoquer et gérer les certifications STEF
          </p>
        </div>
        
        <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Délivrer une certification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle certification</DialogTitle>
              <DialogDescription>
                Délivrer une certification STEF à un expert
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Expert *</Label>
                <Select value={selectedExpert} onValueChange={setSelectedExpert}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un expert" />
                  </SelectTrigger>
                  <SelectContent>
                    {experts.map(expert => (
                      <SelectItem key={expert.id} value={expert.id}>
                        {expert.full_name} ({expert.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Titre du rôle *</Label>
                <Input
                  value={roleTitle}
                  onChange={e => setRoleTitle(e.target.value)}
                  placeholder="Ex: Backend Engineer (Node.js)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Niveau</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVEL_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Score (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={score}
                    onChange={e => setScore(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Nom de l'évaluation *</Label>
                <Input
                  value={assessmentName}
                  onChange={e => setAssessmentName(e.target.value)}
                  placeholder="Ex: Évaluation Backend Node.js Avancée"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Track (pour l'ID)</Label>
                  <Select value={track} onValueChange={setTrack}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRACK_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Validité (mois)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={validMonths}
                    onChange={e => setValidMonths(e.target.value)}
                    placeholder="Illimitée"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={issueCertificate} disabled={issuing}>
                {issuing ? "Délivrance..." : "Délivrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{certifications.length}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {certifications.filter(c => c.status === 'valid').length}
            </div>
            <p className="text-sm text-muted-foreground">Valides</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">
              {certifications.filter(c => c.status === 'expired').length}
            </div>
            <p className="text-sm text-muted-foreground">Expirées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">
              {certifications.filter(c => c.status === 'revoked').length}
            </div>
            <p className="text-sm text-muted-foreground">Révoquées</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Rechercher par nom, ID ou rôle..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Certificat</TableHead>
                <TableHead>Titulaire</TableHead>
                <TableHead>Certification</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredCertifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucune certification trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredCertifications.map(cert => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-mono text-xs">
                      {cert.certificate_id}
                    </TableCell>
                    <TableCell>
                      {cert.first_name} {cert.last_name}
                    </TableCell>
                    <TableCell>{cert.role_title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{cert.level}</Badge>
                    </TableCell>
                    <TableCell>{cert.score}%</TableCell>
                    <TableCell>{getStatusBadge(cert.status)}</TableCell>
                    <TableCell>
                      {new Date(cert.issued_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLink(cert.certificate_id)}
                          title="Copier le lien"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/verify/${cert.certificate_id}`, '_blank')}
                          title="Voir"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {cert.status === 'valid' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateStatus(cert.id, 'revoked')}
                            title="Révoquer"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
