-- Add cleaning report column to client_uploads
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS cleaning_report JSONB DEFAULT '{}'::jsonb;

-- Add quality score column
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS quality_score DOUBLE PRECISION;

-- Add language detected column
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS detected_language TEXT;

-- Add junk_rows and html_cleaned_rows counters
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS junk_rows INTEGER DEFAULT 0;
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS html_cleaned_rows INTEGER DEFAULT 0;
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS too_short_rows INTEGER DEFAULT 0;
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS too_long_rows INTEGER DEFAULT 0;
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS unicode_normalized_rows INTEGER DEFAULT 0;