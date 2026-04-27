
-- ============================================================
-- ASSESSMENT SYSTEM — 3-Phase Technical Evaluation
-- ============================================================

-- Quiz Question Bank (Phase 1)
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stack TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('fundamentals', 'algorithms', 'architecture', 'ecosystem', 'best_practices')),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  time_limit INTEGER NOT NULL DEFAULT 30,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coding Challenges (Phase 2)
CREATE TABLE IF NOT EXISTS public.coding_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stack TEXT NOT NULL,
  title TEXT NOT NULL,
  scenario TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  starter_code TEXT NOT NULL DEFAULT '',
  hidden_tests JSONB NOT NULL DEFAULT '[]',
  visible_tests JSONB NOT NULL DEFAULT '[]',
  max_duration INTEGER NOT NULL DEFAULT 1800,
  difficulty TEXT NOT NULL DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Code Review Challenges (Phase 3)
CREATE TABLE IF NOT EXISTS public.code_review_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stack TEXT NOT NULL,
  code TEXT NOT NULL,
  problems JSONB NOT NULL DEFAULT '[]',
  max_duration INTEGER NOT NULL DEFAULT 300,
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment Sessions (main session tracking)
CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  stack TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired', 'flagged')),
  current_phase INTEGER NOT NULL DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 3),
  
  -- Phase results (JSONB for flexibility)
  phase1_result JSONB,
  phase2_result JSONB,
  phase3_result JSONB,
  
  -- Global score
  global_score JSONB,
  
  -- Anti-cheat
  integrity_flags JSONB NOT NULL DEFAULT '[]',
  integrity_warning_count INTEGER NOT NULL DEFAULT 0,
  integrity_critical_count INTEGER NOT NULL DEFAULT 0,
  
  -- References to specific challenges used
  quiz_question_ids UUID[] DEFAULT '{}',
  coding_challenge_id UUID REFERENCES public.coding_challenges(id),
  code_review_challenge_id UUID REFERENCES public.code_review_challenges(id),
  
  -- Code submitted for Phase 2
  phase2_code TEXT,
  
  -- Code Review answers for Phase 3
  phase3_answers JSONB,
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  phase1_started_at TIMESTAMPTZ,
  phase1_completed_at TIMESTAMPTZ,
  phase2_started_at TIMESTAMPTZ,
  phase2_completed_at TIMESTAMPTZ,
  phase3_started_at TIMESTAMPTZ,
  phase3_completed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_questions_stack_domain ON public.quiz_questions(stack, domain);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_difficulty ON public.quiz_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_coding_challenges_stack ON public.coding_challenges(stack);
CREATE INDEX IF NOT EXISTS idx_code_review_challenges_stack ON public.code_review_challenges(stack);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_candidate ON public.assessment_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user ON public.assessment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_status ON public.assessment_sessions(status);

-- RLS
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_review_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Quiz questions: Admins manage, authenticated users can read active ones
CREATE POLICY "Admins can manage quiz questions" ON public.quiz_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read active quiz questions" ON public.quiz_questions FOR SELECT
  TO authenticated USING (is_active = true);

-- Coding challenges: Admins manage, authenticated can read active
CREATE POLICY "Admins can manage coding challenges" ON public.coding_challenges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read active coding challenges" ON public.coding_challenges FOR SELECT
  TO authenticated USING (is_active = true);

-- Code review challenges: Admins manage, authenticated can read active
CREATE POLICY "Admins can manage code review challenges" ON public.code_review_challenges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read active code review challenges" ON public.code_review_challenges FOR SELECT
  TO authenticated USING (is_active = true);

-- Assessment sessions: Users manage their own, admins see all
CREATE POLICY "Users can manage their own sessions" ON public.assessment_sessions FOR ALL
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all sessions" ON public.assessment_sessions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_assessment_sessions_updated_at BEFORE UPDATE ON public.assessment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quiz_questions_updated_at BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coding_challenges_updated_at BEFORE UPDATE ON public.coding_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_code_review_challenges_updated_at BEFORE UPDATE ON public.code_review_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
