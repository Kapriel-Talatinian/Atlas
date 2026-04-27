/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ScoreImprovedEmailProps { firstName: string; stack: string; oldScore: number; newScore: number; oldLevel: string; newLevel: string; fundamentalsOld?: number; fundamentalsNew?: number; problemSolvingOld?: number; problemSolvingNew?: number; codeQualityOld?: number; codeQualityNew?: number; architectureOld?: number; architectureNew?: number; debuggingOld?: number; debuggingNew?: number; newValidUntil?: string; siteUrl?: string }

export const ScoreImprovedEmail = ({ firstName, stack, oldScore, newScore, oldLevel, newLevel, fundamentalsOld, fundamentalsNew, problemSolvingOld, problemSolvingNew, codeQualityOld, codeQualityNew, architectureOld, architectureNew, debuggingOld, debuggingNew, newValidUntil, siteUrl = SITE_URL }: ScoreImprovedEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{oldScore} → {newScore}. Ton certificat est mis à jour.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Section style={{ textAlign: 'center' as const }}><Text style={{ ...styles.badge, ...styles.badgeSuccess }}>Progression</Text></Section>
          <Heading style={{ ...styles.heading, textAlign: 'center' as const }}>{firstName}, tu as progressé.</Heading>
          <Section style={styles.resultBox}>
            <Text style={{ ...styles.scoreRow, textAlign: 'center' as const, fontSize: '16px', fontWeight: '600' as const, color: colors.textPrimary }}>
              {oldScore}/100 ({oldLevel}) → {newScore}/100 ({newLevel})
            </Text>
            {fundamentalsOld != null && fundamentalsNew != null && (
              <>
                <Hr style={styles.divider} />
                <Text style={styles.scoreRow}>Fondamentaux: {fundamentalsOld} → {fundamentalsNew}</Text>
                <Text style={styles.scoreRow}>Problem Solving: {problemSolvingOld} → {problemSolvingNew}</Text>
                <Text style={styles.scoreRow}>Code Quality: {codeQualityOld} → {codeQualityNew}</Text>
                <Text style={styles.scoreRow}>Architecture: {architectureOld} → {architectureNew}</Text>
                <Text style={styles.scoreRow}>Debugging: {debuggingOld} → {debuggingNew}</Text>
              </>
            )}
          </Section>
          <Text style={styles.paragraph}>Ton certificat a été mis à jour.{newValidUntil ? ` Il est valide jusqu'au ${newValidUntil}.` : ''}</Text>
          <Section style={styles.ctaSection}>
            <Button style={styles.ctaButton} href={`${siteUrl}/expert/certifications`}>Voir mon profil mis à jour</Button>
          </Section>
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default ScoreImprovedEmail
