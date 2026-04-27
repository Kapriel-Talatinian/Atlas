-- Add unique constraint to prevent duplicate test submissions under high concurrency
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_submissions_unique_expert_test 
ON public.test_submissions (expert_id, test_id) 
WHERE expert_id IS NOT NULL AND test_id IS NOT NULL;

-- Add index on funnel_events for high-volume inserts performance
CREATE INDEX IF NOT EXISTS idx_funnel_events_session 
ON public.funnel_events (session_id) 
WHERE session_id IS NOT NULL;

-- Add index on notifications user_id + type for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_type 
ON public.notifications (user_id, type);

-- Add index on test_consents for faster lookups
CREATE INDEX IF NOT EXISTS idx_test_consents_user_expert 
ON public.test_consents (user_id, expert_id);