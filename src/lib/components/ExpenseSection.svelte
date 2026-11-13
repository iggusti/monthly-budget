<script module lang="ts">
  /** Minimal shape of a draggable item (matches the app's ExpenseItem). */
  type DragItem = {
    id: string;
    name: string;
    amount: number;
    method?: string;
    checked?: boolean;
  };

  /** A registered section, used as a drag & drop target. */
  interface SectionEntry {
    key: string;
    group: string | undefined;
    rootEl: HTMLElement | null;
    onExternalDrop?: (item: DragItem, fromKey: string) => void;
  }

  /**
   * Shared drag & drop state across all ExpenseSection instances.
   * Items may only be dropped into another section in the SAME drag group
   * (e.g. fixed ↔ fixed, husband salary ↔ husband savings, ...).
   */
  const sectionRegistry = new Map<string, SectionEntry>();

  const dragState: {
    active: boolean;
    picked: boolean;
    item: DragItem | null;
    fromKey: string | null;
    group: string | undefined | null;
    startX: number;
    startY: number;
    ghostEl: HTMLElement | null;
    sourceRowEl: HTMLElement | null;
  } = {
    active: false,
    picked: false,
    item: null,
    fromKey: null,
    group: null,
    startX: 0,
    startY: 0,
    ghostEl: null,
    sourceRowEl: null
  };

  let docListenersAttached = false;

  function attachGlobalListeners() {
    if (docListenersAttached) return;
    docListenersAttached = true;
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", cleanupDrag);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragState.active) return;
    const x = e.clientX;
    const y = e.clientY;
    if (!dragState.picked) {
      const dx = x - dragState.startX;
      const dy = y - dragState.startY;
      if (Math.hypot(dx, dy) < 10) return; // threshold before "picking" up
      dragState.picked = true;
      createGhost();
    }
    if (dragState.ghostEl) {
      dragState.ghostEl.style.left = `${x}px`;
      dragState.ghostEl.style.top = `${y}px`;
    }
    updateHighlights(x, y);
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragState.active) return;
    if (dragState.picked) tryDrop(e.clientX, e.clientY);
    cleanupDrag();
  }

  function createGhost() {
    if (!dragState.sourceRowEl) return;
    const ghost = dragState.sourceRowEl.cloneNode(true) as HTMLElement;
    ghost.classList.add("drag-ghost");
    ghost.style.position = "fixed";
    ghost.style.left = `${dragState.startX}px`;
    ghost.style.top = `${dragState.startY}px`;
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.width = `${dragState.sourceRowEl.offsetWidth}px`;
    document.body.appendChild(ghost);
    dragState.ghostEl = ghost;
    document.body.classList.add("drag-in-progress");
  }

  function updateHighlights(x: number, y: number) {
    clearHighlights();
    const root = sectionAtPoint(x, y);
    if (!root) return;
    const key = root.dataset.sectionKey;
    const target = key ? sectionRegistry.get(key) : undefined;
    if (target && target.group === dragState.group && target.key !== dragState.fromKey) {
      root.classList.add("is-drop-target");
    }
  }

  function clearHighlights() {
    sectionRegistry.forEach((entry) => entry.rootEl?.classList.remove("is-drop-target"));
  }

  function sectionAtPoint(x: number, y: number): HTMLElement | null {
    const el = document.elementFromPoint(x, y);
    return el ? (el.closest("[data-section-key]") as HTMLElement | null) : null;
  }

  function tryDrop(x: number, y: number) {
    const root = sectionAtPoint(x, y);
    if (!root) return;
    const key = root.dataset.sectionKey;
    const target = key ? sectionRegistry.get(key) : undefined;
    if (
      target &&
      target.group === dragState.group &&
      target.key !== dragState.fromKey &&
      target.onExternalDrop &&
      dragState.item &&
      dragState.fromKey
    ) {
      target.onExternalDrop({ ...dragState.item }, dragState.fromKey);
    }
  }

  function cleanupDrag() {
    dragState.active = false;
    dragState.picked = false;
    dragState.ghostEl?.remove();
    dragState.ghostEl = null;
    dragState.sourceRowEl = null;
    clearHighlights();
    document.body.classList.remove("drag-in-progress");
  }

  function beginSectionDrag(
    e: PointerEvent,
    item: DragItem,
    key: string | undefined,
    group: string | undefined,
    rowEl: HTMLElement
  ) {
    if (!key || !group) return;
    // Don't start a drag when interacting with controls in the row.
    if ((e.target as HTMLElement).closest("button, input, select, a, label.check")) return;
    dragState.active = true;
    dragState.picked = false;
    dragState.item = item;
    dragState.fromKey = key;
    dragState.group = group;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.sourceRowEl = rowEl;
    attachGlobalListeners();
    e.preventDefault();
  }

  function registerSection(
    key: string | undefined,
    group: string | undefined,
    rootEl: HTMLElement | null,
    onExternalDrop?: (item: DragItem, fromKey: string) => void
  ) {
    if (!key) return;
    sectionRegistry.set(key, { key, group, rootEl, onExternalDrop });
  }

  function unregisterSection(key: string | undefined) {
    if (key) sectionRegistry.delete(key);
  }
</script>

<script lang="ts">
  import { slide } from "svelte/transition";
  import {
    formatCurrency,
    makeId,
    todayISO,
    toISODate,
    parseISODate,
    daysBetween,
    type ExpenseItem
  } from "#lib/types";
  import { t, lang } from "#lib/i18n.svelte";
  import BadgeIcon from "./BadgeIcon.svelte";

  interface Props {
    /** Section title, e.g. "Husband Fixed Expenses". */
    title: string;
    /** Optional DOM id used as an in-page navigation anchor. */
    sectionId?: string;
    /** Short badge glyph shown in the section header. */
    badge?: string;
    /** Optional SVG icon name for the badge (income | fixed | wallet | savings). */
    icon?: string;
    /** Colour variant: blue | rose | gold | teal. */
    tone?: "blue" | "rose" | "gold" | "teal";
    /** Field label for the item name input. */
    nameLabel?: string;
    /** Field label for the amount input. */
    amountLabel?: string;
    /** When true each row also captures a payment method. */
    withMethod?: boolean;
    /** Placeholder for the payment method input. */
    methodPlaceholder?: string;
    /** When true each row also captures the date the expense happened. */
    withDate?: boolean;
    /** When true each row shows a checkbox and the footer shows remaining total. */
    checkboxable?: boolean;
    /** When true, only the most recent items are shown with a view more/less toggle. */
    collapsible?: boolean;
    /** Number of items shown when collapsed (default 8). */
    collapseLimit?: number;
    /** Current items. */
    items: ExpenseItem[];
    /** Render a footer with the section total. */
    footerLabel?: string;
    /** Optional trailing footer value (e.g. a balance). */
    footerValue?: number;
    /** Optional extra note row under the footer (label + value), e.g. remaining money. */
    footerNote?: { label: string; value: number };
    /** Optional plan/budget cap note row, e.g. the maximal planned budget. */
    footerPlan?: {
      label: string;
      value: number;
      /** Optional toggle shown on the plan row (e.g. "transfer received"). */
      toggle?: { checked: boolean; label: string; hint?: string; onChange: (checked: boolean) => void };
    };
    /** Called with the updated list whenever the user changes anything. */
    onChange: (items: ExpenseItem[]) => void;
    /** Unique key identifying this section's budget array (used for drag & drop). */
    sectionKey?: string;
    /** Drag group name — items can only be dropped into sections with the same group. */
    dragGroup?: string;
    /** Called when an item from another (same-group) section is dropped here. */
    onExternalDrop?: (item: ExpenseItem, fromKey: string) => void;
    /** Optional index (0–7) used for search filtering; maps to section 1–8. */
    sectionIndex?: number;
    /** When set, item names containing this query will be highlighted with <mark>. */
    highlightedQuery?: string;
    /** When true, ask for confirmation before adding, editing, or deleting. */
    confirmChanges?: boolean;
  }

  let {
    title,
    sectionId,
    badge = "•",
    icon,
    tone = "gold",
    nameLabel,
    amountLabel,
    withMethod = false,
    methodPlaceholder,
    withDate = false,
    checkboxable = false,
    collapsible = false,
    collapseLimit = 8,
    items,
    footerLabel,
    footerValue,
    footerNote,
    footerPlan,
    onChange,
    sectionKey,
    dragGroup,
    onExternalDrop,
    highlightedQuery = "",
    confirmChanges = false
  }: Props = $props();

  /** Reactive labels so they follow the active language unless overridden. */
  const nameText = $derived(nameLabel ?? t("expense.nameLabel"));
  const amountText = $derived(amountLabel ?? t("expense.amountLabel"));
  const methodText = $derived(methodPlaceholder ?? t("expense.methodPlaceholder"));

  /** Highlight matching text in item names when search query is provided. */
  function highlightText(name: string, query: string): string {
    if (!query || !query.trim()) return name;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return name.replace(regex, "<mark>$1</mark>");
  }

  // ── Date helpers ──────────────────────────────────────────────────────────

  /** Quick-pick options shown above the native date input (today, 1, 2 … ago). */
  const DATE_QUICK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

  interface DateOption {
    /** `YYYY-MM-DD` value stored on the item. */
    value: string;
    /** Relative label, e.g. "Today" / "2 days ago". */
    relative: string;
    /** Human day + date, e.g. "Fri, 13 Nov 2026". */
    detail: string;
  }

  /** The locale currently in use for date formatting. */
  function dateLocale(): string {
    return lang.value === "id" ? "id-ID" : "en-US";
  }

  /** "Fri, 13 Nov 2026" for a `YYYY-MM-DD` value. */
  function formatFullDate(value: string | undefined): string {
    const date = parseISODate(value);
    if (!date) return "";
    return date.toLocaleDateString(dateLocale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  /** Relative label for a `YYYY-MM-DD` value ("Today", "1 day ago", a date). */
  function relativeLabel(value: string | undefined): string {
    const date = parseISODate(value);
    if (!date) return t("expense.noDate");
    const diff = daysBetween(date, new Date());
    if (diff === 0) return t("expense.dateToday");
    if (diff === 1) return t("expense.dateYesterday");
    if (diff > 1) return t("expense.daysAgo", { n: diff });
    // Future date: fall back to the absolute day.
    return formatFullDate(value);
  }

  /** Build the quick-pick list, each with its relative label and full date. */
  const dateOptions = $derived.by<DateOption[]>(() => {
    const now = new Date();
    return DATE_QUICK_DAYS.map((offset) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const value = toISODate(date);
      return {
        value,
        relative: offset === 0
          ? t("expense.dateToday")
          : offset === 1
            ? t("expense.dateYesterday")
            : t("expense.daysAgo", { n: offset }),
        detail: formatFullDate(value)
      };
    });
  });

  /** Today's date, offered as the default when adding a new entry. */
  const todayValue = $derived(dateOptions[0]?.value ?? todayISO());

  function pickDate(value: string) {
    draft.date = value;
  }

  let adding = $state(false);
  let editingId = $state<string | null>(null);
  let showAll = $state(false);
  let confirmDeleteId = $state<string | null>(null);
  // A change awaiting confirmation because the month is not the active period.
  let pendingChange = $state<{ items: ExpenseItem[]; action: "add" | "edit" } | null>(null);
  let rootEl = $state<HTMLElement | null>(null);

  $effect(() => {
    if (sectionKey) {
      registerSection(sectionKey, dragGroup, rootEl, onExternalDrop);
      return () => unregisterSection(sectionKey);
    }
  });

  function onRowPointerDown(e: PointerEvent, item: ExpenseItem) {
    // Only start a drag from the drag handle, so scrolling/tapping elsewhere on
    // the row still behaves normally (important on touch devices).
    if (!(e.target as HTMLElement).closest(".drag-handle")) return;
    if (!rootEl) return;
    const rowEl = e.currentTarget as HTMLElement;
    beginSectionDrag(e, item, sectionKey, dragGroup, rowEl);
  }

  let draft = $state<ExpenseItem>({ id: "", name: "", amount: 0, method: "", date: "" });

  const total = $derived(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const checkedTotal = $derived(
    items.reduce((sum, item) => sum + (item.checked ? Number(item.amount) || 0 : 0), 0)
  );
  const remaining = $derived(total - checkedTotal);

  // Item order: unchecked first (so unpaid fixed expenses are visible first).
  const orderedItems = $derived(
    checkboxable ? [...items].sort((a, b) => Number(a.checked ?? false) - Number(b.checked ?? false)) : items
  );

  function computeVisible(): ExpenseItem[] {
    if (!collapsible || showAll) return orderedItems;
    const unchecked = orderedItems.filter((i) => !i.checked);
    const checked = orderedItems.filter((i) => i.checked);
    if (unchecked.length >= collapseLimit) return unchecked.slice(-collapseLimit);
    return [...unchecked, ...checked.slice(-(collapseLimit - unchecked.length))];
  }

  const visibleItems = $derived(computeVisible());
  // Show the toggle whenever there is more to reveal OR everything is visible
  // (so the user can collapse back to "View less").
  const hasMore = $derived(collapsible && items.length > collapseLimit);
  const hiddenCount = $derived(showAll ? 0 : Math.max(items.length - visibleItems.length, 0));

  function startAdd() {
    draft = { id: makeId(), name: "", amount: 0, method: "", date: withDate ? todayValue : "" };
    editingId = null;
    adding = true;
  }

  function startEdit(item: ExpenseItem) {
    draft = { ...item };
    adding = false;
    editingId = item.id;
  }

  function commit() {
    if (!draft.name.trim()) return;
    const existingItem = items.find((item) => item.id === draft.id);
    const clean: ExpenseItem = {
      id: draft.id || makeId(),
      name: draft.name.trim(),
      amount: Number(draft.amount) || 0,
      checked: existingItem?.checked ?? draft.checked ?? false
    };
    if (withMethod) clean.method = draft.method?.trim() ?? "";
    if (withDate) clean.date = draft.date ?? "";

    const exists = items.some((item) => item.id === clean.id);
    const nextItems = exists
      ? items.map((item) => (item.id === clean.id ? clean : item))
      : [...items, clean];

    // Editing an inactive month requires an explicit confirmation first.
    if (confirmChanges) {
      pendingChange = { items: nextItems, action: exists ? "edit" : "add" };
      return;
    }

    onChange(nextItems);
    adding = false;
    editingId = null;
  }

  /** Apply the pending add/edit after the user confirms. */
  function confirmPending() {
    if (!pendingChange) return;
    onChange(pendingChange.items);
    pendingChange = null;
    adding = false;
    editingId = null;
  }

  function cancelPending() {
    pendingChange = null;
  }

  function cancel() {
    adding = false;
    editingId = null;
  }

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
    if (editingId === id) editingId = null;
    confirmDeleteId = null;
  }

  function askRemove(id: string) {
    confirmDeleteId = id;
  }

  function cancelDelete() {
    confirmDeleteId = null;
  }

  function toggleCheck(id: string) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  }
</script>

<div id={sectionId} class="section {tone}" tabindex="-1" bind:this={rootEl} data-section-key={sectionKey || ""}>
  <div class="section-head">
    <span class="badge">
      {#if icon}
        <BadgeIcon name={icon} />
      {:else}
        {badge}
      {/if}
    </span>
    <span class="section-title">{title}</span>
    <span class="section-total">{formatCurrency(total)}</span>
    <button class="add-btn" onclick={startAdd} aria-label={t("expense.addItem")}>+</button>
  </div>

  {#if adding}
    <div class="editor" in:slide={{ duration: 200 }}>
      <div class="editor-fields">
        <label class="field">
          <span>{nameText}</span>
          <input
            type="text"
            bind:value={draft.name}
            placeholder={t("expense.namePlaceholder")}
            onkeydown={(e) => e.key === "Enter" && commit()}
          />
        </label>
        <label class="field">
          <span>{amountText}</span>
          <input
            type="number"
            min="0"
            bind:value={draft.amount}
            placeholder="0"
            onkeydown={(e) => e.key === "Enter" && commit()}
          />
        </label>
        {#if withMethod}
          <label class="field">
            <span>{t("expense.method")}</span>
            <input type="text" bind:value={draft.method} placeholder={methodText} />
          </label>
        {/if}
        {#if withDate}
          <div class="field date-field">
            <span>{t("expense.date")}</span>
            <div class="date-quick">
              {#each dateOptions as option (option.value)}
                <button
                  type="button"
                  class="date-chip"
                  class:active={draft.date === option.value}
                  onclick={() => pickDate(option.value)}
                  title={option.detail}
                >
                  <span class="date-chip-relative">{option.relative}</span>
                  <span class="date-chip-detail">{option.detail}</span>
                </button>
              {/each}
            </div>
            <label class="date-custom">
              <span class="date-custom-label">{t("expense.dateOther")}</span>
              <input type="date" bind:value={draft.date} />
            </label>
            <span class="date-preview" class:empty={!draft.date}>
              {#if draft.date}
                🗓 {relativeLabel(draft.date)} · {formatFullDate(draft.date)}
              {:else}
                {t("expense.noDate")}
              {/if}
            </span>
          </div>
        {/if}
      </div>
      <div class="editor-actions">
        <button class="btn-save" onclick={commit}>{t("expense.add")}</button>
        <button class="btn-cancel" onclick={cancel}>{t("expense.cancel")}</button>
      </div>
    </div>
  {/if}

  {#if items.length}
    <ul class="items">
      {#each visibleItems as item (item.id)}
        <li
          class="item"
          class:editing={editingId === item.id}
          class:checked={item.checked}
          class:draggable={!!sectionKey && !!dragGroup}
          onpointerdown={(e) => onRowPointerDown(e, item)}
        >
          <span class="item-left">
            {#if sectionKey && dragGroup}
              <span class="drag-handle" aria-hidden="true" title={t("expense.dragToMove")}>⠿</span>
            {/if}
            {#if checkboxable}
              <label class="check" title={item.checked ? t("expense.markUnpaid") : t("expense.markPaid")}>
                <input type="checkbox" checked={item.checked} onchange={() => toggleCheck(item.id)} />
                <span class="checkmark"></span>
              </label>
            {/if}
            <span class="item-name">
              {@html highlightText(item.name, highlightedQuery)}
              {#if item.method}<span class="tag">{item.method}</span>{/if}
              {#if withDate && item.date}
                <span class="date-badge" title={formatFullDate(item.date)}>
                  <span class="date-badge-relative">{relativeLabel(item.date)}</span>
                  <span class="date-badge-detail">{formatFullDate(item.date)}</span>
                </span>
              {/if}
            </span>
          </span>
          <span class="item-right">
            <span class="item-amount">{formatCurrency(item.amount)}</span>
            <button class="icon-btn" title={t("expense.edit")} aria-label={t("expense.edit")} onclick={() => startEdit(item)}>
              <svg viewBox="0 0 24 24" class="icon-btn-svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </button>
            <button class="icon-btn danger" title={t("expense.delete")} onclick={() => askRemove(item.id)}>✕</button>
          </span>
        </li>

        {#if editingId === item.id}
          <li class="editor-item" in:slide={{ duration: 200 }}>
            <div class="editor">
              <div class="editor-fields">
                <label class="field">
                  <span>{nameText}</span>
                  <input type="text" bind:value={draft.name} placeholder={t("expense.namePlaceholder")} onkeydown={(e) => e.key === "Enter" && commit()} />
                </label>
                <label class="field">
                  <span>{amountText}</span>
                  <input type="number" min="0" bind:value={draft.amount} placeholder="0" onkeydown={(e) => e.key === "Enter" && commit()} />
                </label>
                {#if withMethod}
                  <label class="field">
                    <span>{t("expense.method")}</span>
                    <input type="text" bind:value={draft.method} placeholder={methodText} />
                  </label>
                {/if}
                {#if withDate}
                  <div class="field date-field">
                    <span>{t("expense.date")}</span>
                    <div class="date-quick">
                      {#each dateOptions as option (option.value)}
                        <button
                          type="button"
                          class="date-chip"
                          class:active={draft.date === option.value}
                          onclick={() => pickDate(option.value)}
                          title={option.detail}
                        >
                          <span class="date-chip-relative">{option.relative}</span>
                          <span class="date-chip-detail">{option.detail}</span>
                        </button>
                      {/each}
                    </div>
                    <label class="date-custom">
                      <span class="date-custom-label">{t("expense.dateOther")}</span>
                      <input type="date" bind:value={draft.date} />
                    </label>
                    <span class="date-preview" class:empty={!draft.date}>
                      {#if draft.date}
                        🗓 {relativeLabel(draft.date)} · {formatFullDate(draft.date)}
                      {:else}
                        {t("expense.noDate")}
                      {/if}
                    </span>
                  </div>
                {/if}
              </div>
              <div class="editor-actions">
                <button class="btn-save" onclick={commit}>{t("expense.saveChanges")}</button>
                <button class="btn-cancel" onclick={cancel}>{t("expense.cancel")}</button>
              </div>
            </div>
          </li>
        {/if}
      {/each}
    </ul>

    {#if hasMore}
      <button class="more-btn" onclick={() => (showAll = !showAll)}>
        {showAll ? t("expense.viewLess") : t("expense.viewMore", { n: hiddenCount })}
        <span class="more-arrow">{showAll ? "↑" : "↓"}</span>
      </button>
    {/if}
  {/if}

  {#if !items.length && !adding}
    <p class="empty">{t("expense.empty")}</p>
  {/if}

  {#if footerLabel !== undefined}
    <div class="section-footer">
      <span>{footerLabel}</span>
      {#if checkboxable}
        <span class="footer-check-stats">
          <span class="footer-remaining" class:negative={remaining < 0}>{formatCurrency(remaining)}</span>
          <span class="footer-sub">{t("expense.remaining")} · {formatCurrency(checkedTotal)} {t("expense.paid")}</span>
        </span>
      {:else}
        <span class:negative={(footerValue ?? total) < 0}>{formatCurrency(footerValue ?? total)}</span>
      {/if}
    </div>
  {/if}

  {#if footerPlan}
    <div class="section-note plan">
      <span>{footerPlan.label}</span>
      <span class="section-note-value">{formatCurrency(footerPlan.value)}</span>
    </div>
    {#if footerPlan.toggle}
      <div class="section-note plan-toggle">
        <label class="switch" title={footerPlan.toggle.checked ? t("expense.markUnpaid") : t("expense.markPaid")}>
          <input
            type="checkbox"
            checked={footerPlan.toggle.checked}
            onchange={(e) => footerPlan?.toggle?.onChange((e.currentTarget as HTMLInputElement).checked)}
          />
          <span class="switch-track"><span class="switch-thumb"></span></span>
          <span class="switch-label">{footerPlan.toggle.label}</span>
        </label>
        {#if footerPlan.toggle.hint}
          <span class="switch-hint">{footerPlan.toggle.hint}</span>
        {/if}
      </div>
    {/if}
  {/if}

  {#if footerNote}
    <div class="section-note">
      <span>{footerNote.label}</span>
      <span class="section-note-value" class:negative={footerNote.value < 0}>{formatCurrency(footerNote.value)}</span>
    </div>
  {/if}

  {#if confirmDeleteId}
    {@const target = items.find((i) => i.id === confirmDeleteId)}
    <div class="modal-overlay" role="presentation">
      <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
        <span class="modal-icon">🗑️</span>
        <h4 class="modal-title">{t("expense.deleteTitle")}</h4>
        <p class="modal-text">
          {t("expense.deleteText", {
            name: target ? target.name : t("expense.thisItem"),
            amount: formatCurrency(target ? target.amount : 0)
          })}
        </p>
        {#if confirmChanges}
          <p class="modal-warning">⚠️ {t("expense.inactiveText")}</p>
        {:else}
          <p class="modal-note">⚠️ Menghapus pengeluaran di bulan aktif ini akan menghapus catatan secara permanen.</p>
        {/if}
        <div class="modal-actions">
          <button class="btn-cancel" onclick={cancelDelete}>{t("expense.cancel")}</button>
          <button class="btn-danger" onclick={() => { if (confirmDeleteId) remove(confirmDeleteId); }}>{t("expense.delete")}</button>
        </div>
      </div>
    </div>
  {/if}

  {#if pendingChange}
    <div class="modal-overlay" role="presentation">
      <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
        <span class="modal-icon">⚠️</span>
        <h4 class="modal-title">{t("expense.inactiveTitle")}</h4>
        <p class="modal-text">{t("expense.inactiveText")}</p>
        <div class="modal-actions">
          <button class="btn-cancel" onclick={cancelPending}>{t("expense.cancel")}</button>
          <button class="btn-danger" onclick={confirmPending}>{t("expense.continue")}</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .section { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); scroll-margin-top: 4.5rem; }

  .section-head { display: flex; align-items: center; gap: 0.65rem; padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--surface-border); }
  .section-title { flex: 1; font-size: 0.88rem; font-weight: 700; }
  .section-total { font-size: 0.9rem; font-weight: 700; }
  .badge { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
  .add-btn { width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--bg-muted); color: var(--text-secondary); font-size: 1rem; line-height: 1; display: flex; align-items: center; justify-content: center; }
  .add-btn:hover { background: var(--text-primary); color: white; }

  .blue .section-head { background: rgba(107, 127, 163, 0.07); }
  .blue .badge { background: rgba(107, 127, 163, 0.15); color: var(--accent-blue); }
  .rose .section-head { background: rgba(196, 112, 112, 0.07); }
  .rose .badge { background: rgba(196, 112, 112, 0.15); color: var(--accent-rose); }
  .gold .section-head { background: rgba(200, 149, 108, 0.07); }
  .gold .badge { background: rgba(200, 149, 108, 0.15); color: var(--accent-gold); }
  .teal .section-head { background: rgba(91, 138, 138, 0.07); }
  .teal .badge { background: rgba(91, 138, 138, 0.15); color: var(--accent-teal); }

  .editor { padding: 1rem 1.25rem; background: var(--bg); border-bottom: 1px solid var(--surface-border); }
  .editor-item { list-style: none; background: var(--bg); border-bottom: 1px solid var(--surface-border); }
  .editor-item .editor { border-bottom: none; }
  .editor-fields { display: grid; grid-template-columns: 1.4fr 1fr; gap: 0.75rem; }
  .editor-fields .field:last-child:nth-child(3) { grid-column: 1 / -1; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field span { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
  .field input { width: 100%; padding: 0.55rem 0.75rem; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--surface); font-size: 0.875rem; color: var(--text-primary); }
  .field input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(200, 149, 108, 0.15); }

  /* Date capture: quick-pick chips + a native picker + a live preview. */
  .date-field { grid-column: 1 / -1; }
  .date-quick { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .date-chip {
    display: flex; flex-direction: column; align-items: flex-start; gap: 0.05rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-secondary);
    text-align: left; line-height: 1.15;
    transition: all 0.15s ease;
  }
  .date-chip:hover { border-color: var(--accent-gold); background: var(--bg-muted); }
  .date-chip.active {
    border-color: var(--accent-gold);
    background: color-mix(in srgb, var(--accent-gold) 14%, transparent);
    color: var(--text-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-gold) 25%, transparent);
  }
  .date-chip-relative { font-size: 0.74rem; font-weight: 700; }
  .date-chip-detail { font-size: 0.64rem; font-weight: 500; color: var(--text-tertiary); }
  .date-custom { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.45rem; }
  .date-custom-label { font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); white-space: nowrap; }
  .date-custom input { flex: 1; padding: 0.4rem 0.6rem; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--surface); font-size: 0.8rem; color: var(--text-primary); }
  .date-custom input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(200, 149, 108, 0.15); }
  .date-preview {
    margin-top: 0.45rem; font-size: 0.75rem; font-weight: 600;
    color: var(--accent-gold);
  }
  .date-preview.empty { color: var(--text-tertiary); font-weight: 500; }
  .editor-actions { display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 0.85rem; }
  .btn-save { padding: 0.5rem 1.05rem; border-radius: var(--radius-sm); background: var(--text-primary); color: var(--bg); font-size: 0.8rem; font-weight: 600; }
  .btn-save:hover { opacity: 0.88; }
  .btn-cancel { padding: 0.5rem 1.05rem; border-radius: var(--radius-sm); background: transparent; border: 1px solid var(--surface-border); color: var(--text-secondary); font-size: 0.8rem; font-weight: 600; }
  .btn-cancel:hover { background: var(--bg-muted); }

  .items { list-style: none; }
  .item { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.7rem 1.25rem; border-bottom: 1px solid var(--bg-muted); transition: background 0.15s; }
  .item.draggable { cursor: grab; }
  .item.draggable:active { cursor: grabbing; }
  .item:last-child { border-bottom: none; }
  .item:hover { background: var(--bg); }
  .item.editing { background: rgba(200, 149, 108, 0.08); }
  .item.checked .item-name { text-decoration: line-through; color: var(--text-tertiary); }
  .item.checked .item-amount { color: var(--text-tertiary); }
  .item-left { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
  .drag-handle {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 6px;
    color: var(--text-tertiary); font-size: 15px; line-height: 1;
    cursor: grab; touch-action: none; user-select: none;
    transition: background 0.15s, color 0.15s;
  }
  .drag-handle:hover { background: var(--bg-muted); color: var(--text-primary); }
  .check { display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0; }
  .check input { position: absolute; opacity: 0; width: 0; height: 0; }
  .checkmark {
    width: 18px; height: 18px; border-radius: 5px;
    border: 2px solid var(--surface-border); background: var(--surface);
    display: inline-flex; align-items: center; justify-content: center;
    transition: all 0.15s ease; font-size: 11px; color: white;
  }
  .check:hover .checkmark { border-color: var(--accent-gold); }
  .check input:checked + .checkmark { background: var(--accent-teal); border-color: var(--accent-teal); }
  .check input:checked + .checkmark::after { content: "✓"; }
  .item-name { font-size: 0.86rem; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .tag { font-size: 0.68rem; font-weight: 600; padding: 0.12rem 0.45rem; border-radius: 4px; background: rgba(107, 127, 163, 0.1); color: var(--accent-blue); }
  .date-badge {
    display: inline-flex; align-items: center; gap: 0.35rem;
    font-size: 0.66rem; font-weight: 600;
    padding: 0.12rem 0.5rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-gold) 12%, transparent);
    color: var(--accent-gold);
    border: 1px solid color-mix(in srgb, var(--accent-gold) 30%, transparent);
    white-space: nowrap;
  }
  .date-badge-relative { font-weight: 700; }
  .date-badge-detail {
    font-weight: 500; color: var(--text-tertiary);
    padding-left: 0.35rem;
    border-left: 1px solid color-mix(in srgb, var(--accent-gold) 30%, transparent);
  }
  .rose .date-badge {
    background: color-mix(in srgb, var(--accent-rose) 12%, transparent);
    color: var(--accent-rose);
    border-color: color-mix(in srgb, var(--accent-rose) 30%, transparent);
  }
  .rose .date-badge-detail { border-left-color: color-mix(in srgb, var(--accent-rose) 30%, transparent); }
  .blue .date-badge {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    color: var(--accent-blue);
    border-color: color-mix(in srgb, var(--accent-blue) 30%, transparent);
  }
  .blue .date-badge-detail { border-left-color: color-mix(in srgb, var(--accent-blue) 30%, transparent); }
  .item-right { display: flex; align-items: center; gap: 0.5rem; }
  .item-amount { font-size: 0.86rem; font-weight: 600; color: var(--text-secondary); }
  .icon-btn { width: 26px; height: 26px; border-radius: var(--radius-sm); background: transparent; color: var(--text-tertiary); font-size: 0.75rem; display: flex; align-items: center; justify-content: center; }
  .icon-btn-svg { width: 14px; height: 14px; }
  .icon-btn:hover { background: var(--bg-muted); color: var(--text-primary); }
  .icon-btn.danger:hover { background: var(--danger-light); color: var(--danger); }

  .empty { padding: 1rem 1.25rem; font-size: 0.82rem; color: var(--text-tertiary); }

  .more-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.35rem;
    width: 100%; padding: 0.5rem;
    background: var(--bg-muted); color: var(--text-secondary);
    font-size: 0.78rem; font-weight: 700;
    border-top: 1px solid var(--surface-border);
    transition: all 0.2s;
  }
  .more-btn:hover { background: var(--surface); color: var(--accent-gold); }
  .more-arrow { font-size: 0.8rem; line-height: 1; }

  /* Totals stand out from the list items: a tinted, accented callout row. */
  .section-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.7rem 1.25rem; font-size: 0.8rem; font-weight: 600;
    border-top: 1px solid var(--surface-border);
    border-left: 4px solid var(--footer-accent, var(--surface-border));
    background: var(--footer-bg, rgba(0, 0, 0, 0.015));
  }
  .section-footer .negative { color: var(--danger); }
  .footer-check-stats { display: flex; align-items: baseline; gap: 0.6rem; }
  .footer-remaining { font-size: 0.9rem; font-weight: 700; }
  .footer-sub { font-size: 0.72rem; font-weight: 500; color: var(--text-tertiary); }

  .section-footer > span:first-child {
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--footer-accent, var(--text-secondary));
  }
  .footer-check-stats .footer-remaining,
  .section-footer > span:last-child {
    color: var(--footer-accent, var(--text-primary));
  }
  .footer-check-stats .footer-sub { color: var(--text-tertiary); }
  .section-footer .negative,
  .footer-check-stats .footer-remaining.negative { color: var(--danger); }

  .section-note {
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
    padding: 0.55rem 1.25rem; font-size: 0.78rem; font-weight: 600;
    border-top: 1px solid var(--surface-border);
    background: color-mix(in srgb, var(--footer-accent, var(--accent-blue)) 7%, transparent);
    color: var(--text-secondary);
  }
  .section-note.plan { background: transparent; border-top-style: dashed; color: var(--text-tertiary); }
  .section-note .section-note-value { font-weight: 700; font-variant-numeric: tabular-nums; }
  .section-note .section-note-value.negative { color: var(--danger); }

  .section-note.plan-toggle { justify-content: flex-start; gap: 0.6rem; border-top: none; background: transparent; }
  .switch { display: inline-flex; align-items: center; gap: 0.55rem; cursor: pointer; user-select: none; }
  .switch input { position: absolute; opacity: 0; width: 0; height: 0; }
  .switch-track {
    position: relative; width: 36px; height: 20px; flex-shrink: 0;
    border-radius: 99px; background: var(--bg-muted);
    border: 1px solid var(--surface-border);
    transition: background 0.2s ease, border-color 0.2s ease;
  }
  .switch-thumb {
    position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
    border-radius: 50%; background: var(--surface);
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s ease;
  }
  .switch input:checked + .switch-track { background: var(--accent-teal); border-color: var(--accent-teal); }
  .switch input:checked + .switch-track .switch-thumb { transform: translateX(16px); }
  .switch input:focus-visible + .switch-track { box-shadow: 0 0 0 3px rgba(91, 138, 138, 0.25); }
  .switch-label { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); }
  .switch-hint { font-size: 0.72rem; color: var(--text-tertiary); margin-left: auto; }

  .gold .section-footer { --footer-accent: var(--accent-gold); --footer-bg: rgba(200, 149, 108, 0.08); }
  .rose .section-footer { --footer-accent: var(--accent-rose); --footer-bg: rgba(196, 112, 112, 0.08); }
  .blue .section-footer { --footer-accent: var(--accent-blue); --footer-bg: rgba(107, 127, 163, 0.08); }
  .teal .section-footer { --footer-accent: var(--accent-teal); --footer-bg: rgba(91, 138, 138, 0.08); }

  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(26, 23, 20, 0.45);
    backdrop-filter: blur(3px);
    padding: 1.25rem;
  }
  .modal {
    background: var(--surface); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg); padding: 1.75rem 1.75rem 1.5rem;
    width: 100%; max-width: 360px; text-align: center;
    animation: scaleIn 0.2s ease;
  }
  .modal-icon { font-size: 2rem; display: block; margin-bottom: 0.75rem; }
  .modal-title { font-size: 1.05rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.4rem; }
  .modal-text { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem; }
  .modal-warning {
    font-size: 0.78rem; font-weight: 600; line-height: 1.45;
    color: var(--accent-gold); background: var(--accent-gold-light);
    border-radius: var(--radius-sm); padding: 0.5rem 0.65rem;
    margin: -0.6rem 0 1.1rem; text-align: left;
  }
  .modal-note {
    font-size: 0.78rem; font-weight: 600; line-height: 1.45;
    color: var(--text-tertiary); background: var(--bg-muted);
    border-radius: var(--radius-sm); padding: 0.5rem 0.65rem;
    margin: -0.6rem 0 1.1rem; text-align: left;
  }
  .modal-actions { display: flex; gap: 0.6rem; justify-content: center; }
  .btn-danger { padding: 0.55rem 1.15rem; border-radius: var(--radius-sm); background: var(--danger); color: white; font-size: 0.825rem; font-weight: 700; }
  .btn-danger:hover { background: #a85a5a; }

  @media (max-width: 640px) {
    .editor-fields { grid-template-columns: 1fr; }
    .editor-fields .field:last-child:nth-child(3) { grid-column: auto; }
  }

  /* Global drag & drop visuals (target both mouse and touch). */
  :global(body.drag-in-progress) { cursor: grabbing; }
  :global(body.drag-in-progress *) { cursor: grabbing; }

  :global(.drag-ghost) {
    opacity: 0.7; box-shadow: var(--shadow-lg);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  :global(.section.is-drop-target) {
    outline: 2px dashed var(--accent-blue);
    outline-offset: -2px;
    border-radius: var(--radius-lg);
  }

  /* Search highlight for matched item names (rendered via {@html}). */
  :global(mark) {
    background: var(--accent-gold);
    color: #fff;
    padding: 0 0.15rem;
    border-radius: 2px;
    font-weight: 600;
  }
</style>
