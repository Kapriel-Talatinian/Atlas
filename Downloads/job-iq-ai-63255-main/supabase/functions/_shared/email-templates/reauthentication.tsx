/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ReauthenticationEmailProps { token: string; confirmationUrl?: string }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Ton code de vérification STEF.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Vérifie ton identité</Heading>
          <Text style={styles.paragraph}>Pour confirmer cette action, entre le code ci-dessous dans l'application.</Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Text style={{ fontSize: '32px', fontWeight: 'bold' as const, color: colors.accent, letterSpacing: '8px', margin: '0', fontFamily: 'monospace' }}>{token}</Text>
          </Section>
          <Text style={styles.smallText}>Ce code expire dans 10 minutes. Si tu n'as pas demandé cette vérification, sécurise ton compte immédiatement.</Text>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ReauthenticationEmail
