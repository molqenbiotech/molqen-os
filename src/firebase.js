import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAH0vjXgnEwR8lqTvw5y5b5_OvlwYFvzJ0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "labnexus-pk.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "labnexus-pk",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "labnexus-pk.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "230428084232",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:230428084232:web:a6dba53d03dc7db685e9bd"
};

// Standard client-side initialization
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();