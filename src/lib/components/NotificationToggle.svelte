<script lang="ts">
  /**
   * Bell in the topbar. Pushes arrive through the Pushover app, so enabling
   * only records which family member owns this browser — no notification
   * permission prompt is needed. The person can be changed by disabling and
   * enabling again.
   */
  import { t, lang } from "#lib/i18n.svelte";
  import { toastError, toastSuccess } from "#lib/toast.svelte";
  import {
    notify,
    enableNotifications,
    disableNotifications,
    type NotificationMessage,
    type Recipient
  } from "#lib/notifications.svelte";

  let open = $state(false);
  let choice = $state<Recipient>(notify.recipient);

  const enabled = $derived(notify.status === "enabled");
  const label = $derived(enabled ? t("nav.notificationsOn") : t("nav.notificationsOff"));

  function report() {
    const message: NotificationMessage = notify.message;
    if (message) {
      if (message === "error") toastError(t("notify.error"));
      else toastSuccess(t(`notify.${message}`));
      notify.message = null;
    }
  }

  async function handleBell() {
    if (notify.busy) return;
    if (enabled) {
      await disableNotifications();
      open = false;
      report();
      return;
    }
    choice = notify.recipient;
    open = !open;
  }

  async function handleEnable() {
    if (notify.busy) return;
    await enableNotifications(choice, lang.value);
    report();
    if (notify.status === "enabled") {
      open = false;
      toastSuccess(t("notify.enabled"));
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) open = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="notify-wrap">
  <button
    type="button"
    class="notify-toggle"
    class:active={enabled}
    class:busy={notify.busy}
    aria-pressed={enabled}
    aria-expanded={open}
    aria-label={label}
    title={label}
    onclick={handleBell}
  >
    {#if enabled}
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
        <path d="M12 2a6 6 0 0 0-6 6v3.6l-1.7 3A1 1 0 0 0 5.2 16h13.6a1 1 0 0 0 .9-1.4l-1.7-3V8a6 6 0 0 0-6-6Z" />
        <path d="M9.5 18a2.5 2.5 0 0 0 5 0Z" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-9.3-5" />
        <path d="M6.3 6.3A6 6 0 0 0 6 8v3.6l-1.7 3A1 1 0 0 0 5.2 16h9.3" />
        <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
        <path d="m2 2 20 20" />
      </svg>
    {/if}
    {#if notify.busy}<span class="notify-spinner" aria-hidden="true"></span>{/if}
  </button>

  {#if open && !enabled}
    <div class="notify-panel" role="group" aria-label={t("notify.title")}>
      <p class="notify-title">{t("notify.title")}</p>
      <p class="notify-note">{t("notify.note")}</p>
      <label class="notify-field" for="notify-recipient">{t("notify.recipient")}</label>
      <select id="notify-recipient" bind:value={choice} disabled={notify.busy}>
        <option value="husband">{t("common.husband")}</option>
        <option value="wife">{t("common.wife")}</option>
      </select>
      <div class="notify-actions">
        <button type="button" class="notify-cancel" onclick={() => (open = false)}>{t("notify.cancel")}</button>
        <button type="button" class="notify-save" onclick={handleEnable} disabled={notify.busy}>
          {t("notify.enable")}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .notify-wrap { position: relative; display: inline-flex; }

  .notify-toggle {
    position: relative;
    width: 32px; height: 32px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: var(--radius-pill);
    background: var(--bg-muted); border: 1px solid var(--surface-border);
    color: var(--text-secondary);
    transition: all var(--dur-fast) var(--ease-out);
  }
  .notify-toggle:hover { color: var(--accent-gold-ink); border-color: var(--accent-gold); }
  .notify-toggle.active {
    background: var(--accent-gold-light);
    border-color: var(--accent-gold);
    color: var(--accent-gold-ink);
  }
  .notify-toggle.busy { opacity: 0.6; }

  .notify-spinner {
    position: absolute; inset: -3px;
    border-radius: var(--radius-pill);
    border: 2px solid transparent;
    border-top-color: var(--accent-gold);
    animation: notify-spin var(--dur-slower) linear infinite;
  }
  @keyframes notify-spin {
    from { transform: rotate(0); }
    to { transform: rotate(360deg); }
  }

  /* Absolute, not fixed: the blurred topbar is the containing block. */
  .notify-panel {
    position: absolute; top: calc(100% + 0.55rem); right: 0;
    z-index: var(--z-raised);
    width: max-content; max-width: min(280px, 78vw);
    padding: 0.85rem;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    color: var(--text-secondary);
    font-size: var(--fs-label); line-height: 1.35; text-align: left;
    animation: notify-fade var(--dur-fast) var(--ease-out);
  }
  @keyframes notify-fade {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .notify-title { margin: 0 0 0.3rem; font-weight: 700; color: var(--text-primary); }
  .notify-note { margin: 0 0 0.7rem; font-size: 0.72rem; color: var(--text-tertiary); }
  .notify-field { display: block; margin-bottom: 0.3rem; font-weight: 600; }
  .notify-panel select {
    width: 100%; padding: 0.45rem 0.55rem;
    border: 1px solid var(--surface-border); border-radius: var(--radius-xs);
    background: var(--bg); color: var(--text-primary);
    font: inherit;
  }
  .notify-actions { display: flex; justify-content: flex-end; gap: 0.4rem; margin-top: 0.8rem; }
  .notify-cancel, .notify-save {
    padding: 0.35rem 0.7rem; border-radius: var(--radius-pill);
    font: inherit; font-weight: 700; cursor: pointer;
    transition: all var(--dur-fast) var(--ease-out);
  }
  .notify-cancel { background: transparent; border: 1px solid var(--surface-border); color: var(--text-secondary); }
  .notify-save {
    background: var(--accent-gold); border: 1px solid var(--accent-gold);
    color: var(--accent-gold-ink);
  }
  .notify-save:disabled { opacity: 0.6; cursor: default; }
</style>
