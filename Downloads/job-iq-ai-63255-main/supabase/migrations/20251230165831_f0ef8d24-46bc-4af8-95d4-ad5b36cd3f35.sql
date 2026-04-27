-- Enable realtime for messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Enable realtime for job_applications table
ALTER TABLE public.job_applications REPLICA IDENTITY FULL;

-- Enable realtime for job_offers table  
ALTER TABLE public.job_offers REPLICA IDENTITY FULL;

-- Add tables to realtime publication (ignore if already exists)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_offers;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;