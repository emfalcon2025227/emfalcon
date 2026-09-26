/**
 * EMIRATES FALCON ERP — GENERAL LEDGER POSTING ENGINE
 * Pure Posting Layer: Receives validated economic events from the financial engine
 * and constructs balanced double-entry accounting journal postings.
 */

import {
  AccountDefinition,
  JournalEntryRecord,
  JournalLine,
  PaymentMethod,
  PropertyExpenseCategory,
  ExpenseCostBearer,
  CommissionPartyType,
} from "../types";

/**
 * Validates a journal entry candidate before posting.
 * Enforces:
 * 1. At least 2 lines.
 * 2. Total Debits === Total Credits (within 0.01 AED tolerance).
 * 3. Every line has a valid accountId and non-negative debit/credit values.
 */
export function validateJournalEntry(entry: {
  lines: Array<{ accountId: string; debit: number; credit: number }>;
}): { isValid: boolean; totalDebit: number; totalCredit: number; error?: string } {
  if (!entry.lines || entry.lines.length < 2) {
    return {
      isValid: false,
      totalDebit: 0,
      totalCredit: 0,
      error: "يجب أن يتكون القيد المحاسبي من طرفين على الأقل (مدين ودائن).",
    };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of entry.lines) {
    if (!line.accountId) {
      return { isValid: false, totalDebit: 0, totalCredit: 0, error: "يوجد طرف في القيد بدون تحديد الحساب." };
    }
    if (isNaN(line.debit) || line.debit < 0 || isNaN(line.credit) || line.credit < 0) {
      return { isValid: false, totalDebit: 0, totalCredit: 0, error: "قيم المدين والدائن يجب أن تكون أرقاماً موجبة." };
    }
    totalDebit += Math.round(line.debit * 100) / 100;
    totalCredit += Math.round(line.credit * 100) / 100;
  }

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;

  const variance = Math.abs(totalDebit - totalCredit);
  if (variance > 0.01) {
    return {
      isValid: false,
      totalDebit,
      totalCredit,
      error: `القيد المحاسبي غير متوازن! مجموع المدين (${totalDebit.toFixed(2)}) لا يساوي مجموع الدائن (${totalCredit.toFixed(2)}).`,
    };
  }

  return { isValid: true, totalDebit, totalCredit };
}

/**
 * Checks if a posted journal entry already exists for a specific source event.
 */
export function isDuplicateJournalPosting(
  journalEntries: JournalEntryRecord[],
  sourceType: string,
  sourceId: string
): boolean {
  if (!sourceType || !sourceId) return false;
  return journalEntries.some(
    (je) => je.sourceType === sourceType && je.sourceId === sourceId && je.status === "POSTED"
  );
}

/**
 * Account Helper Resolver
 */
export function findAccountByCodeOrType(
  chartOfAccounts: AccountDefinition[],
  code: string,
  fallbackType: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE"
): AccountDefinition {
  const found = chartOfAccounts.find((a) => a.accountCode === code);
  if (found) return found;

  const fallback = chartOfAccounts.find((a) => a.accountType === fallbackType && a.isActive);
  if (fallback) return fallback;

  return {
    id: `acc-system-${code}`,
    accountCode: code,
    accountNameAr: `حساب ${code}`,
    accountNameEn: `Account ${code}`,
    accountType: fallbackType,
    normalBalance: fallbackType === "ASSET" || fallbackType === "EXPENSE" ? "DEBIT" : "CREDIT",
    isActive: true,
    isSystemAccount: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Helper to determine cash/bank asset account based on payment method.
 */
function getPaymentAssetAccount(
  chartOfAccounts: AccountDefinition[],
  paymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH"
): AccountDefinition {
  const method = (paymentMethod || "BANK_TRANSFER").toUpperCase();
  if (method === "CASH") {
    return findAccountByCodeOrType(chartOfAccounts, "1020", "ASSET"); // Cash in Hand
  }
  if (method === "CHEQUE") {
    return findAccountByCodeOrType(chartOfAccounts, "1120", "ASSET"); // Cheques Under Collection
  }
  return findAccountByCodeOrType(chartOfAccounts, "1010", "ASSET"); // Main Operating Bank
}

/**
 * 1. Rent Collection Journal Builder
 * Debit: Cash/Bank/Cheque Asset Account
 * Credit: Owner Payable (2010)
 */
export function buildRentCollectionJournal(
  params: {
    collectionId: string;
    receiptNumber: string;
    amount: number;
    transactionDate: string;
    paymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    ownerId?: string;
    propertyId?: string;
    unitId?: string;
    leaseId?: string;
    tenantId?: string;
    createdBy?: string;
    notes?: string;
  },
  chartOfAccounts: AccountDefinition[]
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const amount = Math.round(params.amount * 100) / 100;
  const assetAccount = getPaymentAssetAccount(chartOfAccounts, params.paymentMethod);
  const ownerPayableAccount = findAccountByCodeOrType(chartOfAccounts, "2010", "LIABILITY");

  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountId: assetAccount.id,
      accountCode: assetAccount.accountCode,
      accountNameAr: assetAccount.accountNameAr,
      accountNameEn: assetAccount.accountNameEn,
      debit: amount,
      credit: 0,
      description: `تحصيل إيجار - سند #${params.receiptNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    },
    {
      id: `line-${Date.now()}-2`,
      accountId: ownerPayableAccount.id,
      accountCode: ownerPayableAccount.accountCode,
      accountNameAr: ownerPayableAccount.accountNameAr,
      accountNameEn: ownerPayableAccount.accountNameEn,
      debit: 0,
      credit: amount,
      description: `إضافة لحساب المالك الدائن - سند #${params.receiptNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    },
  ];

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: params.receiptNumber,
    sourceType: "RENT_COLLECTION",
    sourceId: params.collectionId,
    description: params.notes || `قيد تحصيل إيجاري بموجب سند #${params.receiptNumber}`,
    totalDebit: amount,
    totalCredit: amount,
    createdBy: params.createdBy || "النظام المحاسبي",
    lines,
  };
}

/**
 * 2. Administrative Fee / Commission Journal Builder
 * Handles 5% VAT extraction cleanly:
 * Net Revenue = Gross / 1.05
 * VAT = Gross - Net Revenue
 * Debit: Owner Payable (2010) or Bank/Cash
 * Credit: Revenue (4010/4020) + VAT Output (2040)
 */
export function buildAdminFeeJournal(
  params: {
    commissionId: string;
    commissionNumber: string;
    grossAmount: number;
    vatAmount?: number;
    netRevenue?: number;
    partyType: CommissionPartyType | "OWNER" | "TENANT";
    transactionDate: string;
    paymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    isDeductedFromOwner?: boolean;
    ownerId?: string;
    propertyId?: string;
    unitId?: string;
    leaseId?: string;
    tenantId?: string;
    createdBy?: string;
    notes?: string;
  },
  chartOfAccounts: AccountDefinition[]
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const gross = Math.round(params.grossAmount * 100) / 100;
  
  let vat = 0;
  let net = gross;

  if (typeof params.vatAmount === "number" && params.vatAmount > 0) {
    vat = Math.round(params.vatAmount * 100) / 100;
    net = Math.round((gross - vat) * 100) / 100;
  } else if (gross > 0) {
    // Default 5% VAT calculation if taxable
    net = Math.round((gross / 1.05) * 100) / 100;
    vat = Math.round((gross - net) * 100) / 100;
  }

  // Debit Side: From Owner Payable (if explicitly deducted from owner balance) or Bank/Cash Asset
  const isOwnerDeduction = params.isDeductedFromOwner === true;
  const debitAccount = isOwnerDeduction
    ? findAccountByCodeOrType(chartOfAccounts, "2010", "LIABILITY") // Owner Payable
    : getPaymentAssetAccount(chartOfAccounts, params.paymentMethod);

  // Credit Side: Income (4010 Owner, 4020 Tenant) + VAT Output (2040)
  const incomeAccountCode = params.partyType === "OWNER" ? "4010" : "4020";
  const incomeAccount = findAccountByCodeOrType(chartOfAccounts, incomeAccountCode, "INCOME");
  const vatOutputAccount = findAccountByCodeOrType(chartOfAccounts, "2040", "LIABILITY");

  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountId: debitAccount.id,
      accountCode: debitAccount.accountCode,
      accountNameAr: debitAccount.accountNameAr,
      accountNameEn: debitAccount.accountNameEn,
      debit: gross,
      credit: 0,
      description: `خصم رسوم إدارية/عمولة #${params.commissionNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    },
    {
      id: `line-${Date.now()}-2`,
      accountId: incomeAccount.id,
      accountCode: incomeAccount.accountCode,
      accountNameAr: incomeAccount.accountNameAr,
      accountNameEn: incomeAccount.accountNameEn,
      debit: 0,
      credit: net,
      description: `صافي إيراد الرسوم الإدارية (الربح الصافي)`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    },
  ];

  if (vat > 0) {
    lines.push({
      id: `line-${Date.now()}-3`,
      accountId: vatOutputAccount.id,
      accountCode: vatOutputAccount.accountCode,
      accountNameAr: vatOutputAccount.accountNameAr,
      accountNameEn: vatOutputAccount.accountNameEn,
      debit: 0,
      credit: vat,
      description: `ضريبة القيمة المضافة المحصلة (5% Output VAT)`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    });
  }

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: params.commissionNumber,
    sourceType: "ADMIN_FEE",
    sourceId: params.commissionId,
    description: params.notes || `قيد استحقاق إيرادات الرسوم الإدارية #${params.commissionNumber}`,
    totalDebit: gross,
    totalCredit: gross,
    createdBy: params.createdBy || "النظام المحاسبي",
    lines,
  };
}

/**
 * 3. Owner Transfer Settlement Journal Builder
 * Debit: Owner Payable (2010)
 * Credit: Operating Bank Account (1010)
 */
export function buildOwnerTransferJournal(
  params: {
    transferId: string;
    transferNumber: string;
    amount: number;
    transactionDate: string;
    ownerId: string;
    bankAccountReference?: string;
    createdBy?: string;
    notes?: string;
  },
  chartOfAccounts: AccountDefinition[]
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const amount = Math.round(params.amount * 100) / 100;
  const ownerPayableAccount = findAccountByCodeOrType(chartOfAccounts, "2010", "LIABILITY");
  const bankAccount = findAccountByCodeOrType(chartOfAccounts, "1010", "ASSET");

  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountId: ownerPayableAccount.id,
      accountCode: ownerPayableAccount.accountCode,
      accountNameAr: ownerPayableAccount.accountNameAr,
      accountNameEn: ownerPayableAccount.accountNameEn,
      debit: amount,
      credit: 0,
      description: `سداد مستحقات المالك - تحويل بنكي #${params.transferNumber}`,
      ownerId: params.ownerId,
    },
    {
      id: `line-${Date.now()}-2`,
      accountId: bankAccount.id,
      accountCode: bankAccount.accountCode,
      accountNameAr: bankAccount.accountNameAr,
      accountNameEn: bankAccount.accountNameEn,
      debit: 0,
      credit: amount,
      description: `صرف من حساب البنك للتحويل البنكي #${params.transferNumber}`,
      ownerId: params.ownerId,
    },
  ];

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: params.transferNumber,
    sourceType: "OWNER_TRANSFER",
    sourceId: params.transferId,
    description: params.notes || `قيد تسوية سداد مستحقات مالك (تحويل بنكي #${params.transferNumber})`,
    totalDebit: amount,
    totalCredit: amount,
    createdBy: params.createdBy || "النظام المحاسبي",
    lines,
  };
}

/**
 * 3b. Owner Transfer Reversal Journal Builder
 * Debit: Operating Bank Account (1010)
 * Credit: Owner Payable (2010)
 */
export function buildOwnerTransferReversalJournal(
  params: {
    transferId: string;
    transferNumber: string;
    amount: number;
    transactionDate: string;
    ownerId: string;
    createdBy?: string;
    notes?: string;
  },
  chartOfAccounts: AccountDefinition[]
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const amount = Math.round(params.amount * 100) / 100;
  const ownerPayableAccount = findAccountByCodeOrType(chartOfAccounts, "2010", "LIABILITY");
  const bankAccount = findAccountByCodeOrType(chartOfAccounts, "1010", "ASSET");

  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountId: bankAccount.id,
      accountCode: bankAccount.accountCode,
      accountNameAr: bankAccount.accountNameAr,
      accountNameEn: bankAccount.accountNameEn,
      debit: amount,
      credit: 0,
      description: `استرجاع مالي لشيك تحويل ملغى/معكوس للبنك - تحويل #${params.transferNumber}`,
      ownerId: params.ownerId,
    },
    {
      id: `line-${Date.now()}-2`,
      accountId: ownerPayableAccount.id,
      accountCode: ownerPayableAccount.accountCode,
      accountNameAr: ownerPayableAccount.accountNameAr,
      accountNameEn: ownerPayableAccount.accountNameEn,
      debit: 0,
      credit: amount,
      description: `إعادة قيد لحساب المالك الدائن - تحويل معكوس #${params.transferNumber}`,
      ownerId: params.ownerId,
    },
  ];

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: `REV-${params.transferNumber}`,
    sourceType: "OWNER_TRANSFER_REVERSAL",
    sourceId: params.transferId,
    description: params.notes || `قيد عكس مالي لتحويل مالك ملغى #${params.transferNumber}`,
    totalDebit: amount,
    totalCredit: amount,
    createdBy: params.createdBy || "النظام المحاسبي",
    lines,
  };
}

/**
 * 4. Property / Office Expense Journal Builder
 * If costBearer === 'OWNER': Debit Owner Payable (2010), Credit Bank/Cash
 * If costBearer === 'OFFICE': Debit Admin Expense (5040/5010), Credit Bank/Cash (Does NOT affect Owner Payable)
 * If costBearer === 'TENANT': Debit Tenant Receivable (1110), Credit Bank/Cash
 */
export function buildPropertyExpenseJournal(
  params: {
    expenseId: string;
    expenseNumber: string;
    totalAmount: number;
    costBearer: ExpenseCostBearer;
    category: PropertyExpenseCategory;
    transactionDate: string;
    paymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    ownerId?: string;
    propertyId?: string;
    unitId?: string;
    leaseId?: string;
    tenantId?: string;
    createdBy?: string;
    notes?: string;
  },
  chartOfAccounts: AccountDefinition[]
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const amount = Math.round(params.totalAmount * 100) / 100;
  const bankCashAccount = getPaymentAssetAccount(chartOfAccounts, params.paymentMethod);

  let debitAccount: AccountDefinition;

  if (params.costBearer === "OWNER") {
    debitAccount = findAccountByCodeOrType(chartOfAccounts, "2010", "LIABILITY"); // Owner Payable
  } else if (params.costBearer === "TENANT") {
    debitAccount = findAccountByCodeOrType(chartOfAccounts, "1110", "ASSET"); // Tenant Receivable
  } else {
    // OFFICE or SHARED
    if (params.category === "UTILITIES") {
      debitAccount = findAccountByCodeOrType(chartOfAccounts, "5020", "EXPENSE");
    } else if (params.category === "MUNICIPALITY_FEES" || params.category === "LEGAL_FEES") {
      debitAccount = findAccountByCodeOrType(chartOfAccounts, "5030", "EXPENSE");
    } else if (params.category === "MAINTENANCE" || params.category === "REPAIRS") {
      debitAccount = findAccountByCodeOrType(chartOfAccounts, "5010", "EXPENSE");
    } else {
      debitAccount = findAccountByCodeOrType(chartOfAccounts, "5040", "EXPENSE");
    }
  }

  const sourceType = params.costBearer === "OFFICE" ? "OFFICE_EXPENSE" : "PROPERTY_EXPENSE";

  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountId: debitAccount.id,
      accountCode: debitAccount.accountCode,
      accountNameAr: debitAccount.accountNameAr,
      accountNameEn: debitAccount.accountNameEn,
      debit: amount,
      credit: 0,
      description: `مصروف (${params.category}) - #${params.expenseNumber} [تحمل: ${params.costBearer}]`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    },
    {
      id: `line-${Date.now()}-2`,
      accountId: bankCashAccount.id,
      accountCode: bankCashAccount.accountCode,
      accountNameAr: bankCashAccount.accountNameAr,
      accountNameEn: bankCashAccount.accountNameEn,
      debit: 0,
      credit: amount,
      description: `صرف قيمة المصروف #${params.expenseNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    },
  ];

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: params.expenseNumber,
    sourceType,
    sourceId: params.expenseId,
    description: params.notes || `قيد تسجيل مصروفات #${params.expenseNumber}`,
    totalDebit: amount,
    totalCredit: amount,
    createdBy: params.createdBy || "النظام المحاسبي",
    lines,
  };
}

/**
 * 5. Bounced Cheque Journal Builder
 * Debit: Tenant Receivable (1110)
 * Credit: Cheques Under Collection (1120)
 * If penalty charged: Debit Tenant Receivable (1110), Credit Bounced Cheque Penalty Income (4040)
 */
export function buildBouncedChequeJournal(
  params: {
    chequeId: string;
    chequeNumber: string;
    amount: number;
    penaltyFee?: number;
    transactionDate: string;
    ownerId?: string;
    propertyId?: string;
    leaseId?: string;
    tenantId?: string;
    createdBy?: string;
    notes?: string;
  },
  chartOfAccounts: AccountDefinition[]
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const chequeAmount = Math.round(params.amount * 100) / 100;
  const penalty = params.penaltyFee && params.penaltyFee > 0 ? Math.round(params.penaltyFee * 100) / 100 : 0;
  const totalDebit = Math.round((chequeAmount + penalty) * 100) / 100;

  const tenantReceivable = findAccountByCodeOrType(chartOfAccounts, "1110", "ASSET");
  const chequesUnderCollection = findAccountByCodeOrType(chartOfAccounts, "1120", "ASSET");
  const penaltyIncomeAccount = findAccountByCodeOrType(chartOfAccounts, "4040", "INCOME");

  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountId: tenantReceivable.id,
      accountCode: tenantReceivable.accountCode,
      accountNameAr: tenantReceivable.accountNameAr,
      accountNameEn: tenantReceivable.accountNameEn,
      debit: totalDebit,
      credit: 0,
      description: `إعادة قيد شيك مرتجع على المستأجر (شيك #${params.chequeNumber})`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    },
    {
      id: `line-${Date.now()}-2`,
      accountId: chequesUnderCollection.id,
      accountCode: chequesUnderCollection.accountCode,
      accountNameAr: chequesUnderCollection.accountNameAr,
      accountNameEn: chequesUnderCollection.accountNameEn,
      debit: 0,
      credit: chequeAmount,
      description: `إلغاء شيك تحت التحصيل بسب الارتجاع (شيك #${params.chequeNumber})`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    },
  ];

  if (penalty > 0) {
    lines.push({
      id: `line-${Date.now()}-3`,
      accountId: penaltyIncomeAccount.id,
      accountCode: penaltyIncomeAccount.accountCode,
      accountNameAr: penaltyIncomeAccount.accountNameAr,
      accountNameEn: penaltyIncomeAccount.accountNameEn,
      debit: 0,
      credit: penalty,
      description: `إيرادات غرامة ارتجاع شيك #${params.chequeNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    });
  }

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: `CHQ-${params.chequeNumber}`,
    sourceType: "BOUNCED_CHEQUE",
    sourceId: params.chequeId,
    description: params.notes || `قيد ارتجاع شيك إيجار #${params.chequeNumber}`,
    totalDebit,
    totalCredit: totalDebit,
    createdBy: params.createdBy || "النظام المحاسبي",
    lines,
  };
}

/**
 * 6. Reverse Posted Journal Entry
 * Creates an exact mirrored entry with Debits and Credits swapped.
 */
export function buildReversalJournalEntry(
  originalEntry: JournalEntryRecord,
  reversalReason: string,
  reversalBy: string
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const reversedLines: JournalLine[] = originalEntry.lines.map((l, index) => ({
    id: `rev-line-${Date.now()}-${index + 1}`,
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountNameAr: l.accountNameAr,
    accountNameEn: l.accountNameEn,
    debit: l.credit, // SWAP
    credit: l.debit, // SWAP
    description: `عكس قيد: ${l.description || ""}`,
    ownerId: l.ownerId,
    propertyId: l.propertyId,
    unitId: l.unitId,
    leaseId: l.leaseId,
    tenantId: l.tenantId,
  }));

  return {
    transactionDate: new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: `REV-${originalEntry.entryNumber}`,
    sourceType: "FINANCIAL_REVERSAL",
    sourceId: originalEntry.id,
    description: `عكس قيد محاسبي للقيد رقم #${originalEntry.entryNumber} - السبب: ${reversalReason}`,
    totalDebit: originalEntry.totalCredit,
    totalCredit: originalEntry.totalDebit,
    createdBy: reversalBy,
    originalEntryId: originalEntry.id,
    lines: reversedLines,
  };
}

/**
 * 7. Security Deposit Collection Journal Entry (Tenant Liability - Account 2020)
 * Accounting Treatment:
 *   Debit: Bank (1010) / Cash (1020) / Cheques Under Collection (1120)
 *   Credit: Tenant Security Deposits (2020) - Refundable Liability, VAT Exempt (0%)
 */
export function buildSecurityDepositCollectionJournal(
  chartOfAccounts: AccountDefinition[],
  params: {
    leaseId: string;
    leaseNumber: string;
    tenantId: string;
    ownerId?: string;
    propertyId?: string;
    unitId?: string;
    amount: number;
    paymentMethod: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    receiptNumber: string;
    chequeNumber?: string;
    bankName?: string;
    transactionDate?: string;
    createdBy?: string;
    notes?: string;
  }
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const roundedAmount = Math.round(params.amount * 100) / 100;
  const lines: JournalLine[] = [];

  // Determine Asset Account (Debit)
  let assetCode = "1010"; // Default: Operating Bank
  if (params.paymentMethod === "CASH") {
    assetCode = "1020";
  } else if (params.paymentMethod === "CHEQUE") {
    assetCode = "1130"; // Held Security Cheques
  }
  const debitAccount = findAccountByCodeOrType(chartOfAccounts, assetCode, "ASSET");

  // Credit Account: Tenant Security Deposits (2020)
  const creditAccount = findAccountByCodeOrType(chartOfAccounts, "2020", "LIABILITY");

  // Line 1: Debit Asset
  lines.push({
    id: `sd-col-line-${Date.now()}-1`,
    accountId: debitAccount.id,
    accountCode: debitAccount.accountCode,
    accountNameAr: debitAccount.accountNameAr,
    accountNameEn: debitAccount.accountNameEn,
    debit: roundedAmount,
    credit: 0,
    description: `استلام تأمين صيانة مستأجر لعقد #${params.leaseNumber} - سند #${params.receiptNumber}${params.chequeNumber ? ` (شيك #${params.chequeNumber})` : ""}`,
    ownerId: params.ownerId,
    propertyId: params.propertyId,
    unitId: params.unitId,
    leaseId: params.leaseId,
    tenantId: params.tenantId,
  });

  // Line 2: Credit Liability (2020)
  lines.push({
    id: `sd-col-line-${Date.now()}-2`,
    accountId: creditAccount.id,
    accountCode: creditAccount.accountCode,
    accountNameAr: creditAccount.accountNameAr,
    accountNameEn: creditAccount.accountNameEn,
    debit: 0,
    credit: roundedAmount,
    description: `أمانات تأمين صيانة مستأجرين محتجزة لعقد #${params.leaseNumber} (غير خاضع للضريبة - التزام مالي)`,
    ownerId: params.ownerId,
    propertyId: params.propertyId,
    unitId: params.unitId,
    leaseId: params.leaseId,
    tenantId: params.tenantId,
  });

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: params.receiptNumber || `DEP-${params.leaseNumber}`,
    sourceType: "SECURITY_DEPOSIT",
    sourceId: params.leaseId,
    description: params.notes || `تحصيل أمانات تأمين صيانة مستأجر لعقد إيجار #${params.leaseNumber} (حساب 2020)`,
    totalDebit: roundedAmount,
    totalCredit: roundedAmount,
    createdBy: params.createdBy || "النظام المالي",
    lines,
  };
}

/**
 * 8. Security Deposit Settlement & Refund Journal Entry
 * Formula: Held Amount (Debit 2020) - Deductions (Credit) = Net Refund (Credit 1010/1020)
 */
export function buildSecurityDepositSettlementJournal(
  chartOfAccounts: AccountDefinition[],
  params: {
    leaseId: string;
    leaseNumber: string;
    tenantId: string;
    ownerId?: string;
    propertyId?: string;
    unitId?: string;
    totalHeldAmount: number;
    deductions: {
      rentDeduction?: number;
      maintenanceDeduction?: number;
      earlyTerminationDeduction?: number;
      otherDeductions?: number;
    };
    netRefundAmount: number;
    refundPaymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    reference?: string;
    transactionDate?: string;
    createdBy?: string;
    notes?: string;
  }
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const held = Math.round(params.totalHeldAmount * 100) / 100;
  const rentDed = Math.round((params.deductions.rentDeduction || 0) * 100) / 100;
  const maintDed = Math.round((params.deductions.maintenanceDeduction || 0) * 100) / 100;
  const earlyTermDed = Math.round((params.deductions.earlyTerminationDeduction || 0) * 100) / 100;
  const otherDed = Math.round((params.deductions.otherDeductions || 0) * 100) / 100;
  const refund = Math.round(params.netRefundAmount * 100) / 100;

  const lines: JournalLine[] = [];
  let lineIndex = 1;

  // Debit: Liability Account 2020 for the full held amount being settled
  const secDepositAccount = findAccountByCodeOrType(chartOfAccounts, "2020", "LIABILITY");
  lines.push({
    id: `sd-set-line-${Date.now()}-${lineIndex++}`,
    accountId: secDepositAccount.id,
    accountCode: secDepositAccount.accountCode,
    accountNameAr: secDepositAccount.accountNameAr,
    accountNameEn: secDepositAccount.accountNameEn,
    debit: held,
    credit: 0,
    description: `إقفال وتسوية أمانات تأمين المستأجر المحتجزة لعقد #${params.leaseNumber}`,
    ownerId: params.ownerId,
    propertyId: params.propertyId,
    unitId: params.unitId,
    leaseId: params.leaseId,
    tenantId: params.tenantId,
  });

  // Credit 1: Rent Arrears Deduction -> Tenant Receivable (1110)
  if (rentDed > 0) {
    const arAccount = findAccountByCodeOrType(chartOfAccounts, "1110", "ASSET");
    lines.push({
      id: `sd-set-line-${Date.now()}-${lineIndex++}`,
      accountId: arAccount.id,
      accountCode: arAccount.accountCode,
      accountNameAr: arAccount.accountNameAr,
      accountNameEn: arAccount.accountNameEn,
      debit: 0,
      credit: rentDed,
      description: `خصم مستحقات إيجارية متأخرة من التأمين لعقد #${params.leaseNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    });
  }

  // Credit 2: Maintenance Charges Deduction -> Tenant Other Receivables (1115)
  if (maintDed > 0) {
    const maintAccount = findAccountByCodeOrType(chartOfAccounts, "1115", "ASSET");
    lines.push({
      id: `sd-set-line-${Date.now()}-${lineIndex++}`,
      accountId: maintAccount.id,
      accountCode: maintAccount.accountCode,
      accountNameAr: maintAccount.accountNameAr,
      accountNameEn: maintAccount.accountNameEn,
      debit: 0,
      credit: maintDed,
      description: `تسديد مستحقات صيانة على المستأجر من التأمين لعقد #${params.leaseNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    });
  }

  // Credit 3: Early Termination Deduction -> Other Revenue / Penalties (4040)
  if (earlyTermDed > 0) {
    const penaltyAccount = findAccountByCodeOrType(chartOfAccounts, "4040", "INCOME");
    lines.push({
      id: `sd-set-line-${Date.now()}-${lineIndex++}`,
      accountId: penaltyAccount.id,
      accountCode: penaltyAccount.accountCode,
      accountNameAr: penaltyAccount.accountNameAr,
      accountNameEn: penaltyAccount.accountNameEn,
      debit: 0,
      credit: earlyTermDed,
      description: `خصم غرامة فسخ مبكر من التأمين لعقد #${params.leaseNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    });
  }

  // Credit 4: Other Clearance Deductions -> Tenant Other Receivables (1115)
  if (otherDed > 0) {
    const otherAccount = findAccountByCodeOrType(chartOfAccounts, "1115", "ASSET");
    lines.push({
      id: `sd-set-line-${Date.now()}-${lineIndex++}`,
      accountId: otherAccount.id,
      accountCode: otherAccount.accountCode,
      accountNameAr: otherAccount.accountNameAr,
      accountNameEn: otherAccount.accountNameEn,
      debit: 0,
      credit: otherDed,
      description: `تسوية مستحقات أخرى على المستأجر من التأمين لعقد #${params.leaseNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    });
  }

  // Credit 5: Net Refund to Tenant -> Bank (1010) or Cash (1020)
  if (refund > 0) {
    const refundAssetCode = params.refundPaymentMethod === "CASH" ? "1020" : "1010";
    const payoutAccount = findAccountByCodeOrType(chartOfAccounts, refundAssetCode, "ASSET");
    lines.push({
      id: `sd-set-line-${Date.now()}-${lineIndex++}`,
      accountId: payoutAccount.id,
      accountCode: payoutAccount.accountCode,
      accountNameAr: payoutAccount.accountNameAr,
      accountNameEn: payoutAccount.accountNameEn,
      debit: 0,
      credit: refund,
      description: `صرف ورد صافي مبلغ التأمين للمستأجر لعقد #${params.leaseNumber}`,
      ownerId: params.ownerId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
    });
  }

  const totalDebit = held;
  const totalCredit = Math.round((rentDed + maintDed + earlyTermDed + otherDed + refund) * 100) / 100;

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: params.reference || `SET-SD-${params.leaseNumber}`,
    sourceType: "SECURITY_DEPOSIT_SETTLEMENT",
    sourceId: params.leaseId,
    description: params.notes || `تسوية وبراءة ذمة تأمين مستأجر لعقد #${params.leaseNumber} (إجمالي المحتجز: ${held} AED)`,
    totalDebit,
    totalCredit,
    createdBy: params.createdBy || "النظام المالي",
    lines,
  };
}

/**
 * 9. Direct Security Deposit Refund Journal Entry (Without deductions)
 */
/**
 * Bank Deposit Journal Builder
 * Moves funds from Cash in Hand (1020) to Operating Bank (1010) upon verification of deposit slip
 */
export function buildBankDepositJournal(
  params: {
    batchId?: string;
    sourceType: "SECURITY_DEPOSIT" | "OWNER_TRANSFER" | "ADMINISTRATIVE_FEE" | "PROPERTY_EXPENSE" | "BATCH" | "DAILY_DEPOSIT";
    sourceId: string;
    totalAmount: number;
    transactionDate: string;
    referenceNumber?: string;
    notes?: string;
    createdBy?: string;
  },
  chartOfAccounts: AccountDefinition[]
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const amount = Math.round(params.totalAmount * 100) / 100;
  
  const bankAccount = findAccountByCodeOrType(chartOfAccounts, "1010", "ASSET");
  const cashAccount = findAccountByCodeOrType(chartOfAccounts, "1020", "ASSET");

  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountId: bankAccount.id,
      accountCode: bankAccount.accountCode,
      accountNameAr: bankAccount.accountNameAr,
      accountNameEn: bankAccount.accountNameEn,
      debit: amount,
      credit: 0,
      description: `إيداع نقدي بالبنك - ${params.notes || params.referenceNumber || params.sourceId}`,
    },
    {
      id: `line-${Date.now()}-2`,
      accountId: cashAccount.id,
      accountCode: cashAccount.accountCode,
      accountNameAr: cashAccount.accountNameAr,
      accountNameEn: cashAccount.accountNameEn,
      debit: 0,
      credit: amount,
      description: `تحويل النقدية من الصندوق للإيداع البنكي - ${params.notes || params.referenceNumber || params.sourceId}`,
    },
  ];

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: params.referenceNumber || params.batchId || params.sourceId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    description: params.notes || `قيد إيداع بنكي للمبالغ النقدية المحصلة`,
    totalDebit: amount,
    totalCredit: amount,
    createdBy: params.createdBy || "النظام المحاسبي",
    lines,
  };
}

export function buildSecurityDepositRefundJournal(
  chartOfAccounts: AccountDefinition[],
  params: {
    leaseId: string;
    leaseNumber: string;
    tenantId: string;
    ownerId?: string;
    propertyId?: string;
    unitId?: string;
    refundAmount: number;
    paymentMethod: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    reference?: string;
    transactionDate?: string;
    createdBy?: string;
    notes?: string;
  }
): Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status"> {
  const roundedAmount = Math.round(params.refundAmount * 100) / 100;
  const lines: JournalLine[] = [];

  // Debit: Liability 2020
  const liabilityAccount = findAccountByCodeOrType(chartOfAccounts, "2020", "LIABILITY");
  lines.push({
    id: `sd-ref-line-${Date.now()}-1`,
    accountId: liabilityAccount.id,
    accountCode: liabilityAccount.accountCode,
    accountNameAr: liabilityAccount.accountNameAr,
    accountNameEn: liabilityAccount.accountNameEn,
    debit: roundedAmount,
    credit: 0,
    description: `رد أمانات تأمين المستأجر المحتجز لعقد #${params.leaseNumber}`,
    ownerId: params.ownerId,
    propertyId: params.propertyId,
    unitId: params.unitId,
    leaseId: params.leaseId,
    tenantId: params.tenantId,
  });

  // Credit: Asset 1010 or 1020
  const assetCode = params.paymentMethod === "CASH" ? "1020" : "1010";
  const assetAccount = findAccountByCodeOrType(chartOfAccounts, assetCode, "ASSET");
  lines.push({
    id: `sd-ref-line-${Date.now()}-2`,
    accountId: assetAccount.id,
    accountCode: assetAccount.accountCode,
    accountNameAr: assetAccount.accountNameAr,
    accountNameEn: assetAccount.accountNameEn,
    debit: 0,
    credit: roundedAmount,
    description: `صرف رد مبلغ تأمين مستأجر لعقد #${params.leaseNumber} عن طريق ${params.paymentMethod}`,
    ownerId: params.ownerId,
    propertyId: params.propertyId,
    unitId: params.unitId,
    leaseId: params.leaseId,
    tenantId: params.tenantId,
  });

  return {
    transactionDate: params.transactionDate || new Date().toISOString().split("T")[0],
    postingDate: new Date().toISOString(),
    reference: params.reference || `REF-SD-${params.leaseNumber}`,
    sourceType: "SECURITY_DEPOSIT_REFUND",
    sourceId: params.leaseId,
    description: params.notes || `رد مبلغ تأمين مستأجر لعقد #${params.leaseNumber} بمبلغ ${roundedAmount} AED`,
    totalDebit: roundedAmount,
    totalCredit: roundedAmount,
    createdBy: params.createdBy || "النظام المالي",
    lines,
  };
}
