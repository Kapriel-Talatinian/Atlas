
-- ============================================================================
-- P1-1: PRICING ENGINE — Enhanced pricing tables
-- ============================================================================

-- Drop and recreate task_pricing with language support
DROP TABLE IF EXISTS public.task_pricing CASCADE;

CREATE TABLE public.task_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('medical', 'legal', 'finance', 'code')),
  task_type TEXT NOT NULL CHECK (task_type IN ('scoring', 'preference_dpo', 'fact_checking', 'red_teaming')),
  language TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'en', 'fr_en')),
  client_unit_price FLOAT NOT NULL,
  expert_payout FLOAT NOT NULL,
  currency TEXT DEFAULT 'USD',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domain, task_type, language)
);

ALTER TABLE public.task_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pricing" ON public.task_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages pricing" ON public.task_pricing FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Volume discounts
CREATE TABLE IF NOT EXISTS public.volume_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  min_tasks INT NOT NULL,
  max_tasks INT,
  discount_percent FLOAT NOT NULL,
  active BOOLEAN DEFAULT true,
  CONSTRAINT valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 50)
);

ALTER TABLE public.volume_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads discounts" ON public.volume_discounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages discounts" ON public.volume_discounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Client plans
CREATE TABLE IF NOT EXISTS public.client_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name TEXT NOT NULL UNIQUE CHECK (plan_name IN ('pay_per_task', 'monthly', 'enterprise')),
  description TEXT,
  monthly_fee FLOAT DEFAULT 0,
  included_tasks INT DEFAULT 0,
  overage_discount_percent FLOAT DEFAULT 0,
  active BOOLEAN DEFAULT true
);

ALTER TABLE public.client_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads plans" ON public.client_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages plans" ON public.client_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- P1-1: Estimate project cost function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.estimate_project_cost(
  p_domain TEXT,
  p_task_type TEXT,
  p_language TEXT,
  p_num_tasks INT,
  p_client_plan TEXT DEFAULT 'pay_per_task'
)
RETURNS TABLE (
  unit_price FLOAT,
  volume_discount_percent FLOAT,
  plan_discount_percent FLOAT,
  discounted_unit_price FLOAT,
  total_before_tax FLOAT,
  expert_cost_total FLOAT,
  stef_margin_total FLOAT,
  stef_margin_percent FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_price FLOAT;
  v_expert_payout FLOAT;
  v_vol_discount FLOAT := 0;
  v_plan_discount FLOAT := 0;
  v_final_unit FLOAT;
BEGIN
  SELECT tp.client_unit_price, tp.expert_payout
  INTO v_client_price, v_expert_payout
  FROM public.task_pricing tp
  WHERE tp.domain = p_domain AND tp.task_type = p_task_type AND tp.language = p_language AND tp.active = true;

  IF v_client_price IS NULL THEN
    RAISE EXCEPTION 'Pricing not found for %/%/%', p_domain, p_task_type, p_language;
  END IF;

  SELECT vd.discount_percent INTO v_vol_discount
  FROM public.volume_discounts vd
  WHERE vd.active = true AND p_num_tasks >= vd.min_tasks AND (vd.max_tasks IS NULL OR p_num_tasks <= vd.max_tasks);
  v_vol_discount := COALESCE(v_vol_discount, 0);

  SELECT cp.overage_discount_percent INTO v_plan_discount
  FROM public.client_plans cp WHERE cp.plan_name = p_client_plan AND cp.active = true;
  v_plan_discount := COALESCE(v_plan_discount, 0);

  v_final_unit := v_client_price * (1 - v_vol_discount / 100) * (1 - v_plan_discount / 100);

  unit_price := v_client_price;
  volume_discount_percent := v_vol_discount;
  plan_discount_percent := v_plan_discount;
  discounted_unit_price := ROUND(v_final_unit::numeric, 2);
  total_before_tax := ROUND((v_final_unit * p_num_tasks)::numeric, 2);
  expert_cost_total := ROUND((v_expert_payout * p_num_tasks)::numeric, 2);
  stef_margin_total := ROUND(((v_final_unit - v_expert_payout) * p_num_tasks)::numeric, 2);
  stef_margin_percent := ROUND((((v_final_unit - v_expert_payout) / NULLIF(v_final_unit, 0)) * 100)::numeric, 1);
  RETURN NEXT;
END;
$$;

-- Estimate delivery days
CREATE OR REPLACE FUNCTION public.estimate_delivery_days(
  p_domain TEXT,
  p_num_tasks INT,
  p_annotators_per_task INT DEFAULT 2
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active_experts INT;
  v_tasks_per_expert_per_day INT := 20;
  v_total_needed INT;
  v_daily_capacity INT;
  v_days INT;
BEGIN
  SELECT count(*) INTO v_active_experts
  FROM public.annotator_domain_certifications
  WHERE status = 'active';
  v_active_experts := GREATEST(v_active_experts, 1);
  v_total_needed := p_num_tasks * p_annotators_per_task;
  v_daily_capacity := v_active_experts * v_tasks_per_expert_per_day;
  v_days := CEIL(v_total_needed::float / v_daily_capacity) + 2;
  RETURN GREATEST(3, LEAST(v_days, 90));
END;
$$;

-- ============================================================================
-- P1-2: ANTI-FRAUD — Trust score & fraud events
-- ============================================================================

-- Add trust columns to annotator_profiles
ALTER TABLE public.annotator_profiles ADD COLUMN IF NOT EXISTS trust_score FLOAT DEFAULT 70;
ALTER TABLE public.annotator_profiles ADD COLUMN IF NOT EXISTS trust_score_updated_at TIMESTAMPTZ DEFAULT now();

-- Fraud events
CREATE TABLE IF NOT EXISTS public.fraud_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'speed_violation', 'low_alpha', 'monotone_scoring',
    'duplicate_reasoning', 'preference_bias', 'manual_flag'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB,
  action_taken TEXT CHECK (action_taken IN ('none', 'warning', 'suspension_7d', 'suspension_30d', 'ban', 'dismissed')),
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fraud_events_expert ON public.fraud_events(expert_id, created_at DESC);

ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages fraud events" ON public.fraud_events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- P1-3: CLIENT UPLOAD VALIDATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  client_id UUID,
  user_id UUID,
  file_name TEXT NOT NULL,
  file_format TEXT CHECK (file_format IN ('csv', 'json', 'jsonl')),
  file_size_bytes BIGINT,
  storage_path TEXT,
  total_rows INT,
  valid_rows INT,
  invalid_rows INT,
  duplicate_rows INT,
  pii_detected_rows INT,
  validation_errors JSONB,
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validating', 'valid', 'invalid', 'confirmed')),
  avg_prompt_length INT,
  avg_response_length INT,
  estimated_cost FLOAT,
  estimated_delivery_days INT,
  preview_items JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  validated_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_uploads_project ON public.client_uploads(project_id);

ALTER TABLE public.client_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own uploads" ON public.client_uploads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own uploads" ON public.client_uploads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own uploads" ON public.client_uploads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
