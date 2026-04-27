
ALTER TABLE public.annotation_tasks DROP CONSTRAINT annotation_tasks_source_type_check;
ALTER TABLE public.annotation_tasks ADD CONSTRAINT annotation_tasks_source_type_check 
  CHECK (source_type = ANY (ARRAY['test_submission'::text, 'gold_task'::text, 'manual'::text, 'annotation_item'::text, 'project'::text]));

ALTER TABLE public.annotation_tasks DROP CONSTRAINT annotation_tasks_status_check;
ALTER TABLE public.annotation_tasks ADD CONSTRAINT annotation_tasks_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'expired'::text, 'cancelled'::text, 'qa_failed'::text, 'auto_annotated'::text]));
