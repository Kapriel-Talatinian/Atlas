
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES 
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clientA@test.stef', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"company","full_name":"Client Test A"}', now(), now()),
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fake1@test.stef', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"expert","full_name":"Expert Sim 1"}', now(), now()),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fake2@test.stef', crypt('Test1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"expert","full_name":"Expert Sim 2"}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, full_name, email) VALUES 
  ('c0000000-0000-0000-0000-000000000001', 'Client Test A', 'clientA@test.stef'),
  ('e0000000-0000-0000-0000-000000000001', 'Expert Sim 1', 'fake1@test.stef'),
  ('e0000000-0000-0000-0000-000000000002', 'Expert Sim 2', 'fake2@test.stef')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'company'),
  ('e0000000-0000-0000-0000-000000000001', 'expert'),
  ('e0000000-0000-0000-0000-000000000002', 'expert')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.clients (id, user_id, company_name, name, contact_name, contact_email, country, api_key_hash, api_key_prefix, postal_code, city, tva_number)
VALUES ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'MedTech Test SAS', 'MedTech Test SAS', 'Client Test A', 'clientA@test.stef', 'FR', encode(sha256('stef_live_testA123'::bytea), 'hex'), 'stef_live_te', '75014', 'Paris', 'FR12345678901')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.annotator_profiles (id, anonymized_id, country, experience_years, languages, role, seniority, is_qualified, is_active, tier)
VALUES 
  ('e0000000-0000-0000-0000-000000000001', 'anon_sim001', 'FR', 5, ARRAY['fr'], 'annotator', 'senior', true, true, 'senior'),
  ('e0000000-0000-0000-0000-000000000002', 'anon_sim002', 'FR', 3, ARRAY['fr'], 'annotator', 'mid', true, true, 'expert')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.annotator_domain_certifications (user_id, expert_id, domain, tier, score, status, valid_until) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'medical', 'senior', 84, 'valid', now() + interval '12 months'),
  ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'medical', 'expert', 80, 'valid', now() + interval '12 months')
ON CONFLICT DO NOTHING;

INSERT INTO public.expert_balances (expert_id, user_id, available_balance, pending_balance, total_earned) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 0, 0, 0),
  ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 0, 0, 0)
ON CONFLICT DO NOTHING;
