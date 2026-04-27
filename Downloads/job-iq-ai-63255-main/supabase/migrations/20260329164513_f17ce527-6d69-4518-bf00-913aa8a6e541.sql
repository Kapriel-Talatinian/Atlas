
CREATE TABLE IF NOT EXISTS public.project_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'intermediate', 'final')),
  percentage FLOAT NOT NULL,
  amount FLOAT NOT NULL,
  currency TEXT DEFAULT 'USD',
  trigger_condition TEXT CHECK (trigger_condition IN ('on_confirmation', 'at_50_percent', 'on_delivery')),
  triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'triggered', 'paid', 'overdue', 'cancelled')),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  overdue_since TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT false,
  project_paused BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_project ON public.project_payments(project_id);
CREATE INDEX idx_payments_client ON public.project_payments(client_id, status);
CREATE INDEX idx_payments_overdue ON public.project_payments(status) WHERE status = 'overdue';
CREATE INDEX idx_payments_triggered ON public.project_payments(triggered) WHERE triggered = false;

ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own payments"
  ON public.project_payments FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all payments"
  ON public.project_payments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.create_project_payments(
  p_project_id UUID,
  p_client_id UUID,
  p_total_amount FLOAT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_total_amount >= 5000 THEN
    INSERT INTO public.project_payments (project_id, client_id, payment_type, percentage, amount, trigger_condition, status) VALUES
    (p_project_id, p_client_id, 'deposit', 40, ROUND((p_total_amount * 0.40)::numeric, 2), 'on_confirmation', 'triggered'),
    (p_project_id, p_client_id, 'intermediate', 30, ROUND((p_total_amount * 0.30)::numeric, 2), 'at_50_percent', 'pending'),
    (p_project_id, p_client_id, 'final', 30, ROUND((p_total_amount * 0.30)::numeric, 2), 'on_delivery', 'pending');
  ELSE
    INSERT INTO public.project_payments (project_id, client_id, payment_type, percentage, amount, trigger_condition, status) VALUES
    (p_project_id, p_client_id, 'deposit', 50, ROUND((p_total_amount * 0.50)::numeric, 2), 'on_confirmation', 'triggered'),
    (p_project_id, p_client_id, 'final', 50, ROUND((p_total_amount * 0.50)::numeric, 2), 'on_delivery', 'pending');
  END IF;
END;
$$;
