<script lang="ts">
  /**
   * Fixed stack of transient confirmations (see `toast.svelte.ts`).
   *
   * Cards rise from the bottom, newest last, and clear themselves; tapping one
   * closes it early. Mounted once in the root layout, so any page can push to
   * it. Success cards are announced politely, failures assertively.
   */
  import { fly } from "svelte/transition";
  import { t } from "#lib/i18n.svelte";
  import { dismissToast, toastState } from "#lib/toast.svelte";
</script>

<div class="toast-stack" aria-live="polite" aria-atomic="false">
  {#each toastState.list as toast (toast.id)}
    <div
      class="toast {toast.kind}"
      role={toast.kind === "error" ? "alert" : undefined}
      transition:fly={{ y: 18, duration: 220 }}
    >
      <span class="toast-icon" aria-hidden="true">
        {#if toast.kind === "success"}
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 12 4.5 4.5L19 7" />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
            <path d="M12 7v6" />
            <path d="M12 17h.01" />
          </svg>
        {/if}
      </span>
      <span class="toast-text">{toast.message}</span>
      <button
        class="toast-close"
        type="button"
        onclick={() => dismissToast(toast.id)}
        aria-label={t("toast.dismiss")}
        title={t("toast.dismiss")}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed;
    left: 50%;
    bottom: 1.25rem;
    transform: translateX(-50%);
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: min(92vw, 24rem);
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.7rem 0.7rem 0.7rem 0.85rem;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-left: 3px solid var(--success);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.35;
  }
  .toast.error { border-left-color: var(--danger); }

  .toast-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--success-light);
    color: var(--success);
  }
  .toast.error .toast-icon { background: var(--danger-light); color: var(--danger); }

  .toast-text { flex: 1; min-width: 0; }

  .toast-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text-tertiary);
  }
  .toast-close:hover { background: var(--bg-muted); color: var(--text-primary); }

  @media (max-width: 640px) {
    .toast-stack { bottom: 1rem; width: calc(100vw - 2rem); }
  }
</style>
