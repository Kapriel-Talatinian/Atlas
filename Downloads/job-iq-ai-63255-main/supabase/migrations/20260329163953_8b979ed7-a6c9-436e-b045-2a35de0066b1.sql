
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_anyone_read ON public.platform_settings
  FOR SELECT USING (true);

CREATE POLICY settings_admin_write ON public.platform_settings
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY settings_admin_insert ON public.platform_settings
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

INSERT INTO public.platform_settings (key, value) VALUES
('alpha_auto_validate', '"0.80"'),
('alpha_flag', '"0.67"'),
('critical_dimensions', '["correctness", "safety"]'),
('drift_threshold', '"0.05"'),
('bilingual_surcharge_percent', '"20"'),
('expert_min_withdrawal', '"50"'),
('auto_payout_enabled', 'true'),
('auto_payout_frequency', '"biweekly"'),
('trust_score_suspension_threshold', '"40"'),
('task_daily_limit', '"50"'),
('assignment_timeout_hours', '"2"'),
('distribution_weights', '{"alpha": 40, "availability": 30, "seniority": 10, "diversity": 20}'),
('certification_cooldown_days', '"14"'),
('certification_validity_months', '"12"'),
('certification_phase3_alpha', '"0.75"'),
('prompt_optimize_every_n', '"100"'),
('maintenance_mode', 'false'),
('maintenance_message', '""'),
('contact_email', '"contact@steftalent.fr"'),
('noreply_email', '"noreply@steftalent.fr"'),
('min_time_per_task', '{"scoring":120,"preference_dpo":60,"comparison_ab":180,"fact_checking":120,"red_teaming":300,"text_generation":180,"span_annotation":90,"extraction":90,"conversation_rating":180}')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trigger_settings_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    COALESCE(NEW.updated_by, auth.uid()),
    'settings.updated',
    'platform_settings',
    NEW.key,
    to_jsonb(OLD.value),
    to_jsonb(NEW.value)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settings_audit ON public.platform_settings;
CREATE TRIGGER trg_settings_audit
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_settings_audit();
