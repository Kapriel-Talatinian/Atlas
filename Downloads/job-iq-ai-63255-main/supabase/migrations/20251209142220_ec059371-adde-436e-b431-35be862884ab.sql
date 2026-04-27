-- Add notification preferences to expert_profiles
ALTER TABLE public.expert_profiles 
ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_notifications boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_number_sms text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notify_job_matches boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_application_updates boolean DEFAULT true;

-- Add test submissions for visibility
INSERT INTO public.test_submissions (id, expert_id, test_id, job_offer_id, answers, test_score, cv_score, final_score, feedback, submitted_at)
SELECT 
  gen_random_uuid(),
  ep.id,
  NULL,
  NULL,
  '{"question_1": "Implemented a REST API using FastAPI with async endpoints", "question_2": "Used Redis for caching and PostgreSQL for persistence", "question_3": "Applied SOLID principles and dependency injection"}'::jsonb,
  85,
  90,
  87,
  '{"strengths": ["Strong Python skills", "Good system design", "Clean code"], "improvements": ["Could improve testing coverage"], "overall": "Excellent candidate with solid technical foundation"}'::jsonb,
  NOW() - interval '3 days'
FROM public.expert_profiles ep
WHERE ep.onboarding_completed = true
LIMIT 1;

-- Add test referrals with various statuses
INSERT INTO public.expert_referrals (referrer_id, referred_email, status, bonus_amount, created_at, hired_at)
SELECT 
  ep.id,
  'marie.dupont@example.com',
  'hired',
  500,
  NOW() - interval '30 days',
  NOW() - interval '5 days'
FROM public.expert_profiles ep
LIMIT 1;

INSERT INTO public.expert_referrals (referrer_id, referred_email, status, bonus_amount, created_at)
SELECT 
  ep.id,
  'jean.martin@example.com',
  'applying',
  0,
  NOW() - interval '7 days'
FROM public.expert_profiles ep
LIMIT 1;

INSERT INTO public.expert_referrals (referrer_id, referred_email, status, bonus_amount, created_at)
SELECT 
  ep.id,
  'lucas.bernard@example.com',
  'signed_up',
  0,
  NOW() - interval '2 days'
FROM public.expert_profiles ep
LIMIT 1;

INSERT INTO public.expert_referrals (referrer_id, referred_email, status, bonus_amount, created_at)
SELECT 
  ep.id,
  'emma.leroy@example.com',
  'under_review',
  0,
  NOW() - interval '14 days'
FROM public.expert_profiles ep
LIMIT 1;

-- Add sample blog posts for SEO
INSERT INTO public.blog_posts (title, slug, excerpt, content, author_name, is_published, published_at, cover_image_url)
VALUES 
(
  'Comment l''IA révolutionne le recrutement tech en 2024',
  'ia-recrutement-tech-2024',
  'Découvrez comment l''intelligence artificielle transforme le processus de recrutement dans le secteur technologique.',
  '# L''IA au cœur du recrutement moderne

L''intelligence artificielle a profondément transformé la façon dont les entreprises recrutent les talents tech. Voici les tendances clés :

## 1. Évaluation automatisée des compétences

Les tests techniques générés par IA permettent d''évaluer objectivement les candidats, éliminant les biais humains et assurant une sélection basée sur les compétences réelles.

## 2. Matching intelligent

Les algorithmes de matching analysent des centaines de variables pour connecter les bons candidats aux bonnes opportunités, réduisant le temps de recrutement de 66%.

## 3. Analyse prédictive

L''IA peut prédire la compatibilité culturelle et la probabilité de réussite d''un candidat dans un poste spécifique.

## Conclusion

L''adoption de l''IA dans le recrutement n''est plus une option mais une nécessité pour rester compétitif dans la guerre des talents.',
  'Sophie Martin',
  true,
  NOW() - interval '5 days',
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800'
),
(
  'Les 10 compétences tech les plus demandées en 2024',
  'competences-tech-2024',
  'Python, Machine Learning, Cloud... Quelles sont les compétences qui font la différence sur le marché du travail ?',
  '# Top 10 des compétences tech en 2024

Le marché du travail tech évolue rapidement. Voici les compétences les plus recherchées :

## 1. Intelligence Artificielle & Machine Learning
La maîtrise de TensorFlow, PyTorch et des LLMs est devenue essentielle.

## 2. Cloud Computing
AWS, Azure et GCP sont incontournables pour tout projet moderne.

## 3. DevOps & MLOps
L''automatisation du déploiement et de la gestion des modèles ML.

## 4. Cybersécurité
La sécurité est plus importante que jamais face aux menaces croissantes.

## 5. Python
Le langage roi du data science et du développement backend.

## 6-10. Et aussi...
- Kubernetes & Docker
- TypeScript/JavaScript
- Rust
- Data Engineering
- Architecture distribuée

## Comment se préparer ?

Investissez dans la formation continue et les certifications reconnues.',
  'Thomas Dubois',
  true,
  NOW() - interval '10 days',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'
),
(
  'Freelance vs CDI : quel statut choisir en tech ?',
  'freelance-vs-cdi-tech',
  'Flexibilité ou stabilité ? Analysons les avantages et inconvénients de chaque statut pour les développeurs.',
  '# Freelance ou CDI : le guide complet

Le choix entre freelance et CDI dépend de nombreux facteurs. Analysons ensemble.

## Avantages du Freelance

- **Liberté** : Choisissez vos projets et vos clients
- **Rémunération** : TJM souvent 2 à 3 fois supérieur au salaire équivalent
- **Flexibilité** : Travaillez où et quand vous voulez

## Avantages du CDI

- **Stabilité** : Revenus prévisibles et sécurité de l''emploi
- **Avantages sociaux** : Mutuelle, congés payés, formation
- **Évolution** : Parcours de carrière structuré

## Les nouvelles alternatives

Les plateformes comme Stef offrent le meilleur des deux mondes : la flexibilité du freelance avec la sécurité des missions longue durée et le portage salarial.

## Notre conseil

Testez le freelance avec des missions courtes avant de vous lancer à 100%.',
  'Marie Chen',
  true,
  NOW() - interval '15 days',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800'
),
(
  'Guide entreprise : Comment attirer les meilleurs talents tech',
  'attirer-talents-tech-entreprise',
  'Salaires, culture, process de recrutement... Les clés pour séduire les développeurs les plus qualifiés.',
  '# Attirer les meilleurs talents tech

Dans un marché ultra-compétitif, comment se démarquer ?

## 1. Une marque employeur forte

Les développeurs recherchent des entreprises avec des valeurs claires et une culture tech authentique.

## 2. Un processus de recrutement moderne

- Pas de tests chronophages déconnectés de la réalité
- Retours rapides (sous 48h)
- Transparence sur le salaire dès le début

## 3. Rémunération compétitive

Le salaire reste important, mais ce n''est pas tout :
- Remote-first ou hybride
- Équipement de qualité
- Budget formation

## 4. Projets stimulants

Les meilleurs talents veulent travailler sur des défis techniques intéressants avec des technologies modernes.

## 5. Utilisez les bons canaux

Les plateformes spécialisées comme Stef vous donnent accès à des profils pré-qualifiés et testés par IA.',
  'Alexandre Petit',
  true,
  NOW() - interval '20 days',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800'
)
ON CONFLICT (slug) DO NOTHING;