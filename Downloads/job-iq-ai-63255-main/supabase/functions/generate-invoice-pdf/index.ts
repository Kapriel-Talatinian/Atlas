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

  try {
    const body = await req.json();
    const { invoice_id } = body;
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Facture introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify access
    if (userId) {
      const { data: clientData } = await supabase.from("clients").select("id").eq("user_id", userId).maybeSingle();
      const { data: adminRole } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!adminRole && (!clientData || clientData.id !== invoice.client_id)) {
        return new Response(JSON.stringify({ error: "Accès refusé" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if PDF already exists
    if (invoice.pdf_storage_path) {
      const { data: signedUrl } = await supabase.storage
        .from("invoices")
        .createSignedUrl(invoice.pdf_storage_path, 3600);
      if (signedUrl?.signedUrl) {
        return new Response(JSON.stringify({ download_url: signedUrl.signedUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load platform settings for STEF company info + bank details
    const { data: settingsRows } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "bank_account_holder", "bank_iban", "bank_bic", "bank_name",
        "company_name", "company_address", "company_siret", "company_tva",
        "company_capital", "company_rcs",
      ]);

    const settings: Record<string, string> = {};
    for (const row of (settingsRows || []) as any[]) {
      const v = row.value;
      settings[row.key] = typeof v === "string" ? v : JSON.stringify(v);
    }

    // Strip surrounding quotes from JSON string values
    const s = (key: string, fallback: string) => {
      const raw = settings[key] || fallback;
      return raw.replace(/^"|"$/g, "");
    };

    const companyName = s("company_name", "STEF SAS");
    const companyAddress = s("company_address", "Paris, France");
    const companySiret = s("company_siret", "En cours d'immatriculation");
    const companyTva = s("company_tva", "");
    const companyCapital = s("company_capital", "En cours de constitution");
    const companyRcs = s("company_rcs", "RCS Paris — En cours d'immatriculation");
    const bankHolder = s("bank_account_holder", "STEF SAS");
    const bankIban = s("bank_iban", "");
    const bankBic = s("bank_bic", "");
    const bankName = s("bank_name", "");

    const inv = invoice;
    const isPaid = inv.status === "paid";
    const previousPayments = (inv.previous_payments || []) as Array<{ payment_type: string; percentage: number; amount: number; paid_at: string }>;

    const paymentTypeLabels: Record<string, string> = {
      deposit: "Acompte",
      intermediate: "Paiement intermédiaire",
      final: "Solde final",
    };

    const paymentTerms = inv.percentage <= 50
      ? "40% a la confirmation, 30% a 50% d'avancement, 30% a la livraison."
      : "50% a la confirmation, 50% a la livraison.";

    const lines: string[] = [];

    // ── STEF header ──
    lines.push(companyName);
    lines.push(companyAddress);
    lines.push(`SIRET : ${companySiret}`);
    if (companyTva) lines.push(`TVA intracom. : ${companyTva}`);
    lines.push(``);
    lines.push(`FACTURE N  ${inv.invoice_number}`);
    lines.push(`Date : ${new Date(inv.issued_at).toLocaleDateString("fr-FR")}`);
    if (inv.due_date) lines.push(`Echeance : ${new Date(inv.due_date).toLocaleDateString("fr-FR")}`);
    lines.push(``);
    lines.push(`--------------------------------------------`);
    lines.push(``);

    // ── Client info ──
    lines.push(`FACTURER A :`);
    lines.push(`Client : ${inv.client_name}`);
    if (inv.client_address) lines.push(`Adresse : ${inv.client_address}`);
    if (inv.client_siret) lines.push(`SIRET : ${inv.client_siret}`);
    if (inv.client_tva_number) lines.push(`TVA intracom. : ${inv.client_tva_number}`);
    lines.push(``);
    lines.push(`--------------------------------------------`);
    lines.push(``);

    // ── Project details ──
    lines.push(`Projet : ${inv.project_name}`);
    lines.push(`Domaine : ${inv.domain}`);
    lines.push(`Type : ${inv.task_type}`);
    lines.push(`Langue : ${inv.language}`);
    lines.push(`SLA : ${inv.sla_tier}${inv.sla_multiplier > 1 ? ` (x${inv.sla_multiplier})` : ""}`);
    lines.push(``);
    lines.push(`--------------------------------------------`);
    lines.push(``);

    // ── Line items ──
    const unitTotal = inv.num_tasks * inv.unit_price_ht;
    lines.push(`Designation                     Qte    PU HT    Total HT`);
    lines.push(`--------------------------------------------`);
    lines.push(`Annotation RLHF - ${inv.task_type}    ${inv.num_tasks}    ${inv.unit_price_ht.toFixed(2)}    ${unitTotal.toFixed(2)}`);

    if (inv.sla_multiplier > 1) {
      const slaAmount = unitTotal * (inv.sla_multiplier - 1);
      lines.push(`SLA ${inv.sla_tier} (x${inv.sla_multiplier})                                    +${slaAmount.toFixed(2)}`);
    }

    if (inv.volume_discount_percent > 0) {
      const discountAmount = inv.project_total_ht * (inv.volume_discount_percent / 100);
      lines.push(`Remise volume (${inv.volume_discount_percent}%)                                -${discountAmount.toFixed(2)}`);
    }

    lines.push(``);
    lines.push(`--------------------------------------------`);
    lines.push(`Total HT du projet                                    ${inv.project_total_ht.toFixed(2)} USD`);
    lines.push(``);
    lines.push(`${paymentTypeLabels[inv.payment_type]} (${inv.percentage}%)              ${inv.invoice_amount_ht.toFixed(2)} USD`);

    if (inv.tva_rate > 0) {
      lines.push(`TVA (${inv.tva_rate}%)                                          ${inv.tva_amount.toFixed(2)} USD`);
    }

    lines.push(`--------------------------------------------`);
    lines.push(`TOTAL TTC                                             ${inv.invoice_amount_ttc.toFixed(2)} USD`);
    lines.push(``);

    // ── Previous payments ──
    if (previousPayments.length > 0) {
      lines.push(`Paiements precedents :`);
      for (const pp of previousPayments) {
        const ppLabel = paymentTypeLabels[pp.payment_type] || pp.payment_type;
        lines.push(`  - ${ppLabel} (${pp.percentage}%) : ${pp.amount.toFixed(2)} USD - paye le ${new Date(pp.paid_at).toLocaleDateString("fr-FR")}`);
      }
      lines.push(``);
    }

    // ── Payment instructions ──
    lines.push(`--------------------------------------------`);
    lines.push(``);
    lines.push(`MODE DE PAIEMENT : Virement bancaire`);
    lines.push(``);
    if (bankHolder) lines.push(`Titulaire : ${bankHolder}`);
    if (bankIban) lines.push(`IBAN : ${bankIban}`);
    if (bankBic) lines.push(`BIC : ${bankBic}`);
    if (bankName) lines.push(`Banque : ${bankName}`);
    lines.push(`Reference : ${inv.invoice_number}`);
    lines.push(``);
    lines.push(`Conditions de paiement : ${paymentTerms}`);
    lines.push(``);
    lines.push(`En cas de retard : penalites au taux legal majore de 3 points`);
    lines.push(`+ indemnite forfaitaire de 40 EUR (art. D.441-5 du Code de commerce).`);
    lines.push(``);
    lines.push(`${inv.tva_mention}`);
    lines.push(``);

    if (isPaid) {
      lines.push(`============================================`);
      lines.push(`                  PAYEE                     `);
      lines.push(`============================================`);
      lines.push(``);
    }

    // ── Footer ──
    lines.push(`${companyName} - Capital social : ${companyCapital}`);
    lines.push(companyRcs);

    const textContent = lines.join("\n");

    // ── Generate minimal PDF ──
    const escapedText = textContent
      .split("\n")
      .map((line, i) => {
        const escaped = line
          .replace(/\\/g, "\\\\")
          .replace(/\(/g, "\\(")
          .replace(/\)/g, "\\)");
        return `BT /F1 9 Tf 50 ${780 - i * 13} Td (${escaped}) Tj ET`;
      })
      .join("\n");

    const streamLength = new TextEncoder().encode(escapedText).length;

    const pdfLines: string[] = [];
    pdfLines.push(`%PDF-1.4`);
    pdfLines.push(`1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj`);
    pdfLines.push(`2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj`);
    pdfLines.push(`4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj`);
    pdfLines.push(`3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 842]/Contents 5 0 R/Resources<</Font<</F1 4 0 R>>>>>>endobj`);
    pdfLines.push(`5 0 obj<</Length ${streamLength}>>`);
    pdfLines.push(`stream`);
    pdfLines.push(escapedText);
    pdfLines.push(`endstream`);
    pdfLines.push(`endobj`);

    const pdfContent = pdfLines.join("\n");
    const xrefOffset = pdfContent.length;
    const fullPdf = pdfContent + `\nxref\n0 6\n0000000000 65535 f \n` +
      `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;

    const pdfBuffer = new TextEncoder().encode(fullPdf);
    const pdfPath = `${inv.client_id}/${inv.invoice_number}.pdf`;

    await supabase.storage.from("invoices").upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

    await supabase.from("invoices").update({
      pdf_storage_path: pdfPath,
      pdf_generated_at: new Date().toISOString(),
    }).eq("id", inv.id);

    const { data: signedUrl } = await supabase.storage
      .from("invoices")
      .createSignedUrl(pdfPath, 3600);

    return new Response(JSON.stringify({ download_url: signedUrl?.signedUrl || "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-invoice-pdf] Error:", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
