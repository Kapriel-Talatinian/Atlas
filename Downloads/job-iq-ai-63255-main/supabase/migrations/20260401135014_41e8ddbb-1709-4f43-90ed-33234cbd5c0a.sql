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
  do_val FLOAT := 0;
  de_val FLOAT := 0;
BEGIN
  vals := ARRAY(SELECT v FROM unnest(scores) AS v WHERE v IS NOT NULL);
  n_valid := array_length(vals, 1);
  IF n_valid IS NULL OR n_valid < 2 THEN RETURN NULL; END IF;

  FOR i IN 1..n_valid LOOP
    FOR j IN (i+1)..n_valid LOOP
      do_val := do_val + (vals[i] - vals[j])^2;
    END LOOP;
  END LOOP;
  do_val := do_val * 2.0 / (n_valid * (n_valid - 1));

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
$function$;