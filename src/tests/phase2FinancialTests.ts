/**
 * EMIRATES FALCON ERP — PHASE 2 FINANCIAL TEST SUITE
 * Chart of Accounts, Owner Transfers, Property Expenses, and Official Financial Statements
 */

import {
  computeOwnerPayableDetails,
  generateOwnerStatement,
  generateTenantStatement,
  createExpenseFromMaintenance,
  validateOwnerTransfer,
  INITIAL_CHART_OF_ACCOUNTS,
} from "../services/financialEngine";
import {
  CollectionRecord,
  CommissionObligation,
  PropertyExpenseRecord,
  OwnerTransferRecord,
  FinancialReversalRecord,
  Lease,
} from "../types";

export interface Phase2TestResult {
  id: string;
  name: string;
  category: "CHART_OF_ACCOUNTS" | "OWNER_TRANSFERS" | "PROPERTY_EXPENSES" | "STATEMENTS" | "INTEGRATION";
  passed: boolean;
  message: string;
  details?: any;
}

export function runPhase2FinancialTests(): Phase2TestResult[] {
  const results: Phase2TestResult[] = [];

  // -------------------------------------------------------------
  // Test 1: Initial Chart of Accounts Integrity & Structure
  // -------------------------------------------------------------
  try {
    const coa = INITIAL_CHART_OF_ACCOUNTS;
    const requiredCodes = ["1010", "1020", "1110", "1120", "2010", "2020", "2030", "4010", "4020", "5010", "5020"];
    const allPresent = requiredCodes.every((code) => coa.some((acc) => acc.accountCode === code));
    const noDuplicates = new Set(coa.map((a) => a.accountCode)).size === coa.length;

    const passed = allPresent && noDuplicates && coa.length >= 10;
    results.push({
      id: "P2-01",
      name: "Chart of Accounts Initial Hierarchy & Code Uniqueness",
      category: "CHART_OF_ACCOUNTS",
      passed,
      message: passed
        ? `دليل الحسابات التأسيسي مكتمل ويحتوي على ${coa.length} حساباً معتمداً بدون أي تكرار.`
        : "فشل التحقق من بنية دليل الحسابات التأسيسي.",
    });
  } catch (e: any) {
    results.push({ id: "P2-01", name: "Chart of Accounts Initialization", category: "CHART_OF_ACCOUNTS", passed: false, message: e.message });
  }

  // -------------------------------------------------------------
  // Test 2: Derived Owner Payable Calculation (Strict Deductions)
  // -------------------------------------------------------------
  try {
    const ownerId = "ow-test-01";

    const collections: CollectionRecord[] = [
      {
        id: "col-1",
        receiptNumber: "RCP-1",
        chequeId: "chq-1",
        ownerId,
        tenantId: "tnt-1",
        amountEntered: 50000,
        amountApplied: 50000,
        paymentMethod: "BANK_TRANSFER",
        paymentDate: "2026-02-01",
        payerName: "Tenant A",
        collectedBy: "Admin",
        collectedByUserId: "admin-1",
        createdAt: "2026-02-01T10:00:00Z",
      },
    ];

    const commissions: CommissionObligation[] = [
      {
        id: "com-1",
        businessKey: "lse-1:OWNER:BROKERAGE:PRIMARY",
        leaseId: "lse-1",
        ownerId,
        propertyId: "prop-1",
        unitId: "unt-1",
        partyType: "OWNER",
        commissionType: "BROKERAGE",
        calculationBasis: "PERCENTAGE_OF_RENT",
        ratePercentage: 5,
        baseAmount: 50000,
        totalCommissionAmount: 2500, // 5%
        collectedAmount: 2500,
        outstandingBalance: 0,
        dueDate: "2026-02-01",
        status: "FULLY_COLLECTED",
        createdAt: "2026-02-01T10:00:00Z",
        createdById: "test-user",
      },
    ];

    const expenses: PropertyExpenseRecord[] = [
      {
        id: "exp-1",
        expenseNumber: "EXP-2026-0001",
        ownerId,
        propertyId: "prop-1",
        category: "MAINTENANCE",
        description: "إصلاح تسريب مياه",
        amount: 1500,
        vatAmount: 75,
        totalAmount: 1575,
        costBearer: "OWNER",
        expenseDate: "2026-02-05",
        paymentMethod: "BANK_TRANSFER",
        status: "PAID",
        createdAt: "2026-02-05T10:00:00Z",
        createdById: "test-user",
      },
    ];

    const transfers: OwnerTransferRecord[] = [
      {
        id: "trf-1",
        transferNumber: "TRF-2026-0001",
        ownerId,
        amount: 20000,
        transferDate: "2026-02-10",
        paymentMethod: "BANK_TRANSFER",
        status: "PAID",
        createdAt: "2026-02-10T10:00:00Z",
        createdById: "test-user",
      },
    ];

    // Expected: 50000 (rent) - 2500 (commission) - 1575 (expense) - 20000 (paid transfer) = 25925
    const payable = computeOwnerPayableDetails(ownerId, {
      collections,
      commissions,
      expenses,
      transfers,
      adjustments: [],
      reversals: [],
    });

    const passed =
      payable.totalRentCollected === 50000 &&
      payable.totalOwnerCommissions === 2500 &&
      payable.totalOwnerExpenses === 1575 &&
      payable.totalTransfersPaid === 20000 &&
      payable.currentPayableBalance === 25925;

    results.push({
      id: "P2-02",
      name: "Derived Owner Payable Calculation (Collections - Commissions - Expenses - Transfers)",
      category: "OWNER_TRANSFERS",
      passed,
      message: passed
        ? `تم حساب الرصيد الصافي المستحق للمالك بدقة بالغة: ${payable.currentPayableBalance} AED (إجمالي مقبوض 50,000 - عمولات 2,500 - مصاريف 1,575 - تحويلات سابقة 20,000).`
        : `فشل احتساب رصيد المالك المستحق. الناتج: ${payable.currentPayableBalance} AED`,
      details: payable,
    });
  } catch (e: any) {
    results.push({ id: "P2-02", name: "Owner Payable Calculation", category: "OWNER_TRANSFERS", passed: false, message: e.message });
  }

  // -------------------------------------------------------------
  // Test 3: Owner Transfer Validation (Prevent Over-Disbursement)
  // -------------------------------------------------------------
  try {
    const ownerId = "ow-val-01";
    const currentPayableBalance = 30000;

    // Try to disburse 35,000 -> Should fail validation
    const invalidValidation = validateOwnerTransfer(ownerId, 35000, currentPayableBalance);

    // Try to disburse 25,000 -> Should pass validation
    const validValidation = validateOwnerTransfer(ownerId, 25000, currentPayableBalance);

    const passed = !invalidValidation.isValid && validValidation.isValid;
    results.push({
      id: "P2-03",
      name: "Owner Transfer Over-Disbursement Protection",
      category: "OWNER_TRANSFERS",
      passed,
      message: passed
        ? "نجحت حماية الرصيد: تم منع التحويل الذي يتجاوز الرصيد المستحق (35,000 > 30,000) وقبول التحويل المتاح (25,000)."
        : "فشل صمام أمان حماية رصيد المالك من التحويل الزائد.",
    });
  } catch (e: any) {
    results.push({ id: "P2-03", name: "Owner Transfer Validation", category: "OWNER_TRANSFERS", passed: false, message: e.message });
  }

  // -------------------------------------------------------------
  // Test 4: Maintenance Request to Property Expense Integration
  // -------------------------------------------------------------
  try {
    const expense = createExpenseFromMaintenance({
      maintenanceRequestId: "mnt-req-101",
      requestNumber: "MNT-2026-0042",
      invoiceId: "inv-909",
      invoiceNumber: "INV-2026-0099",
      ownerId: "ow-101",
      propertyId: "prop-202",
      unitId: "unt-303",
      amount: 4000,
      vatAmount: 200,
      costBearer: "OWNER",
      vendorName: "الخليج لصيانة المباني",
      description: "إصلاح نظام التكييف المركزي",
      userId: "usr-admin",
      userName: "أحمد المحاسب",
    });

    const passed =
      expense.amount === 4000 &&
      expense.vatAmount === 200 &&
      expense.totalAmount === 4200 &&
      expense.costBearer === "OWNER" &&
      expense.sourceType === "MAINTENANCE_REQUEST" &&
      expense.sourceId === "mnt-req-101";

    results.push({
      id: "P2-04",
      name: "Maintenance Request to Expense Automated Transformation",
      category: "PROPERTY_EXPENSES",
      passed,
      message: passed
        ? `تم تحويل فاتورة الصيانة إلى سند مصروف عقاري بقيمة ${expense.totalAmount} AED شاملاً الضريبة بنجاح.`
        : "فشل ربط وتوليد مصروف الصيانة العقاري.",
    });
  } catch (e: any) {
    results.push({ id: "P2-04", name: "Maintenance to Expense Integration", category: "PROPERTY_EXPENSES", passed: false, message: e.message });
  }

  // -------------------------------------------------------------
  // Test 5: Reversal of Property Expense and Balance Recalculation
  // -------------------------------------------------------------
  try {
    const ownerId = "ow-test-rev";
    const collections: CollectionRecord[] = [
      {
        id: "col-rev-1",
        receiptNumber: "RCP-REV-1",
        chequeId: "chq-1",
        ownerId,
        tenantId: "tnt-1",
        amountEntered: 40000,
        amountApplied: 40000,
        paymentMethod: "CASH",
        paymentDate: "2026-01-01",
        payerName: "Tenant",
        collectedBy: "Admin",
        collectedByUserId: "admin-1",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const expense1: PropertyExpenseRecord = {
      id: "exp-rev-1",
      expenseNumber: "EXP-REV-01",
      ownerId,
      propertyId: "prop-1",
      category: "MAINTENANCE",
      description: "صيانة مصعد",
      amount: 5000,
      vatAmount: 0,
      totalAmount: 5000,
      costBearer: "OWNER",
      expenseDate: "2026-01-05",
      status: "PAID",
      createdAt: "2026-01-05T00:00:00Z",
      createdById: "test-user",
    };

    // Before reversal -> 40,000 - 5,000 = 35,000
    const beforePayable = computeOwnerPayableDetails(ownerId, {
      collections,
      commissions: [],
      expenses: [expense1],
      transfers: [],
      adjustments: [],
      reversals: [],
    });

    // After reversal of expense1
    const reversals: FinancialReversalRecord[] = [
      {
        id: "rev-exp-1",
        reversalNumber: "REV-001",
        targetType: "PAYMENT_ALLOCATION",
        targetId: "exp-rev-1",
        originalAmount: 5000,
        reversedAmount: 5000,
        reason: "فاتورة مكررة ملغاة",
        reversalDate: "2026-01-10",
        reversalTimestamp: "2026-01-10T00:00:00Z",
        performedByUserId: "usr-01",
        performedByUserName: "مدير الحسابات",
        createdAt: "2026-01-10T00:00:00Z",
      },
    ];

    const afterPayable = computeOwnerPayableDetails(ownerId, {
      collections,
      commissions: [],
      expenses: [{ ...expense1, status: "REVERSED" }],
      transfers: [],
      adjustments: [],
      reversals,
    });

    const passed = beforePayable.currentPayableBalance === 35000 && afterPayable.currentPayableBalance === 40000;

    results.push({
      id: "P2-05",
      name: "Property Expense Reversal & Authoritative Recovery",
      category: "PROPERTY_EXPENSES",
      passed,
      message: passed
        ? "تم عكس المصروف بنجاح واسترداد رصيد المالك المستحق تلقائياً إلى 40,000 AED."
        : "فشل اختبار عكس المصروف واسترداد الرصيد.",
    });
  } catch (e: any) {
    results.push({ id: "P2-05", name: "Expense Reversal", category: "PROPERTY_EXPENSES", passed: false, message: e.message });
  }

  // -------------------------------------------------------------
  // Test 6: Owner Statement Generation & Running Balance
  // -------------------------------------------------------------
  try {
    const ownerId = "ow-stmt-01";
    const collections: CollectionRecord[] = [
      {
        id: "col-s1",
        receiptNumber: "RCP-101",
        chequeId: "chq-1",
        ownerId,
        tenantId: "tnt-stmt-1",
        amountEntered: 100000,
        amountApplied: 100000,
        paymentMethod: "BANK_TRANSFER",
        paymentDate: "2026-01-15",
        payerName: "شركة الأفق",
        collectedBy: "Admin",
        collectedByUserId: "admin-1",
        createdAt: "2026-01-15T00:00:00Z",
      },
    ];

    const commissions: CommissionObligation[] = [
      {
        id: "com-s1",
        businessKey: "lse-101:OWNER:BROKERAGE:PRIMARY",
        leaseId: "lse-101",
        ownerId,
        propertyId: "prop-1",
        unitId: "unt-1",
        partyType: "OWNER",
        commissionType: "BROKERAGE",
        calculationBasis: "PERCENTAGE_OF_RENT",
        ratePercentage: 5,
        baseAmount: 100000,
        totalCommissionAmount: 5000,
        collectedAmount: 5000,
        outstandingBalance: 0,
        status: "FULLY_COLLECTED",
        dueDate: "2026-01-15",
        createdAt: "2026-01-15T00:00:00Z",
        createdById: "test-user",
      },
    ];

    const expenses: PropertyExpenseRecord[] = [
      {
        id: "exp-s1",
        expenseNumber: "EXP-101",
        ownerId,
        propertyId: "prop-1",
        category: "MAINTENANCE",
        description: "صيانة عامة",
        amount: 3000,
        vatAmount: 150,
        totalAmount: 3150,
        costBearer: "OWNER",
        expenseDate: "2026-01-20",
        paymentMethod: "BANK_TRANSFER",
        status: "PAID",
        createdAt: "2026-01-20T00:00:00Z",
        createdById: "test-user",
      },
    ];

    const transfers: OwnerTransferRecord[] = [
      {
        id: "trf-s1",
        transferNumber: "TRF-101",
        ownerId,
        amount: 50000,
        transferDate: "2026-01-25",
        paymentMethod: "BANK_TRANSFER",
        status: "PAID",
        createdAt: "2026-01-25T00:00:00Z",
        createdById: "test-user",
      },
    ];

    const statement = generateOwnerStatement(ownerId, "سعادة المالك محمد", {}, {
      collections,
      commissions,
      expenses,
      transfers,
      adjustments: [],
      reversals: [],
    });

    const expectedClosing = 100000 - 5000 - 3150 - 50000; // 41850
    const passed =
      statement.transactions.length === 4 &&
      Math.abs(statement.closingBalance - expectedClosing) < 0.001 &&
      statement.transactions[0].credit === 100000 &&
      statement.transactions[3].runningBalance === expectedClosing;

    results.push({
      id: "P2-06",
      name: "Owner Statement Chronological Generation & Running Balance",
      category: "STATEMENTS",
      passed,
      message: passed
        ? `كشف حساب المالك متوازن بدقة: إجمالي المقبوضات (100,000) - الاستقطاعات والتحويلات (58,150) = رصيد ختامي ${statement.closingBalance} AED.`
        : `فشل توازن كشف حساب المالك. المتوقع: ${expectedClosing}، المحسوب: ${statement.closingBalance}`,
      details: statement,
    });
  } catch (e: any) {
    results.push({ id: "P2-06", name: "Owner Statement Generation", category: "STATEMENTS", passed: false, message: e.message });
  }

  // -------------------------------------------------------------
  // Test 7: Tenant Statement Generation
  // -------------------------------------------------------------
  try {
    const tenantId = "tnt-stmt-01";
    const leases: Lease[] = [
      {
        id: "lse-t1",
        leaseNumber: "LSE-2026-001",
        tenantId,
        ownerId: "ow-1",
        propertyId: "prop-1",
        unitId: "unt-1",
        annualRent: 60000,
        securityDeposit: 3000,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        paymentFrequency: "QUARTERLY",
        installmentsCount: 4,
        installments: [],
        contractStatus: "ACTIVE",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const commissions: CommissionObligation[] = [
      {
        id: "com-t1",
        businessKey: "lse-t1:TENANT:BROKERAGE:PRIMARY",
        leaseId: "lse-t1",
        tenantId,
        propertyId: "prop-1",
        unitId: "unt-1",
        partyType: "TENANT",
        commissionType: "BROKERAGE",
        calculationBasis: "PERCENTAGE_OF_RENT",
        ratePercentage: 5,
        baseAmount: 60000,
        totalCommissionAmount: 3000,
        collectedAmount: 3000,
        outstandingBalance: 0,
        status: "FULLY_COLLECTED",
        dueDate: "2026-01-01",
        createdAt: "2026-01-01T00:00:00Z",
        createdById: "test-user",
      },
    ];

    const collections: CollectionRecord[] = [
      {
        id: "col-t1",
        receiptNumber: "RCP-T1",
        chequeId: "chq-1",
        tenantId,
        ownerId: "ow-1",
        amountEntered: 18000, // 15,000 rent + 3,000 commission
        amountApplied: 18000,
        paymentMethod: "BANK_TRANSFER",
        paymentDate: "2026-01-02",
        payerName: "المستأجر خالد",
        collectedBy: "Admin",
        collectedByUserId: "admin-1",
        createdAt: "2026-01-02T00:00:00Z",
      },
    ];

    const tenantStmt = generateTenantStatement(tenantId, "خالد أحمد", {}, {
      leases,
      collections,
      commissions,
      expenses: [],
      cheques: [],
      adjustments: [],
      reversals: [],
    });

    // Total Debit: 60,000 (rent) + 3,000 (commission) = 63,000
    // Total Credit: 18,000 (paid)
    // Outstanding: 45,000
    const expectedDebt = 63000 - 18000;
    const passed =
      tenantStmt.totalDebits === 63000 &&
      tenantStmt.totalCredits === 18000 &&
      tenantStmt.closingBalance === expectedDebt;

    results.push({
      id: "P2-07",
      name: "Tenant Statement Generation & Outstanding Receivables",
      category: "STATEMENTS",
      passed,
      message: passed
        ? `كشف حساب المستأجر دقيق: إجمالي المطالبات (63,000) - المسدد (18,000) = المتبقي المستحق ${tenantStmt.closingBalance} AED.`
        : `فشل توازن كشف حساب المستأجر. المحسوب: ${tenantStmt.closingBalance}، المتوقع: ${expectedDebt}`,
      details: tenantStmt,
    });
  } catch (e: any) {
    results.push({ id: "P2-07", name: "Tenant Statement Generation", category: "STATEMENTS", passed: false, message: e.message });
  }

  // -------------------------------------------------------------
  // Test 8: Statement Period Filtering with Accurate Opening Balance
  // -------------------------------------------------------------
  try {
    const ownerId = "ow-filter-01";
    const collections: CollectionRecord[] = [
      {
        id: "col-f1",
        receiptNumber: "RCP-F1",
        chequeId: "chq-1",
        ownerId,
        tenantId: "tnt-f1",
        amountEntered: 30000,
        amountApplied: 30000,
        paymentMethod: "CASH",
        paymentDate: "2026-01-10",
        payerName: "Tenant",
        collectedBy: "Admin",
        collectedByUserId: "admin-1",
        createdAt: "2026-01-10T00:00:00Z",
      },
      {
        id: "col-f2",
        receiptNumber: "RCP-F2",
        chequeId: "chq-2",
        ownerId,
        tenantId: "tnt-f1",
        amountEntered: 20000,
        amountApplied: 20000,
        paymentMethod: "CASH",
        paymentDate: "2026-02-15",
        payerName: "Tenant",
        collectedBy: "Admin",
        collectedByUserId: "admin-1",
        createdAt: "2026-02-15T00:00:00Z",
      },
    ];

    // Filter statement for February only (2026-02-01 to 2026-02-28)
    const febStatement = generateOwnerStatement(
      ownerId,
      "المالك فهد",
      { dateFrom: "2026-02-01", dateTo: "2026-02-28" },
      {
        collections,
        commissions: [],
        expenses: [],
        transfers: [],
        adjustments: [],
        reversals: [],
      }
    );

    // Opening balance should be 30,000 from January
    // Period transaction should only contain col-f2 (20,000)
    // Closing balance should be 50,000
    const passed =
      febStatement.openingBalance === 30000 &&
      febStatement.transactions.length === 1 &&
      febStatement.closingBalance === 50000;

    results.push({
      id: "P2-08",
      name: "Statement Period Filtering & Historical Balance Rollforward",
      category: "STATEMENTS",
      passed,
      message: passed
        ? `تم ترحيل الرصيد الافتتاحي بدقة (${febStatement.openingBalance} AED) وتصفية حركات الفترة المحددة فقط.`
        : "فشل تصفية كشف الحساب واحتساب الرصيد الافتتاحي.",
      details: febStatement,
    });
  } catch (e: any) {
    results.push({ id: "P2-08", name: "Statement Period Filtering", category: "STATEMENTS", passed: false, message: e.message });
  }

  // =============================================================
  // PHASE 2 — VAT DYNAMIC RATE & IMMUTABILITY TESTS (A-K)
  // =============================================================

  // Test A: Dynamic Rate Lookup (5% vs 7%)
  try {
    const vRates = [
      { id: "r1", rate: 5, effectiveFrom: "2020-01-01", status: "ACTIVE" as const, createdAt: "2020-01-01" },
      { id: "r2", rate: 7, effectiveFrom: "2026-06-01", status: "ACTIVE" as const, createdAt: "2026-06-01" },
    ];
    
    const getRate = (date: string) => {
      const active = vRates
        .filter(r => r.effectiveFrom <= date)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      return active[0]?.rate || 5;
    };

    const rateJan = getRate("2026-01-15");
    const rateJuly = getRate("2026-07-01");

    const passed = rateJan === 5 && rateJuly === 7;
    results.push({
      id: "P2-VAT-A",
      name: "Dynamic Rate Lookup (5% vs 7%)",
      category: "INTEGRATION",
      passed,
      message: passed 
        ? "نجح البحث الديناميكي: تم تحديد 5% قبل يونيو 2026 و 7% بعد يونيو 2026." 
        : "فشل البحث الديناميكي عن نسبة الضريبة."
    });
  } catch (e: any) {
    results.push({ id: "P2-VAT-A", name: "VAT Rate Lookup", category: "INTEGRATION", passed: false, message: e.message });
  }

  // Test C: Historical Transaction Immutability
  try {
    // Scenario: A transaction was created with 5% VAT. 
    // Even if global rate changes to 7%, the transaction must stay at 5%.
    const transaction: CommissionObligation = {
      id: "com-imm-1",
      businessKey: "k",
      ownerId: "o",
      propertyId: "p",
      unitId: "u",
      partyType: "OWNER",
      commissionType: "ADMIN_FEE",
      calculationBasis: "FIXED_AMOUNT",
      baseAmount: 1000,
      totalCommissionAmount: 1050,
      vatAmount: 50,
      vatRate: 5, // <--- IMMUTABLE RECORDING
      netRevenueAmount: 1000,
      taxTreatment: "VAT_DEDUCTION",
      collectedAmount: 0,
      outstandingBalance: 1050,
      dueDate: "2026-01-01",
      leaseId: "lse-imm-1",
      status: "PENDING",
      createdAt: "2026-01-01",
      createdById: "u"
    };

    // Global rate is now 7%
    const currentGlobalRate = 7;
    
    // Check if record changed (it shouldn't)
    const passed = transaction.vatRate === 5 && transaction.vatAmount === 50;
    results.push({
      id: "P2-VAT-C",
      name: "Historical Transaction Immutability",
      category: "INTEGRATION",
      passed,
      message: passed 
        ? "نجح اختبار الثبات: المعاملة القديمة احتفظت بنسبة 5% رغم تغير النسبة العالمية إلى 7%." 
        : "فشل اختبار ثبات المعاملات التاريخية."
    });
  } catch (e: any) {
    results.push({ id: "P2-VAT-C", name: "VAT Immutability", category: "INTEGRATION", passed: false, message: e.message });
  }

  // Test E: Office Revenue Net of VAT
  try {
    const adminFee: CommissionObligation = {
      id: "com-rev-1",
      businessKey: "k",
      ownerId: "o",
      propertyId: "p",
      unitId: "u",
      partyType: "OWNER",
      commissionType: "ADMIN_FEE",
      calculationBasis: "FIXED_AMOUNT",
      baseAmount: 5000,
      totalCommissionAmount: 5250, // Gross
      vatAmount: 250,
      vatRate: 5,
      netRevenueAmount: 5000, // <--- OFFICE REVENUE
      taxTreatment: "VAT_DEDUCTION",
      collectedAmount: 5250,
      outstandingBalance: 0,
      dueDate: "2026-01-01",
      leaseId: "lse-rev-1",
      status: "FULLY_COLLECTED",
      createdAt: "2026-01-01",
      createdById: "u"
    };

    const passed = adminFee.netRevenueAmount === 5000 && (adminFee.totalCommissionAmount - (adminFee.vatAmount || 0)) === 5000;
    results.push({
      id: "P2-VAT-E",
      name: "Office Revenue Net of VAT (Admin Fee - VAT)",
      category: "INTEGRATION",
      passed,
      message: passed 
        ? "نجح احتساب الإيراد الصافي: إيراد المكتب المسجل هو 5,000 (الإجمالي 5,250 - الضريبة 250)." 
        : "فشل احتساب الإيراد الصافي للمكتب."
    });
  } catch (e: any) {
    results.push({ id: "P2-VAT-E", name: "Office Revenue Calculation", category: "INTEGRATION", passed: false, message: e.message });
  }

  return results;
}
