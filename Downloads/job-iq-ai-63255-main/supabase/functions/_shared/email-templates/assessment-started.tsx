/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface AssessmentStartedEmailProps {
  firstName: string
  stack: string
  siteUrl?: string
}

export const AssessmentStartedEmail = ({ firstName, stack, siteUrl = SITE_URL }: AssessmentStartedEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Bonne chance, {firstName}. Tu as 45 minutes.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logo}>S.</Text>
          <Text style={styles.logoSub}>{SITE_NAME}</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Assessment en cours</Heading>
          <Text style={styles.paragraph}>
            {firstName}, ton assessment en {stack} a commencé. Tu as 45 minutes.
          </Text>
          <Text style={styles.paragraph}>
            Si tu es déconnecté par accident, tu peux reprendre depuis ton dashboard :
          </Text>
          <Section style={styles.ctaSection}>
            <Button style={styles.ctaButton} href={`${siteUrl}/expert/assessment`}>
              Reprendre l'assessment
            </Button>
          </Section>
          <Text style={styles.smallText}>
            Le timer ne s'arrête pas en cas de déconnexion.
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

export default AssessmentStartedEmail
