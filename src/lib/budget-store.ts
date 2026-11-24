import {
  auth,
  BUDGET_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  getFirestoreApi
} from "./firebase";
import { normalizeBudget, type MonthBudget } from "./types";

/**
 * Queue one push job for the scheduled sender. This is best-effort: a failed
 * queue write is logged but never fails the budget write it describes.
 */
async function enqueueNotification(job: {
  monthId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  editorUid: string | null;
}): Promise<void> {
  try {
    const { db, doc, setDoc } = await getFirestoreApi();
    const random =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const id = `${job.monthId}-${Date.now()}-${random}`;
    await setDoc(doc(db, NOTIFICATIONS_COLLECTION, id), {
      ...job,
      createdAt: new Date().toISOString(),
      status: "pending",
      attempts: 0
    });
  } catch (error) {
    console.error("Failed to queue push notification:", error);
  }
}

/** Normalise query results into budgets, newest first. */
function toBudgetList(docs: { id: string; data: () => Partial<MonthBudget> }[]): MonthBudget[] {
  return docs
    .map((entry) => normalizeBudget(entry.id, entry.data()))
    .sort((a, b) => b.id.localeCompare(a.id));
}

/** Fetch a single month budget. Returns an empty (normalised) budget when missing. */
export async function fetchBudget(id: string): Promise<MonthBudget> {
  try {
    const { db, doc, getDoc } = await getFirestoreApi();
    const snapshot = await getDoc(doc(db, BUDGET_COLLECTION, id));
    if (snapshot.exists()) {
      return normalizeBudget(id, snapshot.data() as Partial<MonthBudget>);
    }
  } catch (error) {
    console.error(`Failed to load budget ${id}:`, error);
  }
  return normalizeBudget(id, undefined);
}

/**
 * Whether a budget document exists for `id`.
 *
 * Used to gate the month page: a past period that was never created has no
 * page. Waits for the anonymous session to be restored first so the read is
 * not rejected before auth is ready. On any error it reports `true` (fail
 * open) rather than hiding a page that may well hold data.
 */
export async function budgetExists(id: string): Promise<boolean> {
  try {
    await auth.authStateReady();
    const { db, doc, getDoc } = await getFirestoreApi();
    const snapshot = await getDoc(doc(db, BUDGET_COLLECTION, id));
    return snapshot.exists();
  } catch (error) {
    console.error(`Failed to check budget ${id}:`, error);
    return true;
  }
}

/** Fetch every stored budget, newest first. */
export async function fetchAllBudgets(): Promise<MonthBudget[]> {
  try {
    const { db, collection, getDocs } = await getFirestoreApi();
    const snapshot = await getDocs(collection(db, BUDGET_COLLECTION));
    return toBudgetList(snapshot.docs);
  } catch (error) {
    console.error("Failed to load budgets:", error);
    return [];
  }
}

/**
 * Live-subscribe to a single budget document. On any change (from any user)
 * the callback receives the fresh, normalised budget. Returns an unsubscribe
 * function.
 */
export async function subscribeBudget(
  id: string,
  onChange: (_budget: MonthBudget) => void
): Promise<() => void> {
  const { db, doc, onSnapshot } = await getFirestoreApi();
  return onSnapshot(
    doc(db, BUDGET_COLLECTION, id),
    (snapshot) => {
      if (snapshot.exists()) {
        onChange(normalizeBudget(id, snapshot.data() as Partial<MonthBudget>));
      } else {
        onChange(normalizeBudget(id, undefined));
      }
    },
    (error) => {
      console.error(`Failed to subscribe to budget ${id}:`, error);
    }
  );
}

/** Live-subscribe to all budget documents, newest first. Returns an unsubscribe function. */
export async function subscribeAllBudgets(
  onChange: (_budgets: MonthBudget[]) => void
): Promise<() => void> {
  const { db, collection, onSnapshot } = await getFirestoreApi();
  return onSnapshot(
    collection(db, BUDGET_COLLECTION),
    (snapshot) => {
      onChange(toBudgetList(snapshot.docs));
    },
    (error) => {
      console.error("Failed to subscribe to budgets:", error);
    }
  );
}

/**
 * Persist a budget, stamping the update time and the editor's uid.
 *
 * `lastEditBy` travels with the queued push job so the sender can skip the
 * device that made the change.
 */
export async function saveBudget(budget: MonthBudget): Promise<void> {
  const { db, doc, getDoc, setDoc } = await getFirestoreApi();
  const ref = doc(db, BUDGET_COLLECTION, budget.id);

  let before: Record<string, unknown> | null = null;
  try {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) before = snapshot.data() as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to read previous state of budget ${budget.id}:`, error);
  }

  const payload: MonthBudget = {
    ...budget,
    updatedAt: new Date().toISOString(),
    lastEditBy: auth.currentUser?.uid ?? null
  };
  await setDoc(ref, payload, { merge: true });

  await enqueueNotification({
    monthId: budget.id,
    before,
    after: payload as unknown as Record<string, unknown>,
    editorUid: payload.lastEditBy ?? null
  });
}

/** Permanently delete a budget. */
export async function deleteBudget(id: string): Promise<void> {
  const { db, doc, getDoc, setDoc, deleteDoc } = await getFirestoreApi();
  const ref = doc(db, BUDGET_COLLECTION, id);
  const uid = auth.currentUser?.uid ?? null;

  let before: Record<string, unknown> | null = null;
  try {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) before = snapshot.data() as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to read budget ${id} before deletion:`, error);
  }

  // Stamp the deleter first: the sender only sees the queued snapshot, so it
  // needs this to know whose phone to skip.
  if (uid) {
    try {
      await setDoc(
        ref,
        { lastEditBy: uid, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (error) {
      console.error("Failed to stamp budget deletion:", error);
    }
  }

  await deleteDoc(ref);

  await enqueueNotification({ monthId: id, before, after: null, editorUid: uid });
}
