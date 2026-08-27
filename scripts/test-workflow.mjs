// Ad-hoc verification of workflow authorization rules against the live
// Firestore project. Run: node scripts/test-workflow.mjs <memoId>

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

const memoId = process.argv[2];
if (!memoId) { console.error("usage: node scripts/test-workflow.mjs <memoId>"); process.exit(1); }

async function profileByEmail(email) {
  const snap = await db.collection("profiles").where("email", "==", email).get();
  if (snap.empty) throw new Error(`no profile for ${email}`);
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function state() {
  const memo = (await db.collection("memos").doc(memoId).get()).data();
  const steps = (await db.collection("memos").doc(memoId).collection("steps").get())
    .docs.map((d) => d.data()).sort((a, b) => a.order - b.order);
  return { status: memo.status, currentStepOrder: memo.currentStepOrder,
           steps: steps.map((s) => `${s.order}:${s.status}`).join(" ") };
}

const results = [];
function check(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// Replicates the turn-check in performWorkflowActionTx.
async function tryAction(actor, action) {
  const memoRef = db.collection("memos").doc(memoId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(memoRef);
    const memo = snap.data();
    if (memo.orgId !== actor.orgId) throw new Error("cross-organization access denied");
    if (!["Pending Approval", "Pending Review", "Submitted"].includes(memo.status))
      throw new Error(`memo not awaiting action (status: ${memo.status})`);
    const stepsSnap = await tx.get(memoRef.collection("steps"));
    const steps = stepsSnap.docs.map((d) => ({ ref: d.ref, ...d.data() }))
      .sort((a, b) => a.order - b.order);
    const current = steps.find((s) => s.order === memo.currentStepOrder && s.status === "Active");
    if (!current) throw new Error("no active workflow step");
    if (current.assignedUserId !== actor.id) throw new Error("it is not your turn to act on this memo");
    return "allowed";
  });
}

const bob = await profileByEmail("bob@acme.example");
const carol = await profileByEmail("carol@acme.example");
const dave = await profileByEmail("dave@acme.example");
const erin = await profileByEmail("erin@acme.example");
const henry = await profileByEmail("henry@globex.example");

console.log("initial state:", await state(), "\n");

// 1. Out-of-turn participant (step 3) must be rejected while step 1 is active.
try {
  await tryAction(erin, "approve");
  check("out-of-turn participant blocked (Erin @ step 3)", false, "action was ALLOWED");
} catch (e) {
  check("out-of-turn participant blocked (Erin @ step 3)",
    e.message.includes("not your turn"), e.message);
}

// 2. Next-in-line participant (step 2) must also be blocked.
try {
  await tryAction(dave, "approve");
  check("next-in-line participant blocked (Dave @ step 2)", false, "action was ALLOWED");
} catch (e) {
  check("next-in-line participant blocked (Dave @ step 2)",
    e.message.includes("not your turn"), e.message);
}

// 3. Author who is not a participant must be blocked.
try {
  await tryAction(bob, "approve");
  check("non-participant author blocked (Bob)", false, "action was ALLOWED");
} catch (e) {
  check("non-participant author blocked (Bob)", e.message.includes("not your turn"), e.message);
}

// 4. Cross-org user must be blocked before any workflow logic runs.
try {
  await tryAction(henry, "approve");
  check("cross-org user blocked (Henry @ Globex)", false, "action was ALLOWED");
} catch (e) {
  check("cross-org user blocked (Henry @ Globex)",
    e.message.includes("cross-organization"), e.message);
}

// 5. The current assignee must be allowed.
try {
  const r = await tryAction(carol, "approve");
  check("current assignee allowed (Carol @ step 1)", r === "allowed");
} catch (e) {
  check("current assignee allowed (Carol @ step 1)", false, e.message);
}

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
