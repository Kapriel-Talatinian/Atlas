// ============================================================
// ANNOTATION PLATFORM — Complete Type Definitions
// ============================================================

// ─── Task Taxonomy ─────────────────────────────────────────

export type ComplexityLevel = 1 | 2 | 3;

export type AnnotationType =
  | 'classification'
  | 'ranking'
  | 'rating'
  | 'span_annotation'
  | 'text_generation'
  | 'comparison'
  | 'extraction'
  | 'validation'
  | 'red_teaming'
  | 'conversation_rating';

export type ProjectStatus =
  | 'draft'
  | 'guidelines_review'
  | 'pilot'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export type ItemStatus =
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'in_review'
  | 'adjudication'
  | 'completed'
  | 'rejected'
  | 'auto_annotated';

export type AnnotatorTierLevel =
  | 'junior'
  | 'standard'
  | 'senior'
  | 'expert'
  | 'adjudicator';

export type AnnotatorStatus =
  | 'onboarding'
  | 'active'
  | 'probation'
  | 'suspended'
  | 'inactive';

// ─── Annotation Project ────────────────────────────────────

export interface AnnotationProject {
  id: string;
  client_id: string;
  name: string;
  description: string;
  type: AnnotationType;
  complexity_level: ComplexityLevel;
  domain: string;
  languages: string[];
  guidelines: AnnotationGuidelines;
  taxonomy?: Taxonomy;
  schema?: AnnotationSchema;
  workflow: WorkflowConfig;
  quality_config: QualityConfig;
  automation_config: AutomationConfig;
  total_items: number;
  target_completion_date: string;
  priority_level: 'standard' | 'rush' | 'critical';
  pricing_model: PricingModel;
  estimated_cost: number;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface AnnotationGuidelines {
  version: string;
  content: string;
  examples: {
    item: any;
    correct_annotation: any;
    explanation: string;
  }[];
  counter_examples: {
    item: any;
    incorrect_annotation: any;
    explanation: string;
  }[];
  edge_cases: {
    item: any;
    correct_annotation: any;
    explanation: string;
  }[];
  faq: { question: string; answer: string }[];
  last_updated: string;
  change_log: { version: string; changes: string; date: string }[];
}

export interface Taxonomy {
  id: string;
  name: string;
  categories: TaxonomyCategory[];
}

export interface TaxonomyCategory {
  id: string;
  label: string;
  description?: string;
  children?: TaxonomyCategory[];
}

export interface AnnotationSchema {
  fields: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
    required: boolean;
    options?: string[];
    description?: string;
  }[];
}

export interface WorkflowConfig {
  annotations_per_item: number;
  adjudication_enabled: boolean;
  auto_assign: boolean;
  require_justification: boolean;
  allow_skip: boolean;
  max_items_per_session: number;
  forced_break_interval_minutes: number;
}

export interface QualityConfig {
  annotations_per_item: number;
  adjudication_threshold: number;
  gold_standard_rate: number;
  gold_failure_action: 'warn' | 'pause' | 'recalibrate';
  qa_review_rate: number;
  target_iaa: number;
  target_accuracy: number;
  drift_check_interval: number;
  drift_threshold: number;
  escalation_rules: EscalationRule[];
}

export interface EscalationRule {
  condition: string;
  action: 'notify_lead' | 'pause_annotator' | 'recalibrate' | 'suspend';
  severity: 'info' | 'warning' | 'critical';
}

export interface AutomationConfig {
  enabled: boolean;
  strategy: 'full_auto' | 'pre_annotation' | 'assist_only';
  model: {
    provider: 'lovable_ai' | 'openai' | 'anthropic' | 'local' | 'custom';
    model_id: string;
    endpoint?: string;
  };
  // Per-complexity model overrides (key = complexity level "1"|"2"|"3")
  model_overrides?: Record<string, string>;
  confidence_threshold: number;
  human_review_sample_rate: number;
  max_cost_per_item: number;
  max_total_budget: number;
  fallback_to_human: boolean;
  max_retries: number;
  pre_annotation_visible: boolean;
}

// Default model routing for the annotation pipeline
export const MODEL_ROUTING_DEFAULTS: Record<number, {
  model: string;
  estimated_cost: number;
  strategy: 'full_auto' | 'pre_annotation' | 'assist_only';
  description: string;
}> = {
  1: {
    model: 'google/gemini-2.5-flash-lite',
    estimated_cost: 0.01,
    strategy: 'full_auto',
    description: 'Classification, détection de langue, catégorisation — rapide et économique',
  },
  2: {
    model: 'google/gemini-2.5-flash',
    estimated_cost: 0.04,
    strategy: 'pre_annotation',
    description: 'Analyse de sentiment, NER complexe, scoring — pré-annotation + validation humaine',
  },
  3: {
    model: 'google/gemini-2.5-pro',
    estimated_cost: 0.12,
    strategy: 'assist_only',
    description: 'RLHF, red-teaming, jugement qualitatif — humain requis, IA en support',
  },
};

export interface PricingModel {
  type: 'per_item' | 'per_hour' | 'fixed';
  base_rate: number;
  complexity_multipliers: Record<string, number>;
  rush_surcharge: number;
}

// ─── Annotation Items ──────────────────────────────────────

export interface AnnotationItem {
  id: string;
  project_id: string;
  batch_id: string;
  content: {
    type: 'text' | 'text_pair' | 'conversation' | 'code' | 'image_text' | 'structured';
    primary: string;
    secondary?: string;
    alternatives?: string[];
    metadata?: Record<string, any>;
  };
  status: ItemStatus;
  complexity_level: ComplexityLevel;
  is_gold_standard: boolean;
  is_calibration: boolean;
  annotations: Annotation[];
  final_annotation?: Annotation;
  auto_annotation?: AutoAnnotation;
  ingested_at: string;
  completed_at?: string;
  processing_time?: number;
}

export interface Annotation {
  id: string;
  item_id: string;
  annotator_id: string;
  project_id: string;
  value: AnnotationValue;
  time_spent: number;
  confidence: 'low' | 'medium' | 'high';
  comment?: string;
  flagged: boolean;
  flag_reason?: string;
  agrees_with_gold?: boolean;
  agreement_with_others?: number;
  created_at: string;
  updated_at: string;
  guidelines_version: string;
}

export type AnnotationValue =
  | { type: 'classification'; labels: string[] }
  | { type: 'ranking'; order: string[]; justification?: string }
  | { type: 'rating'; dimensions: { name: string; score: number; justification?: string }[] }
  | { type: 'spans'; spans: { start: number; end: number; label: string; text: string }[] }
  | { type: 'text'; text: string; edited_from?: string }
  | { type: 'comparison'; preferred: string; reasoning: string; margin: 'slight' | 'clear' | 'strong' }
  | { type: 'extraction'; fields: Record<string, any> }
  | { type: 'validation'; approved: boolean; corrections?: any }
  | { type: 'red_team'; prompt: string; category: string; expected_failure_mode: string };

export interface AutoAnnotation {
  model_id: string;
  model_version: string;
  value: AnnotationValue;
  confidence: number;
  latency: number;
  cost: number;
  validated_by_human: boolean;
  validator_id?: string;
  validated_at?: string;
}

// ─── Annotator Profile (Extended) ──────────────────────────

export interface AnnotatorExtended {
  id: string;
  stef_profile_id: string;
  name: string;
  email: string;
  country: string;
  timezone: string;
  languages: { code: string; level: 'native' | 'fluent' | 'proficient' | 'basic' }[];
  annotation_skills: {
    domains: string[];
    task_types: AnnotationType[];
    max_complexity: ComplexityLevel;
    specializations: string[];
  };
  certifications: {
    project_id: string;
    certified_at: string;
    calibration_score: number;
    status: 'active' | 'expired' | 'revoked';
  }[];
  metrics: AnnotatorMetrics;
  availability: {
    hours_per_week: number;
    schedule: { day: string; start_hour: number; end_hour: number }[];
    current_load: number;
    max_concurrent_items: number;
  };
  status: AnnotatorStatus;
  tier: AnnotatorTierLevel;
  joined_at: string;
}

export interface AnnotatorMetrics {
  overall_accuracy: number;
  inter_annotator_agreement: number;
  consistency_score: number;
  task_type_metrics: {
    task_type: AnnotationType;
    accuracy: number;
    avg_time_per_item: number;
    items_completed: number;
  }[];
  total_items_annotated: number;
  avg_time_per_item: number;
  throughput_per_hour: number;
  flag_rate: number;
  abandon_rate: number;
  on_time_rate: number;
  quality_trend: 'improving' | 'stable' | 'declining';
  last_updated: string;
}

// ─── Tier Progression Rules ────────────────────────────────

export const TIER_REQUIREMENTS: Record<AnnotatorTierLevel, {
  min_items: number;
  min_accuracy: number;
  min_iaa: number;
  max_flag_rate?: number;
  validation_rate: number;
  rate_multiplier: number;
  access_levels: ComplexityLevel[];
}> = {
  junior: {
    min_items: 0,
    min_accuracy: 0.70,
    min_iaa: 0,
    validation_rate: 1.0,
    rate_multiplier: 1.0,
    access_levels: [1],
  },
  standard: {
    min_items: 500,
    min_accuracy: 0.80,
    min_iaa: 0.75,
    validation_rate: 0.20,
    rate_multiplier: 1.3,
    access_levels: [1, 2],
  },
  senior: {
    min_items: 2000,
    min_accuracy: 0.88,
    min_iaa: 0.82,
    max_flag_rate: 0.05,
    validation_rate: 0.10,
    rate_multiplier: 1.7,
    access_levels: [1, 2, 3],
  },
  expert: {
    min_items: 5000,
    min_accuracy: 0.92,
    min_iaa: 0.85,
    max_flag_rate: 0.03,
    validation_rate: 0.05,
    rate_multiplier: 2.2,
    access_levels: [1, 2, 3],
  },
  adjudicator: {
    min_items: 5000,
    min_accuracy: 0.95,
    min_iaa: 0.90,
    max_flag_rate: 0.02,
    validation_rate: 0.0,
    rate_multiplier: 2.8,
    access_levels: [1, 2, 3],
  },
};

// ─── Assignment Engine ─────────────────────────────────────

export interface Assignment {
  id: string;
  item_id: string;
  annotator_id: string;
  project_id: string;
  assigned_at: string;
  deadline: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'abandoned' | 'expired';
  started_at?: string;
  completed_at?: string;
}

export interface AssignmentScore {
  quality: number;
  speed: number;
  availability: number;
  diversity: number;
  calibration_recency: number;
  total: number;
}

export const ASSIGNMENT_WEIGHTS = {
  quality: 0.35,
  speed: 0.10,
  availability: 0.25,
  diversity: 0.15,
  calibration_recency: 0.15,
} as const;

// ─── Adjudication ──────────────────────────────────────────

export interface Adjudication {
  id: string;
  item_id: string;
  adjudicator_id: string;
  original_annotations: string[];
  final_value: AnnotationValue;
  method: 'weighted_majority' | 'adjudicator_decision' | 'consensus';
  justification: string;
  confidence: number;
  created_at: string;
}

// ─── Quality & Monitoring ──────────────────────────────────

export interface IAAReport {
  project_id: string;
  metrics: Record<string, number>;
  interpretation: 'poor' | 'fair' | 'moderate' | 'substantial' | 'excellent';
  sample_size: number;
  computed_at: string;
  recommendations: string[];
}

export interface DriftReport {
  project_id: string;
  checks: {
    label_distribution?: { kl_divergence: number; drifted: boolean };
    time_per_item?: { recent_mean: number; historical_mean: number; drifted: boolean };
    iaa_trend?: { recent: number; historical: number; drifted: boolean };
    gold_accuracy_trend?: { recent: number; historical: number; drifted: boolean };
  };
  drifted: boolean;
  recommendations: string[];
  computed_at: string;
}

export interface GoldEvaluation {
  correct: boolean;
  accuracy: number;
  action_triggered?: string;
}

// ─── Project Dashboard ─────────────────────────────────────

export interface ProjectDashboard {
  overview: {
    total_items: number;
    completed_items: number;
    completion_rate: number;
    estimated_completion_date: string;
    current_throughput: number;
    active_annotators: number;
    avg_time_per_item: number;
  };
  quality: {
    current_iaa: number;
    gold_accuracy: number;
    adjudication_rate: number;
    flag_rate: number;
    drift_status: 'stable' | 'warning' | 'drifted';
    quality_trend: { date: string; value: number }[];
  };
  automation: {
    auto_annotated_rate: number;
    auto_accuracy_on_review: number;
    cost_saved: number;
    avg_confidence: number;
    fallback_to_human_rate: number;
  };
  annotators: {
    leaderboard: {
      annotator_id: string;
      name: string;
      accuracy: number;
      throughput: number;
      tier: string;
    }[];
    at_risk: {
      annotator_id: string;
      name: string;
      issue: string;
      recommendation: string;
    }[];
    utilization: number;
  };
  financials: {
    total_cost: number;
    cost_per_item: number;
    human_cost: number;
    automation_cost: number;
    budget: number;
    budget_utilization: number;
  };
}

// ─── Export & Delivery ─────────────────────────────────────

export type ExportFormat = 'jsonl' | 'parquet' | 'csv' | 'huggingface' | 'custom_api';

export interface DeliveryReport {
  project_id: string;
  delivered_at: string;
  total_items_delivered: number;
  human_annotated: number;
  auto_annotated: number;
  adjudicated: number;
  quality: {
    inter_annotator_agreement: number;
    gold_standard_accuracy: number;
    adjudication_rate: number;
    drift_status: string;
    quality_score: number;
  };
  methodology: {
    annotations_per_item: number;
    adjudication_method: string;
    automation_strategy: string;
    automation_rate: number;
    guidelines_version: string;
  };
  workforce: {
    total_annotators: number;
    avg_tier: string;
    avg_accuracy: number;
    avg_experience: string;
    countries: string[];
    languages: string[];
  };
  known_limitations: string[];
  recommendations: string[];
}

// ─── Alert Rules ───────────────────────────────────────────

export interface AlertRule {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  action: string;
  message: string;
}

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    name: "IAA Drop",
    condition: "project.quality.currentIAA < targetIAA - 0.05",
    severity: "warning",
    action: "notify_project_lead",
    message: "L'accord inter-annotateurs est passé sous le seuil cible.",
  },
  {
    name: "Gold Accuracy Critical",
    condition: "annotator.gold_accuracy_last_20 < 0.60",
    severity: "critical",
    action: "pause_annotator",
    message: "Accuracy gold critique. Annotateur mis en pause.",
  },
  {
    name: "Throughput Drop",
    condition: "throughput < expected * 0.5",
    severity: "warning",
    action: "notify_project_lead",
    message: "Le débit est tombé sous 50% de l'attendu.",
  },
  {
    name: "Auto-annotation Degradation",
    condition: "autoAccuracyOnReview < 0.90",
    severity: "critical",
    action: "disable_auto_annotation",
    message: "Accuracy auto-annotation dégradée. Automatisation désactivée.",
  },
  {
    name: "Budget Alert",
    condition: "budgetUtilization > 0.80 && completionRate < 0.60",
    severity: "warning",
    action: "notify_client",
    message: "80% du budget consommé mais faible complétion.",
  },
  {
    name: "Drift Detected",
    condition: "driftStatus == 'drifted'",
    severity: "warning",
    action: "trigger_recalibration",
    message: "Dérive détectée. Recalibration recommandée.",
  },
  {
    name: "Annotator Fatigue",
    condition: "session_duration > 120 && quality_declining",
    severity: "info",
    action: "suggest_break",
    message: "Qualité en baisse après 2h+. Pause suggérée.",
  },
];

// ─── Onboarding per Project ───────────────────────────────

export interface ProjectOnboarding {
  project_id: string;
  annotator_id: string;
  status: 'reading_guidelines' | 'quiz' | 'calibration' | 'probation' | 'certified' | 'failed';
  quiz_score?: number;
  calibration_score?: number;
  probation_accuracy?: number;
  probation_items_reviewed: number;
  started_at: string;
  certified_at?: string;
  guidelines_version: string;
}

// ─── Redundancy Rules ──────────────────────────────────────

export const REDUNDANCY_RULES: Record<ComplexityLevel, {
  human_annotations: number;
  adjudicator_on_disagreement: boolean;
}> = {
  1: { human_annotations: 0, adjudicator_on_disagreement: false },
  2: { human_annotations: 2, adjudicator_on_disagreement: true },
  3: { human_annotations: 3, adjudicator_on_disagreement: true },
};
