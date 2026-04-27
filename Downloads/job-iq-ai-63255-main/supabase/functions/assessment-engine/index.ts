import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, stack, session_id, expert_id } = body;

    // ─── ACTION: generate_quiz ───────────────────────────────
    if (action === "generate_quiz") {
      const { data: existingQuestions, error: qErr } = await supabase
        .from("quiz_questions")
        .select("id, domain, difficulty")
        .eq("stack", stack)
        .eq("is_active", true);

      if (!qErr && existingQuestions && existingQuestions.length >= 100) {
        // Use existing questions — select with domain distribution guarantee
        const selected = selectAdaptiveQuestions(existingQuestions, 20);

        // If expert_id provided, exclude questions they've seen before (A2.14)
        if (expert_id) {
          const { data: previousSessions } = await supabase
            .from("assessment_sessions")
            .select("quiz_question_ids")
            .eq("candidate_id", expert_id)
            .not("quiz_question_ids", "is", null);

          const seenIds = new Set<string>();
          for (const s of previousSessions || []) {
            for (const id of (s.quiz_question_ids as string[]) || []) {
              seenIds.add(id);
            }
          }

          if (seenIds.size > 0) {
            const unseenQuestions = existingQuestions.filter(q => !seenIds.has(q.id));
            if (unseenQuestions.length >= 20) {
              const freshSelected = selectAdaptiveQuestions(unseenQuestions, 20);
              return jsonResponse({ success: true, question_ids: freshSelected });
            }
          }
        }

        return jsonResponse({ success: true, question_ids: selected });
      }

      // Generate questions via AI
      const domains = ["fundamentals", "algorithms", "architecture", "ecosystem", "best_practices"];
      const allQuestions: any[] = [];

      for (const domain of domains) {
        const prompt = buildQuizPrompt(stack, domain);
        const response = await callAI(LOVABLE_API_KEY, QUIZ_SYSTEM_PROMPT, prompt, "google/gemini-2.5-flash", 0.8);
        if (!response) continue;

        try {
          const jsonStr = extractJson(response);
          if (jsonStr) {
            const parsed = JSON.parse(normalizeJsonString(jsonStr));
            const questions = parsed.questions || parsed;
            if (Array.isArray(questions)) {
              for (const q of questions) {
                allQuestions.push({
                  stack,
                  domain,
                  difficulty: q.difficulty || 3,
                  question: q.question,
                  options: q.options,
                  correct_answer: q.correct_answer || q.correctAnswer,
                  explanation: q.explanation || "",
                  time_limit: q.time_limit || q.timeLimit || 30,
                  tags: q.tags || [],
                });
              }
            }
          }
        } catch (e) {
          console.error(`Parse error for domain ${domain}:`, e);
        }
      }

      if (allQuestions.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from("quiz_questions")
          .insert(allQuestions)
          .select("id");

        if (insertErr) throw insertErr;

        return jsonResponse({
          success: true,
          questions_generated: inserted?.length || 0,
          question_ids: inserted?.map(q => q.id) || [],
        });
      }

      throw new Error("Failed to generate quiz questions");
    }

    // ─── ACTION: generate_coding_challenge ────────────────────
    if (action === "generate_coding_challenge") {
      const prompt = buildCodingChallengePrompt(stack);
      const response = await callAI(LOVABLE_API_KEY, CODING_CHALLENGE_SYSTEM_PROMPT, prompt, "google/gemini-2.5-flash", 0.7);
      if (!response) throw new Error("No AI response");

      const jsonStr = extractJson(response);
      if (!jsonStr) throw new Error("Could not parse challenge");
      const challenge = JSON.parse(normalizeJsonString(jsonStr));

      const { data: saved, error: saveErr } = await supabase
        .from("coding_challenges")
        .insert({
          stack,
          title: challenge.title,
          scenario: challenge.scenario,
          steps: challenge.steps,
          starter_code: challenge.starter_code || challenge.starterCode || "",
          hidden_tests: challenge.hidden_tests || challenge.hiddenTests || [],
          visible_tests: challenge.visible_tests || challenge.visibleTests || [],
          max_duration: 1800,
        })
        .select()
        .single();

      if (saveErr) throw saveErr;

      return jsonResponse({ success: true, challenge: saved });
    }

    // ─── ACTION: generate_code_review ─────────────────────────
    if (action === "generate_code_review") {
      const prompt = buildCodeReviewPrompt(stack);
      const response = await callAI(LOVABLE_API_KEY, CODE_REVIEW_SYSTEM_PROMPT, prompt, "google/gemini-2.5-flash", 0.6);
      if (!response) throw new Error("No AI response");

      const jsonStr = extractJson(response);
      if (!jsonStr) throw new Error("Could not parse code review");
      const review = JSON.parse(normalizeJsonString(jsonStr));

      const { data: saved, error: saveErr } = await supabase
        .from("code_review_challenges")
        .insert({
          stack,
          code: review.code,
          problems: review.problems,
          max_duration: 300,
        })
        .select()
        .single();

      if (saveErr) throw saveErr;

      return jsonResponse({ success: true, review: saved });
    }

    // ─── ACTION: evaluate_code (Phase 2 — AI-based code evaluation) ──
    if (action === "evaluate_code") {
      const { code, challenge_id } = body;
      if (!code || !challenge_id) throw new Error("code and challenge_id required");

      const { data: challenge } = await supabase
        .from("coding_challenges")
        .select("*")
        .eq("id", challenge_id)
        .single();

      if (!challenge) throw new Error("Challenge not found");

      // Use a stronger model for code evaluation
      const evalPrompt = buildCodeEvalPrompt(code, challenge, stack);
      const response = await callAI(
        LOVABLE_API_KEY,
        CODE_EVAL_SYSTEM_PROMPT,
        evalPrompt,
        "google/gemini-2.5-flash",
        0.2
      );

      if (!response) throw new Error("No evaluation response");

      const jsonStr = extractJson(response);
      if (!jsonStr) throw new Error("Could not parse evaluation");
      const evaluation = JSON.parse(normalizeJsonString(jsonStr));

      return jsonResponse({ success: true, evaluation });
    }

    // ─── ACTION: detect_plagiarism (A6.07) ────────────────────
    if (action === "detect_plagiarism") {
      const { code, candidate_id } = body;
      if (!code) throw new Error("code required");

      // Get recent submissions for comparison
      const { data: recentSubmissions } = await supabase
        .from("assessment_sessions")
        .select("phase2_code, candidate_id")
        .not("phase2_code", "is", null)
        .neq("candidate_id", candidate_id || "")
        .order("completed_at", { ascending: false })
        .limit(50);

      const similarities: { candidate_id: string; similarity: number }[] = [];

      for (const sub of recentSubmissions || []) {
        if (!sub.phase2_code) continue;
        const similarity = computeJaccardSimilarity(
          tokenizeCode(code),
          tokenizeCode(sub.phase2_code as string)
        );
        if (similarity > 0.6) {
          similarities.push({
            candidate_id: sub.candidate_id,
            similarity: Math.round(similarity * 100),
          });
        }
      }

      const isPlagiarized = similarities.some(s => s.similarity > 80);

      return jsonResponse({
        success: true,
        is_plagiarized: isPlagiarized,
        max_similarity: similarities.length > 0 ? Math.max(...similarities.map(s => s.similarity)) : 0,
        similar_submissions: similarities.slice(0, 5),
      });
    }

    // ─── ACTION: detect_quiz_patterns (A2.13) ─────────────────
    if (action === "detect_quiz_patterns") {
      const { answers } = body;
      if (!answers || !Array.isArray(answers)) throw new Error("answers required");

      const patterns: { type: string; severity: string; details: string }[] = [];

      // Check if always same answer
      const selectedAnswers = answers.map((a: any) => a.selected);
      const counts: Record<string, number> = {};
      for (const s of selectedAnswers) {
        counts[s] = (counts[s] || 0) + 1;
      }
      const maxRepeat = Math.max(...Object.values(counts));
      if (maxRepeat >= answers.length * 0.7) {
        patterns.push({
          type: "same_answer_pattern",
          severity: "warning",
          details: `Le candidat a choisi "${Object.entries(counts).find(([, v]) => v === maxRepeat)?.[0]}" ${maxRepeat}/${answers.length} fois`,
        });
      }

      // Check if all answers are extremely fast (< 3s)
      const fastAnswers = answers.filter((a: any) => (a.time_spent_ms || 0) < 3000);
      if (fastAnswers.length >= answers.length * 0.5) {
        patterns.push({
          type: "speed_pattern",
          severity: "warning",
          details: `${fastAnswers.length}/${answers.length} réponses en moins de 3 secondes`,
        });
      }

      // Check if answers are sequential (A, B, C, D, A, B, C, D...)
      const isSequential = selectedAnswers.every((s: string, i: number) =>
        s === ["A", "B", "C", "D"][i % 4]
      );
      if (isSequential && answers.length >= 8) {
        patterns.push({
          type: "sequential_pattern",
          severity: "critical",
          details: "Pattern séquentiel détecté (A, B, C, D répété)",
        });
      }

      return jsonResponse({ success: true, patterns, flagged: patterns.length > 0 });
    }

    // ─── ACTION: compute_global_score ─────────────────────────
    if (action === "compute_global_score") {
      if (!session_id) throw new Error("session_id required");

      const { data: session, error: sessErr } = await supabase
        .from("assessment_sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      if (sessErr || !session) throw new Error("Session not found");

      // Server-side timer validation
      const sessionStart = new Date(session.started_at).getTime();
      const maxDurationMs = 45 * 60 * 1000;
      const now = Date.now();
      const elapsed = now - sessionStart;
      const timerExceeded = elapsed > maxDurationMs + 60000;

      if (timerExceeded) {
        await supabase
          .from("assessment_sessions")
          .update({
            status: "flagged",
            integrity_flags: [
              ...((session.integrity_flags as any[]) || []),
              {
                type: "timer_exceeded",
                severity: "warning",
                timestamp: new Date().toISOString(),
                details: `Durée totale: ${Math.round(elapsed / 60000)} min (max: 45 min)`,
              },
            ],
          })
          .eq("id", session_id);
      }

      const phase1Duration = session.phase1_started_at && session.phase1_completed_at
        ? (new Date(session.phase1_completed_at).getTime() - new Date(session.phase1_started_at).getTime()) / 1000
        : null;
      const phase2Duration = session.phase2_started_at && session.phase2_completed_at
        ? (new Date(session.phase2_completed_at).getTime() - new Date(session.phase2_started_at).getTime()) / 1000
        : null;
      const phase3Duration = session.phase3_started_at && session.phase3_completed_at
        ? (new Date(session.phase3_completed_at).getTime() - new Date(session.phase3_started_at).getTime()) / 1000
        : null;

      const phase1 = session.phase1_result as any;
      const phase2 = session.phase2_result as any;
      const phase3 = session.phase3_result as any;

      if (!phase1 || !phase2 || !phase3) {
        throw new Error("All 3 phases must be completed");
      }

      // NLP scoring for Phase 3
      let nlpScoredPhase3 = phase3;
      try {
        const codeReviewId = session.code_review_challenge_id;
        if (codeReviewId) {
          const { data: reviewChallenge } = await supabase
            .from("code_review_challenges")
            .select("problems")
            .eq("id", codeReviewId)
            .single();

          if (reviewChallenge?.problems && phase3.answers) {
            const nlpResult = await computeNlpScore(
              LOVABLE_API_KEY,
              reviewChallenge.problems as any[],
              phase3.answers
            );
            nlpScoredPhase3 = { ...phase3, ...nlpResult };
          }
        }
      } catch (nlpErr) {
        console.error("NLP scoring error:", nlpErr);
      }

      // Static analysis scoring for Phase 2
      let staticAnalysisScore = null;
      try {
        if (session.phase2_code && session.stack) {
          staticAnalysisScore = await computeStaticAnalysis(
            LOVABLE_API_KEY,
            session.phase2_code,
            session.stack
          );
        }
      } catch (saErr) {
        console.error("Static analysis error:", saErr);
      }

      const enrichedPhase2 = staticAnalysisScore
        ? { ...phase2, static_analysis: staticAnalysisScore, weighted_score: Math.round(
            (phase2.weighted_score || 0) * 0.8 + (staticAnalysisScore.overall || 0) * 0.2
          )}
        : phase2;

      // Plagiarism check
      let plagiarismResult = null;
      try {
        if (session.phase2_code) {
          const { data: recentSubs } = await supabase
            .from("assessment_sessions")
            .select("phase2_code, candidate_id")
            .not("phase2_code", "is", null)
            .neq("candidate_id", session.candidate_id)
            .order("completed_at", { ascending: false })
            .limit(30);

          let maxSim = 0;
          for (const sub of recentSubs || []) {
            if (!sub.phase2_code) continue;
            const sim = computeJaccardSimilarity(
              tokenizeCode(session.phase2_code),
              tokenizeCode(sub.phase2_code as string)
            );
            if (sim > maxSim) maxSim = sim;
          }

          if (maxSim > 0.8) {
            plagiarismResult = { detected: true, similarity: Math.round(maxSim * 100) };
          }
        }
      } catch (plagErr) {
        console.error("Plagiarism check error:", plagErr);
      }

      const globalScore = computeGlobalScore(phase1, enrichedPhase2, nlpScoredPhase3);

      // Add server timing + plagiarism metadata
      (globalScore as any).server_timing = {
        total_elapsed_seconds: Math.round(elapsed / 1000),
        phase1_seconds: phase1Duration ? Math.round(phase1Duration) : null,
        phase2_seconds: phase2Duration ? Math.round(phase2Duration) : null,
        phase3_seconds: phase3Duration ? Math.round(phase3Duration) : null,
        timer_exceeded: timerExceeded,
      };

      if (plagiarismResult?.detected) {
        (globalScore as any).plagiarism_flag = plagiarismResult;
      }

      // Generate improvement axes via AI (A5.10)
      let improvementAxes: any = null;
      try {
        improvementAxes = await generateImprovementAxes(
          LOVABLE_API_KEY,
          globalScore,
          phase1,
          enrichedPhase2,
          nlpScoredPhase3,
          session.stack
        );
      } catch (impErr) {
        console.error("Improvement axes error:", impErr);
      }

      if (improvementAxes) {
        (globalScore as any).improvement_axes = improvementAxes;
      }

      const finalStatus = plagiarismResult?.detected
        ? "flagged"
        : timerExceeded ? "flagged" : "completed";

      const { error: updateErr } = await supabase
        .from("assessment_sessions")
        .update({
          global_score: globalScore,
          status: finalStatus,
          completed_at: new Date().toISOString(),
        })
        .eq("id", session_id);

      if (updateErr) throw updateErr;

      // ── Auto-certification (A5.07) ──
      try {
        if (finalStatus === "completed" && globalScore.overall >= 50) {
          const { data: expertProfile } = await supabase
            .from("expert_profiles")
            .select("user_id, full_name, country")
            .eq("id", session.candidate_id)
            .single();

          if (expertProfile) {
            const nameParts = expertProfile.full_name.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";
            const certLevel = globalScore.level === "expert" ? "platinum"
              : globalScore.level === "senior" ? "gold"
              : globalScore.level === "mid" ? "silver"
              : "bronze";

            // Check if cert already exists for this session
            const { data: existingCert } = await supabase
              .from("certifications")
              .select("id")
              .eq("user_id", expertProfile.user_id)
              .eq("assessment_name", `STEF Assessment - ${session.stack}`)
              .gte("issued_at", new Date(Date.now() - 86400000).toISOString())
              .limit(1);

            if (!existingCert || existingCert.length === 0) {
              await supabase.rpc("issue_certificate", {
                p_user_id: expertProfile.user_id,
                p_expert_id: session.candidate_id,
                p_first_name: firstName,
                p_last_name: lastName,
                p_country: expertProfile.country || "XX",
                p_role_title: `${session.stack} Developer`,
                p_level: certLevel,
                p_score: Math.round(globalScore.overall),
                p_assessment_name: `STEF Assessment - ${session.stack}`,
                p_track: session.stack,
                p_valid_months: 12,
              });
            }
          }
        }
      } catch (certErr) {
        console.error("Auto-certification error:", certErr);
      }

      // ── Award referral step if applicable ──
      try {
        if (finalStatus === "completed") {
          const { data: expertProfile } = await supabase
            .from("expert_profiles")
            .select("user_id, email")
            .eq("id", session.candidate_id)
            .single();

          if (expertProfile) {
            // Check if referred
            const { data: referral } = await supabase
              .from("expert_referrals")
              .select("id, current_step")
              .eq("referred_user_id", expertProfile.user_id)
              .single();

            if (referral) {
              // Award assessment_completed step
              await supabase.rpc("award_referral_step", {
                p_referral_id: referral.id,
                p_step: "assessment_completed",
              });

              // If certified mid+, award that step too
              if (globalScore.level !== "junior") {
                await supabase.rpc("award_referral_step", {
                  p_referral_id: referral.id,
                  p_step: "certified_mid_plus",
                });
              }
            }
          }
        }
      } catch (refErr) {
        console.error("Referral award error:", refErr);
      }

      return jsonResponse({ success: true, global_score: globalScore });
    }

    // ─── ACTION: get_explanations (A2.15 — post-test review) ──
    if (action === "get_explanations") {
      if (!session_id) throw new Error("session_id required");

      const { data: session } = await supabase
        .from("assessment_sessions")
        .select("quiz_question_ids, phase1_result")
        .eq("id", session_id)
        .single();

      if (!session) throw new Error("Session not found");

      const questionIds = (session.quiz_question_ids as string[]) || [];
      if (questionIds.length === 0) return jsonResponse({ success: true, explanations: [] });

      const { data: questions } = await supabase
        .from("quiz_questions")
        .select("id, question, options, correct_answer, explanation, domain, difficulty")
        .in("id", questionIds);

      const answers = (session.phase1_result as any)?.answers || [];
      const answerMap = new Map(answers.map((a: any) => [a.question_id, a]));

      const explanations = (questions || []).map((q: any) => {
        const answer = answerMap.get(q.id);
        return {
          question_id: q.id,
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          domain: q.domain,
          difficulty: q.difficulty,
          candidate_answer: answer?.selected || null,
          was_correct: answer?.correct || false,
          time_spent_ms: answer?.time_spent_ms || 0,
        };
      });

      return jsonResponse({ success: true, explanations });
    }

    // ─── ACTION: get_history (A5.12 — historical comparison) ──
    if (action === "get_history") {
      if (!expert_id) throw new Error("expert_id required");

      const { data: sessions } = await supabase
        .from("assessment_sessions")
        .select("id, stack, status, completed_at, global_score, created_at")
        .eq("candidate_id", expert_id)
        .eq("status", "completed")
        .order("completed_at", { ascending: true });

      return jsonResponse({
        success: true,
        sessions: (sessions || []).map((s: any) => ({
          id: s.id,
          stack: s.stack,
          completed_at: s.completed_at,
          overall: (s.global_score as any)?.overall || 0,
          level: (s.global_score as any)?.level || "junior",
          breakdown: (s.global_score as any)?.breakdown || {},
        })),
      });
    }

    // ─── ACTION: check_cooldown ──────────────────────────────
    if (action === "check_cooldown") {
      if (!expert_id) throw new Error("expert_id required");

      const { data: lastSession } = await supabase
        .from("assessment_sessions")
        .select("completed_at")
        .eq("candidate_id", expert_id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .single();

      let canRetake = true;
      let cooldownEndsAt = null;

      if (lastSession?.completed_at) {
        const completedDate = new Date(lastSession.completed_at);
        const cooldownEnd = new Date(completedDate);
        cooldownEnd.setDate(cooldownEnd.getDate() + 30);
        if (cooldownEnd > new Date()) {
          canRetake = false;
          cooldownEndsAt = cooldownEnd.toISOString();
        }
      }

      return jsonResponse({ can_retake: canRetake, cooldown_ends_at: cooldownEndsAt });
    }

    // ─── ACTION: get_percentile (A5.11) ──────────────────────
    if (action === "get_percentile") {
      if (!session_id) throw new Error("session_id required");

      const { data: session } = await supabase
        .from("assessment_sessions")
        .select("global_score, stack")
        .eq("id", session_id)
        .single();

      if (!session) throw new Error("Session not found");

      const score = (session.global_score as any)?.overall || 0;

      const { data: allScores } = await supabase
        .from("assessment_sessions")
        .select("global_score")
        .eq("stack", session.stack)
        .eq("status", "completed")
        .not("global_score", "is", null);

      const scores = (allScores || [])
        .map((s: any) => (s.global_score as any)?.overall || 0)
        .filter((s: number) => s > 0);

      const belowCount = scores.filter((s: number) => s < score).length;
      const percentile = scores.length > 0 ? Math.round((belowCount / scores.length) * 100) : 50;

      return jsonResponse({
        success: true,
        percentile,
        total_candidates: scores.length,
        stack: session.stack,
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);

  } catch (error) {
    console.error("Assessment engine error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Erreur inconnue"
    }, 500);
  }
});

// ─── RESPONSE HELPER ─────────────────────────────────────────

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── AI CALL HELPER ──────────────────────────────────────────

async function callAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number
): Promise<string | null> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    console.error(`AI error ${status}:`, text);
    if (status === 429 || status === 402) {
      throw new Error(`AI rate limit or credits exhausted (${status})`);
    }
    return null;
  }

  const aiResponse = await response.json();
  return aiResponse.choices?.[0]?.message?.content || null;
}

// ─── HELPERS ─────────────────────────────────────────────────

function selectAdaptiveQuestions(questions: any[], count: number): string[] {
  const byDomain: Record<string, any[]> = {};
  for (const q of questions) {
    if (!byDomain[q.domain]) byDomain[q.domain] = [];
    byDomain[q.domain].push(q);
  }
  const selected: string[] = [];
  const domains = Object.keys(byDomain);
  const perDomain = Math.ceil(count / domains.length); // 4 per domain for 20 questions

  for (const domain of domains) {
    const pool = byDomain[domain].sort(() => Math.random() - 0.5);
    // Ensure difficulty spread within each domain
    const byDiff: Record<number, any[]> = {};
    for (const q of pool) {
      const d = q.difficulty || 3;
      if (!byDiff[d]) byDiff[d] = [];
      byDiff[d].push(q);
    }
    // Pick: 1 easy (1-2), 2 medium (3), 1 hard (4-5)
    const easy = [...(byDiff[1] || []), ...(byDiff[2] || [])];
    const medium = byDiff[3] || [];
    const hard = [...(byDiff[4] || []), ...(byDiff[5] || [])];

    if (easy.length > 0) selected.push(easy[0].id);
    for (const q of medium.slice(0, 2)) selected.push(q.id);
    if (hard.length > 0) selected.push(hard[0].id);

    // Fill remainder from pool
    const remaining = perDomain - Math.min(4, (easy.length > 0 ? 1 : 0) + Math.min(2, medium.length) + (hard.length > 0 ? 1 : 0));
    if (remaining > 0) {
      const unused = pool.filter(q => !selected.includes(q.id));
      selected.push(...unused.slice(0, remaining).map((q: any) => q.id));
    }
  }
  return selected.slice(0, count);
}

function computeGlobalScore(phase1: any, phase2: any, phase3: any) {
  const weights = { phase1: 0.25, phase2: 0.55, phase3: 0.20 };

  const overall =
    (phase1.calibrated_score || phase1.raw_score || 0) * weights.phase1 +
    (phase2.weighted_score || 0) * weights.phase2 +
    (phase3.score || 0) * weights.phase3;

  const ds = phase1.domain_scores || {};
  const ss = phase2.step_scores || {};
  const cs = phase2.criteria_scores || {};

  const breakdown = {
    fundamentals: wavg([ds.fundamentals || 50, ds.algorithms || 50], [0.6, 0.4]),
    problemSolving: wavg([ss.A || 50, ss.B || 50], [0.4, 0.6]),
    codeQuality: wavg([cs.code_quality || 50, cs.naming_readability || 50], [0.6, 0.4]),
    architecture: wavg([ds.architecture || 50, ss.D || 50], [0.3, 0.7]),
    debugging: wavg([phase3.score || 50, cs.error_handling || 50], [0.7, 0.3]),
  };

  const minDim = Math.min(...Object.values(breakdown));
  let level: string;
  if (overall >= 85 && minDim >= 60) level = "expert";
  else if (overall >= 70 && minDim >= 45) level = "senior";
  else if (overall >= 50) level = "mid";
  else level = "junior";

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  return {
    overall: Math.round(overall * 10) / 10,
    level,
    breakdown,
    radar_chart: Object.entries(breakdown).map(([dim, score]) => ({
      dimension: dim,
      score: Math.round(score),
      fullMark: 100,
    })),
    issued_at: now.toISOString(),
    valid_until: validUntil.toISOString(),
  };
}

function wavg(values: number[], weights: number[]): number {
  let sum = 0, wSum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] * weights[i];
    wSum += weights[i];
  }
  return sum / wSum;
}

// ─── PLAGIARISM DETECTION ────────────────────────────────────

function tokenizeCode(code: string): Set<string> {
  // Extract tokens: split on whitespace/punctuation, normalize
  const tokens = code
    .toLowerCase()
    .replace(/\/\/.*$/gm, "") // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove block comments
    .replace(/['"`].*?['"`]/g, "STR") // normalize strings
    .replace(/\d+/g, "NUM") // normalize numbers
    .split(/[\s{}()\[\];,.:=<>!&|+\-*/%^~?@#]+/)
    .filter(t => t.length > 1);

  // Build n-grams (trigrams)
  const ngrams = new Set<string>();
  for (let i = 0; i <= tokens.length - 3; i++) {
    ngrams.add(tokens.slice(i, i + 3).join(" "));
  }
  return ngrams;
}

function computeJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── IMPROVEMENT AXES GENERATOR ──────────────────────────────

async function generateImprovementAxes(
  apiKey: string,
  globalScore: any,
  phase1: any,
  phase2: any,
  phase3: any,
  stack: string
): Promise<any> {
  const prompt = `Analyse les résultats d'évaluation technique suivants et génère des axes d'amélioration personnalisés.

STACK: ${stack}
SCORE GLOBAL: ${globalScore.overall}/100 — Niveau: ${globalScore.level}

PHASE 1 (QCM):
- Score calibré: ${phase1.calibrated_score || phase1.raw_score || 0}%
- Scores par domaine: ${JSON.stringify(phase1.domain_scores || {})}
- Difficulté max: ${phase1.max_difficulty_reached || "N/A"}

PHASE 2 (Code):
- Score pondéré: ${phase2.weighted_score || 0}%
- Étapes complétées: ${JSON.stringify(phase2.steps_completed || [])}
- Critères: ${JSON.stringify(phase2.criteria_scores || {})}

PHASE 3 (Code Review):
- Score: ${phase3.score || 0}%
- Problèmes trouvés: ${phase3.problems_found || 0}/${phase3.problems_total || 5}

BREAKDOWN 5 DIMENSIONS:
${JSON.stringify(globalScore.breakdown, null, 2)}

Génère 3-5 axes d'amélioration concrets et actionnables. Pour chaque axe, suggère des ressources d'apprentissage.

Réponds UNIQUEMENT en JSON:
{
  "axes": [
    {
      "dimension": "nom de la dimension faible",
      "title": "Titre court de l'axe",
      "description": "Description en 2-3 phrases",
      "priority": "high|medium|low",
      "resources": [
        {"title": "Nom de la ressource", "type": "course|book|practice|doc", "url": "URL si applicable"}
      ]
    }
  ],
  "summary": "Résumé encourageant en 2-3 phrases"
}`;

  const response = await callAI(
    apiKey,
    "Tu es un mentor technique expert. Génère des conseils d'amélioration personnalisés et encourageants. Réponds uniquement en JSON valide.",
    prompt,
    "google/gemini-2.5-flash",
    0.4
  );

  if (!response) return null;

  const jsonStr = extractJson(response);
  if (!jsonStr) return null;
  return JSON.parse(normalizeJsonString(jsonStr));
}

// ─── CODE EVALUATION PROMPT ──────────────────────────────────

const CODE_EVAL_SYSTEM_PROMPT = `Tu es un évaluateur de code expert. Analyse le code soumis par un candidat et évalue-le selon des critères précis. Réponds uniquement en JSON valide.`;

function buildCodeEvalPrompt(code: string, challenge: any, stack: string): string {
  return `Évalue ce code ${stack} soumis pour le challenge "${challenge.title}".

SCÉNARIO:
${challenge.scenario}

ÉTAPES ATTENDUES:
${JSON.stringify(challenge.steps, null, 2)}

CODE SOUMIS:
\`\`\`${stack}
${code.slice(0, 8000)}
\`\`\`

TESTS VISIBLES:
${JSON.stringify(challenge.visible_tests, null, 2)}

TESTS CACHÉS:
${JSON.stringify(challenge.hidden_tests, null, 2)}

Évalue selon ces critères (chacun sur 100):
1. tests_pass: Estimation du % de tests qui passeraient
2. code_quality: Qualité du code (lisibilité, conventions)
3. structure: Organisation et découpage du code
4. error_handling: Gestion des erreurs et edge cases
5. naming_readability: Nommage des variables et fonctions
6. efficiency: Performance algorithmique
7. completeness: Couverture des étapes A-B-C-D

Réponds UNIQUEMENT en JSON:
{
  "weighted_score": 72,
  "criteria_scores": {
    "tests_pass": 80,
    "code_quality": 70,
    "structure": 65,
    "error_handling": 60,
    "naming_readability": 75,
    "efficiency": 70,
    "completeness": 75
  },
  "step_scores": {"A": 90, "B": 70, "C": 60, "D": 50},
  "tests_passed_estimate": 8,
  "tests_total": 12,
  "feedback": "Résumé technique en 3-4 phrases"
}`;
}

// ─── JSON PARSING HELPERS ────────────────────────────────────

function extractJson(input: string): string | null {
  const start = input.indexOf("{");
  if (start === -1) return null;
  let inString = false, escaped = false, depth = 0;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === '"') { inString = false; continue; }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth--; if (depth === 0) return input.slice(start, i + 1); }
  }
  return null;
}

function normalizeJsonString(input: string): string {
  let out = "", inStr = false, esc = false;
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
}

// ─── PROMPT TEMPLATES ────────────────────────────────────────

const QUIZ_SYSTEM_PROMPT = `Tu es un expert en évaluation technique. Génère des questions QCM de haute qualité pour des tests adaptatifs.
RÈGLES:
- Réponds UNIQUEMENT avec un JSON valide
- N'utilise JAMAIS de backticks dans les valeurs JSON
- Chaque question a exactement 4 options (A, B, C, D)
- Les questions doivent être techniques et précises
- Varier les niveaux de difficulté (1 à 5)
- INTERDITS: questions triviales (FizzBuzz, Hello World), questions piège ambiguës`;

function buildQuizPrompt(stack: string, domain: string): string {
  const domainLabels: Record<string, string> = {
    fundamentals: "Fondamentaux du langage (syntaxe, types, structures de contrôle, gestion mémoire)",
    algorithms: "Structures de données & Algorithmique (complexité, choix de structure, manipulation)",
    architecture: "Architecture & Design (patterns, principes SOLID, découpage, API design)",
    ecosystem: "Écosystème & Tooling (framework principal, package manager, testing, CI/CD, Git)",
    best_practices: "Bonnes pratiques (sécurité, gestion d'erreurs, lisibilité, performance)",
  };

  return `Génère 8 questions QCM pour le domaine "${domainLabels[domain]}" en ${stack}.

Répartition des difficultés: 2 questions niveau 1-2, 3 questions niveau 3, 2 questions niveau 4, 1 question niveau 5.

Format JSON:
{
  "questions": [
    {
      "question": "Question en français avec code si nécessaire (utiliser \\n pour les retours à la ligne)",
      "difficulty": 3,
      "options": [
        {"key": "A", "text": "Option A"},
        {"key": "B", "text": "Option B"},
        {"key": "C", "text": "Option C"},
        {"key": "D", "text": "Option D"}
      ],
      "correct_answer": "B",
      "explanation": "Explication détaillée de pourquoi B est correct et pourquoi les autres options sont incorrectes",
      "time_limit": 30,
      "tags": ["tag1", "tag2"]
    }
  ]
}`;
}

const CODING_CHALLENGE_SYSTEM_PROMPT = `Tu es un architecte logiciel senior (15+ ans d'expérience). Génère un challenge de code réaliste en 4 étapes progressives.
RÈGLES:
- Réponds UNIQUEMENT avec un JSON valide
- Le challenge doit être réalisable en 30 minutes
- 4 étapes: A (base), B (edge cases), C (refactoring), D (extension)
- Inclure du code de départ et des tests
- INTERDITS: CRUD trivial, FizzBuzz, calculatrices simples
- Privilégier: System Design, Data Pipelines, Caching, API Design, Event Systems`;

function buildCodingChallengePrompt(stack: string): string {
  const patterns = [
    "API Gateway avec rate-limiting et circuit breaker",
    "Data pipeline avec transformation et validation",
    "Système de cache distribué avec invalidation",
    "Event sourcing avec projection et replay",
    "Job scheduler avec retry et dead-letter queue",
    "Search engine avec indexation et ranking",
    "State machine pour workflow d'approbation",
    "Real-time notification system avec filtrage",
  ];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  return `Génère un challenge de code en ${stack} autour du thème: "${pattern}".

Format JSON:
{
  "title": "Titre du challenge",
  "scenario": "Description du contexte métier en 2-3 paragraphes",
  "starter_code": "Code de départ (utiliser \\n pour les retours à la ligne)",
  "steps": [
    {
      "id": "A",
      "title": "Implémentation de base",
      "instructions": "Instructions détaillées en markdown",
      "estimated_minutes": 8
    },
    {
      "id": "B",
      "title": "Gestion des cas limites",
      "instructions": "Instructions pour la gestion d'erreurs et edge cases",
      "estimated_minutes": 7
    },
    {
      "id": "C",
      "title": "Refactoring & Structure",
      "instructions": "Instructions pour refactoriser le code",
      "estimated_minutes": 8
    },
    {
      "id": "D",
      "title": "Extension & Intégration",
      "instructions": "Instructions pour étendre l'architecture",
      "estimated_minutes": 7
    }
  ],
  "visible_tests": [
    {"id": "t1", "name": "Test basique", "input": "...", "expected_output": "...", "is_hidden": false, "points": 5}
  ],
  "hidden_tests": [
    {"id": "h1", "name": "Edge case", "input": "...", "expected_output": "...", "is_hidden": true, "points": 10}
  ]
}`;
}

const CODE_REVIEW_SYSTEM_PROMPT = `Tu es un expert en code review. Génère un extrait de code (30-50 lignes) contenant exactement 5 problèmes de natures différentes.
RÈGLES:
- Réponds UNIQUEMENT avec un JSON valide
- Le code doit contenir exactement 5 problèmes: 1 bug, 1 faille sécurité, 1 problème performance, 1 problème lisibilité, 1 problème architecture
- Le code doit sembler réaliste (pas artificiellement mauvais)`;

function buildCodeReviewPrompt(stack: string): string {
  return `Génère un code review challenge en ${stack}. Le code doit être réaliste (30-50 lignes) avec 5 problèmes cachés.

Format JSON:
{
  "code": "Le code complet (utiliser \\n pour les retours à la ligne)",
  "problems": [
    {
      "type": "bug",
      "description": "Description du bug",
      "location": {"startLine": 5, "endLine": 7},
      "severity": "critical",
      "keywords": ["mot-clé1", "mot-clé2"]
    },
    {
      "type": "security",
      "description": "Description de la faille",
      "location": {"startLine": 12, "endLine": 14},
      "severity": "critical",
      "keywords": ["injection", "sanitize"]
    },
    {
      "type": "performance",
      "description": "Description du problème de performance",
      "location": {"startLine": 20, "endLine": 25},
      "severity": "major",
      "keywords": ["boucle", "complexité"]
    },
    {
      "type": "readability",
      "description": "Description du problème de lisibilité",
      "location": {"startLine": 30, "endLine": 32},
      "severity": "minor",
      "keywords": ["nommage", "commentaire"]
    },
    {
      "type": "architecture",
      "description": "Description du problème d'architecture",
      "location": {"startLine": 35, "endLine": 40},
      "severity": "major",
      "keywords": ["couplage", "responsabilité"]
    }
  ]
}`;
}

// ─── NLP SCORING (Phase 3) ───────────────────────────────────

async function computeNlpScore(
  apiKey: string,
  expectedProblems: any[],
  candidateAnswers: any[]
): Promise<{ score: number; problems_found: number; problems_total: number; nlp_matches: any[] }> {
  const prompt = `Compare les réponses du candidat avec les problèmes attendus.

PROBLÈMES ATTENDUS:
${JSON.stringify(expectedProblems, null, 2)}

RÉPONSES DU CANDIDAT:
${JSON.stringify(candidateAnswers, null, 2)}

Pour chaque problème attendu, trouve la meilleure correspondance. Évalue la similarité sémantique.

Réponds UNIQUEMENT en JSON:
{
  "matches": [
    {
      "expected_type": "bug",
      "best_match_index": 0,
      "similarity_score": 0.85,
      "type_match": true,
      "location_match": true,
      "partial_credit": 0.87
    }
  ],
  "total_score": 78,
  "problems_identified": 4
}`;

  const response = await callAI(apiKey, "Tu es un évaluateur NLP. Réponds uniquement en JSON valide.", prompt, "google/gemini-2.5-flash", 0.2);
  if (!response) throw new Error("No NLP response");

  const jsonStr = extractJson(response);
  if (!jsonStr) throw new Error("Could not parse NLP result");
  const result = JSON.parse(normalizeJsonString(jsonStr));

  return {
    score: Math.min(100, Math.max(0, result.total_score || 0)),
    problems_found: result.problems_identified || 0,
    problems_total: expectedProblems.length,
    nlp_matches: result.matches || [],
  };
}

// ─── STATIC ANALYSIS (Phase 2) ──────────────────────────────

async function computeStaticAnalysis(
  apiKey: string,
  code: string,
  stack: string
): Promise<{ overall: number; issues: any[]; summary: string }> {
  const linterMap: Record<string, string> = {
    javascript: "ESLint", typescript: "ESLint + TypeScript strict",
    python: "Pylint + mypy", java: "PMD + SpotBugs",
    go: "golangci-lint", php: "PHPStan", ruby: "RuboCop",
    csharp: "Roslyn Analyzers", rust: "Clippy", kotlin: "detekt", swift: "SwiftLint",
  };
  const linter = linterMap[stack] || "generic linter";

  const prompt = `Analyse ce code ${stack} comme ${linter}.

CODE:
\`\`\`${stack}
${code.slice(0, 5000)}
\`\`\`

Réponds UNIQUEMENT en JSON:
{
  "overall": 75,
  "criteria": {
    "cyclomatic_complexity": 80,
    "duplication": 90,
    "naming_conventions": 70,
    "error_handling": 65,
    "security": 85,
    "performance": 70
  },
  "issues": [
    {"severity": "warning", "line": 5, "rule": "no-unused-vars", "message": "Variable inutilisée"}
  ],
  "summary": "Résumé en 1-2 phrases"
}`;

  const response = await callAI(apiKey, `Tu es ${linter}. Réponds uniquement en JSON valide.`, prompt, "google/gemini-2.5-flash", 0.2);
  if (!response) throw new Error("No static analysis response");

  const jsonStr = extractJson(response);
  if (!jsonStr) throw new Error("Could not parse static analysis");
  const result = JSON.parse(normalizeJsonString(jsonStr));

  return {
    overall: Math.min(100, Math.max(0, result.overall || 50)),
    issues: result.issues || [],
    summary: result.summary || "",
  };
}
