CREATE POLICY "Annotators can view their own annotation payments"
ON public.annotation_payments
FOR SELECT
TO authenticated
USING (
  annotator_id IN (
    SELECT ap.id
    FROM public.annotator_profiles ap
    JOIN public.expert_profiles ep ON ep.id = ap.expert_id
    WHERE ep.user_id = auth.uid()
  )
);