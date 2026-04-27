-- Create platform_metrics_history table for tracking KPIs over time
CREATE TABLE public.platform_metrics_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('cac', 'ltv', 'churn_rate', 'nrr', 'gmv', 'mrr', 'arr', 'expert_count', 'client_count', 'placement_count')),
  metric_value DECIMAL(15,2) NOT NULL,
  segment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create marketing_spend table for CAC calculations
CREATE TABLE public.marketing_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month DATE NOT NULL,
  channel TEXT NOT NULL,
  spend_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  leads_generated INTEGER NOT NULL DEFAULT 0,
  clients_acquired INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_logs table for compliance
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance_documents table
CREATE TABLE public.compliance_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('gdpr_dpa', 'privacy_policy', 'terms', 'security_policy', 'soc2_evidence')),
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.platform_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_metrics_history (admin only)
CREATE POLICY "Admins can view metrics" ON public.platform_metrics_history
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert metrics" ON public.platform_metrics_history
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for marketing_spend (admin only)
CREATE POLICY "Admins can manage marketing spend" ON public.marketing_spend
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_logs (admin only, no delete)
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for compliance_documents (admin only)
CREATE POLICY "Admins can manage compliance docs" ON public.compliance_documents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_metrics_date ON public.platform_metrics_history(metric_date);
CREATE INDEX idx_metrics_type ON public.platform_metrics_history(metric_type);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);

-- Add trigger for compliance_documents updated_at
CREATE TRIGGER update_compliance_documents_updated_at
  BEFORE UPDATE ON public.compliance_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();