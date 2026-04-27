
-- ============================================================
-- STEF POINTS SYSTEM
-- ============================================================
CREATE TABLE public.stef_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL, -- 'referral_registration', 'referral_profile', 'referral_assessment', 'referral_certified', 'referral_mission', 'own_assessment', 'annotation', 'spending'
  source_id UUID, -- referral_id, assessment_id, etc.
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stef_points_user ON public.stef_points_ledger(user_id);

-- Points balance view
CREATE OR REPLACE VIEW public.stef_points_balance AS
SELECT user_id, COALESCE(SUM(amount), 0) AS balance
FROM public.stef_points_ledger
GROUP BY user_id;

-- ============================================================
-- AMBASSADOR TIERS
-- ============================================================
CREATE TABLE public.ambassador_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  expert_id UUID REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  current_tier TEXT NOT NULL DEFAULT 'starter' CHECK (current_tier IN ('starter', 'ambassador', 'senior_ambassador', 'elite')),
  tier_bonus_pct INTEGER NOT NULL DEFAULT 0, -- 0, 10, 25, 50
  total_invited INTEGER NOT NULL DEFAULT 0,
  total_registered INTEGER NOT NULL DEFAULT 0,
  total_profile_completed INTEGER NOT NULL DEFAULT 0,
  total_assessment_completed INTEGER NOT NULL DEFAULT 0,
  total_certified INTEGER NOT NULL DEFAULT 0,
  total_on_mission INTEGER NOT NULL DEFAULT 0,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  total_cash_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  pending_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  impact_countries TEXT[] NOT NULL DEFAULT '{}',
  leaderboard_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ambassador_user ON public.ambassador_profiles(user_id);
CREATE INDEX idx_ambassador_tier ON public.ambassador_profiles(current_tier);

-- ============================================================
-- ENHANCED REFERRAL TRACKING (add pipeline columns to expert_referrals)
-- ============================================================
ALTER TABLE public.expert_referrals
  ADD COLUMN IF NOT EXISTS referred_name TEXT,
  ADD COLUMN IF NOT EXISTS invite_channel TEXT DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS link_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessment_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessment_score INTEGER,
  ADD COLUMN IF NOT EXISTS assessment_level TEXT,
  ADD COLUMN IF NOT EXISTS certified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certificate_id TEXT,
  ADD COLUMN IF NOT EXISTS first_mission_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_step TEXT NOT NULL DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS referrer_points_awarded JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS referee_points_awarded JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS referrer_cash_awarded JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nudges_sent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_nudge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- ============================================================
-- REFERRAL NUDGES
-- ============================================================
CREATE TABLE public.referral_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.expert_referrals(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL,
  referee_email TEXT NOT NULL,
  nudge_type TEXT NOT NULL DEFAULT 'manual', -- 'auto', 'manual'
  template_id TEXT, -- 'encourage', 'assessment_reminder', 'custom'
  message TEXT,
  channel TEXT NOT NULL DEFAULT 'email', -- 'email', 'whatsapp', 'sms'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nudges_referral ON public.referral_nudges(referral_id);

-- ============================================================
-- REFERRAL REWARD STEPS CONFIG
-- ============================================================
CREATE TABLE public.referral_reward_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step TEXT NOT NULL UNIQUE,
  referrer_points INTEGER NOT NULL DEFAULT 0,
  referrer_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  referee_points INTEGER NOT NULL DEFAULT 0,
  referee_perks TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Insert default reward steps
INSERT INTO public.referral_reward_config (step, referrer_points, referrer_cash, referee_points, referee_perks, description) VALUES
  ('registration', 5, 0, 10, ARRAY['badge_recommended', 'priority_assessment'], 'Le filleul crée son compte'),
  ('profile_completed', 10, 0, 20, ARRAY['profile_boost'], 'Le filleul complète son profil'),
  ('assessment_completed', 25, 25, 50, ARRAY['certificate', 'marketplace_access'], 'Le filleul termine l''assessment'),
  ('certified_mid_plus', 50, 75, 100, ARRAY['certification_badge', 'visibility_boost'], 'Le filleul est certifié Mid+'),
  ('first_mission', 200, 150, 200, ARRAY['mission_payment'], 'Le filleul est placé en mission');

-- ============================================================
-- REFERRAL ANALYTICS (monthly snapshots)
-- ============================================================
CREATE TABLE public.referral_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_invites INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_registrations INTEGER NOT NULL DEFAULT 0,
  total_profiles_completed INTEGER NOT NULL DEFAULT 0,
  total_assessments_completed INTEGER NOT NULL DEFAULT 0,
  total_certified INTEGER NOT NULL DEFAULT 0,
  total_missions INTEGER NOT NULL DEFAULT 0,
  total_rewards_distributed NUMERIC(10,2) NOT NULL DEFAULT 0,
  channel_breakdown JSONB NOT NULL DEFAULT '{}',
  country_breakdown JSONB NOT NULL DEFAULT '{}',
  k_factor NUMERIC(5,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_start, period_end)
);

-- ============================================================
-- ANTI-ABUSE TRACKING
-- ============================================================
CREATE TABLE public.referral_abuse_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES public.expert_referrals(id) ON DELETE CASCADE,
  referrer_id UUID,
  flag_type TEXT NOT NULL, -- 'same_ip', 'rapid_signups', 'email_pattern', 'self_referral', 'account_deactivated'
  details JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_abuse_referrer ON public.referral_abuse_flags(referrer_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.stef_points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_reward_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_abuse_flags ENABLE ROW LEVEL SECURITY;

-- stef_points_ledger: users see their own
CREATE POLICY "Users see own points" ON public.stef_points_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage points" ON public.stef_points_ledger FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ambassador_profiles: users see their own, public for leaderboard
CREATE POLICY "Users see own ambassador profile" ON public.ambassador_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own ambassador profile" ON public.ambassador_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage ambassadors" ON public.ambassador_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Leaderboard public read" ON public.ambassador_profiles FOR SELECT TO authenticated USING (true);

-- referral_nudges: users see their own sent nudges
CREATE POLICY "Users see own nudges" ON public.referral_nudges FOR SELECT TO authenticated
  USING (referrer_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users insert own nudges" ON public.referral_nudges FOR INSERT TO authenticated
  WITH CHECK (referrer_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

-- referral_reward_config: public read
CREATE POLICY "Anyone can read reward config" ON public.referral_reward_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage reward config" ON public.referral_reward_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- referral_analytics_snapshots: admin only
CREATE POLICY "Admins read analytics" ON public.referral_analytics_snapshots FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- referral_abuse_flags: admin only
CREATE POLICY "Admins manage abuse flags" ON public.referral_abuse_flags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- FUNCTION: Award referral points
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_referral_step(
  p_referral_id UUID,
  p_step TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral RECORD;
  v_reward RECORD;
  v_referrer_user_id UUID;
  v_referee_user_id UUID;
  v_ambassador RECORD;
  v_tier_bonus NUMERIC;
  v_result JSONB;
BEGIN
  -- Get referral
  SELECT * INTO v_referral FROM public.expert_referrals WHERE id = p_referral_id;
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('error', 'Referral not found');
  END IF;

  -- Check if already awarded for this step
  IF (v_referral.referrer_points_awarded ? p_step) THEN
    RETURN jsonb_build_object('error', 'Already awarded for this step');
  END IF;

  -- Get reward config
  SELECT * INTO v_reward FROM public.referral_reward_config WHERE step = p_step AND is_active = true;
  IF v_reward IS NULL THEN
    RETURN jsonb_build_object('error', 'Reward step not found');
  END IF;

  -- Get user IDs
  SELECT user_id INTO v_referrer_user_id FROM public.expert_profiles WHERE id = v_referral.referrer_id;
  v_referee_user_id := v_referral.referred_user_id;

  -- Get ambassador tier bonus
  SELECT * INTO v_ambassador FROM public.ambassador_profiles WHERE user_id = v_referrer_user_id;
  v_tier_bonus := COALESCE(v_ambassador.tier_bonus_pct, 0);

  -- Award referrer points (with tier bonus)
  IF v_reward.referrer_points > 0 THEN
    INSERT INTO public.stef_points_ledger (user_id, amount, source, source_id, description)
    VALUES (v_referrer_user_id, 
            v_reward.referrer_points + FLOOR(v_reward.referrer_points * v_tier_bonus / 100),
            'referral_' || p_step, p_referral_id, 
            'Parrainage étape: ' || p_step);
  END IF;

  -- Award referrer cash
  IF v_reward.referrer_cash > 0 THEN
    UPDATE public.ambassador_profiles
    SET pending_cash = pending_cash + v_reward.referrer_cash + (v_reward.referrer_cash * v_tier_bonus / 100),
        total_cash_earned = total_cash_earned + v_reward.referrer_cash + (v_reward.referrer_cash * v_tier_bonus / 100)
    WHERE user_id = v_referrer_user_id;
  END IF;

  -- Award referee points
  IF v_referee_user_id IS NOT NULL AND v_reward.referee_points > 0 THEN
    INSERT INTO public.stef_points_ledger (user_id, amount, source, source_id, description)
    VALUES (v_referee_user_id, v_reward.referee_points, 'referral_' || p_step, p_referral_id,
            'Bonus filleul étape: ' || p_step);
  END IF;

  -- Mark step as awarded
  UPDATE public.expert_referrals
  SET referrer_points_awarded = referrer_points_awarded || jsonb_build_object(p_step, now()::TEXT),
      referee_points_awarded = referee_points_awarded || jsonb_build_object(p_step, now()::TEXT),
      referrer_cash_awarded = CASE WHEN v_reward.referrer_cash > 0 
        THEN referrer_cash_awarded || jsonb_build_object(p_step, v_reward.referrer_cash)
        ELSE referrer_cash_awarded END,
      current_step = p_step
  WHERE id = p_referral_id;

  -- Update ambassador stats
  UPDATE public.ambassador_profiles SET
    total_points_earned = total_points_earned + v_reward.referrer_points,
    total_registered = CASE WHEN p_step = 'registration' THEN total_registered + 1 ELSE total_registered END,
    total_profile_completed = CASE WHEN p_step = 'profile_completed' THEN total_profile_completed + 1 ELSE total_profile_completed END,
    total_assessment_completed = CASE WHEN p_step = 'assessment_completed' THEN total_assessment_completed + 1 ELSE total_assessment_completed END,
    total_certified = CASE WHEN p_step = 'certified_mid_plus' THEN total_certified + 1 ELSE total_certified END,
    total_on_mission = CASE WHEN p_step = 'first_mission' THEN total_on_mission + 1 ELSE total_on_mission END,
    updated_at = now()
  WHERE user_id = v_referrer_user_id;

  -- Check tier upgrade
  PERFORM public.check_ambassador_tier_upgrade(v_referrer_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'referrer_points', v_reward.referrer_points,
    'referrer_cash', v_reward.referrer_cash,
    'referee_points', v_reward.referee_points
  );
END;
$$;

-- ============================================================
-- FUNCTION: Check & upgrade ambassador tier
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_ambassador_tier_upgrade(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
  v_new_tier TEXT;
  v_new_bonus INTEGER;
BEGIN
  SELECT * INTO v_profile FROM public.ambassador_profiles WHERE user_id = p_user_id;
  IF v_profile IS NULL THEN RETURN 'no_profile'; END IF;

  -- Determine tier based on certified count
  IF v_profile.total_certified >= 25 AND v_profile.total_on_mission >= 5 THEN
    v_new_tier := 'elite'; v_new_bonus := 50;
  ELSIF v_profile.total_certified >= 10 THEN
    v_new_tier := 'senior_ambassador'; v_new_bonus := 25;
  ELSIF v_profile.total_certified >= 3 THEN
    v_new_tier := 'ambassador'; v_new_bonus := 10;
  ELSE
    v_new_tier := 'starter'; v_new_bonus := 0;
  END IF;

  IF v_new_tier != v_profile.current_tier THEN
    UPDATE public.ambassador_profiles
    SET current_tier = v_new_tier, tier_bonus_pct = v_new_bonus, updated_at = now()
    WHERE user_id = p_user_id;

    -- Notify tier upgrade
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_user_id,
      CASE v_new_tier
        WHEN 'ambassador' THEN '⭐ Ambassadeur STEF !'
        WHEN 'senior_ambassador' THEN '🏆 Ambassadeur Senior !'
        WHEN 'elite' THEN '💎 Ambassadeur Élite !'
        ELSE 'Mise à jour tier'
      END,
      CASE v_new_tier
        WHEN 'ambassador' THEN 'Félicitations ! 3 filleuls certifiés. +10% de bonus sur vos rewards.'
        WHEN 'senior_ambassador' THEN 'Incroyable ! 10 filleuls certifiés. +25% de bonus.'
        WHEN 'elite' THEN 'Légende ! 25 certifiés + 5 en mission. +50% de bonus + revenue share.'
        ELSE ''
      END,
      'success', '/expert/referrals');
  END IF;

  RETURN v_new_tier;
END;
$$;

-- ============================================================
-- TRIGGER: Auto-create ambassador profile on expert profile creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_create_ambassador_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.ambassador_profiles (user_id, expert_id)
  VALUES (NEW.user_id, NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_ambassador
  AFTER INSERT ON public.expert_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_ambassador_profile();
