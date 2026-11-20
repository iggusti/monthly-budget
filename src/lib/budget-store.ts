import {
  db,
  auth,
  BUDGET_COLLECTION,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot
} from "./firebase";
import { normalizeBudget, type MonthBudget } from "./types";

/** Normalise query results into budgets, newest first. */
function toBudgetList(docs: { id: string; data: () => Partial<MonthBudget> }[]): MonthBudget[] {
  return docs
    .map((entry) => normalizeBudget(entry.id, entry.data()))
    .sort((a, b) => b.id.localeCompare(a.id));
}

/** Fetch a single month budget. Returns an empty (normalised) budget when missing. */
export async function fetchBudget(id: string): Promise<MonthBudget> {
  try {
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
export function subscribeBudget(
  id: string,
  onChange: (_budget: MonthBudget) => void
): () => void {
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
export function subscribeAllBudgets(
  onChange: (_budgets: MonthBudget[]) => void
): () => void {
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
 * `lastEditBy` is what lets the push notification function avoid notifying the
 * device that made the change.
 */
export async function saveBudget(budget: MonthBudget): Promise<void> {
  const payload: MonthBudget = {
    ...budget,
    updatedAt: new Date().toISOString(),
    lastEditBy: auth.currentUser?.uid ?? null
  };
  await setDoc(doc(db, BUDGET_COLLECTION, budget.id), payload, { merge: true });
}

/** Permanently delete a budget. */
export async function deleteBudget(id: string): Promise<void> {
  const ref = doc(db, BUDGET_COLLECTION, id);
  const uid = auth.currentUser?.uid;

  // Stamp the deleter first: the delete trigger only sees the document as it
  // was just before removal, so without this the sender could not tell who
  // removed the month (and would notify the deleter's own phone).
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
}
