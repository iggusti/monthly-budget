<script lang="ts">
  /**
   * Compact language switch (EN / ID). Reflects the active language from the
   * shared i18n store and persists the choice via `setLang`.
   */
  import { lang, setLang, t } from "#lib/i18n.svelte";

  interface Props {
    /** Visual variant: `pill` (labelled) or `inline` (compact, for dark cards). */
    variant?: "pill" | "inline";
  }

  let { variant = "pill" }: Props = $props();
</script>

<div class="lang-switch {variant}" role="group" aria-label={t("nav.language")}>
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

<style>
  .lang-switch {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 2px; border-radius: 999px;
    background: var(--bg-muted); border: 1px solid var(--surface-border);
  }
  .lang-btn {
    padding: 0.25rem 0.6rem; border-radius: 999px;
    font-size: 0.7rem; font-weight: 800; letter-spacing: 0.03em;
    color: var(--text-tertiary); background: transparent;
    transition: all 0.2s ease;
  }
  .lang-btn:hover { color: var(--text-secondary); }
  .lang-btn.active {
    background: var(--surface); color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  /* Inline variant sits on the glassy login card. */
  .lang-switch.inline { background: rgba(255, 255, 255, 0.75); border-color: rgba(255, 255, 255, 0.8); }
  :root[data-theme="dark"] .lang-switch.inline { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.12); }
  .lang-switch.inline .lang-btn { color: var(--text-tertiary); }
  .lang-switch.inline .lang-btn.active { background: var(--accent-gold-light); color: var(--accent-gold); }
</style>
