
-- Funnel events table
CREATE TABLE public.funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  page_url TEXT,
  device_type TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_funnel_events_type ON public.funnel_events(event_type);
CREATE INDEX idx_funnel_events_created ON public.funnel_events(created_at);

-- User acquisition source table
CREATE TABLE public.user_acquisition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  gclid TEXT,
  fbclid TEXT,
  landing_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: funnel_events open for insert (anon + authenticated), select only for admins
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_acquisition ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert funnel events (tracking)
CREATE POLICY "Anyone can insert funnel events"
  ON public.funnel_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read funnel events
CREATE POLICY "Admins can read funnel events"
  ON public.funnel_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own acquisition data
CREATE POLICY "Users can insert own acquisition"
  ON public.user_acquisition FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own acquisition data
CREATE POLICY "Users can read own acquisition"
  ON public.user_acquisition FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all acquisition data
CREATE POLICY "Admins can read all acquisition"
  ON public.user_acquisition FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
