
-- Expert experience (work history)
CREATE TABLE IF NOT EXISTS public.expert_experience (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  period TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expert education
CREATE TABLE IF NOT EXISTS public.expert_education (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  degree_name TEXT NOT NULL,
  institution TEXT NOT NULL,
  year TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expert languages
CREATE TABLE IF NOT EXISTS public.expert_languages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  language TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'courant',
  UNIQUE(expert_id, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expert_experience_expert ON public.expert_experience(expert_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_expert_education_expert ON public.expert_education(expert_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_expert_languages_expert ON public.expert_languages(expert_id);

-- RLS
ALTER TABLE public.expert_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_availability ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expert_experience' AND policyname='expert_experience_self') THEN
    EXECUTE 'CREATE POLICY expert_experience_self ON public.expert_experience FOR ALL USING (expert_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expert_education' AND policyname='expert_education_self') THEN
    EXECUTE 'CREATE POLICY expert_education_self ON public.expert_education FOR ALL USING (expert_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expert_languages' AND policyname='expert_languages_self') THEN
    EXECUTE 'CREATE POLICY expert_languages_self ON public.expert_languages FOR ALL USING (expert_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expert_availability' AND policyname='expert_availability_self') THEN
    EXECUTE 'CREATE POLICY expert_availability_self ON public.expert_availability FOR ALL USING (expert_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

-- Add fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip_address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_user_agent TEXT;
