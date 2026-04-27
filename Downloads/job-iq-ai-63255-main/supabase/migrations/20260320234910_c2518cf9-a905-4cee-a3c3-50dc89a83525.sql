
-- Email preferences table for category-level opt-outs
CREATE TABLE public.user_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transactional BOOLEAN NOT NULL DEFAULT true,
  lifecycle BOOLEAN NOT NULL DEFAULT true,
  marketing BOOLEAN NOT NULL DEFAULT true,
  referral BOOLEAN NOT NULL DEFAULT true,
  annotation BOOLEAN NOT NULL DEFAULT true,
  dormant_since TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own preferences
CREATE POLICY "Users can view own email preferences"
  ON public.user_email_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own email preferences"
  ON public.user_email_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own email preferences"
  ON public.user_email_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role can read all (for edge functions)
CREATE POLICY "Service role can read all email preferences"
  ON public.user_email_preferences FOR SELECT
  TO service_role
  USING (true);

-- Auto-create preferences on new user signup
CREATE OR REPLACE FUNCTION public.auto_create_email_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_email_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Updated_at trigger
CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.user_email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
