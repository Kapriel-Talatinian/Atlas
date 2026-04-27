
-- Step 1: Create a security definer function to get expert_id for current user
-- This bypasses RLS and prevents recursion
CREATE OR REPLACE FUNCTION public.get_current_expert_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.expert_profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Step 2: Create a security definer function to check company access to expert via application
CREATE OR REPLACE FUNCTION public.company_can_view_expert(p_expert_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_offers jo ON jo.id = ja.job_offer_id
    WHERE ja.expert_id = p_expert_id
      AND jo.user_id = auth.uid()
      AND ja.status IN ('applying', 'reviewing', 'interview', 'accepted', 'offer')
  )
$$;

-- Step 3: Drop the recursive policy on expert_profiles
DROP POLICY IF EXISTS "Companies can view expert profiles via active application" ON public.expert_profiles;

-- Step 4: Recreate it using the security definer function (no recursion)
CREATE POLICY "Companies can view expert profiles via active application"
ON public.expert_profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'company'::app_role) 
  AND public.company_can_view_expert(id)
);
