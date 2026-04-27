/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface CertLifecycleEmailProps { firstName: string; stack: string; level: string; score: number; variant: 'expiring_30' | 'expiring_7' | 'expired'; expirationDate: string; siteUrl?: string }

export const CertLifecycleEmail = ({ firstName, stack, level, score, variant, expirationDate, siteUrl = SITE_URL }: CertLifecycleEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>
      {variant === 'expired' ? 'Repasse l\'assessment pour le renouveler.' :
       variant === 'expiring_7' ? `Après le ${expirationDate}, ton profil ne sera plus visible.` :
       'Repasse l\'assessment pour le renouveler.'}
    </Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}><Text style={styles.logo}>S.</Text><Text style={styles.logoSub}>{SITE_NAME}</Text></Section>
        <Section style={styles.card}>
          <Section style={{ textAlign: 'center' as const }}>
            <Text style={{ ...styles.badge, ...(variant === 'expired' ? styles.badgeError : styles.badgeWarning) }}>
              {variant === 'expired' ? 'Expiré' : 'Expiration proche'}
            </Text>
          </Section>
          <Heading style={styles.heading}>
            {variant === 'expired' ? 'Ton certificat STEF a expiré' :
             variant === 'expiring_7' ? '⚠️ Ton certificat STEF expire dans 7 jours' :
             'Ton certificat STEF expire dans 30 jours'}
          </Heading>
          {variant === 'expired' ? (
            <Text style={styles.paragraph}>{firstName}, ton certificat STEF en {stack} a expiré aujourd'hui. Ton profil n'est plus visible par les entreprises.</Text>
          ) : (
            <>
              <Text style={styles.paragraph}>{firstName}, ton certificat STEF en {stack} (niveau {level}, score {score}/100) expire le {expirationDate}.</Text>
              <Text style={styles.paragraph}>Après cette date, ton profil ne sera plus visible par les entreprises.</Text>
            </>
          )}
          <Text style={styles.paragraph}>Repasse l'assessment pour renouveler ton certificat — c'est toujours gratuit.</Text>
          <Section style={styles.ctaSection}><Button style={styles.ctaButton} href={`${siteUrl}/expert/assessment`}>Repasser l'assessment</Button></Section>
          {variant !== 'expired' && <Text style={styles.smallText}>Si ton score s'améliore, ton nouveau certificat remplacera l'ancien.</Text>}
        </Section>
        <Section style={styles.footer}><Hr style={styles.footerDivider} /><Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text><Text style={styles.footerText}><Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link></Text><Text style={styles.footerText}>© 2026 {SITE_NAME}</Text></Section>
      </Container>
    </Body>
  </Html>
)
export default CertLifecycleEmail
