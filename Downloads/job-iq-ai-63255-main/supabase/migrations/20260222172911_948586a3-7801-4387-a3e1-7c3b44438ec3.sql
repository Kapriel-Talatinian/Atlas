-- 1. audit_logs: restrict INSERT to authenticated users
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2. candidate_access_logs: restrict INSERT to authenticated users
DROP POLICY IF EXISTS "System can insert access logs" ON public.candidate_access_logs;
CREATE POLICY "Authenticated users can insert access logs" ON public.candidate_access_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. test_generation_logs: restrict INSERT to authenticated users
DROP POLICY IF EXISTS "System can insert generation logs" ON public.test_generation_logs;
CREATE POLICY "Authenticated users can insert generation logs" ON public.test_generation_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. rlhf_tier_annotations: restrict INSERT to own annotator profile
DROP POLICY IF EXISTS "Annotators can insert their own" ON public.rlhf_tier_annotations;
CREATE POLICY "Annotators can insert their own annotations" ON public.rlhf_tier_annotations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM annotator_profiles ap
      JOIN expert_profiles ep ON ep.id = ap.expert_id
      WHERE ep.user_id = auth.uid()
      AND ap.anonymized_id = annotator_id
    )
  );
