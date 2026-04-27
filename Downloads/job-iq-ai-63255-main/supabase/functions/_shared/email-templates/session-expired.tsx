/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface SessionExpiredEmailProps {
  firstName: string
  stack: string
  siteUrl?: string
}

export const SessionExpiredEmail = ({ firstName, stack, siteUrl = SITE_URL }: SessionExpiredEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Le timer a expiré. Tes résultats sont en cours de calcul.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logo}>S.</Text>
          <Text style={styles.logoSub}>{SITE_NAME}</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Ton assessment a été soumis automatiquement</Heading>
          <Text style={styles.paragraph}>
            {firstName}, ton assessment en {stack} a été soumis automatiquement à l'expiration du timer.
          </Text>
          <Text style={styles.paragraph}>
            Tout le travail que tu as produit a été enregistré et sera évalué.
          </Text>
          <Text style={styles.paragraph}>
            Tes résultats seront disponibles dans quelques minutes sur ton dashboard.
          </Text>
          <Section style={styles.ctaSection}>
            <Button style={styles.ctaButton} href={`${siteUrl}/expert/certifications`}>
              Voir mes résultats
            </Button>
          </Section>
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

export default SessionExpiredEmail
