export function getLinkedInShareUrl(verificationUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verificationUrl)}`;
}

export function getLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    associate: "Associate",
    professional: "Professional",
    expert: "Expert"
  };
  return labels[level] || level;
}

export function getLinkedInPostText(data: {
  roleTitle: string;
  level: string;
  score: number;
  verificationUrl: string;
}): string {
  return `🎓 J'ai validé mes compétences en "${data.roleTitle}" via STEF - Niveau ${getLevelLabel(data.level)} avec un score de ${data.score}/100.

✅ Attestation vérifiable : ${data.verificationUrl}

Cette évaluation technique démontre mes compétences pratiques sur des cas réels.

#STEF #Compétences #Tech #Évaluation`;
}

export function getLinkedInCredentialFields(data: {
  roleTitle: string;
  certificateId: string;
  issuedAt: string;
  validUntil?: string | null;
  verificationUrl: string;
}): {
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expirationDate?: string;
  credentialId: string;
  credentialUrl: string;
} {
  const issueDate = new Date(data.issuedAt);
  const expirationDate = data.validUntil ? new Date(data.validUntil) : undefined;

  return {
    name: `${data.roleTitle} - Technical Skills Validation`,
    issuingOrganization: 'STEF - Skills & Talent Evaluation Framework (plateforme d\'évaluation)',
    issueDate: `${issueDate.toLocaleString('fr-FR', { month: 'long' })} ${issueDate.getFullYear()}`,
    expirationDate: expirationDate 
      ? `${expirationDate.toLocaleString('fr-FR', { month: 'long' })} ${expirationDate.getFullYear()}`
      : undefined,
    credentialId: data.certificateId,
    credentialUrl: data.verificationUrl
  };
}
