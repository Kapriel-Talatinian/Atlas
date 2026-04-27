
-- ============================================================================
-- STEF — KRIPPENDORFF'S ALPHA TABLES & FUNCTIONS
-- ============================================================================

-- Tables
CREATE TABLE IF NOT EXISTS public.alpha_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_size INT NOT NULL,
  mean_alpha FLOAT NOT NULL,
  dimension_alphas JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alpha_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  overall_alpha FLOAT NOT NULL,
  dimension_alphas JSONB NOT NULL,
  flag_human_review BOOLEAN DEFAULT false,
  flag_reasons JSONB,
  computed_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_alpha_task UNIQUE (task_id)
);

CREATE TABLE IF NOT EXISTS public.drift_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mean_alpha_current FLOAT,
  mean_alpha_previous FLOAT,
  drifting_dimensions TEXT[],
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alpha_history_date ON public.alpha_history(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_alpha_reports_task ON public.alpha_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_alpha_reports_flag ON public.alpha_reports(flag_human_review) WHERE flag_human_review = true;
CREATE INDEX IF NOT EXISTS idx_drift_alerts_ack ON public.drift_alerts(acknowledged) WHERE acknowledged = false;

-- RLS
ALTER TABLE public.alpha_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alpha_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drift_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alpha_history" ON public.alpha_history FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage alpha_reports" ON public.alpha_reports FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage drift_alerts" ON public.drift_alerts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Service role access for edge functions
CREATE POLICY "Service can insert alpha_history" ON public.alpha_history FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can insert alpha_reports" ON public.alpha_reports FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can update alpha_reports" ON public.alpha_reports FOR UPDATE TO service_role USING (true);
CREATE POLICY "Service can insert drift_alerts" ON public.drift_alerts FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================================
-- FUNCTION: krippendorff_alpha_scores
-- ============================================================================
CREATE OR REPLACE FUNCTION public.krippendorff_alpha_scores(scores FLOAT[])
RETURNS FLOAT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n_valid INT;
  vals FLOAT[];
  i INT;
  j INT;
  do_val FLOAT := 0;
  de_val FLOAT := 0;
BEGIN
  vals := ARRAY(SELECT unnest(scores) WHERE unnest IS NOT NULL);
  n_valid := array_length(vals, 1);
  IF n_valid IS NULL OR n_valid < 2 THEN RETURN NULL; END IF;

  FOR i IN 1..n_valid LOOP
    FOR j IN (i+1)..n_valid LOOP
      do_val := do_val + (vals[i] - vals[j])^2;
    END LOOP;
  END LOOP;
  do_val := do_val * 2.0 / (n_valid * (n_valid - 1));

  de_val := do_val; -- For single-item with interval metric, De = Do baseline
  -- Proper De from marginal distribution
  de_val := 0;
  FOR i IN 1..n_valid LOOP
    FOR j IN (i+1)..n_valid LOOP
      de_val := de_val + (vals[i] - vals[j])^2;
    END LOOP;
  END LOOP;
  de_val := de_val * 2.0 / (n_valid * (n_valid - 1));

  IF de_val = 0 THEN RETURN 1.0; END IF;
  RETURN ROUND((1.0 - (do_val / de_val))::numeric, 4);
END;
$$;

-- ============================================================================
-- FUNCTION: compute_task_alpha
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_task_alpha(p_task_id UUID)
RETURNS TABLE (dimension TEXT, alpha_score FLOAT, n_annotators INT, interpretation TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  dims TEXT[] := ARRAY['correctness','security','code_quality','reasoning_depth','edge_case_handling','documentation_quality','performance_awareness','error_handling','communication_clarity'];
  dim TEXT;
  scores_arr FLOAT[];
  alpha_val FLOAT;
  n_ann INT;
BEGIN
  FOREACH dim IN ARRAY dims LOOP
    SELECT array_agg((a.value->>'dimensions')::jsonb->>dim)::float[], count(*)
    INTO scores_arr, n_ann
    FROM public.annotations a
    WHERE a.item_id = p_task_id;

    IF n_ann >= 2 THEN
      alpha_val := public.krippendorff_alpha_scores(scores_arr);
    ELSE
      alpha_val := NULL;
    END IF;

    dimension := dim;
    alpha_score := alpha_val;
    n_annotators := n_ann;
    interpretation := CASE
      WHEN alpha_val IS NULL THEN 'insufficient_data'
      WHEN alpha_val >= 0.80 THEN 'reliable'
      WHEN alpha_val >= 0.67 THEN 'acceptable'
      ELSE 'unreliable'
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================================
-- FUNCTION: compute_batch_alpha
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_batch_alpha(p_limit INT DEFAULT 100)
RETURNS TABLE (dimension TEXT, alpha_score FLOAT, n_items INT, interpretation TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  dims TEXT[] := ARRAY['correctness','security','code_quality','reasoning_depth','edge_case_handling','documentation_quality','performance_awareness','error_handling','communication_clarity'];
  dim TEXT;
  alpha_val FLOAT;
  item_count INT;
BEGIN
  FOREACH dim IN ARRAY dims LOOP
    WITH recent_tasks AS (
      SELECT DISTINCT ai.id as task_id
      FROM public.annotation_items ai
      JOIN public.annotations a ON a.item_id = ai.id
      ORDER BY ai.id DESC
      LIMIT p_limit
    ),
    task_alphas AS (
      SELECT rt.task_id,
        public.krippendorff_alpha_scores(
          array_agg(((a.value->>'dimensions')::jsonb->>dim)::float ORDER BY a.annotator_id)
        ) as task_alpha
      FROM recent_tasks rt
      JOIN public.annotations a ON a.item_id = rt.task_id
      GROUP BY rt.task_id
      HAVING count(*) >= 2
    )
    SELECT avg(task_alpha), count(*)
    INTO alpha_val, item_count
    FROM task_alphas WHERE task_alpha IS NOT NULL;

    dimension := dim;
    alpha_score := ROUND(alpha_val::numeric, 4);
    n_items := COALESCE(item_count, 0);
    interpretation := CASE
      WHEN alpha_val IS NULL THEN 'insufficient_data'
      WHEN alpha_val >= 0.80 THEN 'reliable'
      WHEN alpha_val >= 0.67 THEN 'acceptable'
      ELSE 'unreliable'
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================================
-- FUNCTION: detect_alpha_drift
-- ============================================================================
CREATE OR REPLACE FUNCTION public.detect_alpha_drift()
RETURNS TABLE (dimension TEXT, current_alpha FLOAT, previous_alpha FLOAT, delta FLOAT, is_drifting BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_record RECORD;
  previous_record RECORD;
  dim TEXT;
  dims TEXT[] := ARRAY['correctness','security','code_quality','reasoning_depth','edge_case_handling','documentation_quality','performance_awareness','error_handling','communication_clarity'];
  cur_val FLOAT;
  prev_val FLOAT;
BEGIN
  SELECT * INTO current_record FROM public.alpha_history ORDER BY computed_at DESC LIMIT 1;
  SELECT * INTO previous_record FROM public.alpha_history ORDER BY computed_at DESC OFFSET 1 LIMIT 1;
  IF current_record IS NULL OR previous_record IS NULL THEN RETURN; END IF;

  FOREACH dim IN ARRAY dims LOOP
    cur_val := (current_record.dimension_alphas->dim->>'alpha')::float;
    prev_val := (previous_record.dimension_alphas->dim->>'alpha')::float;
    dimension := dim;
    current_alpha := ROUND(COALESCE(cur_val, 0)::numeric, 4);
    previous_alpha := ROUND(COALESCE(prev_val, 0)::numeric, 4);
    delta := ROUND(COALESCE(cur_val - prev_val, 0)::numeric, 4);
    is_drifting := COALESCE(cur_val - prev_val < -0.05, false);
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================================
-- FUNCTION: dataset_quality_report
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dataset_quality_report(p_project_id UUID)
RETURNS TABLE (metric_name TEXT, metric_value FLOAT, detail TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_items INT;
  auto_validated INT;
  human_reviewed INT;
  mean_alpha FLOAT;
  reliable_pct FLOAT;
BEGIN
  SELECT count(*) INTO total_items FROM public.annotation_items WHERE project_id = p_project_id;

  SELECT count(*) INTO auto_validated
  FROM public.alpha_reports ar
  JOIN public.annotation_items ai ON ai.id = ar.task_id
  WHERE ai.project_id = p_project_id AND ar.flag_human_review = false;

  SELECT count(*) INTO human_reviewed
  FROM public.human_review_queue hrq
  WHERE hrq.status = 'completed';

  SELECT avg(ar.overall_alpha) INTO mean_alpha
  FROM public.alpha_reports ar
  JOIN public.annotation_items ai ON ai.id = ar.task_id
  WHERE ai.project_id = p_project_id;

  SELECT count(*) FILTER (WHERE ar.overall_alpha >= 0.80)::float / NULLIF(count(*), 0) * 100
  INTO reliable_pct
  FROM public.alpha_reports ar
  JOIN public.annotation_items ai ON ai.id = ar.task_id
  WHERE ai.project_id = p_project_id;

  metric_name := 'total_items'; metric_value := total_items; detail := 'Nombre total d items annotés'; RETURN NEXT;
  metric_name := 'auto_validated'; metric_value := auto_validated; detail := 'Items auto-validés (α >= 0.80)'; RETURN NEXT;
  metric_name := 'human_reviewed'; metric_value := human_reviewed; detail := 'Items vérifiés par un humain'; RETURN NEXT;
  metric_name := 'mean_krippendorff_alpha'; metric_value := ROUND(mean_alpha::numeric, 4); detail := 'Alpha moyen du dataset'; RETURN NEXT;
  metric_name := 'reliable_percentage'; metric_value := ROUND(reliable_pct::numeric, 2); detail := 'Pourcentage d items avec α >= 0.80'; RETURN NEXT;
END;
$$;

-- ============================================================================
-- VIEW: annotation quality dashboard
-- ============================================================================
CREATE OR REPLACE VIEW public.v_annotation_quality_dashboard AS
SELECT
  ai.project_id,
  count(DISTINCT ai.id) as total_items,
  count(DISTINCT ar.task_id) as items_with_alpha,
  ROUND(avg(ar.overall_alpha)::numeric, 4) as mean_alpha,
  ROUND(min(ar.overall_alpha)::numeric, 4) as min_alpha,
  ROUND(max(ar.overall_alpha)::numeric, 4) as max_alpha,
  count(*) FILTER (WHERE ar.overall_alpha >= 0.80) as reliable_count,
  count(*) FILTER (WHERE ar.overall_alpha >= 0.67 AND ar.overall_alpha < 0.80) as acceptable_count,
  count(*) FILTER (WHERE ar.overall_alpha < 0.67) as unreliable_count,
  count(*) FILTER (WHERE ar.flag_human_review = true) as flagged_for_review,
  ROUND(
    (count(*) FILTER (WHERE ar.overall_alpha >= 0.80))::numeric /
    NULLIF(count(DISTINCT ar.task_id), 0) * 100, 2
  ) as reliability_percentage
FROM public.annotation_items ai
LEFT JOIN public.alpha_reports ar ON ar.task_id = ai.id
GROUP BY ai.project_id;

-- ============================================================================
-- TRIGGER: Auto-compute alpha after annotation insert
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_compute_alpha()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ann_count INT;
  alpha_row RECORD;
  overall FLOAT;
  dim_alphas JSONB := '{}'::jsonb;
  has_unreliable BOOLEAN := false;
  unreliable_dims TEXT[] := '{}';
BEGIN
  SELECT count(*) INTO ann_count FROM public.annotations WHERE item_id = NEW.item_id;

  IF ann_count >= 2 THEN
    FOR alpha_row IN SELECT * FROM public.compute_task_alpha(NEW.item_id) LOOP
      dim_alphas := dim_alphas || jsonb_build_object(
        alpha_row.dimension,
        jsonb_build_object('alpha', alpha_row.alpha_score, 'interpretation', alpha_row.interpretation)
      );
      IF alpha_row.interpretation = 'unreliable' THEN
        has_unreliable := true;
        unreliable_dims := array_append(unreliable_dims, alpha_row.dimension || ': unreliable');
      END IF;
    END LOOP;

    SELECT avg(alpha_score) INTO overall FROM public.compute_task_alpha(NEW.item_id) WHERE alpha_score IS NOT NULL;

    INSERT INTO public.alpha_reports (task_id, overall_alpha, dimension_alphas, flag_human_review, flag_reasons)
    VALUES (NEW.item_id, COALESCE(overall, 0), dim_alphas, has_unreliable, to_jsonb(unreliable_dims))
    ON CONFLICT ON CONSTRAINT unique_alpha_task
    DO UPDATE SET
      overall_alpha = EXCLUDED.overall_alpha,
      dimension_alphas = EXCLUDED.dimension_alphas,
      flag_human_review = EXCLUDED.flag_human_review,
      flag_reasons = EXCLUDED.flag_reasons,
      computed_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_alpha ON public.annotations;
CREATE TRIGGER trg_compute_alpha
  AFTER INSERT ON public.annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compute_alpha();
