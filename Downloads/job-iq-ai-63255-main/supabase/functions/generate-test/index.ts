import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Makes the model output far more parseable by escaping raw newlines that sometimes
// appear inside quoted strings (illegal in JSON).
function normalizeJsonString(input: string) {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (inString) {
      if (escaped) {
        out += c;
        escaped = false;
        continue;
      }

      if (c === "\\") {
        out += c;
        escaped = true;
        continue;
      }

      if (c === '"') {
        out += c;
        inString = false;
        continue;
      }

      // Critical: raw newlines inside strings break JSON.parse
      if (c === "\n") {
        out += "\\n";
        continue;
      }
      if (c === "\r") {
        continue;
      }
      if (c === "\t") {
        out += "\\t";
        continue;
      }

      out += c;
    } else {
      if (c === '"') {
        out += c;
        inString = true;
        continue;
      }
      out += c;
    }
  }

  return out;
}

// Extract the first full JSON object from a string, even if the response contains
// markdown fences or backticks inside JSON string values.
function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  if (start === -1) return null;

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = start; i < input.length; i++) {
    const c = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === "\\") {
        escaped = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === "{") {
      depth += 1;
      continue;
    }

    if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  return null;
}
// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests: number): boolean {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

// Sanitize user input before injecting into AI prompts
function sanitizeForAI(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove HTML-like tags
    .replace(/```/g, '')  // Remove code fences
    .trim()
    .slice(0, maxLength);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIp, 5)) {
    return new Response(JSON.stringify({ error: "Trop de requêtes" }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  try {
    // Authentication: verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrlAuth = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrlAuth, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const tokenStr = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(tokenStr);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const InputSchema = z.object({
      expert_id: z.string().uuid().optional(),
      job_offer_id: z.string().uuid().optional(),
      skills: z.array(z.string().max(100)).min(1).max(20),
      title: z.string().min(1).max(200),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
      job_description: z.string().max(10000).optional(),
    });
    const rawBody = await req.json();
    const parseResult = InputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Données invalides", details: parseResult.error.issues.map(i => i.message) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { expert_id, job_offer_id, skills, title, difficulty, job_description } = parseResult.data;
    
    console.log("Generating test for expert:", expert_id);
    console.log("Job offer ID:", job_offer_id);
    console.log("Skills:", skills);
    console.log("Title:", title);
    console.log("Difficulty:", difficulty);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client for profile validation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // RATE LIMITING: Check if expert has generated more than 3 tests in last 24 hours
    if (expert_id) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { count, error: countError } = await supabase
        .from("test_generation_logs")
        .select("*", { count: "exact", head: true })
        .eq("expert_id", expert_id)
        .gte("created_at", twentyFourHoursAgo);
      
      if (!countError && count !== null && count >= 3) {
        console.log("Rate limit exceeded for expert:", expert_id, "count:", count);
        return new Response(JSON.stringify({ 
          error: "Limite atteinte : vous ne pouvez générer que 3 tests par 24 heures. Réessayez plus tard.",
          rate_limited: true,
          remaining_tests: 0
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log("Rate limit check passed. Tests in last 24h:", count || 0);
    }

    // Validate expert profile completeness if expert_id is provided
    if (expert_id) {
      const { data: expertProfile, error: profileError } = await supabase
        .from("expert_profiles")
        .select("*")
        .eq("id", expert_id)
        .single();

      if (profileError || !expertProfile) {
        console.error("Expert profile not found:", profileError);
        return new Response(JSON.stringify({ 
          error: "Profil expert non trouvé",
          profile_incomplete: true,
          missing_fields: ["profile"]
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check for required fields to generate a meaningful test
      const missingFields: string[] = [];
      
      if (!expertProfile.title || expertProfile.title.trim() === '') {
        missingFields.push("title");
      }
      if (!expertProfile.primary_skills || expertProfile.primary_skills.length === 0) {
        missingFields.push("primary_skills");
      }
      if (!expertProfile.years_of_experience || expertProfile.years_of_experience < 0) {
        missingFields.push("years_of_experience");
      }
      if (!expertProfile.full_name || expertProfile.full_name.trim() === '') {
        missingFields.push("full_name");
      }

      // If profile is incomplete, return error with missing fields
      if (missingFields.length > 0) {
        console.log("Profile incomplete, missing fields:", missingFields);
        return new Response(JSON.stringify({ 
          error: "Votre profil est incomplet. Veuillez compléter les informations manquantes pour générer un test personnalisé.",
          profile_incomplete: true,
          missing_fields: missingFields,
          missing_fields_labels: {
            title: "Titre professionnel",
            primary_skills: "Compétences principales",
            years_of_experience: "Années d'expérience",
            full_name: "Nom complet"
          }
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Profile validated successfully:", expertProfile.full_name);
    }

    // Create prompt for test generation - more specific to job description
    // Randomize question type distribution to avoid repetitive tests
    const questionPatterns = [
      {
        name: "pattern_A",
        distribution: [
          { type: "DEBUGGING", desc: "Code avec 2-3 bugs subtils (race conditions, closures, off-by-one, memory leaks). Le candidat identifie ET corrige." },
          { type: "OPTIMISATION", desc: "Code fonctionnel mais inefficient. Optimiser avec contraintes (complexité, mémoire, latence)." },
          { type: "ARCHITECTURE", desc: "Concevoir un système (cache distribué, rate limiter, circuit breaker, event sourcing). Expliquer trade-offs." },
          { type: "CODE AVANCÉ", desc: "Implémenter une solution avec contraintes multiples (error handling, edge cases, typage, immutabilité)." },
          { type: "PROBLEM SOLVING", desc: "Scénario réaliste multi-étapes avec pipeline de transformation + validation + fallback." },
        ]
      },
      {
        name: "pattern_B",
        distribution: [
          { type: "REVIEW DE CODE", desc: "Analyser un PR/code review : identifier les problèmes de sécurité, performance, maintenabilité. Proposer des améliorations concrètes avec justifications." },
          { type: "REFACTORING", desc: "Transformer du code legacy/spaghetti en code propre. Appliquer des design patterns appropriés tout en préservant le comportement." },
          { type: "DEBUGGING PRODUCTION", desc: "Analyser des logs/stack traces/métriques d'un incident production. Identifier la root cause et proposer un fix + prévention." },
          { type: "CONCEPTION API", desc: "Designer une API (REST/GraphQL/gRPC) complète pour un use case réel. Gérer versioning, pagination, erreurs, auth, rate limiting." },
          { type: "TESTING & QUALITÉ", desc: "Écrire des tests (unit/integration/e2e) pour du code complexe. Identifier les edge cases critiques et la stratégie de test." },
        ]
      },
      {
        name: "pattern_C",
        distribution: [
          { type: "MIGRATION DE DONNÉES", desc: "Écrire un script de migration de schéma/données avec rollback, validation, et gestion des données corrompues." },
          { type: "CONCURRENCE & PARALLÉLISME", desc: "Résoudre un problème de concurrence (deadlock, race condition, starvation). Implémenter une solution thread-safe." },
          { type: "SÉCURITÉ", desc: "Auditer du code pour des vulnérabilités (injection SQL, XSS, CSRF, auth bypass). Proposer des corrections sécurisées." },
          { type: "PERFORMANCE PROFILING", desc: "Analyser un profil de performance (CPU/mémoire/I/O). Identifier les bottlenecks et optimiser sans régresser." },
          { type: "SYSTEM DESIGN", desc: "Concevoir l'architecture complète d'un système distribué. Gérer scaling, résilience, consistency, monitoring." },
        ]
      },
      {
        name: "pattern_D",
        distribution: [
          { type: "ALGORITHME APPLIQUÉ", desc: "Résoudre un problème algorithmique ancré dans un cas métier réel (scheduling, matching, routing, ranking). Pas de leetcode académique." },
          { type: "INTÉGRATION SYSTÈME", desc: "Intégrer plusieurs services/APIs avec gestion des erreurs, retries, circuit breakers, et fallbacks." },
          { type: "DEBUGGING AVANCÉ", desc: "Code avec un bug non-évident lié au langage (coercion, hoisting, floating point, timezone, encoding). Expliquer pourquoi." },
          { type: "MODÉLISATION DONNÉES", desc: "Concevoir un schéma de données (SQL/NoSQL) pour un domaine complexe. Gérer les relations, indexation, dénormalisation." },
          { type: "DEVOPS & INFRA AS CODE", desc: "Écrire/corriger une config (Docker, CI/CD, Terraform, K8s). Diagnostiquer un problème de déploiement." },
        ]
      },
    ];

    const selectedPattern = questionPatterns[Math.floor(Math.random() * questionPatterns.length)];
    console.log("Selected question pattern:", selectedPattern.name);

    const questionTypesBlock = selectedPattern.distribution
      .map((q, i) => `${i + 1}. ${q.type} : ${q.desc}`)
      .join("\n");

    const systemPrompt = `Tu es un architecte logiciel senior avec 15+ ans d'expérience dans des entreprises tech de premier plan. Tu dois générer un test technique EXIGEANT, VARIÉ et RÉALISTE qui évalue la GLOBALITÉ de l'expertise d'un candidat.

RÈGLES CRITIQUES:
- Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de \`\`\`, pas de texte autour)
- N'utilise JAMAIS \`\`\` dans aucun champ (même dans "context")
- Toutes les chaînes doivent être du JSON strict (les retours à la ligne doivent être encodés en \\n)
- Génère exactement 5 questions techniques
- Le test doit être RÉALISABLE en 30-45 minutes maximum
- Chaque question doit être claire et sans ambiguïté

NIVEAU DE DIFFICULTÉ - EXIGEANT:
Les questions doivent exiger une réflexion de niveau senior/staff. INTERDICTION ABSOLUE de :
- Fonctions triviales (tri, recherche, CRUD basique, fizzbuzz, palindrome, todo list)
- Questions purement académiques ou définitionnelles ("qu'est-ce que X ?")
- Implémentations de base sans contraintes réelles
- Questions génériques qui pourraient s'appliquer à n'importe quel poste

COUVERTURE GLOBALE DE L'EXPERTISE:
Le test doit évaluer TOUTES les dimensions d'un développeur complet :
- Capacité à lire et comprendre du code existant (pas juste écrire)
- Raisonnement sur les trade-offs (performance vs lisibilité, consistance vs disponibilité)
- Connaissance des patterns ET des anti-patterns
- Gestion des cas limites et des erreurs en production
- Vision systémique (pas juste des fonctions isolées)

TYPES DE QUESTIONS POUR CE TEST (distribution imposée):
${questionTypesBlock}

VARIÉTÉ OBLIGATOIRE:
- Chaque question doit tester une DIMENSION DIFFÉRENTE de l'expertise
- Varier les formats : code à corriger, code à écrire, analyse de code, conception, diagramme textuel
- Varier la taille : 1 question courte (5 min), 2 moyennes (7-8 min), 2 longues (10-12 min)
- Au moins 1 question doit fournir du code en contexte de 15+ lignes
- Au moins 1 question doit être un scénario narratif (situation réelle, pas un exercice abstrait)
- JAMAIS 2 questions qui testent la même compétence sous un angle différent

CONTRAINTES PAR QUESTION:
- Toujours inclure des edge cases à traiter
- Spécifier des contraintes de performance quand pertinent
- Les questions de code doivent inclure du contexte réaliste (pas de fonctions isolées)
- Le code fourni en contexte doit être réaliste (10-25 lignes), pas trivial
- Chaque question doit avoir des critères d'évaluation SPÉCIFIQUES et MESURABLES

⚠️ INSTRUCTIONS OBLIGATOIRES POUR LE CANDIDAT (à inclure dans chaque question de code):
- Expliquer brièvement son approche AVANT d'écrire le code
- Commenter chaque fonction et bloc important
- Justifier les décisions algorithmiques dans le code
- Le code non commenté sera pénalisé à l'évaluation

Format de réponse JSON (objet racine):
{
  "questions": [
    {
      "id": 1,
      "type": "theory" | "code" | "problem_solving" | "review" | "design",
      "category": "La catégorie parmi: ${selectedPattern.distribution.map(q => q.type).join(', ')}",
      "question": "Question claire et concise",
      "context": "Contexte ou code de départ si nécessaire (utiliser \\n pour les retours à la ligne)",
      "expected_skills": ["skill1", "skill2"],
      "max_points": 20,
      "evaluation_criteria": ["critère1", "critère2", "critère3"],
      "time_estimate_minutes": 5,
      "requires_explanation": true,
      "difficulty_tier": "medium" | "hard" | "expert",
      "scoring_weights": {
        "code_quality": 0.40,
        "reasoning": 0.30,
        "comments": 0.15,
        "edge_cases": 0.15
      }
    }
  ],
  "total_points": 100,
  "estimated_duration_minutes": 35,
  "pattern_used": "${selectedPattern.name}",
  "evaluation_guidelines": {
    "uncommented_code_penalty": -20,
    "partial_code_with_reasoning_max": 75,
    "perfect_code_no_explanation_max": 50,
    "edge_cases_bonus": 10
  }
}`;

    const userPrompt = `Génère un test technique de niveau ${difficulty} pour ce poste:

TITRE DU POSTE: ${sanitizeForAI(title, 200)}

COMPÉTENCES REQUISES: ${skills.map(s => sanitizeForAI(s, 100)).join(', ')}

${job_description ? `DESCRIPTION DU POSTE:\n${sanitizeForAI(job_description, 10000)}\n` : ''}

INSTRUCTIONS STRICTES:
- Les questions DOIVENT tester les compétences listées ci-dessus dans des scénarios réalistes de production
- Chaque question doit cibler une FACETTE DIFFÉRENTE du métier (pas 5 exercices de code similaires)
- Les scénarios doivent être tirés de situations RÉELLES qu'un ${sanitizeForAI(title, 200)} rencontrerait
- Le candidat doit pouvoir compléter le test en 35 minutes environ
- Les questions doivent être en français
- ÉVITER ABSOLUMENT: tri basique, CRUD, fizzbuzz, palindrome, fonctions utilitaires simples, questions "définissez X"
- PRIVILÉGIER: debugging subtil, code review critique, conception de systèmes, optimisation avec contraintes, incidents production, migration complexe

DISTRIBUTION DE DIFFICULTÉ:
- 1 question "medium" (accessible mais non triviale) — 15 points
- 2 questions "hard" (requiert une expertise solide) — 20 points chacune
- 2 questions "expert" (requiert une maîtrise avancée) — 22-23 points chacune

EXIGENCES DE COMMENTAIRES ET RAISONNEMENT:
Pour chaque question de code, ajoute explicitement dans l'énoncé:
"⚠️ IMPORTANT: Avant d'écrire votre code, expliquez brièvement votre approche en commentaires.
Commentez chaque fonction et justifiez vos choix algorithmiques.
Un raisonnement solide avec code partiel sera mieux noté qu'un code fonctionnel sans explication."`;

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
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques secondes" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("AI response missing content:", aiResponse);
      throw new Error("Erreur lors de la génération du test, veuillez réessayer");
    }

    console.log("AI Response content:", content);

    // Parse JSON from response - robust extraction (handles ``` inside string values)
    let testData;
    try {
      // Extract a full JSON object by bracket matching (ignores braces inside strings)
      let jsonString = extractFirstJsonObject(content);
      if (!jsonString) {
        throw new Error("No JSON object found in AI response");
      }

      jsonString = jsonString.trim();

      // Normalize illegal raw newlines inside quoted strings
      jsonString = normalizeJsonString(jsonString);

      console.log("Attempting to parse JSON string of length:", jsonString.length);
      testData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Content that failed to parse:", content.substring(0, 800));
      throw new Error("Erreur lors de la génération du test, veuillez réessayer");
    }

    // Save to database (supabase client already initialized above)

    const { data: savedTest, error: saveError } = await supabase
      .from("technical_tests")
      .insert({
        questions: testData,
        difficulty: difficulty,
        job_offer_id: job_offer_id || null
      })
      .select()
      .single();

    if (saveError) {
      console.error("Database save error:", saveError);
      throw saveError;
    }

    console.log("Test saved successfully:", savedTest.id);

    // Log this test generation for rate limiting
    if (expert_id) {
      await supabase
        .from("test_generation_logs")
        .insert({
          expert_id: expert_id,
          test_id: savedTest.id
        });
      console.log("Test generation logged for rate limiting");
    }

    return new Response(JSON.stringify({ 
      success: true,
      test_id: savedTest.id,
      test: testData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-test:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erreur inconnue" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});