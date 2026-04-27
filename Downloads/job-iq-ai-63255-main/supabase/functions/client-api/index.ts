import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { authenticateRequest, getServiceClient, generateApiKey, hashApiKey, type AuthResult } from '../_shared/auth.ts';
import { checkRateLimit, rateLimitHeaders } from '../_shared/rate-limiter.ts';
import { generateRequestId, logRequest, auditLog } from '../_shared/logger.ts';
import { sanitizeInput } from '../_shared/validators.ts';

// ─── Constants ───────────────────────────────────────────────
const VALID_DOMAINS = ['medical', 'legal', 'finance', 'code'] as const;
const VALID_TASK_TYPES = ['scoring', 'preference_dpo', 'comparison_ab', 'red_teaming', 'fact_checking', 'text_generation', 'span_annotation', 'extraction', 'conversation_rating'] as const;
const VALID_SLA_TIERS = ['standard', 'priority', 'express'] as const;
const VALID_EXPORT_FORMATS = ['jsonl', 'csv', 'parquet', 'huggingface'] as const;
const VALID_WEBHOOK_EVENTS = ['project.completed', 'project.status_changed', 'batch.ready', 'task.flagged', 'export.ready', 'quality.alert', 'sla.at_risk'] as const;
const VALID_TASK_STATUSES = ['queued', 'assigned', 'in_progress', 'submitted', 'in_review', 'adjudication', 'completed', 'rejected', 'auto_annotated'] as const;
const STATUS_ALIAS_MAP: Record<string, string> = { pending: 'queued', done: 'completed', review: 'in_review' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_PAGE = 100;

// ─── Domain/Type mapping (API ↔ DB) ─────────────────────────
// La colonne public.annotation_projects.domain est un TEXT libre en base.
// On stocke désormais les valeurs documentées de l'API telles quelles,
// tout en conservant la compatibilité lecture/filtrage avec l'ancien mapping.
const DOMAIN_API_TO_DB: Record<string, string> = {
  medical: 'medical',
  legal: 'legal',
  finance: 'finance',
  code: 'code',
};
const DOMAIN_DB_TO_API: Record<string, string> = {
  medical: 'medical',
  legal: 'legal',
  juridique_fr: 'legal',
  finance: 'finance',
  code: 'code',
  code_tech: 'code',
};
const TYPE_API_TO_DB: Record<string, string> = {
  scoring: 'rating', preference_dpo: 'ranking', fact_checking: 'validation',
  red_teaming: 'red_teaming', comparison_ab: 'comparison', text_generation: 'text_generation',
  span_annotation: 'span_annotation', extraction: 'extraction', conversation_rating: 'conversation_rating',
};
const TYPE_DB_TO_API: Record<string, string> = { rating: 'scoring', ranking: 'preference_dpo', validation: 'fact_checking', red_teaming: 'red_teaming', comparison: 'comparison_ab', text_generation: 'text_generation', span_annotation: 'span_annotation', extraction: 'extraction', conversation_rating: 'conversation_rating', classification: 'classification' };

function mapDomainToApi(dbDomain: string): string { return DOMAIN_DB_TO_API[dbDomain] || dbDomain; }
function mapTypeToApi(dbType: string): string { return TYPE_DB_TO_API[dbType] || dbType; }

// ─── Security headers ───────────────────────────────────────
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// ─── Standardized error response ─────────────────────────────
function errorResponse(
  status: number,
  type: string,
  message: string,
  code: string,
  param?: string,
  extraHeaders?: Record<string, string>,
): Response {
  const error: Record<string, unknown> = { type, message, code };
  if (param) error.param = param;
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

function okResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

// ─── Helpers ─────────────────────────────────────────────────
function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function parsePagination(params: Record<string, string>): { page: number; perPage: number } {
  const page = Math.max(1, parseInt(String(params?.page ?? '1'), 10) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(String(params?.per_page ?? '20'), 10) || 20));
  return { page, perPage };
}

function parsePath(path: string): { segments: string[]; raw: string } {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return { segments: clean.split('/').filter(Boolean), raw: path };
}

// ─── Route handlers ─────────────────────────────────────────

async function handleListProjects(supabase: ReturnType<typeof createClient>, clientId: string, params: Record<string, string>) {
  const { page, perPage } = parsePagination(params);
  const offset = (page - 1) * perPage;

  let query = supabase
    .from('annotation_projects')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (params?.status) query = query.eq('status', params.status);
  if (params?.domain) query = query.eq('domain', DOMAIN_API_TO_DB[params.domain] || params.domain);

  const { data, error, count } = await query;
  if (error) return errorResponse(500, 'internal_error', 'Erreur lors de la récupération des projets.', 'INTERNAL_ERROR');

  return okResponse({
    data: (data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      domain: mapDomainToApi(p.domain as string),
      task_type: mapTypeToApi(p.type as string),
      status: p.status,
      total_tasks: p.total_items || 0,
      completed_tasks: p.completed_tasks || 0,
      sla_tier: p.sla_tier || 'standard',
      created_at: p.created_at,
    })),
    pagination: { page, per_page: perPage, total: count || 0 },
  });
}

async function handleGetProject(supabase: ReturnType<typeof createClient>, clientId: string, projectId: string) {
  const { data: p, error } = await supabase
    .from('annotation_projects')
    .select('*')
    .eq('id', projectId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) return errorResponse(500, 'internal_error', 'Erreur interne.', 'INTERNAL_ERROR');
  if (!p) return errorResponse(404, 'not_found', 'Projet non trouvé.', 'NOT_FOUND');

  const [totalRes, completedRes, queuedRes, inProgressRes] = await Promise.all([
    supabase.from('annotation_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('annotation_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'completed'),
    supabase.from('annotation_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'queued'),
    supabase.from('annotation_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId).in('status', ['assigned', 'in_progress', 'in_review', 'submitted']),
  ]);

  const realTotal = totalRes.count ?? p.total_items ?? 0;

  const { data: sla } = await supabase
    .from('sla_tracking')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  return okResponse({
    id: p.id, name: p.name, description: p.description,
    domain: mapDomainToApi(p.domain), task_type: mapTypeToApi(p.type),
    languages: p.languages, status: p.status,
    total_tasks: realTotal,
    completed_tasks: completedRes.count || 0,
    queued_tasks: queuedRes.count || 0,
    in_progress_tasks: inProgressRes.count || 0,
    sla_tier: p.sla_tier || 'standard',
    complexity_level: p.complexity_level,
    sla: sla ? {
      committed_delivery_date: sla.committed_delivery_date,
      guaranteed_min_alpha: sla.committed_min_alpha,
      at_risk: sla.at_risk,
      current_alpha: sla.current_alpha,
    } : null,
    created_at: p.created_at, updated_at: p.updated_at,
  });
}

async function handleCreateProject(supabase: ReturnType<typeof createClient>, clientId: string, body: Record<string, unknown>, auth: AuthResult) {
  const name = typeof body.name === 'string' ? sanitizeInput(body.name) : '';
  const domain = typeof body.domain === 'string' ? body.domain : '';
  const taskType = typeof body.task_type === 'string' ? body.task_type : '';
  const slaTier = typeof body.sla_tier === 'string' ? body.sla_tier : 'standard';

  // Validate required fields
  const errors: string[] = [];
  if (!name || name.trim().length < 3) errors.push("Le champ 'name' est obligatoire (min. 3 caractères).");
  if (!domain) errors.push("Le champ 'domain' est obligatoire.");
  else if (!(VALID_DOMAINS as readonly string[]).includes(domain))
    errors.push(`Le champ 'domain' doit être l'une des valeurs suivantes : ${VALID_DOMAINS.join(', ')}.`);
  if (!taskType) errors.push("Le champ 'task_type' est obligatoire.");
  else if (!(VALID_TASK_TYPES as readonly string[]).includes(taskType))
    errors.push(`Le champ 'task_type' doit être l'une des valeurs suivantes : ${VALID_TASK_TYPES.join(', ')}.`);
  if (slaTier !== 'standard' && !(VALID_SLA_TIERS as readonly string[]).includes(slaTier))
    errors.push(`Le champ 'sla_tier' doit être l'une des valeurs suivantes : ${VALID_SLA_TIERS.join(', ')}.`);

  if (errors.length > 0) return errorResponse(400, 'invalid_request', errors[0], 'VALIDATION_ERROR');

  const dbDomain = DOMAIN_API_TO_DB[domain] || domain;
  const dbType = TYPE_API_TO_DB[taskType] || taskType;

  const { data: project, error } = await supabase
    .from('annotation_projects')
    .insert({
      client_id: clientId,
      name,
      description: typeof body.description === 'string' ? sanitizeInput(body.description) : '',
      domain: dbDomain,
      type: dbType,
      languages: [typeof body.language === 'string' ? body.language : 'fr'],
      sla_tier: slaTier,
      status: 'draft',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[CREATE_PROJECT_DB_ERROR]', JSON.stringify({ error_message: error.message, error_code: error.code, error_details: error.details, domain: dbDomain, type: dbType }));
    return errorResponse(500, 'internal_error', 'Impossible de créer le projet.', 'INTERNAL_ERROR');
  }

  await auditLog(auth.client_id || auth.user_id || 'unknown', 'project.created', 'project', project.id, { name });

  return okResponse({
    id: project.id, name: project.name,
    domain: mapDomainToApi(project.domain),
    task_type: taskType,
    language: typeof body.language === 'string' ? body.language : 'fr',
    status: 'draft',
    created_at: project.created_at,
  }, 201);
}

async function handleUpdateProject(supabase: ReturnType<typeof createClient>, clientId: string, projectId: string, body: Record<string, unknown>) {
  const { data: existing } = await supabase
    .from('annotation_projects')
    .select('id, status')
    .eq('id', projectId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!existing) return errorResponse(404, 'not_found', 'Projet non trouvé.', 'NOT_FOUND');
  if (existing.status !== 'draft') return errorResponse(400, 'invalid_request', 'Seuls les projets en brouillon peuvent être modifiés.', 'PROJECT_NOT_DRAFT');

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = sanitizeInput(body.name);
  if (typeof body.description === 'string') updates.description = sanitizeInput(body.description);

  if (Object.keys(updates).length === 0) return errorResponse(400, 'invalid_request', 'Aucun champ à mettre à jour.', 'NO_UPDATES');

  const { data, error } = await supabase
    .from('annotation_projects')
    .update(updates)
    .eq('id', projectId)
    .select('*')
    .single();

  if (error) return errorResponse(500, 'internal_error', 'Erreur interne.', 'INTERNAL_ERROR');
  return okResponse({ id: data.id, name: data.name, status: data.status, updated_at: data.updated_at });
}

async function handleDeleteProject(supabase: ReturnType<typeof createClient>, clientId: string, projectId: string) {
  const { data: existing } = await supabase
    .from('annotation_projects')
    .select('id, status')
    .eq('id', projectId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!existing) return errorResponse(404, 'not_found', 'Projet non trouvé.', 'NOT_FOUND');
  if (existing.status !== 'draft') return errorResponse(400, 'invalid_request', 'Seuls les projets en brouillon peuvent être supprimés.', 'PROJECT_NOT_DRAFT');

  const { error } = await supabase.from('annotation_projects').delete().eq('id', projectId);
  if (error) return errorResponse(500, 'internal_error', 'Erreur interne.', 'INTERNAL_ERROR');

  return okResponse({ deleted: true, id: projectId });
}

// ─── POST /uploads — Create upload + insert rows into annotation_items ───
async function handleCreateUpload(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const projectId = body.project_id;
  if (!isValidUUID(projectId)) {
    return errorResponse(400, 'invalid_request', "Le champ 'project_id' est obligatoire (UUID).", 'INVALID_PARAM', 'project_id');
  }

  // Verify project belongs to this client
  const { data: project } = await supabase
    .from('annotation_projects')
    .select('id, domain, type, status')
    .eq('id', projectId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!project) return errorResponse(404, 'not_found', 'Projet non trouvé.', 'NOT_FOUND');

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return errorResponse(400, 'invalid_request', "Le champ 'rows' doit être un tableau non vide d'objets.", 'INVALID_PARAM', 'rows');
  }

  if (rows.length > 10000) {
    return errorResponse(400, 'invalid_request', "Maximum 10 000 lignes par upload.", 'LIMIT_EXCEEDED', 'rows');
  }

  const totalRows = rows.length;
  const fileName = typeof body.file_name === 'string' ? body.file_name : `api-upload-${Date.now()}.jsonl`;

  // Create client_uploads record
  const { data: upload, error: uploadErr } = await supabase
    .from('client_uploads')
    .insert({
      project_id: projectId,
      client_id: clientId,
      file_name: fileName,
      file_format: 'jsonl',
      total_rows: totalRows,
      valid_rows: totalRows,
      invalid_rows: 0,
      duplicate_rows: 0,
      pii_detected_rows: 0,
      validation_status: 'valid',
      validated_at: new Date().toISOString(),
      quality_score: 1.0,
    })
    .select('id')
    .single();

  if (uploadErr || !upload) {
    console.error('[CREATE_UPLOAD_ERROR]', JSON.stringify(uploadErr));
    return errorResponse(500, 'internal_error', "Impossible de créer l'upload.", 'INTERNAL_ERROR');
  }

  // Insert rows into annotation_items in batches of 500
  const INSERT_BATCH = 500;
  let insertedCount = 0;
  const allInsertedIds: string[] = [];

  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const chunk = rows.slice(i, i + INSERT_BATCH).map((row: unknown) => ({
      project_id: projectId as string,
      content: typeof row === 'object' && row !== null ? row : { prompt: String(row) },
      status: 'queued',
      ingested_at: new Date().toISOString(),
    }));

    const { error: insertErr, data: inserted } = await supabase
      .from('annotation_items')
      .insert(chunk)
      .select('id');

    if (insertErr) {
      console.error('[INSERT_ITEMS_ERROR]', JSON.stringify({ batch_index: i, error: insertErr.message }));
    } else {
      insertedCount += inserted?.length ?? 0;
      for (const item of (inserted || [])) allInsertedIds.push(item.id);
    }
  }

  // Update upload record with final counts
  await supabase
    .from('client_uploads')
    .update({ valid_rows: insertedCount })
    .eq('id', upload.id);

  // Create annotation_batches (groups of 50 items)
  const BATCH_GROUP_SIZE = 50;
  let batchesCreated = 0;
  for (let i = 0; i < allInsertedIds.length; i += BATCH_GROUP_SIZE) {
    const batchIds = allInsertedIds.slice(i, i + BATCH_GROUP_SIZE);
    const batchNum = Math.floor(i / BATCH_GROUP_SIZE) + 1;

    const { data: batch } = await supabase
      .from('annotation_batches')
      .insert({
        project_id: projectId as string,
        name: `${fileName} — Lot ${batchNum}`,
        total_items: batchIds.length,
        status: 'active',
      })
      .select('id')
      .single();

    if (batch) {
      batchesCreated++;
      // Link items to this batch
      await supabase
        .from('annotation_items')
        .update({ batch_id: batch.id })
        .in('id', batchIds);
    }
  }

  // Update project total_items and activate
  const { count: realTotal } = await supabase
    .from('annotation_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId as string);

  await supabase
    .from('annotation_projects')
    .update({
      total_items: realTotal ?? insertedCount,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId as string);

  return okResponse({
    upload_id: upload.id,
    project_id: projectId,
    status: 'valid',
    total_rows: totalRows,
    valid_rows: insertedCount,
    invalid_rows: totalRows - insertedCount,
    batches_created: batchesCreated,
    project_status: 'active',
    message: `${insertedCount} items insérés en ${batchesCreated} lots.`,
  }, 201);
}

async function handleGetUpload(supabase: ReturnType<typeof createClient>, clientId: string, uploadId: string) {
  const { data: upload, error } = await supabase
    .from('client_uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) return errorResponse(500, 'internal_error', 'Erreur interne.', 'INTERNAL_ERROR');
  if (!upload) return errorResponse(404, 'not_found', 'Upload non trouvé.', 'NOT_FOUND');

  return okResponse({
    upload_id: upload.id, project_id: upload.project_id, file_name: upload.file_name,
    status: upload.validation_status, total_rows: upload.total_rows,
    valid_rows: upload.valid_rows, invalid_rows: upload.invalid_rows,
    duplicate_rows: upload.duplicate_rows, pii_detected_rows: upload.pii_detected_rows,
    quality_score: upload.quality_score, detected_language: upload.detected_language,
    cost_estimate: upload.estimated_cost ? { total: upload.estimated_cost, currency: 'USD' } : null,
    delivery_estimate_days: upload.estimated_delivery_days,
    errors: upload.validation_errors, created_at: upload.created_at,
  });
}

async function handleConfirmUpload(supabase: ReturnType<typeof createClient>, clientId: string, uploadId: string) {
  const { data: upload } = await supabase
    .from('client_uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('client_id', clientId)
    .eq('validation_status', 'valid')
    .maybeSingle();

  if (!upload) return errorResponse(400, 'invalid_request', 'Upload non trouvé ou non validé.', 'UPLOAD_NOT_VALID');

  // Mark upload as confirmed
  await supabase.from('client_uploads').update({ confirmed_at: new Date().toISOString() }).eq('id', uploadId);

  // Count actual items inserted for this project
  const { count: realItemCount } = await supabase
    .from('annotation_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', upload.project_id);

  const totalItems = realItemCount ?? upload.valid_rows ?? 0;

  // Check if batches already exist; if not, create them
  const { count: existingBatches } = await supabase
    .from('annotation_batches')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', upload.project_id);

  let batchesCreated = existingBatches ?? 0;

  if ((existingBatches ?? 0) === 0 && totalItems > 0) {
    // Get all unbatched items
    const { data: unbatchedItems } = await supabase
      .from('annotation_items')
      .select('id')
      .eq('project_id', upload.project_id)
      .is('batch_id', null)
      .order('created_at', { ascending: true });

    const ids = (unbatchedItems || []).map((i: { id: string }) => i.id);
    const BATCH_GROUP = 50;
    batchesCreated = 0;

    for (let i = 0; i < ids.length; i += BATCH_GROUP) {
      const batchIds = ids.slice(i, i + BATCH_GROUP);
      const batchNum = Math.floor(i / BATCH_GROUP) + 1;

      const { data: batch } = await supabase
        .from('annotation_batches')
        .insert({
          project_id: upload.project_id,
          name: `${upload.file_name} — Lot ${batchNum}`,
          total_items: batchIds.length,
          status: 'active',
        })
        .select('id')
        .single();

      if (batch) {
        batchesCreated++;
        await supabase
          .from('annotation_items')
          .update({ batch_id: batch.id })
          .in('id', batchIds);
      }
    }
  }

  // Update project total_items with real count and activate
  if (totalItems > 0) {
    await supabase
      .from('annotation_projects')
      .update({
        total_items: totalItems,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', upload.project_id)
      .eq('client_id', clientId);
  }

  return okResponse({
    upload_id: uploadId, status: 'confirmed',
    tasks_created: totalItems,
    batches_created: batchesCreated,
    project_status: 'active',
    message: `${totalItems} tâches créées en ${batchesCreated} lots. L'annotation a démarré.`,
  });
}

async function handleListTasks(supabase: ReturnType<typeof createClient>, clientId: string, projectId: string, params: Record<string, string>) {
  const { data: proj } = await supabase
    .from('annotation_projects')
    .select('id')
    .eq('id', projectId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!proj) return errorResponse(404, 'not_found', 'Projet non trouvé.', 'NOT_FOUND');

  const { page, perPage } = parsePagination(params);
  const offset = (page - 1) * perPage;

  // Validate and map status parameter
  let statusFilter: string | null = null;
  if (params?.status) {
    const mappedStatus = STATUS_ALIAS_MAP[params.status] || params.status;
    if (!(VALID_TASK_STATUSES as readonly string[]).includes(mappedStatus)) {
      return errorResponse(400, 'invalid_request',
        `Statut invalide: '${params.status}'. Valeurs acceptées : ${[...VALID_TASK_STATUSES, 'pending', 'done', 'review'].join(', ')}.`,
        'INVALID_VALUE', 'status');
    }
    statusFilter = mappedStatus;
  }

  try {
    let query = supabase
      .from('annotation_items')
      .select('id, content, status, complexity_level, is_gold_standard, is_calibration, created_at, completed_at', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter as any);

    // Get total count first to avoid out-of-range offset
    const { count: totalCount, error: countError } = await supabase
      .from('annotation_items')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const safeTotal = totalCount ?? 0;

    // If offset exceeds total (or total is 0 and page > 1), return empty page
    if (offset >= safeTotal) {
      return okResponse({
        data: [],
        pagination: { page, per_page: perPage, total: safeTotal },
      });
    }

    // Safe range: clamp end to last available row
    const rangeEnd = Math.min(offset + perPage - 1, safeTotal - 1);
    query = query.range(offset, rangeEnd);

    const { data, error } = await query;
    if (error) {
      console.error('Tasks query error:', JSON.stringify(error));
      return errorResponse(500, 'internal_error', 'Erreur lors de la récupération des tâches.', 'INTERNAL_ERROR');
    }

    return okResponse({
      data: (data || []).map((t: Record<string, unknown>) => ({
        id: t.id, content: t.content, status: t.status,
        complexity_level: t.complexity_level, is_gold_standard: t.is_gold_standard,
        created_at: t.created_at, completed_at: t.completed_at,
      })),
      pagination: { page, per_page: perPage, total: safeTotal },
    });
  } catch (err) {
    console.error('handleListTasks crash:', err);
    return errorResponse(500, 'internal_error', 'Erreur interne lors de la pagination des tâches.', 'INTERNAL_ERROR');
  }
}

async function handleExport(supabase: ReturnType<typeof createClient>, clientId: string, projectId: string, body: Record<string, unknown>) {
  const { data: proj } = await supabase
    .from('annotation_projects')
    .select('id, status, total_items, completed_tasks')
    .eq('id', projectId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!proj) return errorResponse(404, 'not_found', 'Projet non trouvé.', 'NOT_FOUND');

  // BLOCAGE : le projet doit être terminé
  if (proj.status !== 'completed') {
    return errorResponse(400, 'invalid_request',
      `Le dataset ne peut être exporté que lorsque le projet est terminé. Statut actuel : ${proj.status}. Avancement : ${proj.completed_tasks || 0}/${proj.total_items} tâches.`,
      'PROJECT_NOT_COMPLETED');
  }

  const format = typeof body.format === 'string' ? body.format : 'jsonl';
  if (!(VALID_EXPORT_FORMATS as readonly string[]).includes(format)) {
    return errorResponse(422, 'validation_error',
      `Format invalide. Valeurs acceptées : ${VALID_EXPORT_FORMATS.join(', ')}.`,
      'INVALID_VALUE', 'format');
  }

  // Validate min_alpha — accept both number and numeric string
  let minAlpha = 0.80;
  if (body.min_alpha !== undefined && body.min_alpha !== null) {
    const parsed = Number(body.min_alpha);
    if (isNaN(parsed) || parsed < 0 || parsed > 1) {
      return errorResponse(422, 'validation_error',
        'min_alpha doit être un nombre entre 0.0 et 1.0.',
        'INVALID_VALUE', 'min_alpha');
    }
    minAlpha = parsed;
  }

  const { data: exportData, error } = await supabase
    .from('dataset_exports')
    .insert({
      project_id: projectId,
      client_id: clientId,
      format,
      min_alpha: minAlpha,
      include_reasoning: body.include_reasoning !== false,
      include_raw_annotations: body.include_raw_annotations === true,
      status: 'generating',
    })
    .select('*')
    .single();

  if (error) return errorResponse(500, 'internal_error', 'Impossible de créer l\'export.', 'INTERNAL_ERROR');

  return okResponse({
    export_id: exportData.id, status: 'generating', format,
    message: 'Export en cours de génération.',
  }, 202);
}

async function handleGetExport(supabase: ReturnType<typeof createClient>, clientId: string, exportId: string) {
  const { data: exp } = await supabase
    .from('dataset_exports')
    .select('*')
    .eq('id', exportId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!exp) return errorResponse(404, 'not_found', 'Export non trouvé.', 'NOT_FOUND');

  return okResponse({
    export_id: exp.id, status: exp.status, format: exp.format,
    total_items: exp.total_items, download_url: exp.download_url,
    file_size_bytes: exp.file_size_bytes, created_at: exp.created_at,
    completed_at: exp.completed_at, expires_at: exp.expires_at,
  });
}

// ─── Webhook management ────────────────────────────────────

async function handleCreateWebhook(supabase: ReturnType<typeof createClient>, clientId: string, body: Record<string, unknown>) {
  // Validate URL
  if (!body.url || typeof body.url !== 'string') {
    return errorResponse(400, 'invalid_request', "Le champ 'url' est obligatoire.", 'MISSING_FIELD', 'url');
  }
  try { new URL(body.url as string); } catch {
    return errorResponse(400, 'invalid_request', 'URL invalide.', 'INVALID_VALUE', 'url');
  }

  // Validate events
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return errorResponse(400, 'invalid_request', "Le champ 'events' doit être un tableau non vide.", 'MISSING_FIELD', 'events');
  }
  const invalidEvents = (body.events as unknown[]).filter(e => !(VALID_WEBHOOK_EVENTS as readonly string[]).includes(e as string));
  if (invalidEvents.length > 0) {
    return errorResponse(400, 'invalid_request',
      `Événements invalides : ${invalidEvents.join(', ')}. Valeurs acceptées : ${VALID_WEBHOOK_EVENTS.join(', ')}.`,
      'INVALID_VALUE', 'events');
  }

  const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
  const secretHash = await hashApiKey(secret);

  const { data, error } = await supabase
    .from('client_webhooks')
    .insert({ client_id: clientId, url: body.url, events: body.events, secret_hash: secretHash })
    .select('*')
    .single();

  if (error) return errorResponse(500, 'internal_error', 'Erreur interne.', 'INTERNAL_ERROR');

  return okResponse({ id: data.id, url: data.url, events: data.events, secret, created_at: data.created_at }, 201);
}

async function handleListWebhooks(supabase: ReturnType<typeof createClient>, clientId: string) {
  const { data, error } = await supabase
    .from('client_webhooks')
    .select('id, url, events, active, failure_count, last_triggered_at, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) return errorResponse(500, 'internal_error', 'Erreur interne.', 'INTERNAL_ERROR');
  return okResponse({ data: data || [] });
}

async function handleDeleteWebhook(supabase: ReturnType<typeof createClient>, clientId: string, webhookId: string) {
  const { data: existing } = await supabase
    .from('client_webhooks')
    .select('id')
    .eq('id', webhookId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!existing) return errorResponse(404, 'not_found', 'Webhook non trouvé.', 'NOT_FOUND');

  await supabase.from('client_webhooks').delete().eq('id', webhookId);
  return okResponse({ deleted: true, id: webhookId });
}

async function handleTestWebhook(supabase: ReturnType<typeof createClient>, clientId: string, webhookId: string) {
  const { data: webhook } = await supabase
    .from('client_webhooks')
    .select('*')
    .eq('id', webhookId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!webhook) return errorResponse(404, 'not_found', 'Webhook non trouvé.', 'NOT_FOUND');

  const testPayload = {
    event: 'test.ping',
    data: { message: 'Ceci est un test de webhook STEF.', timestamp: new Date().toISOString() },
    timestamp: new Date().toISOString(),
  };

  try {
    const start = Date.now();
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'STEF-Webhook/1.0', 'X-STEF-Event': 'test.ping' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;
    const success = response.status >= 200 && response.status < 300;
    const responseText = await response.text().catch(() => '');

    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhookId, event: 'test.ping', payload: testPayload,
      status_code: response.status, response_body: responseText.substring(0, 1000),
      latency_ms: latency, success,
    });

    return okResponse({ success, status_code: response.status, latency_ms: latency });
  } catch (e) {
    return okResponse({ success: false, error: e instanceof Error ? e.message : 'Timeout ou erreur réseau' });
  }
}

// ─── API Key management ─────────────────────────────────────

async function handleRegenerateApiKey(supabase: ReturnType<typeof createClient>, clientId: string) {
  const { key, prefix } = generateApiKey();
  const keyHash = await hashApiKey(key);

  const { error } = await supabase
    .from('clients')
    .update({ api_key_hash: keyHash, api_key_prefix: prefix, api_key_created_at: new Date().toISOString() })
    .eq('id', clientId);

  if (error) return errorResponse(500, 'internal_error', 'Erreur interne.', 'INTERNAL_ERROR');

  return okResponse({ api_key: key, prefix, message: 'Conservez cette clé. Elle ne sera plus affichée.' }, 201);
}

// ─── Invoices ───────────────────────────────────────────────

async function handleListInvoices(supabase: ReturnType<typeof createClient>, clientId: string, params: Record<string, string>) {
  const { page, perPage } = parsePagination(params);
  const offset = (page - 1) * perPage;

  const { data, error, count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) return errorResponse(500, 'internal_error', 'Erreur interne.', 'INTERNAL_ERROR');

  return okResponse({
    data: (data || []).map((inv: Record<string, unknown>) => ({
      id: inv.id, invoice_number: inv.invoice_number,
      subtotal: inv.subtotal, tax_amount: inv.tax_amount, total: inv.total,
      currency: 'USD', status: inv.status, due_date: inv.due_date,
      paid_at: inv.paid_at, created_at: inv.created_at,
    })),
    pagination: { page, per_page: perPage, total: count || 0 },
  });
}

async function handleGetInvoice(supabase: ReturnType<typeof createClient>, clientId: string, invoiceId: string) {
  const { data: inv } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!inv) return errorResponse(404, 'not_found', 'Facture non trouvée.', 'NOT_FOUND');

  return okResponse({
    id: inv.id, invoice_number: inv.invoice_number,
    subtotal: inv.subtotal, tax_rate: inv.tax_rate, tax_amount: inv.tax_amount,
    total: inv.total, currency: 'USD', status: inv.status,
    due_date: inv.due_date, paid_at: inv.paid_at, notes: inv.notes,
    created_at: inv.created_at,
  });
}

// ─── Project Stats ──────────────────────────────────────────

async function handleProjectStats(supabase: ReturnType<typeof createClient>, clientId: string, projectId: string) {
  const { data: proj } = await supabase
    .from('annotation_projects')
    .select('id, total_items, completed_tasks')
    .eq('id', projectId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!proj) return errorResponse(404, 'not_found', 'Projet non trouvé.', 'NOT_FOUND');

  const [totalRes, completedRes, queuedRes, inProgressRes] = await Promise.all([
    supabase.from('annotation_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('annotation_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'completed'),
    supabase.from('annotation_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'queued'),
    supabase.from('annotation_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId).in('status', ['assigned', 'in_progress']),
  ]);

  const realTotal = totalRes.count ?? proj.total_items ?? 0;

  // Sync total_items if out of date
  if (realTotal !== proj.total_items && realTotal > 0) {
    await supabase.from('annotation_projects').update({ total_items: realTotal }).eq('id', projectId);
  }

  const { data: qualityReport } = await supabase
    .from('annotation_quality_reports')
    .select('metrics, drifted, computed_at')
    .eq('project_id', projectId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return okResponse({
    project_id: projectId, total_items: realTotal,
    completed: completedRes.count || 0, queued: queuedRes.count || 0,
    in_progress: inProgressRes.count || 0,
    completion_rate: realTotal > 0 ? Math.round(((completedRes.count || 0) / realTotal) * 100) : 0,
    quality: qualityReport ? {
      metrics: qualityReport.metrics, drifted: qualityReport.drifted,
      computed_at: qualityReport.computed_at,
    } : null,
  });
}

// ─── POST /estimate — Devis de prix ─────────────────────────
async function handleEstimate(supabase: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const domain = typeof body.domain === 'string' ? body.domain : '';
  const taskType = typeof body.task_type === 'string' ? body.task_type : '';
  const numTasks = typeof body.num_tasks === 'number' ? body.num_tasks : 0;
  const language = typeof body.language === 'string' ? body.language : 'fr';
  const slaTier = typeof body.sla_tier === 'string' ? body.sla_tier : 'standard';
  const clientPlan = typeof body.client_plan === 'string' ? body.client_plan : 'pay_per_task';

  if (!domain || !(VALID_DOMAINS as readonly string[]).includes(domain))
    return errorResponse(400, 'invalid_request', `Le champ 'domain' est obligatoire (${VALID_DOMAINS.join(', ')}).`, 'INVALID_PARAM', 'domain');
  if (!taskType || !(VALID_TASK_TYPES as readonly string[]).includes(taskType))
    return errorResponse(400, 'invalid_request', `Le champ 'task_type' est obligatoire (${VALID_TASK_TYPES.join(', ')}).`, 'INVALID_PARAM', 'task_type');
  if (!numTasks || numTasks < 1)
    return errorResponse(400, 'invalid_request', "Le champ 'num_tasks' doit être un entier positif.", 'INVALID_PARAM', 'num_tasks');

  // Get cost estimate
  const { data: costData, error: costErr } = await supabase.rpc('estimate_project_cost', {
    p_domain: domain, p_task_type: taskType, p_language: language,
    p_num_tasks: numTasks, p_client_plan: clientPlan,
  });

  if (costErr) {
    console.error('[ESTIMATE_COST_ERROR]', costErr.message);
    return errorResponse(400, 'invalid_request', costErr.message, 'PRICING_NOT_FOUND');
  }

  const cost = Array.isArray(costData) ? costData[0] : costData;

  // Get delivery estimate
  const { data: deliveryData } = await supabase.rpc('estimate_delivery_v2', {
    p_domain: domain, p_task_type: taskType,
    p_num_tasks: numTasks, p_sla_tier: slaTier,
  });

  const delivery = Array.isArray(deliveryData) ? deliveryData[0] : deliveryData;

  return okResponse({
    unit_price: cost.unit_price,
    volume_discount: `${cost.volume_discount_percent}%`,
    plan_discount: `${cost.plan_discount_percent}%`,
    final_unit_price: cost.discounted_unit_price,
    total_ht: cost.total_before_tax,
    expert_cost: cost.expert_cost_total,
    margin: `${cost.stef_margin_percent}%`,
    sla_tier: slaTier,
    sla_multiplier: delivery?.price_multiplier ?? 1.0,
    estimated_delivery_days: delivery?.estimated_days ?? 7,
    estimated_completion_date: delivery?.estimated_completion_date ?? null,
    annotators_per_task: delivery?.annotators_per_task ?? 2,
    capacity_warning: delivery?.capacity_warning ?? false,
    capacity_message: delivery?.capacity_message ?? '',
    currency: 'USD',
  });
}

// ─── POST /projects/:id/report — Performance report ─────────
async function handleGenerateReport(supabase: ReturnType<typeof createClient>, clientId: string, projectId: string) {
  // Verify project ownership
  const { data: project } = await supabase
    .from('annotation_projects')
    .select('id, status')
    .eq('id', projectId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!project) return errorResponse(404, 'not_found', 'Projet non trouvé.', 'NOT_FOUND');

  // Check at least 1 completed task
  const { count } = await supabase
    .from('annotation_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', projectId)
    .eq('status', 'completed');

  if (!count || count === 0) {
    return errorResponse(400, 'invalid_request',
      'Aucune tâche validée. Le rapport sera disponible après la première tâche.',
      'NO_DATA');
  }

  // Call generate-performance-report edge function
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const reportRes = await fetch(`${supabaseUrl}/functions/v1/generate-performance-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ project_id: projectId, client_id: clientId }),
  });

  const reportBody = await reportRes.json();

  if (!reportRes.ok) {
    return errorResponse(reportRes.status, 'internal_error',
      reportBody?.error || 'Erreur lors de la génération du rapport.',
      reportBody?.code || 'REPORT_ERROR');
  }

  return okResponse(reportBody);
}

// ─── Main Router ────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = getServiceClient();
  const startTime = Date.now();
  const requestId = generateRequestId();
  const baseHeaders: Record<string, string> = { 'X-Request-ID': requestId };

  try {
    // ── Parse body ──
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    let jsonParseError = false;

    if (req.method !== 'GET' && req.method !== 'DELETE') {
      try {
        const text = await req.text();
        if (text.trim()) {
          body = JSON.parse(text);
          if (typeof body !== 'object' || body === null || Array.isArray(body)) {
            return errorResponse(400, 'invalid_request', 'Le corps de la requête doit être un objet JSON.', 'INVALID_JSON');
          }
        } else {
          jsonParseError = true;
        }
      } catch {
        return errorResponse(400, 'invalid_request', 'Corps de requête JSON invalide ou malformé.', 'INVALID_JSON');
      }
    }

    // ── Determine path and method ──
    const urlPath = url.pathname.replace(/^\/client-api/, '').replace(/\/$/, '') || '/';
    const path = (typeof body.path === 'string' && body.path) ? body.path : urlPath;
    const method = (typeof body.method === 'string' && body.method) ? body.method.toUpperCase() : req.method;

    // ── Guard: empty body with no path → 400 ──
    if (jsonParseError && path === '/' && req.method === 'POST') {
      return errorResponse(400, 'invalid_request',
        "Le corps de la requête est vide. Les champs 'path' et 'method' sont obligatoires.",
        'EMPTY_BODY');
    }

    // ── Guard: path is required for invoke-style calls ──
    if (path === '/' && req.method === 'POST') {
      return errorResponse(400, 'invalid_request',
        "Le champ 'path' est obligatoire (ex: '/projects').",
        'MISSING_FIELD', 'path');
    }

    // Parse query params
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { params[k] = v; });
    if (body.params && typeof body.params === 'object') Object.assign(params, body.params);

    // Resolve body for create/update
    const reqBody = (body.body && typeof body.body === 'object') ? body.body as Record<string, unknown> : body;

    // ── Internal API key generation (JWT auth for dashboard) ──
    if (path === '/api-key/generate' || path === '/api-key/regenerate') {
      const auth = await authenticateRequest(req);
      if (!auth.authenticated) return errorResponse(401, 'authentication_error', auth.error || 'Authentification requise.', 'AUTH_REQUIRED');
      if (!auth.client_id) return errorResponse(403, 'authorization_error', 'Pas de compte client.', 'FORBIDDEN');
      const response = await handleRegenerateApiKey(supabase, auth.client_id);
      for (const [k, v] of Object.entries(baseHeaders)) response.headers.set(k, v);
      return response;
    }

    // ── Authenticate ──
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return errorResponse(401, 'authentication_error', auth.error || 'Authentification requise.', 'AUTH_REQUIRED');
    }

    if (auth.user_role !== 'client' && auth.user_role !== 'admin') {
      return errorResponse(403, 'authorization_error', 'Accès réservé aux comptes entreprise.', 'FORBIDDEN');
    }

    const clientId = auth.client_id;
    if (!clientId) return errorResponse(403, 'authorization_error', 'Aucun compte client associé.', 'FORBIDDEN');

    // ── Rate limiting ──
    const rl = await checkRateLimit(clientId, auth.rate_limit);
    const rlHeaders = rateLimitHeaders(rl);
    Object.assign(baseHeaders, rlHeaders);

    if (!rl.allowed) {
      return errorResponse(429, 'rate_limit_exceeded',
        'Limite de requêtes dépassée. Réessayez dans un moment.',
        'RATE_LIMIT_EXCEEDED', undefined, { ...baseHeaders, 'Retry-After': String(rl.retry_after || 60) });
    }

    // ── Route matching ──
    const { segments } = parsePath(path);
    let response: Response;

    // Helper for UUID validation in routes
    const requireUUID = (value: string, label: string): Response | null => {
      if (!isValidUUID(value)) {
        return errorResponse(400, 'invalid_request',
          `ID invalide pour '${label}' (format UUID attendu).`,
          'INVALID_UUID', label);
      }
      return null;
    };

    // /projects
    if (segments[0] === 'projects' && segments.length === 1) {
      if (method === 'GET') response = await handleListProjects(supabase, clientId, params);
      else if (method === 'POST') response = await handleCreateProject(supabase, clientId, reqBody, auth);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée sur /projects.`, 'METHOD_NOT_ALLOWED');
    }
    // /projects/:id
    else if (segments[0] === 'projects' && segments.length === 2) {
      const uuidErr = requireUUID(segments[1], 'project_id');
      if (uuidErr) { response = uuidErr; }
      else {
        const projectId = segments[1];
        if (method === 'GET') response = await handleGetProject(supabase, clientId, projectId);
        else if (method === 'PUT' || method === 'PATCH') response = await handleUpdateProject(supabase, clientId, projectId, reqBody);
        else if (method === 'DELETE') response = await handleDeleteProject(supabase, clientId, projectId);
        else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
      }
    }
    // /projects/:id/tasks
    else if (segments[0] === 'projects' && segments.length === 3 && segments[2] === 'tasks') {
      const uuidErr = requireUUID(segments[1], 'project_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'GET') response = await handleListTasks(supabase, clientId, segments[1], params);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /projects/:id/stats
    else if (segments[0] === 'projects' && segments.length === 3 && segments[2] === 'stats') {
      const uuidErr = requireUUID(segments[1], 'project_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'GET') response = await handleProjectStats(supabase, clientId, segments[1]);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /projects/:id/export
    else if (segments[0] === 'projects' && segments.length === 3 && segments[2] === 'export') {
      const uuidErr = requireUUID(segments[1], 'project_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'POST') response = await handleExport(supabase, clientId, segments[1], reqBody);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /uploads (POST to create)
    else if (segments[0] === 'uploads' && segments.length === 1) {
      if (method === 'POST') response = await handleCreateUpload(supabase, clientId, reqBody);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée sur /uploads.`, 'METHOD_NOT_ALLOWED');
    }
    // /uploads/:id
    else if (segments[0] === 'uploads' && segments.length === 2) {
      const uuidErr = requireUUID(segments[1], 'upload_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'GET') response = await handleGetUpload(supabase, clientId, segments[1]);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /uploads/:id/confirm
    else if (segments[0] === 'uploads' && segments.length === 3 && segments[2] === 'confirm') {
      const uuidErr = requireUUID(segments[1], 'upload_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'POST') response = await handleConfirmUpload(supabase, clientId, segments[1]);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /exports/:id
    else if (segments[0] === 'exports' && segments.length === 2) {
      const uuidErr = requireUUID(segments[1], 'export_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'GET') response = await handleGetExport(supabase, clientId, segments[1]);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /webhooks
    else if (segments[0] === 'webhooks' && segments.length === 1) {
      if (method === 'GET') response = await handleListWebhooks(supabase, clientId);
      else if (method === 'POST') response = await handleCreateWebhook(supabase, clientId, reqBody);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /webhooks/:id
    else if (segments[0] === 'webhooks' && segments.length === 2) {
      const uuidErr = requireUUID(segments[1], 'webhook_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'DELETE') response = await handleDeleteWebhook(supabase, clientId, segments[1]);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /webhooks/:id/test
    else if (segments[0] === 'webhooks' && segments.length === 3 && segments[2] === 'test') {
      const uuidErr = requireUUID(segments[1], 'webhook_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'POST') response = await handleTestWebhook(supabase, clientId, segments[1]);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /invoices
    else if (segments[0] === 'invoices' && segments.length === 1) {
      if (method === 'GET') response = await handleListInvoices(supabase, clientId, params);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /invoices/:id
    else if (segments[0] === 'invoices' && segments.length === 2) {
      const uuidErr = requireUUID(segments[1], 'invoice_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'GET') response = await handleGetInvoice(supabase, clientId, segments[1]);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // /estimate
    else if (segments[0] === 'estimate' && segments.length === 1) {
      if (method === 'POST') response = await handleEstimate(supabase, reqBody);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée sur /estimate.`, 'METHOD_NOT_ALLOWED');
    }
    // /projects/:id/report
    else if (segments[0] === 'projects' && segments.length === 3 && segments[2] === 'report') {
      const uuidErr = requireUUID(segments[1], 'project_id');
      if (uuidErr) { response = uuidErr; }
      else if (method === 'POST') response = await handleGenerateReport(supabase, clientId, segments[1]);
      else response = errorResponse(400, 'invalid_request', `Méthode '${method}' non supportée.`, 'METHOD_NOT_ALLOWED');
    }
    // 404 — catch-all
    else {
      response = errorResponse(404, 'not_found', `Endpoint introuvable : ${method} ${path}`, 'NOT_FOUND');
    }

    // Attach base headers to response
    for (const [k, v] of Object.entries(baseHeaders)) response.headers.set(k, v);

    // Async logging (fire and forget)
    const latency = Date.now() - startTime;
    logRequest({
      client_id: clientId, endpoint: path, method,
      status_code: response.status, latency_ms: latency,
      ip_address: req.headers.get('x-forwarded-for') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
      request_id: requestId,
    });

    return response;
  } catch (e) {
    console.error(`[STEF API ERROR][${requestId}]`, {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      ts: new Date().toISOString(),
    });

    const latency = Date.now() - startTime;
    logRequest({
      endpoint: 'unknown', method: req.method,
      status_code: 500, latency_ms: latency,
      error_message: e instanceof Error ? e.message : 'Unknown error',
      request_id: requestId,
    });

    return errorResponse(500, 'internal_error',
      'Une erreur interne est survenue. Notre équipe a été notifiée.',
      'INTERNAL_ERROR');
  }
});
