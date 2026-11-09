<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { logout, isAuthenticated } from "#lib/auth";
  import { t } from "#lib/i18n.svelte";
  import { syncTheme } from "#lib/theme.svelte";
  import LanguageToggle from "#lib/components/LanguageToggle.svelte";
  import ThemeToggle from "#lib/components/ThemeToggle.svelte";

  let { children } = $props();

  let authed = $state(false);
  $effect(() => {
    authed = isAuthenticated();
  });

  // Keep the document theme in sync with the store on mount.
  $effect(() => {
    syncTheme();
  });

  // The login screen is a standalone, full-screen page: no topbar/footer.
  const isLogin = $derived(page.url.pathname === "/login");

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
          <span class="logo-mark">❖</span>
          <span class="logo-text">Nia & Ilham</span>
        </a>
        <nav class="topbar-nav">
          {#if authed}
            <button class="nav-logout" onclick={handleLogout} title={t("nav.signOut")}>{t("nav.signOut")}</button>
          {/if}
          <LanguageToggle />
          <ThemeToggle />
          {#if authed}
            <button class="nav-logout" onclick={handleLogout} title={t("nav.signOut")}>{t("nav.signOut")}</button>
          {/if}
        </nav>
      </div>
    </header>

    <main class="main-content">
      {@render children()}
    </main>

    <footer class="footer">
      <p>{t("footer.tagline")}</p>
    </footer>
  </div>
{/if}

<style>
  .page-wrapper { min-height: 100vh; display: flex; flex-direction: column; }

  .topbar {
    position: sticky; top: 0; z-index: 100;
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
    width: 32px; height: 32px;
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-rose));
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; color: white; font-weight: 700;
  }
  .logo-text { font-family: "Playfair Display", serif; font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; }
  .topbar-nav { display: flex; align-items: center; gap: 0.5rem; }
  .nav-link {
    text-decoration: none; color: var(--text-secondary);
    font-size: 0.85rem; font-weight: 500;
    padding: 0.35rem 0.75rem; border-radius: var(--radius-sm);
    transition: all 0.2s ease;
  }
  .nav-link:hover { color: var(--text-primary); background: var(--bg-muted); }
  .nav-sep { color: var(--text-tertiary); font-size: 0.75rem; }
  .nav-user {
    font-size: 0.78rem; color: var(--text-tertiary);
    padding: 0.3rem 0.75rem; background: var(--accent-gold-light);
    border-radius: 20px; font-weight: 500;
  }
  .nav-logout {
    font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
    padding: 0.3rem 0.75rem; border-radius: 20px;
    background: transparent; border: 1px solid var(--surface-border);
    transition: all 0.2s;
  }
  .nav-logout:hover { background: var(--danger-light); color: var(--danger); border-color: transparent; }
  .main-content { flex: 1; max-width: 1100px; margin: 0 auto; width: 100%; padding: 2rem 2rem 3rem; }
  .footer { text-align: center; padding: 1.5rem; color: var(--text-tertiary); font-size: 0.8rem; border-top: 1px solid var(--surface-border); }

  @media (max-width: 640px) {
    .topbar { padding: 0 1rem; }
    .topbar-nav { gap: 0.3rem; }
    .main-content { padding: 1.25rem 1rem 2rem; }
    .nav-user { display: none; }
    .nav-sep { display: none; }
    .nav-logout { padding: 0.25rem 0.6rem; font-size: 0.68rem; }
  }
</style>
