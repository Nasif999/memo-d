// Gives every existing organization a join code. Organizations created before
// the join feature have none; new ones get one at registration.
// Usage:  node scripts/backfill-join-codes.mjs

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
const db = getFirestore();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rand = (n) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

const snap = await db.collection("orgs").get();
for (const doc of snap.docs) {
  const org = doc.data();
  if (org.joinCode) {
    console.log(`skip  ${org.name} — already has ${org.joinCode}`);
    continue;
  }
  const code = `${org.identifier}-${rand(4)}-${rand(4)}`;
  await doc.ref.update({ joinCode: code });
  console.log(`set   ${org.name} — ${code}`);
}
console.log("done");
process.exit(0);
