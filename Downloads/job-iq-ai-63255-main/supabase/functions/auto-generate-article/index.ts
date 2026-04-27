import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get next unused topic
    const { data: topic, error: topicErr } = await supabase
      .from("article_topics")
      .select("*")
      .eq("used", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (topicErr) throw topicErr;
    if (!topic) {
      return new Response(JSON.stringify({ error: "No unused topics remaining" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Generate article via AI
    const systemPrompt = `Tu es un rédacteur technique expert en machine learning, RLHF, annotation de données IA, et qualité des datasets. Tu écris pour le blog technique de STEF (steftalent.fr), une plateforme RLHF-as-a-Service.

Ton audience : CTOs, Heads of AI, chercheurs ML, développeurs senior. Ils sont techniques. Pas de vulgarisation excessive.

Règles :
- Longueur : 800-1200 mots
- Format : Markdown
- Ton : précis, confiant, sobre. Pas de "Dans cet article, nous allons voir...". Commence directement par le sujet.
- Structure : 3-5 sections avec H2, pas de H1 (le titre est séparé)
- Inclure au moins 1 code block ou formule technique si pertinent
- Inclure des chiffres concrets quand possible
- NE PAS mentionner de concurrents par nom
- Mentionner STEF naturellement 1-2 fois maximum, sans forcer
- NE PAS utiliser les mots : "révolutionnaire", "game-changer", "innovant", "cutting-edge"
- NE PAS commencer les paragraphes par "Il est important de noter que"
- Les affirmations techniques doivent être vérifiables
- Conclure par une ouverture (pas un CTA commercial)`;

    const userPrompt = `Écris un article sur le sujet suivant : ${topic.topic}

Génère aussi :
- Un titre (max 80 caractères)
- Un extrait (max 200 caractères)
- Une meta description SEO (max 160 caractères)
- 2-3 tags parmi : RLHF, DPO, Qualité des données, Annotation, Red-teaming, Métriques, Produit, Recherche, Médical, Code, Finance, Juridique`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_article",
              description: "Create a blog article with structured data",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Article title, max 80 chars" },
                  slug: { type: "string", description: "URL slug, lowercase with hyphens" },
                  excerpt: { type: "string", description: "Short excerpt, max 200 chars" },
                  meta_description: { type: "string", description: "SEO meta description, max 160 chars" },
                  tags: { type: "array", items: { type: "string" }, description: "2-3 tags" },
                  content_markdown: { type: "string", description: "Full article content in Markdown" },
                  estimated_read_minutes: { type: "number", description: "Estimated read time in minutes" },
                },
                required: ["title", "slug", "excerpt", "meta_description", "tags", "content_markdown", "estimated_read_minutes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_article" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output from AI");
    }

    const articleData = JSON.parse(toolCall.function.arguments);

    // Save article
    const { data: savedArticle, error: insertErr } = await supabase
      .from("blog_articles")
      .insert({
        title: articleData.title,
        slug: articleData.slug,
        excerpt: articleData.excerpt,
        meta_description: articleData.meta_description,
        tags: articleData.tags,
        content_markdown: articleData.content_markdown,
        estimated_read_minutes: articleData.estimated_read_minutes || 5,
        status: "auto_generated",
        source: "auto",
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    // Mark topic as used
    await supabase
      .from("article_topics")
      .update({ used: true, article_id: savedArticle.id })
      .eq("id", topic.id);

    console.log(`[auto-generate-article] Generated: "${articleData.title}"`);

    return new Response(
      JSON.stringify({ success: true, title: articleData.title, id: savedArticle.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[auto-generate-article] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
