import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RLHFNavbar } from "@/components/RLHFNavbar";
import { RLHFFooter } from "@/components/RLHFFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SEO } from "@/components/SEO";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const BlogPost = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Related articles
  const { data: related } = useQuery({
    queryKey: ["blog-related", slug, post?.tags],
    queryFn: async () => {
      if (!post?.tags?.length) return [];
      const { data } = await supabase
        .from("blog_articles")
        .select("id, title, slug, tags, published_at, estimated_read_minutes")
        .eq("status", "published")
        .neq("slug", slug)
        .overlaps("tags", post.tags)
        .order("published_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!post?.tags?.length,
  });

  // Increment views (fire and forget)
  useQuery({
    queryKey: ["blog-view-inc", post?.id],
    queryFn: async () => {
      if (!post?.id) return null;
      try {
        await supabase.rpc("increment_blog_views" as any, { p_article_id: post.id });
      } catch {}
      return true;
    },
    enabled: !!post?.id,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <RLHFNavbar />
        <div className="pt-28 pb-16 px-4 sm:px-8 max-w-[720px] mx-auto">
          <Skeleton className="h-6 w-24 mb-8" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-5 w-48 mb-12" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <RLHFNavbar />
        <div className="pt-32 pb-16 px-4 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Article non trouvé</h1>
          <Button onClick={() => navigate("/blog")} className="h-12 sm:h-10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au journal
          </Button>
        </div>
        <RLHFFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title={`${post.title} — STEF`}
        description={post.meta_description || post.excerpt || post.title}
        path={`/blog/${slug}`}
        type="article"
        article={{ publishedTime: post.published_at || undefined, author: "STEF" }}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.meta_description || post.excerpt || post.title,
          author: { "@type": "Organization", name: "STEF" },
          datePublished: post.published_at,
          publisher: { "@type": "Organization", name: "STEF" },
          url: `https://steftalent.fr/blog/${slug}`,
        }}
      />
      <RLHFNavbar />

      <article className="pt-28 pb-16 px-4 sm:px-8 lg:px-4">
        <div className="max-w-[720px] mx-auto">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/blog")}
            className="mb-8 -ml-2 text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Journal
          </Button>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {post.tags?.map((tag: string) => (
              <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-12">
            {post.published_at && (
              <span>{format(new Date(post.published_at), "d MMMM yyyy", { locale: fr })}</span>
            )}
            {post.estimated_read_minutes && (
              <>
                <span>·</span>
                <span>{post.estimated_read_minutes} min de lecture</span>
              </>
            )}
          </div>

          {/* Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none
            prose-headings:text-foreground prose-headings:font-bold
            prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6
            prose-h3:text-lg sm:prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:font-semibold
            prose-p:text-foreground/80 prose-p:leading-[1.7]
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
            prose-pre:bg-[#0D0D0F] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:font-mono prose-pre:text-[13px] prose-pre:overflow-x-auto
            prose-blockquote:border-l-3 prose-blockquote:border-primary prose-blockquote:pl-5 prose-blockquote:italic prose-blockquote:text-muted-foreground
            prose-strong:text-foreground prose-strong:font-semibold
            prose-ul:list-disc prose-ol:list-decimal
            prose-img:rounded-lg prose-img:border prose-img:border-border prose-img:w-full prose-img:h-auto
            prose-table:border prose-table:border-border prose-th:bg-muted/50 prose-th:font-semibold prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
            >
              {post.content_markdown}
            </ReactMarkdown>
          </div>

          {/* Divider */}
          <hr className="border-border my-16" />

          {/* Related articles */}
          {related && related.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-6">Articles liés</h2>
              <div className="space-y-4">
                {related.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/blog/${r.slug}`)}
                    className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/30 transition-all duration-150 group min-h-[44px]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {r.tags?.slice(0, 1).map((t: string) => (
                        <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>
                      ))}
                      {r.estimated_read_minutes && (
                        <span className="text-[10px] text-muted-foreground">{r.estimated_read_minutes} min</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {r.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      <RLHFFooter />
    </div>
  );
};

export default BlogPost;
