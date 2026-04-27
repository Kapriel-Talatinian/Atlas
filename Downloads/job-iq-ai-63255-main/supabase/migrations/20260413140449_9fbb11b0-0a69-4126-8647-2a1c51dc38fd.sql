DROP POLICY "Annotators can update their assigned tasks" ON public.annotation_tasks;

CREATE POLICY "Annotators can update their assigned tasks"
ON public.annotation_tasks
FOR UPDATE
TO authenticated
USING (
  assigned_annotator_id IN (
    SELECT ap.id FROM annotator_profiles ap
    JOIN expert_profiles ep ON ep.id = ap.expert_id
    WHERE ep.user_id = auth.uid()
  )
  AND status IN ('assigned', 'in_progress')
)
WITH CHECK (
  assigned_annotator_id IN (
    SELECT ap.id FROM annotator_profiles ap
    JOIN expert_profiles ep ON ep.id = ap.expert_id
    WHERE ep.user_id = auth.uid()
  )
);