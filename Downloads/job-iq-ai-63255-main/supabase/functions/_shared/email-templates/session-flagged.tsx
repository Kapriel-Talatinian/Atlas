/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface SessionFlaggedEmailProps {
  firstName: string
  siteUrl?: string
}

export const SessionFlaggedEmail = ({ firstName, siteUrl = SITE_URL }: SessionFlaggedEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Des anomalies ont été détectées pendant ta session.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logo}>S.</Text>
          <Text style={styles.logoSub}>{SITE_NAME}</Text>
        </Section>
        <Section style={styles.card}>
          <Section style={{ textAlign: 'center' as const }}>
            <Text style={{ ...styles.badge, ...styles.badgeWarning }}>Revue en cours</Text>
          </Section>
          <Heading style={styles.heading}>Information sur ton assessment STEF</Heading>
          <Text style={styles.paragraph}>
            {firstName}, pendant ton assessment, notre système a détecté des comportements inhabituels (changements d'onglet fréquents, copier-coller, ou autres).
          </Text>
          <Text style={styles.paragraph}>
            Tes résultats ont été enregistrés mais sont marqués pour revue. Cela signifie que les entreprises verront une mention sur ton profil.
          </Text>
          <Text style={styles.paragraph}>
            Si tu penses qu'il s'agit d'une erreur (problème technique, déconnexion, etc.), contacte-nous et on examinera ta session :
          </Text>
          <Section style={styles.ctaSection}>
            <Button style={styles.ctaButton} href={`mailto:support@steftalent.fr`}>
              Contacter le support
            </Button>
          </Section>
          <Text style={styles.smallText}>
            Tu pourras repasser l'assessment dans 30 jours.
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

export default SessionFlaggedEmail
