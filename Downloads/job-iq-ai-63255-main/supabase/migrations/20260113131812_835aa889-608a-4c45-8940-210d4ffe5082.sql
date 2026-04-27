-- Create storage bucket for proctoring images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proctoring-captures',
  'proctoring-captures',
  false,
  1048576, -- 1MB max per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Experts can upload their own captures
CREATE POLICY "Experts can upload proctoring captures"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'proctoring-captures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policy: Only admins can view proctoring captures
CREATE POLICY "Admins can view proctoring captures"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'proctoring-captures' AND
  public.has_role(auth.uid(), 'admin')
);

-- RLS policy: Experts can view their own captures
CREATE POLICY "Experts can view own proctoring captures"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'proctoring-captures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);