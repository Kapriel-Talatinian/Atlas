
-- LLM Call Logs
CREATE TABLE IF NOT EXISTS public.llm_call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  purpose TEXT NOT NULL,
  task_id UUID,
  project_id UUID,
  input_tokens INT,
  output_tokens INT,
  cost_usd FLOAT,
  latency_ms INT,
  temperature FLOAT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llm_logs_purpose ON public.llm_call_logs(purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_logs_cost ON public.llm_call_logs(cost_usd, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_logs_project ON public.llm_call_logs(project_id);

-- PII Logs
CREATE TABLE IF NOT EXISTS public.pii_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID,
  items_count INT NOT NULL DEFAULT 0,
  categories TEXT[] DEFAULT '{}',
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expert Annotations (the core annotation data from experts)
CREATE TABLE IF NOT EXISTS public.expert_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.annotation_tasks(id) ON DELETE CASCADE NOT NULL,
  expert_id UUID NOT NULL,
  annotation_type TEXT NOT NULL,
  annotation_data JSONB NOT NULL DEFAULT '{}',
  dimensions JSONB,
  reasoning TEXT,
  preference TEXT,
  preference_reasoning TEXT,
  verdict TEXT,
  justification TEXT,
  sources JSONB,
  flaw_category TEXT,
  flaw_severity TEXT,
  time_spent_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expert_annotations_task ON public.expert_annotations(task_id);
CREATE INDEX IF NOT EXISTS idx_expert_annotations_expert ON public.expert_annotations(expert_id);

-- Task Assignments
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.annotation_tasks(id) ON DELETE CASCADE NOT NULL,
  expert_id UUID NOT NULL,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'completed', 'skipped', 'expired')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ DEFAULT (now() + interval '2 hours')
);
CREATE INDEX IF NOT EXISTS idx_task_assignments_expert ON public.task_assignments(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON public.task_assignments(task_id);

-- Final Annotations (after QA)
CREATE TABLE IF NOT EXISTS public.final_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.annotation_tasks(id) UNIQUE NOT NULL,
  final_data JSONB NOT NULL,
  resolution_method TEXT CHECK (resolution_method IN ('unanimous', 'majority', 'adjudicated', 'flagged', 'manual')),
  alpha FLOAT,
  source_annotation_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_final_annotations_task ON public.final_annotations(task_id);

-- Human Review Queue
CREATE TABLE IF NOT EXISTS public.human_review_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.annotation_tasks(id) UNIQUE NOT NULL,
  reason JSONB,
  alpha FLOAT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assigned_to UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add pii_scanned flag to annotation_tasks
ALTER TABLE public.annotation_tasks ADD COLUMN IF NOT EXISTS pii_scanned BOOLEAN DEFAULT false;

-- Add completed_tasks counter to annotation_projects
ALTER TABLE public.annotation_projects ADD COLUMN IF NOT EXISTS completed_tasks INT DEFAULT 0;

-- RLS policies
ALTER TABLE public.llm_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "llm_logs_admin_only" ON public.llm_call_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.expert_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expert_annotations_own" ON public.expert_annotations FOR ALL USING (expert_id = auth.uid());
CREATE POLICY "expert_annotations_admin" ON public.expert_annotations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_assignments_own" ON public.task_assignments FOR SELECT USING (expert_id = auth.uid());
CREATE POLICY "task_assignments_admin" ON public.task_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.final_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "final_annotations_admin" ON public.final_annotations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.human_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "human_review_admin" ON public.human_review_queue FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.pii_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pii_logs_admin" ON public.pii_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Increment completed tasks function
CREATE OR REPLACE FUNCTION public.increment_completed_tasks(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.annotation_projects
  SET completed_tasks = COALESCE(completed_tasks, 0) + 1
  WHERE id = p_project_id;
END;
$$;
