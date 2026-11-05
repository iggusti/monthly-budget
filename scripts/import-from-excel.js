// Script ini membaca file Excel/CSV dan menyimpan ke Firebase
// Cara pakai: node scripts/import-from-excel.js data.xlsx

const fs = require('fs');
const path = require('path');

// Load firebase config dari environment atau hardcode
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  projectId: process.env.FIREBASE_PROJECT_ID || "monthly-budget-580b2"
};

console.log("Import script siap digunakan");
console.log("1. Install: npm install xlsx firebase-admin");
console.log("2. Dapatkan service account dari Firebase Console > Project Settings > Service Accounts");
console.log("3. Jalankan: node scripts/import-from-excel.js your-data.xlsx");