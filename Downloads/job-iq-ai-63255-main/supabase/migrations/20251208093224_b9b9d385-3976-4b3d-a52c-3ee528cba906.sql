-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create blog_posts table for dynamic blog content
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT,
  cover_image_url TEXT,
  author_name TEXT NOT NULL,
  author_avatar_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create platform_stats table for animated counters
CREATE TABLE public.platform_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_key TEXT NOT NULL UNIQUE,
  stat_value INTEGER NOT NULL DEFAULT 0,
  stat_label TEXT NOT NULL,
  display_suffix TEXT DEFAULT '',
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_stats ENABLE ROW LEVEL SECURITY;

-- Blog posts policies
CREATE POLICY "Anyone can view published blog posts"
ON public.blog_posts FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage blog posts"
ON public.blog_posts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Platform stats policies
CREATE POLICY "Anyone can view platform stats"
ON public.platform_stats FOR SELECT USING (is_visible = true);

CREATE POLICY "Admins can manage platform stats"
ON public.platform_stats FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial platform stats
INSERT INTO public.platform_stats (stat_key, stat_value, stat_label, display_suffix, display_order) VALUES
('experts_placed', 150, 'Experts placés', '+', 1),
('companies', 45, 'Entreprises', '', 2),
('interviews_conducted', 500, 'Entretiens réalisés', '+', 3),
('satisfaction_rate', 98, 'Satisfaction', '%', 4);

-- Create triggers
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_stats_updated_at
BEFORE UPDATE ON public.platform_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();