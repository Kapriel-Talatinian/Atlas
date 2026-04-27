/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ContactAcceptedEmailProps { firstName: string; companyName: string; contactName: string; contactRole: string; contactEmail: string; talentEmail: string; siteUrl?: string }

export const ContactAcceptedEmail = ({ firstName, companyName, contactName, contactRole, contactEmail, talentEmail, siteUrl = SITE_URL }: ContactAcceptedEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Voici les coordonnées du recruteur.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{firstName}, tu es mis en relation avec {companyName}.</Heading>
          <Section style={styles.resultBox}>
            <Text style={{ ...styles.scoreRow, fontWeight: '600' as const, color: colors.textPrimary }}>Contact chez {companyName} :</Text>
            <Text style={styles.scoreRow}>{contactName} — {contactRole}</Text>
            <Text style={styles.scoreRow}><Link href={`mailto:${contactEmail}`} style={{ color: colors.accent }}>{contactEmail}</Link></Text>
          </Section>
          <Text style={styles.paragraph}>De ton côté, ton email ({talentEmail}) a été partagé avec cette personne.</Text>
          <Text style={styles.paragraph}>Conseil : n'hésite pas à prendre l'initiative et à envoyer un premier message.</Text>
          <Text style={{ ...styles.paragraph, fontWeight: '600' as const }}>Bonne chance.</Text>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ContactAcceptedEmail
