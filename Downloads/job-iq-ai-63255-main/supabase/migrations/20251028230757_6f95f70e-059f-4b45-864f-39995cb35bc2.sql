-- Empêcher plusieurs comptes avec le même email pour éviter l'abus de crédits gratuits
-- Créer un index unique sur l'email dans la table profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles(LOWER(email));

-- Créer une fonction pour vérifier les emails similaires (détection d'abus)
CREATE OR REPLACE FUNCTION public.check_email_abuse(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  similar_count integer;
BEGIN
  -- Vérifier les emails très similaires (ex: test+1@gmail.com, test+2@gmail.com)
  SELECT COUNT(*) INTO similar_count
  FROM public.profiles
  WHERE 
    -- Retirer les caractères après + dans les emails Gmail/Outlook
    CASE 
      WHEN LOWER(email) LIKE '%@gmail.com' OR LOWER(email) LIKE '%@googlemail.com' THEN
        SPLIT_PART(LOWER(email), '+', 1) || SPLIT_PART(LOWER(email), '@', 2)
      ELSE
        LOWER(email)
    END = 
    CASE 
      WHEN LOWER(check_email) LIKE '%@gmail.com' OR LOWER(check_email) LIKE '%@googlemail.com' THEN
        SPLIT_PART(LOWER(check_email), '+', 1) || SPLIT_PART(LOWER(check_email), '@', 2)
      ELSE
        LOWER(check_email)
    END;
  
  -- Si plus de 1 compte similaire, c'est suspect
  RETURN similar_count > 0;
END;
$function$;

-- Modifier la fonction handle_new_user_role pour vérifier l'abus
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
  is_abuse boolean;
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
  
  -- If user is a company, create company_credits record
  IF user_role = 'company' THEN
    -- Vérifier si l'email n'est pas abusif
    is_abuse := public.check_email_abuse(NEW.email);
    
    -- Ne donner le crédit gratuit que si pas d'abus détecté
    INSERT INTO public.company_credits (user_id, total_credits, used_credits, available_credits)
    VALUES (
      NEW.id, 
      CASE WHEN is_abuse THEN 0 ELSE 1 END,  -- 0 si abus, 1 sinon
      0, 
      CASE WHEN is_abuse THEN 0 ELSE 1 END   -- 0 si abus, 1 sinon
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;