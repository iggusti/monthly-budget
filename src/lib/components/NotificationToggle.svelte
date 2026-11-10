<script lang="ts">
  /**
   * Bell button in the topbar that turns push notifications on/off for this
   * device. Shows a short toast when the browser blocks the request or the
   * feature is not configured.
   */
  import { t, lang } from "#lib/i18n.svelte";
  import {
    notify,
    enableNotifications,
    disableNotifications,
    type NotificationMessage
  } from "#lib/notifications.svelte";

  const enabled = $derived(notify.status === "enabled");
  const label = $derived(enabled ? t("nav.notificationsOn") : t("nav.notificationsOff"));

  let toast = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function showToast(text: string) {
    toast = text;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      toast = null;
      timer = null;
    }, 4500);
  }

  async function handleClick() {
    if (notify.busy) return;

    if (enabled) {
      await disableNotifications();
    } else {
      await enableNotifications(lang.value);
    }

    const message: NotificationMessage = notify.message;
    if (message) {
      showToast(t(`notify.${message}`));
      notify.message = null;
    }
  }
</script>

<div class="notify-wrap">
  <button
    type="button"
    class="notify-toggle"
    class:active={enabled}
    class:busy={notify.busy}
    aria-pressed={enabled}
    aria-label={label}
    title={label}
    onclick={handleClick}
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

  {#if toast}
    <div class="notify-toast" role="status">{toast}</div>
  {/if}
</div>

<style>
  .notify-wrap { position: relative; display: inline-flex; }

  .notify-toggle {
    position: relative;
    width: 32px; height: 32px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 999px;
    background: var(--bg-muted); border: 1px solid var(--surface-border);
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }
  .notify-toggle:hover { color: var(--accent-gold); border-color: var(--accent-gold); }
  .notify-toggle.active {
    background: var(--accent-gold-light);
    border-color: var(--accent-gold);
    color: var(--accent-gold);
  }
  .notify-toggle.busy { opacity: 0.6; }

  .notify-spinner {
    position: absolute; inset: -3px;
    border-radius: 999px;
    border: 2px solid transparent;
    border-top-color: var(--accent-gold);
    animation: notify-spin 0.7s linear infinite;
  }
  @keyframes notify-spin { to { transform: rotate(360deg); } }

  .notify-toast {
    position: absolute; top: calc(100% + 0.55rem); right: 0;
    z-index: 300;
    width: max-content; max-width: min(260px, 70vw);
    padding: 0.6rem 0.8rem;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.12));
    color: var(--text-secondary);
    font-size: 0.78rem; line-height: 1.35; text-align: left;
    animation: notify-fade 0.2s ease;
  }
  @keyframes notify-fade {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
