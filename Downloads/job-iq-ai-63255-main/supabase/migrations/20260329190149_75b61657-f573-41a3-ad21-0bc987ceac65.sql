
-- Blog articles table
CREATE TABLE public.blog_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content_markdown TEXT NOT NULL,
  meta_description TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  source TEXT DEFAULT 'manual',
  estimated_read_minutes INT DEFAULT 5,
  views INT DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_blog_slug ON public.blog_articles(slug);
CREATE INDEX idx_blog_status ON public.blog_articles(status, published_at DESC);
CREATE INDEX idx_blog_tags ON public.blog_articles USING gin(tags);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_blog_article_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'auto_generated', 'archived') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.source NOT IN ('manual', 'auto') THEN
    RAISE EXCEPTION 'Invalid source: %', NEW.source;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_blog_article
  BEFORE INSERT OR UPDATE ON public.blog_articles
  FOR EACH ROW EXECUTE FUNCTION public.validate_blog_article_status();

-- Auto update updated_at
CREATE TRIGGER trg_blog_articles_updated_at
  BEFORE UPDATE ON public.blog_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Article topics for auto-poster
CREATE TABLE public.article_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  theme TEXT NOT NULL,
  topic TEXT NOT NULL,
  used BOOLEAN DEFAULT false,
  article_id UUID REFERENCES public.blog_articles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_topics_unused ON public.article_topics(used) WHERE used = false;

-- RLS
ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_topics ENABLE ROW LEVEL SECURITY;

-- Public can read published articles
CREATE POLICY blog_public_read ON public.blog_articles
  FOR SELECT USING (status = 'published');

-- Admin can do everything on articles
CREATE POLICY blog_admin_all ON public.blog_articles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Admin can do everything on topics
CREATE POLICY topics_admin_all ON public.article_topics
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Service role bypass for edge functions (topics read)
CREATE POLICY topics_service_read ON public.article_topics
  FOR SELECT USING (true);
