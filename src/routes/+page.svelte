<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import {
    subscribeAllBudgets,
    fetchBudget,
    saveBudget,
    deleteBudget
  } from "#lib/budget-store";
  import {
    computeTotals,
    createEmptyBudget,
    formatCurrency,
    makeId,
    monthsOfYear,
    type MonthBudget,
    type FixedExpense
  } from "#lib/types";
  import { isAuthenticated } from "#lib/auth";
  import { t, lang } from "#lib/i18n.svelte";
  import Seo from "#lib/components/Seo.svelte";
  import Skeleton from "#lib/components/Skeleton.svelte";

  let budgets = $state<MonthBudget[]>([]);
  let loading = $state(true);
  let busy = $state(false);
  let showAllMonths = $state(false);

  const thisYear = new Date().getFullYear();

  // Redirect to login when not authenticated.
  onMount(() => {
    if (!isAuthenticated()) {
      location.href = "/login";
      return;
    }

    // Live-sync the dashboard: new/edited/deleted months appear immediately
    // without a reload.
    const unsubscribe = subscribeAllBudgets((next) => {
      budgets = next;
      loading = false;
    });

    return () => {
      unsubscribe();
    };
  });

  // The current period is the one containing today, based on the 25th cycle.
  const currentMonthId = $derived(currentPeriodId());
  // All months from the earliest budget year (or this year) through the current
  // period, newest first.
  const orderedMonths = $derived(allMonthsTo(currentMonthId).reverse());
  // Show the 8 most recent by default; reveal the rest via "View more".
  const visibleMonths = $derived(showAllMonths ? orderedMonths : orderedMonths.slice(0, 8));
  const hasMoreMonths = $derived(orderedMonths.length > 8);

  const usedIds = $derived(new Set(budgets.map((b) => b.id)));

  // The budget for the current period (may be undefined if not created yet).
  const currentBudget = $derived(budgets.find((b) => b.id === currentMonthId));
  const currentTotals = $derived(currentBudget ? computeTotals(currentBudget) : null);

  // This month's headline numbers.
  const currentIncome = $derived(currentTotals ? currentTotals.totalIncome : 0);
  const currentFixedExpense = $derived(currentTotals ? currentTotals.totalFixedExpenses : 0);
  const currentBalance = $derived(currentIncome - currentFixedExpense);
  const currentPerPerson = $derived(currentTotals ? currentTotals.equalSplitAmount : 0);

  // Daily spending for the CURRENT month only (broken down per spouse).
  const currentSalaryHusband = $derived(currentTotals ? currentTotals.husbandDailyFromSalaryTotal : 0);
  const currentSalaryWife = $derived(currentTotals ? currentTotals.wifeDailyFromSalaryTotal : 0);
  const currentSavingsHusband = $derived(currentTotals ? currentTotals.husbandDailyFromSavingsTotal : 0);
  const currentSavingsWife = $derived(currentTotals ? currentTotals.wifeDailyFromSavingsTotal : 0);
  const currentSalary = $derived(currentSalaryHusband + currentSalaryWife);
  const currentSavings = $derived(currentSavingsHusband + currentSavingsWife);

  function monthLabel(id: string): string {
    // Reflect the END month of the period (e.g. 2026-10 -> "November 2026").
    const [year, month] = id.split("-").map(Number);
    const end = new Date(year, month || 1, 24);
    const locale = lang.value === "id" ? "id-ID" : "en-US";
    return `${end.toLocaleString(locale, { month: "long" })} ${end.getFullYear()}`;
  }

  function monthBudget(id: string): MonthBudget | undefined {
    return budgets.find((b) => b.id === id);
  }

  function monthPeriod(id: string): string {
    const budget = monthBudget(id);
    if (budget?.period) return budget.period;
    return "25th → 24th";
  }

  /**
   * The budget period that contains today. A period `YYYY-MM` covers the 25th
   * of month (M-1) through the 24th of month M. For example `2026-10` covers
   * 25 Oct – 24 Nov. So if today is the 25th or later, we are already in the
   * current month's period; otherwise we are still in the previous month's.
   */
  function currentPeriodId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-based
    const day = now.getDate();
    const startMonth = day >= 25 ? month : month - 1;
    const [targetYear, targetMonth] = startMonth <= 0 ? [year - 1, 12] : [year, startMonth];
    return `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  }

  /**
   * All month ids from the start of the earliest budget year up to `end`.
   * Falls back to the current year when no budgets exist yet.
   */
  function allMonthsTo(end: string): string[] {
    const endYear = Number(end.slice(0, 4));
    const startYear = Math.min(thisYear, endYear);
    const result: string[] = [];
    for (let year = startYear; year <= endYear; year++) {
      for (const id of monthsOfYear(year)) {
        if (id <= end) result.push(id);
      }
    }
    return result;
  }

  /** ID of the calendar month before `id` (`YYYY-MM`). */
  function previousMonthId(id: string): string {
    const [year, month] = id.split("-").map(Number);
    if (month <= 1) return `${year - 1}-12`;
    return `${year}-${String(month - 1).padStart(2, "0")}`;
  }

  async function createMonth(id: string) {
    if (usedIds.has(id)) {
      location.href = `/month/${id}`;
      return;
    }
    busy = true;
    const budget = createEmptyBudget(id);

    // Copy ALL fixed expenses from the previous month (checked and unchecked),
    // but reset them to unchecked for the new period. Also carry over income.
    const prev = await fetchBudget(previousMonthId(id));
    const carryHusband = prev.husbandFixed ?? [];
    const carryWife = prev.wifeFixed ?? [];
    if (carryHusband.length > 0 || carryWife.length > 0) {
      const newId = () => makeId();
      budget.husbandFixed = carryHusband.map((i: FixedExpense) => ({ ...i, id: newId(), checked: false }));
      budget.wifeFixed = carryWife.map((i: FixedExpense) => ({ ...i, id: newId(), checked: false }));
    }
    if ((prev.husbandIncome ?? 0) > 0) budget.husbandIncome = prev.husbandIncome;
    if ((prev.wifeIncome ?? 0) > 0) budget.wifeIncome = prev.wifeIncome;

    // Always start a new month with the routine monthly sadaqah (auto donate).
    budget.husbandDailyFromSalary = [
      { id: makeId(), name: "Sedekah Jariyah", amount: 30000, method: "Auto Donate" }
    ];

    await saveBudget(budget);
    budgets = [...budgets, budget].sort((a, b) => b.id.localeCompare(a.id));
    busy = false;
    location.href = `/month/${budget.id}`;
  }

  async function removeMonth(id: string) {
    if (!confirm(t("dashboard.confirmDelete", { month: monthLabel(id) }))) return;
    await deleteBudget(id);
    budgets = budgets.filter((b) => b.id !== id);
  }
</script>

<Seo title={t("dashboard.pageTitle")} description={t("seo.dashboardDescription")} path="/" />

<div class="page">
  <div in:fade={{ duration: 500 }} class="hero">
    <p class="hero-eyebrow">{t("dashboard.heroEyebrow")}</p>
    <h1 class="hero-title">{t("dashboard.heroTitleLine1")}<br />{t("dashboard.heroTitleLine2")}</h1>
    <p class="hero-sub">
      {t("dashboard.heroSub")}
    </p>
  </div>

  {#if loading}
    <!-- Overview skeleton (mirrors the real summary layout) -->
    <div class="overview" aria-hidden="true">
      <div class="overview-head">
        <Skeleton width="90px" height="0.9rem" />
        <Skeleton width="120px" height="0.78rem" />
      </div>
      {#each Array(6) as _}
        <div class="overview-item">
          <Skeleton width="60%" height="0.68rem" />
          <Skeleton width="80%" height="1.35rem" />
          <Skeleton width="70%" height="0.7rem" />
        </div>
      {/each}
    </div>
  {:else if budgets.length}
    <div class="overview" in:fly={{ y: 14, duration: 450, delay: 80 }}>
      <div class="overview-head">
        <span class="overview-head-title">{t("dashboard.thisMonth")}</span>
        <span class="overview-head-sub">{monthLabel(currentMonthId)}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">{t("dashboard.totalIncome")}</span>
        <span class="overview-value income">{formatCurrency(currentIncome)}</span>
        <span class="overview-sub">{t("dashboard.husbandWife")}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">{t("dashboard.totalFixed")}</span>
        <span class="overview-value expense">{formatCurrency(currentFixedExpense)}</span>
        <span class="overview-sub">{t("dashboard.husbandWifeFixed")}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">{t("dashboard.balanceAfterFixed")}</span>
        <span class="overview-value" class:negative={currentBalance < 0}>{formatCurrency(currentBalance)}</span>
        <span class="overview-sub">{t("dashboard.incomeMinusFixed")}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">{t("dashboard.perPerson")}</span>
        <span class="overview-value teal">{formatCurrency(currentPerPerson)}</span>
        <span class="overview-sub">{t("dashboard.afterFixedSplit")}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">{t("dashboard.dailyFromSalary")}</span>
        <span class="overview-value rose">{formatCurrency(currentSalary)}</span>
        <span class="overview-sub">{t("common.husband").toLowerCase()} {formatCurrency(currentSalaryHusband)} · {t("common.wife").toLowerCase()} {formatCurrency(currentSalaryWife)}</span>
      </div>
      <div class="overview-item">
        <span class="overview-label">{t("dashboard.dailyFromSavings")}</span>
        <span class="overview-value blue">{formatCurrency(currentSavings)}</span>
        <span class="overview-sub">{t("common.husband").toLowerCase()} {formatCurrency(currentSavingsHusband)} · {t("common.wife").toLowerCase()} {formatCurrency(currentSavingsWife)}</span>
      </div>
    </div>
  {/if}

  <div class="section-label" in:fly={{ y: 14, duration: 450, delay: 120 }}>
    <span>{t("dashboard.budgetPeriods")}</span>
  </div>

  {#if loading}
    <!-- Month card skeletons -->
    <div class="months-grid" aria-hidden="true">
      {#each Array(6) as _}
        <div class="month-card">
          <div class="card-link">
            <div class="card-top">
              <div class="card-titleblock">
                <Skeleton width="110px" height="1.05rem" />
                <Skeleton width="90px" height="0.72rem" />
              </div>
              <Skeleton width="48px" height="18px" radius="999px" />
            </div>
            <div class="card-person">
              <Skeleton width="60px" height="0.72rem" />
              <Skeleton width="80px" height="1rem" />
            </div>
            <div class="card-groups">
              <div class="card-group">
                <Skeleton width="50px" height="0.66rem" />
                <div class="card-group-row"><Skeleton width="45px" height="0.7rem" /><Skeleton width="70px" height="0.7rem" /></div>
                <div class="card-group-row"><Skeleton width="55px" height="0.7rem" /><Skeleton width="70px" height="0.7rem" /></div>
              </div>
              <div class="card-group">
                <Skeleton width="40px" height="0.66rem" />
                <div class="card-group-row"><Skeleton width="45px" height="0.7rem" /><Skeleton width="70px" height="0.7rem" /></div>
                <div class="card-group-row"><Skeleton width="55px" height="0.7rem" /><Skeleton width="70px" height="0.7rem" /></div>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="months-grid" in:fly={{ y: 14, duration: 450, delay: 140 }}>
      {#each visibleMonths as id}
        {@const exists = usedIds.has(id)}
        {@const budget = monthBudget(id)}
        {@const totals = budget ? computeTotals(budget) : null}
        {@const isCurrent = id === currentMonthId}
        <div
          class="month-card"
          class:current={isCurrent}
          class:exists={exists}
          class:past={exists && !isCurrent}
        >
          <a
            href="/month/{id}"
            class="card-link"
            onclick={(e) => {
              if (!exists) {
                e.preventDefault();
                createMonth(id);
              }
            }}
          >
            <div class="card-top">
              <div class="card-titleblock">
                <span class="card-month">{monthLabel(id)}</span>
                <span class="card-period">{monthPeriod(id)}</span>
              </div>
              {#if isCurrent && exists}
                <span class="card-badge current">{t("dashboard.active")}</span>
              {:else if exists}
                <span class="card-badge past">{t("dashboard.past")}</span>
              {:else}
                <span class="card-badge new">{t("dashboard.new")}</span>
              {/if}
            </div>

            {#if exists && totals}
              <div class="card-person">
                <span class="card-person-label">{t("dashboard.perPerson")}</span>
                <span class="card-person-value">{formatCurrency(totals.equalSplitAmount)}</span>
              </div>
              <div class="card-groups">
                <div class="card-group">
                  <span class="card-group-title">{t("common.husband")}</span>
                  <div class="card-group-row"><span>{t("common.salary")}</span><b class="blue">{formatCurrency(totals.husbandDailyFromSalaryTotal)}</b></div>
                  <div class="card-group-row"><span>{t("common.savings")}</span><b class="blue">{formatCurrency(totals.husbandDailyFromSavingsTotal)}</b></div>
                </div>
                <div class="card-group">
                  <span class="card-group-title">{t("common.wife")}</span>
                  <div class="card-group-row"><span>{t("common.salary")}</span><b class="rose">{formatCurrency(totals.wifeDailyFromSalaryTotal)}</b></div>
                  <div class="card-group-row"><span>{t("common.savings")}</span><b class="rose">{formatCurrency(totals.wifeDailyFromSavingsTotal)}</b></div>
                </div>
              </div>
            {:else}
              <div class="card-empty">
                <span class="card-empty-icon">+</span>
                <span>{t("dashboard.noBudgetYetTap")}</span>
              </div>
            {/if}
          </a>
        </div>
      {/each}
    </div>
  {/if}

  {#if !loading && hasMoreMonths}
    <div class="months-toggle">
      <button class="toggle-btn" onclick={() => (showAllMonths = !showAllMonths)}>
        {showAllMonths ? t("common.viewLess") : t("dashboard.viewMore", { n: orderedMonths.length - 8 })}
        <span class="toggle-arrow">{showAllMonths ? "↑" : "↓"}</span>
      </button>
    </div>
  {/if}

  {#if !loading && budgets.length === 0}
    <div class="empty-state" in:fade={{ duration: 400 }}>
      <span class="empty-icon">◻</span>
      <h3>{t("dashboard.noBudgetTitle")}</h3>
      <p>{t("dashboard.noBudgetText")}</p>
    </div>
  {/if}

  {#if !loading}
    <div in:fade={{ duration: 500, delay: 400 }} class="info-strip">
      <div class="info-item"><span class="info-dot blue"></span><span><b>{t("dashboard.infoIncomeFixed")}</b> — {t("dashboard.infoIncomeFixedSub")}</span></div>
      <div class="info-item"><span class="info-dot rose"></span><span><b>{t("dashboard.infoSalary")}</b> — {t("dashboard.infoSalarySub")}</span></div>
      <div class="info-item"><span class="info-dot teal"></span><span><b>{t("dashboard.infoSavings")}</b> — {t("dashboard.infoSavingsSub")}</span></div>
      <div class="info-item"><span class="info-dot gold"></span><span><b>{t("dashboard.infoPerPerson")}</b> — {t("dashboard.infoPerPersonSub")}</span></div>
    </div>
  {/if}
</div>

<style>
  .page { display: flex; flex-direction: column; gap: 2rem; }

  .hero { padding: 3rem 0 1rem; border-bottom: 1px solid var(--surface-border); }
  .hero-eyebrow { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent-gold); margin-bottom: 1rem; }
  .hero-title { font-size: clamp(2.25rem, 5vw, 3.5rem); line-height: 1.05; letter-spacing: -0.03em; margin-bottom: 1rem; }
  .hero-sub { font-size: 1.05rem; color: var(--text-secondary); max-width: 520px; line-height: 1.7; }

  .overview {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm);
  }
  .overview-head { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 0.6rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--surface-border); }
  .overview-head-title { font-size: 0.9rem; font-weight: 800; color: var(--text-primary); }
  .overview-head-sub { font-size: 0.78rem; color: var(--text-tertiary); }
  .overview-item { display: flex; flex-direction: column; gap: 0.25rem; }
  .overview-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); }
  .overview-value { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.02em; }
  .overview-sub { font-size: 0.7rem; color: var(--text-tertiary); }
  .overview-value.income { color: var(--success); }
  .overview-value.expense { color: var(--accent-gold); }
  .overview-value.teal { color: var(--accent-teal); }
  .overview-value.rose { color: var(--accent-rose); }
  .overview-value.blue { color: var(--accent-blue); }
  .overview-value.negative { color: var(--danger); }

  .section-label { display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); }
  .section-label::after { content: ""; flex: 1; height: 1px; background: var(--surface-border); }
  .months-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }

  .months-toggle { display: flex; justify-content: center; }
  .toggle-btn {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1.1rem; border-radius: 999px;
    background: var(--bg-muted); border: 1.5px solid var(--surface-border);
    color: var(--text-secondary); font-size: 0.82rem; font-weight: 700;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .toggle-btn:hover { background: var(--surface); border-color: var(--accent-gold); color: var(--accent-gold); }
  .toggle-arrow { font-size: 0.8rem; line-height: 1; }

  .month-card {
    position: relative; background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);
    display: flex; flex-direction: column; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .month-card::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--surface-border); }
  .month-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }

  .card-link { text-decoration: none; color: inherit; padding: 1.15rem 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; flex: 1; }

  .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
  .card-titleblock { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
  .card-month { font-size: 1.05rem; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
  .card-period { font-size: 0.74rem; color: var(--text-tertiary); }

  .card-badge {
    flex-shrink: 0; font-size: 0.62rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 0.22rem 0.6rem; border-radius: 999px;
  }
  .card-badge.new { background: var(--accent-gold-light); color: var(--accent-gold); }
  .card-badge.past { background: var(--bg-muted); color: var(--text-tertiary); }
  .card-badge.current { background: var(--success-light); color: var(--success); }

  .card-person { display: flex; align-items: baseline; justify-content: space-between; background: linear-gradient(135deg, var(--accent-teal-light), var(--surface)); border-radius: var(--radius-md); padding: 0.45rem 0.7rem; }
  .card-person-label { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); }
  .card-person-value { font-size: 1.05rem; font-weight: 800; color: var(--accent-teal); }

  .card-groups { display: flex; flex-direction: column; gap: 0.5rem; }
  .card-group { min-width: 0; background: var(--bg-muted); border-radius: var(--radius-sm); padding: 0.5rem 0.7rem; }
  .card-group-title { display: block; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 0.3rem; }
  .card-group-row { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; min-width: 0; font-size: 0.76rem; color: var(--text-tertiary); padding: 0.12rem 0; }
  .card-group-row b { min-width: 0; overflow-wrap: anywhere; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .card-group-row b.rose { color: var(--accent-rose); }
  .card-group-row b.blue { color: var(--accent-blue); }

  .card-empty {
    display: flex; align-items: center; gap: 0.5rem; justify-content: center;
    padding: 1.25rem; border: 1.5px dashed var(--surface-border); border-radius: var(--radius-md);
    color: var(--text-tertiary); font-size: 0.85rem; font-weight: 600;
  }
  .card-empty-icon { font-size: 1.1rem; font-weight: 700; color: var(--accent-gold); }

  /* Current (active) month stands out, but not overdone. */
  .month-card.current { border-color: rgba(91, 138, 138, 0.55); box-shadow: 0 0 0 1px rgba(91, 138, 138, 0.2), var(--shadow-md); }
  .month-card.current::before { background: linear-gradient(90deg, var(--accent-teal), var(--accent-gold)); }
  .month-card.past::before { background: var(--bg-muted); }

  .empty-state { text-align: center; padding: 4rem 2rem; background: var(--surface); border: 1px dashed var(--surface-border); border-radius: var(--radius-xl); }
  .empty-icon { font-size: 2.25rem; display: block; margin-bottom: 1rem; color: var(--text-tertiary); }
  .empty-state h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; }
  .empty-state p { font-size: 0.85rem; color: var(--text-tertiary); }

  .info-strip { display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; padding: 1.25rem 1.5rem; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
  .info-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.4; }
  .info-item b { color: var(--text-primary); font-weight: 700; }
  .info-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .info-dot.blue { background: var(--accent-blue); }
  .info-dot.rose { background: var(--accent-rose); }
  .info-dot.teal { background: var(--accent-teal); }
  .info-dot.gold { background: var(--accent-gold); }

  @media (max-width: 1000px) {
    .overview { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 640px) {
    .overview { grid-template-columns: 1fr; }
    .months-grid { grid-template-columns: 1fr; }
    .hero { padding: 2rem 0 1rem; }
  }
</style>
