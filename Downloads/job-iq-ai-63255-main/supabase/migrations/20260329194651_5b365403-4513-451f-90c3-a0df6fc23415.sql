-- Add storage_key column to client_uploads for storing full validated data
ALTER TABLE public.client_uploads ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- Create storage bucket for upload data
INSERT INTO storage.buckets (id, name, public) VALUES ('upload-data', 'upload-data', false) ON CONFLICT (id) DO NOTHING;