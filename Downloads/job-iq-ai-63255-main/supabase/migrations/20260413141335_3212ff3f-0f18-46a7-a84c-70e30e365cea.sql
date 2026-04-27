CREATE POLICY "Experts can view their own transactions"
ON public.expert_transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());