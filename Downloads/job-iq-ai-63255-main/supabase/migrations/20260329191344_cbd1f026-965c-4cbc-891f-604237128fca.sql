
-- Refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES public.project_payments(id),
  client_id UUID,
  amount FLOAT NOT NULL,
  reason TEXT NOT NULL,
  stripe_refund_id TEXT,
  status TEXT DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_client ON public.refunds(client_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds(payment_id);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_refunds" ON public.refunds FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Impersonation sessions
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID,
  target_user_id UUID,
  target_type TEXT,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON public.impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_token ON public.impersonation_sessions(token);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_impersonation" ON public.impersonation_sessions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Monthly reports
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month DATE NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_monthly_reports" ON public.monthly_reports FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add status/disabled columns to clients if not present
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='disabled_reason') THEN
    ALTER TABLE public.clients ADD COLUMN disabled_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='disabled_at') THEN
    ALTER TABLE public.clients ADD COLUMN disabled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add validation trigger for refunds status
CREATE OR REPLACE FUNCTION public.validate_refund_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid refund status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_refund_status_trigger ON public.refunds;
CREATE TRIGGER validate_refund_status_trigger BEFORE INSERT OR UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.validate_refund_status();
