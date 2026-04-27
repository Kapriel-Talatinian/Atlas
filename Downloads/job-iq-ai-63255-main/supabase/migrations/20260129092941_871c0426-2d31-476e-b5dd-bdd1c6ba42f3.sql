-- Add new columns to rlhf_feedback for enhanced schema
ALTER TABLE public.rlhf_feedback 
ADD COLUMN IF NOT EXISTS time_spent_seconds integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attention_check_passed boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS device_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS user_agent_info text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS data_retention_policy text DEFAULT 'standard_12_months',
ADD COLUMN IF NOT EXISTS job_context jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS generator text DEFAULT 'lovable_ai',
ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS content_hash text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS export_batch_id text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.rlhf_feedback.job_context IS 'Extended job context: stack, responsibilities, industry, remote, etc.';
COMMENT ON COLUMN public.rlhf_feedback.time_spent_seconds IS 'Time spent by annotator on this feedback task';
COMMENT ON COLUMN public.rlhf_feedback.content_hash IS 'SHA256 hash of the AI output for integrity verification';
COMMENT ON COLUMN public.rlhf_feedback.data_retention_policy IS 'Data retention policy: standard_12_months, extended_36_months, permanent';