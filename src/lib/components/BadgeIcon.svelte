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
      '<path d="M4.2 13.6c0-3.4 2.8-6.2 6.3-6.2 1.2 0 2.4.4 3.3 1"/><path d="M4.2 13.6c0 3.1 2.6 5.6 5.7 5.6h2.2c1.7 0 3-1.3 3-3 0-1.3-.8-2.3-2-2.7"/><path d="M13.8 8.6c.5-.6 1.2-1 2-1 1.3 0 2.4 1.1 2.4 2.4 0 .9-.5 1.7-1.2 2.1"/><path d="M15.7 7.6 15.2 5.4M17 7.4 17.3 5.2M18.3 7.8 19.3 5.8"/><path d="M19.9 9.7 22.4 9l-2.3 1.9"/><path d="M19.3 11.6c.4.3.6.8.5 1.3"/><path d="M17.8 9.3h.01"/><path d="M8.3 12.4c1.6-.2 3.1.6 3.7 2.1"/><path d="M9 18.6v1.9M12.7 18.6v1.9"/><path d="M7.7 9.9c1-.4 2.1-.5 3-.4"/>',
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
