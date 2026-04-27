import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// A-73 — Rapport quotidien plateforme
interface AdminDailyReportProps {
  date: string
  newSignups: number
  assessmentsCompleted: number
  certifiedCount: number
  activeAnnotators: number
  annotationsCompleted: number
  newLeads: number
  contactRequests: number
  emailsSent: number
  emailBounceRate: number
  siteUrl?: string
}

export const AdminDailyReportEmail: React.FC<AdminDailyReportProps> = ({
  date = '',
  newSignups = 0,
  assessmentsCompleted = 0,
  certifiedCount = 0,
  activeAnnotators = 0,
  annotationsCompleted = 0,
  newLeads = 0,
  contactRequests = 0,
  emailsSent = 0,
  emailBounceRate = 0,
  siteUrl = SITE_URL,
}) => (
  <html>
    <body style={styles.main}>
      <div style={styles.container}>
        <div style={styles.header}>
          <p style={styles.logo}>{SITE_NAME}</p>
          <p style={styles.logoSub}>Rapport quotidien</p>
        </div>
        <div style={styles.card}>
          <h1 style={styles.heading}>📊 Rapport du {date}</h1>

          <p style={{ ...styles.paragraph, fontWeight: '600' as const }}>Talent Pipeline</p>
          <div style={styles.resultBox}>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Nouvelles inscriptions :</span> {newSignups}</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Assessments complétés :</span> {assessmentsCompleted}</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Certifiés (Mid+) :</span> {certifiedCount}</p>
          </div>

          <p style={{ ...styles.paragraph, fontWeight: '600' as const }}>RLHF / Annotation</p>
          <div style={styles.resultBox}>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Annotateurs actifs :</span> {activeAnnotators}</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Annotations complétées :</span> {annotationsCompleted}</p>
          </div>

          <p style={{ ...styles.paragraph, fontWeight: '600' as const }}>Business</p>
          <div style={styles.resultBox}>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Nouveaux leads :</span> {newLeads}</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Demandes de contact :</span> {contactRequests}</p>
          </div>

          <p style={{ ...styles.paragraph, fontWeight: '600' as const }}>Emails</p>
          <div style={styles.resultBox}>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Emails envoyés :</span> {emailsSent}</p>
            <p style={styles.scoreRow}><span style={styles.scoreLabel}>Taux de bounce :</span> {emailBounceRate}%</p>
          </div>

          <div style={styles.ctaSection}>
            <a href={`${siteUrl}/admin`} style={styles.ctaButton}>Ouvrir le dashboard</a>
          </div>
        </div>
        <div style={styles.footer}>
          <p style={styles.footerText}>{SITE_NAME} Admin • Rapport automatique</p>
        </div>
      </div>
    </body>
  </html>
)
