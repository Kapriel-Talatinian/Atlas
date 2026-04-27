/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { styles, SITE_URL, SITE_NAME } from './styles.ts'

interface CooldownEndedEmailProps { firstName: string; stack: string; currentScore?: number; siteUrl?: string }

export const CooldownEndedEmail = ({ firstName, stack, currentScore, siteUrl = SITE_URL }: CooldownEndedEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Le cooldown de 30 jours est terminé.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Tu peux repasser l'assessment STEF</Heading>
          <Text style={styles.paragraph}>{firstName}, le cooldown de 30 jours est terminé. Tu peux repasser l'assessment en {stack}.</Text>
          {currentScore != null && <Text style={styles.paragraph}>Ton score actuel : {currentScore}/100. Prêt à l'améliorer ?</Text>}
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`${siteUrl}/expert/assessment`}>Repasser l'assessment</Button></Section>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default CooldownEndedEmail
