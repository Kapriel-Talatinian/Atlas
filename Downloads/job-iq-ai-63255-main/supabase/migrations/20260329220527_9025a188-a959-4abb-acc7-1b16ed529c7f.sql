
-- Create dataset_exports table (referenced by export endpoints)
CREATE TABLE IF NOT EXISTS public.dataset_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'jsonl',
  min_alpha FLOAT DEFAULT 0.80,
  include_reasoning BOOLEAN DEFAULT true,
  include_raw_annotations BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'generating',
  total_items INTEGER DEFAULT 0,
  download_url TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.dataset_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own exports"
  ON public.dataset_exports FOR SELECT
  TO authenticated
  USING (client_id IN (
    SELECT id::text FROM public.clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role full access on exports"
  ON public.dataset_exports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
