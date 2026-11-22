<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { page } from "$app/state";
  import { MOTION, motionFly, takeNavOffset } from "#lib/motion";
  import { logout, isAuthenticated } from "#lib/auth";
  import { t, lang } from "#lib/i18n.svelte";
  import { syncTheme } from "#lib/theme.svelte";
  import {
    initNotifications,
    PUSH_NOTIFICATIONS_ENABLED,
    registerServiceWorker
  } from "#lib/notifications.svelte";
  import { checkAppUpdate } from "#lib/app-update.svelte";
  import { installPrompt } from "#lib/install-prompt.svelte";
  import LanguageToggle from "#lib/components/LanguageToggle.svelte";
  import NotificationToggle from "#lib/components/NotificationToggle.svelte";
  import ThemeToggle from "#lib/components/ThemeToggle.svelte";
  import Toasts from "#lib/components/Toasts.svelte";

  let { children } = $props();

  onMount(() => {
    installPrompt.init();
    void registerServiceWorker().catch((error) =>
      console.error("Service worker registration failed:", error)
    );
    checkAppUpdate();
  });

  /** Month changes slide in from their direction; other routes just rise. */
  function pageEnter() {
    return { ...motionFly(8, MOTION.base), x: takeNavOffset(12) };
  }

  let authed = $state(false);
  $effect(() => {
    authed = isAuthenticated();
  });

  $effect(() => {
    syncTheme();
  });

  // The login screen is a standalone, full-screen page: no topbar/footer.
  const isLogin = $derived(page.url.pathname === "/login");

  // Refresh the push registration (and its stored language) once signed in.
  $effect(() => {
    const currentLang = lang.value;
    if (!PUSH_NOTIFICATIONS_ENABLED) return;
    if (isLogin || !isAuthenticated()) return;
    void initNotifications(currentLang);
  });

  async function handleLogout() {
    await logout();
    location.href = "/login";
  }
</script>

{#if isLogin}
  {@render children()}
{:else}
  <div class="page-wrapper">
    <header class="topbar">
      <div class="topbar-inner">
        <a href="/" class="logo">
          <!-- Inline so the tile follows the active theme; CSS vars cannot cross an <img>. -->
          <svg class="logo-mark" viewBox="0 0 64 64" width="32" height="32" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="logo-body" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" style="stop-color: color-mix(in srgb, var(--accent-gold), white 20%)" />
                <stop offset="0.55" style="stop-color: var(--accent-rose)" />
                <stop offset="1" style="stop-color: color-mix(in srgb, var(--accent-rose), var(--text-primary) 12%)" />
              </linearGradient>
              <linearGradient id="logo-roof" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" style="stop-color: color-mix(in srgb, var(--accent-gold), white 10%)" />
                <stop offset="1" style="stop-color: color-mix(in srgb, var(--accent-gold), var(--text-primary) 12%)" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="60" height="60" rx="16" style="fill: var(--accent-teal)" />
            <rect x="15" y="29" width="34" height="24" rx="3" fill="url(#logo-body)" />
            <path d="M10 30 L32 11 L54 30 Z" fill="url(#logo-roof)" />
            <rect x="27" y="37" width="10" height="16" rx="2" style="fill: var(--logo-door)" />
            <path d="M32 39.5c-1-1.5-3.4-1.4-4.2 0.2-0.8 1.6 0.6 2.8 4.2 4.8 3.6-2 5-3.2 4.2-4.8-0.8-1.6-3.2-1.7-4.2-0.2z" style="fill: var(--accent-rose)" />
          </svg>
          <span class="logo-text">Nia & Ilham</span>
        </a>
        <nav class="topbar-nav">
          <LanguageToggle />
          {#if PUSH_NOTIFICATIONS_ENABLED}
            <NotificationToggle />
          {/if}
          <ThemeToggle />
          {#if authed}
            <button class="nav-logout" onclick={handleLogout} title={t("nav.signOut")}>{t("nav.signOut")}</button>
          {/if}
        </nav>
      </div>
    </header>

    <main class="main-content">
      {#key page.url.pathname}
        <div class="page-enter" in:fly={pageEnter()}>
          {@render children()}
        </div>
      {/key}
    </main>

    <footer class="footer">
      <p>{t("footer.tagline")}</p>
    </footer>
  </div>
{/if}

<Toasts />

<style>
  .page-wrapper { min-height: 100vh; display: flex; flex-direction: column; }

  .topbar {
    position: sticky; top: 0; z-index: var(--z-sticky);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--surface-border);
    padding: 0 2rem; padding-top: env(safe-area-inset-top, 0px);
    height: calc(60px + env(safe-area-inset-top, 0px));
    display: flex; align-items: center;
  }
  .topbar-inner {
    max-width: 1100px; margin: 0 auto; width: 100%;
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; color: var(--text-primary); }
  .logo-mark {
    display: block;
    width: 32px; height: 32px;
    border-radius: 8px;
    transition: transform var(--dur-base) var(--ease-spring), box-shadow var(--dur-base) var(--ease-out);
  }
  .logo:hover .logo-mark { transform: rotate(-8deg) scale(1.06); box-shadow: 0 6px 16px color-mix(in srgb, var(--accent-teal) 35%, transparent); }
  .logo-text { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; }
  .topbar-nav { display: flex; align-items: center; gap: 0.5rem; }
  .nav-logout {
    font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
    padding: 0.3rem 0.75rem; border-radius: var(--radius-pill);
    background: transparent; border: 1px solid var(--surface-border);
    transition: all var(--dur-fast) var(--ease-out);
  }
  .nav-logout:hover { background: var(--danger-light); color: var(--danger); border-color: transparent; }
  .main-content { flex: 1; max-width: 1100px; margin: 0 auto; width: 100%; min-width: 0; overflow-x: clip; padding: 2rem 2rem 3rem; }

  .page-enter { display: flex; flex-direction: column; flex: 1; min-width: 0; max-width: 100%; overflow-x: clip; }
  .footer { text-align: center; padding: 1.5rem; color: var(--text-tertiary); font-size: 0.8rem; border-top: 1px solid var(--surface-border); }

  @media (max-width: 640px) {
    .topbar { padding: 0 1rem; padding-top: env(safe-area-inset-top, 0px); }
    .topbar-nav { gap: 0.3rem; }
    .main-content { padding: 1.25rem 1rem 2rem; }
    .nav-logout { padding: 0.25rem 0.6rem; font-size: 0.68rem; }
  }
</style>
