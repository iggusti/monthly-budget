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
  type Toast,
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
export function showToast(kind: ToastKind, message: string) {
  const id = nextId++;
  toastState.list = pushToast(toastState.list, { id, kind, message });
  if (typeof window !== "undefined") {
    setTimeout(() => dismissToast(id), TOAST_DURATION[kind]);
  }
}

/** Confirm that a change was saved. */
export function toastSuccess(message: string) {
  showToast("success", message);
}

/** Report that a change could not be saved. */
export function toastError(message: string) {
  showToast("error", message);
}
