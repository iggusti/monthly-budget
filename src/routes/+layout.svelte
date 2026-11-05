<script lang="ts">
  import "../app.css";
  import { logout, isAuthenticated } from "#lib/auth";

  let { children } = $props();

  let authed = $state(false);
  $effect(() => {
    authed = isAuthenticated();
  });

  async function handleLogout() {
    await logout();
    location.href = "/login";
  }
</script>

<div class="page-wrapper">
  <header class="topbar">
    <div class="topbar-inner">
      <a href="/" class="logo">
        <span class="logo-mark">❖</span>
        <span class="logo-text">Budget Harmony</span>
      </a>
      <nav class="topbar-nav">
        {#if authed}
          <a href="/" class="nav-link">Dashboard</a>
          <span class="nav-sep">·</span>
          <span class="nav-user">Family Plan</span>
          <button class="nav-logout" onclick={handleLogout} title="Sign out">Sign out</button>
        {/if}
      </nav>
    </div>
  </header>

  <main class="main-content">
    {@render children()}
  </main>

  <footer class="footer">
    <p>Family Budget Harmony · Stay balanced, save together</p>
  </footer>
</div>

<style>
  .page-wrapper { min-height: 100vh; display: flex; flex-direction: column; }

  .topbar {
    position: sticky; top: 0; z-index: 100;
    background: rgba(250, 249, 247, 0.88);
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
    .main-content { padding: 1.25rem 1rem 2rem; }
    .nav-user { display: none; }
  }
</style>
