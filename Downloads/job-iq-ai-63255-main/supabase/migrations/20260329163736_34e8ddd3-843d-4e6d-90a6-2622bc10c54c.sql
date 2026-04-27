
-- Storage bucket for dataset exports
INSERT INTO storage.buckets (id, name, public) VALUES ('datasets', 'datasets', false) ON CONFLICT (id) DO NOTHING;

-- Client invoices table
CREATE TABLE IF NOT EXISTS public.client_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  project_id UUID,
  amount FLOAT NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  tasks_billed INT DEFAULT 0,
  stripe_invoice_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_invoices_client ON public.client_invoices(client_id, created_at DESC);

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_client_own" ON public.client_invoices FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY "invoices_admin" ON public.client_invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Expert transactions table
CREATE TABLE IF NOT EXISTS public.expert_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  amount FLOAT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task_credit', 'bonus', 'penalty', 'withdrawal', 'referral')),
  task_id UUID,
  description TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expert_transactions_expert ON public.expert_transactions(expert_id, created_at DESC);

ALTER TABLE public.expert_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_expert_own" ON public.expert_transactions FOR SELECT USING (expert_id = auth.uid());
CREATE POLICY "transactions_admin" ON public.expert_transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Platform stats function
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_experts', (SELECT count(*) FROM public.annotator_profiles),
    'certified_experts', (SELECT count(DISTINCT expert_id) FROM public.annotator_domain_certifications WHERE status = 'active'),
    'total_clients', (SELECT count(*) FROM public.clients),
    'total_projects', (SELECT count(*) FROM public.annotation_projects),
    'active_projects', (SELECT count(*) FROM public.annotation_projects WHERE status = 'active'),
    'total_tasks', (SELECT count(*) FROM public.annotation_tasks),
    'completed_tasks', (SELECT count(*) FROM public.annotation_tasks WHERE status = 'completed'),
    'total_annotations', (SELECT count(*) FROM public.expert_annotations),
    'total_revenue', (SELECT COALESCE(sum(amount), 0) FROM public.client_invoices WHERE status = 'paid'),
    'total_expert_payouts', (SELECT COALESCE(sum(amount), 0) FROM public.expert_transactions WHERE type = 'task_credit'),
    'total_llm_cost', (SELECT COALESCE(sum(cost_usd), 0) FROM public.llm_call_logs),
    'mean_alpha', (SELECT ROUND(avg(overall_alpha)::numeric, 4) FROM public.alpha_reports)
  ) INTO result;
  RETURN result;
END;
$$;
