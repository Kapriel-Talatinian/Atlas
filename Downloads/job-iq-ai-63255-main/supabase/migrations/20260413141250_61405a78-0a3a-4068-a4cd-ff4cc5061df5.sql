INSERT INTO public.annotation_payments (
  annotator_id,
  task_id,
  base_amount,
  status,
  time_spent_seconds
)
SELECT
  t.assigned_annotator_id,
  t.id,
  CASE t.domain
    WHEN 'medical' THEN CASE WHEN t.complexity_level IN ('senior', 'lead') THEN 1.875 ELSE 1.50 END
    WHEN 'legal' THEN CASE WHEN t.complexity_level IN ('senior', 'lead') THEN 1.50 ELSE 1.20 END
    WHEN 'finance' THEN CASE WHEN t.complexity_level IN ('senior', 'lead') THEN 1.50 ELSE 1.20 END
    WHEN 'code' THEN CASE WHEN t.complexity_level IN ('senior', 'lead') THEN 1.25 ELSE 1.00 END
    ELSE 1.00
  END,
  'pending',
  EXTRACT(EPOCH FROM (t.completed_at - t.assigned_at))::INT
FROM public.annotation_tasks t
WHERE t.status = 'completed'
  AND t.assigned_annotator_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.annotation_payments ap WHERE ap.task_id = t.id
  );