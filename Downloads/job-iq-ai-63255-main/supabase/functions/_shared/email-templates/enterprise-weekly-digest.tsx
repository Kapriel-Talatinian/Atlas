import * as React from 'npm:react@18.3.1'
import { styles, colors, SITE_URL, SITE_NAME } from './styles.ts'

// E-58 — Digest hebdo nouveaux talents
interface EnterpriseWeeklyDigestProps {
  firstName: string
  company: string
  newTalentsCount: number
  topStacks: string[]
  highlightProfiles?: Array<{ code: string; stack: string; level: string; score: number }>
  siteUrl?: string
}

export const EnterpriseWeeklyDigestEmail: React.FC<EnterpriseWeeklyDigestProps> = ({
  firstName = 'Responsable',
  company = '',
  newTalentsCount = 0,
  topStacks = [],
  highlightProfiles = [],
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
          <h1 style={styles.heading}>
            {newTalentsCount} nouveaux talents cette semaine
          </h1>
          <p style={styles.paragraph}>
            Bonjour {firstName}, voici les derniers développeurs certifiés sur {SITE_NAME} qui pourraient intéresser {company}.
          </p>

          {topStacks.length > 0 && (
            <div style={styles.resultBox}>
              <p style={{ ...styles.scoreRow, ...styles.scoreLabel }}>Stacks les plus représentées :</p>
              {topStacks.map((stack, i) => (
                <p key={i} style={styles.scoreRow}>• {stack}</p>
              ))}
            </div>
          )}

          {highlightProfiles.length > 0 && (
            <>
              <p style={{ ...styles.paragraph, fontWeight: '600' as const }}>Profils à découvrir :</p>
              {highlightProfiles.map((p, i) => (
                <div key={i} style={{ ...styles.resultBox, marginBottom: '8px' }}>
                  <p style={{ ...styles.scoreRow, ...styles.scoreLabel }}>{p.code} — {p.stack}</p>
                  <p style={styles.scoreRow}>Niveau : {p.level} • Score : {p.score}/100</p>
                </div>
              ))}
            </>
          )}

          <div style={styles.ctaSection}>
            <a href={`${siteUrl}/client`} style={styles.ctaButton}>Voir tous les profils</a>
          </div>
        </div>
        <div style={styles.footer}>
          <p style={styles.footerText}>
            {SITE_NAME} • <a href={siteUrl} style={styles.footerLink}>{siteUrl.replace('https://', '')}</a>
          </p>
          <p style={styles.footerText}>
            <a href={`${siteUrl}/email-preferences`} style={styles.footerLink}>Gérer mes préférences</a> • <a href={`${siteUrl}/unsubscribe`} style={styles.footerLink}>Se désinscrire</a>
          </p>
        </div>
      </div>
    </body>
  </html>
)
