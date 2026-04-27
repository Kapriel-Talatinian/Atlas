CREATE TABLE public.pricing_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  domain TEXT NOT NULL,
  volume INTEGER NOT NULL,
  sla TEXT NOT NULL,
  mode TEXT NOT NULL,
  estimated_price_low NUMERIC(10,2) NOT NULL,
  estimated_price_high NUMERIC(10,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'landing_calculator',
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all pricing leads"
ON public.pricing_leads
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pricing leads"
ON public.pricing_leads
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can submit pricing leads"
ON public.pricing_leads
FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_pricing_leads_created_at ON public.pricing_leads(created_at DESC);
CREATE INDEX idx_pricing_leads_email ON public.pricing_leads(email);