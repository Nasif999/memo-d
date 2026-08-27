// Seeds two demo organizations with users, departments, and categories.
// Usage:  node scripts/seed.mjs      (reads .env.local)

import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Minimal .env.local loader (no dependency needed)
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

const PASSWORD = "Passw0rd!";

async function createUser(email, orgId, fullName, designation, departmentId, role) {
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`  user exists: ${email}`);
  } catch {
    const created = await auth.createUser({
      email,
      password: PASSWORD,
      displayName: fullName,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`  created user: ${email}`);
  }
  await db.collection("profiles").doc(uid).set({
    orgId,
    fullName,
    email,
    designation,
    departmentId,
    role,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  });
  return uid;
}

async function createOrg(name, identifier, contactEmail) {
  const existing = await db
    .collection("orgs")
    .where("identifier", "==", identifier)
    .get();
  if (!existing.empty) {
    console.log(`org exists: ${name}`);
    return existing.docs[0].id;
  }
  const ref = await db.collection("orgs").add({
    name,
    identifier,
    logoUrl: null,
    contactEmail,
    contactPhone: null,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`created org: ${name}`);
  return ref.id;
}

async function createDept(orgId, name, description) {
  const ref = await db.collection("departments").add({
    orgId, name, description, isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function createCategories(orgId, names) {
  for (const name of names) {
    await db.collection("categories").add({
      orgId, name, description: null, isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

async function main() {
  console.log("Seeding Acme Corporation…");
  const acme = await createOrg("Acme Corporation", "ACME", "info@acme.example");
  const admin_dept = await createDept(acme, "Administration", "Admin dept");
  const finance = await createDept(acme, "Finance", "Finance dept");
  const engineering = await createDept(acme, "Engineering", "Engineering dept");
  await createCategories(acme, [
    "Administrative", "Financial", "Procurement", "HR", "Technical", "General",
  ]);
  await createUser("admin@acme.example", acme, "Alice Admin", "Administrator", admin_dept, "org_admin");
  await createUser("bob@acme.example", acme, "Bob Employee", "Engineer", engineering, "user");
  await createUser("carol@acme.example", acme, "Carol Head", "Department Head", engineering, "user");
  await createUser("dave@acme.example", acme, "Dave Finance", "Finance Manager", finance, "user");
  await createUser("erin@acme.example", acme, "Erin Director", "Director", admin_dept, "user");

  console.log("Seeding Globex Industries…");
  const globex = await createOrg("Globex Industries", "GLOBEX", "info@globex.example");
  const ops = await createDept(globex, "Operations", "Ops dept");
  await createDept(globex, "HR", "HR dept");
  await createCategories(globex, ["Administrative", "Financial", "General"]);
  await createUser("admin@globex.example", globex, "Grace Admin", "Administrator", ops, "org_admin");
  await createUser("henry@globex.example", globex, "Henry Ops", "Operations Lead", ops, "user");

  console.log(`\nDone. All demo accounts use password: ${PASSWORD}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
