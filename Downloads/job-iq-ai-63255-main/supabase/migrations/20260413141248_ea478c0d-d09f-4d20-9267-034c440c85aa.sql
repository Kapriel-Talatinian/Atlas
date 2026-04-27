CREATE OR REPLACE FUNCTION public.auto_create_annotation_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base_amount NUMERIC := 1.00;
  v_project_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    v_project_id := (NEW.task_content->>'project_id')::UUID;

    v_base_amount := CASE NEW.domain
      WHEN 'medical' THEN 1.50
      WHEN 'legal' THEN 1.20
      WHEN 'finance' THEN 1.20
      WHEN 'code' THEN 1.00
      ELSE 1.00
    END;

    IF NEW.complexity_level IN ('senior', 'lead') THEN
      v_base_amount := v_base_amount * 1.25;
    END IF;

    INSERT INTO public.annotation_payments (
      annotator_id,
      task_id,
      base_amount,
      status,
      time_spent_seconds
    ) VALUES (
      NEW.assigned_annotator_id,
      NEW.id,
      v_base_amount,
      'pending',
      EXTRACT(EPOCH FROM (NEW.completed_at - NEW.assigned_at))::INT
    )
    ON CONFLICT (task_id) DO UPDATE
    SET annotator_id = EXCLUDED.annotator_id,
        base_amount = EXCLUDED.base_amount,
        status = EXCLUDED.status,
        time_spent_seconds = EXCLUDED.time_spent_seconds;

    UPDATE public.annotator_profiles
    SET total_annotations = COALESCE(total_annotations, 0) + 1
    WHERE id = NEW.assigned_annotator_id;

    IF v_project_id IS NOT NULL THEN
      UPDATE public.annotation_projects
      SET completed_tasks = COALESCE(completed_tasks, 0) + 1,
          updated_at = now()
      WHERE id = v_project_id;
    END IF;

    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      SELECT ep.user_id,
        'Tâche validée — +' || v_base_amount || '$',
        'Votre annotation en ' || NEW.domain || ' a été créditée.',
        'success',
        '/expert/tasks'
      FROM public.annotator_profiles ap
      JOIN public.expert_profiles ep ON ep.id = ap.expert_id
      WHERE ap.id = NEW.assigned_annotator_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;