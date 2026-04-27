import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: userRoles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = userRoles?.some(r => r.role === "admin");

    const BodySchema = z.object({
      action: z.enum(["estimate", "get_pricing", "update_pricing", "get_discounts"]),
      domain: z.string().optional(),
      task_type: z.string().optional(),
      language: z.string().optional(),
      num_tasks: z.number().int().positive().optional(),
      client_plan: z.string().optional(),
      llm_mode: z.enum(["standard", "sovereign"]).optional(),
      pricing_id: z.string().uuid().optional(),
      client_unit_price: z.number().positive().optional(),
      expert_payout: z.number().positive().optional(),
    });

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.issues }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, domain, task_type, language, num_tasks, client_plan, llm_mode, pricing_id, client_unit_price, expert_payout } = parsed.data;

    // ====== ESTIMATE ======
    if (action === "estimate") {
      if (!domain || !task_type || !num_tasks) {
        return new Response(JSON.stringify({ error: "domain, task_type, num_tasks required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const lang = language || "fr";
      const plan = client_plan || "pay_per_task";

      const { data: estimate, error: estErr } = await supabase.rpc("estimate_project_cost", {
        p_domain: domain,
        p_task_type: task_type,
        p_language: lang,
        p_num_tasks: num_tasks,
        p_client_plan: plan,
      });

      if (estErr) {
        return new Response(JSON.stringify({ error: estErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const row = Array.isArray(estimate) ? estimate[0] : estimate;

      // Apply sovereign multiplier if applicable
      const sovereignMult = llm_mode === "sovereign" ? 1.20 : 1.0;
      const adjustedTotal = Math.round(row.total_before_tax * sovereignMult * 100) / 100;
      const adjustedUnit = Math.round(row.discounted_unit_price * sovereignMult * 100) / 100;

      // Estimate delivery
      const { data: deliveryData } = await supabase.rpc("estimate_delivery_days", {
        p_domain: domain,
        p_num_tasks: num_tasks,
        p_annotators_per_task: domain === "medical" ? 3 : 2,
      });

      return new Response(JSON.stringify({
        unit_price: row.unit_price,
        volume_discount: `${row.volume_discount_percent}%`,
        plan_discount: `${row.plan_discount_percent}%`,
        final_unit_price: adjustedUnit,
        total_estimate: adjustedTotal,
        expert_cost: row.expert_cost_total,
        stef_margin: Math.round((adjustedTotal - row.expert_cost_total) * 100) / 100,
        margin_percent: `${Math.round(((adjustedTotal - row.expert_cost_total) / adjustedTotal) * 1000) / 10}%`,
        estimated_delivery_days: deliveryData || 7,
        currency: "USD",
        llm_mode: llm_mode || "standard",
        sovereign_multiplier: sovereignMult,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== GET PRICING ======
    if (action === "get_pricing") {
      const { data: pricing } = await supabase
        .from("task_pricing")
        .select("*")
        .eq("active", true)
        .order("domain")
        .order("task_type");

      return new Response(JSON.stringify({ pricing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== UPDATE PRICING (admin) ======
    if (action === "update_pricing") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!pricing_id) {
        return new Response(JSON.stringify({ error: "pricing_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (client_unit_price !== undefined) updates.client_unit_price = client_unit_price;
      if (expert_payout !== undefined) updates.expert_payout = expert_payout;

      const { error } = await supabase.from("task_pricing").update(updates).eq("id", pricing_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== GET DISCOUNTS ======
    if (action === "get_discounts") {
      const { data: discounts } = await supabase
        .from("volume_discounts")
        .select("*")
        .eq("active", true)
        .order("min_tasks");

      const { data: plans } = await supabase
        .from("client_plans")
        .select("*")
        .eq("active", true);

      return new Response(JSON.stringify({ discounts, plans }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[pricing-engine] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
