
-- Désactiver le trigger d'audit sur platform_settings
ALTER TABLE platform_settings DISABLE TRIGGER ALL;

-- 1. Logs et données transactionnelles
TRUNCATE TABLE webhook_deliveries CASCADE;
TRUNCATE TABLE pii_logs CASCADE;
TRUNCATE TABLE api_request_logs CASCADE;
TRUNCATE TABLE llm_call_logs CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE email_send_log CASCADE;
TRUNCATE TABLE email_send_state CASCADE;
TRUNCATE TABLE fraud_events CASCADE;
TRUNCATE TABLE funnel_events CASCADE;
TRUNCATE TABLE signup_rate_limits CASCADE;
TRUNCATE TABLE suppressed_emails CASCADE;
TRUNCATE TABLE email_unsubscribe_tokens CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE conversations CASCADE;
TRUNCATE TABLE platform_metrics_history CASCADE;
TRUNCATE TABLE platform_stats CASCADE;
TRUNCATE TABLE user_acquisition CASCADE;
TRUNCATE TABLE marketing_spend CASCADE;
TRUNCATE TABLE drift_alerts CASCADE;
TRUNCATE TABLE activation_emails CASCADE;

-- 2. Annotations, QA, RLHF
TRUNCATE TABLE human_review_queue CASCADE;
TRUNCATE TABLE final_annotations CASCADE;
TRUNCATE TABLE alpha_reports CASCADE;
TRUNCATE TABLE alpha_history CASCADE;
TRUNCATE TABLE annotation_drafts CASCADE;
TRUNCATE TABLE annotation_warnings CASCADE;
TRUNCATE TABLE annotation_alerts CASCADE;
TRUNCATE TABLE annotation_quality_reports CASCADE;
TRUNCATE TABLE annotations CASCADE;
TRUNCATE TABLE adjudications CASCADE;
TRUNCATE TABLE annotation_payments CASCADE;
TRUNCATE TABLE item_assignments CASCADE;
TRUNCATE TABLE task_assignments CASCADE;
TRUNCATE TABLE annotation_items CASCADE;
TRUNCATE TABLE annotation_batches CASCADE;
TRUNCATE TABLE annotation_exports CASCADE;
TRUNCATE TABLE annotation_tasks CASCADE;
TRUNCATE TABLE annotation_test_items CASCADE;
TRUNCATE TABLE rlhf_feedback CASCADE;
TRUNCATE TABLE rlhf_gold_tasks CASCADE;
TRUNCATE TABLE rlhf_pending_qa CASCADE;
TRUNCATE TABLE rlhf_qa_queue CASCADE;
TRUNCATE TABLE rlhf_disagreements CASCADE;
TRUNCATE TABLE rlhf_dataset_versions CASCADE;
TRUNCATE TABLE rlhf_email_queue CASCADE;
TRUNCATE TABLE rlhf_sla_tracking CASCADE;
TRUNCATE TABLE rlhf_tier_annotations CASCADE;
TRUNCATE TABLE rlhf_test_instances CASCADE;
TRUNCATE TABLE rlhf_contributor_agreements CASCADE;
TRUNCATE TABLE prompt_versions CASCADE;
TRUNCATE TABLE extraction_schemas CASCADE;
TRUNCATE TABLE label_sets CASCADE;
TRUNCATE TABLE annotation_guidelines CASCADE;

-- 3. Projets, uploads, exports, SLA
TRUNCATE TABLE dataset_exports CASCADE;
TRUNCATE TABLE performance_reports CASCADE;
TRUNCATE TABLE sla_tracking CASCADE;
TRUNCATE TABLE client_uploads CASCADE;
TRUNCATE TABLE project_onboarding CASCADE;

-- 4. Paiements et factures
TRUNCATE TABLE refunds CASCADE;
TRUNCATE TABLE client_invoices CASCADE;
TRUNCATE TABLE invoices CASCADE;
TRUNCATE TABLE project_payments CASCADE;
TRUNCATE TABLE annotation_projects CASCADE;

-- 5. Experts
TRUNCATE TABLE withdrawal_requests CASCADE;
TRUNCATE TABLE expert_transactions CASCADE;
TRUNCATE TABLE expert_balances CASCADE;
TRUNCATE TABLE expert_bank_accounts CASCADE;
TRUNCATE TABLE expert_stripe_accounts CASCADE;
TRUNCATE TABLE expert_payouts CASCADE;
TRUNCATE TABLE expert_achievements CASCADE;
TRUNCATE TABLE annotator_domain_certifications CASCADE;
TRUNCATE TABLE annotator_assessment_sessions CASCADE;
TRUNCATE TABLE certifications CASCADE;
TRUNCATE TABLE certificate_events CASCADE;
TRUNCATE TABLE certificate_sequences CASCADE;
TRUNCATE TABLE certification_assessments CASCADE;
TRUNCATE TABLE assessment_sessions CASCADE;
TRUNCATE TABLE test_submissions CASCADE;
TRUNCATE TABLE test_consents CASCADE;
TRUNCATE TABLE test_generation_logs CASCADE;
TRUNCATE TABLE technical_tests CASCADE;
TRUNCATE TABLE coding_challenges CASCADE;
TRUNCATE TABLE code_review_challenges CASCADE;
TRUNCATE TABLE quiz_results CASCADE;
TRUNCATE TABLE quiz_questions CASCADE;
TRUNCATE TABLE expert_experience CASCADE;
TRUNCATE TABLE expert_education CASCADE;
TRUNCATE TABLE expert_languages CASCADE;
TRUNCATE TABLE expert_availability CASCADE;
TRUNCATE TABLE expert_weekly_schedule CASCADE;
TRUNCATE TABLE timesheets CASCADE;
TRUNCATE TABLE expert_annotations CASCADE;
TRUNCATE TABLE annotator_profiles CASCADE;
TRUNCATE TABLE anonymized_candidates CASCADE;
TRUNCATE TABLE candidate_access_logs CASCADE;
TRUNCATE TABLE candidate_score_dimensions CASCADE;
TRUNCATE TABLE candidates CASCADE;
TRUNCATE TABLE ai_feedback CASCADE;
TRUNCATE TABLE stef_points_ledger CASCADE;

-- 6. Referral
TRUNCATE TABLE referral_abuse_flags CASCADE;
TRUNCATE TABLE referral_analytics_snapshots CASCADE;
TRUNCATE TABLE referral_nudges CASCADE;
TRUNCATE TABLE expert_referrals CASCADE;
TRUNCATE TABLE ambassador_profiles CASCADE;

-- 7. Clients
TRUNCATE TABLE client_webhooks CASCADE;
TRUNCATE TABLE client_notification_preferences CASCADE;
TRUNCATE TABLE quote_requests CASCADE;
TRUNCATE TABLE legal_acceptances CASCADE;
TRUNCATE TABLE impersonation_sessions CASCADE;
TRUNCATE TABLE compliance_documents CASCADE;
TRUNCATE TABLE contracts CASCADE;
TRUNCATE TABLE identity_unlock_requests CASCADE;
TRUNCATE TABLE company_unlock_credits CASCADE;
TRUNCATE TABLE company_credits CASCADE;
TRUNCATE TABLE enterprise_leads CASCADE;
TRUNCATE TABLE leads CASCADE;
TRUNCATE TABLE saved_jobs CASCADE;
TRUNCATE TABLE job_applications CASCADE;
TRUNCATE TABLE job_offers CASCADE;
TRUNCATE TABLE placements CASCADE;
TRUNCATE TABLE eor_commissions CASCADE;
TRUNCATE TABLE eor_partners CASCADE;
TRUNCATE TABLE legal_documents CASCADE;

-- 8. Blog (garder les topics)
UPDATE article_topics SET used = false, article_id = NULL;
TRUNCATE TABLE blog_articles CASCADE;
TRUNCATE TABLE blog_posts CASCADE;

-- 9. Rapports
TRUNCATE TABLE monthly_reports CASCADE;

-- 10. Profils (garder admin)
DELETE FROM clients;
DELETE FROM expert_profiles WHERE user_id != '503c953e-b66a-4ed9-9ca2-52725dc0af37';
DELETE FROM user_email_preferences WHERE user_id != '503c953e-b66a-4ed9-9ca2-52725dc0af37';
DELETE FROM user_roles WHERE user_id != '503c953e-b66a-4ed9-9ca2-52725dc0af37';
DELETE FROM profiles WHERE user_id != '503c953e-b66a-4ed9-9ca2-52725dc0af37';

-- 11. Réinitialiser le compteur de factures
ALTER SEQUENCE invoice_number_seq RESTART WITH 1;

-- 12. Désactiver le mode maintenance
UPDATE platform_settings SET value = 'false' WHERE key = 'maintenance_mode';
UPDATE platform_settings SET value = '""' WHERE key = 'maintenance_message';

-- Réactiver les triggers
ALTER TABLE platform_settings ENABLE TRIGGER ALL;
