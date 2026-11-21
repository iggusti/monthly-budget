/**
 * Reactive toast stack behind the `Toasts` component.
 *
 * Usage:
 *   import { toastSuccess, toastError } from "#lib/toast.svelte";
 *   toastSuccess(t("toast.added"));
 *
 * Showing a toast never throws — it is only feedback, so the write that
 * triggered it stays responsible for reporting failure.
 */
import {
  dropToast,
  pushToast,
  TOAST_DURATION,
  TOAST_UNDO_DURATION,
  type Toast,
  type ToastAction,
  type ToastKind
} from "./toast";

let nextId = 1;

/** Live stack, newest last. Reassign `list` to change what is shown. */
export const toastState = $state<{ list: Toast[] }>({ list: [] });

/** Remove one toast, e.g. when its card is tapped closed. */
export function dismissToast(id: number) {
  toastState.list = dropToast(toastState.list, id);
}

/** Show a toast and dismiss it automatically after its kind's duration. */
export function showToast(
  kind: ToastKind,
  message: string,
  options: { action?: ToastAction; duration?: number } = {}
) {
  const id = nextId++;
  toastState.list = pushToast(toastState.list, {
    id,
    kind,
    message,
    action: options.action
  });
  if (typeof window !== "undefined") {
    setTimeout(
      () => dismissToast(id),
      options.duration ?? TOAST_DURATION[kind]
    );
  }
}

export function toastSuccess(message: string) {
  showToast("success", message);
}

export function toastError(message: string) {
  showToast("error", message);
}

/** Feedback with an "Undo"-style button that stays long enough to tap. */
export function toastAction(message: string, label: string, run: () => void) {
  showToast("success", message, {
    action: { label, run },
    duration: TOAST_UNDO_DURATION
  });
}
