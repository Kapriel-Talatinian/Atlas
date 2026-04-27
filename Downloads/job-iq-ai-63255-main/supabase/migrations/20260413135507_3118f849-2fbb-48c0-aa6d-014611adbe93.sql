CREATE POLICY "annotators_view_items_via_tasks"
ON public.annotation_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.annotation_tasks at
    WHERE at.task_content->>'item_id' = annotation_items.id::text
      AND at.assigned_annotator_id IN (
        SELECT ap.id FROM public.annotator_profiles ap
        JOIN public.expert_profiles ep ON ep.id = ap.expert_id
        WHERE ep.user_id = auth.uid()
      )
  )
);