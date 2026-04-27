
-- Function to check if an email is eligible for signup (anti-fraud)
-- Returns JSON with eligibility status and reason
CREATE OR REPLACE FUNCTION public.check_signup_eligibility(p_email text, p_referral_code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_email text;
  v_email_exists boolean;
  v_abuse_detected boolean;
  v_referral_valid boolean := true;
  v_referral_self boolean := false;
  v_recent_signups integer;
BEGIN
  -- Normalize email: lowercase, strip Gmail + aliases
  v_normalized_email := LOWER(p_email);
  
  IF v_normalized_email LIKE '%@gmail.com' OR v_normalized_email LIKE '%@googlemail.com' THEN
    -- Remove dots and +alias for Gmail
    v_normalized_email := REPLACE(SPLIT_PART(v_normalized_email, '@', 1), '.', '');
    v_normalized_email := SPLIT_PART(v_normalized_email, '+', 1) || '@gmail.com';
  ELSE
    -- For other providers, just strip +alias
    v_normalized_email := SPLIT_PART(v_normalized_email, '+', 1) || '@' || SPLIT_PART(v_normalized_email, '@', 2);
  END IF;

  -- Check if email already exists in profiles
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(p_email)
  ) INTO v_email_exists;

  -- Check for email abuse (normalized duplicates)
  SELECT COUNT(*) > 0 INTO v_abuse_detected
  FROM public.profiles
  WHERE CASE 
    WHEN LOWER(email) LIKE '%@gmail.com' OR LOWER(email) LIKE '%@googlemail.com' THEN
      REPLACE(SPLIT_PART(LOWER(email), '@', 1), '.', '') || '@gmail.com'
    ELSE
      SPLIT_PART(LOWER(email), '+', 1) || '@' || SPLIT_PART(LOWER(email), '@', 2)
  END = v_normalized_email;

  -- Check recent signups with similar normalized email pattern (last 24h)
  SELECT COUNT(*) INTO v_recent_signups
  FROM public.profiles
  WHERE created_at > now() - interval '24 hours'
    AND CASE 
      WHEN LOWER(email) LIKE '%@gmail.com' OR LOWER(email) LIKE '%@googlemail.com' THEN
        REPLACE(SPLIT_PART(LOWER(email), '@', 1), '.', '') || '@gmail.com'
      ELSE
        SPLIT_PART(LOWER(email), '+', 1) || '@' || SPLIT_PART(LOWER(email), '@', 2)
    END = v_normalized_email;

  -- Validate referral code if provided
  IF p_referral_code IS NOT NULL AND p_referral_code != '' THEN
    -- Check if referral code belongs to the same email (self-referral)
    SELECT EXISTS (
      SELECT 1 FROM public.expert_profiles 
      WHERE referral_code = p_referral_code 
        AND LOWER(email) = LOWER(p_email)
    ) INTO v_referral_self;

    -- If email already exists, referral is invalid
    IF v_email_exists OR v_abuse_detected THEN
      v_referral_valid := false;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'eligible', NOT v_email_exists AND NOT v_abuse_detected,
    'email_exists', v_email_exists,
    'abuse_detected', v_abuse_detected,
    'referral_valid', v_referral_valid AND NOT v_referral_self,
    'self_referral', v_referral_self,
    'recent_signups', v_recent_signups
  );
END;
$$;

-- Allow anonymous users to call this function (needed for signup page)
GRANT EXECUTE ON FUNCTION public.check_signup_eligibility TO anon;
GRANT EXECUTE ON FUNCTION public.check_signup_eligibility TO authenticated;

-- Rate limiting table for signup attempts
CREATE TABLE IF NOT EXISTS public.signup_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_fingerprint text,
  was_blocked boolean DEFAULT false
);

ALTER TABLE public.signup_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only admins can read, anyone can insert (for tracking)
CREATE POLICY "Admins can manage rate limits"
ON public.signup_rate_limits FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert rate limit records"
ON public.signup_rate_limits FOR INSERT
WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_signup_rate_limits_email_hash ON public.signup_rate_limits(email_hash, attempted_at DESC);

-- Function to check rate limit (max 3 attempts per email per hour)
CREATE OR REPLACE FUNCTION public.check_signup_rate_limit(p_email_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.signup_rate_limits
  WHERE email_hash = p_email_hash
    AND attempted_at > now() - interval '1 hour';
  
  -- Log this attempt
  INSERT INTO public.signup_rate_limits (email_hash) VALUES (p_email_hash);
  
  -- Allow max 5 attempts per hour
  RETURN v_count < 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_signup_rate_limit TO anon;
GRANT EXECUTE ON FUNCTION public.check_signup_rate_limit TO authenticated;
