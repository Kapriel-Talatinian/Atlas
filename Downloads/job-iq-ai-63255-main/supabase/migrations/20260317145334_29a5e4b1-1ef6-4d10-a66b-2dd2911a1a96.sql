CREATE POLICY "Experts can delete their own applications"
ON public.job_applications
FOR DELETE
USING (expert_id IN (
  SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
));