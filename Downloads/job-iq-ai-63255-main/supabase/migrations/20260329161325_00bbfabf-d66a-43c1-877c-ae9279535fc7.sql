-- Add Phase 2B ethical judgment columns to certification_assessments
ALTER TABLE public.certification_assessments
  ADD COLUMN IF NOT EXISTS phase2b_scenario JSONB,
  ADD COLUMN IF NOT EXISTS phase2b_expert_verdict TEXT,
  ADD COLUMN IF NOT EXISTS phase2b_gold_verdict TEXT,
  ADD COLUMN IF NOT EXISTS phase2b_problems_identified JSONB,
  ADD COLUMN IF NOT EXISTS phase2b_justification TEXT,
  ADD COLUMN IF NOT EXISTS phase2b_correction TEXT,
  ADD COLUMN IF NOT EXISTS phase2b_passed BOOLEAN;

-- Create task_assignments table if not exists
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.annotation_tasks(id),
  expert_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  timeout_at TIMESTAMPTZ DEFAULT now() + interval '2 hours',
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'completed', 'expired', 'skipped')),
  UNIQUE(task_id, expert_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_expert ON public.task_assignments(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_task ON public.task_assignments(task_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_timeout ON public.task_assignments(timeout_at) WHERE status = 'assigned';

-- Add expert_stripe_accounts.user_id if missing
ALTER TABLE public.expert_stripe_accounts
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add expert_balances.user_id if missing
ALTER TABLE public.expert_balances
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add expert_transactions.user_id if missing
ALTER TABLE public.expert_transactions
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add withdrawal_requests.user_id if missing
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- RLS for task_assignments
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Experts can view own assignments" ON public.task_assignments
  FOR SELECT TO authenticated
  USING (expert_id IN (SELECT id FROM public.annotator_profiles WHERE expert_id = (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid())));

CREATE POLICY "Admins can manage all assignments" ON public.task_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));