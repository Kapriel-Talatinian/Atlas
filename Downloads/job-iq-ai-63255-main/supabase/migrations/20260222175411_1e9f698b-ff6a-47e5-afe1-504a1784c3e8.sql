
-- S7: Audit logging triggers (these succeeded in the previous attempt, using IF NOT EXISTS pattern)
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop and recreate triggers to be safe
DROP TRIGGER IF EXISTS audit_expert_profiles ON public.expert_profiles;
CREATE TRIGGER audit_expert_profiles
AFTER UPDATE OR DELETE ON public.expert_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_certifications ON public.certifications;
CREATE TRIGGER audit_certifications
AFTER INSERT OR UPDATE ON public.certifications
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_placements ON public.placements;
CREATE TRIGGER audit_placements
AFTER INSERT OR UPDATE OR DELETE ON public.placements
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- A5: Storage policies - only add the ones that don't exist yet
-- Drop existing conflicting ones and recreate with hardened versions
DROP POLICY IF EXISTS "Experts can upload their own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Experts can view their own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Experts can update their own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Experts can delete their own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Experts can upload proctoring captures" ON storage.objects;
DROP POLICY IF EXISTS "Owner and admins can view proctoring captures" ON storage.objects;
DROP POLICY IF EXISTS "Experts can upload KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Owner and admins can view KYC documents" ON storage.objects;

CREATE POLICY "Experts can upload their own CVs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expert-cvs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Experts can view their own CVs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expert-cvs' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
    OR (
      has_role(auth.uid(), 'company') AND EXISTS (
        SELECT 1 FROM public.job_applications ja
        JOIN public.job_offers jo ON jo.id = ja.job_offer_id
        JOIN public.expert_profiles ep ON ep.id = ja.expert_id
        WHERE jo.user_id = auth.uid()
          AND ep.user_id::text = (storage.foldername(name))[1]
          AND ja.status IN ('applying', 'reviewing', 'interview', 'accepted', 'offer')
      )
    )
  )
);

CREATE POLICY "Experts can update their own CVs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'expert-cvs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Experts can delete their own CVs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'expert-cvs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Experts can upload proctoring captures v2"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proctoring-captures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owner and admins can view proctoring captures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proctoring-captures'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Experts can upload KYC documents v2"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owner and admins can view KYC documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
  )
);

-- A4: Enable realtime on critical tables
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
