import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// H-86 — Paiement effectué annotateur
interface AnnotatorPaymentProps {
  firstName: string
  amount: number
  currency: string
  method: string
  period: string
  tasksCount: number
  bonusAmount?: number
  reference?: string
  siteUrl?: string
}

export const AnnotatorPaymentEmail: React.FC<AnnotatorPaymentProps> = ({
  firstName = 'Annotateur',
  amount = 0,
  currency = 'USD',
  method = 'Virement',
  period = '',
  tasksCount = 0,
  bonusAmount = 0,
  reference = '',
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
          <h1 style={styles.heading}>💰 Paiement de {amount}{currency === 'USD' ? '$' : currency}</h1>
          <p style={styles.paragraph}>
            {firstName}, ton paiement a été traité.
          </p>
          <div style={styles.resultBox}>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Montant :</span> {amount}{currency === 'USD' ? '$' : ` ${currency}`}</p>
            {bonusAmount > 0 && (
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Dont bonus qualité :</span> +{bonusAmount}$</p>
            )}
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Période :</span> {period}</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Tâches :</span> {tasksCount} validées</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Méthode :</span> {method}</p>
            {reference && (
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Référence :</span> {reference}</p>
            )}
          </div>
          <p style={styles.paragraph}>
            Le virement sera visible sous 2-5 jours ouvrés selon ta banque.
          </p>
          <div style={styles.ctaSection}>
            <a href={`${siteUrl}/expert/earnings`} style={styles.ctaButton}>Voir mon historique</a>
          </div>
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
