import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection
} from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  authDomain: "monthly-budget-580b2.firebaseapp.com",
  projectId: "monthly-budget-580b2",
  storageBucket: "monthly-budget-580b2.firebasestorage.app",
  messagingSenderId: "276706600878",
  appId: "1:276706600878:web:0d8914bd9e8ecbc4048a3f",
  measurementId: "G-CQM5K87C7K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const BUDGET_COLLECTION = "budget";

export {
  db,
  auth,
  app,
  BUDGET_COLLECTION,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection
};
