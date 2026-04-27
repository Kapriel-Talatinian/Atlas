import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// System prompts for each function for fine-tuning context
const SYSTEM_PROMPTS: Record<string, string> = {
  "evaluate-test": `Tu es un évaluateur technique expert et bienveillant. Tu dois évaluer les réponses d'un candidat à un test technique de manière juste et constructive.

RÈGLES D'ÉVALUATION:
- Sois juste et constructif
- Attribue un score de 0 à max_points pour chaque question
- Même une réponse partielle mérite des points si elle montre une compréhension
- Justifie chaque score avec des commentaires constructifs
- Identifie les points forts et axes d'amélioration`,

  "match-experts": `Tu es un système de matching expert pour une ESN. Tu dois évaluer la compatibilité entre des experts et une offre d'emploi.

CRITÈRES D'ÉVALUATION (par ordre d'importance):
1. Compétences techniques (40%) - Match exact des skills requis
2. Score test IA (25%) - Experts avec score ≥80 sont "Vérifiés IA"
3. Expérience (15%) - Années d'expérience pertinentes
4. Disponibilité (10%) - Immédiat > 2 semaines > 1 mois
5. Budget (10%) - TJM dans le budget si spécifié`,

  "match-jobs": `Tu es un système de recommandation d'emplois pour experts tech. Tu dois analyser les compétences d'un expert et matcher avec les offres disponibles.

CRITÈRES:
- Correspondance des compétences techniques principales
- Niveau d'expérience adapté
- Préférences de travail (remote, hybride, présentiel)
- Budget/TJM compatible`,

  "generate-test": `Tu es un générateur de tests techniques pour évaluer des candidats. Tu dois créer des questions pertinentes et progressives adaptées au niveau et aux compétences recherchées.

RÈGLES:
- 5 questions par test
- Mix de questions théoriques et pratiques
- Difficulté progressive
- Temps estimé réaliste`,

  "chat-support": `Tu es un assistant support pour une plateforme de mise en relation entre experts tech et entreprises. Tu aides les utilisateurs avec leurs questions sur la plateforme.

TON:
- Professionnel mais amical
- Réponses concises et utiles
- Redirection vers les bonnes ressources si nécessaire`
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication: Admin only
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin role
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ExportSchema = z.object({
      format: z.enum(["jsonl", "csv", "json"]).default("jsonl"),
      function_name: z.string().max(50).optional(),
      limit: z.number().int().min(1).max(10000).default(1000),
      only_corrected: z.boolean().default(false),
    });
    const rawBody = await req.json();
    const parseResult = ExportSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Données invalides", details: parseResult.error.issues.map(i => i.message) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { format, function_name, limit, only_corrected } = parseResult.data;
    
    console.log("Exporting RLHF data:", { format, function_name, limit, only_corrected });

    // Build query
    let query = supabase
      .from("ai_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (function_name && function_name !== "all") {
      query = query.eq("function_name", function_name);
    }

    if (only_corrected) {
      query = query.not("human_correction", "is", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        count: 0,
        data: "",
        message: "Aucune donnée à exporter"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${data.length} feedback records`);

    let exportData: string;
    let contentType: string;
    let filename: string;

    if (format === "jsonl") {
      // Format JSONL pour fine-tuning Mistral/OpenAI
      const lines = data.map(feedback => {
        const systemPrompt = SYSTEM_PROMPTS[feedback.function_name] || 
          "Tu es un assistant IA utile et professionnel.";

        const messages = [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: typeof feedback.input_context === 'string' 
              ? feedback.input_context 
              : JSON.stringify(feedback.input_context)
          },
          {
            role: "assistant",
            content: feedback.is_positive === false && feedback.human_correction
              ? feedback.human_correction
              : typeof feedback.ai_output === 'string'
                ? feedback.ai_output
                : JSON.stringify(feedback.ai_output)
          }
        ];

        return JSON.stringify({ messages });
      });

      exportData = lines.join("\n");
      contentType = "application/jsonl";
      filename = `rlhf-training-${new Date().toISOString().split('T')[0]}.jsonl`;
    } else if (format === "csv") {
      // Format CSV pour analyse
      const headers = [
        "id",
        "function_name",
        "is_positive",
        "human_rating",
        "has_correction",
        "created_at"
      ];

      const rows = data.map(f => [
        f.id,
        f.function_name,
        f.is_positive === null ? "" : f.is_positive.toString(),
        f.human_rating || "",
        f.human_correction ? "true" : "false",
        f.created_at
      ]);

      exportData = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      contentType = "text/csv";
      filename = `rlhf-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      // Format JSON complet
      exportData = JSON.stringify(data, null, 2);
      contentType = "application/json";
      filename = `rlhf-full-${new Date().toISOString().split('T')[0]}.json`;
    }

    // Stats
    const stats = {
      total: data.length,
      positive: data.filter(f => f.is_positive === true).length,
      negative: data.filter(f => f.is_positive === false).length,
      with_corrections: data.filter(f => f.human_correction).length,
      by_function: {} as Record<string, number>
    };

    data.forEach(f => {
      stats.by_function[f.function_name] = (stats.by_function[f.function_name] || 0) + 1;
    });

    console.log("Export stats:", stats);

    return new Response(JSON.stringify({ 
      success: true,
      count: data.length,
      stats,
      format,
      filename,
      data: exportData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in export-rlhf:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erreur lors de l'export" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
