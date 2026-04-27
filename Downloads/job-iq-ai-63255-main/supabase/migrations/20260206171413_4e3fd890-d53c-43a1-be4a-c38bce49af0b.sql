-- 1. Ajouter colonnes qualification et sanctions à annotator_profiles
ALTER TABLE public.annotator_profiles 
ADD COLUMN IF NOT EXISTS qualification_score NUMERIC,
ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS warnings_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS level_demoted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS daily_quota INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS current_daily_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_quota_reset TIMESTAMPTZ DEFAULT now();

-- 2. Créer la table annotation_tasks pour la distribution automatique
CREATE TABLE public.annotation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('test_submission', 'gold_task', 'manual')),
  source_id UUID NOT NULL,
  
  -- Classification
  complexity_level TEXT NOT NULL CHECK (complexity_level IN ('junior', 'mid', 'senior', 'lead')),
  domain TEXT NOT NULL,
  language TEXT DEFAULT 'fr',
  
  -- Assignment
  assigned_annotator_id UUID REFERENCES public.annotator_profiles(id),
  assigned_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'expired', 'cancelled')),
  completed_at TIMESTAMPTZ,
  
  -- AI Triage
  ai_quality_score NUMERIC,
  ai_noise_detected BOOLEAN DEFAULT FALSE,
  ai_triage_notes TEXT,
  
  -- Task content snapshot
  task_content JSONB NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Créer la table annotation_payments pour le système de paiement
CREATE TABLE public.annotation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotator_id UUID NOT NULL REFERENCES public.annotator_profiles(id),
  task_id UUID NOT NULL REFERENCES public.annotation_tasks(id),
  feedback_id UUID REFERENCES public.rlhf_feedback(id),
  
  base_amount NUMERIC NOT NULL DEFAULT 1.00,
  bonus_amount NUMERIC DEFAULT 0,
  penalty_amount NUMERIC DEFAULT 0,
  final_amount NUMERIC GENERATED ALWAYS AS (base_amount + bonus_amount - penalty_amount) STORED,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  paid_at TIMESTAMPTZ,
  
  -- Quality metrics at payment time
  time_spent_seconds INTEGER,
  effort_score NUMERIC,
  agreement_score NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Créer la table annotation_warnings pour tracker les infractions
CREATE TABLE public.annotation_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotator_id UUID NOT NULL REFERENCES public.annotator_profiles(id),
  task_id UUID REFERENCES public.annotation_tasks(id),
  warning_type TEXT NOT NULL CHECK (warning_type IN ('time_too_short', 'comment_too_short', 'low_effort', 'low_coherence', 'repetitive_pattern', 'high_rejection_rate')),
  severity INTEGER NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  details TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE public.annotation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_warnings ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies pour annotation_tasks
CREATE POLICY "Admins can manage all annotation tasks"
ON public.annotation_tasks FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Annotators can view their assigned tasks"
ON public.annotation_tasks FOR SELECT
USING (
  assigned_annotator_id IN (
    SELECT id FROM public.annotator_profiles 
    WHERE expert_id IN (
      SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Annotators can update their assigned tasks"
ON public.annotation_tasks FOR UPDATE
USING (
  assigned_annotator_id IN (
    SELECT id FROM public.annotator_profiles 
    WHERE expert_id IN (
      SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
    )
  )
  AND status IN ('assigned', 'in_progress')
);

-- 7. RLS Policies pour annotation_payments
CREATE POLICY "Admins can manage all payments"
ON public.annotation_payments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Annotators can view their own payments"
ON public.annotation_payments FOR SELECT
USING (
  annotator_id IN (
    SELECT id FROM public.annotator_profiles 
    WHERE expert_id IN (
      SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
    )
  )
);

-- 8. RLS Policies pour annotation_warnings
CREATE POLICY "Admins can manage all warnings"
ON public.annotation_warnings FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Annotators can view their own warnings"
ON public.annotation_warnings FOR SELECT
USING (
  annotator_id IN (
    SELECT id FROM public.annotator_profiles 
    WHERE expert_id IN (
      SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
    )
  )
);

-- 9. Index pour performance
CREATE INDEX idx_annotation_tasks_status ON public.annotation_tasks(status);
CREATE INDEX idx_annotation_tasks_assigned ON public.annotation_tasks(assigned_annotator_id);
CREATE INDEX idx_annotation_tasks_complexity ON public.annotation_tasks(complexity_level);
CREATE INDEX idx_annotation_payments_annotator ON public.annotation_payments(annotator_id);
CREATE INDEX idx_annotation_payments_status ON public.annotation_payments(status);
CREATE INDEX idx_annotation_warnings_annotator ON public.annotation_warnings(annotator_id);

-- 10. Trigger pour updated_at
CREATE TRIGGER update_annotation_tasks_updated_at
  BEFORE UPDATE ON public.annotation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();