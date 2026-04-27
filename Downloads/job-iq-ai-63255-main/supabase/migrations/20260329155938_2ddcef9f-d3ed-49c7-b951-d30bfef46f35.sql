
ALTER TABLE task_pricing DROP CONSTRAINT task_pricing_task_type_check;
ALTER TABLE task_pricing ADD CONSTRAINT task_pricing_task_type_check 
  CHECK (task_type = ANY (ARRAY['scoring','preference_dpo','fact_checking','red_teaming','text_generation','span_annotation','extraction','conversation_rating','comparison_ab']));

CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  plan TEXT,
  domain TEXT,
  estimated_volume TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert quote requests"
  ON quote_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Only admins can view quote requests"
  ON quote_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_quotes_status ON quote_requests(status, created_at DESC);
