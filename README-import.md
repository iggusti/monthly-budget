# How to Import Data into Firebase

## Option 1: Use the Admin Page (Easiest)
1. Open `http://localhost:5173/admin`
2. Fill in the form and click "Save to Firebase"

## Option 2: Use the Import Page
1. Open `http://localhost:5173/import`
2. Upload a CSV file or paste the data
3. Click "Import to Firebase"

## Option 3: Configure Firestore Rules

Open [Firebase Console](https://console.firebase.google.com/) > Firestore Database > Rules, then paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /budget/{document} {
      allow read, write: if true;
    }
  }
}
```

## Supported CSV Format

```
month,title,period,husbandIncome,wifeIncome,name,amount,category
2026-01,January 2026,25 Jan - 24 Feb,5500000,4100000,Bayar Air,80000,husband
2026-01,January 2026,25 Jan - 24 Feb,5500000,4100000,Koperasi,350000,wife
2026-01,January 2026,25 Jan - 24 Feb,5500000,4100000,Car Free Day,200000,daily
```
