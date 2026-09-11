import { runTransaction, doc, Firestore } from "firebase/firestore";

/**
 * Atomically allocates the next N sequence numbers for a given prefix.
 * Stores state in system_counters/{sequenceName}.
 */
export const allocateNextSequence = async (
  db: Firestore,
  sequenceName: string,
  prefix: string,
  count: number = 1,
  padding: number = 5,
  fallbackInitial: number = 0
): Promise<string[]> => {
  return await runTransaction(db, async (t) => {
    const counterRef = doc(db, "system_counters", sequenceName);
    const snap = await t.get(counterRef);
    let current = snap.exists() ? snap.data().lastValue || 0 : 0;
    
    // If this is the very first time the counter is used, seed it safely
    if (current === 0 && fallbackInitial > 0) {
      current = fallbackInitial;
    }
    
    const allocated: string[] = [];
    for (let i = 0; i < count; i++) {
      current += 1;
      allocated.push(`${prefix}${String(current).padStart(padding, "0")}`);
    }
    
    t.set(counterRef, { lastValue: current }, { merge: true });
    return allocated;
  });
};
