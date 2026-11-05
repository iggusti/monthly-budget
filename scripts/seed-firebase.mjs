import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  authDomain: "monthly-budget-580b2.firebaseapp.com",
  projectId: "monthly-budget-580b2",
  storageBucket: "monthly-budget-580b2.firebasestorage.app",
  messagingSenderId: "276706600878",
  appId: "1:276706600878:web:0d8914bd9e8ecbc4048a3f",
  measurementId: "G-CQM5K87C7K"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Budget data to seed
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

async function seedData() {
  console.log("🌱 Seeding budget data to Firebase...");
  
  for (const [monthId, data] of Object.entries(budgetData)) {
    await setDoc(doc(db, "budget", monthId), data, { merge: true });
    console.log(`✓ Saved: ${monthId}`);
  }
  
  console.log("✅ All data synced to Firebase!");
  process.exit(0);
}

seedData().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});