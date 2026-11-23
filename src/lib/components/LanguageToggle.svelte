<script lang="ts">
  /**
   * Language control: a round next-language button on phones and the original
   * EN / ID pill on tablets and desktop. Both paths use the shared i18n state.
   */
  import { lang, setLang, toggleLang, t } from "#lib/i18n.svelte";

  interface Props {
    /** Visual variant: `pill` (default) or `inline` (compact, for dark cards). */
    variant?: "pill" | "inline";
  }

  let { variant = "pill" }: Props = $props();

  // The phone button shows the language the next click will activate.
  const nextLang = $derived(lang.value === "en" ? "id" : "en");
  const label = $derived(t(nextLang === "en" ? "nav.langToEn" : "nav.langToId"));
</script>

<div class="language-control {variant}">
  <button
    type="button"
    class="lang-toggle"
    aria-label={label}
    title={label}
    onclick={toggleLang}
  >
    {nextLang.toUpperCase()}
  </button>

  <div class="lang-switch" role="group" aria-label={t("nav.language")}>
    <button
      type="button"
      class="lang-btn"
      class:active={lang.value === "en"}
      aria-pressed={lang.value === "en"}
      onclick={() => setLang("en")}
    >
      EN
    </button>
    <button
      type="button"
      class="lang-btn"
      class:active={lang.value === "id"}
      aria-pressed={lang.value === "id"}
      onclick={() => setLang("id")}
    >
      ID
    </button>
  </div>
</div>

<style>
  .language-control { display: inline-flex; align-items: center; }
  .lang-switch { display: none; }

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
  .language-control.inline .lang-toggle { background: var(--surface-glass); border-color: var(--border-glass); }

  /* Tablets and desktops keep the original two-option pill. */
  @media (min-width: 769px) {
    .lang-toggle { display: none; }
    .lang-switch {
      display: inline-flex; align-items: center; gap: 2px;
      padding: 2px; border-radius: var(--radius-pill);
      background: var(--bg-muted); border: 1px solid var(--surface-border);
    }
    .lang-btn {
      padding: 0.25rem 0.6rem; border-radius: var(--radius-pill);
      font-size: var(--fs-caption); font-weight: 800; letter-spacing: var(--tracking-caption);
      color: var(--text-tertiary); background: transparent;
      transition: color var(--dur-fast) var(--ease-out), background var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-spring);
    }
    .lang-btn:hover { color: var(--text-secondary); transform: translateY(-1px); }
    .lang-btn:active { transform: translateY(0) scale(0.95); }
    .lang-btn.active {
      background: var(--surface); color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }
    .language-control.inline .lang-switch { background: var(--surface-glass); border-color: var(--border-glass); }
    .language-control.inline .lang-btn { color: var(--text-tertiary); }
    .language-control.inline .lang-btn.active { background: var(--accent-gold-light); color: var(--accent-gold); }
  }
</style>
