
-- 1. Add llm_mode column to annotation_projects
ALTER TABLE public.annotation_projects
ADD COLUMN IF NOT EXISTS llm_mode TEXT DEFAULT 'standard';

-- Add validation trigger (not CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_llm_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.llm_mode NOT IN ('standard', 'sovereign') THEN
    RAISE EXCEPTION 'Invalid llm_mode: %. Must be standard or sovereign.', NEW.llm_mode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_llm_mode
  BEFORE INSERT OR UPDATE OF llm_mode ON public.annotation_projects
  FOR EACH ROW
  EXECUTE FUNCTION validate_llm_mode();

-- 2. Create llm_model_config table
CREATE TABLE IF NOT EXISTS public.llm_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL,
  tier INT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  cost_per_1k_input FLOAT NOT NULL,
  cost_per_1k_output FLOAT NOT NULL,
  max_tokens INT DEFAULT 4096,
  temperature FLOAT DEFAULT 0.3,
  timeout_ms INT DEFAULT 30000,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mode, tier)
);

ALTER TABLE public.llm_model_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage llm_model_config" ON public.llm_model_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read llm_model_config" ON public.llm_model_config
  FOR SELECT TO authenticated
  USING (true);

-- Insert standard models (Lovable Gateway)
INSERT INTO public.llm_model_config (mode, tier, provider, model_id, display_name, cost_per_1k_input, cost_per_1k_output, max_tokens, timeout_ms) VALUES
('standard', 1, 'google',  'google/gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', 0.00010, 0.00040, 8192, 15000),
('standard', 2, 'google',  'google/gemini-2.5-flash',      'Gemini 2.5 Flash',      0.00025, 0.00100, 16384, 30000),
('standard', 3, 'google',  'google/gemini-2.5-pro',        'Gemini 2.5 Pro',        0.00125, 0.00500, 16384, 60000),
('standard', 4, 'openai',  'openai/gpt-5',                 'GPT-5',                 0.00500, 0.01500, 16384, 60000),
-- Sovereign models (Mistral direct)
('sovereign', 1, 'mistral', 'mistral-small-latest',  'Mistral Small',         0.00020, 0.00060, 8192, 15000),
('sovereign', 2, 'mistral', 'mistral-medium-latest', 'Mistral Medium',        0.00090, 0.00270, 16384, 30000),
('sovereign', 3, 'mistral', 'mistral-large-latest',  'Mistral Large',         0.00200, 0.00600, 16384, 60000),
('sovereign', 4, 'mistral', 'mistral-large-latest',  'Mistral Large (Code)',   0.00200, 0.00600, 16384, 60000)
ON CONFLICT (mode, tier) DO NOTHING;

-- 3. Add mode and tier columns to llm_call_logs
ALTER TABLE public.llm_call_logs ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'standard';
ALTER TABLE public.llm_call_logs ADD COLUMN IF NOT EXISTS tier INT;

-- 4. Add sovereign price multiplier to platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES ('sovereign_price_multiplier', '"1.20"')
ON CONFLICT (key) DO NOTHING;

-- 5. Add system annotator profiles for Mistral models
INSERT INTO public.annotator_profiles (
  id, anonymized_id, country, experience_years, languages, role, seniority,
  is_active, is_qualified, tier
) VALUES
  ('a0000000-0000-0000-0000-000000000005', 'sys_mistral_small', 'FR', 0, ARRAY['fr','en'], 'system', 'senior', true, true, 'expert'),
  ('a0000000-0000-0000-0000-000000000006', 'sys_mistral_medium', 'FR', 0, ARRAY['fr','en'], 'system', 'senior', true, true, 'expert'),
  ('a0000000-0000-0000-0000-000000000007', 'sys_mistral_large', 'FR', 0, ARRAY['fr','en'], 'system', 'lead', true, true, 'senior')
ON CONFLICT (id) DO NOTHING;
