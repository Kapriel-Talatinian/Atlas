import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  try {
    const body = await req.json();
    const { action } = body;

    // Auth - get user
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let clientId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;

      if (userId) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        clientId = clientData?.id || null;
      }
    }

    switch (action) {
      case "create_checkout": {
        if (!clientId) {
          return new Response(JSON.stringify({ error: "Non authentifié" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: payment } = await supabase
          .from("project_payments")
          .select("*, annotation_projects(name)")
          .eq("id", body.payment_id)
          .eq("client_id", clientId)
          .single();

        if (!payment) {
          return new Response(JSON.stringify({ error: "Paiement introuvable" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (payment.status === "paid") {
          return new Response(JSON.stringify({ error: "Ce paiement a déjà été effectué." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get or create Stripe customer
        const { data: client } = await supabase
          .from("clients")
          .select("stripe_customer_id, name, contact_email")
          .eq("id", clientId)
          .single();

        let customerId = client?.stripe_customer_id;
        if (!customerId) {
          const customer = await stripe.customers.create({
            name: client?.name || "",
            email: client?.contact_email || "",
            metadata: { stef_client_id: clientId },
          });
          customerId = customer.id;
          await supabase.from("clients").update({ stripe_customer_id: customerId }).eq("id", clientId);
        }

        const typeLabels: Record<string, string> = {
          deposit: "Acompte",
          intermediate: "Paiement intermédiaire",
          final: "Solde final",
        };

        const origin = req.headers.get("origin") || "https://steftalent.fr";

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: {
                name: `STEF — ${typeLabels[payment.payment_type]} (${payment.percentage}%)`,
                description: `Projet : ${payment.annotation_projects?.name || "—"}`,
              },
              unit_amount: Math.round(payment.amount * 100),
            },
            quantity: 1,
          }],
          metadata: {
            stef_payment_id: payment.id,
            stef_project_id: payment.project_id,
            stef_client_id: clientId,
            payment_type: payment.payment_type,
          },
          success_url: `${origin}/client/projects/${payment.project_id}?payment=success`,
          cancel_url: `${origin}/client/projects/${payment.project_id}?payment=cancelled`,
        });

        await supabase.from("project_payments").update({
          stripe_checkout_session_id: session.id,
        }).eq("id", payment.id);

        return new Response(JSON.stringify({ checkout_url: session.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_milestone": {
        const { data: project } = await supabase
          .from("annotation_projects")
          .select("total_items, completed_tasks, client_id")
          .eq("id", body.project_id)
          .single();

        if (!project) {
          return new Response(JSON.stringify({ error: "Projet introuvable" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const totalTasks = project.total_items || 1;
        const progress = (project.completed_tasks || 0) / totalTasks;

        // Check intermediate payment at 50%
        if (progress >= 0.50) {
          const { data: intPayment } = await supabase
            .from("project_payments")
            .select("*")
            .eq("project_id", body.project_id)
            .eq("payment_type", "intermediate")
            .eq("triggered", false)
            .maybeSingle();

          if (intPayment) {
            await supabase.from("project_payments").update({
              triggered: true,
              triggered_at: new Date().toISOString(),
              status: "triggered",
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            }).eq("id", intPayment.id);
          }
        }

        // Check final payment at 100%
        if (progress >= 1.0) {
          const { data: finalPayment } = await supabase
            .from("project_payments")
            .select("*")
            .eq("project_id", body.project_id)
            .eq("payment_type", "final")
            .eq("triggered", false)
            .maybeSingle();

          if (finalPayment) {
            await supabase.from("project_payments").update({
              triggered: true,
              triggered_at: new Date().toISOString(),
              status: "triggered",
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            }).eq("id", finalPayment.id);
          }
        }

        return new Response(JSON.stringify({ checked: true, progress }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "handle_overdue": {
        const { data: overduePayments } = await supabase
          .from("project_payments")
          .select("*, annotation_projects(name, client_id, status)")
          .eq("status", "triggered")
          .lt("due_date", new Date().toISOString());

        for (const payment of overduePayments || []) {
          await supabase.from("project_payments").update({
            status: "overdue",
            overdue_since: payment.overdue_since || new Date().toISOString(),
          }).eq("id", payment.id);

          const overdueDays = Math.floor(
            (Date.now() - new Date(payment.due_date).getTime()) / (24 * 60 * 60 * 1000)
          );

          // Pause project after 7 days overdue
          if (overdueDays >= 7 && !payment.project_paused) {
            await supabase.from("annotation_projects").update({
              status: "paused" as any,
            }).eq("id", payment.project_id);

            await supabase.from("project_payments").update({
              project_paused: true,
            }).eq("id", payment.id);

            console.log(`Project ${payment.project_id} paused for non-payment`);
          }
        }

        return new Response(JSON.stringify({ processed: overduePayments?.length || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_status": {
        const projectId = body.project_id;
        const filterClientId = clientId;

        let query = supabase
          .from("project_payments")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });

        if (filterClientId) {
          query = query.eq("client_id", filterClientId);
        }

        const { data: payments } = await query;

        const totalPaid = payments?.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
        const totalDue = payments?.filter((p: any) => ["triggered", "overdue"].includes(p.status)).reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
        const totalPending = payments?.filter((p: any) => p.status === "pending").reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

        return new Response(JSON.stringify({
          payments: payments?.map((p: any) => ({
            id: p.id,
            type: p.payment_type,
            percentage: p.percentage,
            amount: p.amount,
            status: p.status,
            trigger_condition: p.trigger_condition,
            due_date: p.due_date,
            paid_at: p.paid_at,
            overdue_since: p.overdue_since,
          })),
          summary: { total_paid: totalPaid, total_due: totalDue, total_pending: totalPending, total: totalPaid + totalDue + totalPending },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Action inconnue" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Payment handler error:", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
