/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ReferralTierUpgradeEmailProps { referrerName: string; newTier: string; benefits: string[]; totalCertified: number; totalCountries?: number; totalEarned?: number; siteUrl?: string }

export const ReferralTierUpgradeEmail = ({ referrerName, newTier, benefits = [], totalCertified, totalCountries, totalEarned, siteUrl = SITE_URL }: ReferralTierUpgradeEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Découvre tes nouveaux avantages.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Section style={{ textAlign: 'center' as const }}><Text style={{ ...styles.badge, ...styles.badgeSuccess }}>Nouveau tier</Text></Section>
          <Heading style={{ ...styles.heading, textAlign: 'center' as const }}>Félicitations {referrerName}, tu es maintenant {newTier} !</Heading>
          {benefits.length > 0 && (
            <>
              <Text style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>Tes nouveaux avantages :</Text>
              {benefits.map((b, i) => <Text key={i} style={styles.checkItem}>✓ {b}</Text>)}
            </>
          )}
          <Section style={styles.resultBox}>
            <Text style={styles.scoreRow}>🌍 {totalCertified} talents certifiés</Text>
            {totalCountries != null && <Text style={styles.scoreRow}>📍 {totalCountries} pays</Text>}
            {totalEarned != null && <Text style={styles.scoreRow}>💰 {totalEarned}$ gagnés</Text>}
          </Section>
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`${siteUrl}/expert/referrals`}>Voir mes avantages</Button></Section>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ReferralTierUpgradeEmail
