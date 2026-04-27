
-- 1. certifications: "Anyone can verify" was already dropped in the failed migration
-- Verify and ensure it's gone, re-drop if needed
DROP POLICY IF EXISTS "Anyone can verify certificates" ON public.certifications;
DROP POLICY IF EXISTS "Public can verify by certificate_id" ON public.certifications;

-- 2. eor_partners: already fixed in the failed migration (it succeeded before the error)
-- Re-apply idempotently
DROP POLICY IF EXISTS "Anyone can view EOR partners" ON public.eor_partners;
DROP POLICY IF EXISTS "Admins can manage EOR partners" ON public.eor_partners;

CREATE POLICY "Admins can manage EOR partners"
ON public.eor_partners
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. rlhf_tier_annotations: already fixed in failed migration
-- Re-apply idempotently
DROP POLICY IF EXISTS "Annotators can view their own" ON public.rlhf_tier_annotations;
DROP POLICY IF EXISTS "Annotators can view their own annotations" ON public.rlhf_tier_annotations;

CREATE POLICY "Annotators can view their own annotations"
ON public.rlhf_tier_annotations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM annotator_profiles ap
    JOIN expert_profiles ep ON ep.id = ap.expert_id
    WHERE ep.user_id = auth.uid()
    AND ap.anonymized_id = rlhf_tier_annotations.annotator_id
  )
);

-- 4. rlhf_disagreements: fix with correct column names
DROP POLICY IF EXISTS "Anyone can view disagreements" ON public.rlhf_disagreements;
DROP POLICY IF EXISTS "Admins can manage disagreements" ON public.rlhf_disagreements;
DROP POLICY IF EXISTS "Annotators can view their own disagreements" ON public.rlhf_disagreements;

CREATE POLICY "Admins can manage disagreements"
ON public.rlhf_disagreements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Annotators can view their own disagreements"
ON public.rlhf_disagreements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM annotator_profiles ap
    JOIN expert_profiles ep ON ep.id = ap.expert_id
    WHERE ep.user_id = auth.uid()
    AND ap.anonymized_id = rlhf_disagreements.senior_annotator_id
  )
  OR EXISTS (
    SELECT 1 FROM rlhf_tier_annotations rta
    JOIN annotator_profiles ap ON ap.anonymized_id = rta.annotator_id
    JOIN expert_profiles ep ON ep.id = ap.expert_id
    WHERE ep.user_id = auth.uid()
    AND (rta.id = rlhf_disagreements.tier_1_annotation_id OR rta.id = rlhf_disagreements.tier_2_annotation_id)
  )
);
