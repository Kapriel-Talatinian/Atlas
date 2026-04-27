-- Create ai_feedback table for RLHF-Lite system
CREATE TABLE public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  input_context JSONB NOT NULL,
  ai_output JSONB NOT NULL,
  human_rating INTEGER CHECK (human_rating >= 1 AND human_rating <= 5),
  is_positive BOOLEAN,
  human_correction TEXT,
  user_id UUID,
  expert_id UUID REFERENCES public.expert_profiles(id),
  job_offer_id UUID REFERENCES public.job_offers(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can create feedback" 
ON public.ai_feedback 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own feedback" 
ON public.ai_feedback 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can do everything on feedback" 
ON public.ai_feedback 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient queries
CREATE INDEX idx_ai_feedback_function ON public.ai_feedback(function_name);
CREATE INDEX idx_ai_feedback_rating ON public.ai_feedback(human_rating);
CREATE INDEX idx_ai_feedback_created ON public.ai_feedback(created_at DESC);