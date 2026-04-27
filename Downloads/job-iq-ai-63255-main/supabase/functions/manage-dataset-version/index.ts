import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ActionSchema = z.object({
  action: z.enum(["create", "lock", "publish", "get_pipeline_status"]),
  version_id: z.string().uuid().optional(),
  version_name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  qa_status_filter: z.enum(["validated", "all"]).default("validated"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth - Admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json();
    const parseResult = ActionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, version_id, version_name, description, qa_status_filter } = parseResult.data;

    switch (action) {
      // ─── CREATE a new dataset version ───
      case "create": {
        if (!version_name) {
          return new Response(JSON.stringify({ error: "version_name required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get the next version number
        const { data: latestVersion } = await supabase
          .from("rlhf_dataset_versions")
          .select("version_number")
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        const nextVersion = (latestVersion?.version_number || 0) + 1;

        // Count eligible feedback (validated, not yet in a version, not locked)
        let feedbackQuery = supabase
          .from("rlhf_feedback")
          .select("id", { count: "exact", head: true })
          .is("dataset_version_id", null)
          .eq("pii_present", false);

        if (qa_status_filter === "validated") {
          feedbackQuery = feedbackQuery.eq("qa_status", "validated");
        }

        const { count: eligibleCount } = await feedbackQuery;

        // Create the version
        const { data: newVersion, error: createError } = await supabase
          .from("rlhf_dataset_versions")
          .insert({
            version_name,
            version_number: nextVersion,
            description: description || `Dataset version ${nextVersion}`,
            total_instances: 0,
            validated_instances: 0,
            is_published: false,
            is_locked: false,
            created_by: userId,
            metadata: {
              qa_filter: qa_status_filter,
              created_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (createError) throw new Error(`Failed to create version: ${createError.message}`);

        // Assign eligible feedback to this version
        let assignQuery = supabase
          .from("rlhf_feedback")
          .update({ dataset_version_id: newVersion.id })
          .is("dataset_version_id", null)
          .eq("pii_present", false);

        if (qa_status_filter === "validated") {
          assignQuery = assignQuery.eq("qa_status", "validated");
        }

        const { error: assignError } = await assignQuery;
        if (assignError) console.error("Error assigning feedback:", assignError);

        // Update counts
        const { count: totalAssigned } = await supabase
          .from("rlhf_feedback")
          .select("*", { count: "exact", head: true })
          .eq("dataset_version_id", newVersion.id);

        const { count: validatedAssigned } = await supabase
          .from("rlhf_feedback")
          .select("*", { count: "exact", head: true })
          .eq("dataset_version_id", newVersion.id)
          .eq("qa_status", "validated");

        await supabase
          .from("rlhf_dataset_versions")
          .update({
            total_instances: totalAssigned || 0,
            validated_instances: validatedAssigned || 0,
          })
          .eq("id", newVersion.id);

        console.log(`[manage-dataset-version] Created v${nextVersion} with ${totalAssigned} instances`);

        return new Response(
          JSON.stringify({
            success: true,
            version: { ...newVersion, total_instances: totalAssigned, validated_instances: validatedAssigned },
            eligible_before: eligibleCount,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── LOCK a dataset version (make immutable) ───
      case "lock": {
        if (!version_id) {
          return new Response(JSON.stringify({ error: "version_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: version } = await supabase
          .from("rlhf_dataset_versions")
          .select("*")
          .eq("id", version_id)
          .single();

        if (!version) {
          return new Response(JSON.stringify({ error: "Version not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (version.is_locked) {
          return new Response(JSON.stringify({ error: "Version already locked" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Lock all associated feedback
        const { error: lockFeedbackError } = await supabase
          .from("rlhf_feedback")
          .update({ is_locked: true })
          .eq("dataset_version_id", version_id);

        if (lockFeedbackError) console.error("Error locking feedback:", lockFeedbackError);

        // Lock the version
        const { error: lockError } = await supabase
          .from("rlhf_dataset_versions")
          .update({
            is_locked: true,
            metadata: { ...version.metadata, locked_at: new Date().toISOString(), locked_by: userId },
          })
          .eq("id", version_id);

        if (lockError) throw new Error(`Failed to lock: ${lockError.message}`);

        console.log(`[manage-dataset-version] Locked version ${version_id}`);

        return new Response(
          JSON.stringify({ success: true, locked: true, version_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── PUBLISH a dataset version ───
      case "publish": {
        if (!version_id) {
          return new Response(JSON.stringify({ error: "version_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: version } = await supabase
          .from("rlhf_dataset_versions")
          .select("*")
          .eq("id", version_id)
          .single();

        if (!version) {
          return new Response(JSON.stringify({ error: "Version not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!version.is_locked) {
          return new Response(JSON.stringify({ error: "Version must be locked before publishing" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check PII compliance - all feedback must be pii_free
        const { count: piiCount } = await supabase
          .from("rlhf_feedback")
          .select("*", { count: "exact", head: true })
          .eq("dataset_version_id", version_id)
          .eq("pii_present", true);

        if (piiCount && piiCount > 0) {
          return new Response(
            JSON.stringify({
              error: "Cannot publish: PII detected in feedback",
              pii_count: piiCount,
              action_required: "Run PII scan and remediate before publishing",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: publishError } = await supabase
          .from("rlhf_dataset_versions")
          .update({
            is_published: true,
            published_at: new Date().toISOString(),
            metadata: { ...version.metadata, published_by: userId },
          })
          .eq("id", version_id);

        if (publishError) throw new Error(`Failed to publish: ${publishError.message}`);

        console.log(`[manage-dataset-version] Published version ${version_id}`);

        return new Response(
          JSON.stringify({ success: true, published: true, version_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── GET PIPELINE STATUS ───
      case "get_pipeline_status": {
        const { count: rawCount } = await supabase
          .from("rlhf_feedback")
          .select("*", { count: "exact", head: true });

        const { count: annotatedCount } = await supabase
          .from("rlhf_feedback")
          .select("*", { count: "exact", head: true })
          .not("scores", "is", null);

        const { count: qaReviewedCount } = await supabase
          .from("rlhf_feedback")
          .select("*", { count: "exact", head: true })
          .neq("qa_status", "pending");

        const { count: validatedCount } = await supabase
          .from("rlhf_feedback")
          .select("*", { count: "exact", head: true })
          .eq("qa_status", "validated");

        const { count: lockedCount } = await supabase
          .from("rlhf_feedback")
          .select("*", { count: "exact", head: true })
          .eq("is_locked", true);

        const { data: versions } = await supabase
          .from("rlhf_dataset_versions")
          .select("*")
          .order("version_number", { ascending: false })
          .limit(10);

        return new Response(
          JSON.stringify({
            pipeline: {
              raw: rawCount || 0,
              annotated: annotatedCount || 0,
              qa_reviewed: qaReviewedCount || 0,
              validated: validatedCount || 0,
              locked: lockedCount || 0,
            },
            versions: versions || [],
            compliance: {
              pii_free_rate: rawCount ? Math.round(((rawCount - (await supabase.from("rlhf_feedback").select("*", { count: "exact", head: true }).eq("pii_present", true)).count!) / rawCount) * 100) : 100,
              consent_version: "v1.0",
              retention_policy: "standard_12_months",
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
  } catch (error) {
    console.error("[manage-dataset-version] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
