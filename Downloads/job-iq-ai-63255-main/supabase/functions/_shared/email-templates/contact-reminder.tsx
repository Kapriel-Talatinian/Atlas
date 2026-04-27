/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ContactReminderEmailProps { firstName: string; companyName: string; daysLeft: number; acceptUrl: string; declineUrl: string; siteUrl?: string }

export const ContactReminderEmail = ({ firstName, companyName, daysLeft, acceptUrl, declineUrl }: ContactReminderEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Tu as encore {daysLeft} jours pour accepter ou décliner.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Rappel : {companyName} attend ta réponse</Heading>
          <Text style={styles.paragraph}>{firstName}, {companyName} a demandé à te contacter il y a 3 jours. Tu n'as pas encore répondu.</Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button style={styles.ctaButton} href={acceptUrl}>✅ Accepter</Button>
            {' '}
            <Button style={styles.ctaButtonOutline} href={declineUrl}>❌ Décliner</Button>
          </Section>
          <Text style={styles.smallText}>La demande expire dans {daysLeft} jours.</Text>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ContactReminderEmail
