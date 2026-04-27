
-- P2 Migration: Client API, Email Queue, SLA System

-- P2-1: CLIENT API
ALTER TABLE clients ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS api_key_prefix TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS api_rate_limit INT DEFAULT 100;

CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT NOT NULL,
  latency_ms INT,
  ip_address TEXT,
  user_agent TEXT,
  request_body_size INT,
  response_body_size INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_client ON api_request_logs(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_rate ON api_request_logs(client_id, created_at);

CREATE TABLE IF NOT EXISTS client_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret_hash TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INT,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID REFERENCES client_webhooks(id),
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INT,
  response_body TEXT,
  latency_ms INT,
  success BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_client ON client_webhooks(client_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries ON webhook_deliveries(webhook_id, created_at DESC);

-- P2-2: EMAIL QUEUE
CREATE TABLE IF NOT EXISTS rlhf_email_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rlhf_email_queue_status ON rlhf_email_queue(status);

-- P2-3: SLA SYSTEM
CREATE TABLE IF NOT EXISTS sla_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_name TEXT NOT NULL UNIQUE CHECK (tier_name IN ('standard', 'priority', 'express')),
  description TEXT,
  max_delivery_multiplier FLOAT NOT NULL,
  guaranteed_min_alpha FLOAT NOT NULL,
  min_annotators_per_task INT NOT NULL,
  price_multiplier FLOAT NOT NULL,
  active BOOLEAN DEFAULT true
);

INSERT INTO sla_tiers (tier_name, description, max_delivery_multiplier, guaranteed_min_alpha, min_annotators_per_task, price_multiplier) VALUES
('standard', 'Délai normal, qualité garantie α ≥ 0.75', 1.0, 0.75, 2, 1.0),
('priority', 'Livraison accélérée, qualité supérieure α ≥ 0.80', 0.7, 0.80, 2, 1.3),
('express', 'Livraison rapide, qualité maximale α ≥ 0.85, 3 annotateurs', 0.4, 0.85, 3, 1.8)
ON CONFLICT (tier_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS sla_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES annotation_projects(id) UNIQUE,
  sla_tier TEXT NOT NULL,
  committed_delivery_date DATE NOT NULL,
  actual_completion_date DATE,
  delivery_on_time BOOLEAN,
  committed_min_alpha FLOAT NOT NULL,
  current_alpha FLOAT,
  alpha_on_target BOOLEAN,
  at_risk BOOLEAN DEFAULT false,
  at_risk_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sla_tracking_project ON sla_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_risk ON sla_tracking(at_risk);

ALTER TABLE annotation_projects ADD COLUMN IF NOT EXISTS sla_tier TEXT DEFAULT 'standard';

-- SLA estimation function
CREATE OR REPLACE FUNCTION estimate_delivery_v2(
  p_domain TEXT, p_task_type TEXT, p_num_tasks INT, p_sla_tier TEXT DEFAULT 'standard'
)
RETURNS TABLE (
  estimated_days INT, estimated_completion_date DATE, guaranteed_min_alpha FLOAT,
  annotators_per_task INT, price_multiplier FLOAT, capacity_warning BOOLEAN, capacity_message TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_active_experts INT; v_tpd INT; v_total INT; v_cap INT; v_base INT;
  v_sla RECORD; v_final INT; v_warn BOOLEAN := false; v_msg TEXT := '';
BEGIN
  SELECT * INTO v_sla FROM public.sla_tiers WHERE tier_name = p_sla_tier AND active = true;
  IF v_sla IS NULL THEN RAISE EXCEPTION 'SLA tier not found: %', p_sla_tier; END IF;

  SELECT count(*) INTO v_active_experts FROM public.annotator_domain_certifications WHERE status = 'active';
  v_active_experts := GREATEST(v_active_experts, 1);

  v_tpd := CASE p_task_type WHEN 'scoring' THEN 25 WHEN 'preference_dpo' THEN 30 WHEN 'fact_checking' THEN 20 WHEN 'red_teaming' THEN 8 ELSE 20 END;
  v_total := p_num_tasks * v_sla.min_annotators_per_task;
  v_cap := v_active_experts * v_tpd;
  v_base := CEIL(v_total::float / v_cap) + 2;
  v_final := GREATEST(CEIL(v_base * v_sla.max_delivery_multiplier), 3);

  IF v_active_experts < 5 THEN v_warn := true; v_msg := 'Experts limités (' || v_active_experts || ').'; END IF;
  IF p_sla_tier = 'express' AND v_active_experts < 10 THEN v_warn := true; v_msg := 'Capacité insuffisante pour Express.'; END IF;

  estimated_days := v_final; estimated_completion_date := CURRENT_DATE + v_final;
  guaranteed_min_alpha := v_sla.guaranteed_min_alpha; annotators_per_task := v_sla.min_annotators_per_task;
  price_multiplier := v_sla.price_multiplier; capacity_warning := v_warn; capacity_message := v_msg;
  RETURN NEXT;
END;
$$;

-- SLA compliance check
CREATE OR REPLACE FUNCTION check_sla_compliance()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  r RECORD; v_progress FLOAT; v_days_remaining INT; v_expected FLOAT; v_completed INT; v_total INT;
BEGIN
  FOR r IN SELECT st.*, ap.total_items, ap.status as ps FROM public.sla_tracking st JOIN public.annotation_projects ap ON ap.id = st.project_id WHERE ap.status IN ('active', 'in_progress')
  LOOP
    SELECT count(*) INTO v_completed FROM public.annotation_items WHERE project_id = r.project_id AND status = 'completed';
    v_total := GREATEST(r.total_items, 1);
    v_progress := v_completed::float / v_total;
    v_days_remaining := r.committed_delivery_date - CURRENT_DATE;
    v_expected := GREATEST(LEAST(1.0 - (v_days_remaining::float / NULLIF((r.committed_delivery_date - r.created_at::date), 0)), 1.0), 0);

    IF v_progress < (v_expected * 0.80) AND v_days_remaining > 0 THEN
      UPDATE public.sla_tracking SET at_risk = true, at_risk_reason = 'Retard: ' || ROUND((v_progress*100)::numeric,1) || '% vs ' || ROUND((v_expected*100)::numeric,1) || '%', updated_at = now() WHERE id = r.id;
    END IF;
    IF r.current_alpha IS NOT NULL AND r.current_alpha < r.committed_min_alpha THEN
      UPDATE public.sla_tracking SET at_risk = true, alpha_on_target = false, updated_at = now() WHERE id = r.id;
    END IF;
    IF v_completed >= v_total THEN
      UPDATE public.sla_tracking SET actual_completion_date = CURRENT_DATE, delivery_on_time = (CURRENT_DATE <= r.committed_delivery_date), alpha_on_target = (COALESCE(r.current_alpha,0) >= r.committed_min_alpha), updated_at = now() WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- RLS
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rlhf_email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_tiers_public_read" ON sla_tiers FOR SELECT USING (true);
CREATE POLICY "api_logs_admin" ON api_request_logs FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "webhooks_admin" ON client_webhooks FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "webhooks_client" ON client_webhooks FOR ALL USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
CREATE POLICY "webhook_del_admin" ON webhook_deliveries FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "email_queue_admin" ON rlhf_email_queue FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "sla_tracking_admin" ON sla_tracking FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "sla_tracking_client" ON sla_tracking FOR SELECT USING (project_id IN (SELECT id FROM annotation_projects WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())));
