<script lang="ts">
  /**
   * Small outline icons for the backup panel buttons. Inline SVG keeps the
   * stroke inheriting `currentColor`, so icons follow both themes and the
   * primary button's contrast automatically.
   */
  type IconName = "json" | "csv" | "pdf" | "install" | "restore" | "cancel" | "confirm";

  let { name, size = 16 }: { name: IconName; size?: number } = $props();

  const ICONS: Record<IconName, string> = {
    // Braces — JSON data
    json:
      '<path d="M8 3H7a2 2 0 0 0-2 2v3.5a2 2 0 0 1-2 2 2 2 0 0 1 2 2V16a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v3.5a2 2 0 0 0 2 2 2 2 0 0 0-2 2V16a2 2 0 0 1-2 2h-1"/>',
    // Grid — CSV rows and columns
    csv:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11"/>',
    // Document — printable PDF report
    pdf:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    // Phone with a download arrow — install the PWA
    install:
      '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2M12 6v7m0 0-3-3m3 3 3-3"/>',
    // Upload into a tray — restore a backup file
    restore:
      '<path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    cancel: '<path d="M18 6 6 18M6 6l12 12"/>',
    confirm: '<path d="M20 6 9 17l-5-5"/>'
  };
</script>

<svg
  viewBox="0 0 24 24"
  class="backup-icon"
  style="width:{size}px;height:{size}px;"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  >{@html ICONS[name]}</svg
>

<style>
  .backup-icon { display: block; flex-shrink: 0; }
</style>
