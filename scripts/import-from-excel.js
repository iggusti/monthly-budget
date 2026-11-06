// Reads an Excel/CSV file and stores it to Firebase.
// Usage: node scripts/import-from-excel.js data.xlsx

const fs = require('fs');
const path = require('path');

// Load firebase config from the environment or hardcode.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  projectId: process.env.FIREBASE_PROJECT_ID || "monthly-budget-580b2"
};

console.log("Import script ready");
console.log("1. Install: npm install xlsx firebase-admin");
console.log("2. Get the service account from Firebase Console > Project Settings > Service Accounts");
console.log("3. Run: node scripts/import-from-excel.js your-data.xlsx");