-- RLHF Gold Standard Schema Migration

-- Create rlhf_feedback table (full gold standard schema)
CREATE TABLE public.rlhf_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- TASK CONTEXT (obligatoire)
  task_type TEXT NOT NULL DEFAULT 'ai_hiring_test_evaluation',
  job_role TEXT NOT NULL,
  job_level_targeted TEXT NOT NULL CHECK (job_level_targeted IN ('junior', 'mid', 'senior', 'lead', 'principal')),
  language TEXT NOT NULL DEFAULT 'fr',
  country_context TEXT NOT NULL,
  prompt_used TEXT,
  constraints JSONB, -- {duration_minutes, difficulty_expected, format_expected}
  
  -- AI OUTPUT
  model_type TEXT DEFAULT 'lovable_ai_v1',
  generated_output JSONB NOT NULL,
  generation_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  test_id UUID REFERENCES public.technical_tests(id),
  job_offer_id UUID REFERENCES public.job_offers(id),
  
  -- HUMAN FEEDBACK
  overall_rating TEXT NOT NULL CHECK (overall_rating IN ('up', 'down', 'neutral')),
  scores JSONB, -- {clarity: 1-5, relevance: 1-5, difficulty_alignment: 1-5, job_realism: 1-5, bias_risk: 1-5}
  issues_detected TEXT[], -- normalized list
  free_text_comment TEXT,
  preferred_action TEXT CHECK (preferred_action IN ('accept', 'regenerate', 'edit', NULL)),
  
  -- ANNOTATOR (anonymized reference)
  annotator_id TEXT NOT NULL,
  expert_id UUID REFERENCES public.expert_profiles(id),
  
  -- QUALITY CONTROL
  gold_task BOOLEAN DEFAULT false,
  is_duplicate_annotation BOOLEAN DEFAULT false,
  original_feedback_id UUID REFERENCES public.rlhf_feedback(id),
  agreement_score DECIMAL(3,2),
  qa_status TEXT DEFAULT 'pending' CHECK (qa_status IN ('pending', 'validated', 'rejected', 'needs_review')),
  
  -- LEGAL
  rights_assigned BOOLEAN NOT NULL DEFAULT true,
  pii_present BOOLEAN DEFAULT false,
  consent_version TEXT DEFAULT 'v1.0',
  
  -- METADATA
  platform_version TEXT DEFAULT 'web_v1',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create annotator_profiles table (one-time qualification)
CREATE TABLE public.annotator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID UNIQUE REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  anonymized_id TEXT UNIQUE NOT NULL,
  
  -- Qualification (asked once)
  role TEXT NOT NULL,
  seniority TEXT NOT NULL CHECK (seniority IN ('junior', 'mid', 'senior', 'lead', 'principal')),
  experience_years INTEGER NOT NULL,
  region TEXT,
  country TEXT NOT NULL,
  languages TEXT[] NOT NULL,
  
  -- Consent
  consent_given_at TIMESTAMPTZ DEFAULT now(),
  consent_version TEXT DEFAULT 'v1.0',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create rlhf_gold_tasks table for QA
CREATE TABLE public.rlhf_gold_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  job_role TEXT NOT NULL,
  job_level TEXT NOT NULL,
  ai_output JSONB NOT NULL,
  expected_rating TEXT NOT NULL CHECK (expected_rating IN ('up', 'down', 'neutral')),
  expected_issues TEXT[],
  min_agreement_threshold DECIMAL(3,2) DEFAULT 0.80,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create rlhf_pending_qa table for double annotation
CREATE TABLE public.rlhf_pending_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_feedback_id UUID REFERENCES public.rlhf_feedback(id) ON DELETE CASCADE,
  second_feedback_id UUID REFERENCES public.rlhf_feedback(id),
  requires_second_annotator BOOLEAN DEFAULT true,
  assigned_annotator_id TEXT,
  completed_at TIMESTAMPTZ,
  agreement_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.rlhf_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rlhf_gold_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rlhf_pending_qa ENABLE ROW LEVEL SECURITY;

-- RLS policies for rlhf_feedback
CREATE POLICY "Experts can insert their own feedback"
ON public.rlhf_feedback FOR INSERT
TO authenticated
WITH CHECK (
  expert_id IN (
    SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Experts can view their own feedback"
ON public.rlhf_feedback FOR SELECT
TO authenticated
USING (
  expert_id IN (
    SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage all feedback"
ON public.rlhf_feedback FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for annotator_profiles
CREATE POLICY "Experts can manage their own annotator profile"
ON public.annotator_profiles FOR ALL
TO authenticated
USING (
  expert_id IN (
    SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all annotator profiles"
ON public.annotator_profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for rlhf_gold_tasks (admin only)
CREATE POLICY "Admins can manage gold tasks"
ON public.rlhf_gold_tasks FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Experts can view gold tasks"
ON public.rlhf_gold_tasks FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS policies for rlhf_pending_qa (admin only)
CREATE POLICY "Admins can manage pending QA"
ON public.rlhf_pending_qa FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_rlhf_feedback_expert_id ON public.rlhf_feedback(expert_id);
CREATE INDEX idx_rlhf_feedback_job_offer_id ON public.rlhf_feedback(job_offer_id);
CREATE INDEX idx_rlhf_feedback_task_type ON public.rlhf_feedback(task_type);
CREATE INDEX idx_rlhf_feedback_overall_rating ON public.rlhf_feedback(overall_rating);
CREATE INDEX idx_rlhf_feedback_qa_status ON public.rlhf_feedback(qa_status);
CREATE INDEX idx_rlhf_feedback_created_at ON public.rlhf_feedback(created_at DESC);
CREATE INDEX idx_annotator_profiles_expert_id ON public.annotator_profiles(expert_id);
CREATE INDEX idx_rlhf_pending_qa_completed ON public.rlhf_pending_qa(completed_at) WHERE completed_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_rlhf_feedback_updated_at
  BEFORE UPDATE ON public.rlhf_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate anonymized annotator ID
CREATE OR REPLACE FUNCTION public.generate_anonymized_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'anon_' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
END;
$$;

-- Trigger to auto-generate anonymized_id for new annotator profiles
CREATE OR REPLACE FUNCTION public.set_annotator_anonymized_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.anonymized_id IS NULL OR NEW.anonymized_id = '' THEN
    NEW.anonymized_id := public.generate_anonymized_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_annotator_anonymized_id_trigger
  BEFORE INSERT ON public.annotator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_annotator_anonymized_id();