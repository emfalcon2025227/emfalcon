import { Cheque, Lease, LeaseInstallment, RentalCase, PaymentAllocation } from "../types";

/**
 * Normalizes a cheque number by trimming whitespace, removing prefixes (like #, No., Chq, شيك),
 * and stripping leading zeros from numeric strings so that '00123' and '123' match.
 */
export function normalizeChequeNumber(num?: string | number | null): string {
  if (num === undefined || num === null) return "";
  let s = String(num).trim();
  if (!s) return "";

  // Remove common prefixes
  s = s.replace(/^(#|no\.?|chq[-\s]?|cheque[-\s]?|شيك[-\s]?|\s)+/i, "").trim();

  // If the remaining string is purely digits, strip leading zeros (but keep "0" if all zeros)
  if (/^\d+$/.test(s)) {
    s = s.replace(/^0+/, "");
    if (s === "") s = "0";
  }

  return s.toLowerCase();
}

/**
 * Checks if two cheque numbers match under normalization.
 */
export function isSameChequeNumber(
  a?: string | number | null,
  b?: string | number | null
): boolean {
  if (!a || !b) return false;
  const strA = String(a).trim();
  const strB = String(b).trim();
  if (strA === strB) return true;

  const normA = normalizeChequeNumber(a);
  const normB = normalizeChequeNumber(b);
  if (normA && normB && normA === normB) return true;

  return false;
}

/**
 * Finds the linked Cheque record for a specific lease installment using a robust multi-tier lookup.
 * Follows replacement chains for replaced cheques and prioritizes active instruments.
 */
export function findLinkedChequeForInstallment(
  chequesList: Cheque[],
  inst: {
    installmentNumber?: number;
    chequeId?: string;
    chequeNumber?: string;
    dueDate?: string;
    amount?: number;
  },
  lease: {
    id: string;
    leaseNumber?: string;
    tenantId?: string;
    propertyId?: string;
    unitId?: string;
  }
): Cheque | undefined {
  if (!chequesList || chequesList.length === 0 || !inst) return undefined;

  const isNonTerminal = (c: Cheque) => c.status !== "REPLACED" && c.status !== "CANCELLED";

  // Priority 1: Direct Cheque ID match
  if (inst.chequeId) {
    const byId = chequesList.find((c) => c.id === inst.chequeId);
    if (byId) {
      // If this cheque was replaced, resolve to its active replacement if available
      if (byId.status === "REPLACED" && byId.replacementChequeIds && byId.replacementChequeIds.length > 0) {
        const activeRep = chequesList.find(
          (c) => byId.replacementChequeIds!.includes(c.id) && isNonTerminal(c)
        );
        if (activeRep) return activeRep;
      }
      return byId;
    }
  }

  const normInst = normalizeChequeNumber(inst.chequeNumber);

  // Priority 2: Same lease + Cheque Number match (active first)
  if (normInst) {
    const leaseMatches = chequesList.filter(
      (c) =>
        (c.leaseId === lease.id || (lease.leaseNumber && c.leaseId === lease.leaseNumber)) &&
        isSameChequeNumber(c.chequeNumber, inst.chequeNumber)
    );
    const active = leaseMatches.find(isNonTerminal);
    if (active) return active;
    if (leaseMatches.length > 0) return leaseMatches[0];
  }

  // Priority 3: Same tenant + Property + Cheque Number match (active first)
  if (normInst) {
    const propMatches = chequesList.filter(
      (c) =>
        c.tenantId === lease.tenantId &&
        c.propertyId === lease.propertyId &&
        isSameChequeNumber(c.chequeNumber, inst.chequeNumber)
    );
    const active = propMatches.find(isNonTerminal);
    if (active) return active;
    if (propMatches.length > 0) return propMatches[0];
  }

  // Priority 4: Same tenant + Cheque Number match (active first)
  if (normInst) {
    const tenantMatches = chequesList.filter(
      (c) =>
        c.tenantId === lease.tenantId &&
        isSameChequeNumber(c.chequeNumber, inst.chequeNumber)
    );
    const active = tenantMatches.find(isNonTerminal);
    if (active) return active;
    if (tenantMatches.length > 0) return tenantMatches[0];
  }

  // Priority 5: Cheque Number match anywhere (e.g. unassigned leaseId, active first)
  if (normInst) {
    const numMatches = chequesList.filter((c) => isSameChequeNumber(c.chequeNumber, inst.chequeNumber));
    const active = numMatches.find(isNonTerminal);
    if (active) return active;
    if (numMatches.length > 0) return numMatches[0];
  }

  // Priority 6: Same Lease + due date and amount match (active first)
  const leaseDueMatches = chequesList.filter(
    (c) =>
      (c.leaseId === lease.id || (lease.leaseNumber && c.leaseId === lease.leaseNumber)) &&
      (c.dueDate === inst.dueDate || c.chequeDate === inst.dueDate) &&
      Math.abs((c.amount || 0) - (inst.amount || 0)) < 1.0
  );
  const activeDue = leaseDueMatches.find(isNonTerminal);
  if (activeDue) return activeDue;
  if (leaseDueMatches.length > 0) return leaseDueMatches[0];

  // Priority 7: Same Tenant + Same Property + dueDate + amount
  const tenantMetaMatches = chequesList.filter(
    (c) =>
      c.tenantId === lease.tenantId &&
      c.propertyId === lease.propertyId &&
      (c.dueDate === inst.dueDate || c.chequeDate === inst.dueDate) &&
      Math.abs((c.amount || 0) - (inst.amount || 0)) < 1.0
  );
  const activeTenantMeta = tenantMetaMatches.find(isNonTerminal);
  if (activeTenantMeta) return activeTenantMeta;
  if (tenantMetaMatches.length > 0) return tenantMetaMatches[0];

  return undefined;
}

/**
 * Finds the corresponding lease and installment index for a given cheque.
 */
export function findMatchingLeaseAndInstallment(
  leasesList: Lease[],
  cheque: Cheque
): { lease: Lease; installmentIndex: number; installment: LeaseInstallment } | undefined {
  if (!leasesList || leasesList.length === 0 || !cheque) return undefined;

  // 1. Check direct leaseId match first
  if (cheque.leaseId) {
    const directLease = leasesList.find(
      (l) => l.id === cheque.leaseId || l.leaseNumber === cheque.leaseId
    );
    if (directLease && directLease.installments && directLease.installments.length > 0) {
      const idx = directLease.installments.findIndex(
        (inst) =>
          inst.chequeId === cheque.id ||
          isSameChequeNumber(inst.chequeNumber, cheque.chequeNumber) ||
          (inst.dueDate === cheque.dueDate && Math.abs(inst.amount - cheque.amount) < 1.0)
      );
      if (idx !== -1) {
        return { lease: directLease, installmentIndex: idx, installment: directLease.installments[idx] };
      }
      // If index not found but lease matches, pick by amount and due date or first matching
      const fuzzyIdx = directLease.installments.findIndex(
        (inst) => inst.dueDate === cheque.dueDate || Math.abs(inst.amount - cheque.amount) < 1.0
      );
      if (fuzzyIdx !== -1) {
        return { lease: directLease, installmentIndex: fuzzyIdx, installment: directLease.installments[fuzzyIdx] };
      }
      return { lease: directLease, installmentIndex: 0, installment: directLease.installments[0] };
    }
  }

  // 2. Check across all leases by matching tenant and cheque number
  for (const l of leasesList) {
    if (!l.installments || l.installments.length === 0) continue;
    const isTenantMatch = l.tenantId === cheque.tenantId;
    const isPropMatch = !cheque.propertyId || l.propertyId === cheque.propertyId;

    if (isTenantMatch || isPropMatch) {
      const idx = l.installments.findIndex(
        (inst) =>
          inst.chequeId === cheque.id ||
          isSameChequeNumber(inst.chequeNumber, cheque.chequeNumber)
      );
      if (idx !== -1) {
        return { lease: l, installmentIndex: idx, installment: l.installments[idx] };
      }
    }
  }

  // 3. Fallback: match by cheque number on any lease
  if (cheque.chequeNumber) {
    for (const l of leasesList) {
      if (!l.installments || l.installments.length === 0) continue;
      const idx = l.installments.findIndex((inst) =>
        isSameChequeNumber(inst.chequeNumber, cheque.chequeNumber)
      );
      if (idx !== -1) {
        return { lease: l, installmentIndex: idx, installment: l.installments[idx] };
      }
    }
  }

  return undefined;
}

/**
 * Checks whether a given cheque is associated with an active rental legal case.
 */
export function isChequeInActiveCase(chequeOrId: string | Cheque, cases: RentalCase[] = []): boolean {
  if (!chequeOrId || !cases || cases.length === 0) return false;
  const chequeId = typeof chequeOrId === "string" ? chequeOrId : chequeOrId.id;
  if (!chequeId) return false;

  return cases.some((c) => {
    if (c.status === "CLOSED" || c.status === "ARCHIVED" || c.status === "SETTLED") return false;
    const isDirectMatch = (c as any).chequeId === chequeId;
    const isLinkedMatch = Array.isArray(c.linkedChequeIds) && c.linkedChequeIds.includes(chequeId);
    return isDirectMatch || isLinkedMatch;
  });
}

/**
 * Checks whether a cheque is bounced and has not yet been converted to a legal case.
 */
export function isBouncedWithoutLegalAction(cheque: Cheque, cases: RentalCase[] = []): boolean {
  if (!cheque) return false;
  const isBounced = cheque.status === "BOUNCED" || cheque.originalStatus === "BOUNCED";
  if (!isBounced) return false;
  if (
    cheque.status === "COLLECTED" ||
    cheque.status === "CLEARED" ||
    (cheque.outstanding !== undefined && cheque.outstanding <= 0.01)
  ) {
    return false;
  }
  return !isChequeInActiveCase(cheque.id, cases);
}

/**
 * Computes remaining outstanding amount on a cheque taking into account active payment allocations.
 */
export function getChequeOutstanding(
  cheque: Cheque,
  paymentAllocations: PaymentAllocation[] = []
): number {
  if (!cheque) return 0;
  if (cheque.status === "COLLECTED" || cheque.status === "CLEARED") return 0;
  if (!paymentAllocations || paymentAllocations.length === 0) {
    return cheque.outstanding !== undefined ? cheque.outstanding : cheque.amount;
  }
  const allocs = paymentAllocations.filter((pa) => pa.targetId === cheque.id && pa.status === "ACTIVE");
  const allocatedSum = allocs.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
  const remaining = Math.max(0, cheque.amount - allocatedSum);
  return remaining;
}
