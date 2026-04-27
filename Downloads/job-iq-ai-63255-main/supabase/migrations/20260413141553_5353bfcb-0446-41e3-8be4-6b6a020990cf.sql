CREATE OR REPLACE FUNCTION public.auto_create_annotation_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base_amount NUMERIC := 1.00;
  v_project_id UUID;
  v_user_id UUID;
  v_expert_id UUID;
  v_existing_payment_id UUID;
  v_existing_transaction_id UUID;
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

    SELECT id INTO v_existing_payment_id
    FROM public.annotation_payments
    WHERE task_id = NEW.id
    LIMIT 1;

    INSERT INTO public.annotation_payments (
      annotator_id,
      task_id,
      base_amount,
      status,
      time_spent_seconds,
      paid_at
    ) VALUES (
      NEW.assigned_annotator_id,
      NEW.id,
      v_base_amount,
      'paid',
      EXTRACT(EPOCH FROM (NEW.completed_at - NEW.assigned_at))::INT,
      now()
    )
    ON CONFLICT (task_id) DO UPDATE
    SET annotator_id = EXCLUDED.annotator_id,
        base_amount = EXCLUDED.base_amount,
        status = EXCLUDED.status,
        time_spent_seconds = EXCLUDED.time_spent_seconds,
        paid_at = COALESCE(public.annotation_payments.paid_at, EXCLUDED.paid_at);

    SELECT ep.id, ep.user_id INTO v_expert_id, v_user_id
    FROM public.annotator_profiles ap
    JOIN public.expert_profiles ep ON ep.id = ap.expert_id
    WHERE ap.id = NEW.assigned_annotator_id
    LIMIT 1;

    SELECT id INTO v_existing_transaction_id
    FROM public.expert_transactions
    WHERE task_id = NEW.id
    LIMIT 1;

    IF v_existing_payment_id IS NULL THEN
      UPDATE public.annotator_profiles
      SET total_annotations = COALESCE(total_annotations, 0) + 1
      WHERE id = NEW.assigned_annotator_id;

      IF v_project_id IS NOT NULL THEN
        UPDATE public.annotation_projects
        SET completed_tasks = COALESCE(completed_tasks, 0) + 1,
            updated_at = now()
        WHERE id = v_project_id;
      END IF;
    END IF;

    IF v_user_id IS NOT NULL AND v_expert_id IS NOT NULL AND v_existing_transaction_id IS NULL THEN
      INSERT INTO public.expert_transactions (
        expert_id,
        user_id,
        amount,
        type,
        status,
        description,
        task_id
      )
      VALUES (
        v_expert_id,
        v_user_id,
        v_base_amount,
        'task_credit',
        'completed',
        'Tâche validée en ' || NEW.domain,
        NEW.id
      )
      ON CONFLICT (task_id) DO NOTHING;

      INSERT INTO public.expert_balances (user_id, available_balance, pending_balance, total_earned)
      VALUES (v_user_id, v_base_amount, 0, v_base_amount)
      ON CONFLICT (user_id) DO UPDATE
      SET available_balance = COALESCE(public.expert_balances.available_balance, 0) + EXCLUDED.available_balance,
          total_earned = COALESCE(public.expert_balances.total_earned, 0) + EXCLUDED.total_earned,
          updated_at = now();

      BEGIN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          v_user_id,
          'Tâche validée — +' || v_base_amount || '$',
          'Votre annotation en ' || NEW.domain || ' a été créditée.',
          'success',
          '/expert/earnings'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;