<script lang="ts">
  /**
   * Base skeleton placeholder with a gentle shimmer, theme-aware colours.
   *
   * Compose page-level skeletons from this primitive:
   *   <Skeleton w="60%" h="1rem" />
   *   <Skeleton circle size={40} />
   */
  interface Props {
    /** Width (CSS length). Defaults to 100%. */
    width?: string;
    /** Height (CSS length). Defaults to 1rem. */
    height?: string;
    /** Border radius (CSS length). Defaults to 8px. */
    radius?: string;
    /** Render as a circle of this size (px). Overrides width/height/radius. */
    circle?: boolean;
    /** Circle diameter in px (used with `circle`). */
    size?: number;
    /** Extra inline styles. */
    style?: string;
  }

  let { width = "100%", height = "1rem", radius = "8px", circle = false, size = 40, style = "" }: Props =
    $props();

  const dims = $derived(
    circle
      ? `width:${size}px;height:${size}px;border-radius:50%;`
      : `width:${width};height:${height};border-radius:${radius};`
  );
</script>

<span class="skeleton" style="{dims}{style}" aria-hidden="true"></span>

<style>
  .skeleton {
    display: block;
    flex-shrink: 0;
    background: linear-gradient(
      90deg,
      var(--bg-muted) 0%,
      color-mix(in srgb, var(--bg-muted) 55%, var(--surface)) 50%,
      var(--bg-muted) 100%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }

  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none; }
  }
</style>
