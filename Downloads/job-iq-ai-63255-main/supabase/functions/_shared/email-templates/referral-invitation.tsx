/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ReferralInvitationEmailProps { referrerName: string; referrerEmail: string; referralUrl: string; siteUrl?: string }

export const ReferralInvitationEmail = ({ referrerName, referrerEmail, referralUrl, siteUrl = SITE_URL }: ReferralInvitationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Certifie tes compétences techniques en 45 minutes. Gratuit.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{referrerName} te recommande sur STEF</Heading>
          <Text style={styles.paragraph}>STEF est une plateforme qui évalue et certifie les compétences techniques des développeurs via un assessment de 45 minutes.</Text>
          <Text style={styles.paragraph}>Le certificat est vérifiable par les entreprises et les recruteurs. L'assessment est gratuit.</Text>
          <Text style={styles.paragraph}>Comme {referrerName} t'a recommandé, tu bénéficies d'un accès prioritaire.</Text>
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={referralUrl}>Créer mon compte</Button></Section>
          <Text style={styles.checkItem}>✓ Gratuit</Text>
          <Text style={styles.checkItem}>✓ 45 minutes</Text>
          <Text style={styles.checkItem}>✓ Certificat vérifiable</Text>
          <Text style={styles.checkItem}>✓ Profil visible par les recruteurs</Text>
        </Section>
        <Section style={styles.footer}>
          <Hr style={styles.footerDivider} />
          <Text style={styles.footerText}>Cet email vous a été envoyé car {referrerName} ({referrerEmail}) vous a recommandé sur STEF. Si vous n'êtes pas intéressé, ignorez cet email. Vous ne recevrez pas de relance.</Text>
          <Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text>
          <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
export default ReferralInvitationEmail
