export const DOMAINS = ["code", "finance", "legal", "medical"] as const;
export const DOMAIN_LABELS: Record<string, string> = {
  code: "Code",
  finance: "Finance",
  legal: "Juridique",
  medical: "Médical",
};

export const TASK_TYPES = [
  "scoring",
  "preference_dpo",
  "comparison_ab",
  "fact_checking",
  "red_teaming",
  "text_generation",
  "span_annotation",
  "extraction",
  "conversation_rating",
] as const;

export const TASK_TYPE_LABELS: Record<string, string> = {
  scoring: "Scoring",
  preference_dpo: "Préférences DPO",
  comparison_ab: "Comparaison A/B",
  fact_checking: "Fact-checking",
  red_teaming: "Red-teaming",
  text_generation: "Génération de texte",
  span_annotation: "Annotation de spans",
  extraction: "Extraction",
  conversation_rating: "Notation de conversation",
};

export const DEFAULT_CLIENT_PRICES: Record<string, Record<string, number>> = {
  scoring:              { code: 25, finance: 30, legal: 30, medical: 35 },
  preference_dpo:       { code: 20, finance: 24, legal: 24, medical: 28 },
  comparison_ab:        { code: 25, finance: 30, legal: 30, medical: 35 },
  fact_checking:        { code: 28, finance: 35, legal: 35, medical: 40 },
  red_teaming:          { code: 42, finance: 50, legal: 50, medical: 60 },
  text_generation:      { code: 30, finance: 38, legal: 38, medical: 45 },
  span_annotation:      { code: 22, finance: 26, legal: 26, medical: 30 },
  extraction:           { code: 24, finance: 28, legal: 28, medical: 32 },
  conversation_rating:  { code: 28, finance: 32, legal: 32, medical: 38 },
};

export const DEFAULT_EXPERT_PAYOUTS: Record<string, Record<string, number>> = {
  scoring:              { code: 5, finance: 7, legal: 7, medical: 8 },
  preference_dpo:       { code: 4, finance: 5, legal: 5, medical: 6 },
  comparison_ab:        { code: 5, finance: 7, legal: 7, medical: 8 },
  fact_checking:        { code: 6, finance: 9, legal: 9, medical: 10 },
  red_teaming:          { code: 10, finance: 12, legal: 12, medical: 15 },
  text_generation:      { code: 8, finance: 10, legal: 10, medical: 12 },
  span_annotation:      { code: 5, finance: 6, legal: 6, medical: 7 },
  extraction:           { code: 5.5, finance: 6.5, legal: 6.5, medical: 7.5 },
  conversation_rating:  { code: 6, finance: 7.5, legal: 7.5, medical: 9 },
};

export const SLA_DEFAULTS = [
  { tier_name: "standard", price_multiplier: 1.0, guaranteed_min_alpha: 0.75, min_annotators_per_task: 2, max_delivery_multiplier: 1.0, active: true },
  { tier_name: "priority", price_multiplier: 1.4, guaranteed_min_alpha: 0.80, min_annotators_per_task: 2, max_delivery_multiplier: 0.7, active: true },
  { tier_name: "express", price_multiplier: 2.2, guaranteed_min_alpha: 0.85, min_annotators_per_task: 3, max_delivery_multiplier: 0.4, active: true },
];
