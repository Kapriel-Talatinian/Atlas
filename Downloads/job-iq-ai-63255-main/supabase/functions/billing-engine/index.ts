import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ─── Usage Calculation ──────────────────────────────────────────

async function getUsage(
  supabase: any,
  clientId: string,
  periodStart: string,
  periodEnd: string,
  projectId?: string
) {
  // Get client projects
  let projectQuery = supabase
    .from("annotation_projects")
    .select("id, domain, type, languages")
    .eq("client_id", clientId);

  if (projectId) {
    projectQuery = projectQuery.eq("id", projectId);
  }

  const { data: clientProjects } = await projectQuery;
  if (!clientProjects || clientProjects.length === 0) {
    return { usage: {}, subtotal: 0, total_tasks: 0, volume_discount: { percent: 0, amount: 0 }, sla_multiplier: 1.0, total: 0 };
  }

  const projectIds = clientProjects.map((p: any) => p.id);
  const projectMap = new Map(clientProjects.map((p: any) => [p.id, p]));

  // Get completed tasks
  const { data: completedTasks } = await supabase
    .from("annotation_tasks")
    .select("id, domain, source_id, completed_at")
    .in("source_id", projectIds)
    .eq("status", "completed")
    .gte("completed_at", periodStart)
    .lte("completed_at", periodEnd);

  if (!completedTasks || completedTasks.length === 0) {
    return { usage: {}, subtotal: 0, total_tasks: 0, volume_discount: { percent: 0, amount: 0 }, sla_multiplier: 1.0, total: 0 };
  }

  // Group by domain × type
  const usage: Record<string, { count: number; unit_price: number; total: number; domain: string; task_type: string }> = {};

  for (const task of completedTasks) {
    const project = projectMap.get(task.source_id);
    if (!project) continue;
    const key = `${project.domain}_${project.type}`;

    if (!usage[key]) {
      const { data: pricing } = await supabase
        .from("task_pricing")
        .select("client_unit_price")
        .eq("domain", project.domain)
        .eq("task_type", project.type)
        .eq("active", true)
        .limit(1)
        .single();

      usage[key] = { count: 0, unit_price: pricing?.client_unit_price || 0.25, total: 0, domain: project.domain, task_type: project.type };
    }

    usage[key].count++;
    usage[key].total = usage[key].count * usage[key].unit_price;
  }

  const totalTasks = Object.values(usage).reduce((s, u) => s + u.count, 0);
  const subtotal = Object.values(usage).reduce((s, u) => s + u.total, 0);

  // Volume discount
  const { data: discount } = await supabase
    .from("volume_discounts")
    .select("discount_percent")
    .lte("min_tasks", totalTasks)
    .eq("active", true)
    .order("min_tasks", { ascending: false })
    .limit(1)
    .single();

  const discountPercent = discount?.discount_percent || 0;
  const discountAmount = subtotal * (discountPercent / 100);

  // SLA multiplier
  let slaMultiplier = 1.0;
  if (projectId) {
    const { data: sla } = await supabase.from("sla_tracking").select("sla_tier").eq("project_id", projectId).single();
    if (sla?.sla_tier) {
      const { data: tier } = await supabase.from("sla_tiers").select("price_multiplier").eq("tier_name", sla.sla_tier).single();
      slaMultiplier = tier?.price_multiplier || 1.0;
    }
  }

  const total = Math.round((subtotal - discountAmount) * slaMultiplier * 100) / 100;

  return { usage, subtotal: Math.round(subtotal * 100) / 100, total_tasks: totalTasks, volume_discount: { percent: discountPercent, amount: Math.round(discountAmount * 100) / 100 }, sla_multiplier: slaMultiplier, total };
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { action } = body;

    // Auth
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let isAdmin = false;

    if (authHeader?.startsWith("Bearer ey")) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
      if (userId) {
        const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").single();
        isAdmin = !!role;
      }
    }

    switch (action) {
      case "get_usage": {
        const clientId = body.client_id;
        if (!clientId) return jsonError("client_id required", 400);

        const now = new Date();
        const periodStart = body.period_start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const periodEnd = body.period_end || now.toISOString();

        const usage = await getUsage(supabase, clientId, periodStart, periodEnd, body.project_id);
        return jsonOk({ period: { start: periodStart, end: periodEnd }, ...usage, currency: "USD" });
      }

      case "generate_invoice": {
        if (!isAdmin) return jsonError("Admin access required", 403);

        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) return jsonError("Stripe not configured", 500);

        const clientId = body.client_id;
        if (!clientId) return jsonError("client_id required", 400);

        const now = new Date();
        const periodStart = body.period_start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const periodEnd = body.period_end || now.toISOString();

        const usage = await getUsage(supabase, clientId, periodStart, periodEnd, body.project_id);
        if (usage.total <= 0) return jsonError("No billable usage", 400);

        const { data: client } = await supabase.from("clients").select("stripe_customer_id, company_name, contact_email").eq("id", clientId).single();
        if (!client) return jsonError("Client not found", 404);

        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        let stripeCustomerId = client.stripe_customer_id;
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({ name: client.company_name, email: client.contact_email, metadata: { stef_client_id: clientId } });
          stripeCustomerId = customer.id;
          await supabase.from("clients").update({ stripe_customer_id: stripeCustomerId }).eq("id", clientId);
        }

        const invoice = await stripe.invoices.create({
          customer: stripeCustomerId,
          auto_advance: true,
          collection_method: "send_invoice",
          days_until_due: 30,
          metadata: { stef_client_id: clientId, period_start: periodStart, period_end: periodEnd },
        });

        for (const [, u] of Object.entries(usage.usage)) {
          const usageItem = u as any;
          await stripe.invoiceItems.create({
            customer: stripeCustomerId,
            invoice: invoice.id,
            amount: Math.round(usageItem.total * 100),
            currency: "usd",
            description: `STEF ${usageItem.domain}/${usageItem.task_type} — ${usageItem.count} tasks × $${usageItem.unit_price}`,
          });
        }

        if (usage.volume_discount.amount > 0) {
          await stripe.invoiceItems.create({
            customer: stripeCustomerId,
            invoice: invoice.id,
            amount: -Math.round(usage.volume_discount.amount * 100),
            currency: "usd",
            description: `Volume discount (${usage.volume_discount.percent}%)`,
          });
        }

        await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(invoice.id);

        await supabase.from("client_invoices").insert({
          client_id: clientId,
          project_id: body.project_id || null,
          amount: usage.total,
          currency: "USD",
          tasks_billed: usage.total_tasks,
          stripe_invoice_id: invoice.id,
          status: "pending",
          period_start: periodStart,
          period_end: periodEnd,
        });

        return jsonOk({ invoice_id: invoice.id, amount: usage.total, currency: "USD", status: "sent", tasks_billed: usage.total_tasks });
      }

      default:
        return jsonError("Unknown action", 400);
    }
  } catch (error: any) {
    console.error("[billing-engine] Error:", error);
    return jsonError(error.message || "Internal error", 500);
  }
});

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
