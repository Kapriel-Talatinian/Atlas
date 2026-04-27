import * as React from 'npm:react@18.3.1'
import {
  Html, Head, Body, Container, Heading, Text, Button, Preview, Section, Hr,
} from 'npm:@react-email/components@0.0.22'

const ACCENT = '#7C5CFC'
const BG = '#F9FAFB'

const specialtyLabels: Record<string, string> = {
  backend: 'Backend', frontend: 'Frontend', fullstack: 'Fullstack',
  data: 'Data / IA', devops: 'Cloud / DevOps', mobile: 'Mobile',
}

interface QuizResultsEmailProps {
  score?: number
  level?: string
  specialty?: string
  correctCount?: number
  totalQuestions?: number
  avgTimeSec?: number
  resultsUrl?: string
}

export function QuizResultsEmail({
  score = 72,
  level = 'Confirmé',
  specialty = 'Backend',
  correctCount = 7,
  totalQuestions = 10,
  avgTimeSec = 22,
  resultsUrl,
}: QuizResultsEmailProps) {
  const specLabel = specialtyLabels[specialty || ''] || specialty || 'technique'

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{`Tes résultats STEF : ${score}/100 en ${specLabel}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={logo}>S.</Text>
          <Text style={logoSub}>STEF</Text>

          <Section style={badgeSection}>
            <Text style={badge}>RÉSULTATS QUIZ</Text>
          </Section>

          <Heading style={h1}>{score}/100 — {level}</Heading>

          <Section style={summaryBox}>
            <Text style={summaryLine}>Spécialité : <span style={{ fontWeight: 600, color: '#111' }}>{specLabel}</span></Text>
            <Text style={summaryLine}>Bonnes réponses : <span style={{ fontWeight: 600, color: '#111' }}>{correctCount}/{totalQuestions}</span></Text>
            <Text style={summaryLine}>Temps moyen : <span style={{ fontWeight: 600, color: '#111' }}>{avgTimeSec}s par question</span></Text>
          </Section>

          {resultsUrl && (
            <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
              <Button href={resultsUrl} style={ctaButton}>
                Voir mes résultats détaillés
              </Button>
            </Section>
          )}

          <Hr style={divider} />

          <Text style={text}>
            Pour obtenir ta certification officielle STEF, passe l'évaluation complète sur PC :
          </Text>

          <Section style={{ textAlign: 'center' as const, margin: '16px 0 32px' }}>
            <Button href="https://steftalent.fr/go" style={ctaButtonSecondary}>
              Passer l'évaluation complète
            </Button>
          </Section>

          <Text style={footer}>
            STEF — Plateforme de certification tech
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#F9FAFB', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" }
const container = { backgroundColor: '#ffffff', maxWidth: '520px', margin: '0 auto', padding: '32px 28px', borderRadius: '12px' }
const logo = { fontSize: '28px', fontWeight: '800' as const, color: ACCENT, textAlign: 'center' as const, margin: '0 0 2px' }
const logoSub = { fontSize: '10px', color: '#666', textTransform: 'uppercase' as const, letterSpacing: '3px', textAlign: 'center' as const, margin: '0 0 24px' }
const badgeSection = { textAlign: 'center' as const, margin: '0 0 16px' }
const badge = { display: 'inline-block', fontSize: '11px', fontWeight: '600' as const, color: ACCENT, backgroundColor: 'rgba(124,92,252,0.08)', padding: '4px 14px', borderRadius: '100px', letterSpacing: '0.5px' }
const h1 = { fontSize: '28px', fontWeight: '800' as const, color: '#111', textAlign: 'center' as const, margin: '0 0 24px' }
const summaryBox = { backgroundColor: '#F9FAFB', borderRadius: '10px', padding: '16px 20px', margin: '0 0 24px' }
const summaryLine = { fontSize: '14px', color: '#666', margin: '0 0 6px', lineHeight: '1.5' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 16px' }
const ctaButton = { display: 'inline-block', backgroundColor: ACCENT, color: '#ffffff', fontSize: '15px', fontWeight: '700' as const, padding: '14px 32px', borderRadius: '50px', textDecoration: 'none' }
const ctaButtonSecondary = { display: 'inline-block', backgroundColor: '#111', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, padding: '12px 28px', borderRadius: '50px', textDecoration: 'none' }
const divider = { borderColor: '#eee', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999', textAlign: 'center' as const, margin: '24px 0 0' }
