
-- Function to check if a task has enough annotations and trigger QA
CREATE OR REPLACE FUNCTION public.check_and_trigger_qa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task RECORD;
  v_annotation_count INT;
  v_required INT;
  v_project RECORD;
BEGIN
  -- Get the task info
  SELECT * INTO v_task FROM public.annotation_tasks WHERE id = NEW.task_id;
  IF v_task IS NULL THEN RETURN NEW; END IF;

  -- Count total annotations for this task
  SELECT count(*) INTO v_annotation_count
  FROM public.expert_annotations WHERE task_id = NEW.task_id;

  -- Get project to determine required annotation count
  SELECT ap.* INTO v_project
  FROM public.annotation_projects ap
  WHERE ap.id = v_task.source_id;

  -- Default: 2 annotations required (3 for medical/express)
  v_required := 2;
  IF v_project IS NOT NULL THEN
    v_required := COALESCE((v_project.workflow::jsonb->>'annotations_per_item')::int, 
      CASE WHEN v_project.domain = 'medical' THEN 3 ELSE 2 END);
  END IF;

  -- If we have enough annotations, trigger QA via pg_net
  IF v_annotation_count >= v_required THEN
    -- Call qa-engine edge function
    PERFORM net.http_post(
      url := 'https://iwhwhriielbpkopfoqjp.supabase.co/functions/v1/qa-engine',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3aHdocmlpZWxicGtvcGZvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDUzOTMsImV4cCI6MjA3NzIyMTM5M30.aRcZDoGXiQpCAPLd6KOamNxuluZoSynrtwiHUVGBcU4"}'::jsonb,
      body := jsonb_build_object('action', 'run_qa', 'task_id', NEW.task_id)
    );
    
    -- Mark task as in_qa
    UPDATE public.annotation_tasks
    SET status = 'in_qa'
    WHERE id = NEW.task_id AND status = 'assigned';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on expert_annotations table
DROP TRIGGER IF EXISTS trigger_qa_on_annotation_insert ON public.expert_annotations;
CREATE TRIGGER trigger_qa_on_annotation_insert
  AFTER INSERT ON public.expert_annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_trigger_qa();

-- Also create a function to auto-activate projects when payment is confirmed
CREATE OR REPLACE FUNCTION public.activate_project_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a client_invoice is marked as 'paid', activate the corresponding project
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE public.annotation_projects
    SET status = 'active'
    WHERE id = NEW.project_id AND status IN ('draft', 'pending');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on client_invoices
DROP TRIGGER IF EXISTS trigger_activate_project_on_payment ON public.client_invoices;
CREATE TRIGGER trigger_activate_project_on_payment
  AFTER UPDATE ON public.client_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_project_on_payment();
