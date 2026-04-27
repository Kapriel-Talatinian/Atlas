
-- Migration: 20251027171113
-- Table pour stocker les candidats et leur CV
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  cv_text TEXT NOT NULL,
  cv_score INTEGER, -- Score caché du candidat
  parsed_data JSONB, -- Données structurées extraites du CV
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les offres d'emploi
CREATE TABLE IF NOT EXISTS public.job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, -- À lier plus tard avec table companies
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements JSONB NOT NULL, -- Stack technique, seniority, etc.
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les tests techniques générés automatiquement
CREATE TABLE IF NOT EXISTS public.technical_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_offer_id UUID REFERENCES public.job_offers(id) ON DELETE CASCADE,
  questions JSONB NOT NULL, -- Questions générées par AI
  difficulty TEXT DEFAULT 'advanced',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les soumissions de tests
CREATE TABLE IF NOT EXISTS public.test_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  test_id UUID REFERENCES public.technical_tests(id) ON DELETE CASCADE,
  job_offer_id UUID REFERENCES public.job_offers(id) ON DELETE CASCADE,
  answers JSONB NOT NULL, -- Réponses du candidat
  cv_score INTEGER, -- Score du CV
  test_score INTEGER, -- Score du test
  final_score INTEGER, -- Score combiné
  feedback JSONB, -- Détails des bonnes/mauvaises réponses
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour candidates (lecture publique pour matching, écriture propre données)
CREATE POLICY "Candidats peuvent voir leur propre profil"
  ON public.candidates FOR SELECT
  USING (true); -- Public pour matching

CREATE POLICY "Candidats peuvent créer leur profil"
  ON public.candidates FOR INSERT
  WITH CHECK (true);

-- RLS Policies pour job_offers (lecture publique, écriture entreprises)
CREATE POLICY "Offres publiques visibles"
  ON public.job_offers FOR SELECT
  USING (status = 'active');

CREATE POLICY "Entreprises peuvent créer offres"
  ON public.job_offers FOR INSERT
  WITH CHECK (true); -- À affiner avec auth entreprise

-- RLS Policies pour technical_tests (lecture par candidats, écriture système)
CREATE POLICY "Tests visibles pour tous"
  ON public.technical_tests FOR SELECT
  USING (true);

CREATE POLICY "Système peut créer tests"
  ON public.technical_tests FOR INSERT
  WITH CHECK (true);

-- RLS Policies pour test_submissions
CREATE POLICY "Candidats voient leurs soumissions"
  ON public.test_submissions FOR SELECT
  USING (true);

CREATE POLICY "Candidats peuvent soumettre tests"
  ON public.test_submissions FOR INSERT
  WITH CHECK (true);

-- Index pour performances
CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_job_offers_status ON public.job_offers(status);
CREATE INDEX idx_technical_tests_job_offer ON public.technical_tests(job_offer_id);
CREATE INDEX idx_test_submissions_candidate ON public.test_submissions(candidate_id);
CREATE INDEX idx_test_submissions_job_offer ON public.test_submissions(job_offer_id);

-- Migration: 20251028103730
-- Ajouter des colonnes pour détecter la triche dans test_submissions
ALTER TABLE test_submissions
ADD COLUMN IF NOT EXISTS cheat_indicators JSONB DEFAULT '{
  "tab_switches": 0,
  "copy_attempts": 0,
  "paste_attempts": 0,
  "time_away": 0,
  "suspicious_speed": false
}'::jsonb;

COMMENT ON COLUMN test_submissions.cheat_indicators IS 'Indicateurs de comportements suspects pendant le test';
