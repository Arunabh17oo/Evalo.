import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Real Firebase configuration provided by the user
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDocBuKp6odhChwI03_aCtq_aBJaL9sqv4",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "evalo-9db2b.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "evalo-9db2b",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "evalo-9db2b.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "871613404833",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:871613404833:web:0dba08b4d777431bdbc2e0",
    measurementId: "G-3888HLB1TW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
