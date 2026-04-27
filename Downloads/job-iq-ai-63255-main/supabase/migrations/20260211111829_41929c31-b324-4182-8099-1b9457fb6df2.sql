-- Add unique constraint to prevent duplicate referrals
CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_referrals_email_referrer 
ON public.expert_referrals (referrer_id, referred_email);

-- Index on referral_code for fast lookup during signup
CREATE INDEX IF NOT EXISTS idx_expert_profiles_referral_code 
ON public.expert_profiles (referral_code) WHERE referral_code IS NOT NULL;