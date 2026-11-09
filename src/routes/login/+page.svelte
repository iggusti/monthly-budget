<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { login, isAuthenticated } from "#lib/auth";
  import { t } from "#lib/i18n.svelte";
  import { syncTheme } from "#lib/theme.svelte";
  import LanguageToggle from "#lib/components/LanguageToggle.svelte";
  import ThemeToggle from "#lib/components/ThemeToggle.svelte";
  import Seo from "#lib/components/Seo.svelte";
  import { onMount } from "svelte";

  let keyword = $state("");
  let hasError = $state(false);
  let shake = $state(false);
  let focus = $state(false);
  let show = $state(false);
  let loading = $state(false);
  let showPassword = $state(false);

  onMount(() => {
    syncTheme();
    if (isAuthenticated()) {
      location.href = "/";
      return;
    }
    setTimeout(() => (show = true), 60);
  });

  async function submit() {
    if (loading || !keyword.trim()) return;
    loading = true;
    hasError = false;
    const ok = await login(keyword);
    loading = false;
    if (ok) {
      location.href = "/";
    } else {
      hasError = true;
      shake = true;
      setTimeout(() => (shake = false), 500);
    }
  }
</script>

<Seo title={t("login.pageTitle")} description={t("seo.loginDescription")} path="/login" />

<div class="login-page">
  <div class="blob blob1"></div>
  <div class="blob blob2"></div>
  <div class="blob blob3"></div>

  <div class="lang-corner">
    <LanguageToggle variant="inline" />
    <ThemeToggle variant="inline" />
  </div>

  <div class="card" class:show={show} class:shake={shake}>
    <div class="card-glow"></div>

    <div class="logo" in:scale={{ duration: 500, delay: 120 }}>
      <svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#c8956c"/>
            <stop offset="0.55" stop-color="#c47070"/>
            <stop offset="1" stop-color="#5b8a8a"/>
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="16" fill="#1a1714"/>
        <rect x="15" y="29" width="34" height="24" rx="3" fill="url(#lg)"/>
        <path d="M10 30 L32 11 L54 30 Z" fill="#c8956c"/>
        <rect x="27" y="37" width="10" height="16" rx="2" fill="#faf9f7"/>
        <path d="M32 39.5c-1-1.5-3.4-1.4-4.2 0.2-0.8 1.6 0.6 2.8 4.2 4.8 3.6-2 5-3.2 4.2-4.8-0.8-1.6-3.2-1.7-4.2-0.2z" fill="#c47070"/>
      </svg>
    </div>

    <h1 class="title">{t("login.title")}</h1>
    <p class="subtitle">{t("login.subtitle")}</p>

    <div class="divider"><span></span></div>

    <form onsubmit={(e) => { e.preventDefault(); submit(); }} class="form">
      <label class="field-label" for="keyword">{t("login.fieldLabel")}</label>
      <div class="input-wrap" class:focused={focus}>
        <span class="input-icon">🔑</span>
        <input
          id="keyword"
          type={showPassword ? "text" : "password"}
          bind:value={keyword}
          placeholder={t("login.placeholder")}
          autocomplete="off"
          onfocus={() => (focus = true)}
          onblur={() => (focus = false)}
          onkeydown={(e) => e.key === "Enter" && submit()}
        />
        <button
          type="button"
          class="toggle-pass"
          onmousedown={(e) => e.preventDefault()}
          onclick={() => (showPassword = !showPassword)}
          title={showPassword ? t("login.hide") : t("login.show")}
          aria-label={showPassword ? t("login.hide") : t("login.show")}
        >
          {showPassword ? "🙈" : "👁️"}
        </button>
      </div>

      {#if hasError}
        <p class="error" in:fade={{ duration: 200 }}>{t("login.error")}</p>
      {/if}

      <button class="submit" type="submit" disabled={loading || !keyword.trim()}>
        <span>{loading ? t("login.signingIn") : t("login.signIn")}</span>
        <span class="arrow">{loading ? "" : "→"}</span>
      </button>
    </form>

    <p class="hint">{t("login.hint")}</p>
  </div>
</div>

<style>
  .login-page {
    position: relative; min-height: 100vh; min-height: 100dvh;
    display: flex; align-items: center; justify-content: center;
    padding: 2rem 1.25rem;
    background: linear-gradient(160deg, #faf9f7 0%, #f5ece4 45%, #edf4f4 100%);
    overflow: hidden;
    max-width: 100%;
  }
  :root[data-theme="dark"] .login-page {
    background: linear-gradient(160deg, #17150f 0%, #221b16 45%, #16201f 100%);
  }

  .blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.5; }
  .blob1 { width: 320px; height: 320px; background: #c8956c; top: -80px; left: -80px; }
  .blob2 { width: 280px; height: 280px; background: #c47070; bottom: -70px; right: -60px; }
  .blob3 { width: 220px; height: 220px; background: #5b8a8a; bottom: 20%; left: -60px; opacity: 0.35; }

  .lang-corner { position: absolute; top: 1.25rem; right: 1.25rem; z-index: 2; display: flex; align-items: center; gap: 0.5rem; }

  /* Keep the decorative blobs from creating horizontal overflow on small screens. */
  @media (max-width: 640px) {
    .blob { opacity: 0.4; }
    .blob1 { width: 220px; height: 220px; top: -70px; left: -70px; }
    .blob2 { width: 200px; height: 200px; bottom: -60px; right: -50px; }
    .blob3 { width: 160px; height: 160px; left: -50px; }
  }

  .card {
    position: relative; width: 100%; max-width: 400px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 24px;
    padding: 2.6rem 2.2rem 2rem;
    box-shadow: 0 24px 60px rgba(26, 23, 20, 0.18);
    opacity: 0; transform: translateY(16px) scale(0.98);
    transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  :root[data-theme="dark"] .card {
    background: rgba(33, 30, 24, 0.85);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  }
  .card.show { opacity: 1; transform: translateY(0) scale(1); }
  .card.shake { animation: shake 0.5s; }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }

  .card-glow {
    position: absolute; inset: 0; border-radius: 24px;
    background: linear-gradient(135deg, rgba(200, 149, 108, 0.15), rgba(196, 112, 112, 0.12), rgba(91, 138, 138, 0.15));
    pointer-events: none;
  }

  .logo {
    width: 64px; height: 64px; margin: 0 auto 1.1rem;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #f5ece4, #edf4f4);
    border-radius: 20px;
    box-shadow: 0 8px 24px rgba(26, 23, 20, 0.12);
  }
  :root[data-theme="dark"] .logo { background: linear-gradient(135deg, #2c2620, #22302f); }

  .title { text-align: center; font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }
  .subtitle { text-align: center; color: var(--text-tertiary); font-size: 0.9rem; margin-top: 0.3rem; }

  .divider { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0; }
  .divider span { flex: 1; height: 1px; background: var(--surface-border); }

  .form { display: flex; flex-direction: column; gap: 1.1rem; }
  .field-label { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.02em; }

  .input-wrap {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    background: var(--surface); border: 1.5px solid var(--surface-border);
    border-radius: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .input-wrap.focused { border-color: var(--accent-gold); box-shadow: 0 0 0 4px rgba(200, 149, 108, 0.15); }
  .input-icon { font-size: 1.1rem; }
  .input-wrap input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 1rem; padding: 0.35rem 0; color: var(--text-primary); }
  .input-wrap input::placeholder { color: #c4bdb6; }
  .toggle-pass {
    flex-shrink: 0; width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.05rem; border-radius: 10px;
    background: var(--bg-muted); color: var(--text-secondary);
    transition: all 0.2s;
  }
  .toggle-pass:hover { background: var(--accent-gold-light); color: var(--accent-gold); }

  .error { color: var(--danger); font-size: 0.82rem; font-weight: 600; }

  .submit {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    padding: 0.95rem 1.2rem; border-radius: 14px;
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-rose));
    color: #fff; font-size: 1rem; font-weight: 800;
    box-shadow: 0 10px 24px rgba(196, 112, 112, 0.35);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(196, 112, 112, 0.45); }
  .submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .arrow { transition: transform 0.2s; }
  .submit:hover:not(:disabled) .arrow { transform: translateX(3px); }

  .hint { text-align: center; font-size: 0.78rem; color: var(--text-tertiary); margin-top: 1.3rem; }

  @media (max-width: 420px) {
    .login-page { padding: 1.25rem 1rem; }
    .card { padding: 2rem 1.4rem 1.6rem; border-radius: 20px; }
    .title { font-size: 1.3rem; }
  }

  @media (max-width: 340px) {
    .card { padding: 1.6rem 1.1rem 1.4rem; }
    .title { font-size: 1.15rem; }
    .subtitle { font-size: 0.82rem; }
  }
</style>
