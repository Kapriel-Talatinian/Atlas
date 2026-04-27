
-- ============================================
-- INDEXES FOR RLS POLICY PERFORMANCE AT SCALE
-- ============================================

-- Core user lookups (used in almost every RLS policy)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles (user_id, role);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_user_id ON public.expert_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients (user_id);

-- Annotator lookups (used in annotation RLS policies)
CREATE INDEX IF NOT EXISTS idx_annotator_profiles_expert_id ON public.annotator_profiles (expert_id);
CREATE INDEX IF NOT EXISTS idx_annotator_profiles_anonymized_id ON public.annotator_profiles (anonymized_id);
CREATE INDEX IF NOT EXISTS idx_annotator_profiles_tier ON public.annotator_profiles (tier);

-- Job applications
CREATE INDEX IF NOT EXISTS idx_job_applications_expert_id ON public.job_applications (expert_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_offer_id ON public.job_applications (job_offer_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications (status);

-- Job offers
CREATE INDEX IF NOT EXISTS idx_job_offers_user_id ON public.job_offers (user_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON public.job_offers (status);
CREATE INDEX IF NOT EXISTS idx_job_offers_company_id ON public.job_offers (company_id);

-- Notifications (high volume table)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (user_id, is_read);

-- Test submissions
CREATE INDEX IF NOT EXISTS idx_test_submissions_expert_id ON public.test_submissions (expert_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_job_offer_id ON public.test_submissions (job_offer_id);

-- RLHF feedback (high volume)
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_expert_id ON public.rlhf_feedback (expert_id);
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_gold_task ON public.rlhf_feedback (gold_task);
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_qa_status ON public.rlhf_feedback (qa_status);
CREATE INDEX IF NOT EXISTS idx_rlhf_feedback_dataset_version_id ON public.rlhf_feedback (dataset_version_id);

-- Annotation tasks
CREATE INDEX IF NOT EXISTS idx_annotation_tasks_assigned_annotator_id ON public.annotation_tasks (assigned_annotator_id);
CREATE INDEX IF NOT EXISTS idx_annotation_tasks_status ON public.annotation_tasks (status);

-- Annotation payments
CREATE INDEX IF NOT EXISTS idx_annotation_payments_annotator_id ON public.annotation_payments (annotator_id);
CREATE INDEX IF NOT EXISTS idx_annotation_payments_status ON public.annotation_payments (status);

-- Certifications
CREATE INDEX IF NOT EXISTS idx_certifications_user_id ON public.certifications (user_id);
CREATE INDEX IF NOT EXISTS idx_certifications_expert_id ON public.certifications (expert_id);
CREATE INDEX IF NOT EXISTS idx_certifications_certificate_id ON public.certifications (certificate_id);
CREATE INDEX IF NOT EXISTS idx_certifications_role_title_level ON public.certifications (role_title, level);

-- Placements
CREATE INDEX IF NOT EXISTS idx_placements_client_id ON public.placements (client_id);
CREATE INDEX IF NOT EXISTS idx_placements_expert_id ON public.placements (expert_id);
CREATE INDEX IF NOT EXISTS idx_placements_status ON public.placements (status);

-- Expert referrals
CREATE INDEX IF NOT EXISTS idx_expert_referrals_referrer_id ON public.expert_referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_expert_referrals_referred_user_id ON public.expert_referrals (referred_user_id);
CREATE INDEX IF NOT EXISTS idx_expert_referrals_status ON public.expert_referrals (status);

-- Conversations & messages
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON public.conversations (participant_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON public.conversations (participant_2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);

-- Contracts
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON public.contracts (client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_expert_id ON public.contracts (expert_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts (status);

-- Expert payouts
CREATE INDEX IF NOT EXISTS idx_expert_payouts_expert_id ON public.expert_payouts (expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_payouts_status ON public.expert_payouts (status);

-- Audit & access logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_access_logs_company_user_id ON public.candidate_access_logs (company_user_id);

-- Blog posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_is_published ON public.blog_posts (is_published);

-- Saved jobs
CREATE INDEX IF NOT EXISTS idx_saved_jobs_expert_id ON public.saved_jobs (expert_id);

-- Test generation logs (rate limiting queries)
CREATE INDEX IF NOT EXISTS idx_test_generation_logs_expert_id_created_at ON public.test_generation_logs (expert_id, created_at DESC);

-- RLHF tier annotations
CREATE INDEX IF NOT EXISTS idx_rlhf_tier_annotations_feedback_id ON public.rlhf_tier_annotations (feedback_id);
CREATE INDEX IF NOT EXISTS idx_rlhf_tier_annotations_annotator_id ON public.rlhf_tier_annotations (annotator_id);

-- Identity unlock requests
CREATE INDEX IF NOT EXISTS idx_identity_unlock_requests_company_user_id ON public.identity_unlock_requests (company_user_id);
CREATE INDEX IF NOT EXISTS idx_identity_unlock_requests_status ON public.identity_unlock_requests (status);

-- Anonymized candidates
CREATE INDEX IF NOT EXISTS idx_anonymized_candidates_expert_id ON public.anonymized_candidates (expert_id);
CREATE INDEX IF NOT EXISTS idx_anonymized_candidates_is_visible ON public.anonymized_candidates (is_visible);

-- Timesheets
CREATE INDEX IF NOT EXISTS idx_timesheets_placement_id ON public.timesheets (placement_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON public.timesheets (status);

-- Expert availability
CREATE INDEX IF NOT EXISTS idx_expert_availability_expert_id ON public.expert_availability (expert_id);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
