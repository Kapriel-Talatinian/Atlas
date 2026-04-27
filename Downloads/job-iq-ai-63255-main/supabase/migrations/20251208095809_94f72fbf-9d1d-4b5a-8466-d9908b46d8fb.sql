-- Table for job applications
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_offer_id UUID NOT NULL REFERENCES public.job_offers(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applying' CHECK (status IN ('applying', 'under_review', 'offer', 'hired', 'rejected')),
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(job_offer_id, expert_id)
);

-- Table for expert referrals
CREATE TABLE public.expert_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up', 'applying', 'under_review', 'offer', 'hired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  hired_at TIMESTAMP WITH TIME ZONE,
  bonus_amount NUMERIC DEFAULT 0,
  bonus_paid_at TIMESTAMP WITH TIME ZONE
);

-- Table for expert payouts/earnings
CREATE TABLE public.expert_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL DEFAULT 'work' CHECK (type IN ('work', 'referral', 'bonus')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  description TEXT,
  contract_id UUID REFERENCES public.placements(id),
  payout_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_applications
CREATE POLICY "Experts can view their own applications"
  ON public.job_applications FOR SELECT
  USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Experts can create applications"
  ON public.job_applications FOR INSERT
  WITH CHECK (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Experts can update their own applications"
  ON public.job_applications FOR UPDATE
  USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Companies can view applications to their jobs"
  ON public.job_applications FOR SELECT
  USING (job_offer_id IN (SELECT id FROM public.job_offers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can do everything on applications"
  ON public.job_applications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS policies for expert_referrals
CREATE POLICY "Experts can view their own referrals"
  ON public.expert_referrals FOR SELECT
  USING (referrer_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Experts can create referrals"
  ON public.expert_referrals FOR INSERT
  WITH CHECK (referrer_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can do everything on referrals"
  ON public.expert_referrals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS policies for expert_payouts
CREATE POLICY "Experts can view their own payouts"
  ON public.expert_payouts FOR SELECT
  USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can do everything on payouts"
  ON public.expert_payouts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add payment_method_connected to expert_profiles
ALTER TABLE public.expert_profiles 
ADD COLUMN IF NOT EXISTS payment_method_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;