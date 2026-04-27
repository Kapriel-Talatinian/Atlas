// webhook-dispatch/index.ts — Outgoing webhook dispatch with HMAC signing + retry

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { Errors, ok } from '../_shared/errors.ts';
import { authenticateRequest, getServiceClient } from '../_shared/auth.ts';

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function dispatchToWebhook(
  supabase: ReturnType<typeof getServiceClient>,
  webhook: Record<string, unknown>,
  event: string,
  data: unknown
): Promise<{ success: boolean; status_code: number; latency_ms: number }> {
  const payload = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  const signature = await signPayload(payload, webhook.secret_hash as string);
  const deliveryId = crypto.randomUUID();

  try {
    const start = Date.now();
    const response = await fetch(webhook.url as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-STEF-Signature': `sha256=${signature}`,
        'X-STEF-Event': event,
        'X-STEF-Delivery': deliveryId,
        'User-Agent': 'STEF-Webhook/1.0',
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    const latency = Date.now() - start;
    const success = response.status >= 200 && response.status < 300;
    const responseBody = (await response.text().catch(() => '')).substring(0, 2000);

    // Log delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event,
      payload: JSON.parse(payload),
      status_code: response.status,
      response_body: responseBody,
      latency_ms: latency,
      success,
    });

    // Update webhook state
    const failureCount = success ? 0 : ((webhook.failure_count as number) || 0) + 1;
    const updateData: Record<string, unknown> = {
      last_triggered_at: new Date().toISOString(),
      last_status_code: response.status,
      failure_count: failureCount,
    };

    // Disable after 10 consecutive failures
    if (failureCount >= 10) {
      updateData.active = false;
    }

    await supabase.from('client_webhooks').update(updateData).eq('id', webhook.id);

    return { success, status_code: response.status, latency_ms: latency };
  } catch (e) {
    // Network error or timeout
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event,
      payload: JSON.parse(payload),
      status_code: 0,
      response_body: e instanceof Error ? e.message : 'Unknown error',
      latency_ms: 10000,
      success: false,
    });

    await supabase
      .from('client_webhooks')
      .update({
        failure_count: ((webhook.failure_count as number) || 0) + 1,
        last_triggered_at: new Date().toISOString(),
        last_status_code: 0,
      })
      .eq('id', webhook.id);

    return { success: false, status_code: 0, latency_ms: 10000 };
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Only internal calls (service role) can dispatch webhooks
    const auth = await authenticateRequest(req);
    if (!auth.authenticated || auth.auth_type !== 'service') {
      return Errors.forbidden('Réservé aux appels internes.');
    }

    const body = await req.json();
    const { client_id, event, data, max_retries = 3 } = body;

    if (!client_id || !event || data === undefined) {
      return Errors.badRequest('client_id, event et data sont requis.', 'MISSING_FIELDS');
    }

    const supabase = getServiceClient();

    // Get active webhooks for this client and event
    const { data: webhooks, error } = await supabase
      .from('client_webhooks')
      .select('*')
      .eq('client_id', client_id)
      .eq('active', true)
      .contains('events', [event]);

    if (error) return Errors.internal(error.message);
    if (!webhooks || webhooks.length === 0) {
      return ok({ dispatched: 0, message: 'Aucun webhook actif pour cet événement.' });
    }

    // Dispatch to all matching webhooks with retry
    const results = [];
    for (const webhook of webhooks) {
      let result = { success: false, status_code: 0, latency_ms: 0 };

      for (let attempt = 0; attempt <= max_retries; attempt++) {
        result = await dispatchToWebhook(supabase, webhook, event, data);
        if (result.success) break;

        if (attempt < max_retries) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }

      results.push({
        webhook_id: webhook.id,
        url: webhook.url,
        success: result.success,
        status_code: result.status_code,
        latency_ms: result.latency_ms,
      });
    }

    return ok({
      dispatched: results.length,
      results,
    });
  } catch (e) {
    console.error('Webhook dispatch error:', e);
    return Errors.internal('Erreur lors du dispatch de webhook.');
  }
});
