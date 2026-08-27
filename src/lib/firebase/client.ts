"use client";

// Client-side Firebase is used for AUTHENTICATION ONLY (sign-in, password
// change). All data access happens server-side through the Admin SDK —
// Firestore security rules deny every client read/write.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

export function firebaseApp() {
  return getApps().length ? getApp() : initializeApp(config);
}

export function firebaseAuth() {
  return getAuth(firebaseApp());
}
