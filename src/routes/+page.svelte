<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { MOTION, motionFade, motionFly } from "#lib/motion";
  import {
    subscribeAllBudgets,
    fetchBudget,
    saveBudget,
    deleteBudget
  } from "#lib/budget-store";
  import { buildBackupJson, parseBackup, toBudgetsCsv } from "#lib/backup";
  import { downloadBudgetsPdf } from "#lib/backup-pdf";
  import {
    BUDGET_SECTION_KEYS,
    computeTotals,
    createBudgetFromPrevious,
    formatCurrency,
    todayISO,
    totalExpenses,
    type MonthBudget,
    type DailyExpense,
    type DailySectionKey
  } from "#lib/types";
  import { isAuthenticated } from "#lib/auth";
  import { toastAction, toastError, toastSuccess } from "#lib/toast.svelte";
  import { currentPeriodId, listedPeriodIds, monthLabel, previousMonthId } from "#lib/period";
  import { highlightText, matchesQuery } from "#lib/search";
  import { monthPageSize } from "#lib/month-grid";
  import { equalSplitCardKind, isPeriodStartDay } from "#lib/equal-split";
  import { t, lang } from "#lib/i18n.svelte";
  import Seo from "#lib/components/Seo.svelte";
  import Skeleton from "#lib/components/Skeleton.svelte";
  import SearchBar from "#lib/components/SearchBar.svelte";
  import CountUp from "#lib/components/CountUp.svelte";
  import QuickAddDailyExpense from "#lib/components/QuickAddDailyExpense.svelte";

  let budgets = $state<MonthBudget[]>([]);
  let loading = $state(true);
  let busy = $state(false);
  let showAllMonths = $state(false);
  let searchQuery = $state("");
  let quickAddOpen = $state(false);
  let importInput = $state<HTMLInputElement | null>(null);
  let exportingPdf = $state(false);

  const LAST_OPEN_KEY = "fhb-last-open";

  /** Open the summary on the first visit today, folded on every later visit. */
  function initialOverviewExpanded(): boolean {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(LAST_OPEN_KEY) !== todayISO();
  }

  let overviewExpanded = $state(initialOverviewExpanded());

  function toggleOverview() {
    overviewExpanded = !overviewExpanded;
  }

  onMount(() => {
    if (!isAuthenticated()) {
      location.href = "/login";
      return;
    }

    // Stamp today so the next visit (still today) starts with the summary
    // folded; tomorrow it opens again.
    if (typeof localStorage !== "undefined") localStorage.setItem(LAST_OPEN_KEY, todayISO());

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

  // The active period contains today (25th cycle). The dashboard lists one
  // period further ahead from the 21st, so the upcoming card can be prepared
  // early without moving the cycle itself.
  const currentMonthId = $derived(currentPeriodId());
  // All months from the earliest budget year (or this year) through the newest
  // listed period, newest first. Shared with the month page's URL gate.
  const orderedMonths = $derived(listedPeriodIds().reverse());

  // The month grid is responsive, so the first page fills complete rows instead
  // of always showing 8 cards (which meant 8 tall rows on a phone).
  let monthsGridEl = $state<HTMLDivElement | null>(null);
  let monthColumns = $state(3);

  $effect(() => {
    const el = monthsGridEl;
    if (!el) return;

    const update = () => {
      // Read the used column list so the CSS breakpoints stay the source of truth.
      const columns = getComputedStyle(el).gridTemplateColumns
        .split(" ")
        .filter(Boolean).length;
      monthColumns = Math.max(1, columns);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  });

  // Phones: 4 rows; tablets (2 columns): 3 rows; wider grids: 2 full rows.
  const monthLimit = $derived(monthPageSize(monthColumns));
  // Show the first page of months; reveal the rest via "View more".
  const visibleMonths = $derived(showAllMonths ? orderedMonths : orderedMonths.slice(0, monthLimit));
  const hasMoreMonths = $derived(orderedMonths.length > monthLimit);

  const usedIds = $derived(new Set(budgets.map((b) => b.id)));

  // ── Cross-month item search ─────────────────────────────────────────────

  /** A single item match inside a month, tagged with its section label. */
  interface ItemMatch {
    id: string;
    name: string;
    section: string;
  }

  /** Collect every item in a budget that matches `query`, with section labels. */
  function findMatchingItems(budget: MonthBudget, query: string): ItemMatch[] {
    const matches: ItemMatch[] = [];
    if (matchesQuery(t("month.husbandIncome"), undefined, query)) {
      matches.push({ id: "husband-income", name: t("month.husbandIncome"), section: t("month.section1") });
    }
    if (matchesQuery(t("month.wifeIncome"), undefined, query)) {
      matches.push({ id: "wife-income", name: t("month.wifeIncome"), section: t("month.section2") });
    }
    BUDGET_SECTION_KEYS.forEach((key, i) => {
      if (key === "husbandIncome" || key === "wifeIncome") return;
      const items = (budget[key] ?? []) as { id: string; name: string; method?: string }[];
      for (const item of items) {
        if (matchesQuery(item.name, item.method, query)) {
          matches.push({ id: item.id, name: item.name, section: t(`month.section${i + 1}`) });
        }
      }
    });
    return matches;
  }

  /**
   * When a query is active, only months that contain a matching item are shown;
   * each is paired with the matches so they can be listed inside the card.
   */
  const searchActive = $derived(searchQuery.trim().length > 0);

  const searchResults = $derived(
    orderedMonths
      .map((id) => {
        const budget = monthBudget(id);
        const items = budget ? findMatchingItems(budget, searchQuery) : [];
        return { id, items };
      })
      .filter((result) => result.items.length > 0)
  );

  /** Month ids currently rendered in the grid (search results or the normal list). */
  const visibleMonthIds = $derived(
    searchActive ? searchResults.map((result) => result.id) : visibleMonths
  );

  // Scroll to the first matching month when a search is committed.
  $effect(() => {
    if (searchActive && searchResults.length > 0) {
      const target = document.getElementById(`month-${searchResults[0].id}`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // The budget for the current period (may be undefined if not created yet).
  const currentBudget = $derived(budgets.find((b) => b.id === currentMonthId));
  const currentTotals = $derived(currentBudget ? computeTotals(currentBudget) : null);

  const currentIncome = $derived(currentTotals ? currentTotals.totalIncome : 0);
  const currentFixedExpense = $derived(currentTotals ? currentTotals.totalFixedExpenses : 0);
  const currentPerPerson = $derived(currentTotals ? currentTotals.equalSplitAmount : 0);

  // The split card shows a pending transfer until it is settled: the wife's
  // transfer stays visible until she marks it received, while the husband's
  // transfer is assumed done from the 26th on.
  const currentShowTransfer = $derived(
    currentTotals
      ? equalSplitCardKind(
          currentTotals.equalSplitTransfer,
          currentBudget?.transferReceived ?? false,
          isPeriodStartDay(currentBudget?.periodStart ?? `${currentMonthId}-25`)
        ) === "transfer"
      : false
  );
  const currentTransferAmount = $derived(
    currentTotals ? Math.abs(currentTotals.equalSplitTransfer) : 0
  );
  const currentTransferDirection = $derived(
    (currentTotals?.equalSplitTransfer ?? 0) >= 0
      ? `${t("common.husband")} → ${t("common.wife")}`
      : `${t("common.wife")} → ${t("common.husband")}`
  );

  const currentIncomeHusband = $derived(currentBudget ? currentBudget.husbandIncome : 0);
  const currentIncomeWife = $derived(currentBudget ? currentBudget.wifeIncome : 0);
  const currentFixedHusband = $derived(currentTotals ? currentTotals.husbandFixedTotal : 0);
  const currentFixedWife = $derived(currentTotals ? currentTotals.wifeFixedTotal : 0);

  const currentSalaryHusband = $derived(currentTotals ? currentTotals.husbandDailyFromSalaryTotal : 0);
  const currentSalaryWife = $derived(currentTotals ? currentTotals.wifeDailyFromSalaryTotal : 0);
  const currentSavingsHusband = $derived(currentTotals ? currentTotals.husbandDailyFromSavingsTotal : 0);
  const currentSavingsWife = $derived(currentTotals ? currentTotals.wifeDailyFromSavingsTotal : 0);
  const currentSalary = $derived(currentSalaryHusband + currentSalaryWife);
  const currentSavings = $derived(currentSavingsHusband + currentSavingsWife);

  const currentTotalExpense = $derived(currentFixedExpense + currentSalary + currentSavings);
  const currentTotalExpenseHusband = $derived(
    currentFixedHusband + currentSalaryHusband + currentSavingsHusband
  );
  const currentTotalExpenseWife = $derived(
    currentFixedWife + currentSalaryWife + currentSavingsWife
  );

  const locale = $derived(lang.value === "id" ? "id-ID" : "en-US");

  function monthBudget(id: string): MonthBudget | undefined {
    return budgets.find((b) => b.id === id);
  }

  function monthPeriod(id: string): string {
    const budget = monthBudget(id);
    if (budget?.period) return budget.period;
    return "25th → 24th";
  }

  async function createMonth(id: string) {
    if (usedIds.has(id)) {
      location.href = `/month/${id}`;
      return;
    }
    busy = true;
    // Carry over fixed expenses (unchecked) and income from the previous
    // period; the shared helper also seeds the routine sadaqah.
    const prev = await fetchBudget(previousMonthId(id));
    const budget = createBudgetFromPrevious(id, prev);

    await saveBudget(budget);
    budgets = [...budgets, budget].sort((a, b) => b.id.localeCompare(a.id));
    busy = false;
    location.href = `/month/${budget.id}`;
  }

  /**
   * Append a daily expense to the active period. When that period has no
   * document yet, create it with the same carry-over a month card would use,
   * so quick-add works without opening the month page first.
   */
  async function quickAddExpense(sectionKey: DailySectionKey, item: DailyExpense): Promise<boolean> {
    try {
      let budget = currentBudget;
      if (!budget) {
        const prev = await fetchBudget(previousMonthId(currentMonthId));
        budget = createBudgetFromPrevious(currentMonthId, prev);
      }
      const next = {
        ...budget,
        [sectionKey]: [...budget[sectionKey], item]
      } as MonthBudget;

      await saveBudget(next);
      // Keep the local state in step before the live snapshot arrives, so the
      // summary numbers move as soon as the sheet closes.
      budgets = usedIds.has(next.id)
        ? budgets.map((b) => (b.id === next.id ? next : b))
        : [...budgets, next].sort((a, b) => b.id.localeCompare(a.id));
      toastSuccess(t("toast.added"));
      return true;
    } catch (error) {
      console.error("Failed to add daily expense:", error);
      toastError(t("toast.saveFailed"));
      return false;
    }
  }

  async function removeMonth(id: string) {
    const snapshot = budgets.find((b) => b.id === id);
    if (!snapshot) return;
    try {
      await deleteBudget(id);
    } catch (error) {
      console.error("Failed to delete budget:", error);
      toastError(t("toast.saveFailed"));
      return;
    }
    budgets = budgets.filter((b) => b.id !== id);
    toastAction(t("toast.monthDeleted", { month: snapshot.title }), t("common.undo"), () => {
      void saveBudget(snapshot).then(
        () => {
          budgets = [...budgets, snapshot].sort((a, b) => b.id.localeCompare(a.id));
          toastSuccess(t("toast.restored"));
        },
        (error) => {
          console.error("Failed to restore budget:", error);
          toastError(t("toast.saveFailed"));
        }
      );
    });
  }

  function downloadBackup(text: string, extension: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `monthly-budget-${todayISO()}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    toastSuccess(t("backup.exported"));
  }

  async function exportPdf() {
    if (exportingPdf) return;
    exportingPdf = true;
    try {
      await downloadBudgetsPdf(budgets, {
        title: t("backup.title"),
        generated: t("backup.pdfGenerated", {
          date: new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
        }),
        summary: t("backup.pdfSummary"),
        period: t("backup.pdfPeriod"),
        totalIncome: t("month.totalIncome"),
        totalExpense: t("month.totalExpense"),
        name: t("expense.nameLabel"),
        amount: t("expense.amountLabel"),
        method: t("expense.method"),
        date: t("expense.date"),
        noItems: t("backup.pdfNoItems"),
        page: t("backup.pdfPage"),
        sections: [
          t("month.section1"),
          t("month.section2"),
          t("month.section3"),
          t("month.section4"),
          t("month.section5"),
          t("month.section6"),
          t("month.section7"),
          t("month.section8")
        ]
      });
      toastSuccess(t("backup.exported"));
    } catch (error) {
      console.error("Failed to create PDF:", error);
      toastError(t("backup.exportFailed"));
    } finally {
      exportingPdf = false;
    }
  }

  async function restoreBackup(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    let restored: MonthBudget[];
    let skipped: number;
    try {
      ({ budgets: restored, skipped } = parseBackup(await file.text()));
    } catch (error) {
      console.error("Invalid backup file:", error);
      toastError(t("backup.invalidFile"));
      return;
    }
    if (restored.length === 0) {
      toastError(t("backup.invalidFile"));
      return;
    }
    if (!confirm(t("backup.confirmReplace", { n: restored.length }))) return;

    try {
      for (const budget of restored) await saveBudget(budget);
    } catch (error) {
      console.error("Failed to restore backup:", error);
      toastError(t("backup.importFailed"));
      return;
    }
    const restoredIds = new Set(restored.map((b) => b.id));
    budgets = [...budgets.filter((b) => !restoredIds.has(b.id)), ...restored].sort((a, b) =>
      b.id.localeCompare(a.id)
    );
    toastSuccess(t("backup.imported", { n: restored.length }));
    if (skipped > 0) toastSuccess(t("backup.skipped", { n: skipped }));
  }
</script>

<Seo title={t("dashboard.pageTitle")} description={t("seo.dashboardDescription")} path="/" />

<div class="page">
  {#if loading}
    <span class="sr-only" role="status">{t("common.loading")}</span>
  {/if}
  <div in:fade={motionFade(MOTION.slow)} class="hero">
    <p class="hero-eyebrow animate-rise">{t("dashboard.heroEyebrow")}</p>
    <h1 class="hero-title animate-rise" style="--anim-delay: 0.08s">{t("dashboard.heroTitleLine1")}<br />{t("dashboard.heroTitleLine2")}</h1>
    <p class="hero-sub animate-rise" style="--anim-delay: 0.16s">
      {t("dashboard.heroSub")}
    </p>
  </div>

  <div class="overview-slot">
  {#if loading}
    <!-- Overview skeleton (mirrors the real summary layout) -->
    <div class="overview" aria-hidden="true" out:fade={motionFade(MOTION.fast)}>
      <div class="overview-head">
        <Skeleton width="90px" height="1rem" />
        <Skeleton width="120px" height="0.88rem" />
        <Skeleton circle size={28} style="margin-left:auto;" />
      </div>
      <div class="overview-body" class:collapsed={!overviewExpanded}>
        <div class="overview-body-clip">
          {#each Array(8) as _}
            <div class="overview-item">
              <Skeleton width="60%" height="1.05rem" />
              <Skeleton width="80%" height="1.7rem" />
              <Skeleton width="70%" height="1.1rem" />
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else if budgets.length}
    <div class="overview" in:fly={motionFly(10, MOTION.slow, 60)}>
      <div class="overview-head">
        <span class="overview-head-title">{t("dashboard.overviewTitle")}</span>
        <span class="overview-head-sub">{monthLabel(currentMonthId, locale)}</span>
        <button
          class="overview-toggle"
          type="button"
          aria-expanded={overviewExpanded}
          aria-controls="overview-details"
          aria-label={overviewExpanded ? t("dashboard.collapseOverview") : t("dashboard.expandOverview")}
          title={overviewExpanded ? t("dashboard.collapseOverview") : t("dashboard.expandOverview")}
          onclick={toggleOverview}
        >
          <svg class="overview-chevron" class:open={overviewExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      <div class="overview-body" class:collapsed={!overviewExpanded} id="overview-details" inert={!overviewExpanded}>
        <div class="overview-body-clip">
          <div class="overview-item">
            <span class="overview-label">{t("dashboard.totalIncome")}</span>
            <CountUp value={currentIncome} class="overview-value income" />
            <span class="overview-sub">{t("common.husband")} {formatCurrency(currentIncomeHusband)} · {t("common.wife")} {formatCurrency(currentIncomeWife)}</span>
          </div>
          <div class="overview-item">
            {#if currentShowTransfer}
              <span class="overview-label">{t("month.equalSplitTransfer")}</span>
              <CountUp value={currentTransferAmount} class="overview-value expense" />
              <span class="overview-sub">
                {currentTransferDirection} · {t("month.eachHolds", { amount: formatCurrency(currentPerPerson) })}
              </span>
            {:else}
              <span class="overview-label">{t("dashboard.maxPlannedPerPerson")}</span>
              <CountUp value={currentPerPerson} class="overview-value teal" />
              <span class="overview-sub">
                {#if currentTransferAmount > 0}
                  {t("month.splitTransferNote")}
                  <strong class="split-amount">{formatCurrency(currentTransferAmount)}</strong>
                  · {currentTransferDirection}
                {:else}
                  {t("month.splitTransferNone")}
                {/if}
              </span>
            {/if}
          </div>
          <div class="overview-item">
            <span class="overview-label">{t("dashboard.totalExpense")}</span>
            <CountUp value={currentTotalExpense} class="overview-value expense" />
            <span class="overview-sub">{t("dashboard.expenseBreakdown")}</span>
          </div>
          <div class="overview-item">
            <span class="overview-label">{t("dashboard.totalExpenseHusband")}</span>
            <CountUp value={currentTotalExpenseHusband} class="overview-value blue" />
            <span class="overview-sub">{t("dashboard.expenseBreakdown")}</span>
          </div>
          <div class="overview-item">
            <span class="overview-label">{t("dashboard.totalExpenseWife")}</span>
            <CountUp value={currentTotalExpenseWife} class="overview-value rose" />
            <span class="overview-sub">{t("dashboard.expenseBreakdown")}</span>
          </div>
          <div class="overview-item">
            <span class="overview-label">{t("dashboard.totalFixed")}</span>
            <CountUp value={currentFixedExpense} class="overview-value violet" />
            <span class="overview-sub">{t("common.husband")} {formatCurrency(currentFixedHusband)} · {t("common.wife")} {formatCurrency(currentFixedWife)}</span>
          </div>
          <div class="overview-item">
            <span class="overview-label">{t("dashboard.dailyFromSalary")}</span>
            <CountUp value={currentSalary} class="overview-value indigo" />
            <span class="overview-sub">{t("common.husband")} {formatCurrency(currentSalaryHusband)} · {t("common.wife")} {formatCurrency(currentSalaryWife)}</span>
          </div>
          <div class="overview-item">
            <span class="overview-label">{t("dashboard.dailyFromSavings")}</span>
            <CountUp value={currentSavings} class="overview-value olive" />
            <span class="overview-sub">{t("common.husband")} {formatCurrency(currentSavingsHusband)} · {t("common.wife")} {formatCurrency(currentSavingsWife)}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
  </div>

  <div class="section-label" in:fly={motionFly(10, MOTION.slow, 90)}>
    <span>{t("dashboard.budgetPeriods")}</span>
  </div>

  {#if !loading}
    <div class="search-row" in:fade={motionFade(MOTION.base)}>
      <SearchBar
        query={searchQuery}
        onQueryChange={(q: string) => (searchQuery = q)}
        onClear={() => (searchQuery = "")}
        placeholderKey="dashboard.searchPlaceholder"
      />
    </div>
  {:else}
    <!-- Search skeleton keeps the grid from jumping when the real bar appears. -->
    <div class="search-row" aria-hidden="true">
      <Skeleton width="100%" height="3.5rem" radius="var(--radius-md)" style="max-width:420px;" />
    </div>
  {/if}

  {#if loading}
    <!-- Month card skeletons -->
    <div class="months-grid" aria-hidden="true" bind:this={monthsGridEl}>
      {#each Array(monthLimit) as _}
        <div class="month-card">
          <div class="card-link">
            <div class="card-top">
              <div class="card-titleblock">
                <Skeleton width="110px" height="1.25rem" />
                <Skeleton width="90px" height="1.15rem" />
              </div>
              <Skeleton width="52px" height="1.4rem" radius="999px" />
            </div>
            <div class="card-person">
              <Skeleton width="60px" height="1.1rem" />
              <Skeleton width="80px" height="1.4rem" />
            </div>
            <div class="card-groups">
              {#each Array(2) as _}
                <div class="card-group">
                  <Skeleton width="50px" height="1.05rem" style="margin-bottom:0.3rem;" />
                  <div class="card-group-row"><Skeleton width="45px" height="1.2rem" /><Skeleton width="70px" height="1.2rem" /></div>
                  <div class="card-group-row"><Skeleton width="55px" height="1.2rem" /><Skeleton width="70px" height="1.2rem" /></div>
                  <div class="card-group-row"><Skeleton width="50px" height="1.2rem" /><Skeleton width="70px" height="1.2rem" /></div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="months-grid animate-stagger" in:fly={motionFly(10, MOTION.slow, 110)} bind:this={monthsGridEl}>
      {#each visibleMonthIds as id}
        {@const exists = usedIds.has(id)}
        {@const budget = monthBudget(id)}
        {@const totals = budget ? computeTotals(budget) : null}
        {@const isCurrent = id === currentMonthId}
        {@const matches = searchActive ? searchResults.find((result) => result.id === id)?.items ?? [] : []}
        <div
          class="month-card"
          id="month-{id}"
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
                <span class="card-month">{monthLabel(id, locale)}</span>
                <span class="card-period">{monthPeriod(id)}</span>
              </div>
              {#if searchActive}
                <span class="card-badge match">{matches.length}</span>
              {:else if isCurrent && exists}
                <span class="card-badge current">{t("dashboard.active")}</span>
              {:else if exists}
                <span class="card-badge past">{t("dashboard.past")}</span>
              {:else}
                <span class="card-badge new">{t("dashboard.new")}</span>
              {/if}
            </div>

            {#if searchActive}
              <ul class="card-matches">
                {#each matches as match}
                  <li class="card-match">
                    <span class="card-match-section">{match.section}</span>
                    <span class="card-match-name">{@html highlightText(match.name, searchQuery)}</span>
                  </li>
                {/each}
              </ul>
            {:else if exists && totals}
              <div class="card-person">
                <span class="card-person-label">{t("dashboard.expense")}</span>
                <span class="card-person-value">{formatCurrency(totalExpenses(totals))}</span>
              </div>
              <div class="card-groups">
                <div class="card-group">
                  <span class="card-group-title">{t("common.husband")}</span>
                  <div class="card-group-row"><span>{t("common.fixed")}</span><b class="blue">{formatCurrency(totals.husbandFixedTotal)}</b></div>
                  <div class="card-group-row"><span>{t("common.salary")}</span><b class="blue">{formatCurrency(totals.husbandDailyFromSalaryTotal)}</b></div>
                  <div class="card-group-row"><span>{t("common.savings")}</span><b class="blue">{formatCurrency(totals.husbandDailyFromSavingsTotal)}</b></div>
                </div>
                <div class="card-group">
                  <span class="card-group-title">{t("common.wife")}</span>
                  <div class="card-group-row"><span>{t("common.fixed")}</span><b class="rose">{formatCurrency(totals.wifeFixedTotal)}</b></div>
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

    {#if searchActive && searchResults.length === 0}
      <div class="empty-state" in:fade={motionFade(MOTION.base)}>
        <span class="empty-icon">⌕</span>
        <h3>{t("dashboard.searchEmpty")}</h3>
        <p>“{searchQuery}”</p>
      </div>
    {/if}
  {/if}

  {#if !loading && hasMoreMonths && !searchActive}
    <div class="months-toggle">
      <button class="toggle-btn" onclick={() => (showAllMonths = !showAllMonths)}>
        {showAllMonths ? t("common.viewLess") : t("dashboard.viewMore", { n: orderedMonths.length - monthLimit })}
        <span class="toggle-arrow">{showAllMonths ? "↑" : "↓"}</span>
      </button>
    </div>
  {/if}

  {#if !loading && budgets.length === 0}
    <div class="empty-state" in:fade={motionFade(MOTION.slow)}>
      <span class="empty-icon">◻</span>
      <h3>{t("dashboard.noBudgetTitle")}</h3>
      <p>{t("dashboard.noBudgetText")}</p>
    </div>
  {/if}

  {#if !loading}
    <div in:fade={motionFade(MOTION.slow, 180)} class="info-strip animate-stagger">
      <div class="info-item"><span class="info-dot blue"></span><span><b>{t("dashboard.infoIncomeFixed")}</b> — {t("dashboard.infoIncomeFixedSub")}</span></div>
      <div class="info-item"><span class="info-dot rose"></span><span><b>{t("dashboard.infoSalary")}</b> — {t("dashboard.infoSalarySub")}</span></div>
      <div class="info-item"><span class="info-dot teal"></span><span><b>{t("dashboard.infoSavings")}</b> — {t("dashboard.infoSavingsSub")}</span></div>
      <div class="info-item"><span class="info-dot gold"></span><span><b>{t("dashboard.infoPerPerson")}</b> — {t("dashboard.infoPerPersonSub")}</span></div>
    </div>
  {:else}
    <!-- Info strip skeleton: dot + one text line per item, same padding. -->
    <div class="info-strip" aria-hidden="true">
      {#each Array(4) as _}
        <div class="info-item">
          <Skeleton circle size={9} />
          <Skeleton width="180px" height="1.15rem" />
        </div>
      {/each}
    </div>
  {/if}

  {#if !loading}
    <section class="backup-panel" in:fade={motionFade(MOTION.slow, 220)}>
      <div class="backup-copy">
        <h2>{t("backup.title")}</h2>
        <p>{t("backup.text")}</p>
        <small>{t("backup.importHint")}</small>
      </div>
      <div class="backup-actions">
        <button class="backup-btn" onclick={() => downloadBackup(buildBackupJson(budgets), "json", "application/json")} disabled={budgets.length === 0}>{t("backup.exportJson")}</button>
        <button class="backup-btn" onclick={() => downloadBackup(toBudgetsCsv(budgets), "csv", "text/csv;charset=utf-8")} disabled={budgets.length === 0}>{t("backup.exportCsv")}</button>
        <button class="backup-btn" onclick={exportPdf} disabled={budgets.length === 0 || exportingPdf}>{exportingPdf ? "…" : t("backup.exportPdf")}</button>
        <button class="backup-btn primary" onclick={() => importInput?.click()}>{t("backup.import")}</button>
        <input
          bind:this={importInput}
          class="sr-only"
          type="file"
          accept="application/json,.json"
          aria-label={t("backup.import")}
          onchange={restoreBackup}
        />
      </div>
    </section>
  {/if}
</div>

{#if !loading}
  <!-- One always-reachable entry point for daily spending on the dashboard. -->
  <button
    class="quick-add-fab"
    type="button"
    aria-label={t("dashboard.quickAdd")}
    title={t("dashboard.quickAdd")}
    onclick={() => (quickAddOpen = true)}
  >
    <svg class="quick-add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </button>
{/if}

{#if quickAddOpen}
  <QuickAddDailyExpense
    month={monthLabel(currentMonthId, locale)}
    onClose={() => (quickAddOpen = false)}
    onSave={quickAddExpense}
  />
{/if}

<style>
  .page { display: flex; flex-direction: column; gap: 2rem; }
  /* The FAB floats over the page; phones need room so it never covers the
     info strip at the very bottom. */
  @media (max-width: 768px) {
    .page { padding-bottom: 5rem; }
  }

  .quick-add-fab {
    position: fixed;
    right: max(1.25rem, env(safe-area-inset-right));
    bottom: calc(1.5rem + env(safe-area-inset-bottom));
    z-index: var(--z-overlay);
    /* Phones only, like the month page's jump-to-section button. */
    display: none; place-items: center;
    width: 3.4rem; height: 3.4rem;
    border-radius: 50%; color: #fff;
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-rose));
    box-shadow: 0 10px 26px rgba(200, 149, 108, 0.42), 0 4px 10px rgba(26, 23, 20, 0.18);
    transition: transform var(--dur-base) var(--ease-spring), box-shadow var(--dur-base) var(--ease-out);
  }
  .quick-add-fab:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 14px 32px rgba(200, 149, 108, 0.5), 0 6px 14px rgba(26, 23, 20, 0.2);
  }
  .quick-add-fab:active { transform: scale(0.96); }
  .quick-add-fab:focus-visible { outline: 2px solid var(--accent-gold); outline-offset: 3px; }
  .quick-add-icon { width: 1.4rem; height: 1.4rem; transition: transform var(--dur-base) var(--ease-spring); }
  .quick-add-fab:hover .quick-add-icon { transform: rotate(90deg); }
  /* Must follow the base rule so the equal-specificity override wins on phones. */
  @media (max-width: 768px) {
    .quick-add-fab { display: grid; }
  }

  .hero { padding: 3rem 0 1rem; border-bottom: 1px solid var(--surface-border); }
  .hero-eyebrow { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent-gold); margin-bottom: 1rem; }
  .hero-title { font-size: clamp(2.25rem, 5vw, 3.5rem); line-height: 1.05; letter-spacing: -0.03em; margin-bottom: 1rem; }
  .hero-sub { font-size: 1.05rem; color: var(--text-secondary); max-width: 520px; line-height: 1.7; }

  /* Skeleton and real card share one grid cell so the crossfade cannot push
     the rest of the page down while both are briefly mounted. */
  .overview-slot { display: grid; }
  .overview-slot > * { grid-area: 1 / 1; }

  .overview {
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm);
  }
  .overview-head { display: flex; align-items: center; gap: 0.6rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--surface-border); }
  .overview-head-title { font-size: 0.9rem; font-weight: 800; color: var(--text-primary); }
  .overview-head-sub { font-size: 0.78rem; color: var(--text-tertiary); }
  .overview-toggle {
    margin-left: auto; display: inline-flex; align-items: center; justify-content: center;
    width: 1.9rem; height: 1.9rem; flex-shrink: 0; padding: 0;
    border: 1px solid var(--surface-border); border-radius: 50%; background: transparent;
    color: var(--text-secondary); cursor: pointer;
    transition: background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out);
  }
  .overview-toggle:hover { background: var(--bg-muted); color: var(--text-primary); }
  .overview-toggle:focus-visible { outline: 2px solid var(--accent-teal); outline-offset: 2px; }
  /* Chevron points down when open and right when folded. */
  .overview-chevron { width: 1.05rem; height: 1.05rem; transition: transform 0.28s var(--ease-out); }
  .overview-chevron:not(.open) { transform: rotate(-90deg); }
  /* Collapse the row height instead of animating `height` itself; the clip
     child keeps the overflow hidden so it shrinks in one smooth motion. */
  .overview-body { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 0.34s var(--ease-out), opacity 0.34s var(--ease-out); }
  .overview-body.collapsed { grid-template-rows: 0fr; opacity: 0; }
  .overview-body-clip {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding-top: 1rem;
    overflow: hidden; transition: padding-top 0.34s var(--ease-out);
  }
  .overview-body.collapsed .overview-body-clip { padding-top: 0; }
  .overview-item { display: flex; flex-direction: column; gap: 0.25rem; }
  .overview-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); }
  .overview-sub { font-size: 0.7rem; color: var(--text-tertiary); }
  /* The split transfer amount is the key number of that caption, so it gets
     weight and the body text colour while the rest stays muted. */
  .overview-sub .split-amount {
    font-size: 0.8rem; font-weight: 800; letter-spacing: -0.01em;
    color: var(--text-primary); white-space: nowrap;
  }
  /* Values render through the CountUp child component, so their styling must
     escape scoping; the `.overview-item` prefix keeps it local enough. */
  .overview-item :global(.overview-value) { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em; }
  .overview-item :global(.overview-value.income) { color: var(--success); }
  .overview-item :global(.overview-value.expense) { color: var(--accent-gold); }
  .overview-item :global(.overview-value.teal) { color: var(--accent-teal); }
  .overview-item :global(.overview-value.rose) { color: var(--accent-rose); }
  .overview-item :global(.overview-value.blue) { color: var(--accent-blue); }
  .overview-item :global(.overview-value.violet) { color: var(--accent-violet); }
  .overview-item :global(.overview-value.indigo) { color: var(--accent-indigo); }
  .overview-item :global(.overview-value.olive) { color: var(--accent-olive); }

  .section-label { display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); }
  .section-label::after { content: ""; flex: 1; height: 1px; background: var(--surface-border); transform-origin: left; transform: scaleX(1); animation: underlineGrow var(--dur-slower) var(--ease-out) backwards; animation-delay: 0.2s; }

  .search-row { display: flex; justify-content: flex-start; }
  .search-row :global(.search-bar) { max-width: 420px; }
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
    display: flex; flex-direction: column;
    transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out);
  }
  .month-card::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--surface-border); transition: height var(--dur-base) var(--ease-out); }
  .month-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
  .month-card:active { transform: translateY(-1px) scale(0.995); }
  .month-card:hover::before { height: 4px; }

  /* Soft diagonal sheen that sweeps across the card on hover. */
  .month-card::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.22) 50%, transparent 70%);
    transform: translateX(-120%); transition: transform var(--dur-slower) var(--ease-out);
  }
  .month-card.exists:hover::after { transform: translateX(120%); }
  :root[data-theme="dark"] .month-card.exists:hover::after {
    background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.06) 50%, transparent 70%);
  }

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
  .card-badge.match { background: var(--accent-gold-light); color: var(--accent-gold); }

  .card-matches { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
  .card-match { display: flex; flex-direction: column; gap: 0.1rem; background: var(--bg-muted); border-radius: var(--radius-sm); padding: 0.4rem 0.6rem; }
  .card-match-section { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); }
  .card-match-name { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); overflow-wrap: anywhere; }
  /* Highlight for matched text inside item names. */
  .card-matches :global(mark) {
    background: var(--accent-gold);
    color: #fff;
    padding: 0 0.15rem;
    border-radius: 2px;
    font-weight: 600;
  }

  .card-person { display: flex; align-items: baseline; justify-content: space-between; background: linear-gradient(135deg, var(--accent-teal-light), var(--surface)); border-radius: var(--radius-md); padding: 0.45rem 0.7rem; }
  .card-person-label { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); }
  .card-person-value { font-size: 0.9rem; font-weight: 800; color: var(--accent-teal); }

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
  .month-card.current::before { background: linear-gradient(90deg, var(--accent-teal), var(--accent-gold)); background-size: 200% 100%; animation: gradientPan 6s var(--ease-in-out) infinite; }
  .month-card.past::before { background: var(--bg-muted); }

  .empty-state { text-align: center; padding: 4rem 2rem; background: var(--surface); border: 1px dashed var(--surface-border); border-radius: var(--radius-xl); }
  .empty-icon { font-size: 2.25rem; display: block; margin-bottom: 1rem; color: var(--text-tertiary); animation: popIn var(--dur-slow) var(--ease-spring) backwards, floaty 4s var(--ease-in-out) 0.45s infinite; }
  .empty-state h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; }
  .empty-state p { font-size: 0.85rem; color: var(--text-tertiary); }

  .info-strip { display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; padding: 1.25rem 1.5rem; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
  .info-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.4; transition: transform var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out); }
  .info-item:hover { transform: translateX(3px); color: var(--text-primary); }
  .info-item b { color: var(--text-primary); font-weight: 700; }
  .info-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; transition: transform var(--dur-base) var(--ease-spring); }
  .info-item:hover .info-dot { transform: scale(1.4); }
  .info-dot.blue { background: var(--accent-blue); }
  .info-dot.rose { background: var(--accent-rose); }
  .info-dot.teal { background: var(--accent-teal); }
  .info-dot.gold { background: var(--accent-gold); }

  .backup-panel { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem 1.5rem; padding: 1.1rem 1.5rem; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
  .backup-copy h2 { font-size: 0.9rem; font-weight: 800; margin-bottom: 0.2rem; }
  .backup-copy p, .backup-copy small { display: block; font-size: 0.78rem; color: var(--text-tertiary); }
  .backup-copy small { margin-top: 0.15rem; font-size: 0.72rem; }
  .backup-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .backup-btn { padding: 0.55rem 0.9rem; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--bg-muted); color: var(--text-primary); font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: transform var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out); }
  .backup-btn:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--accent-teal); }
  .backup-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .backup-btn.primary { background: var(--accent-teal); border-color: var(--accent-teal); color: #fff; }

  @media (max-width: 1000px) {
    .overview-body-clip { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 640px) {
    .overview-body-clip { grid-template-columns: 1fr; }
    .months-grid { grid-template-columns: 1fr; }
    .hero { padding: 2rem 0 1rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .overview-body, .overview-body-clip, .overview-chevron { transition: none; }
  }
</style>
