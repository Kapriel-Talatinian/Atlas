import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE_NAME = 'STEF'
const SITE_URL = 'https://steftalent.fr'
const PRIMARY = '#7B6FF0'

// ─── HTML helper ────────────────────────────────────────────
function css(obj: Record<string, string>): string {
  return Object.entries(obj).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';')
}

const mainS = css({ backgroundColor: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '0', margin: '0' })
const containerS = css({ backgroundColor: '#ffffff', padding: '40px 32px', margin: '40px auto', borderRadius: '8px', maxWidth: '560px', border: '1px solid #e5e7eb' })
const h1S = css({ fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 24px', lineHeight: '1.4' })
const textS = css({ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 16px' })
const btnS = css({ backgroundColor: PRIMARY, color: '#ffffff', padding: '10px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: '500', textDecoration: 'none', display: 'inline-block' })
const footerS = css({ fontSize: '12px', color: '#9ca3af', margin: '32px 0 0', lineHeight: '1.5' })
const hrS = css({ borderColor: '#e5e7eb', margin: '24px 0' })
const detailS = css({ fontSize: '13px', color: '#4b5563', lineHeight: '1.6', margin: '4px 0' })

function wrap(preview: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="${mainS}"><div style="display:none;max-height:0;overflow:hidden">${preview}</div><div style="${containerS}">${content}<hr style="${hrS}"/><p style="${footerS}">L'équipe ${SITE_NAME}</p></div></body></html>`
}

// ─── Templates ──────────────────────────────────────────────

function expertWelcome(p: any): string {
  return wrap(`Bienvenue sur ${SITE_NAME}`,
    `<h1 style="${h1S}">Bienvenue sur ${SITE_NAME}</h1>` +
    `<p style="${textS}">Bonjour ${p.expert_name},</p>` +
    `<p style="${textS}">Votre compte expert a été créé avec succès sur ${SITE_NAME}.</p>` +
    `<p style="${textS}">Pour commencer à annoter et recevoir des rémunérations, vous devez d'abord obtenir votre certification dans au moins un domaine d'expertise.</p>` +
    `<p style="${textS}">Rendez-vous sur votre espace pour démarrer votre certification.</p>` +
    `<a href="${SITE_URL}/expert/certification" style="${btnS}">Accéder à mon espace</a>`)
}

function expertCertPassed(p: any): string {
  return wrap(`Certification obtenue — ${p.domain_label}`,
    `<h1 style="${h1S}">Certification obtenue</h1>` +
    `<p style="${textS}">Bonjour ${p.expert_name},</p>` +
    `<p style="${textS}">Félicitations. Vous êtes désormais certifié dans le domaine ${p.domain_label} sur ${SITE_NAME}.</p>` +
    `<p style="${textS}">Vous pouvez dès maintenant accéder aux tâches d'annotation disponibles dans votre domaine et commencer à recevoir des rémunérations.</p>` +
    `<a href="${SITE_URL}/expert/tasks" style="${btnS}">Voir les tâches disponibles</a>`)
}

function expertCertFailed(p: any): string {
  return wrap(`Résultat de votre certification`,
    `<h1 style="${h1S}">Résultat de votre certification</h1>` +
    `<p style="${textS}">Bonjour ${p.expert_name},</p>` +
    `<p style="${textS}">Votre assessment de certification dans le domaine ${p.domain_label} n'a pas atteint le seuil requis.</p>` +
    `<p style="${textS}">Vous pourrez repasser l'assessment à partir du ${p.next_attempt_date}.</p>` +
    `<p style="${textS}">Si vous avez des questions, n'hésitez pas à nous contacter.</p>`)
}

function expertTaskAvailable(p: any): string {
  const cur = p.currency || 'USD'
  return wrap(`${p.task_count} nouvelles tâches — ${p.domain_label}`,
    `<h1 style="${h1S}">Nouvelles tâches disponibles</h1>` +
    `<p style="${textS}">Bonjour ${p.expert_name},</p>` +
    `<p style="${textS}">${p.task_count} nouvelles tâches d'annotation sont disponibles dans le domaine ${p.domain_label}.</p>` +
    `<p style="${detailS}">Type de tâche : ${p.task_type_label}</p>` +
    `<p style="${detailS}">Rémunération par tâche : ${p.payout_amount} ${cur}</p><br/>` +
    `<a href="${SITE_URL}/expert/tasks" style="${btnS}">Voir les tâches</a>`)
}

function expertPayoutSent(p: any): string {
  const cur = p.currency || 'USD'
  return wrap(`Paiement effectué — ${p.amount} ${cur}`,
    `<h1 style="${h1S}">Paiement effectué</h1>` +
    `<p style="${textS}">Bonjour ${p.expert_name},</p>` +
    `<p style="${textS}">Un paiement de ${p.amount} ${cur} a été initié vers votre compte bancaire.</p>` +
    `<p style="${detailS}">Période : du ${p.period_start} au ${p.period_end}</p>` +
    `<p style="${detailS}">Tâches rémunérées : ${p.tasks_count}</p>` +
    `<p style="${detailS}">Montant : ${p.amount} ${cur}</p><br/>` +
    `<p style="${textS}">Le virement sera visible sur votre compte sous 2 à 5 jours ouvrés.</p>`)
}

function expertWarning(p: any): string {
  return wrap(`Avertissement concernant vos annotations`,
    `<h1 style="${h1S}">Avertissement</h1>` +
    `<p style="${textS}">Bonjour ${p.expert_name},</p>` +
    `<p style="${textS}">Nous avons détecté un comportement inhabituel dans vos annotations récentes.</p>` +
    `<p style="${detailS}">Motif : ${p.warning_reason}</p><br/>` +
    `<p style="${textS}">Nous vous rappelons que la qualité des annotations est essentielle au fonctionnement de la plateforme. Des avertissements répétés peuvent entraîner une suspension temporaire de votre compte.</p>` +
    `<p style="${textS}">Si vous pensez qu'il s'agit d'une erreur, veuillez nous contacter.</p>`)
}

function expertSuspended(p: any): string {
  return wrap(`Suspension temporaire de votre compte`,
    `<h1 style="${h1S}">Suspension temporaire</h1>` +
    `<p style="${textS}">Bonjour ${p.expert_name},</p>` +
    `<p style="${textS}">Votre compte expert a été temporairement suspendu jusqu'au ${p.suspension_until}.</p>` +
    `<p style="${detailS}">Motif : ${p.suspension_reason}</p><br/>` +
    `<p style="${textS}">Pendant cette période, vous ne pouvez pas accéder aux tâches d'annotation. Les tâches en cours ont été réassignées.</p>` +
    `<p style="${textS}">Si vous souhaitez contester cette décision, veuillez nous contacter.</p>`)
}

function clientWelcome(p: any): string {
  return wrap(`Bienvenue sur ${SITE_NAME}`,
    `<h1 style="${h1S}">Bienvenue sur ${SITE_NAME}</h1>` +
    `<p style="${textS}">Bonjour ${p.client_name},</p>` +
    `<p style="${textS}">Votre compte entreprise a été créé sur ${SITE_NAME}.</p>` +
    `<p style="${textS}">Vous pouvez dès maintenant créer votre premier projet d'annotation et commencer à exploiter notre réseau d'experts certifiés.</p>` +
    `<a href="${SITE_URL}/client/dashboard" style="${btnS}">Créer mon premier projet</a>`)
}

function clientProjectStarted(p: any): string {
  const cur = p.currency || 'USD'
  return wrap(`Projet lancé — ${p.project_name}`,
    `<h1 style="${h1S}">Projet lancé</h1>` +
    `<p style="${textS}">Bonjour ${p.client_name},</p>` +
    `<p style="${textS}">Votre projet « ${p.project_name} » est désormais actif.</p>` +
    `<p style="${detailS}">Domaine : ${p.domain_label}</p>` +
    `<p style="${detailS}">Type de tâche : ${p.task_type_label}</p>` +
    `<p style="${detailS}">Nombre de tâches : ${p.total_tasks}</p>` +
    `<p style="${detailS}">Coût estimé : ${p.estimated_cost} ${cur}</p>` +
    `<p style="${detailS}">Livraison estimée : ${p.estimated_date}</p><br/>` +
    `<p style="${textS}">Les tâches sont en cours de distribution auprès de nos experts certifiés. Vous pouvez suivre l'avancement en temps réel depuis votre dashboard.</p>` +
    `<a href="${SITE_URL}/client/dashboard" style="${btnS}">Suivre mon projet</a>`)
}

function clientProjectCompleted(p: any): string {
  return wrap(`Projet terminé — ${p.project_name}`,
    `<h1 style="${h1S}">Projet terminé</h1>` +
    `<p style="${textS}">Bonjour ${p.client_name},</p>` +
    `<p style="${textS}">Votre projet « ${p.project_name} » est terminé.</p>` +
    `<p style="${detailS}">Tâches complétées : ${p.completed_tasks}</p>` +
    `<p style="${detailS}">Alpha moyen : ${p.mean_alpha}</p>` +
    `<p style="${detailS}">Tâches auto-validées (α ≥ 0.80) : ${p.auto_validated_count}</p>` +
    `<p style="${detailS}">Tâches vérifiées manuellement : ${p.human_reviewed_count}</p><br/>` +
    `<p style="${textS}">Vous pouvez télécharger votre dataset depuis votre dashboard ou via l'API.</p>` +
    `<a href="${SITE_URL}/client/dashboard" style="${btnS}">Télécharger le dataset</a>`)
}

function clientInvoice(p: any): string {
  const cur = p.currency || 'USD'
  return wrap(`Facture ${SITE_NAME} — ${p.invoice_number}`,
    `<h1 style="${h1S}">Facture disponible</h1>` +
    `<p style="${textS}">Bonjour ${p.client_name},</p>` +
    `<p style="${textS}">Une nouvelle facture est disponible.</p>` +
    `<p style="${detailS}">Numéro : ${p.invoice_number}</p>` +
    `<p style="${detailS}">Projet : ${p.project_name}</p>` +
    `<p style="${detailS}">Montant : ${p.amount} ${cur}</p>` +
    `<p style="${detailS}">Échéance : ${p.due_date}</p><br/>` +
    `<a href="${SITE_URL}/client/dashboard" style="${btnS}">Voir la facture</a>`)
}

function clientQualityAlert(p: any): string {
  return wrap(`Alerte qualité — ${p.project_name}`,
    `<h1 style="${h1S}">Alerte qualité</h1>` +
    `<p style="${textS}">Bonjour ${p.client_name},</p>` +
    `<p style="${textS}">L'indice de fiabilité (Krippendorff's Alpha) de votre projet « ${p.project_name} » est actuellement de ${p.current_alpha}, en dessous du seuil optimal de 0.80.</p>` +
    `<p style="${textS}">Cela signifie qu'un nombre plus élevé de tâches nécessite une vérification supplémentaire. Notre équipe a été notifiée et des mesures correctives sont en cours (recalibration des annotateurs, réassignation des tâches flaggées).</p>` +
    `<p style="${textS}">Aucune action de votre part n'est requise. Nous vous tiendrons informé de l'évolution.</p>`)
}

// ─── Template Registry ──────────────────────────────────────
const TEMPLATES: Record<string, { render: (d: any) => string; subject: (d: any) => string }> = {
  expert_welcome: { render: expertWelcome, subject: () => `Bienvenue sur ${SITE_NAME}` },
  expert_certification_passed: { render: expertCertPassed, subject: (d) => `Certification obtenue — Domaine ${d.domain_label || d.domain}` },
  expert_certification_failed: { render: expertCertFailed, subject: (d) => `Résultat de votre certification — Domaine ${d.domain_label || d.domain}` },
  expert_task_available: { render: expertTaskAvailable, subject: (d) => `Nouvelles tâches disponibles — ${d.domain_label || d.domain}` },
  expert_payout_sent: { render: expertPayoutSent, subject: (d) => `Paiement effectué — ${d.amount} ${d.currency || 'USD'}` },
  expert_warning: { render: expertWarning, subject: () => `Avertissement concernant vos annotations` },
  expert_suspended: { render: expertSuspended, subject: () => `Suspension temporaire de votre compte` },
  client_welcome: { render: clientWelcome, subject: () => `Bienvenue sur ${SITE_NAME}` },
  client_project_started: { render: clientProjectStarted, subject: (d) => `Projet lancé — ${d.project_name}` },
  client_project_completed: { render: clientProjectCompleted, subject: (d) => `Projet terminé — ${d.project_name}` },
  client_invoice: { render: clientInvoice, subject: (d) => `Facture ${SITE_NAME} — ${d.invoice_number}` },
  client_quality_alert: { render: clientQualityAlert, subject: (d) => `Alerte qualité — ${d.project_name}` },
}

// ─── Constants ──────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SENDER_DOMAIN = 'notify.steftalent.fr'
const FROM_DOMAIN = 'steftalent.fr'

// ─── Handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json()
    const { action } = body

    if (action === 'process_queue') {
      const { data: pending } = await supabase
        .from('rlhf_email_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50)

      if (!pending?.length) {
        return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      let processed = 0
      for (const email of pending) {
        try {
          const tmpl = TEMPLATES[email.template]
          if (!tmpl) {
            await supabase.from('rlhf_email_queue').update({ status: 'failed', error_message: `Unknown template: ${email.template}` }).eq('id', email.id)
            continue
          }

          const vars = email.variables || {}
          const html = tmpl.render(vars)
          const subject = tmpl.subject(vars)

          await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: email.id,
              to: email.recipient_email,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text: subject,
              purpose: 'transactional',
              label: email.template,
              queued_at: new Date().toISOString(),
            },
          })

          await supabase.from('rlhf_email_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', email.id)
          processed++
        } catch (e: any) {
          const retryCount = (email.retry_count || 0) + 1
          const newStatus = retryCount >= 3 ? 'failed' : 'pending'
          await supabase.from('rlhf_email_queue').update({
            status: newStatus,
            retry_count: retryCount,
            error_message: e.message,
          }).eq('id', email.id)
        }
      }

      return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Direct send (for edge functions calling this)
    const { template, to, data: templateData } = body
    if (!template || !to) {
      return new Response(JSON.stringify({ error: 'Missing template or to' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: insertErr } = await supabase.from('rlhf_email_queue').insert({
      recipient_email: to,
      recipient_name: templateData?.expert_name || templateData?.client_name || '',
      template,
      variables: templateData || {},
    })

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, queued: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    console.error('RLHF email error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
