
-- Add task_config to annotation_tasks
ALTER TABLE public.annotation_tasks ADD COLUMN IF NOT EXISTS task_config JSONB DEFAULT '{}';

-- Label sets for span annotation
CREATE TABLE IF NOT EXISTS public.label_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  labels JSONB NOT NULL DEFAULT '[]',
  domain TEXT,
  created_by UUID,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extraction schemas
CREATE TABLE IF NOT EXISTS public.extraction_schemas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}',
  domain TEXT,
  created_by UUID,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Annotation drafts for auto-save
CREATE TABLE IF NOT EXISTS public.annotation_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  annotator_id UUID NOT NULL,
  draft_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, annotator_id)
);

-- RLS
ALTER TABLE public.label_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_drafts ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='label_sets' AND policyname='label_sets_read') THEN
    EXECUTE 'CREATE POLICY label_sets_read ON public.label_sets FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='extraction_schemas' AND policyname='extraction_schemas_read') THEN
    EXECUTE 'CREATE POLICY extraction_schemas_read ON public.extraction_schemas FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='annotation_drafts' AND policyname='annotation_drafts_own') THEN
    EXECUTE 'CREATE POLICY annotation_drafts_own ON public.annotation_drafts FOR ALL USING (annotator_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_annotation_drafts_task ON public.annotation_drafts(task_id, annotator_id);
