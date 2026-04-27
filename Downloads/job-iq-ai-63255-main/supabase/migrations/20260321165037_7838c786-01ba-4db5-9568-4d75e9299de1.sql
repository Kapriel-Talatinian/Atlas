
-- ============================================
-- ANNOTATOR ASSESSMENT SYSTEM
-- ============================================

-- Annotation domains enum
CREATE TYPE public.annotation_domain AS ENUM (
  'generaliste',
  'rlhf_preference',
  'code_tech',
  'red_teaming_safety',
  'juridique_fr',
  'medical',
  'finance'
);

-- Annotator assessment tier enum
CREATE TYPE public.annotator_assessment_tier AS ENUM (
  'junior',
  'standard',
  'senior',
  'expert'
);

-- ─── Guidelines per domain ───────────────────────────
CREATE TABLE public.annotation_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain annotation_domain NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1.0',
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  examples JSONB NOT NULL DEFAULT '[]',
  counter_examples JSONB NOT NULL DEFAULT '[]',
  edge_cases JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain, version)
);

-- ─── Item bank for tests ─────────────────────────────
CREATE TABLE public.annotation_test_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain annotation_domain NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'intermediate', 'hard')),
  item_type TEXT NOT NULL CHECK (item_type IN ('annotation', 'error_detection', 'guidelines_quiz', 'ethical_judgment')),
  content JSONB NOT NULL DEFAULT '{}',
  gold_annotation JSONB NOT NULL DEFAULT '{}',
  scoring_rubric JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  pass_rate NUMERIC DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotation_test_items_domain ON public.annotation_test_items(domain, item_type, difficulty) WHERE is_active = true;

-- ─── Assessment sessions ─────────────────────────────
CREATE TABLE public.annotator_assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL,
  domain annotation_domain NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'expired', 'flagged')),
  
  -- Phase tracking
  current_phase INTEGER NOT NULL DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 4),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Phase 1: Guidelines comprehension
  phase1_started_at TIMESTAMPTZ,
  phase1_completed_at TIMESTAMPTZ,
  phase1_item_ids UUID[] DEFAULT '{}',
  phase1_answers JSONB DEFAULT '[]',
  phase1_score NUMERIC,
  phase1_passed BOOLEAN,
  
  -- Phase 2: Practical annotation
  phase2_started_at TIMESTAMPTZ,
  phase2_completed_at TIMESTAMPTZ,
  phase2_item_ids UUID[] DEFAULT '{}',
  phase2_answers JSONB DEFAULT '[]',
  phase2_scores JSONB DEFAULT '{}',
  phase2_avg_time_per_item NUMERIC,
  
  -- Phase 3: Error detection
  phase3_started_at TIMESTAMPTZ,
  phase3_completed_at TIMESTAMPTZ,
  phase3_item_ids UUID[] DEFAULT '{}',
  phase3_answers JSONB DEFAULT '[]',
  phase3_score NUMERIC,
  
  -- Phase 4: Ethical judgment
  phase4_started_at TIMESTAMPTZ,
  phase4_completed_at TIMESTAMPTZ,
  phase4_item_ids UUID[] DEFAULT '{}',
  phase4_answers JSONB DEFAULT '[]',
  phase4_score NUMERIC,
  
  -- Global results
  global_score NUMERIC,
  tier_awarded annotator_assessment_tier,
  feedback JSONB DEFAULT '{}',
  
  -- Integrity
  integrity_flags JSONB DEFAULT '[]',
  integrity_warning_count INTEGER DEFAULT 0,
  integrity_critical_count INTEGER DEFAULT 0,
  
  -- Timing
  time_limit_seconds INTEGER NOT NULL DEFAULT 2400,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotator_assessment_user ON public.annotator_assessment_sessions(user_id, domain, status);
CREATE INDEX idx_annotator_assessment_expert ON public.annotator_assessment_sessions(expert_id, domain);

-- ─── Domain certifications ───────────────────────────
CREATE TABLE public.annotator_domain_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL,
  domain annotation_domain NOT NULL,
  tier annotator_assessment_tier NOT NULL,
  score NUMERIC NOT NULL,
  session_id UUID REFERENCES public.annotator_assessment_sessions(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 months'),
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'revoked', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(expert_id, domain, status)
);

CREATE INDEX idx_annotator_domain_certs ON public.annotator_domain_certifications(expert_id, domain) WHERE status = 'valid';

-- ─── RLS policies ────────────────────────────────────

ALTER TABLE public.annotation_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_test_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotator_assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotator_domain_certifications ENABLE ROW LEVEL SECURITY;

-- Guidelines: readable by authenticated, writable by admins
CREATE POLICY "Authenticated can read active guidelines"
  ON public.annotation_guidelines FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage guidelines"
  ON public.annotation_guidelines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Test items: readable by system (edge functions use service role), no direct user access to gold
CREATE POLICY "Admins can manage test items"
  ON public.annotation_test_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Assessment sessions: users see own
CREATE POLICY "Users see own assessment sessions"
  ON public.annotator_assessment_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create own assessment sessions"
  ON public.annotator_assessment_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own in-progress sessions"
  ON public.annotator_assessment_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'in_progress');

CREATE POLICY "Admins manage all assessment sessions"
  ON public.annotator_assessment_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Domain certifications: users see own, public verification
CREATE POLICY "Users see own domain certifications"
  ON public.annotator_domain_certifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage domain certifications"
  ON public.annotator_domain_certifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at triggers
CREATE TRIGGER update_annotation_guidelines_updated_at
  BEFORE UPDATE ON public.annotation_guidelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotation_test_items_updated_at
  BEFORE UPDATE ON public.annotation_test_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotator_assessment_sessions_updated_at
  BEFORE UPDATE ON public.annotator_assessment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
