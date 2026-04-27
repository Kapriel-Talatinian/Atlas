-- Simplifier le système annotateur: retirer tiers, paiements auto, pénalités complexes

-- Supprimer les colonnes inutiles de annotation_payments
ALTER TABLE public.annotation_payments 
  DROP COLUMN IF EXISTS agreement_score,
  DROP COLUMN IF EXISTS effort_score;

-- Simplifier annotation_tasks: retirer l'attribution automatique complexe  
ALTER TABLE public.annotation_tasks
  DROP COLUMN IF EXISTS ai_quality_score,
  DROP COLUMN IF EXISTS ai_noise_detected;

-- Conserver ai_triage_notes pour le triage basique

-- Modifier le type tier pour être simplement un booléen "qualifié"
-- On garde la colonne tier mais on n'utilisera que 'gold' pour "qualifié"
-- et NULL pour "non qualifié"

-- Ajouter une colonne simple pour le statut qualifié/non-qualifié
ALTER TABLE public.annotator_profiles
  ADD COLUMN IF NOT EXISTS is_qualified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_qualification_attempt TIMESTAMPTZ;

-- Simplifier: retirer les colonnes de pénalités complexes qu'on a ajouté
-- On garde warnings_count et suspended_until pour la sécurité de base

-- Mettre à jour les RLS pour simplifier
DROP POLICY IF EXISTS "Annotators view own payments" ON public.annotation_payments;
CREATE POLICY "Annotators view own payments" ON public.annotation_payments
  FOR SELECT USING (
    annotator_id IN (
      SELECT id FROM public.annotator_profiles 
      WHERE expert_id IN (
        SELECT id FROM public.expert_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Politique simple pour les tâches
DROP POLICY IF EXISTS "Annotators view assigned tasks" ON public.annotation_tasks;
CREATE POLICY "Annotators view assigned tasks" ON public.annotation_tasks
  FOR SELECT USING (
    assigned_annotator_id IN (
      SELECT id FROM public.annotator_profiles 
      WHERE expert_id IN (
        SELECT id FROM public.expert_profiles 
        WHERE user_id = auth.uid()
      )
    )
  );