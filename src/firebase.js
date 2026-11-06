import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyByB8NZM3E2NzviQKPbrY3At9Vgc1JpgPM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "molqen-33dc9.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "molqen-33dc9",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "molqen-33dc9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "314815446505",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:314815446505:web:f75b5f0a61ba0ef4019f78"
};

// Standard client-side initialization
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
