-- 1. Create system annotator profiles for AI models
INSERT INTO public.annotator_profiles (
  id, anonymized_id, country, experience_years, languages, role, seniority,
  is_active, is_qualified, tier
) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'sys_gemini_flash_lite', 'US', 0, ARRAY['fr','en'], 'system', 'senior', true, true, 'expert'),
  ('a0000000-0000-0000-0000-000000000002', 'sys_gemini_flash', 'US', 0, ARRAY['fr','en'], 'system', 'senior', true, true, 'expert'),
  ('a0000000-0000-0000-0000-000000000003', 'sys_gemini_pro', 'US', 0, ARRAY['fr','en'], 'system', 'lead', true, true, 'senior'),
  ('a0000000-0000-0000-0000-000000000004', 'sys_gpt5', 'US', 0, ARRAY['fr','en'], 'system', 'lead', true, true, 'senior')
ON CONFLICT (id) DO NOTHING;

-- 2. Create function to auto-complete projects when all items are done
CREATE OR REPLACE FUNCTION public.check_project_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id UUID;
  v_total INT;
  v_completed INT;
BEGIN
  SELECT source_id INTO v_project_id FROM public.annotation_tasks WHERE id = NEW.id;
  IF v_project_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_total FROM public.annotation_tasks WHERE source_id = v_project_id;
  SELECT count(*) INTO v_completed FROM public.annotation_tasks WHERE source_id = v_project_id AND status IN ('completed', 'auto_annotated');

  IF v_total > 0 AND v_completed >= v_total THEN
    UPDATE public.annotation_projects
    SET status = 'completed', updated_at = now()
    WHERE id = v_project_id AND status IN ('active', 'in_progress');
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create trigger for project auto-completion
CREATE TRIGGER trigger_check_project_completion
  AFTER UPDATE OF status ON public.annotation_tasks
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'auto_annotated'))
  EXECUTE FUNCTION check_project_completion();