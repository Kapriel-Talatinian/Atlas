-- Fix notifications INSERT policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Fix rlhf_disagreements UPDATE policy
DROP POLICY IF EXISTS "Seniors can resolve" ON public.rlhf_disagreements;
CREATE POLICY "Seniors can resolve disagreements" ON public.rlhf_disagreements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM annotator_profiles ap
      JOIN expert_profiles ep ON ep.id = ap.expert_id
      WHERE ep.user_id = auth.uid()
      AND ap.tier = 'senior'
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );
