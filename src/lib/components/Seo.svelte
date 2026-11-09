<script lang="ts">
  /**
   * Professional SEO head block for Monthly Budget Nia Ilham.
   *
   * Centralises every `<meta>` tag so each route only passes its page-specific
   * title/description. The app is a private, keyword-gated family tool, so
   * indexing is intentionally blocked (noindex, nofollow) while social preview
   * tags (Open Graph / Twitter) are fully populated for link sharing.
   */
  import { page } from "$app/state";

  interface Props {
    /** Page title (already translated). Emitted as both <title> and og:title. */
    title: string;
    /** Page description (already translated). */
    description: string;
    /** Optional canonical path override; defaults to the current pathname. */
    path?: string;
  }

  let { title, description, path }: Props = $props();

  const SITE_NAME = "Monthly Budget Nia Ilham";
  const BASE_URL = "https://nia-ilham.web.app";
  const OG_IMAGE = `${BASE_URL}/og-image.png`;

  // Canonical URL for the current page (no query/hash).
  const canonical = $derived(`${BASE_URL}${path ?? page.url.pathname}`);

  // Structured data describing the web application.
  const jsonLd = $derived({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    alternateName: "Anggaran Bulanan Nia Ilham",
    description,
    url: BASE_URL,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    inLanguage: ["en", "id"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "IDR"
    }
  });
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />

  <!-- Private app: keep it out of search indexes -->
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
  <meta name="googlebot" content="noindex, nofollow" />

  <!-- Canonical -->
  <link rel="canonical" href={canonical} />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={OG_IMAGE} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:locale:alternate" content="id_ID" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={OG_IMAGE} />

  <!-- Theme colour for mobile browser chrome -->
  <meta name="theme-color" content="#c8956c" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#17150f" media="(prefers-color-scheme: dark)" />

  <!-- Structured data -->
  {@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>`}
</svelte:head>
