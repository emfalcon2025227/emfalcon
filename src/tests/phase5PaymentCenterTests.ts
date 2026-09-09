import { CollectionRecord, PaymentAllocation, Cheque, Lease, CommissionObligation } from "../types";
import { validatePaymentAllocations } from "../services/financialEngine";

export function runPhase5PaymentCenterTests(
  recordLeasePayment: any,
  reversePaymentReceipt: any,
  leases: Lease[],
  cheques: Cheque[],
  commissions: CommissionObligation[],
  collections: CollectionRecord[],
  allocations: PaymentAllocation[]
) {
  console.log("=========================================");
  console.log("PHASE 5: CONTRACT PAYMENT CENTER E2E TEST");
  console.log("=========================================");

  let passed = 0;
  let total = 0;
  const assert = (condition: boolean, msg: string) => {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
    }
  };

  if (leases.length === 0) {
    console.error("No leases available to run tests.");
    return { passed, total };
  }

  const lease = leases[0];
  const inst1 = lease.installments?.[0];
  if (!inst1) {
    console.warn("Lease has no installments to test.");
    return { passed, total };
  }

  // 1. Validation Logic checks
  assert(validatePaymentAllocations(1000, [{ targetType: "LEASE_INSTALLMENT", targetId: "test", allocatedAmount: 500 }]).isValid === true, "Partial allocation is valid");
  assert(validatePaymentAllocations(1000, [{ targetType: "LEASE_INSTALLMENT", targetId: "test", allocatedAmount: 1500 }]).isValid === false, "Over allocation is invalid");

  // 2. Full payment against single target (Bank Transfer)
  const p1 = recordLeasePayment({
    leaseId: lease.id,
    amount: inst1.amount,
    paymentMethod: "BANK_TRANSFER",
    payerName: "E2E Test Payer",
    paymentDate: new Date().toISOString().split("T")[0],
    allocations: [{ targetType: "LEASE_INSTALLMENT", targetId: `${lease.id}:1`, amount: inst1.amount }]
  });
  assert(p1.success === true, "Successfully recorded full installment payment via Bank Transfer");
  assert(p1.receipt?.amountEntered === inst1.amount, "Receipt amount matches");

  // 3. Partial payment against single target (Cash)
  const p2 = recordLeasePayment({
    leaseId: lease.id,
    amount: 1000,
    paymentMethod: "CASH",
    payerName: "E2E Test Payer",
    paymentDate: new Date().toISOString().split("T")[0],
    allocations: [{ targetType: "LEASE_INSTALLMENT", targetId: `${lease.id}:2`, amount: 1000 }]
  });
  assert(p2.success === true, "Successfully recorded partial installment payment via Cash");

  // 4. Overpayment / unallocated payment
  const p3 = recordLeasePayment({
    leaseId: lease.id,
    amount: 5000,
    paymentMethod: "CREDIT_CARD",
    payerName: "E2E Test Payer",
    paymentDate: new Date().toISOString().split("T")[0],
    allocations: [{ targetType: "LEASE_INSTALLMENT", targetId: `${lease.id}:3`, amount: 2000 }] // 3000 unallocated
  });
  assert(p3.success === true, "Successfully recorded payment with unallocated balance");
  assert(p3.receipt?.amountEntered === 5000 && p3.receipt?.amountApplied === 2000, "Unallocated balance correctly tracked");

  // 5. Multi-obligation allocation
  const p4 = recordLeasePayment({
    leaseId: lease.id,
    amount: 5000,
    paymentMethod: "BANK_TRANSFER",
    payerName: "E2E Test Payer",
    paymentDate: new Date().toISOString().split("T")[0],
    allocations: [
      { targetType: "LEASE_INSTALLMENT", targetId: `${lease.id}:4`, amount: 2500 },
      { targetType: "LEASE_INSTALLMENT", targetId: `${lease.id}:5`, amount: 2500 }
    ]
  });
  assert(p4.success === true, "Successfully recorded payment allocated to multiple targets");
  
  // 6. Cheque creation and lifecycle simulation
  const p5 = recordLeasePayment({
    leaseId: lease.id,
    amount: 10000,
    paymentMethod: "CHEQUE",
    payerName: "E2E Test Payer",
    paymentDate: new Date().toISOString().split("T")[0],
    allocations: [{ targetType: "LEASE_INSTALLMENT", targetId: `${lease.id}:6`, amount: 10000 }],
    chequeDetails: { chequeNumber: "TEST-CHQ-123", bankName: "Emirates NBD", chequeDate: "2024-01-01" }
  });
  assert(p5.success === true, "Successfully recorded cheque payment and created authoritative cheque entity");
  assert(p5.receipt?.chequeId !== "DIRECT_COLLECTIONS" && p5.receipt?.chequeId?.startsWith("chq-"), "Cheque ID generated and linked");

  // Duplicate Check
  const p6 = recordLeasePayment({
    leaseId: lease.id,
    amount: 10000,
    paymentMethod: "CHEQUE",
    payerName: "E2E Test Payer",
    paymentDate: new Date().toISOString().split("T")[0],
    allocations: [{ targetType: "LEASE_INSTALLMENT", targetId: `${lease.id}:6`, amount: 10000 }],
    chequeDetails: { chequeNumber: "TEST-CHQ-123", bankName: "Emirates NBD", chequeDate: "2024-01-01" }
  });
  assert(p6.success === false, "Duplicate cheque successfully prevented");

  // Reversals
  const r1 = reversePaymentReceipt(p1.receipt!.id, "Bounced");
  assert(r1.success === true, "Successfully reversed a payment receipt");
  
  const r2 = reversePaymentReceipt(p1.receipt!.id, "Double reverse test");
  assert(r2.success === false, "Double reversal correctly rejected");

  console.log("-----------------------------------------");
  console.log(`TESTS PASSED: ${passed}/${total}`);
  console.log("=========================================");
  
  return { passed, total };
}
