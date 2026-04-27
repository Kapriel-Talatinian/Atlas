import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// H-81 — Nouveau projet disponible
interface AnnotatorProjectProps {
  firstName: string
  projectName: string
  domain: string
  languages: string[]
  estimatedTasks: number
  ratePerTask: number
  deadline?: string
  siteUrl?: string
}

export const AnnotatorProjectEmail: React.FC<AnnotatorProjectProps> = ({
  firstName = 'Annotateur',
  projectName = '',
  domain = '',
  languages = [],
  estimatedTasks = 0,
  ratePerTask = 0,
  deadline = '',
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
          <h1 style={styles.heading}>Nouveau projet disponible</h1>
          <p style={styles.paragraph}>
            {firstName}, un nouveau projet d'annotation correspond à ton profil.
          </p>
          <div style={styles.resultBox}>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Projet :</span> {projectName}</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Domaine :</span> {domain}</p>
            {languages.length > 0 && (
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Langues :</span> {languages.join(', ')}</p>
            )}
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Tâches estimées :</span> ~{estimatedTasks}</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Rémunération :</span> {ratePerTask}$ / tâche</p>
            {deadline && (
              <p style={styles.scoreRow}><span style={styles.scoreLabel}>Deadline :</span> {deadline}</p>
            )}
          </div>
          <div style={styles.ctaSection}>
            <a href={`${siteUrl}/expert/annotations`} style={styles.ctaButton}>Voir le projet</a>
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
