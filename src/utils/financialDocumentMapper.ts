/**
 * EMIRATES FALCON ERP — FINANCIAL DOCUMENT MAPPER
 * Pure adapter mapping authoritative financial entities into unified printable document models
 */

import {
  CollectionRecord,
  OwnerTransferRecord,
  PropertyExpenseRecord,
  OfficePettyCashExpense,
  Cheque,
  DailyDepositRecord,
  Owner,
  Tenant,
  Property,
  Unit,
  Lease,
} from "../types";
import { UnifiedFinancialDocument, FinancialBreakdownItem } from "../types/unifiedPrinting";

interface DataContextSnapshot {
  collections?: CollectionRecord[];
  ownerTransfers?: OwnerTransferRecord[];
  propertyExpenses?: PropertyExpenseRecord[];
  officePettyCashExpenses?: OfficePettyCashExpense[];
  cheques?: Cheque[];
  dailyDeposits?: DailyDepositRecord[];
  owners?: Owner[];
  tenants?: Tenant[];
  properties?: Property[];
  units?: Unit[];
  leases?: Lease[];
}

/**
 * Builds the complete unified catalog of printable financial documents from existing data.
 * Pure read-only operation with zero mutations.
 */
export function buildUnifiedFinancialDocuments(data: DataContextSnapshot): UnifiedFinancialDocument[] {
  const {
    collections = [],
    ownerTransfers = [],
    propertyExpenses = [],
    officePettyCashExpenses = [],
    cheques = [],
    dailyDeposits = [],
    owners = [],
    tenants = [],
    properties = [],
    units = [],
    leases = [],
  } = data;

  const docs: UnifiedFinancialDocument[] = [];

  // Helper resolvers
  const getOwner = (id?: string) => (id ? owners.find((o) => o.id === id) : undefined);
  const getTenant = (id?: string) => (id ? tenants.find((t) => t.id === id) : undefined);
  const getProperty = (id?: string) => (id ? properties.find((p) => p.id === id) : undefined);
  const getUnit = (id?: string) => (id ? units.find((u) => u.id === id) : undefined);
  const getLease = (id?: string) => (id ? leases.find((l) => l.id === id) : undefined);

  // 1. MAPPING RENTAL COLLECTIONS (إيصالات وسندات القبض الإيجاري)
  collections.forEach((col) => {
    const tenant = getTenant(col.tenantId);
    const cheque = col.chequeId ? cheques.find((c) => c.id === col.chequeId) : undefined;
    const lease = cheque?.leaseId
      ? getLease(cheque.leaseId)
      : leases.find((l) => l.tenantId === col.tenantId);
    const property = cheque?.propertyId
      ? getProperty(cheque.propertyId)
      : lease?.propertyId
      ? getProperty(lease.propertyId)
      : undefined;
    const unit = cheque?.unitId
      ? getUnit(cheque.unitId)
      : lease?.unitId
      ? getUnit(lease.unitId)
      : undefined;

    const totalAmt = col.amountEntered || col.amountApplied || 0;
    const breakdown: FinancialBreakdownItem[] = [];

    if (col.amountApplied > 0) {
      breakdown.push({
        labelAr: "دفعة إيجارية مستحقة (إيجار)",
        labelEn: "Rent Installment Applied",
        amount: col.amountApplied,
        type: "ADDITION",
      });
    }
    if ((col.bouncedFeeAmount || 0) > 0) {
      breakdown.push({
        labelAr: "غرامة شيك مرتجع",
        labelEn: "Bounced Cheque Penalty Fee",
        amount: col.bouncedFeeAmount!,
        type: "ADDITION",
      });
    }
    if ((col.adminFeeAmount || 0) > 0) {
      breakdown.push({
        labelAr: "رسوم إدارية / خدمات",
        labelEn: "Administrative / Service Fee",
        amount: col.adminFeeAmount!,
        type: "ADDITION",
      });
    }

    const isSecurity = Boolean(col.isSecurityDepositReceipt);
    const tenantName = col.payerName || (tenant ? tenant.nameAr || tenant.nameEn : "المستأجر");

    docs.push({
      id: `doc-rcp-${col.id}`,
      authoritativeId: col.id,
      documentNumber: col.receiptNumber || `RCP-${col.id.substring(0, 6)}`,
      documentType: isSecurity ? "SECURITY_DEPOSIT_RECEIPT" : "RENTAL_RECEIPT",
      titleAr: isSecurity ? "سند استلام مبلغ التأمين" : "إيصال وسند قبض مالي إيجاري",
      titleEn: isSecurity ? "Security Deposit Receipt" : "Official Rental Collection Receipt",
      date: col.paymentDate || col.createdAt,
      amount: totalAmt,
      netAmount: col.amountApplied,
      paymentMethod: col.paymentMethod || "BANK_TRANSFER",
      status: col.isReversed ? "REVERSED" : "POSTED",
      isCancelledOrReversed: col.isReversed,
      isPrintable: true,
      partyType: "TENANT",
      partyName: tenantName,
      partyPhone: tenant?.phone,
      partyEmail: tenant?.email,
      partyIdNumber: tenant?.emiratesId,
      partyId: col.tenantId,
      propertyId: property?.id,
      propertyName: property?.nameAr || property?.nameEn,
      unitId: unit?.id,
      unitNumber: unit?.unitNumber,
      leaseId: lease?.id,
      leaseNumber: lease?.leaseNumber,
      chequeNumber: cheque?.chequeNumber,
      chequeDueDate: cheque?.dueDate,
      bankName: cheque?.bankName,
      referenceNumber: col.transactionReference,
      approvalCode: col.approvalCode,
      description: col.notes || `تحصيل إيجاري بموجب ${col.paymentMethod}`,
      notes: col.notes,
      breakdown,
      recordedByName: col.collectedBy || "موظف التحصيل",
      recordedByUserId: col.collectedByUserId,
      createdAt: col.createdAt,
      sourceRecord: { type: "COLLECTION", record: col },
    });
  });

  // 2. MAPPING OWNER TRANSFERS (سندات صرف ودفع الملاك)
  ownerTransfers.forEach((trf) => {
    const owner = getOwner(trf.ownerId);
    const property = getProperty(trf.propertyId);
    const unit = getUnit(trf.unitId);
    const lease = getLease(trf.leaseId);

    const isPaid = trf.status === "PAID" || trf.status === "RECONCILED" || trf.status === "COMPLETED";
    const isReversed = trf.isReversed || trf.status === "REVERSED" || trf.status === "CANCELLED";

    const breakdown: FinancialBreakdownItem[] = [
      {
        labelAr: "صافي الدفعة المحولة لحساب المالك",
        labelEn: "Net Transferred Amount to Owner",
        amount: trf.amount,
        type: "NET",
      },
    ];

    docs.push({
      id: `doc-trf-${trf.id}`,
      authoritativeId: trf.id,
      documentNumber: trf.transferNumber || `TRF-${trf.id.substring(0, 6)}`,
      documentType: "OWNER_PAYMENT_VOUCHER",
      titleAr: "سند صرف وتحويل مالي للمالك",
      titleEn: "Owner Payment & Disbursement Voucher",
      date: trf.transferDate || trf.createdAt,
      amount: trf.amount,
      netAmount: trf.amount,
      paymentMethod: (trf.paymentMethod as any) || "BANK_TRANSFER",
      status: trf.status,
      isCancelledOrReversed: isReversed,
      isPrintable: isPaid && !isReversed,
      unprintableReasonAr: !isPaid
        ? "سند الصرف متاح فقط بعد إتمام الصرف والتحويل الفعلي (الحالة: مسددة - PAID)"
        : isReversed
        ? "هذا السند ملغى أو تم عكس قيده المالي"
        : undefined,
      unprintableReasonEn: !isPaid
        ? "Payment voucher is only printable after transfer is finalized (Status: PAID)"
        : isReversed
        ? "This voucher has been reversed/cancelled"
        : undefined,
      partyType: "OWNER",
      partyName: trf.ownerName || (owner ? owner.nameAr || owner.nameEn : "المالك"),
      partyPhone: owner?.phone,
      partyEmail: owner?.email,
      partyIdNumber: owner?.emiratesId,
      partyId: trf.ownerId,
      propertyId: property?.id,
      propertyName: property?.nameAr || property?.nameEn,
      unitId: unit?.id,
      unitNumber: unit?.unitNumber,
      leaseId: lease?.id,
      leaseNumber: lease?.leaseNumber,
      bankName: trf.beneficiaryBankName || owner?.bankName,
      iban: trf.beneficiaryIban || owner?.iban,
      accountNumber: owner?.accountNumber,
      referenceNumber: trf.transactionReferenceNumber || trf.bankAccountReference,
      description: trf.notes || `تحويل أرباح وإيجارات للمالك بموجب ${trf.paymentMethod}`,
      notes: trf.notes,
      breakdown,
      recordedByName: trf.createdByName || "المحاسب",
      recordedByUserId: trf.createdById,
      approvedByName: trf.approvedByUserName,
      paidByName: trf.paidByUserName || trf.settledByName,
      createdAt: trf.createdAt,
      sourceRecord: { type: "OWNER_TRANSFER", record: trf },
    });
  });

  // 3. MAPPING PROPERTY & MAINTENANCE EXPENSES (سندات صرف مصروفات العقارات والصيانة)
  propertyExpenses.forEach((exp) => {
    const owner = getOwner(exp.ownerId);
    const tenant = getTenant(exp.tenantId);
    const property = getProperty(exp.propertyId);
    const unit = getUnit(exp.unitId);
    const lease = getLease(exp.leaseId);

    const isReversed = exp.status === "REVERSED" || exp.status === "CANCELLED";
    const vat = exp.vatAmount || 0;
    const baseAmt = exp.amount || (exp.totalAmount ? exp.totalAmount - vat : 0);
    const totalAmt = exp.totalAmount || baseAmt + vat;

    const breakdown: FinancialBreakdownItem[] = [
      {
        labelAr: "المبلغ الأساسي الخاضع للضريبة",
        labelEn: "Taxable Base Amount",
        amount: baseAmt,
        type: "ADDITION",
      },
    ];

    if (vat > 0) {
      breakdown.push({
        labelAr: `ضريبة القيمة المضافة (${exp.vatRate || 5}%)`,
        labelEn: `VAT (${exp.vatRate || 5}%)`,
        amount: vat,
        type: "TAX",
      });
    }

    breakdown.push({
      labelAr: "إجمالي المصروف المعتمد",
      labelEn: "Total Approved Expense",
      amount: totalAmt,
      type: "TOTAL",
    });

    const partyName =
      exp.vendorName ||
      (exp.costBearer === "OWNER"
        ? owner?.nameAr || owner?.nameEn || "حساب المالك"
        : exp.costBearer === "TENANT"
        ? tenant?.nameAr || tenant?.nameEn || "حساب المستأجر"
        : "المكتب / الشركة");

    docs.push({
      id: `doc-exp-${exp.id}`,
      authoritativeId: exp.id,
      documentNumber: exp.expenseNumber || `EXP-${exp.id.substring(0, 6)}`,
      documentType: "PROPERTY_EXPENSE_VOUCHER",
      titleAr: "سند صرف مصروفات عقار وصيانة",
      titleEn: "Property & Maintenance Expense Voucher",
      date: exp.expenseDate || exp.createdAt,
      amount: totalAmt,
      netAmount: baseAmt,
      vatAmount: vat,
      vatRate: exp.vatRate || 5,
      paymentMethod: (exp.paymentMethod as any) || "BANK_TRANSFER",
      status: exp.status,
      isCancelledOrReversed: isReversed,
      isPrintable: !isReversed,
      unprintableReasonAr: isReversed ? "تم إلغاء أو عكس قيد هذا المصروف" : undefined,
      unprintableReasonEn: isReversed ? "This expense has been reversed/cancelled" : undefined,
      partyType: exp.vendorName ? "VENDOR" : exp.costBearer === "OWNER" ? "OWNER" : exp.costBearer === "TENANT" ? "TENANT" : "OFFICE",
      partyName,
      partyPhone: owner?.phone || tenant?.phone,
      partyId: exp.ownerId || exp.tenantId,
      propertyId: property?.id,
      propertyName: property?.nameAr || property?.nameEn,
      unitId: unit?.id,
      unitNumber: unit?.unitNumber,
      leaseId: lease?.id,
      leaseNumber: lease?.leaseNumber,
      referenceNumber: exp.vendorInvoiceNumber || exp.maintenanceInvoiceId,
      description: exp.description || `مصروف ${exp.category} على حساب ${exp.costBearer}`,
      notes: exp.notes,
      breakdown,
      recordedByName: (exp as any).createdByName || "مدير العمليات",
      recordedByUserId: (exp as any).createdById,
      createdAt: exp.createdAt || exp.expenseDate,
      sourceRecord: { type: "PROPERTY_EXPENSE", record: exp },
    });
  });

  // 4. MAPPING OFFICE PETTY CASH EXPENSES (سندات صرف النثرية والمصاريف المكتبية)
  officePettyCashExpenses.forEach((pc) => {
    const isReversed = false;
    const breakdown: FinancialBreakdownItem[] = [
      {
        labelAr: "مبلغ النثرية المصروف",
        labelEn: "Disbursed Petty Cash Amount",
        amount: pc.amount,
        type: "TOTAL",
      },
    ];

    docs.push({
      id: `doc-pc-${pc.id}`,
      authoritativeId: pc.id,
      documentNumber: pc.expenseNumber || `PC-${pc.id.substring(0, 6)}`,
      documentType: "PETTY_CASH_VOUCHER",
      titleAr: "سند صرف عهدة ونثرية مكتبية",
      titleEn: "Office Petty Cash Expense Voucher",
      date: pc.date || pc.createdAt,
      amount: pc.amount,
      netAmount: pc.amount,
      paymentMethod: "CASH",
      status: "POSTED",
      isCancelledOrReversed: isReversed,
      isPrintable: true,
      partyType: "EMPLOYEE",
      partyName: pc.payee || "المستفيد من النثرية",
      referenceNumber: pc.refNumber,
      description: pc.description || "مصروف نثرية معتمد",
      notes: pc.notes,
      breakdown,
      recordedByName: pc.createdBy || "أمين الصندوق",
      createdAt: pc.createdAt || pc.date,
      sourceRecord: { type: "OFFICE_PETTY_CASH", record: pc },
    });
  });

  // 5. MAPPING CHEQUES (سندات استلام وحركة الشيكات)
  cheques.forEach((chq) => {
    const tenant = getTenant(chq.tenantId);
    const property = getProperty(chq.propertyId);
    const unit = getUnit(chq.unitId);
    const lease = getLease(chq.leaseId);

    const isReversed = chq.status === "CANCELLED" || chq.status === "REPLACED";
    const collectedAmt = chq.totalApplied || (chq.amount - (chq.outstanding || 0));

    const breakdown: FinancialBreakdownItem[] = [
      {
        labelAr: "قيمة الشيك الإجمالية",
        labelEn: "Cheque Face Value",
        amount: chq.amount,
        type: "TOTAL",
      },
      {
        labelAr: "المبلغ المحصل فعلياً",
        labelEn: "Collected Amount",
        amount: collectedAmt,
        type: "ADDITION",
      },
      {
        labelAr: "الرصيد المتبقي على الشيك",
        labelEn: "Remaining Outstanding",
        amount: chq.outstanding || 0,
        type: "NET",
      },
    ];

    docs.push({
      id: `doc-chq-${chq.id}`,
      authoritativeId: chq.id,
      documentNumber: `CHQ-${chq.chequeNumber}`,
      documentType: "CHEQUE_RECEIPT",
      titleAr: "سند استلام وحركة شيك إيجاري",
      titleEn: "Cheque Custody & Deposit Receipt",
      date: chq.chequeDate || chq.dueDate,
      amount: chq.amount,
      netAmount: collectedAmt,
      paymentMethod: "CHEQUE",
      status: chq.status,
      isCancelledOrReversed: isReversed,
      isPrintable: true,
      partyType: "TENANT",
      partyName: tenant ? tenant.nameAr || tenant.nameEn : "المستأجر",
      partyPhone: tenant?.phone,
      partyIdNumber: tenant?.emiratesId,
      partyId: chq.tenantId,
      propertyId: property?.id,
      propertyName: property?.nameAr || property?.nameEn,
      unitId: unit?.id,
      unitNumber: unit?.unitNumber,
      leaseId: lease?.id,
      leaseNumber: lease?.leaseNumber,
      chequeNumber: chq.chequeNumber,
      chequeDueDate: chq.dueDate,
      bankName: chq.bankName,
      description: `شيك رقم ${chq.chequeNumber} مسحوب على ${chq.bankName || "البنك"} مستحق بتاريخ ${chq.dueDate}`,
      notes: chq.notes,
      breakdown,
      recordedByName: (chq as any).createdByName || "أمين الخزينة",
      createdAt: chq.chequeDate || chq.dueDate,
      sourceRecord: { type: "CHEQUE", record: chq },
    });
  });

  // 6. MAPPING DAILY DEPOSITS (سندات الإيداع البنكي اليومي)
  dailyDeposits.forEach((dep) => {
    const breakdown: FinancialBreakdownItem[] = [
      {
        labelAr: "إجمالي الإيداع البنكي المعتمد",
        labelEn: "Total Approved Bank Deposit",
        amount: dep.amount || 0,
        type: "TOTAL",
      },
    ];

    docs.push({
      id: `doc-dep-${dep.id}`,
      authoritativeId: dep.id,
      documentNumber: dep.depositReference || `DEP-${dep.id.substring(0, 6)}`,
      documentType: "BANK_DEPOSIT_SLIP",
      titleAr: "سند إيداع بنكي يومي معتمد",
      titleEn: "Official Daily Bank Deposit Slip",
      date: dep.depositDate || dep.createdAt,
      amount: dep.amount || 0,
      netAmount: dep.amount || 0,
      paymentMethod: "BANK_TRANSFER",
      status: dep.status || "COMPLETED",
      isCancelledOrReversed: dep.status === "REVERSED",
      isPrintable: dep.status !== "REVERSED",
      partyType: "BANK",
      partyName: dep.bank || "الحساب البنكي للشركة",
      bankName: dep.bank,
      accountNumber: dep.bankAccount,
      referenceNumber: dep.depositReference,
      description: `إيداع بنكي بحساب ${dep.bank || "الشركة"} - مرجع: ${dep.depositReference}`,
      notes: dep.depositSlipNumber ? `رقم قسيمة الإيداع: ${dep.depositSlipNumber}` : undefined,
      breakdown,
      recordedByName: dep.createdBy || "المحاسب المسؤول",
      createdAt: dep.createdAt,
      sourceRecord: { type: "DAILY_DEPOSIT", record: dep },
    });
  });

  // Sort descending by date
  return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
