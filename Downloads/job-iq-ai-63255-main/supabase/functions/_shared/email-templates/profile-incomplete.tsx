/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface ProfileIncompleteEmailProps {
  firstName: string
  variant: 'day3' | 'day7'
  missingFields?: string[]
  weeklyAssessmentCount?: number
  siteUrl?: string
}

export const ProfileIncompleteEmail = ({
  firstName,
  variant,
  missingFields = [],
  weeklyAssessmentCount = 0,
  siteUrl = SITE_URL,
}: ProfileIncompleteEmailProps) => {
  const isDay3 = variant === 'day3'

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>
        {isDay3
          ? 'Complète ton profil pour débloquer l\'assessment.'
          : '45 minutes pour certifier tes compétences. Gratuit.'}
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.logo}>S.</Text>
            <Text style={styles.logoSub}>{SITE_NAME}</Text>
          </Section>
          <Section style={styles.card}>
            <Heading style={styles.heading}>
              {isDay3 ? `${firstName}, ton profil est presque prêt` : `Ton assessment t'attend, ${firstName}`}
            </Heading>

            {isDay3 ? (
              <>
                <Text style={styles.paragraph}>
                  Il te manque quelques infos pour accéder à l'assessment :
                </Text>
                <Section style={styles.resultBox}>
                  <Text style={{ ...styles.checkItem, color: colors.success }}>✅ Compte créé</Text>
                  {missingFields.length > 0 ? (
                    missingFields.map((field, i) => (
                      <Text key={i} style={{ ...styles.checkItem, color: colors.error }}>❌ {field}</Text>
                    ))
                  ) : (
                    <>
                      <Text style={{ ...styles.checkItem, color: colors.error }}>❌ Stack principale</Text>
                      <Text style={{ ...styles.checkItem, color: colors.error }}>❌ Années d'expérience</Text>
                      <Text style={{ ...styles.checkItem, color: colors.error }}>❌ Pays / ville</Text>
                    </>
                  )}
                </Section>
                <Text style={styles.paragraph}>Ça prend 2 minutes.</Text>
              </>
            ) : (
              <>
                <Text style={styles.paragraph}>
                  Tu t'es inscrit sur STEF il y a une semaine. L'assessment est prêt dès que ton profil est complété.
                </Text>
                <Text style={styles.paragraph}>
                  Rappel : l'assessment STEF dure 45 min, il est gratuit, et il te donne un certificat vérifiable par n'importe quelle entreprise.
                </Text>
                {weeklyAssessmentCount > 0 && (
                  <Text style={{ ...styles.paragraph, fontWeight: '600' as const, color: colors.textPrimary }}>
                    {weeklyAssessmentCount} développeurs l'ont passé cette semaine.
                  </Text>
                )}
              </>
            )}

            <Section style={styles.ctaSection}>
              <Button style={styles.ctaButton} href={`${siteUrl}/expert/onboarding`}>
                Compléter mon profil
              </Button>
            </Section>
          </Section>
          <Section style={styles.footer}>
            <Hr style={styles.footerDivider} />
            <Text style={styles.footerText}>
              {SITE_NAME} •{' '}
              <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link>
            </Text>
            <Text style={styles.footerText}>
              Tu reçois cet email car tu es inscrit sur STEF.
              {' '}
              <Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link>
            </Text>
            <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default ProfileIncompleteEmail
