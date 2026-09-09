/**
 * Phase 25: Operational Control & Reporting Service
 * Centralizes KPI calculations, Daily Operations Worklist generation,
 * and 14 authoritative operational reports with inclusive date-range filtering and grouping.
 */

import {
  DailyWorklistItem,
  OperationalControlKPIs,
  OperationalException,
  OperationalReportType,
  OperationalTask,
  Owner,
  Property,
  Unit,
  Tenant,
  Lease,
  Cheque,
  RentalCase,
  MaintenanceRequest,
  OwnerTransferRecord,
  CommissionObligation,
  OperationalDocumentRecord,
  OperationalCommunicationRecord,
  PaymentPromise,
  CollectionAction,
  CompanyProfile,
} from "../types";
import { ScanExceptionsInput } from "./exceptionService";
import { normalizeArabicText } from "../utils/arabicTextNormalizer";
import * as XLSX from "xlsx";

export function calculateOperationalKPIs(
  data: ScanExceptionsInput,
  exceptions: OperationalException[]
): OperationalControlKPIs {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentTime = now.getTime();

  // 1. Task Metrics
  const tasks = data.tasks || [];
  let overdueTasks = 0;
  let tasksDueToday = 0;
  let tasksDue3Days = 0;
  let tasksDue7Days = 0;

  tasks.forEach((t) => {
    if (t.status === "COMPLETED" || t.status === "CANCELLED" || !t.dueDate) return;
    const dueMs = new Date(t.dueDate).getTime();
    const daysDiff = Math.ceil((dueMs - currentTime) / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) overdueTasks++;
    else if (daysDiff === 0 || t.dueDate === todayStr) tasksDueToday++;
    else if (daysDiff <= 3) tasksDue3Days++;
    else if (daysDiff <= 7) tasksDue7Days++;
  });

  // 2. Leases & Renewals
  const leases = data.leases || [];
  let expiringLeases = 0;
  let pendingRenewals = 0;

  leases.forEach((l) => {
    if (l.contractStatus === "UNDER_RENEWAL") pendingRenewals++;
    if (l.contractStatus === "ACTIVE" && l.endDate) {
      const endMs = new Date(l.endDate).getTime();
      const daysDiff = Math.ceil((endMs - currentTime) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 60 && daysDiff >= 0) expiringLeases++;
    }
  });

  // 3. Documents
  const documents = data.documents || [];
  let expiringDocuments = 0;
  let missingRequiredDocuments = 0;

  documents.forEach((d) => {
    // Missing is an abstract concept here, but d.status doesn't have "MISSING", only UPLOADED, PENDING_VERIFICATION, VERIFIED, EXPIRED, ARCHIVED.
    // So we'll skip missing checking here or check another property.
    if (d.expiryDate) {
      const expMs = new Date(d.expiryDate).getTime();
      const daysDiff = Math.ceil((expMs - currentTime) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 60 && daysDiff >= 0) expiringDocuments++;
    }
  });

  // 4. Maintenance
  const maintenance = data.maintenanceRequests || [];
  let openMaintenanceRequests = 0;
  let unpostedMaintenanceExpenses = 0;

  maintenance.forEach((m) => {
    if (m.status === "OPEN" || m.status === "IN_PROGRESS") {
      openMaintenanceRequests++;
    }
    if ((m.status === "COMPLETED") && m.totalCost && m.totalCost > 0 && m.financialStatus !== "POSTED") {
      unpostedMaintenanceExpenses++;
    }
  });

  // 5. Cheques & Collections
  const cheques = data.cheques || [];
  const cases = data.cases || [];
  let bouncedCheques = 0;

  cheques.forEach((c) => {
    if (c.status === "BOUNCED" || c.originalStatus === "BOUNCED") {
      const hasCase = cases.some((ca) => (ca.linkedChequeIds || []).includes(c.id));
      if (!hasCase) bouncedCheques++;
    }
  });

  const promises = data.paymentPromises || [];
  let brokenPaymentPromises = promises.filter((p) => p.status === "BROKEN").length;

  const openLegalCases = cases.filter((c) => c.status !== "CLOSED" && c.status !== "ARCHIVED").length;

  const ownerTransfers = data.ownerTransfers || [];
  const pendingOwnerTransfers = ownerTransfers.filter((t) => t.status === "DRAFT" || t.status === "PENDING_APPROVAL").length;

  const commissions = data.commissions || [];
  const pendingAdminFees = commissions.filter((c) => c.status === "DUE" && c.outstandingBalance > 0).length;

  const communications = data.communications || [];
  const failedCommunications = communications.filter((c) => c.status === "FAILED").length;

  // Active Exceptions breakdown
  const activeExcs = exceptions.filter((e) => e.status === "OPEN" || e.status === "ACKNOWLEDGED" || e.status === "IN_PROGRESS");
  const criticalExceptionsCount = activeExcs.filter((e) => e.severity === "CRITICAL").length;
  const highExceptionsCount = activeExcs.filter((e) => e.severity === "HIGH").length;
  const warningExceptionsCount = activeExcs.filter((e) => e.severity === "WARNING").length;

  return {
    overdueTasks,
    tasksDueToday,
    tasksDue3Days,
    tasksDue7Days,
    expiringLeases,
    pendingRenewals,
    expiringDocuments,
    missingRequiredDocuments,
    openMaintenanceRequests,
    unpostedMaintenanceExpenses,
    pendingPropertyExpenses: 0,
    outstandingTenantBalances: brokenPaymentPromises + bouncedCheques,
    bouncedCheques,
    brokenPaymentPromises,
    openLegalCases,
    pendingLegalFees: 0,
    pendingOwnerTransfers,
    pendingAdminFees,
    pendingCollectionFollowups: brokenPaymentPromises,
    failedCommunications,
    criticalExceptionsCount,
    highExceptionsCount,
    warningExceptionsCount,
    totalActiveExceptions: activeExcs.length,
  };
}

/**
 * Generates the 12 Categorized Sections of the Daily Operations Worklist
 */
export function generateDailyOperationsWorklist(
  data: ScanExceptionsInput,
  exceptions: OperationalException[]
): Record<DailyWorklistItem["section"], DailyWorklistItem[]> {
  const sections: Record<DailyWorklistItem["section"], DailyWorklistItem[]> = {
    OVERDUE: [],
    DUE_TODAY: [],
    DUE_NEXT_3_DAYS: [],
    DUE_NEXT_7_DAYS: [],
    HIGH_PRIORITY: [],
    CRITICAL_EXCEPTIONS: [],
    PENDING_APPROVALS: [],
    PENDING_COLLECTIONS: [],
    DOCUMENT_EXPIRIES: [],
    RENEWALS: [],
    MAINTENANCE: [],
    LEGAL_FOLLOWUP: [],
  };

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentTime = now.getTime();

  // 1. Process Active Tasks into Timeline Sections
  (data.tasks || []).forEach((t) => {
    if (t.status === "COMPLETED" || t.status === "CANCELLED") return;

    const dueMs = t.dueDate ? new Date(t.dueDate).getTime() : currentTime;
    const daysDiff = t.dueDate ? Math.ceil((dueMs - currentTime) / (1000 * 60 * 60 * 24)) : 0;

    const item: DailyWorklistItem = {
      id: `wl-task-${t.id}`,
      section: "DUE_TODAY",
      titleAr: t.title,
      titleEn: t.title,
      descriptionAr: t.description,
      descriptionEn: t.description,
      entityName: t.assignedUserName || "Operational Team",
      entityType: "TASK",
      entityId: t.id,
      priority: t.priority,
      dueDate: t.dueDate,
      responsibleUser: t.assignedUserName,
      status: t.status,
      actionRoute: { view: "TASK_CENTER", entityId: t.id, entityType: "TASK" },
    };

    if (daysDiff < 0) {
      sections.OVERDUE.push({ ...item, section: "OVERDUE" });
    } else if (daysDiff === 0 || t.dueDate === todayStr) {
      sections.DUE_TODAY.push({ ...item, section: "DUE_TODAY" });
    } else if (daysDiff <= 3) {
      sections.DUE_NEXT_3_DAYS.push({ ...item, section: "DUE_NEXT_3_DAYS" });
    } else if (daysDiff <= 7) {
      sections.DUE_NEXT_7_DAYS.push({ ...item, section: "DUE_NEXT_7_DAYS" });
    }

    if (t.priority === "URGENT" || t.priority === "HIGH") {
      sections.HIGH_PRIORITY.push({ ...item, section: "HIGH_PRIORITY" });
    }
  });

  // 2. Process Exceptions into Specialized Sections
  exceptions.forEach((exc) => {
    if (exc.status === "RESOLVED" || exc.status === "DISMISSED") return;

    const item: DailyWorklistItem = {
      id: `wl-exc-${exc.id}`,
      section: "CRITICAL_EXCEPTIONS",
      titleAr: exc.titleAr,
      titleEn: exc.titleEn,
      descriptionAr: exc.descriptionAr,
      descriptionEn: exc.descriptionEn,
      entityName: exc.sourceEntity,
      entityType: exc.sourceEntity,
      entityId: exc.sourceRecordId,
      priority: exc.severity === "CRITICAL" ? "URGENT" : exc.severity === "HIGH" ? "HIGH" : "MEDIUM",
      severity: exc.severity,
      dueDate: exc.dueDate,
      status: exc.status,
      amount: exc.amount,
      actionRoute: exc.actionRoute ? { view: exc.actionRoute.view, entityId: exc.sourceRecordId } : { view: "OPERATIONAL_CONTROL" },
    };

    if (exc.severity === "CRITICAL") {
      sections.CRITICAL_EXCEPTIONS.push({ ...item, section: "CRITICAL_EXCEPTIONS" });
    }

    if (exc.type === "BOUNCED_CHEQUE" || exc.type === "BROKEN_PAYMENT_PROMISE" || exc.type === "OVERDUE_COLLECTION") {
      sections.PENDING_COLLECTIONS.push({ ...item, section: "PENDING_COLLECTIONS" });
    }

    if (exc.type.startsWith("DOCUMENT_") || exc.type === "MISSING_REQUIRED_DOCUMENT") {
      sections.DOCUMENT_EXPIRIES.push({ ...item, section: "DOCUMENT_EXPIRIES" });
    }

    if (exc.type.startsWith("LEASE_")) {
      sections.RENEWALS.push({ ...item, section: "RENEWALS" });
    }

    if (exc.type.includes("MAINTENANCE")) {
      sections.MAINTENANCE.push({ ...item, section: "MAINTENANCE" });
    }

    if (exc.type.includes("LEGAL") || exc.type === "OPEN_LEGAL_CASE" || exc.type === "BOUNCED_CHEQUE") {
      sections.LEGAL_FOLLOWUP.push({ ...item, section: "LEGAL_FOLLOWUP" });
    }

    if (exc.type === "PENDING_OWNER_TRANSFER" || exc.type === "UNPOSTED_MAINTENANCE_EXPENSE") {
      sections.PENDING_APPROVALS.push({ ...item, section: "PENDING_APPROVALS" });
    }
  });

  return sections;
}

export interface OperationalReportFilter {
  dateFrom?: string;
  dateTo?: string;
  ownerId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  status?: string;
  priority?: string;
  assignedUser?: string;
  searchQuery?: string;
  groupBy?: "OWNER" | "PROPERTY" | "TENANT" | "UNIT" | "CATEGORY" | "STATUS" | "PRIORITY" | "NONE";
}

export interface OperationalReportRow {
  id: string;
  date: string;
  reference: string;
  title: string;
  entityName: string;
  category: string;
  status: string;
  priority?: string;
  assignedTo?: string;
  amount?: number;
  notes?: string;
  groupKey?: string;
}

export interface OperationalReportResult {
  titleAr: string;
  titleEn: string;
  reportType: OperationalReportType;
  generatedAt: string;
  filters: OperationalReportFilter;
  rows: OperationalReportRow[];
  totalCount: number;
  totalAmount?: number;
  groupedRows?: Record<string, { rows: OperationalReportRow[]; subtotalCount: number; subtotalAmount?: number }>;
}

/**
 * Filter by date range ensuring inclusive boundary dates
 */
export function isDateInRange(targetDateStr?: string, fromDateStr?: string, toDateStr?: string): boolean {
  if (!targetDateStr) return true;
  const target = new Date(targetDateStr.split("T")[0]).getTime();
  if (isNaN(target)) return true;
  if (fromDateStr) {
    const from = new Date(fromDateStr).getTime();
    if (!isNaN(from) && target < from) return false;
  }
  if (toDateStr) {
    const to = new Date(toDateStr).getTime();
    if (!isNaN(to) && target > to) return false;
  }
  return true;
}

/**
 * 14 Operational Reports Generator Engine
 */
export function generateOperationalReport(
  reportType: OperationalReportType,
  data: ScanExceptionsInput,
  exceptions: OperationalException[],
  filters: OperationalReportFilter = {}
): OperationalReportResult {
  const rows: OperationalReportRow[] = [];
  let totalAmount = 0;
  const now = new Date().toISOString();

  const getOwnerName = (id?: string) => (data.owners || []).find((o) => o && o.id === id)?.nameAr || (data.owners || []).find((o) => o && o.id === id)?.nameEn || "---";
  const getPropertyName = (id?: string) => (data.properties || []).find((p) => p && p.id === id)?.nameAr || (data.properties || []).find((p) => p && p.id === id)?.nameEn || "---";
  const getTenantName = (id?: string) => (data.tenants || []).find((t) => t && t.id === id)?.nameAr || (data.tenants || []).find((t) => t && t.id === id)?.nameEn || "---";

  switch (reportType) {
    case "OPERATIONAL_TASKS":
    case "OVERDUE_TASKS": {
      const isOverdueOnly = reportType === "OVERDUE_TASKS";
      const todayStr = new Date().toISOString().split("T")[0];

      (data.tasks || []).forEach((t) => {
        if (!isDateInRange(t.dueDate || t.createdAt, filters.dateFrom, filters.dateTo)) return;
        if (filters.status && t.status !== filters.status) return;
        if (filters.priority && t.priority !== filters.priority) return;
        if (filters.propertyId && t.propertyId !== filters.propertyId) return;

        const isOverdue = t.dueDate && t.dueDate < todayStr && t.status !== "COMPLETED" && t.status !== "CANCELLED";
        if (isOverdueOnly && !isOverdue) return;

        rows.push({
          id: t.id,
          date: t.dueDate || t.createdAt,
          reference: t.taskNumber,
          title: t.title,
          entityName: getPropertyName(t.propertyId),
          category: t.priority,
          status: t.status,
          priority: t.priority,
          assignedTo: t.assignedUserName || "Team",
          notes: t.description,
          groupKey: filters.groupBy === "PROPERTY" ? getPropertyName(t.propertyId) : filters.groupBy === "STATUS" ? t.status : "ALL",
        });
      });
      break;
    }

    case "EXCEPTIONS": {
      exceptions.forEach((e) => {
        if (!isDateInRange(e.createdAt || e.dueDate, filters.dateFrom, filters.dateTo)) return;
        if (filters.status && e.status !== filters.status) return;
        if (filters.priority && e.severity !== filters.priority) return;

        if (e.amount) totalAmount += e.amount;

        rows.push({
          id: e.id,
          date: e.createdAt,
          reference: e.exceptionNumber,
          title: e.titleAr,
          entityName: e.sourceEntity,
          category: e.severity,
          status: e.status,
          priority: e.severity,
          amount: e.amount,
          notes: e.descriptionAr,
          groupKey: filters.groupBy === "CATEGORY" ? e.severity : filters.groupBy === "STATUS" ? e.status : "ALL",
        });
      });
      break;
    }

    case "DOCUMENT_EXPIRY":
    case "MISSING_DOCUMENTS": {
      const isMissing = reportType === "MISSING_DOCUMENTS";
      (data.documents || []).forEach((d) => {
        if (!isDateInRange(d.expiryDate || d.uploadedAt, filters.dateFrom, filters.dateTo)) return;
        if (isMissing && (d.status === "VERIFIED" || d.status === "ARCHIVED")) return;
        if (!isMissing && (d.status !== "VERIFIED" && d.status !== "ARCHIVED")) return;

        rows.push({
          id: d.id,
          date: d.expiryDate || d.uploadedAt,
          reference: d.documentNumber,
          title: d.title,
          entityName: getPropertyName(d.propertyId),
          category: d.documentType,
          status: d.status,
          assignedTo: d.verifiedByUserName || "Unverified",
          notes: d.driveFileId ? `Drive Link: ${d.driveFileId}` : "",
          groupKey: filters.groupBy === "CATEGORY" ? d.documentType : filters.groupBy === "PROPERTY" ? getPropertyName(d.propertyId) : "ALL",
        });
      });
      break;
    }

    case "LEASE_RENEWAL_PIPELINE": {
      (data.leases || []).forEach((l) => {
        if (!isDateInRange(l.endDate, filters.dateFrom, filters.dateTo)) return;
        if (l.annualRent) totalAmount += l.annualRent;

        rows.push({
          id: l.id,
          date: l.endDate,
          reference: l.leaseNumber || l.id,
          title: `عقد إيجار - ${getTenantName(l.tenantId)}`,
          entityName: getPropertyName(l.propertyId),
          category: l.contractStatus,
          status: l.contractStatus,
          amount: l.annualRent,
          notes: `Rent: ${l.annualRent} AED | Security Deposit: ${l.securityDeposit || 0} AED`,
          groupKey: filters.groupBy === "PROPERTY" ? getPropertyName(l.propertyId) : filters.groupBy === "STATUS" ? l.contractStatus : "ALL",
        });
      });
      break;
    }

    case "BOUNCED_CHEQUE_FOLLOWUP": {
      (data.cheques || []).forEach((c) => {
        if (c.status !== "BOUNCED" && c.originalStatus !== "BOUNCED") return;
        if (!isDateInRange(c.dueDate || c.chequeDate, filters.dateFrom, filters.dateTo)) return;

        const amt = c.outstanding !== undefined ? c.outstanding : c.amount;
        totalAmount += amt;

        rows.push({
          id: c.id,
          date: c.dueDate || c.chequeDate,
          reference: c.chequeNumber,
          title: `شيك مرتجع #${c.chequeNumber}`,
          entityName: getTenantName(c.tenantId),
          category: c.bankName,
          status: c.status,
          amount: amt,
          notes: `Drawer: ${c.drawerName || "---"} | Outstanding: ${amt} AED`,
          groupKey: filters.groupBy === "TENANT" ? getTenantName(c.tenantId) : "ALL",
        });
      });
      break;
    }

    case "MAINTENANCE_FOLLOWUP": {
      (data.maintenanceRequests || []).forEach((m) => {
        if (!isDateInRange(m.requestDate, filters.dateFrom, filters.dateTo)) return;
        if (m.totalCost) totalAmount += m.totalCost;

        rows.push({
          id: m.id,
          date: m.requestDate,
          reference: m.requestNumber || m.id,
          title: m.issueDescription || "صيانة",
          entityName: getPropertyName(m.propertyId),
          category: m.category || "GENERAL",
          status: m.status,
          priority: m.priority,
          amount: m.totalCost || 0,
          notes: `Financial Status: ${m.financialStatus} | Cost Bearer: ${m.costBearer || "OWNER"}`,
          groupKey: filters.groupBy === "STATUS" ? m.status : filters.groupBy === "PROPERTY" ? getPropertyName(m.propertyId) : "ALL",
        });
      });
      break;
    }

    case "COMMUNICATION_ACTIVITY": {
      (data.communications || []).forEach((comm) => {
        if (!isDateInRange(comm.timestamp, filters.dateFrom, filters.dateTo)) return;

        rows.push({
          id: comm.id,
          date: comm.timestamp,
          reference: comm.communicationNumber,
          title: comm.subject,
          entityName: getTenantName(comm.tenantId) || comm.recipient,
          category: comm.channel,
          status: comm.status,
          assignedTo: comm.userName || "System",
          notes: comm.messageSummary,
          groupKey: filters.groupBy === "CATEGORY" ? comm.channel : filters.groupBy === "STATUS" ? comm.status : "ALL",
        });
      });
      break;
    }

    default: {
      // General Fallback to Exceptions
      exceptions.forEach((e) => {
        if (!isDateInRange(e.createdAt, filters.dateFrom, filters.dateTo)) return;
        rows.push({
          id: e.id,
          date: e.createdAt,
          reference: e.exceptionNumber,
          title: e.titleAr,
          entityName: e.sourceEntity,
          category: e.severity,
          status: e.status,
          amount: e.amount,
          notes: e.descriptionAr,
        });
      });
      break;
    }
  }

  // Multi-Level Grouping
  const groupedRows: Record<string, { rows: OperationalReportRow[]; subtotalCount: number; subtotalAmount?: number }> = {};
  rows.forEach((r) => {
    const key = r.groupKey || "ALL";
    if (!groupedRows[key]) {
      groupedRows[key] = { rows: [], subtotalCount: 0, subtotalAmount: 0 };
    }
    groupedRows[key].rows.push(r);
    groupedRows[key].subtotalCount++;
    if (r.amount) {
      groupedRows[key].subtotalAmount = (groupedRows[key].subtotalAmount || 0) + r.amount;
    }
  });

  return {
    titleAr: getReportTitle(reportType, "ar"),
    titleEn: getReportTitle(reportType, "en"),
    reportType,
    generatedAt: now,
    filters,
    rows,
    totalCount: rows.length,
    totalAmount: totalAmount > 0 ? totalAmount : undefined,
    groupedRows,
  };
}

function getReportTitle(type: OperationalReportType, lang: "ar" | "en"): string {
  const titles: Record<OperationalReportType, { ar: string; en: string }> = {
    OPERATIONAL_TASKS: { ar: "تقرير المهام التشغيلية", en: "Operational Tasks Report" },
    OVERDUE_TASKS: { ar: "تقرير المهام المتأخرة", en: "Overdue Tasks Report" },
    EXCEPTIONS: { ar: "تقرير الاستثناءات والملاحظات الحرجة", en: "Exceptions & Critical Alerts Report" },
    DOCUMENT_EXPIRY: { ar: "تقرير وثائق منتهية الصلاحية", en: "Document Expiry Report" },
    MISSING_DOCUMENTS: { ar: "تقرير الوثائق المطلوبة والناقصة", en: "Missing Documents Report" },
    LEASE_RENEWAL_PIPELINE: { ar: "تقرير خطة تجديد عقود الإيجار", en: "Lease Renewal Pipeline Report" },
    COLLECTION_FOLLOWUP: { ar: "تقرير متابعة التحصيلات المالية", en: "Collection Follow-up Report" },
    PAYMENT_PROMISES: { ar: "تقرير وعود السداد", en: "Payment Promises Report" },
    BOUNCED_CHEQUE_FOLLOWUP: { ar: "تقرير متابعة الشيكات المرتجعة", en: "Bounced Cheque Follow-up Report" },
    MAINTENANCE_FOLLOWUP: { ar: "تقرير متابعة طلبات الصيانة", en: "Maintenance Follow-up Report" },
    LEGAL_FOLLOWUP: { ar: "تقرير متابعة القضايا الإيجارية", en: "Legal Follow-up Report" },
    COMMUNICATION_ACTIVITY: { ar: "تقرير سجل المراسلات والإشعارات", en: "Communication Activity Report" },
    VACANCY_OPERATIONS: { ar: "تقرير العمليات والوحدات الشاغرة", en: "Vacancy Operations Report" },
    PROPERTY_OPERATIONAL_PERFORMANCE: { ar: "تقرير الأداء التشغيلي للعقارات", en: "Property Operational Performance Report" },
  };
  return titles[type]?.[lang] || type;
}

/**
 * Export Operational Report to Excel with CompanyProfile branding
 */
export function exportOperationalReportToExcel(
  reportResult: OperationalReportResult,
  companyProfile: CompanyProfile,
  lang: "ar" | "en" = "ar"
) {
  const isAr = lang === "ar";
  const wb = XLSX.utils.book_new();

  // Header Info
  const headerData = [
    { [isAr ? "البيان" : "Header"]: isAr ? companyProfile.nameAr : companyProfile.nameEn },
    { [isAr ? "البيان" : "Header"]: `${isAr ? "التقرير:" : "Report:"} ${isAr ? reportResult.titleAr : reportResult.titleEn}` },
    { [isAr ? "البيان" : "Header"]: `${isAr ? "تاريخ الإنشاء:" : "Generated At:"} ${reportResult.generatedAt.split("T")[0]}` },
    { [isAr ? "البيان" : "Header"]: `${isAr ? "إجمالي السجلات:" : "Total Records:"} ${reportResult.totalCount}` },
    { [isAr ? "البيان" : "Header"]: "" },
  ];

  const tableData = reportResult.rows.map((r) => ({
    [isAr ? "الرقم المرجعي" : "Ref"]: r.reference,
    [isAr ? "التاريخ" : "Date"]: r.date,
    [isAr ? "العنوان" : "Title"]: r.title,
    [isAr ? "الجهة / العقار" : "Entity"]: r.entityName,
    [isAr ? "التصنيف" : "Category"]: r.category,
    [isAr ? "الحالة" : "Status"]: r.status,
    [isAr ? "المسؤول" : "Assigned To"]: r.assignedTo || "---",
    [isAr ? "المبلغ (درهم)" : "Amount (AED)"]: r.amount !== undefined ? r.amount : "---",
    [isAr ? "ملاحظات" : "Notes"]: r.notes || "---",
  }));

  const ws = XLSX.utils.json_to_sheet(headerData.concat(tableData as any));
  XLSX.utils.book_append_sheet(wb, ws, "Operational_Report");
  XLSX.writeFile(wb, `${reportResult.reportType}_${new Date().toISOString().split("T")[0]}.xlsx`);
}
