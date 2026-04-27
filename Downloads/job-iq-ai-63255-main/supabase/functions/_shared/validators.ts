// _shared/validators.ts — Lightweight validation utilities

export function validateRequired(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return `Le champ '${field}' est obligatoire.`;
  }
  return null;
}

export function validateEnum(value: string, allowed: string[], field: string): string | null {
  if (!allowed.includes(value)) {
    return `Le champ '${field}' doit être l'une des valeurs suivantes : ${allowed.join(', ')}`;
  }
  return null;
}

export function validateMinLength(value: string, min: number, field: string): string | null {
  if (typeof value !== 'string' || value.length < min) {
    return `Le champ '${field}' doit contenir au moins ${min} caractères.`;
  }
  return null;
}

export function validateMaxLength(value: string, max: number, field: string): string | null {
  if (typeof value === 'string' && value.length > max) {
    return `Le champ '${field}' ne doit pas dépasser ${max} caractères.`;
  }
  return null;
}

export function validatePositiveInt(value: unknown, field: string): string | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return `Le champ '${field}' doit être un entier positif.`;
  }
  return null;
}

export function validateUrl(value: string, field: string): string | null {
  try {
    new URL(value);
    return null;
  } catch {
    return `Le champ '${field}' doit être une URL valide.`;
  }
}

export function validateEmail(value: string, field: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return `Le champ '${field}' doit être une adresse email valide.`;
  }
  return null;
}

export function validateRange(value: number, min: number, max: number, field: string): string | null {
  if (typeof value !== 'number' || value < min || value > max) {
    return `Le champ '${field}' doit être entre ${min} et ${max}.`;
  }
  return null;
}

/** Run an array of validation checks, return the first error or null */
export function validate(checks: (string | null)[]): string | null {
  return checks.find((c) => c !== null) || null;
}

/** Sanitize user input to prevent XSS */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .substring(0, 10000);
}
