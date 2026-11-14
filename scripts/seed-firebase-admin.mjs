import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./admin-app.mjs";

initAdmin();
const db = getFirestore();

const budgetData = {
  "2026-01": {
    title: "January 2026",
    period: "25 January – 24 February",
    totalHusbandIncome: 5500000,
    totalWifeIncome: 4100000,
    husbandExpenses: [
      { id: 1, name: "Bayar Air Ciparay", amount: 80000 },
      { id: 2, name: "Bayar Listrik Ciparay", amount: 150000 }
    ],
    wifeExpenses: [
      { id: 1, name: "Untuk Orang Tua", amount: 1500000 },
      { id: 2, name: "Koperasi", amount: 350000 }
    ],
    dailyExpenses: [
      { id: 1, name: "Car Free Day", amount: 200000, method: "BNI" }
    ],
    savingsWithdrawals: []
  },
  "2026-05": {
    title: "May 2026",
    period: "25 May – 24 June",
    totalHusbandIncome: 1477000,
    totalWifeIncome: 0,
    husbandExpenses: [],
    wifeExpenses: [],
    dailyExpenses: [
      { id: 1, name: "Sedekah Jariyah", amount: 30000, method: "Auto Donate" }
    ],
    savingsWithdrawals: [
      { id: 1, name: "Kondangan Rizal", amount: 150000 }
    ]
  }
};

async function seed() {
  console.log("Seeding budget data to Firebase...");
  for (const [id, data] of Object.entries(budgetData)) {
    await db.collection("budget").doc(id).set(data, { merge: true });
    console.log(`✓ ${id}`);
  }
  console.log("Done!");
}

seed().catch(e => console.error(e));