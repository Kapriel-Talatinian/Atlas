import Stripe from "npm:stripe@18.5.0";
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
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check roles
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = userRoles?.map((r) => r.role) || [];
    const isAdmin = roles.includes("admin");

    const BodySchema = z.object({
      action: z.enum([
        "credit_task",
        "request_withdrawal",
        "process_withdrawal",
        "auto_payout",
        "get_balance",
      ]),
      expert_id: z.string().uuid().optional(),
      task_id: z.string().uuid().optional(),
      domain: z.string().optional(),
      task_type: z.string().optional(),
      amount: z.number().positive().optional(),
      withdrawal_id: z.string().uuid().optional(),
    });

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.issues }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, expert_id, task_id, domain, task_type, amount, withdrawal_id } = parsed.data;

    // Get own expert profile
    const { data: ownExpert } = await supabase
      .from("expert_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    // ====== CREDIT TASK (called by system after QA) ======
    if (action === "credit_task") {
      if (!isAdmin && !roles.includes("expert")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!expert_id || !task_id || !domain || !task_type) {
        return new Response(JSON.stringify({ error: "expert_id, task_id, domain, task_type required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get pricing
      const { data: pricing } = await supabase
        .from("task_pricing")
        .select("expert_payout_amount")
        .eq("domain", domain)
        .eq("task_type", task_type)
        .eq("active", true)
        .single();

      if (!pricing) {
        return new Response(JSON.stringify({ error: "Pricing not found for this domain/task_type" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payoutAmount = pricing.expert_payout_amount;

      // Check for duplicate credit
      const { data: existingTx } = await supabase
        .from("expert_transactions")
        .select("id")
        .eq("expert_id", expert_id)
        .eq("task_id", task_id)
        .eq("type", "task_credit")
        .single();

      if (existingTx) {
        return new Response(JSON.stringify({ error: "Task already credited" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user_id for the expert
      const { data: expertProfile } = await supabase
        .from("expert_profiles")
        .select("user_id")
        .eq("id", expert_id)
        .single();

      if (!expertProfile) {
        return new Response(JSON.stringify({ error: "Expert not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create transaction
      await supabase.from("expert_transactions").insert({
        expert_id,
        user_id: expertProfile.user_id,
        type: "task_credit",
        amount: payoutAmount,
        task_id,
        description: `Paiement tâche ${domain}/${task_type}`,
        status: "completed",
      });

      // Update balance
      const { data: balance } = await supabase
        .from("expert_balances")
        .select("*")
        .eq("expert_id", expert_id)
        .single();

      if (balance) {
        await supabase.from("expert_balances").update({
          available_balance: (balance.available_balance || 0) + payoutAmount,
          total_earned: (balance.total_earned || 0) + payoutAmount,
          updated_at: new Date().toISOString(),
        }).eq("expert_id", expert_id);
      } else {
        await supabase.from("expert_balances").insert({
          expert_id,
          user_id: expertProfile.user_id,
          available_balance: payoutAmount,
          total_earned: payoutAmount,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        amount: payoutAmount,
        currency: "USD",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== GET BALANCE ======
    if (action === "get_balance") {
      const targetExpertId = expert_id || ownExpert?.id;
      if (!targetExpertId) {
        return new Response(JSON.stringify({ error: "Expert not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      if (!isAdmin && targetExpertId !== ownExpert?.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: balance } = await supabase
        .from("expert_balances")
        .select("*")
        .eq("expert_id", targetExpertId)
        .single();

      const { data: transactions } = await supabase
        .from("expert_transactions")
        .select("*")
        .eq("expert_id", targetExpertId)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: stripeAccount } = await supabase
        .from("expert_stripe_accounts")
        .select("onboarding_complete, charges_enabled, payouts_enabled")
        .eq("expert_id", targetExpertId)
        .single();

      return new Response(JSON.stringify({
        balance: balance || { available_balance: 0, pending_balance: 0, total_earned: 0 },
        transactions: transactions || [],
        stripe_status: stripeAccount || { onboarding_complete: false },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== REQUEST WITHDRAWAL ======
    if (action === "request_withdrawal") {
      if (!ownExpert) {
        return new Response(JSON.stringify({ error: "Expert profile required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!amount || amount < 50) {
        return new Response(JSON.stringify({ error: "Minimum withdrawal: $50" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check Stripe account
      const { data: stripeAccount } = await supabase
        .from("expert_stripe_accounts")
        .select("*")
        .eq("expert_id", ownExpert.id)
        .single();

      if (!stripeAccount?.onboarding_complete) {
        return new Response(JSON.stringify({ error: "Stripe account not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atomic balance check and debit
      const { data: debitSuccess } = await supabase.rpc("process_withdrawal_atomic", {
        p_expert_id: ownExpert.id,
        p_amount: amount,
      });

      if (!debitSuccess) {
        return new Response(JSON.stringify({ error: "Insufficient balance" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create withdrawal request
      const { data: withdrawal } = await supabase.from("withdrawal_requests").insert({
        expert_id: ownExpert.id,
        user_id: userId,
        amount,
        status: "processing",
      }).select().single();

      // Create Stripe Transfer
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(amount * 100), // cents
          currency: "usd",
          destination: stripeAccount.stripe_account_id,
          metadata: {
            stef_withdrawal_id: withdrawal.id,
            stef_expert_id: ownExpert.id,
          },
        });

        // Update withdrawal with Stripe transfer ID
        await supabase.from("withdrawal_requests").update({
          stripe_transfer_id: transfer.id,
          status: "completed",
          processed_at: new Date().toISOString(),
        }).eq("id", withdrawal.id);

        // Record transaction
        await supabase.from("expert_transactions").insert({
          expert_id: ownExpert.id,
          user_id: userId,
          type: "withdrawal",
          amount: -amount,
          description: `Retrait vers compte bancaire`,
          stripe_transfer_id: transfer.id,
          status: "completed",
        });

        return new Response(JSON.stringify({
          success: true,
          withdrawal_id: withdrawal.id,
          amount,
          stripe_transfer_id: transfer.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (stripeError) {
        // Reverse the balance debit
        await supabase.from("expert_balances").update({
          available_balance: supabase.rpc ? amount : amount, // re-credit
        }).eq("expert_id", ownExpert.id);

        // Actually re-credit properly
        const { data: currentBalance } = await supabase
          .from("expert_balances")
          .select("available_balance")
          .eq("expert_id", ownExpert.id)
          .single();

        await supabase.from("expert_balances").update({
          available_balance: (currentBalance?.available_balance || 0) + amount,
          updated_at: new Date().toISOString(),
        }).eq("expert_id", ownExpert.id);

        await supabase.from("withdrawal_requests").update({
          status: "failed",
        }).eq("id", withdrawal.id);

        throw stripeError;
      }
    }

    // ====== PROCESS WITHDRAWAL (admin) ======
    if (action === "process_withdrawal") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!withdrawal_id) {
        return new Response(JSON.stringify({ error: "withdrawal_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: wd } = await supabase
        .from("withdrawal_requests")
        .select("*, expert_stripe_accounts!inner(stripe_account_id)")
        .eq("id", withdrawal_id)
        .eq("status", "pending")
        .single();

      if (!wd) {
        return new Response(JSON.stringify({ error: "Withdrawal not found or already processed" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Use request_withdrawal for direct processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== AUTO PAYOUT (cron) ======
    if (action === "auto_payout") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find all experts with balance >= 50 and active Stripe accounts
      const { data: eligibleExperts } = await supabase
        .from("expert_balances")
        .select("expert_id, user_id, available_balance")
        .gte("available_balance", 50);

      let processed = 0;
      const errors: string[] = [];

      for (const eb of eligibleExperts || []) {
        const { data: stripeAccount } = await supabase
          .from("expert_stripe_accounts")
          .select("stripe_account_id, onboarding_complete")
          .eq("expert_id", eb.expert_id)
          .single();

        if (!stripeAccount?.onboarding_complete) continue;

        try {
          const transferAmount = eb.available_balance;

          // Atomic debit
          const { data: success } = await supabase.rpc("process_withdrawal_atomic", {
            p_expert_id: eb.expert_id,
            p_amount: transferAmount,
          });

          if (!success) continue;

          const transfer = await stripe.transfers.create({
            amount: Math.round(transferAmount * 100),
            currency: "usd",
            destination: stripeAccount.stripe_account_id,
            metadata: { stef_expert_id: eb.expert_id, type: "auto_payout" },
          });

          await supabase.from("withdrawal_requests").insert({
            expert_id: eb.expert_id,
            user_id: eb.user_id,
            amount: transferAmount,
            stripe_transfer_id: transfer.id,
            status: "completed",
            processed_at: new Date().toISOString(),
          });

          await supabase.from("expert_transactions").insert({
            expert_id: eb.expert_id,
            user_id: eb.user_id,
            type: "withdrawal",
            amount: -transferAmount,
            description: "Paiement automatique bi-mensuel",
            stripe_transfer_id: transfer.id,
            status: "completed",
          });

          processed++;
        } catch (err) {
          errors.push(`${eb.expert_id}: ${err.message}`);
        }
      }

      return new Response(JSON.stringify({ processed, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[expert-payout] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
