
-- Table pour les versions de prompts (DSPy-inspired optimization)
CREATE TABLE public.prompt_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  icl_examples JSONB,
  optimization_reasoning TEXT,
  changes_made JSONB,
  status TEXT DEFAULT 'candidate' NOT NULL,
  performance_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Table pour la queue de review humain
CREATE TABLE public.human_review_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.annotation_items(id) ON DELETE CASCADE,
  candidate_id UUID,
  reason JSONB,
  alpha FLOAT,
  priority TEXT DEFAULT 'medium' NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  assigned_to UUID REFERENCES public.annotator_profiles(id) ON DELETE SET NULL,
  human_annotation JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Table pour les logs PII
CREATE TABLE public.pii_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID,
  candidate_id UUID,
  items_count INT NOT NULL DEFAULT 0,
  categories TEXT[],
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_human_review_status ON public.human_review_queue(status, priority);
CREATE INDEX idx_prompt_versions_status ON public.prompt_versions(status);
CREATE INDEX idx_pii_logs_candidate ON public.pii_logs(candidate_id);

-- Validation triggers (instead of CHECK constraints)
CREATE OR REPLACE FUNCTION public.validate_prompt_version_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('candidate', 'active', 'retired') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be candidate, active, or retired.', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_prompt_version_status
  BEFORE INSERT OR UPDATE ON public.prompt_versions
  FOR EACH ROW EXECUTE FUNCTION public.validate_prompt_version_status();

CREATE OR REPLACE FUNCTION public.validate_human_review_queue()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.priority NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_human_review_queue
  BEFORE INSERT OR UPDATE ON public.human_review_queue
  FOR EACH ROW EXECUTE FUNCTION public.validate_human_review_queue();

-- RLS
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pii_logs ENABLE ROW LEVEL SECURITY;

-- prompt_versions: only admins can read/write
CREATE POLICY "Admins can manage prompt versions"
  ON public.prompt_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- human_review_queue: admins full access, assigned annotators can read their items
CREATE POLICY "Admins can manage review queue"
  ON public.human_review_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Annotators can read assigned reviews"
  ON public.human_review_queue FOR SELECT TO authenticated
  USING (
    assigned_to IN (
      SELECT id FROM public.annotator_profiles WHERE expert_id = public.get_current_expert_id()
    )
  );

-- pii_logs: only admins
CREATE POLICY "Admins can read PII logs"
  ON public.pii_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role insert for edge functions (anon/service key)
CREATE POLICY "Service can insert prompt versions"
  ON public.prompt_versions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Service can insert review queue"
  ON public.human_review_queue FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Service can insert PII logs"
  ON public.pii_logs FOR INSERT TO anon
  WITH CHECK (true);
