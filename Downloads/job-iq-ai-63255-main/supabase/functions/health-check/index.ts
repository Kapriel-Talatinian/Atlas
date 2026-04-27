// health-check/index.ts — Comprehensive health check with alerts

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = getServiceClient();
  let body: Record<string, unknown> = {};
  
  try {
    if (req.method === "POST") {
      body = await req.json().catch(() => ({}));
    }
  } catch {}

  const action = body.action as string | undefined;

  // ── Alert checking action ──
  if (action === "check_alerts") {
    return await handleCheckAlerts(supabase);
  }

  // ── Cron status action ──
  if (action === "cron_status") {
    return await handleCronStatus(supabase);
  }

  // ── Storage status action ──
  if (action === "storage_status") {
    return await handleStorageStatus(supabase);
  }

  // ── Default: health check ──
  const startTime = Date.now();
  const checks: Record<string, { status: string; latency_ms: number; error?: string }> = {};

  // Database check
  try {
    const dbStart = Date.now();
    const { error } = await supabase.from('profiles').select('user_id').limit(1);
    checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      latency_ms: Date.now() - dbStart,
      ...(error && { error: error.message }),
    };
  } catch (e) {
    checks.database = { status: 'unhealthy', latency_ms: 0, error: e instanceof Error ? e.message : 'Unknown' };
  }

  // Storage check
  try {
    const sStart = Date.now();
    const { error } = await supabase.storage.listBuckets();
    checks.storage = {
      status: error ? 'unhealthy' : 'healthy',
      latency_ms: Date.now() - sStart,
      ...(error && { error: error.message }),
    };
  } catch (e) {
    checks.storage = { status: 'unhealthy', latency_ms: 0, error: e instanceof Error ? e.message : 'Unknown' };
  }

  // Email service check
  try {
    const eStart = Date.now();
    const { count: failedCount } = await supabase
      .from('email_send_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    checks.email_service = {
      status: (failedCount || 0) > 10 ? 'degraded' : 'healthy',
      latency_ms: Date.now() - eStart,
    };
  } catch (e) {
    checks.email_service = { status: 'unhealthy', latency_ms: 0, error: e instanceof Error ? e.message : 'Unknown' };
  }

  // Metrics
  const [pendingTasks, activeExperts, pendingEmails, failedEmails, pendingWithdrawals, overdueInvoices] = await Promise.all([
    supabase.from('annotation_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('annotator_domain_certifications').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('email_send_log').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('email_send_log').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'pending').lt('due_date', new Date().toISOString()),
  ]);

  // Last distribution/fraud scan timestamps
  const [lastDistrib, lastFraud] = await Promise.all([
    supabase.from('platform_settings').select('value').eq('key', 'last_distribution_run').maybeSingle(),
    supabase.from('platform_settings').select('value').eq('key', 'last_fraud_scan').maybeSingle(),
  ]);

  // Average API latency (last 1 hour)
  const { data: latencyData } = await supabase
    .from('api_request_logs')
    .select('latency_ms')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(100);
  
  const avgLatency = latencyData && latencyData.length > 0
    ? Math.round(latencyData.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / latencyData.length)
    : 0;

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  return new Response(
    JSON.stringify({
      status: allHealthy ? 'healthy' : 'degraded',
      version: '2.1.0',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      database: checks.database?.status || 'unknown',
      storage: checks.storage?.status || 'unknown',
      email_service: checks.email_service?.status || 'unknown',
      pending_tasks: pendingTasks.count || 0,
      active_experts: activeExperts.count || 0,
      pending_emails: pendingEmails.count || 0,
      failed_emails: failedEmails.count || 0,
      pending_withdrawals: pendingWithdrawals.count || 0,
      overdue_invoices: overdueInvoices.count || 0,
      last_distribution_run: lastDistrib.data ? JSON.parse(lastDistrib.data.value as string) : null,
      last_fraud_scan: lastFraud.data ? JSON.parse(lastFraud.data.value as string) : null,
      avg_api_latency_ms: avgLatency,
      checked_at: new Date().toISOString(),
      checks,
    }),
    {
      status: allHealthy ? 200 : 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// ─── Alert checking ──────────────────────────────────────────────

async function handleCheckAlerts(supabase: ReturnType<typeof getServiceClient>) {
  const alerts: { type: string; message: string; severity: string }[] = [];

  // 1. Failed emails (> 5 in last 24h)
  const { count: failedEmails } = await supabase
    .from('email_send_log')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if ((failedEmails || 0) >= 5) {
    alerts.push({
      type: 'failed_emails',
      message: `${failedEmails} emails en échec dans les dernières 24h`,
      severity: 'high',
    });
  }

  // 2. Overdue invoices (> 7 days)
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount, due_date')
    .eq('status', 'pending')
    .lt('due_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(10);

  if (overdueInvoices && overdueInvoices.length > 0) {
    for (const inv of overdueInvoices) {
      alerts.push({
        type: 'overdue_invoice',
        message: `Facture ${inv.invoice_number || inv.id} en retard (échéance: ${inv.due_date})`,
        severity: 'high',
      });
    }
  }

  // 3. Low trust score experts (< 40)
  const { data: lowTrustExperts } = await supabase
    .from('annotator_profiles')
    .select('id, trust_score')
    .lt('trust_score', 40)
    .eq('is_active', true)
    .limit(10);

  if (lowTrustExperts && lowTrustExperts.length > 0) {
    for (const exp of lowTrustExperts) {
      alerts.push({
        type: 'expert_trust_critical',
        message: `Expert ${exp.id} a un trust score de ${exp.trust_score} (seuil: 40)`,
        severity: 'medium',
      });
    }
  }

  // 4. Distribution stalled (> 30 min)
  const { data: lastDistrib } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'last_distribution_run')
    .maybeSingle();

  if (lastDistrib?.value) {
    const lastRun = new Date(JSON.parse(lastDistrib.value as string));
    const minutesAgo = (Date.now() - lastRun.getTime()) / (60 * 1000);
    if (minutesAgo > 30) {
      alerts.push({
        type: 'distribution_stalled',
        message: `Distribution bloquée depuis ${Math.floor(minutesAgo)} minutes`,
        severity: 'critical',
      });
    }
  }

  // 5. Quality below SLA (alpha < 0.80)
  const { data: lowAlpha } = await supabase
    .from('alpha_reports')
    .select('task_id, overall_alpha')
    .lt('overall_alpha', 0.67)
    .gte('computed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(5);

  if (lowAlpha && lowAlpha.length > 0) {
    alerts.push({
      type: 'quality_below_sla',
      message: `${lowAlpha.length} tâche(s) avec alpha < 0.67 dans les dernières 24h`,
      severity: 'high',
    });
  }

  // Send admin alert email if any alerts
  if (alerts.length > 0) {
    // Queue notification (not actual email since we use Lovable's system)
    await supabase.from('audit_logs').insert({
      action: 'system.alerts_checked',
      entity_type: 'system',
      new_value: { alerts, checked_at: new Date().toISOString() },
    });
  }

  return new Response(
    JSON.stringify({
      alerts_count: alerts.length,
      alerts,
      checked_at: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// ─── Cron status ────────────────────────────────────────────────

async function handleCronStatus(supabase: ReturnType<typeof getServiceClient>) {
  const cronKeys = [
    { key: 'last_distribution_run', name: 'distribute-tasks', frequency: '5 min', max_age_min: 10 },
    { key: 'last_cleanup_run', name: 'cleanup-expired', frequency: '10 min', max_age_min: 15 },
    { key: 'last_email_run', name: 'process-emails', frequency: '1 min', max_age_min: 5 },
    { key: 'last_sla_check', name: 'check-sla', frequency: '1 hour', max_age_min: 120 },
    { key: 'last_fraud_scan', name: 'fraud-scan', frequency: '1 day', max_age_min: 1500 },
    { key: 'last_overdue_check', name: 'check-overdue', frequency: '1 day', max_age_min: 1500 },
    { key: 'last_blog_generation', name: 'auto-generate-article', frequency: '1 week', max_age_min: 10500 },
  ];

  const { data: settings } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', cronKeys.map((c) => c.key));

  const settingsMap = new Map(
    (settings || []).map((s) => [s.key, s.value])
  );

  const crons = cronKeys.map((cron) => {
    const raw = settingsMap.get(cron.key);
    let lastRun: string | null = null;
    let healthy = false;

    if (raw) {
      try {
        lastRun = JSON.parse(raw as string);
        const ageMin = (Date.now() - new Date(lastRun!).getTime()) / (60 * 1000);
        healthy = ageMin <= cron.max_age_min;
      } catch {}
    }

    return {
      name: cron.name,
      frequency: cron.frequency,
      last_run: lastRun || 'never',
      healthy,
    };
  });

  return new Response(
    JSON.stringify({ crons }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// ─── Storage status ─────────────────────────────────────────────

async function handleStorageStatus(supabase: ReturnType<typeof getServiceClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketStats: Record<string, { files: number }> = {};

  if (buckets) {
    for (const bucket of buckets) {
      try {
        const { data: files } = await supabase.storage.from(bucket.name).list('', { limit: 1000 });
        bucketStats[bucket.name] = {
          files: files?.length || 0,
        };
      } catch {
        bucketStats[bucket.name] = { files: 0 };
      }
    }
  }

  return new Response(
    JSON.stringify({
      buckets: bucketStats,
      total_buckets: buckets?.length || 0,
      checked_at: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
