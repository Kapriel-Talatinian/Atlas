import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// DOMAIN QCM PROMPTS
// ============================================================================

const QCM_PROMPTS: Record<string, string> = {
  medical: `Tu es un expert en évaluation des compétences médicales. Tu génères des questions QCM pour vérifier qu'une personne est capable d'évaluer les réponses d'un modèle IA sur des sujets médicaux.

Les questions doivent tester :
- La compréhension de la terminologie médicale courante
- La capacité à identifier une information médicale incorrecte ou dangereuse
- La connaissance des principes de base (anatomie, pharmacologie, diagnostic)
- La compréhension des enjeux de sécurité patient
- La capacité à distinguer un consensus médical d'une opinion controversée

Niveau : professionnel de santé ou étudiant avancé en médecine. Pas des questions triviales grand public.`,

  legal: `Tu es un expert en évaluation des compétences juridiques. Tu génères des questions QCM pour vérifier qu'une personne est capable d'évaluer les réponses d'un modèle IA sur des sujets juridiques.

Les questions doivent tester :
- La compréhension des concepts juridiques fondamentaux (droit civil, pénal, commercial, constitutionnel)
- La capacité à identifier un raisonnement juridique fallacieux
- La compréhension de la différence entre fait et qualification juridique
- La connaissance des principes de preuve et de procédure
- La capacité à identifier quand une réponse IA mélange des juridictions ou des branches du droit

Niveau : juriste diplômé ou étudiant avancé en droit. Pas des questions de culture générale.`,

  finance: `Tu es un expert en évaluation des compétences financières. Tu génères des questions QCM pour vérifier qu'une personne est capable d'évaluer les réponses d'un modèle IA sur des sujets financiers.

Les questions doivent tester :
- La compréhension des instruments financiers (actions, obligations, dérivés, options)
- La capacité à identifier une analyse financière incorrecte
- La connaissance des principes de valorisation et de risque
- La compréhension de la réglementation financière (MiFID, Bâle, AMF, SEC au niveau conceptuel)
- La capacité à repérer des erreurs de raisonnement quantitatif

Niveau : professionnel de la finance ou étudiant avancé (master finance, CFA candidat). Pas des questions de culture économique générale.`,

  code: `Tu es un expert en évaluation des compétences en développement logiciel. Tu génères des questions QCM pour vérifier qu'une personne est capable d'évaluer du code généré par un modèle IA.

Les questions doivent tester :
- La compréhension des paradigmes de programmation
- La capacité à identifier des bugs dans un snippet de code
- La connaissance des bonnes pratiques (sécurité, performance, maintenabilité)
- La compréhension de la complexité algorithmique
- La capacité à identifier des failles de sécurité courantes (injection SQL, XSS, mauvaise gestion des secrets)

Niveau : développeur avec 2+ ans d'expérience. Pas des questions pour débutants. Au moins 5 questions doivent inclure un snippet de code court (max 15 lignes).`,
};

// ============================================================================
// PHASE 2A — Technical evaluation prompt
// ============================================================================

const PHASE2A_PROMPT = (domain: string) => `Tu génères une tâche d'évaluation pour certifier un expert annotateur dans le domaine ${domain}.

Génère :
1. Un prompt réaliste qu'un utilisateur poserait à un LLM dans le domaine ${domain}
2. Une réponse IA qui contient EXACTEMENT 3 erreurs de types variés :
   - Au moins 1 erreur factuelle
   - Au moins 1 omission importante
   - Au moins 1 affirmation correcte mais trompeuse (vraie mais hors contexte)
   - Le reste de la réponse doit être correct et convaincant

3. Le scoring gold de référence sur chaque dimension (0-5) avec justification :
   correctness, safety, completeness, reasoning_depth, source_reliability, communication_clarity

4. La liste des erreurs avec leur localisation

Format JSON strict :
{
  "prompt": "...",
  "ai_response": "...",
  "gold_scores": {
    "correctness": { "score": 3, "justification": "..." },
    "safety": { "score": 2, "justification": "..." },
    "completeness": { "score": 2, "justification": "..." },
    "reasoning_depth": { "score": 3, "justification": "..." },
    "source_reliability": { "score": 2, "justification": "..." },
    "communication_clarity": { "score": 4, "justification": "..." }
  },
  "errors": [
    { "type": "factual", "text": "...", "correction": "..." },
    { "type": "omission", "description": "..." },
    { "type": "misleading", "text": "...", "why_misleading": "..." }
  ]
}

La réponse IA doit être RÉALISTE — le genre d'erreur qu'un vrai LLM ferait. Pas des erreurs grossières qu'un non-expert verrait.
Langue : français.`;

// ============================================================================
// PHASE 2B — Ethical judgment prompt
// ============================================================================

const PHASE2B_PROMPTS: Record<string, string> = {
  medical: `Scénarios autour de : consentement éclairé, biais racial en médecine, formulation anxiogène, automédication dangereuse, confidentialité patient.
La réponse doit être médicalement correcte mais éthiquement problématique.`,

  legal: `Scénarios autour de : conseil juridique sans mise en garde sur les juridictions, jargon incompréhensible pour un non-juriste, omission de droits du demandeur, biais socio-économique.
La réponse doit être juridiquement correcte mais éthiquement problématique.`,

  finance: `Scénarios autour de : recommandation inadaptée au profil de risque, présentation trompeuse de performances passées (survivorship bias), optimisation fiscale agressive présentée comme normale, biais vers des produits complexes.
La réponse doit être financièrement correcte mais éthiquement problématique.`,

  code: `Scénarios autour de : collecte excessive de données utilisateur, algorithme de scoring avec biais discriminatoire, licence incompatible, dark patterns, absence de consentement utilisateur.
Le code doit être fonctionnel mais éthiquement problématique.`,
};

const PHASE2B_PROMPT = (domain: string) => `Tu génères un scénario de jugement éthique pour certifier un expert annotateur dans le domaine ${domain}.

Le scénario présente une réponse IA qui est TECHNIQUEMENT CORRECTE mais ÉTHIQUEMENT PROBLÉMATIQUE. L'objectif est de vérifier que l'expert ne valide pas aveuglément une réponse "correcte" qui pose un problème éthique, de biais, de sécurité ou de responsabilité.

${PHASE2B_PROMPTS[domain] || ""}

Génère :
1. Un contexte : qui est l'utilisateur, que demande-t-il (2-3 phrases)
2. La réponse du modèle IA : techniquement exacte mais contenant AU MOINS 2 problèmes éthiques parmi :
   - Biais discriminatoire (genre, race, âge, origine)
   - Risque pour la sécurité de l'utilisateur
   - Information trompeuse (correcte isolément mais biaisée dans sa présentation)
   - Absence de mise en garde nécessaire
   - Violation de la vie privée ou du consentement
   - Conseil inadapté au profil/contexte de l'utilisateur
3. Le verdict gold : "appropriate" | "problematic" | "inappropriate"
4. La liste des problèmes éthiques avec justification
5. La correction suggérée

Format JSON strict :
{
  "context": "...",
  "ai_response": "...",
  "gold_verdict": "problematic",
  "ethical_problems": [
    {
      "category": "biais_discriminatoire",
      "description": "...",
      "severity": "high",
      "quote": "..."
    }
  ],
  "suggested_correction": "...",
  "difficulty": "medium"
}

Le scénario doit être SUBTIL. Les problèmes éthiques ne sont pas évidents — ils sont le genre de choses qu'un annotateur non attentif laisserait passer.
Langue : français.`;

// ============================================================================
// MAIN HANDLER
// ============================================================================

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

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
      action: z.enum(["start", "submit_phase1", "submit_phase2a", "submit_phase2b", "submit_phase2", "submit_phase3", "status"]),
      domain: z.enum(["medical", "legal", "finance", "code"]),
      assessment_id: z.string().uuid().optional(),
      answers: z.any().optional(),
    });

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.issues }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, domain, assessment_id, answers } = parsed.data;

    // Get expert profile
    const { data: expertProfile } = await supabase
      .from("expert_profiles").select("id").eq("user_id", userId).single();

    if (!expertProfile) {
      return new Response(JSON.stringify({ error: "Expert profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const expertId = expertProfile.id;

    // ====== STATUS ======
    if (action === "status") {
      const { data: sessions } = await supabase
        .from("certification_assessments").select("*")
        .eq("expert_id", expertId).eq("domain", domain)
        .order("created_at", { ascending: false }).limit(1);

      return new Response(JSON.stringify({ assessment: sessions?.[0] || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== START ======
    if (action === "start") {
      // Check cooldown
      const { data: lastAttempt } = await supabase
        .from("certification_assessments")
        .select("next_attempt_allowed_at, overall_passed")
        .eq("expert_id", expertId).eq("domain", domain)
        .order("created_at", { ascending: false }).limit(1).single();

      if (lastAttempt?.overall_passed) {
        return new Response(JSON.stringify({ error: "Already certified in this domain" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (lastAttempt?.next_attempt_allowed_at && new Date(lastAttempt.next_attempt_allowed_at) > new Date()) {
        return new Response(JSON.stringify({
          error: "Cooldown active", next_attempt_at: lastAttempt.next_attempt_allowed_at,
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Generate QCM via AI
      const qcmPrompt = QCM_PROMPTS[domain];
      const fullPrompt = `${qcmPrompt}

Langue : français

Génère exactement 15 questions. Chaque question doit avoir :
- Un énoncé clair et sans ambiguïté
- 4 options (A, B, C, D)
- Une seule réponse correcte
- Une explication courte de la bonne réponse

Format JSON :
{
  "questions": [
    { "id": 1, "question": "...", "options": { "A": "...", "B": "...", "C": "...", "D": "..." }, "correct_answer": "B", "explanation": "..." }
  ]
}

RÈGLES :
- Pas de doubles négations
- Distracteurs plausibles, pas absurdes
- Varier les sous-domaines
- Ne pas inclure de questions sur des protocoles spécifiques à un pays
- Tester le jugement, pas la mémorisation`;

      const aiResponse = await callLovableAI(lovableApiKey, fullPrompt);
      const questions = extractJSON(aiResponse);

      if (!questions?.questions || questions.questions.length < 15) {
        return new Response(JSON.stringify({ error: "Failed to generate questions" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clientQuestions = questions.questions.map((q: any) => ({
        id: q.id, question: q.question, options: q.options,
      }));

      const { data: assessment, error: insertErr } = await supabase
        .from("certification_assessments").insert({
          expert_id: expertId, user_id: userId, domain,
          phase1_questions: questions, current_phase: 1,
          phase1_started_at: new Date().toISOString(),
        }).select().single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to create assessment" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        assessment_id: assessment.id, phase: 1, questions: clientQuestions, time_limit_minutes: 20,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== SUBMIT PHASE 1 ======
    if (action === "submit_phase1") {
      if (!assessment_id || !answers) {
        return new Response(JSON.stringify({ error: "assessment_id and answers required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: assessment } = await supabase
        .from("certification_assessments").select("*")
        .eq("id", assessment_id).eq("expert_id", expertId).single();

      if (!assessment || assessment.current_phase !== 1) {
        return new Response(JSON.stringify({ error: "Invalid assessment state" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const questions = assessment.phase1_questions.questions;
      let correct = 0;
      const results: any[] = [];
      for (const q of questions) {
        const expertAnswer = answers[q.id];
        const isCorrect = expertAnswer === q.correct_answer;
        if (isCorrect) correct++;
        results.push({
          id: q.id, expert_answer: expertAnswer, correct_answer: q.correct_answer,
          is_correct: isCorrect, explanation: q.explanation,
        });
      }

      const score = correct / questions.length;
      const passed = score >= 0.70;

      const updateData: any = {
        phase1_answers: { answers, results },
        phase1_score: Math.round(score * 100),
        phase1_passed: passed,
        phase1_completed_at: new Date().toISOString(),
      };

      if (!passed) {
        updateData.status = "failed";
        updateData.overall_passed = false;
        updateData.completed_at = new Date().toISOString();
        updateData.next_attempt_allowed_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        // Generate Phase 2A task
        const phase2aResponse = await callLovableAI(lovableApiKey, PHASE2A_PROMPT(domain));
        const phase2Task = extractJSON(phase2aResponse);
        updateData.current_phase = 2;
        updateData.phase2_task = phase2Task;
        updateData.phase2_started_at = new Date().toISOString();
      }

      await supabase.from("certification_assessments").update(updateData).eq("id", assessment_id);

      if (!passed) {
        return new Response(JSON.stringify({
          phase: 1, passed: false, score: Math.round(score * 100),
          correct, total: questions.length, results, cooldown_days: 7,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        phase: 1, passed: true, score: Math.round(score * 100), correct, total: questions.length,
        next_phase: "2a",
        phase2_task: {
          prompt: updateData.phase2_task?.prompt,
          ai_response: updateData.phase2_task?.ai_response,
          dimensions: ["correctness", "safety", "completeness", "reasoning_depth", "source_reliability", "communication_clarity"],
        },
        time_limit_minutes: 25,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== SUBMIT PHASE 2A (Technical Evaluation) ======
    if (action === "submit_phase2a" || (action === "submit_phase2" && answers?.scores)) {
      if (!assessment_id || !answers) {
        return new Response(JSON.stringify({ error: "assessment_id and answers required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: assessment } = await supabase
        .from("certification_assessments").select("*")
        .eq("id", assessment_id).eq("expert_id", expertId).single();

      if (!assessment || assessment.current_phase !== 2) {
        return new Response(JSON.stringify({ error: "Invalid assessment state" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const goldScores = assessment.phase2_task?.gold_scores || {};
      const expertScores = answers.scores || {};
      const dimensions = Object.keys(goldScores);
      let totalDeviation = 0;
      let criticalMiss = false;
      const deviations: any = {};

      for (const dim of dimensions) {
        const gold = goldScores[dim]?.score || 0;
        const expert = expertScores[dim]?.score ?? expertScores[dim] ?? 0;
        const dev = Math.abs(gold - expert);
        deviations[dim] = { gold, expert, deviation: dev };
        totalDeviation += dev;
        if ((dim === "safety" || dim === "correctness") && dev > 2) {
          criticalMiss = true;
        }
      }

      const meanDeviation = dimensions.length > 0 ? totalDeviation / dimensions.length : 999;
      const phase2aPassed = meanDeviation < 1.0 && !criticalMiss;

      const updateData: any = {
        phase2_expert_scores: answers,
        phase2_gold_scores: goldScores,
        phase2_error_detection: answers.errors_found || [],
        phase2_mean_deviation: Math.round(meanDeviation * 100) / 100,
      };

      if (!phase2aPassed) {
        updateData.phase2_passed = false;
        updateData.status = "failed";
        updateData.overall_passed = false;
        updateData.completed_at = new Date().toISOString();
        updateData.next_attempt_allowed_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from("certification_assessments").update(updateData).eq("id", assessment_id);

        return new Response(JSON.stringify({
          phase: "2a", passed: false, mean_deviation: updateData.phase2_mean_deviation,
          critical_miss: criticalMiss, deviations, gold_scores: goldScores, cooldown_days: 7,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Phase 2A passed → generate Phase 2B ethical scenario
      const phase2bResponse = await callLovableAI(lovableApiKey, PHASE2B_PROMPT(domain));
      const phase2bScenario = extractJSON(phase2bResponse);

      updateData.phase2b_scenario = phase2bScenario;

      await supabase.from("certification_assessments").update(updateData).eq("id", assessment_id);

      // Return scenario to client (strip gold verdict and problems)
      return new Response(JSON.stringify({
        phase: "2a", passed: true, mean_deviation: updateData.phase2_mean_deviation, deviations,
        next_phase: "2b",
        ethical_scenario: {
          context: phase2bScenario?.context,
          ai_response: phase2bScenario?.ai_response,
        },
        time_limit_minutes: 15,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== SUBMIT PHASE 2B (Ethical Judgment) ======
    if (action === "submit_phase2b") {
      if (!assessment_id || !answers) {
        return new Response(JSON.stringify({ error: "assessment_id and answers required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: assessment } = await supabase
        .from("certification_assessments").select("*")
        .eq("id", assessment_id).eq("expert_id", expertId).single();

      if (!assessment || assessment.current_phase !== 2 || !assessment.phase2b_scenario) {
        return new Response(JSON.stringify({ error: "Invalid assessment state for phase 2b" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const goldVerdict = assessment.phase2b_scenario.gold_verdict;
      const goldProblems = assessment.phase2b_scenario.ethical_problems || [];
      const expertVerdict = answers.verdict; // "appropriate" | "problematic" | "inappropriate"
      const expertProblems = answers.problems_identified || [];
      const expertJustification = answers.justification || "";
      const expertCorrection = answers.correction || "";

      // Evaluate verdict
      const verdictLevels: Record<string, number> = { appropriate: 0, problematic: 1, inappropriate: 2 };
      const goldLevel = verdictLevels[goldVerdict] ?? 1;
      const expertLevel = verdictLevels[expertVerdict] ?? 0;
      const verdictGap = Math.abs(goldLevel - expertLevel);

      // ELIMINATORY: expert says "appropriate" when gold says "inappropriate"
      const eliminatory = expertVerdict === "appropriate" && goldVerdict === "inappropriate";

      // Check problem detection (at least 50% of gold problems identified)
      const goldProblemCategories = goldProblems.map((p: any) => p.category);
      const matchedProblems = expertProblems.filter((p: string) =>
        goldProblemCategories.some((gc: string) => gc.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(gc.toLowerCase()))
      );
      const problemDetectionRate = goldProblemCategories.length > 0 ? matchedProblems.length / goldProblemCategories.length : 1;

      // Evaluate justification quality via AI
      let justificationQuality = "pertinente";
      if (expertJustification.length >= 20) {
        try {
          const evalPrompt = `Évalue la cohérence de cette justification par rapport au verdict donné.
Verdict expert: "${expertVerdict}"
Justification: "${expertJustification}"
Verdict gold: "${goldVerdict}"
Réponds uniquement par un JSON: {"quality": "pertinente" | "partiellement_pertinente" | "hors_sujet"}`;
          const evalRes = await callLovableAI(lovableApiKey, evalPrompt);
          const evalData = extractJSON(evalRes);
          justificationQuality = evalData?.quality || "pertinente";
        } catch {
          // fallback
        }
      }

      const phase2bPassed = !eliminatory && verdictGap <= 1 && problemDetectionRate >= 0.5;

      // Overall Phase 2 result
      const phase2Passed = phase2bPassed; // 2A already passed to get here

      const updateData: any = {
        phase2b_expert_verdict: expertVerdict,
        phase2b_gold_verdict: goldVerdict,
        phase2b_problems_identified: { expert: expertProblems, matched: matchedProblems, detection_rate: problemDetectionRate },
        phase2b_justification: expertJustification,
        phase2b_correction: expertCorrection,
        phase2b_passed: phase2bPassed,
        phase2_passed: phase2Passed,
        phase2_completed_at: new Date().toISOString(),
      };

      if (!phase2Passed) {
        updateData.status = "failed";
        updateData.overall_passed = false;
        updateData.completed_at = new Date().toISOString();
        updateData.next_attempt_allowed_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from("certification_assessments").update(updateData).eq("id", assessment_id);

        return new Response(JSON.stringify({
          phase: "2b", passed: false, eliminatory,
          verdict_gap: verdictGap, expert_verdict: expertVerdict, gold_verdict: goldVerdict,
          problem_detection_rate: Math.round(problemDetectionRate * 100),
          justification_quality: justificationQuality,
          gold_problems: goldProblems,
          cooldown_days: 7,
          message: eliminatory
            ? "Vous n'avez pas identifié un problème éthique important. La capacité à détecter ces situations est essentielle pour annoter sur STEF."
            : "Phase 2 non validée.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Passed → move to Phase 3
      updateData.current_phase = 3;
      updateData.phase3_started_at = new Date().toISOString();

      await supabase.from("certification_assessments").update(updateData).eq("id", assessment_id);

      return new Response(JSON.stringify({
        phase: "2b", passed: true,
        expert_verdict: expertVerdict, gold_verdict: goldVerdict,
        problem_detection_rate: Math.round(problemDetectionRate * 100),
        justification_quality: justificationQuality,
        next_phase: 3,
        message: "Phase 2 validée. Passez à la phase 3 : annotation en conditions réelles.",
        time_limit_minutes: 45,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== SUBMIT PHASE 3 ======
    if (action === "submit_phase3") {
      if (!assessment_id || !answers) {
        return new Response(JSON.stringify({ error: "assessment_id and answers required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: assessment } = await supabase
        .from("certification_assessments").select("*")
        .eq("id", assessment_id).eq("expert_id", expertId).single();

      if (!assessment || assessment.current_phase !== 3) {
        return new Response(JSON.stringify({ error: "Invalid assessment state" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Evaluate annotations via AI
      const evaluationPrompt = `Tu es un évaluateur senior d'annotations RLHF dans le domaine "${domain}".

L'expert a soumis les annotations suivantes pour 3 tâches. Évalue la qualité globale en simulant un accord inter-annotateurs (Krippendorff's Alpha).

Annotations soumises :
${JSON.stringify(answers.annotations, null, 2)}

Évalue sur ces critères :
1. Précision des scores (les scores sont-ils cohérents et justifiés ?)
2. Qualité du raisonnement (les justifications sont-elles pertinentes, profondes ?)
3. Détection d'erreurs (l'expert a-t-il identifié les problèmes clés ?)
4. Cohérence (les scores sont-ils cohérents entre eux et avec le raisonnement ?)

Retourne un JSON strict :
{
  "overall_quality_score": 0.82,
  "per_task_scores": [0.8, 0.85, 0.82],
  "feedback": "...",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."]
}

Le score doit être entre 0 et 1. Sois exigeant mais juste. Un expert moyen obtient 0.70-0.80. Un excellent expert obtient 0.85+. En dessous de 0.75, l'expert n'est pas certifié.`;

      const evalResponse = await callLovableAI(lovableApiKey, evaluationPrompt);
      const evaluation = extractJSON(evalResponse);
      const alphaEstimate = evaluation?.overall_quality_score || 0;
      const passed = alphaEstimate >= 0.75;

      const updateData: any = {
        phase3_alpha: Math.round(alphaEstimate * 100) / 100,
        phase3_passed: passed,
        phase3_completed_at: new Date().toISOString(),
        overall_passed: passed,
        status: passed ? "passed" : "failed",
        completed_at: new Date().toISOString(),
      };

      if (!passed) {
        updateData.next_attempt_allowed_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      }

      await supabase.from("certification_assessments").update(updateData).eq("id", assessment_id);

      // If passed, create domain certification
      if (passed) {
        const domainMap: Record<string, string> = {
          medical: "medical", legal: "juridique_fr", finance: "finance", code: "code_tech",
        };
        const tier = alphaEstimate >= 0.90 ? "expert" : alphaEstimate >= 0.80 ? "senior" : "standard";

        await supabase.from("annotator_domain_certifications").insert({
          expert_id: expertId, user_id: userId,
          domain: domainMap[domain] || domain,
          score: Math.round(alphaEstimate * 100),
          tier, session_id: assessment_id, status: "active",
          valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });

        // Create/update annotator profile
        const { data: existingProfile } = await supabase
          .from("annotator_profiles").select("id").eq("expert_id", expertId).single();

        if (!existingProfile) {
          await supabase.from("annotator_profiles").insert({
            expert_id: expertId,
            anonymized_id: `anon_${crypto.randomUUID().slice(0, 8)}`,
            country: "FR", languages: ["fr"], experience_years: 1,
            role: "annotator", seniority: tier, is_qualified: true,
            qualified_at: new Date().toISOString(),
            qualification_score: Math.round(alphaEstimate * 100), tier,
          });
        }

        // Create balance record
        await supabase.from("expert_balances").insert({
          expert_id: expertId, user_id: userId,
        }).onConflict("expert_id").ignore();
      }

      return new Response(JSON.stringify({
        phase: 3, passed, alpha: updateData.phase3_alpha, overall_passed: passed,
        evaluation: evaluation?.feedback, strengths: evaluation?.strengths,
        weaknesses: evaluation?.weaknesses, cooldown_days: passed ? null : 14,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[assessment-certification] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================================================
// HELPERS
// ============================================================================

async function callLovableAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Tu es un assistant expert. Réponds toujours en JSON valide quand un format JSON est demandé." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI gateway error: ${response.status} — ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch {}
  }
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          const raw = text.slice(start, i + 1).replace(/[\n\r]/g, " ");
          return JSON.parse(raw);
        } catch { return null; }
      }
    }
  }
  return null;
}
