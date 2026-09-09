# ERP IMPLEMENTATION BLUEPRINT (CORRECTED & UPDATED)
## EMIRATES FALCON REAL ESTATE — ENTERPRISE DATA MODEL & FINANCIAL RULES SPECIFICATION
*Architectural Document Version: 2.0.0 (Updated Post-Correction Audit)*
*Date of Revision: August 18, 2026*
*Status: APPROVED SPECIFICATION — PLANNING & DESIGN ONLY (NO CODE MODIFICATIONS)*

---

## 1. Executive Summary & Architectural Axioms

This document represents the finalized, corrected, and authoritative **ERP Implementation Blueprint** for transforming the active **Emirates Falcon Real Estate** management platform into a comprehensive, audit-grade Real Estate ERP.

### Core Architectural Axioms
1. **Core System Preservation**: The existing application and database collections are the **CORE SYSTEM**. All existing tables, structures, historical records, and business workflows remain intact.
2. **Implementation Hierarchy**:
   * **REUSE FIRST**: Leverage existing tables (`owners`, `properties`, `units`, `tenants`, `leases`, `cheques`, `collections`, `cases`, `maintenance_requests`, `archive`, `notifications`, `auditLogs`, `historicalRecords`).
   * **EXTEND SECOND**: Add non-breaking, optional extension attributes to existing entities.
   * **CREATE NEW ONLY WHEN NECESSARY**: Introduce discrete new entities strictly for missing enterprise functions (`commissions`, `payment_allocations`, `invoices`, `owner_transfers`, `property_operating_expenses`, `unit_inspections`, `chart_of_accounts`, `journal_entries`).
3. **Operational Dominance over Accounting**:
   Double-entry accounting does **NOT** drive the operational system. Instead, the architecture enforces a unidirectional operational-to-financial pipeline:
   $$\text{Business Transaction} \longrightarrow \text{Financial Transaction} \longrightarrow \text{Allocation} \longrightarrow \text{Derived Balances} \longrightarrow \text{Accounting Entry}$$
4. **Single Source of Financial Truth (SSOT)**:
   Every monetary figure has exactly one authoritative origin. All balances, statements, and ledgers are **derived values** computed from verified underlying transactions.

---

## 2. System Inventory & Classification Matrix

| Entity | Current Collection / Component | Status in Core System | Role in Future ERP |
| :--- | :--- | :--- | :--- |
| **Owners** | `owners` | `CONFIRMED` | Master Landlord entity; anchor for Owner Ledgers and Statements |
| **Properties** | `properties` | `CONFIRMED` | Physical asset root; anchor for OpEx, ROI, and Profitability |
| **Units** | `units` | `CONFIRMED` | Rentable inventory; anchor for Inspections and Maintenance history |
| **Tenants** | `tenants` | `CONFIRMED` | Customer party; anchor for Tenant Ledger, Risk Scores, and Invoices |
| **Leases** | `leases` | `CONFIRMED` | Operational Contract; anchor for Payment Schedules, Commissions, and Invoicing |
| **Cheques** | `cheques` | `CONFIRMED` | Banking instrument register; tracks deposits, clearances, and bounces |
| **Collections** | `collections` | `CONFIRMED` | Primary Cash/Bank receipt transaction record |
| **Rental Cases** | `cases` | `CONFIRMED` | Legal dispute register; consolidates bounced cheques and settlements |
| **Maintenance** | `maintenance_requests` | `CONFIRMED` | Work order ticket system; integrates with OpEx and Invoicing |
| **Technicians** | `technicians` | `CONFIRMED` | Service vendor and contractor directory |
| **Archive** | `archive` | `CONFIRMED` | Digital document repository; unified across all ERP modules |
| **Notifications** | `notifications` | `PARTIALLY IMPLEMENTED` (Simulated) | Communication logs; target for direct automated gateway integration |
| **Audit Logs** | `auditLogs` | `CONFIRMED` | Immutable audit trail for system actions |
| **Historical Records** | `historicalRecords` | `CONFIRMED` | Soft-deletion recovery container |
| **Commissions** | *New entity* | `NOT FOUND` in Core (To be added) | Tracks commission obligations and receivables independently |
| **Payment Allocations**| *New entity* | `NOT FOUND` in Core (To be added) | Maps multi-target payments across schedules, invoices, and cheques |
| **Invoices & Items** | *New entity* | `NOT FOUND` in Core (To be added) | Formal billing instruments for rent, fees, and charges |
| **Owner Transfers** | *New entity* | `NOT FOUND` in Core (To be added) | Financial transaction for disbursing collected funds to landlords |
| **Property OpEx** | *New entity* | `NOT FOUND` in Core (To be added) | Non-maintenance building operational expenses |
| **Unit Inspections** | *New entity* | `NOT FOUND` in Core (To be added) | Move-in/Move-out inspection checklists and damage deductions |
| **General Ledger** | *New entity* | `NOT FOUND` in Core (To be added) | Chart of Accounts, Journal Entries, and Lines |

---

## A. Updated Commission Architecture

### Core Principles
* **Multiple Commissions per Lease**: A single lease contract can spawn multiple independent commission obligations (e.g., Landlord Commission, Tenant Brokerage Fee, Contract Renewal Commission, Ad-Hoc Administration Fee).
* **Decoupling Obligation from Payment**:
  * **Commission Obligation (`commissions`)**: Represents the legally recognized receivable/claim.
  * **Commission Payment (`collections` + `payment_allocations`)**: Represents the actual monetary settlement of that claim.
* **Unique Business Key for Duplicate Prevention**:
  To prevent duplicate generation without restricting a lease to a single record, commissions use a composite business key:
  $$\text{Business Key} = \text{leaseId} \mathbin{\Vert} \text{partyType} \mathbin{\Vert} \text{commissionType} \mathbin{\Vert} \text{sequenceOrPeriod}$$
  *Example*: `L-2026-001:TENANT:BROKERAGE:ORIGINAL` or `L-2026-001:OWNER:MANAGEMENT_FEE:YEAR_1`.

### Data Schema: Commission Obligation (`commissions`)
```typescript
interface CommissionObligation {
  id: string; // Unique ID (or formatted unique business key)
  businessKey: string; // leaseId:partyType:commissionType:sequence
  leaseId: string; // Foreign Key -> leases
  ownerId?: string; // Foreign Key -> owners (if partyType === 'OWNER')
  tenantId?: string; // Foreign Key -> tenants (if partyType === 'TENANT')
  propertyId: string; // Foreign Key -> properties
  unitId: string; // Foreign Key -> units
  
  partyType: "OWNER" | "TENANT" | "THIRD_PARTY";
  commissionType: "BROKERAGE" | "MANAGEMENT_FEE" | "RENEWAL_FEE" | "ADMIN_FEE" | "LEASING_PREMIUM";
  calculationBasis: "PERCENTAGE_OF_RENT" | "FIXED_AMOUNT" | "FORMULA";
  
  baseAmount: number; // e.g., Annual Rent value used for calculation
  ratePercentage?: number; // e.g., 5.0 (for 5%)
  fixedAmount?: number; // e.g., 2000 AED
  totalCommissionAmount: number; // Final computed obligation amount
  
  dueDate: string; // ISO Date string when commission is due
  invoiceId?: string; // Optional link to formal invoice generated
  
  // Derived balances (updated strictly via Payment Allocation Engine)
  collectedAmount: number; // Total successfully allocated payments
  outstandingBalance: number; // totalCommissionAmount - collectedAmount
  status: "PENDING" | "PARTIALLY_COLLECTED" | "FULLY_COLLECTED" | "WAIVED" | "CANCELLED";
  
  createdAt: string;
  updatedAt: string;
  createdById: string;
}
```

---

## B. Updated Financial Source of Truth (SSOT) Matrix

| Financial Value | Authoritative Source of Truth (SSOT) | Derived Value / Computation | User Editable? | Edit Location & Validation Rules | Audit Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Annual Rent** | `leases.annualRent` | SOT (Origin) | Yes (Draft/Active lease) | Edit Contract Screen; restricted once installments/cheques are cleared. | `AUDIT_LOG_FULL_DIFF` |
| **Installment Amount** | `leases.installments[].amount` | SOT (Origin) | Yes (Before clearance) | Edit Lease Payment Schedule; sum must match `annualRent`. | `AUDIT_LOG_FULL_DIFF` |
| **Payment Due** | `invoices.totalAmount` / Schedule Due Date | Derived: Invoice or Schedule Line | No (Derived from contract) | Modifiable only via contract amendment or invoice credit note. | `AUDIT_LOG_ON_OVERRIDE` |
| **Actual Payment** | `collections.amountEntered` | SOT (Origin) | No (Financial Receipt) | Cannot edit amount directly; requires payment reversal + new receipt. | `AUDIT_LOG_IMMUTABLE` |
| **Cheque Amount** | `cheques.amount` | SOT (Physical Instrument) | Yes (Before deposit) | Edit Cheque Screen; reflects physical cheque face value. | `AUDIT_LOG_FULL_DIFF` |
| **Collected Amount** | $\sum(\text{payment\_allocations.allocatedAmount})$ | Derived Value | No | Calculated dynamically from active payment allocations. | Recalculable on query |
| **Bounced Amount** | `cheques.amount` when `status === 'BOUNCED'` | SOT for Bounced Instrument | No | Fixed by cheque face value upon bank dishonor event. | `AUDIT_LOG_ON_BOUNCE` |
| **Settlement Amount**| `cases.settlement.schedule[].amount` | SOT (Legal Agreement) | Yes (Legal Counsel) | Rental Case Settlement Screen; legally binding schedule. | `AUDIT_LOG_FULL_DIFF` |
| **Commission Amount**| `commissions.totalCommissionAmount` | SOT (Obligation) | Yes (Authorized Manager) | Commission Management Screen; recalculates outstanding. | `AUDIT_LOG_FULL_DIFF` |
| **Invoice Total** | `invoices.subtotal` + `tax` - `discount` | Derived from Line Items | No | Computed automatically from `invoice_items`. | Recalculable on query |
| **Expense Amount** | `property_operating_expenses.totalAmount` | SOT (Vendor Bill) | Yes (Finance/Manager) | Operating Expense Screen; requires supporting bill. | `AUDIT_LOG_FULL_DIFF` |
| **Rent Collected** | $\sum(\text{Allocations to Lease Rental Schedule})$ | Derived Value | No | Sum of collections allocated to rent for owner's properties. | Recalculable on query |
| **Owner Payable** | $\text{Rent Collected} - \text{Commissions} - \text{Owner Exp}$ | Derived Formula | No | Computed in Owner Ledger from underlying transactions. | Recalculable on query |
| **Owner Transferred**| $\sum(\text{owner\_transfers.amount})$ | Derived Value | No | Sum of completed bank transfers/payouts to the owner. | `AUDIT_LOG_FULL_DIFF` |
| **Owner Balance** | $\text{Owner Payable} - \text{Owner Transferred}$ | Derived Formula | No | Net current liability owed to landlord. | Recalculable on query |
| **Tenant Outstanding**| $\text{Total Invoiced/Due} - \text{Total Allocated Paid}$ | Derived Formula | No | Net current receivables owed by tenant. | Recalculable on query |
| **Office Revenue** | $\sum(\text{Commissions Paid}) + \sum(\text{Admin Fees})$ | Derived Formula | No | Aggregated from corporate general ledger accounts. | Recalculable on query |

---

## C. Updated Payment Allocation Architecture

### Concept & Flow
A payment receipt (`collections`) is a single financial event representing incoming funds. The **Payment Allocation Engine** maps this lump sum or specific payment across one or multiple targets without mutating the original receipt amount.

```
┌────────────────────────────────────────────────────────┐
│             PAYMENT RECEIPT (collections)             │
│            e.g., Amount: 15,000 AED Cash/Bank           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               PAYMENT ALLOCATION ENGINE                │
│    Distributes 15,000 AED across target liabilities:   │
├────────────────────────────────────────────────────────┤
│ ├── Target 1: Rental Invoice #INV-101 ────►  8,000 AED │
│ ├── Target 2: Commission #COM-202 ────────►  2,000 AED │
│ ├── Target 3: Maintenance Bill #MNT-05 ───►  1,500 AED │
│ └── Target 4: Unallocated / Prepayment ───►  3,500 AED │
└────────────────────────────────────────────────────────┘
```

### Data Schema: Payment Allocation (`payment_allocations`)
```typescript
interface PaymentAllocation {
  id: string; // Unique UUID
  collectionId: string; // Foreign Key -> collections (The parent payment receipt)
  
  targetType: "LEASE_INSTALLMENT" | "INVOICE" | "COMMISSION" | "CHEQUE" | "SETTLEMENT" | "UNALLOCATED_PREPAYMENT";
  targetId: string; // ID of the specific target entity
  
  allocatedAmount: number; // Portion of collection applied to this target
  allocationDate: string; // ISO Timestamp
  
  status: "ACTIVE" | "REVERSED"; // Reversed in case of bounced cheque or payment void
  reversalReason?: string;
  reversalTimestamp?: string;
  
  createdById: string;
}
```

### Allocation Rules
1. **Partial Allocation**: A payment can settle a fraction of an invoice or installment. The target's `outstandingAmount` decreases by `allocatedAmount`.
2. **Full Allocation**: When cumulative allocations match the target's total, status becomes `"FULLY_PAID"` or `"COLLECTED"`.
3. **Unallocated Amounts (Prepayments)**: If payment exceeds outstanding liabilities, the remainder is stored as `targetType: "UNALLOCATED_PREPAYMENT"`. This credit can be applied to future invoices.
4. **Payment Reversal (e.g., Dishonored Cheque)**: When a collection is reversed, all child `payment_allocations` are flagged as `"REVERSED"`, automatically reinstating the outstanding balances across all targets without deleting transaction history.

---

## D. Updated Owner Ledger

The Owner Ledger is an immutable, transaction-level account recording every debit and credit affecting the landlord's financial position with the agency.

### Ledger Transaction Classification
* **Credit to Owner (Increases Owner Balance / Agency Liability)**:
  * `RENT_COLLECTED`: Gross rent collected from tenants for owner's properties.
  * `SECURITY_DEPOSIT_HELD_FOR_OWNER`: Deposit funds allocated to owner.
  * `OWNER_CREDIT_ADJUSTMENT`: Manual accounting correction in favor of owner.
* **Debit to Owner (Decreases Owner Balance / Deductions)**:
  * `AGENCY_COMMISSION_DEDUCTED`: Management or leasing commission deducted.
  * `MAINTENANCE_PAID_BY_OFFICE`: Maintenance expenses paid on behalf of owner.
  * `PROPERTY_OPEX_PAID`: Municipality fees, insurance, or utilities paid.
  * `OWNER_TRANSFER_PAID`: Cash/Wire disbursement sent to landlord.
  * `OWNER_DEBIT_ADJUSTMENT`: Correction debiting the owner.

### Data Schema: Owner Ledger Transaction (`owner_ledger_transactions`)
```typescript
interface OwnerLedgerTransaction {
  id: string;
  ownerId: string; // Foreign Key -> owners
  propertyId?: string; // Foreign Key -> properties
  unitId?: string; // Foreign Key -> units
  leaseId?: string; // Foreign Key -> leases
  
  transactionDate: string;
  transactionType: "RENT_COLLECTED" | "COMMISSION_DEDUCTION" | "MAINTENANCE_EXPENSE" | "PROPERTY_OPEX" | "OWNER_TRANSFER" | "ADJUSTMENT";
  
  sourceEntityType: "collections" | "commissions" | "property_operating_expenses" | "maintenance_requests" | "owner_transfers";
  sourceEntityId: string;
  
  debitAmount: number; // Charges against owner (decreases liability)
  creditAmount: number; // Money earned/collected for owner (increases liability)
  runningBalance: number; // Balance after this transaction
  
  descriptionAr: string;
  descriptionEn: string;
  createdAt: string;
  createdById: string;
}
```

---

## E. Updated Owner Statement Architecture

The **Owner Statement** is a compiled financial reporting view generated dynamically from the `owner_ledger_transactions` table for any specified date range $[T_{\text{start}}, T_{\text{end}}]$.

### Explicit Four-Pillar Financial Values
The system explicitly distinguishes and computes four independent financial figures:
1. **RENT COLLECTED FROM TENANT ($\text{Rent}_{\text{collected}}$)**: Total gross rental cash/cheques cleared from occupants during the period.
2. **OWNER PAYABLE ($\text{Owner}_{\text{payable}}$)**: Total net earnings due to the owner after subtracting authorized agency commissions, operating expenses, and maintenance costs:
   $$\text{Owner}_{\text{payable}} = \text{Rent}_{\text{collected}} - \text{Commissions}_{\text{deducted}} - \text{Maintenance}_{\text{owner}} - \text{OpEx}_{\text{owner}} \pm \text{Adjustments}$$
3. **OWNER TRANSFERRED ($\text{Owner}_{\text{transferred}}$)**: Total funds actually disbursed and paid to the landlord via bank wire or cheque during the period.
4. **OWNER BALANCE ($\text{Owner}_{\text{balance}}$)**: Current net remaining liability owed to the owner:
   $$\text{Owner}_{\text{balance}} = \text{Opening Balance} + \text{Owner}_{\text{payable}} - \text{Owner}_{\text{transferred}}$$

$$\mathbf{Owner\ Payable} \neq \mathbf{Owner\ Transferred}\quad \text{(Unless full disbursement has physically executed)}$$

---

## F. Owner Transfer Specification (`owner_transfers`)

* **Core System Status**: `NOT FOUND` in current core system.
* **Future Role**: Independent financial entity for tracking banking disbursements to landlords.

### Data Schema: Owner Transfer (`owner_transfers`)
```typescript
interface OwnerTransfer {
  id: string; // Unique UUID (e.g., TRF-2026-0001)
  ownerId: string; // Foreign Key -> owners
  transferNumber: string; // Sequential reference code
  
  amount: number; // Transfer amount in AED
  transferDate: string; // Date payment dispatched
  
  paymentMethod: "BANK_TRANSFER" | "CHEQUE" | "CASH";
  sourceBankAccountId: string; // Agency Bank Account ID from Chart of Accounts
  destinationBankName: string; // Landlord's Bank
  destinationIban: string; // Landlord's IBAN
  
  referenceNumber: string; // Bank wire reference or Cheque number
  supportingDocumentUrl?: string; // Wire receipt uploaded to archive
  
  status: "DRAFT" | "SUBMITTED" | "COMPLETED" | "REJECTED" | "CANCELLED";
  
  journalEntryId?: string; // Link to General Ledger entry
  notes?: string;
  
  createdAt: string;
  createdById: string;
  approvedById?: string;
}
```

---

## G. Updated Tenant Ledger

The Tenant Ledger maintains the chronological balance sheet for each tenant across all contracted units.

### Balance Calculation Formulation
$$\text{Total Due} = \sum(\text{Invoiced Rent}) + \sum(\text{Invoiced Tenant Commissions}) + \sum(\text{Tenant Maintenance Charges}) + \sum(\text{Late Fees})$$
$$\text{Total Paid} = \sum(\text{Active Cleared Collections Allocated to Tenant})$$
$$\text{Tenant Outstanding Balance} = \text{Total Due} - \text{Total Paid} \pm \text{Adjustments}$$

### Bounced Cheque Handling
When a cheque bounces:
1. The corresponding `payment_allocation` is marked `"REVERSED"`.
2. A debit transaction (`CHEQUE_BOUNCE_CHARGEBACK`) is posted to the Tenant Ledger.
3. The tenant's outstanding balance immediately increases by the dishonored amount.
4. Tenant's operational status transitions to reflect overdue arrears.

---

## H. Updated Accounting Architecture (Operational Layer First)

Double-entry bookkeeping serves as the **audited financial reporting shadow** of operational activity. No manual journal entry can alter operational balances (such as unit occupancy or cheque bounce states) directly.

```
┌────────────────────────────────────────────────────────┐
│             OPERATIONAL BUSINESS EVENT                 │
│      (e.g., Rental Payment, Commission, Expense)       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             FINANCIAL TRANSACTION CREATION             │
│            (collections / property_expenses)           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│              PAYMENT ALLOCATION ENGINE                 │
│    (Updates Outstanding Balances on Invoices/Leases)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│         AUTOMATED GENERAL LEDGER DISPATCHER            │
│   Generates balanced Double-Entry Journal Entry Lines  │
└────────────────────────────────────────────────────────┘
```

### Event-to-Journal Mapping Matrix

| Business Event | Source Entity | Accounting Trigger | Debit Account | Credit Account | Audit Trail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rent Collection (Cleared)** | `collections` | Payment clearance | Bank Account (`1101`) | Accounts Receivable - Tenant (`1201`) | Linked via `sourceEntityId: collection.id` |
| **Agency Commission Earned** | `commissions` | Obligation booked | Accounts Receivable (`1201`) | Agency Commission Revenue (`4101`) | Linked via `sourceEntityId: commission.id` |
| **Commission Received** | `collections` | Commission receipt | Bank Account (`1101`) | Accounts Receivable (`1201`) | Linked via `sourceEntityId: allocation.id` |
| **Property OpEx Paid** | `property_expenses`| Expense confirmed | Building OpEx (`5102`) | Bank Account (`1101`) | Linked via `sourceEntityId: expense.id` |
| **Disbursement to Owner** | `owner_transfers` | Transfer completed | Owner Payable Liability (`2101`)| Bank Account (`1101`) | Linked via `sourceEntityId: transfer.id` |
| **Cheque Dishonor (Bounce)**| `cheques` | Bounce flagged | Accounts Receivable (`1201`) | Bank Account / In-Transit (`1102`) | Reversal Journal Entry posted |

---

## I. Updated Invoice Architecture

* **Definition of Terms**:
  * **Invoice** = Formal Notice of Demand / Amount Due ($\text{Liability Established}$).
  * **Payment** = Receipt of Monetary Funds ($\text{Liability Settled}$).
* Creating an invoice does **not** assume collection.
* An invoice's `paidAmount` and `outstandingAmount` are modified **strictly** through valid `payment_allocations`.

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string; // Unique sequential code (e.g., INV-2026-0001)
  invoiceType: "RENTAL_INSTALLMENT" | "AGENCY_COMMISSION" | "MAINTENANCE_CHARGE" | "LATE_FEE" | "UTILITY_BILL" | "OTHER";
  
  customerId: string; // Tenant ID or Owner ID
  customerType: "TENANT" | "OWNER" | "OTHER";
  
  leaseId?: string;
  propertyId: string;
  unitId?: string;
  
  issueDate: string;
  dueDate: string;
  
  subtotal: number;
  taxRate: number; // Configurable (e.g., 0.0 or 5.0)
  taxAmount: number;
  discountAmount: number;
  totalAmount: number; // subtotal + taxAmount - discountAmount
  
  // Derived balances (via Payment Allocations)
  paidAmount: number;
  outstandingAmount: number; // totalAmount - paidAmount
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "FULLY_PAID" | "OVERDUE" | "CANCELLED";
  
  createdAt: string;
}
```

---

## J. Balance Calculation & Correction Rules

### Authoritative Recalculation Engine
All customer and landlord balances are fully recalculable from verified base transactions:
$$\text{Calculated Balance} = \sum(\text{Authorized Charges}) - \sum(\text{Active Allocated Payments}) + \sum(\text{Debit Adjustments}) - \sum(\text{Credit Adjustments})$$

### Correction & Error Handling Protocols
1. **Zero Physical Deletion**: Financial transactions (`collections`, `commissions`, `invoices`, `owner_transfers`) must **never** be deleted from Firestore or LocalStorage.
2. **Reversals (`REVERSAL`)**: If a transaction was entered in error, an explicit reversal transaction is posted referencing the original ID, neutralizing the balance impact while retaining full audit history.
3. **Adjustments (`ADJUSTMENT`)**: Minor balance corrections (discounts, roundings, waived charges) require a signed Adjustment Record containing an explicit business justification and approval metadata.
4. **Write-offs (`WRITE_OFF`)**: Uncollectible debts from legal defaults require Super Admin approval, posting a credit to the tenant ledger and debiting Bad Debt Expense (`5901`).

---

## K. Updated VAT & Taxation Rules

* **Status**: `NOT CONFIRMED` (UAE VAT applies conditionally to commercial leases, commissions, and services; residential leases are generally exempt).
* **Architecture Rule**: VAT is **CONFIGURABLE** and **NEVER HARDCODED**.

### Tax Configuration Specifications
* **Tax Status Categories**:
  * `TAXABLE`: Standard VAT applies (e.g., 5% on commercial leases, management commissions, maintenance).
  * `ZERO_RATED`: 0% rate applied.
  * `EXEMPT`: Completely exempt from tax (e.g., residential rents).
  * `OUT_OF_SCOPE`: Non-taxable government/court fees.
* **Dynamic Calculation**:
  $$\text{Line Tax Amount} = \begin{cases} \text{Line Subtotal} \times \left( \frac{\text{Tax Rate \%}}{100} \right) & \text{if Tax Status is TAXABLE} \\ 0 & \text{otherwise} \end{cases}$$
* The system allows configuring tax rates at the global system level, company level, and overriding per invoice line item.

---

## L. Historical Data Preservation Rules

1. **Immutability of Cleared Data**: Historical collections, cleared cheques, and finalized lease records cannot be edited in place.
2. **Soft Deletions with Audit Archiving**: Any non-financial master record (e.g., archived unit or draft property) marked for deletion is relocated to `historicalRecords` with a full snapshot of its state and author metadata.
3. **Bounced Cheque Integrity**: Bounced cheques remain permanently accessible in the `cheques` register, linked to their respective `cases` and `settlements`.

---

## M. Data Integrity & Validation Rules

1. **Unique Business Keys**:
   * Cheques: `UNIQUE(bankName, chequeNumber, tenantId)`
   * Leases: `UNIQUE(leaseNumber)`
   * Commissions: `UNIQUE(businessKey)`
   * Invoices: `UNIQUE(invoiceNumber)`
2. **Referential Integrity**:
   * No lease can reference a unit that is not marked `VACANT` (unless under renewal).
   * No payment allocation can reference a deleted or cancelled invoice.
   * Total payment allocations for a collection cannot exceed `collections.amountEntered`.
3. **Zero Negative Balance Invariant**:
   * Bank accounts and cash holding accounts must not drop below zero without an explicit overdraft authorization flag.

---

## N. Updated Status Matrix

```
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│  Lease Status   │             │  Cheque Status  │             │ Invoice Status  │
├─────────────────┤             ├─────────────────┤             ├─────────────────┤
│ DRAFT           │             │ PENDING         │             │ DRAFT           │
│ ACTIVE          │             │ DEPOSITED       │             │ ISSUED          │
│ EXPIRING        │             │ CLEARED         │             │ PARTIALLY_PAID  │
│ RENEWED         │             │ BOUNCED         │             │ FULLY_PAID      │
│ TERMINATED      │             │ CANCELLED       │             │ OVERDUE         │
│ EXPIRED         │             │ REPLACED        │             │ CANCELLED       │
└─────────────────┘             └─────────────────┘             └─────────────────┘
```

| Entity | Current Status | Allowed Next Status | Forbidden Transitions | Changer Role | Trigger Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Commission** | `PENDING` | `PARTIALLY_COLLECTED`, `FULLY_COLLECTED`, `WAIVED` | `CANCELLED` (if paid) | System / Finance | Payment allocation matches obligation |
| **Commission** | `PARTIALLY_COLLECTED` | `FULLY_COLLECTED`, `WAIVED` | `PENDING` | System | Subsequent payment allocations |
| **Owner Transfer** | `DRAFT` | `SUBMITTED`, `CANCELLED` | `COMPLETED` | Finance User | Transfer request created |
| **Owner Transfer** | `SUBMITTED` | `COMPLETED`, `REJECTED` | `DRAFT` | Super Admin / Bank | Bank confirms funds sent |
| **Invoice** | `ISSUED` | `PARTIALLY_PAID`, `FULLY_PAID`, `OVERDUE` | `DRAFT` | System / Allocation | Allocation applied / Date passed |

---

## O. Updated Implementation Dependencies & Pipeline

```
[Phase 1: Master Schema Extensions & Commission Obligation Engine]
  - Add non-breaking fields to Leases & Tenants
  - Deploy standalone Commissions entity with Business Key validation
                          │
                          ▼
[Phase 2: Payment Allocation Engine & Multi-Target Mapping]
  - Deploy payment_allocations container
  - Link Collections to Invoices, Schedules, and Commissions
                          │
                          ▼
[Phase 3: Invoicing Module & Tax Engine Scaffolding]
  - Deploy Invoices and Invoice Items
  - Configurable VAT matrix per transaction type
                          │
                          ▼
[Phase 4: Owner & Tenant Transaction Ledgers]
  - Implement Owner Ledger & Tenant Ledger aggregations
  - Deploy Owner Transfers entity
  - Generate dynamic Owner Statements (4 distinct values)
                          │
                          ▼
[Phase 5: Property Operating Expenses (OpEx) & Inspections]
  - Deploy property_operating_expenses
  - Deploy unit_inspections checklists
                          │
                          ▼
[Phase 6: Shadow Double-Entry General Ledger]
  - Deploy Chart of Accounts, Journal Entries, and Lines
  - Automated journal generation on operational triggers
```

---

## 3. Consistency & Non-Conflict Verification

A comprehensive cross-module consistency check was executed across all entities and formulas:
1. **Commission vs. Payment**: Resolved. Commissions define obligations; Collections + Allocations settle them.
2. **Owner Payable vs. Owner Transferred**: Resolved. Decoupled into distinct ledger-backed metrics.
3. **Invoice vs. Payment**: Resolved. Invoices represent demand; Payments are allocated to invoices without dual-entry conflicts.
4. **Cheque vs. Settlement vs. Case**: Resolved. Multi-cheque dispute claims maintain individual cheque-level allocation FIFO queues.
5. **Operational vs. Accounting**: Resolved. Unidirectional flow guarantees general ledger cannot break active lease/cheque operational states.

---

**[BLUEPRINT UPDATE COMPLETE — SYSTEM FULLY VALIDATED — STOPPING TURN]**
