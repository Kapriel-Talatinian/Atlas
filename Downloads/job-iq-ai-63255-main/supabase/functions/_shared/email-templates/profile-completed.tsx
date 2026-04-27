/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ProfileCompletedEmailProps {
  firstName: string
  stack: string
  siteUrl?: string
}

export const ProfileCompletedEmail = ({ firstName, stack, siteUrl = SITE_URL }: ProfileCompletedEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>45 minutes pour prouver tes compétences en {stack}.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logo}>S.</Text>
          <Text style={styles.logoSub}>{SITE_NAME}</Text>
        </Section>
        <Section style={styles.card}>
          <Section style={{ textAlign: 'center' as const }}>
            <Text style={{ ...styles.badge, ...styles.badgeSuccess }}>Profil complété</Text>
          </Section>
          <Heading style={{ ...styles.heading, textAlign: 'center' as const }}>
            {firstName}, ton profil est complet
          </Heading>
          <Text style={styles.paragraph}>
            Tu peux maintenant passer l'assessment STEF en {stack}.
          </Text>
          <Text style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>
            Ce qui t'attend :
          </Text>
          <Section style={styles.resultBox}>
            <Text style={styles.scoreRow}><strong>Phase 1 — QCM adaptatif (10 min)</strong></Text>
            <Text style={styles.smallText}>20 questions qui s'adaptent à ton niveau</Text>
            <Text style={{ ...styles.scoreRow, marginTop: '12px' }}><strong>Phase 2 — Challenge pratique (30 min)</strong></Text>
            <Text style={styles.smallText}>Un mini-projet réaliste en {stack}</Text>
            <Text style={{ ...styles.scoreRow, marginTop: '12px' }}><strong>Phase 3 — Code Review (5 min)</strong></Text>
            <Text style={styles.smallText}>Identifie les problèmes dans un code</Text>
          </Section>
          <Text style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>
            Conseils :
          </Text>
          <Text style={styles.checkItem}>• Installe-toi au calme, sans distraction</Text>
          <Text style={styles.checkItem}>• Assure-toi d'avoir 50 min devant toi</Text>
          <Text style={styles.checkItem}>• Connexion internet stable</Text>
          <Text style={styles.checkItem}>• Le timer démarre dès que tu commences</Text>
          <Section style={styles.ctaSection}>
            <Button style={styles.ctaButton} href={`${siteUrl}/expert/assessment`}>
              Passer l'assessment
            </Button>
          </Section>
        </Section>
        <Section style={styles.footer}>
          <Hr style={styles.footerDivider} />
          <Text style={styles.footerText}>
            {SITE_NAME} •{' '}
            <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link>
          </Text>
          <Text style={styles.footerText}>
            Tu reçois cet email car tu es inscrit sur STEF.
            {' '}
            <Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link>
          </Text>
          <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ProfileCompletedEmail
