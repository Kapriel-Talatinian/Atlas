/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ProfileData { initials: string; stack: string; level: string; score: number; strengths: string[] }
interface EnterpriseProfileSelectionEmailProps { firstName: string; company: string; stack: string; profiles: ProfileData[]; siteUrl?: string }

export const EnterpriseProfileSelectionEmail = ({ firstName, company, stack, profiles = [], siteUrl = SITE_URL }: EnterpriseProfileSelectionEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Voici une première sélection de talents certifiés.</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>{profiles.length} profils {stack} pour {company}</Heading>
          <Text style={styles.paragraph}>Bonjour {firstName},</Text>
          <Text style={styles.paragraph}>Voici une première sélection de talents certifiés correspondant à vos critères :</Text>
          {profiles.map((p, i) => (
            <Section key={i} style={{ ...styles.resultBox, marginBottom: '12px' }}>
              <Text style={{ ...styles.scoreRow, fontWeight: '600' as const, color: colors.textPrimary }}>{p.initials} • {p.stack} • {p.level} ({p.score}/100)</Text>
              {p.strengths.length > 0 && <Text style={styles.scoreRow}>Forces : {p.strengths.join(', ')}</Text>}
            </Section>
          ))}
          <Text style={styles.paragraph}>Souhaitez-vous être mis en relation avec un ou plusieurs de ces profils ?</Text>
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`mailto:contact@steftalent.fr?subject=Intéressé par des profils ${stack}`}>Répondre</Button></Section>
          <Hr style={styles.divider} />
          <Text style={styles.smallText}>Les profils complets (radar de compétences, certificat vérifiable) seront accessibles depuis votre dashboard beta.</Text>
        </Section>
        <Section style={styles.footer}>
          <Hr style={styles.footerDivider} />
          <Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text>
          <Text style={styles.footerText}>Vous recevez cet email suite à votre demande sur STEF.</Text>
          <Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text>
          <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
export default EnterpriseProfileSelectionEmail
