import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// H-83 — Feedback performance hebdo annotateur
interface AnnotatorWeeklyPerformanceProps {
  firstName: string
  tasksCompleted: number
  accuracy: number
  accuracyTrend: 'up' | 'down' | 'stable'
  goldTasksAccuracy: number
  earnings: number
  rank?: number
  totalAnnotators?: number
  tier: string
  siteUrl?: string
}

export const AnnotatorWeeklyPerformanceEmail: React.FC<AnnotatorWeeklyPerformanceProps> = ({
  firstName = 'Annotateur',
  tasksCompleted = 0,
  accuracy = 0,
  accuracyTrend = 'stable',
  goldTasksAccuracy = 0,
  earnings = 0,
  rank,
  totalAnnotators,
  tier = 'standard',
  siteUrl = SITE_URL,
}) => {
  const trendEmoji = accuracyTrend === 'up' ? '📈' : accuracyTrend === 'down' ? '📉' : '➡️'

  return (
    <html>
      <body style={styles.main}>
        <div style={styles.container}>
          <div style={styles.header}>
            <p style={styles.logo}>{SITE_NAME}</p>
            <p style={styles.logoSub}>Data Quality</p>
          </div>
          <div style={styles.card}>
            <h1 style={styles.heading}>Ta semaine en chiffres</h1>
            <p style={styles.paragraph}>{firstName}, voici ton résumé hebdomadaire.</p>

            <div style={styles.resultBox}>
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Tâches complétées :</span> {tasksCompleted}</p>
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Précision globale :</span> {accuracy}% {trendEmoji}</p>
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Précision gold tasks :</span> {goldTasksAccuracy}%</p>
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Gains cette semaine :</span> {earnings}$</p>
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Tier :</span> {tier}</p>
              {rank && totalAnnotators && (
                <p style={styles.scoreRow}><span style={styles.scoreLabel}>Classement :</span> #{rank}/{totalAnnotators}</p>
              )}
            </div>

            {accuracyTrend === 'down' && (
              <p style={{ ...styles.paragraph, color: colors.warning }}>
                Ta précision a baissé cette semaine. Revois les guidelines des projets actifs pour rester au-dessus du seuil.
              </p>
            )}

            <div style={styles.ctaSection}>
              <a href={`${siteUrl}/expert/annotations`} style={styles.ctaButton}>Voir mes statistiques</a>
            </div>
          </div>
          <div style={styles.footer}>
            <p style={styles.footerText}>
              {SITE_NAME} • <a href={siteUrl} style={styles.footerLink}>{siteUrl.replace('https://', '')}</a>
            </p>
            <p style={styles.footerText}>
              <a href={`${siteUrl}/email-preferences`} style={styles.footerLink}>Gérer mes préférences</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
