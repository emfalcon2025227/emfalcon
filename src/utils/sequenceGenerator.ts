import { runTransaction, doc, Firestore, Transaction } from "firebase/firestore";

interface TxSequenceState {
  counters: Map<string, number>;
  pendingWrites: Map<string, () => void>;
}

// Transaction state registry to guarantee Firestore read-before-write invariants and atomic commits
const txStateRegistry = new WeakMap<Transaction, TxSequenceState>();

function getTxState(tx: Transaction): TxSequenceState {
  let state = txStateRegistry.get(tx);
  if (!state) {
    state = { counters: new Map(), pendingWrites: new Map() };
    txStateRegistry.set(tx, state);
  }
  return state;
}

export function queueTransactionWrite(tx: Transaction, writeFn: () => void): void {
  const state = getTxState(tx);
  state.pendingWrites.set(String(state.pendingWrites.size), writeFn);
}

export function flushTransactionWrites(tx: Transaction): void {
  const state = txStateRegistry.get(tx);
  if (state) {
    for (const writeFn of state.pendingWrites.values()) {
      writeFn();
    }
    state.pendingWrites.clear();
  }
}

/**
 * Transaction-aware sequence number allocation.
 * Reads the sequence document inside the active transaction during the READ phase (caching for repeated calls within the same transaction),
 * and defers the write to the WRITE phase via flushTransactionWrites to strictly preserve Firestore read-before-write invariants.
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
  const state = getTxState(transaction);
  let current: number;

  if (state.counters.has(sequenceName)) {
    current = state.counters.get(sequenceName)!;
  } else {
    const counterRef = doc(db, "system_counters", sequenceName);
    const snap = await transaction.get(counterRef);
    current = snap.exists() ? snap.data().lastValue || 0 : 0;

    if (current === 0 && fallbackInitial > 0) {
      current = fallbackInitial;
    }
  }

  const allocated: string[] = [];
  for (let i = 0; i < count; i++) {
    current += 1;
    allocated.push(`${prefix}${String(current).padStart(padding, "0")}`);
  }

  state.counters.set(sequenceName, current);

  const counterRef = doc(db, "system_counters", sequenceName);
  state.pendingWrites.set(sequenceName, () => {
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
