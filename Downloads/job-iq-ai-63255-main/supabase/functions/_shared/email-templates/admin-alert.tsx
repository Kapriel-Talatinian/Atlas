import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// A-70 — Nouveau lead entreprise (notification interne)
// A-71 — Alerte annotateur en difficulté
// A-72 — Alerte drift détecté
interface AdminAlertProps {
  variant: 'new_lead' | 'annotator_struggling' | 'drift_detected'
  // new_lead
  leadName?: string
  leadCompany?: string
  leadEmail?: string
  leadStacks?: string
  leadPositions?: number
  // annotator_struggling
  annotatorId?: string
  annotatorAccuracy?: number
  goldTasksPassed?: number
  goldTasksTotal?: number
  projectName?: string
  // drift_detected
  driftMetric?: string
  driftValue?: number
  driftThreshold?: number
  driftProjectName?: string
  siteUrl?: string
}

export const AdminAlertEmail: React.FC<AdminAlertProps> = ({
  variant = 'new_lead',
  leadName, leadCompany, leadEmail, leadStacks, leadPositions,
  annotatorId, annotatorAccuracy, goldTasksPassed, goldTasksTotal, projectName,
  driftMetric, driftValue, driftThreshold, driftProjectName,
  siteUrl = SITE_URL,
}) => {
  const headingMap = {
    new_lead: `🏢 Nouveau lead : ${leadCompany}`,
    annotator_struggling: `⚠️ Annotateur en difficulté`,
    drift_detected: `🔴 Drift détecté — ${driftProjectName}`,
  }

  return (
    <html>
      <body style={styles.main}>
        <div style={styles.container}>
          <div style={styles.header}>
            <p style={styles.logo}>{SITE_NAME}</p>
            <p style={styles.logoSub}>Admin Alert</p>
          </div>
          <div style={styles.card}>
            <h1 style={styles.heading}>{headingMap[variant]}</h1>

            {variant === 'new_lead' && (
              <>
                <div style={styles.resultBox}>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Contact :</span> {leadName}</p>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Entreprise :</span> {leadCompany}</p>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Email :</span> {leadEmail}</p>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Stacks :</span> {leadStacks}</p>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Postes :</span> {leadPositions}</p>
                </div>
                <div style={styles.ctaSection}>
                  <a href={`${siteUrl}/admin`} style={styles.ctaButton}>Voir dans le dashboard</a>
                </div>
              </>
            )}

            {variant === 'annotator_struggling' && (
              <>
                <p style={styles.paragraph}>
                  L'annotateur <strong>{annotatorId}</strong> a un taux de réussite gold inférieur au seuil sur le projet <strong>{projectName}</strong>.
                </p>
                <div style={styles.resultBox}>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Gold tasks :</span> {goldTasksPassed}/{goldTasksTotal} réussis</p>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Accuracy :</span> {annotatorAccuracy}%</p>
                </div>
                <p style={styles.paragraph}>
                  Action recommandée : vérifier les guidelines, envisager une re-calibration ou une suspension temporaire.
                </p>
                <div style={styles.ctaSection}>
                  <a href={`${siteUrl}/admin`} style={styles.ctaButton}>Gérer l'annotateur</a>
                </div>
              </>
            )}

            {variant === 'drift_detected' && (
              <>
                <p style={styles.paragraph}>
                  Un drift a été détecté sur le projet <strong>{driftProjectName}</strong>.
                </p>
                <div style={{ ...styles.resultBox, borderColor: colors.error }}>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Métrique :</span> {driftMetric}</p>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Valeur actuelle :</span> {driftValue}%</p>
                  <p style={styles.scoreRow}><span style={styles.scoreLabel}>Seuil :</span> {driftThreshold}%</p>
                </div>
                <p style={styles.paragraph}>
                  Vérifiez les annotations récentes et envisagez une session de re-calibration.
                </p>
                <div style={styles.ctaSection}>
                  <a href={`${siteUrl}/admin`} style={styles.ctaButton}>Voir le rapport</a>
                </div>
              </>
            )}
          </div>
          <div style={styles.footer}>
            <p style={styles.footerText}>{SITE_NAME} Admin • Email interne</p>
          </div>
        </div>
      </body>
    </html>
  )
}
