
-- ============================================================
-- ANNOTATION PLATFORM — Database Schema
-- ============================================================

-- Enums
CREATE TYPE public.annotation_type AS ENUM (
  'classification', 'ranking', 'rating', 'span_annotation',
  'text_generation', 'comparison', 'extraction', 'validation',
  'red_teaming', 'conversation_rating'
);

CREATE TYPE public.annotation_project_status AS ENUM (
  'draft', 'guidelines_review', 'pilot', 'active', 'paused', 'completed', 'archived'
);

CREATE TYPE public.annotation_item_status AS ENUM (
  'queued', 'assigned', 'in_progress', 'submitted', 'in_review',
  'adjudication', 'completed', 'rejected', 'auto_annotated'
);

CREATE TYPE public.annotator_tier_level AS ENUM (
  'junior', 'standard', 'senior', 'expert', 'adjudicator'
);

CREATE TYPE public.annotator_status_type AS ENUM (
  'onboarding', 'active', 'probation', 'suspended', 'inactive'
);

CREATE TYPE public.assignment_status AS ENUM (
  'pending', 'accepted', 'in_progress', 'completed', 'abandoned', 'expired'
);

-- ─── Annotation Projects ───────────────────────────────────
CREATE TABLE public.annotation_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type public.annotation_type NOT NULL DEFAULT 'classification',
  complexity_level SMALLINT NOT NULL DEFAULT 1 CHECK (complexity_level BETWEEN 1 AND 3),
  domain TEXT NOT NULL DEFAULT 'general',
  languages TEXT[] NOT NULL DEFAULT ARRAY['fr'],
  guidelines JSONB NOT NULL DEFAULT '{}',
  taxonomy JSONB,
  annotation_schema JSONB,
  workflow JSONB NOT NULL DEFAULT '{"annotations_per_item":1,"adjudication_enabled":false,"auto_assign":true,"require_justification":false,"allow_skip":false,"max_items_per_session":100,"forced_break_interval_minutes":60}',
  quality_config JSONB NOT NULL DEFAULT '{"annotations_per_item":1,"adjudication_threshold":0.7,"gold_standard_rate":0.05,"gold_failure_action":"warn","qa_review_rate":0.1,"target_iaa":0.8,"target_accuracy":0.85,"drift_check_interval":200,"drift_threshold":0.1,"escalation_rules":[]}',
  automation_config JSONB NOT NULL DEFAULT '{"enabled":false,"strategy":"assist_only","model":{"provider":"lovable_ai","model_id":"google/gemini-2.5-flash"},"confidence_threshold":0.95,"human_review_sample_rate":0.05,"max_cost_per_item":0.1,"max_total_budget":1000,"fallback_to_human":true,"max_retries":2,"pre_annotation_visible":false}',
  total_items INTEGER NOT NULL DEFAULT 0,
  target_completion_date TIMESTAMPTZ,
  priority_level TEXT NOT NULL DEFAULT 'standard',
  pricing_model JSONB NOT NULL DEFAULT '{"type":"per_item","base_rate":0.5,"complexity_multipliers":{},"rush_surcharge":0}',
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  status public.annotation_project_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.annotation_projects ENABLE ROW LEVEL SECURITY;

-- ─── Annotation Batches ────────────────────────────────────
CREATE TABLE public.annotation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.annotation_batches ENABLE ROW LEVEL SECURITY;

-- ─── Annotation Items ──────────────────────────────────────
CREATE TABLE public.annotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.annotation_batches(id) ON DELETE SET NULL,
  content JSONB NOT NULL DEFAULT '{}',
  status public.annotation_item_status NOT NULL DEFAULT 'queued',
  complexity_level SMALLINT NOT NULL DEFAULT 1,
  is_gold_standard BOOLEAN NOT NULL DEFAULT false,
  is_calibration BOOLEAN NOT NULL DEFAULT false,
  gold_annotation JSONB,
  auto_annotation JSONB,
  final_annotation_id UUID,
  processing_time INTEGER,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotation_items_project ON public.annotation_items(project_id);
CREATE INDEX idx_annotation_items_status ON public.annotation_items(status);
CREATE INDEX idx_annotation_items_batch ON public.annotation_items(batch_id);

ALTER TABLE public.annotation_items ENABLE ROW LEVEL SECURITY;

-- ─── Annotations ───────────────────────────────────────────
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.annotation_items(id) ON DELETE CASCADE,
  annotator_id UUID NOT NULL REFERENCES public.annotator_profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  value JSONB NOT NULL DEFAULT '{}',
  time_spent INTEGER NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL DEFAULT 'medium',
  comment TEXT,
  flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  agrees_with_gold BOOLEAN,
  agreement_with_others NUMERIC,
  guidelines_version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotations_item ON public.annotations(item_id);
CREATE INDEX idx_annotations_annotator ON public.annotations(annotator_id);
CREATE INDEX idx_annotations_project ON public.annotations(project_id);

ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

-- ─── Item Assignments ──────────────────────────────────────
CREATE TABLE public.item_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.annotation_items(id) ON DELETE CASCADE,
  annotator_id UUID NOT NULL REFERENCES public.annotator_profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  status public.assignment_status NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_annotator ON public.item_assignments(annotator_id);
CREATE INDEX idx_assignments_item ON public.item_assignments(item_id);

ALTER TABLE public.item_assignments ENABLE ROW LEVEL SECURITY;

-- ─── Adjudications ─────────────────────────────────────────
CREATE TABLE public.adjudications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.annotation_items(id) ON DELETE CASCADE,
  adjudicator_id UUID NOT NULL REFERENCES public.annotator_profiles(id) ON DELETE CASCADE,
  original_annotation_ids UUID[] NOT NULL DEFAULT '{}',
  final_value JSONB NOT NULL DEFAULT '{}',
  method TEXT NOT NULL DEFAULT 'adjudicator_decision',
  justification TEXT NOT NULL DEFAULT '',
  confidence NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.adjudications ENABLE ROW LEVEL SECURITY;

-- ─── Project Onboarding ────────────────────────────────────
CREATE TABLE public.project_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  annotator_id UUID NOT NULL REFERENCES public.annotator_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'reading_guidelines',
  quiz_score NUMERIC,
  calibration_score NUMERIC,
  probation_accuracy NUMERIC,
  probation_items_reviewed INTEGER NOT NULL DEFAULT 0,
  guidelines_version TEXT NOT NULL DEFAULT '1.0',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  certified_at TIMESTAMPTZ,
  UNIQUE(project_id, annotator_id)
);

ALTER TABLE public.project_onboarding ENABLE ROW LEVEL SECURITY;

-- ─── Quality Reports ───────────────────────────────────────
CREATE TABLE public.annotation_quality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'iaa',
  metrics JSONB NOT NULL DEFAULT '{}',
  interpretation TEXT,
  sample_size INTEGER NOT NULL DEFAULT 0,
  drifted BOOLEAN NOT NULL DEFAULT false,
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.annotation_quality_reports ENABLE ROW LEVEL SECURITY;

-- ─── Annotation Alerts ─────────────────────────────────────
CREATE TABLE public.annotation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  action_taken TEXT,
  annotator_id UUID REFERENCES public.annotator_profiles(id),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.annotation_alerts ENABLE ROW LEVEL SECURITY;

-- ─── Export Records ────────────────────────────────────────
CREATE TABLE public.annotation_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.annotation_projects(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'jsonl',
  total_items INTEGER NOT NULL DEFAULT 0,
  human_annotated INTEGER NOT NULL DEFAULT 0,
  auto_annotated INTEGER NOT NULL DEFAULT 0,
  adjudicated INTEGER NOT NULL DEFAULT 0,
  quality_report JSONB NOT NULL DEFAULT '{}',
  delivery_report JSONB NOT NULL DEFAULT '{}',
  file_url TEXT,
  exported_by UUID,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.annotation_exports ENABLE ROW LEVEL SECURITY;

-- ─── Add new columns to annotator_profiles ─────────────────
ALTER TABLE public.annotator_profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS annotation_skills JSONB DEFAULT '{"domains":[],"task_types":[],"max_complexity":1,"specializations":[]}',
  ADD COLUMN IF NOT EXISTS overall_accuracy NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inter_annotator_agreement NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consistency_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS throughput_per_hour NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flag_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS abandon_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS on_time_rate NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS quality_trend TEXT DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS max_concurrent_items INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS hours_per_week INTEGER DEFAULT 40;

-- ─── RLS Policies ──────────────────────────────────────────

-- Admin can manage all annotation projects
CREATE POLICY "admin_manage_annotation_projects" ON public.annotation_projects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Annotators can view active projects they're onboarded to
CREATE POLICY "annotators_view_active_projects" ON public.annotation_projects
  FOR SELECT TO authenticated
  USING (
    status = 'active' AND EXISTS (
      SELECT 1 FROM public.project_onboarding po
      JOIN public.annotator_profiles ap ON ap.id = po.annotator_id
      WHERE po.project_id = annotation_projects.id
        AND ap.expert_id = (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid() LIMIT 1)
        AND po.status = 'certified'
    )
  );

-- Admin manages batches
CREATE POLICY "admin_manage_batches" ON public.annotation_batches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Annotators see assigned items
CREATE POLICY "annotators_view_assigned_items" ON public.annotation_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.item_assignments ia
      JOIN public.annotator_profiles ap ON ap.id = ia.annotator_id
      WHERE ia.item_id = annotation_items.id
        AND ap.expert_id = (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- Admin manages items
CREATE POLICY "admin_manage_items" ON public.annotation_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Annotators can create and view their own annotations
CREATE POLICY "annotators_manage_own_annotations" ON public.annotations
  FOR ALL TO authenticated
  USING (
    annotator_id IN (
      SELECT ap.id FROM public.annotator_profiles ap
      JOIN public.expert_profiles ep ON ep.id = ap.expert_id
      WHERE ep.user_id = auth.uid()
    )
  )
  WITH CHECK (
    annotator_id IN (
      SELECT ap.id FROM public.annotator_profiles ap
      JOIN public.expert_profiles ep ON ep.id = ap.expert_id
      WHERE ep.user_id = auth.uid()
    )
  );

-- Admin manages all annotations
CREATE POLICY "admin_manage_annotations" ON public.annotations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Assignments visible to assigned annotator
CREATE POLICY "annotators_view_assignments" ON public.item_assignments
  FOR SELECT TO authenticated
  USING (
    annotator_id IN (
      SELECT ap.id FROM public.annotator_profiles ap
      JOIN public.expert_profiles ep ON ep.id = ap.expert_id
      WHERE ep.user_id = auth.uid()
    )
  );

-- Admin manages assignments
CREATE POLICY "admin_manage_assignments" ON public.item_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin-only for adjudications, quality reports, alerts, exports, onboarding
CREATE POLICY "admin_manage_adjudications" ON public.adjudications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_manage_quality_reports" ON public.annotation_quality_reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_manage_alerts" ON public.annotation_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_manage_exports" ON public.annotation_exports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Onboarding: annotators see their own, admin sees all
CREATE POLICY "annotators_view_own_onboarding" ON public.project_onboarding
  FOR SELECT TO authenticated
  USING (
    annotator_id IN (
      SELECT ap.id FROM public.annotator_profiles ap
      JOIN public.expert_profiles ep ON ep.id = ap.expert_id
      WHERE ep.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_manage_onboarding" ON public.project_onboarding
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_annotation_projects_updated_at
  BEFORE UPDATE ON public.annotation_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotation_items_updated_at
  BEFORE UPDATE ON public.annotation_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at
  BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotation_batches_updated_at
  BEFORE UPDATE ON public.annotation_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
