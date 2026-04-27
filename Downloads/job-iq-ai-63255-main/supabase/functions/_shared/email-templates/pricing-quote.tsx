/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { colors, styles, SITE_URL, SITE_NAME } from './styles.ts'

interface PricingQuoteEmailProps {
  domain: string
  volume: number
  sla: string
  mode: string
  estimatedLow: number
  estimatedHigh: number
  basePrice: number
  multSla: number
  multMode: number
  discountPct: number
}

const DOMAIN_LABEL: Record<string, string> = {
  medical: 'Medical',
  legal: 'Legal',
  finance: 'Finance',
  code: 'Code',
}

const SLA_LABEL: Record<string, string> = {
  standard: 'Standard (5 jours, α≥0.75, 2 annotateurs)',
  priority: 'Prioritaire (3 jours, α≥0.80, 2 annotateurs)',
  express: 'Express (1-2 jours, α≥0.85, 3 annotateurs)',
}

const MODE_LABEL: Record<string, string> = {
  standard: 'Standard (Lovable AI Gateway)',
  sovereign: 'Souverain (Mistral France)',
}

export const PricingQuoteEmail = ({
  domain,
  volume,
  sla,
  mode,
  estimatedLow,
  estimatedHigh,
  basePrice,
  multSla,
  multMode,
  discountPct,
}: PricingQuoteEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre estimation STEF : {estimatedLow.toLocaleString('en-US')} – {estimatedHigh.toLocaleString('en-US')} USD HT</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.logo}>S.</Text>
          <Text style={styles.logoSub}>{SITE_NAME}</Text>
        </Section>
        <Section style={styles.card}>
          <Heading style={styles.heading}>Votre estimation de projet</Heading>
          <Text style={styles.paragraph}>Bonjour,</Text>
          <Text style={styles.paragraph}>
            Voici l'estimation générée depuis le calculateur de tarification STEF.
          </Text>

          <Section style={styles.resultBox}>
            <Text style={{ ...styles.scoreRow, fontSize: '22px', fontWeight: '700' as const, color: colors.textPrimary }}>
              {estimatedLow.toLocaleString('en-US')} – {estimatedHigh.toLocaleString('en-US')} USD HT
            </Text>
            <Text style={{ ...styles.scoreRow, fontSize: '13px', color: colors.textSecondary }}>
              {volume} tâches · livraison sous {sla === 'express' ? '1-2 jours' : sla === 'priority' ? '3 jours' : '5 jours'}
            </Text>
          </Section>

          <Text style={{ ...styles.paragraph, fontWeight: '600' as const }}>Détails du calcul</Text>
          <Text style={styles.scoreRow}>Domaine : {DOMAIN_LABEL[domain] || domain}</Text>
          <Text style={styles.scoreRow}>SLA : {SLA_LABEL[sla] || sla}</Text>
          <Text style={styles.scoreRow}>Mode : {MODE_LABEL[mode] || mode}</Text>
          <Text style={styles.scoreRow}>Prix de base : {basePrice}$ × {volume} tâches</Text>
          <Text style={styles.scoreRow}>Multiplicateur SLA : ×{multSla.toFixed(1)}</Text>
          <Text style={styles.scoreRow}>Multiplicateur mode : ×{multMode.toFixed(2)}</Text>
          {discountPct > 0 && <Text style={styles.scoreRow}>Remise volume : −{discountPct}%</Text>}

          <Hr style={styles.divider} />

          <Text style={styles.paragraph}>
            Cette estimation est indicative. Notre équipe peut établir un devis ferme après cadrage du dataset et des dimensions de scoring.
          </Text>
          <Text style={styles.checkItem}>
            → <Link href={`${SITE_URL}#demo`} style={{ color: colors.accent }}>Voir la démo produit (2 min)</Link>
          </Text>
          <Text style={styles.checkItem}>
            → <Link href={`${SITE_URL}/technology`} style={{ color: colors.accent }}>Comprendre notre méthodologie (ARES)</Link>
          </Text>

          <Hr style={styles.divider} />
          <Text style={styles.paragraph}>Une question ? Répondez directement à cet email.</Text>
          <Text style={styles.paragraph}>L'équipe {SITE_NAME}</Text>
        </Section>
        <Section style={styles.footer}>
          <Hr style={styles.footerDivider} />
          <Text style={styles.footerText}>{SITE_NAME} • <Link href={SITE_URL} style={styles.footerLink}>steftalent.fr</Link></Text>
          <Text style={styles.footerText}>Vous recevez cet email car vous avez demandé un devis sur le calculateur STEF.</Text>
          <Text style={styles.footerText}>© 2026 {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
