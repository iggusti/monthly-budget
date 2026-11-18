/**
 * Toast queue logic, kept free of Svelte imports so it stays unit-testable.
 *
 * The reactive stack lives in `toast.svelte.ts`; this module only decides what
 * the stack looks like after a push or a dismiss.
 */

export type ToastKind = "success" | "error";

export interface Toast {
  /** Unique, monotonically increasing id — also the `{#each}` key. */
  id: number;
  kind: ToastKind;
  message: string;
}

/** How long each kind stays on screen before it dismisses itself. */
export const TOAST_DURATION: Record<ToastKind, number> = {
  success: 2800,
  error: 4800
};

/** Most toasts shown at once; the oldest is dropped when more arrive. */
export const TOAST_LIMIT = 3;

/**
 * The stack after adding `toast`: newest last, capped at `limit`.
 *
 * A toast with the same kind and message already on screen is replaced rather
 * than duplicated, so repeating an action refreshes one card instead of piling
 * up identical ones.
 */
export function pushToast(
  list: readonly Toast[],
  toast: Toast,
  limit: number = TOAST_LIMIT
): Toast[] {
  const rest = list.filter(
    (t) => !(t.kind === toast.kind && t.message === toast.message)
  );
  return [...rest, toast].slice(-limit);
}

/** The stack without the toast `id`. */
export function dropToast(list: readonly Toast[], id: number): Toast[] {
  return list.filter((t) => t.id !== id);
}
