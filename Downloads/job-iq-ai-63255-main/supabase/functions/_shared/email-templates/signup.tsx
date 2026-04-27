/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Clique sur le lien pour activer ton compte STEF.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logo}>S.</Text>
          <Text style={styles.logoSub}>{SITE_NAME}</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Confirme ton email</Heading>
          <Text style={styles.paragraph}>
            Clique sur le bouton ci-dessous pour activer ton compte STEF.
          </Text>
          <Section style={styles.ctaSection}>
            <Button style={styles.ctaButton} href={confirmationUrl}>
              Confirmer mon email
            </Button>
          </Section>
          <Text style={styles.smallText}>
            Ce lien expire dans 24 heures.
            Si tu n'as pas créé de compte sur STEF, ignore cet email.
          </Text>
        </Section>
        <Section style={styles.footer}>
          <Hr style={styles.footerDivider} />
          <Text style={styles.footerText}>
            {SITE_NAME} •{' '}
            <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link>
          </Text>
          <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
