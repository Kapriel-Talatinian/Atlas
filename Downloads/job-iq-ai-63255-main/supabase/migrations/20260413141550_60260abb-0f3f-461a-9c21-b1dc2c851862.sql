CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_transactions_task_id_unique
ON public.expert_transactions(task_id)
WHERE task_id IS NOT NULL;