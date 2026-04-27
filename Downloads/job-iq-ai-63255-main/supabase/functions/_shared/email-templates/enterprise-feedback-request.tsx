import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// E-59 — Demande de feedback beta J+30
interface EnterpriseFeedbackRequestProps {
  firstName: string
  company: string
  siteUrl?: string
}

export const EnterpriseFeedbackRequestEmail: React.FC<EnterpriseFeedbackRequestProps> = ({
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
          <h1 style={styles.heading}>Votre avis compte, {firstName}</h1>
          <p style={styles.paragraph}>
            Cela fait un mois que {company} utilise {SITE_NAME} en beta. Nous aimerions avoir votre retour pour améliorer la plateforme.
          </p>
          <p style={styles.paragraph}>
            3 questions rapides (2 min) :
          </p>
          <div style={styles.resultBox}>
            <p style={styles.checkItem}>1. La qualité des profils correspond-elle à vos attentes ?</p>
            <p style={styles.checkItem}>2. Le processus de mise en relation est-il fluide ?</p>
            <p style={styles.checkItem}>3. Qu'est-ce qu'on pourrait améliorer en priorité ?</p>
          </div>
          <p style={styles.paragraph}>
            Répondez directement à cet email — chaque retour est lu par l'équipe fondatrice.
          </p>
          <div style={styles.ctaSection}>
            <a href={`mailto:contact@steftalent.fr?subject=Feedback beta ${company}`} style={styles.ctaButton}>
              Donner mon feedback
            </a>
          </div>
          <p style={styles.paragraph}>Merci pour votre confiance.</p>
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
