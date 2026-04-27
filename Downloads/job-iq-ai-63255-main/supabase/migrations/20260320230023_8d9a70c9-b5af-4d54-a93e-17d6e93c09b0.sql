
CREATE TABLE public.enterprise_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  stacks TEXT[] NOT NULL DEFAULT '{}',
  positions_count TEXT NOT NULL DEFAULT '1-2',
  min_level TEXT NOT NULL DEFAULT 'mid',
  interests TEXT[] DEFAULT '{}',
  message TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new',
  contacted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public form)
CREATE POLICY "Anyone can submit enterprise lead form"
  ON public.enterprise_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read leads
CREATE POLICY "Admins can read enterprise leads"
  ON public.enterprise_leads
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Only admins can update leads
CREATE POLICY "Admins can update enterprise leads"
  ON public.enterprise_leads
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );
