// _shared/auth.ts — Dual authentication: Supabase JWT + API Key

import { createClient } from 'npm:@supabase/supabase-js@2';

export interface AuthResult {
  authenticated: boolean;
  auth_type: 'session' | 'api_key' | 'service' | 'none';
  user_id: string | null;
  user_role: 'expert' | 'client' | 'admin' | null;
  client_id: string | null;
  rate_limit: number;
  error?: string;
}

const UNAUTHENTICATED: AuthResult = {
  authenticated: false,
  auth_type: 'none',
  user_id: null,
  user_role: null,
  client_id: null,
  rate_limit: 0,
};

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function hashApiKey(apiKey: string): Promise<string> {
  const data = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const supabase = getServiceClient();
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { ...UNAUTHENTICATED, error: 'Aucune authentification fournie' };
  }

  // ── API Key auth (clients externes) ──
  if (authHeader.startsWith('Bearer stef_live_')) {
    const apiKey = authHeader.replace('Bearer ', '');
    const apiKeyHash = await hashApiKey(apiKey);

    const { data: client } = await supabase
      .from('clients')
      .select('id, api_key_hash, api_rate_limit')
      .eq('api_key_hash', apiKeyHash)
      .maybeSingle();

    if (!client) {
      return { ...UNAUTHENTICATED, error: 'API key invalide' };
    }

    return {
      authenticated: true,
      auth_type: 'api_key',
      user_id: null,
      user_role: 'client',
      client_id: client.id,
      rate_limit: client.api_rate_limit || 100,
    };
  }

  // ── Service role key (internal cron / edge-to-edge) ──
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    return {
      authenticated: true,
      auth_type: 'service',
      user_id: null,
      user_role: 'admin',
      client_id: null,
      rate_limit: 10000,
    };
  }

  // ── Supabase JWT session (dashboard users) ──
  if (authHeader.startsWith('Bearer ey')) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { ...UNAUTHENTICATED, error: 'Session invalide' };
    }

    // Determine role from user_roles table
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roleSet = new Set((roles || []).map((r: { role: string }) => r.role));
    let userRole: 'expert' | 'client' | 'admin' = 'expert';
    if (roleSet.has('admin')) userRole = 'admin';
    else if (roleSet.has('company')) userRole = 'client';

    // If client, get client_id
    let clientId: string | null = null;
    if (userRole === 'client') {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      clientId = clientData?.id || null;
    }

    return {
      authenticated: true,
      auth_type: 'session',
      user_id: user.id,
      user_role: userRole,
      client_id: clientId,
      rate_limit: userRole === 'admin' ? 1000 : 200,
    };
  }

  return { ...UNAUTHENTICATED, error: 'Format d\'authentification non reconnu' };
}

// Generate a new API key
export function generateApiKey(): { key: string; prefix: string } {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'stef_live_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return { key, prefix: key.substring(10, 18) };
}

export { hashApiKey };
