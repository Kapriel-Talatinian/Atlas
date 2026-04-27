-- Remove the foreign key constraint on candidate_id since we're using expert_id
ALTER TABLE public.test_submissions DROP CONSTRAINT IF EXISTS test_submissions_candidate_id_fkey;

-- Add expert_id column if it doesn't exist  
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_submissions' AND column_name = 'expert_id') THEN
    ALTER TABLE public.test_submissions ADD COLUMN expert_id uuid REFERENCES public.expert_profiles(id);
  END IF;
END $$;

-- Add job_offer_id reference to technical_tests
ALTER TABLE public.technical_tests DROP CONSTRAINT IF EXISTS technical_tests_job_offer_id_fkey;
ALTER TABLE public.technical_tests ADD CONSTRAINT technical_tests_job_offer_id_fkey 
  FOREIGN KEY (job_offer_id) REFERENCES public.job_offers(id) ON DELETE SET NULL;