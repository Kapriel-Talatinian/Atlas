import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// H-84 — Alerte qualité annotateur
interface AnnotatorQualityAlertProps {
  firstName: string
  projectName: string
  currentAccuracy: number
  threshold: number
  warningLevel: 'warning' | 'critical'
  consecutiveFailures?: number
  siteUrl?: string
}

export const AnnotatorQualityAlertEmail: React.FC<AnnotatorQualityAlertProps> = ({
  firstName = 'Annotateur',
  projectName = '',
  currentAccuracy = 0,
  threshold = 80,
  warningLevel = 'warning',
  consecutiveFailures = 0,
  siteUrl = SITE_URL,
}) => {
  const isCritical = warningLevel === 'critical'

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
              {isCritical ? `🔴 Alerte qualité critique` : `⚠️ Alerte qualité`}
            </h1>
            <p style={styles.paragraph}>
              {firstName}, ta précision sur le projet <strong>{projectName}</strong> est passée en dessous du seuil.
            </p>
            <div style={{ ...styles.resultBox, borderColor: isCritical ? colors.error : colors.warning }}>
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Précision actuelle :</span> {currentAccuracy}%</p>
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Seuil requis :</span> {threshold}%</p>
              {consecutiveFailures > 0 && (
                <p style={styles.scoreRow}><span style={styles.scoreLabel}>Gold tasks échouées consécutives :</span> {consecutiveFailures}</p>
              )}
            </div>

            {isCritical ? (
              <p style={styles.paragraph}>
                Ton accès au projet a été suspendu. Contacte le lead du projet pour discuter d'une re-calibration.
              </p>
            ) : (
              <p style={styles.paragraph}>
                Revois les guidelines du projet et fais attention aux prochaines gold tasks. Si ta précision ne s'améliore pas, ton accès pourrait être suspendu.
              </p>
            )}

            <div style={styles.ctaSection}>
              <a href={`${siteUrl}/expert/annotations`} style={styles.ctaButton}>
                {isCritical ? 'Contacter le support' : 'Revoir les guidelines'}
              </a>
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
