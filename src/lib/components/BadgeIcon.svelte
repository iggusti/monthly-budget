<script lang="ts">
  /**
   * Small outline (stroke) icon used in section badges.
   * Icons are rendered as inline SVG so they inherit the badge's accent
   * color via `currentColor`.
   */
  let { name = "income" }: { name?: string } = $props();

  const ICONS: Record<string, string> = {
    // Banknote — monthly income
    income:
      '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    // Receipt — fixed / recurring obligations
    fixed:
      '<path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    // Wallet — everyday spending from salary
    wallet:
      '<path d="M20 7V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M16 12h4v4h-4a2 2 0 0 1 0-4z"/>',
    // Piggy bank — savings withdrawals
    savings:
      '<path d="M19 5c-1.5 0-2.8.4-3.8 1H8.5A5.5 5.5 0 0 0 3 11.5V13a2 2 0 0 0 2 2h1v4h4v-3h2v3h4v-4.5c1-.8 1.7-1.9 1.9-3.1L21 8c.5-1 .4-2-.5-2.5.3-.3.5-.5.5-.5z"/><circle cx="7.5" cy="11.5" r="1"/><path d="M18 5c0 0 .5 1-.5 2"/>'
  };
</script>

<svg
  viewBox="0 0 24 24"
  class="badge-icon"
  fill="none"
  stroke="currentColor"
  stroke-width="1.9"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  >{@html ICONS[name] ?? ICONS.income}</svg
>

<style>
  .badge-icon { width: 16px; height: 16px; display: block; }
</style>
