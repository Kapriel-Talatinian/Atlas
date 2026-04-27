// _shared/rate-limiter.ts — Per-client / per-user rate limiting

import { getServiceClient } from './auth.ts';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: number;
  retry_after?: number;
}

export async function checkRateLimit(
  identifier: string,
  limit: number
): Promise<RateLimitResult> {
  const supabase = getServiceClient();
  const windowStart = new Date(Date.now() - 60_000).toISOString();

  const { count } = await supabase
    .from('api_request_logs')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', identifier)
    .gte('created_at', windowStart);

  const current = count || 0;
  const remaining = Math.max(0, limit - current);
  const resetAt = Math.floor(Date.now() / 1000) + 60;

  if (current >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset_at: resetAt,
      retry_after: 60,
    };
  }

  return { allowed: true, limit, remaining, reset_at: resetAt };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset_at.toString(),
  };
  if (result.retry_after) {
    headers['Retry-After'] = result.retry_after.toString();
  }
  return headers;
}
