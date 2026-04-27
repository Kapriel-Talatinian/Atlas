-- Modifier la fonction handle_new_user_role pour donner 1 crédit gratuit aux entreprises
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
BEGIN
  -- Get role from user metadata, default to 'expert'
  user_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'expert'::app_role
  );
  
  -- Insert the user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Insert profile
  INSERT INTO public.profiles (
    user_id,
    email,
    full_name,
    company_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'company_name'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    company_name = COALESCE(EXCLUDED.company_name, profiles.company_name),
    updated_at = now();
  
  -- If user is a company, create company_credits record with 1 free credit
  IF user_role = 'company' THEN
    INSERT INTO public.company_credits (user_id, total_credits, used_credits, available_credits)
    VALUES (NEW.id, 1, 0, 1)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;