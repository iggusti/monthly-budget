<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { fade, fly, slide } from "svelte/transition";
  import ExpenseSection from "#lib/components/ExpenseSection.svelte";
  import { fetchBudget, saveBudget } from "#lib/budget-store";
  import {
    computeTotals,
    createEmptyBudget,
    formatCurrency,
    type MonthBudget,
    type ExpenseItem
  } from "#lib/types";
  import { isAuthenticated } from "#lib/auth";

  const monthId = $derived(page.params.id ?? "");

  let budget = $state<MonthBudget>(createEmptyBudget("2026-01"));
  let loading = $state(true);
  let saving = $state(false);
  let savedAt = $state<string>("");
  let showHeaderEditor = $state(false);

  let headerDraft = $state({ title: "", period: "" });

  const totals = $derived(computeTotals(budget));

  onMount(async () => {
    if (!isAuthenticated()) {
      location.href = "/login";
      return;
    }
    if (!monthId) return;
    budget = await fetchBudget(monthId);
    headerDraft = { title: budget.title, period: budget.period };
    loading = false;
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

<svelte:head>
  <title>{budget.title} — Family Budget Harmony</title>
</svelte:head>

<div class="page">
  <div class="page-header" in:fade={{ duration: 350 }}>
    <a href="/" class="back-btn">← <span>All months</span></a>
    <div class="header-meta">
      <h1 class="page-title">{budget.title}</h1>
      <p class="page-subtitle">{budget.period}</p>
    </div>
    <div class="header-side">
      <span class="save-state" class:saving>
        {#if loading}Loading…{:else if saving}Saving…{:else if savedAt}Saved {savedAt}{:else}Editable{/if}
      </span>
      <button class="edit-btn" onclick={openHeaderEditor}>✎ Edit header</button>
    </div>
  </div>

  {#if showHeaderEditor}
    <div class="income-panel" in:slide={{ duration: 220 }}>
      <div class="income-fields">
        <label class="field">
          <span>Title</span>
          <input type="text" bind:value={headerDraft.title} />
        </label>
        <label class="field">
          <span>Budget period</span>
          <input type="text" bind:value={headerDraft.period} />
        </label>
      </div>
      <div class="income-actions">
        <button class="btn-save" onclick={saveHeader}>Save changes</button>
        <button class="btn-cancel" onclick={() => (showHeaderEditor = false)}>Cancel</button>
      </div>
    </div>
  {/if}

  <div class="summary-row" in:fly={{ y: 14, duration: 420, delay: 60 }}>
    <div class="stat-card income">
      <span class="stat-label">Total Income</span>
      <span class="stat-value">{formatCurrency(totals.totalIncome)}</span>
      <span class="stat-sub">
        Husband {formatCurrency(budget.husbandIncome)} · Wife {formatCurrency(budget.wifeIncome)}
      </span>
    </div>
    <div class="stat-card expense">
      <span class="stat-label">Total Fixed Expenses</span>
      <span class="stat-value">{formatCurrency(totals.totalFixedExpenses)}</span>
      <span class="stat-sub">
        Husband {formatCurrency(totals.husbandFixedTotal)} · Wife {formatCurrency(totals.wifeFixedTotal)}
      </span>
    </div>
    <div class="stat-card balance" class:negative={totals.balanceAfterFixed < 0}>
      <span class="stat-label">Balance after Fixed Expenses</span>
      <span class="stat-value">{formatCurrency(totals.balanceAfterFixed)}</span>
      <span class="stat-sub">
        Fixed used {totals.usedPercentFixed}% of income
      </span>
    </div>
    <div class="stat-card split" class:negative={totals.equalSplitTransfer < 0}>
      <span class="stat-label">Equal Split Transfer</span>
      <span class="stat-value">{formatCurrency(Math.abs(totals.equalSplitTransfer))}</span>
      <span class="stat-sub">
        {#if totals.equalSplitTransfer >= 0}Husband → Wife{:else}Wife → Husband{/if}
        · each holds {formatCurrency(totals.equalSplitAmount)} after fixed
      </span>
    </div>
  </div>

  <div class="progress-section" in:fly={{ y: 12, duration: 420, delay: 100 }}>
    <div class="progress-header">
      <span class="progress-label">Budget utilisation</span>
      <span class="progress-pct" style:color={totals.usedPercentFixed > 100 ? "var(--danger)" : totals.usedPercentFixed > 80 ? "var(--accent-gold)" : "var(--success)"}>
        {totals.usedPercentFixed}%
      </span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style:width={`${Math.min(totals.usedPercentFixed, 100)}%`} style:background={totals.usedPercentFixed > 100 ? "var(--danger)" : totals.usedPercentFixed > 80 ? "var(--accent-gold)" : "var(--success)"}></div>
    </div>
    <div class="progress-detail">
      <span>Income {formatCurrency(totals.totalIncome)}</span>
      <span>Fixed {formatCurrency(totals.totalFixedExpenses)}</span>
    </div>
  </div>

  <div class="sections" in:fade={{ duration: 350, delay: 120 }}>
    <ExpenseSection
      title="1. Husband Income"
      badge="♂"
      tone="blue"
      nameLabel="Source"
      items={[{ id: "husband-income", name: "Husband monthly income", amount: budget.husbandIncome }]}
      onChange={(items: ExpenseItem[]) => update("husbandIncome", items[0]?.amount ?? 0)}
    />

    <ExpenseSection
      title="2. Wife Income"
      badge="♀"
      tone="rose"
      nameLabel="Source"
      items={[{ id: "wife-income", name: "Wife monthly income", amount: budget.wifeIncome }]}
      onChange={(items: ExpenseItem[]) => update("wifeIncome", items[0]?.amount ?? 0)}
    />

    <ExpenseSection
      title="3. Husband Fixed Expenses"
      badge="♂"
      tone="blue"
      checkboxable
      items={budget.husbandFixed}
      onChange={(items: ExpenseItem[]) => update("husbandFixed", items)}
      footerLabel="Husband fixed — left"
    />
    <ExpenseSection
      title="4. Wife Fixed Expenses"
      badge="♀"
      tone="rose"
      checkboxable
      items={budget.wifeFixed}
      onChange={(items: ExpenseItem[]) => update("wifeFixed", items)}
      footerLabel="Wife fixed — left"
    />

    <ExpenseSection
      title="5. Husband Daily Expenses (from salary)"
      badge="○"
      tone="gold"
      items={budget.husbandDailyFromSalary}
      withMethod
      onChange={(items: ExpenseItem[]) =>
        update(
          "husbandDailyFromSalary",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "" }))
        )}
      footerLabel="Subtotal from salary"
      footerValue={totals.husbandDailyFromSalaryTotal}
    />

    <ExpenseSection
      title="6. Husband Daily Expenses (from savings)"
      badge="↓"
      tone="teal"
      items={budget.husbandDailyFromSavings}
      withMethod
      onChange={(items: ExpenseItem[]) =>
        update(
          "husbandDailyFromSavings",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "" }))
        )}
      footerLabel="Subtotal from savings"
      footerValue={totals.husbandDailyFromSavingsTotal}
    />

    <ExpenseSection
      title="7. Wife Daily Expenses (from salary)"
      badge="○"
      tone="rose"
      items={budget.wifeDailyFromSalary}
      withMethod
      onChange={(items: ExpenseItem[]) =>
        update(
          "wifeDailyFromSalary",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "" }))
        )}
      footerLabel="Subtotal from salary"
      footerValue={totals.wifeDailyFromSalaryTotal}
    />

    <ExpenseSection
      title="8. Wife Daily Expenses (from savings)"
      badge="↓"
      tone="teal"
      items={budget.wifeDailyFromSavings}
      withMethod
      onChange={(items: ExpenseItem[]) =>
        update(
          "wifeDailyFromSavings",
          items.map((item: ExpenseItem) => ({ id: item.id, name: item.name, amount: item.amount, method: item.method ?? "" }))
        )}
      footerLabel="Subtotal from savings"
      footerValue={totals.wifeDailyFromSavingsTotal}
    />
  </div>
</div>

<style>
  .page { display: flex; flex-direction: column; gap: 1.5rem; }

  .page-header { display: flex; align-items: center; gap: 1rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--surface-border); flex-wrap: wrap; }
  .back-btn { display: flex; align-items: center; gap: 0.35rem; text-decoration: none; color: var(--text-tertiary); font-size: 0.85rem; font-weight: 500; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); transition: all 0.2s; }
  .back-btn:hover { color: var(--text-primary); background: var(--bg-muted); }
  .header-meta { flex: 1; min-width: 180px; }
  .page-title { font-size: 1.55rem; letter-spacing: -0.02em; }
  .page-subtitle { font-size: 0.85rem; color: var(--text-tertiary); margin-top: 0.1rem; }
  .header-side { display: flex; align-items: center; gap: 0.75rem; }
  .save-state { font-size: 0.72rem; font-weight: 600; color: var(--text-tertiary); }
  .save-state.saving { color: var(--accent-gold); }
  .edit-btn { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 600; color: var(--accent-gold); background: var(--accent-gold-light); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: 1px solid rgba(200, 149, 108, 0.2); }
  .edit-btn:hover { background: rgba(200, 149, 108, 0.2); }

  .income-panel { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-md); }
  .income-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field span { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
  .field input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--bg); font-size: 0.875rem; color: var(--text-primary); }
  .field input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(200, 149, 108, 0.15); }
  .income-actions { display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 1rem; }
  .btn-save { padding: 0.55rem 1.15rem; border-radius: var(--radius-sm); background: var(--text-primary); color: white; font-size: 0.825rem; font-weight: 600; }
  .btn-save:hover { background: #2d2a27; }
  .btn-cancel { padding: 0.55rem 1.15rem; border-radius: var(--radius-sm); background: transparent; border: 1px solid var(--surface-border); color: var(--text-secondary); font-size: 0.825rem; font-weight: 600; }
  .btn-cancel:hover { background: var(--bg-muted); }

  .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm); }
  .stat-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); display: block; margin-bottom: 0.5rem; }
  .stat-value { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; display: block; margin-bottom: 0.4rem; }
  .stat-sub { font-size: 0.78rem; color: var(--text-tertiary); display: block; line-height: 1.5; }
  .stat-card.income .stat-value { color: var(--success); }
  .stat-card.expense .stat-value { color: var(--accent-gold); }
  .stat-card.balance.negative .stat-value { color: var(--danger); }
  .stat-card.split { background: linear-gradient(135deg, var(--accent-teal-light), #ffffff); border-color: rgba(91, 138, 138, 0.35); }
  .stat-card.split .stat-value { color: var(--accent-teal); }
  .stat-card.split.negative .stat-value { color: var(--danger); }

  .progress-section { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 1.1rem 1.5rem; box-shadow: var(--shadow-sm); }
  .progress-header { display: flex; justify-content: space-between; margin-bottom: 0.65rem; }
  .progress-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
  .progress-pct { font-size: 0.85rem; font-weight: 700; }
  .progress-track { height: 6px; background: var(--bg-muted); border-radius: 99px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 99px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
  .progress-detail { display: flex; justify-content: space-between; margin-top: 0.4rem; font-size: 0.72rem; color: var(--text-tertiary); }

  .sections { display: flex; flex-direction: column; gap: 1rem; }

  @media (max-width: 1000px) {
    .summary-row { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 768px) {
    .summary-row { grid-template-columns: 1fr; }
    .income-fields { grid-template-columns: 1fr; }
  }
</style>
