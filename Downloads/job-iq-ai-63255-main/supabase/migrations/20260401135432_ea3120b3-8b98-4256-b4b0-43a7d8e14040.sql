
-- Performance reports table
CREATE TABLE IF NOT EXISTS public.performance_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.annotation_projects(id) ON DELETE CASCADE NOT NULL,
  client_id UUID NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('intermediate', 'final')),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_storage_path TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_reports_project ON public.performance_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_perf_reports_client ON public.performance_reports(client_id);

ALTER TABLE public.performance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own performance reports"
  ON public.performance_reports FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Add export_blocked_reason to dataset_exports
ALTER TABLE public.dataset_exports ADD COLUMN IF NOT EXISTS export_blocked_reason TEXT;

-- Anonymized expert stats function
CREATE OR REPLACE FUNCTION public.get_anonymized_expert_stats(p_project_id UUID)
RETURNS TABLE(
  expert_alias TEXT,
  tasks_completed BIGINT,
  avg_alpha FLOAT,
  avg_time_seconds FLOAT,
  consensus_rate FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH completed_task_ids AS (
    SELECT id FROM public.annotation_tasks
    WHERE source_id = p_project_id AND status = 'completed'
  ),
  expert_data AS (
    SELECT
      ea.annotator_id as expert_id,
      'Expert ' || chr(64 + ROW_NUMBER() OVER (ORDER BY ea.annotator_id)::int) as alias,
      count(*) as tasks,
      avg(ar.overall_alpha) as avg_a,
      avg(ea.time_spent) as avg_t,
      avg(CASE WHEN ar.overall_alpha >= 0.80 THEN 1.0 ELSE 0.0 END) * 100 as cons_rate
    FROM public.annotations ea
    JOIN completed_task_ids ct ON ct.id = ea.item_id
    LEFT JOIN public.alpha_reports ar ON ar.task_id = ea.item_id
    GROUP BY ea.annotator_id
  )
  SELECT
    ed.alias,
    ed.tasks,
    ROUND(ed.avg_a::numeric, 2)::float,
    ROUND(COALESCE(ed.avg_t, 0)::numeric, 0)::float,
    ROUND(COALESCE(ed.cons_rate, 0)::numeric, 1)::float
  FROM expert_data ed
  ORDER BY ed.tasks DESC;
END;
$$;

-- Reports storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clients can read their own reports"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reports' AND (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.clients WHERE user_id = auth.uid()
  ));
