<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  
  let months = [
    { id: "2026-01", label: "January 2026", period: "25 January - 24 February 2026" },
    { id: "2026-02", label: "February 2026", period: "25 February - 24 March 2026" },
    { id: "2026-03", label: "March 2026", period: "25 March - 24 April 2026" },
    { id: "2026-04", label: "April 2026", period: "25 April - 24 May 2026" },
    { id: "2026-05", label: "May 2026", period: "25 May - 24 June 2026" },
    { id: "2026-06", label: "June 2026", period: "25 June - 24 July 2026" },
  ];
  
  let showCards = false;
  
  onMount(() => {
    setTimeout(() => showCards = true, 100);
  });
</script>

<svelte:head>
  <title>Family Budget Harmony - Home</title>
</svelte:head>

<div class="home-container">
  <section class="hero" in:fade={{ duration: 800 }}>
    <div class="hero-hearts">
      <span>??</span>
      <span>??</span>
      <span>??</span>
    </div>
    <h2 class="hero-title">Our Family Budget Journey</h2>
    <p class="hero-description">
      Together we balance, together we save, together we dream for our beautiful family
    </p>
  </section>

  <section class="months-section">
    <h3 class="section-title" in:fly={{ y: 20, duration: 600, delay: 200 }}>
      <span>??</span> Select Budget Period
    </h3>
    
    <div class="months-grid">
      {#if showCards}
        {#each months as month, i}
          <a 
            href="/month/{month.id}" 
            class="month-card"
            in:scale={{ duration: 400, delay: i * 100, start: 0.9 }}
          >
            <div class="card-decoration">
              <span class="decoration-circle"></span>
              <span class="decoration-circle"></span>
              <span class="decoration-circle"></span>
            </div>
            <div class="card-content">
              <div class="month-icon">???</div>
              <h4 class="month-label">{month.label}</h4>
              <p class="month-period">{month.period}</p>
              <div class="card-footer">
                <span class="view-text">View Budget</span>
                <span class="arrow">?</span>
              </div>
            </div>
            <div class="card-shine"></div>
          </a>
        {/each}
      {/if}
    </div>
  </section>

  <section class="family-stats" in:fade={{ duration: 800, delay: 800 }}>
    <div class="stat-card husband">
      <span class="stat-icon">??</span>
      <div class="stat-info">
        <h4>Husband</h4>
        <p>Fixed Expenses & Daily Needs</p>
      </div>
    </div>
    <div class="stat-card wife">
      <span class="stat-icon">??</span>
      <div class="stat-info">
        <h4>Wife</h4>
        <p>Family Support & Personal Needs</p>
      </div>
    </div>
    <div class="stat-card family">
      <span class="stat-icon">????????</span>
      <div class="stat-info">
        <h4>Family</h4>
        <p>Together for our future</p>
      </div>
    </div>
  </section>
</div>

<style>
  .home-container {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  .hero {
    text-align: center;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(254, 243, 199, 0.9) 100%);
    padding: 3rem 2rem;
    border-radius: 30px;
    box-shadow: var(--shadow-card);
    border: 2px solid rgba(251, 191, 36, 0.5);
    position: relative;
    overflow: hidden;
  }

  .hero::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(244, 114, 182, 0.1) 0%, transparent 70%);
    animation: float 6s ease-in-out infinite;
  }

  .hero-hearts {
    display: flex;
    justify-content: center;
    gap: 1rem;
    font-size: 2rem;
    margin-bottom: 1rem;
    position: relative;
    z-index: 1;
  }

  .hero-hearts span {
    animation: heartbeat 2s ease-in-out infinite;
  }

  .hero-hearts span:nth-child(2) {
    animation-delay: 0.3s;
  }

  .hero-hearts span:nth-child(3) {
    animation-delay: 0.6s;
  }

  .hero-title {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
    position: relative;
    z-index: 1;
    background: linear-gradient(135deg, #d97706 0%, #db2777 50%, #2563eb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-description {
    font-size: 1.1rem;
    color: var(--text-secondary);
    position: relative;
    z-index: 1;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.6rem;
    margin-bottom: 1.5rem;
    color: var(--text-primary);
  }

  .months-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .month-card {
    background: var(--card-bg);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    padding: 1.5rem;
    text-decoration: none;
    color: inherit;
    box-shadow: var(--shadow-card);
    border: 2px solid transparent;
    background-clip: padding-box;
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    display: block;
  }

  .month-card::before {
    content: "";
    position: absolute;
    inset: 0;
    padding: 2px;
    background: linear-gradient(135deg, #fbbf24, #f472b6, #60a5fa);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    border-radius: 20px;
  }

  .month-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 25px 70px rgba(244, 114, 182, 0.35);
  }

  .month-card:hover .card-shine {
    left: 100%;
  }

  .month-card:hover .arrow {
    transform: translateX(8px);
  }

  .card-decoration {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 1rem;
    position: relative;
    z-index: 1;
  }

  .decoration-circle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fbbf24, #f472b6);
  }

  .decoration-circle:nth-child(2) {
    background: linear-gradient(135deg, #f472b6, #60a5fa);
  }

  .decoration-circle:nth-child(3) {
    background: linear-gradient(135deg, #60a5fa, #34d399);
  }

  .card-content {
    position: relative;
    z-index: 1;
  }

  .month-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
    display: inline-block;
    animation: float 3s ease-in-out infinite;
  }

  .month-label {
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }

  .month-period {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid rgba(251, 191, 36, 0.3);
    font-weight: 600;
    color: #d97706;
  }

  .arrow {
    transition: transform 0.3s ease;
    font-size: 1.2rem;
  }

  .card-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    transition: left 0.6s ease;
    z-index: 0;
  }

  .family-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: var(--card-bg);
    backdrop-filter: blur(10px);
    padding: 1.25rem;
    border-radius: 16px;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: var(--shadow-card);
    border: 2px solid transparent;
  }

  .stat-card.husband {
    border-color: rgba(96, 165, 250, 0.5);
  }

  .stat-card.wife {
    border-color: rgba(244, 114, 182, 0.5);
  }

  .stat-card.family {
    border-color: rgba(52, 211, 153, 0.5);
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-info h4 {
    font-size: 1.1rem;
    margin-bottom: 0.25rem;
  }

  .stat-info p {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .hero-title {
      font-size: 2rem;
    }
    .months-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

