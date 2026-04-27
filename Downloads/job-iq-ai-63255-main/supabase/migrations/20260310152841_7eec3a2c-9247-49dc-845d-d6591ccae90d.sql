
-- 1. Add structured reasoning_steps, chosen/rejected outputs to rlhf_feedback
ALTER TABLE public.rlhf_feedback 
  ADD COLUMN IF NOT EXISTS reasoning_steps jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chosen_output jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rejected_output jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comparison_rationale text DEFAULT NULL;

-- 2. Expand scores jsonb schema documentation (scores is already jsonb, just needs new keys used)
-- No schema change needed - scores jsonb already supports arbitrary keys

-- 3. Create SLA tracking table
CREATE TABLE IF NOT EXISTS public.rlhf_sla_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.annotation_tasks(id) ON DELETE CASCADE,
  feedback_id uuid REFERENCES public.rlhf_feedback(id) ON DELETE SET NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_at timestamp with time zone,
  completed_at timestamp with time zone,
  target_hours integer NOT NULL DEFAULT 72,
  actual_hours numeric GENERATED ALWAYS AS (
    CASE WHEN completed_at IS NOT NULL AND requested_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (completed_at - requested_at)) / 3600.0
      ELSE NULL 
    END
  ) STORED,
  sla_met boolean GENERATED ALWAYS AS (
    CASE WHEN completed_at IS NOT NULL AND requested_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (completed_at - requested_at)) / 3600.0 <= target_hours
      ELSE NULL 
    END
  ) STORED,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on SLA tracking
ALTER TABLE public.rlhf_sla_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage SLA tracking"
  ON public.rlhf_sla_tracking FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Seed platform_stats with RLHF KPIs
INSERT INTO public.platform_stats (stat_key, stat_label, stat_value, display_suffix, display_order, is_visible)
VALUES 
  ('total_annotations', 'Annotations', 0, '+', 1, true),
  ('active_annotators', 'Annotateurs actifs', 0, '', 2, true),
  ('avg_agreement_rate', 'Agreement Rate', 0, '%', 3, true),
  ('datasets_delivered', 'Datasets livrés', 0, '', 4, true)
ON CONFLICT (stat_key) DO NOTHING;
