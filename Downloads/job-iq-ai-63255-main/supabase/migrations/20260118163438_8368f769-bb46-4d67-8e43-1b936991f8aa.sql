-- Add KYC fields to expert_profiles
ALTER TABLE public.expert_profiles 
ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS kyc_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS kyc_rejection_reason text,
ADD COLUMN IF NOT EXISTS kyc_documents jsonb DEFAULT '[]'::jsonb;

-- Create contracts table for e-signatures
CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placement_id uuid REFERENCES public.placements(id) ON DELETE CASCADE,
  expert_id uuid NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_type text NOT NULL CHECK (contract_type IN ('expert_agreement', 'client_agreement', 'placement_contract')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'expert_signed', 'client_signed', 'fully_signed', 'expired', 'cancelled')),
  document_url text,
  contract_data jsonb DEFAULT '{}'::jsonb,
  expert_signature_data jsonb,
  expert_signed_at timestamp with time zone,
  client_signature_data jsonb,
  client_signed_at timestamp with time zone,
  sent_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies for contracts
CREATE POLICY "Admins can do everything on contracts"
  ON public.contracts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Experts can view their own contracts"
  ON public.contracts
  FOR SELECT
  USING (expert_id IN (
    SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Experts can update their own contracts for signing"
  ON public.contracts
  FOR UPDATE
  USING (expert_id IN (
    SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()
  ) AND status IN ('sent', 'client_signed'));

CREATE POLICY "Clients can view their own contracts"
  ON public.contracts
  FOR SELECT
  USING (client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "Clients can update their own contracts for signing"
  ON public.contracts
  FOR UPDATE
  USING (client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  ) AND status IN ('sent', 'expert_signed'));

-- Create trigger for updated_at on contracts
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create kyc-documents storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for kyc-documents
CREATE POLICY "Experts can upload their own KYC documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Experts can view their own KYC documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all KYC documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete KYC documents"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for contracts table
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;