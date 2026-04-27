import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Template imports ───────────────────────────────────────────────
// Talent lifecycle
import { TestSuccessEmail } from '../_shared/email-templates/test-success.tsx'
import { ReferralNotificationEmail } from '../_shared/email-templates/referral-notification.tsx'
import { WelcomeEmail } from '../_shared/email-templates/welcome.tsx'
import { ProfileIncompleteEmail } from '../_shared/email-templates/profile-incomplete.tsx'
import { ProfileCompletedEmail } from '../_shared/email-templates/profile-completed.tsx'
import { AssessmentNudgeEmail } from '../_shared/email-templates/assessment-nudge.tsx'
import { AssessmentStartedEmail } from '../_shared/email-templates/assessment-started.tsx'
import { ResultJuniorEmail } from '../_shared/email-templates/junior-result.tsx'
import { SessionExpiredEmail } from '../_shared/email-templates/session-expired.tsx'
import { SessionFlaggedEmail } from '../_shared/email-templates/session-flagged.tsx'
import { ContactRequestEmail } from '../_shared/email-templates/contact-request.tsx'
import { ContactReminderEmail } from '../_shared/email-templates/contact-reminder.tsx'
import { ContactAcceptedEmail } from '../_shared/email-templates/contact-accepted.tsx'
import { CertLifecycleEmail } from '../_shared/email-templates/cert-lifecycle.tsx'
import { ScoreImprovedEmail } from '../_shared/email-templates/score-improved.tsx'
import { CooldownEndedEmail } from '../_shared/email-templates/cooldown-ended.tsx'
// Referral
import { ReferralInvitationEmail } from '../_shared/email-templates/referral-invitation.tsx'
import { ReferralNudgeEmail } from '../_shared/email-templates/referral-nudge.tsx'
import { ReferralTierUpgradeEmail } from '../_shared/email-templates/referral-tier-upgrade.tsx'
import { ReferralWeeklySummaryEmail } from '../_shared/email-templates/referral-weekly-summary.tsx'
import { ReferralPayoutEmail } from '../_shared/email-templates/referral-payout.tsx'
// Enterprise
import { EnterpriseLeadConfirmationEmail } from '../_shared/email-templates/enterprise-lead-confirmation.tsx'
import { EnterpriseProfileSelectionEmail } from '../_shared/email-templates/enterprise-profile-selection.tsx'
import { EnterpriseLeadFollowupEmail } from '../_shared/email-templates/enterprise-lead-followup.tsx'
import { EnterpriseWelcomeEmail } from '../_shared/email-templates/enterprise-welcome.tsx'
import { EnterpriseContactResponseEmail } from '../_shared/email-templates/enterprise-contact-response.tsx'
import { EnterpriseWeeklyDigestEmail } from '../_shared/email-templates/enterprise-weekly-digest.tsx'
import { EnterpriseFeedbackRequestEmail } from '../_shared/email-templates/enterprise-feedback-request.tsx'
// Admin
import { AdminAlertEmail } from '../_shared/email-templates/admin-alert.tsx'
import { AdminDailyReportEmail } from '../_shared/email-templates/admin-daily-report.tsx'
// Annotator / RLHF
import { AnnotatorWelcomeEmail } from '../_shared/email-templates/annotator-welcome.tsx'
import { AnnotatorProjectEmail } from '../_shared/email-templates/annotator-project.tsx'
import { AnnotatorCalibrationResultEmail } from '../_shared/email-templates/annotator-calibration-result.tsx'
import { AnnotatorWeeklyPerformanceEmail } from '../_shared/email-templates/annotator-weekly-performance.tsx'
import { AnnotatorQualityAlertEmail } from '../_shared/email-templates/annotator-quality-alert.tsx'
import { AnnotatorTierChangeEmail } from '../_shared/email-templates/annotator-tier-change.tsx'
import { AnnotatorPaymentEmail } from '../_shared/email-templates/annotator-payment.tsx'
import { QuizResultsEmail } from '../_shared/email-templates/quiz-results.tsx'
import { PricingQuoteEmail } from '../_shared/email-templates/pricing-quote.tsx'

// ─── Constants ──────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SITE_NAME = 'STEF'
const SENDER_DOMAIN = 'notify.steftalent.fr'
const FROM_DOMAIN = 'steftalent.fr'
const SITE_URL = 'https://steftalent.fr'

// ─── Template registry ──────────────────────────────────────────────
const TEMPLATES: Record<string, { component: React.ComponentType<any>; subject: (d: any) => string }> = {
  // ─ Assessment results ─
  test_success: {
    component: TestSuccessEmail,
    subject: (d) => `🎉 ${d.recipientName || d.firstName}, tu es certifié ${d.level} en ${d.stack || ''}`,
  },
  result_junior: {
    component: ResultJuniorEmail,
    subject: (d) => `${d.firstName}, tes résultats d'assessment STEF`,
  },
  score_improved: {
    component: ScoreImprovedEmail,
    subject: (d) => `📈 ${d.firstName}, ton score a augmenté !`,
  },

  // ─ Talent lifecycle ─
  welcome: {
    component: WelcomeEmail,
    subject: (d) => `Bienvenue sur STEF, ${d.firstName}`,
  },
  profile_completed: {
    component: ProfileCompletedEmail,
    subject: (d) => `✅ Profil complété — ton assessment est prêt`,
  },
  profile_incomplete: {
    component: ProfileIncompleteEmail,
    subject: (d) => d.variant === 'day3' ? `${d.firstName}, il te reste 2 minutes` : `Ton assessment t'attend, ${d.firstName}`,
  },
  assessment_nudge: {
    component: AssessmentNudgeEmail,
    subject: (d) => d.variant === 'day14' ? `Dernière chose, ${d.firstName}` : `${d.firstName}, ${d.weeklyCount || 0} devs se sont certifiés cette semaine`,
  },
  assessment_started: {
    component: AssessmentStartedEmail,
    subject: () => `Assessment en cours`,
  },
  session_expired: {
    component: SessionExpiredEmail,
    subject: () => `Ton assessment a été soumis automatiquement`,
  },
  session_flagged: {
    component: SessionFlaggedEmail,
    subject: () => `Information sur ton assessment STEF`,
  },
  cert_lifecycle: {
    component: CertLifecycleEmail,
    subject: (d) => d.variant === 'expired' ? `Ton certificat STEF a expiré` : d.variant === 'expiring_7' ? `⚠️ Ton certificat STEF expire dans 7 jours` : `Ton certificat STEF expire dans 30 jours`,
  },
  cooldown_ended: {
    component: CooldownEndedEmail,
    subject: () => `Tu peux repasser l'assessment STEF`,
  },

  // ─ Contact / notification ─
  contact_request: {
    component: ContactRequestEmail,
    subject: () => `Une entreprise veut te contacter`,
  },
  contact_reminder: {
    component: ContactReminderEmail,
    subject: (d) => `Rappel : ${d.companyName} attend ta réponse`,
  },
  contact_accepted: {
    component: ContactAcceptedEmail,
    subject: (d) => `Vous êtes mis en relation avec ${d.companyName}`,
  },

  // ─ Referral ─
  referral_notification: {
    component: ReferralNotificationEmail,
    subject: (d) => {
      if (d.status === 'hired') return `🎉 ${d.referredName} est en mission — tu gagnes ${d.cash || 150}$`
      if (d.status === 'certified') return `${d.referredName} est certifié ! Bonus débloqué`
      if (d.status === 'signed_up') return `${d.referredName} vient de s'inscrire grâce à toi`
      if (d.status === 'assessment_completed') return `${d.referredName} a passé l'assessment STEF`
      if (d.status === 'profile_completed') return `${d.referredName} a complété son profil`
      return `Mise à jour parrainage — ${d.referredName}`
    },
  },
  referral_invitation: {
    component: ReferralInvitationEmail,
    subject: (d) => `${d.referrerName} t'invite sur STEF`,
  },
  referral_nudge: {
    component: ReferralNudgeEmail,
    subject: (d) => `${d.refereeName} n'a pas avancé depuis une semaine`,
  },
  referral_tier_upgrade: {
    component: ReferralTierUpgradeEmail,
    subject: (d) => `🏆 Tu passes ${d.newTier} !`,
  },
  referral_weekly_summary: {
    component: ReferralWeeklySummaryEmail,
    subject: (d) => `Ta semaine STEF : ${(d.newSignups || 0) + (d.certified || 0)} filleuls ont progressé`,
  },
  referral_payout: {
    component: ReferralPayoutEmail,
    subject: (d) => d.variant === 'available' ? `${d.amount}$ disponibles sur ton compte STEF` : `Virement de ${d.amount}$ effectué`,
  },

  // ─ Enterprise ─
  enterprise_lead_confirmation: {
    component: EnterpriseLeadConfirmationEmail,
    subject: () => `Votre demande STEF a bien été reçue`,
  },
  enterprise_profile_selection: {
    component: EnterpriseProfileSelectionEmail,
    subject: (d) => `${d.profiles?.length || 0} profils ${d.stack} pour ${d.company}`,
  },
  enterprise_lead_followup: {
    component: EnterpriseLeadFollowupEmail,
    subject: (d) => d.variant === 'day30' ? `${d.firstName}, on reste disponible` : `${d.firstName}, avez-vous des questions ?`,
  },
  enterprise_welcome: {
    component: EnterpriseWelcomeEmail,
    subject: (d) => `Bienvenue sur STEF, ${d.firstName}`,
  },
  enterprise_contact_accepted: {
    component: EnterpriseContactResponseEmail,
    subject: (d) => `Le talent ${d.talentCode} a accepté votre demande`,
  },
  enterprise_contact_declined: {
    component: EnterpriseContactResponseEmail,
    subject: (d) => `Le talent ${d.talentCode} a décliné votre demande`,
  },
  enterprise_contact_expired: {
    component: EnterpriseContactResponseEmail,
    subject: (d) => `Votre demande pour ${d.talentCode} a expiré`,
  },
  enterprise_weekly_digest: {
    component: EnterpriseWeeklyDigestEmail,
    subject: (d) => `${d.newTalentsCount} nouveaux talents cette semaine`,
  },
  enterprise_feedback_request: {
    component: EnterpriseFeedbackRequestEmail,
    subject: (d) => `Votre avis compte, ${d.firstName}`,
  },

  // ─ Admin / Internal ─
  admin_new_lead: {
    component: AdminAlertEmail,
    subject: (d) => `🏢 Nouveau lead : ${d.leadCompany}`,
  },
  admin_annotator_struggling: {
    component: AdminAlertEmail,
    subject: (d) => `⚠️ Annotateur en difficulté — ${d.annotatorId}`,
  },
  admin_drift_detected: {
    component: AdminAlertEmail,
    subject: (d) => `🔴 Drift détecté — ${d.driftProjectName}`,
  },
  admin_daily_report: {
    component: AdminDailyReportEmail,
    subject: (d) => `📊 Rapport STEF du ${d.date}`,
  },

  // ─ Annotator / RLHF ─
  annotator_welcome: {
    component: AnnotatorWelcomeEmail,
    subject: (d) => `Bienvenue dans l'équipe annotation, ${d.firstName}`,
  },
  annotator_project: {
    component: AnnotatorProjectEmail,
    subject: (d) => `Nouveau projet disponible : ${d.projectName}`,
  },
  annotator_calibration_result: {
    component: AnnotatorCalibrationResultEmail,
    subject: (d) => d.passed ? `✅ Calibration réussie — ${d.projectName}` : `Résultat calibration — ${d.projectName}`,
  },
  annotator_weekly_performance: {
    component: AnnotatorWeeklyPerformanceEmail,
    subject: (d) => `Ta semaine annotation : ${d.tasksCompleted} tâches, ${d.accuracy}% précision`,
  },
  annotator_quality_alert: {
    component: AnnotatorQualityAlertEmail,
    subject: (d) => d.warningLevel === 'critical' ? `🔴 Alerte qualité critique — ${d.projectName}` : `⚠️ Alerte qualité — ${d.projectName}`,
  },
  annotator_tier_change: {
    component: AnnotatorTierChangeEmail,
    subject: (d) => d.direction === 'up' ? `🏆 Tu passes ${d.newTier} !` : `Changement de tier : ${d.newTier}`,
  },
  annotator_payment: {
    component: AnnotatorPaymentEmail,
    subject: (d) => `💰 Paiement de ${d.amount}$ effectué`,
  },
  pc_bridge: {
    component: PcBridgeEmail,
    subject: (d) => d.variant === 'j3' ? `Dernière chance — la cohorte se termine bientôt` : d.variant === 'j1' ? `Rappel : ton évaluation ${d.specialty || ''} t'attend sur PC` : `Ouvre cet email depuis ton PC — ton évaluation STEF t'attend`,
  },
  'quiz-results': {
    component: QuizResultsEmail,
    subject: (d) => `Tes résultats STEF : ${d.score || 0}/100 en ${d.specialty || 'technique'}`,
  },
  'pricing-quote': {
    component: PricingQuoteEmail,
    subject: (d) => `Votre estimation STEF : ${(d.estimatedLow || 0).toLocaleString('en-US')} – ${(d.estimatedHigh || 0).toLocaleString('en-US')} USD HT`,
  },
}

// ─── Handler ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { template, to, data } = body

    if (!template || !to || !data) {
      return new Response(JSON.stringify({ error: 'Missing template, to, or data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tmpl = TEMPLATES[template]
    if (!tmpl) {
      return new Response(JSON.stringify({ error: `Unknown template: ${template}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check email preferences (skip for transactional-critical)
    const category = getCategoryForTemplate(template)
    if (category && category !== 'transactional') {
      const { data: prefs } = await supabase
        .from('user_email_preferences')
        .select(category)
        .eq('user_id', user.id)
        .maybeSingle()

      if (prefs && prefs[category] === false) {
        return new Response(JSON.stringify({ success: true, skipped: 'user_opted_out', category }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const templateData = { ...data, siteUrl: SITE_URL }
    const html = await renderAsync(React.createElement(tmpl.component, templateData))
    const text = await renderAsync(React.createElement(tmpl.component, templateData), { plainText: true })

    const messageId = crypto.randomUUID()

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: template,
      recipient_email: to,
      status: 'pending',
    })

    const { error: enqueueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: tmpl.subject(templateData),
        html,
        text,
        purpose: 'transactional',
        label: template,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      console.error('Failed to enqueue email', enqueueError)
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: template,
        recipient_email: to,
        status: 'failed',
        error_message: 'Failed to enqueue email',
      })
      return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Transactional email enqueued', { template, to, messageId })

    return new Response(JSON.stringify({ success: true, messageId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Category mapping for preference checks ────────────────────────
function getCategoryForTemplate(template: string): string | null {
  const categoryMap: Record<string, string> = {
    // Transactional (always sent)
    welcome: 'transactional',
    test_success: 'transactional',
    result_junior: 'transactional',
    assessment_started: 'transactional',
    session_expired: 'transactional',
    session_flagged: 'transactional',
    contact_accepted: 'transactional',
    score_improved: 'transactional',
    enterprise_lead_confirmation: 'transactional',
    enterprise_welcome: 'transactional',
    enterprise_contact_accepted: 'transactional',
    enterprise_contact_declined: 'transactional',
    enterprise_contact_expired: 'transactional',
    annotator_payment: 'transactional',
    annotator_calibration_result: 'transactional',

    // Lifecycle (opt-out possible)
    profile_incomplete: 'lifecycle',
    profile_completed: 'lifecycle',
    assessment_nudge: 'lifecycle',
    cert_lifecycle: 'lifecycle',
    cooldown_ended: 'lifecycle',
    contact_request: 'lifecycle',
    contact_reminder: 'lifecycle',
    enterprise_lead_followup: 'lifecycle',
    enterprise_feedback_request: 'lifecycle',

    // Marketing (opt-out possible)
    enterprise_weekly_digest: 'marketing',
    enterprise_profile_selection: 'marketing',
    admin_daily_report: 'marketing',

    // Referral (opt-out possible)
    referral_notification: 'referral',
    referral_invitation: 'referral',
    referral_nudge: 'referral',
    referral_tier_upgrade: 'referral',
    referral_weekly_summary: 'referral',
    referral_payout: 'referral',

    // Annotation (opt-out possible)
    annotator_welcome: 'annotation',
    annotator_project: 'annotation',
    annotator_weekly_performance: 'annotation',
    annotator_quality_alert: 'annotation',
    annotator_tier_change: 'annotation',
    admin_new_lead: 'annotation',
    admin_annotator_struggling: 'annotation',
    admin_drift_detected: 'annotation',
  }
  return categoryMap[template] || null
}
