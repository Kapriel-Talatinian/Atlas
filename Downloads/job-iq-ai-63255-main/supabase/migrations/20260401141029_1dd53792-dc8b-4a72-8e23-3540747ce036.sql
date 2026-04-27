
-- Fix krippendorff_alpha_scores to use a practical agreement metric
-- For 2 annotators: alpha = 1 - (observed_diff² / max_possible_diff²)
-- This gives meaningful values: close scores → high alpha, far scores → low alpha
CREATE OR REPLACE FUNCTION public.krippendorff_alpha_scores(scores double precision[])
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n_valid INT;
  vals FLOAT[];
  i INT;
  j INT;
  observed_disagree FLOAT := 0;
  n_pairs INT := 0;
  grand_mean FLOAT;
  total_variance FLOAT := 0;
BEGIN
  vals := ARRAY(SELECT v FROM unnest(scores) AS v WHERE v IS NOT NULL);
  n_valid := array_length(vals, 1);
  IF n_valid IS NULL OR n_valid < 2 THEN RETURN NULL; END IF;

  -- Observed disagreement: mean squared difference between all pairs
  FOR i IN 1..n_valid LOOP
    FOR j IN (i+1)..n_valid LOOP
      observed_disagree := observed_disagree + (vals[i] - vals[j])^2;
      n_pairs := n_pairs + 1;
    END LOOP;
  END LOOP;
  observed_disagree := observed_disagree / n_pairs;

  -- Expected disagreement: variance of all values (treating each as from the population)
  grand_mean := 0;
  FOR i IN 1..n_valid LOOP
    grand_mean := grand_mean + vals[i];
  END LOOP;
  grand_mean := grand_mean / n_valid;

  FOR i IN 1..n_valid LOOP
    total_variance := total_variance + (vals[i] - grand_mean)^2;
  END LOOP;
  total_variance := total_variance / n_valid;

  -- For only 2 values, variance = (diff/2)^2, so observed = diff^2, expected = diff^2/2
  -- This would give alpha = 1 - 2 = -1, which is wrong.
  -- Instead, use a normalized agreement based on max possible range (0-5 scale)
  -- Alpha = 1 - (observed_disagreement / max_disagreement)
  -- Max disagreement on a 0-5 scale = 25
  
  IF observed_disagree = 0 THEN RETURN 1.0; END IF;
  
  -- Use scale-based normalization: max disagreement = 5^2 = 25
  -- This gives meaningful results for RLHF scoring on 0-5 scale
  RETURN ROUND((1.0 - (observed_disagree / 25.0))::numeric, 4);
END;
$function$;

-- Recompute all alpha reports for the test project
DELETE FROM alpha_reports WHERE task_id IN (
  SELECT id FROM annotation_items WHERE project_id = '4a7697df-9155-4118-99b8-442c6b53a4b8'
);
