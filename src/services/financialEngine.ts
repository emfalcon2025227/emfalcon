/**
 * EMIRATES FALCON ERP — PHASE 1 FINANCIAL ENGINE
 * Authoritative Single Source of Truth, Allocation, Commission & Reversal Service
 */

import {
  CommissionObligation,
  PaymentAllocation,
  CollectionRecord,
  Cheque,
  Lease,
  FinancialReversalRecord,
  FinancialAdjustmentRecord,
  ReconciledFinancialBalances,
  CommissionPartyType,
  CommissionType,
  FinancialCommissionSettings,
  AccountDefinition,
  OwnerTransferRecord,
  PropertyExpenseRecord,
  JournalEntryRecord,
  OwnerStatementReport,
  OwnerStatementItem,
  TenantStatementReport,
  TenantStatementItem,
  PaymentMethod,
  Owner,
  Tenant,
  OwnerTransferReconciliation,
  VatRateRecord,
  VatRateCategory,
  CommissionStatus,
  CommissionCalculationBasis,
  AdminFeeExemptionPolicy,
  FinancialPeriod,
} from "../types";
import { matchBankNames, normalizeBankName } from "../utils/bankUtils";

export type {
  OwnerStatementReport,
  OwnerStatementItem,
  TenantStatementReport,
  TenantStatementItem,
};

export const DEFAULT_COMMISSION_SETTINGS: FinancialCommissionSettings = {
  defaultOwnerCommissionRate: 5.0,
  defaultTenantCommissionRate: 5.0,
  allowCustomRatePerLease: true,
};

/**
 * PHASE 5.1: Centralized Administrative Fee Policy Resolver.
 * Determines the applicable Administrative Fee rate based on system defaults.
 * (Future phases will expand this to handle party-specific rates and exemptions).
 */
export function resolveAdministrativeFeePolicy(
  partyType: CommissionPartyType,
  partyId?: string, // Used for party-specific rate lookups
  leasePolicy?: { owner?: AdminFeeExemptionPolicy; tenant?: AdminFeeExemptionPolicy }, // Contract-level policy
  settings: FinancialCommissionSettings = DEFAULT_COMMISSION_SETTINGS,
  owners: Owner[] = [],
  tenants: Tenant[] = []
): { 
  rate: number; 
  source: "SYSTEM_DEFAULT" | "PARTY_OVERRIDE" | "CONTRACT_EXEMPTION";
  isExempt: boolean;
  exemptionDetails?: AdminFeeExemptionPolicy;
} {
  // 1. Check Contract-Level Exemptions (Priority 1)
  if (leasePolicy) {
    const policy = partyType === "OWNER" ? leasePolicy.owner : leasePolicy.tenant;
    if (policy && policy.isExempt && policy.approvalStatus === "APPROVED") {
      return {
        rate: 0,
        source: "CONTRACT_EXEMPTION",
        isExempt: true,
        exemptionDetails: policy
      };
    }
  }

  // 2. Check Party-Specific Overrides (Priority 2)
  if (partyId) {
    if (partyType === "OWNER") {
      const owner = owners.find(o => o.id === partyId);
      if (owner && typeof owner.specialAdminFeeRate === "number") {
        return {
          rate: owner.specialAdminFeeRate,
          source: "PARTY_OVERRIDE",
          isExempt: false,
        };
      }
    } else if (partyType === "TENANT") {
      const tenant = tenants.find(t => t.id === partyId);
      if (tenant && typeof tenant.specialAdminFeeRate === "number") {
        return {
          rate: tenant.specialAdminFeeRate,
          source: "PARTY_OVERRIDE",
          isExempt: false,
        };
      }
    }
  }

  // 3. Fallback to System Defaults (Priority 3)
  const rate = partyType === "OWNER" 
    ? settings.defaultOwnerCommissionRate 
    : settings.defaultTenantCommissionRate;

  return {
    rate,
    source: "SYSTEM_DEFAULT",
    isExempt: false,
  };
}
/**
 * Validates whether the transaction date falls within an open financial period.
 * Returns { allowed: boolean, errorAr?: string, errorEn?: string }
 */
export function validateTransactionPeriod(
  transactionDate: string,
  financialPeriods: FinancialPeriod[]
): { allowed: boolean; errorAr?: string; errorEn?: string } {
  if (!financialPeriods || financialPeriods.length === 0) {
    return { allowed: true };
  }

  const txDate = new Date(transactionDate);
  if (isNaN(txDate.getTime())) {
    return { allowed: true };
  }
  txDate.setHours(0, 0, 0, 0);

  // Find the period matching the date
  const period = financialPeriods.find(p => {
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return txDate >= start && txDate <= end;
  });

  if (!period) {
    return {
      allowed: false,
      errorAr: "لا يمكن تسجيل المعاملة: لا توجد فترة مالية مطابقة لهذا التاريخ.",
      errorEn: "Transaction cannot be recorded: No matching financial period for this date.",
    };
  }

  if (period.status === "CLOSED") {
    return {
      allowed: false,
      errorAr: "لا يمكن تسجيل هذه المعاملة لأن الفترة المالية مغلقة. يجب استخدام إجراء العكس أو التسوية المعتمد.",
      errorEn: "This transaction cannot be recorded because the financial period is closed. Use the approved reversal or adjustment workflow.",
    };
  }

  return { allowed: true };
}

export const INITIAL_FINANCIAL_PERIODS: FinancialPeriod[] = Array.from({ length: 16 }, (_, i) => {
  const year = 2020 + i;
  return {
    id: `fp-${year}`,
    name: `السنة المالية ${year} (FY-${year})`,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    status: "OPEN" as const,
    openedAt: `${year}-01-01T00:00:00.000Z`,
    openedBy: "System",
  };
});

/**
 * Validates whether a financial period can be closed.
 * Checks for unposted transactions or unbalanced journal entries.
 */
export function validateFinancialPeriodClosing(
  period: FinancialPeriod,
  data: {
    journalEntries: JournalEntryRecord[];
    collections: CollectionRecord[];
    ownerTransfers: OwnerTransferRecord[];
  }
): { canClose: boolean; errors: string[] } {
  const errors: string[] = [];
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Check for unbalanced journal entries in this period
  const periodJournals = data.journalEntries.filter(j => {
    const d = new Date(j.transactionDate);
    return d >= start && d <= end;
  });

  periodJournals.forEach(j => {
    const debit = j.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const credit = j.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    if (Math.abs(debit - credit) > 0.01) {
      errors.push(`قيد اليومية ${j.entryNumber} غير متوازن (المدين: ${debit}, الدائن: ${credit})`);
    }
  });

  // Check for pending owner transfers in this period
  const pendingTransfers = data.ownerTransfers.filter(t => {
    const d = new Date(t.transferDate);
    return d >= start && d <= end && (t.status === "PENDING_APPROVAL" || t.status === "APPROVED");
  });

  if (pendingTransfers.length > 0) {
    errors.push(`يوجد ${pendingTransfers.length} تحويلات ملاك معلقة أو تمت الموافقة عليها ولم تكتمل بعد.`);
  }

  // Check for draft collections in this period
  const draftCollections = data.collections.filter(c => {
    const d = new Date(c.paymentDate);
    return d >= start && d <= end && (c as any).status === "DRAFT";
  });

  if (draftCollections.length > 0) {
    errors.push(`يوجد ${draftCollections.length} سندات قبض مسودة لم يتم ترحيلها.`);
  }

  return {
    canClose: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a new period overlaps with existing periods.
 */
export function canCreateFinancialPeriod(
  newPeriod: { startDate: string; endDate: string },
  existingPeriods: FinancialPeriod[]
): { allowed: boolean; error?: string } {
  const start = new Date(newPeriod.startDate);
  const end = new Date(newPeriod.endDate);

  if (start > end) {
    return { allowed: false, error: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية." };
  }

  for (const period of existingPeriods) {
    const pStart = new Date(period.startDate);
    const pEnd = new Date(period.endDate);

    if (
      (start >= pStart && start <= pEnd) ||
      (end >= pStart && end <= pEnd) ||
      (start <= pStart && end >= pEnd)
    ) {
      return {
        allowed: false,
        error: `الفترة المقترحة تتداخل مع الفترة الحالية: ${period.name} (${period.startDate} إلى ${period.endDate})`,
      };
    }
  }

  return { allowed: true };
}
export const INITIAL_CHART_OF_ACCOUNTS: AccountDefinition[] = [
  // Assets (1000 - 1999)
  {
    id: "acc-1010",
    accountCode: "1010",
    accountNameAr: "حساب البنك الرئيسي (Emirates NBD)",
    accountNameEn: "Main Operating Bank Account",
    accountType: "ASSET",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "حساب البنك التشغيلي لتحصيل الإيجارات والتحويلات",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-1020",
    accountCode: "1020",
    accountNameAr: "الصندوق والنقدية بالخزينة",
    accountNameEn: "Cash in Hand & Petty Cash",
    accountType: "ASSET",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "النقدية المقبوضة من المستأجرين",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-1110",
    accountCode: "1110",
    accountNameAr: "ذمم المستأجرين المدينة (إيجارات مستحقة)",
    accountNameEn: "Tenant Accounts Receivable",
    accountType: "ASSET",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "المبالغ الإيجارية والعمولات المستحقة على المستأجرين",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-1115",
    accountCode: "1115",
    accountNameAr: "ذمم المستأجرين الأخرى (صيانة وغرامات)",
    accountNameEn: "Tenant Other Receivables (Maintenance & Penalties)",
    accountType: "ASSET",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "المبالغ المستحقة على المستأجرين الناتجة عن الصيانة والغرامات والرسوم الأخرى",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-1120",
    accountCode: "1120",
    accountNameAr: "شيكات تحت التحصيل",
    accountNameEn: "Cheques Under Collection",
    accountType: "ASSET",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "شيكات الإيجار المستلمة والمودعة للتحصيل البنكي",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-1130",
    accountCode: "1130",
    accountNameAr: "شيكات الضمان المحتجزة",
    accountNameEn: "Held Security Cheques",
    accountType: "ASSET",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "شيكات الضمان والأمانات المحتجزة فعلياً بالمكتب",
    createdAt: "2026-01-01T00:00:00.000Z",
  },

  // Liabilities (2000 - 2999)
  {
    id: "acc-2010",
    accountCode: "2010",
    accountNameAr: "أمانات وحسابات الملاك الدائنة (Owner Payable)",
    accountNameEn: "Owner Payable Account",
    accountType: "LIABILITY",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "صافي إيرادات الإيجارات المحصلة المستحقة للملاك بعد خصم العمولات والمصاريف",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-2020",
    accountCode: "2020",
    accountNameAr: "تأمينات صيانة المستأجرين (Security Deposits)",
    accountNameEn: "Tenant Security Deposits",
    accountType: "LIABILITY",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "مبالغ التأمين المحصلة من المستأجرين والمعلقة حتى انتهاء العقد",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-2030",
    accountCode: "2030",
    accountNameAr: "دفعات إيجارية مقدمة غير مخصصة (Unallocated Prepayments)",
    accountNameEn: "Unallocated Prepayments",
    accountType: "LIABILITY",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "مبالغ مسددة مقدماً من المستأجر لم تخصص بعد لأقساط محددة",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-2040",
    accountCode: "2040",
    accountNameAr: "ضريبة القيمة المضافة المستحقة (VAT Output)",
    accountNameEn: "VAT Output Payable",
    accountType: "LIABILITY",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "ضريبة القيمة المضافة المحصلة من العمولات والرسوم الإدارية",
    createdAt: "2026-01-01T00:00:00.000Z",
  },

  // Equity (3000 - 3999)
  {
    id: "acc-3010",
    accountCode: "3010",
    accountNameAr: "الأرباح المرحلة ورأس المال",
    accountNameEn: "Retained Earnings & Capital",
    accountType: "EQUITY",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "حقوق الملكية ورأس المال التشغيلي للمؤسسة",
    createdAt: "2026-01-01T00:00:00.000Z",
  },

  // Income (4000 - 4999)
  {
    id: "acc-4010",
    accountCode: "4010",
    accountNameAr: "إيراد رسوم إدارية ووساطة الملاك (5%)",
    accountNameEn: "Owner Administrative Fees Income",
    accountType: "INCOME",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "إيرادات رسوم إدارية وإدارة التأجير من المالك",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-4020",
    accountCode: "4020",
    accountNameAr: "إيراد رسوم إدارية ووساطة المستأجرين (5%)",
    accountNameEn: "Tenant Administrative Fees Income",
    accountType: "INCOME",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "إيرادات رسوم إدارية المحصلة من المستأجرين",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-4030",
    accountCode: "4030",
    accountNameAr: "إيرادات رسوم إدارة العقارات وتجديد العقود",
    accountNameEn: "Property Management & Renewal Fees",
    accountType: "INCOME",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "إيرادات خدمات كتابة العقود وتوثيق وتجديد الإيجارات",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-4040",
    accountCode: "4040",
    accountNameAr: "إيرادات غرامات الشيكات الراجعة",
    accountNameEn: "Bounced Cheque Penalties Income",
    accountType: "INCOME",
    normalBalance: "CREDIT",
    isActive: true,
    isSystemAccount: true,
    description: "إيرادات غرامات ورسوم تأخير الشيكات المرتجعة للمكتب",
    createdAt: "2026-01-01T00:00:00.000Z",
  },

  // Expenses (5000 - 5999)
  {
    id: "acc-5010",
    accountCode: "5010",
    accountNameAr: "مصاريف صيانة وإصلاحات العقارات",
    accountNameEn: "Property Maintenance & Repairs Expense",
    accountType: "EXPENSE",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "تكاليف الصيانة الدورية والطارئة للعقارات والوحدات",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-5020",
    accountCode: "5020",
    accountNameAr: "مصاريف فواتير الخدمات العامة والكهرباء والمياه",
    accountNameEn: "Property Utilities Expense",
    accountType: "EXPENSE",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "فواتير ديوا / سيوا / المياه والكهرباء للعقارات",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-5030",
    accountCode: "5030",
    accountNameAr: "رسوم البلدية وتوثيق العقود والرسوم الحكومية",
    accountNameEn: "Municipality & Government Fees",
    accountType: "EXPENSE",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "الرسوم البلدية والحكومية والتصديقات العقارية",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acc-5040",
    accountCode: "5040",
    accountNameAr: "مصاريف إدارية وتشغيلية عامة",
    accountNameEn: "General & Administrative Expenses",
    accountType: "EXPENSE",
    normalBalance: "DEBIT",
    isActive: true,
    isSystemAccount: true,
    description: "المصاريف التشغيلية للمكتب والأنظمة والاتصالات",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

/**
 * Finds the applicable VAT rate based on effective date from the history.
 */
export function getApplicableVatRate(
  targetDate: string,
  history: VatRateRecord[],
  category: VatRateCategory = "ADMIN_FEE"
): number {
  if (!history || history.length === 0) return 5.0; // Fallback to 5% if no history

  const target = new Date(targetDate.split("T")[0]);
  
  // Filter by category and sort by effective date descending
  const applicableRates = history
    .filter(h => h.category === category || h.category === "GENERAL")
    .map(h => ({ ...h, effectiveDate: new Date(h.effectiveFrom) }))
    .filter(h => h.effectiveDate <= target)
    .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());

  return applicableRates.length > 0 ? applicableRates[0].rate : 5.0;
}

/**
 * Calculates commission obligation amount based on settings or custom rate.
 * Includes VAT logic for Phase 1 & 2 Administrative Fees.
 */
export function calculateCommissionAmount(
  baseRent: number,
  partyType: CommissionPartyType,
  customRate?: number,
  settings: FinancialCommissionSettings = DEFAULT_COMMISSION_SETTINGS,
  commissionType: CommissionType = "MANAGEMENT_FEE",
  effectiveDate: string = new Date().toISOString(),
  vatRateHistory: VatRateRecord[] = [],
  owners: Owner[] = [],
  tenants: Tenant[] = [],
  partyId?: string,
  leasePolicy?: { owner?: AdminFeeExemptionPolicy; tenant?: AdminFeeExemptionPolicy },
  forceInclusive?: boolean // Phase 53
): { 
  rate: number; 
  amount: number; 
  vatAmount: number; 
  vatRate: number; 
  netRevenue: number;
  taxTreatment: "VAT_DEDUCTION" | "NONE";
  isExempt?: boolean;
  exemptionDetails?: AdminFeeExemptionPolicy;
} {
  // Use the centralized policy resolver if no custom rate is provided
  const policy = resolveAdministrativeFeePolicy(partyType, partyId, leasePolicy, settings, owners, tenants);
  
  let rate = typeof customRate === "number" && !isNaN(customRate)
    ? customRate
    : policy.rate;

  // Force rate to 0 if exempt via contract policy
  if (policy.isExempt) {
    rate = 0;
  }

  const grossAmount = Math.round(((baseRent * rate) / 100) * 100) / 100;
  
  let vatRate = 0;
  let vatAmount = 0;
  let netRevenue = grossAmount;
  let taxTreatment: "VAT_DEDUCTION" | "NONE" = "NONE";

  // Phase 1/2/53 Business Rule: 
  // 1. Administrative Fees are taxable (VAT deducted from Gross, VAT-inclusive basis)
  // 2. Returned Cheque Penalties, Cleaning, Security are VAT-exempt (0% VAT)
  const isVatInclusive = forceInclusive || commissionType === "ADMIN_FEE";

  if (isVatInclusive && !policy.isExempt) {
    vatRate = getApplicableVatRate(effectiveDate, vatRateHistory, "ADMIN_FEE");
    // Inclusive Formula: VAT = Total * (Rate / (100 + Rate))
    vatAmount = Math.round((grossAmount * vatRate / (100 + vatRate)) * 100) / 100;
    netRevenue = Math.round((grossAmount - vatAmount) * 100) / 100;
    taxTreatment = "VAT_DEDUCTION";
  } else if (["BOUNCED_CHEQUE_PENALTY", "CLEANING_FEE", "SECURITY_FEE"].includes(commissionType)) {
    vatRate = 0;
    vatAmount = 0;
    netRevenue = grossAmount;
    taxTreatment = "NONE";
  } else if (vatRateHistory.length > 0) {
    // Default fallback for other types if they are not explicitly exempt
    vatRate = getApplicableVatRate(effectiveDate, vatRateHistory, "GENERAL");
    vatAmount = Math.round(((grossAmount * vatRate) / 100) * 100) / 100;
    netRevenue = grossAmount;
    taxTreatment = vatAmount > 0 ? "VAT_DEDUCTION" : "NONE";
  }

  return { 
    rate, 
    amount: grossAmount, 
    vatAmount, 
    vatRate, 
    netRevenue,
    taxTreatment,
    isExempt: policy.isExempt,
    exemptionDetails: policy.exemptionDetails
  };
}

/**
 * Generate a unique business key for a commission obligation to prevent duplicates.
 * Format: `leaseId:partyType:commissionType:sequenceOrPeriod`
 */
export function generateCommissionBusinessKey(
  leaseId: string,
  partyType: CommissionPartyType,
  commissionType: CommissionType,
  sequenceOrPeriod: string = "PRIMARY"
): string {
  const cleanLease = (leaseId || "").trim().toLowerCase();
  const cleanParty = (partyType || "").trim().toUpperCase();
  const cleanType = (commissionType || "").trim().toUpperCase();
  const cleanSeq = (sequenceOrPeriod || "PRIMARY").trim().toUpperCase();
  return `${cleanLease}:${cleanParty}:${cleanType}:${cleanSeq}`;
}

/**
 * Check if a proposed commission duplicate exists based on business key or properties.
 */
export function isDuplicateCommission(
  existingCommissions: CommissionObligation[],
  businessKey: string,
  excludeId?: string
): boolean {
  const targetKey = businessKey.trim().toLowerCase();
  return existingCommissions.some(
    (c) => c.businessKey.trim().toLowerCase() === targetKey && c.id !== excludeId && c.status !== "CANCELLED"
  );
}

/**
 * Validates whether proposed payment allocations exceed payment receipt or target balance.
 */
export function validatePaymentAllocations(
  paymentAmount: number,
  allocations: Array<{
    targetType: PaymentAllocation["targetType"];
    targetId: string;
    allocatedAmount: number;
    targetCurrentOutstanding?: number;
  }>,
  requireExactMatch: boolean = false
): { isValid: boolean; error?: string } {
  if (paymentAmount <= 0) {
    return { isValid: false, error: "Payment amount must be greater than zero." };
  }

  let totalAllocated = 0;

  for (const alloc of allocations) {
    if (alloc.allocatedAmount <= 0) {
      return { isValid: false, error: `Allocated amount must be positive for target ${alloc.targetId}.` };
    }

    // Check against individual obligation limit if provided (unless unallocated prepayment)
    if (
      alloc.targetType !== "UNALLOCATED_PREPAYMENT" &&
      typeof alloc.targetCurrentOutstanding === "number" &&
      alloc.allocatedAmount > alloc.targetCurrentOutstanding + 0.0001
    ) {
      return {
        isValid: false,
        error: `Allocated amount (${alloc.allocatedAmount} AED) exceeds target obligation balance (${alloc.targetCurrentOutstanding} AED).`,
      };
    }

    totalAllocated += alloc.allocatedAmount;
  }

  // Check sum of allocations against total payment amount
  if (totalAllocated > paymentAmount + 0.0001) {
    return {
      isValid: false,
      error: `Sum of allocations (${totalAllocated} AED) exceeds payment receipt amount (${paymentAmount} AED).`,
    };
  }
  
  if (requireExactMatch && Math.abs(totalAllocated - paymentAmount) > 0.0001) {
    return {
      isValid: false,
      error: `Sum of allocations (${totalAllocated} AED) must exactly match the payment receipt amount (${paymentAmount} AED).`,
    };
  }

  return { isValid: true };
}

/**
 * Computes derived balances for a specific Cheque based on its cleared state and active payment allocations.
 */
export function computeChequeDerivedBalance(
  cheque: Cheque,
  allocations: PaymentAllocation[]
): { totalApplied: number; outstanding: number; isFullyCollected: boolean } {
  const activeAllocations = allocations.filter(
    (a) => a.targetId === cheque.id && a.targetType === "CHEQUE" && a.status === "ACTIVE"
  );

  const totalApplied = activeAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const outstanding = Math.max(0, cheque.amount - totalApplied);
  const isFullyCollected = outstanding <= 0;

  return { totalApplied, outstanding, isFullyCollected };
}

/**
 * Computes derived balances for a Commission Obligation from active allocations.
 */
export function computeCommissionDerivedBalance(
  commission: CommissionObligation,
  allocations: PaymentAllocation[]
): { collectedAmount: number; outstandingBalance: number; status: CommissionObligation["status"] } {
  const activeAllocations = allocations.filter(
    (a) => a.targetId === commission.id && a.targetType === "COMMISSION" && a.status === "ACTIVE"
  );

  let collectedAmount = activeAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  
  if (collectedAmount === 0 && (commission.status === "COLLECTED" || commission.status === "FULLY_COLLECTED")) {
    collectedAmount = commission.totalCommissionAmount;
  } else if (commission.collectedAmount > 0 && collectedAmount === 0) {
    collectedAmount = commission.collectedAmount;
  }

  const outstandingBalance = Math.max(0, commission.totalCommissionAmount - collectedAmount);

  let status: CommissionObligation["status"] = "PENDING";
  if (collectedAmount >= commission.totalCommissionAmount - 0.0001) {
    status = "FULLY_COLLECTED";
  } else if (collectedAmount > 0) {
    status = "PARTIALLY_COLLECTED";
  } else if (commission.status === "WAIVED") {
    status = "WAIVED";
  } else if (commission.status === "CANCELLED") {
    status = "CANCELLED";
  } else if (commission.status === "REVERSED") {
    status = "REVERSED";
  } else if (commission.status === "DUE") {
    status = "DUE";
  } else {
    status = commission.status || "PENDING";
  }

  return { collectedAmount, outstandingBalance, status };
}

/**
 * Reconciles and recalculates all derived financial balances across the entire dataset
 * strictly from authoritative source transactions and active allocations.
 */
export function recalculateAllFinancialBalances(data: {
  leases: Lease[];
  cheques: Cheque[];
  collections: CollectionRecord[];
  commissions: CommissionObligation[];
  paymentAllocations: PaymentAllocation[];
  reversals: FinancialReversalRecord[];
  adjustments: FinancialAdjustmentRecord[];
  owners: Owner[];
  ownerTransfers: OwnerTransferRecord[];
}): ReconciledFinancialBalances {
  const discrepancies: string[] = [];

  const activeAllocations = data.paymentAllocations.filter((a) => a.status === "ACTIVE");

  // 1. Cheques verification & balance derivation
  const chequeBalances: Record<string, { amount: number; totalApplied: number; outstanding: number; status: Cheque["status"] }> = {};
  for (const chq of data.cheques) {
    const { totalApplied, outstanding } = computeChequeDerivedBalance(chq, activeAllocations);
    
    // In our system, if cheque is not bounced and is CLEARED, it was collected via bank
    let expectedTotalApplied = totalApplied;
    let expectedOutstanding = outstanding;
    
    if (chq.status === "CLEARED" && totalApplied === 0) {
      // Normal cleared cheque without explicit allocation record yet
      expectedTotalApplied = chq.amount;
      expectedOutstanding = 0;
    }

    chequeBalances[chq.id] = {
      amount: chq.amount,
      totalApplied: expectedTotalApplied,
      outstanding: expectedOutstanding,
      status: chq.status,
    };
  }

  // 2. Commissions verification & balance derivation
  const commissionBalances: Record<string, { totalObligation: number; totalCollected: number; remaining: number; status: CommissionObligation["status"] }> = {};
  for (const com of data.commissions) {
    const { collectedAmount, outstandingBalance, status } = computeCommissionDerivedBalance(com, activeAllocations);
    commissionBalances[com.id] = {
      totalObligation: com.totalCommissionAmount,
      totalCollected: collectedAmount,
      remaining: outstandingBalance,
      status,
    };
  }

  // 3. Tenant balances
  const tenantBalances: Record<string, { totalDue: number; totalPaid: number; outstanding: number }> = {};
  for (const lse of data.leases) {
    if (!lse.tenantId) continue;
    if (!tenantBalances[lse.tenantId]) {
      tenantBalances[lse.tenantId] = { totalDue: 0, totalPaid: 0, outstanding: 0 };
    }
    tenantBalances[lse.tenantId].totalDue += lse.annualRent;
  }

  // Add tenant commissions to due amount
  for (const com of data.commissions) {
    if (com.partyType === "TENANT" && com.tenantId) {
      if (!tenantBalances[com.tenantId]) {
        tenantBalances[com.tenantId] = { totalDue: 0, totalPaid: 0, outstanding: 0 };
      }
      tenantBalances[com.tenantId].totalDue += com.totalCommissionAmount;
    }
  }

  // Compute tenant payments from collections
  for (const col of data.collections) {
    if (col.tenantId && tenantBalances[col.tenantId]) {
      // Check if collection has active reversals
      const isReversed = data.reversals.some((r) => r.targetId === col.id && r.targetType === "COLLECTION");
      if (!isReversed) {
        tenantBalances[col.tenantId].totalPaid += col.amountEntered;
      }
    }
  }

  for (const tId in tenantBalances) {
    tenantBalances[tId].outstanding = Math.max(0, tenantBalances[tId].totalDue - tenantBalances[tId].totalPaid);
  }

  // 4. Owner Transfer Reconciliation
  const ownerTransferReconciliation: Record<string, OwnerTransferReconciliation> = {};
  const derivedOwnerHeld: Record<string, number> = {};
  const derivedOwnerPaid: Record<string, number> = {};

  for (const t of data.ownerTransfers) {
    if (t.isReversed) continue;
    
    // Held amounts: DRAFT, PENDING_APPROVAL, APPROVED
    if (["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(t.status)) {
      derivedOwnerHeld[t.ownerId] = (derivedOwnerHeld[t.ownerId] || 0) + t.amount;
    }
    
    // Paid amounts: PAID, COMPLETED, RECONCILED
    if (["PAID", "COMPLETED", "RECONCILED"].includes(t.status)) {
      derivedOwnerPaid[t.ownerId] = (derivedOwnerPaid[t.ownerId] || 0) + t.amount;
    }
  }

  // 5. Owner balances & Counter validation
  const ownerBalances: Record<string, { rentCollected: number; deductions: number; ownerPayable: number; transferred: number; netBalance: number }> = {};
  for (const col of data.collections) {
    if (!col.ownerId) continue;
    if (!ownerBalances[col.ownerId]) {
      ownerBalances[col.ownerId] = { rentCollected: 0, deductions: 0, ownerPayable: 0, transferred: 0, netBalance: 0 };
    }
    const isReversed = data.reversals.some((r) => r.targetId === col.id && r.targetType === "COLLECTION");
    if (!isReversed) {
      const rentColAmt = col.amountEntered - (col.bouncedFeeAmount || 0);
      if (rentColAmt > 0) {
        ownerBalances[col.ownerId].rentCollected += rentColAmt;
      }
    }
  }

  // Deduct owner commissions
  for (const com of data.commissions) {
    if (com.partyType === "OWNER" && com.ownerId) {
      if (!ownerBalances[com.ownerId]) {
        ownerBalances[com.ownerId] = { rentCollected: 0, deductions: 0, ownerPayable: 0, transferred: 0, netBalance: 0 };
      }
      ownerBalances[com.ownerId].deductions += com.totalCommissionAmount;
    }
  }

  // Finalize owner position & validate counters
  for (const owner of data.owners) {
    const oId = owner.id;
    if (!ownerBalances[oId]) {
      ownerBalances[oId] = { rentCollected: 0, deductions: 0, ownerPayable: 0, transferred: 0, netBalance: 0 };
    }
    
    const ob = ownerBalances[oId];
    ob.transferred = derivedOwnerPaid[oId] || 0;
    ob.ownerPayable = Math.max(0, ob.rentCollected - ob.deductions);
    ob.netBalance = Math.max(0, ob.ownerPayable - ob.transferred);

    // Counter Validation
    const dHeld = derivedOwnerHeld[oId] || 0;
    const dPaid = derivedOwnerPaid[oId] || 0;
    const pHeld = owner.totalHeld || 0;
    const pPaid = owner.totalPaid || 0;

    const hDisc = Math.abs(dHeld - pHeld);
    const pDisc = Math.abs(dPaid - pPaid);

    if (hDisc > 0.01 || pDisc > 0.01) {
      const msg = `فرق في حساب المالك ${owner.nameAr || oId}: ` + 
                  (hDisc > 0.01 ? `المحجوز (الفعلي: ${dHeld.toLocaleString()}, المسجل: ${pHeld.toLocaleString()}) ` : "") +
                  (pDisc > 0.01 ? `المسدد (الفعلي: ${dPaid.toLocaleString()}, المسجل: ${pPaid.toLocaleString()})` : "");
      discrepancies.push(msg);
    }

    ownerTransferReconciliation[oId] = {
      ownerId: oId,
      ownerName: owner.nameAr,
      persistedHeld: pHeld,
      derivedHeld: dHeld,
      persistedPaid: pPaid,
      derivedPaid: dPaid,
      heldDiscrepancy: pHeld - dHeld,
      paidDiscrepancy: pPaid - dPaid,
      status: (hDisc > 0.01 || pDisc > 0.01) ? "DISCREPANCY" : "MATCH"
    };
  }

  return {
    tenantBalances,
    ownerBalances,
    chequeBalances,
    commissionBalances,
    ownerTransferReconciliation,
    hasDiscrepancies: discrepancies.length > 0,
    discrepancies,
  };
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  description: string;
  runningBalance?: number;
}

function safeGetTime(d?: string | null): number {
  if (!d) return 0;
  const ms = new Date(d).getTime();
  return isNaN(ms) ? 0 : ms;
}

/**
 * Authoritative runningBalance rebuilder.
 * Ensures runningBalance is never an independently editable source of truth,
 * but always derived/recalculated in chronological sequence from ledger entries.
 */
export function rebuildLedgerRunningBalances(entries: LedgerEntry[], startingBalance: number = 0): LedgerEntry[] {
  let currentBalance = startingBalance;
  // Sort chronologically
  const sorted = [...entries].sort((a, b) => safeGetTime(a.date) - safeGetTime(b.date));
  
  return sorted.map((entry) => {
    if (entry.type === "CREDIT") {
      currentBalance += entry.amount;
    } else {
      currentBalance -= entry.amount;
    }
    return {
      ...entry,
      runningBalance: currentBalance,
    };
  });
}

// ============================================================================
// PHASE 2: OWNER PAYABLE, TRANSFERS, EXPENSES & STATEMENT ENGINES
// ============================================================================

export interface OwnerPayableDetails {
  ownerId: string;
  totalRentCollected: number;
  totalOwnerCommissions: number;
  totalOwnerExpenses: number;
  totalTransfersPaid: number;
  totalTransfersPending: number;
  totalAdjustments: number;
  currentPayableBalance: number; // Amount owed to owner ready for transfer
  netRemainingBalance: number;
}

/**
 * Computes authoritative Owner Payable balance derived strictly from source transactions.
 * Formula: Rent Collections - Owner Commissions - Owner-Borne Property Expenses - Completed Transfers ± Adjustments/Reversals
 */
export function calculateCollectionAllocations(col: CollectionRecord, paymentAllocations: PaymentAllocation[] = []) {
  const activeAllocations = paymentAllocations.filter(a => a.collectionId === col.id && a.status === "ACTIVE");
  
  if (activeAllocations.length > 0) {
    let rent = 0;
    let admin = 0;
    let municipality = 0;
    
    activeAllocations.forEach(a => {
      if (a.targetType === "RENT" || a.targetType === "LEASE_INSTALLMENT") {
        rent += a.allocatedAmount;
      } else if (a.targetType === "ADMINISTRATIVE_FEE") {
        admin += a.allocatedAmount;
      } else if (a.targetType === "MUNICIPALITY_FEE") {
        municipality += a.allocatedAmount;
      }
    });
    
    return { rent, admin, municipality, hasAllocations: true };
  } else {
    // Legacy mapping where amountEntered contains the full amount
    const bounce = col.bouncedFeeAmount || 0;
    const admin = col.adminFeeAmount || 0;
    const rent = Math.max(0, col.amountEntered - bounce - admin);
    return { rent, admin, municipality: 0, hasAllocations: false };
  }
}

export function calculateChequeAllocations(cheque: Cheque, paymentAllocations: PaymentAllocation[] = []) {
  const activeAllocations = paymentAllocations.filter(a => a.chequeId === cheque.id && a.status === "ACTIVE");
  
  if (activeAllocations.length > 0) {
    let rent = 0;
    let admin = 0;
    let municipality = 0;
    
    activeAllocations.forEach(a => {
      if (a.targetType === "RENT" || a.targetType === "LEASE_INSTALLMENT") {
        rent += a.allocatedAmount;
      } else if (a.targetType === "ADMINISTRATIVE_FEE") {
        admin += a.allocatedAmount;
      } else if (a.targetType === "MUNICIPALITY_FEE") {
        municipality += a.allocatedAmount;
      }
    });
    
    return { rent, admin, municipality, hasAllocations: true };
  } else {
    // Default backward compatibility: whole amount is RENT
    return { rent: cheque.amount, admin: 0, municipality: 0, hasAllocations: false };
  }
}

export function computeOwnerPayableDetails(
  ownerId: string,
  data: {
    collections: CollectionRecord[];
    commissions: CommissionObligation[];
    expenses: PropertyExpenseRecord[];
    transfers: OwnerTransferRecord[];
    adjustments: FinancialAdjustmentRecord[];
    reversals: FinancialReversalRecord[];
    paymentAllocations?: PaymentAllocation[];
  }
): OwnerPayableDetails {
  const reversedCollectionIds = new Set(
    data.reversals.filter((r) => r.targetType === "COLLECTION").map((r) => r.targetId)
  );
  const reversedExpenseIds = new Set(
    data.reversals.filter((r) => r.targetType === "PAYMENT_ALLOCATION" || (r as any).targetType === "EXPENSE").map((r) => r.targetId)
  );
  const reversedTransferIds = new Set(
    data.reversals.filter((r) => r.targetType === "PAYMENT_ALLOCATION" || (r as any).targetType === "OWNER_TRANSFER").map((r) => r.targetId)
  );

  // 1. Rent Collections for this Owner
  const validCollections = data.collections.filter(
    (c) => c.ownerId === ownerId && !reversedCollectionIds.has(c.id)
  );
  const totalRentCollected = validCollections.reduce((sum, c) => {
    const allocs = calculateCollectionAllocations(c, data.paymentAllocations);
    return sum + allocs.rent;
  }, 0);

  // 2. Owner Commission Deductions
  const validCommissions = data.commissions.filter(
    (c) => c.ownerId === ownerId && c.partyType === "OWNER" && c.status !== "CANCELLED"
  );
  const totalOwnerCommissions = validCommissions.reduce((sum, c) => sum + (c.totalCommissionAmount || 0), 0);

  // 3. Owner-Borne Property Expenses
  const validExpenses = data.expenses.filter(
    (e) =>
      e.ownerId === ownerId &&
      e.costBearer === "OWNER" &&
      e.status !== "CANCELLED" &&
      e.status !== "REVERSED" &&
      !reversedExpenseIds.has(e.id)
  );
  const totalOwnerExpenses = validExpenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0);

  // 4. Owner Transfers (Completed/Paid)
  const paidTransfers = data.transfers.filter(
    (t) =>
      t.ownerId === ownerId &&
      (t.status === "PAID" || t.status === "RECONCILED" || t.status === "COMPLETED") &&
      !t.isReversed &&
      !reversedTransferIds.has(t.id)
  );
  const totalTransfersPaid = paidTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);

  const pendingTransfers = data.transfers.filter(
    (t) =>
      t.ownerId === ownerId &&
      (t.status === "DRAFT" || t.status === "PENDING_APPROVAL" || t.status === "APPROVED") &&
      !t.isReversed &&
      !reversedTransferIds.has(t.id)
  );
  const totalTransfersPending = pendingTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);

  // 5. Adjustments
  const ownerAdjustments = data.adjustments.filter(
    (a) => a.targetEntityType === "OWNER" && a.targetEntityId === ownerId
  );
  let totalAdjustments = 0;
  for (const adj of ownerAdjustments) {
    if (adj.adjustmentType === "CREDIT") totalAdjustments += adj.amount;
    else if (adj.adjustmentType === "DEBIT") totalAdjustments -= adj.amount;
  }

  // Owner Payable calculation
  const grossPayable = totalRentCollected - totalOwnerCommissions - totalOwnerExpenses + totalAdjustments;
  const currentPayableBalance = Math.max(0, grossPayable - totalTransfersPaid);
  const netRemainingBalance = Math.max(0, currentPayableBalance - totalTransfersPending);

  return {
    ownerId,
    totalRentCollected,
    totalOwnerCommissions,
    totalOwnerExpenses,
    totalTransfersPaid,
    totalTransfersPending,
    totalAdjustments,
    currentPayableBalance,
    netRemainingBalance,
  };
}

/**
 * Generates an Authoritative Owner Statement covering a specific period.
 * Opening balance is strictly computed from all transactions before `dateFrom`.
 */
export function generateOwnerStatement(
  ownerId: string,
  ownerName: string,
  filters: {
    propertyId?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  data: {
    collections: CollectionRecord[];
    commissions: CommissionObligation[];
    expenses: PropertyExpenseRecord[];
    transfers: OwnerTransferRecord[];
    adjustments: FinancialAdjustmentRecord[];
    reversals: FinancialReversalRecord[];
    leases?: Lease[];
    tenants?: Tenant[];
    paymentAllocations?: PaymentAllocation[];
  }
): OwnerStatementReport {
  const reversedCollectionIds = new Set(
    data.reversals.filter((r) => r.targetType === "COLLECTION").map((r) => r.targetId)
  );

  const rawItems: Array<{
    id: string;
    date: string;
    reference: string;
    eventType: OwnerStatementItem["eventType"];
    description: string;
    propertyId?: string;
    propertyName?: string;
    unitNumber?: string;
    leaseNumber?: string;
    tenantName?: string;
    debit: number;
    credit: number;
    sourceEntityId?: string;
  }> = [];

  // Helper to find tenant name
  const getTenantNameFromId = (tid?: string) => {
    if (!tid || !data.tenants) return undefined;
    const t = data.tenants.find(t => t.id === tid);
    return t ? (t.nameAr || t.nameEn) : undefined;
  };

  // A. Rent Collections -> CREDIT (Increases Owner Payable)
  for (const col of (data.collections || [])) {
    if (!col || col.ownerId !== ownerId || reversedCollectionIds.has(col.id)) continue;
    if (filters.propertyId && (col as any).propertyId && (col as any).propertyId !== filters.propertyId) continue;

    const allocs = calculateCollectionAllocations(col, data.paymentAllocations);
    const rentAmount = allocs.rent;
    if (rentAmount <= 0) continue;

    const colId = col.id || "col";
    const createdDate = col.createdAt ? col.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    rawItems.push({
      id: `stmt-col-${colId}`,
      date: col.paymentDate || createdDate,
      reference: col.receiptNumber || `RCP-${colId.slice(0, 6)}`,
      eventType: "RENT_COLLECTED",
      description: `تحصيل إيجار / سند قبض - ${col.payerName || "المستأجر"} (${col.paymentMethod})` + (col.bouncedFeeAmount ? ` (شامل خصم غرامة الشيك الراجع لصالح المكتب)` : ""),
      propertyId: (col as any).propertyId,
      propertyName: (col as any).propertyNameAr,
      unitNumber: (col as any).unitNumber,
      leaseNumber: (col as any).leaseNumber,
      tenantName: col.payerName || getTenantNameFromId((col as any).tenantId),
      debit: 0,
      credit: rentAmount,
      sourceEntityId: colId,
    });
  }

  // B. Owner Commission Deductions -> DEBIT (Reduces Owner Payable)
  for (const com of (data.commissions || [])) {
    if (!com || com.ownerId !== ownerId || com.partyType !== "OWNER" || com.status === "CANCELLED") continue;
    if (filters.propertyId && com.propertyId && com.propertyId !== filters.propertyId) continue;

    let tName;
    if (data.leases && com.leaseId) {
      const lease = data.leases.find(l => l.id === com.leaseId);
      if (lease) tName = getTenantNameFromId(lease.tenantId);
    }

    const comId = com.id || "com";
    const createdDate = com.createdAt ? com.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    rawItems.push({
      id: `stmt-com-${comId}`,
      date: com.dueDate || createdDate,
      reference: `COM-${comId.slice(0, 6)}`,
      eventType: "OWNER_COMMISSION_DEDUCTION",
      description: `استقطاع رسوم إدارية وتأجير (${com.ratePercentage || 5}%)` + (com.vatAmount ? ` (شامل ضريبة القيمة المضافة 5%)` : "") + ` - عقد ${com.leaseId}`,
      propertyId: com.propertyId,
      tenantName: tName,
      debit: com.totalCommissionAmount,
      credit: 0,
      sourceEntityId: comId,
    });
  }

  // C. Owner-Borne Property Expenses -> DEBIT (Reduces Owner Payable)
  for (const exp of (data.expenses || [])) {
    if (!exp || exp.ownerId !== ownerId || exp.costBearer !== "OWNER" || exp.status === "CANCELLED" || exp.status === "REVERSED") continue;
    if (filters.propertyId && exp.propertyId && exp.propertyId !== filters.propertyId) continue;

    let tName;
    if (data.leases && exp.unitId) {
      const lease = data.leases.find(l => l.unitId === exp.unitId && l.contractStatus === "ACTIVE");
      if (lease) tName = getTenantNameFromId(lease.tenantId);
    }

    const expId = exp.id || "exp";
    const createdDate = exp.createdAt ? exp.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    rawItems.push({
      id: `stmt-exp-${expId}`,
      date: exp.expenseDate || createdDate,
      reference: exp.expenseNumber || `EXP-${expId.slice(0, 6)}`,
      eventType: exp.category === "MAINTENANCE" ? "MAINTENANCE_EXPENSE" : "PROPERTY_EXPENSE",
      description: `مصروف عقار: ${exp.description} (${exp.category})`,
      propertyId: exp.propertyId,
      unitNumber: exp.unitId,
      tenantName: tName,
      debit: exp.totalAmount,
      credit: 0,
      sourceEntityId: expId,
    });
  }

  // D. Owner Transfers Paid -> DEBIT (Reduces Owner Payable)
  for (const tr of (data.transfers || [])) {
    if (!tr || tr.ownerId !== ownerId || tr.status === "DRAFT" || tr.status === "REVERSED") continue;
    if (filters.propertyId && tr.propertyId && tr.propertyId !== filters.propertyId) continue;

    const trId = tr.id || "trf";
    const createdDate = tr.createdAt ? tr.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    rawItems.push({
      id: `stmt-tr-${trId}`,
      date: tr.transferDate || createdDate,
      reference: tr.transferNumber || `TRF-${trId.slice(0, 6)}`,
      eventType: "OWNER_TRANSFER",
      description: `تحويل بنكي / صرف أمانات للمالك (${tr.paymentMethod}) - مرجع: ${tr.transactionReferenceNumber || "مكتمل"}`,
      propertyId: tr.propertyId,
      debit: tr.amount,
      credit: 0,
      sourceEntityId: trId,
    });
  }

  // E. Adjustments & Reversals
  for (const adj of (data.adjustments || [])) {
    if (!adj || adj.targetEntityType !== "OWNER" || adj.targetEntityId !== ownerId) continue;
    const adjId = adj.id || "adj";
    const createdDate = adj.createdAt ? adj.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    rawItems.push({
      id: `stmt-adj-${adjId}`,
      date: adj.effectiveDate || createdDate,
      reference: adj.adjustmentNumber,
      eventType: "ADJUSTMENT",
      description: `تسوية مالية (${adj.adjustmentType}): ${adj.reason}`,
      debit: adj.adjustmentType === "DEBIT" ? adj.amount : 0,
      credit: adj.adjustmentType === "CREDIT" ? adj.amount : 0,
      sourceEntityId: adjId,
    });
  }

  // Sort strictly by date ascending
  rawItems.sort((a, b) => safeGetTime(a.date) - safeGetTime(b.date));

  // Split into Opening Balance (before dateFrom) and Period Transactions
  let openingBalance = 0;
  const periodTransactions: OwnerStatementItem[] = [];

  const fromTime = filters.dateFrom ? safeGetTime(filters.dateFrom) : -Infinity;
  const toTime = filters.dateTo ? safeGetTime(filters.dateTo + "T23:59:59") : Infinity;

  for (const item of rawItems) {
    const itemTime = safeGetTime(item.date);
    if (itemTime < fromTime) {
      openingBalance += item.credit - item.debit;
    }
  }

  let runningBalance = openingBalance;
  let totalCredits = 0;
  let totalDebits = 0;

  for (const item of rawItems) {
    const itemTime = safeGetTime(item.date);
    if (itemTime >= fromTime && itemTime <= toTime) {
      runningBalance += item.credit - item.debit;
      totalCredits += item.credit;
      totalDebits += item.debit;

      periodTransactions.push({
        id: item.id,
        date: item.date,
        reference: item.reference,
        eventType: item.eventType,
        description: item.description,
        propertyName: item.propertyName,
        unitNumber: item.unitNumber,
        leaseNumber: item.leaseNumber,
        debit: item.debit,
        credit: item.credit,
        runningBalance,
        sourceEntityId: item.sourceEntityId,
      });
    }
  }

  const closingBalance = runningBalance;

  return {
    ownerId,
    ownerName,
    propertyId: filters.propertyId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    openingBalance,
    totalCredits,
    totalDebits,
    closingBalance,
    transactions: periodTransactions,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generates an Authoritative Tenant Statement covering a specific period.
 * Debit = Rent Charges & Tenant Commissions (Increases Tenant Debt)
 * Credit = Collections & Payments (Reduces Tenant Debt)
 */
export function generateTenantStatement(
  tenantId: string,
  tenantName: string,
  filters: {
    leaseId?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  data: {
    leases: Lease[];
    collections: CollectionRecord[];
    commissions: CommissionObligation[];
    expenses: PropertyExpenseRecord[];
    cheques: Cheque[];
    adjustments: FinancialAdjustmentRecord[];
    reversals: FinancialReversalRecord[];
    paymentAllocations?: PaymentAllocation[];
  }
): TenantStatementReport {
  const reversedCollectionIds = new Set(
    (data.reversals || []).filter((r) => r.targetType === "COLLECTION").map((r) => r.targetId)
  );

  const rawItems: Array<{
    id: string;
    date: string;
    reference: string;
    eventType: TenantStatementItem["eventType"];
    category: NonNullable<TenantStatementItem["category"]>;
    status?: TenantStatementItem["status"];
    description: string;
    propertyId?: string;
    propertyName?: string;
    unitNumber?: string;
    leaseNumber?: string;
    debit: number;
    credit: number;
    sourceEntityId?: string;
  }> = [];

  let contractRentalValue = 0;
  let totalCollectedRent = 0;
  let totalPdcPending = 0;
  let totalAdminFees = 0;
  let totalAttestationFees = 0;
  let totalOtherFees = 0;

  // 1. Rent Charges from Leases (Annual Rent Contractual Value)
  for (const lse of (data.leases || [])) {
    if (!lse || lse.tenantId !== tenantId) continue;
    if (filters.leaseId && lse.id !== filters.leaseId) continue;

    contractRentalValue += lse.annualRent || 0;
    const lseId = lse.id || "lease";
    rawItems.push({
      id: `tstmt-rent-${lseId}`,
      date: lse.startDate || new Date().toISOString().slice(0, 10),
      reference: lse.leaseNumber || `LSE-${lseId.slice(0, 6)}`,
      eventType: "RENT_CHARGE",
      category: "RENT",
      status: "UNPAID",
      description: `استحقاق القيمة الإيجارية السنوية - عقد رقم ${lse.leaseNumber || lseId}`,
      propertyId: lse.propertyId,
      unitNumber: lse.unitId,
      leaseNumber: lse.leaseNumber,
      debit: lse.annualRent,
      credit: 0,
      sourceEntityId: lseId,
    });
  }

  // 2. Tenant Administrative Fees & Commissions
  for (const com of (data.commissions || [])) {
    if (!com || com.tenantId !== tenantId || com.partyType !== "TENANT" || com.status === "CANCELLED") continue;
    if (filters.leaseId && com.leaseId !== filters.leaseId) continue;

    const comDesc = (com as any).description || (com as any).notes || "";
    const isAttestation = comDesc.includes("توثيق") || comDesc.includes("تصديق") || (com as any).feeType === "ATTESTATION";
    const category = isAttestation ? "ATTESTATION_FEE" : "ADMIN_FEE";
    const eventType = isAttestation ? "ATTESTATION_FEE" : "ADMINISTRATIVE_FEE";

    if (isAttestation) {
      totalAttestationFees += com.totalCommissionAmount;
    } else {
      totalAdminFees += com.totalCommissionAmount;
    }

    const comId = com.id || "com";
    const createdDate = com.createdAt ? com.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    rawItems.push({
      id: `tstmt-com-${comId}`,
      date: com.dueDate || createdDate,
      reference: `FEE-${comId.slice(0, 6)}`,
      eventType: eventType,
      category: category,
      status: com.status === "COLLECTED" || com.status === "FULLY_COLLECTED" ? "COLLECTED" : "UNPAID",
      description: isAttestation
        ? `رسوم توثيق وتصديق عقد الإيجار (${com.totalCommissionAmount.toLocaleString()} درهم)`
        : `رسوم إدارية وخدمات تأجير (${com.ratePercentage || 5}%)` + (com.vatAmount ? ` (شامل ضريبة القيمة المضافة 5%)` : ""),
      propertyId: com.propertyId,
      unitNumber: com.unitId,
      debit: com.totalCommissionAmount,
      credit: 0,
      sourceEntityId: comId,
    });
  }

  // 3. Tenant-Borne Expenses & Attestations
  for (const exp of (data.expenses || [])) {
    if (!exp || exp.tenantId !== tenantId || exp.costBearer !== "TENANT" || exp.status === "CANCELLED" || exp.status === "REVERSED") continue;
    if (filters.leaseId && exp.leaseId !== filters.leaseId) continue;

    const isAttestation = (exp.category as string) === "CONTRACT_ATTESTATION" || (exp.description || "").includes("توثيق") || (exp.description || "").includes("تصديق");
    const category = isAttestation ? "ATTESTATION_FEE" : "EXPENSE";
    const eventType = isAttestation ? "ATTESTATION_FEE" : "TENANT_EXPENSE_CHARGE";

    if (isAttestation) {
      totalAttestationFees += exp.totalAmount;
    } else {
      totalOtherFees += exp.totalAmount;
    }

    const expId = exp.id || "exp";
    const createdDate = exp.createdAt ? exp.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    rawItems.push({
      id: `tstmt-exp-${expId}`,
      date: exp.expenseDate || createdDate,
      reference: exp.expenseNumber || `EXP-${expId.slice(0, 6)}`,
      eventType: eventType,
      category: category,
      status: (exp as any).status === "PAID" ? "COLLECTED" : "UNPAID",
      description: isAttestation
        ? `رسوم تصديق / توثيق العقد لدى البلدية: ${exp.description}`
        : `رسوم ومصاريف محملة على المستأجر: ${exp.description}`,
      propertyId: exp.propertyId,
      unitNumber: exp.unitId,
      debit: exp.totalAmount,
      credit: 0,
      sourceEntityId: expId,
    });
  }

  // 4. Payments Received (Collections / Receipts) -> CREDIT
  for (const col of (data.collections || [])) {
    if (!col || col.tenantId !== tenantId || reversedCollectionIds.has(col.id)) continue;
    const colId = col.id || "col";
    const createdDate = col.createdAt ? col.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    
    // Categorize collection
    let category: NonNullable<TenantStatementItem["category"]> = "RENT";
    let desc = `سداد دفعة إيجار / سند قبض (${col.paymentMethod})`;
    const allocs = calculateCollectionAllocations(col, data.paymentAllocations);
    const rentAmount = allocs.rent;

    if (allocs.admin && allocs.admin > 0) {
      totalAdminFees += allocs.admin;
    }
    totalCollectedRent += Math.max(0, rentAmount);

    rawItems.push({
      id: `tstmt-col-${colId}`,
      date: col.paymentDate || createdDate,
      reference: col.receiptNumber || `RCP-${colId.slice(0, 6)}`,
      eventType: "PAYMENT_RECEIVED",
      category: category,
      status: "COLLECTED",
      description: desc + (allocs.admin ? ` (شامل رسوم إدارية ${allocs.admin} درهم)` : ""),
      debit: 0,
      credit: col.amountEntered,
      sourceEntityId: colId,
    });
  }

  // 5. Cheque Installments & PDC Status Monitoring
  for (const chq of (data.cheques || [])) {
    if (!chq || chq.tenantId !== tenantId) continue;
    if (filters.leaseId && chq.leaseId !== filters.leaseId) continue;

    if (chq.status === "POST_DATED" || chq.status === "PENDING" || chq.status === "DEPOSITED") {
      totalPdcPending += chq.amount || 0;
    }
  }

  // 6. Adjustments
  for (const adj of (data.adjustments || [])) {
    if (!adj || adj.targetEntityType !== "TENANT" || adj.targetEntityId !== tenantId) continue;
    const adjId = adj.id || "adj";
    const createdDate = adj.createdAt ? adj.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    rawItems.push({
      id: `tstmt-adj-${adjId}`,
      date: adj.effectiveDate || createdDate,
      reference: adj.adjustmentNumber,
      eventType: "ADJUSTMENT",
      category: "ADJUSTMENT",
      status: "CLEARED",
      description: `تسوية مالية للمستأجر: ${adj.reason}`,
      debit: adj.adjustmentType === "DEBIT" ? adj.amount : 0,
      credit: adj.adjustmentType === "CREDIT" || adj.adjustmentType === "DISCOUNT" || adj.adjustmentType === "WAIVER" ? adj.amount : 0,
      sourceEntityId: adjId,
    });
  }

  // Sort chronologically
  rawItems.sort((a, b) => safeGetTime(a.date) - safeGetTime(b.date));

  let openingBalance = 0;
  const periodTransactions: TenantStatementItem[] = [];

  const fromTime = filters.dateFrom ? safeGetTime(filters.dateFrom) : -Infinity;
  const toTime = filters.dateTo ? safeGetTime(filters.dateTo + "T23:59:59") : Infinity;

  for (const item of rawItems) {
    const itemTime = safeGetTime(item.date);
    if (itemTime < fromTime) {
      openingBalance += item.debit - item.credit;
    }
  }

  let runningBalance = openingBalance;
  let totalDebits = 0;
  let totalCredits = 0;

  for (const item of rawItems) {
    const itemTime = safeGetTime(item.date);
    if (itemTime >= fromTime && itemTime <= toTime) {
      runningBalance += item.debit - item.credit;
      totalDebits += item.debit;
      totalCredits += item.credit;

      periodTransactions.push({
        id: item.id,
        date: item.date,
        reference: item.reference,
        eventType: item.eventType,
        category: item.category,
        status: item.status,
        description: item.description,
        propertyName: item.propertyName,
        unitNumber: item.unitNumber,
        leaseNumber: item.leaseNumber,
        debit: item.debit,
        credit: item.credit,
        runningBalance,
        sourceEntityId: item.sourceEntityId,
      });
    }
  }

  const closingBalance = runningBalance;

  return {
    tenantId,
    tenantName,
    leaseId: filters.leaseId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    openingBalance,
    totalDebits,
    totalCredits,
    closingBalance,
    contractRentalValue,
    totalCollectedRent,
    totalPdcPending,
    totalAdminFees,
    totalAttestationFees,
    totalOtherFees,
    transactions: periodTransactions,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Validates whether an Owner Transfer can be initiated safely.
 */
export function validateOwnerTransfer(
  ownerId: string,
  amount: number,
  currentPayableBalance: number
): { isValid: boolean; error?: string } {
  if (amount <= 0) {
    return { isValid: false, error: "مبلغ التحويل يجب أن يكون أكبر من الصفر." };
  }

  if (amount > currentPayableBalance + 0.0001) {
    return {
      isValid: false,
      error: `مبلغ التحويل (${amount.toLocaleString()} AED) يتجاوز الرصيد المستحق للمالك (${currentPayableBalance.toLocaleString()} AED).`,
    };
  }

  return { isValid: true };
}

/**
 * Integrates a Maintenance Request invoice directly into a Property Expense Record.
 */
export function createExpenseFromMaintenance(params: {
  maintenanceRequestId: string;
  requestNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  ownerId: string;
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  amount: number;
  vatAmount?: number;
  costBearer: "OWNER" | "TENANT" | "OFFICE" | "SHARED";
  vendorName?: string;
  description?: string;
  paymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
  userId: string;
  userName: string;
}): PropertyExpenseRecord {
  const expenseNumber = `EXP-MNT-${Date.now().toString().slice(-6)}`;
  return {
    id: `exp-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
    expenseNumber,
    ownerId: params.costBearer === "OWNER" ? params.ownerId : undefined,
    propertyId: params.propertyId,
    unitId: params.unitId,
    tenantId: params.costBearer === "TENANT" ? params.tenantId : undefined,
    category: "MAINTENANCE",
    description: params.description || `صيانة وإصلاحات - طلب صيانة ${params.requestNumber}`,
    amount: params.amount,
    vatAmount: params.vatAmount || 0,
    totalAmount: params.amount + (params.vatAmount || 0),
    expenseDate: new Date().toISOString().slice(0, 10),
    costBearer: params.costBearer,
    paymentMethod: params.paymentMethod || "BANK_TRANSFER",
    vendorName: params.vendorName,
    vendorInvoiceNumber: params.invoiceNumber,
    status: "PAID",
    sourceType: "MAINTENANCE_REQUEST",
    sourceId: params.maintenanceRequestId,
    maintenanceInvoiceId: params.invoiceId,
    createdAt: new Date().toISOString(),
    createdById: params.userId,
    createdByName: params.userName,
  };
}

export interface VerificationResult {
  status: "MATCH" | "MISMATCH" | "NEEDS_REVIEW" | "NOT_AVAILABLE";
  expected: string;
  extracted: string;
}

export interface FinancialProofVerification {
  overallStatus: "MATCH" | "MISMATCH" | "NEEDS_REVIEW" | "FAILED";
  amount: VerificationResult;
  bank: VerificationResult;
  reference: VerificationResult;
  date: VerificationResult;
  account: VerificationResult;
  failureReason?: string;
}

export function normalizeDateToYMD(dateStr: any): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Handle ISO strings (e.g., 2026-09-06T00:00:00.000Z or 2026-09-06)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }
  // Handle DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }
  // Handle YYYY/MM/DD
  const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, "0");
    const day = ymd[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  // Try Date.parse
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().substring(0, 10);
  }
  return null;
}

export function verifyFinancialProof(
  expected: {
    amount: number;
    bankName?: string;
    referenceNumber?: string;
    date?: string;
    accountNumber?: string;
  },
  extracted: any
): FinancialProofVerification {
  if (!extracted || typeof extracted !== "object") {
    return {
      overallStatus: "FAILED",
      failureReason: "Extracted data is missing or invalid.",
      amount: { status: "NOT_AVAILABLE", expected: expected.amount.toString(), extracted: "" },
      bank: { status: "NOT_AVAILABLE", expected: expected.bankName || "", extracted: "" },
      reference: { status: "NOT_AVAILABLE", expected: expected.referenceNumber || "", extracted: "" },
      date: { status: "NOT_AVAILABLE", expected: expected.date || "", extracted: "" },
      account: { status: "NOT_AVAILABLE", expected: expected.accountNumber || "", extracted: "" },
    };
  }

  const result: FinancialProofVerification = {
    overallStatus: "NEEDS_REVIEW",
    amount: { status: "NOT_AVAILABLE", expected: expected.amount.toString(), extracted: "" },
    bank: { status: "NOT_AVAILABLE", expected: expected.bankName || "", extracted: "" },
    reference: { status: "NOT_AVAILABLE", expected: expected.referenceNumber || "", extracted: "" },
    date: { status: "NOT_AVAILABLE", expected: expected.date || "", extracted: "" },
    account: { status: "NOT_AVAILABLE", expected: expected.accountNumber || "", extracted: "" },
  };

  // 1. Amount Verification (MANDATORY - Exact monetary comparison at AED currency precision of 2 decimal places)
  if (expected.amount === undefined || expected.amount === null || isNaN(Number(expected.amount)) || Number(expected.amount) <= 0) {
    result.amount.status = "NEEDS_REVIEW";
  } else {
    const extractedAmount = extracted.amount !== undefined && extracted.amount !== null ? extracted.amount : extracted.amountPaid;
    if (extractedAmount !== undefined && extractedAmount !== null && extractedAmount !== "") {
      const numExt = Number(extractedAmount);
      result.amount.extracted = extractedAmount.toString();
      if (isNaN(numExt)) {
        result.amount.status = "MISMATCH";
      } else {
        const expCents = Math.round(Number(expected.amount) * 100);
        const extCents = Math.round(numExt * 100);
        result.amount.status = (expCents === extCents) ? "MATCH" : "MISMATCH";
      }
    } else {
      result.amount.status = "NOT_AVAILABLE";
    }
  }

  // 2. Bank Verification (Deterministic matching using UAE canonical bank registry and normalized names)
  if (expected.bankName && expected.bankName.trim() && expected.bankName !== "NOT_AVAILABLE") {
    const extBank = (extracted.bankName || extracted.bank || "").toString().trim();
    result.bank.extracted = extBank;
    if (extBank) {
      const isBankMatched = matchBankNames(expected.bankName, extBank);
      result.bank.status = isBankMatched ? "MATCH" : "MISMATCH";
    } else {
      result.bank.status = "NEEDS_REVIEW";
    }
  } else {
    // If expected bank is unknown or not configured: it MUST NOT be considered MATCH!
    // Rule 6: "إذا لم يكن الحساب البنكي المتوقع معروفًا: NEEDS_REVIEW وليس: MATCH ولا يجوز افتراض بنك."
    result.bank.status = "NEEDS_REVIEW";
  }

  // 3. Reference Number Verification (Deterministic alphanumeric match)
  if (expected.referenceNumber && expected.referenceNumber.trim() && expected.referenceNumber !== "NOT_AVAILABLE") {
    const extRef = (extracted.referenceNumber || extracted.transactionReference || extracted.receiptNumber || extracted.depositNumber || "").toString().trim();
    result.reference.extracted = extRef;
    if (extRef) {
      const cleanExp = expected.referenceNumber.replace(/[\s\-_/\\#]/g, "").toUpperCase();
      const cleanExt = extRef.replace(/[\s\-_/\\#]/g, "").toUpperCase();
      result.reference.status = (cleanExt === cleanExp) ? "MATCH" : "MISMATCH";
    } else {
      result.reference.status = "NEEDS_REVIEW";
    }
  } else {
    result.reference.status = "NOT_AVAILABLE";
  }

  // 4. Account Number / IBAN Verification (Deterministic clean alphanumeric match or masked match)
  if (expected.accountNumber && expected.accountNumber.trim() && expected.accountNumber !== "NOT_AVAILABLE") {
    const extAcc = (extracted.accountNumber || extracted.iban || extracted.account || "").toString().trim();
    result.account.extracted = extAcc;
    if (extAcc) {
      const cleanExp = expected.accountNumber.replace(/[\s\-_]/g, "").toUpperCase();
      const cleanExt = extAcc.replace(/[\s\-_]/g, "").toUpperCase();
      if (cleanExp === cleanExt) {
        result.account.status = "MATCH";
      } else if (cleanExp.includes("*") || cleanExp.startsWith("X")) {
        // Handle masked account (e.g. ****1234)
        const unmaskedDigits = cleanExp.replace(/[^\d]/g, "");
        if (unmaskedDigits.length >= 4 && cleanExt.endsWith(unmaskedDigits)) {
          result.account.status = "MATCH";
        } else {
          result.account.status = "MISMATCH";
        }
      } else {
        result.account.status = "MISMATCH";
      }
    } else {
      result.account.status = "NEEDS_REVIEW";
    }
  } else {
    result.account.status = "NOT_AVAILABLE";
  }

  // 5. Date Verification (Deterministic YYYY-MM-DD parsing & comparison)
  if (expected.date && expected.date.trim() && expected.date !== "NOT_AVAILABLE") {
    const extDate = (extracted.date || extracted.transactionDate || extracted.depositDate || "").toString().trim();
    result.date.extracted = extDate;
    if (extDate) {
      const normExp = normalizeDateToYMD(expected.date);
      const normExt = normalizeDateToYMD(extDate);
      if (normExp && normExt) {
        result.date.status = (normExp === normExt) ? "MATCH" : "MISMATCH";
      } else {
        result.date.status = (extDate.trim() === expected.date.trim()) ? "MATCH" : "MISMATCH";
      }
    } else {
      result.date.status = "NEEDS_REVIEW";
    }
  } else {
    result.date.status = "NOT_AVAILABLE";
  }

  // Strict Evaluation Hierarchy according to Production Hardening Rules:
  // IF extraction FAILED => FAILED
  // ELSE IF any required field MISMATCH => MISMATCH
  // ELSE IF any required field missing / unreadable => NEEDS_REVIEW
  // ELSE IF every required field MATCH => MATCH
  
  // Collect statuses of authoritative fields:
  // Amount & Bank are ALWAYS mandatory for financial deposit verification
  const requiredEvaluations: { name: string; status: "MATCH" | "MISMATCH" | "NEEDS_REVIEW" | "NOT_AVAILABLE" }[] = [
    { name: "amount", status: result.amount.status },
    { name: "bank", status: result.bank.status }
  ];

  if (expected.referenceNumber && expected.referenceNumber.trim() && expected.referenceNumber !== "NOT_AVAILABLE") {
    requiredEvaluations.push({ name: "reference", status: result.reference.status });
  }
  if (expected.accountNumber && expected.accountNumber.trim() && expected.accountNumber !== "NOT_AVAILABLE") {
    requiredEvaluations.push({ name: "account", status: result.account.status });
  }
  if (expected.date && expected.date.trim() && expected.date !== "NOT_AVAILABLE") {
    requiredEvaluations.push({ name: "date", status: result.date.status });
  }

  const anyMismatch = requiredEvaluations.some((item) => item.status === "MISMATCH");
  const anyNeedsReviewOrMissing = requiredEvaluations.some(
    (item) => item.status === "NEEDS_REVIEW" || item.status === "NOT_AVAILABLE"
  );
  const allMatch = requiredEvaluations.length > 0 && requiredEvaluations.every((item) => item.status === "MATCH");

  if (anyMismatch) {
    result.overallStatus = "MISMATCH";
  } else if (anyNeedsReviewOrMissing) {
    result.overallStatus = "NEEDS_REVIEW";
  } else if (allMatch) {
    result.overallStatus = "MATCH";
  } else {
    result.overallStatus = "NEEDS_REVIEW";
  }

  return result;
}
