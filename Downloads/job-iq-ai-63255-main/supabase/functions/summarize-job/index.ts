import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Rate limiter
const _rl = new Map<string, { c: number; r: number }>();
function checkRateLimit(ip: string, max: number, windowMs = 60000): boolean {
  const now = Date.now(); const e = _rl.get(ip);
  if (!e || now > e.r) { _rl.set(ip, { c: 1, r: now + windowMs }); return true; }
  if (e.c >= max) return false; e.c++; return true;
}
function sanitizeForAI(input: string, maxLen = 10000): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/###\s*(?:System|User|Assistant)\s*:/gi, '').replace(/(?:ignore|forget|disregard)\s+(?:previous|above|all)\s+instructions/gi, '[FILTERED]').slice(0, maxLen);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIp, 10)) {
    return new Response(JSON.stringify({ error: "Trop de requêtes" }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  try {
    // === Body size check ===
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 100_000) {
      return new Response(JSON.stringify({ error: 'Request too large' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Authentication ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    // Role check: expert, company, or admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from('user_roles').select('role')
      .eq('user_id', userId);
    
    const roles = roleData?.map(r => r.role) || [];
    if (!roles.some(r => ['admin', 'expert', 'company'].includes(r))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Business Logic ===
    const SummarizeSchema = z.object({
      job_id: z.string().uuid().optional(),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(10000),
      update_db: z.boolean().default(true),
    });
    const rawBody = await req.json();
    const parseResult = SummarizeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Données invalides", details: parseResult.error.issues.map(i => i.message) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { job_id, title, description, update_db } = parseResult.data;
    
    console.log("Summarizing job:", title);

    const safeTitle = sanitizeForAI(title, 200);
    const safeDescription = sanitizeForAI(description, 10000);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un expert RH spécialisé dans la rédaction d'offres d'emploi tech. Tu dois analyser une offre d'emploi et créer un résumé structuré.

RÈGLES:
- Analyse le titre et la description pour extraire les informations clés
- Génère un résumé concis mais complet
- Identifie les compétences obligatoires (need to have) et souhaitables (nice to have)
- Les responsabilités doivent être claires et actionables
- Adapte le contenu au niveau du poste (junior, senior, lead, etc.)
- Tout doit être en français

FORMAT JSON REQUIS:
{
  "summary": "Résumé de 2-3 phrases décrivant le poste et son contexte",
  "min_rate": 50,
  "max_rate": 100,
  "work_type": "Remote" | "Hybrid" | "On-site",
  "location": "Localisation",
  "duration": "Type de contrat",
  "responsibilities": ["Responsabilité 1","Responsabilité 2","Responsabilité 3","Responsabilité 4","Responsabilité 5"],
  "need_to_have": ["Compétence obligatoire 1","Compétence obligatoire 2","Compétence obligatoire 3","Compétence obligatoire 4","Compétence obligatoire 5"],
  "good_to_have": ["Compétence souhaitée 1","Compétence souhaitée 2","Compétence souhaitée 3"],
  "keywords": ["mot-clé1", "mot-clé2", "mot-clé3"]
}`;

    const userPrompt = `Analyse cette offre d'emploi et génère un résumé structuré:\n\nTITRE: ${safeTitle}\n\nDESCRIPTION:\n${safeDescription}\n\nGénère un JSON avec le résumé, les responsabilités, les compétences requises (need_to_have) et souhaitées (good_to_have).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    let jobSummary;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      jobSummary = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return new Response(JSON.stringify({ error: "Erreur lors de l'analyse, veuillez réessayer" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (update_db && job_id) {
      const { error: updateError } = await supabase
        .from("job_offers")
        .update({ description: jobSummary.summary || description, requirements: jobSummary })
        .eq("id", job_id);
      if (updateError) console.error("Database update error:", updateError);
    }

    return new Response(JSON.stringify({ success: true, summary: jobSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in summarize-job:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
