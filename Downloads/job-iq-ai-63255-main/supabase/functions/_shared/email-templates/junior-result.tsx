/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ResultJuniorProps {
  firstName: string
  score: number
  stack: string
  completionTime?: string
  stepsCompleted?: string
  fundamentals?: number
  problemSolving?: number
  codeQuality?: number
  architecture?: number
  debugging?: number
  strengths?: string[]
  improvements?: string[]
  recommendations?: string[]
  siteUrl?: string
}

export const ResultJuniorEmail = ({
  firstName = '',
  score = 0,
  stack = '',
  completionTime = '',
  stepsCompleted = '',
  fundamentals,
  problemSolving,
  codeQuality,
  architecture,
  debugging,
  strengths = [],
  improvements = [],
  recommendations = [],
  siteUrl = SITE_URL,
}: ResultJuniorProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Score : {score}/100. Voici tes axes de progression.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logo}>S.</Text>
          <Text style={styles.logoSub}>{SITE_NAME}</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{firstName}, voici tes résultats.</Heading>
          <Section style={styles.resultBox}>
            <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Score global :</span> {score}/100</Text>
            <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Niveau :</span> Junior</Text>
            {completionTime && <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Temps :</span> {completionTime}</Text>}
            {stepsCompleted && <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Étapes :</span> {stepsCompleted}</Text>}
            {fundamentals != null && (
              <>
                <Hr style={styles.divider} />
                <Text style={styles.scoreRow}>Fondamentaux — {fundamentals}/100</Text>
                <Text style={styles.scoreRow}>Problem Solving — {problemSolving}/100</Text>
                <Text style={styles.scoreRow}>Code Quality — {codeQuality}/100</Text>
                <Text style={styles.scoreRow}>Architecture — {architecture}/100</Text>
                <Text style={styles.scoreRow}>Debugging — {debugging}/100</Text>
              </>
            )}
            {strengths.length > 0 && (
              <>
                <Hr style={styles.divider} />
                <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Points forts :</span> {strengths.join(', ')}</Text>
              </>
            )}
            {improvements.length > 0 && (
              <Text style={styles.scoreRow}><span style={styles.scoreLabel}>Axes de progression :</span> {improvements.join(', ')}</Text>
            )}
          </Section>
          <Text style={styles.paragraph}>Le niveau Junior signifie que certaines compétences sont encore en construction.</Text>
          {recommendations.length > 0 && (
            <>
              <Text style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>On te recommande :</Text>
              {recommendations.map((rec, i) => <Text key={i} style={styles.checkItem}>{i + 1}. {rec}</Text>)}
            </>
          )}
          <Text style={styles.paragraph}>Tu peux repasser l'assessment dans 30 jours.</Text>
          <Section style={styles.ctaSection}>
            <Button style={styles.ctaButton} href={`${siteUrl}/expert/certifications`}>Voir mes résultats détaillés</Button>
          </Section>
          <Hr style={styles.divider} />
          <Text style={styles.smallText}>Tu peux parrainer un ami pour gagner des STEF Points.</Text>
          <Section style={{ textAlign: 'center' as const, margin: '12px 0 0' }}>
            <Button style={styles.ctaButtonOutline} href={`${siteUrl}/expert/referrals`}>Parrainer un ami</Button>
          </Section>
        </Section>
        <Section style={styles.footer}>
          <Hr style={styles.footerDivider} />
          <Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text>
          <Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text>
          <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
