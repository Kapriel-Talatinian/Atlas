-- ═══════════════════════════════════════════════════════════════════
-- Phase 3 — Mandatory expert onboarding wizard
--
--   1. expert_profiles.onboarding_completed_at: timestamp set when the
--      expert finishes the 3-step wizard. ProtectedRoute uses this to
--      redirect any expert that hasn't completed onboarding back to
--      /expert/onboarding.
--
--   2. RLS for rlhf_contributor_agreements: experts must be able to
--      INSERT their own agreement during onboarding (currently the table
--      is admin-only for writes). Reads are already allowed via existing
--      policy on (expert_id IN their own profile).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. onboarding_completed_at ────────────────────────────────────
ALTER TABLE public.expert_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_expert_profiles_onboarding
  ON public.expert_profiles(onboarding_completed_at)
  WHERE onboarding_completed_at IS NULL;


-- ─── 2. Allow experts to insert their own contributor agreement ───
DROP POLICY IF EXISTS "Experts can insert own agreement"
  ON public.rlhf_contributor_agreements;

CREATE POLICY "Experts can insert own agreement"
  ON public.rlhf_contributor_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    expert_id IN (
      SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
    )
  );


-- ─── 3. Allow experts to update/insert their own annotator_profiles ─
-- The onboarding wizard creates the annotator_profiles row before the
-- first certification so the contributor agreement can attach to it.
DROP POLICY IF EXISTS "Experts can manage own annotator profile"
  ON public.annotator_profiles;

CREATE POLICY "Experts can manage own annotator profile"
  ON public.annotator_profiles
  FOR ALL
  TO authenticated
  USING (
    expert_id IN (
      SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    expert_id IN (
      SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
    )
  );
