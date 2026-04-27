import * as React from 'npm:react@18.3.1'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

const specialtyLabels: Record<string, string> = {
  backend: 'Backend', 'Backend Node.js': 'Backend Node.js',
  frontend: 'Frontend', 'Frontend React': 'Frontend React',
  fullstack: 'Fullstack', data: 'Data / IA', devops: 'Cloud / DevOps', mobile: 'Mobile',
}

export function PcBridgeEmail({ specialty, variant }: { specialty?: string; variant?: string }) {
  const specLabel = specialty ? (specialtyLabels[specialty] || specialty) : 'technique'
  const isJ1 = variant === 'j1'
  const isJ3 = variant === 'j3'

  const title = isJ3
    ? `La cohorte ${new Date().toLocaleString('fr-FR', { month: 'long' })} ${new Date().getFullYear()} se termine bientôt`
    : isJ1
      ? "Tu n'as pas encore passé ton évaluation"
      : 'Ton évaluation est prête'

  const intro = isJ3
    ? `Les développeurs qui passent leur évaluation ce mois-ci sont inclus dans le classement mensuel. Les meilleurs scores gagnent en visibilité auprès des entreprises.\n\nTon profil est créé. Ta spécialité (${specLabel}) est enregistrée. Il ne te manque que ton score.`
    : isJ1
      ? `Tu t'es inscrit hier sur STEF et tu as choisi la spécialité ${specLabel}.\n\nTon évaluation est prête — il te suffit d'ouvrir ce lien depuis un ordinateur :`
      : `Tu t'es inscrit sur STEF depuis ton téléphone. L'évaluation technique nécessite un ordinateur avec un éditeur de code.\n\nOuvre cet email depuis un PC (au bureau, au cybercafé, à l'université, chez un ami) et clique sur le bouton ci-dessous.`

  const buttonText = isJ3 ? 'Passer mon évaluation sur PC' : 'Lancer mon évaluation'

  return (
    <html>
      <body style={styles.main}>
        <div style={styles.container}>
          {/* Header */}
          <div style={styles.header}>
            <p style={styles.logo}>S.</p>
            <p style={styles.logoSub}>{SITE_NAME}</p>
          </div>

          {/* Card */}
          <div style={styles.card}>
            {/* Specialty badge */}
            {specialty && (
              <div style={{ textAlign: 'center' as const, marginBottom: 16 }}>
                <span style={{ ...styles.badge, ...styles.badgeAccent }}>
                  {specLabel}
                </span>
              </div>
            )}

            <h1 style={{ ...styles.heading, textAlign: 'center' as const }}>{title}</h1>

            {intro.split('\n\n').map((p, i) => (
              <p key={i} style={styles.paragraph}>{p}</p>
            ))}

            {/* CTA */}
            <div style={styles.ctaSection}>
              <a href={`${SITE_URL}/expert/test?specialty=${specialty || ''}`} style={styles.ctaButton}>
                {buttonText}
              </a>
            </div>

            {!isJ3 && (
              <>
                <hr style={styles.divider} />
                <p style={{ ...styles.smallText, fontWeight: '600' as const, color: colors.textPrimary }}>
                  Infos pratiques :
                </p>
                <p style={styles.checkItem}>• Durée : 30-45 minutes</p>
                <p style={styles.checkItem}>• Résultats immédiats</p>
                <p style={styles.checkItem}>• Certification vérifiable si tu réussis</p>
                <p style={styles.checkItem}>• Navigateur récent requis (Chrome, Firefox, Edge)</p>
              </>
            )}

            {isJ1 && (
              <p style={{ ...styles.paragraph, marginTop: 16 }}>
                Astuce : tu peux passer le test depuis n'importe quel PC avec un navigateur récent — au bureau, au cybercafé, à l'université.
              </p>
            )}

            {isJ3 && (
              <>
                <p style={{ ...styles.paragraph, textAlign: 'center' as const, marginTop: 16 }}>
                  30-45 min · Score immédiat · Certification vérifiable
                </p>
                <hr style={styles.divider} />
                <p style={styles.paragraph}>
                  Si tu as une question ou un problème, réponds à cet email — je lis tout.
                </p>
                <p style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>
                  L'équipe STEF
                </p>
              </>
            )}

            <p style={{ ...styles.smallText, marginTop: 16, textAlign: 'center' as const }}>
              Tu peux aussi te connecter directement sur{' '}
              <a href={SITE_URL} style={{ color: colors.accent, textDecoration: 'none' }}>steftalent.fr</a>
              {' '}depuis ton PC.
            </p>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <p style={styles.footerText}>
              © {new Date().getFullYear()} {SITE_NAME} · Tous droits réservés
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
