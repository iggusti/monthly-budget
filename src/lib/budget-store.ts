import {
  db,
  BUDGET_COLLECTION,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc
} from "./firebase";
import { normalizeBudget, type MonthBudget } from "./types";

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

/** Fetch every stored budget, newest first. */
export async function fetchAllBudgets(): Promise<MonthBudget[]> {
  try {
    const snapshot = await getDocs(collection(db, BUDGET_COLLECTION));
    return snapshot.docs
      .map((entry) => normalizeBudget(entry.id, entry.data() as Partial<MonthBudget>))
      .sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    console.error("Failed to load budgets:", error);
    return [];
  }
}

/** Persist a budget, stamping the update time. */
export async function saveBudget(budget: MonthBudget): Promise<void> {
  const payload: MonthBudget = {
    ...budget,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, BUDGET_COLLECTION, budget.id), payload, { merge: true });
}

/** Permanently delete a budget. */
export async function deleteBudget(id: string): Promise<void> {
  await deleteDoc(doc(db, BUDGET_COLLECTION, id));
}
