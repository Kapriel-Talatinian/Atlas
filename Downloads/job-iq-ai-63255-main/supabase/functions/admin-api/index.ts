import { createClient } from "npm:@supabase/supabase-js@2";

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

async function auditLog(supabase: any, userId: string, action: string, entityType: string, entityId: string, data?: any) {
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    new_value: data || {},
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = await req.json();

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ey")) {
      return jsonError("Authentication required", 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return jsonError("Invalid token", 401);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return jsonError("Admin access required", 403);

    const { action } = body;

    switch (action) {
      // ═══════════════════════════════════════════════════════════
      // DASHBOARD_KPIS
      // ═══════════════════════════════════════════════════════════
      case "dashboard_kpis": {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

        const { data: revenueData } = await supabase.from("client_invoices").select("amount").gte("created_at", monthStart).eq("status", "paid");
        const revenue = revenueData?.reduce((s: number, i: any) => s + i.amount, 0) || 0;

        const { data: prevRevenueData } = await supabase.from("client_invoices").select("amount").gte("created_at", prevMonthStart).lt("created_at", monthStart).eq("status", "paid");
        const prevRevenue = prevRevenueData?.reduce((s: number, i: any) => s + i.amount, 0) || 0;

        const { count: tasksThisMonth } = await supabase.from("annotation_tasks").select("*", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", monthStart);

        const { data: activeExpertData } = await supabase.from("expert_annotations").select("expert_id").gte("created_at", monthStart);
        const activeExperts = new Set((activeExpertData || []).map((e: any) => e.expert_id)).size;

        const { count: activeClients } = await supabase.from("annotation_projects").select("*", { count: "exact", head: true }).in("status", ["active", "in_progress"]);

        const { data: alphaData } = await supabase.from("alpha_reports").select("overall_alpha").gte("computed_at", monthStart);
        const meanAlpha = alphaData?.length ? alphaData.reduce((s: number, a: any) => s + a.overall_alpha, 0) / alphaData.length : 0;

        const { count: pendingQA } = await supabase.from("human_review_queue").select("*", { count: "exact", head: true }).eq("status", "pending");

        const { data: llmCosts } = await supabase.from("llm_call_logs").select("cost_usd").gte("created_at", monthStart);
        const totalLLMCost = llmCosts?.reduce((s: number, l: any) => s + (l.cost_usd || 0), 0) || 0;

        const { data: expertCosts } = await supabase.from("annotation_payments").select("base_amount, bonus_amount").eq("status", "approved").gte("approved_at", monthStart);
        const totalExpertCost = expertCosts?.reduce((s: number, t: any) => s + (t.base_amount || 0) + (t.bonus_amount || 0), 0) || 0;

        return jsonOk({
          revenue: { current: revenue, previous: prevRevenue, delta_percent: prevRevenue > 0 ? (((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null },
          tasks_completed: tasksThisMonth,
          active_experts: activeExperts,
          active_clients: activeClients,
          mean_alpha: Math.round(meanAlpha * 10000) / 10000,
          pending_qa: pendingQA,
          costs: { llm: Math.round(totalLLMCost * 100) / 100, experts: Math.round(totalExpertCost * 100) / 100, total: Math.round((totalLLMCost + totalExpertCost) * 100) / 100 },
          margin: revenue > 0 ? Math.round(((revenue - totalLLMCost - totalExpertCost) / revenue) * 100 * 10) / 10 : 0,
        });
      }

      // ═══════════════════════════════════════════════════════════
      // SUSPEND_EXPERT
      // ═══════════════════════════════════════════════════════════
      case "suspend_expert": {
        const { expert_id, duration_days, reason } = body;
        if (!expert_id || !duration_days || !reason) return jsonError("expert_id, duration_days, reason required", 400);

        const suspendUntil = new Date(Date.now() + duration_days * 86400000).toISOString();
        await supabase.from("annotator_profiles").update({ suspended_until: suspendUntil, suspension_reason: reason, is_active: false }).eq("id", expert_id);
        await supabase.from("task_assignments").update({ status: "expired" }).eq("expert_id", expert_id).eq("status", "assigned");
        await auditLog(supabase, user.id, "expert.suspended", "expert", expert_id, { duration_days, reason, suspended_until: suspendUntil });
        return jsonOk({ suspended: true, until: suspendUntil });
      }

      // ═══════════════════════════════════════════════════════════
      // REVOKE_CERTIFICATION
      // ═══════════════════════════════════════════════════════════
      case "revoke_certification": {
        const { expert_id: certExpertId, domain } = body;
        if (!certExpertId || !domain) return jsonError("expert_id and domain required", 400);
        await supabase.from("annotator_domain_certifications").update({ status: "revoked" }).eq("expert_id", certExpertId).eq("domain", domain);
        await auditLog(supabase, user.id, "certification.revoked", "certification", certExpertId, { domain });
        return jsonOk({ revoked: true });
      }

      // ═══════════════════════════════════════════════════════════
      // PLATFORM_STATS
      // ═══════════════════════════════════════════════════════════
      case "platform_stats": {
        const { data: stats } = await supabase.rpc("get_platform_stats");
        return jsonOk(stats || {});
      }

      // ═══════════════════════════════════════════════════════════
      // LIST_FLAGGED_TASKS
      // ═══════════════════════════════════════════════════════════
      case "list_flagged_tasks": {
        const page = body.page || 1;
        const perPage = Math.min(body.per_page || 20, 100);
        const offset = (page - 1) * perPage;
        const { data, count } = await supabase.from("human_review_queue").select("*, annotation_tasks(domain, source_id)", { count: "exact" }).eq("status", body.status || "pending").order("created_at", { ascending: false }).range(offset, offset + perPage - 1);
        return jsonOk({ data: data || [], pagination: { page, per_page: perPage, total: count } });
      }

      // ═══════════════════════════════════════════════════════════
      // LLM_COST_REPORT
      // ═══════════════════════════════════════════════════════════
      case "llm_cost_report": {
        const days = body.days || 30;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const { data: logs } = await supabase.from("llm_call_logs").select("model_id, model_name, purpose, cost_usd, input_tokens, output_tokens, latency_ms, success").gte("created_at", since);
        if (!logs || logs.length === 0) return jsonOk({ total_cost: 0, total_calls: 0, by_model: {}, by_purpose: {} });

        const byModel: Record<string, any> = {};
        const byPurpose: Record<string, any> = {};
        for (const log of logs) {
          if (!byModel[log.model_name]) byModel[log.model_name] = { calls: 0, cost: 0, avg_latency: 0 };
          byModel[log.model_name].calls++;
          byModel[log.model_name].cost += log.cost_usd || 0;
          byModel[log.model_name].avg_latency += log.latency_ms || 0;
          if (!byPurpose[log.purpose]) byPurpose[log.purpose] = { calls: 0, cost: 0 };
          byPurpose[log.purpose].calls++;
          byPurpose[log.purpose].cost += log.cost_usd || 0;
        }
        for (const m of Object.values(byModel)) { m.avg_latency = Math.round(m.avg_latency / m.calls); m.cost = Math.round(m.cost * 100) / 100; }
        for (const p of Object.values(byPurpose)) { p.cost = Math.round(p.cost * 100) / 100; }

        return jsonOk({
          total_cost: Math.round(logs.reduce((s: number, l: any) => s + (l.cost_usd || 0), 0) * 100) / 100,
          total_calls: logs.length,
          success_rate: Math.round((logs.filter((l: any) => l.success).length / logs.length) * 100),
          by_model: byModel,
          by_purpose: byPurpose,
        });
      }

      // ═══════════════════════════════════════════════════════════
      // PAUSE_PROJECT
      // ═══════════════════════════════════════════════════════════
      case "pause_project": {
        const { project_id, reason } = body;
        if (!project_id || !reason || reason.length < 20) return jsonError("project_id and reason (min 20 chars) required", 400);

        await supabase.from("annotation_projects").update({ status: "paused" }).eq("id", project_id);
        await supabase.from("task_assignments").update({ status: "expired" }).eq("project_id", project_id).eq("status", "assigned");
        await supabase.from("annotation_tasks").update({ status: "pending" }).eq("source_id", project_id).eq("status", "assigned");
        await auditLog(supabase, user.id, "project.paused_manual", "project", project_id, { reason });
        return jsonOk({ paused: true });
      }

      // ═══════════════════════════════════════════════════════════
      // REACTIVATE_PROJECT
      // ═══════════════════════════════════════════════════════════
      case "reactivate_project": {
        const { project_id } = body;
        if (!project_id) return jsonError("project_id required", 400);
        await supabase.from("annotation_projects").update({ status: "active" }).eq("id", project_id);
        await auditLog(supabase, user.id, "project.reactivated", "project", project_id);
        return jsonOk({ reactivated: true });
      }

      // ═══════════════════════════════════════════════════════════
      // DELETE_PROJECT
      // ═══════════════════════════════════════════════════════════
      case "delete_project": {
        const { project_id, confirmation_name } = body;
        if (!project_id || !confirmation_name) return jsonError("project_id and confirmation_name required", 400);

        const { data: project } = await supabase.from("annotation_projects").select("name").eq("id", project_id).single();
        if (!project || project.name !== confirmation_name) return jsonError("Confirmation name does not match", 400);

        // Cascade deletions
        await supabase.from("task_assignments").delete().eq("project_id", project_id);
        await supabase.from("expert_annotations").delete().eq("project_id", project_id);
        await supabase.from("annotations").delete().eq("project_id", project_id);
        await supabase.from("annotation_items").delete().eq("project_id", project_id);
        await supabase.from("annotation_alerts").delete().eq("project_id", project_id);
        await supabase.from("annotation_batches").delete().eq("project_id", project_id);
        await supabase.from("annotation_quality_reports").delete().eq("project_id", project_id);
        await supabase.from("annotation_exports").delete().eq("project_id", project_id);
        await supabase.from("sla_tracking").delete().eq("project_id", project_id);
        await supabase.from("annotation_tasks").delete().eq("source_id", project_id);
        await supabase.from("project_payments").update({ status: "cancelled" }).eq("project_id", project_id);
        await supabase.from("annotation_projects").delete().eq("id", project_id);

        await auditLog(supabase, user.id, "project.deleted", "project", project_id, { name: confirmation_name });
        return jsonOk({ deleted: true });
      }

      // ═══════════════════════════════════════════════════════════
      // UPDATE_PROJECT
      // ═══════════════════════════════════════════════════════════
      case "update_project": {
        const { project_id, updates } = body;
        if (!project_id || !updates) return jsonError("project_id and updates required", 400);

        const allowed: Record<string, any> = {};
        if (updates.name) allowed.name = updates.name;
        if (updates.description !== undefined) allowed.description = updates.description;
        if (updates.sla_tier) allowed.sla_tier = updates.sla_tier;

        if (Object.keys(allowed).length === 0) return jsonError("No valid fields to update", 400);

        await supabase.from("annotation_projects").update(allowed).eq("id", project_id);
        await auditLog(supabase, user.id, "project.updated", "project", project_id, allowed);
        return jsonOk({ updated: true });
      }

      // ═══════════════════════════════════════════════════════════
      // LIST_CLIENTS
      // ═══════════════════════════════════════════════════════════
      case "list_clients": {
        const { data: clients } = await supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(500);
        
        const clientIds = clients?.map((c: any) => c.id) || [];
        const { data: projects } = await supabase.from("annotation_projects").select("client_id, status").in("client_id", clientIds);
        const { data: invoices } = await supabase.from("client_invoices").select("client_id, amount, status").in("client_id", clientIds);

        const enriched = clients?.map((c: any) => {
          const cProjects = projects?.filter((p: any) => p.client_id === c.id) || [];
          const cInvoices = invoices?.filter((i: any) => i.client_id === c.id) || [];
          return {
            ...c,
            active_projects: cProjects.filter((p: any) => p.status === "active").length,
            total_projects: cProjects.length,
            total_spent: cInvoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.amount, 0),
            pending_amount: cInvoices.filter((i: any) => i.status === "pending").reduce((s: number, i: any) => s + i.amount, 0),
          };
        }) || [];

        return jsonOk({ clients: enriched });
      }

      // ═══════════════════════════════════════════════════════════
      // GET_CLIENT
      // ═══════════════════════════════════════════════════════════
      case "get_client": {
        const { client_id } = body;
        if (!client_id) return jsonError("client_id required", 400);

        const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).single();
        if (!client) return jsonError("Client not found", 404);

        const { data: projects } = await supabase.from("annotation_projects").select("id, name, status, domain, type, created_at").eq("client_id", client_id).order("created_at", { ascending: false });
        const { data: invoices } = await supabase.from("client_invoices").select("*").eq("client_id", client_id).order("created_at", { ascending: false });
        const { data: apiKeys } = await supabase.from("api_keys").select("id, key_prefix, created_at, last_used_at, is_active").eq("client_id", client_id);

        return jsonOk({ client, projects: projects || [], invoices: invoices || [], api_keys: apiKeys || [] });
      }

      // ═══════════════════════════════════════════════════════════
      // DISABLE_CLIENT
      // ═══════════════════════════════════════════════════════════
      case "disable_client": {
        const { client_id, reason } = body;
        if (!client_id || !reason) return jsonError("client_id and reason required", 400);

        await supabase.from("clients").update({ disabled_reason: reason, disabled_at: new Date().toISOString() }).eq("id", client_id);
        await supabase.from("annotation_projects").update({ status: "paused" }).eq("client_id", client_id).eq("status", "active");
        await supabase.from("api_keys").update({ is_active: false }).eq("client_id", client_id);
        await auditLog(supabase, user.id, "client.disabled", "client", client_id, { reason });
        return jsonOk({ disabled: true });
      }

      // ═══════════════════════════════════════════════════════════
      // ENABLE_CLIENT
      // ═══════════════════════════════════════════════════════════
      case "enable_client": {
        const { client_id } = body;
        if (!client_id) return jsonError("client_id required", 400);
        await supabase.from("clients").update({ disabled_reason: null, disabled_at: null }).eq("id", client_id);
        await supabase.from("api_keys").update({ is_active: true }).eq("client_id", client_id);
        await auditLog(supabase, user.id, "client.enabled", "client", client_id);
        return jsonOk({ enabled: true });
      }

      // ═══════════════════════════════════════════════════════════
      // UPDATE_CLIENT
      // ═══════════════════════════════════════════════════════════
      case "update_client": {
        const { client_id, updates } = body;
        if (!client_id || !updates) return jsonError("client_id and updates required", 400);

        const allowed: Record<string, any> = {};
        if (updates.company_name !== undefined) allowed.company_name = updates.company_name;
        if (updates.contact_name !== undefined) allowed.contact_name = updates.contact_name;
        if (updates.contact_email !== undefined) allowed.contact_email = updates.contact_email;

        if (Object.keys(allowed).length === 0) return jsonError("No valid fields to update", 400);

        await supabase.from("clients").update(allowed).eq("id", client_id);
        await auditLog(supabase, user.id, "client.updated", "client", client_id, allowed);
        return jsonOk({ updated: true });
      }

      // ═══════════════════════════════════════════════════════════
      // DELETE_CLIENT
      // ═══════════════════════════════════════════════════════════
      case "delete_client": {
        const { client_id, confirmation_name } = body;
        if (!client_id || !confirmation_name) return jsonError("client_id and confirmation_name required", 400);

        const { data: client } = await supabase.from("clients").select("company_name").eq("id", client_id).single();
        if (!client || client.company_name !== confirmation_name) return jsonError("Confirmation name does not match", 400);

        // Get all client projects and delete them
        const { data: projects } = await supabase.from("annotation_projects").select("id").eq("client_id", client_id);
        for (const p of (projects || [])) {
          await supabase.from("task_assignments").delete().eq("project_id", p.id);
          await supabase.from("annotations").delete().eq("project_id", p.id);
          await supabase.from("annotation_items").delete().eq("project_id", p.id);
          await supabase.from("annotation_alerts").delete().eq("project_id", p.id);
          await supabase.from("annotation_batches").delete().eq("project_id", p.id);
          await supabase.from("annotation_tasks").delete().eq("source_id", p.id);
          await supabase.from("sla_tracking").delete().eq("project_id", p.id);
          await supabase.from("annotation_projects").delete().eq("id", p.id);
        }

        // Mark invoices as client_deleted (keep for legal)
        await supabase.from("client_invoices").update({ status: "client_deleted" }).eq("client_id", client_id);
        await supabase.from("api_keys").delete().eq("client_id", client_id);
        await supabase.from("webhook_configs").delete().eq("client_id", client_id);
        await supabase.from("clients").delete().eq("id", client_id);

        await auditLog(supabase, user.id, "client.deleted", "client", client_id, { company: confirmation_name });
        return jsonOk({ deleted: true });
      }

      // ═══════════════════════════════════════════════════════════
      // REVOKE_CLIENT_API_KEY
      // ═══════════════════════════════════════════════════════════
      case "revoke_client_api_key": {
        const { api_key_id } = body;
        if (!api_key_id) return jsonError("api_key_id required", 400);
        await supabase.from("api_keys").update({ is_active: false, key_hash: null, key_prefix: null }).eq("id", api_key_id);
        await auditLog(supabase, user.id, "api_key.revoked", "api_key", api_key_id);
        return jsonOk({ revoked: true });
      }

      // ═══════════════════════════════════════════════════════════
      // BAN_EXPERT
      // ═══════════════════════════════════════════════════════════
      case "ban_expert": {
        const { expert_id, reason } = body;
        if (!expert_id || !reason) return jsonError("expert_id and reason required", 400);

        await supabase.from("annotator_profiles").update({
          suspended_until: null,
          suspension_reason: reason,
          is_active: false,
          is_qualified: false,
        }).eq("id", expert_id);

        await supabase.from("task_assignments").update({ status: "expired" }).eq("expert_id", expert_id).eq("status", "assigned");
        await supabase.from("annotation_tasks").update({ status: "pending", assigned_annotator_id: null }).eq("assigned_annotator_id", expert_id).eq("status", "assigned");

        await auditLog(supabase, user.id, "expert.banned", "expert", expert_id, { reason });
        return jsonOk({ banned: true });
      }

      // ═══════════════════════════════════════════════════════════
      // LIFT_SUSPENSION
      // ═══════════════════════════════════════════════════════════
      case "lift_suspension": {
        const { expert_id } = body;
        if (!expert_id) return jsonError("expert_id required", 400);

        await supabase.from("annotator_profiles").update({
          suspended_until: null,
          suspension_reason: null,
          is_active: true,
        }).eq("id", expert_id);

        await auditLog(supabase, user.id, "expert.suspension_lifted", "expert", expert_id);
        return jsonOk({ lifted: true });
      }

      // ═══════════════════════════════════════════════════════════
      // DELETE_EXPERT
      // ═══════════════════════════════════════════════════════════
      case "delete_expert": {
        const { expert_id, confirmation_email } = body;
        if (!expert_id || !confirmation_email) return jsonError("expert_id and confirmation_email required", 400);

        const { data: profile } = await supabase.from("annotator_profiles").select("expert_id").eq("id", expert_id).single();
        if (profile?.expert_id) {
          const { data: ep } = await supabase.from("expert_profiles").select("email").eq("id", profile.expert_id).single();
          if (ep?.email !== confirmation_email) return jsonError("Email does not match", 400);
        }

        // Anonymize annotations (keep data, remove identity)
        await supabase.from("annotations").update({ annotator_id: expert_id }).eq("annotator_id", expert_id);
        await supabase.from("annotator_domain_certifications").delete().eq("expert_id", expert_id);
        await supabase.from("task_assignments").delete().eq("expert_id", expert_id);
        await supabase.from("annotation_payments").delete().eq("annotator_id", expert_id);
        await supabase.from("annotation_warnings").delete().eq("annotator_id", expert_id);
        await supabase.from("annotator_profiles").delete().eq("id", expert_id);

        if (profile?.expert_id) {
          await supabase.from("expert_profiles").delete().eq("id", profile.expert_id);
        }

        await auditLog(supabase, user.id, "expert.deleted", "expert", expert_id);
        return jsonOk({ deleted: true });
      }

      // ═══════════════════════════════════════════════════════════
      // REASSIGN_EXPERT_TASKS
      // ═══════════════════════════════════════════════════════════
      case "reassign_expert_tasks": {
        const { expert_id } = body;
        if (!expert_id) return jsonError("expert_id required", 400);

        await supabase.from("task_assignments").update({ status: "expired" }).eq("expert_id", expert_id).eq("status", "assigned");
        await supabase.from("annotation_tasks").update({ status: "pending", assigned_annotator_id: null }).eq("assigned_annotator_id", expert_id).eq("status", "assigned");

        await auditLog(supabase, user.id, "expert.tasks_reassigned", "expert", expert_id);
        return jsonOk({ reassigned: true });
      }

      // ═══════════════════════════════════════════════════════════
      // REFUND_PAYMENT
      // ═══════════════════════════════════════════════════════════
      case "refund_payment": {
        const { payment_id, amount, reason } = body;
        if (!payment_id || !amount || !reason) return jsonError("payment_id, amount, reason required", 400);

        const { data: payment } = await supabase.from("project_payments").select("*, annotation_projects(client_id)").eq("id", payment_id).single();
        if (!payment) return jsonError("Payment not found", 404);

        await supabase.from("refunds").insert({
          payment_id,
          client_id: (payment as any).annotation_projects?.client_id,
          amount,
          reason,
          status: "completed",
          created_by: user.id,
        });

        const newStatus = amount >= (payment.amount || 0) ? "refunded" : "partially_refunded";
        await supabase.from("project_payments").update({ status: newStatus }).eq("id", payment_id);

        await auditLog(supabase, user.id, "payment.refunded", "payment", payment_id, { amount, reason });
        return jsonOk({ refunded: true, status: newStatus });
      }

      // ═══════════════════════════════════════════════════════════
      // CANCEL_INVOICE
      // ═══════════════════════════════════════════════════════════
      case "cancel_invoice": {
        const { invoice_id, reason } = body;
        if (!invoice_id) return jsonError("invoice_id required", 400);

        await supabase.from("client_invoices").update({ status: "cancelled" }).eq("id", invoice_id);
        await auditLog(supabase, user.id, "invoice.cancelled", "invoice", invoice_id, { reason });
        return jsonOk({ cancelled: true });
      }

      // ═══════════════════════════════════════════════════════════
      // FORCE_EXPERT_PAYOUT
      // ═══════════════════════════════════════════════════════════
      case "force_expert_payout": {
        const { expert_id, amount } = body;
        if (!expert_id || !amount) return jsonError("expert_id and amount required", 400);

        await supabase.from("expert_balances").update({
          available_balance: 0,
          updated_at: new Date().toISOString(),
        }).eq("expert_id", expert_id);

        await supabase.from("expert_transactions").insert({
          expert_id,
          amount: -amount,
          type: "withdrawal",
          description: "Paiement forcé par admin",
        });

        await auditLog(supabase, user.id, "expert_payout.forced", "expert", expert_id, { amount });
        return jsonOk({ paid: true, amount });
      }

      // ═══════════════════════════════════════════════════════════
      // CANCEL_EXPERT_PAYOUT
      // ═══════════════════════════════════════════════════════════
      case "cancel_expert_payout": {
        const { withdrawal_id } = body;
        if (!withdrawal_id) return jsonError("withdrawal_id required", 400);

        const { data: withdrawal } = await supabase.from("withdrawal_requests").select("*").eq("id", withdrawal_id).single();
        if (!withdrawal) return jsonError("Withdrawal not found", 404);

        await supabase.from("withdrawal_requests").update({ status: "cancelled" }).eq("id", withdrawal_id);
        
        // Re-credit balance
        const { data: balance } = await supabase.from("expert_balances").select("available_balance").eq("expert_id", withdrawal.expert_id).single();
        if (balance) {
          await supabase.from("expert_balances").update({
            available_balance: (balance.available_balance || 0) + withdrawal.amount,
            updated_at: new Date().toISOString(),
          }).eq("expert_id", withdrawal.expert_id);
        }

        await auditLog(supabase, user.id, "expert_payout.cancelled", "withdrawal", withdrawal_id);
        return jsonOk({ cancelled: true });
      }

      // ═══════════════════════════════════════════════════════════
      // EXPORT_CSV
      // ═══════════════════════════════════════════════════════════
      case "export_csv": {
        const { type } = body;
        if (!type) return jsonError("type required", 400);

        let rows: any[] = [];
        let headers: string[] = [];

        switch (type) {
          case "experts": {
            const { data } = await supabase.from("annotator_profiles").select("anonymized_id, country, seniority, tier, is_active, overall_accuracy, total_annotations, trust_score, created_at").limit(1000);
            headers = ["ID", "Pays", "Séniorité", "Tier", "Actif", "Alpha", "Tâches", "Trust Score", "Inscription"];
            rows = (data || []).map((e: any) => [e.anonymized_id, e.country, e.seniority, e.tier, e.is_active, e.overall_accuracy, e.total_annotations, e.trust_score, e.created_at]);
            break;
          }
          case "clients": {
            const { data } = await supabase.from("clients").select("company_name, contact_email, plan, created_at").limit(1000);
            headers = ["Entreprise", "Email", "Plan", "Inscription"];
            rows = (data || []).map((c: any) => [c.company_name, c.contact_email, c.plan, c.created_at]);
            break;
          }
          case "projects": {
            const { data } = await supabase.from("annotation_projects").select("name, domain, type, status, total_items, completed_tasks, estimated_cost, created_at").limit(1000);
            headers = ["Nom", "Domaine", "Type", "Statut", "Tâches", "Complétées", "Coût estimé", "Créé"];
            rows = (data || []).map((p: any) => [p.name, p.domain, p.type, p.status, p.total_items, p.completed_tasks, p.estimated_cost, p.created_at]);
            break;
          }
          case "transactions": {
            const { data } = await supabase.from("expert_transactions").select("expert_id, amount, type, description, created_at").order("created_at", { ascending: false }).limit(1000);
            headers = ["Expert ID", "Montant", "Type", "Description", "Date"];
            rows = (data || []).map((t: any) => [t.expert_id, t.amount, t.type, t.description, t.created_at]);
            break;
          }
          case "invoices": {
            const { data } = await supabase.from("client_invoices").select("client_id, amount, currency, status, tasks_billed, period_start, period_end, created_at").order("created_at", { ascending: false }).limit(1000);
            headers = ["Client ID", "Montant", "Devise", "Statut", "Tâches", "Début", "Fin", "Date"];
            rows = (data || []).map((i: any) => [i.client_id, i.amount, i.currency, i.status, i.tasks_billed, i.period_start, i.period_end, i.created_at]);
            break;
          }
          case "llm": {
            const { data } = await supabase.from("llm_call_logs").select("model_name, purpose, input_tokens, output_tokens, cost_usd, latency_ms, success, created_at").order("created_at", { ascending: false }).limit(1000);
            headers = ["Modèle", "Purpose", "Tokens In", "Tokens Out", "Coût USD", "Latence ms", "Succès", "Date"];
            rows = (data || []).map((l: any) => [l.model_name, l.purpose, l.input_tokens, l.output_tokens, l.cost_usd, l.latency_ms, l.success, l.created_at]);
            break;
          }
          default: return jsonError("Unknown export type", 400);
        }

        // Build CSV
        const csvLines = [headers.join(",")];
        for (const row of rows) {
          csvLines.push(row.map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
        }

        await auditLog(supabase, user.id, "export.csv", "export", type, { rows: rows.length });
        return new Response(csvLines.join("\n"), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="stef_${type}_${new Date().toISOString().slice(0,10)}.csv"` },
        });
      }

      // ═══════════════════════════════════════════════════════════
      // LIST_ADMINS
      // ═══════════════════════════════════════════════════════════
      case "list_admins": {
        const { data: admins } = await supabase.from("user_roles").select("user_id, created_at").eq("role", "admin");
        const userIds = admins?.map((a: any) => a.user_id) || [];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);

        const result = admins?.map((a: any) => {
          const p = profiles?.find((p: any) => p.user_id === a.user_id);
          return { user_id: a.user_id, name: p?.full_name || "", email: p?.email || "", added_at: a.created_at };
        }) || [];

        return jsonOk({ admins: result });
      }

      // ═══════════════════════════════════════════════════════════
      // ADD_ADMIN
      // ═══════════════════════════════════════════════════════════
      case "add_admin": {
        const { email } = body;
        if (!email) return jsonError("email required", 400);

        const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", email).single();
        if (!profile) return jsonError("No account found with this email", 404);

        await supabase.from("user_roles").insert({ user_id: profile.user_id, role: "admin" });
        await auditLog(supabase, user.id, "admin.added", "admin", profile.user_id, { email });
        return jsonOk({ added: true });
      }

      // ═══════════════════════════════════════════════════════════
      // REMOVE_ADMIN
      // ═══════════════════════════════════════════════════════════
      case "remove_admin": {
        const { target_user_id } = body;
        if (!target_user_id) return jsonError("target_user_id required", 400);
        if (target_user_id === user.id) return jsonError("Cannot remove yourself", 400);

        // Check at least 1 admin remains
        const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
        if ((count || 0) <= 1) return jsonError("Cannot remove the last admin", 400);

        await supabase.from("user_roles").delete().eq("user_id", target_user_id).eq("role", "admin");
        await auditLog(supabase, user.id, "admin.removed", "admin", target_user_id);
        return jsonOk({ removed: true });
      }

      // ═══════════════════════════════════════════════════════════
      // DELETE_UPLOAD
      // ═══════════════════════════════════════════════════════════
      case "delete_upload": {
        const { upload_id } = body;
        if (!upload_id) return jsonError("upload_id required", 400);
        await supabase.from("client_uploads").update({ status: "deleted" }).eq("id", upload_id);
        await auditLog(supabase, user.id, "upload.deleted", "upload", upload_id);
        return jsonOk({ deleted: true });
      }

      // ═══════════════════════════════════════════════════════════
      // DELETE_EXPORT
      // ═══════════════════════════════════════════════════════════
      case "delete_export": {
        const { export_id } = body;
        if (!export_id) return jsonError("export_id required", 400);
        await supabase.from("dataset_exports").update({ status: "deleted" }).eq("id", export_id);
        await auditLog(supabase, user.id, "export.deleted", "export", export_id);
        return jsonOk({ deleted: true });
      }

      default:
        return jsonError("Unknown admin action", 400);
    }
  } catch (error: any) {
    console.error("[admin-api] Error:", error);
    return jsonError(error.message || "Internal error", 500);
  }
});

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
