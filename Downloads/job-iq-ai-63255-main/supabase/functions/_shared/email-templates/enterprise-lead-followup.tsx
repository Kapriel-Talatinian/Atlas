import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// E-52 — Relance lead J+7
// E-53 — Relance lead J+30 (dernière)
interface EnterpriseLeadFollowupProps {
  firstName: string
  company: string
  variant: 'day7' | 'day30'
  stacks?: string
  siteUrl?: string
}

export const EnterpriseLeadFollowupEmail: React.FC<EnterpriseLeadFollowupProps> = ({
  firstName = 'Responsable',
  company = '',
  variant = 'day7',
  stacks = '',
  siteUrl = SITE_URL,
}) => {
  const isDay30 = variant === 'day30'

  return (
    <html>
      <body style={styles.main}>
        <div style={styles.container}>
          <div style={styles.header}>
            <p style={styles.logo}>{SITE_NAME}</p>
            <p style={styles.logoSub}>Talent certifié</p>
          </div>
          <div style={styles.card}>
            <h1 style={styles.heading}>
              {isDay30 ? `${firstName}, on reste disponible` : `${firstName}, avez-vous des questions ?`}
            </h1>
            <p style={styles.paragraph}>
              {isDay30
                ? `Vous avez soumis une demande sur STEF il y a un mois pour ${company}. Nos profils certifiés en ${stacks || 'développement'} sont toujours disponibles.`
                : `Vous avez soumis une demande sur STEF il y a une semaine pour ${company}. Nous voulions nous assurer que vous aviez bien reçu notre sélection de profils.`}
            </p>
            {isDay30 ? (
              <p style={styles.paragraph}>
                C'est notre dernier message à ce sujet. Si vous souhaitez reprendre la conversation, répondez simplement à cet email ou planifiez un appel.
              </p>
            ) : (
              <p style={styles.paragraph}>
                Si vous avez des questions sur les profils, le processus ou les tarifs, n'hésitez pas à répondre directement à cet email.
              </p>
            )}
            <div style={styles.ctaSection}>
              <a href={`${siteUrl}/enterprise`} style={styles.ctaButton}>
                {isDay30 ? 'Reprendre la conversation' : 'Voir les profils disponibles'}
              </a>
            </div>
            {isDay30 && (
              <p style={{ ...styles.smallText, textAlign: 'center' as const }}>
                Nous ne vous enverrons plus de relance à ce sujet.
              </p>
            )}
          </div>
          <div style={styles.footer}>
            <p style={styles.footerText}>
              {SITE_NAME} • <a href={siteUrl} style={styles.footerLink}>{siteUrl.replace('https://', '')}</a>
            </p>
            <p style={styles.footerText}>
              Vous recevez cet email suite à votre demande sur {SITE_NAME}.
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
