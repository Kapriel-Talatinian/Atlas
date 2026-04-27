
-- Drop existing leads table and recreate with full CRM schema
DROP TABLE IF EXISTS public.leads;

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  contact_method TEXT NOT NULL DEFAULT 'email',
  source TEXT NOT NULL DEFAULT 'quiz',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  quiz_result_id UUID,
  specialty TEXT,
  quiz_score INTEGER,
  quiz_level TEXT,
  device_type TEXT,
  country TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  converted_to_user_id UUID,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_contacted_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_specialty ON public.leads(specialty);
CREATE INDEX idx_leads_score ON public.leads(quiz_score);
CREATE INDEX idx_leads_created ON public.leads(created_at);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE UNIQUE INDEX idx_leads_email_unique ON public.leads(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_leads_whatsapp_unique ON public.leads(whatsapp) WHERE whatsapp IS NOT NULL;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anon can insert leads" ON public.leads
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (true);
