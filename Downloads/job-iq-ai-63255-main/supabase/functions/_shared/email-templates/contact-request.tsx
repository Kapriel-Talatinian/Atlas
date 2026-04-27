/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ContactRequestEmailProps { firstName: string; companyName: string; companySector?: string; companyLocation?: string; stack: string; recruiterName?: string; recruiterRole?: string; acceptUrl: string; declineUrl: string; siteUrl?: string }

export const ContactRequestEmail = ({ firstName, companyName, companySector, companyLocation, stack, recruiterName, recruiterRole, acceptUrl, declineUrl, siteUrl = SITE_URL }: ContactRequestEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{companyName} recherche un développeur {stack}. Acceptes-tu ?</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{firstName}, une entreprise s'intéresse à ton profil</Heading>
          <Section style={styles.resultBox}>
            <Text style={{ ...styles.scoreRow, fontWeight: '600' as const, color: colors.textPrimary }}>{companyName}</Text>
            {companySector && <Text style={styles.scoreRow}>{companySector}{companyLocation ? ` • ${companyLocation}` : ''}</Text>}
            <Text style={styles.scoreRow}>Recherche : développeur {stack}</Text>
            {recruiterName && <Text style={styles.scoreRow}>Contact : {recruiterName}{recruiterRole ? ` — ${recruiterRole}` : ''}</Text>}
          </Section>
          <Text style={styles.paragraph}>Si tu acceptes, tes coordonnées (email) seront partagées avec cette entreprise, et tu recevras les leurs.</Text>
          <Text style={styles.paragraph}>Si tu refuses, tes données ne seront pas partagées et l'entreprise ne saura pas pourquoi.</Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button style={{ ...styles.ctaButton, marginRight: '8px' }} href={acceptUrl}>✅ Accepter</Button>
            {' '}
            <Button style={styles.ctaButtonOutline} href={declineUrl}>❌ Décliner</Button>
          </Section>
          <Text style={styles.smallText}>Tu as 7 jours pour répondre. Passé ce délai, la demande expire.</Text>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ContactRequestEmail
