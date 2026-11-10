<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { fade, fly, slide } from "svelte/transition";
  import ExpenseSection from "#lib/components/ExpenseSection.svelte";
  import { subscribeBudget, saveBudget, fetchAllBudgets } from "#lib/budget-store";
  import {
    computeTotals,
    createEmptyBudget,
    formatCurrency,
    type MonthBudget,
    type ExpenseItem
  } from "#lib/types";
  import { isAuthenticated } from "#lib/auth";
  import { t, lang } from "#lib/i18n.svelte";
  import SearchBar from "#lib/components/SearchBar.svelte";
import Seo from "#lib/components/Seo.svelte";
  import Skeleton from "#lib/components/Skeleton.svelte";

  const monthId = $derived(page.params.id ?? "");

  /**
   * Current budget period id (`YYYY-MM`). The period runs from the 25th of the
   * previous month through the 24th of the period month, so on the 25th or
   * later we are already in the current month's period.
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

  /** Month pages outside the active period require confirmation before edits. */
  const isActiveMonth = $derived(monthId === currentPeriodId());

  /** All stored month ids, sorted chronologically (oldest first). */
  let allMonthIds = $state<string[]>([]);

  const currentIndex = $derived(allMonthIds.indexOf(monthId));
  const prevMonthId = $derived(currentIndex > 0 ? allMonthIds[currentIndex - 1] : null);
  const nextMonthId = $derived(currentIndex >= 0 && currentIndex < allMonthIds.length - 1 ? allMonthIds[currentIndex + 1] : null);
  /** Right arrow goes to the previous month; stop at the earliest month in DB. */
  const canGoPrevious = $derived(prevMonthId != null);
  /** Left arrow goes to the next month; stop when on the active month. */
  const canGoNext = $derived(nextMonthId != null && !isActiveMonth);

  let budget = $state<MonthBudget>(createEmptyBudget("2026-01"));
  let loading = $state(true);
  let saving = $state(false);
  let savedAt = $state<string>("");
  let showHeaderEditor = $state(false);
  let showSectionNav = $state(false);
  let searchQuery = $state("");

  /** Filter items per section based on the current search query. */
  function matchesSearch(item: ExpenseItem, query: string): boolean {
    if (!query.trim()) return true;
    const lowered = query.toLowerCase();
    const nameMatch = item.name.toLowerCase().includes(lowered);
    const methodMatch = (item.method ?? "").toLowerCase().includes(lowered);
    return nameMatch || methodMatch;
  }

  // Section keys mapped 1:1 to sections 1–8 (index 0 = section 1, … index 7 = section 8).
  const SECTION_KEYS = [
    "husbandIncome",
    "wifeIncome",
    "husbandFixed",
    "wifeFixed",
    "husbandDailyFromSalary",
    "husbandDailyFromSavings",
    "wifeDailyFromSalary",
    "wifeDailyFromSavings"
  ] as const;

  // Derived visible items per section after search filtering.
  const visibleItemsPerSection = $derived(
    SECTION_KEYS.map((sectionKey, index) => {
      let items: ExpenseItem[] = [];
      if (sectionKey === "husbandIncome") {
        items = [{ id: "husband-income", name: t("month.husbandIncome"), amount: budget.husbandIncome, method: undefined }];
      } else if (sectionKey === "wifeIncome") {
        items = [{ id: "wife-income", name: t("month.wifeIncome"), amount: budget.wifeIncome, method: undefined }];
      } else {
        // Use a type assertion since `sectionKey` is a union narrowed by the if/else above.
        items = (budget[sectionKey as keyof MonthBudget] ?? []) as ExpenseItem[];
      }
      return {
        index, // 0 = section 1, 1 = section 2, …, 7 = section 8
        key: sectionKey,
        title: t(`month.section${index + 1}`),
        items: items.filter((item) => matchesSearch(item, searchQuery)),
      };
    })
  );

  // Which sections have a match, and the first one for auto-focus.
  const searchActive = $derived(searchQuery.trim().length > 0);
  const matchedSections = $derived(
    visibleItemsPerSection.map((section) => section.items.length > 0)
  );
  const firstMatchedIndex = $derived(matchedSections.indexOf(true));

  // Auto-scroll to the first section that has a search result.
  $effect(() => {
    if (searchActive && firstMatchedIndex !== -1) {
      const target = document.getElementById(`section-${firstMatchedIndex + 1}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.focus({ preventScroll: true });
      }
    }
  });

  // Section titles for the mobile quick-jump menu, in page order.
  const SECTION_NAV_KEYS = [
    "month.section1",
    "month.section2",
    "month.section3",
    "month.section4",
    "month.section5",
    "month.section6",
    "month.section7",
    "month.section8"
  ] as const;

  /** Close the menu and smooth-scroll to the requested section. */
  function goToSection(index: number) {
    showSectionNav = false;
    const target = document.getElementById(`section-${index}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
  }

  let headerDraft = $state({ title: "", period: "" });

  // On narrow screens the bar value labels have little room, so they switch to
  // a compact currency form (e.g. "Rp 9,6 jt") to avoid overlapping each other.
  let isNarrow = $state(false);
  $effect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => (isNarrow = mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  });

  /** Locale-aware compact rupiah, e.g. "Rp 9,6 jt" (id) / "Rp 9.6M" (en). */
  function formatCompactIDR(value: number): string {
    if (!value) return "Rp 0";
    const compact = new Intl.NumberFormat(lang.value, {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(value);
    return `Rp ${compact}`;
  }

  const totals = $derived(computeTotals(budget));

  // ── Wife → Husband pending transfer ─────────────────────────────────────
  // A period starts on the 25th of the previous month, but the wife is not paid
  // until the 1st. So when the equal-split transfer flows Wife → Husband, the
  // husband must hold back that amount from his daily-from-salary plan until it
  // actually lands. The section 5 toggle records when it has arrived.
  //
  // The reverse direction (Husband → Wife) needs neither the toggle nor any
  // hold-back: `equalSplitAmount` already reflects the transfer the husband
  // sends, so his max planned budget must not be reduced any further.
  const pendingWifeToHusbandTransfer = $derived(
    totals.equalSplitTransfer < 0 ? -totals.equalSplitTransfer : 0
  );
  const showTransferReceived = $derived(pendingWifeToHusbandTransfer > 0);
  const husbandPlanReduction = $derived(
    showTransferReceived && !budget.transferReceived ? pendingWifeToHusbandTransfer : 0
  );
  const husbandSalaryPlan = $derived(totals.equalSplitAmount - husbandPlanReduction);
  const husbandSalaryRemaining = $derived(husbandSalaryPlan - totals.husbandDailyFromSalaryTotal);

  // Combined daily totals (husband + wife).
  const dailyFromSalaryTotal = $derived(
    totals.husbandDailyFromSalaryTotal + totals.wifeDailyFromSalaryTotal
  );
  const dailyFromSavingsTotal = $derived(
    totals.husbandDailyFromSavingsTotal + totals.wifeDailyFromSavingsTotal
  );

  // Total expenses = fixed + daily from salary + daily from savings.
  const totalExpense = $derived(
    totals.totalFixedExpenses + dailyFromSalaryTotal + dailyFromSavingsTotal
  );
  const husbandTotalExpense = $derived(
    totals.husbandFixedTotal + totals.husbandDailyFromSalaryTotal + totals.husbandDailyFromSavingsTotal
  );
  const wifeTotalExpense = $derived(
    totals.wifeFixedTotal + totals.wifeDailyFromSalaryTotal + totals.wifeDailyFromSavingsTotal
  );

  // ── Chart 1: income by source (vertical bars) ───────────────────────────
  const husbandIncomeValue = $derived(Math.max(budget.husbandIncome, 0));
  const wifeIncomeValue = $derived(Math.max(budget.wifeIncome, 0));
  const incomeBars = $derived([
    {
      key: "combined",
      label: t("month.chartCombined"),
      husband: husbandIncomeValue,
      wife: wifeIncomeValue,
      total: husbandIncomeValue + wifeIncomeValue,
      combined: true
    },
    { key: "husband", label: t("common.husband"), husband: husbandIncomeValue, wife: 0, total: husbandIncomeValue, combined: false },
    { key: "wife", label: t("common.wife"), husband: 0, wife: wifeIncomeValue, total: wifeIncomeValue, combined: false }
  ]);
  const incomeMax = $derived(Math.max(totals.totalIncome, 1));

  // ── Chart 2: expenses by source (vertical stacked bars) ─────────────────
  // Each bar is a spending category, stacked husband (blue) + wife (rose).
  const expenseBars = $derived([
    {
      key: "allTotal",
      label: t("month.chartFixedSalarySavingsShort"),
      husband:
        Math.max(totals.husbandFixedTotal, 0) +
        Math.max(totals.husbandDailyFromSalaryTotal, 0) +
        Math.max(totals.husbandDailyFromSavingsTotal, 0),
      wife:
        Math.max(totals.wifeFixedTotal, 0) +
        Math.max(totals.wifeDailyFromSalaryTotal, 0) +
        Math.max(totals.wifeDailyFromSavingsTotal, 0)
    },
    {
      key: "fixedSalary",
      label: t("month.chartFixedSalaryShort"),
      husband: Math.max(totals.husbandFixedTotal, 0) + Math.max(totals.husbandDailyFromSalaryTotal, 0),
      wife: Math.max(totals.wifeFixedTotal, 0) + Math.max(totals.wifeDailyFromSalaryTotal, 0)
    },
    {
      key: "fixed",
      label: t("month.chartFixedShort"),
      husband: Math.max(totals.husbandFixedTotal, 0),
      wife: Math.max(totals.wifeFixedTotal, 0)
    },
    {
      key: "salary",
      label: t("month.chartSalaryShort"),
      husband: Math.max(totals.husbandDailyFromSalaryTotal, 0),
      wife: Math.max(totals.wifeDailyFromSalaryTotal, 0)
    },
    {
      key: "savings",
      label: t("month.chartSavingsShort"),
      husband: Math.max(totals.husbandDailyFromSavingsTotal, 0),
      wife: Math.max(totals.wifeDailyFromSavingsTotal, 0)
    }
  ].map((b) => ({ ...b, total: b.husband + b.wife })));
  const expenseMax = $derived(
    Math.max(...expenseBars.map((b) => b.total), 1)
  );

  $effect(() => {
    if (!isAuthenticated()) {
      location.href = "/login";
      return;
    }
    if (!monthId) return;

    // Know which months exist in DB so navigation can stop at the edges.
    fetchAllBudgets().then((bs) => {
      allMonthIds = bs.map((b) => b.id).sort();
    });

    // Start from a correctly-titled empty budget until the live data arrives.
    if (budget.id !== monthId) {
      budget = createEmptyBudget(monthId);
      loading = true;
    }

    // Live-sync: when the other spouse (or this device) edits this budget in
    // Firestore, update locally immediately — no reload needed. Re-subscribes
    // whenever the opened month changes so navigation actually loads new data.
    const unsubscribe = subscribeBudget(monthId, (next) => {
      budget = next;
      // Don't clobber an in-progress header edit.
      if (!showHeaderEditor) {
        headerDraft = { title: next.title, period: next.period };
      }
      loading = false;
    });

    return () => {
      unsubscribe();
    };
  });

  async function persist(next: MonthBudget) {
    budget = next;
    saving = true;
    try {
      await saveBudget(next);
      savedAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      saving = false;
    }
  }

  function update<K extends keyof MonthBudget>(key: K, value: MonthBudget[K]) {
    persist({ ...budget, [key]: value });
  }

  /** Record whether the wife-to-husband equal-split transfer has arrived. */
  function setTransferReceived(received: boolean) {
    // Only meaningful for Wife → Husband; ignore any stale call when the
    // transfer direction is Husband → Wife.
    if (!showTransferReceived) return;
    persist({ ...budget, transferReceived: received });
  }

  // ── Drag & drop between paired sections ─────────────────────────────────
  // Map a section key -> the budget field it edits.
  const SECTION_FIELDS: Record<string, keyof MonthBudget> = {
    hf: "husbandFixed",
    wf: "wifeFixed",
    hs: "husbandDailyFromSalary",
    hsv: "husbandDailyFromSavings",
    ws: "wifeDailyFromSalary",
    wsv: "wifeDailyFromSavings"
  };

  /**
   * Move an item dropped into `toField` from its original section.
   * Only valid when the item truly exists in the source section.
   */
  function moveItem(item: ExpenseItem, fromKey: string, toField: keyof MonthBudget) {
    const fromField = SECTION_FIELDS[fromKey];
    if (!fromField || fromField === toField) return;

    const src = (budget[fromField] as ExpenseItem[]) ?? [];
    const dst = (budget[toField] as ExpenseItem[]) ?? [];
    if (!src.some((i) => i.id === item.id)) return;

    const nextSrc = src.filter((i) => i.id !== item.id);
    const nextDst = [...dst, item];

    const next = {
      ...budget,
      [fromField]: nextSrc,
      [toField]: nextDst
    } as MonthBudget;
    persist(next);
  }

  function openHeaderEditor() {
    headerDraft = { title: budget.title, period: budget.period };
    showHeaderEditor = true;
  }

  function saveHeader() {
    persist({
      ...budget,
      title: headerDraft.title.trim() || budget.title,
      period: headerDraft.period.trim() || budget.period
    });
    showHeaderEditor = false;
  }
</script>

<Seo
  title={t("month.pageTitle", { title: budget.title })}
  description={t("seo.monthDescription")}
  path={`/month/${monthId}`}
/>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape") showSectionNav = false;
  }}
  onresize={() => {
    if (window.innerWidth > 768) showSectionNav = false;
  }}
/>

<div class="page">
  <div class="page-header" in:fade={{ duration: 350 }}>
    <div class="header-top">
      <a href="/" class="back-btn" aria-label={t("month.allMonths")}>← <span class="back-text">{t("month.allMonths")}</span></a>
      <div class="header-side">
        <SearchBar
          query={searchQuery}
          onQueryChange={(q: string) => (searchQuery = q)}
          onClear={() => (searchQuery = "")}
        />
        <span class="save-state" class:saving>
          {#if loading}{t("common.loading")}{:else if saving}{t("month.saving")}{:else if savedAt}{t("month.saved", { time: savedAt })}{/if}
        </span>
      </div>
    </div>
    <div class="header-meta">
      {#if loading}
        <Skeleton width="220px" height="1.7rem" />
        <Skeleton width="160px" height="0.85rem" />
      {:else}
        <h1 class="page-title">{budget.title}</h1>
        <p class="page-subtitle">{budget.period}</p>
        <button class="edit-btn" onclick={openHeaderEditor}>
          <svg viewBox="0 0 24 24" class="edit-btn-svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
          {t("month.editHeader")}
        </button>
      {/if}
    </div>
  </div>

  {#if loading}
    <!-- Summary skeleton -->
    <div class="summary-row" aria-hidden="true">
      {#each Array(4) as _}
        <div class="stat-card">
          <Skeleton width="65%" height="0.72rem" />
          <Skeleton width="85%" height="1.5rem" />
          <Skeleton width="75%" height="0.78rem" />
        </div>
      {/each}
    </div>

    <!-- Chart skeleton -->
    <div class="chart-section" aria-hidden="true">
      <Skeleton width="200px" height="0.9rem" />
      <div class="charts-grid" style="margin-top:1.1rem">
        {#each Array(2) as _}
          <div class="bar-chart">
            <Skeleton width="55%" height="0.82rem" />
            <div class="bar-chart-plot" style="margin-top:0.85rem">
              {#each Array(2) as _}
                <div class="bar-col">
                  <div class="bar-col-track">
                    <Skeleton width="62px" height="140px" radius="8px 8px 0 0" />
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Sections skeleton -->
    <div class="sections" aria-hidden="true">
      {#each Array(8) as _}
        <div class="section-skeleton">
          <div class="section-skeleton-head">
            <Skeleton circle size={28} />
            <Skeleton width="60%" height="0.88rem" />
            <Skeleton width="80px" height="0.9rem" />
          </div>
          {#each Array(3) as _}
            <div class="section-skeleton-row">
              <Skeleton width="55%" height="0.86rem" />
              <Skeleton width="70px" height="0.86rem" />
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {:else}
  {#if showHeaderEditor}
    <div class="income-panel" in:slide={{ duration: 220 }}>
      <div class="income-fields">
        <label class="field">
          <span>{t("month.fieldTitle")}</span>
          <input type="text" bind:value={headerDraft.title} />
        </label>
        <label class="field">
          <span>{t("month.fieldPeriod")}</span>
          <input type="text" bind:value={headerDraft.period} />
        </label>
      </div>
      <div class="income-actions">
        <button class="btn-save" onclick={saveHeader}>{t("common.saveChanges")}</button>
        <button class="btn-cancel" onclick={() => (showHeaderEditor = false)}>{t("common.cancel")}</button>
      </div>
    </div>
  {/if}

  <div class="summary-row" in:fly={{ y: 14, duration: 420, delay: 60 }}>
    <div class="stat-card income">
      <span class="stat-label">{t("month.totalIncome")}</span>
      <span class="stat-value">{formatCurrency(totals.totalIncome)}</span>
      <span class="stat-sub">
        {t("common.husband")} {formatCurrency(budget.husbandIncome)} · {t("common.wife")} {formatCurrency(budget.wifeIncome)}
      </span>
    </div>
    <div class="stat-card expense">
      <span class="stat-label">{t("month.totalExpense")}</span>
      <span class="stat-value">{formatCurrency(totalExpense)}</span>
      <span class="stat-sub">
        {t("common.husband")} {formatCurrency(husbandTotalExpense)} · {t("common.wife")} {formatCurrency(wifeTotalExpense)}
      </span>
    </div>
    <div class="stat-card savings">
      <span class="stat-label">{t("month.totalDailyFromSavings")}</span>
      <span class="stat-value">{formatCurrency(dailyFromSavingsTotal)}</span>
      <span class="stat-sub">
        {t("common.husband")} {formatCurrency(totals.husbandDailyFromSavingsTotal)} · {t("common.wife")} {formatCurrency(totals.wifeDailyFromSavingsTotal)}
      </span>
    </div>
    <div class="stat-card split" class:negative={totals.equalSplitTransfer < 0}>
      <span class="stat-label">{t("month.equalSplitTransfer")}</span>
      <span class="stat-value">{formatCurrency(Math.abs(totals.equalSplitTransfer))}</span>
      <span class="stat-sub">
        {#if totals.equalSplitTransfer >= 0}{t("common.husband")} → {t("common.wife")}{:else}{t("common.wife")} → {t("common.husband")}{/if}
        · {t("month.eachHolds", { amount: formatCurrency(totals.equalSplitAmount) })}
      </span>
    </div>
  </div>

  <div class="chart-section" in:fly={{ y: 12, duration: 420, delay: 100 }}>
    <div class="chart-header">
      <span class="chart-title">{t("month.chartTitle")}</span>
    </div>

    <div class="charts-grid">
      <!-- Chart 1: Income by source -->
      <div class="bar-chart">
        <div class="bar-chart-head">
          <span class="bar-chart-title">{t("month.chartIncomeTitle")}</span>
          <span class="bar-chart-total">{formatCurrency(totals.totalIncome)}</span>
        </div>
        <div class="bar-chart-plot" role="img" aria-label={t("month.chartIncomeAria")}>
          {#each incomeBars as bar}
            <div class="bar-col" class:combined={bar.combined}>
              <div class="bar-col-track">
                <div class="bar-stack" style:height={`${(bar.total / incomeMax) * 100}%`}>
                  <span class="bar-value">{isNarrow ? formatCompactIDR(bar.total) : formatCurrency(bar.total)}</span>
                  <div class="bar-seg blue" style:height={`${bar.total ? (bar.husband / bar.total) * 100 : 0}%`}></div>
                  <div class="bar-seg rose" style:height={`${bar.total ? (bar.wife / bar.total) * 100 : 0}%`}></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
        <div class="bar-chart-labels">
          {#each incomeBars as bar}
            <span class="bar-label" class:combined={bar.combined}>{bar.label}</span>
          {/each}
        </div>
        <div class="bar-legend">
          <span class="legend-chip"><span class="legend-dot blue"></span>{t("common.husband")}</span>
          <span class="legend-chip"><span class="legend-dot rose"></span>{t("common.wife")}</span>
        </div>
      </div>

      <!-- Chart 2: Expenses by source -->
      <div class="bar-chart">
        <div class="bar-chart-head">
          <span class="bar-chart-title">{t("month.chartExpenseTitle")}</span>
          <span class="bar-chart-total">{formatCurrency(totalExpense)}</span>
        </div>
        <div class="bar-chart-plot" role="img" aria-label={t("month.chartExpenseAria")}>
          {#each expenseBars as bar}
            <div class="bar-col">
              <div class="bar-col-track">
                <div class="bar-stack" style:height={`${(bar.total / expenseMax) * 100}%`}>
                  <span class="bar-value">{isNarrow ? formatCompactIDR(bar.total) : formatCurrency(bar.total)}</span>
                  <div class="bar-seg blue" style:height={`${bar.total ? (bar.husband / bar.total) * 100 : 0}%`}></div>
                  <div class="bar-seg rose" style:height={`${bar.total ? (bar.wife / bar.total) * 100 : 0}%`}></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
        <div class="bar-chart-labels">
          {#each expenseBars as bar}
            <span class="bar-label" class:combined={bar.key === "allTotal" || bar.key === "fixedSalary"}>{bar.label}</span>
          {/each}
        </div>
        <div class="bar-legend">
          <span class="legend-chip"><span class="legend-dot blue"></span>{t("common.husband")}</span>
          <span class="legend-chip"><span class="legend-dot rose"></span>{t("common.wife")}</span>
        </div>
      </div>
    </div>

    <div class="chart-note">
      <span class="chart-note-icon">💡</span>
      <div class="chart-note-body">
        <p>
          {t("month.chartConclusionIncome", {
            income: formatCurrency(totals.totalIncome),
            husband: formatCurrency(budget.husbandIncome),
            wife: formatCurrency(budget.wifeIncome)
          })}
        </p>
        <p>
          {t("month.chartConclusionSplit", {
            fixed: formatCurrency(totals.totalFixedExpenses),
            salary: formatCurrency(dailyFromSalaryTotal),
            remaining: formatCurrency(Math.max(totals.balanceAfterFixed - dailyFromSalaryTotal, 0))
          })}
        </p>
        <p>
          {t("month.chartConclusionSavings", {
            total: formatCurrency(totalExpense),
            savings: formatCurrency(dailyFromSavingsTotal)
          })}
        </p>
      </div>
    </div>
  </div>

  <div class="sections" in:fade={{ duration: 350, delay: 120 }}>
    {#if !searchActive || matchedSections[0]}
    <ExpenseSection
      sectionId="section-1"
      confirmChanges={!isActiveMonth}
      title={t("month.section1")}
      sectionIndex={0}
      highlightedQuery={searchQuery}
      badge="♂"
      icon="income"
      tone="blue"
      nameLabel={t("month.sourceLabel")}
      items={visibleItemsPerSection[0]?.items ?? [{ id: "husband-income", name: t("month.husbandIncome"), amount: budget.husbandIncome }]}
      onChange={(items: ExpenseItem[]) => update("husbandIncome", items[0]?.amount ?? 0)}
    />
    {/if}

    {#if !searchActive || matchedSections[1]}
    <ExpenseSection
      sectionId="section-2"
      confirmChanges={!isActiveMonth}
      title={t("month.section2")}
      sectionIndex={1}
      highlightedQuery={searchQuery}
      badge="♀"
      icon="income"
      tone="rose"
      nameLabel={t("month.sourceLabel")}
      items={visibleItemsPerSection[1]?.items ?? [{ id: "wife-income", name: t("month.wifeIncome"), amount: budget.wifeIncome }]}
      onChange={(items: ExpenseItem[]) => update("wifeIncome", items[0]?.amount ?? 0)}
    />
    {/if}

    {#if !searchActive || matchedSections[2]}
    <ExpenseSection
      sectionId="section-3"
      confirmChanges={!isActiveMonth}
      title={t("month.section3")}
      sectionIndex={2}
      highlightedQuery={searchQuery}
      badge="♂"
      icon="fixed"
      tone="blue"
      checkboxable
      collapsible
      items={visibleItemsPerSection[2]?.items ?? budget.husbandFixed}
      onChange={(items: ExpenseItem[]) => update("husbandFixed", items)}
      footerLabel={t("month.husbandFixedRemaining")}
      sectionKey="hf"
      dragGroup="fixed"
      onExternalDrop={(item, fromKey) => moveItem(item, fromKey, "husbandFixed")}
    />
    {/if}
    {#if !searchActive || matchedSections[3]}
    <ExpenseSection
      sectionId="section-4"
      confirmChanges={!isActiveMonth}
      title={t("month.section4")}
      sectionIndex={3}
      highlightedQuery={searchQuery}
      badge="♀"
      icon="fixed"
      tone="rose"
      checkboxable
      collapsible
      items={visibleItemsPerSection[3]?.items ?? budget.wifeFixed}
      onChange={(items: ExpenseItem[]) => update("wifeFixed", items)}
      footerLabel={t("month.wifeFixedRemaining")}
      sectionKey="wf"
      dragGroup="fixed"
      onExternalDrop={(item, fromKey) => moveItem(item, fromKey, "wifeFixed")}
    />
    {/if}

    {#if !searchActive || matchedSections[4]}
    <ExpenseSection
      sectionId="section-5"
      confirmChanges={!isActiveMonth}
      title={t("month.section5")}
      badge="○"
      icon="wallet"
      tone="blue"
      collapsible
      items={visibleItemsPerSection[4]?.items ?? budget.husbandDailyFromSalary}
      highlightedQuery={searchQuery}
      withMethod
      onChange={(items: ExpenseItem[]) =>
        update(
          "husbandDailyFromSalary",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "" }))
        )}
      footerLabel={t("month.subtotalSalary")}
      footerValue={totals.husbandDailyFromSalaryTotal}
      footerPlan={{
        label: t("month.maxPlanned"),
        value: husbandSalaryPlan,
        toggle:
          showTransferReceived
            ? {
                checked: budget.transferReceived ?? false,
                label: t("month.transferReceived"),
                hint: budget.transferReceived
                  ? undefined
                  : t("month.waitingTransfer", { amount: formatCurrency(pendingWifeToHusbandTransfer) }),
                onChange: setTransferReceived
              }
            : undefined
      }}
      footerNote={{
        label: t("month.remainingMoney"),
        value: husbandSalaryRemaining
      }}
      sectionKey="hs"
      dragGroup="husband"
      onExternalDrop={(item, fromKey) => moveItem(item, fromKey, "husbandDailyFromSalary")}
    />
    {/if}

    {#if !searchActive || matchedSections[5]}
    <ExpenseSection
      sectionId="section-6"
      confirmChanges={!isActiveMonth}
      title={t("month.section6")}
      badge="↓"
      icon="savings"
      tone="blue"
      collapsible
      items={visibleItemsPerSection[5]?.items ?? budget.husbandDailyFromSavings}
      highlightedQuery={searchQuery}
      withMethod
      onChange={(items: ExpenseItem[]) =>
        update(
          "husbandDailyFromSavings",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "" }))
        )}
      footerLabel={t("month.subtotalSavings")}
      footerValue={totals.husbandDailyFromSavingsTotal}
      sectionKey="hsv"
      dragGroup="husband"
      onExternalDrop={(item, fromKey) => moveItem(item, fromKey, "husbandDailyFromSavings")}
    />
    {/if}

    {#if !searchActive || matchedSections[6]}
    <ExpenseSection
      sectionId="section-7"
      confirmChanges={!isActiveMonth}
      title={t("month.section7")}
      badge="○"
      icon="wallet"
      tone="rose"
      collapsible
      items={visibleItemsPerSection[6]?.items ?? budget.wifeDailyFromSalary}
      highlightedQuery={searchQuery}
      withMethod
      onChange={(items: ExpenseItem[]) =>
        update(
          "wifeDailyFromSalary",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "" }))
        )}
      footerLabel={t("month.subtotalSalary")}
      footerValue={totals.wifeDailyFromSalaryTotal}
      footerPlan={{
        label: t("month.maxPlanned"),
        value: totals.equalSplitAmount
      }}
      footerNote={{
        label: t("month.remainingMoney"),
        value: totals.equalSplitAmount - totals.wifeDailyFromSalaryTotal
      }}
      sectionKey="ws"
      dragGroup="wife"
      onExternalDrop={(item, fromKey) => moveItem(item, fromKey, "wifeDailyFromSalary")}
    />
    {/if}

    {#if !searchActive || matchedSections[7]}
    <ExpenseSection
      sectionId="section-8"
      confirmChanges={!isActiveMonth}
      title={t("month.section8")}
      badge="↓"
      icon="savings"
      tone="rose"
      collapsible
      items={visibleItemsPerSection[7]?.items ?? budget.wifeDailyFromSavings}
      highlightedQuery={searchQuery}
      withMethod
      onChange={(items: ExpenseItem[]) =>
        update(
          "wifeDailyFromSavings",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "" }))
        )}
      footerLabel={t("month.subtotalSavings")}
      footerValue={totals.wifeDailyFromSavingsTotal}
      sectionKey="wsv"
      dragGroup="wife"
      onExternalDrop={(item, fromKey) => moveItem(item, fromKey, "wifeDailyFromSavings")}
    />
    {/if}
  </div>

  {#if searchActive && firstMatchedIndex === -1}
    <div class="search-empty" in:fade={{ duration: 300 }}>
      <span class="search-empty-icon">⌕</span>
      <h3>{t("month.searchEmpty")}</h3>
      <p>“{searchQuery}”</p>
    </div>
  {/if}

  <!-- Mobile-only floating navigation to jump between the eight sections. -->
  <div class="section-nav">
    {#if showSectionNav}
      <button
        class="section-nav-backdrop"
        type="button"
        tabindex="-1"
        aria-label={t("month.sectionMenuClose")}
        onclick={() => (showSectionNav = false)}
      ></button>
      <nav
        id="section-nav-menu"
        class="section-nav-menu"
        aria-label={t("month.sectionMenu")}
        transition:fly={{ y: 10, duration: 180 }}
      >
        <span class="section-nav-title">{t("month.sectionMenu")}</span>
        {#each SECTION_NAV_KEYS as key, i (key)}
          <button class="section-nav-item" type="button" onclick={() => goToSection(i + 1)}>
            <span>{t(key)}</span>
            <svg
              viewBox="0 0 24 24"
              class="section-nav-chevron"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        {/each}
      </nav>
    {/if}

    <button
      class="section-nav-fab"
      type="button"
      aria-expanded={showSectionNav}
      aria-controls="section-nav-menu"
      aria-label={showSectionNav ? t("month.sectionMenuClose") : t("month.sectionMenu")}
      onclick={() => (showSectionNav = !showSectionNav)}
    >
      {#if showSectionNav}
        <svg
          viewBox="0 0 24 24"
          class="section-nav-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      {:else}
        <svg
          viewBox="0 0 24 24"
          class="section-nav-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
          <path d="M9 6h11M9 12h11M9 18h11" />
        </svg>
      {/if}
    </button>
  </div>

  <!-- Month-to-month navigation: left → next month, right → previous month. -->
  <nav class="month-nav" aria-label="Month navigation">
    <button
      class="month-nav-btn"
      type="button"
      aria-label="Next month"
      disabled={!canGoNext}
      onclick={() => canGoNext && goto(`/month/${nextMonthId}`)}
    >
      ←
    </button>
    <span class="month-nav-sep">{monthId}</span>
    <button
      class="month-nav-btn"
      type="button"
      aria-label="Previous month"
      disabled={!canGoPrevious}
      onclick={() => canGoPrevious && goto(`/month/${prevMonthId}`)}
    >
      →
    </button>
  </nav>
  {/if}
</div>

<style>
  .page { display: flex; flex-direction: column; gap: 1.5rem; }

  .page-header { display: flex; flex-direction: column; gap: 0.75rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--surface-border); }
  .header-top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .back-btn { display: flex; align-items: center; gap: 0.35rem; text-decoration: none; color: var(--text-tertiary); font-size: 0.85rem; font-weight: 500; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); transition: all 0.2s; }
  .back-btn:hover { color: var(--text-primary); background: var(--bg-muted); }
  .page-title { font-size: 1.55rem; letter-spacing: -0.02em; line-height: 1.2; }
  .page-subtitle { font-size: 0.85rem; color: var(--text-tertiary); margin-top: 0.1rem; }
  .header-side { display: flex; align-items: center; gap: 0.75rem; }
  .save-state { font-size: 0.72rem; font-weight: 600; color: var(--text-tertiary); }
  .save-state.saving { color: var(--accent-gold); }
  .edit-btn { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 600; color: var(--accent-gold); background: var(--accent-gold-light); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: 1px solid rgba(200, 149, 108, 0.2); }
  .edit-btn-svg { width: 14px; height: 14px; }
  .edit-btn:hover { background: rgba(200, 149, 108, 0.2); }

  .income-panel { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-md); }
  .income-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field span { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
  .field input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--bg); font-size: 0.875rem; color: var(--text-primary); }
  .field input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(200, 149, 108, 0.15); }
  .income-actions { display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 1rem; }
  .btn-save { padding: 0.55rem 1.15rem; border-radius: var(--radius-sm); background: var(--text-primary); color: var(--bg); font-size: 0.825rem; font-weight: 600; }
  .btn-save:hover { opacity: 0.88; }
  .btn-cancel { padding: 0.55rem 1.15rem; border-radius: var(--radius-sm); background: transparent; border: 1px solid var(--surface-border); color: var(--text-secondary); font-size: 0.825rem; font-weight: 600; }
  .btn-cancel:hover { background: var(--bg-muted); }

  .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm); }
  .stat-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); display: block; margin-bottom: 0.5rem; }
  .stat-value { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; display: block; margin-bottom: 0.4rem; }
  .stat-sub { font-size: 0.78rem; color: var(--text-tertiary); display: block; line-height: 1.5; }
  .stat-card.income .stat-value { color: var(--success); }
  .stat-card.expense .stat-value { color: var(--accent-gold); }
  .stat-card.savings .stat-value { color: var(--accent-blue); }
  .stat-card.split { background: linear-gradient(135deg, var(--accent-teal-light), var(--surface)); border-color: rgba(91, 138, 138, 0.35); }
  .stat-card.split .stat-value { color: var(--accent-teal); }
  .stat-card.split.negative .stat-value { color: var(--danger); }

  .chart-section { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm); }
  .chart-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
  .chart-title { font-size: 0.9rem; font-weight: 800; color: var(--text-primary); }

  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }

  .bar-chart { display: flex; flex-direction: column; }
  .bar-chart-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.85rem; }
  .bar-chart-title { font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); }
  .bar-chart-total { font-size: 0.95rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .bar-chart-plot {
    display: flex; align-items: flex-end; justify-content: space-around;
    gap: 0.75rem; height: 210px; padding: 0.5rem 0.25rem 0;
    border-bottom: 1px solid var(--surface-border);
  }
  .bar-col { display: flex; align-items: flex-end; justify-content: center; flex: 1; height: 100%; max-width: 96px; }
  .bar-col-track { position: relative; width: 100%; height: 100%; display: flex; align-items: flex-end; justify-content: center; }

  .bar-chart-labels {
    display: flex; justify-content: space-around;
    gap: 0.75rem; padding: 0 0.25rem; margin-top: 0.55rem;
  }
  .bar-label {
    flex: 1; max-width: 96px;
    font-size: 0.74rem; font-weight: 600;
    color: var(--text-tertiary); text-align: center; line-height: 1.25;
  }
  .bar-label.combined { color: var(--text-primary); font-weight: 800; }

  .bar-stack {
    width: 100%; max-width: 62px; min-height: 3px;
    display: flex; flex-direction: column;
    position: relative; transition: height 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .bar-stack > :first-child { border-radius: 8px 8px 0 0; }
  .bar-seg { width: 100%; transition: height 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
  .bar-seg.blue { background: linear-gradient(180deg, var(--accent-blue), #5a7090); }
  .bar-seg.rose { background: linear-gradient(180deg, var(--accent-rose), #b06a7c); }

  .bar-value {
    position: absolute; bottom: calc(100% + 0.15rem); left: 50%; transform: translateX(-50%);
    font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
    white-space: nowrap; font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  .bar-legend { display: flex; gap: 1rem; margin-top: 0.85rem; justify-content: center; }
  .legend-chip { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); }
  .legend-dot { width: 12px; height: 12px; border-radius: 4px; }
  .legend-dot.blue { background: var(--accent-blue); }
  .legend-dot.rose { background: var(--accent-rose); }

  .chart-note { display: flex; gap: 0.6rem; margin-top: 1.25rem; padding: 0.85rem 1rem; background: var(--bg-muted); border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; }
  .chart-note-icon { font-size: 1.1rem; flex-shrink: 0; }
  .chart-note-body { display: flex; flex-direction: column; gap: 0.35rem; }
  .chart-note-body p { margin: 0; }

  .sections { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; align-items: start; }

  .search-empty {
    display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
    text-align: center; padding: 3.5rem 2rem; background: var(--surface);
    border: 1px dashed var(--surface-border); border-radius: var(--radius-lg);
  }
  .search-empty-icon { font-size: 2rem; color: var(--text-tertiary); }
  .search-empty h3 { font-size: 1rem; font-weight: 700; }
  .search-empty p { font-size: 0.85rem; color: var(--text-tertiary); overflow-wrap: anywhere; }

  /* ── Mobile quick section navigation ──────────────────────────────────── */
  .section-nav { display: none; position: fixed; right: calc(1rem + env(safe-area-inset-right, 0px)); bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); z-index: 200; }

  .section-nav-backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
    background: rgba(26, 23, 20, 0.22);
    backdrop-filter: blur(2px);
    border: none;
    padding: 0;
    cursor: default;
    touch-action: none;
  }

  .section-nav-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.75rem);
    z-index: 2;
    width: min(19rem, calc(100vw - 2rem));
    max-height: min(68vh, 32rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    transform-origin: bottom right;
  }

  .section-nav-title {
    padding: 0.35rem 0.65rem 0.45rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  .section-nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    width: 100%;
    padding: 0.6rem 0.65rem;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.82rem;
    font-weight: 500;
    line-height: 1.35;
    text-align: left;
    transition: background 0.18s ease, color 0.18s ease;
  }
  .section-nav-item:hover,
  .section-nav-item:active {
    background: var(--accent-gold-light);
    color: var(--text-primary);
  }
  .section-nav-chevron {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    color: var(--text-tertiary);
  }
  .section-nav-item:hover .section-nav-chevron { color: var(--accent-gold); }

  .section-nav-fab {
    position: relative;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 3.4rem;
    height: 3.4rem;
    border-radius: 50%;
    color: #fff;
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-rose));
    box-shadow: 0 10px 26px rgba(200, 149, 108, 0.42), 0 4px 10px rgba(26, 23, 20, 0.18);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .section-nav-fab:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 14px 32px rgba(200, 149, 108, 0.5), 0 6px 14px rgba(26, 23, 20, 0.2);
  }
  .section-nav-fab:active { transform: scale(0.96); }
  .section-nav-fab:focus-visible { outline: 2px solid var(--accent-gold); outline-offset: 3px; }
  .section-nav-icon { width: 1.35rem; height: 1.35rem; }

  /* Month-to-month navigation bar at the bottom of the month page. */
  .month-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin: 2rem 0;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--surface-border);
  }
  .month-nav-btn {
    display: grid;
    place-items: center;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    border: 1px solid var(--surface-border);
    background: var(--bg);
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s ease;
  }
  .month-nav-btn:hover:not(:disabled) {
    background: var(--bg-muted);
    color: var(--accent-gold);
  }
  .month-nav-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    color: var(--text-tertiary);
  }
  .month-nav-sep {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-tertiary);
    letter-spacing: 0.05em;
  }

  @media (max-width: 1000px) {
    .summary-row { grid-template-columns: repeat(2, 1fr); }
    .sections { grid-template-columns: 1fr; }
    .charts-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 768px) {
    .page { padding-bottom: calc(3.5rem + env(safe-area-inset-bottom, 0px)); }
    .section-nav { display: block; }
    .summary-row { grid-template-columns: 1fr; }
    .income-fields { grid-template-columns: 1fr; }
    .charts-grid { grid-template-columns: 1fr; gap: 1.25rem; }
    .chart-section { padding: 1rem 0.85rem; }
    .bar-chart-plot { height: 180px; gap: 0.4rem; padding-left: 0; padding-right: 0; }
    .bar-chart-labels { gap: 0.4rem; padding-left: 0; padding-right: 0; }
    .bar-col { max-width: none; }
    .bar-label { max-width: none; font-size: 0.66rem; }
    .bar-value { font-size: 0.56rem; }
    .back-text { display: none; }
    .back-btn { padding: 0.4rem 0.5rem; font-size: 1rem; }
    .save-state { display: none; }
    .page-title { font-size: 1.3rem; }
    .edit-btn { padding: 0.45rem 0.85rem; font-size: 0.75rem; }
  }
</style>
