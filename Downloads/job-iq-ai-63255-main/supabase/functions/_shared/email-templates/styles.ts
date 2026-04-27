// Shared email design tokens for STEF
// Light, professional design — consistent across all emails

export const SITE_URL = 'https://steftalent.fr'
export const SITE_NAME = 'STEF'

export const colors = {
  bgBody: '#f4f4f7',
  bgCard: '#ffffff',
  accent: '#7c5cfc',
  accentLight: '#f0edff',
  textPrimary: '#1a1a2e',
  textSecondary: '#4a4a68',
  textMuted: '#8c8ca1',
  border: '#e5e5ea',
  divider: '#ededf0',
  success: '#22c55e',
  successBg: '#f0fdf4',
  warning: '#f59e0b',
  warningBg: '#fffbeb',
  error: '#ef4444',
  errorBg: '#fef2f2',
}

export const styles = {
  main: {
    backgroundColor: colors.bgBody,
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: '40px 0',
    margin: '0',
  } as const,
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '0 16px',
  } as const,
  header: {
    textAlign: 'center' as const,
    padding: '24px 0 16px',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 'bold' as const,
    color: colors.accent,
    margin: '0',
    letterSpacing: '-0.5px',
  },
  logoSub: {
    fontSize: '10px',
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '3px',
    margin: '2px 0 0',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: '8px',
    padding: '32px 24px',
    border: `1px solid ${colors.border}`,
  },
  heading: {
    fontSize: '22px',
    fontWeight: 'bold' as const,
    color: colors.textPrimary,
    margin: '0 0 16px',
    lineHeight: '1.3',
  },
  paragraph: {
    fontSize: '15px',
    color: colors.textSecondary,
    lineHeight: '1.6',
    margin: '0 0 16px',
  },
  ctaSection: {
    textAlign: 'center' as const,
    margin: '24px 0',
  },
  ctaButton: {
    backgroundColor: colors.accent,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600' as const,
    borderRadius: '8px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block' as const,
  },
  ctaButtonOutline: {
    backgroundColor: 'transparent',
    color: colors.accent,
    fontSize: '14px',
    fontWeight: '600' as const,
    borderRadius: '8px',
    padding: '12px 24px',
    textDecoration: 'none',
    display: 'inline-block' as const,
    border: `2px solid ${colors.accent}`,
  },
  linkFallback: {
    fontSize: '12px',
    color: colors.textMuted,
    textAlign: 'center' as const,
    margin: '8px 0 0',
  },
  linkUrl: {
    fontSize: '12px',
    color: colors.accent,
    wordBreak: 'break-all' as const,
  },
  divider: {
    borderColor: colors.divider,
    margin: '24px 0',
  },
  resultBox: {
    backgroundColor: colors.bgBody,
    borderRadius: '8px',
    padding: '20px',
    margin: '16px 0',
    border: `1px solid ${colors.border}`,
  },
  badge: {
    display: 'inline-block' as const,
    fontSize: '11px',
    fontWeight: '600' as const,
    padding: '4px 12px',
    borderRadius: '100px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  badgeSuccess: {
    backgroundColor: colors.successBg,
    color: colors.success,
  },
  badgeWarning: {
    backgroundColor: colors.warningBg,
    color: colors.warning,
  },
  badgeError: {
    backgroundColor: colors.errorBg,
    color: colors.error,
  },
  badgeAccent: {
    backgroundColor: colors.accentLight,
    color: colors.accent,
  },
  smallText: {
    fontSize: '13px',
    color: colors.textMuted,
    lineHeight: '1.5',
    margin: '0 0 8px',
  },
  footer: {
    padding: '24px 8px 0',
  },
  footerText: {
    fontSize: '12px',
    color: colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: '1.6',
    margin: '0 0 8px',
  },
  footerLink: {
    color: colors.textMuted,
    textDecoration: 'underline',
  },
  footerDivider: {
    borderColor: colors.divider,
    margin: '16px 0',
  },
  scoreRow: {
    fontSize: '14px',
    color: colors.textSecondary,
    margin: '4px 0',
    lineHeight: '1.5',
  },
  scoreLabel: {
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  checkItem: {
    fontSize: '14px',
    color: colors.textSecondary,
    margin: '4px 0',
    lineHeight: '1.5',
  },
}
