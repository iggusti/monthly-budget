<script lang="ts">
  import { fade } from "svelte/transition";
  import { MOTION, motionFade } from "#lib/motion";
  import { login, isAuthenticated } from "#lib/auth";
  import { t } from "#lib/i18n.svelte";
  import { toastError, toastSuccess } from "#lib/toast.svelte";
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
      toastSuccess(t("toast.loginSuccess"));
      location.href = "/";
    } else {
      hasError = true;
      toastError(t("toast.loginFailed"));
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

    <div class="logo animate-pop" style="--anim-delay: 0.1s">
      <svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style="stop-color: var(--accent-gold)"/>
            <stop offset="0.55" style="stop-color: var(--accent-rose)"/>
            <stop offset="1" style="stop-color: var(--accent-teal)"/>
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="16" style="fill: var(--text-primary)"/>
        <rect x="15" y="29" width="34" height="24" rx="3" fill="url(#lg)"/>
        <path d="M10 30 L32 11 L54 30 Z" style="fill: var(--accent-gold)"/>
        <rect x="27" y="37" width="10" height="16" rx="2" style="fill: var(--logo-door)"/>
        <path d="M32 39.5c-1-1.5-3.4-1.4-4.2 0.2-0.8 1.6 0.6 2.8 4.2 4.8 3.6-2 5-3.2 4.2-4.8-0.8-1.6-3.2-1.7-4.2-0.2z" style="fill: var(--accent-rose)"/>
      </svg>
    </div>

    <h1 class="title animate-rise" style="--anim-delay: 0.16s">{t("login.title")}</h1>
    <p class="subtitle animate-rise" style="--anim-delay: 0.22s">{t("login.subtitle")}</p>

    <div class="divider"><span></span></div>

    <form onsubmit={(e) => { e.preventDefault(); submit(); }} class="form animate-rise" style="--anim-delay: 0.28s">
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
        <p class="error" in:fade={motionFade(MOTION.fast)}>{t("login.error")}</p>
      {/if}

      <button class="submit" type="submit" disabled={loading || !keyword.trim()}>
        <span>{loading ? t("login.signingIn") : t("login.signIn")}</span>
        <span class="arrow">{loading ? "" : "→"}</span>
      </button>
    </form>

    <p class="hint animate-rise" style="--anim-delay: 0.34s">{t("login.hint")}</p>
  </div>
</div>

<style>
  .login-page {
    position: relative; min-height: 100vh; min-height: 100dvh;
    display: flex; align-items: center; justify-content: center;
    padding: 2rem 1.25rem;
    background: linear-gradient(160deg, var(--bg) 0%, var(--accent-gold-light) 45%, var(--accent-teal-light) 100%);
    overflow: hidden;
    max-width: 100%;
  }

  .blob { position: absolute; border-radius: var(--radius-circle); filter: blur(60px); opacity: 0.5; animation: floaty 14s var(--ease-in-out) infinite; }
  .blob1 { width: 320px; height: 320px; background: var(--accent-gold); top: -80px; left: -80px; }
  .blob2 { width: 280px; height: 280px; background: var(--accent-rose); bottom: -70px; right: -60px; animation-delay: -5s; }
  .blob3 { width: 220px; height: 220px; background: var(--accent-teal); bottom: 20%; left: -60px; opacity: 0.35; animation-delay: -9s; }

  .lang-corner { position: absolute; top: 1.25rem; right: 1.25rem; z-index: var(--z-raised); display: flex; align-items: center; gap: 0.5rem; }

  /* Keep the decorative blobs from creating horizontal overflow on small screens. */
  @media (max-width: 640px) {
    .blob { opacity: 0.4; }
    .blob1 { width: 220px; height: 220px; top: -70px; left: -70px; }
    .blob2 { width: 200px; height: 200px; bottom: -60px; right: -50px; }
    .blob3 { width: 160px; height: 160px; left: -50px; }
  }

  .card {
    position: relative; width: 100%; max-width: 400px;
    background: var(--surface-glass);
    backdrop-filter: blur(14px);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-xl);
    padding: 2.6rem 2.2rem 2rem;
    box-shadow: var(--shadow-lg);
    opacity: 0; transform: translateY(16px) scale(0.98);
    transition: opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out);
  }
  .card.show { opacity: 1; transform: none; }
  .card.shake { animation: shake var(--dur-slow) var(--ease-out); }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }

  .card-glow {
    position: absolute; inset: 0; border-radius: var(--radius-xl);
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent-gold) 15%, transparent), color-mix(in srgb, var(--accent-rose) 12%, transparent), color-mix(in srgb, var(--accent-teal) 15%, transparent));
    pointer-events: none;
  }

  .logo {
    width: 64px; height: 64px; margin: 0 auto 1.1rem;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--accent-gold-light), var(--accent-teal-light));
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .title { text-align: center; font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }
  .subtitle { text-align: center; color: var(--text-tertiary); font-size: 0.9rem; margin-top: 0.3rem; }

  .divider { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0; }
  .divider span { flex: 1; height: 1px; background: var(--surface-border); }

  .form { display: flex; flex-direction: column; gap: 1.1rem; }
  .field-label { font-size: var(--fs-label); font-weight: 700; color: var(--text-secondary); letter-spacing: var(--tracking-caption); }

  .input-wrap {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    background: var(--surface); border: var(--border-emphasis);
    border-radius: var(--radius-md);
    transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
  }
  .input-wrap.focused { border-color: var(--accent-gold); box-shadow: var(--focus-ring-gold); }
  .input-icon { font-size: 1.1rem; }
  .input-wrap input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 1rem; padding: 0.35rem 0; color: var(--text-primary); }
  .input-wrap input::placeholder { color: var(--text-tertiary); }
  .toggle-pass {
    flex-shrink: 0; width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.05rem; border-radius: 10px;
    background: var(--bg-muted); color: var(--text-secondary);
    transition: all var(--dur-fast) var(--ease-out);
  }
  .toggle-pass:hover { background: var(--accent-gold-light); color: var(--accent-gold); }

  .error { color: var(--danger); font-size: var(--fs-label); font-weight: 600; }

  .submit {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    padding: 0.95rem 1.2rem; border-radius: 14px;
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-rose), var(--accent-gold));
    background-size: 200% 200%;
    color: var(--on-accent); font-size: 1rem; font-weight: 800;
    box-shadow: 0 10px 24px color-mix(in srgb, var(--accent-rose) 35%, transparent);
    transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), background-position var(--dur-slower) var(--ease-out);
  }
  .submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 30px color-mix(in srgb, var(--accent-rose) 45%, transparent); background-position: 100% 0; }
  .submit:active:not(:disabled) { transform: translateY(0) scale(0.99); }
  .submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .arrow { transition: transform var(--dur-fast) var(--ease-out); }
  .submit:hover:not(:disabled) .arrow { transform: translateX(3px); }

  .hint { text-align: center; font-size: var(--fs-label); color: var(--text-tertiary); margin-top: 1.3rem; }

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
