<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { fade, fly, slide } from "svelte/transition";
  import { untrack } from "svelte";
  import ExpenseSection from "#lib/components/ExpenseSection.svelte";
  import { subscribeBudget, saveBudget, fetchAllBudgets } from "#lib/budget-store";
  import {
    computeTotals,
    createEmptyBudget,
    formatCurrency,
    formatPeriod,
    totalExpenses,
    type MonthBudget,
    type ExpenseItem
  } from "#lib/types";
  import { isAuthenticated } from "#lib/auth";
  import { currentPeriodId, isUpcomingPeriod, monthLabel } from "#lib/period";
  import { matchesQuery } from "#lib/search";
  import { splitEmphasis } from "#lib/emphasis";
  import { equalSplitCardKind, isPeriodStartDay } from "#lib/equal-split";
  import { t, lang } from "#lib/i18n.svelte";
  import SearchBar from "#lib/components/SearchBar.svelte";
  import Seo from "#lib/components/Seo.svelte";
  import Skeleton from "#lib/components/Skeleton.svelte";
  import CountUp from "#lib/components/CountUp.svelte";
  import { toastError, toastSuccess } from "#lib/toast.svelte";

  const monthId = $derived(page.params.id ?? "");

  /** Month pages outside the active period require confirmation before edits. */
  const isActiveMonth = $derived(monthId === currentPeriodId());
  /**
   * The upcoming period is listed on the dashboard from the 21st but only
   * becomes active on the 25th. Its fixed expenses are carried over from the
   * previous period, so they can be prepared early — edited, moved between the
   * spouses and deleted — without the inactive-month confirmation.
   */
  const isUpcomingMonth = $derived(isUpcomingPeriod(monthId));
  /** Fixed sections skip the confirmation for the upcoming period only. */
  const confirmFixedChanges = $derived(!isActiveMonth && !isUpcomingMonth);

  /** All stored month ids, sorted chronologically (oldest first). */
  let allMonthIds = $state<string[]>([]);

  const currentIndex = $derived(allMonthIds.indexOf(monthId));
  const prevMonthId = $derived(currentIndex > 0 ? allMonthIds[currentIndex - 1] : null);
  const nextMonthId = $derived(currentIndex >= 0 && currentIndex < allMonthIds.length - 1 ? allMonthIds[currentIndex + 1] : null);
  /** Right arrow goes to the previous month; stop at the earliest month in DB. */
  const canGoPrevious = $derived(prevMonthId != null);
  /** Left arrow goes to the next month; stop when on the active month. */
  const canGoNext = $derived(nextMonthId != null && !isActiveMonth);

  const locale = $derived(lang.value === "id" ? "id-ID" : "en-US");
  /** Readable name of the viewed period, e.g. `2026-10` -> "November 2026". */
  const navMonthLabel = $derived(monthId ? monthLabel(monthId, locale) : "");

  let budget = $state<MonthBudget>(createEmptyBudget("2026-01"));
  let loading = $state(true);
  let saving = $state(false);
  let savedAt = $state<string>("");
  let showHeaderEditor = $state(false);
  let showSectionNav = $state(false);
  let searchQuery = $state("");

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
        items: items.filter((item) => matchesQuery(item.name, item.method, searchQuery)),
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

  let headerDraft = $state({ title: "", periodStart: "", periodEnd: "" });

  /** Locale for date formatting, following the active language. */
  const dateLocale = $derived(lang.value === "id" ? "id-ID" : "en-US");

  /** Live preview of the period label built from the two draft dates. */
  const headerPeriodPreview = $derived(
    formatPeriod(headerDraft.periodStart, headerDraft.periodEnd, dateLocale)
  );

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

  /**
   * Compact rupiah for labels drawn *inside* a bar segment. The coloured strip is
   * only ~62px wide, so a full "Rp 9.600.000" would be clipped: always use the
   * compact notation and drop the decimal once it no longer adds information.
   */
  function formatInBarIDR(value: number): string {
    if (!value) return "Rp 0";
    const compact = new Intl.NumberFormat(lang.value, {
      notation: "compact",
      maximumFractionDigits: value >= 1_000_000 ? 0 : 1
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

  // ── Equal-split card: pending transfer vs. planned budget ───────────────
  // Wife → Husband keeps showing the transfer until section 5 marks it
  // received. Husband → Wife only shows it on the period's first day (the
  // 25th); from the 26th on he has certainly sent it, so the card falls back
  // to the planned per-person budget.
  const showEqualSplitTransfer = $derived(
    equalSplitCardKind(
      totals.equalSplitTransfer,
      budget.transferReceived ?? false,
      isActiveMonth && isPeriodStartDay(budget.periodStart ?? `${monthId}-25`)
    ) === "transfer"
  );
  const transferDirection = $derived(
    totals.equalSplitTransfer >= 0
      ? `${t("common.husband")} → ${t("common.wife")}`
      : `${t("common.wife")} → ${t("common.husband")}`
  );
  const equalSplitTransferAmount = $derived(Math.abs(totals.equalSplitTransfer));

  // Combined daily totals (husband + wife).
  const dailyFromSalaryTotal = $derived(
    totals.husbandDailyFromSalaryTotal + totals.wifeDailyFromSalaryTotal
  );
  const dailyFromSavingsTotal = $derived(
    totals.husbandDailyFromSavingsTotal + totals.wifeDailyFromSavingsTotal
  );

  // Total expenses = fixed + daily from salary + daily from savings.
  const totalExpense = $derived(totalExpenses(totals));
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
    // Read `budget.id` untracked: otherwise every snapshot's `budget = next`
    // reassignment invalidates this effect, which re-subscribes, fires again and
    // loops forever (constant re-renders that never let the count-up settle).
    if (untrack(() => budget.id) !== monthId) {
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
        headerDraft = {
          title: next.title,
          periodStart: next.periodStart ?? "",
          periodEnd: next.periodEnd ?? ""
        };
      }
      loading = false;
    });

    return () => {
      unsubscribe();
    };
  });

  /**
   * Write the budget optimistically and report the outcome.
   *
   * Returns `true` when the save landed and `false` when it failed, so callers
   * (the expense sections) can confirm the change with a toast.
   */
  async function persist(next: MonthBudget): Promise<boolean> {
    budget = next;
    saving = true;
    try {
      await saveBudget(next);
      savedAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return true;
    } catch (error) {
      console.error("Save failed:", error);
      return false;
    } finally {
      saving = false;
    }
  }

  function update<K extends keyof MonthBudget>(key: K, value: MonthBudget[K]): Promise<boolean> {
    return persist({ ...budget, [key]: value });
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

  /** Budget fields a dragged item can be dropped into. */
  type DropField =
    | "husbandFixed"
    | "wifeFixed"
    | "husbandDailyFromSalary"
    | "husbandDailyFromSavings"
    | "wifeDailyFromSalary"
    | "wifeDailyFromSavings";

  /** Whose section each drop target is and which pot it draws from (i18n keys). */
  const DROP_TARGET: Record<DropField, { person: string; kind: string }> = {
    husbandFixed: { person: "common.husband", kind: "common.fixed" },
    wifeFixed: { person: "common.wife", kind: "common.fixed" },
    husbandDailyFromSalary: { person: "common.husband", kind: "common.salary" },
    husbandDailyFromSavings: { person: "common.husband", kind: "common.savings" },
    wifeDailyFromSalary: { person: "common.wife", kind: "common.salary" },
    wifeDailyFromSavings: { person: "common.wife", kind: "common.savings" }
  };

  /**
   * Move an item dropped into `toField` from its original section.
   * Only valid when the item truly exists in the source section.
   */
  function moveItem(item: ExpenseItem, fromKey: string, toField: DropField) {
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

    void reportMove(next, movedMessage(toField));
  }

  /** "Moved to Wife · Savings" for the section a dragged item landed in. */
  function movedMessage(field: DropField): string {
    const target = DROP_TARGET[field];
    return t("toast.movedTo", {
      person: t(target.person),
      kind: t(target.kind)
    });
  }

  /** Persist a drag-and-drop move and confirm it with a toast. */
  async function reportMove(next: MonthBudget, message: string) {
    try {
      const saved = await persist(next);
      if (saved) toastSuccess(message);
      else toastError(t("toast.saveFailed"));
    } catch (error) {
      console.error("Move failed:", error);
      toastError(t("toast.saveFailed"));
    }
  }

  function openHeaderEditor() {
    headerDraft = {
      title: budget.title,
      periodStart: budget.periodStart ?? "",
      periodEnd: budget.periodEnd ?? ""
    };
    showHeaderEditor = true;
  }

  function saveHeader() {
    const period = headerPeriodPreview || budget.period;
    persist({
      ...budget,
      title: headerDraft.title.trim() || budget.title,
      period,
      periodStart: headerDraft.periodStart,
      periodEnd: headerDraft.periodEnd
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
  <div class="page-header animate-stagger" in:fade={{ duration: 350 }}>
    <div class="header-top">
      <a href="/" class="back-btn" aria-label={t("month.allMonths")}>← <span class="back-text">{t("month.allMonths")}</span></a>
      <div class="header-side">
        <SearchBar
          query={searchQuery}
          onQueryChange={(q: string) => (searchQuery = q)}
          onClear={() => (searchQuery = "")}
        />
        <span class="save-state" class:saving aria-live="polite">
          {#if loading}{t("common.loading")}{:else if saving}{t("month.saving")}{:else if savedAt}{t("month.saved", { time: savedAt })}{/if}
        </span>
      </div>
    </div>
    <div class="header-meta">
      {#if loading}
        <Skeleton width="220px" height="1.85rem" />
        <Skeleton width="160px" height="1.1rem" style="margin-top:0.35rem;" />
        <Skeleton width="118px" height="2.4rem" radius="var(--radius-sm)" style="margin-top:0.75rem;" />
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
    <!-- Summary skeleton: same card tones (4th is the tinted split card) and
         line heights as the real stats, so nothing jumps when data lands. -->
    <div class="summary-row" aria-hidden="true">
      {#each ["income", "split", "expense", "savings"] as tone}
        <div class="stat-card {tone}">
          <Skeleton width="65%" height="1.1rem" style="margin-bottom:0.5rem;" />
          <Skeleton width="85%" height="1.7rem" style="margin-bottom:0.4rem;" />
          <!-- Captions wrap to two lines on most widths. -->
          <Skeleton width="100%" height="0.95rem" />
          <Skeleton width="55%" height="0.95rem" style="margin-top:0.2rem;" />
        </div>
      {/each}
    </div>

    <!-- Chart skeleton: same plot height, bar widths and text sizes as the
         real charts. Heights are in px so no engine has to resolve a
         percentage inside a flex item. -->
    <div class="chart-section" aria-hidden="true">
      <div class="chart-header">
        <Skeleton width="200px" height="1.1rem" />
      </div>
      <div class="charts-grid">
        <!-- Mirror the two real charts: 3 income bars, 5 expense bars. -->
        {#each [{ bars: 3, h: [190, 122, 82] }, { bars: 5, h: [186, 146, 112, 78, 50] }] as chart}
          <div class="bar-chart">
            <div class="bar-chart-head">
              <Skeleton width="55%" height="1rem" />
              <Skeleton width="72px" height="1.15rem" />
            </div>
            <div class="bar-chart-plot">
              {#each chart.h as barHeight}
                <div class="bar-col">
                  <div class="bar-col-track">
                    <Skeleton
                      width="100%"
                      height="{barHeight}px"
                      radius="8px 8px 0 0"
                      style="max-width:62px;"
                    />
                  </div>
                </div>
              {/each}
            </div>
            <div class="bar-chart-labels">
              {#each Array(chart.bars) as _}
                <Skeleton width="60%" height="1rem" style="margin:0 auto;max-width:60px;" />
              {/each}
            </div>
            <div class="bar-legend">
              <span class="legend-chip">
                <Skeleton width="12px" height="12px" radius="4px" />
                <Skeleton width="34px" height="1.1rem" />
              </span>
              <span class="legend-chip">
                <Skeleton width="12px" height="12px" radius="4px" />
                <Skeleton width="34px" height="1.1rem" />
              </span>
            </div>
          </div>
        {/each}
      </div>
      <!-- Takeaway note under the charts (three short paragraphs). -->
      <div class="chart-note">
        <Skeleton circle size={18} />
        <div class="chart-note-body" style="flex:1;">
          <Skeleton width="100%" height="1.1rem" />
          <Skeleton width="92%" height="1.1rem" />
          <Skeleton width="68%" height="1.1rem" />
        </div>
      </div>
    </div>

    <!-- Sections skeleton (mirrors the 8 real expense sections) -->
    <div class="sections" aria-hidden="true">
      <!-- Income sections hold one row; fixed sections are the longest. The
           two fixed sections also show a checkbox per row. -->
      {#each [1, 1, 4, 4, 3, 3, 2, 2] as rowCount, sectionIndex}
        <div class="section-skeleton">
          <div class="section-skeleton-head">
            <Skeleton width="28px" height="28px" radius="7px" />
            <Skeleton width="55%" height="1.15rem" style="flex:1;" />
            <Skeleton width="76px" height="1.1rem" />
            <Skeleton width="28px" height="28px" radius="var(--radius-sm)" />
          </div>
          {#each Array(rowCount) as _}
            <div class="section-skeleton-row">
              <div class="section-skeleton-left">
                {#if sectionIndex === 2 || sectionIndex === 3}
                  <Skeleton width="18px" height="18px" radius="5px" />
                {/if}
                <Skeleton width="45%" height="1.2rem" />
              </div>
              <div class="section-skeleton-right">
                <Skeleton width="68px" height="1.2rem" />
                <Skeleton width="26px" height="26px" radius="var(--radius-sm)" />
                <Skeleton width="26px" height="26px" radius="var(--radius-sm)" />
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    <!-- Month navigation skeleton (the real nav renders with the content). -->
    <nav class="month-nav" aria-hidden="true">
      <Skeleton width="2.6rem" height="2.6rem" radius="50%" />
      <div class="month-nav-label">
        <Skeleton width="120px" height="1.2rem" />
        <Skeleton width="96px" height="1.05rem" style="margin-top:0.15rem;" />
      </div>
      <Skeleton width="2.6rem" height="2.6rem" radius="50%" />
    </nav>
  {:else}
  {#if showHeaderEditor}
    <div class="income-panel" in:slide={{ duration: 220 }}>
      <div class="income-fields">
        <label class="field">
          <span>{t("month.fieldTitle")}</span>
          <input type="text" bind:value={headerDraft.title} />
        </label>
        <div class="period-field">
          <span class="period-label">{t("month.fieldPeriod")}</span>
          <div class="period-dates">
            <label class="period-date">
              <span>{t("month.fieldPeriodFrom")}</span>
              <input type="date" bind:value={headerDraft.periodStart} />
            </label>
            <span class="period-arrow" aria-hidden="true">→</span>
            <label class="period-date">
              <span>{t("month.fieldPeriodTo")}</span>
              <input type="date" bind:value={headerDraft.periodEnd} />
            </label>
          </div>
          <span class="field-hint">
            {headerPeriodPreview || t("month.fieldPeriodHint")}
          </span>
        </div>
      </div>
      <div class="income-actions">
        <button class="btn-save" onclick={saveHeader}>{t("common.saveChanges")}</button>
        <button class="btn-cancel" onclick={() => (showHeaderEditor = false)}>{t("common.cancel")}</button>
      </div>
    </div>
  {/if}

  <div class="summary-row animate-stagger" in:fly={{ y: 14, duration: 420, delay: 60 }}>
    <div class="stat-card income">
      <span class="stat-label">{t("month.totalIncome")}</span>
      <CountUp value={totals.totalIncome} class="stat-value" />
      <span class="stat-sub">
        {t("common.husband")} {formatCurrency(budget.husbandIncome)} · {t("common.wife")} {formatCurrency(budget.wifeIncome)}
      </span>
    </div>
    <div class="stat-card split" class:negative={showEqualSplitTransfer && totals.equalSplitTransfer < 0}>
      {#if showEqualSplitTransfer}
        <span class="stat-label">{t("month.equalSplitTransfer")}</span>
        <CountUp value={Math.abs(totals.equalSplitTransfer)} class="stat-value" />
        <span class="stat-sub">
          {transferDirection}
          · {t("month.eachHolds", { amount: formatCurrency(totals.equalSplitAmount) })}
        </span>
      {:else}
        <span class="stat-label">{t("dashboard.maxPlannedPerPerson")}</span>
        <CountUp value={totals.equalSplitAmount} class="stat-value" />
        <span class="stat-sub">
          {#if equalSplitTransferAmount > 0}
            {t("month.splitTransferNote")}
            <strong class="split-amount">{formatCurrency(equalSplitTransferAmount)}</strong>
            · {transferDirection}
          {:else}
            {t("month.splitTransferNone")}
          {/if}
        </span>
      {/if}
    </div>
    <div class="stat-card expense">
      <span class="stat-label">{t("month.totalExpense")}</span>
      <CountUp value={totalExpense} class="stat-value" />
      <span class="stat-sub">
        {t("common.husband")} {formatCurrency(husbandTotalExpense)} · {t("common.wife")} {formatCurrency(wifeTotalExpense)}
      </span>
    </div>
    <div class="stat-card savings">
      <span class="stat-label">{t("month.totalDailyFromSavings")}</span>
      <CountUp value={dailyFromSavingsTotal} class="stat-value" />
      <span class="stat-sub">
        {t("common.husband")} {formatCurrency(totals.husbandDailyFromSavingsTotal)} · {t("common.wife")} {formatCurrency(totals.wifeDailyFromSavingsTotal)}
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
          {#each incomeBars as bar, i}
            <div class="bar-col" class:combined={bar.combined} style:--bar-index={i}>
              <div class="bar-col-track">
                <div class="bar-stack" style:height={`${(bar.total / incomeMax) * 100}%`}>
                  <span class="bar-value">{isNarrow ? formatCompactIDR(bar.total) : formatCurrency(bar.total)}</span>
                  <div class="bar-fill">
                    <div class="bar-seg blue" style:height={`${bar.total ? (bar.husband / bar.total) * 100 : 0}%`}>
                      {#if bar.husband > 0 && bar.wife > 0}
                        <span class="bar-seg-value">{formatInBarIDR(bar.husband)}</span>
                      {/if}
                    </div>
                    <div class="bar-seg rose" style:height={`${bar.total ? (bar.wife / bar.total) * 100 : 0}%`}>
                      {#if bar.husband > 0 && bar.wife > 0}
                        <span class="bar-seg-value">{formatInBarIDR(bar.wife)}</span>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
        <div class="bar-chart-labels">
          {#each incomeBars as bar, i}
            <span class="bar-label" class:combined={bar.combined} style:--bar-index={i}>{bar.label}</span>
          {/each}
        </div>
        <div class="bar-legend animate-stagger">
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
          {#each expenseBars as bar, i}
            <div class="bar-col" style:--bar-index={i}>
              <div class="bar-col-track">
                <div class="bar-stack" style:height={`${(bar.total / expenseMax) * 100}%`}>
                  <span class="bar-value">{isNarrow ? formatCompactIDR(bar.total) : formatCurrency(bar.total)}</span>
                  <div class="bar-fill">
                    <div class="bar-seg blue" style:height={`${bar.total ? (bar.husband / bar.total) * 100 : 0}%`}>
                      {#if bar.husband > 0 && bar.wife > 0}
                        <span class="bar-seg-value">{formatInBarIDR(bar.husband)}</span>
                      {/if}
                    </div>
                    <div class="bar-seg rose" style:height={`${bar.total ? (bar.wife / bar.total) * 100 : 0}%`}>
                      {#if bar.husband > 0 && bar.wife > 0}
                        <span class="bar-seg-value">{formatInBarIDR(bar.wife)}</span>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
        <div class="bar-chart-labels">
          {#each expenseBars as bar, i}
            <span class="bar-label" class:combined={bar.key === "allTotal" || bar.key === "fixedSalary"} style:--bar-index={i}>{bar.label}</span>
          {/each}
        </div>
        <div class="bar-legend animate-stagger">
          <span class="legend-chip"><span class="legend-dot blue"></span>{t("common.husband")}</span>
          <span class="legend-chip"><span class="legend-dot rose"></span>{t("common.wife")}</span>
        </div>
      </div>
    </div>

    <div class="chart-note">
      <span class="chart-note-icon">💡</span>
      <div class="chart-note-body">
        {#snippet conclusion(text: string)}
          {#each splitEmphasis(text) as run}
            {#if run.strong}<strong>{run.text}</strong>{:else}{run.text}{/if}
          {/each}
        {/snippet}
        <p>
          {@render conclusion(
            t("month.chartConclusionIncome", {
              income: formatCurrency(totals.totalIncome),
              husband: formatCurrency(budget.husbandIncome),
              wife: formatCurrency(budget.wifeIncome)
            })
          )}
        </p>
        <p>
          {@render conclusion(
            t("month.chartConclusionSplit", {
              fixed: formatCurrency(totals.totalFixedExpenses),
              salary: formatCurrency(dailyFromSalaryTotal),
              remaining: formatCurrency(Math.max(totals.balanceAfterFixed - dailyFromSalaryTotal, 0))
            })
          )}
        </p>
        <p>
          {@render conclusion(
            t("month.chartConclusionSavings", {
              total: formatCurrency(totalExpense),
              savings: formatCurrency(dailyFromSavingsTotal)
            })
          )}
        </p>
      </div>
    </div>
  </div>

  <div class="sections animate-stagger" in:fade={{ duration: 350, delay: 120 }}>
    {#if !searchActive || matchedSections[0]}
    <ExpenseSection
      sectionId="section-1"
      confirmChanges={!isActiveMonth}
      noRowShift
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
      noRowShift
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
      confirmChanges={confirmFixedChanges}
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
      confirmChanges={confirmFixedChanges}
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
      methodDefault={{ base: "qris", channel: "Bank Jago" }}
      withDate
      onChange={(items: ExpenseItem[]) =>
        update(
          "husbandDailyFromSalary",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "", date: item.date ?? "" }))
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
      methodDefault={{ base: "qris", channel: "Allo Bank" }}
      withDate
      onChange={(items: ExpenseItem[]) =>
        update(
          "husbandDailyFromSavings",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "", date: item.date ?? "" }))
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
      methodDefault={{ base: "qris", channel: "BSI" }}
      withDate
      onChange={(items: ExpenseItem[]) =>
        update(
          "wifeDailyFromSalary",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "", date: item.date ?? "" }))
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
      methodDefault={{ base: "qris", channel: "Bank Jago" }}
      withDate
      onChange={(items: ExpenseItem[]) =>
        update(
          "wifeDailyFromSavings",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "", date: item.date ?? "" }))
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

  {#if searchActive}
    <div class="clear-filter-row" in:fade={{ duration: 250 }}>
      <button
        type="button"
        class="clear-filter-btn"
        onclick={() => (searchQuery = "")}
      >
        <svg
          viewBox="0 0 24 24"
          class="clear-filter-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
        {t("month.clearFilter")}
      </button>
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
        transition:fade={{ duration: 180 }}
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
  <nav class="month-nav" aria-label={t("month.navAria")}>
    <button
      class="month-nav-btn"
      type="button"
      aria-label={t("month.nextMonth")}
      disabled={!canGoNext}
      onclick={() => canGoNext && goto(`/month/${nextMonthId}`)}
    >
      <svg class="month-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <div class="month-nav-label">
      <span class="month-nav-month">
        {#if isActiveMonth}<span class="month-nav-dot" aria-hidden="true"></span>{/if}
        <span class="month-nav-name">{navMonthLabel}</span>
      </span>
      {#if budget.period}
        <span class="month-nav-range">{budget.period}</span>
      {/if}
    </div>
    <button
      class="month-nav-btn"
      type="button"
      aria-label={t("month.prevMonth")}
      disabled={!canGoPrevious}
      onclick={() => canGoPrevious && goto(`/month/${prevMonthId}`)}
    >
      <svg class="month-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  </nav>
  {/if}
</div>

<style>
  .page { display: flex; flex-direction: column; gap: 1.5rem; }

  .page-header { display: flex; flex-direction: column; gap: 0.75rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--surface-border); }
  .header-top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .back-btn { display: flex; align-items: center; gap: 0.35rem; text-decoration: none; color: var(--text-tertiary); font-size: 0.85rem; font-weight: 500; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); transition: color var(--dur-fast) ease, background var(--dur-fast) ease, transform var(--dur-base) var(--ease-out); }
  .back-btn:hover { color: var(--text-primary); background: var(--bg-muted); transform: translateX(-3px); }
  .page-title { font-size: 1.55rem; letter-spacing: -0.02em; line-height: 1.2; }
  .page-subtitle { font-size: 0.85rem; color: var(--text-tertiary); margin-top: 0.1rem; }
  .header-side { display: flex; align-items: center; gap: 0.75rem; }
  .save-state { font-size: 0.72rem; font-weight: 600; color: var(--text-tertiary); transition: color var(--dur-base) var(--ease-out); }
  .save-state.saving { color: var(--accent-gold); animation: pulse 1.2s var(--ease-in-out) infinite; }
  .edit-btn { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 600; color: var(--accent-gold); background: var(--accent-gold-light); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: 1px solid rgba(200, 149, 108, 0.2); transition: background var(--dur-fast) ease, transform var(--dur-base) var(--ease-spring), box-shadow var(--dur-base) var(--ease-out); }
  .edit-btn-svg { width: 14px; height: 14px; transition: transform var(--dur-base) var(--ease-spring); }
  .edit-btn:hover { background: rgba(200, 149, 108, 0.2); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
  .edit-btn:hover .edit-btn-svg { transform: rotate(-8deg) scale(1.1); }
  .edit-btn:active { transform: translateY(0) scale(0.97); }

  .income-panel { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-md); }
  .income-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field span { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
  .field input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--bg); font-size: 0.875rem; color: var(--text-primary); }
  .field input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(200, 149, 108, 0.15); }

  /* Period input: two date pickers joined by an arrow. The live preview below
     them uses the shared `.field-hint` look (app.css). */
  .period-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .period-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
  .period-dates { display: flex; align-items: flex-end; gap: 0.5rem; }
  .period-date { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0; }
  .period-date span { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); }
  .period-date input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--bg); font-size: 0.85rem; color: var(--text-primary); min-width: 0; }
  .period-date input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(200, 149, 108, 0.15); }
  .period-arrow { padding-bottom: 0.65rem; font-size: 0.9rem; color: var(--text-tertiary); }
  .income-actions { display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 1rem; }
  .btn-save { padding: 0.55rem 1.15rem; border-radius: var(--radius-sm); background: var(--text-primary); color: var(--bg); font-size: 0.825rem; font-weight: 600; }
  .btn-save:hover { opacity: 0.88; }
  .btn-cancel { padding: 0.55rem 1.15rem; border-radius: var(--radius-sm); background: transparent; border: 1px solid var(--surface-border); color: var(--text-secondary); font-size: 0.825rem; font-weight: 600; }
  .btn-cancel:hover { background: var(--bg-muted); }

  .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm); transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out); }
  .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .stat-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); display: block; margin-bottom: 0.5rem; }
  .stat-sub { font-size: 0.78rem; color: var(--text-tertiary); display: block; line-height: 1.5; }
  /* The split transfer amount is the key number of that caption, so it gets
     weight and the body text colour while the rest stays muted. */
  .stat-sub .split-amount {
    font-size: 0.86rem; font-weight: 800; letter-spacing: -0.01em;
    color: var(--text-primary); white-space: nowrap;
  }
  /* Values render through the CountUp child component, so their styling must
     escape scoping; the `.stat-card` prefix keeps it local enough. */
  .stat-card :global(.stat-value) { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; display: block; margin-bottom: 0.4rem; }
  .stat-card.income :global(.stat-value) { color: var(--success); }
  .stat-card.expense :global(.stat-value) { color: var(--accent-gold); }
  .stat-card.savings :global(.stat-value) { color: var(--accent-blue); }
  .stat-card.split { background: linear-gradient(135deg, var(--accent-teal-light), var(--surface)); border-color: rgba(91, 138, 138, 0.35); }
  .stat-card.split :global(.stat-value) { color: var(--accent-teal); }
  .stat-card.split.negative :global(.stat-value) { color: var(--danger); }

  .chart-section { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm); }
  .chart-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
  .chart-title { font-size: 0.9rem; font-weight: 800; color: var(--text-primary); }

  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }

  /* Per-bar entrance rhythm: `--bar-start` waits for the section to settle in,
     `--bar-stagger` walks the bars left to right. Both are inherited by the
     bars and their labels. */
  .bar-chart { display: flex; flex-direction: column; --bar-start: 160ms; --bar-stagger: 80ms; }
  .bar-chart-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.85rem; }
  .bar-chart-title { font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); }
  .bar-chart-total { font-size: 0.95rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .bar-chart-plot {
    position: relative;
    display: flex; align-items: flex-end; justify-content: space-around;
    gap: 0.75rem; height: 210px; padding: 0.5rem 0.25rem 0;
  }
  /* The axis draws in from the left while the bars rise. A `border-bottom`
     would be painted at full width straight away, so it is a pseudo-element. */
  .bar-chart-plot::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
    background: var(--surface-border); transform-origin: left;
    animation: underlineGrow var(--dur-slow) var(--ease-out) both;
    animation-delay: 80ms;
  }
  /* ── Bar chart motion ──────────────────────────────────────────────────────
   * Entering the month page, every bar grows from the baseline up to its own
   * height, left to right, then its numbers fade in.
   *
   * The rise is a `scaleY` on the coloured layer, not an animated `height`:
   * percentage heights inside flex items are resolved inconsistently across
   * engines (Safari/WebKit in particular), so a height keyframe can silently
   * never run. A transform needs no percentage resolution, is composited on
   * every browser and stays smooth on low-end phones.
   *
   * Both keyframes are spelled out on purpose — an implicit end keyframe
   * (`from` only) is not reliably resolved by older WebKit builds. With no
   * animation support at all the bars simply render at full height, because
   * the animation never owns the layout height.
   *
   * Hovering a column lifts it and dims the others so the highlighted bar is
   * immediately readable. */
  .bar-col {
    display: flex; align-items: flex-end; justify-content: center;
    flex: 1; height: 100%; max-width: 96px;
    transition: transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out);
  }
  /* Only dim the other columns while one is actually hovered, so moving over the
     empty plot area does not fade the whole chart. */
  /* `:not(:hover)` matters: `:has(.bar-col:hover)` carries the specificity of its
     argument, so a plain `.bar-col` selector here would outrank the hover rule
     below and dim the hovered column too. */
  .bar-chart-plot:has(.bar-col:hover) .bar-col:not(:hover) { opacity: 0.55; }
  .bar-chart-plot .bar-col:hover { opacity: 1; transform: translateY(-3px); }
  .bar-col-track { position: relative; width: 100%; height: 100%; display: flex; align-items: flex-end; justify-content: center; }

  .bar-chart-labels {
    display: flex; justify-content: space-around;
    gap: 0.75rem; padding: 0 0.25rem; margin-top: 0.55rem;
  }
  .bar-label {
    flex: 1; max-width: 96px;
    font-size: 0.74rem; font-weight: 600;
    color: var(--text-tertiary); text-align: center; line-height: 1.25;
    animation: barTextIn var(--dur-base) var(--ease-out) both;
    animation-delay: calc(var(--bar-index, 0) * var(--bar-stagger) + var(--bar-start) + 120ms);
  }
  .bar-label.combined { color: var(--text-primary); font-weight: 800; }

  .bar-stack {
    width: 100%; max-width: 62px; min-height: 3px;
    display: flex; flex-direction: column;
    position: relative; transition: height 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  }
  /* Grow the coloured layer out of the baseline. `scaleY` is explicit on both
     ends and needs no percentage resolution, so every engine runs it. The
     numbers inside are still hidden while the scale is animating (their fade
     starts after the bar lands), so nothing ever looks stretched. */
  @keyframes barRise {
    from { transform: scaleY(0); }
    to { transform: scaleY(1); }
  }
  /* The coloured stack, rounded at the top. Kept in its own absolutely
     positioned layer so the total label above the bar stays outside the clip
     that the corner radius needs. */
  .bar-fill {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    border-radius: 8px 8px 0 0;
    overflow: hidden;
    transform-origin: bottom center;
    animation: barRise var(--dur-slower) var(--ease-out) backwards;
    animation-delay: calc(var(--bar-index, 0) * var(--bar-stagger) + var(--bar-start));
  }
  /* Browsers that cannot animate transforms at all still show the full bar:
     the keyframes only ever own the transform, never the layout. */
  @media (prefers-reduced-motion: reduce) {
    .bar-fill { animation: none; transform: none; }
  }

  @keyframes barTextIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .bar-seg {
    width: 100%; position: relative;
    container-type: size; container-name: barseg;
    display: flex; align-items: center; justify-content: center;
    filter: brightness(1) saturate(1);
    transition: height 0.7s cubic-bezier(0.4, 0, 0.2, 1), filter var(--dur-base) var(--ease-out);
  }
  .bar-col:hover .bar-seg { filter: brightness(1.07) saturate(1.06); }
  .bar-seg.blue { background: linear-gradient(180deg, var(--accent-blue), #5a7090); }
  .bar-seg.rose { background: linear-gradient(180deg, var(--accent-rose), #b06a7c); }

  /* Value of a single source, drawn inside its own coloured segment. Kept short
     (compact notation) and shrunk to the strip width so it never gets clipped. */
  .bar-seg-value {
    font-size: 0.66rem; font-weight: 700; color: #fff;
    max-width: 100%; padding: 0 0.15rem;
    overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; font-variant-numeric: tabular-nums;
    pointer-events: none; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    animation: barTextIn var(--dur-base) var(--ease-out) both;
    animation-delay: calc(
      var(--bar-index, 0) * var(--bar-stagger) + var(--bar-start) + var(--dur-slower) + 60ms
    );
  }
  /* A segment too short to hold its label simply hides it (threshold ≈ 1.2rem). */
  @container barseg (max-height: 1.2rem) {
    .bar-seg-value { display: none; }
  }

  .bar-value {
    position: absolute; bottom: calc(100% + 0.15rem); left: 50%; transform: translateX(-50%);
    font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
    white-space: nowrap; font-variant-numeric: tabular-nums;
    pointer-events: none;
    animation: barTextIn var(--dur-base) var(--ease-out) both;
    animation-delay: calc(
      var(--bar-index, 0) * var(--bar-stagger) + var(--bar-start) + var(--dur-slower)
    );
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
  /* Only the takeaway figures are emphasised (income total, unspent balance,
     savings-paid expenses), so the note can be skimmed at a glance. */
  .chart-note-body strong {
    color: var(--text-primary);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .sections { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; align-items: start; }

  /* Section skeleton mirrors the real `.section` card: surface, border, radius. */
  .section-skeleton {
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }
  .section-skeleton-head {
    display: flex; align-items: center; gap: 0.65rem;
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--surface-border);
  }
  .section-skeleton-row {
    display: flex; align-items: center; justify-content: space-between; gap: 0.85rem;
    padding: 0.7rem 1.25rem;
    border-bottom: 1px solid var(--bg-muted);
  }
  .section-skeleton-row:last-child { border-bottom: none; }
  .section-skeleton-left { display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0; }
  .section-skeleton-right { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }

  .search-empty {
    display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
    text-align: center; padding: 3.5rem 2rem; background: var(--surface);
    border: 1px dashed var(--surface-border); border-radius: var(--radius-lg);
  }
  .search-empty-icon { font-size: 2rem; color: var(--text-tertiary); }
  .search-empty h3 { font-size: 1rem; font-weight: 700; }
  .search-empty p { font-size: 0.85rem; color: var(--text-tertiary); overflow-wrap: anywhere; }

  .clear-filter-row { display: flex; justify-content: center; margin-top: 1.25rem; }
  .clear-filter-btn {
    display: inline-flex; align-items: center; gap: 0.45rem;
    padding: 0.6rem 1.15rem; border-radius: 999px;
    border: 1px solid var(--surface-border); background: var(--surface);
    color: var(--text-secondary); font-size: 0.82rem; font-weight: 600;
    cursor: pointer; box-shadow: var(--shadow-sm);
    transition: background-color 0.2s, color 0.2s, border-color 0.2s;
  }
  .clear-filter-btn:hover {
    background: var(--accent-gold-light); color: var(--text-primary); border-color: var(--accent-gold);
  }
  .clear-filter-icon { width: 1rem; height: 1rem; flex-shrink: 0; }

  /* ── Mobile quick section navigation ──────────────────────────────────── */
  .section-nav { display: none; position: fixed; right: calc(1rem + env(safe-area-inset-right, 0px)); bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); z-index: var(--z-overlay); }

  .section-nav-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-behind);
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
    z-index: var(--z-raised);
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
    animation: riseIn var(--dur-base) var(--ease-out) both;
    transition: background var(--dur-fast) ease, color var(--dur-fast) ease, padding-left var(--dur-base) var(--ease-out);
  }
  .section-nav-item:nth-child(1) { animation-delay: 0.01s; }
  .section-nav-item:nth-child(2) { animation-delay: 0.04s; }
  .section-nav-item:nth-child(3) { animation-delay: 0.07s; }
  .section-nav-item:nth-child(4) { animation-delay: 0.1s; }
  .section-nav-item:nth-child(5) { animation-delay: 0.13s; }
  .section-nav-item:nth-child(6) { animation-delay: 0.16s; }
  .section-nav-item:nth-child(7) { animation-delay: 0.19s; }
  .section-nav-item:nth-child(8) { animation-delay: 0.22s; }
  .section-nav-item:nth-child(n + 9) { animation-delay: 0.25s; }
  .section-nav-item:hover,
  .section-nav-item:active {
    background: var(--accent-gold-light);
    color: var(--text-primary);
    padding-left: 0.85rem;
  }
  .section-nav-chevron {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    color: var(--text-tertiary);
    transition: transform var(--dur-base) var(--ease-out), color var(--dur-fast) ease;
  }
  .section-nav-item:hover .section-nav-chevron { color: var(--accent-gold); transform: translateX(3px); }

  .section-nav-fab {
    position: relative;
    z-index: var(--z-raised);
    display: grid;
    place-items: center;
    width: 3.4rem;
    height: 3.4rem;
    border-radius: 50%;
    color: #fff;
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-rose));
    box-shadow: 0 10px 26px rgba(200, 149, 108, 0.42), 0 4px 10px rgba(26, 23, 20, 0.18);
    transition: transform var(--dur-base) var(--ease-spring), box-shadow var(--dur-base) var(--ease-out);
  }
  .section-nav-fab:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 14px 32px rgba(200, 149, 108, 0.5), 0 6px 14px rgba(26, 23, 20, 0.2);
  }
  .section-nav-fab:active { transform: scale(0.96); }
  .section-nav-fab:focus-visible { outline: 2px solid var(--accent-gold); outline-offset: 3px; }
  .section-nav-icon { width: 1.35rem; height: 1.35rem; transition: transform var(--dur-base) var(--ease-spring); }
  .section-nav-fab:hover .section-nav-icon { transform: rotate(90deg); }

  /* Month-to-month navigation bar at the bottom of the month page.
     Spacing below is left to `.main-content` so the gap to the footer matches
     the other pages instead of stacking a second margin. */
  .month-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin: 2rem 0 0;
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
    cursor: pointer;
    transition: background var(--dur-fast) ease, color var(--dur-fast) ease, border-color var(--dur-fast) ease, transform var(--dur-base) var(--ease-spring);
  }
  /* Both arrows are the same SVG so the two buttons stay pixel-identical. */
  .month-nav-icon { width: 1.15rem; height: 1.15rem; display: block; }
  .month-nav-btn:hover:not(:disabled) {
    background: var(--bg-muted);
    color: var(--accent-gold);
    border-color: var(--accent-gold);
    transform: scale(1.08);
  }
  .month-nav-btn:active:not(:disabled) { transform: scale(0.94); }
  .month-nav-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    color: var(--text-tertiary);
  }
  /* Centre label of the month nav: readable period name over the actual date
     range, so the raw `YYYY-MM` id never has to be shown. Flat on purpose —
     the two arrows already frame it. */
  .month-nav-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-width: 0;
    max-width: 15rem;
    padding: 0 0.5rem;
  }
  .month-nav-month {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    max-width: 100%;
    font-family: "Playfair Display", serif;
    font-size: 1.02rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--text-primary);
  }
  /* Only the name gets the ellipsis: clipping the flex row would shave the
     dot's ring on its left edge and make the dot look lopsided. */
  .month-nav-name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* "This is the active period" marker: a crisp ring reads cleaner than a
     blurred glow at this size. */
  .month-nav-dot {
    flex-shrink: 0;
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 0 2px var(--success-light);
  }
  .month-nav-range {
    max-width: 100%;
    overflow: hidden;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--text-tertiary);
    white-space: nowrap;
    text-overflow: ellipsis;
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
    .period-dates { flex-direction: column; align-items: stretch; gap: 0.4rem; }
    .period-arrow { display: none; }
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
    .month-nav { gap: 0.4rem; }
    .month-nav-btn { width: 2.3rem; height: 2.3rem; }
    .month-nav-label { max-width: 11rem; padding: 0 0.35rem; }
    .month-nav-month { font-size: 0.92rem; }
    .month-nav-range { font-size: 0.62rem; }
  }
</style>
