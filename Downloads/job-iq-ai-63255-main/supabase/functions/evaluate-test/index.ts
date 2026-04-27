import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to get RLHF feedback examples for test evaluation
async function getRLHFFeedback(supabase: any, limit: number = 5): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("ai_feedback")
      .select("input_context, ai_output, is_positive, human_correction")
      .eq("function_name", "evaluate-test")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) return "";

    const positiveExamples = data.filter((e: any) => e.is_positive);
    const negativeExamples = data.filter((e: any) => !e.is_positive);

    let rlhfSection = "\n\n--- APPRENTISSAGE RLHF ---\n";
    
    if (positiveExamples.length > 0) {
      rlhfSection += "\nÉvaluations APPROUVÉES par les admins:\n";
      positiveExamples.slice(0, 2).forEach((ex: any, i: number) => {
        const score = ex.ai_output?.score;
        rlhfSection += `${i + 1}. Score ${score}% - Évaluation validée\n`;
      });
    }

    if (negativeExamples.length > 0) {
      rlhfSection += "\nÉvaluations CORRIGÉES par les admins:\n";
      negativeExamples.slice(0, 2).forEach((ex: any, i: number) => {
        const score = ex.ai_output?.score;
        rlhfSection += `${i + 1}. Score IA: ${score}%\n`;
        if (ex.human_correction) {
          rlhfSection += `   → Correction admin: "${ex.human_correction}"\n`;
        }
      });
    }

    rlhfSection += "\nUtilise ces exemples pour améliorer la précision de tes évaluations.\n";
    rlhfSection += "--- FIN RLHF ---\n";

    console.log("RLHF loaded:", positiveExamples.length, "positive,", negativeExamples.length, "negative");
    return rlhfSection;
  } catch (e) {
    console.error("Error loading RLHF:", e);
    return "";
  }
}
// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests: number): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxRequests;
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
    // Authentication: verify user owns the expert_id
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
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authenticatedUserId = claimsData.claims.sub;

    const InputSchema = z.object({
      test_id: z.string().uuid(),
      expert_id: z.string().uuid(),
      job_offer_id: z.string().uuid().optional(),
      answers: z.array(z.object({ answer: z.string().max(10000).optional() })).min(1).max(20),
      time_taken_seconds: z.number().int().min(0).max(36000).optional(),
      cheat_indicators: z.object({
        tab_switches: z.number().int().min(0).optional(),
        copy_attempts: z.number().int().min(0).optional(),
        paste_attempts: z.number().int().min(0).optional(),
        right_click_attempts: z.number().int().min(0).optional(),
        blocked_shortcuts: z.number().int().min(0).optional(),
        fullscreen_exits: z.number().int().min(0).optional(),
        time_away: z.number().min(0).optional(),
        drag_drop_attempts: z.number().int().min(0).optional(),
        devtools_open_count: z.number().int().min(0).optional(),
        mouse_exits: z.number().int().min(0).optional(),
        window_resizes: z.number().int().min(0).optional(),
        risk_score: z.number().min(0).max(100).optional(),
        keystroke_analysis: z.object({
          total_keystrokes: z.number().int().min(0).optional(),
          avg_typing_speed: z.number().min(0).optional(),
          max_typing_speed: z.number().min(0).optional(),
          long_pauses: z.number().int().min(0).optional(),
          very_fast_bursts: z.number().int().min(0).optional(),
          typing_rhythm_variance: z.number().min(0).max(1).optional(),
          backspace_ratio: z.number().min(0).max(1).optional(),
          paste_like_bursts: z.number().int().min(0).optional(),
        }).optional(),
      }).optional(),
      auto_submitted: z.boolean().optional(),
    });
    const rawBody = await req.json();
    const parseResult = InputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Données invalides", details: parseResult.error.issues.map(i => i.message) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { test_id, expert_id, job_offer_id, answers, time_taken_seconds, cheat_indicators, auto_submitted } = parseResult.data;
    
    console.log("Evaluating test:", test_id);
    console.log("Expert:", expert_id);
    console.log("Job offer:", job_offer_id);
    console.log("Answers count:", answers?.length);
    console.log("Time taken:", time_taken_seconds, "seconds");
    console.log("Cheat indicators:", cheat_indicators);

    // Validate required fields
    if (!test_id || !expert_id || !answers) {
      return new Response(JSON.stringify({ 
        error: "Paramètres manquants: test_id, expert_id et answers sont requis" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify expert_id belongs to authenticated user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: expertCheck } = await supabase
      .from("expert_profiles")
      .select("id")
      .eq("id", expert_id)
      .eq("user_id", authenticatedUserId)
      .single();
    
    if (!expertCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden - expert_id does not belong to you' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ANTI-SPAM: Validate minimum time (2 minutes = 120 seconds)
    // Skip this check for auto-submitted tests (abandoned sessions)
    const MIN_TIME_SECONDS = 120;
    if (!auto_submitted && time_taken_seconds && time_taken_seconds < MIN_TIME_SECONDS) {
      console.log(`Rejected submission: time ${time_taken_seconds}s < ${MIN_TIME_SECONDS}s minimum`);
      return new Response(JSON.stringify({ 
        error: `Temps de test insuffisant. Minimum requis: ${Math.floor(MIN_TIME_SECONDS / 60)} minutes.`,
        code: "MIN_TIME_NOT_MET"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (auto_submitted) {
      console.log("Auto-submitted test (abandoned session) - skipping MIN_TIME check");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get test questions from database (supabase client already created above)

    const { data: testData, error: testError } = await supabase
      .from("technical_tests")
      .select("*")
      .eq("id", test_id)
      .single();

    if (testError || !testData) {
      console.error("Test not found:", testError);
      return new Response(JSON.stringify({ error: "Test non trouvé" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questions = testData.questions;
    console.log("Questions loaded:", questions);

    // Get RLHF feedback
    const rlhfFeedback = await getRLHFFeedback(supabase, 5);

    // Create evaluation prompt with reasoning/comment criteria
    const systemPrompt = `Tu es un évaluateur technique expert mais bienveillant. Tu dois évaluer les réponses d'un candidat à un test technique.

RÈGLES D'ÉVALUATION:
- Sois juste et constructif dans ton évaluation
- Attribue un score de 0 à max_points pour chaque question
- Même une réponse partielle mérite des points si elle montre une compréhension
- Si la réponse est vide, donne 0 points mais un feedback encourageant
- Justifie chaque score avec des commentaires constructifs
- Identifie les points forts et axes d'amélioration

⚠️ CRITÈRES D'ÉVALUATION DU RAISONNEMENT ET COMMENTAIRES:
- Un raisonnement solide avec code partiel > code fonctionnel sans explication
- Le code non commenté doit recevoir une pénalité de -20% sur le score
- Évalue la qualité des commentaires et explications selon ces poids:
  * Code quality: 50%
  * Reasoning quality: 25%  
  * Comment completeness: 15%
  * Decision justification: 10%

SCORING SPÉCIAL:
- Code parfait SANS explication = max 50% du score
- Raisonnement solide avec code partiel = jusqu'à 75% du score
- Code commenté ET expliqué = 100% du score possible

FORMAT DE RÉPONSE JSON:
{
  "evaluations": [
    {
      "question_id": 1,
      "score": 15,
      "max_score": 20,
      "code_score": 10,
      "reasoning_score": 5,
      "has_explanation": true,
      "has_inline_comments": true,
      "feedback": "Commentaire détaillé sur la réponse",
      "strengths": ["point fort 1"],
      "improvements": ["amélioration suggérée 1"],
      "plagiarism_detected": false,
      "comment_analysis": {
        "approach_explained": true,
        "functions_commented": 3,
        "decisions_justified": 2,
        "reasoning_quality": 4,
        "comment_quality": 3,
        "explanation_depth": 4
      }
    }
  ],
  "total_score": 75,
  "max_total_score": 100,
  "percentage": 75,
  "overall_feedback": "Évaluation globale du candidat - sois encourageant même si le score est bas",
  "skill_assessment": {
    "niveau_global": "débutant/intermédiaire/avancé/expert"
  },
  "reasoning_assessment": {
    "overall_reasoning_quality": 4,
    "overall_comment_quality": 3,
    "overall_explanation_depth": 4,
    "has_systematic_approach": true,
    "justifies_decisions": true
  },
  "recommendation": "hire" | "maybe" | "no_hire",
  "fraud_analysis": {
    "suspicious": false,
    "reasons": []
  }
}
${rlhfFeedback}`;

    // Build questions and answers for evaluation
    const qaForEvaluation = questions.questions.map((q: any, index: number) => ({
      question_id: q.id,
      question: q.question,
      type: q.type,
      max_points: q.max_points,
      evaluation_criteria: q.evaluation_criteria,
      candidate_answer: answers[index]?.answer || "(Pas de réponse fournie)"
    }));

    const userPrompt = `Évalue les réponses suivantes:

TEST INFO:
- Difficulté: ${testData.difficulty}
- Temps prévu: ${questions.estimated_duration_minutes} minutes
- Temps réel: ${Math.round(time_taken_seconds / 60)} minutes

QUESTIONS ET RÉPONSES:
${JSON.stringify(qaForEvaluation, null, 2)}

INDICATEURS DE TRICHE:
- Changements d'onglet: ${cheat_indicators?.tab_switches || 0}
- Tentatives de copie: ${cheat_indicators?.copy_attempts || 0}
- Tentatives de coller: ${cheat_indicators?.paste_attempts || 0}
- Tentatives clic droit: ${cheat_indicators?.right_click_attempts || 0}
- Raccourcis bloqués: ${cheat_indicators?.blocked_shortcuts || 0}
- Sorties plein écran: ${cheat_indicators?.fullscreen_exits || 0}
- Temps hors focus: ${cheat_indicators?.time_away || 0} secondes
- Tentatives drag-and-drop: ${cheat_indicators?.drag_drop_attempts || 0}
- Ouvertures DevTools détectées: ${cheat_indicators?.devtools_open_count || 0}
- Sorties curseur (mouse leave): ${cheat_indicators?.mouse_exits || 0}
- Redimensionnements fenêtre: ${cheat_indicators?.window_resizes || 0}
- Score de risque agrégé client: ${cheat_indicators?.risk_score || 0}/100

ANALYSE DES PATTERNS DE FRAPPE:
- Total frappes clavier: ${cheat_indicators?.keystroke_analysis?.total_keystrokes || 0}
- Vitesse moyenne: ${cheat_indicators?.keystroke_analysis?.avg_typing_speed || 0} caractères/min
- Vitesse max: ${cheat_indicators?.keystroke_analysis?.max_typing_speed || 0} caractères/min
- Pauses longues (>30s): ${cheat_indicators?.keystroke_analysis?.long_pauses || 0}
- Bursts très rapides (suspect si >600/min): ${cheat_indicators?.keystroke_analysis?.very_fast_bursts || 0}
- Variance du rythme (0-1, bas = robotique): ${cheat_indicators?.keystroke_analysis?.typing_rhythm_variance || 0}
- Ratio backspace: ${cheat_indicators?.keystroke_analysis?.backspace_ratio || 0} (0.05-0.15 = normal)
- Insertions massives (type coller): ${cheat_indicators?.keystroke_analysis?.paste_like_bursts || 0}

ANALYSE DE FRAUDE À EFFECTUER:
- Un ratio backspace < 0.03 ou > 0.3 est suspect (trop parfait ou trop d'erreurs)
- Une variance de rythme < 0.2 suggère un comportement robotique
- Beaucoup de bursts très rapides + peu de backspaces = copié-collé probable
- DevTools ouverts = probable consultation de sources externes
- Drag-and-drop = tentative de contourner le blocage du coller
- Score de risque > 50 = comportement très suspect, > 20 = modéré
- Combiner tous ces indicateurs pour déterminer si le comportement est suspect

Évalue chaque réponse et fournis une analyse complète. Sois juste mais bienveillant.`;

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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez" }), {
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
    
    console.log("AI Evaluation response:", content);

    // Parse evaluation result - robust JSON extraction
    let evaluation;
    try {
      // First try: extract JSON object by bracket matching (handles ``` inside string values)
      const extractFirstJsonObject = (input: string): string | null => {
        const start = input.indexOf("{");
        if (start === -1) return null;
        let inString = false;
        let escaped = false;
        let depth = 0;
        for (let i = start; i < input.length; i++) {
          const c = input[i];
          if (inString) {
            if (escaped) { escaped = false; continue; }
            if (c === "\\") { escaped = true; continue; }
            if (c === '"') { inString = false; continue; }
            continue;
          }
          if (c === '"') { inString = true; continue; }
          if (c === "{") { depth += 1; continue; }
          if (c === "}") { depth -= 1; if (depth === 0) return input.slice(start, i + 1); }
        }
        return null;
      };

      // Normalize raw newlines inside JSON strings
      const normalizeJsonString = (input: string): string => {
        let out = "";
        let inStr = false;
        let esc = false;
        for (let i = 0; i < input.length; i++) {
          const c = input[i];
          if (inStr) {
            if (esc) { out += c; esc = false; continue; }
            if (c === "\\") { out += c; esc = true; continue; }
            if (c === '"') { out += c; inStr = false; continue; }
            if (c === "\n") { out += "\\n"; continue; }
            if (c === "\r") continue;
            if (c === "\t") { out += "\\t"; continue; }
            out += c;
          } else {
            if (c === '"') { out += c; inStr = true; continue; }
            out += c;
          }
        }
        return out;
      };

      let jsonString = extractFirstJsonObject(content);
      if (!jsonString) {
        // Fallback: try regex
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        jsonString = jsonMatch ? jsonMatch[1] : content;
      }
      jsonString = normalizeJsonString(jsonString.trim());
      evaluation = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Content preview:", content?.substring(0, 500));
      return new Response(JSON.stringify({ 
        error: "Erreur lors de l'évaluation, veuillez réessayer" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate final score (0-100)
    const testScore = evaluation.percentage || Math.round((evaluation.total_score / evaluation.max_total_score) * 100);

    // Save submission to database - using expert_id directly (not candidate_id)
    const { data: submission, error: saveError } = await supabase
      .from("test_submissions")
      .insert({
        test_id: test_id,
        job_offer_id: job_offer_id || null,
        expert_id: expert_id,
        answers: answers,
        test_score: testScore,
        final_score: testScore,
        feedback: evaluation,
        cheat_indicators: cheat_indicators || {},
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error("Database save error:", saveError);
      // If it's a duplicate submission error, return friendly message
      if (saveError.code === '23505') {
        return new Response(JSON.stringify({ 
          error: "Vous avez déjà soumis ce test" 
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw saveError;
    }

    // Update job application status if applicable
    if (job_offer_id) {
      const { error: updateError } = await supabase
        .from("job_applications")
        .update({
          status: testScore >= 60 ? "test_passed" : "test_failed",
          updated_at: new Date().toISOString()
        })
        .eq("job_offer_id", job_offer_id)
        .eq("expert_id", expert_id);

      if (updateError) {
        console.log("Could not update application status:", updateError);
      }
    }

    console.log("Submission saved:", submission.id);
    console.log("Final score:", testScore);

    // ===== AUTO-CERTIFICATION IF SCORE >= 80% =====
    let certificationId = null;
    let certificateId = null;
    
    if (testScore >= 80) {
      console.log("Score >= 80%, issuing automatic certification...");
      
      try {
        // Get expert profile data
        const { data: expertProfile, error: profileError } = await supabase
          .from("expert_profiles")
          .select("user_id, full_name, country, title")
          .eq("id", expert_id)
          .single();

        if (profileError || !expertProfile) {
          console.error("Could not fetch expert profile:", profileError);
        } else {
          // Get job offer title if available
          let roleTitle = expertProfile.title || "Technical Assessment";
          
          if (job_offer_id) {
            const { data: jobData } = await supabase
              .from("job_offers")
              .select("title")
              .eq("id", job_offer_id)
              .single();
            
            if (jobData?.title) {
              roleTitle = jobData.title;
            }
          }

          // Determine level based on score
          let level: 'associate' | 'professional' | 'expert' = 'associate';
          if (testScore >= 95) {
            level = 'expert';
          } else if (testScore >= 85) {
            level = 'professional';
          }

          // Parse name
          const nameParts = (expertProfile.full_name || "Candidat Anonyme").split(" ");
          const firstName = nameParts[0] || "Candidat";
          const lastName = nameParts.slice(1).join(" ") || "Anonyme";

          // Extract track from role title (simplified)
          const track = roleTitle.toLowerCase().includes("data") ? "DATA" 
            : roleTitle.toLowerCase().includes("devops") ? "OPS"
            : roleTitle.toLowerCase().includes("mobile") ? "MOB"
            : roleTitle.toLowerCase().includes("front") ? "FE"
            : roleTitle.toLowerCase().includes("back") ? "BE"
            : roleTitle.toLowerCase().includes("full") ? "FS"
            : "DEV";

          // Generate certificate ID using the database function
          const { data: certIdData, error: certIdError } = await supabase.rpc(
            'generate_certificate_id',
            { 
              p_country_code: (expertProfile.country || 'XX').substring(0, 2).toUpperCase(),
              p_track: track
            }
          );

          if (certIdError) {
            console.error("Error generating certificate ID:", certIdError);
          } else {
            certificateId = certIdData;
            
            // Calculate validity (24 months)
            const validUntil = new Date();
            validUntil.setMonth(validUntil.getMonth() + 24);

            // Insert certification
            const { data: certData, error: certError } = await supabase
              .from("certifications")
              .insert({
                certificate_id: certificateId,
                user_id: expertProfile.user_id,
                expert_id: expert_id,
                first_name: firstName,
                last_name: lastName,
                country: expertProfile.country,
                role_title: roleTitle,
                level: level,
                score: testScore,
                assessment_name: testData.difficulty + " Technical Test",
                valid_until: validUntil.toISOString(),
                status: 'valid'
              })
              .select()
              .single();

            if (certError) {
              console.error("Error creating certification:", certError);
            } else {
              certificationId = certData.id;
              console.log("Certification created:", certificateId);

              // Log the issue event
              await supabase.from("certificate_events").insert({
                certification_id: certificationId,
                event_type: "issued"
              });

              // Sign the certificate
              try {
                const signingSecret = Deno.env.get("SIGNING_SECRET");
                if (signingSecret) {
                  const signedPayload = [
                    certificateId,
                    firstName,
                    lastName,
                    roleTitle,
                    level,
                    testScore.toString(),
                    certData.issued_at,
                    validUntil.toISOString(),
                    'valid'
                  ].join('|');

                  const encoder = new TextEncoder();
                  const keyData = encoder.encode(signingSecret);
                  const messageData = encoder.encode(signedPayload);

                  const cryptoKey = await crypto.subtle.importKey(
                    'raw',
                    keyData,
                    { name: 'HMAC', hash: 'SHA-256' },
                    false,
                    ['sign']
                  );

                  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
                  const hashArray = Array.from(new Uint8Array(signature));
                  const signatureHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

                  await supabase
                    .from("certifications")
                    .update({
                      signature_hash: signatureHash,
                      signed_at: new Date().toISOString()
                    })
                    .eq("id", certificationId);

                  console.log("Certificate signed successfully");
                }
              } catch (signError) {
                console.error("Error signing certificate:", signError);
              }

              // Create notification for the expert
              await supabase.from("notifications").insert({
                user_id: expertProfile.user_id,
                title: "🎉 Certification obtenue !",
                message: `Félicitations ! Vous avez obtenu la certification ${roleTitle} avec un score de ${testScore}%`,
                type: "success",
                link: `/expert/certifications/${certificateId}`
              });

              // Send congratulation email
              try {
                const siteUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '') || 'https://steftalent.fr';
                const certUrl = `https://steftalent.fr/verify/${certificateId}`;

                // Render and enqueue test success email
                const { renderAsync } = await import('npm:@react-email/components@0.0.22');
                const React = await import('npm:react@18.3.1');
                const { TestSuccessEmail } = await import('../_shared/email-templates/test-success.tsx');

                const emailProps = {
                  recipientName: firstName || expertProfile.full_name.split(' ')[0],
                  assessmentName: testData.difficulty + " Technical Test — " + roleTitle,
                  score: testScore,
                  level: level,
                  certificateId: certificateId,
                  certificateUrl: certUrl,
                  siteUrl: 'https://steftalent.fr',
                };

                const html = await renderAsync(React.createElement(TestSuccessEmail, emailProps));
                const text = await renderAsync(React.createElement(TestSuccessEmail, emailProps), { plainText: true });

                const messageId = crypto.randomUUID();
                await supabase.from('email_send_log').insert({
                  message_id: messageId,
                  template_name: 'test_success',
                  recipient_email: expertProfile.email,
                  status: 'pending',
                });

                const levelEmoji = level === 'platinum' ? '💎' : level === 'gold' ? '🥇' : level === 'silver' ? '🥈' : '🥉';
                await supabase.rpc('enqueue_email', {
                  queue_name: 'transactional_emails',
                  payload: {
                    message_id: messageId,
                    to: expertProfile.email,
                    from: 'STEF <noreply@steftalent.fr>',
                    sender_domain: 'notify.steftalent.fr',
                    subject: `${levelEmoji} Félicitations ${firstName} ! Attestation ${level.toUpperCase()} obtenue — ${testScore}%`,
                    html,
                    text,
                    purpose: 'transactional',
                    label: 'test_success',
                    queued_at: new Date().toISOString(),
                  },
                });
                console.log("Test success email enqueued for", expertProfile.email);
              } catch (emailError) {
                console.error("Error sending test success email:", emailError);
              }
            }
          }
        }
      } catch (certifyError) {
        console.error("Error in auto-certification process:", certifyError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      submission_id: submission.id,
      score: testScore,
      evaluation: evaluation,
      recommendation: evaluation.recommendation,
      certification: testScore >= 80 ? {
        issued: !!certificationId,
        certificate_id: certificateId,
        certification_id: certificationId
      } : null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in evaluate-test:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erreur lors de l'évaluation" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
