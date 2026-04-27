
-- Create a public view that hides contact info from expert_profiles
CREATE VIEW public.expert_profiles_public
WITH (security_invoker = on) AS
SELECT
  id,
  user_id,
  full_name,
  title,
  bio,
  city,
  country,
  primary_skills,
  secondary_skills,
  years_of_experience,
  daily_rate,
  availability,
  contract_types,
  work_type,
  languages,
  avatar_url,
  github_url,
  portfolio_url,
  onboarding_completed,
  profile_visible,
  kyc_status,
  created_at,
  updated_at
  -- Excluded: email, phone, phone_number_sms, linkedin_url, cv_url, cv_filename,
  -- kyc_documents, kyc_rejection_reason, kyc_submitted_at, kyc_verified_at,
  -- referral_code, payment_method_connected, email_notifications, sms_notifications,
  -- notify_job_matches, notify_application_updates
FROM public.expert_profiles;

-- Restrict direct SELECT on expert_profiles for companies
-- Companies should use the view instead
-- Keep existing policies for experts/admins, add restriction for companies
CREATE POLICY "Companies can view expert profiles via active application"
ON public.expert_profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'company') AND
  id IN (
    SELECT ja.expert_id
    FROM public.job_applications ja
    JOIN public.job_offers jo ON jo.id = ja.job_offer_id
    WHERE jo.user_id = auth.uid()
      AND ja.status IN ('applying', 'reviewing', 'interview', 'accepted', 'offer')
  )
);
