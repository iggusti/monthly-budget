/**
 * Best-effort audit trail for user-triggered Firebase actions.
 *
 * Every action writes a small `notification-outbox` job of kind `activity`.
 * The scheduled sender turns it into a Telegram card, using the same device
 * list as budget changes so the person who performed the action is skipped.
 * A failed queue write is logged but never breaks the action it describes.
 */

import { auth, NOTIFICATIONS_COLLECTION, getFirestoreApi } from "./firebase";

export type ActivityAction =
  | "budget.save"
  | "budget.delete"
  | "auth.login"
  | "auth.logout"
  | "notify.enable"
  | "notify.disable"
  | "notify.language";

export type ActivityOutcome = "success" | "error";

export async function logActivity(input: {
  action: ActivityAction;
  outcome: ActivityOutcome;
  detail?: string;
  monthId?: string | null;
  editorUid?: string | null;
  error?: unknown;
}): Promise<void> {
  try {
    const { db, doc, setDoc } = await getFirestoreApi();
    const random =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const id = `${input.monthId || "activity"}-${Date.now()}-${random}`;
    await setDoc(doc(db, NOTIFICATIONS_COLLECTION, id), {
      kind: "activity",
      action: input.action,
      outcome: input.outcome,
      detail: input.detail || "",
      monthId: input.monthId || null,
      editorUid: input.editorUid ?? auth.currentUser?.uid ?? null,
      error: input.error ? String(input.error).slice(0, 300) : null,
      createdAt: new Date().toISOString(),
      status: "pending",
      attempts: 0
    });
  } catch (error) {
    console.error("Failed to queue activity notification:", error);
  }
}
