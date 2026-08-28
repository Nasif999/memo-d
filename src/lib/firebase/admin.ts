import "server-only";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function adminApp() {
  if (getApps().length) return getApp();
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON!
  );
  return initializeApp({ credential: cert(serviceAccount) });
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function db() {
  const firestore = getFirestore(adminApp());
  try {
    firestore.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if called twice — safe to ignore
  }
  return firestore;
}
