
-- Function to increment blog article views
CREATE OR REPLACE FUNCTION public.increment_blog_views(p_article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.blog_articles SET views = views + 1 WHERE id = p_article_id;
END;
$$;
