
-- Weekly schedule table (separate from expert_availability which is date-based)
CREATE TABLE IF NOT EXISTS public.expert_weekly_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  schedule JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_expert_weekly_schedule ON public.expert_weekly_schedule(expert_id);
ALTER TABLE public.expert_weekly_schedule ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expert_weekly_schedule' AND policyname='expert_weekly_schedule_self') THEN
    EXECUTE 'CREATE POLICY expert_weekly_schedule_self ON public.expert_weekly_schedule FOR ALL USING (expert_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;
