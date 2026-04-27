ALTER TABLE public.annotation_payments
DROP CONSTRAINT IF EXISTS annotation_payments_task_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_annotation_payments_task_unique
ON public.annotation_payments(task_id);