-- Step 1: Add 'client' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- Step 2: Create clients table (French client companies)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  siret TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'France',
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  billing_email TEXT,
  payment_terms INTEGER DEFAULT 30,
  stripe_customer_id TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 3: Create EOR partners table
CREATE TABLE public.eor_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  contract_url TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 4: Create placements table (active missions)
CREATE TABLE public.placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  expert_id UUID REFERENCES public.expert_profiles(id) ON DELETE RESTRICT NOT NULL,
  eor_id UUID REFERENCES public.eor_partners(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  client_daily_rate DECIMAL(10,2) NOT NULL,
  expert_daily_rate DECIMAL(10,2) NOT NULL,
  eor_daily_cost DECIMAL(10,2),
  stef_margin DECIMAL(10,2) GENERATED ALWAYS AS (client_daily_rate - expert_daily_rate - COALESCE(eor_daily_cost, 0)) STORED,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  work_type TEXT DEFAULT 'remote' CHECK (work_type IN ('remote', 'onsite', 'hybrid')),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 5: Create timesheets table
CREATE TABLE public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID REFERENCES public.placements(id) ON DELETE CASCADE NOT NULL,
  expert_id UUID REFERENCES public.expert_profiles(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2024),
  days_worked DECIMAL(4,1) NOT NULL DEFAULT 0 CHECK (days_worked >= 0 AND days_worked <= 31),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'invoiced')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(placement_id, month, year)
);

-- Step 6: Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
  timesheet_ids UUID[] NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 20.00,
  tax_amount DECIMAL(12,2) GENERATED ALWAYS AS (subtotal * tax_rate / 100) STORED,
  total DECIMAL(12,2) GENERATED ALWAYS AS (subtotal + (subtotal * tax_rate / 100)) STORED,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 7: Create EOR commissions tracking table
CREATE TABLE public.eor_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eor_id UUID REFERENCES public.eor_partners(id) ON DELETE RESTRICT NOT NULL,
  placement_id UUID REFERENCES public.placements(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  base_amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(12,2) GENERATED ALWAYS AS (base_amount * commission_rate / 100) STORED,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'disputed')),
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(eor_id, placement_id, month, year)
);

-- Step 8: Enable RLS on all new tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eor_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eor_commissions ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies for clients
CREATE POLICY "Admins can do everything on clients"
ON public.clients FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view their own record"
ON public.clients FOR SELECT
USING (auth.uid() = user_id);

-- Step 10: Create RLS policies for eor_partners
CREATE POLICY "Admins can do everything on eor_partners"
ON public.eor_partners FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active EOR partners"
ON public.eor_partners FOR SELECT
USING (is_active = true);

-- Step 11: Create RLS policies for placements
CREATE POLICY "Admins can do everything on placements"
ON public.placements FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Experts can view their own placements"
ON public.placements FOR SELECT
USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view their own placements"
ON public.placements FOR SELECT
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Step 12: Create RLS policies for timesheets
CREATE POLICY "Admins can do everything on timesheets"
ON public.timesheets FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Experts can view their own timesheets"
ON public.timesheets FOR SELECT
USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Experts can insert their own timesheets"
ON public.timesheets FOR INSERT
WITH CHECK (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Experts can update their draft timesheets"
ON public.timesheets FOR UPDATE
USING (
  expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid())
  AND status = 'draft'
);

-- Step 13: Create RLS policies for invoices
CREATE POLICY "Admins can do everything on invoices"
ON public.invoices FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view their own invoices"
ON public.invoices FOR SELECT
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Step 14: Create RLS policies for eor_commissions
CREATE POLICY "Admins can do everything on eor_commissions"
ON public.eor_commissions FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 15: Create updated_at triggers for new tables
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_eor_partners_updated_at
  BEFORE UPDATE ON public.eor_partners
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_placements_updated_at
  BEFORE UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_timesheets_updated_at
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Step 16: Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  current_month TEXT;
  seq_num INTEGER;
  invoice_num TEXT;
BEGIN
  current_year := to_char(CURRENT_DATE, 'YYYY');
  current_month := to_char(CURRENT_DATE, 'MM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 10 FOR 4) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.invoices
  WHERE invoice_number LIKE 'STEF-' || current_year || current_month || '-%';
  
  invoice_num := 'STEF-' || current_year || current_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  RETURN invoice_num;
END;
$$;

-- Step 17: Create indexes for performance
CREATE INDEX idx_placements_client_id ON public.placements(client_id);
CREATE INDEX idx_placements_expert_id ON public.placements(expert_id);
CREATE INDEX idx_placements_status ON public.placements(status);
CREATE INDEX idx_timesheets_placement_id ON public.timesheets(placement_id);
CREATE INDEX idx_timesheets_expert_id ON public.timesheets(expert_id);
CREATE INDEX idx_timesheets_status ON public.timesheets(status);
CREATE INDEX idx_timesheets_month_year ON public.timesheets(year, month);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_month_year ON public.invoices(year, month);