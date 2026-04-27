
-- Add TVA fields to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tva_number TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS name TEXT;

-- Update name from company_name if null
UPDATE public.clients SET name = company_name WHERE name IS NULL;

-- Drop old invoices table (empty, legacy schema)
DROP TABLE IF EXISTS public.invoices CASCADE;

-- Drop old sequence if exists
DROP SEQUENCE IF EXISTS invoice_number_seq CASCADE;

-- Create invoice number sequence
CREATE SEQUENCE public.invoice_number_seq START WITH 1;

-- Create new invoices table
CREATE TABLE public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES public.annotation_projects(id),
  client_id UUID REFERENCES public.clients(id),
  payment_id UUID REFERENCES public.project_payments(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'intermediate', 'final')),
  percentage FLOAT NOT NULL,
  project_total_ht FLOAT NOT NULL,
  invoice_amount_ht FLOAT NOT NULL,
  tva_rate FLOAT NOT NULL DEFAULT 20.0,
  tva_amount FLOAT NOT NULL DEFAULT 0,
  invoice_amount_ttc FLOAT NOT NULL,
  currency TEXT DEFAULT 'USD',
  tva_regime TEXT NOT NULL DEFAULT 'hors_ue_exonere' CHECK (tva_regime IN ('fr_standard', 'eu_autoliquidation', 'hors_ue_exonere', 'franchise')),
  tva_mention TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  task_type TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'en',
  sla_tier TEXT NOT NULL DEFAULT 'standard',
  num_tasks INT NOT NULL DEFAULT 0,
  unit_price_ht FLOAT NOT NULL DEFAULT 0,
  volume_discount_percent FLOAT DEFAULT 0,
  sla_multiplier FLOAT DEFAULT 1.0,
  client_name TEXT NOT NULL DEFAULT '',
  client_address TEXT,
  client_siret TEXT,
  client_tva_number TEXT,
  previous_payments JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  issued_at TIMESTAMPTZ DEFAULT now(),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_storage_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_invoices_client ON public.invoices(client_id, status);
CREATE INDEX idx_invoices_project ON public.invoices(project_id);

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_client_read ON public.invoices
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY invoices_admin_all ON public.invoices
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Function to generate sequential invoice number
CREATE OR REPLACE FUNCTION public.generate_sequential_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_val INT;
BEGIN
  seq_val := nextval('invoice_number_seq');
  RETURN 'STEF-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$;

-- Function to determine TVA regime
CREATE OR REPLACE FUNCTION public.determine_tva_regime(
  p_client_country TEXT,
  p_client_tva_number TEXT
)
RETURNS TABLE(regime TEXT, rate FLOAT, mention TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF UPPER(COALESCE(p_client_country, '')) = 'FR' THEN
    RETURN QUERY SELECT
      'fr_standard'::TEXT,
      20.0::FLOAT,
      'TVA 20% — art. 278 du CGI'::TEXT;
  ELSIF UPPER(COALESCE(p_client_country, '')) IN ('DE','IT','ES','NL','BE','PT','AT','IE','FI','SE','DK','PL','CZ','RO','HU','BG','HR','SK','SI','LT','LV','EE','CY','MT','LU','GR')
    AND p_client_tva_number IS NOT NULL
    AND p_client_tva_number != '' THEN
    RETURN QUERY SELECT
      'eu_autoliquidation'::TEXT,
      0.0::FLOAT,
      'Autoliquidation — TVA due par le preneur, art. 196 directive 2006/112/CE'::TEXT;
  ELSE
    RETURN QUERY SELECT
      'hors_ue_exonere'::TEXT,
      0.0::FLOAT,
      'Exonération de TVA — art. 259-1 du CGI'::TEXT;
  END IF;
END;
$$;

-- Create invoices storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: clients can read their own invoices
CREATE POLICY invoices_storage_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'invoices'
    AND (
      (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Enable realtime for invoices
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
