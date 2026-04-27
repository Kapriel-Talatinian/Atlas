import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// E-54 — Bienvenue compte beta client
interface EnterpriseWelcomeProps {
  firstName: string
  company: string
  siteUrl?: string
}

export const EnterpriseWelcomeEmail: React.FC<EnterpriseWelcomeProps> = ({
  firstName = 'Responsable',
  company = '',
  siteUrl = SITE_URL,
}) => (
  <html>
    <body style={styles.main}>
      <div style={styles.container}>
        <div style={styles.header}>
          <p style={styles.logo}>{SITE_NAME}</p>
          <p style={styles.logoSub}>Talent certifié</p>
        </div>
        <div style={styles.card}>
          <h1 style={styles.heading}>Bienvenue sur {SITE_NAME}, {firstName}</h1>
          <p style={styles.paragraph}>
            Votre compte entreprise pour {company} est créé. Vous avez accès au dashboard beta où vous pouvez :
          </p>
          <div style={styles.resultBox}>
            <p style={styles.checkItem}>✓ Parcourir les profils certifiés</p>
            <p style={styles.checkItem}>✓ Demander un contact avec un talent</p>
            <p style={styles.checkItem}>✓ Suivre vos demandes en cours</p>
            <p style={styles.checkItem}>✓ Consulter les résultats d'assessment vérifiés</p>
          </div>
          <div style={styles.ctaSection}>
            <a href={`${siteUrl}/client`} style={styles.ctaButton}>Accéder au dashboard</a>
          </div>
          <p style={styles.paragraph}>
            Pendant la beta, votre feedback est précieux. N'hésitez pas à répondre à cet email avec vos retours.
          </p>
          <p style={styles.paragraph}>L'équipe {SITE_NAME}</p>
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
