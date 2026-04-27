-- Allow company users to create their own client record
CREATE POLICY "Companies can create their own client record"
ON public.clients
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow company users to update their own client record
CREATE POLICY "Companies can update their own client record"
ON public.clients
FOR UPDATE
USING (auth.uid() = user_id);