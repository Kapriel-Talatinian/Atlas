
-- 1. Trigger: auto-create payment when task is completed
CREATE OR REPLACE FUNCTION public.auto_create_annotation_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_base_amount NUMERIC := 1.00;
  v_project_id UUID;
  v_annotator_user_id UUID;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    
    -- Get project_id from task_content
    v_project_id := (NEW.task_content->>'project_id')::UUID;
    
    -- Check domain-based pricing
    v_base_amount := CASE NEW.domain
      WHEN 'medical' THEN 1.50
      WHEN 'legal' THEN 1.20
      WHEN 'finance' THEN 1.20
      WHEN 'code' THEN 1.00
      ELSE 1.00
    END;
    
    -- Bonus for complex tasks
    IF NEW.complexity_level IN ('senior', 'lead') THEN
      v_base_amount := v_base_amount * 1.25;
    END IF;
    
    -- Insert payment record (idempotent: skip if already exists)
    INSERT INTO public.annotation_payments (
      annotator_id,
      task_id,
      base_amount,
      final_amount,
      status,
      time_spent_seconds
    ) VALUES (
      NEW.assigned_annotator_id,
      NEW.id,
      v_base_amount,
      v_base_amount,
      'pending',
      EXTRACT(EPOCH FROM (NEW.completed_at - NEW.assigned_at))::INT
    )
    ON CONFLICT DO NOTHING;
    
    -- Update annotator total_annotations counter
    UPDATE public.annotator_profiles
    SET total_annotations = COALESCE(total_annotations, 0) + 1
    WHERE id = NEW.assigned_annotator_id;
    
    -- Update project completed_tasks counter
    IF v_project_id IS NOT NULL THEN
      UPDATE public.annotation_projects
      SET completed_tasks = COALESCE(completed_tasks, 0) + 1,
          updated_at = now()
      WHERE id = v_project_id;
    END IF;
    
    -- Send notification to annotator
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
      -- Don't fail the whole transaction for a notification
      NULL;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_payment_on_completion ON public.annotation_tasks;
CREATE TRIGGER trg_auto_payment_on_completion
  AFTER UPDATE OF status ON public.annotation_tasks
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.auto_create_annotation_payment();
