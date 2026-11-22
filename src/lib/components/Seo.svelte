<script lang="ts">
  import { page } from "$app/state";
  import { lang } from "#lib/i18n.svelte";

  interface Props {
    title: string;
    description: string;
    path?: string;
  }

  let { title, description, path }: Props = $props();

  const SITE_NAME = "Monthly Budget Nia Ilham";
  const BASE_URL = "https://monthly-budget-nia-ilham.web.app";
  const OG_IMAGE = `${BASE_URL}/og-image.png`;

  const canonical = $derived(`${BASE_URL}${path ?? page.url.pathname}`);
  const locale = $derived(lang.value === "id" ? "id_ID" : "en_US");
  const alternateLocale = $derived(lang.value === "id" ? "en_US" : "id_ID");

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
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
  <meta name="googlebot" content="noindex, nofollow" />
  <link rel="canonical" href={canonical} />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={OG_IMAGE} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content={locale} />
  <meta property="og:locale:alternate" content={alternateLocale} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={OG_IMAGE} />

  <!-- theme-color lives in app.html so the theme switch can update it. -->
  {@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>`}
</svelte:head>
