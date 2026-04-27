import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SignRequest { certification_id: string; }
interface VerifyRequest { certificate_id: string; }

async function computeSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const signingSecret = Deno.env.get('SIGNING_SECRET');

    if (!signingSecret) {
      return new Response(JSON.stringify({ error: 'Signing not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'sign';

    // === SIGN action: requires admin auth ===
    if (action === 'sign') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const userId = claimsData.claims.sub;

      const { data: roleData } = await supabase
        .from('user_roles').select('role')
        .eq('user_id', userId).eq('role', 'admin').single();
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const SignSchema = z.object({ certification_id: z.string().uuid() });
      const signParse = SignSchema.safeParse(await req.json());
      if (!signParse.success) {
        return new Response(JSON.stringify({ error: "Données invalides", details: signParse.error.issues.map(i => i.message) }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { certification_id } = signParse.data;

      const { data: cert, error: certError } = await supabase
        .from('certifications').select('*').eq('id', certification_id).single();
      if (certError || !cert) {
        return new Response(JSON.stringify({ error: 'Certification not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const signedPayload = [cert.certificate_id, cert.first_name, cert.last_name, cert.role_title, cert.level, cert.score.toString(), cert.issued_at, cert.valid_until || '', cert.status].join('|');
      const signatureHash = await computeSignature(signedPayload, signingSecret);
      const signedAt = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('certifications').update({ signature_hash: signatureHash, signed_at: signedAt }).eq('id', certification_id);
      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to sign certificate' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, signature_hash: signatureHash, signed_at: signedAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === VERIFY action: PUBLIC (no auth required) ===
    if (action === 'verify') {
      const VerifySchema = z.object({ certificate_id: z.string().min(1).max(50) });
      const verifyParse = VerifySchema.safeParse(await req.json());
      if (!verifyParse.success) {
        return new Response(JSON.stringify({ error: "Données invalides", details: verifyParse.error.issues.map(i => i.message) }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { certificate_id } = verifyParse.data;

      const { data: cert, error: certError } = await supabase
        .from('certifications').select('*').eq('certificate_id', certificate_id).single();
      if (certError || !cert) {
        return new Response(JSON.stringify({ valid: false, error: 'Certificate not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!cert.signature_hash) {
        return new Response(JSON.stringify({
          valid: false, error: 'Certificate not signed',
          certificate: { certificate_id: cert.certificate_id, first_name: cert.first_name, last_name: cert.last_name, role_title: cert.role_title, level: cert.level, score: cert.score, issued_at: cert.issued_at, valid_until: cert.valid_until, status: cert.status, percentile_rank: cert.percentile_rank, min_samples_met: cert.min_samples_met }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const signedPayload = [cert.certificate_id, cert.first_name, cert.last_name, cert.role_title, cert.level, cert.score.toString(), cert.issued_at, cert.valid_until || '', cert.status].join('|');
      const expectedHash = await computeSignature(signedPayload, signingSecret);
      const isValid = expectedHash === cert.signature_hash;

      return new Response(JSON.stringify({
        valid: isValid, signature_hash: cert.signature_hash, signed_at: cert.signed_at, signature_mismatch: !isValid,
        certificate: { certificate_id: cert.certificate_id, first_name: cert.first_name, last_name: cert.last_name, role_title: cert.role_title, level: cert.level, score: cert.score, issued_at: cert.issued_at, valid_until: cert.valid_until, status: cert.status, percentile_rank: cert.percentile_rank, min_samples_met: cert.min_samples_met }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
