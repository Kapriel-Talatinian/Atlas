import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientDashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, RefreshCw, ChevronRight } from "lucide-react";

const SECTIONS = [
  { id: "auth", label: "Authentification" },
  { id: "projects", label: "Projets" },
  { id: "uploads", label: "Upload de données" },
  { id: "tasks", label: "Tâches" },
  { id: "exports", label: "Export" },
  { id: "webhooks", label: "Webhooks" },
  { id: "errors", label: "Erreurs" },
] as const;

const CodeBlock = ({ title, code, lang = "bash" }: { title?: string; code: string; lang?: string }) => {
  const copy = () => { navigator.clipboard.writeText(code); toast.success("Copié"); };
  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <span className="text-xs font-mono text-muted-foreground">{title}</span>
          <Button variant="ghost" size="sm" onClick={copy} className="h-6 px-2 text-xs">
            <Copy className="h-3 w-3 mr-1" /> Copier
          </Button>
        </div>
      )}
      <pre className="p-4 text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  );
};

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    POST: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    PUT: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  return <Badge variant="outline" className={`font-mono text-xs ${colors[method] || ""}`}>{method}</Badge>;
};

const EndpointSection = ({ method, path, description, requestExample, responseExample, responseStatus = "200" }: {
  method: string; path: string; description: string;
  requestExample?: string; responseExample: string; responseStatus?: string;
}) => (
  <div className="space-y-4 pb-8 border-b border-border last:border-0">
    <div className="flex items-center gap-3">
      <MethodBadge method={method} />
      <code className="text-sm font-mono text-foreground font-medium">{path}</code>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    {requestExample && <CodeBlock title="Requête" code={requestExample} lang="json" />}
    <CodeBlock title={`Réponse ${responseStatus}`} code={responseExample} lang="json" />
  </div>
);

export default function ApiDocumentation() {
  const [activeSection, setActiveSection] = useState("auth");
  const [showKey, setShowKey] = useState(false);
  const queryClient = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ["client-api-info"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("clients").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      return data?.[0] ?? null;
    },
  });

  const generateKey = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("client-api", {
        body: { path: "/api-key/generate" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Nouvelle clé API générée");
      queryClient.invalidateQueries({ queryKey: ["client-api-info"] });
      // Show key temporarily
      setShowKey(true);
    },
  });

  const maskedKey = client?.api_key_prefix
    ? `stef_live_${client.api_key_prefix}${"•".repeat(24)}`
    : "Aucune clé générée";

  const baseUrl = "https://iwhwhriielbpkopfoqjp.supabase.co/functions/v1/client-api";

  return (
    <ClientDashboardLayout>
      <div className="flex gap-8 max-w-7xl mx-auto">
        {/* Sidebar nav */}
        <nav className="hidden lg:block w-56 shrink-0 sticky top-24 h-fit">
          <div className="space-y-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-10 pb-20">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documentation API</h1>
            <p className="text-muted-foreground mt-1">
              Intégrez STEF dans votre pipeline via notre API REST.
            </p>
          </div>

          {/* API Key section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Votre clé API</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                  {showKey ? maskedKey : maskedKey.replace(/[a-zA-Z0-9]/g, "•")}
                </code>
                <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(maskedKey); toast.success("Copié"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateKey.mutate()}
                  disabled={generateKey.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${generateKey.isPending ? "animate-spin" : ""}`} />
                  {client?.api_key_hash ? "Regénérer la clé" : "Générer une clé"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  La clé n'est affichée qu'une seule fois. Si vous la perdez, vous devrez en regénérer une.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Auth */}
          {activeSection === "auth" && (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold">Authentification</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Toutes les requêtes à l'API STEF nécessitent une clé API envoyée dans l'en-tête Authorization.
              </p>
              <CodeBlock
                title="En-tête d'authentification"
                code={`Authorization: Bearer stef_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
              />
              <CodeBlock
                title="Exemple curl"
                code={`curl -X POST "${baseUrl}" \\
  -H "Authorization: Bearer stef_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"path": "/projects", "method": "GET"}'`}
              />
              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-2">Rate Limiting</h3>
                <p className="text-sm text-muted-foreground">
                  Par défaut : 100 requêtes par minute. Plan Enterprise : 500/min.
                  Les en-têtes X-RateLimit-Limit, X-RateLimit-Remaining et X-RateLimit-Reset
                  sont inclus dans chaque réponse.
                </p>
              </div>
            </section>
          )}

          {/* Projects */}
          {activeSection === "projects" && (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold">Projets</h2>

              <EndpointSection
                method="POST"
                path="/projects"
                description="Créer un nouveau projet d'annotation."
                requestExample={`{
  "path": "/projects",
  "method": "POST",
  "name": "Évaluation Mistral Medical v2",
  "domain": "medical",
  "task_type": "scoring",
  "language": "fr",
  "sla_tier": "standard"
}`}
                responseExample={`{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Évaluation Mistral Medical v2",
  "domain": "medical",
  "task_type": "scoring",
  "status": "draft",
  "created_at": "2026-03-29T12:00:00Z"
}`}
                responseStatus="201"
              />

              <EndpointSection
                method="GET"
                path="/projects"
                description="Lister tous vos projets avec pagination."
                requestExample={`{
  "path": "/projects",
  "method": "GET",
  "params": { "page": 1, "per_page": 20 }
}`}
                responseExample={`{
  "data": [
    {
      "id": "...",
      "name": "Mon projet",
      "domain": "medical",
      "task_type": "scoring",
      "status": "active",
      "total_tasks": 1000,
      "sla_tier": "standard",
      "created_at": "..."
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 3 }
}`}
              />

              <EndpointSection
                method="GET"
                path="/projects/:id"
                description="Détail d'un projet avec métriques de progression et SLA."
                requestExample={`{
  "path": "/projects/550e8400-...",
  "method": "GET"
}`}
                responseExample={`{
  "id": "550e8400-...",
  "name": "Mon projet",
  "domain": "medical",
  "status": "active",
  "total_tasks": 1000,
  "completed_tasks": 450,
  "pending_tasks": 320,
  "sla": {
    "committed_delivery_date": "2026-04-12",
    "guaranteed_min_alpha": 0.75,
    "at_risk": false,
    "current_alpha": 0.84
  }
}`}
              />
            </section>
          )}

          {/* Uploads */}
          {activeSection === "uploads" && (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold">Upload de données</h2>

              <EndpointSection
                method="GET"
                path="/uploads/:id"
                description="Vérifier le statut de validation d'un upload."
                requestExample={`{
  "path": "/uploads/abc123-...",
  "method": "GET"
}`}
                responseExample={`{
  "upload_id": "abc123-...",
  "status": "valid",
  "total_rows": 1000,
  "valid_rows": 987,
  "invalid_rows": 8,
  "duplicate_rows": 5,
  "pii_detected_rows": 12,
  "cost_estimate": { "total": 23462.50, "currency": "USD" },
  "delivery_estimate_days": 7,
  "errors": [
    { "row": 42, "error": "Champ 'response' vide" }
  ]
}`}
              />

              <EndpointSection
                method="POST"
                path="/uploads/:id/confirm"
                description="Confirmer l'upload et lancer l'annotation."
                requestExample={`{
  "path": "/uploads/abc123-.../confirm",
  "method": "POST"
}`}
                responseExample={`{
  "upload_id": "abc123-...",
  "status": "confirmed",
  "tasks_created": 987,
  "project_status": "active",
  "message": "987 tâches créées. L'annotation a démarré."
}`}
              />
            </section>
          )}

          {/* Tasks */}
          {activeSection === "tasks" && (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold">Tâches</h2>

              <EndpointSection
                method="GET"
                path="/projects/:id/tasks"
                description="Lister les tâches d'un projet avec filtres optionnels."
                requestExample={`{
  "path": "/projects/550e8400-.../tasks",
  "method": "GET",
  "params": {
    "status": "completed",
    "page": 1,
    "per_page": 50
  }
}`}
                responseExample={`{
  "data": [
    {
      "id": "task-uuid",
      "content": { "prompt": "...", "response": "..." },
      "status": "completed",
      "is_gold_standard": false,
      "created_at": "...",
      "completed_at": "..."
    }
  ],
  "pagination": { "page": 1, "per_page": 50, "total": 987 }
}`}
              />
            </section>
          )}

          {/* Exports */}
          {activeSection === "exports" && (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold">Export du dataset</h2>

              <EndpointSection
                method="POST"
                path="/projects/:id/export"
                description="Déclencher un export du dataset annoté."
                requestExample={`{
  "path": "/projects/550e8400-.../export",
  "method": "POST",
  "format": "jsonl",
  "min_alpha": 0.80,
  "include_reasoning": true
}`}
                responseExample={`{
  "export_id": "exp-uuid",
  "status": "generating",
  "message": "Export en cours de génération."
}`}
                responseStatus="202"
              />

              <EndpointSection
                method="GET"
                path="/exports/:id"
                description="Récupérer le statut et l'URL de téléchargement d'un export."
                requestExample={`{
  "path": "/exports/exp-uuid",
  "method": "GET"
}`}
                responseExample={`{
  "export_id": "exp-uuid",
  "status": "ready",
  "format": "jsonl",
  "total_items": 890,
  "download_url": "https://storage.stef.../exports/exp.jsonl",
  "exported_at": "2026-03-29T14:30:00Z"
}`}
              />

              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-2">Formats supportés</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code className="font-mono text-xs bg-muted px-1 rounded">jsonl</code> — Un objet JSON par ligne</li>
                  <li><code className="font-mono text-xs bg-muted px-1 rounded">parquet</code> — Format columnar optimisé</li>
                  <li><code className="font-mono text-xs bg-muted px-1 rounded">huggingface</code> — Compatible HuggingFace Datasets</li>
                </ul>
              </div>
            </section>
          )}

          {/* Webhooks */}
          {activeSection === "webhooks" && (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold">Webhooks</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Configurez des webhooks pour recevoir des notifications en temps réel sur l'avancement de vos projets.
              </p>

              <EndpointSection
                method="POST"
                path="/webhooks"
                description="Configurer un nouveau webhook."
                requestExample={`{
  "path": "/webhooks",
  "method": "POST",
  "url": "https://api.example.com/webhooks/stef",
  "events": ["project.completed", "batch.ready", "task.flagged"]
}`}
                responseExample={`{
  "id": "wh-uuid",
  "url": "https://api.example.com/webhooks/stef",
  "events": ["project.completed", "batch.ready", "task.flagged"],
  "secret": "whsec_xxxxxxxx",
  "created_at": "..."
}`}
                responseStatus="201"
              />

              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-2">Événements disponibles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div><code className="font-mono text-xs bg-muted px-1 rounded">project.completed</code> — Projet terminé</div>
                  <div><code className="font-mono text-xs bg-muted px-1 rounded">batch.ready</code> — Batch complété</div>
                  <div><code className="font-mono text-xs bg-muted px-1 rounded">task.flagged</code> — Tâche flaggée (α &lt; 0.67)</div>
                  <div><code className="font-mono text-xs bg-muted px-1 rounded">export.ready</code> — Export prêt</div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-2">Payload et signature</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Chaque payload est signé avec votre secret (HMAC SHA-256) dans l'en-tête <code className="font-mono text-xs bg-muted px-1 rounded">X-STEF-Signature</code>.
                </p>
                <CodeBlock
                  code={`{
  "event": "batch.ready",
  "project_id": "proj-uuid",
  "data": {
    "tasks_completed": 50,
    "mean_alpha": 0.86
  },
  "timestamp": "2026-03-29T14:30:00Z"
}`}
                />
              </div>
            </section>
          )}

          {/* Errors */}
          {activeSection === "errors" && (
            <section className="space-y-6">
              <h2 className="text-lg font-semibold">Gestion des erreurs</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Toutes les erreurs suivent un format standardisé avec un type, un message descriptif, un code machine et le paramètre fautif.
              </p>

              <CodeBlock
                title="Format d'erreur"
                code={`{
  "error": {
    "type": "invalid_request",
    "message": "Le champ 'domain' est obligatoire.",
    "code": "MISSING_FIELD",
    "param": "domain"
  }
}`}
              />

              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-3">Codes HTTP</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ["200", "Succès"],
                    ["201", "Ressource créée"],
                    ["202", "Traitement asynchrone accepté"],
                    ["400", "Requête invalide (champ manquant, valeur incorrecte)"],
                    ["401", "Non authentifié (clé API manquante ou invalide)"],
                    ["403", "Accès refusé (rôle insuffisant)"],
                    ["404", "Ressource non trouvée"],
                    ["422", "Erreur de validation (format, min_alpha hors plage)"],
                    ["429", "Rate limit dépassé — consultez X-RateLimit-Reset"],
                    ["500", "Erreur interne — notre équipe est notifiée"],
                  ].map(([code, desc]) => (
                    <div key={code} className="flex items-center gap-3">
                      <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded w-12 text-center">{code}</code>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-3">Codes d'erreur machine</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ["MISSING_FIELD", "Champ obligatoire absent"],
                    ["AUTH_REQUIRED", "En-tête Authorization absent"],
                    ["INVALID_AUTH", "Clé API invalide ou révoquée"],
                    ["INVALID_VALUE", "Valeur hors des valeurs autorisées"],
                    ["INVALID_UUID", "Format UUID attendu (xxxxxxxx-xxxx-…)"],
                    ["INVALID_JSON", "Corps de requête non parseable"],
                    ["EMPTY_BODY", "Corps de requête vide"],
                    ["RATE_LIMIT_EXCEEDED", "Quota de requêtes dépassé"],
                    ["NOT_FOUND", "Ressource introuvable"],
                    ["FORBIDDEN", "Accès refusé à cette ressource"],
                    ["VALIDATION_ERROR", "Erreur de validation des champs"],
                    ["INTERNAL_ERROR", "Erreur serveur interne"],
                  ].map(([code, desc]) => (
                    <div key={code} className="flex items-center gap-3">
                      <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded min-w-[180px]">{code}</code>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-3">Valeurs acceptées par champ</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ["domain", '"medical" | "legal" | "finance" | "code"'],
                    ["task_type", '"scoring" | "preference_dpo" | "comparison_ab" | "red_teaming" | "fact_checking" | "text_generation" | "span_annotation" | "extraction" | "conversation_rating"'],
                    ["sla_tier", '"standard" | "priority" | "express"'],
                    ["format", '"jsonl" | "parquet" | "huggingface"'],
                    ["min_alpha", "float entre 0.0 et 1.0 (défaut: 0.80)"],
                    ["status (tâches)", '"queued" | "assigned" | "in_progress" | "completed" | "pending" | "done"'],
                    ["events", '"project.completed" | "project.status_changed" | "batch.ready" | "task.flagged" | "export.ready" | "quality.alert" | "sla.at_risk"'],
                  ].map(([field, values]) => (
                    <div key={field} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                      <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded min-w-[120px] shrink-0">{field}</code>
                      <span className="text-muted-foreground font-mono text-xs">{values}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <h3 className="text-sm font-medium mb-3">Guide de résolution</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>429</strong> — Respectez l'en-tête <code className="font-mono text-xs bg-muted px-1 rounded">X-RateLimit-Reset</code> (timestamp UNIX) avant de réessayer.</p>
                  <p><strong>401</strong> — Régénérez votre clé depuis le dashboard STEF.</p>
                  <p><strong>400</strong> — Consultez <code className="font-mono text-xs bg-muted px-1 rounded">error.param</code> pour identifier le champ fautif.</p>
                  <p><strong>500</strong> — Erreur de notre côté. Conservez le timestamp et contactez le support.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
