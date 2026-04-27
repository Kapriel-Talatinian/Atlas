-- Create enum types for certifications
CREATE TYPE public.certification_level AS ENUM ('associate', 'professional', 'expert');
CREATE TYPE public.certification_status AS ENUM ('valid', 'expired', 'revoked');
CREATE TYPE public.certificate_event_type AS ENUM ('issued', 'revoked', 'expired', 'downloaded', 'viewed_public');

-- Create certifications table
CREATE TABLE public.certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  expert_id UUID REFERENCES public.expert_profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  country TEXT,
  role_title TEXT NOT NULL,
  level public.certification_level NOT NULL DEFAULT 'associate',
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  assessment_name TEXT NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  status public.certification_status NOT NULL DEFAULT 'valid',
  verification_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create certificate_events table for audit logging
CREATE TABLE public.certificate_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  event_type public.certificate_event_type NOT NULL,
  actor_user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence table for certificate ID generation
CREATE TABLE public.certificate_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  track TEXT NOT NULL,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  UNIQUE(year, track)
);

-- Enable RLS
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for certifications

-- Users can view their own certifications
CREATE POLICY "Users can view their own certifications"
ON public.certifications
FOR SELECT
USING (auth.uid() = user_id);

-- Public can verify certificates by certificate_id (limited columns via view)
CREATE POLICY "Anyone can verify certificates"
ON public.certifications
FOR SELECT
USING (true);

-- Admins can manage all certifications
CREATE POLICY "Admins can manage certifications"
ON public.certifications
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for certificate_events

-- Users can view events for their certificates
CREATE POLICY "Users can view their certificate events"
ON public.certificate_events
FOR SELECT
USING (
  certification_id IN (
    SELECT id FROM public.certifications WHERE user_id = auth.uid()
  )
);

-- Anyone can insert view events (for public verification)
CREATE POLICY "Anyone can log view events"
ON public.certificate_events
FOR INSERT
WITH CHECK (event_type = 'viewed_public');

-- Admins can manage all events
CREATE POLICY "Admins can manage certificate events"
ON public.certificate_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for sequences (admin only)
CREATE POLICY "Admins can manage sequences"
ON public.certificate_sequences
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to generate certificate ID
CREATE OR REPLACE FUNCTION public.generate_certificate_id(
  p_country_code TEXT,
  p_track TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_sequence INTEGER;
  v_certificate_id TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get or create sequence for this year/track combination
  INSERT INTO public.certificate_sequences (year, track, current_sequence)
  VALUES (v_year, p_track, 1)
  ON CONFLICT (year, track) 
  DO UPDATE SET current_sequence = certificate_sequences.current_sequence + 1
  RETURNING current_sequence INTO v_sequence;
  
  -- Generate the certificate ID
  v_certificate_id := 'STEF-' || UPPER(p_country_code) || '-' || UPPER(p_track) || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
  
  RETURN v_certificate_id;
END;
$$;

-- Function to issue a certificate
CREATE OR REPLACE FUNCTION public.issue_certificate(
  p_user_id UUID,
  p_expert_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_country TEXT,
  p_role_title TEXT,
  p_level public.certification_level,
  p_score INTEGER,
  p_assessment_name TEXT,
  p_track TEXT,
  p_valid_months INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  RETURN v_certification_id;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_certifications_updated_at
BEFORE UPDATE ON public.certifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_certifications_user_id ON public.certifications(user_id);
CREATE INDEX idx_certifications_certificate_id ON public.certifications(certificate_id);
CREATE INDEX idx_certifications_status ON public.certifications(status);
CREATE INDEX idx_certificate_events_certification_id ON public.certificate_events(certification_id);