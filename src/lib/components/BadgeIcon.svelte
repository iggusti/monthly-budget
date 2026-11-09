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
    // Chicken money box ("celengan ayam") — savings withdrawals
    savings:
      '<path d="M9.5 4.5 8.2 2.6M12 4 12 2.2M14.5 4.5 15.8 2.6"/><path d="M6 11.5c0-2.7 2.6-4.9 5.7-4.9 2.2 0 4.1 1 5.1 2.6h2.4c1 0 1.8.8 1.8 1.8s-.8 1.8-1.8 1.8H17v1.4c0 .9-.4 1.6-1 2.2v2.3h-2.4v-1.6h-3.2v1.6H8v-2.6c-1.2-1-2-2.4-2-4.2Z"/><circle cx="15.4" cy="9.6" r=".6"/><path d="M16.7 7.7h.01"/>',
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
