ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'specialty',
ADD COLUMN IF NOT EXISTS selected_specialty TEXT;