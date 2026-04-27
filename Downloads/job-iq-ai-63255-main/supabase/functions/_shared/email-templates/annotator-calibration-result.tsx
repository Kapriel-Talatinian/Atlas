import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// H-82 — Résultat calibration
interface AnnotatorCalibrationResultProps {
  firstName: string
  projectName: string
  passed: boolean
  accuracy: number
  threshold: number
  totalTasks: number
  correctTasks: number
  feedback?: string
  siteUrl?: string
}

export const AnnotatorCalibrationResultEmail: React.FC<AnnotatorCalibrationResultProps> = ({
  firstName = 'Annotateur',
  projectName = '',
  passed = false,
  accuracy = 0,
  threshold = 80,
  totalTasks = 0,
  correctTasks = 0,
  feedback = '',
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
          <h1 style={styles.heading}>
            {passed ? `✅ Calibration réussie — ${projectName}` : `Résultat calibration — ${projectName}`}
          </h1>
          <div style={styles.resultBox}>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Précision :</span> {accuracy}%</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Seuil requis :</span> {threshold}%</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Tâches :</span> {correctTasks}/{totalTasks} correctes</p>
          </div>

          {passed ? (
            <>
              <p style={styles.paragraph}>
                {firstName}, tu es calibré pour le projet <strong>{projectName}</strong>. Tu vas recevoir des tâches de production.
              </p>
              <div style={styles.ctaSection}>
                <a href={`${siteUrl}/expert/annotations`} style={styles.ctaButton}>Voir mes tâches</a>
              </div>
            </>
          ) : (
            <>
              <p style={styles.paragraph}>
                {firstName}, ta précision est en dessous du seuil requis pour ce projet. Tu peux retenter la calibration après avoir revu les guidelines.
              </p>
              {feedback && (
                <div style={styles.resultBox}>
                  <p style={{ ...styles.scoreRow, ...styles.scoreLabel }}>Feedback :</p>
                  <p style={styles.scoreRow}>{feedback}</p>
                </div>
              )}
              <div style={styles.ctaSection}>
                <a href={`${siteUrl}/expert/annotations`} style={styles.ctaButton}>Revoir les guidelines</a>
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
