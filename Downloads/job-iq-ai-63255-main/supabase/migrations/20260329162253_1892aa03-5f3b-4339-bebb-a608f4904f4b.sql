
-- Drop conflicting policies first
DROP POLICY IF EXISTS "webhooks_admin" ON public.client_webhooks;
DROP POLICY IF EXISTS "webhooks_client_own" ON public.client_webhooks;

-- Recreate them
CREATE POLICY "webhooks_client_own" ON public.client_webhooks
  FOR ALL USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE POLICY "webhooks_admin" ON public.client_webhooks
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Add columns to api_request_logs if missing
ALTER TABLE public.api_request_logs
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

-- Cleanup functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.dataset_exports
  SET status = 'expired'
  WHERE status = 'ready'
    AND expires_at < now();
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.api_request_logs WHERE created_at < now() - interval '90 days';
  DELETE FROM public.webhook_deliveries WHERE created_at < now() - interval '90 days';
END;
$$;
