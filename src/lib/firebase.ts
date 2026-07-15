// src/lib/firebase.ts
// Firebase CLIENT SDK initialization.
// Single source of truth for: app, auth, db (client-side Firestore).
// All domain types live in @/lib/types — not here.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore }                    from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

// ─── Environment Variable Validation ─────────────────────────────────────────
// Fails immediately at module load with a clear, descriptive error.
// Prevents cryptic Firebase SDK errors caused by missing env vars in production.

const REQUIRED_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_FIREBASE_API_KEY:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingVars = Object.entries(REQUIRED_ENV)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(
    `[Firebase Client] Missing required environment variables:\n${missingVars.join("\n")}\n` +
    "Ensure these are set in your .env.local file and in your deployment environment."
  );
}

// ─── Firebase App Initialization ──────────────────────────────────────────────
// Singleton pattern: safe for Next.js hot-reload and multi-import scenarios.

const firebaseConfig = {
  apiKey:            REQUIRED_ENV.NEXT_PUBLIC_FIREBASE_API_KEY            as string,
  authDomain:        REQUIRED_ENV.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        as string,
  projectId:         REQUIRED_ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID         as string,
  storageBucket:     REQUIRED_ENV.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: REQUIRED_ENV.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             REQUIRED_ENV.NEXT_PUBLIC_FIREBASE_APP_ID             as string,
};

const app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Google Auth Provider ─────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  app,
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
};

export type { User };