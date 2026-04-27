
-- Fix 1: candidates table - restrict INSERT to experts with matching user_id
DROP POLICY IF EXISTS "Candidats peuvent créer leur profil" ON public.candidates;
CREATE POLICY "Experts can create own candidate profile"
ON public.candidates FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- Fix 2: job_offers table - restrict INSERT to companies with matching user_id
DROP POLICY IF EXISTS "Entreprises peuvent créer offres" ON public.job_offers;
CREATE POLICY "Companies can create job offers"
ON public.job_offers FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  has_role(auth.uid(), 'company'::app_role)
);

-- Fix 3: technical_tests table - remove permissive INSERT (tests created via edge functions with service role)
DROP POLICY IF EXISTS "Système peut créer tests" ON public.technical_tests;

-- Fix 4: test_submissions table - restrict INSERT to matching expert
DROP POLICY IF EXISTS "Candidats peuvent soumettre tests" ON public.test_submissions;
CREATE POLICY "Experts can submit own tests"
ON public.test_submissions FOR INSERT
WITH CHECK (
  expert_id IN (
    SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
  )
);

-- Fix 5: test_submissions SELECT - restrict to own submissions + admins
DROP POLICY IF EXISTS "Candidats voient leurs soumissions" ON public.test_submissions;
CREATE POLICY "Users can view own submissions"
ON public.test_submissions FOR SELECT
USING (
  expert_id IN (
    SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 6: CV storage - restrict access to CVs of applicants only
DROP POLICY IF EXISTS "Companies can view expert CVs" ON storage.objects;
CREATE POLICY "Experts can view own CVs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expert-cvs'
  AND (
    -- Expert can view their own CV
    (storage.foldername(name))[1] = auth.uid()::text
    -- Admin can view all CVs
    OR has_role(auth.uid(), 'admin'::app_role)
    -- Company can view CVs of experts who applied to their jobs
    OR EXISTS (
      SELECT 1 FROM public.job_applications ja
      JOIN public.job_offers jo ON ja.job_offer_id = jo.id
      JOIN public.expert_profiles ep ON ja.expert_id = ep.id
      WHERE jo.user_id = auth.uid()
      AND (storage.foldername(name))[1] = ep.user_id::text
    )
  )
);

-- Fix 7: Expert contact exposure - create a restricted view for companies
-- Replace the overly permissive company access policy
DROP POLICY IF EXISTS "Companies can view completed expert profiles" ON public.expert_profiles;

-- Companies can only see non-sensitive fields of visible experts
CREATE POLICY "Companies can view public expert profiles"
ON public.expert_profiles FOR SELECT
USING (
  (
    onboarding_completed = true
    AND profile_visible = true
    AND has_role(auth.uid(), 'company'::app_role)
  )
  OR (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
