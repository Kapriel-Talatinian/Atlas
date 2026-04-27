import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// E-55 — Talent a accepté le contact
// E-56 — Talent a décliné
// E-57 — Demande expirée
interface EnterpriseContactResponseProps {
  firstName: string
  company: string
  talentCode: string
  talentStack: string
  variant: 'accepted' | 'declined' | 'expired'
  talentEmail?: string
  talentName?: string
  siteUrl?: string
}

export const EnterpriseContactResponseEmail: React.FC<EnterpriseContactResponseProps> = ({
  firstName = 'Responsable',
  company = '',
  talentCode = '',
  talentStack = '',
  variant = 'accepted',
  talentEmail = '',
  talentName = '',
  siteUrl = SITE_URL,
}) => {
  const headingMap = {
    accepted: `Le talent ${talentCode} a accepté votre demande`,
    declined: `Le talent ${talentCode} a décliné votre demande`,
    expired: `Votre demande pour ${talentCode} a expiré`,
  }

  return (
    <html>
      <body style={styles.main}>
        <div style={styles.container}>
          <div style={styles.header}>
            <p style={styles.logo}>{SITE_NAME}</p>
            <p style={styles.logoSub}>Talent certifié</p>
          </div>
          <div style={styles.card}>
            <h1 style={styles.heading}>{headingMap[variant]}</h1>

            {variant === 'accepted' && (
              <>
                <p style={styles.paragraph}>
                  Bonne nouvelle, {firstName}. Le développeur {talentStack} que vous avez contacté a accepté d'être mis en relation avec {company}.
                </p>
                <div style={styles.resultBox}>
                  <p style={{ ...styles.scoreRow, ...styles.scoreLabel }}>Coordonnées du talent :</p>
                  <p style={styles.scoreRow}>Nom : {talentName || talentCode}</p>
                  <p style={styles.scoreRow}>Email : {talentEmail}</p>
                  <p style={styles.scoreRow}>Stack : {talentStack}</p>
                </div>
                <p style={styles.paragraph}>
                  Nous vous recommandons de prendre contact dans les 48h.
                </p>
                <div style={styles.ctaSection}>
                  <a href={`mailto:${talentEmail}`} style={styles.ctaButton}>Contacter le talent</a>
                </div>
              </>
            )}

            {variant === 'declined' && (
              <>
                <p style={styles.paragraph}>
                  {firstName}, le développeur {talentStack} ({talentCode}) a décliné votre demande de contact. Cela peut arriver — le talent n'est peut-être pas disponible en ce moment.
                </p>
                <p style={styles.paragraph}>
                  D'autres profils certifiés {talentStack} sont disponibles sur votre dashboard.
                </p>
                <div style={styles.ctaSection}>
                  <a href={`${siteUrl}/client`} style={styles.ctaButton}>Voir d'autres profils</a>
                </div>
              </>
            )}

            {variant === 'expired' && (
              <>
                <p style={styles.paragraph}>
                  {firstName}, votre demande de contact avec le talent {talentCode} ({talentStack}) n'a pas reçu de réponse dans le délai de 7 jours.
                </p>
                <p style={styles.paragraph}>
                  Vous pouvez contacter d'autres profils certifiés depuis votre dashboard.
                </p>
                <div style={styles.ctaSection}>
                  <a href={`${siteUrl}/client`} style={styles.ctaButton}>Parcourir les profils</a>
                </div>
              </>
            )}
          </div>
          <div style={styles.footer}>
            <p style={styles.footerText}>
              {SITE_NAME} • <a href={siteUrl} style={styles.footerLink}>{siteUrl.replace('https://', '')}</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
