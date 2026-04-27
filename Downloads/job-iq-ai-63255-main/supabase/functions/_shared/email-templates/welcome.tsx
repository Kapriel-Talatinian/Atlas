/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface WelcomeEmailProps {
  firstName: string
  siteUrl?: string
}

export const WelcomeEmail = ({ firstName, siteUrl = SITE_URL }: WelcomeEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Ton compte est créé. Prochaine étape : complète ton profil.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logo}>S.</Text>
          <Text style={styles.logoSub}>{SITE_NAME}</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Bienvenue {firstName},</Heading>
          <Text style={styles.paragraph}>
            Ton compte STEF est créé.
          </Text>
          <Text style={styles.paragraph}>
            STEF évalue tes compétences techniques en 45 minutes et te délivre un certificat vérifiable par les entreprises.
          </Text>
          <Text style={styles.paragraph}>
            Prochaine étape : complète ton profil pour accéder à l'assessment.
          </Text>
          <Section style={styles.ctaSection}>
            <Button style={styles.ctaButton} href={`${siteUrl}/expert/onboarding`}>
              Compléter mon profil
            </Button>
          </Section>
          <Hr style={styles.divider} />
          <Text style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>
            Ce qui t'attend :
          </Text>
          <Text style={styles.checkItem}>1. Complète ton profil (2 min)</Text>
          <Text style={styles.checkItem}>2. Passe l'assessment (45 min)</Text>
          <Text style={styles.checkItem}>3. Reçois ton certificat</Text>
          <Text style={styles.checkItem}>4. Sois visible par les entreprises</Text>
          <Text style={{ ...styles.smallText, marginTop: '16px' }}>
            L'assessment est gratuit. Tu peux le passer quand tu veux.
          </Text>
        </Section>
        <Section style={styles.footer}>
          <Hr style={styles.footerDivider} />
          <Text style={styles.footerText}>
            {SITE_NAME} •{' '}
            <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link>
          </Text>
          <Text style={styles.footerText}>
            Tu reçois cet email car tu as créé un compte sur STEF.
          </Text>
          <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default WelcomeEmail
