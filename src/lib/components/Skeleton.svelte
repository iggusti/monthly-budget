<script lang="ts">
  /**
   * Base skeleton placeholder with a gentle shimmer, theme-aware colours.
   *
   * Compose page-level skeletons from this primitive:
   *   <Skeleton width="60%" height="1rem" />
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
      ? `width:${size}px;height:${size}px;border-radius:var(--radius-circle);`
      : `width:${width};height:${height};border-radius:${radius};`
  );
</script>

<span class="skeleton" style="{dims}{style}" aria-hidden="true"></span>

<style>
  .skeleton {
    position: relative;
    display: block;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--skeleton-base, #eeece8);
    pointer-events: none;
  }

  /* A single soft highlight sweeps across the block. Doing this on a pseudo
     element (instead of sliding a 200%-wide gradient) keeps the shimmer calm
     and clips cleanly inside rounded/circular skeletons.

     Longhand offsets and a plain rgba token on purpose: `inset` and
     `color-mix()` are recent additions, and a browser that drops either one
     silently loses the whole shimmer. */
  .skeleton::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--skeleton-sheen) 50%,
      transparent 100%
    );
    transform: translateX(-100%);
    animation: skeleton-shimmer 1.6s ease-in-out infinite;
  }

  /* Both ends are explicit so no engine has to infer the missing keyframe. */
  @keyframes skeleton-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton::after { animation: none; opacity: 0; }
  }
</style>
