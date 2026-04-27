import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// H-85 — Changement de tier annotateur
interface AnnotatorTierChangeProps {
  firstName: string
  oldTier: string
  newTier: string
  direction: 'up' | 'down'
  newRate?: number
  newQuota?: number
  siteUrl?: string
}

export const AnnotatorTierChangeEmail: React.FC<AnnotatorTierChangeProps> = ({
  firstName = 'Annotateur',
  oldTier = '',
  newTier = '',
  direction = 'up',
  newRate = 0,
  newQuota = 0,
  siteUrl = SITE_URL,
}) => {
  const isPromotion = direction === 'up'

  return (
    <html>
      <body style={styles.main}>
        <div style={styles.container}>
          <div style={styles.header}>
            <p style={styles.logo}>{SITE_NAME}</p>
            <p style={styles.logoSub}>Data Quality</p>
          </div>
          <div style={styles.card}>
            <h1 style={styles.heading}>
              {isPromotion ? `🏆 Tu passes ${newTier} !` : `Changement de tier : ${newTier}`}
            </h1>
            <p style={styles.paragraph}>
              {isPromotion
                ? `${firstName}, ta qualité et ta fiabilité t'ont permis de monter de ${oldTier} à ${newTier}. Bravo !`
                : `${firstName}, suite à une baisse de précision, ton tier passe de ${oldTier} à ${newTier}.`}
            </p>

            <div style={styles.resultBox}>
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Nouveau tier :</span> {newTier}</p>
              {newRate > 0 && (
                <p style={styles.scoreRow}><span style={styles.scoreLabel}>Nouveau taux :</span> {newRate}$ / tâche</p>
              )}
              {newQuota > 0 && (
                <p style={styles.scoreRow}><span style={styles.scoreLabel}>Quota quotidien :</span> {newQuota} tâches</p>
              )}
            </div>

            {isPromotion ? (
              <p style={styles.paragraph}>
                Tu as maintenant accès à plus de tâches, un taux plus élevé, et une priorité sur les nouveaux projets.
              </p>
            ) : (
              <p style={styles.paragraph}>
                Améliore ta précision pour retrouver ton tier précédent. Revois les guidelines et les gold tasks.
              </p>
            )}

            <div style={styles.ctaSection}>
              <a href={`${siteUrl}/expert/annotations`} style={styles.ctaButton}>Voir mes tâches</a>
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
}
