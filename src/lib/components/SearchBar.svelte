<script lang="ts">
  import { t } from "#lib/i18n.svelte";

  /** SearchBar component props. */
  interface Props {
    query: string;
    onQueryChange: (query: string) => void;
    onClear: () => void;
    placeholderKey?: string;
  }

  let { query, onQueryChange, onClear, placeholderKey = "month.searchPlaceholder" } = $props();

  let escaped = $derived(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); // for aria-activedescendant

  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    onQueryChange(input.value);
  }

  function handleClear() {
    onClear();
  }
</script>

<div class="search-bar" aria-expanded="true">
  <svg
    viewBox="0 0 24 24"
    class="search-bar-icon"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
  <input
    type="text"
    bind:value={query}
    oninput={handleInput}
    placeholder={t(placeholderKey)}
    class="search-bar-input"
    aria-label={t("month.searchPlaceholder")}
    aria-activedescendant={escaped ? `search-${escaped.replace(/\s+/g, "-").toLowerCase()}` : ""}
    autocomplete="off"
  />
  {#if query}
    <button
      class="search-bar-clear"
      type="button"
      aria-label={t("month.clearSearch")}
      onclick={handleClear}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M36 18l-15-15" />
      </svg>
    </button>
  {/if}
</div>

<style>
  .search-bar {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    padding: 0 1rem;
    height: 3.5rem;
    width: 100%;
    max-width: 360px;
    font-size: 0.875rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search-bar:hover {
    border-color: var(--accent-gold);
  }
  .search-bar:focus-within {
    border-color: var(--accent-gold);
    box-shadow: 0 0 0 3px rgba(200, 149, 108, 0.15);
    outline: none;
  }
  .search-bar-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    color: var(--text-tertiary);
  }
  .search-bar-input {
    flex: 1;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    color: var(--text-primary);
    padding: 0;
    outline: none;
  }
  .search-bar-input::placeholder {
    color: var(--text-tertiary);
  }
  .search-bar-clear {
    width: 2rem;
    height: 2rem;
    border: none;
    background: transparent;
    padding: 0;
    color: var(--text-tertiary);
    flex-shrink: 0;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
  }
  .search-bar-clear:hover,
  .search-bar-clear:focus-visible {
    color: var(--accent-gold);
  }
  .search-bar[aria-expanded="true"] .search-bar-clear {
    display: flex;
  }
  @media (max-width: 768px) {
    .search-bar { max-width: 100%; }
  }
</style>