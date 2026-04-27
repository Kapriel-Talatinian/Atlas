/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface WeeklyActivity { name: string; action: string }
interface ReferralWeeklySummaryEmailProps { referrerName: string; newSignups: number; profilesCompleted: number; assessmentsPassed: number; certified: number; earned: number; pointsEarned: number; activities: WeeklyActivity[]; totalPoints: number; totalCash: number; siteUrl?: string }

export const ReferralWeeklySummaryEmail = ({ referrerName, newSignups, profilesCompleted, assessmentsPassed, certified, earned, pointsEarned, activities = [], totalPoints, totalCash, siteUrl = SITE_URL }: ReferralWeeklySummaryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{newSignups + profilesCompleted + assessmentsPassed + certified} filleuls ont progressé cette semaine.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{referrerName}, voici ta semaine.</Heading>
          <Section style={styles.resultBox}>
            <Text style={{ ...styles.scoreRow, fontWeight: '600' as const, color: colors.textPrimary }}>Cette semaine :</Text>
            {newSignups > 0 && <Text style={styles.scoreRow}>{newSignups} nouveaux inscrits</Text>}
            {profilesCompleted > 0 && <Text style={styles.scoreRow}>{profilesCompleted} profils complétés</Text>}
            {assessmentsPassed > 0 && <Text style={styles.scoreRow}>{assessmentsPassed} assessments passés</Text>}
            {certified > 0 && <Text style={styles.scoreRow}>{certified} certifiés</Text>}
            {earned > 0 && <Text style={styles.scoreRow}>{earned}$ gagnés</Text>}
            {pointsEarned > 0 && <Text style={styles.scoreRow}>+{pointsEarned} STEF Points</Text>}
          </Section>
          {activities.length > 0 && (
            <>
              <Text style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>Détail :</Text>
              {activities.map((a, i) => <Text key={i} style={styles.checkItem}>• {a.name} — {a.action}</Text>)}
            </>
          )}
          <Text style={styles.paragraph}>Solde actuel : {totalPoints} Points, {totalCash}$</Text>
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`${siteUrl}/expert/referrals`}>Voir mes parrainages</Button></Section>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ReferralWeeklySummaryEmail
