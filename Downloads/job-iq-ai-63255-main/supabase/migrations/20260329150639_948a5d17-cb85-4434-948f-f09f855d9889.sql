
-- Legal documents and acceptances

CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('cgu_expert', 'cgv_client', 'privacy_policy', 'api_terms', 'nda_template')),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TIMESTAMPTZ DEFAULT now(),
  is_current BOOLEAN DEFAULT true,
  UNIQUE(document_type, version)
);

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('cgu_expert', 'cgv_client', 'privacy_policy', 'api_terms', 'nda')),
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_legal_user ON legal_acceptances(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_legal_docs_current ON legal_documents(document_type) WHERE is_current = true;

-- RLS
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read legal docs" ON legal_documents FOR SELECT USING (true);
CREATE POLICY "Users insert own acceptances" ON legal_acceptances FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own acceptances" ON legal_acceptances FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin full access legal_acceptances" ON legal_acceptances FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin full access legal_documents" ON legal_documents FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Seed current versions
INSERT INTO legal_documents (document_type, version, title, is_current) VALUES
('cgu_expert', '1.0', 'Conditions Générales d''Utilisation — Experts', true),
('cgv_client', '1.0', 'Conditions Générales de Vente — Clients', true),
('privacy_policy', '1.0', 'Politique de Confidentialité', true),
('api_terms', '1.0', 'Conditions d''Utilisation de l''API', true),
('nda_template', '1.0', 'Accord de Confidentialité (NDA)', true);
