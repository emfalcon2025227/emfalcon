import { runTransaction, doc, Firestore, Transaction } from "firebase/firestore";

// Transaction pending write registry to guarantee Firestore read-before-write invariants
const pendingTxWrites = new WeakMap<Transaction, Array<() => void>>();

export function queueTransactionWrite(tx: Transaction, writeFn: () => void): void {
  let list = pendingTxWrites.get(tx);
  if (!list) {
    list = [];
    pendingTxWrites.set(tx, list);
  }
  list.push(writeFn);
}

export function flushTransactionWrites(tx: Transaction): void {
  const list = pendingTxWrites.get(tx);
  if (list) {
    for (const writeFn of list) {
      writeFn();
    }
    pendingTxWrites.delete(tx);
  }
}

/**
 * Transaction-aware sequence number allocation.
 * Performs the sequence document read inside the active transaction during the READ phase,
 * and defers the write to the WRITE phase to strictly preserve Firestore read-before-write invariants.
 */
export const allocateNextSequenceInTransaction = async (
  transaction: Transaction,
  db: Firestore,
  sequenceName: string,
  prefix: string,
  count: number = 1,
  padding: number = 5,
  fallbackInitial: number = 0
): Promise<string[]> => {
  const counterRef = doc(db, "system_counters", sequenceName);
  const snap = await transaction.get(counterRef);
  let current = snap.exists() ? snap.data().lastValue || 0 : 0;

  if (current === 0 && fallbackInitial > 0) {
    current = fallbackInitial;
  }

  const allocated: string[] = [];
  for (let i = 0; i < count; i++) {
    current += 1;
    allocated.push(`${prefix}${String(current).padStart(padding, "0")}`);
  }

  // Queue write to be committed atomically in the write phase of this same transaction
  queueTransactionWrite(transaction, () => {
    transaction.set(counterRef, { lastValue: current }, { merge: true });
  });

  return allocated;
};

/**
 * Atomically allocates the next N sequence numbers for a given prefix in a standalone transaction.
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
    const allocated = await allocateNextSequenceInTransaction(
      t,
      db,
      sequenceName,
      prefix,
      count,
      padding,
      fallbackInitial
    );
    flushTransactionWrites(t);
    return allocated;
  });
};
