
ALTER TABLE public.annotation_tasks DROP CONSTRAINT annotation_tasks_status_check;
ALTER TABLE public.annotation_tasks ADD CONSTRAINT annotation_tasks_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'expired'::text, 'cancelled'::text, 'qa_failed'::text, 'auto_annotated'::text, 'in_qa'::text, 'review'::text]));
