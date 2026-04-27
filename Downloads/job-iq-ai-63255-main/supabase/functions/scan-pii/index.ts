import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ─── PII Detection System Prompt ────────────────────────────────

const SYSTEM_PROMPT_PII = `Tu es le scanner PII de STEF. Tu analyses un texte et tu identifies toute information personnelle identifiable.

Catégories à détecter :
- NOM : noms propres, prénoms, noms de famille (pas les noms de médicaments, maladies, technologies)
- EMAIL : adresses email
- TELEPHONE : numéros de téléphone (tout format)
- ADRESSE : adresses physiques complètes (rue + ville). "Paris est la capitale" n'est PAS une adresse.
- IDENTIFIANT : carte d'identité, passeport, sécurité sociale, numéro patient
- FINANCIER : carte bancaire, IBAN, comptes bancaires
- IP : adresses IP (IPv4, IPv6)
- URL_PERSO : profils LinkedIn, GitHub personnel avec vrai nom
- DATE_NAISSANCE : dates de naissance

Règles :
- Ne PAS anonymiser les noms de technologies, frameworks, langages de programmation
- Ne PAS anonymiser les noms d'entreprises utilisés comme contexte technique (ex: "l'API de Stripe")
- Ne PAS anonymiser les noms de maladies, médicaments, concepts juridiques
- Ne PAS anonymiser les noms géographiques utilisés comme fait (ex: "Paris est la capitale")
- En cas de doute, anonymiser (faux positif > faux négatif)

Format de sortie JSON strict :
{
  "pii_detected": true/false,
  "items": [
    {
      "category": "NOM",
      "original": "Jean Dupont",
      "start": 45,
      "end": 56,
      "replacement": "[PERSONNE_1]",
      "confidence": 0.95
    }
  ],
  "sanitized_text": "le texte complet avec les PII remplacés"
}`;

// ─── Interfaces ─────────────────────────────────────────────────

interface PIIItem {
  category: string;
  original: string;
  start: number;
  end: number;
  replacement: string;
  confidence: number;
}

interface PIIScanResult {
  pii_detected: boolean;
  items: PIIItem[];
  sanitized_text: string;
}

// ─── Luhn check for credit cards ────────────────────────────────

function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ─── Regex-based fast scan ──────────────────────────────────────

function regexScan(text: string): PIIItem[] {
  const items: PIIItem[] = [];
  let match: RegExpExecArray | null;

  // Email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((match = emailRegex.exec(text)) !== null) {
    items.push({
      category: "EMAIL",
      original: match[0],
      start: match.index,
      end: match.index + match[0].length,
      replacement: "[EMAIL]",
      confidence: 0.99,
    });
  }

  // French social security number (NIR) - must match BEFORE phone to avoid overlap
  const nssRegex = /\b[12]\s?\d{2}\s?\d{2}\s?\d{2,5}\s?\d{3}\s?\d{3}\s?\d{2}\b/g;
  while ((match = nssRegex.exec(text)) !== null) {
    const digits = match[0].replace(/\s/g, "");
    // Must be 13-15 digits and start with 1 or 2
    if (digits.length >= 13 && digits.length <= 15) {
      items.push({
        category: "SSN",
        original: match[0],
        start: match.index,
        end: match.index + match[0].length,
        replacement: "[SSN]",
        confidence: 0.97,
      });
    }
  }

  // IBAN - must be at least 15 chars (country code + check + BBAN)
  const ibanRegex = /\b[A-Z]{2}\d{2}[\s]?(?:[\dA-Z]{4}[\s]?){2,7}[\dA-Z]{1,4}\b/g;
  while ((match = ibanRegex.exec(text)) !== null) {
    const clean = match[0].replace(/\s/g, "");
    if (clean.length >= 15) {
      items.push({
        category: "IBAN",
        original: match[0],
        start: match.index,
        end: match.index + match[0].length,
        replacement: "[IBAN]",
        confidence: 0.98,
      });
    }
  }

  // Phone (French + international) - skip if overlaps with NIR
  const phoneRegex =
    /(?:\+33|0033|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    const phoneDigits = match[0].replace(/\D/g, "");
    if (phoneDigits.length >= 10) {
      // Check no overlap with already found NIR
      const overlapsNIR = items.some(
        (item) =>
          item.category === "SSN" &&
          match!.index >= item.start &&
          match!.index + match![0].length <= item.end
      );
      if (!overlapsNIR) {
        items.push({
          category: "PHONE",
          original: match[0],
          start: match.index,
          end: match.index + match[0].length,
          replacement: "[PHONE]",
          confidence: 0.95,
        });
      }
    }
  }

  // Credit card (16 digits with optional separators) - with Luhn check
  const ccRegex = /\b(\d{4}[-\s]?){3}\d{4}\b/g;
  while ((match = ccRegex.exec(text)) !== null) {
    const digits = match[0].replace(/\D/g, "");
    // Skip if overlaps with IBAN
    const overlapsIBAN = items.some(
      (item) =>
        item.category === "IBAN" &&
        match!.index >= item.start &&
        match!.index + match![0].length <= item.end
    );
    if (!overlapsIBAN && luhnCheck(digits)) {
      items.push({
        category: "CREDIT_CARD",
        original: match[0],
        start: match.index,
        end: match.index + match[0].length,
        replacement: "[CREDIT_CARD]",
        confidence: 0.96,
      });
    }
  }

  // IP Address (IPv4)
  const ipRegex = /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g;
  while ((match = ipRegex.exec(text)) !== null) {
    // Validate octets are in valid IP range and not a version number
    const octets = match[0].split(".").map(Number);
    const isPrivateOrPublic =
      octets[0] >= 1 && octets[0] <= 255 &&
      // Exclude common version patterns (all octets < 10)
      !(octets.every((o) => o < 10));
    if (isPrivateOrPublic) {
      items.push({
        category: "IP_ADDRESS",
        original: match[0],
        start: match.index,
        end: match.index + match[0].length,
        replacement: "[IP_ADDRESS]",
        confidence: 0.90,
      });
    }
  }

  // LinkedIn / GitHub profile URLs
  const profileRegex =
    /https?:\/\/(?:www\.)?(?:linkedin\.com\/in|github\.com)\/[a-zA-Z0-9_-]+/g;
  while ((match = profileRegex.exec(text)) !== null) {
    items.push({
      category: "URL_PERSO",
      original: match[0],
      start: match.index,
      end: match.index + match[0].length,
      replacement: "[PROFILE_URL]",
      confidence: 0.9,
    });
  }

  return items;
}

// ─── LLM-based deep scan ───────────────────────────────────────

async function callLLMForPII(text: string): Promise<PIIScanResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { pii_detected: false, items: [], sanitized_text: text };
  }

  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SYSTEM_PROMPT_PII },
            { role: "user", content: text },
          ],
          temperature: 0.0,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) return { pii_detected: false, items: [], sanitized_text: text };

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as PIIScanResult;
    } catch {}

    return { pii_detected: false, items: [], sanitized_text: text };
  } catch {
    return { pii_detected: false, items: [], sanitized_text: text };
  }
}

// ─── Merge & Apply ──────────────────────────────────────────────

function mergeResults(regex: PIIItem[], llm: PIIItem[]): PIIItem[] {
  const merged = [...regex];
  for (const item of llm) {
    // Skip LLM items that overlap with regex items
    const overlap = merged.some(
      (r) =>
        (item.start >= r.start && item.start < r.end) ||
        (item.end > r.start && item.end <= r.end) ||
        (item.start <= r.start && item.end >= r.end)
    );
    if (!overlap) merged.push(item);
  }
  return merged.sort((a, b) => a.start - b.start);
}

function applyReplacements(text: string, items: PIIItem[]): string {
  // Remove overlapping items — keep higher confidence one
  const deduplicated: PIIItem[] = [];
  const sorted = [...items].sort((a, b) => a.start - b.start);
  
  for (const item of sorted) {
    const overlaps = deduplicated.some(
      (existing) =>
        (item.start >= existing.start && item.start < existing.end) ||
        (item.end > existing.start && item.end <= existing.end) ||
        (item.start <= existing.start && item.end >= existing.end)
    );
    if (!overlaps) {
      deduplicated.push(item);
    }
  }

  // Apply replacements in reverse order to preserve offsets
  const reverseSorted = [...deduplicated].sort((a, b) => b.start - a.start);
  let result = text;
  for (const item of reverseSorted) {
    result =
      result.substring(0, item.start) +
      item.replacement +
      result.substring(item.end);
  }
  return result;
}

// ─── Core scan function ─────────────────────────────────────────

async function scanText(text: string): Promise<PIIScanResult> {
  if (!text || text.trim().length === 0) {
    return { pii_detected: false, items: [], sanitized_text: text };
  }

  // Step 1: Fast regex scan
  const regexResults = regexScan(text);

  // Step 2: LLM scan for texts with PII or longer texts
  if (regexResults.length > 0 || text.length > 200) {
    const llmResult = await callLLMForPII(text);
    const merged = mergeResults(regexResults, llmResult.items || []);
    const sanitized = applyReplacements(text, merged);

    return {
      pii_detected: merged.length > 0,
      items: merged,
      sanitized_text: sanitized,
    };
  }

  // Short text with no regex hits → skip LLM
  if (regexResults.length > 0) {
    const sanitized = applyReplacements(text, regexResults);
    return { pii_detected: true, items: regexResults, sanitized_text: sanitized };
  }

  return { pii_detected: false, items: [], sanitized_text: text };
}

// ─── Logging ────────────────────────────────────────────────────

async function logPII(
  clientId: string | null,
  result: PIIScanResult,
  context?: string
) {
  try {
    const supabase = getServiceClient();
    // Log each PII type separately for analytics
    const categories = [...new Set(result.items.map((i) => i.category))];
    for (const cat of categories) {
      const count = result.items.filter((i) => i.category === cat).length;
      await supabase.from("pii_logs").insert({
        client_id: clientId,
        pii_type: cat,
        items_count: count,
        categories: [cat],
        context,
      });
    }
  } catch (e) {
    console.error("Failed to log PII:", e);
  }
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, text, texts, data, context, client_id } = body;

    // Support "scan" action with "data" array (used by upload pipeline)
    if (action === "scan" && Array.isArray(data)) {
      const allTexts: string[] = data.map((item: Record<string, unknown>) => {
        return Object.values(item)
          .filter((v) => typeof v === "string")
          .join(" ");
      });

      const results: PIIScanResult[] = [];
      for (let i = 0; i < allTexts.length; i += 10) {
        const batch = allTexts.slice(i, i + 10);
        const batchResults = await Promise.all(batch.map((t) => scanText(t)));
        results.push(...batchResults);
      }

      const totalPII = results.filter((r) => r.pii_detected).length;
      if (totalPII > 0) {
        await logPII(client_id || null, {
          pii_detected: true,
          items: results.flatMap((r) => r.items),
          sanitized_text: "",
        }, context || "upload_scan");
      }

      return new Response(
        JSON.stringify({
          total_scanned: results.length,
          pii_detected_count: totalPII,
          results,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "scan_single": {
        if (!text) {
          return new Response(
            JSON.stringify({ error: "Le champ 'text' est obligatoire" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await scanText(text);
        if (result.pii_detected) {
          await logPII(client_id || null, result, context);
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "scan_batch": {
        if (!texts || !Array.isArray(texts)) {
          return new Response(
            JSON.stringify({ error: "Le champ 'texts' est obligatoire (array)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const batchSize = 10;
        const results: PIIScanResult[] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map((t: string) => scanText(t))
          );
          results.push(...batchResults);
        }

        const totalPII = results.filter((r) => r.pii_detected).length;

        if (totalPII > 0) {
          await logPII(client_id || null, {
            pii_detected: true,
            items: results.flatMap((r) => r.items),
            sanitized_text: "",
          }, context);
        }

        return new Response(
          JSON.stringify({
            total_scanned: results.length,
            pii_detected_count: totalPII,
            results,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Action inconnue. Utilisez 'scan_single', 'scan_batch', ou 'scan'" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("[scan-pii] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

export { scanText };
export type { PIIScanResult, PIIItem };
