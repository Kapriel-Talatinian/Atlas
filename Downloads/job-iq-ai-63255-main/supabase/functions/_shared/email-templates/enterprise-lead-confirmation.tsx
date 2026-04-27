/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface EnterpriseLeadConfirmationEmailProps { firstName: string; company: string; stacks: string[]; level: string; positions: string; interests: string[]; siteUrl?: string }

export const EnterpriseLeadConfirmationEmail = ({ firstName, company, stacks, level, positions, interests, siteUrl = SITE_URL }: EnterpriseLeadConfirmationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Notre équipe revient vers vous sous 24h.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Votre demande STEF a bien été reçue</Heading>
          <Text style={styles.paragraph}>Bonjour {firstName},</Text>
          <Text style={styles.paragraph}>Nous avons bien reçu votre demande.</Text>
          <Section style={styles.resultBox}>
            <Text style={{ ...styles.scoreRow, fontWeight: '600' as const, color: colors.textPrimary }}>Récapitulatif :</Text>
            <Text style={styles.scoreRow}>Entreprise : {company}</Text>
            <Text style={styles.scoreRow}>Stack(s) : {stacks.join(', ')}</Text>
            <Text style={styles.scoreRow}>Niveau minimum : {level}</Text>
            <Text style={styles.scoreRow}>Postes : {positions}</Text>
            {interests.length > 0 && <Text style={styles.scoreRow}>Intérêt : {interests.join(', ')}</Text>}
          </Section>
          <Text style={styles.paragraph}>Notre équipe vous contacte sous 24h avec une première sélection de profils.</Text>
          <Text style={styles.paragraph}>En attendant :</Text>
          <Text style={styles.checkItem}>→ <Link href={`${siteUrl}/process`} style={{ color: colors.accent }}>Comment fonctionne l'assessment STEF</Link></Text>
          <Text style={styles.checkItem}>→ <Link href={`${siteUrl}/entreprises#faq`} style={{ color: colors.accent }}>Notre FAQ entreprise</Link></Text>
          <Hr style={styles.divider} />
          <Text style={styles.paragraph}>Des questions ? Répondez directement à cet email.</Text>
          <Text style={styles.paragraph}>L'équipe STEF</Text>
        </Section>
        <Section style={styles.footer}>
          <Hr style={styles.footerDivider} />
          <Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text>
          <Text style={styles.footerText}>Vous recevez cet email car vous avez soumis une demande sur STEF.</Text>
          <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
export default EnterpriseLeadConfirmationEmail
