<script lang="ts">
  /**
   * Compact light/dark theme switch. Reflects the shared theme store and
   * persists the choice via `toggleTheme`.
   */
  import { theme, toggleTheme } from "#lib/theme.svelte";
  import { t } from "#lib/i18n.svelte";

  interface Props {
    /** Visual variant: `pill` (default) or `inline` (compact, for the login card). */
    variant?: "pill" | "inline";
  }

  let { variant = "pill" }: Props = $props();
</script>

<button
  type="button"
  class="theme-toggle {variant}"
  aria-label={theme.value === "dark" ? t("nav.themeLight") : t("nav.themeDark")}
  title={theme.value === "dark" ? t("nav.themeLight") : t("nav.themeDark")}
  onclick={toggleTheme}
>
  {#if theme.value === "dark"}
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
    width: 32px; height: 32px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 999px;
    background: var(--bg-muted); border: 1px solid var(--surface-border);
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }
  .theme-toggle:hover { color: var(--accent-gold); border-color: var(--accent-gold); }

  /* Inline variant sits on the glassy login card. */
  .theme-toggle.inline { background: rgba(255, 255, 255, 0.75); border-color: rgba(255, 255, 255, 0.8); }
  :root[data-theme="dark"] .theme-toggle.inline { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.12); }
</style>
