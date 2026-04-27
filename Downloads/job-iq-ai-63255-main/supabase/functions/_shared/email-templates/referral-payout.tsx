/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ReferralPayoutEmailProps { referrerName: string; amount: number; variant: 'available' | 'completed'; method?: string; newBalance?: number; siteUrl?: string }

export const ReferralPayoutEmail = ({ referrerName, amount, variant, method, newBalance, siteUrl = SITE_URL }: ReferralPayoutEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{variant === 'available' ? `Tu peux retirer tes gains.` : `Ton paiement STEF a été traité.`}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>
            {variant === 'available' ? `${amount}$ disponibles sur ton compte STEF` : `Virement de ${amount}$ effectué`}
          </Heading>
          {variant === 'available' ? (
            <>
              <Text style={styles.paragraph}>{referrerName}, tu as accumulé {amount}$ de gains de parrainage. Tu peux retirer tes gains dès maintenant.</Text>
              <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`${siteUrl}/expert/referrals`}>Retirer mes gains</Button></Section>
            </>
          ) : (
            <>
              <Text style={styles.paragraph}>{referrerName}, ton paiement de {amount}$ a été traité{method ? ` via ${method}` : ''}.</Text>
              {newBalance != null && <Text style={styles.paragraph}>Nouveau solde : {newBalance}$</Text>}
            </>
          )}
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ReferralPayoutEmail
