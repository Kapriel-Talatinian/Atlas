// _shared/errors.ts — Standardized API error responses

import { corsHeaders } from './cors.ts';

type ErrorType =
  | 'invalid_request'
  | 'authentication_error'
  | 'authorization_error'
  | 'not_found'
  | 'rate_limit_exceeded'
  | 'validation_error'
  | 'internal_error'
  | 'service_unavailable';

interface ApiError {
  type: ErrorType;
  message: string;
  code: string;
  param?: string;
}

function errorResponse(
  status: number,
  type: ErrorType,
  message: string,
  code: string,
  param?: string,
  extraHeaders?: Record<string, string>
): Response {
  const body: { error: ApiError } = {
    error: { type, message, code, ...(param && { param }) },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

export const Errors = {
  badRequest: (message: string, code: string, param?: string) =>
    errorResponse(400, 'invalid_request', message, code, param),

  unauthorized: (message = 'Authentification requise') =>
    errorResponse(401, 'authentication_error', message, 'AUTH_REQUIRED'),

  forbidden: (message = 'Accès refusé') =>
    errorResponse(403, 'authorization_error', message, 'FORBIDDEN'),

  notFound: (resource = 'Ressource') =>
    errorResponse(404, 'not_found', `${resource} non trouvé(e)`, 'NOT_FOUND'),

  rateLimited: (retryAfter: number) =>
    errorResponse(429, 'rate_limit_exceeded', 'Trop de requêtes. Réessayez plus tard.', 'RATE_LIMITED', undefined, {
      'Retry-After': retryAfter.toString(),
    }),

  validation: (message: string, param: string) =>
    errorResponse(422, 'validation_error', message, 'INVALID_PARAM', param),

  internal: (message = 'Erreur interne. Veuillez réessayer.') =>
    errorResponse(500, 'internal_error', message, 'INTERNAL_ERROR'),

  unavailable: (message = 'Service temporairement indisponible') =>
    errorResponse(503, 'service_unavailable', message, 'SERVICE_UNAVAILABLE'),
};

export function ok(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}
