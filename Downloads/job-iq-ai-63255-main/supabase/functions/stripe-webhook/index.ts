import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature!,
        Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errorMessage);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing webhook event:", event.type);

    // ====== CHECKOUT SESSION COMPLETED (client credits) ======
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // ====== PROJECT PAYMENT (deposit / intermediate / final) ======
      const stefPaymentId = session.metadata?.stef_payment_id;
      const stefProjectId = session.metadata?.stef_project_id;

      if (stefPaymentId) {
        // Mark payment as paid
        await supabase.from("project_payments").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
          overdue_since: null,
          project_paused: false,
        }).eq("id", stefPaymentId);

        const { data: payment } = await supabase
          .from("project_payments")
          .select("payment_type, percentage, amount, project_id, client_id")
          .eq("id", stefPaymentId)
          .single();

        // If deposit → activate project
        if (payment?.payment_type === "deposit" && stefProjectId) {
          await supabase.from("annotation_projects").update({
            status: "active",
          }).eq("id", stefProjectId);
          console.log("Project activated after deposit:", stefProjectId);
        }

        // If project was paused → reactivate
        if ((payment?.payment_type === "intermediate" || payment?.payment_type === "final") && stefProjectId) {
          const { data: project } = await supabase
            .from("annotation_projects")
            .select("status")
            .eq("id", stefProjectId)
            .single();

          if (project?.status === "paused") {
            await supabase.from("annotation_projects").update({
              status: "active",
            }).eq("id", stefProjectId);
            console.log("Project reactivated after payment:", stefProjectId);
          }
        }

        // === AUTO-CREATE INVOICE ===
        if (payment && stefProjectId) {
          try {
            const { data: proj } = await supabase
              .from("annotation_projects")
              .select("name, domain, type, languages, sla_tier, total_items, estimated_cost, pricing_model")
              .eq("id", stefProjectId)
              .single();

            const { data: clientData } = await supabase
              .from("clients")
              .select("company_name, address, siret, tva_number, country")
              .eq("id", payment.client_id)
              .single();

            if (proj && clientData) {
              // Determine TVA regime
              const { data: tvaInfo } = await supabase.rpc("determine_tva_regime", {
                p_client_country: clientData.country || "US",
                p_client_tva_number: clientData.tva_number || "",
              });

              const tvaRate = tvaInfo?.[0]?.rate || 0;
              const tvaMention = tvaInfo?.[0]?.mention || "Exonération de TVA — art. 259-1 du CGI";
              const tvaRegime = tvaInfo?.[0]?.regime || "hors_ue_exonere";

              const invoiceAmountHt = payment.amount;
              const tvaAmount = Math.round(invoiceAmountHt * tvaRate / 100 * 100) / 100;
              const invoiceAmountTtc = Math.round((invoiceAmountHt + tvaAmount) * 100) / 100;

              // Get previous paid payments
              const { data: prevPayments } = await supabase
                .from("project_payments")
                .select("payment_type, percentage, amount, paid_at")
                .eq("project_id", stefProjectId)
                .eq("status", "paid")
                .neq("id", stefPaymentId)
                .order("created_at", { ascending: true });

              // Generate invoice number
              const { data: invNumber } = await supabase.rpc("generate_sequential_invoice_number");

              const pricingModel = (proj.pricing_model || {}) as any;

              await supabase.from("invoices").insert({
                invoice_number: invNumber || `STEF-${new Date().getFullYear()}-0000`,
                project_id: stefProjectId,
                client_id: payment.client_id,
                payment_id: stefPaymentId,
                payment_type: payment.payment_type,
                percentage: payment.percentage,
                project_total_ht: proj.estimated_cost || payment.amount / (payment.percentage / 100),
                invoice_amount_ht: invoiceAmountHt,
                tva_rate: tvaRate,
                tva_amount: tvaAmount,
                invoice_amount_ttc: invoiceAmountTtc,
                currency: "USD",
                tva_regime: tvaRegime,
                tva_mention: tvaMention,
                project_name: proj.name,
                domain: proj.domain,
                task_type: proj.type,
                language: (proj.languages || ["en"])[0],
                sla_tier: proj.sla_tier || "standard",
                num_tasks: proj.total_items || 0,
                unit_price_ht: pricingModel?.unit_price || 0,
                volume_discount_percent: pricingModel?.volume_discount || 0,
                sla_multiplier: pricingModel?.sla_multiplier || 1.0,
                client_name: clientData.company_name || "",
                client_address: clientData.address || "",
                client_siret: clientData.siret || "",
                client_tva_number: clientData.tva_number || "",
                previous_payments: prevPayments || [],
                status: "paid",
                paid_at: new Date().toISOString(),
                issued_at: new Date().toISOString(),
                due_date: new Date().toISOString(),
              });

              console.log("Invoice auto-created for payment:", stefPaymentId);
            }
          } catch (invErr) {
            console.error("Failed to auto-create invoice:", invErr);
          }
        }

        console.log("Project payment received:", stefPaymentId);
      }

      // ====== LEGACY: CREDITS ======
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits || "0");

      if (userId && credits) {
        const { data: currentCredits } = await supabase
          .from("company_credits")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (currentCredits) {
          const newTotalCredits = (currentCredits.total_credits || 0) + credits;
          await supabase.from("company_credits").update({
            total_credits: newTotalCredits,
            available_credits: newTotalCredits - (currentCredits.used_credits || 0),
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);
        }
        console.log("Credits added:", { userId, credits });
      }
    }

    // ====== STRIPE CONNECT: ACCOUNT UPDATED ======
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const stripeAccountId = account.id;

      await supabase.from("expert_stripe_accounts").update({
        onboarding_complete: account.charges_enabled && account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        country: account.country,
        updated_at: new Date().toISOString(),
      }).eq("stripe_account_id", stripeAccountId);

      console.log("Stripe account updated:", stripeAccountId);
    }

    // ====== TRANSFER FAILED ======
    if (event.type === "transfer.failed") {
      const transfer = event.data.object as Stripe.Transfer;
      const withdrawalId = transfer.metadata?.stef_withdrawal_id;
      const expertId = transfer.metadata?.stef_expert_id;

      if (withdrawalId) {
        await supabase.from("withdrawal_requests").update({
          status: "failed",
        }).eq("id", withdrawalId);

        // Re-credit the expert balance
        if (expertId) {
          const amount = transfer.amount / 100;
          const { data: balance } = await supabase
            .from("expert_balances")
            .select("available_balance")
            .eq("expert_id", expertId)
            .single();

          if (balance) {
            await supabase.from("expert_balances").update({
              available_balance: (balance.available_balance || 0) + amount,
              updated_at: new Date().toISOString(),
            }).eq("expert_id", expertId);
          }
        }

        console.log("Transfer failed, balance re-credited:", withdrawalId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
