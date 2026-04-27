// _shared/logger.ts — Structured request logging + audit trail

import { getServiceClient } from './auth.ts';

export interface LogEntry {
  client_id?: string;
  user_id?: string;
  endpoint: string;
  method: string;
  status_code: number;
  latency_ms: number;
  ip_address?: string;
  user_agent?: string;
  request_body_size?: number;
  response_body_size?: number;
  error_message?: string;
  request_id: string;
}

export function generateRequestId(): string {
  return 'req_' + crypto.randomUUID().replace(/-/g, '').substring(0, 24);
}

export async function logRequest(entry: LogEntry): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from('api_request_logs').insert({
      client_id: entry.client_id || null,
      endpoint: entry.endpoint,
      method: entry.method,
      status_code: entry.status_code,
      latency_ms: entry.latency_ms,
      ip_address: entry.ip_address || null,
      user_agent: entry.user_agent || null,
      request_body_size: entry.request_body_size || null,
      response_body_size: entry.response_body_size || null,
    });
  } catch (e) {
    console.error('Failed to log request:', e);
  }
}

export async function auditLog(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from('audit_logs').insert({
      user_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      new_value: details || null,
    });
  } catch (e) {
    console.error('Failed to write audit log:', e);
  }
}
