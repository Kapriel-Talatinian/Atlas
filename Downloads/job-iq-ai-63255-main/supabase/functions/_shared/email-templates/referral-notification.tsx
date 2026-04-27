/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ReferralNotificationEmailProps {
  referrerName: string; referredName: string; referredEmail?: string; status: string
  step?: string; points?: number; cash?: number; nextStep?: string
  totalCertified?: number; totalMissions?: number; totalEarned?: number; siteUrl?: string
}

export const ReferralNotificationEmail = ({ referrerName, referredName, referredEmail = '', status, step, points = 0, cash = 0, nextStep, totalCertified, totalMissions, totalEarned, siteUrl = SITE_URL }: ReferralNotificationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>
      {status === 'hired' ? `+${cash}$ — ${referredName} a été placé en mission` :
       status === 'signed_up' ? `+${points} Points — ${referredName} vient de s'inscrire` :
       status === 'certified' ? `${referredName} est certifié ! Bonus débloqué` :
       `Mise à jour parrainage — ${referredName}`}
    </Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>
            {status === 'signed_up' && `${referredName} vient de s'inscrire grâce à toi`}
            {status === 'profile_completed' && `${referredName} a complété son profil`}
            {status === 'assessment_completed' && `${referredName} a passé l'assessment STEF`}
            {status === 'certified' && `🎉 ${referredName} est certifié !`}
            {status === 'hired' && `🎉 ${referredName} est en mission`}
            {!['signed_up', 'profile_completed', 'assessment_completed', 'certified', 'hired'].includes(status) && `Mise à jour : ${referredName}`}
          </Heading>
          <Text style={styles.paragraph}>{referrerName},</Text>
          {(points > 0 || cash > 0) && (
            <Section style={styles.resultBox}>
              {points > 0 && <Text style={{ ...styles.scoreRow, color: colors.accent, fontWeight: '600' as const }}>+{points} STEF Points</Text>}
              {cash > 0 && <Text style={{ ...styles.scoreRow, color: colors.success, fontWeight: '600' as const }}>+{cash}$</Text>}
            </Section>
          )}
          {nextStep && <Text style={styles.paragraph}>Prochaine récompense : quand {referredName} {nextStep}.</Text>}
          {totalCertified != null && (
            <Section style={styles.resultBox}>
              <Text style={styles.scoreRow}>🌍 {totalCertified} talents certifiés grâce à toi</Text>
              {totalMissions != null && <Text style={styles.scoreRow}>💼 {totalMissions} placés en mission</Text>}
              {totalEarned != null && <Text style={styles.scoreRow}>💰 {totalEarned}$ gagnés</Text>}
            </Section>
          )}
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`${siteUrl}/expert/referrals`}>Voir mes parrainages</Button></Section>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ReferralNotificationEmail
