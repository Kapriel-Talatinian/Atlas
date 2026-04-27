
-- ============================================================================
-- P0-1: CERTIFICATION ASSESSMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certification_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('medical', 'legal', 'finance', 'code')),
  
  -- Phase 1: QCM
  phase1_questions JSONB,
  phase1_answers JSONB,
  phase1_score FLOAT,
  phase1_passed BOOLEAN,
  phase1_started_at TIMESTAMPTZ,
  phase1_completed_at TIMESTAMPTZ,
  
  -- Phase 2: Evaluation
  phase2_task JSONB,
  phase2_expert_scores JSONB,
  phase2_gold_scores JSONB,
  phase2_error_detection JSONB,
  phase2_mean_deviation FLOAT,
  phase2_passed BOOLEAN,
  phase2_started_at TIMESTAMPTZ,
  phase2_completed_at TIMESTAMPTZ,
  
  -- Phase 3: Real annotation
  phase3_task_ids UUID[],
  phase3_alpha FLOAT,
  phase3_passed BOOLEAN,
  phase3_started_at TIMESTAMPTZ,
  phase3_completed_at TIMESTAMPTZ,
  
  -- Global
  current_phase INT DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'passed', 'failed', 'expired')),
  overall_passed BOOLEAN,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  next_attempt_allowed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cert_assess_expert ON public.certification_assessments(expert_id, domain);
CREATE INDEX idx_cert_assess_user ON public.certification_assessments(user_id, domain);

ALTER TABLE public.certification_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessments" ON public.certification_assessments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own assessments" ON public.certification_assessments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own assessments" ON public.certification_assessments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- P0-2: TASK ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  expert_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  timeout_at TIMESTAMPTZ DEFAULT now() + interval '2 hours',
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'completed', 'expired', 'skipped')),
  UNIQUE(task_id, expert_id)
);

CREATE INDEX idx_assignments_expert ON public.task_assignments(expert_id, status);
CREATE INDEX idx_assignments_task ON public.task_assignments(task_id, status);
CREATE INDEX idx_assignments_timeout ON public.task_assignments(timeout_at) WHERE status = 'assigned';

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Experts see own assignments" ON public.task_assignments
  FOR SELECT TO authenticated
  USING (
    expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System can manage assignments" ON public.task_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- P0-3: STRIPE CONNECT & EXPERT PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expert_stripe_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL UNIQUE,
  stripe_account_id TEXT NOT NULL,
  onboarding_complete BOOLEAN DEFAULT false,
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  country TEXT,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expert_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL UNIQUE,
  available_balance FLOAT DEFAULT 0,
  pending_balance FLOAT DEFAULT 0,
  total_earned FLOAT DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expert_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task_credit', 'withdrawal', 'adjustment', 'reversal')),
  amount FLOAT NOT NULL,
  task_id UUID,
  description TEXT,
  stripe_transfer_id TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount FLOAT NOT NULL,
  currency TEXT DEFAULT 'USD',
  stripe_transfer_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.task_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('medical', 'legal', 'finance', 'code')),
  task_type TEXT NOT NULL CHECK (task_type IN ('scoring', 'preference_dpo', 'fact_checking', 'red_teaming')),
  expert_payout_amount FLOAT NOT NULL,
  client_price_amount FLOAT NOT NULL,
  currency TEXT DEFAULT 'USD',
  active BOOLEAN DEFAULT true,
  UNIQUE(domain, task_type)
);

-- Indexes
CREATE INDEX idx_expert_stripe ON public.expert_stripe_accounts(expert_id);
CREATE INDEX idx_expert_balance ON public.expert_balances(expert_id);
CREATE INDEX idx_expert_transactions ON public.expert_transactions(expert_id, created_at DESC);
CREATE INDEX idx_withdrawals ON public.withdrawal_requests(expert_id, status);

-- RLS for Stripe accounts
ALTER TABLE public.expert_stripe_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own stripe account" ON public.expert_stripe_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System manages stripe accounts" ON public.expert_stripe_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS for balances
ALTER TABLE public.expert_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own balance" ON public.expert_balances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- RLS for transactions
ALTER TABLE public.expert_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own transactions" ON public.expert_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- RLS for withdrawals
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS for task pricing (public read)
ALTER TABLE public.task_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pricing" ON public.task_pricing
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages pricing" ON public.task_pricing
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Atomic withdrawal function
CREATE OR REPLACE FUNCTION public.process_withdrawal_atomic(
  p_expert_id UUID,
  p_amount FLOAT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.expert_balances
  SET 
    available_balance = available_balance - p_amount,
    updated_at = now()
  WHERE expert_id = p_expert_id
    AND available_balance >= p_amount;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;
