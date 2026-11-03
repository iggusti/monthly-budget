<script lang="ts">
  import "../app.css";
</script>

<div class="app-shell">
  <header class="app-header">
    <div class="header-content">
      <div class="logo-group">
        <span class="logo-heart">????</span>
        <div>
          <h1 class="app-title">Family Budget Harmony</h1>
          <p class="app-subtitle">Balancing love, money, and dreams together</p>
        </div>
      </div>
      <div class="header-decor">
        <span class="decor-item">??</span>
        <span class="decor-item">????????</span>
        <span class="decor-item">??</span>
      </div>
    </div>
  </header>

  <main class="app-main">
    <slot />
  </main>

  <footer class="app-footer">
    <p>Made with ?? for a happy family</p>
  </footer>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(254, 243, 199, 0.95) 100%);
    backdrop-filter: blur(10px);
    border-bottom: 3px solid transparent;
    border-image: linear-gradient(90deg, #fbbf24, #f472b6, #60a5fa, #34d399) 1;
    box-shadow: var(--shadow-soft);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .logo-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logo-heart {
    font-size: 2.5rem;
    animation: heartbeat 2s ease-in-out infinite;
  }

  .app-title {
    font-size: 1.8rem;
    background: linear-gradient(135deg, #d97706 0%, #db2777 50%, #2563eb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .app-subtitle {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-top: 0.25rem;
  }

  .header-decor {
    display: flex;
    gap: 0.75rem;
    font-size: 1.8rem;
  }

  .decor-item {
    animation: float 3s ease-in-out infinite;
  }

  .decor-item:nth-child(2) {
    animation-delay: 0.5s;
  }

  .decor-item:nth-child(3) {
    animation-delay: 1s;
  }

  .app-main {
    flex: 1;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
    padding: 2rem;
  }

  .app-footer {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
    background: linear-gradient(180deg, transparent 0%, rgba(252, 231, 243, 0.5) 100%);
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 1rem;
    }
    .app-title {
      font-size: 1.4rem;
    }
    .app-main {
      padding: 1rem;
    }
  }
</style>

