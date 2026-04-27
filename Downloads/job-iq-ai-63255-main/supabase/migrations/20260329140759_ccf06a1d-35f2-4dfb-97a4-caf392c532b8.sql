
-- RLS: Clients can view their own annotation projects
CREATE POLICY "clients_view_own_projects"
ON public.annotation_projects
FOR SELECT
TO authenticated
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- RLS: Clients can insert projects linked to their client record
CREATE POLICY "clients_insert_own_projects"
ON public.annotation_projects
FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- RLS: Clients can update their own projects (only draft/paused)
CREATE POLICY "clients_update_own_projects"
ON public.annotation_projects
FOR UPDATE
TO authenticated
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- RLS: Clients can view items in their own projects
CREATE POLICY "clients_view_own_items"
ON public.annotation_items
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.annotation_projects
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);

-- RLS: Clients can insert items into their own projects
CREATE POLICY "clients_insert_own_items"
ON public.annotation_items
FOR INSERT
TO authenticated
WITH CHECK (
  project_id IN (
    SELECT id FROM public.annotation_projects
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);

-- RLS: Clients can view batches in their own projects
CREATE POLICY "clients_view_own_batches"
ON public.annotation_batches
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.annotation_projects
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);

-- RLS: Clients can view exports from their own projects
CREATE POLICY "clients_view_own_exports"
ON public.annotation_exports
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.annotation_projects
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);

-- RLS: Clients can view quality reports for their own projects
CREATE POLICY "clients_view_own_quality_reports"
ON public.annotation_quality_reports
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.annotation_projects
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);

-- RLS: Clients can view alerts for their own projects
CREATE POLICY "clients_view_own_alerts"
ON public.annotation_alerts
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.annotation_projects
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);

-- Storage bucket for client data uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('annotation-uploads', 'annotation-uploads', false, 52428800, ARRAY['text/csv', 'application/json', 'application/jsonl', 'text/plain', 'application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: clients can upload to their own folder
CREATE POLICY "clients_upload_annotation_data"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'annotation-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: clients can view their own uploads
CREATE POLICY "clients_view_own_uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'annotation-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
