/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface AssessmentNudgeEmailProps {
  firstName: string
  stack: string
  variant: 'day5' | 'day14'
  weeklyCount?: number
  siteUrl?: string
}

export const AssessmentNudgeEmail = ({
  firstName,
  stack,
  variant,
  weeklyCount = 0,
  siteUrl = SITE_URL,
}: AssessmentNudgeEmailProps) => {
  const isLast = variant === 'day14'

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>
        {isLast ? 'On ne va pas t\'envoyer 10 relances. Juste celle-ci.' : 'Ton assessment est prêt depuis 5 jours.'}
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.logo}>S.</Text>
            <Text style={styles.logoSub}>{SITE_NAME}</Text>
          </Section>
          <Section style={styles.card}>
            <Heading style={styles.heading}>
              {isLast ? `Dernière chose, ${firstName}` : `${firstName}, ${weeklyCount} devs se sont certifiés cette semaine`}
            </Heading>

            {isLast ? (
              <>
                <Text style={styles.paragraph}>
                  On ne va pas te spammer. C'est le dernier rappel.
                </Text>
                <Text style={styles.paragraph}>
                  Ton assessment STEF en {stack} est prêt depuis 2 semaines.
                  Si tu veux le passer, il sera toujours là :
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.paragraph}>
                  Cette semaine, {weeklyCount} développeurs ont passé l'assessment STEF et reçu leur certificat.
                </Text>
                <Text style={styles.paragraph}>
                  Le tien est prêt. 45 minutes, gratuit, et tu peux le passer quand tu veux.
                </Text>
              </>
            )}

            <Section style={styles.ctaSection}>
              <Button style={styles.ctaButton} href={`${siteUrl}/expert/assessment`}>
                Passer l'assessment
              </Button>
            </Section>

            {isLast ? (
              <Text style={styles.smallText}>
                Si ce n'est pas le bon moment, on comprend. On ne t'enverra plus de relance à ce sujet.
              </Text>
            ) : (
              <Text style={styles.smallText}>
                Pas le temps maintenant ? Pas de souci. L'assessment reste disponible.
              </Text>
            )}
          </Section>
          <Section style={styles.footer}>
            <Hr style={styles.footerDivider} />
            <Text style={styles.footerText}>
              {SITE_NAME} •{' '}
              <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link>
            </Text>
            <Text style={styles.footerText}>
              <Link href={`${SITE_URL}/unsubscribe`} style={styles.footerLink}>Se désinscrire</Link>
            </Text>
            <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AssessmentNudgeEmail
