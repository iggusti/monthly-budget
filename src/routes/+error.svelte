<script lang="ts">
  import { page } from "$app/state";
  import { t } from "#lib/i18n.svelte";

  const status = $derived(page.status);
  const notFound = $derived(status === 404);
</script>

<svelte:head>
  <title>{notFound ? t("error.notFoundTitle") : t("error.title")} — Monthly Budget Nia Ilham</title>
</svelte:head>

<div class="error-page">
  <span class="error-code">{status}</span>
  <h1 class="error-title">{notFound ? t("error.notFoundTitle") : t("error.title")}</h1>
  <p class="error-text">{notFound ? t("error.notFoundText") : t("error.text")}</p>
  <a class="error-link" href="/">{t("error.backHome")}</a>
</div>

<style>
  .error-page {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    gap: 0.7rem; padding: 4rem 1rem;
  }
  .error-code {
    font-family: "Playfair Display", serif; font-size: 4.5rem; font-weight: 700;
    line-height: 1; color: var(--accent-gold);
  }
  .error-title { font-size: 1.35rem; font-weight: 800; color: var(--text-primary); }
  .error-text { font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary); max-width: 34rem; }
  .error-link {
    margin-top: 0.85rem;
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.6rem 1.3rem; border-radius: 999px;
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-rose));
    color: #fff; font-size: 0.85rem; font-weight: 700; text-decoration: none;
    box-shadow: var(--shadow-sm);
    transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
  }
  .error-link:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
</style>
