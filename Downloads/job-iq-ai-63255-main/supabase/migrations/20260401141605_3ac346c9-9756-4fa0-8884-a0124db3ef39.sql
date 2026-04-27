
-- Expert bank accounts
CREATE TABLE IF NOT EXISTS expert_bank_accounts (
  expert_id UUID REFERENCES profiles(id) PRIMARY KEY,
  account_holder TEXT NOT NULL,
  iban_encrypted TEXT NOT NULL,
  bic TEXT,
  bank_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expert_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_expert_own ON expert_bank_accounts
  FOR ALL USING (expert_id = auth.uid());

CREATE POLICY bank_admin_all ON expert_bank_accounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID REFERENCES profiles(id),
  amount FLOAT NOT NULL,
  currency TEXT DEFAULT 'USD',
  iban_snapshot TEXT NOT NULL,
  account_holder_snapshot TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  transfer_date DATE,
  transfer_reference TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_withdrawals_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawals_expert ON withdrawal_requests(expert_id);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY withdrawal_expert_own ON withdrawal_requests
  FOR SELECT USING (expert_id = auth.uid());

CREATE POLICY withdrawal_admin_all ON withdrawal_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Only one pending withdrawal per expert
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_withdrawal
  ON withdrawal_requests(expert_id) WHERE status = 'pending';

-- Invoice columns for bank transfer
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_transfer_reference TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS manually_confirmed_by UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS manually_confirmed_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders_sent INT DEFAULT 0;

-- Bank details in platform_settings
INSERT INTO platform_settings (key, value) VALUES
('bank_account_holder', '"STEF SAS"'),
('bank_iban', '"FR76 XXXX XXXX XXXX XXXX XXXX XXX"'),
('bank_bic', '"XXXXXXXXX"'),
('bank_name', '"Nom de la banque"')
ON CONFLICT (key) DO NOTHING;

-- Enable realtime on withdrawal_requests for admin notifications
ALTER PUBLICATION supabase_realtime ADD TABLE withdrawal_requests;
