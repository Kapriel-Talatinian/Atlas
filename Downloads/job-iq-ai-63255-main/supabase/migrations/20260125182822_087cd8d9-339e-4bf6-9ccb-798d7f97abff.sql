-- =====================================================
-- RLHF MVP COMPLET - Multi-Tier Annotation System
-- =====================================================

-- 1. Add annotator tier/role enum
DO $$ BEGIN
  CREATE TYPE public.annotator_tier AS ENUM ('student', 'expert', 'senior');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Update annotator_profiles with tier system
ALTER TABLE public.annotator_profiles 
ADD COLUMN IF NOT EXISTS tier annotator_tier DEFAULT 'expert',
ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_annotations integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS accuracy_vs_senior numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS incentive_multiplier numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 3. Create dataset versions table
CREATE TABLE IF NOT EXISTS public.rlhf_dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name text NOT NULL UNIQUE,
  version_number integer NOT NULL,
  description text,
  schema_version text DEFAULT 'v1.0',
  total_instances integer DEFAULT 0,
  validated_instances integer DEFAULT 0,
  is_published boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  published_at timestamptz,
  created_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.rlhf_dataset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dataset versions" ON public.rlhf_dataset_versions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view published versions" ON public.rlhf_dataset_versions
  FOR SELECT USING (is_published = true);

-- 4. Create multi-tier annotations table
CREATE TABLE IF NOT EXISTS public.rlhf_tier_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid REFERENCES public.rlhf_feedback(id) ON DELETE CASCADE,
  annotator_id text NOT NULL,
  tier annotator_tier NOT NULL,
  
  -- Expanded scoring (10+ dimensions per PRD)
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Expected: correctness, reasoning_clarity, code_quality, edge_cases, 
  -- complexity, performance, maintainability, security_awareness, 
  -- trade_offs, production_readiness
  
  overall_rating text NOT NULL CHECK (overall_rating IN ('up', 'down', 'neutral')),
  issues_detected text[] DEFAULT '{}',
  rationale text,
  improvement_suggestions text,
  inline_comments jsonb DEFAULT '[]'::jsonb,
  
  -- Metadata
  time_spent_seconds integer,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(feedback_id, tier)
);

ALTER TABLE public.rlhf_tier_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tier annotations" ON public.rlhf_tier_annotations
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Annotators can insert their own" ON public.rlhf_tier_annotations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Annotators can view their own" ON public.rlhf_tier_annotations
  FOR SELECT USING (true);

-- 5. Create disagreement capture table (HIGH VALUE per PRD)
CREATE TABLE IF NOT EXISTS public.rlhf_disagreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid REFERENCES public.rlhf_feedback(id) ON DELETE CASCADE,
  
  -- Tiers involved
  tier_1 annotator_tier NOT NULL,
  tier_1_annotation_id uuid REFERENCES public.rlhf_tier_annotations(id),
  tier_2 annotator_tier NOT NULL,
  tier_2_annotation_id uuid REFERENCES public.rlhf_tier_annotations(id),
  
  -- Disagreement details
  disagreement_type text NOT NULL CHECK (disagreement_type IN ('rating', 'score', 'issues', 'methodology', 'other')),
  severity text DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
  description text,
  
  -- Senior resolution
  senior_resolution text,
  senior_annotator_id text,
  resolved_rating text,
  resolved_at timestamptz,
  resolution_rationale text,
  
  created_at timestamptz DEFAULT now(),
  is_resolved boolean DEFAULT false
);

ALTER TABLE public.rlhf_disagreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage disagreements" ON public.rlhf_disagreements
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Seniors can resolve" ON public.rlhf_disagreements
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can view disagreements" ON public.rlhf_disagreements
  FOR SELECT USING (true);

-- 6. Create compliance/rights tracking table
CREATE TABLE IF NOT EXISTS public.rlhf_contributor_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotator_id text NOT NULL,
  expert_id uuid REFERENCES public.expert_profiles(id),
  
  agreement_version text NOT NULL DEFAULT 'v1.0',
  signed_at timestamptz DEFAULT now(),
  ip_address text,
  
  -- Rights
  data_usage_consent boolean DEFAULT true,
  anonymization_consent boolean DEFAULT true,
  resale_consent boolean DEFAULT true,
  
  -- Restrictions
  sector_restrictions text[] DEFAULT '{}',
  time_limit_months integer,
  
  is_active boolean DEFAULT true,
  revoked_at timestamptz
);

ALTER TABLE public.rlhf_contributor_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agreements" ON public.rlhf_contributor_agreements
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own agreements" ON public.rlhf_contributor_agreements
  FOR SELECT USING (expert_id IN (SELECT id FROM expert_profiles WHERE user_id = auth.uid()));

-- 7. Add dataset version link to feedback
ALTER TABLE public.rlhf_feedback 
ADD COLUMN IF NOT EXISTS dataset_version_id uuid REFERENCES public.rlhf_dataset_versions(id),
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tier_complete jsonb DEFAULT '{"student": false, "expert": false, "senior": false}'::jsonb;

-- 8. Create test instances table (atomic unit per PRD)
CREATE TABLE IF NOT EXISTS public.rlhf_test_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Test content (immutable after creation)
  test_prompt text NOT NULL,
  candidate_solution text,
  expected_output text,
  
  -- Metadata
  domain text NOT NULL CHECK (domain IN ('backend', 'frontend', 'data', 'devops', 'algo', 'system_design', 'other')),
  difficulty text NOT NULL CHECK (difficulty IN ('junior', 'mid', 'senior', 'staff', 'principal')),
  language text DEFAULT 'fr',
  
  -- Versioning
  version integer DEFAULT 1,
  is_immutable boolean DEFAULT false,
  
  -- Stats
  total_annotations integer DEFAULT 0,
  avg_correctness_score numeric,
  
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.rlhf_test_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage test instances" ON public.rlhf_test_instances
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Annotators can view test instances" ON public.rlhf_test_instances
  FOR SELECT USING (true);

-- 9. Link feedback to test instances
ALTER TABLE public.rlhf_feedback
ADD COLUMN IF NOT EXISTS test_instance_id uuid REFERENCES public.rlhf_test_instances(id);

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tier_annotations_feedback ON public.rlhf_tier_annotations(feedback_id);
CREATE INDEX IF NOT EXISTS idx_tier_annotations_tier ON public.rlhf_tier_annotations(tier);
CREATE INDEX IF NOT EXISTS idx_disagreements_feedback ON public.rlhf_disagreements(feedback_id);
CREATE INDEX IF NOT EXISTS idx_disagreements_resolved ON public.rlhf_disagreements(is_resolved);
CREATE INDEX IF NOT EXISTS idx_feedback_dataset_version ON public.rlhf_feedback(dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_test_instances_domain ON public.rlhf_test_instances(domain);
CREATE INDEX IF NOT EXISTS idx_annotator_tier ON public.annotator_profiles(tier);

-- 11. Update annotator_profiles with tier based on experience
UPDATE public.annotator_profiles 
SET tier = CASE 
  WHEN experience_years >= 10 THEN 'senior'::annotator_tier
  WHEN experience_years >= 3 THEN 'expert'::annotator_tier
  ELSE 'student'::annotator_tier
END
WHERE tier IS NULL;