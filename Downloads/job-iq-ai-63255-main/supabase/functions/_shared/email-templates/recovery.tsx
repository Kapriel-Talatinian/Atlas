/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface RecoveryEmailProps { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Ce lien expire dans 1 heure.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Réinitialisation du mot de passe</Heading>
          <Text style={styles.paragraph}>Tu as demandé à réinitialiser ton mot de passe. Clique ci-dessous pour en choisir un nouveau.</Text>
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={confirmationUrl}>Réinitialiser</Button></Section>
          <Text style={styles.smallText}>Ce lien expire dans 1 heure. Si tu n'as pas fait cette demande, ignore cet email. Ton compte est toujours sécurisé.</Text>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default RecoveryEmail
