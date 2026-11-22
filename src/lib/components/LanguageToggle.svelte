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

  /* Inline variant sits on the glassy login card. */
  .lang-switch.inline { background: var(--surface-glass); border-color: var(--border-glass); }
  .lang-switch.inline .lang-btn { color: var(--text-tertiary); }
  .lang-switch.inline .lang-btn.active { background: var(--accent-gold-light); color: var(--accent-gold); }
</style>
