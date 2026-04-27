
-- Table: certification_questions (QCM + ethics questions per domain)
CREATE TABLE IF NOT EXISTS public.certification_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('medical', 'legal', 'finance', 'code')),
  phase TEXT NOT NULL CHECK (phase IN ('phase1_qcm', 'phase2_technical', 'phase2_ethics')),
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INT NOT NULL,
  explanation TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cert_questions_domain ON public.certification_questions(domain, phase, active);

-- Table: certification_gold_tasks (Phase 2A gold standard tasks)
CREATE TABLE IF NOT EXISTS public.certification_gold_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('medical', 'legal', 'finance', 'code')),
  task_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  gold_scores JSONB NOT NULL,
  gold_reasoning TEXT NOT NULL,
  explanation TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cert_gold_tasks_domain ON public.certification_gold_tasks(domain, active);

-- Table: certification_answers (history of answers per expert)
CREATE TABLE IF NOT EXISTS public.certification_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  session_id UUID,
  question_id UUID REFERENCES public.certification_questions(id),
  gold_task_id UUID REFERENCES public.certification_gold_tasks(id),
  selected_answer INT,
  submitted_scores JSONB,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cert_answers_expert ON public.certification_answers(expert_id);

-- RLS
ALTER TABLE public.certification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_gold_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_answers ENABLE ROW LEVEL SECURITY;

-- Questions readable by authenticated users
CREATE POLICY "Authenticated users can read active certification questions"
  ON public.certification_questions FOR SELECT TO authenticated
  USING (active = true);

-- Gold tasks readable by authenticated users (scores hidden in app layer)
CREATE POLICY "Authenticated users can read active gold tasks"
  ON public.certification_gold_tasks FOR SELECT TO authenticated
  USING (active = true);

-- Answers: users can read/insert their own
CREATE POLICY "Users can read own certification answers"
  ON public.certification_answers FOR SELECT TO authenticated
  USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own certification answers"
  ON public.certification_answers FOR INSERT TO authenticated
  WITH CHECK (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));
