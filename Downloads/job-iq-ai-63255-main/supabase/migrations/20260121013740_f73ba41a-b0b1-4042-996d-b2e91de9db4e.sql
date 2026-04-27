-- Add expert_profile_snapshot column to capture complete expert data at feedback time
ALTER TABLE public.rlhf_feedback 
ADD COLUMN expert_profile_snapshot JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN public.rlhf_feedback.expert_profile_snapshot IS 'Complete snapshot of expert profile data at time of feedback submission for rich RLHF context';