-- Create table for saved/bookmarked jobs
CREATE TABLE public.saved_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  job_offer_id UUID NOT NULL REFERENCES public.job_offers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(expert_id, job_offer_id)
);

-- Enable Row Level Security
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

-- Experts can view their own saved jobs
CREATE POLICY "Experts can view their own saved jobs"
ON public.saved_jobs
FOR SELECT
USING (expert_id IN (
  SELECT id FROM expert_profiles WHERE user_id = auth.uid()
));

-- Experts can save jobs
CREATE POLICY "Experts can save jobs"
ON public.saved_jobs
FOR INSERT
WITH CHECK (expert_id IN (
  SELECT id FROM expert_profiles WHERE user_id = auth.uid()
));

-- Experts can unsave jobs
CREATE POLICY "Experts can unsave jobs"
ON public.saved_jobs
FOR DELETE
USING (expert_id IN (
  SELECT id FROM expert_profiles WHERE user_id = auth.uid()
));