import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// H-80 — Bienvenue annotateur
interface AnnotatorWelcomeProps {
  firstName: string
  domain: string
  languages: string[]
  siteUrl?: string
}

export const AnnotatorWelcomeEmail: React.FC<AnnotatorWelcomeProps> = ({
  firstName = 'Annotateur',
  domain = '',
  languages = [],
  siteUrl = SITE_URL,
}) => (
  <html>
    <body style={styles.main}>
      <div style={styles.container}>
        <div style={styles.header}>
          <p style={styles.logo}>{SITE_NAME}</p>
          <p style={styles.logoSub}>Data Quality</p>
        </div>
        <div style={styles.card}>
          <h1 style={styles.heading}>Bienvenue dans l'équipe, {firstName}</h1>
          <p style={styles.paragraph}>
            Tu es désormais annotateur {SITE_NAME} dans le domaine <strong>{domain}</strong>.
            {languages.length > 0 && ` Langues : ${languages.join(', ')}.`}
          </p>
          <p style={styles.paragraph}>
            Voici comment ça fonctionne :
          </p>
          <div style={styles.resultBox}>
            <p style={styles.checkItem}>1. <strong>Calibration</strong> — Tu commences par des tâches d'entraînement avec feedback immédiat</p>
            <p style={styles.checkItem}>2. <strong>Production</strong> — Tu reçois des tâches réelles une fois calibré</p>
            <p style={styles.checkItem}>3. <strong>Gold tasks</strong> — Des tâches de contrôle sont insérées régulièrement pour mesurer ta qualité</p>
            <p style={styles.checkItem}>4. <strong>Paiement</strong> — Tu es payé par tâche complétée et validée</p>
          </div>
          <div style={styles.ctaSection}>
            <a href={`${siteUrl}/expert/annotations`} style={styles.ctaButton}>Commencer la calibration</a>
          </div>
          <p style={styles.smallText}>
            Ton quota quotidien initial est limité. Il augmente avec ta précision et ta fiabilité.
          </p>
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
