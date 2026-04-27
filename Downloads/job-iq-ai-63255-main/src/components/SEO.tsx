import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  article?: {
    publishedTime?: string;
    author?: string;
  };
  jsonLd?: Record<string, unknown>;
  noindex?: boolean;
  breadcrumbs?: { name: string; url: string }[];
}

const SITE_URL = "https://steftalent.fr";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.svg`;
const SITE_NAME = "STEF";

export const SEO = ({
  title,
  description,
  path,
  type = "website",
  image,
  article,
  jsonLd,
  noindex = false,
  breadcrumbs,
}: SEOProps) => {
  const fullTitle = title === "STEF" ? title : `${title} | STEF`;
  const url = `${SITE_URL}${path}`;
  const ogImage = image || DEFAULT_IMAGE;

  // Organization schema (always present)
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "STEF",
    url: SITE_URL,
    logo: `${SITE_URL}/stef-favicon.png`,
    description: "Plateforme ESN de recrutement tech propulsée par l'IA.",
    sameAs: [
      "https://www.linkedin.com/company/stef-ai/",
      "https://www.facebook.com/share/17zoqeAca2/?mibextid=wwXIfr",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Paris",
      addressCountry: "FR",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@steftalent.fr",
      contactType: "customer service",
      availableLanguage: ["French", "English"],
    },
  };

  // WebSite schema with search action (for sitelinks searchbox)
  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "STEF",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  // Breadcrumb schema
  const breadcrumbSchema = breadcrumbs
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }
    : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Hreflang */}
      <link rel="alternate" hrefLang="fr" href={url} />
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:locale:alternate" content="en_US" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Article-specific */}
      {article?.publishedTime && (
        <meta property="article:published_time" content={article.publishedTime} />
      )}
      {article?.author && (
        <meta property="article:author" content={article.author} />
      )}

      {/* JSON-LD */}
      <script type="application/ld+json">{JSON.stringify(orgSchema)}</script>
      {path === "/" && (
        <script type="application/ld+json">{JSON.stringify(webSiteSchema)}</script>
      )}
      {breadcrumbSchema && (
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      )}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};
