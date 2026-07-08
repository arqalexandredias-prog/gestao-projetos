import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAJknPCUNsHIpot5dBIh28fSWS-7Zan60E",
  authDomain: "gestao-projetos-bad35.firebaseapp.com",
  projectId: "gestao-projetos-bad35",
  storageBucket: "gestao-projetos-bad35.firebasestorage.app",
  messagingSenderId: "645787348477",
  appId: "1:645787348477:web:ec734252e0774d2b4c7d94",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
