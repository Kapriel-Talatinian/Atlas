// ============================================================
// ASSESSMENT SYSTEM — Full 3-Phase Technical Evaluation Types
// ============================================================

// ─── Tech Stacks ───────────────────────────────────────────
export type TechStack =
  | 'python' | 'javascript' | 'typescript'
  | 'java' | 'go' | 'php' | 'ruby'
  | 'csharp' | 'rust' | 'swift' | 'kotlin';

// ─── Integrity & Anti-Cheat ────────────────────────────────
export interface IntegrityFlag {
  type:
    | 'tab_switch'           // Candidat a quitté l'onglet
    | 'copy_paste_large'     // Copier-coller > 50 caractères
    | 'typing_anomaly'       // Pattern de frappe anormal (trop rapide, trop régulier)
    | 'plagiarism_detected'  // Similarité > 80% avec une solution connue
    | 'idle_then_burst'      // Longue inactivité puis soumission rapide
    | 'screen_resize';       // Redimensionnement suspect (écran partagé?)
  timestamp: string;         // ISO DateTime
  severity: 'info' | 'warning' | 'critical';
  details: string;
}

// ─── Phase 1: Adaptive Quiz (QCM) ─────────────────────────
export type QuizDomain =
  | 'fundamentals'
  | 'algorithms'
  | 'architecture'
  | 'ecosystem'
  | 'best_practices';

export interface QuizQuestion {
  id: string;
  stack: TechStack;
  domain: QuizDomain;
  difficulty: 1 | 2 | 3 | 4 | 5;      // 1=débutant, 5=expert
  question: string;                     // Markdown supporté + code blocks
  options: { key: string; text: string }[];  // 4 choix
  correctAnswer: string;
  explanation: string;                  // Affiché après le test
  timeLimit: number;                    // Secondes (défaut: 30)
  tags: string[];                       // Ex: ['async', 'promises', 'error-handling']
}

export interface QuizResult {
  total_questions: number;
  correct_answers: number;
  raw_score: number;                    // 0-100
  calibrated_score: number;             // Score ajusté selon difficulté atteinte
  max_difficulty_reached: number;       // 1-5
  domain_scores: Record<QuizDomain, number>;  // 0-100 par domaine
  time_taken_seconds: number;
  answers: {
    question_id: string;
    selected: string;
    correct: boolean;
    difficulty: number;
    time_spent_ms: number;
  }[];
}

// ─── Phase 2: Coding Challenge ─────────────────────────────
export type ChallengeStepId = 'A' | 'B' | 'C' | 'D';

export interface ScoringCriteria {
  tests_pass: number;         // 0.30
  code_quality: number;       // 0.20
  structure: number;          // 0.15
  error_handling: number;     // 0.10
  naming_readability: number; // 0.10
  efficiency: number;         // 0.10
  completeness: number;       // 0.05
}

export interface TestCase {
  id: string;
  name: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
}

export interface ChallengeStep {
  id: ChallengeStepId;
  title: string;
  instructions: string;                 // Markdown
  tests: TestCase[];
  scoring_criteria: ScoringCriteria;
  estimated_minutes: number;
}

export interface CodingChallenge {
  id: string;
  stack: TechStack;
  title: string;
  scenario: string;                     // Description du contexte métier
  steps: ChallengeStep[];               // 4 étapes A-B-C-D
  starter_code: string;                 // Code de départ fourni
  hidden_tests: TestCase[];             // Tests non visibles par le candidat
  visible_tests: TestCase[];            // Tests que le candidat peut voir
  max_duration: number;                 // 1800 secondes (30 min)
}

export interface ChallengeResult {
  weighted_score: number;               // 0-100
  step_scores: Record<ChallengeStepId, number>;
  criteria_scores: Record<keyof ScoringCriteria, number>;
  code_submitted: string;
  tests_passed: number;
  tests_total: number;
  time_taken_seconds: number;
  steps_completed: ChallengeStepId[];
}

// ─── Phase 3: Code Review ──────────────────────────────────
export type CodeProblemType = 'bug' | 'security' | 'performance' | 'readability' | 'architecture';

export interface CodeReviewProblem {
  type: CodeProblemType;
  description: string;                  // Description attendue
  location: { startLine: number; endLine: number };
  severity: 'critical' | 'major' | 'minor';
  keywords: string[];                   // Mots-clés pour le scoring NLP
}

export interface CodeReviewChallenge {
  id: string;
  stack: TechStack;
  code: string;                         // 30-50 lignes avec 5 problèmes
  problems: CodeReviewProblem[];
  max_duration: number;                 // 300 secondes (5 min)
}

export interface CodeReviewAnswer {
  problem_type: CodeProblemType;
  line_start: number;
  line_end: number;
  description: string;
}

export interface CodeReviewResult {
  score: number;                        // 0-100
  answers: CodeReviewAnswer[];
  problems_found: number;
  problems_total: number;
  time_taken_seconds: number;
}

// ─── Global Score ──────────────────────────────────────────
export type ExpertLevel = 'junior' | 'mid' | 'senior' | 'expert';

export interface RadarDataPoint {
  dimension: string;
  score: number;
  fullMark: number;
}

export interface GlobalScore {
  overall: number;                     // Score composite 0-100
  level: ExpertLevel;
  breakdown: {
    fundamentals: number;              // 0-100
    problemSolving: number;            // 0-100
    codeQuality: number;              // 0-100
    architecture: number;             // 0-100
    debugging: number;                // 0-100
  };
  radar_chart: RadarDataPoint[];       // Pour le rendu visuel
  issued_at: string;
  valid_until: string;                 // Validité 12 mois
}

// ─── Assessment Session ────────────────────────────────────
export type AssessmentStatus = 'in_progress' | 'completed' | 'expired' | 'flagged';

export interface AssessmentSession {
  id: string;                          // UUID
  candidate_id: string;                // Référence au profil expert
  stack: TechStack;                    // Stack choisie par le candidat
  started_at: string;
  completed_at?: string;
  status: AssessmentStatus;

  // Résultats par phase
  phase1?: QuizResult;
  phase2?: ChallengeResult;
  phase3?: CodeReviewResult;

  // Score global
  global_score?: GlobalScore;

  // Anti-triche
  integrity_flags: IntegrityFlag[];

  // Phase courante
  current_phase: 1 | 2 | 3;
}

// ─── Scoring Algorithm Constants ───────────────────────────
export const PHASE_WEIGHTS = {
  phase1: 0.25,  // QCM — Fondamentaux et étendue
  phase2: 0.55,  // Challenge — Capacité réelle à produire
  phase3: 0.20,  // Code Review — Maturité et oeil critique
} as const;

export const INTEGRITY_RULES = {
  warning_threshold: 3,     // 3 warnings → session flagged
  critical_auto_terminate: true,  // 1 critical → session terminée
  copy_paste_char_limit: 50,      // Copier-coller > 50 chars → flag
  idle_threshold_seconds: 120,    // 2 min d'inactivité → suspect
  typing_speed_max_cpm: 800,      // > 800 chars/min → suspect
} as const;
