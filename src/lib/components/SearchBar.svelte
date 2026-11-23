<script lang="ts">
  import { t } from "#lib/i18n.svelte";
  import { untrack } from "svelte";

  interface Props {
    query: string;
    onQueryChange: (query: string) => void;
    onClear: () => void;
    placeholderKey?: string;
  }

  let { query, onQueryChange, onClear, placeholderKey = "month.searchPlaceholder" } = $props();

  // Local draft of what the user is typing. Search is only committed on Enter,
  // so editing this does not trigger live filtering. The initial value is read
  // untracked so the local `$state` doesn't capture `query` reactively.
  let draft = $state(untrack(() => query));

  // Keep the draft in sync when the parent resets the query externally.
  // Only track `query` here so typing in the input is not overwritten.
  $effect(() => {
    const nextQuery = query;
    untrack(() => {
      if (nextQuery !== draft) draft = nextQuery;
    });
  });

  function commitSearch() {
    if (draft !== query) onQueryChange(draft);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitSearch();
    }
  }

  function handleClear() {
    draft = "";
    onClear();
  }
</script>

<div class="search-bar" role="search">
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
    bind:value={draft}
    onkeydown={handleKeydown}
    placeholder={t(placeholderKey)}
    class="search-bar-input"
    aria-label={t(placeholderKey)}
    autocomplete="off"
  />
  {#if draft}
    <button
      class="search-bar-clear"
      type="button"
      aria-label={t("month.clearSearch")}
      onclick={handleClear}
    >
      <svg
        viewBox="0 0 24 24"
        class="search-bar-clear-icon"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
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
    background: var(--bg-muted);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    padding: 0 1rem;
    height: 3.5rem;
    width: 100%;
    max-width: 360px;
    font-size: 0.875rem;
    transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-out);
  }
  .search-bar:hover {
    border-color: var(--accent-gold);
  }
  .search-bar:focus-within {
    background: var(--surface);
    border-color: var(--accent-gold);
    box-shadow: var(--focus-ring-gold);
    outline: none;
    transform: translateY(-1px);
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
    padding-right: 2.2rem;
    outline: none;
  }
  .search-bar-input::placeholder {
    color: var(--text-tertiary);
  }
  .search-bar-clear {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    width: 2rem;
    height: 2rem;
    border: none;
    background: transparent;
    padding: 0;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-spring);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-circle);
  }
  .search-bar-clear-icon {
    width: 1rem;
    height: 1rem;
  }
  .search-bar-clear:hover,
  .search-bar-clear:focus-visible {
    color: var(--accent-gold);
    transform: translateY(-50%) rotate(90deg);
  }
  @media (max-width: 768px) {
    .search-bar { max-width: 100%; }
  }
</style>