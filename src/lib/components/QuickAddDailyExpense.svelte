<script lang="ts">
  /**
   * Compact "add daily expense" sheet for the dashboard.
   *
   * The parent owns the budget: this component only collects a destination,
   * amount, payment method and date, then hands a complete item to `onSave`.
   * It closes only after that promise resolves true, so a failed write keeps
   * the typed data available for a retry.
   */
  import { untrack } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { MOTION, motionFade, motionFly } from "#lib/motion";
  import {
    daysBetween,
    makeId,
    parseISODate,
    todayISO,
    toISODate,
    type DailyExpense,
    type DailySectionKey
  } from "#lib/types";
  import { channelsFor, DAILY_METHOD_DEFAULTS, joinMethod } from "#lib/expense-methods";
  import { periodDateCeiling, periodDateRange, periodQuickDates } from "#lib/period";
  import BadgeIcon from "#lib/components/BadgeIcon.svelte";
  import { lang, t } from "#lib/i18n.svelte";

  interface Props {
    /** Human label of the period receiving the entry, e.g. "November 2026". */
    month: string;
    /** Period id (`YYYY-MM`) used to keep custom dates inside this cycle. */
    periodId?: string;
    onClose: () => void;
    /** Returns false when the save failed (the sheet then stays open). */
    onSave: (sectionKey: DailySectionKey, item: DailyExpense) => Promise<boolean>;
  }

  let { month, periodId, onClose, onSave }: Props = $props();

  /**
   * The four daily buckets, in the same order as sections 5–8 of a month.
   * The icons match those sections' badges: wallet for salary, savings for
   * withdrawals, with the same blue/rose tone per person.
   */
  const destinations: {
    key: DailySectionKey;
    label: string;
    person: "husband" | "wife";
    icon: "wallet" | "savings";
  }[] = $derived([
    { key: "husbandDailyFromSalary", label: `${t("common.husband")} · ${t("common.salary")}`, person: "husband", icon: "wallet" },
    { key: "husbandDailyFromSavings", label: `${t("common.husband")} · ${t("common.savings")}`, person: "husband", icon: "savings" },
    { key: "wifeDailyFromSalary", label: `${t("common.wife")} · ${t("common.salary")}`, person: "wife", icon: "wallet" },
    { key: "wifeDailyFromSavings", label: `${t("common.wife")} · ${t("common.savings")}`, person: "wife", icon: "savings" }
  ]);

  const methodBases = $derived([
    { value: "qris", label: t("expense.methodQris") },
    { value: "transfer", label: t("expense.methodTransfer") },
    { value: "cash", label: t("expense.methodCash") }
  ]);

  const periodRange = $derived(periodId ? periodDateRange(periodId) : null);
  const today = $derived(todayISO());
  const dateFloor = $derived(periodRange?.start ?? toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 3)));
  const dateCeiling = $derived(periodId ? periodDateCeiling(periodId) : today);
  const isPastPeriod = $derived(periodRange ? periodRange.end < today : false);

  /** Original chip labels, but the list stops at the period's 25th start. */
  const dateOptions = $derived(
    (periodId ? periodQuickDates(periodId) : [todayISO()]).map((value, offset) => ({
      value,
      relative: offset === 0
        ? t("expense.dateToday")
        : offset === 1
          ? t("expense.dateYesterday")
          : t("expense.daysAgo", { n: offset })
    }))
  );

  /** Date descriptions, worded and formatted like the month page's editor. */
  function formatFullDate(value: string | undefined): string {
    const date = parseISODate(value);
    if (!date) return "";
    return date.toLocaleDateString(lang.value === "id" ? "id-ID" : "en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function relativeLabel(value: string | undefined): string {
    const date = parseISODate(value);
    if (!date) return t("expense.noDate");
    const diff = daysBetween(date, new Date());
    if (diff === 0) return t("expense.dateToday");
    if (diff === 1) return t("expense.dateYesterday");
    if (diff > 1) return t("expense.daysAgo", { n: diff });
    return formatFullDate(value);
  }

  /** The section preselected when the sheet opens (section 5 on the month page). */
  const DEFAULT_SECTION: DailySectionKey = "husbandDailyFromSalary";

  let sectionKey = $state<DailySectionKey>(DEFAULT_SECTION);
  let name = $state("");
  let amountInput = $state("");
  // Open with the same preset the month page uses for that section.
  let methodBase = $state(DAILY_METHOD_DEFAULTS[DEFAULT_SECTION].base);
  let methodChannel = $state(DAILY_METHOD_DEFAULTS[DEFAULT_SECTION].channel);
  let date = $state(untrack(() => (periodId ? periodDateCeiling(periodId) : todayISO())));
  let saving = $state(false);

  const channelOptions = $derived(channelsFor(methodBase));
  const channelLabel = $derived(
    methodBase === "cash" ? t("expense.methodChannelBank") : t("expense.methodChannel")
  );
  const amount = $derived(Number(amountInput.replace(/\D/g, "")) || 0);

  const hasName = $derived(name.trim().length > 0);
  const hasAmount = $derived(amount > 0);
  const canCommit = $derived(hasName && hasAmount);

  /** Focus the first field without letting the browser jump the page. */
  function focusName(node: HTMLInputElement) {
    node.focus({ preventScroll: true });
  }

  /** Keep grouped digits in the input while storing a plain number. */
  function onAmountInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const digits = input.value.replace(/\D/g, "");
    amountInput = digits ? Number(digits).toLocaleString("id-ID") : "";
    input.value = amountInput;
  }

  /** Drop a channel that is not offered by the newly chosen method. */
  function onMethodBaseChange() {
    if (!channelOptions.includes(methodChannel)) methodChannel = "";
  }

  /**
   * Changing the destination also applies that section's method preset, so
   * the bank/e-wallet default is exactly the one used on the month page.
   */
  function pickSection(key: DailySectionKey) {
    sectionKey = key;
    const preset = DAILY_METHOD_DEFAULTS[key];
    methodBase = preset.base;
    methodChannel = preset.channel;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canCommit || saving) return;
    const trimmed = name.trim();

    const base = methodBases.find((option) => option.value === methodBase)?.label ?? "";
    const channel = channelOptions.includes(methodChannel) ? methodChannel : "";
    const item: DailyExpense = {
      id: makeId(),
      name: trimmed,
      amount,
      method: joinMethod(base, channel),
      date
    };

    saving = true;
    const saved = await onSave(sectionKey, item);
    saving = false;
    if (saved) onClose();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  // ── Keyboard-safe sheet ─────────────────────────────────────────────────────
  // A phone keyboard only shows up as a smaller visual viewport. Lift the
  // sheet by that difference and scroll the focused field inside the sheet;
  // the browser's own reveal runs before the keyboard has animated in.

  let dialogEl = $state<HTMLElement | null>(null);

  function keyboardInset(): number {
    const viewport = window.visualViewport;
    if (!viewport) return 0;
    return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
  }

  function keepFieldVisible() {
    if (!dialogEl) return;
    dialogEl.style.setProperty("--sheet-keyboard", `${keyboardInset()}px`);

    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !dialogEl.contains(active)) return;
    const body = dialogEl.querySelector<HTMLElement>(".sheet-body");
    if (!body) return;

    const field = active.getBoundingClientRect();
    const box = body.getBoundingClientRect();
    if (field.bottom > box.bottom - 8) body.scrollTop += field.bottom - box.bottom + 8;
    else if (field.top < box.top + 8) body.scrollTop -= box.top + 8 - field.top;
  }

  $effect(() => {
    if (typeof window === "undefined" || !dialogEl) return;
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", keepFieldVisible);
    keepFieldVisible();
    return () => viewport?.removeEventListener("resize", keepFieldVisible);
  });
</script>

<svelte:window onkeydown={onKeydown} onfocusin={keepFieldVisible} />

<div class="sheet-overlay" role="presentation" transition:fade={motionFade(MOTION.fast)}>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={t("dashboard.quickAdd")}
    bind:this={dialogEl}
    transition:fly={motionFly(20, MOTION.fast)}
  >
    <div class="sheet-head">
      <div class="head-text">
        <h2 class="sheet-title">{t("dashboard.quickAdd")}</h2>
        <p class="sheet-sub">{t("dashboard.quickAddFor", { month })}</p>
      </div>
      <button class="close-btn" type="button" aria-label={t("common.close")} onclick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <!-- `min`/`max` only guide the native picker; `novalidate` keeps a typed
         date from silently blocking the submit handler. -->
    <form class="sheet-body" onsubmit={submit} novalidate>
      <div>
        <span class="group-label">{t("dashboard.quickAddTarget")}</span>
        <div class="destinations" role="group" aria-label={t("dashboard.quickAddTarget")}>
          {#each destinations as option (option.key)}
            <button
              class="destination"
              class:rose={option.person === "wife"}
              class:active={sectionKey === option.key}
              type="button"
              aria-pressed={sectionKey === option.key}
              onclick={() => pickSection(option.key)}
            >
              <span class="destination-icon" aria-hidden="true">
                <BadgeIcon name={option.icon} />
              </span>
              <span>{option.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <label class="field">
        <span class="field-label">{t("expense.nameLabel")}</span>
        <input
          type="text"
          use:focusName
          bind:value={name}
          placeholder={t("expense.namePlaceholder")}
        />
        {#if !hasName}
          <span class="editor-hint" transition:fade={motionFade(MOTION.fast)}>{t("expense.nameRequired")}</span>
        {/if}
      </label>

      <label class="field">
        <span class="field-label">{t("expense.amountLabel")}</span>
        <input
          type="text"
          inputmode="numeric"
          value={amountInput}
          oninput={onAmountInput}
          placeholder="0"
        />
        {#if !hasAmount}
          <span class="editor-hint" transition:fade={motionFade(MOTION.fast)}>{t("expense.amountRequired")}</span>
        {/if}
      </label>

      <div class="field-row">
        <label class="field">
          <span class="field-label">{t("expense.method")}</span>
          <select bind:value={methodBase} onchange={onMethodBaseChange}>
            {#each methodBases as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        <label class="field">
          <span class="field-label">{channelLabel}</span>
          <select bind:value={methodChannel}>
            <option value="">{t("expense.methodChannelAny")}</option>
            {#each channelOptions as channel (channel)}
              <option value={channel}>{channel}</option>
            {/each}
          </select>
        </label>
      </div>

      {#if isPastPeriod}
        <label class="field">
          <span class="field-label">{t("expense.date")}</span>
          <input
            class="date-input"
            type="date"
            bind:value={date}
            min={dateFloor}
            max={dateCeiling}
          />
          <span class="date-preview field-hint">
            {#if date}
              🗓 {formatFullDate(date)}
            {:else}
              {t("expense.noDate")}
            {/if}
          </span>
        </label>
      {:else}
        <div>
          <span class="field-label">{t("expense.date")}</span>
          <div class="date-chips" role="group" aria-label={t("expense.date")}>
            {#each dateOptions as option (option.value)}
              <button
                class="date-chip"
                class:active={date === option.value}
                type="button"
                aria-pressed={date === option.value}
                title={formatFullDate(option.value)}
                onclick={() => (date = option.value)}
              >
                {option.relative}
              </button>
            {/each}
          </div>
          <label class="date-custom">
            <span class="date-custom-label">{t("expense.dateOther")}</span>
            <input
              class="date-input"
              type="date"
              bind:value={date}
              min={dateFloor}
              max={dateOptions[0].value}
            />
          </label>
          <span class="date-preview field-hint">
            {#if date}
              🗓 {relativeLabel(date)} · {formatFullDate(date)}
            {:else}
              {t("expense.noDate")}
            {/if}
          </span>
        </div>
      {/if}

      <div class="sheet-actions">
        <button class="btn-cancel" type="button" onclick={onClose}>{t("expense.cancel")}</button>
        <button class="btn-save" type="submit" disabled={!canCommit || saving}>{t("expense.add")}</button>
      </div>
    </form>
  </div>
</div>

<style>
  .sheet-overlay {
    position: fixed; inset: 0; z-index: var(--z-modal);
    /* Phones only, like the month page's jump-to-section button. */
    display: none; align-items: center; justify-content: center;
    padding: 1.25rem;
    background: var(--scrim);
    backdrop-filter: blur(3px);
  }
  .sheet {
    display: flex; flex-direction: column;
    width: 100%; max-width: 29rem;
    max-height: min(88dvh, 44rem);
    background: var(--surface); border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
  .sheet-head {
    display: flex; align-items: flex-start; gap: 1rem;
    padding: 1.1rem 1.25rem 0.85rem;
    border-bottom: 1px solid var(--surface-border);
  }
  .head-text { min-width: 0; }
  .sheet-title { font-size: 1.05rem; font-weight: 800; color: var(--text-primary); line-height: 1.3; }
  .sheet-sub { font-size: 0.75rem; color: var(--text-tertiary); }
  .close-btn {
    flex-shrink: 0; margin-left: auto;
    display: grid; place-items: center;
    width: 1.9rem; height: 1.9rem; border-radius: var(--radius-circle);
    background: var(--bg-muted); color: var(--text-secondary);
  }
  .close-btn:hover { background: var(--surface-border); color: var(--text-primary); }
  .close-btn svg { width: 1rem; height: 1rem; }

  .sheet-body {
    display: flex; flex-direction: column; gap: 0.9rem;
    padding: 1rem 1.25rem 1.25rem;
    overflow-y: auto; overscroll-behavior: contain;
  }
  .group-label, .field-label {
    display: block; font-size: 0.7rem; font-weight: 700;
    color: var(--text-secondary); margin-bottom: 0.4rem;
  }
  .destinations { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
  .destination {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.4rem 0.6rem; border-radius: var(--radius-sm);
    border: 1px solid var(--surface-border); background: var(--bg-muted);
    color: var(--text-secondary); font-size: 0.78rem; font-weight: 700;
    text-align: left;
  }
  .destination:hover { border-color: var(--accent-gold); }
  .destination.active {
    border-color: var(--accent-gold); background: var(--accent-gold-light);
    color: var(--text-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-gold) 16%, transparent);
  }
  /* Same badge icons and blue/rose tones as sections 5–8 on the month page. */
  .destination-icon {
    width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0;
    display: grid; place-items: center;
    background: color-mix(in srgb, var(--accent-blue) 15%, transparent); color: var(--accent-blue);
    transition: transform var(--dur-base) var(--ease-spring);
  }
  .destination.rose .destination-icon {
    background: color-mix(in srgb, var(--accent-rose) 15%, transparent); color: var(--accent-rose);
  }
  .destination.active .destination-icon { transform: scale(1.08) rotate(-4deg); }

  .field { display: block; }
  .sheet input[type="text"], .sheet input[type="date"], .sheet select {
    width: 100%; padding: 0.55rem 0.7rem;
    border: 1px solid var(--surface-border); border-radius: var(--radius-sm);
    background: var(--surface); color: var(--text-primary); font-size: 0.85rem;
  }
  .sheet input:focus, .sheet select:focus {
    outline: none; border-color: var(--accent-gold);
    box-shadow: var(--focus-ring-gold);
  }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .date-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; }
  .date-chip {
    padding: 0.4rem 0.15rem; border-radius: var(--radius-pill);
    border: 1px solid var(--surface-border); background: var(--bg-muted);
    color: var(--text-secondary); font-size: 0.7rem; font-weight: 700;
  }
  .date-chip:hover { border-color: var(--accent-gold); }
  .date-chip.active {
    border-color: var(--accent-gold); background: var(--accent-gold-light);
    color: var(--text-primary);
  }
  .date-custom { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.45rem; }
  .date-custom-label {
    font-size: var(--fs-caption); font-weight: 600; color: var(--text-tertiary); white-space: nowrap;
  }
  .date-custom input { flex: 1; min-width: 0; }
  .field > .date-input { min-height: 44px; }
  .date-preview { margin-top: 0.45rem; }

  /* Mounted only while the field is empty, so filled fields keep normal
     spacing; `fade` handles the appearance without animating layout height. */
  .editor-hint {
    font-size: var(--fs-caption); font-weight: 600; color: var(--accent-gold);
  }

  .sheet-actions { display: flex; gap: 0.6rem; justify-content: flex-end; padding-top: 0.2rem; }
  .btn-cancel, .btn-save {
    padding: 0.55rem 1.1rem; border-radius: var(--radius-sm);
    font-size: 0.82rem; font-weight: 700;
  }
  .btn-cancel { background: transparent; border: 1px solid var(--surface-border); color: var(--text-secondary); }
  .btn-cancel:hover { background: var(--bg-muted); }
  .btn-save { background: var(--text-primary); color: var(--bg); }
  .btn-save:hover { opacity: 0.88; }
  .btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

  .close-btn:focus-visible, .destination:focus-visible, .date-chip:focus-visible,
  .btn-cancel:focus-visible, .btn-save:focus-visible {
    outline: var(--focus-outline); outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .sheet-overlay { display: flex; }
  }

  @media (max-width: 640px) {
    .sheet-overlay { align-items: flex-end; padding: 0; }
    .sheet {
      max-width: none;
      max-height: calc(100dvh - var(--sheet-keyboard, 0px) - env(safe-area-inset-top) - 0.75rem);
      margin-bottom: calc(var(--sheet-keyboard, 0px) + env(safe-area-inset-bottom));
      border-radius: 18px 18px 0 0; border-bottom: none;
    }
    .sheet-head { padding: 1rem 1.1rem 0.8rem; }
    .sheet-body { padding: 0.9rem 1.1rem calc(1rem + env(safe-area-inset-bottom)); }
  }
</style>
