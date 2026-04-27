/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface TestSuccessEmailProps {
  recipientName: string; firstName?: string; level: string; score: number; stack?: string
  completionTime?: string; stepsCompleted?: string; assessmentName?: string
  fundamentals?: number; problemSolving?: number; codeQuality?: number; architecture?: number; debugging?: number
  strengths?: string[]; improvements?: string[]; certificateId?: string; certificateUrl?: string; siteUrl?: string
}

export const TestSuccessEmail = ({ recipientName, firstName, level, score, stack = '', completionTime = '', stepsCompleted = '4/4', fundamentals, problemSolving, codeQuality, architecture, debugging, strengths = [], improvements = [], certificateUrl = '', siteUrl = SITE_URL }: TestSuccessEmailProps) => {
  const name = firstName || recipientName
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Score : {score}/100. Ton certificat est prêt.</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
          <Section style={styles.card}>
            <Section style={{ textAlign: 'center' as const }}><Text style={{ ...styles.badge, ...styles.badgeSuccess }}>Certifié</Text></Section>
            <Heading style={{ ...styles.heading, textAlign: 'center' as const }}>Félicitations {name},<br />tu es certifié {level}{stack ? ` en ${stack}` : ''}.</Heading>
            <Section style={styles.resultBox}>
              <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Score global :</span> {score}/100</Text>
              <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Niveau :</span> {level}</Text>
              {completionTime && <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Temps :</span> {completionTime}</Text>}
              <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Étapes :</span> {stepsCompleted}</Text>
              {fundamentals != null && (<><Hr style={styles.divider} /><Text style={styles.scoreRow}>Fondamentaux — {fundamentals}/100</Text><Text style={styles.scoreRow}>Problem Solving — {problemSolving}/100</Text><Text style={styles.scoreRow}>Code Quality — {codeQuality}/100</Text><Text style={styles.scoreRow}>Architecture — {architecture}/100</Text><Text style={styles.scoreRow}>Debugging — {debugging}/100</Text></>)}
              {strengths.length > 0 && (<><Hr style={styles.divider} /><Text style={styles.scoreRow}><span style={styles.scoreLabel}>Points forts :</span> {strengths.join(', ')}</Text></>)}
              {improvements.length > 0 && <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Axes de progression :</span> {improvements.join(', ')}</Text>}
            </Section>
            {certificateUrl && <Text style={{ ...styles.paragraph, textAlign: 'center' as const }}>Ton certificat est vérifiable publiquement :<br /><Link href={certificateUrl} style={{ color: colors.accent }}>🔗 {certificateUrl}</Link></Text>}
            <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`${siteUrl}/expert/certifications`}>Voir mon profil certifié</Button></Section>
            <Hr style={styles.divider} />
            <Text style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>Et maintenant ?</Text>
            <Text style={styles.paragraph}>Ton profil est désormais visible par les entreprises qui recrutent sur STEF. Tu n'as rien d'autre à faire — les entreprises viennent à toi.</Text>
            <Text style={styles.checkItem}>• Partager ton certificat sur LinkedIn</Text>
            <Text style={styles.checkItem}>• Parrainer un ami développeur</Text>
            <Text style={styles.checkItem}>• Repasser l'assessment dans 30 jours pour améliorer ton score</Text>
            <Section style={{ textAlign: 'center' as const, margin: '16px 0 0' }}><Button style={styles.ctaButtonOutline} href={`${siteUrl}/expert/referrals`}>Parrainer un ami</Button></Section>
          </Section>
          <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
        </Container>
      </Body>
    </Html>
  )
}
export default TestSuccessEmail
