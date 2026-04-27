-- Create function to auto-update referral status when referred user completes onboarding
CREATE OR REPLACE FUNCTION public.update_referral_on_expert_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_record record;
BEGIN
  -- Only trigger when onboarding is completed
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    -- Find if this expert was referred by someone
    UPDATE public.expert_referrals
    SET status = 'applying',
        referred_user_id = NEW.user_id
    WHERE referred_email = NEW.email
      AND status = 'signed_up'
    RETURNING * INTO referral_record;
    
    IF referral_record IS NOT NULL THEN
      -- Notify the referrer
      INSERT INTO public.notifications (user_id, title, message, type, link)
      SELECT ep.user_id, 
             'Parrainage: Inscription complète!',
             'Votre filleul ' || NEW.full_name || ' a complété son inscription!',
             'success',
             '/expert/referrals'
      FROM public.expert_profiles ep
      WHERE ep.id = referral_record.referrer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-updating referral status
DROP TRIGGER IF EXISTS on_expert_onboarding_completed ON public.expert_profiles;
CREATE TRIGGER on_expert_onboarding_completed
  AFTER UPDATE ON public.expert_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_referral_on_expert_onboarding();

-- Create function to auto-update referral status when referred user gets hired (placement created)
CREATE OR REPLACE FUNCTION public.update_referral_on_placement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expert_user_id uuid;
  expert_email text;
  referral_record record;
BEGIN
  -- Get expert's user_id and email
  SELECT user_id, email INTO expert_user_id, expert_email
  FROM public.expert_profiles
  WHERE id = NEW.expert_id;
  
  -- Update referral status to hired
  UPDATE public.expert_referrals
  SET status = 'hired',
      hired_at = now(),
      bonus_amount = 500 -- $500 bonus
  WHERE referred_user_id = expert_user_id
    AND status IN ('signed_up', 'applying', 'under_review', 'offer')
  RETURNING * INTO referral_record;
  
  IF referral_record IS NOT NULL THEN
    -- Create a payout record for the referrer
    INSERT INTO public.expert_payouts (
      expert_id,
      amount,
      type,
      status,
      description
    )
    SELECT 
      referral_record.referrer_id,
      500,
      'referral',
      'pending',
      'Bonus parrainage pour ' || expert_email;
    
    -- Notify the referrer about the bonus
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT ep.user_id,
           'Bonus de parrainage!',
           'Félicitations! Votre filleul a été embauché. Vous recevrez $500 de bonus!',
           'success',
           '/expert/referrals'
    FROM public.expert_profiles ep
    WHERE ep.id = referral_record.referrer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for placement creation
DROP TRIGGER IF EXISTS on_placement_created ON public.placements;
CREATE TRIGGER on_placement_created
  AFTER INSERT ON public.placements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_referral_on_placement();

-- Create function to process referral bonus payout
CREATE OR REPLACE FUNCTION public.process_referral_bonus_payout(referral_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_record record;
BEGIN
  -- Get referral record
  SELECT * INTO ref_record
  FROM public.expert_referrals
  WHERE id = referral_id
    AND status = 'hired'
    AND bonus_paid_at IS NULL;
  
  IF ref_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Mark bonus as paid
  UPDATE public.expert_referrals
  SET bonus_paid_at = now()
  WHERE id = referral_id;
  
  -- Update payout status
  UPDATE public.expert_payouts
  SET status = 'paid',
      payout_date = now()
  WHERE expert_id = ref_record.referrer_id
    AND type = 'referral'
    AND status = 'pending'
    AND description LIKE '%' || (
      SELECT email FROM public.expert_profiles 
      WHERE user_id = ref_record.referred_user_id
    ) || '%';
  
  RETURN true;
END;
$$;

-- Add index for faster referral lookups
CREATE INDEX IF NOT EXISTS idx_expert_referrals_email ON public.expert_referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_expert_referrals_status ON public.expert_referrals(status);