// ============================================================
// ANNOTATOR ASSESSMENT SYSTEM — Types
// ============================================================

export type AnnotationDomain =
  | 'generaliste'
  | 'rlhf_preference'
  | 'code_tech'
  | 'red_teaming_safety'
  | 'juridique_fr'
  | 'medical'
  | 'finance';

export type AnnotatorTier = 'junior' | 'standard' | 'senior' | 'expert';

export const DOMAIN_LABELS: Record<AnnotationDomain, { label: string; description: string; icon: string; requiresExperience?: string }> = {
  generaliste: {
    label: 'Généraliste',
    description: 'Évaluation de réponses LLM, classification, détection de problèmes.',
    icon: '📝',
  },
  rlhf_preference: {
    label: 'RLHF / Preference',
    description: 'Comparaison de réponses, ranking par préférence, évaluation multi-dimensions.',
    icon: '⚖️',
  },
  code_tech: {
    label: 'Code / Tech',
    description: 'Annotation de code, évaluation de réponses techniques, détection de bugs.',
    icon: '💻',
    requiresExperience: 'Expérience en développement requise',
  },
  red_teaming_safety: {
    label: 'Red-teaming / Safety',
    description: 'Prompts adversariaux, détection de biais, contenu dangereux, désinformation.',
    icon: '🛡️',
  },
  juridique_fr: {
    label: 'Juridique FR',
    description: 'Textes juridiques, droit français, détection d\'hallucinations légales.',
    icon: '⚖️',
    requiresExperience: 'Formation ou expérience juridique requise',
  },
  medical: {
    label: 'Médical',
    description: 'Textes médicaux, détection de conseils dangereux, cohérence médicale.',
    icon: '🏥',
    requiresExperience: 'Formation ou expérience dans le domaine de la santé requise',
  },
  finance: {
    label: 'Finance',
    description: 'Textes financiers, détection de conseils inappropriés, vérification chiffrée.',
    icon: '📊',
  },
};

export const TIER_LABELS: Record<AnnotatorTier, { label: string; color: string; minScore: number; description: string }> = {
  junior: { label: 'Junior', color: 'bg-zinc-500', minScore: 50, description: 'Tâches niveau 1. Vérification 100% pendant la probation.' },
  standard: { label: 'Standard', color: 'bg-blue-500', minScore: 65, description: 'Tâches niveau 1-2. Vérification 20%. Rémunération ×1.3.' },
  senior: { label: 'Senior', color: 'bg-amber-500', minScore: 80, description: 'Tâches niveau 1-3. Reviewer possible. Rémunération ×1.7.' },
  expert: { label: 'Expert', color: 'bg-emerald-500', minScore: 90, description: 'Toutes tâches. Adjudicateur. Rémunération ×2.2.' },
};

export const PHASE_WEIGHTS = {
  phase1: 0.20,
  phase2: 0.50,
  phase3: 0.20,
  phase4: 0.10,
} as const;

export interface AnnotatorAssessmentSession {
  id: string;
  user_id: string;
  expert_id: string;
  domain: AnnotationDomain;
  status: 'in_progress' | 'completed' | 'failed' | 'expired' | 'flagged';
  current_phase: 1 | 2 | 3 | 4;
  started_at: string;
  completed_at?: string;
  phase1_score?: number;
  phase1_passed?: boolean;
  phase2_scores?: { average: number };
  phase3_score?: number;
  phase4_score?: number;
  global_score?: number;
  tier_awarded?: AnnotatorTier;
  feedback?: any;
  time_limit_seconds: number;
}

export interface GuidelinesQuizItem {
  id: string;
  content: {
    question: string;
    scenario: string;
    options: { key: string; text: string }[];
  };
  difficulty: string;
}

export interface AnnotationItem {
  id: string;
  content: {
    prompt: string;
    response: string;
    response_b?: string; // for RLHF preference
    dimensions: string[];
    context?: string;
  };
  difficulty: string;
}

export interface ErrorDetectionItem {
  id: string;
  content: {
    prompt: string;
    response: string;
    existing_annotation: {
      dimensions: Record<string, number>;
      justification: string;
    };
  };
}

export interface EthicalJudgmentItem {
  id: string;
  content: {
    scenario: string;
    context: string;
  };
}
