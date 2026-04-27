import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus, Sparkles, Edit, Trash2, Eye, EyeOff, ExternalLink, FileText, Loader2, ArrowLeft, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ALL_TAGS = ["RLHF", "DPO", "Qualité des données", "Annotation", "Red-teaming", "Métriques", "Produit", "Recherche", "Médical", "Code", "Finance", "Juridique"];

interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_markdown: string;
  meta_description: string | null;
  tags: string[];
  status: string;
  source: string;
  estimated_read_minutes: number | null;
  views: number;
  published_at: string | null;
  created_at: string;
}

const BlogManagement = () => {
  const queryClient = useQueryClient();
  const [editingArticle, setEditingArticle] = useState<BlogArticle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: articles, isLoading } = useQuery({
    queryKey: ["admin-blog-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BlogArticle[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Article supprimé"); queryClient.invalidateQueries({ queryKey: ["admin-blog-articles"] }); setDeleteId(null); },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auto-generate-article");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Article généré : "${data?.title || 'Nouvel article'}"`);
      queryClient.invalidateQueries({ queryKey: ["admin-blog-articles"] });
    },
    onError: (e) => toast.error("Erreur génération : " + e.message),
  });

  const filtered = (articles || []).filter((a) => {
    if (statusFilter === "all") return true;
    return a.status === statusFilter;
  });

  const publishedCount = articles?.filter((a) => a.status === "published").length || 0;
  const draftCount = articles?.filter((a) => a.status === "draft").length || 0;
  const autoCount = articles?.filter((a) => a.status === "auto_generated").length || 0;

  if (editingArticle) {
    return (
      <ArticleEditor
        article={editingArticle}
        onBack={() => { setEditingArticle(null); queryClient.invalidateQueries({ queryKey: ["admin-blog-articles"] }); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Journal — Gestion</h2>
          <p className="text-muted-foreground text-sm">
            {articles?.length || 0} articles · {publishedCount} publiés · {draftCount} brouillons · {autoCount} auto-générés
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Générer avec IA
          </Button>
          <Button onClick={() => setEditingArticle({ id: "", title: "", slug: "", excerpt: "", content_markdown: "", meta_description: "", tags: [], status: "draft", source: "manual", estimated_read_minutes: 5, views: 0, published_at: null, created_at: new Date().toISOString() })}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel article
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "published", "draft", "auto_generated"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn("px-3 py-1.5 text-sm rounded-full border transition-colors", statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {s === "all" ? "Tous" : s === "published" ? "Publiés" : s === "draft" ? "Brouillons" : "Auto-générés"}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucun article</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Vues</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="font-medium truncate">{a.title}</p>
                        {a.source === "auto" && <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Bot className="w-3 h-3" /> Auto-généré</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.status === "published" ? "default" : "secondary"} className={cn(a.status === "published" && "bg-green-600", a.status === "auto_generated" && "bg-amber-600")}>
                        {a.status === "published" ? "Publié" : a.status === "draft" ? "Brouillon" : "Auto-généré"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">{a.tags?.slice(0, 2).map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>)}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.published_at ? format(new Date(a.published_at), "d MMM yyyy", { locale: fr }) : format(new Date(a.created_at), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right text-sm">{a.views}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => window.open(`/blog/${a.slug}`, "_blank")} title="Voir"><ExternalLink className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingArticle(a)} title="Modifier"><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ===== ARTICLE EDITOR =====
function ArticleEditor({ article, onBack }: { article: BlogArticle; onBack: () => void }) {
  const isNew = !article.id;
  const [form, setForm] = useState({
    title: article.title,
    slug: article.slug,
    content_markdown: article.content_markdown,
    excerpt: article.excerpt || "",
    meta_description: article.meta_description || "",
    tags: article.tags || [],
    status: article.status,
    estimated_read_minutes: article.estimated_read_minutes || 5,
  });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const generateSlug = (title: string) =>
    title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, slug: isNew || f.slug === generateSlug(f.title) ? generateSlug(title) : f.slug }));
  };

  const toggleTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag] }));
  };

  const handleSave = async (publish?: boolean) => {
    if (!form.title.trim() || !form.content_markdown.trim()) { toast.error("Titre et contenu requis."); return; }
    setSaving(true);
    const status = publish ? "published" : form.status === "published" ? "published" : "draft";
    const payload = {
      title: form.title,
      slug: form.slug || generateSlug(form.title),
      content_markdown: form.content_markdown,
      excerpt: form.excerpt || form.content_markdown.split(/\.\s/)[0]?.slice(0, 200) || "",
      meta_description: form.meta_description || form.excerpt?.slice(0, 160) || "",
      tags: form.tags,
      status,
      estimated_read_minutes: Math.max(1, Math.ceil(form.content_markdown.split(/\s+/).length / 200)),
      published_at: status === "published" ? (article.published_at || new Date().toISOString()) : null,
    };

    try {
      if (isNew) {
        const { error } = await supabase.from("blog_articles").insert(payload);
        if (error) throw error;
        toast.success(publish ? "Article publié !" : "Brouillon enregistré.");
      } else {
        const { error } = await supabase.from("blog_articles").update(payload).eq("id", article.id);
        if (error) throw error;
        toast.success("Article mis à jour.");
      }
      onBack();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la liste
      </Button>

      {/* Auto-generated banner */}
      {article.source === "auto" && article.status === "auto_generated" && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
          <Bot className="w-4 h-4 inline mr-2" />
          Cet article a été généré automatiquement. Relisez-le et modifiez-le avant de publier.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Editor (left) */}
        <div className="lg:col-span-3 space-y-4">
          <Input
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Titre de l'article"
            className="text-2xl font-bold border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 bg-transparent h-auto py-2"
          />
          <div className="flex gap-2 text-xs text-muted-foreground border-b border-border pb-2">
            {["**gras**", "*italique*", "## H2", "### H3", "`code`", "[lien](url)", "> citation", "- liste"].map((hint) => (
              <span key={hint} className="px-2 py-1 rounded bg-muted font-mono">{hint}</span>
            ))}
          </div>
          <Textarea
            value={form.content_markdown}
            onChange={(e) => setForm((f) => ({ ...f, content_markdown: e.target.value }))}
            placeholder="Contenu en Markdown..."
            className="font-mono text-sm min-h-[500px] resize-y"
          />
        </div>

        {/* Sidebar (right) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="published">Publié</SelectItem>
                    <SelectItem value="auto_generated">Auto-généré</SelectItem>
                    <SelectItem value="archived">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="font-mono text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Extrait</Label>
                <Textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} rows={2} maxLength={200} />
                <p className="text-[10px] text-muted-foreground mt-1">{form.excerpt.length}/200</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meta description (SEO)</Label>
                <Textarea value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} rows={2} maxLength={160} />
                <p className="text-[10px] text-muted-foreground mt-1">{form.meta_description.length}/160</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_TAGS.map((tag) => (
                    <button key={tag} onClick={() => toggleTag(tag)} className={cn("text-[11px] px-2 py-1 rounded-full border transition-colors", form.tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="w-4 h-4 mr-2" />
              {showPreview ? "Masquer le preview" : "Preview"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleSave(false)} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer le brouillon
            </Button>
            <Button className="w-full" onClick={() => handleSave(true)} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Publier
            </Button>
          </div>

          {/* Preview */}
          {showPreview && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Aperçu</CardTitle></CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-pre:bg-[#0D0D0F] prose-pre:border prose-pre:border-border prose-blockquote:border-primary">
                  <h1 className="text-xl font-bold mb-2">{form.title || "Sans titre"}</h1>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {form.content_markdown || "*Aucun contenu*"}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlogManagement;
