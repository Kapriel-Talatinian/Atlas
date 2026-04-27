-- 1. Create test_consents table for logging consent with timestamp
CREATE TABLE public.test_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expert_id UUID REFERENCES public.expert_profiles(id),
  consent_version TEXT NOT NULL DEFAULT 'v1.0',
  consent_type TEXT NOT NULL DEFAULT 'test_data_usage',
  ip_address TEXT,
  user_agent TEXT,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create test_generation_logs table for rate limiting
CREATE TABLE public.test_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id),
  test_id UUID REFERENCES public.technical_tests(id),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.test_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_generation_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for test_consents
CREATE POLICY "Users can insert their own consent" 
ON public.test_consents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own consent" 
ON public.test_consents 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all consents" 
ON public.test_consents 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. RLS policies for test_generation_logs
CREATE POLICY "System can insert generation logs" 
ON public.test_generation_logs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view generation logs" 
ON public.test_generation_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Experts can view their own logs" 
ON public.test_generation_logs 
FOR SELECT 
USING (expert_id IN (
  SELECT id FROM expert_profiles WHERE user_id = auth.uid()
));

-- 6. Index for rate limiting queries
CREATE INDEX idx_test_generation_logs_expert_created 
ON public.test_generation_logs(expert_id, created_at DESC);