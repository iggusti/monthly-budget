<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { fade, fly, slide } from "svelte/transition";
  import ExpenseSection from "#lib/components/ExpenseSection.svelte";
  import { subscribeBudget, saveBudget } from "#lib/budget-store";
  import {
    computeTotals,
    createEmptyBudget,
    formatCurrency,
    type MonthBudget,
    type ExpenseItem
  } from "#lib/types";
  import { isAuthenticated } from "#lib/auth";
  import { t } from "#lib/i18n.svelte";
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

  // Donut segments as fractions of total income (clamped to sum to 100%).
  const chartSegments = $derived(() => {
    const income = totals.totalIncome || 1;
    const fixed = Math.max(totals.totalFixedExpenses, 0);
    const salary = Math.max(dailyFromSalaryTotal, 0);
    const remaining = Math.max(income - fixed - salary, 0);
    const total = income;
    return [
      { key: "fixed", label: t("month.chartFixed"), value: fixed, frac: fixed / total, color: "var(--accent-gold)" },
      { key: "salary", label: t("month.chartSalary"), value: salary, frac: salary / total, color: "var(--accent-rose)" },
      { key: "remaining", label: t("month.chartRemaining"), value: remaining, frac: remaining / total, color: "var(--accent-teal)" }
    ];
  });
  // Donut geometry constants.
  const DONUT_R = 48;
  const DONUT_C = 2 * Math.PI * DONUT_R;

  // Cumulative fractions for drawing the ring.
  const chartCumulative = $derived(() => {
    let acc = 0;
    return chartSegments().map((seg) => {
      const start = acc;
      acc += seg.frac;
      return { ...seg, start };
    });
  });

  onMount(() => {
    if (!isAuthenticated()) {
      location.href = "/login";
      return;
    }
    if (!monthId) return;

    // If navigating directly to a month other than the default, start from a
    // correctly-titled empty budget until the live data arrives.
    if (budget.id !== monthId) {
      budget = createEmptyBudget(monthId);
    }

    // Live-sync: when the other spouse (or this device) edits this budget in
    // Firestore, update locally immediately — no reload needed.
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
      <div class="chart-body" style="margin-top:1.1rem">
        <Skeleton circle size={190} />
        <div class="chart-legend">
          {#each Array(3) as _}
            <div class="legend-row">
              <Skeleton width="14px" height="14px" radius="4px" />
              <Skeleton width="120px" height="0.82rem" />
              <Skeleton width="90px" height="0.85rem" />
            </div>
          {/each}
        </div>
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

    <div class="chart-body">
      <!-- Donut ring -->
      <div class="chart-donut">
        <svg viewBox="0 0 120 120" width="190" height="190" role="img" aria-label={t("month.chartDonutAria")}>
          {#each chartCumulative() as seg, i}
            {@const dash = seg.frac * DONUT_C}
            {@const offset = -seg.start * DONUT_C}
            <circle
              cx="60" cy="60" r={DONUT_R}
              fill="none"
              stroke={seg.color}
              stroke-width="18"
              stroke-linecap="butt"
              stroke-dasharray={`${dash} ${DONUT_C - dash}`}
              stroke-dashoffset={offset}
              transform="rotate(-90 60 60)"
              style:transition={`stroke-dashoffset 0.8s ease, stroke-dasharray 0.8s ease`}
              style:opacity={i === 0 ? "1" : "1"}
            />
          {/each}
          <text x="60" y="56" text-anchor="middle" class="donut-value">{formatCurrency(totals.totalIncome)}</text>
          <text x="60" y="72" text-anchor="middle" class="donut-label">{t("month.totalIncomeLabel")}</text>
        </svg>
      </div>

      <!-- Legend -->
      <div class="chart-legend">
        {#each chartSegments() as seg}
          <div class="legend-row" title={formatCurrency(seg.value)}>
            <span class="legend-dot" style:background={seg.color}></span>
            <span class="legend-label">{seg.label}</span>
            <span class="legend-value">{formatCurrency(seg.value)}</span>
          </div>
          {#if seg.key === "fixed"}
            <div class="legend-split">
              <span class="legend-split-label">{t("common.husband")}</span>
              <span class="legend-split-value blue">{formatCurrency(totals.husbandFixedTotal)}</span>
              <span class="legend-split-sep">·</span>
              <span class="legend-split-label">{t("common.wife")}</span>
              <span class="legend-split-value rose">{formatCurrency(totals.wifeFixedTotal)}</span>
            </div>
          {/if}
          {#if seg.key === "salary"}
            <div class="legend-split">
              <span class="legend-split-label">{t("common.husband")}</span>
              <span class="legend-split-value blue">{formatCurrency(totals.husbandDailyFromSalaryTotal)}</span>
              <span class="legend-split-sep">·</span>
              <span class="legend-split-label">{t("common.wife")}</span>
              <span class="legend-split-value rose">{formatCurrency(totals.wifeDailyFromSalaryTotal)}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Daily from savings: separate block, funded from savings (not income) -->
    <div class="chart-savings">
      <div class="savings-head">
        <span class="savings-icon">🏦</span>
        <span class="savings-title">{t("month.dailyFromSavings")}</span>
        <span class="savings-value">{formatCurrency(dailyFromSavingsTotal)}</span>
      </div>
      <div class="savings-bar">
        <span class="savings-fill" style:width={`${Math.min((dailyFromSavingsTotal / (totals.totalIncome || 1)) * 100, 100)}%`}></span>
      </div>
      <div class="savings-split">
        <div class="split-person">
          <span class="split-person-label">{t("common.husband")}</span>
          <span class="split-person-value blue">{formatCurrency(totals.husbandDailyFromSavingsTotal)}</span>
        </div>
        <div class="split-person">
          <span class="split-person-label">{t("common.wife")}</span>
          <span class="split-person-value rose">{formatCurrency(totals.wifeDailyFromSavingsTotal)}</span>
        </div>
      </div>
      <p class="savings-note">
        {t("month.savingsNote")}
      </p>
    </div>

    <div class="chart-note">
      <span class="chart-note-icon">💡</span>
      <span>
        {t("month.chartNoteStart", { income: formatCurrency(totals.totalIncome) })}
        <strong>{t("month.chartNoteAmount", { perPerson: formatCurrency(totals.equalSplitAmount) })}</strong>
        {t("month.chartNoteEnd")}
      </span>
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

  .chart-body { display: flex; align-items: center; gap: 1.75rem; flex-wrap: wrap; }

  .chart-donut { flex-shrink: 0; margin: 0 auto; }
  .donut-value { font-size: 13px; font-weight: 800; fill: var(--text-primary); }
  .donut-label { font-size: 7px; font-weight: 600; letter-spacing: 0.04em; fill: var(--text-tertiary); text-transform: uppercase; }

  .chart-legend { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 0.6rem; }
  .legend-row { display: grid; grid-template-columns: 14px 1fr auto; align-items: center; gap: 0.6rem; }
  .legend-dot { width: 14px; height: 14px; border-radius: 4px; }
  .legend-label { font-size: 0.82rem; color: var(--text-secondary); }
  .legend-value { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; }
  .legend-split { display: flex; align-items: center; gap: 0.4rem; padding-left: 1.25rem; font-size: 0.78rem; color: var(--text-tertiary); }
  .legend-split-label { color: var(--text-tertiary); }
  .legend-split-value { font-weight: 700; }
  .legend-split-value.blue { color: var(--accent-blue); }
  .legend-split-value.rose { color: var(--accent-rose); }
  .legend-split-sep { color: var(--text-tertiary); }

  .chart-savings { margin-top: 1.1rem; padding: 0.9rem 1rem; background: var(--accent-blue-light); border-radius: var(--radius-md); }
  .savings-head { display: flex; align-items: center; gap: 0.6rem; }
  .savings-icon { font-size: 1.1rem; }
  .savings-title { font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); flex: 1; }
  .savings-value { font-size: 0.95rem; font-weight: 800; color: var(--accent-blue); }
  .savings-bar { height: 8px; background: rgba(107, 127, 163, 0.15); border-radius: 99px; overflow: hidden; margin-top: 0.6rem; }
  .savings-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #5a7090); border-radius: 99px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
  .savings-note { font-size: 0.74rem; color: var(--text-tertiary); margin-top: 0.5rem; }
  .savings-split { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.7rem; }
  .split-person { display: flex; align-items: baseline; justify-content: space-between; gap: 0.4rem; background: var(--surface); border-radius: var(--radius-sm); padding: 0.4rem 0.6rem; }
  .split-person-label { font-size: 0.72rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
  .split-person-value { font-size: 0.9rem; font-weight: 800; font-variant-numeric: tabular-nums; }
  .split-person-value.blue { color: var(--accent-blue); }
  .split-person-value.rose { color: var(--accent-rose); }

  .chart-note { display: flex; gap: 0.6rem; margin-top: 1.25rem; padding: 0.85rem 1rem; background: var(--bg-muted); border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; }
  .chart-note-icon { font-size: 1.1rem; flex-shrink: 0; }
  .chart-note strong { color: var(--text-primary); }

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

  @media (max-width: 1000px) {
    .summary-row { grid-template-columns: repeat(2, 1fr); }
    .sections { grid-template-columns: 1fr; }
  }

  @media (max-width: 768px) {
    .page { padding-bottom: calc(3.5rem + env(safe-area-inset-bottom, 0px)); }
    .section-nav { display: block; }
    .summary-row { grid-template-columns: 1fr; }
    .income-fields { grid-template-columns: 1fr; }
    .chart-body { flex-direction: column; gap: 1.25rem; }
    .chart-legend { width: 100%; }

    /* Stack the spouse split vertically on small screens. */
    .savings-split { grid-template-columns: 1fr; }
    .back-text { display: none; }
    .back-btn { padding: 0.4rem 0.5rem; font-size: 1rem; }
    .save-state { display: none; }
    .page-title { font-size: 1.3rem; }
    .edit-btn { padding: 0.45rem 0.85rem; font-size: 0.75rem; }
  }
</style>
