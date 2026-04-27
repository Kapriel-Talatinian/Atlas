-- Create app_role enum for user types
CREATE TYPE public.app_role AS ENUM ('company', 'expert', 'admin');

-- Create user_roles table with proper security
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create company_credits table for credit management
CREATE TABLE public.company_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_credits INTEGER DEFAULT 0 NOT NULL,
  used_credits INTEGER DEFAULT 0 NOT NULL,
  available_credits INTEGER GENERATED ALWAYS AS (total_credits - used_credits) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on company_credits
ALTER TABLE public.company_credits ENABLE ROW LEVEL SECURITY;

-- Company credits policies
CREATE POLICY "Companies can view their own credits"
ON public.company_credits FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Companies can update their own credits"
ON public.company_credits FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Update trigger for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update trigger for company_credits
CREATE TRIGGER update_company_credits_updated_at
BEFORE UPDATE ON public.company_credits
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to create profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  
  -- Insert role from metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
    
    -- If company, create credits record
    IF NEW.raw_user_meta_data->>'role' = 'company' THEN
      INSERT INTO public.company_credits (user_id, total_credits, used_credits)
      VALUES (NEW.id, 0, 0);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Update job_offers to link to user_id instead of company_id
ALTER TABLE public.job_offers 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for job_offers
DROP POLICY IF EXISTS "Entreprises peuvent créer offres" ON public.job_offers;
DROP POLICY IF EXISTS "Offres publiques visibles" ON public.job_offers;

CREATE POLICY "Companies can create their offers"
ON public.job_offers FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'company') AND auth.uid() = user_id);

CREATE POLICY "Companies can view their own offers"
ON public.job_offers FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'expert') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Companies can update their own offers"
ON public.job_offers FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Companies can delete their own offers"
ON public.job_offers FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update candidates table to link to user_id
ALTER TABLE public.candidates
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS for candidates
DROP POLICY IF EXISTS "Candidats peuvent créer leur profil" ON public.candidates;
DROP POLICY IF EXISTS "Candidats peuvent voir leur propre profil" ON public.candidates;

CREATE POLICY "Experts can create their candidate profile"
ON public.candidates FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'expert') AND auth.uid() = user_id);

CREATE POLICY "Experts can view their own candidate profile"
ON public.candidates FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'company') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Companies can view all candidates"
ON public.candidates FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'company') OR public.has_role(auth.uid(), 'admin'));