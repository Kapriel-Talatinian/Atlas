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

    const BodySchema = z.object({
      action: z.enum(["create_account", "refresh_link", "check_status"]),
    });

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = parsed.data;

    // Get expert profile
    const { data: expert } = await supabase
      .from("expert_profiles")
      .select("id, email, full_name")
      .eq("user_id", userId)
      .single();

    if (!expert) {
      return new Response(JSON.stringify({ error: "Expert profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== CREATE ACCOUNT ======
    if (action === "create_account") {
      // Check if already exists
      const { data: existing } = await supabase
        .from("expert_stripe_accounts")
        .select("*")
        .eq("expert_id", expert.id)
        .single();

      if (existing?.onboarding_complete) {
        return new Response(JSON.stringify({
          message: "Stripe account already configured",
          status: "complete",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let stripeAccountId = existing?.stripe_account_id;

      if (!stripeAccountId) {
        // Create Stripe Connect Express account
        const account = await stripe.accounts.create({
          type: "express",
          email: expert.email,
          capabilities: {
            transfers: { requested: true },
          },
          metadata: {
            stef_expert_id: expert.id,
            stef_user_id: userId,
          },
        });

        stripeAccountId = account.id;

        await supabase.from("expert_stripe_accounts").insert({
          expert_id: expert.id,
          user_id: userId,
          stripe_account_id: stripeAccountId,
        });
      }

      // Create onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${req.headers.get("origin") || "https://steftalent.fr"}/expert/earnings?stripe_refresh=true`,
        return_url: `${req.headers.get("origin") || "https://steftalent.fr"}/expert/earnings?stripe_complete=true`,
        type: "account_onboarding",
      });

      return new Response(JSON.stringify({
        onboarding_url: accountLink.url,
        stripe_account_id: stripeAccountId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== REFRESH LINK ======
    if (action === "refresh_link") {
      const { data: stripeAccount } = await supabase
        .from("expert_stripe_accounts")
        .select("stripe_account_id")
        .eq("expert_id", expert.id)
        .single();

      if (!stripeAccount) {
        return new Response(JSON.stringify({ error: "No Stripe account found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accountLink = await stripe.accountLinks.create({
        account: stripeAccount.stripe_account_id,
        refresh_url: `${req.headers.get("origin") || "https://steftalent.fr"}/expert/earnings?stripe_refresh=true`,
        return_url: `${req.headers.get("origin") || "https://steftalent.fr"}/expert/earnings?stripe_complete=true`,
        type: "account_onboarding",
      });

      return new Response(JSON.stringify({ onboarding_url: accountLink.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== CHECK STATUS ======
    if (action === "check_status") {
      const { data: stripeAccount } = await supabase
        .from("expert_stripe_accounts")
        .select("*")
        .eq("expert_id", expert.id)
        .single();

      if (!stripeAccount) {
        return new Response(JSON.stringify({ status: "not_created" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch latest status from Stripe
      const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);

      const isComplete = account.charges_enabled && account.payouts_enabled;

      // Update local record
      if (isComplete !== stripeAccount.onboarding_complete) {
        await supabase.from("expert_stripe_accounts").update({
          onboarding_complete: isComplete,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          country: account.country,
          updated_at: new Date().toISOString(),
        }).eq("id", stripeAccount.id);
      }

      return new Response(JSON.stringify({
        status: isComplete ? "complete" : "pending",
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        country: account.country,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[stripe-connect-onboarding] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
