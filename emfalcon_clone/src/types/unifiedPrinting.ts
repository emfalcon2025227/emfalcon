/**
 * EMIRATES FALCON ERP — UNIFIED PRINTING & VOUCHERS DOMAIN
 * Read-Only Presentation Layer types mapped to Authoritative Financial Transactions
 */

import {
  CollectionRecord,
  OwnerTransferRecord,
  PropertyExpenseRecord,
  OfficePettyCashExpense,
  Cheque,
  DailyDepositRecord,
  PaymentMethod,
} from "../types";

export type UnifiedDocumentType =
  | "RENTAL_RECEIPT"
  | "SECURITY_DEPOSIT_RECEIPT"
  | "OWNER_PAYMENT_VOUCHER"
  | "PROPERTY_EXPENSE_VOUCHER"
  | "PETTY_CASH_VOUCHER"
  | "CHEQUE_RECEIPT"
  | "BANK_DEPOSIT_SLIP";

export type DocumentPartyType = "TENANT" | "OWNER" | "VENDOR" | "OFFICE" | "EMPLOYEE" | "BANK";

export interface FinancialBreakdownItem {
  labelAr: string;
  labelEn: string;
  amount: number;
  type: "ADDITION" | "DEDUCTION" | "TAX" | "NET" | "TOTAL";
  notes?: string;
}

export interface UnifiedFinancialDocument {
  id: string; // Unique document key
  authoritativeId: string; // Real Firestore document ID
  documentNumber: string; // Formatted number e.g. RCP-0001, TRF-0012, EXP-0034
  documentType: UnifiedDocumentType;
  titleAr: string;
  titleEn: string;
  date: string; // YYYY-MM-DD or ISO
  amount: number; // Primary amount in AED
  netAmount?: number;
  vatAmount?: number;
  vatRate?: number;
  paymentMethod: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH" | "VISA" | "MASTERCARD";
  status: string; // Current status string
  isCancelledOrReversed?: boolean;
  isPrintable: boolean;
  unprintableReasonAr?: string;
  unprintableReasonEn?: string;

  // Beneficiary / Payer details
  partyType: DocumentPartyType;
  partyName: string;
  partyPhone?: string;
  partyEmail?: string;
  partyIdNumber?: string;
  partyId?: string;

  // Real Estate / Contract Context
  propertyId?: string;
  propertyName?: string;
  unitId?: string;
  unitNumber?: string;
  leaseId?: string;
  leaseNumber?: string;

  // Banking / Reference details
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  chequeNumber?: string;
  chequeDueDate?: string;
  referenceNumber?: string;
  transactionReference?: string;
  approvalCode?: string;

  // Detailed Breakdown & Description
  description: string;
  notes?: string;
  breakdown: FinancialBreakdownItem[];

  // Author & Audit metadata
  recordedByName: string;
  recordedByUserId?: string;
  approvedByName?: string;
  paidByName?: string;
  createdAt: string;

  // Raw source record reference (immutable)
  sourceRecord:
    | { type: "COLLECTION"; record: CollectionRecord }
    | { type: "OWNER_TRANSFER"; record: OwnerTransferRecord }
    | { type: "PROPERTY_EXPENSE"; record: PropertyExpenseRecord }
    | { type: "OFFICE_PETTY_CASH"; record: OfficePettyCashExpense }
    | { type: "CHEQUE"; record: Cheque }
    | { type: "DAILY_DEPOSIT"; record: DailyDepositRecord };
}

export interface DocumentFilterCriteria {
  searchQuery: string;
  documentType: UnifiedDocumentType | "ALL";
  paymentMethod: string; // "ALL" | PaymentMethod
  dateFrom: string;
  dateTo: string;
  status: string; // "ALL" | "PAID" | "PENDING" etc.
  propertyId?: string;
  ownerId?: string;
  tenantId?: string;
}
