import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Database,
  Lock,
  Unlock,
  Globe,
  Plus,
  RefreshCw,
  Loader2,
  Download,
  Tag,
  Calendar,
  CheckCircle2,
  FileJson,
  Archive
} from "lucide-react";

interface DatasetVersion {
  id: string;
  version_name: string;
  version_number: number;
  description: string;
  schema_version: string;
  total_instances: number;
  validated_instances: number;
  is_published: boolean;
  is_locked: boolean;
  created_at: string;
  published_at: string | null;
  metadata: any;
}

export function RLHFDatasetVersioning() {
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Create form state
  const [newVersion, setNewVersion] = useState({
    version_name: "",
    description: "",
    schema_version: "v1.0"
  });

  useEffect(() => {
    loadVersions();
  }, []);

  async function loadVersions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rlhf_dataset_versions")
        .select("*")
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersions(data as DatasetVersion[] || []);
    } catch (error) {
      console.error("Error loading versions:", error);
      toast.error("Erreur lors du chargement des versions");
    } finally {
      setLoading(false);
    }
  }

  async function createVersion() {
    if (!newVersion.version_name) {
      toast.error("Le nom de version est requis");
      return;
    }

    setCreating(true);
    try {
      const nextNumber = versions.length > 0 
        ? Math.max(...versions.map(v => v.version_number)) + 1 
        : 1;

      const { error } = await supabase
        .from("rlhf_dataset_versions")
        .insert({
          version_name: newVersion.version_name,
          version_number: nextNumber,
          description: newVersion.description,
          schema_version: newVersion.schema_version,
          total_instances: 0,
          validated_instances: 0,
          is_published: false,
          is_locked: false,
          metadata: {
            created_by: "admin",
            annotation_schema: "gold_standard_v1"
          }
        });

      if (error) throw error;

      toast.success("Version créée avec succès");
      setShowCreate(false);
      setNewVersion({ version_name: "", description: "", schema_version: "v1.0" });
      loadVersions();
    } catch (error) {
      console.error("Error creating version:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  }

  async function toggleLock(version: DatasetVersion) {
    try {
      const { error } = await supabase
        .from("rlhf_dataset_versions")
        .update({ is_locked: !version.is_locked })
        .eq("id", version.id);

      if (error) throw error;
      toast.success(version.is_locked ? "Version déverrouillée" : "Version verrouillée");
      loadVersions();
    } catch (error) {
      console.error("Error toggling lock:", error);
      toast.error("Erreur lors du verrouillage");
    }
  }

  async function togglePublish(version: DatasetVersion) {
    try {
      const { error } = await supabase
        .from("rlhf_dataset_versions")
        .update({ 
          is_published: !version.is_published,
          published_at: !version.is_published ? new Date().toISOString() : null
        })
        .eq("id", version.id);

      if (error) throw error;
      toast.success(version.is_published ? "Version dépubliée" : "Version publiée");
      loadVersions();
    } catch (error) {
      console.error("Error publishing:", error);
      toast.error("Erreur lors de la publication");
    }
  }

  async function exportVersion(version: DatasetVersion) {
    try {
      toast.info("Export en cours...");
      
      const { data, error } = await supabase.functions.invoke("export-rlhf-gold", {
        body: {
          format: "jsonl",
          limit: 10000,
          only_validated: true
        }
      });

      if (error) throw error;

      // Create downloadable file
      const blob = new Blob([data.data], { type: "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${version.version_name}_${Date.now()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Export terminé: ${data.count} entrées`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Erreur lors de l'export");
    }
  }

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
            <Database className="h-6 w-6" />
            Dataset Versioning
          </h2>
          <p className="text-muted-foreground">
            Gestion des versions de datasets pour auditabilité et reproductibilité
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadVersions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Version
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Tag className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{versions.length}</p>
                <p className="text-sm text-muted-foreground">Versions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Globe className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{versions.filter(v => v.is_published).length}</p>
                <p className="text-sm text-muted-foreground">Publiées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <Lock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{versions.filter(v => v.is_locked).length}</p>
                <p className="text-sm text-muted-foreground">Verrouillées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {versions.reduce((acc, v) => acc + v.validated_instances, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Instances validées</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Readiness Banner */}
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Archive className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Audit-Ready pour AI Labs</h3>
              <p className="text-sm text-muted-foreground">
                Chaque version est immuable une fois verrouillée. Les prompts, schémas d'annotation,
                et métadonnées de provenance sont préservés pour la reproductibilité.
                <br/>
                <span className="text-blue-600 font-medium">Compatible: OpenAI, Anthropic, Google DeepMind, Mistral AI</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Versions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Versions du Dataset</CardTitle>
          <CardDescription>
            Historique et gestion des versions de données RLHF
          </CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune version créée</p>
              <p className="text-sm">Créez votre première version de dataset</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>Instances</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          v{v.version_number}
                        </Badge>
                        <span className="font-medium">{v.version_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {v.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{v.schema_version}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{v.validated_instances}</span>
                        <span className="text-muted-foreground">/{v.total_instances}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {v.is_locked && (
                          <Badge variant="outline" className="border-amber-500 text-amber-500">
                            <Lock className="h-3 w-3 mr-1" />
                            Verrouillé
                          </Badge>
                        )}
                        {v.is_published && (
                          <Badge className="bg-green-500">
                            <Globe className="h-3 w-3 mr-1" />
                            Publié
                          </Badge>
                        )}
                        {!v.is_locked && !v.is_published && (
                          <Badge variant="secondary">Brouillon</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleLock(v)}
                          title={v.is_locked ? "Déverrouiller" : "Verrouiller"}
                        >
                          {v.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePublish(v)}
                          disabled={!v.is_locked && !v.is_published}
                          title={v.is_published ? "Dépublier" : "Publier"}
                        >
                          <Globe className={`h-4 w-4 ${v.is_published ? 'text-green-500' : ''}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => exportVersion(v)}
                          title="Exporter JSONL"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouvelle Version de Dataset
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="version_name">Nom de la version *</Label>
              <Input
                id="version_name"
                placeholder="ex: STEF_RLHF_Q1_2024"
                value={newVersion.version_name}
                onChange={(e) => setNewVersion(prev => ({ ...prev, version_name: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Décrivez cette version du dataset..."
                value={newVersion.description}
                onChange={(e) => setNewVersion(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="schema_version">Version du schéma</Label>
              <Input
                id="schema_version"
                placeholder="v1.0"
                value={newVersion.schema_version}
                onChange={(e) => setNewVersion(prev => ({ ...prev, schema_version: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button onClick={createVersion} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Créer la version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
