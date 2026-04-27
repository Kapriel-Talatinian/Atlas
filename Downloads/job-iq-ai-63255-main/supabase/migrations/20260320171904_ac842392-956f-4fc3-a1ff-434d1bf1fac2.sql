-- Admin can view ALL expert profiles
CREATE POLICY "Admins can view all expert profiles"
ON public.expert_profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can manage ALL expert profiles
CREATE POLICY "Admins can manage expert profiles"
ON public.expert_profiles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all user roles (for signup count)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));