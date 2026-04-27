// _shared/types.ts — Shared TypeScript types for edge functions

export type Domain = 'medical' | 'legal' | 'finance' | 'code';

export type TaskType =
  | 'scoring'
  | 'preference_dpo'
  | 'comparison_ab'
  | 'red_teaming'
  | 'fact_checking'
  | 'text_generation'
  | 'span_annotation'
  | 'extraction'
  | 'conversation_rating';

export type SlaTier = 'standard' | 'priority' | 'express';

export type ExportFormat = 'jsonl' | 'parquet' | 'huggingface';

export type WebhookEvent =
  | 'project.completed'
  | 'project.status_changed'
  | 'batch.ready'
  | 'task.flagged'
  | 'export.ready'
  | 'quality.alert'
  | 'sla.at_risk';

export interface PaginationParams {
  page: number;
  per_page: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

export interface HandlerResult {
  status: number;
  body: string;
  headers?: Record<string, string>;
}
