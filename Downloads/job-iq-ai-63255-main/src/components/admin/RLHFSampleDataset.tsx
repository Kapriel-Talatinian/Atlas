import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Download,
  FileJson,
  Eye,
  Loader2,
  Lock,
  Shield,
  CheckCircle2,
  Database,
  Copy,
  Check
} from "lucide-react";

// Sample anonymized data structure
const SAMPLE_DATA = [
  {
    rlhf_id: "sample_001",
    task: {
      task_type: "ai_hiring_test_evaluation",
      job_role: "Backend Developer",
      job_level_targeted: "mid",
      language: "fr",
      country_context: "France",
      prompt_used: "Évaluez ce test technique pour un développeur Backend...",
      constraints: { time_limit: 60, max_questions: 5 }
    },
    ai_output: {
      model_type: "lovable_ai_v1",
      generated_test: {
        questions: [
          { id: 1, type: "code", difficulty: "medium", topic: "REST API" },
          { id: 2, type: "mcq", difficulty: "easy", topic: "HTTP methods" }
        ]
      },
      generation_timestamp: "2024-01-15T10:30:00Z"
    },
    human_feedback: {
      overall_rating: "up",
      scores: { clarity: 4, relevance: 5, difficulty_alignment: 4, job_realism: 5, bias_risk: 1 },
      issues_detected: [],
      free_text_comment: "Test bien équilibré pour le niveau visé",
      preferred_action: "approve"
    },
    annotator: {
      annotator_id: "anon_a1b2c3d4",
      role: "backend_developer",
      seniority: "senior",
      experience_years: 8,
      region: "Europe",
      country: "France",
      languages: ["fr", "en"]
    },
    quality_control: {
      gold_task: false,
      agreement_score: 0.92,
      qa_status: "validated",
      profile_completeness: 95,
      kyc_verified: true
    },
    legal: {
      rights_assigned: true,
      pii_present: false,
      consent_version: "v2.0"
    },
    metadata: {
      platform_version: "web_v1",
      session_id: "sess_xyz789",
      timestamp: "2024-01-15T10:45:00Z"
    }
  },
  {
    rlhf_id: "sample_002",
    task: {
      task_type: "ai_hiring_test_evaluation",
      job_role: "Data Scientist",
      job_level_targeted: "senior",
      language: "en",
      country_context: "United States",
      prompt_used: "Evaluate this technical assessment for a Senior Data Scientist...",
      constraints: { time_limit: 90, max_questions: 7 }
    },
    ai_output: {
      model_type: "lovable_ai_v1",
      generated_test: {
        questions: [
          { id: 1, type: "code", difficulty: "hard", topic: "ML Pipeline" },
          { id: 2, type: "code", difficulty: "hard", topic: "Feature Engineering" },
          { id: 3, type: "essay", difficulty: "medium", topic: "Model Selection" }
        ]
      },
      generation_timestamp: "2024-01-16T14:20:00Z"
    },
    human_feedback: {
      overall_rating: "down",
      scores: { clarity: 3, relevance: 4, difficulty_alignment: 2, job_realism: 4, bias_risk: 2 },
      issues_detected: ["difficulty_too_high", "time_insufficient"],
      free_text_comment: "Questions too complex for the allocated time",
      preferred_action: "regenerate"
    },
    annotator: {
      annotator_id: "anon_e5f6g7h8",
      role: "data_scientist",
      seniority: "lead",
      experience_years: 12,
      region: "North America",
      country: "United States",
      languages: ["en"]
    },
    quality_control: {
      gold_task: false,
      agreement_score: 0.85,
      qa_status: "validated",
      profile_completeness: 88,
      kyc_verified: true
    },
    legal: {
      rights_assigned: true,
      pii_present: false,
      consent_version: "v2.0"
    },
    metadata: {
      platform_version: "web_v1",
      session_id: "sess_abc123",
      timestamp: "2024-01-16T14:35:00Z"
    }
  },
  {
    rlhf_id: "sample_003",
    task: {
      task_type: "ai_hiring_test_evaluation",
      job_role: "Frontend Developer",
      job_level_targeted: "junior",
      language: "fr",
      country_context: "France",
      prompt_used: "Évaluez ce test technique pour un développeur Frontend junior...",
      constraints: { time_limit: 45, max_questions: 4 }
    },
    ai_output: {
      model_type: "lovable_ai_v1",
      generated_test: {
        questions: [
          { id: 1, type: "mcq", difficulty: "easy", topic: "HTML/CSS" },
          { id: 2, type: "code", difficulty: "easy", topic: "JavaScript basics" }
        ]
      },
      generation_timestamp: "2024-01-17T09:15:00Z"
    },
    human_feedback: {
      overall_rating: "up",
      scores: { clarity: 5, relevance: 5, difficulty_alignment: 5, job_realism: 4, bias_risk: 1 },
      issues_detected: [],
      free_text_comment: "Parfait pour un profil junior",
      preferred_action: "approve"
    },
    annotator: {
      annotator_id: "anon_i9j0k1l2",
      role: "frontend_developer",
      seniority: "expert",
      experience_years: 6,
      region: "Europe",
      country: "Belgium",
      languages: ["fr", "en", "nl"]
    },
    quality_control: {
      gold_task: true,
      agreement_score: 0.98,
      qa_status: "validated",
      profile_completeness: 100,
      kyc_verified: true
    },
    legal: {
      rights_assigned: true,
      pii_present: false,
      consent_version: "v2.0"
    },
    metadata: {
      platform_version: "web_v1",
      session_id: "sess_def456",
      timestamp: "2024-01-17T09:30:00Z"
    }
  }
];

export function RLHFSampleDataset() {
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDownloadSample() {
    setDownloading(true);
    try {
      // Convert to JSONL format
      const jsonl = SAMPLE_DATA.map(item => JSON.stringify(item)).join("\n");
      
      const blob = new Blob([jsonl], { type: "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stef_rlhf_sample_${Date.now()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Sample dataset téléchargé");
    } catch (error) {
      console.error("Error downloading sample:", error);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadReal() {
    setDownloading(true);
    try {
      toast.info("Génération du sample anonymisé...");
      
      const { data, error } = await supabase.functions.invoke("export-rlhf-gold", {
        body: {
          format: "jsonl",
          limit: 10,
          only_validated: true
        }
      });

      if (error) throw error;

      if (data.count === 0) {
        toast.warning("Aucune donnée validée disponible. Utilisation du sample statique.");
        handleDownloadSample();
        return;
      }

      const blob = new Blob([data.data], { type: "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stef_rlhf_real_sample_${Date.now()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Sample téléchargé: ${data.count} entrées`);
    } catch (error) {
      console.error("Error downloading real sample:", error);
      toast.error("Erreur - Utilisation du sample statique");
      handleDownloadSample();
    } finally {
      setDownloading(false);
    }
  }

  function handleCopy() {
    const jsonl = SAMPLE_DATA.map(item => JSON.stringify(item, null, 2)).join("\n\n---\n\n");
    navigator.clipboard.writeText(jsonl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copié dans le presse-papiers");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Sample Dataset Anonymisé
          </h2>
          <p className="text-muted-foreground">
            Échantillon de données pour démonstration et évaluation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? "Masquer" : "Prévisualiser"}
          </Button>
          <Button onClick={handleDownloadReal} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Télécharger Sample
          </Button>
        </div>
      </div>

      {/* Sample Info Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileJson className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{SAMPLE_DATA.length}</p>
                <p className="text-sm text-muted-foreground">Entrées sample</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Lock className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">100%</p>
                <p className="text-sm text-muted-foreground">Anonymisé</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Shield className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">PII détectées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">Gold</p>
                <p className="text-sm text-muted-foreground">Standard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anonymization Notice */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Lock className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Anonymisation Stricte</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Ce sample respecte les standards d'anonymisation les plus stricts :
              </p>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>IDs remplacés par format anon_XXXXXXXX</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Aucun nom, email ou téléphone</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Pays/région agrégés seulement</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Sessions non traçables</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Structure Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Structure Gold Standard
          </CardTitle>
          <CardDescription>
            Format JSONL optimisé pour fine-tuning et évaluation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-5 gap-3">
            {[
              { name: "task", desc: "Contexte de la tâche", color: "bg-blue-500" },
              { name: "ai_output", desc: "Génération IA", color: "bg-purple-500" },
              { name: "human_feedback", desc: "Jugement humain", color: "bg-green-500" },
              { name: "annotator", desc: "Profil anonyme", color: "bg-amber-500" },
              { name: "quality_control", desc: "QA & Metadata", color: "bg-red-500" }
            ].map((block) => (
              <div key={block.name} className="p-3 rounded-lg border bg-muted/30">
                <div className={`w-3 h-3 rounded-full ${block.color} mb-2`} />
                <p className="font-medium text-sm">{block.name}</p>
                <p className="text-xs text-muted-foreground">{block.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      {showPreview && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Aperçu des données</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 rounded-lg border bg-muted/30 p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(SAMPLE_DATA[0], null, 2)}
              </pre>
              <Separator className="my-4" />
              <p className="text-center text-sm text-muted-foreground">
                + {SAMPLE_DATA.length - 1} autres entrées...
              </p>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Download Options */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={handleDownloadSample}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <FileJson className="h-6 w-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Sample Statique</h3>
                <p className="text-sm text-muted-foreground">
                  3 entrées de démonstration anonymisées
                </p>
              </div>
              <Badge variant="outline">JSONL</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={handleDownloadReal}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Database className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Sample Réel (10 entrées)</h3>
                <p className="text-sm text-muted-foreground">
                  Données validées de production anonymisées
                </p>
              </div>
              <Badge className="bg-green-500">Live</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
