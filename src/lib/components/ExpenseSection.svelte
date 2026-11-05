<script lang="ts">
  import { slide } from "svelte/transition";
  import { formatCurrency, makeId, type ExpenseItem } from "#lib/types";

  interface Props {
    /** Section title, e.g. "Husband Fixed Expenses". */
    title: string;
    /** Short badge glyph shown in the section header. */
    badge?: string;
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
    /** When true each row shows a checkbox and the footer shows remaining total. */
    checkboxable?: boolean;
    /** Current items. */
    items: ExpenseItem[];
    /** Render a footer with the section total. */
    footerLabel?: string;
    /** Optional trailing footer value (e.g. a balance). */
    footerValue?: number;
    /** Called with the updated list whenever the user changes anything. */
    onChange: (items: ExpenseItem[]) => void;
  }

  let {
    title,
    badge = "•",
    tone = "gold",
    nameLabel = "Name",
    amountLabel = "Amount (IDR)",
    withMethod = false,
    methodPlaceholder = "e.g. Cash, BNI, QRIS",
    checkboxable = false,
    items,
    footerLabel,
    footerValue,
    onChange
  }: Props = $props();

  let adding = $state(false);
  let editingId = $state<string | null>(null);

  let draft = $state<ExpenseItem>({ id: "", name: "", amount: 0, method: "" });

  const total = $derived(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const checkedTotal = $derived(
    items.reduce((sum, item) => sum + (item.checked ? Number(item.amount) || 0 : 0), 0)
  );
  const remaining = $derived(total - checkedTotal);

  function startAdd() {
    draft = { id: makeId(), name: "", amount: 0, method: "" };
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

    const exists = items.some((item) => item.id === clean.id);
    onChange(exists ? items.map((item) => (item.id === clean.id ? clean : item)) : [...items, clean]);

    adding = false;
    editingId = null;
  }

  function cancel() {
    adding = false;
    editingId = null;
  }

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
    if (editingId === id) editingId = null;
  }

  function toggleCheck(id: string) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  }
</script>

<div class="section {tone}">
  <div class="section-head">
    <span class="badge">{badge}</span>
    <span class="section-title">{title}</span>
    <span class="section-total">{formatCurrency(total)}</span>
    <button class="add-btn" onclick={startAdd} aria-label="Add item">+</button>
  </div>

  {#if adding || editingId}
    <div class="editor" in:slide={{ duration: 200 }}>
      <div class="editor-fields">
        <label class="field">
          <span>{nameLabel}</span>
          <input
            type="text"
            bind:value={draft.name}
            placeholder="e.g. Bayar Listrik"
            onkeydown={(e) => e.key === "Enter" && commit()}
          />
        </label>
        <label class="field">
          <span>{amountLabel}</span>
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
            <span>Payment method</span>
            <input type="text" bind:value={draft.method} placeholder={methodPlaceholder} />
          </label>
        {/if}
      </div>
      <div class="editor-actions">
        <button class="btn-save" onclick={commit}>{editingId ? "Save changes" : "Add"}</button>
        <button class="btn-cancel" onclick={cancel}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if items.length}
    <ul class="items">
      {#each items as item (item.id)}
        <li class="item" class:editing={editingId === item.id} class:checked={item.checked}>
          <span class="item-left">
            {#if checkboxable}
              <label class="check" title={item.checked ? "Mark unpaid" : "Mark paid"}>
                <input type="checkbox" checked={item.checked} onchange={() => toggleCheck(item.id)} />
                <span class="checkmark"></span>
              </label>
            {/if}
            <span class="item-name">
              {item.name}
              {#if item.method}<span class="tag">{item.method}</span>{/if}
            </span>
          </span>
          <span class="item-right">
            <span class="item-amount">{formatCurrency(item.amount)}</span>
            <button class="icon-btn" title="Edit" onclick={() => startEdit(item)}>✎</button>
            <button class="icon-btn danger" title="Delete" onclick={() => remove(item.id)}>✕</button>
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if !items.length && !adding}
    <p class="empty">No entries yet — tap “+” to add one.</p>
  {/if}

  {#if footerLabel !== undefined}
    <div class="section-footer">
      <span>{footerLabel}</span>
      {#if checkboxable}
        <span class="footer-check-stats">
          <span class="footer-remaining" class:negative={remaining < 0}>{formatCurrency(remaining)}</span>
          <span class="footer-sub">left · {formatCurrency(checkedTotal)} paid</span>
        </span>
      {:else}
        <span class:negative={(footerValue ?? total) < 0}>{formatCurrency(footerValue ?? total)}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .section { background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }

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
  .editor-fields { display: grid; grid-template-columns: 1.4fr 1fr; gap: 0.75rem; }
  .editor-fields .field:last-child:nth-child(3) { grid-column: 1 / -1; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field span { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
  .field input { width: 100%; padding: 0.55rem 0.75rem; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--surface); font-size: 0.875rem; color: var(--text-primary); }
  .field input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(200, 149, 108, 0.15); }
  .editor-actions { display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 0.85rem; }
  .btn-save { padding: 0.5rem 1.05rem; border-radius: var(--radius-sm); background: var(--text-primary); color: white; font-size: 0.8rem; font-weight: 600; }
  .btn-save:hover { background: #2d2a27; }
  .btn-cancel { padding: 0.5rem 1.05rem; border-radius: var(--radius-sm); background: transparent; border: 1px solid var(--surface-border); color: var(--text-secondary); font-size: 0.8rem; font-weight: 600; }
  .btn-cancel:hover { background: var(--bg-muted); }

  .items { list-style: none; }
  .item { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.7rem 1.25rem; border-bottom: 1px solid var(--bg-muted); transition: background 0.15s; }
  .item:last-child { border-bottom: none; }
  .item:hover { background: var(--bg); }
  .item.editing { background: rgba(200, 149, 108, 0.08); }
  .item.checked .item-name { text-decoration: line-through; color: var(--text-tertiary); }
  .item.checked .item-amount { color: var(--text-tertiary); }
  .item-left { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
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
  .item-right { display: flex; align-items: center; gap: 0.5rem; }
  .item-amount { font-size: 0.86rem; font-weight: 600; color: var(--text-secondary); }
  .icon-btn { width: 26px; height: 26px; border-radius: var(--radius-sm); background: transparent; color: var(--text-tertiary); font-size: 0.75rem; display: flex; align-items: center; justify-content: center; }
  .icon-btn:hover { background: var(--bg-muted); color: var(--text-primary); }
  .icon-btn.danger:hover { background: var(--danger-light); color: var(--danger); }

  .empty { padding: 1rem 1.25rem; font-size: 0.82rem; color: var(--text-tertiary); }

  .section-footer { display: flex; justify-content: space-between; align-items: center; padding: 0.7rem 1.25rem; font-size: 0.8rem; font-weight: 600; border-top: 1px solid var(--surface-border); background: rgba(0, 0, 0, 0.015); }
  .section-footer .negative { color: var(--danger); }
  .footer-check-stats { display: flex; align-items: baseline; gap: 0.6rem; }
  .footer-remaining { font-size: 0.9rem; font-weight: 700; }
  .footer-sub { font-size: 0.72rem; font-weight: 500; color: var(--text-tertiary); }

  @media (max-width: 640px) {
    .editor-fields { grid-template-columns: 1fr; }
    .editor-fields .field:last-child:nth-child(3) { grid-column: auto; }
  }
</style>
