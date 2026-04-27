/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface MagicLinkEmailProps { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Clique pour te connecter à STEF.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Ton lien de connexion</Heading>
          <Text style={styles.paragraph}>Clique sur le bouton ci-dessous pour te connecter à ton compte STEF.</Text>
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={confirmationUrl}>Me connecter</Button></Section>
          <Text style={styles.smallText}>Ce lien expire dans 1 heure et ne peut être utilisé qu'une seule fois. Si tu n'as pas demandé ce lien, ignore cet email.</Text>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default MagicLinkEmail
