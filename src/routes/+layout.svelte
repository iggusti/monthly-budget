<script lang="ts">
  import "../app.css";
  import { fly } from "svelte/transition";
  import { page } from "$app/state";
  import { MOTION, motionFly, takeNavOffset } from "#lib/motion";
  import { logout, isAuthenticated } from "#lib/auth";
  import { t, lang } from "#lib/i18n.svelte";
  import { syncTheme } from "#lib/theme.svelte";
  import { initNotifications } from "#lib/notifications.svelte";
  import LanguageToggle from "#lib/components/LanguageToggle.svelte";
  import NotificationToggle from "#lib/components/NotificationToggle.svelte";
  import ThemeToggle from "#lib/components/ThemeToggle.svelte";
  import Toasts from "#lib/components/Toasts.svelte";

  /**
   * Push notifications are hidden until the sender Cloud Function can be
   * deployed (the project is still on the Firebase Spark plan, so nothing would
   * be delivered). Flip this flag back to `true` once the function is live.
   */
  const PUSH_NOTIFICATIONS_ENABLED = false;

  let { children } = $props();

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
          <img class="logo-mark" src="/favicon.svg" alt="" width="32" height="32" />
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
    padding: 0 2rem; height: 60px;
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
  .logo:hover .logo-mark { transform: rotate(-8deg) scale(1.06); box-shadow: 0 6px 16px rgba(200, 149, 108, 0.35); }
  .logo-text { font-family: "Playfair Display", serif; font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; }
  .topbar-nav { display: flex; align-items: center; gap: 0.5rem; }
  .nav-logout {
    font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
    padding: 0.3rem 0.75rem; border-radius: 20px;
    background: transparent; border: 1px solid var(--surface-border);
    transition: all 0.2s;
  }
  .nav-logout:hover { background: var(--danger-light); color: var(--danger); border-color: transparent; }
  .main-content { flex: 1; max-width: 1100px; margin: 0 auto; width: 100%; padding: 2rem 2rem 3rem; }

  .page-enter { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .footer { text-align: center; padding: 1.5rem; color: var(--text-tertiary); font-size: 0.8rem; border-top: 1px solid var(--surface-border); }

  @media (max-width: 640px) {
    .topbar { padding: 0 1rem; }
    .topbar-nav { gap: 0.3rem; }
    .main-content { padding: 1.25rem 1rem 2rem; }
    .nav-logout { padding: 0.25rem 0.6rem; font-size: 0.68rem; }
  }
</style>
