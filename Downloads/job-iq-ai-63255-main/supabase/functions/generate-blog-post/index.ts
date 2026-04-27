import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const topics = [
  { 
    theme: "ia-recrutement", 
    titlesFr: [
      "Comment l'IA transforme le processus de recrutement en {year}",
      "Les algorithmes de matching : révolution dans le recrutement tech",
      "IA et biais de recrutement : comment les éviter",
      "Évaluation automatisée des compétences : le futur du hiring",
      "Machine Learning appliqué au sourcing de talents"
    ],
    titlesEn: [
      "How AI is transforming the recruitment process in {year}",
      "Matching algorithms: revolution in tech recruitment",
      "AI and recruitment bias: how to avoid them",
      "Automated skills assessment: the future of hiring",
      "Machine Learning applied to talent sourcing"
    ]
  },
  {
    theme: "talents-tech",
    titlesFr: [
      "Les compétences tech les plus recherchées en {year}",
      "Python vs JavaScript : quel langage apprendre en priorité",
      "DevOps : le profil qui fait la différence",
      "Full Stack Developer : mythe ou réalité ?",
      "Comment attirer les meilleurs développeurs dans votre équipe"
    ],
    titlesEn: [
      "Most in-demand tech skills in {year}",
      "Python vs JavaScript: which language to learn first",
      "DevOps: the profile that makes the difference",
      "Full Stack Developer: myth or reality?",
      "How to attract top developers to your team"
    ]
  },
  {
    theme: "freelance-remote",
    titlesFr: [
      "Freelance tech en Afrique : opportunités et défis",
      "Remote work : 10 outils indispensables pour les équipes distribuées",
      "Portage salarial vs freelance : quel statut choisir",
      "Construire une carrière tech internationale depuis l'Afrique",
      "Les meilleures plateformes pour trouver des missions tech"
    ],
    titlesEn: [
      "Tech freelancing in Africa: opportunities and challenges",
      "Remote work: 10 essential tools for distributed teams",
      "Umbrella company vs freelance: which status to choose",
      "Building an international tech career from Africa",
      "Best platforms to find tech missions"
    ]
  },
  {
    theme: "entreprises",
    titlesFr: [
      "Pourquoi externaliser votre développement en Afrique",
      "Réduire vos coûts de recrutement tech de 40%",
      "Comment évaluer un développeur en 30 minutes",
      "Construire une équipe tech internationale efficace",
      "Les erreurs à éviter lors du recrutement de développeurs"
    ],
    titlesEn: [
      "Why outsource your development to Africa",
      "Reduce your tech recruitment costs by 40%",
      "How to evaluate a developer in 30 minutes",
      "Building an effective international tech team",
      "Mistakes to avoid when hiring developers"
    ]
  },
  {
    theme: "tendances",
    titlesFr: [
      "LLM et développement : comment ChatGPT change le métier",
      "Low-code/No-code : menace ou opportunité pour les devs",
      "Web3 et blockchain : les compétences qui recrutent",
      "Cybersécurité : la pénurie de talents s'aggrave",
      "Cloud computing : AWS vs Azure vs GCP en {year}"
    ],
    titlesEn: [
      "LLMs and development: how ChatGPT is changing the job",
      "Low-code/No-code: threat or opportunity for devs",
      "Web3 and blockchain: in-demand skills",
      "Cybersecurity: the talent shortage is worsening",
      "Cloud computing: AWS vs Azure vs GCP in {year}"
    ]
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Authentication: Admin, service-role Bearer, or internal cron header
    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.replace('Bearer ', '');
    const isCron = req.headers.get('x-cron-secret') === SUPABASE_SERVICE_ROLE_KEY
      || bearerToken === SUPABASE_SERVICE_ROLE_KEY;
    
    if (!isCron) {
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(SUPABASE_URL, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const userId = claimsData.claims.sub;
      const adminCheckClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: roleData } = await adminCheckClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single();
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log("Starting blog post generation...");
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pick random topic and title
    const year = new Date().getFullYear();
    const topicGroup = topics[Math.floor(Math.random() * topics.length)];
    const titleIndex = Math.floor(Math.random() * topicGroup.titlesFr.length);
    const titleFr = topicGroup.titlesFr[titleIndex].replace("{year}", year.toString());
    const titleEn = topicGroup.titlesEn[titleIndex].replace("{year}", year.toString());
    
    // Generate slug from French title
    const slug = titleFr
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + 
      "-" + Date.now().toString(36);

    console.log(`Generating article: ${titleFr}`);

    // Generate content using Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un rédacteur web expert pour "STEF", plateforme de recrutement tech connectant talents africains et entreprises internationales.

Style d'écriture :
- Phrases courtes et percutantes. Paragraphes de 2-3 lignes max.
- Ton direct, engageant, presque conversationnel. Pas de jargon inutile.
- Utilise des chiffres concrets et des exemples réels.
- Chaque section doit accrocher le lecteur dès la première phrase.
- Évite les introductions génériques type "Le monde évolue..."
- Commence par un fait marquant ou une question provocante.

Format STRICT — markdown pur, PAS de JSON :
- Commence directement par ## pour la première section (pas de # titre)
- Utilise ## pour les sections principales et ### pour les sous-sections  
- Utilise **gras** pour les points clés
- Listes à puces avec - pour les énumérations
- Maximum 500 mots au total`
          },
          {
            role: "user",
            content: `Écris un article de blog sur : "${titleFr}"

Structure :
1. Introduction percutante (2-3 lignes, fait marquant ou question)
2. 3 sections ## avec contenu concis et actionnable
3. Conclusion courte avec CTA vers STEF

IMPORTANT : Réponds UNIQUEMENT en JSON valide, sans backticks, sans texte autour :
{"content": "le contenu markdown", "excerpt": "description SEO max 155 chars", "author_name": "prénom nom réaliste"}`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content;

    if (!generatedText) {
      throw new Error("No content generated");
    }

    console.log("AI response received, parsing...");

    // Parse the JSON response - handle common LLM formatting issues
    let parsedContent;
    try {
      let cleanedText = generatedText.trim();
      // Strip markdown code fences
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
      }
      // Extract JSON object
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Remove trailing commas before } or ]
        const sanitized = jsonMatch[0].replace(/,\s*([\]}])/g, '$1');
        parsedContent = JSON.parse(sanitized);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error, using fallback:", parseError);
      // Fallback: strip any JSON wrapper and use raw content
      let fallbackContent = generatedText;
      if (fallbackContent.startsWith('```')) {
        fallbackContent = fallbackContent.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
      }
      try {
        const jsonMatch = fallbackContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const inner = JSON.parse(jsonMatch[0].replace(/,\s*([\]}])/g, '$1'));
          fallbackContent = inner.content || fallbackContent;
        }
      } catch {}
      parsedContent = {
        content: fallbackContent,
        excerpt: titleFr.slice(0, 155) + "...",
        author_name: "Équipe Stef"
      };
    }

    // Get a relevant cover image from Unsplash
    const imageKeywords = ["technology", "coding", "startup", "office", "programming", "developer"];
    const randomKeyword = imageKeywords[Math.floor(Math.random() * imageKeywords.length)];
    const coverImageUrl = `https://images.unsplash.com/photo-${Date.now() % 1000000}?w=800&h=400&fit=crop&q=80`;
    
    // Use a reliable Unsplash image
    const unsplashImages = [
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop"
    ];
    const selectedImage = unsplashImages[Math.floor(Math.random() * unsplashImages.length)];

    // Insert into database
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title: titleFr,
        slug: slug,
        content: parsedContent.content,
        excerpt: parsedContent.excerpt?.slice(0, 160) || titleFr.slice(0, 155) + "...",
        author_name: parsedContent.author_name || "Équipe Stef",
        cover_image_url: selectedImage,
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log("Blog post created successfully:", data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Blog post generated successfully",
        post: {
          id: data.id,
          title: data.title,
          slug: data.slug
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating blog post:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
