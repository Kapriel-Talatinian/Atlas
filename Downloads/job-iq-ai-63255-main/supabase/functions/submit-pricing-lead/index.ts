import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_DOMAINS = ["medical", "legal", "finance", "code"];
const VALID_SLAS = ["standard", "priority", "express"];
const VALID_MODES = ["standard", "sovereign"];

interface PricingLeadBody {
  email: string;
  domain: string;
  volume: number;
  sla: string;
  mode: string;
  estimatedLow: number;
  estimatedHigh: number;
  basePrice: number;
  multSla: number;
  multMode: number;
  discountPct: number;
}

function validate(body: any): body is PricingLeadBody {
  if (!body || typeof body !== "object") return false;
  if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 255) return false;
  if (!VALID_DOMAINS.includes(body.domain)) return false;
  if (typeof body.volume !== "number" || body.volume < 50 || body.volume > 100000) return false;
  if (!VALID_SLAS.includes(body.sla)) return false;
  if (!VALID_MODES.includes(body.mode)) return false;
  if (typeof body.estimatedLow !== "number" || typeof body.estimatedHigh !== "number") return false;
  return true;
}

// Simple in-memory rate-limit per IP (best-effort; serverless instances may reset)
const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(ip);
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKETS.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!rateLimit(ip)) {
      return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans une minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!validate(body)) {
      return new Response(JSON.stringify({ error: "Paramètres invalides." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userAgent = req.headers.get("user-agent") || null;

    const { data: lead, error: insertError } = await supabase
      .from("pricing_leads")
      .insert({
        email: body.email.toLowerCase().trim(),
        domain: body.domain,
        volume: body.volume,
        sla: body.sla,
        mode: body.mode,
        estimated_price_low: body.estimatedLow,
        estimated_price_high: body.estimatedHigh,
        ip_address: ip,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[submit-pricing-lead] insert error:", insertError);
      return new Response(JSON.stringify({ error: "Impossible d'enregistrer la demande." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send transactional email (fire-and-forget so the user gets a fast response)
    supabase.functions
      .invoke("send-transactional-email", {
        body: {
          templateName: "pricing-quote",
          recipientEmail: body.email,
          idempotencyKey: `pricing-quote-${lead.id}`,
          templateData: {
            domain: body.domain,
            volume: body.volume,
            sla: body.sla,
            mode: body.mode,
            estimatedLow: body.estimatedLow,
            estimatedHigh: body.estimatedHigh,
            basePrice: body.basePrice,
            multSla: body.multSla,
            multMode: body.multMode,
            discountPct: body.discountPct,
          },
        },
      })
      .catch((err) => console.error("[submit-pricing-lead] email send error:", err));

    return new Response(JSON.stringify({ success: true, leadId: lead.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[submit-pricing-lead] error:", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
