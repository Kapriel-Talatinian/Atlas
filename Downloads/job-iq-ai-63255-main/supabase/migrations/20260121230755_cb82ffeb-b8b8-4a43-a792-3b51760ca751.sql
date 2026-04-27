-- Add gold_task_id to track which gold task was used for calibration
ALTER TABLE public.rlhf_feedback 
ADD COLUMN IF NOT EXISTS gold_task_id uuid REFERENCES public.rlhf_gold_tasks(id);

-- Add second_annotator_id for double annotation
ALTER TABLE public.rlhf_feedback 
ADD COLUMN IF NOT EXISTS second_annotator_id uuid;

-- Add qa_reviewer_id to track who validated
ALTER TABLE public.rlhf_feedback 
ADD COLUMN IF NOT EXISTS qa_reviewer_id uuid;

-- Add qa_reviewed_at timestamp
ALTER TABLE public.rlhf_feedback 
ADD COLUMN IF NOT EXISTS qa_reviewed_at timestamptz;

-- Add qa_notes for reviewer comments
ALTER TABLE public.rlhf_feedback 
ADD COLUMN IF NOT EXISTS qa_notes text;

-- Add reliability_score to annotator_profiles for calibration tracking
ALTER TABLE public.annotator_profiles
ADD COLUMN IF NOT EXISTS reliability_score numeric DEFAULT 1.0;

-- Add gold_tasks_completed count
ALTER TABLE public.annotator_profiles
ADD COLUMN IF NOT EXISTS gold_tasks_completed integer DEFAULT 0;

-- Add gold_tasks_passed count  
ALTER TABLE public.annotator_profiles
ADD COLUMN IF NOT EXISTS gold_tasks_passed integer DEFAULT 0;

-- Create table for pending QA assignments (second annotator queue)
CREATE TABLE IF NOT EXISTS public.rlhf_qa_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_feedback_id uuid REFERENCES public.rlhf_feedback(id) NOT NULL,
  assigned_annotator_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'completed', 'expired')),
  created_at timestamptz DEFAULT now(),
  assigned_at timestamptz,
  completed_at timestamptz,
  UNIQUE(original_feedback_id)
);

-- Enable RLS
ALTER TABLE public.rlhf_qa_queue ENABLE ROW LEVEL SECURITY;

-- Allow admins full access
CREATE POLICY "Admins can manage QA queue" ON public.rlhf_qa_queue
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Allow experts to see their assigned tasks
CREATE POLICY "Annotators can see assigned tasks" ON public.rlhf_qa_queue
FOR SELECT USING (
  assigned_annotator_id IN (
    SELECT id FROM public.annotator_profiles WHERE expert_id IN (
      SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
    )
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_rlhf_qa_queue_status ON public.rlhf_qa_queue(status);
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_qa_status ON public.rlhf_feedback(qa_status);
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_gold_task ON public.rlhf_feedback(gold_task) WHERE gold_task = true;