import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BODY_SIZE = 100_000; // 100KB

interface QARequest {
  action: "assign_second_annotator" | "calculate_agreement" | "inject_gold_task" | "update_reliability" | "strict_qa_triage";
  feedback_id?: string;
  annotator_id?: string;
}

interface AIQAScores {
  effort_score: number;
  coherence_score: number;
  comment_quality_score: number;
  role_match: "match" | "adjacent" | "mismatch";
  risk_score: number;
  triage_decision: "low_risk" | "medium_risk" | "high_risk";
}

interface QAResult {
  ai_qa: AIQAScores;
  qa_recommendation: "auto_validate" | "send_to_peer_review" | "reject_or_review";
}

// ========================
// STRICT MODE QA TRIAGE
// ========================
async function performStrictQATriage(
  feedback: any,
  annotatorProfile: any,
  LOVABLE_API_KEY: string
): Promise<QAResult> {
  const systemPrompt = `You are a STRICT QA triage system for an RLHF pipeline producing sellable human feedback data.

CORE PRINCIPLES:
- Data quality > volume
- Conservative decisions are preferred
- Human disagreement is acceptable only if well-argued
- Validation does NOT equal correctness
- Statistical trust matters more than individual opinions

Your job is to evaluate the QUALITY of human feedback, not whether you personally agree with it.

Compute the following scores between 0 and 1 with STRICT thresholds:

1. effort_score
   - Penalize short, generic, or vague comments heavily
   - Require specific reasoning tied to the test content
   - Score < 0.3 for comments under 20 characters
   - Score < 0.5 for generic comments without specifics
   - Score > 0.7 only for detailed, actionable feedback

2. coherence_score
   - Strongly penalize any inconsistency between:
     - overall rating (up/neutral/down)
     - numerical scores (1-5)
     - selected issues
     - free-text comment
   - Score < 0.5 if rating contradicts comment sentiment
   - Score < 0.6 if issues don't align with scores

3. comment_quality_score
   - High score (>0.7) ONLY if:
     - Technical reasoning is present
     - Examples are cited
     - Improvement actions are suggested
   - Score < 0.4 for empty or "ok" comments

4. role_match
   - "match": Annotator's expertise directly matches job role
   - "adjacent": Related field (e.g., backend dev reviewing fullstack)
   - "mismatch": Unrelated expertise (e.g., designer reviewing backend code)

5. risk_score (STRICT RULES)
   - If role_match == "mismatch": risk_score MUST be >= 0.6
   - If effort_score < 0.5: risk_score MUST be >= 0.5
   - If coherence_score < 0.6: risk_score MUST be >= 0.5
   - Be conservative - prefer false positives over false negatives

Final classification:
- risk_score < 0.2: low_risk → auto_validate_allowed
- 0.2 <= risk_score < 0.4: medium_risk → human_peer_review_required
- risk_score >= 0.4: high_risk → reject_or_force_human_review

NEVER auto-validate borderline cases.
When in doubt, escalate to human review.

Return ONLY valid JSON, no explanations.`;

  const userPrompt = `Evaluate this RLHF feedback:

FEEDBACK DATA:
- Job Role: ${feedback.job_role}
- Job Level: ${feedback.job_level_targeted}
- Overall Rating: ${feedback.overall_rating}
- Scores: ${JSON.stringify(feedback.scores || {})}
- Issues Detected: ${JSON.stringify(feedback.issues_detected || [])}
- Comment: "${(feedback.free_text_comment || "(empty)").slice(0, 500)}"
- Preferred Action: ${feedback.preferred_action || "none"}
- Time Spent: ${feedback.time_spent_seconds || "unknown"} seconds

ANNOTATOR PROFILE:
- Role: ${annotatorProfile?.role || "unknown"}
- Seniority: ${annotatorProfile?.seniority || "unknown"}
- Experience Years: ${annotatorProfile?.experience_years || 0}
- Languages: ${JSON.stringify(annotatorProfile?.languages || [])}
- Reliability Score: ${annotatorProfile?.reliability_score || 1.0}
- Total Annotations: ${annotatorProfile?.total_annotations || 0}

Return JSON format:
{
  "ai_qa": {
    "effort_score": float,
    "coherence_score": float,
    "comment_quality_score": float,
    "role_match": "match | adjacent | mismatch",
    "risk_score": float,
    "triage_decision": "low_risk | medium_risk | high_risk"
  },
  "qa_recommendation": "auto_validate | send_to_peer_review | reject_or_review"
}`;

  try {
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
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI Gateway error:", response.status);
      return createFallbackQAResult(feedback, annotatorProfile);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return createFallbackQAResult(feedback, annotatorProfile);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return createFallbackQAResult(feedback, annotatorProfile);
    }

    const result = JSON.parse(jsonMatch[0]) as QAResult;
    return applyStrictModeRules(result, feedback, annotatorProfile);
  } catch (error) {
    console.error("QA Triage error:", error);
    return createFallbackQAResult(feedback, annotatorProfile);
  }
}

function applyStrictModeRules(result: QAResult, feedback: any, annotator: any): QAResult {
  const qa = result.ai_qa;
  if (qa.role_match === "mismatch" && qa.risk_score < 0.6) qa.risk_score = 0.6;
  if (qa.effort_score < 0.5 && qa.risk_score < 0.5) qa.risk_score = 0.5;
  if (qa.coherence_score < 0.6 && qa.risk_score < 0.5) qa.risk_score = 0.5;
  const comment = feedback.free_text_comment || "";
  if (comment.length < 20) {
    qa.effort_score = Math.min(qa.effort_score, 0.3);
    qa.risk_score = Math.max(qa.risk_score, 0.5);
  }
  if (annotator?.total_annotations < 5 && annotator?.reliability_score < 0.8) {
    qa.risk_score = Math.max(qa.risk_score, 0.4);
  }
  if (qa.risk_score < 0.2) { qa.triage_decision = "low_risk"; result.qa_recommendation = "auto_validate"; }
  else if (qa.risk_score < 0.4) { qa.triage_decision = "medium_risk"; result.qa_recommendation = "send_to_peer_review"; }
  else { qa.triage_decision = "high_risk"; result.qa_recommendation = "reject_or_review"; }
  return result;
}

function createFallbackQAResult(feedback: any, annotator: any): QAResult {
  const comment = feedback.free_text_comment || "";
  const hasComment = comment.length > 20;
  const hasScores = feedback.scores && Object.keys(feedback.scores).length > 0;
  const hasIssues = feedback.issues_detected && feedback.issues_detected.length > 0;
  return {
    ai_qa: {
      effort_score: hasComment ? 0.5 : 0.2,
      coherence_score: (hasScores && hasIssues) ? 0.5 : 0.3,
      comment_quality_score: hasComment ? 0.4 : 0.1,
      role_match: annotator ? "adjacent" : "mismatch",
      risk_score: 0.5,
      triage_decision: "medium_risk"
    },
    qa_recommendation: "send_to_peer_review"
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === Authentication - Admin only ===
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Admin role check
    const { data: roleData } = await supabase
      .from('user_roles').select('role')
      .eq('user_id', userId).eq('role', 'admin').single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Body size check ===
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const QASchema = z.object({
      action: z.enum(["assign_second_annotator", "calculate_agreement", "inject_gold_task", "update_reliability", "strict_qa_triage"]),
      feedback_id: z.string().uuid().optional(),
      annotator_id: z.string().uuid().optional(),
    });
    const rawBody = await req.json();
    const parseResult = QASchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Données invalides", details: parseResult.error.issues.map(i => i.message) }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { action, feedback_id, annotator_id } = parseResult.data;

    // === Input validation ===
    const validActions = ["assign_second_annotator", "calculate_agreement", "inject_gold_task", "update_reliability", "strict_qa_triage"];
    if (!action || !validActions.includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing QA action: ${action}`, { feedback_id, annotator_id });

    switch (action) {
      case "strict_qa_triage": {
        if (!feedback_id) throw new Error("feedback_id required");
        if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

        const { data: feedback, error: feedbackError } = await supabase
          .from("rlhf_feedback").select("*").eq("id", feedback_id).single();
        if (feedbackError || !feedback) throw new Error("Feedback not found");

        const { data: annotator } = await supabase
          .from("annotator_profiles").select("*").eq("id", feedback.annotator_id).single();

        const qaResult = await performStrictQATriage(feedback, annotator, LOVABLE_API_KEY);

        const { error: updateError } = await supabase
          .from("rlhf_feedback")
          .update({
            scores: {
              ...feedback.scores,
              ai_qa_effort: qaResult.ai_qa.effort_score,
              ai_qa_coherence: qaResult.ai_qa.coherence_score,
              ai_qa_comment_quality: qaResult.ai_qa.comment_quality_score,
              ai_qa_risk: qaResult.ai_qa.risk_score,
              ai_qa_role_match: qaResult.ai_qa.role_match,
              ai_qa_triage: qaResult.ai_qa.triage_decision,
            },
            qa_notes: `AI Triage: ${qaResult.qa_recommendation} (risk: ${(qaResult.ai_qa.risk_score * 100).toFixed(0)}%)`,
          })
          .eq("id", feedback_id);

        if (updateError) console.error("Error updating feedback:", updateError);

        if (qaResult.qa_recommendation === "auto_validate") {
          await supabase.from("rlhf_feedback").update({ qa_status: "validated", qa_reviewed_at: new Date().toISOString() }).eq("id", feedback_id);
        }

        if (qaResult.ai_qa.risk_score >= 0.8 && qaResult.ai_qa.effort_score < 0.3 && qaResult.ai_qa.coherence_score < 0.3) {
          await supabase.from("rlhf_feedback").update({
            qa_status: "rejected", qa_reviewed_at: new Date().toISOString(),
            qa_notes: `Auto-rejected: risk=${(qaResult.ai_qa.risk_score * 100).toFixed(0)}%, effort=${(qaResult.ai_qa.effort_score * 100).toFixed(0)}%`,
          }).eq("id", feedback_id);
        }

        return new Response(JSON.stringify(qaResult), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "assign_second_annotator": {
        if (!feedback_id) throw new Error("feedback_id required");

        const { data: originalFeedback, error: fetchError } = await supabase
          .from("rlhf_feedback").select("*").eq("id", feedback_id).single();
        if (fetchError || !originalFeedback) throw new Error("Feedback not found");

        const { data: availableAnnotators } = await supabase
          .from("annotator_profiles").select("id, expert_id")
          .neq("id", originalFeedback.annotator_id)
          .contains("languages", [originalFeedback.language])
          .eq("seniority", originalFeedback.job_level_targeted)
          .limit(5);

        let selected;
        if (!availableAnnotators || availableAnnotators.length === 0) {
          const { data: fallbackAnnotators } = await supabase
            .from("annotator_profiles").select("id, expert_id")
            .neq("id", originalFeedback.annotator_id).limit(5);
          if (!fallbackAnnotators || fallbackAnnotators.length === 0) throw new Error("No available annotators");
          selected = fallbackAnnotators[Math.floor(Math.random() * fallbackAnnotators.length)];
        } else {
          selected = availableAnnotators[Math.floor(Math.random() * availableAnnotators.length)];
        }

        await supabase.from("rlhf_pending_qa").upsert({ original_feedback_id: feedback_id, assigned_annotator_id: selected.id, requires_second_annotator: true });
        await supabase.from("rlhf_feedback").update({ second_annotator_id: selected.id }).eq("id", feedback_id);

        return new Response(JSON.stringify({ success: true, assigned_to: selected.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "calculate_agreement": {
        if (!feedback_id) throw new Error("feedback_id required");

        const { data: feedbacks } = await supabase
          .from("rlhf_feedback").select("*")
          .or(`id.eq.${feedback_id},original_feedback_id.eq.${feedback_id}`)
          .order("created_at", { ascending: true });

        if (!feedbacks || feedbacks.length < 2) {
          return new Response(JSON.stringify({ success: false, error: "Need two annotations to calculate agreement" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const [first, second] = feedbacks;
        let agreementPoints = 0;
        let totalPoints = 0;

        totalPoints += 3;
        if (first.overall_rating === second.overall_rating) agreementPoints += 3;
        else if (
          (first.overall_rating === "up" && second.overall_rating === "neutral") ||
          (first.overall_rating === "neutral" && second.overall_rating === "up") ||
          (first.overall_rating === "down" && second.overall_rating === "neutral") ||
          (first.overall_rating === "neutral" && second.overall_rating === "down")
        ) agreementPoints += 1.5;

        totalPoints += 2;
        if (first.preferred_action === second.preferred_action) agreementPoints += 2;

        totalPoints += 2;
        const issues1 = new Set(first.issues_detected || []);
        const issues2 = new Set(second.issues_detected || []);
        const intersection = [...issues1].filter(x => issues2.has(x));
        const union = new Set([...issues1, ...issues2]);
        if (union.size > 0) agreementPoints += 2 * (intersection.length / union.size);
        else agreementPoints += 2;

        if (first.scores && second.scores) {
          const scoreKeys = ["clarity", "relevance", "difficulty_alignment", "job_realism", "bias_risk"];
          let scoreAgreement = 0;
          let scoreCount = 0;
          for (const key of scoreKeys) {
            const s1 = first.scores[key];
            const s2 = second.scores[key];
            if (s1 !== undefined && s2 !== undefined) {
              scoreCount++;
              const diff = Math.abs(s1 - s2);
              if (diff === 0) scoreAgreement += 1;
              else if (diff === 1) scoreAgreement += 0.5;
            }
          }
          if (scoreCount > 0) {
            totalPoints += 3;
            agreementPoints += 3 * (scoreAgreement / scoreCount);
          }
        }

        const agreementScore = totalPoints > 0 ? agreementPoints / totalPoints : 0;

        await supabase.from("rlhf_feedback").update({ agreement_score: agreementScore }).in("id", [first.id, second.id]);
        await supabase.from("rlhf_pending_qa").update({ agreement_score: agreementScore, completed_at: new Date().toISOString() }).eq("original_feedback_id", feedback_id);

        return new Response(JSON.stringify({ success: true, agreement_score: agreementScore, details: { totalPoints, agreementPoints } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "inject_gold_task": {
        const { data: goldTasks } = await supabase
          .from("rlhf_gold_tasks").select("*").eq("is_active", true);
        if (!goldTasks || goldTasks.length === 0) {
          return new Response(JSON.stringify({ success: false, error: "No gold tasks available" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const randomGold = goldTasks[Math.floor(Math.random() * goldTasks.length)];
        return new Response(JSON.stringify({ success: true, gold_task: { id: randomGold.id, task_type: randomGold.task_type, job_role: randomGold.job_role, job_level: randomGold.job_level, ai_output: randomGold.ai_output } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update_reliability": {
        if (!annotator_id) throw new Error("annotator_id required");

        const { data: payments } = await supabase
          .from("annotation_payments").select("status, final_amount")
          .eq("annotator_id", annotator_id).order("created_at", { ascending: false }).limit(50);

        const totalPayments = payments?.length || 0;
        const flaggedPayments = payments?.filter((p: any) => p.status === "flagged").length || 0;
        const flagRate = totalPayments > 0 ? flaggedPayments / totalPayments : 0;
        const newReliability = Math.max(0, Math.min(1, 1 - (flagRate * 2)));

        await supabase.from("annotator_profiles").update({ reliability_score: newReliability }).eq("id", annotator_id);

        return new Response(JSON.stringify({ success: true, reliability_score: newReliability, total_reviewed: totalPayments, flagged: flaggedPayments }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error: any) {
    console.error("Error in process-rlhf-qa:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
