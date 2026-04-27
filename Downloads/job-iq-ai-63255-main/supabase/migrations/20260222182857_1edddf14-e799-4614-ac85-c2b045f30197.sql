
-- 1. expert_profiles: Companies should only see profiles with active applications to their jobs
-- Remove the broad "Companies can view public expert profiles" policy
DROP POLICY IF EXISTS "Companies can view public expert profiles" ON public.expert_profiles;

-- Keep "Companies can view expert profiles via active application" (already scoped)
-- Keep "Experts can view/create/update their own profile"
-- Keep admin access via other policies

-- 2. job_offers: Experts should only see published/active offers, not all
DROP POLICY IF EXISTS "Companies can view their own offers" ON public.job_offers;

CREATE POLICY "Companies and admins can view their own offers"
ON public.job_offers
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Experts can view active offers only"
ON public.job_offers
FOR SELECT
USING (
  has_role(auth.uid(), 'expert'::app_role)
  AND status = 'active'
);

-- 3. candidates: Companies can only see candidates who applied to their jobs
DROP POLICY IF EXISTS "Companies can view all candidates" ON public.candidates;
DROP POLICY IF EXISTS "Experts can view their own candidate profile" ON public.candidates;

CREATE POLICY "Companies can view candidates for their jobs"
ON public.candidates
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'company'::app_role)
    AND id IN (
      SELECT ja.expert_id FROM job_applications ja
      JOIN job_offers jo ON jo.id = ja.job_offer_id
      WHERE jo.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can view their own candidate profile"
ON public.candidates
FOR SELECT
USING (auth.uid() = user_id);
