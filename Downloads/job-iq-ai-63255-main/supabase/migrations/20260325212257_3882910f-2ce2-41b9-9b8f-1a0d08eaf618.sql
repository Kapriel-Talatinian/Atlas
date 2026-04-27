
CREATE TABLE public.activation_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_type TEXT NOT NULL,
  specialty TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

ALTER TABLE public.activation_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activation emails" ON public.activation_emails
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activation emails" ON public.activation_emails
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_activation_emails_user ON public.activation_emails(user_id);
CREATE INDEX idx_activation_emails_type ON public.activation_emails(email_type);

CREATE TABLE public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  anonymous_id TEXT,
  specialty TEXT NOT NULL,
  score INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_time_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert quiz results" ON public.quiz_results
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Users can view own quiz results" ON public.quiz_results
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Anon can view own quiz results" ON public.quiz_results
  FOR SELECT TO anon USING (anonymous_id IS NOT NULL);

CREATE INDEX idx_quiz_results_user ON public.quiz_results(user_id);
CREATE INDEX idx_quiz_results_score ON public.quiz_results(score);
