# Cara Import Data ke Firebase

## Opsi 1: Pakai Halaman Admin (Paling Mudah)
1. Buka `http://localhost:5173/admin`
2. Isi form dan klik "Save to Firebase"

## Opsi 2: Pakai Halaman Import
1. Buka `http://localhost:5173/import`
2. Upload file CSV atau paste data
3. Klik "Import to Firebase"

## Opsi 3: Konfigurasi Firestore Rules

Buka [Firebase Console](https://console.firebase.google.com/) > Firestore Database > Rules, lalu paste:

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

## Format CSV yang Didukung

```
month,title,period,husbandIncome,wifeIncome,name,amount,category
2026-01,January 2026,25 Jan - 24 Feb,5500000,4100000,Bayar Air,80000,husband
2026-01,January 2026,25 Jan - 24 Feb,5500000,4100000,Koperasi,350000,wife
2026-01,January 2026,25 Jan - 24 Feb,5500000,4100000,Car Free Day,200000,daily
```