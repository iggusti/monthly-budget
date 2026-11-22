<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { fade, fly } from "svelte/transition";
  import { untrack } from "svelte";
  import { MOTION, motionFade, motionFly, prefersReducedMotion, setMonthNavDirection } from "#lib/motion";
  import ExpenseSection from "#lib/components/ExpenseSection.svelte";
  import { subscribeBudget, saveBudget, fetchAllBudgets } from "#lib/budget-store";
  import {
    BUDGET_SECTION_KEYS,
    computeTotals,
    createEmptyBudget,
    formatCurrency,
    totalExpenses,
    type MonthBudget,
    type ExpenseItem,
    type DailyExpense
  } from "#lib/types";
  import { isAuthenticated } from "#lib/auth";
  import {
    canEditDailyExpenses,
    currentPeriodId,
    isPastPeriodId,
    isPeriodLocked,
    isUpcomingPeriod,
    monthLabel
  } from "#lib/period";
  import { matchesQuery } from "#lib/search";
  import { splitEmphasis } from "#lib/emphasis";
  import { equalSplitCardKind, isPeriodStartDay } from "#lib/equal-split";
  import { DAILY_METHOD_DEFAULTS } from "#lib/expense-methods";
  import { t, lang } from "#lib/i18n.svelte";
  import SearchBar from "#lib/components/SearchBar.svelte";
  import Seo from "#lib/components/Seo.svelte";
  import Skeleton from "#lib/components/Skeleton.svelte";
  import CountUp from "#lib/components/CountUp.svelte";
  import { toastAction, toastError, toastSuccess } from "#lib/toast.svelte";

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
  /** Left arrow goes to the previous month; stop at the earliest month in DB. */
  const canGoPrevious = $derived(prevMonthId != null);
  /** Right arrow goes to the next month; stop when on the active month. */
  const canGoNext = $derived(nextMonthId != null && !isActiveMonth);

  const locale = $derived(lang.value === "id" ? "id-ID" : "en-US");
  /** Readable name of the viewed period, e.g. `2026-10` -> "November 2026". */
  const navMonthLabel = $derived(monthId ? monthLabel(monthId, locale) : "");

  let budget = $state<MonthBudget>(createEmptyBudget("2026-01"));
  let loading = $state(true);
  let saving = $state(false);
  let savedAt = $state<string>("");
  let showSectionNav = $state(false);
  let searchQuery = $state("");
  let activeBar = $state<string | null>(null);

  const visibleItemsPerSection = $derived(
    BUDGET_SECTION_KEYS.map((sectionKey, index) => {
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
        index,
        key: sectionKey,
        title: t(`month.section${index + 1}`),
        items: items.filter((item) => matchesQuery(item.name, item.method, searchQuery)),
      };
    })
  );

  const searchActive = $derived(searchQuery.trim().length > 0);
  const matchedSections = $derived(
    visibleItemsPerSection.map((section) => section.items.length > 0)
  );
  const firstMatchedIndex = $derived(matchedSections.indexOf(true));

  /** Scroll vertically to a section without ever moving the page sideways. */
  function scrollToSection(target: HTMLElement): void {
    if (typeof window === "undefined") return;
    const scrollMargin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const top = target.getBoundingClientRect().top + window.scrollY - scrollMargin;
    window.scrollTo({
      top: Math.max(0, top),
      left: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  }

  $effect(() => {
    if (searchActive && firstMatchedIndex !== -1) {
      const target = document.getElementById(`section-${firstMatchedIndex + 1}`);
      if (target) {
        scrollToSection(target);
        target.focus({ preventScroll: true });
      }
    }
  });

  /** Close the menu and scroll to the requested section. */
  function goToSection(index: number) {
    showSectionNav = false;
    const target = document.getElementById(`section-${index}`);
    if (!target) return;
    scrollToSection(target);
    target.focus({ preventScroll: true });
  }

  /** Close the section menu and open another month. */
  function goToMonth(id: string | null) {
    if (!id) return;
    showSectionNav = false;
    setMonthNavDirection(monthId, id);
    goto(`/month/${id}`);
  }

  /** Keep the fixed nav outside the page transition's transformed wrapper. */
  function portalToBody(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      }
    };
  }

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

  const dailyFromSalaryTotal = $derived(
    totals.husbandDailyFromSalaryTotal + totals.wifeDailyFromSalaryTotal
  );
  const dailyFromSavingsTotal = $derived(
    totals.husbandDailyFromSavingsTotal + totals.wifeDailyFromSavingsTotal
  );

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

  const isPastMonth = $derived(isPastPeriodId(monthId));
  const isLocked = $derived(isPeriodLocked(monthId, budget.locked));
  const canLock = $derived(isPastMonth && budget.locked === false);
  const canEditDaily = $derived(canEditDailyExpenses(monthId));

  function toggleBar(key: string): void {
    activeBar = activeBar === key ? null : key;
  }

  async function setLocked(locked: boolean): Promise<void> {
    if (!(await update("locked", locked))) {
      toastError(t("toast.saveFailed"));
      return;
    }
    if (locked) {
      toastAction(t("month.lockedToast"), t("backup.undo"), () => void setLocked(false));
    } else {
      toastSuccess(t("month.unlockedToast"));
    }
  }

  /** Record whether the wife-to-husband equal-split transfer has arrived. */
  async function setTransferReceived(received: boolean) {
    // Only meaningful for Wife → Husband; ignore any stale call when the
    // transfer direction is Husband → Wife.
    if (!showTransferReceived) return;
    const saved = await persist({ ...budget, transferReceived: received });
    if (saved) {
      toastSuccess(received ? t("toast.transferReceived") : t("toast.transferPending"));
    } else {
      toastError(t("toast.saveFailed"));
    }
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

  /** Keep the daily row fields; fixed expenses' `checked` flag is dropped. */
  function toDailyExpenses(items: ExpenseItem[]): DailyExpense[] {
    return items.map(({ id, name, amount, method, date }) => ({
      id,
      name,
      amount,
      method: method ?? "",
      date: date ?? ""
    }));
  }

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

</script>

{#snippet lockButton(locked: boolean)}
  <button
    class="lock-btn"
    class:unlocking={locked}
    onclick={() => void setLocked(!locked)}
    aria-label={t(locked ? "month.unlock" : "month.lock")}
  >
    {#if locked}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 7.5-2" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    {/if}
    {t(locked ? "month.unlock" : "month.lock")}
  </button>
{/snippet}

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
  <div class="page-header animate-stagger" in:fade={motionFade(MOTION.base)}>
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
        <div class="header-titleblock">
          <h1 class="page-title">{budget.title}</h1>
          <p class="page-subtitle">{budget.period}</p>
        </div>
        {#if isLocked || canLock}
          <div class="header-actions">
            {@render lockButton(isLocked)}
          </div>
        {/if}
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
  <div class="summary-row animate-stagger" in:fly={motionFly(10, MOTION.slow, 60)}>
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

  <div class="chart-section" in:fly={motionFly(10, MOTION.slow, 90)}>
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
        <div class="bar-chart-plot" aria-label={t("month.chartIncomeAria")}>
          {#each incomeBars as bar, i}
            <div
              class="bar-col"
              class:combined={bar.combined}
              class:active={activeBar === `income-${i}`}
              style:--bar-index={i}
              role="button"
              tabindex="0"
              aria-label={`${bar.label}: ${t("common.husband")} ${formatCurrency(bar.husband)}, ${t("common.wife")} ${formatCurrency(bar.wife)}, ${t("common.total")} ${formatCurrency(bar.total)}`}
              onclick={() => toggleBar(`income-${i}`)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleBar(`income-${i}`);
                }
              }}
            >
              <div class="bar-col-track">
                <div class="bar-stack" style:height={`${(bar.total / incomeMax) * 100}%`}>
                  <span class="bar-value">{isNarrow ? formatCompactIDR(bar.total) : formatCurrency(bar.total)}</span>
                  <div class="bar-fill">
                    <div class="bar-seg blue" style:height={`${bar.total ? (bar.husband / bar.total) * 100 : 0}%`} title={`${t("common.husband")}: ${formatCurrency(bar.husband)}`}>
                      {#if bar.husband > 0 && bar.wife > 0}
                        <span class="bar-seg-value">{formatInBarIDR(bar.husband)}</span>
                      {/if}
                    </div>
                    <div class="bar-seg rose" style:height={`${bar.total ? (bar.wife / bar.total) * 100 : 0}%`} title={`${t("common.wife")}: ${formatCurrency(bar.wife)}`}>
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
        <div class="bar-chart-plot" aria-label={t("month.chartExpenseAria")}>
          {#each expenseBars as bar, i}
            <div
              class="bar-col"
              class:active={activeBar === `expense-${i}`}
              style:--bar-index={i}
              role="button"
              tabindex="0"
              aria-label={`${bar.label}: ${t("common.husband")} ${formatCurrency(bar.husband)}, ${t("common.wife")} ${formatCurrency(bar.wife)}, ${t("common.total")} ${formatCurrency(bar.total)}`}
              onclick={() => toggleBar(`expense-${i}`)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleBar(`expense-${i}`);
                }
              }}
            >
              <div class="bar-col-track">
                <div class="bar-stack" style:height={`${(bar.total / expenseMax) * 100}%`}>
                  <span class="bar-value">{isNarrow ? formatCompactIDR(bar.total) : formatCurrency(bar.total)}</span>
                  <div class="bar-fill">
                    <div class="bar-seg blue" style:height={`${bar.total ? (bar.husband / bar.total) * 100 : 0}%`} title={`${t("common.husband")}: ${formatCurrency(bar.husband)}`}>
                      {#if bar.husband > 0 && bar.wife > 0}
                        <span class="bar-seg-value">{formatInBarIDR(bar.husband)}</span>
                      {/if}
                    </div>
                    <div class="bar-seg rose" style:height={`${bar.total ? (bar.wife / bar.total) * 100 : 0}%`} title={`${t("common.wife")}: ${formatCurrency(bar.wife)}`}>
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

    <!-- The table keeps its natural width for screen readers; clipping it through a
         wrapper (instead of sizing the table itself) stops it widening the layout
         viewport on phones, which would drag the fixed section FAB off-screen. -->
    <div class="sr-only">
      <table>
        <caption>{t("month.chartDataTable")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("expense.nameLabel")}</th>
            <th scope="col">{t("common.husband")}</th>
            <th scope="col">{t("common.wife")}</th>
            <th scope="col">{t("common.total")}</th>
          </tr>
        </thead>
        <tbody>
          <tr><th scope="rowgroup" colspan="4">{t("month.chartIncomeTitle")}</th></tr>
          {#each incomeBars as bar}
            <tr>
              <th scope="row">{bar.label}</th>
              <td>{formatCurrency(bar.husband)}</td>
              <td>{formatCurrency(bar.wife)}</td>
              <td>{formatCurrency(bar.total)}</td>
            </tr>
          {/each}
          <tr><th scope="rowgroup" colspan="4">{t("month.chartExpenseTitle")}</th></tr>
          {#each expenseBars as bar}
            <tr>
              <th scope="row">{bar.label}</th>
              <td>{formatCurrency(bar.husband)}</td>
              <td>{formatCurrency(bar.wife)}</td>
              <td>{formatCurrency(bar.total)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
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

  {#if isLocked}
    <div class="lock-notice" in:fade={motionFade(MOTION.base, 110)}>
      <div class="lock-notice-copy">
        <strong>{t("month.lockedTitle")}</strong>
        <p>{t("month.lockedText")}</p>
      </div>
      {@render lockButton(true)}
    </div>
  {/if}
  {#if isUpcomingMonth && !isLocked}
    <p class="upcoming-daily-notice">{t("month.upcomingDailyNotice")}</p>
  {/if}
  <div class="sections animate-stagger" in:fade={motionFade(MOTION.base, 110)}>
    {#if !searchActive || matchedSections[0]}
    <ExpenseSection
      sectionId="section-1"
      confirmChanges={!isActiveMonth}
      readOnly={isLocked}
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
      readOnly={isLocked}
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
      readOnly={isLocked}
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
      readOnly={isLocked}
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
      readOnly={isLocked || !canEditDaily}
      title={t("month.section5")}
      badge="○"
      icon="wallet"
      tone="blue"
      collapsible
      items={visibleItemsPerSection[4]?.items ?? budget.husbandDailyFromSalary}
      highlightedQuery={searchQuery}
      withMethod
      methodDefault={DAILY_METHOD_DEFAULTS.husbandDailyFromSalary}
      withDate
      onChange={(items: ExpenseItem[]) =>
        update(
          "husbandDailyFromSalary",
          toDailyExpenses(items)
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
      readOnly={isLocked || !canEditDaily}
      title={t("month.section6")}
      badge="↓"
      icon="savings"
      tone="blue"
      collapsible
      items={visibleItemsPerSection[5]?.items ?? budget.husbandDailyFromSavings}
      highlightedQuery={searchQuery}
      withMethod
      methodDefault={DAILY_METHOD_DEFAULTS.husbandDailyFromSavings}
      withDate
      onChange={(items: ExpenseItem[]) =>
        update(
          "husbandDailyFromSavings",
          toDailyExpenses(items)
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
      readOnly={isLocked || !canEditDaily}
      title={t("month.section7")}
      badge="○"
      icon="wallet"
      tone="rose"
      collapsible
      items={visibleItemsPerSection[6]?.items ?? budget.wifeDailyFromSalary}
      highlightedQuery={searchQuery}
      withMethod
      methodDefault={DAILY_METHOD_DEFAULTS.wifeDailyFromSalary}
      withDate
      onChange={(items: ExpenseItem[]) =>
        update(
          "wifeDailyFromSalary",
          toDailyExpenses(items)
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
      readOnly={isLocked || !canEditDaily}
      title={t("month.section8")}
      badge="↓"
      icon="savings"
      tone="rose"
      collapsible
      items={visibleItemsPerSection[7]?.items ?? budget.wifeDailyFromSavings}
      highlightedQuery={searchQuery}
      withMethod
      methodDefault={DAILY_METHOD_DEFAULTS.wifeDailyFromSavings}
      withDate
      onChange={(items: ExpenseItem[]) =>
        update(
          "wifeDailyFromSavings",
          toDailyExpenses(items)
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
    <div class="search-empty" in:fade={motionFade(MOTION.base)}>
      <span class="search-empty-icon">⌕</span>
      <h3>{t("month.searchEmpty")}</h3>
      <p>“{searchQuery}”</p>
    </div>
  {/if}

  {#if searchActive}
    <div class="clear-filter-row" in:fade={motionFade(MOTION.fast)}>
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
  <div class="section-nav" use:portalToBody>
    {#if showSectionNav}
      <button
        class="section-nav-backdrop"
        type="button"
        tabindex="-1"
        aria-label={t("month.sectionMenuClose")}
        onclick={() => (showSectionNav = false)}
        transition:fade={motionFade(MOTION.fast)}
      ></button>
      <nav
        id="section-nav-menu"
        class="section-nav-menu"
        aria-label={t("month.sectionMenu")}
        transition:fly={motionFly(8, MOTION.fast)}
      >
        <!-- Month switcher: the section menu floats over the page, so this is the
             only month control reachable without scrolling to the bottom nav. -->
        <div class="section-nav-month" role="group" aria-label={t("month.navAria")}>
          <button
            class="section-nav-month-btn"
            type="button"
            aria-label={t("month.prevMonth")}
            disabled={!canGoPrevious}
            onclick={() => goToMonth(prevMonthId)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span class="section-nav-month-label">
            {#if isActiveMonth}<span class="section-nav-month-dot" aria-hidden="true"></span>{/if}
            <span class="section-nav-month-name">{navMonthLabel}</span>
          </span>
          <button
            class="section-nav-month-btn"
            type="button"
            aria-label={t("month.nextMonth")}
            disabled={!canGoNext}
            onclick={() => goToMonth(nextMonthId)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <span class="section-nav-title">{t("month.sectionMenu")}</span>
        {#each visibleItemsPerSection as section, i (section.key)}
          <button class="section-nav-item" type="button" style="--stagger: {i}" onclick={() => goToSection(i + 1)}>
            <span>{section.title}</span>
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

  <!-- Month-to-month navigation: left → previous month, right → next month. -->
  <nav class="month-nav" aria-label={t("month.navAria")}>
    <button
      class="month-nav-btn"
      type="button"
      aria-label={t("month.prevMonth")}
      disabled={!canGoPrevious}
      onclick={() => goToMonth(prevMonthId)}
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
      aria-label={t("month.nextMonth")}
      disabled={!canGoNext}
      onclick={() => goToMonth(nextMonthId)}
    >
      <svg class="month-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  </nav>
  {/if}
</div>

<style>
  .page { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; max-width: 100%; min-width: 0; overflow-x: hidden; }
  @supports (overflow-x: clip) { .page { overflow-x: clip; } }

  .page-header { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; padding-bottom: 1.25rem; border-bottom: 1px solid var(--surface-border); }
  .header-top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-width: 0; }
  .back-btn { display: flex; align-items: center; gap: 0.35rem; text-decoration: none; color: var(--text-tertiary); font-size: 0.85rem; font-weight: 500; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-out); }
  .back-btn:hover { color: var(--text-primary); background: var(--bg-muted); transform: translateX(-3px); }
  .header-titleblock { min-width: 0; }
  .page-title { font-size: 1.55rem; letter-spacing: -0.02em; line-height: 1.2; }
  .page-subtitle { font-size: 0.85rem; color: var(--text-tertiary); margin-top: 0.1rem; }
  .header-actions { display: flex; justify-content: flex-end; margin-top: 0.75rem; }
  .upcoming-daily-notice { margin: 0; padding: 0.75rem 1rem; font-size: 0.8rem; color: var(--text-secondary); background: var(--accent-gold-light); border: 1px solid var(--accent-gold); border-radius: var(--radius-md); }
  .header-side { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .header-side :global(.search-bar),
  .header-side :global(.search-bar-input) { min-width: 0; }
  .save-state { font-size: 0.72rem; font-weight: 600; color: var(--text-tertiary); transition: color var(--dur-base) var(--ease-out); }
  .save-state.saving { color: var(--accent-gold-ink); animation: pulse 1.2s var(--ease-in-out) infinite; }
  .lock-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
    padding: 0.55rem 1rem; font-size: 0.8rem; font-weight: 700;
    color: var(--accent-gold-ink); background: var(--accent-gold-light);
    border: 1px solid color-mix(in srgb, var(--accent-gold) 28%, transparent);
    border-radius: var(--radius-pill); box-shadow: var(--shadow-sm); cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-spring), box-shadow var(--dur-fast) var(--ease-out);
  }
  .lock-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
  .lock-btn.unlocking { color: var(--accent-teal); background: var(--accent-teal-light); border-color: color-mix(in srgb, var(--accent-teal) 30%, transparent); }
  @media (hover: hover) {
    .lock-btn:hover { background: color-mix(in srgb, var(--accent-gold) 20%, transparent); border-color: var(--accent-gold); transform: translateY(-1px); box-shadow: var(--shadow-md); }
    .lock-btn.unlocking:hover { background: color-mix(in srgb, var(--accent-teal) 18%, transparent); border-color: var(--accent-teal); }
  }
  .lock-btn:active { transform: scale(0.97); }
  .lock-btn:focus-visible { outline: var(--focus-outline); outline-offset: 2px; }
  .lock-notice {
    display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem 1rem;
    padding: 1rem 1.25rem; background: var(--accent-gold-light);
    border: 1px solid color-mix(in srgb, var(--accent-gold) 30%, transparent);
    border-radius: var(--radius-md);
  }
  .lock-notice-copy { flex: 1 1 16rem; min-width: 0; }
  .lock-notice strong { font-size: 0.9rem; color: var(--text-primary); }
  .lock-notice p { margin: 0.15rem 0 0; color: var(--text-secondary); font-size: var(--fs-body); }
  .lock-notice .lock-btn { flex-shrink: 0; }

  .summary-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; min-width: 0; }
  .stat-card { min-width: 0; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm); transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out); }
  .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .stat-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); display: block; margin-bottom: 0.5rem; }
  .stat-sub { font-size: 0.78rem; color: var(--text-tertiary); display: block; line-height: 1.5; overflow-wrap: anywhere; }
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
  .stat-card.expense :global(.stat-value) { color: var(--accent-gold-ink); }
  .stat-card.savings :global(.stat-value) { color: var(--accent-blue); }
  .stat-card.split { background: linear-gradient(135deg, var(--accent-teal-light), var(--surface)); border-color: color-mix(in srgb, var(--accent-teal) 35%, transparent); }
  .stat-card.split :global(.stat-value) { color: var(--accent-teal); }
  .stat-card.split.negative :global(.stat-value) { color: var(--danger); }

  .chart-section { min-width: 0; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm); }
  .chart-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
  .chart-title { font-size: 0.9rem; font-weight: 800; color: var(--text-primary); }

  .charts-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; min-width: 0; }

  /* Per-bar entrance rhythm: `--bar-start` waits for the section to settle in,
     `--bar-stagger` walks the bars left to right. Both are inherited by the
     bars and their labels. */
  .bar-chart { display: flex; flex-direction: column; min-width: 0; --bar-start: 160ms; --bar-stagger: 80ms; }
  .bar-chart-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.85rem; }
  .bar-chart-title { font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); }
  .bar-chart-total { font-size: 0.95rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .bar-chart-plot {
    position: relative;
    display: flex; align-items: flex-end; justify-content: space-around;
    gap: 0.75rem; height: 210px; min-width: 0; padding: 0.5rem 0.25rem 0;
  }
  /* The axis draws in from the left while the bars rise. A `border-bottom`
     would be painted at full width straight away, so it is a pseudo-element. */
  .bar-chart-plot::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
    background: var(--surface-border); transform-origin: left; transform: scaleX(1);
    animation: underlineGrow var(--dur-slow) var(--ease-out) backwards;
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
    flex: 1; min-width: 0; height: 100%; max-width: 96px;
    transition: transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out);
  }
  /* Only dim the other columns while one is actually hovered, so moving over the
     empty plot area does not fade the whole chart. */
  /* `:not(:hover)` matters: `:has(.bar-col:hover)` carries the specificity of its
     argument, so a plain `.bar-col` selector here would outrank the hover rule
     below and dim the hovered column too. */
  .bar-chart-plot:has(.bar-col:hover) .bar-col:not(:hover) { opacity: 0.55; }
  .bar-chart-plot .bar-col:hover { opacity: 1; transform: translateY(-3px); }
  .bar-chart-plot:has(.bar-col.active) .bar-col:not(.active) { opacity: 0.55; }
  .bar-chart-plot .bar-col.active { opacity: 1; transform: translateY(-3px); }
  .bar-col.active .bar-seg { filter: brightness(1.07) saturate(1.06); }
  .bar-col-track { position: relative; width: 100%; height: 100%; display: flex; align-items: flex-end; justify-content: center; }

  .bar-chart-labels {
    display: flex; justify-content: space-around;
    gap: 0.75rem; min-width: 0; padding: 0 0.25rem; margin-top: 0.55rem;
  }
  .bar-label {
    flex: 1; min-width: 0; max-width: 96px; overflow-wrap: anywhere;
    font-size: 0.74rem; font-weight: 600;
    color: var(--text-tertiary); text-align: center; line-height: 1.25;
    animation: barTextIn var(--dur-base) var(--ease-out) backwards;
    animation-delay: calc(var(--bar-index, 0) * var(--bar-stagger) + var(--bar-start) + 120ms);
  }
  .bar-label.combined { color: var(--text-primary); font-weight: 800; }

  .bar-stack {
    width: 100%; max-width: 62px; min-height: 3px;
    display: flex; flex-direction: column;
    position: relative; transition: height var(--dur-slower) var(--ease-in-out);
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
    transition: height var(--dur-slower) var(--ease-in-out), filter var(--dur-base) var(--ease-out);
  }
  .bar-col:hover .bar-seg { filter: brightness(1.07) saturate(1.06); }
  .bar-seg.blue { background: linear-gradient(180deg, var(--accent-blue), color-mix(in srgb, var(--accent-blue), var(--text-primary) 18%)); }
  .bar-seg.rose { background: linear-gradient(180deg, var(--accent-rose), color-mix(in srgb, var(--accent-rose), var(--text-primary) 18%)); }

  /* Value of a single source, drawn inside its own coloured segment. Kept short
     (compact notation) and shrunk to the strip width so it never gets clipped. */
  .bar-seg-value {
    font-size: 0.66rem; font-weight: 700; color: #fff;
    max-width: 100%; padding: 0 0.15rem;
    overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; font-variant-numeric: tabular-nums;
    pointer-events: none; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    animation: barTextIn var(--dur-base) var(--ease-out) backwards;
    animation-delay: calc(
      var(--bar-index, 0) * var(--bar-stagger) + var(--bar-start) + var(--dur-slower) + 60ms
    );
  }
  @container barseg (max-height: 1.2rem) {
    .bar-seg-value { display: none; }
  }

  .bar-value {
    position: absolute; bottom: calc(100% + 0.15rem); left: 50%; transform: translateX(-50%);
    font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
    white-space: nowrap; font-variant-numeric: tabular-nums;
    pointer-events: none;
    animation: barTextIn var(--dur-base) var(--ease-out) backwards;
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

  .sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; min-width: 0; align-items: start; }

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
    padding: 0.6rem 1.15rem; border-radius: var(--radius-pill);
    border: 1px solid var(--surface-border); background: var(--surface);
    color: var(--text-secondary); font-size: 0.82rem; font-weight: 600;
    cursor: pointer; box-shadow: var(--shadow-sm);
    transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
  }
  .clear-filter-btn:hover {
    background: var(--accent-gold-light); color: var(--text-primary); border-color: var(--accent-gold);
  }
  .clear-filter-icon { width: 1rem; height: 1rem; flex-shrink: 0; }

  /* ── Mobile quick section navigation ──────────────────────────────────── */
  /* Full-width, pointer-transparent anchor: positioning the FAB and menu against
     the viewport (not a shrink-to-fit box) keeps them inside it on phones with
     safe-area insets or a visible scrollbar. */
  .section-nav {
    display: none;
    position: fixed;
    inset: auto 0 0;
    height: calc(3.4rem + 1rem + env(safe-area-inset-bottom, 0px));
    z-index: var(--z-overlay);
    pointer-events: none;
  }

  .section-nav-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-behind);
    background: var(--scrim-soft);
    backdrop-filter: blur(2px);
    border: none;
    padding: 0;
    cursor: default;
    touch-action: none;
    pointer-events: auto;
  }

  .section-nav-menu {
    position: absolute;
    right: calc(1rem + env(safe-area-inset-right, 0px));
    bottom: calc(3.4rem + 1.75rem + env(safe-area-inset-bottom, 0px));
    z-index: var(--z-raised);
    width: min(19rem, calc(100% - 2rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
    pointer-events: auto;
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

  /* Month switcher inside the section menu: a muted segmented row with the two
     arrows framing the current period. The menu floats over the page, so this
     is the only month control reachable without scrolling to the bottom nav. */
  .section-nav-month {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.3rem;
    padding: 0.3rem;
    background: var(--bg-muted);
    border-radius: var(--radius-md);
  }
  .section-nav-month-btn {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 2.15rem;
    height: 2.15rem;
    border-radius: var(--radius-circle);
    border: 1px solid transparent;
    background: var(--surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
    transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-spring);
  }
  .section-nav-month-btn svg { display: block; width: 1.05rem; height: 1.05rem; }
  .section-nav-month-btn:hover:not(:disabled) { color: var(--accent-gold-ink); border-color: var(--accent-gold); transform: scale(1.06); }
  .section-nav-month-btn:active:not(:disabled) { transform: scale(0.94); }
  .section-nav-month-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .section-nav-month-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    flex: 1;
    min-width: 0;
    font-family: var(--font-serif);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-primary);
  }
  .section-nav-month-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .section-nav-month-dot {
    flex-shrink: 0;
    width: 0.38rem;
    height: 0.38rem;
    border-radius: var(--radius-circle);
    background: var(--success);
    box-shadow: 0 0 0 2px var(--success-light);
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
    animation: riseIn var(--dur-base) var(--ease-out) backwards;
    /* Delay comes from the item index (`--stagger`), not `nth-child`: the menu
       also holds the month switcher and the title above the list. */
    animation-delay: calc(var(--stagger, 0) * 0.03s);
    transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), padding-left var(--dur-base) var(--ease-out);
  }
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
    transition: transform var(--dur-base) var(--ease-out), color var(--dur-fast) var(--ease-out);
  }
  .section-nav-item:hover .section-nav-chevron { color: var(--accent-gold-ink); transform: translateX(3px); }

  .section-nav-fab {
    position: absolute;
    right: calc(1rem + env(safe-area-inset-right, 0px));
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    z-index: var(--z-raised);
    pointer-events: auto;
    display: grid;
    place-items: center;
    width: 3.4rem;
    height: 3.4rem;
    border-radius: var(--radius-circle);
    color: var(--on-accent);
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-rose));
    box-shadow: var(--shadow-fab);
    transition: transform var(--dur-base) var(--ease-spring), box-shadow var(--dur-base) var(--ease-out);
  }
  .section-nav-fab:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: var(--shadow-fab-hover);
  }
  .section-nav-fab:active { transform: scale(0.96); }
  .section-nav-fab:focus-visible { outline: var(--focus-outline); outline-offset: 3px; }
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
    border-radius: var(--radius-circle);
    border: 1px solid var(--surface-border);
    background: var(--bg);
    color: var(--text-primary);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-spring);
  }
  /* Both arrows are the same SVG so the two buttons stay pixel-identical. */
  .month-nav-icon { width: 1.15rem; height: 1.15rem; display: block; }
  .month-nav-btn:hover:not(:disabled) {
    background: var(--bg-muted);
    color: var(--accent-gold-ink);
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
    font-family: var(--font-serif);
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
  .month-nav-dot {
    flex-shrink: 0;
    width: 0.42rem;
    height: 0.42rem;
    border-radius: var(--radius-circle);
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
    .header-actions { justify-content: stretch; }
    .header-actions > button { width: 100%; }
    .section-nav { display: block; }
    .summary-row { grid-template-columns: 1fr; }
    .charts-grid { grid-template-columns: minmax(0, 1fr); gap: 1.25rem; }
    .chart-section { padding: 1rem 0.85rem; }
    .bar-chart-plot { height: 180px; gap: 0.25rem; padding-left: 0; padding-right: 0; }
    .bar-chart-labels { gap: 0.25rem; padding-left: 0; padding-right: 0; }
    .bar-col { max-width: none; }
    .bar-label { max-width: none; font-size: 0.66rem; }
    .bar-value { font-size: 0.52rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
    .back-text { display: none; }
    .back-btn { padding: 0.4rem 0.5rem; font-size: 1rem; }
    .save-state { display: none; }
    .page-title { font-size: 1.3rem; }
    .month-nav { gap: 0.4rem; }
    .month-nav-btn { width: 2.3rem; height: 2.3rem; }
    .month-nav-label { max-width: 11rem; padding: 0 0.35rem; }
    .month-nav-month { font-size: 0.92rem; }
    .month-nav-range { font-size: 0.62rem; }
  }
</style>
