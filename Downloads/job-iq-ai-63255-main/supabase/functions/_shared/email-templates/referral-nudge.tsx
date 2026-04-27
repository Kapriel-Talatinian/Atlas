/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ReferralNudgeEmailProps { referrerName: string; refereeName: string; currentStep: string; nudgesRemaining: number; siteUrl?: string }

export const ReferralNudgeEmail = ({ referrerName, refereeName, currentStep, nudgesRemaining, siteUrl = SITE_URL }: ReferralNudgeEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Un petit encouragement pourrait l'aider.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{refereeName} n'a pas avancé depuis une semaine</Heading>
          <Text style={styles.paragraph}>{referrerName}, {refereeName} est bloqué à l'étape « {currentStep} » depuis 7 jours.</Text>
          <Text style={styles.paragraph}>Tu peux lui envoyer un encouragement depuis ton dashboard (il te reste {nudgesRemaining} rappels disponibles).</Text>
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`${siteUrl}/expert/referrals`}>Encourager {refereeName}</Button></Section>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ReferralNudgeEmail
