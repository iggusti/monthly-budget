<script lang="ts">
  /**
   * Round language button. Its EN / ID label shows the language that the next
   * click will activate. The choice persists through `toggleLang()`.
   */
  import { lang, toggleLang, t } from "#lib/i18n.svelte";

  interface Props {
    /** Visual variant: `pill` (default) or `inline` (compact, for dark cards). */
    variant?: "pill" | "inline";
  }

  let { variant = "pill" }: Props = $props();

  // Show the language the next click will activate, so the label and action agree.
  const nextLang = $derived(lang.value === "en" ? "id" : "en");
  const label = $derived(t(nextLang === "en" ? "nav.langToEn" : "nav.langToId"));
</script>

<button
  type="button"
  class="lang-toggle {variant}"
  aria-label={label}
  title={label}
  onclick={toggleLang}
>
  {nextLang.toUpperCase()}
</button>

<style>
  .lang-toggle {
    width: 32px; height: 32px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: var(--radius-pill);
    background: var(--bg-muted); border: 1px solid var(--surface-border);
    color: var(--text-secondary);
    font-size: 0.68rem; font-weight: 800; letter-spacing: var(--tracking-caption);
    transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-spring);
  }
  .lang-toggle:hover { color: var(--accent-gold); border-color: var(--accent-gold); transform: scale(1.06); }
  .lang-toggle:active { transform: scale(0.94); }

  /* Inline variant sits on the glassy login card. */
  .lang-toggle.inline { background: var(--surface-glass); border-color: var(--border-glass); }
</style>
