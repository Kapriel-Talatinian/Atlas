-- Create profiles table for experts
CREATE TABLE public.expert_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Personal Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  
  -- Professional Information
  title TEXT NOT NULL, -- e.g. "Senior Full-Stack Developer"
  bio TEXT,
  years_of_experience INTEGER NOT NULL,
  
  -- Skills & Expertise
  primary_skills TEXT[] NOT NULL DEFAULT '{}',
  secondary_skills TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}', -- Programming languages
  
  -- Work Preferences
  daily_rate INTEGER, -- TJM in euros
  availability TEXT NOT NULL, -- 'immediate', '2_weeks', '1_month', '3_months'
  work_type TEXT[] NOT NULL DEFAULT '{}', -- 'remote', 'hybrid', 'onsite'
  contract_types TEXT[] NOT NULL DEFAULT '{}', -- 'freelance', 'cdi', 'cdd'
  
  -- Documents
  cv_url TEXT,
  cv_filename TEXT,
  portfolio_url TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  
  -- Profile Status
  onboarding_completed BOOLEAN DEFAULT FALSE,
  profile_visible BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for expert_profiles
CREATE POLICY "Experts can view their own profile"
  ON public.expert_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Experts can create their own profile"
  ON public.expert_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Experts can update their own profile"
  ON public.expert_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Companies can view completed expert profiles
CREATE POLICY "Companies can view completed expert profiles"
  ON public.expert_profiles
  FOR SELECT
  USING (onboarding_completed = TRUE AND profile_visible = TRUE);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.expert_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for CVs
INSERT INTO storage.buckets (id, name, public)
VALUES ('expert-cvs', 'expert-cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for CVs
CREATE POLICY "Experts can upload their own CV"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'expert-cvs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Experts can view their own CV"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'expert-cvs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Experts can update their own CV"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'expert-cvs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Experts can delete their own CV"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'expert-cvs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Companies can view CVs of completed profiles
CREATE POLICY "Companies can view expert CVs"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'expert-cvs'
  );