-- Add signature and percentile columns to certifications table
ALTER TABLE public.certifications 
ADD COLUMN IF NOT EXISTS signature_hash text,
ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS percentile_rank integer,
ADD COLUMN IF NOT EXISTS percentile_computed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS min_samples_met boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cohort_size integer;

-- Create index for efficient percentile lookups
CREATE INDEX IF NOT EXISTS idx_certifications_role_level ON public.certifications(role_title, level);
CREATE INDEX IF NOT EXISTS idx_certifications_issued_at ON public.certifications(issued_at DESC);

-- Function to compute percentile for a certification
CREATE OR REPLACE FUNCTION public.compute_certification_percentile(p_certification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cert RECORD;
  v_percentile INTEGER;
  v_cohort_size INTEGER;
  v_min_samples INTEGER := 50;
  v_window_days INTEGER := 180;
BEGIN
  -- Get the certification details
  SELECT * INTO v_cert FROM public.certifications WHERE id = p_certification_id;
  
  IF v_cert IS NULL THEN
    RETURN;
  END IF;
  
  -- Count cohort size (same role_title and level within window)
  SELECT COUNT(*) INTO v_cohort_size
  FROM public.certifications
  WHERE role_title = v_cert.role_title
    AND level = v_cert.level
    AND issued_at >= (v_cert.issued_at - (v_window_days || ' days')::INTERVAL)
    AND issued_at <= v_cert.issued_at
    AND status = 'valid';
  
  -- Calculate percentile only if we have enough samples
  IF v_cohort_size >= v_min_samples THEN
    SELECT ROUND(100.0 * COUNT(*) / v_cohort_size) INTO v_percentile
    FROM public.certifications
    WHERE role_title = v_cert.role_title
      AND level = v_cert.level
      AND issued_at >= (v_cert.issued_at - (v_window_days || ' days')::INTERVAL)
      AND issued_at <= v_cert.issued_at
      AND status = 'valid'
      AND score < v_cert.score;
    
    -- Convert to "top X%" (100 - percentile)
    v_percentile := 100 - v_percentile;
    
    UPDATE public.certifications SET
      percentile_rank = v_percentile,
      percentile_computed_at = now(),
      min_samples_met = true,
      cohort_size = v_cohort_size
    WHERE id = p_certification_id;
  ELSE
    UPDATE public.certifications SET
      percentile_rank = NULL,
      percentile_computed_at = now(),
      min_samples_met = false,
      cohort_size = v_cohort_size
    WHERE id = p_certification_id;
  END IF;
END;
$function$;

-- Update issue_certificate function to include signature placeholder
CREATE OR REPLACE FUNCTION public.issue_certificate(
  p_user_id uuid, 
  p_expert_id uuid, 
  p_first_name text, 
  p_last_name text, 
  p_country text, 
  p_role_title text, 
  p_level certification_level, 
  p_score integer, 
  p_assessment_name text, 
  p_track text, 
  p_valid_months integer DEFAULT NULL::integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_certificate_id TEXT;
  v_country_code TEXT;
  v_certification_id UUID;
  v_valid_until TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get country code (first 2 chars or default)
  v_country_code := COALESCE(UPPER(LEFT(p_country, 2)), 'XX');
  
  -- Generate certificate ID
  v_certificate_id := public.generate_certificate_id(v_country_code, p_track);
  
  -- Calculate validity date if specified
  IF p_valid_months IS NOT NULL THEN
    v_valid_until := now() + (p_valid_months || ' months')::INTERVAL;
  END IF;
  
  -- Insert the certification
  INSERT INTO public.certifications (
    certificate_id,
    user_id,
    expert_id,
    first_name,
    last_name,
    country,
    role_title,
    level,
    score,
    assessment_name,
    valid_until,
    status
  ) VALUES (
    v_certificate_id,
    p_user_id,
    p_expert_id,
    p_first_name,
    p_last_name,
    p_country,
    p_role_title,
    p_level,
    p_score,
    p_assessment_name,
    v_valid_until,
    'valid'
  )
  RETURNING id INTO v_certification_id;
  
  -- Log the issue event
  INSERT INTO public.certificate_events (certification_id, event_type, actor_user_id)
  VALUES (v_certification_id, 'issued', auth.uid());
  
  -- Compute percentile (async would be better, but for now synchronous)
  PERFORM public.compute_certification_percentile(v_certification_id);
  
  RETURN v_certification_id;
END;
$function$;