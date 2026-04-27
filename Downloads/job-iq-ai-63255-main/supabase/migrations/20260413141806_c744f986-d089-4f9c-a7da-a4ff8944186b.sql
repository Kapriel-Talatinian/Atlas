CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_balances_user_id_unique
ON public.expert_balances(user_id);