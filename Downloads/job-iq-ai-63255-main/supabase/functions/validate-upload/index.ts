import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════
// PII DETECTION PATTERNS (CORRECTIF 3)
// ═══════════════════════════════════════════════════════════
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_FR_REGEX = /(?:\+33|0033|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/g;
const PHONE_INTL_REGEX = /\+(?:44|49|1|39|34|32|31|41|43)\s*\d[\s.\-]?\d{2,4}(?:[\s.\-]?\d{2,4}){1,3}/g;
const NIR_REGEX = /[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}/g;
const IBAN_REGEX = /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?(?:[\dA-Z]{4}[\s]?){2,7}[\dA-Z]{1,4}\b/g;
const CB_REGEX = /\b(?:\d[\s\-]?){13,19}\b/g;
const SSN_US_REGEX = /\d{3}-\d{2}-\d{4}/g;
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
const RPPS_REGEX = /\bRPPS\s*[:\-]?\s*([18]\d{10})\b/gi;

function isValidLuhn(number: string): boolean {
  const digits = number.replace(/[\s\-]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]);
    if (alternate) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function isIPAddress(match: string, context: string): boolean {
  const idx = context.indexOf(match);
  const before = context.substring(Math.max(0, idx - 20), idx).toLowerCase();
  if (before.includes("version") || before.includes(" v") || before.includes("v.")) return false;
  const octets = match.split(".").map(Number);
  if (octets.every(o => o < 10)) return false;
  return true;
}

interface PIIMatch { type: string; value: string; count: number }

function scanPII(text: string): { found: boolean; matches: PIIMatch[] } {
  const matches: PIIMatch[] = [];
  const addMatches = (regex: RegExp, type: string, filter?: (m: string) => boolean) => {
    const found = [...text.matchAll(new RegExp(regex.source, regex.flags))];
    const filtered = filter ? found.filter(m => filter(m[0])) : found;
    if (filtered.length > 0) matches.push({ type, value: filtered[0][0], count: filtered.length });
  };

  addMatches(EMAIL_REGEX, "email");
  addMatches(PHONE_FR_REGEX, "phone_fr");

  // Intl phones — exclude those already matched as FR
  const frPhones = [...text.matchAll(new RegExp(PHONE_FR_REGEX.source, PHONE_FR_REGEX.flags))].map(m => m.index);
  const intlFound = [...text.matchAll(new RegExp(PHONE_INTL_REGEX.source, PHONE_INTL_REGEX.flags))];
  const intlFiltered = intlFound.filter(m => !frPhones.includes(m.index));
  if (intlFiltered.length > 0) matches.push({ type: "phone_intl", value: intlFiltered[0][0], count: intlFiltered.length });

  // NIR with validation
  const nirMatches = [...text.matchAll(new RegExp(NIR_REGEX.source, NIR_REGEX.flags))].filter(m => {
    const clean = m[0].replace(/\s/g, "");
    const month = parseInt(clean.substring(3, 5));
    return (month >= 1 && month <= 12) || month >= 20;
  });
  if (nirMatches.length > 0) matches.push({ type: "nir", value: nirMatches[0][0], count: nirMatches.length });

  // IBAN multi-country
  addMatches(IBAN_REGEX, "iban", (m) => {
    const clean = m.replace(/\s/g, "");
    return clean.length >= 14 && clean.length <= 34;
  });

  // Credit cards with Luhn
  const cbFound = [...text.matchAll(new RegExp(CB_REGEX.source, CB_REGEX.flags))].filter(m => {
    const clean = m[0].replace(/[\s\-]/g, "");
    const validPrefix = /^(4\d{12,15}|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})$/;
    return validPrefix.test(clean) && isValidLuhn(clean);
  });
  if (cbFound.length > 0) matches.push({ type: "credit_card", value: cbFound[0][0], count: cbFound.length });

  addMatches(SSN_US_REGEX, "ssn_us");

  // IP with false positive filter
  const ipFound = [...text.matchAll(new RegExp(IP_REGEX.source, IP_REGEX.flags))].filter(m => isIPAddress(m[0], text));
  if (ipFound.length > 0) matches.push({ type: "ip_address", value: ipFound[0][0], count: ipFound.length });

  // RPPS
  const rppsFound = [...text.matchAll(new RegExp(RPPS_REGEX.source, RPPS_REGEX.flags))];
  if (rppsFound.length > 0) matches.push({ type: "rpps", value: rppsFound[0][1] || rppsFound[0][0], count: rppsFound.length });

  return { found: matches.length > 0, matches };
}

function anonymizeText(text: string): string {
  let result = text;
  const patterns: [RegExp, string][] = [
    [EMAIL_REGEX, "[EMAIL_REDACTED]"],
    [PHONE_FR_REGEX, "[PHONE_REDACTED]"],
    [PHONE_INTL_REGEX, "[PHONE_REDACTED]"],
    [NIR_REGEX, "[NIR_REDACTED]"],
    [IBAN_REGEX, "[IBAN_REDACTED]"],
    [SSN_US_REGEX, "[SSN_REDACTED]"],
    [IP_REGEX, "[IP_REDACTED]"],
    [RPPS_REGEX, "[RPPS_REDACTED]"],
  ];
  for (const [regex, replacement] of patterns) {
    result = result.replace(new RegExp(regex.source, regex.flags), replacement);
  }
  // CB with Luhn
  result = result.replace(new RegExp(CB_REGEX.source, CB_REGEX.flags), (m) => {
    const clean = m.replace(/[\s\-]/g, "");
    const validPrefix = /^(4\d{12,15}|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})$/;
    return validPrefix.test(clean) && isValidLuhn(clean) ? "[CB_REDACTED]" : m;
  });
  return result;
}

// ═══════════════════════════════════════════════════════════
// JUNK / PLACEHOLDER VALIDATION (CORRECTIF 2)
// ═══════════════════════════════════════════════════════════
const PLACEHOLDER_VALUES = new Set([
  "n/a", "na", "none", "null", "undefined", "todo",
  "tbd", "test", "xxx", "...", "placeholder",
  "à compléter", "to be filled", "example", "sample",
  "dummy", "filler", "lorem ipsum", "asdf", "aaa",
]);

interface ValidationResult { valid: boolean; reason?: string; category?: string }

function validateItem(item: any, taskType: string, requiredFields: string[]): ValidationResult {
  // CHECK 1: item is an object
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return { valid: false, reason: "INVALID_TYPE: l'item n'est pas un objet JSON", category: "invalid_type" };
  }

  // CHECK 2: required fields present
  for (const field of requiredFields) {
    if (!(field in item)) {
      return { valid: false, reason: `MISSING_FIELD: champ '${field}' manquant`, category: "missing_field" };
    }
  }

  // CHECK 3: fields must be strings
  for (const field of requiredFields) {
    if (typeof item[field] !== "string") {
      return { valid: false, reason: `WRONG_TYPE: '${field}' est de type ${typeof item[field]}, attendu string`, category: "wrong_type" };
    }
  }

  // CHECK 4: fields non-empty after trim
  for (const field of requiredFields) {
    if (item[field].trim().length === 0) {
      return { valid: false, reason: `EMPTY_FIELD: '${field}' est vide`, category: "empty_field" };
    }
  }

  // CHECK 5: no placeholder values
  for (const field of requiredFields) {
    const normalized = item[field].trim().toLowerCase();
    if (PLACEHOLDER_VALUES.has(normalized)) {
      return { valid: false, reason: `PLACEHOLDER: '${field}' contient '${item[field].trim()}'`, category: "placeholder" };
    }
  }

  // CHECK 6: minimum length (10 chars)
  for (const field of requiredFields) {
    const trimmed = item[field].trim();
    if (trimmed.length < 10) {
      return { valid: false, reason: `TOO_SHORT: '${field}' fait ${trimmed.length} chars (min 10)`, category: "too_short" };
    }
  }

  // CHECK 7: maximum length (50000 chars)
  for (const field of requiredFields) {
    if (item[field].length > 50000) {
      return { valid: false, reason: `TOO_LONG: '${field}' fait ${item[field].length} chars (max 50000)`, category: "too_long" };
    }
  }

  // CHECK 8: prompt ≠ response/chosen (copy-paste)
  if (taskType === "preference_dpo" || taskType === "comparison_ab") {
    const responseField = taskType === "preference_dpo" ? "response_a" : "response_a";
    if (item[responseField] && item.prompt) {
      const promptNorm = item.prompt.trim().toLowerCase();
      const responseNorm = item[responseField].trim().toLowerCase();
      if (promptNorm === responseNorm) {
        return { valid: false, reason: "COPY_PASTE: response identique au prompt", category: "copy_paste" };
      }
    }
  }
  if (taskType === "scoring" && item.response && item.prompt) {
    if (item.prompt.trim().toLowerCase() === item.response.trim().toLowerCase()) {
      return { valid: false, reason: "COPY_PASTE: response identique au prompt", category: "copy_paste" };
    }
  }

  // CHECK 9: response_a ≠ response_b (no preference)
  if ((taskType === "preference_dpo" || taskType === "comparison_ab") && item.response_a && item.response_b) {
    if (item.response_a.trim().toLowerCase() === item.response_b.trim().toLowerCase()) {
      return { valid: false, reason: "NO_PREFERENCE: response_a et response_b sont identiques", category: "no_preference" };
    }
  }

  // CHECK 10: meaningful text content (not just punctuation)
  for (const field of requiredFields) {
    const textOnly = item[field].replace(/[^a-zA-ZÀ-ÿ0-9]/g, "").trim();
    if (textOnly.length < 3) {
      return { valid: false, reason: `NO_CONTENT: '${field}' ne contient pas de texte significatif`, category: "no_content" };
    }
  }

  // CHECK 11: not a single repeated word
  for (const field of requiredFields) {
    const words = item[field].trim().toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (uniqueWords.size === 1 && words.length > 2) {
      return { valid: false, reason: `REPEATED_WORD: '${field}' ne contient qu'un seul mot répété`, category: "repeated_word" };
    }
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════
// DEDUPLICATION (CORRECTIF 1) — hash on ALL content fields
// ═══════════════════════════════════════════════════════════
const METADATA_KEYS = new Set(["id", "idx", "index", "row", "row_number", "line", "ligne", "num", "number"]);

async function computeContentHash(item: Record<string, string>, _requiredFields: string[]): Promise<string> {
  const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  // Hash on ALL content fields (sorted for determinism), not just requiredFields
  // This prevents false duplicates when column names don't match expected aliases
  const contentEntries = Object.entries(item)
    .filter(([k]) => !METADATA_KEYS.has(k.toLowerCase().replace(/[\s_-]/g, "")))
    .sort(([a], [b]) => a.localeCompare(b));
  const content = contentEntries.map(([, v]) => normalize(v)).join("||");
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ═══════════════════════════════════════════════════════════
// HTML / MARKDOWN CLEANUP
// ═══════════════════════════════════════════════════════════
const STYLE_SCRIPT_REGEX = /<(?:style|script)[^>]*>[\s\S]*?<\/(?:style|script)>/gi;
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const HTML_TAG_REGEX = /<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\s*\/?>/g;
const HTML_ENTITY_REGEX = /&(?:amp|lt|gt|quot|apos|nbsp|#\d{1,5}|#x[\da-fA-F]{1,4});/g;

function stripHTML(text: string): { cleaned: string; hadHTML: boolean } {
  const original = text;
  let result = text;
  result = result.replace(STYLE_SCRIPT_REGEX, " ");
  result = result.replace(HTML_COMMENT_REGEX, " ");
  result = result.replace(HTML_TAG_REGEX, " ");
  result = result.replace(HTML_ENTITY_REGEX, (entity) => {
    const map: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " };
    return map[entity] || (entity.startsWith("&#x")
      ? String.fromCharCode(parseInt(entity.slice(3, -1), 16))
      : entity.startsWith("&#")
      ? String.fromCharCode(parseInt(entity.slice(2, -1)))
      : entity);
  });
  result = result.replace(/\s{2,}/g, " ").trim();
  return { cleaned: result, hadHTML: result !== original };
}

// ═══════════════════════════════════════════════════════════
// UNICODE NORMALIZATION (CORRECTIF 5)
// ═══════════════════════════════════════════════════════════
function normalizeUnicode(text: string): { normalized: string; wasChanged: boolean } {
  let result = text
    .normalize("NFC")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\uFE10]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { normalized: result, wasChanged: result !== text };
}

// ═══════════════════════════════════════════════════════════
// LANGUAGE DETECTION PER ITEM (CORRECTIF 4)
// ═══════════════════════════════════════════════════════════
const NON_LATIN_PATTERNS: Record<string, RegExp> = {
  arabic: /[\u0600-\u06FF\u0750-\u077F]/g,
  japanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
  chinese: /[\u4E00-\u9FFF]/g,
  cyrillic: /[\u0400-\u04FF]/g,
  korean: /[\uAC00-\uD7AF\u1100-\u11FF]/g,
};

const LANG_TRIGRAMS: Record<string, Set<string>> = {
  fr: new Set(["le", "la", "les", "un", "une", "des", "du", "de", "en", "est", "et", "il", "elle", "nous", "vous", "je", "tu", "ce", "cette", "qui", "que", "dans", "avec", "pour", "sur", "par", "pas", "sont", "mais", "aussi", "très", "plus", "avoir", "être", "faire"]),
  en: new Set(["the", "is", "are", "was", "were", "have", "has", "had", "been", "will", "would", "could", "should", "this", "that", "with", "from", "they", "their", "what", "which", "when", "where", "how", "not", "but", "also", "very", "more", "than"]),
  de: new Set(["der", "die", "das", "ein", "eine", "und", "ist", "von", "mit", "auf", "für", "den", "dem", "nicht", "sich", "als", "auch", "noch", "nach", "bei", "wie", "über", "kann", "hat", "sind", "wird"]),
  es: new Set(["el", "los", "las", "una", "unos", "del", "con", "por", "para", "como", "pero", "más", "este", "esta", "puede", "son", "fue", "ser", "hay", "también", "muy", "desde", "donde", "está", "sus"]),
  it: new Set(["gli", "che", "del", "per", "una", "con", "non", "sono", "dalla", "delle", "nella", "alla", "come", "anche", "può", "suo", "questa", "quello", "essere", "stato"]),
};

interface LangResult {
  detected: string | null;
  confidence: number;
  mismatch: boolean;
  script_mismatch: boolean;
}

function detectItemLanguage(text: string, declaredLang: string): LangResult {
  // Check non-latin scripts
  for (const [script, pattern] of Object.entries(NON_LATIN_PATTERNS)) {
    const matches = text.match(new RegExp(pattern.source, "g"));
    if (matches && matches.length > 5) {
      return { detected: script, confidence: 0.95, mismatch: true, script_mismatch: true };
    }
  }

  // Trigram matching
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  if (words.length < 5) return { detected: null, confidence: 0, mismatch: false, script_mismatch: false };

  const scores: Record<string, number> = {};
  for (const [lang, trigrams] of Object.entries(LANG_TRIGRAMS)) {
    scores[lang] = words.filter(w => trigrams.has(w)).length / words.length;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] > 0.05) {
    const detected = sorted[0][0];
    const confidence = sorted[0][1];
    const declaredNorm = declaredLang.toLowerCase().substring(0, 2);
    const mismatch = detected !== declaredNorm && confidence > 0.10;
    return { detected, confidence, mismatch, script_mismatch: false };
  }

  return { detected: null, confidence: 0, mismatch: false, script_mismatch: false };
}

// Aggregate language detection for the report
function detectLanguageAggregate(texts: string[]): { detected: string; confidence: number; distribution: Record<string, number> } {
  const sample = texts.slice(0, 100).join(" ");
  const words = sample.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  const total = Math.max(words.length, 1);

  const counts: Record<string, number> = {};
  for (const [lang, trigrams] of Object.entries(LANG_TRIGRAMS)) {
    counts[lang] = words.filter(w => trigrams.has(w)).length;
  }
  const totalMatches = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  const distribution: Record<string, number> = {};
  for (const [lang, count] of Object.entries(counts)) {
    distribution[lang] = Math.round((count / totalMatches) * 100);
  }

  const sorted = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const significantLangs = sorted.filter(([, pct]) => pct >= 25);
  if (significantLangs.length >= 2) {
    return { detected: `${significantLangs[0][0]}_${significantLangs[1][0]}`, confidence: Math.max(...significantLangs.map(([, p]) => p)), distribution };
  }

  return { detected: sorted[0]?.[0] || "unknown", confidence: sorted[0]?.[1] || 0, distribution };
}

// ═══════════════════════════════════════════════════════════
// QUALITY FLAGS (CORRECTIF 6)
// ═══════════════════════════════════════════════════════════
interface QualityFlag { type: string; field: string; detail: string; severity: "warning" | "critical" }

function computeSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function checkQualityFlags(item: Record<string, string>, taskType: string): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (taskType === "preference_dpo" || taskType === "comparison_ab") {
    if (item.response_a && item.response_b) {
      const similarity = computeSimilarity(item.response_a, item.response_b);
      if (similarity > 0.85) {
        flags.push({ type: "TOO_SIMILAR", field: "response_a/response_b", detail: `Similarité ${(similarity * 100).toFixed(0)}%`, severity: "warning" });
      }
      if (item.response_a.length < item.response_b.length * 0.3) {
        flags.push({ type: "POSSIBLY_INVERTED", field: "response_a/response_b", detail: `response_a (${item.response_a.length}) << response_b (${item.response_b.length})`, severity: "warning" });
      }
    }
  }

  for (const field of ["prompt", "response", "response_a", "response_b"]) {
    if (!item[field]) continue;
    const text = item[field];
    const upperCount = (text.match(/[A-ZÀ-Ü]/g) || []).length;
    const letterCount = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    if (letterCount > 20 && upperCount / letterCount > 0.80) {
      flags.push({ type: "ALL_CAPS", field, detail: `${((upperCount / letterCount) * 100).toFixed(0)}% majuscules`, severity: "warning" });
    }
  }

  for (const field of ["response", "response_a", "response_b"]) {
    if (!item[field]) continue;
    const sentences = item[field].split(/[.!?]+/).map((s: string) => s.trim().toLowerCase()).filter((s: string) => s.length > 10);
    const counts = new Map<string, number>();
    for (const s of sentences) counts.set(s, (counts.get(s) || 0) + 1);
    for (const [sentence, count] of counts) {
      if (count >= 3) {
        flags.push({ type: "REPETITIVE", field, detail: `"${sentence.substring(0, 40)}..." ×${count}`, severity: "warning" });
        break;
      }
    }
  }

  for (const field of ["response", "response_a", "response_b"]) {
    if (!item[field]) continue;
    const frWords = (item[field].match(/\b(les|des|une|est|que|pas|par|sur|dans|pour|avec)\b/gi) || []).length;
    const enWords = (item[field].match(/\b(the|and|that|have|for|not|with|you|this|but)\b/gi) || []).length;
    if (frWords > 3 && enWords > 3) {
      flags.push({ type: "MIXED_LANGUAGE", field, detail: `${frWords} FR + ${enWords} EN`, severity: "warning" });
    }
  }

  return flags;
}

// ═══════════════════════════════════════════════════════════
// QUALITY SCORING
// ═══════════════════════════════════════════════════════════
function computeRowQuality(row: Record<string, string>, requiredFields: string[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;
  for (const field of requiredFields) {
    const val = row[field] || "";
    const tokens = Math.ceil(val.length / 4);
    if (tokens < 20 && val.length >= 10) { score -= 10; issues.push(`${field}: contenu pauvre (${tokens} tokens)`); }
    const words = val.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length > 5) {
      const wordCounts: Record<string, number> = {};
      for (const w of words) wordCounts[w] = (wordCounts[w] || 0) + 1;
      const maxRepeat = Math.max(...Object.values(wordCounts));
      if (maxRepeat / words.length > 0.3) { score -= 15; issues.push(`${field}: contenu répétitif`); }
    }
  }
  return { score: Math.max(0, Math.min(100, score)), issues };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const BodySchema = z.object({
      action: z.enum(["validate", "get_report", "confirm", "reject"]),
      upload_id: z.string().uuid().optional(),
      project_id: z.string().uuid().optional(),
      data: z.array(z.record(z.any())).optional(),
      file_name: z.string().optional(),
      task_type: z.string().optional(),
    });

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, upload_id, project_id, data: rawData, file_name, task_type } = parsed.data;

    // ══════════════════════════════════════════════════════
    // VALIDATE — Full data cleaning pipeline v3.0
    // ══════════════════════════════════════════════════════
    if (action === "validate") {
      if (!project_id || !rawData || !task_type) {
        return new Response(JSON.stringify({ error: "project_id, data, task_type required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rawData.length > 50000) {
        return new Response(JSON.stringify({ error: "Maximum 50 000 lignes par upload" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rawData.length === 0) {
        return new Response(JSON.stringify({ error: "Le fichier ne contient aucune donnée" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: project } = await supabase
        .from("annotation_projects")
        .select("domain, type, languages, client_id")
        .eq("id", project_id)
        .single();

      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const requiredFields = getRequiredFields(task_type);
      const errors: { row: number; error: string; severity: "error" | "warning" }[] = [];
      const validItems: any[] = [];
      const seenHashes = new Set<string>();

      // Cleaning counters
      let duplicates = 0;
      let piiDetected = 0;
      let htmlCleanedRows = 0;
      let unicodeNormalizedRows = 0;
      const piiBreakdown: Record<string, number> = {};
      const qualityScores: number[] = [];
      const promptLengths: number[] = [];
      const responseLengths: number[] = [];
      const allTexts: string[] = [];

      // Junk breakdown
      const junkBreakdown: Record<string, number> = {};
      let junkRows = 0;
      let tooShortRows = 0;
      let tooLongRows = 0;

      // Language counters
      let langCorrect = 0;
      let langMismatchFlagged = 0;
      let langScriptRejected = 0;

      // Quality flags counters
      const qualityFlagCounts: Record<string, number> = {};

      const projectLang = project.languages?.[0] || "fr";

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNum = i + 1;

        // ── Step 1: Junk validation (11 checks) ──
        const junkResult = validateItem(row, task_type, requiredFields);
        if (!junkResult.valid) {
          junkRows++;
          const cat = junkResult.category || "unknown";
          junkBreakdown[cat] = (junkBreakdown[cat] || 0) + 1;
          if (cat === "too_short") tooShortRows++;
          if (cat === "too_long") tooLongRows++;
          errors.push({ row: rowNum, error: junkResult.reason!, severity: "error" });
          continue;
        }

        // ── Step 2: Trim + Unicode normalization ──
        const cleaned: Record<string, string> = {};
        let rowUnicodeChanged = false;
        for (const [key, val] of Object.entries(row)) {
          const strVal = String(val).trim();
          const { normalized, wasChanged } = normalizeUnicode(strVal);
          cleaned[key] = normalized;
          if (wasChanged) rowUnicodeChanged = true;
        }
        if (rowUnicodeChanged) unicodeNormalizedRows++;

        // ── Step 3: HTML cleanup ──
        let rowHadHTML = false;
        for (const key of Object.keys(cleaned)) {
          const { cleaned: strippedText, hadHTML } = stripHTML(cleaned[key]);
          if (hadHTML) { cleaned[key] = strippedText; rowHadHTML = true; }
        }
        if (rowHadHTML) htmlCleanedRows++;

        // ── Step 4: Per-item language detection ──
        const textForLang = requiredFields.map(f => cleaned[f] || "").join(" ");
        const langCheck = detectItemLanguage(textForLang, projectLang);
        if (langCheck.script_mismatch) {
          langScriptRejected++;
          errors.push({ row: rowNum, error: `LANGUAGE_SCRIPT: contenu en ${langCheck.detected} alors que '${projectLang}' déclaré`, severity: "error" });
          continue;
        } else if (langCheck.mismatch && langCheck.confidence > 0.15) {
          langMismatchFlagged++;
          errors.push({ row: rowNum, error: `LANGUAGE_MISMATCH: détecté ${langCheck.detected} (${(langCheck.confidence * 100).toFixed(0)}%) mais déclaré ${projectLang}`, severity: "warning" });
          // Warning only, don't skip
        } else {
          langCorrect++;
        }

        // ── Step 5: Deduplication on content fields ──
        const hash = await computeContentHash(cleaned, requiredFields);
        if (seenHashes.has(hash)) {
          duplicates++;
          continue;
        }
        seenHashes.add(hash);

        // ── Step 6: PII scan + anonymization ──
        const allText = Object.values(cleaned).join(" ");
        const piiResult = scanPII(allText);
        if (piiResult.found) {
          piiDetected++;
          for (const m of piiResult.matches) {
            piiBreakdown[m.type] = (piiBreakdown[m.type] || 0) + m.count;
          }
          for (const key of Object.keys(cleaned)) {
            cleaned[key] = anonymizeText(cleaned[key]);
          }
        }

        // ── Step 7: Quality scoring ──
        const quality = computeRowQuality(cleaned, requiredFields);
        qualityScores.push(quality.score);
        if (quality.issues.length > 0 && quality.score < 50) {
          errors.push({ row: rowNum, error: `Qualité faible (${quality.score}/100): ${quality.issues[0]}`, severity: "warning" });
        }

        // ── Step 8: Quality flags ──
        const qFlags = checkQualityFlags(cleaned, task_type);
        for (const f of qFlags) {
          qualityFlagCounts[f.type] = (qualityFlagCounts[f.type] || 0) + 1;
          if (qFlags.length <= 2) {
            errors.push({ row: rowNum, error: `FLAG_${f.type}: ${f.detail}`, severity: "warning" });
          }
        }

        // ── Step 9: Stats collection ──
        if (cleaned.prompt) { promptLengths.push(estimateTokens(cleaned.prompt)); allTexts.push(cleaned.prompt); }
        if (cleaned.response) responseLengths.push(estimateTokens(cleaned.response));
        if (cleaned.response_a) responseLengths.push(estimateTokens(cleaned.response_a));
        if (cleaned.response_b) responseLengths.push(estimateTokens(cleaned.response_b));
        if (cleaned.claim) allTexts.push(cleaned.claim);

        validItems.push(cleaned);
      }

      const totalRows = rawData.length;
      const invalidRows = totalRows - validItems.length - duplicates;
      const invalidPercent = (invalidRows / totalRows) * 100;
      const validationStatus = invalidPercent > 10 ? "invalid" : "valid";

      // Aggregate language detection
      const langResult = detectLanguageAggregate(allTexts);
      const langMismatch = !langResult.detected.includes(projectLang) && langResult.confidence > 60;

      // Aggregate quality score
      const avgQuality = qualityScores.length > 0
        ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length) : 0;

      // Stats
      const avgPrompt = promptLengths.length > 0 ? Math.round(promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length) : 0;
      const avgResponse = responseLengths.length > 0 ? Math.round(responseLengths.reduce((a, b) => a + b, 0) / responseLengths.length) : 0;

      // Cost estimate
      const lang = project.languages?.[0] || "fr";
      let costEstimate: any = null;
      try {
        const { data: est } = await supabase.rpc("estimate_project_cost", {
          p_domain: project.domain, p_task_type: task_type, p_language: lang,
          p_num_tasks: validItems.length, p_client_plan: "pay_per_task",
        });
        costEstimate = Array.isArray(est) ? est[0] : est;
      } catch {}

      // Delivery estimate
      let deliveryDays = 7;
      try {
        const { data: dd } = await supabase.rpc("estimate_delivery_days", {
          p_domain: project.domain, p_num_tasks: validItems.length,
        });
        deliveryDays = dd || 7;
      } catch {}

      // Build cleaning report v3.0
      const cleaningReport = {
        pipeline_version: "3.0",
        steps: [
          { name: "unicode_normalization", applied: unicodeNormalizedRows, description: "NFC, guillemets, tirets, espaces spéciaux, zero-width" },
          { name: "junk_detection", removed: junkRows, breakdown: junkBreakdown, description: "11 checks : types, placeholders, vide, copier-coller, répétitions" },
          { name: "html_cleanup", cleaned: htmlCleanedRows, description: "Suppression balises HTML, scripts, styles, entités" },
          { name: "deduplication", removed: duplicates, method: "sha256_content_fields", description: "Hash SHA-256 sur tous les champs de contenu (pas juste le prompt)" },
          { name: "pii_scan", detected: piiDetected, breakdown: piiBreakdown, description: "Emails, téléphones FR+intl, IBAN multi-pays, NIR, CB+Luhn, SSN, IP, RPPS" },
          { name: "language_detection", correct: langCorrect, mismatch_flagged: langMismatchFlagged, script_rejected: langScriptRejected, aggregate: langResult, mismatch: langMismatch },
          { name: "quality_scoring", avg_score: avgQuality, below_50: qualityScores.filter(s => s < 50).length },
          { name: "quality_flags", counts: qualityFlagCounts },
        ],
        total_input: totalRows,
        total_output: validItems.length,
        rows_removed: totalRows - validItems.length,
        removal_rate: Math.round(((totalRows - validItems.length) / totalRows) * 100 * 10) / 10,
      };

      // Store validated data
      const storageKey = `uploads/${project_id}/${Date.now()}.json`;
      const blob = new Blob([JSON.stringify(validItems)], { type: "application/json" });
      await supabase.storage.from("upload-data").upload(storageKey, blob, { upsert: true });

      // Persist upload record
      const { data: upload, error: uploadErr } = await supabase.from("client_uploads").insert({
        project_id,
        client_id: project.client_id,
        user_id: userId,
        file_name: file_name || "upload.json",
        file_format: "json",
        file_size_bytes: JSON.stringify(rawData).length,
        total_rows: totalRows,
        valid_rows: validItems.length,
        invalid_rows: invalidRows,
        duplicate_rows: duplicates,
        pii_detected_rows: piiDetected,
        junk_rows: junkRows,
        html_cleaned_rows: htmlCleanedRows,
        too_short_rows: tooShortRows,
        too_long_rows: tooLongRows,
        unicode_normalized_rows: unicodeNormalizedRows,
        validation_errors: errors.slice(0, 100),
        validation_status: validationStatus,
        avg_prompt_length: avgPrompt,
        avg_response_length: avgResponse,
        estimated_cost: costEstimate?.total_before_tax || 0,
        estimated_delivery_days: deliveryDays,
        preview_items: validItems.slice(0, 5),
        storage_key: storageKey,
        quality_score: avgQuality,
        detected_language: langResult.detected,
        cleaning_report: cleaningReport,
        validated_at: new Date().toISOString(),
      }).select().single();

      if (uploadErr) {
        return new Response(JSON.stringify({ error: uploadErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        upload_id: upload.id,
        status: validationStatus,
        total_rows: totalRows,
        valid_rows: validItems.length,
        invalid_rows: invalidRows,
        duplicate_rows: duplicates,
        pii_detected_rows: piiDetected,
        junk_rows: junkRows,
        html_cleaned_rows: htmlCleanedRows,
        too_short_rows: tooShortRows,
        too_long_rows: tooLongRows,
        unicode_normalized_rows: unicodeNormalizedRows,
        quality_score: avgQuality,
        language: langResult,
        language_mismatch: langMismatch,
        language_per_item: { correct: langCorrect, mismatch_flagged: langMismatchFlagged, script_rejected: langScriptRejected },
        quality_flags: qualityFlagCounts,
        junk_breakdown: junkBreakdown,
        pii_breakdown: piiBreakdown,
        validation_errors: errors.slice(0, 30),
        cleaning_report: cleaningReport,
        stats: {
          avg_prompt_length_tokens: avgPrompt,
          avg_response_length_tokens: avgResponse,
          min_response_length_tokens: responseLengths.length > 0 ? Math.min(...responseLengths) : 0,
          max_response_length_tokens: responseLengths.length > 0 ? Math.max(...responseLengths) : 0,
        },
        cost_estimate: costEstimate ? {
          unit_price: costEstimate.unit_price,
          volume_discount: `${costEstimate.volume_discount_percent}%`,
          total: costEstimate.total_before_tax,
          currency: "USD",
        } : null,
        delivery_estimate_days: deliveryDays,
        preview: validItems.slice(0, 5),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════════════════════════════════════════════════════
    // GET REPORT
    // ══════════════════════════════════════════════════════
    if (action === "get_report") {
      if (!upload_id) {
        return new Response(JSON.stringify({ error: "upload_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: upload } = await supabase.from("client_uploads").select("*").eq("id", upload_id).single();
      return new Response(JSON.stringify({ upload }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════════════════════════════════════════════════════
    // CONFIRM
    // ══════════════════════════════════════════════════════
    if (action === "confirm") {
      if (!upload_id) {
        return new Response(JSON.stringify({ error: "upload_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: upload } = await supabase.from("client_uploads").select("*")
        .eq("id", upload_id).eq("validation_status", "valid").single();

      if (!upload) {
        return new Response(JSON.stringify({ error: "Upload not found or not valid" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: project } = await supabase.from("annotation_projects")
        .select("domain, type, languages").eq("id", upload.project_id).single();

      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: batch } = await supabase.from("annotation_batches").insert({
        project_id: upload.project_id, name: upload.file_name,
        total_items: upload.valid_rows, status: "active",
      }).select("id").single();

      let allItems: any[] = [];
      if ((upload as any).storage_key) {
        const { data: fileData } = await supabase.storage.from("upload-data").download((upload as any).storage_key);
        if (fileData) {
          try { allItems = JSON.parse(await fileData.text()); }
          catch { allItems = upload.preview_items || []; }
        }
      } else {
        allItems = upload.preview_items || [];
      }

      const { data: projData } = await supabase
        .from("annotation_projects")
        .select("complexity_level")
        .eq("id", upload.project_id)
        .single();
      const itemComplexity = projData?.complexity_level || 2;

      const BATCH_SIZE = 500;
      let totalCreated = 0;
      for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const chunk = allItems.slice(i, i + BATCH_SIZE);
        const items = chunk.map((item: any) => ({
          project_id: upload.project_id,
          batch_id: batch?.id,
          content: {
            type: item.response_a && item.response_b ? "text_pair" : "text",
            primary: item.prompt || item.claim || "",
            secondary: item.response || undefined,
            alternatives: item.response_a && item.response_b ? [item.response_a, item.response_b] : undefined,
          },
          complexity_level: itemComplexity,
          status: "queued" as const,
          is_gold_standard: false,
          is_calibration: false,
        }));
        if (items.length > 0) {
          await supabase.from("annotation_items").insert(items);
          totalCreated += items.length;
        }
      }

      await supabase.from("annotation_projects").update({
        status: "active", total_items: totalCreated,
      }).eq("id", upload.project_id);

      await supabase.from("client_uploads").update({
        validation_status: "confirmed", confirmed_at: new Date().toISOString(),
      }).eq("id", upload_id);

      return new Response(JSON.stringify({
        success: true, tasks_created: totalCreated, project_status: "active",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ══════════════════════════════════════════════════════
    // REJECT
    // ══════════════════════════════════════════════════════
    if (action === "reject") {
      if (!upload_id) {
        return new Response(JSON.stringify({ error: "upload_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("client_uploads").update({ validation_status: "invalid" }).eq("id", upload_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[validate-upload] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getRequiredFields(taskType: string): string[] {
  switch (taskType) {
    case "scoring": return ["prompt", "response"];
    case "preference_dpo": return ["prompt", "response_a", "response_b"];
    case "comparison_ab": return ["prompt", "response_a", "response_b"];
    case "fact_checking": return ["claim"];
    case "red_teaming": return [];
    case "text_generation": return ["prompt"];
    case "span_annotation": return ["text"];
    case "extraction": return ["text"];
    case "conversation_rating": return ["prompt"];
    default: return ["prompt"];
  }
}
