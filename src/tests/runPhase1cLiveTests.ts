import { db } from "../lib/firebase";
import { runTransaction, doc, writeBatch, getDoc } from "firebase/firestore";

async function testIdempotencyLock() {
  const idempotencyKey = "test-lock-" + Date.now();
  console.log(`Starting Idempotency Lock Test with key ${idempotencyKey}`);

  // Simulate two concurrent unified payment requests
  const req1 = runTransaction(db, async (t) => {
    const lockRef = doc(db, "idempotency_locks", idempotencyKey);
    const snap = await t.get(lockRef);
    if (snap.exists()) {
      throw new Error("Duplicate submission");
    }
    t.set(lockRef, { timestamp: Date.now() });
    
    // Simulate setting a collection
    t.set(doc(db, "collections", `col-${idempotencyKey}`), { amount: 1000, test: true });
    return true;
  });

  const req2 = runTransaction(db, async (t) => {
    const lockRef = doc(db, "idempotency_locks", idempotencyKey);
    const snap = await t.get(lockRef);
    if (snap.exists()) {
      throw new Error("Duplicate submission");
    }
    t.set(lockRef, { timestamp: Date.now() });
    
    // Simulate setting a collection
    t.set(doc(db, "collections", `col-${idempotencyKey}`), { amount: 1000, test: true });
    return true;
  });

  try {
    const results = await Promise.allSettled([req1, req2]);
    const successes = results.filter(r => r.status === "fulfilled").length;
    const failures = results.filter(r => r.status === "rejected").length;
    
    console.log(`[PASS] Idempotency: Successes=${successes}, Failures=${failures}`);
    if (successes !== 1 || failures !== 1) {
      console.error("[FAIL] Idempotency Test: Both succeeded or both failed!");
      return false;
    }
    
    // Verify it was actually written
    const snap = await getDoc(doc(db, "collections", `col-${idempotencyKey}`));
    if (snap.exists()) {
      console.log("[PASS] Data persisted correctly.");
    } else {
      console.error("[FAIL] Data not found.");
      return false;
    }
  } catch (err) {
    console.error("[FAIL] Unexpected error", err);
    return false;
  }
  return true;
}

async function testAllocateNextSequence() {
  const { allocateNextSequence } = await import("../utils/sequenceGenerator");
  const year = new Date().getFullYear();
  const sequenceName = "test_sequence_" + Date.now();
  
  const seq1 = allocateNextSequence(db, sequenceName, "JE-", 1, 5);
  const seq2 = allocateNextSequence(db, sequenceName, "JE-", 1, 5);
  
  const [res1, res2] = await Promise.all([seq1, seq2]);
  console.log(`[PASS] Sequences allocated concurrently: ${res1[0]}, ${res2[0]}`);
  if (res1[0] === res2[0]) {
    console.error("[FAIL] Duplicate sequence allocated!");
    return false;
  }
  return true;
}

async function main() {
  console.log("=================================================");
  console.log("PHASE 1C: FIREBASE LIVE INTEGRITY TESTS");
  console.log("=================================================");
  
  let allPassed = true;
  allPassed = await testIdempotencyLock() && allPassed;
  allPassed = await testAllocateNextSequence() && allPassed;

  if (allPassed) {
    console.log("ALL LIVE TESTS PASSED.");
    process.exit(0);
  } else {
    console.error("SOME TESTS FAILED.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
