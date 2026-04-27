
ALTER TABLE quiz_results
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS contact_method TEXT,
ADD COLUMN IF NOT EXISTS results_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS results_viewed BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  whatsapp TEXT,
  source TEXT DEFAULT 'quiz',
  specialty TEXT,
  quiz_score INTEGER,
  converted_to_user BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads(whatsapp) WHERE whatsapp IS NOT NULL;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert on leads" ON leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow auth insert on leads" ON leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon insert quiz_results" ON quiz_results FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update quiz_results contact" ON quiz_results FOR UPDATE TO anon USING (true) WITH CHECK (true);
