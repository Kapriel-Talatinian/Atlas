import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RLHFNavbar } from "@/components/RLHFNavbar";
import { RLHFFooter } from "@/components/RLHFFooter";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const TAGS = [
  "Tous",
  "RLHF",
  "DPO",
  "Qualité des données",
  "Annotation",
  "Red-teaming",
  "Métriques",
  "Produit",
  "Recherche",
];

const PAGE_SIZE = 10;

interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  tags: string[];
  status: string;
  estimated_read_minutes: number | null;
  published_at: string | null;
}

const Blog = () => {
  const navigate = useNavigate();
  const [activeTag, setActiveTag] = useState("Tous");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: articles, isLoading } = useQuery({
    queryKey: ["blog-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select("id, title, slug, excerpt, tags, status, estimated_read_minutes, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BlogArticle[];
    },
  });

  const filtered = (articles || []).filter((a) => {
    if (activeTag === "Tous") return true;
    return a.tags?.includes(activeTag);
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title="Journal — STEF"
        description="Recherche, méthodes et retours d'expérience sur l'annotation de données IA et le RLHF."
        path="/blog"
      />
      <RLHFNavbar />

      {/* Header */}
      <section className="pt-28 pb-12 px-4 sm:px-8 lg:px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-[28px] sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Journal
          </h1>
          <p className="text-muted-foreground mt-2 text-base sm:text-lg max-w-2xl">
            Recherche, méthodes et retours d'expérience sur l'annotation de données IA.
          </p>
        </div>
      </section>

      {/* Tag filters — scrollable on mobile */}
      <section className="px-4 sm:px-8 lg:px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => { setActiveTag(tag); setVisibleCount(PAGE_SIZE); }}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-full border transition-all duration-150 whitespace-nowrap min-h-[44px] sm:min-h-0 flex items-center",
                  activeTag === tag
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="px-4 sm:px-8 lg:px-4 pb-24">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <p className="text-center text-muted-foreground py-20">
              Aucun article publié{activeTag !== "Tous" ? ` pour le tag "${activeTag}"` : ""}.
            </p>
          ) : (
            <>
              {/* Featured (first article) */}
              <ArticleCard article={visible[0]} featured onClick={() => navigate(`/blog/${visible[0].slug}`)} />

              {/* Grid */}
              {visible.length > 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mt-8">
                  {visible.slice(1).map((a) => (
                    <ArticleCard key={a.id} article={a} onClick={() => navigate(`/blog/${a.slug}`)} />
                  ))}
                </div>
              )}

              {/* Load more */}
              {hasMore && (
                <div className="text-center mt-12">
                  <Button
                    variant="outline"
                    className="h-12 sm:h-10"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  >
                    Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <RLHFFooter />
    </div>
  );
};

function ArticleCard({
  article,
  featured,
  onClick,
}: {
  article: BlogArticle;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <article
      onClick={onClick}
      className={cn(
        "group cursor-pointer border border-border rounded-xl p-5 sm:p-6 transition-all duration-150",
        "hover:border-primary/30 hover:-translate-y-0.5",
        featured && "sm:col-span-2"
      )}
    >
      {/* Tags + read time */}
      <div className="flex items-center gap-3 mb-3">
        {article.tags?.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {tag}
          </span>
        ))}
        {article.estimated_read_minutes && (
          <span className="text-[11px] text-muted-foreground">
            {article.estimated_read_minutes} min de lecture
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        className={cn(
          "font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2",
          featured ? "text-lg sm:text-xl md:text-2xl" : "text-base sm:text-lg"
        )}
      >
        {article.title}
      </h3>

      {/* Excerpt */}
      {article.excerpt && (
        <p className={cn(
          "text-muted-foreground mt-2 line-clamp-3",
          featured ? "text-sm sm:text-base" : "text-sm"
        )}>
          {article.excerpt}
        </p>
      )}

      {/* Date */}
      {article.published_at && (
        <p className="text-[13px] text-muted-foreground mt-4">
          {format(new Date(article.published_at), "d MMMM yyyy", { locale: fr })}
        </p>
      )}
    </article>
  );
}

export default Blog;
