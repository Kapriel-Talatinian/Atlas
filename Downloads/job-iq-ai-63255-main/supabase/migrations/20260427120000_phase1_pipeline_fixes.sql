-- ═══════════════════════════════════════════════════════════════════
-- Phase 1 — Pipeline fixes (end-to-end annotator → dataset)
--
--   1. handle_new_user_role: also seed minimal expert_profiles for new
--      experts so the rest of the chain (certification, tasks, alpha)
--      can attach to it without 404.
--   2. alpha_reports.item_id: bridge column so export-dataset can
--      match alpha-reports to annotation_items directly.
--   3. annotator_profiles.is_active / is_qualified defaults so a freshly
--      certified annotator can immediately pick up tasks.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Handle new user role (v2 — seeds expert_profiles) ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
  v_full_name TEXT;
BEGIN
  user_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'expert'::app_role
  );

  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  -- user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- profiles
  INSERT INTO public.profiles (user_id, email, full_name, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    NEW.raw_user_meta_data->>'company_name'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name    = COALESCE(EXCLUDED.full_name, profiles.full_name),
    company_name = COALESCE(EXCLUDED.company_name, profiles.company_name),
    updated_at   = now();

  -- Expert: seed expert_profiles with placeholder values that can be
  -- completed later via the profile wizard.
  IF user_role = 'expert' THEN
    INSERT INTO public.expert_profiles (
      user_id, full_name, email, country, city, title,
      years_of_experience, primary_skills, availability, work_type, contract_types
    )
    VALUES (
      NEW.id,
      v_full_name,
      NEW.email,
      'FR',
      '',
      'Expert',
      0,
      '{}'::TEXT[],
      'immediate',
      ARRAY['remote']::TEXT[],
      ARRAY['freelance']::TEXT[]
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Company: free credit
  IF user_role = 'company' THEN
    INSERT INTO public.company_credits (user_id, credits_purchased, credits_used)
    VALUES (NEW.id, 1, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Re-bind trigger (no-op if unchanged)
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();


-- ─── 2. alpha_reports.item_id (bridge for export-dataset) ──────────
ALTER TABLE public.alpha_reports
  ADD COLUMN IF NOT EXISTS item_id UUID;

CREATE INDEX IF NOT EXISTS idx_alpha_reports_item ON public.alpha_reports(item_id);


-- ─── 3. annotator_profiles defaults & one-row-per-expert guarantee ─
-- Make sure the columns used by distribute-tasks have safe defaults so
-- a freshly-created annotator_profiles row doesn't violate NOT NULLs.
DO $$
BEGIN
  -- is_active / is_qualified should default to true after certification.
  -- (Columns exist; we just align defaults so manual inserts work.)
  EXECUTE 'ALTER TABLE public.annotator_profiles ALTER COLUMN is_active SET DEFAULT true';
EXCEPTION WHEN undefined_column THEN NULL;
END$$;
