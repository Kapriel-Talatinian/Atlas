
ALTER TABLE public.dataset_exports ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE public.dataset_exports ADD COLUMN IF NOT EXISTS error_message TEXT;
