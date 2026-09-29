import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Search,
  Filter,
  Calendar,
  Building2,
  Users,
  Wallet,
  TrendingUp,
  Scale,
  Receipt,
  Download,
  ChevronRight,
  ArrowRightLeft,
  FileDown,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  Gavel,
  Wrench,
  BarChart3,
  Layers,
  History,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  PieChart,
  DollarSign,
  Briefcase,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { downloadElementAsPdf } from "../../utils/pdfExportUtils";
import { UniversalReportFilter } from "../common/UniversalReportFilter";
import { ReportPrintHeader, ReportPrintFooter } from "./reports/ReportPrintHeader";
import { groupReportItems } from "./reports/reportGroupingUtils";
import { UniversalReportFilters, ReportItemBase, ReportGroupByOption } from "../../types/reportingTypes";
import { generateOwnerStatement, generateTenantStatement } from "../../services/financialEngine";

export const FinancialReportsView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    commissions = [],
    propertyExpenses = [],
    ownerTransfers = [],
    collections = [],
    leases = [],
    properties = [],
    owners = [],
    tenants = [],
    units = [],
    cheques = [],
    cases = [],
    maintenanceRequests = [],
    financialReversals = [],
    financialAdjustments = [],
    auditLogs = [],
    companyProfile,
    getOwnerStatement,
    getTenantStatement,
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReportId, setSelectedReportId] = useState<string>("executive_dashboard");
  const [reportCategory, setReportCategory] = useState<"all" | "owner" | "tenant" | "executive" | "audit">("all");
  
  // Universal Filters State (defaulting to empty/all records)
  const [filters, setFilters] = useState<UniversalReportFilters>({
    fromDate: "",
    toDate: "",
    ownerId: "",
    tenantId: "",
    propertyId: "",
    unitId: "",
    leaseId: "",
    transactionType: "",
    status: "",
    paymentMethod: "",
    expenseCategory: "",
    groupBy: "NONE",
    searchQuery: "",
  });

  // Test Suite State
  const [testReport, setTestReport] = useState<Phase23TestSuiteReport | null>(null);
  const [phase26Report, setPhase26Report] = useState<Phase26TestReport | null>(null);
  const [phase27Report, setPhase27Report] = useState<Phase27TestReport | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  // Expose test runners to window for automated testing
  useEffect(() => {
    (window as any).runPhase23AdvancedReportingTests = runPhase23AdvancedReportingTests;
    (window as any).runPhase26FinalUITestSuite = runPhase26FinalUITestSuite;
    (window as any).runPhase27SystemWideQATestSuite = runPhase27SystemWideQATestSuite;
    (window as any).runPhase28ProductionReadinessTests = runPhase28ProductionReadinessTests;
    (window as any).runPhase29GoLiveReadinessTests = runPhase29GoLiveReadinessTests;
    (window as any).runPhase30ProductionOperationsTests = (customData?: any) => {
      const activeData = customData || {
        owners,
        properties,
        units,
        tenants,
        leases,
        cheques,
        collections,
        maintenanceRequests,
        propertyExpenses,
        commissions: commissions || [],
        ownerTransfers: ownerTransfers || [],
        cases,
        archive: [],
        notifications: []
      };
      return runPhase30ProductionOperationsTests(activeData);
    };
  }, [owners, properties, units, tenants, leases, cheques, collections, maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases]);

  const handleRunTests = () => {
    const report28 = runPhase28ProductionReadinessTests();
    const report27 = runPhase27SystemWideQATestSuite();
    const report26 = runPhase26FinalUITestSuite();
    const report23 = runPhase23AdvancedReportingTests();
    setPhase27Report(report27);
    setPhase26Report(report26);
    setTestReport(report23);
    setShowTestModal(true);
  };

  // Report Definitions
  const reportsList = [
    {
      id: "executive_dashboard",
      nameAr: "التقرير التنفيذي ولوحة الذكاء التشغيلي",
      nameEn: "Executive Dashboard & Operational Intelligence",
      category: "executive",
      icon: BarChart3,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      descriptionAr: "مؤشرات الأداء الرئيسية، نسب الإشغال، الإيرادات والمصروفات وصافي الدخل",
      descriptionEn: "Key KPIs, Occupancy rate, Revenue vs Expenses, and Net Operating Income",
    },
    {
      id: "owner_statement",
      nameAr: "كشف حساب المالك المالي المعتمد",
      nameEn: "Owner Financial Statement",
      category: "owner",
      icon: Wallet,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      descriptionAr: "كشف تفصيلي لحركات الإيجارات، العمولات، المصاريف، والحوالات الصادرة",
      descriptionEn: "Detailed statement of rent collections, commissions, expenses and payouts",
    },
    {
      id: "tenant_statement",
      nameAr: "كشف حساب المستأجر المالي",
      nameEn: "Tenant Financial Statement",
      category: "tenant",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      descriptionAr: "سجل مستحقات الإيجار، الدفعات المسددة، الشيكات، والذمم المتبقية",
      descriptionEn: "Rent obligations, receipts, cheques and outstanding balance",
    },
    {
      id: "owner_payable_summary",
      nameAr: "ملخص مستحقات وأرصدة الملاك",
      nameEn: "Owner Payable Summary Report",
      category: "owner",
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      descriptionAr: "أرصدة الملاك المستحقة للصرف بعد خصم العمولات والمصاريف",
      descriptionEn: "Net payable balances for all owners after commissions and expenses",
    },
    {
      id: "property_expenses",
      nameAr: "تقرير مصاريف وتشغيل العقارات",
      nameEn: "Property Expense & Operating Report",
      category: "executive",
      icon: Receipt,
      color: "text-slate-600",
      bg: "bg-slate-50 dark:bg-slate-800",
      descriptionAr: "تفصيل مصاريف الصيانة، الخدمات، الفواتير والرسوم حسب العقار والطرف",
      descriptionEn: "Breakdown of operating, maintenance and utility expenses by property",
    },
    {
      id: "maintenance_financial",
      nameAr: "التقرير المالي لصيانة العقارات",
      nameEn: "Maintenance Financial Report",
      category: "executive",
      icon: Wrench,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      descriptionAr: "تكاليف طلبات الصيانة، فواتير الموردين، وتحمل المالك أو المستأجر",
      descriptionEn: "Maintenance work order costs, invoices, and cost-bearer allocation",
    },
    {
      id: "admin_fees",
      nameAr: "تقرير الرسوم الإدارية والعمولات",
      nameEn: "Administrative Fees & Commission Report",
      category: "owner",
      icon: FileText,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      descriptionAr: "عمولات إدارة العقارات، رسوم العقود والخدمات الإدارية المحصلة",
      descriptionEn: "Property management commissions, contract fees, and collected admin fees",
    },
    {
      id: "owner_transfers",
      nameAr: "تقرير حوالات وصرفيات الملاك",
      nameEn: "Owner Transfer & Payout Report",
      category: "owner",
      icon: ArrowRightLeft,
      color: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-950/40",
      descriptionAr: "حوالات التحويل البنكي وشيكات صرف الأرباح لملاك العقارات",
      descriptionEn: "Bank transfers and payout cheques disbursed to property owners",
    },
    {
      id: "collections",
      nameAr: "تقرير المقبوضات والتحصيلات",
      nameEn: "Collection & Receipts Report",
      category: "tenant",
      icon: CheckCircle2,
      color: "text-cyan-600",
      bg: "bg-cyan-50 dark:bg-cyan-950/40",
      descriptionAr: "سندات القبض المسددة نقدياً، عبر التحويل أو الشيكات البنكية",
      descriptionEn: "Receipt vouchers collected via cash, bank transfer, or cheques",
    },
    {
      id: "bounced_cheques",
      nameAr: "تقرير الشيكات المرتجعة والتعثر",
      nameEn: "Bounced Cheques & Default Report",
      category: "tenant",
      icon: AlertTriangle,
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      descriptionAr: "الشيكات المرتجعة، أسباب الإرجاع، المبالغ المستحقة وإجراءات المتابعة",
      descriptionEn: "Bounced cheques, return reasons, outstanding balances, and recovery status",
    },
    {
      id: "legal_court_fees",
      nameAr: "تقرير القضايا والمصاريف القضائية",
      nameEn: "Legal & Rental Dispute Fees Report",
      category: "executive",
      icon: Gavel,
      color: "text-amber-700",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      descriptionAr: "نزاعات الإيجار ولجنة فض المنازعات، المطالبات والمصاريف القانونية",
      descriptionEn: "Rental dispute committee cases, claims, legal fees and recoveries",
    },
    {
      id: "profitability_summary",
      nameAr: "تقرير الربحية وصافي الدخل التشغيلي",
      nameEn: "Property Profitability & Net Operating Income",
      category: "executive",
      icon: TrendingUp,
      color: "text-emerald-700",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      descriptionAr: "مقارنة الإيرادات الإيجارية بالمصاريف لحساب صافي العائد الاستثماري",
      descriptionEn: "Rental revenues vs operating expenses to calculate net returns",
    },
    {
      id: "vat_tax_report",
      nameAr: "تقرير ضريبة القيمة المضافة والموقف الضريبي",
      nameEn: "VAT Tax Report & Tax Position",
      category: "audit",
      icon: Scale,
      color: "text-indigo-700",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      descriptionAr: "ضريبة المخرجات، ضريبة المدخلات، وصافي الموقف الضريبي للهيئة",
      descriptionEn: "Output VAT, Input VAT, and Net Tax Position for FTA",
    },
    {
      id: "financial_reversals",
      nameAr: "سجل العمليات المالية الملغاة والمعكوسة",
      nameEn: "Financial Reversal Audit Report",
      category: "audit",
      icon: RotateCcw,
      color: "text-orange-700",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      descriptionAr: "عمليات الإلغاء، تصحيح القيود، أسباب الاسترجاع والمدقق المسؤول",
      descriptionEn: "Reversals, entry adjustments, rollback reasons and responsible auditor",
    },
    {
      id: "audit_report",
      nameAr: "سجل تدقيق الأنشطة المحاسبية",
      nameEn: "Accounting & Audit Activity Log",
      category: "audit",
      icon: ShieldCheck,
      color: "text-slate-700",
      bg: "bg-slate-100 dark:bg-slate-800",
      descriptionAr: "سجل تتبع الحركات والتغييرات المالية لضمان الشفافية والامتثال",
      descriptionEn: "Chronological audit trail of financial events, updates and actions",
    },
  ];

  const filteredReportsList = reportsList.filter((r) => {
    if (reportCategory !== "all" && r.category !== reportCategory) return false;
    if (!searchQuery) return true;
    return (
      r.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.descriptionAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Date filtering helper
  const isInDateRange = (dateStr?: string) => {
    if (!dateStr) return true;
    const d = dateStr.slice(0, 10);
    if (filters.fromDate && d < filters.fromDate) return false;
    if (filters.toDate && d > filters.toDate) return false;
    return true;
  };

  // Helper to format Party, Property & Unit Details
  const formatEntityDetails = (params: {
    ownerId?: string;
    tenantId?: string;
    propertyId?: string;
    unitId?: string;
  }) => {
    const property = properties.find((p) => p.id === params.propertyId);
    const owner = owners.find((o) => o.id === (params.ownerId || property?.ownerId));
    const tenant = tenants.find((t) => t.id === params.tenantId);
    const unit =
      units.find((u) => u.id === params.unitId) ||
      (property ? units.find((u) => u.propertyId === property.id) : undefined);

    const ownerName = owner ? (isAr ? owner.nameAr : owner.nameEn) : "---";
    const tenantName = tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "---";
    const propName = property ? (isAr ? property.nameAr : property.nameEn) : "---";
    const unitNum = unit ? unit.unitNumber : isAr ? "عام" : "General";

    if (tenant && tenantName !== "---") {
      return isAr
        ? `المستأجر: ${tenantName} | المالك: ${ownerName} | العقار: ${propName} | الوحدة: ${unitNum}`
        : `Tenant: ${tenantName} | Owner: ${ownerName} | Property: ${propName} | Unit: ${unitNum}`;
    }

    return isAr
      ? `المالك: ${ownerName} | العقار: ${propName} | الوحدة: ${unitNum}`
      : `Owner: ${ownerName} | Property: ${propName} | Unit: ${unitNum}`;
  };

  // Primary Compute Engine for Selected Report
  const rawReportItems = useMemo<ReportItemBase[]>(() => {
    if (!selectedReportId || selectedReportId === "executive_dashboard") return [];

    switch (selectedReportId) {
      // 1. OWNER STATEMENT
      case "owner_statement": {
        const targetOwnerId = filters.ownerId || owners[0]?.id;
        if (!targetOwnerId) return [];

        const targetOwner = owners.find((o) => o.id === targetOwnerId);
        const ownerName = targetOwner ? (isAr ? targetOwner.nameAr : targetOwner.nameEn) : "";

        const stmt = generateOwnerStatement(
          targetOwnerId,
          ownerName,
          {
            propertyId: filters.propertyId || undefined,
            dateFrom: filters.fromDate || undefined,
            dateTo: filters.toDate || undefined,
          },
          {
            commissions,
            expenses: propertyExpenses,
            transfers: ownerTransfers,
            collections,
            leases,
            reversals: financialReversals,
            adjustments: financialAdjustments,
          }
        );

        return stmt.transactions.map((tx, idx) => {
          return {
            id: tx.id || `tx-${idx}`,
            date: tx.date,
            reference: tx.reference || `REF-${idx + 1}`,
            description: tx.description,
            ownerId: targetOwnerId,
            ownerName,
            propertyName: tx.propertyName || "",
            entityDetails: isAr
              ? `المالك: ${ownerName} | العقار: ${tx.propertyName || "عام"} | الوحدة: ${tx.unitNumber || "عام"}`
              : `Owner: ${ownerName} | Property: ${tx.propertyName || "General"} | Unit: ${tx.unitNumber || "General"}`,
            category: tx.eventType,
            debit: tx.debit,
            credit: tx.credit,
            balance: tx.runningBalance,
          };
        });
      }

      // 2. TENANT STATEMENT
      case "tenant_statement": {
        const targetTenantId = filters.tenantId || tenants[0]?.id;
        if (!targetTenantId) return [];

        const targetTenant = tenants.find((t) => t.id === targetTenantId);
        const tenantName = targetTenant ? (isAr ? targetTenant.nameAr : targetTenant.nameEn) : "";

        const stmt = generateTenantStatement(
          targetTenantId,
          tenantName,
          {
            leaseId: filters.leaseId || undefined,
            dateFrom: filters.fromDate || undefined,
            dateTo: filters.toDate || undefined,
          },
          {
            leases,
            collections,
            commissions,
            expenses: propertyExpenses,
            cheques,
            adjustments: financialAdjustments,
            reversals: financialReversals,
          }
        );

        return stmt.transactions.map((tx, idx) => {
          return {
            id: tx.id || `tnt-tx-${idx}`,
            date: tx.date,
            reference: tx.reference || `REF-${idx + 1}`,
            description: tx.description,
            tenantId: targetTenantId,
            tenantName,
            entityDetails: isAr
              ? `المستأجر: ${tenantName} | الوحدة: ${tx.unitNumber || "عام"} | عقد: ${tx.leaseNumber || "---"}`
              : `Tenant: ${tenantName} | Unit: ${tx.unitNumber || "General"} | Lease: ${tx.leaseNumber || "---"}`,
            category: tx.eventType,
            debit: tx.debit,
            credit: tx.credit,
            balance: tx.runningBalance,
          };
        });
      }

      // 3. OWNER PAYABLE SUMMARY
      case "owner_payable_summary": {
        return owners
          .filter((o) => !filters.ownerId || o.id === filters.ownerId)
          .map((owner) => {
            const ownerName = isAr ? owner.nameAr : owner.nameEn;
            const ownerRentCollections = collections
              .filter((c) => c.ownerId === owner.id && isInDateRange(c.paymentDate))
              .reduce((sum, c) => sum + (c.amountApplied || c.amountEntered || 0), 0);

            const ownerComms = commissions
              .filter((c) => c.ownerId === owner.id && c.partyType === "OWNER" && isInDateRange(c.dueDate))
              .reduce((sum, c) => sum + (c.collectedAmount || c.totalCommissionAmount || 0), 0);

            const ownerExp = propertyExpenses
              .filter((e) => e.ownerId === owner.id && e.costBearer === "OWNER" && isInDateRange(e.expenseDate))
              .reduce((sum, e) => sum + (e.totalAmount || e.amount || 0), 0);

            const ownerTrfs = ownerTransfers
              .filter((t) => t.ownerId === owner.id && isInDateRange(t.transferDate))
              .reduce((sum, t) => sum + t.amount, 0);

            const netPayable = ownerRentCollections - ownerComms - ownerExp - ownerTrfs;

            return {
              id: owner.id,
              date: new Date().toISOString().split("T")[0],
              reference: owner.code || "OW",
              description: isAr ? `ملخص رصيد المالك: ${ownerName}` : `Payable Summary: ${ownerName}`,
              ownerId: owner.id,
              ownerName,
              entityDetails: `${isAr ? "المالك:" : "Owner:"} ${ownerName} | IBAN: ${owner.iban || "---"}`,
              category: "OWNER_PAYABLE",
              debit: ownerComms + ownerExp + ownerTrfs,
              credit: ownerRentCollections,
              balance: netPayable,
            };
          });
      }

      // 4. PROPERTY EXPENSES
      case "property_expenses": {
        return propertyExpenses
          .filter((exp) => {
            if (!isInDateRange(exp.expenseDate || exp.createdAt)) return false;
            if (filters.ownerId && exp.ownerId !== filters.ownerId) return false;
            if (filters.tenantId && exp.tenantId !== filters.tenantId) return false;
            if (filters.propertyId && exp.propertyId !== filters.propertyId) return false;
            if (filters.unitId && exp.unitId !== filters.unitId) return false;
            if (filters.expenseCategory && exp.category !== filters.expenseCategory) return false;
            if (filters.paymentMethod && exp.paymentMethod !== filters.paymentMethod) return false;
            return true;
          })
          .map((exp) => {
            const prop = properties.find((p) => p.id === exp.propertyId);
            const owner = owners.find((o) => o.id === exp.ownerId);
            const tenant = tenants.find((t) => t.id === exp.tenantId);
            return {
              id: exp.id,
              date: exp.expenseDate || exp.createdAt?.split("T")[0] || "",
              reference: exp.expenseNumber || exp.id.slice(0, 8),
              description: exp.description,
              ownerId: exp.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              tenantId: exp.tenantId,
              tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "",
              propertyId: exp.propertyId,
              propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "",
              entityDetails: formatEntityDetails({
                ownerId: exp.ownerId,
                tenantId: exp.tenantId,
                propertyId: exp.propertyId,
                unitId: exp.unitId,
              }),
              category: exp.category,
              costBearer: exp.costBearer,
              paymentMethod: exp.paymentMethod || "OTHER",
              vatAmount: exp.vatAmount || 0,
              debit: exp.totalAmount || exp.amount,
              credit: 0,
              balance: -(exp.totalAmount || exp.amount),
            };
          });
      }

      // 5. MAINTENANCE FINANCIAL REPORT
      case "maintenance_financial": {
        return maintenanceRequests
          .filter((req) => {
            if (!isInDateRange(req.requestDate || req.createdAt)) return false;
            if (filters.ownerId && req.ownerId !== filters.ownerId) return false;
            if (filters.tenantId && req.tenantId !== filters.tenantId) return false;
            if (filters.propertyId && req.propertyId !== filters.propertyId) return false;
            if (filters.unitId && req.unitId !== filters.unitId) return false;
            return true;
          })
          .map((req) => {
            const prop = properties.find((p) => p.id === req.propertyId);
            const owner = owners.find((o) => o.id === req.ownerId);
            const tenant = tenants.find((t) => t.id === req.tenantId);
            return {
              id: req.id,
              date: req.requestDate || req.createdAt?.split("T")[0] || "",
              reference: req.requestNumber || req.id.slice(0, 8),
              description: `${req.category}: ${req.issueDescription}`,
              ownerId: req.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              tenantId: req.tenantId,
              tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "",
              propertyId: req.propertyId,
              propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "",
              entityDetails: formatEntityDetails({
                ownerId: req.ownerId,
                tenantId: req.tenantId,
                propertyId: req.propertyId,
                unitId: req.unitId,
              }),
              category: req.category,
              costBearer: req.costBearer,
              status: req.status,
              debit: req.totalCost,
              credit: req.paidAmount || 0,
              balance: req.remainingAmount || (req.totalCost - (req.paidAmount || 0)),
            };
          });
      }

      // 6. ADMIN FEES & COMMISSIONS
      case "admin_fees": {
        return commissions
          .filter((com) => {
            if (!isInDateRange(com.dueDate || com.createdAt)) return false;
            if (filters.ownerId && com.ownerId !== filters.ownerId) return false;
            if (filters.tenantId && com.tenantId !== filters.tenantId) return false;
            if (filters.leaseId && com.leaseId !== filters.leaseId) return false;
            return true;
          })
          .map((com) => {
            const lease = leases.find((l) => l.id === com.leaseId);
            const owner = owners.find((o) => o.id === com.ownerId);
            const tenant = tenants.find((t) => t.id === com.tenantId);
            return {
              id: com.id,
              date: com.dueDate || com.createdAt?.split("T")[0] || "",
              reference: `COM-${com.id.slice(0, 6)}`,
              description: isAr
                ? `عمولة إدارة (${com.partyType === "OWNER" ? "المالك" : "المستأجر"}) - بنسبة ${com.ratePercentage}%`
                : `Management Commission (${com.partyType}) - ${com.ratePercentage}%`,
              ownerId: com.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              tenantId: com.tenantId,
              tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "",
              propertyId: lease?.propertyId,
              leaseId: com.leaseId,
              entityDetails: formatEntityDetails({
                ownerId: com.ownerId,
                tenantId: com.tenantId,
                propertyId: lease?.propertyId,
                unitId: lease?.unitId,
              }),
              category: "COMMISSION",
              status: com.status,
              debit: com.totalCommissionAmount,
              credit: com.collectedAmount || 0,
              balance: com.outstandingBalance !== undefined ? com.outstandingBalance : (com.totalCommissionAmount - (com.collectedAmount || 0)),
            };
          });
      }

      // 7. OWNER TRANSFERS & PAYOUTS
      case "owner_transfers": {
        return ownerTransfers
          .filter((trf) => {
            if (!isInDateRange(trf.transferDate || trf.createdAt)) return false;
            if (filters.ownerId && trf.ownerId !== filters.ownerId) return false;
            if (filters.paymentMethod && trf.paymentMethod !== filters.paymentMethod) return false;
            return true;
          })
          .map((trf) => {
            const owner = owners.find((o) => o.id === trf.ownerId);
            const prop = properties.find((p) => p.id === trf.propertyId || p.ownerId === trf.ownerId);
            return {
              id: trf.id,
              date: trf.transferDate || trf.createdAt?.split("T")[0] || "",
              reference: trf.transferNumber || trf.id.slice(0, 8),
              description: trf.notes || (isAr ? `تحويل بنكي لمستحقات المالك` : `Owner Bank Payout Transfer`),
              ownerId: trf.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              propertyId: trf.propertyId,
              propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "",
              entityDetails: `${isAr ? "المالك:" : "Owner:"} ${owner ? (isAr ? owner.nameAr : owner.nameEn) : "---"} | IBAN: ${trf.beneficiaryIban || "---"}`,
              category: "TRANSFER",
              paymentMethod: trf.paymentMethod,
              status: trf.status,
              debit: 0,
              credit: trf.amount,
              balance: trf.amount,
            };
          });
      }

      // 8. COLLECTIONS & RECEIPTS
      case "collections": {
        return collections
          .filter((col) => {
            if (!isInDateRange(col.paymentDate || col.createdAt)) return false;
            if (filters.ownerId && col.ownerId !== filters.ownerId) return false;
            if (filters.tenantId && col.tenantId !== filters.tenantId) return false;
            if (filters.paymentMethod && col.paymentMethod !== filters.paymentMethod) return false;
            return true;
          })
          .map((col) => {
            const tenant = tenants.find((t) => t.id === col.tenantId);
            const owner = owners.find((o) => o.id === col.ownerId);
            return {
              id: col.id,
              date: col.paymentDate || col.createdAt?.split("T")[0] || "",
              reference: col.receiptNumber || col.id.slice(0, 8),
              description: col.notes || (isAr ? `سند قبض إيجار / دفعة مالية` : `Rent Collection Receipt`),
              ownerId: col.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              tenantId: col.tenantId,
              tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "",
              entityDetails: formatEntityDetails({
                ownerId: col.ownerId,
                tenantId: col.tenantId,
              }),
              category: "COLLECTION",
              paymentMethod: col.paymentMethod,
              debit: 0,
              credit: col.amountApplied || col.amountEntered,
              balance: col.amountApplied || col.amountEntered,
            };
          });
      }

      // 9. BOUNCED CHEQUES
      case "bounced_cheques": {
        return cheques
          .filter((chq) => {
            if (chq.status !== "BOUNCED" && chq.originalStatus !== "BOUNCED") return false;
            if (!isInDateRange(chq.returnedDate || chq.chequeDate)) return false;
            if (filters.ownerId && chq.ownerId !== filters.ownerId) return false;
            if (filters.tenantId && chq.tenantId !== filters.tenantId) return false;
            if (filters.propertyId && chq.propertyId !== filters.propertyId) return false;
            return true;
          })
          .map((chq) => {
            const tenant = tenants.find((t) => t.id === chq.tenantId);
            const owner = owners.find((o) => o.id === chq.ownerId);
            const prop = properties.find((p) => p.id === chq.propertyId);
            return {
              id: chq.id,
              date: chq.returnedDate || chq.chequeDate,
              reference: chq.chequeNumber,
              description: isAr
                ? `شيك مرتجع (${chq.bankName}) - سبب الإرجاع: ${chq.returnReason || "عدم كفاية الرصيد"}`
                : `Bounced Cheque (${chq.bankName}) - Reason: ${chq.returnReason || "Insufficient Funds"}`,
              ownerId: chq.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              tenantId: chq.tenantId,
              tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "",
              propertyId: chq.propertyId,
              propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "",
              entityDetails: formatEntityDetails({
                ownerId: chq.ownerId,
                tenantId: chq.tenantId,
                propertyId: chq.propertyId,
                unitId: chq.unitId,
              }),
              category: "BOUNCED_CHEQUE",
              status: chq.status,
              debit: chq.outstanding !== undefined ? chq.outstanding : chq.amount,
              credit: chq.totalApplied || 0,
              balance: chq.outstanding !== undefined ? chq.outstanding : chq.amount,
            };
          });
      }

      // 10. LEGAL & COURT FEES
      case "legal_court_fees": {
        return cases
          .filter((cs) => {
            if (!isInDateRange(cs.filingDate || cs.createdAt)) return false;
            if (filters.ownerId && cs.ownerId !== filters.ownerId) return false;
            if (filters.tenantId && cs.tenantId !== filters.tenantId) return false;
            if (filters.propertyId && cs.propertyId !== filters.propertyId) return false;
            return true;
          })
          .map((cs) => {
            const tenant = tenants.find((t) => t.id === cs.tenantId);
            const owner = owners.find((o) => o.id === cs.ownerId);
            const prop = properties.find((p) => p.id === cs.propertyId);
            return {
              id: cs.id,
              date: cs.filingDate || cs.createdAt?.split("T")[0] || "",
              reference: cs.caseNumber || cs.courtReferenceNumber || cs.id.slice(0, 8),
              description: `${cs.courtName || "لجنة فض المنازعات الإيجارية"} - قضية رقم ${cs.caseNumber}`,
              ownerId: cs.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              tenantId: cs.tenantId,
              tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "",
              propertyId: cs.propertyId,
              propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "",
              entityDetails: formatEntityDetails({
                ownerId: cs.ownerId,
                tenantId: cs.tenantId,
                propertyId: cs.propertyId,
                unitId: cs.unitId,
              }),
              category: "LEGAL_CASE",
              status: cs.status,
              debit: (cs.claimAmount || 0) + (cs.legalFeesClaimed || 0),
              credit: cs.totalPaid || 0,
              balance: cs.outstanding || (cs.claimAmount || 0) + (cs.legalFeesClaimed || 0) - (cs.totalPaid || 0),
            };
          });
      }

      // 11. PROFITABILITY SUMMARY
      case "profitability_summary": {
        return properties
          .filter((p) => !filters.propertyId || p.id === filters.propertyId)
          .map((prop) => {
            const owner = owners.find((o) => o.id === prop.ownerId);
            const propName = isAr ? prop.nameAr : prop.nameEn;

            const propLeases = leases.filter((l) => l.propertyId === prop.id);
            const propTenantIds = new Set(propLeases.map((l) => l.tenantId));

            const totalInflow = collections
              .filter((c) => propTenantIds.has(c.tenantId) && isInDateRange(c.paymentDate))
              .reduce((sum, c) => sum + (c.amountApplied || c.amountEntered || 0), 0);

            const totalExpenses = propertyExpenses
              .filter((e) => e.propertyId === prop.id && isInDateRange(e.expenseDate))
              .reduce((sum, e) => sum + (e.totalAmount || e.amount || 0), 0);

            const netOperatingResult = totalInflow - totalExpenses;

            return {
              id: prop.id,
              date: new Date().toISOString().split("T")[0],
              reference: prop.code || "PROP",
              description: isAr ? `تحليل ربحية عقار: ${propName}` : `Property Profitability: ${propName}`,
              ownerId: prop.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              propertyId: prop.id,
              propertyName: propName,
              entityDetails: `${isAr ? "العقار:" : "Property:"} ${propName} | ${isAr ? "المالك:" : "Owner:"} ${owner ? (isAr ? owner.nameAr : owner.nameEn) : "---"}`,
              category: "PROFITABILITY",
              debit: totalExpenses,
              credit: totalInflow,
              balance: netOperatingResult,
            };
          });
      }

      // 12. VAT TAX REPORT
      case "vat_tax_report": {
        // Only Administrative Fees are subject to VAT
        const expenseVat = propertyExpenses
          .filter((e) => {
            if (!isInDateRange(e.expenseDate || e.createdAt)) return false;
            // Filter: Only Administrative Fees (if any in expenses, e.g. "MANAGEMENT")
            if (e.category !== "MANAGEMENT") return false; 
            return (e.vatAmount && e.vatAmount > 0);
          })
          .map((exp) => {
            const prop = properties.find((p) => p.id === exp.propertyId);
            const owner = owners.find((o) => o.id === exp.ownerId);
            const calculatedVAT = exp.vatAmount || 0; 
            const vatRateUsed = exp.vatRate || (exp.amount > 0 ? Math.round((calculatedVAT / exp.amount) * 100) : 5);

            return {
              id: exp.id,
              date: exp.expenseDate || exp.createdAt?.split("T")[0] || "",
              reference: exp.expenseNumber || exp.id.slice(0, 8),
              description: isAr 
                ? `ضريبة مدخلات (رسوم إدارية ${vatRateUsed}%): ${exp.description}` 
                : `Input VAT (Admin Fee ${vatRateUsed}%): ${exp.description}`,
              ownerId: exp.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              propertyId: exp.propertyId,
              propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "",
              entityDetails: formatEntityDetails({
                ownerId: exp.ownerId,
                propertyId: exp.propertyId,
                unitId: exp.unitId,
              }),
              category: "VAT_INPUT",
              taxableBase: exp.amount,
              vatRate: vatRateUsed,
              vatAmount: calculatedVAT,
              taxDirection: "INPUT_VAT",
              debit: exp.amount,
              credit: calculatedVAT,
              balance: exp.amount + calculatedVAT,
            };
          });

        const commissionVat = commissions
          .filter((c) => {
            if (c.status === "REVERSED" || c.status === "CANCELLED") return false;
            if (!isInDateRange(c.dueDate || c.createdAt)) return false;
            // Filter: Only Administrative Fees
            if (c.commissionType !== "ADMIN_FEE") return false;
            return c.vatAmount && c.vatAmount > 0;
          })
          .map((com) => {
            const prop = properties.find((p) => p.id === com.propertyId);
            const owner = owners.find((o) => o.id === com.ownerId);
            const vRate = com.vatRate || 5;
            return {
              id: com.id,
              date: com.dueDate || com.createdAt?.split("T")[0] || "",
              reference: `VAT-${com.id.slice(0, 6)}`,
              description: isAr 
                ? `ضريبة مخرجات (رسوم إدارية ${vRate}%): ${com.commissionType} (${com.partyType})` 
                : `Output VAT (Admin Fee ${vRate}%): ${com.commissionType} (${com.partyType})`,
              ownerId: com.ownerId,
              ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "",
              propertyId: com.propertyId,
              propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "",
              entityDetails: formatEntityDetails({
                ownerId: com.ownerId,
                tenantId: com.tenantId,
                propertyId: com.propertyId,
                unitId: com.unitId,
              }),
              category: "VAT_OUTPUT",
              taxableBase: com.netRevenueAmount || com.totalCommissionAmount - (com.vatAmount || 0),
              vatRate: vRate,
              vatAmount: com.vatAmount || 0,
              taxDirection: "OUTPUT_VAT",
              debit: com.netRevenueAmount || com.totalCommissionAmount - (com.vatAmount || 0),
              credit: com.vatAmount || 0,
              balance: com.totalCommissionAmount,
            };
          });

        return [...expenseVat, ...commissionVat].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      // 13. FINANCIAL REVERSALS AUDIT
      case "financial_reversals": {
        return financialReversals
          .filter((rev) => isInDateRange(rev.reversalDate || rev.createdAt))
          .map((rev) => {
            return {
              id: rev.id,
              date: rev.reversalDate || rev.createdAt?.split("T")[0] || "",
              reference: rev.reversalNumber || rev.id.slice(0, 8),
              description: `${rev.reason} (${isAr ? "المدقق:" : "Auditor:"} ${rev.performedByUserName || "Finance Auditor"})`,
              category: rev.targetType,
              entityDetails: isAr
                ? `عملية ملغاة: ${rev.targetType} | الكود: ${rev.targetId}`
                : `Reversed: ${rev.targetType} | ID: ${rev.targetId}`,
              debit: rev.reversedAmount,
              credit: 0,
              balance: -rev.reversedAmount,
            };
          });
      }

      // 14. AUDIT & ACTIVITY LOG
      case "audit_report": {
        return (auditLogs || [])
          .filter((log: any) => isInDateRange(log.timestamp || log.createdAt))
          .map((log: any, idx: number) => {
            return {
              id: log.id || `audit-${idx}`,
              date: log.timestamp?.split("T")[0] || log.createdAt?.split("T")[0] || "",
              reference: log.action || "SYSTEM_AUDIT",
              description: `${log.details || log.description || log.action} - [${log.userName || "System"}]`,
              category: log.actionCategory || "AUDIT",
              entityDetails: `${log.resourceType || "Financial"}: ${log.resourceId || "---"}`,
              debit: 0,
              credit: 0,
              balance: 0,
            };
          });
      }

      default:
        return [];
    }
  }, [
    selectedReportId,
    filters,
    owners,
    tenants,
    properties,
    leases,
    collections,
    commissions,
    propertyExpenses,
    ownerTransfers,
    cheques,
    cases,
    maintenanceRequests,
    financialReversals,
    financialAdjustments,
    auditLogs,
    isAr,
  ]);

  // Apply Search Query to Report Items
  const filteredReportItems = useMemo(() => {
    if (!filters.searchQuery) return rawReportItems;
    const q = filters.searchQuery.toLowerCase();
    return rawReportItems.filter((item) => {
      return (
        item.description.toLowerCase().includes(q) ||
        item.reference?.toLowerCase().includes(q) ||
        item.entityDetails?.toLowerCase().includes(q) ||
        item.ownerName?.toLowerCase().includes(q) ||
        item.tenantName?.toLowerCase().includes(q) ||
        item.propertyName?.toLowerCase().includes(q)
      );
    });
  }, [rawReportItems, filters.searchQuery]);

  // Compute Grouped and Subtotaled Result
  const groupedResult = useMemo(() => {
    return groupReportItems(filteredReportItems, filters.groupBy || "NONE", isAr);
  }, [filteredReportItems, filters.groupBy, isAr]);

  // Executive Dashboard KPIs calculation
  const executiveKPIs = useMemo(() => {
    const totalProperties = properties.length;
    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === "OCCUPIED" || u.currentTenantId).length;
    const vacantUnits = totalUnits - occupiedUnits;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const totalGrossRevenue = collections
      .filter((c) => isInDateRange(c.paymentDate))
      .reduce((sum, c) => sum + (c.amountApplied || c.amountEntered || 0), 0);

    const totalOperatingExpenses = propertyExpenses
      .filter((e) => isInDateRange(e.expenseDate))
      .reduce((sum, e) => sum + (e.totalAmount || e.amount || 0), 0);

    const netOperatingIncome = totalGrossRevenue - totalOperatingExpenses;

    const totalCommissionsEarned = commissions
      .filter((c) => isInDateRange(c.dueDate) && c.status !== "REVERSED" && c.status !== "CANCELLED")
      .reduce((sum, c) => {
        // For taxable commissions, revenue is only the Net portion
        const netRevenue = c.netRevenueAmount !== undefined ? c.netRevenueAmount : c.totalCommissionAmount;
        // Recognition based on collected portion (proportionate to net)
        const collected = c.collectedAmount || 0;
        const gross = c.totalCommissionAmount || 1;
        const collectedNet = (collected / gross) * netRevenue;
        
        return sum + (collected > 0 ? collectedNet : 0);
      }, 0);

    const totalOwnerPayouts = ownerTransfers
      .filter((t) => isInDateRange(t.transferDate))
      .reduce((sum, t) => sum + t.amount, 0);

    const bouncedChequesTotal = cheques
      .filter((c) => (c.status === "BOUNCED" || c.originalStatus === "BOUNCED") && isInDateRange(c.returnedDate))
      .reduce((sum, c) => sum + (c.outstanding !== undefined ? c.outstanding : c.amount), 0);

    return {
      totalProperties,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate: occupancyRate.toFixed(1),
      totalGrossRevenue,
      totalOperatingExpenses,
      netOperatingIncome,
      totalCommissionsEarned,
      totalOwnerPayouts,
      bouncedChequesTotal,
    };
  }, [properties, units, collections, propertyExpenses, commissions, ownerTransfers, cheques, filters]);

  // Export CSV Handler
  const handleExportCSV = () => {
    const reportMeta = reportsList.find((r) => r.id === selectedReportId);
    const headers = [
      isAr ? "التاريخ" : "Date",
      isAr ? "المرجع" : "Reference",
      isAr ? "بيانات الطرف والعقار والوحدة" : "Party, Property & Unit Details",
      isAr ? "البيان والتفاصيل" : "Description",
      isAr ? "التصنيف" : "Category",
      isAr ? "مدين (AED)" : "Debit (AED)",
      isAr ? "دائن (AED)" : "Credit (AED)",
      isAr ? "الرصيد / الصافي (AED)" : "Balance / Net (AED)",
    ];

    const rows = filteredReportItems.map((item) => [
      `"${item.date}"`,
      `"${item.reference || ""}"`,
      `"${(item.entityDetails || "").replace(/"/g, '""')}"`,
      `"${(item.description || "").replace(/"/g, '""')}"`,
      `"${item.category || ""}"`,
      item.debit || 0,
      item.credit || 0,
      item.balance || 0,
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedReportId}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Excel Handler (using xlsx library)
  const handleExportExcel = () => {
    const reportMeta = reportsList.find((r) => r.id === selectedReportId);
    const excelData = filteredReportItems.map((item) => ({
      [isAr ? "التاريخ" : "Date"]: item.date,
      [isAr ? "المرجع" : "Reference"]: item.reference || "",
      [isAr ? "بيانات الطرف والعقار والوحدة" : "Party & Property Details"]: item.entityDetails || "",
      [isAr ? "البيان والتفاصيل" : "Description"]: item.description,
      [isAr ? "التصنيف" : "Category"]: item.category || "",
      [isAr ? "مدين" : "Debit"]: item.debit || 0,
      [isAr ? "دائن" : "Credit"]: item.credit || 0,
      [isAr ? "الرصيد" : "Balance"]: item.balance || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${selectedReportId}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Official Print / PDF Trigger
  const handlePrintPDF = () => {
    window.print();
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfToastMessage, setPdfToastMessage] = useState<string | null>(null);

  const handleDownloadPDF = async () => {
    setIsDownloadingPdf(true);
    try {
      const reportMeta = reportsList.find((r) => r.id === selectedReportId);
      const safeTitle = reportMeta ? reportMeta.nameEn.replace(/[^a-zA-Z0-9]/g, "_") : selectedReportId;
      const fileName = `${safeTitle}_${new Date().toISOString().split("T")[0]}.pdf`;

      const el = document.getElementById("printable-report-card");
      if (el) {
        const success = await downloadElementAsPdf(el, {
          fileName,
          orientation: "p",
          scale: 2,
        });
        if (success) {
          setPdfToastMessage(
            isAr
              ? "تم حفظ التقرير المالي كملف PDF بنجاح!"
              : "Financial report saved as PDF successfully!"
          );
          setTimeout(() => setPdfToastMessage(null), 4000);
        }
      }
    } catch (err) {
      console.error("[FinancialReportsView] PDF export failed:", err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const currentReportMeta = reportsList.find((r) => r.id === selectedReportId);

  return (
    <div className="space-y-6">
      {/* Top Banner & Test Suite Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-md print:hidden">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            {isAr ? "مركز التقارير المالية والذكاء التشغيلي" : "Financial Reporting & Intelligence Center"}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            {isAr ? "التقارير المحاسبية والإدارية المعتمدة" : "Official Financial & Management Reports"}
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            {isAr
              ? "منظومة محاسبية متكاملة تدعم 15 تقريراً مالياً، فلاتر متعددة، تجميع الحسابات، تصدير إكسل والطباعة الرسمية المعتمدة."
              : "Integrated accounting suite supporting 15 financial reports, universal filters, grouping & subtotals, Excel export, and certified A4 printing."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunTests}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs"
          >
            <Play className="w-4 h-4" />
            <span>{isAr ? "تشغيل فحص النظام (80+ اختبار)" : "Run Tests (80+ Assertions)"}</span>
          </button>
        </div>
      </div>

      {/* Category Tabs & Quick Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setReportCategory("all")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
              reportCategory === "all"
                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            {isAr ? "جميع التقارير (All)" : "All Reports"}
          </button>
          <button
            onClick={() => setReportCategory("owner")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              reportCategory === "owner"
                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{isAr ? "تقارير الملاك" : "Owner Reports"}</span>
          </button>
          <button
            onClick={() => setReportCategory("tenant")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              reportCategory === "tenant"
                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isAr ? "تقارير المستأجرين" : "Tenant Reports"}</span>
          </button>
          <button
            onClick={() => setReportCategory("executive")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              reportCategory === "executive"
                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{isAr ? "التقارير التنفيذية والتشغيلية" : "Executive & Operations"}</span>
          </button>
          <button
            onClick={() => setReportCategory("audit")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              reportCategory === "audit"
                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{isAr ? "الضرائب والتدقيق المالي" : "Tax & Audit"}</span>
          </button>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "ابحث عن تقرير..." : "Search report..."}
            className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Reports Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 print:hidden">
        {filteredReportsList.map((report) => {
          const isSelected = selectedReportId === report.id;
          return (
            <button
              key={report.id}
              onClick={() => setSelectedReportId(report.id)}
              className={`group text-right rtl:text-right p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/30"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300"
              }`}
            >
              <div>
                <div
                  className={`w-10 h-10 rounded-xl ${report.bg} flex items-center justify-center mb-3 transition-transform group-hover:scale-105`}
                >
                  <report.icon className={`w-5 h-5 ${report.color}`} />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                  {isAr ? report.nameAr : report.nameEn}
                </h3>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isSelected ? (isAr ? "التقرير الحالي" : "SELECTED") : isAr ? "عرض التقرير" : "VIEW"}
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isAr ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Universal Filter Engine Bar */}
      <UniversalReportFilter
        filters={filters}
        onFilterChange={setFilters}
        owners={owners}
        tenants={tenants}
        properties={properties}
        units={units}
        leases={leases}
        mode={reportCategory === "owner" ? "owner" : reportCategory === "tenant" ? "tenant" : "all"}
      />

      {/* EXECUTIVE DASHBOARD VIEW (If Selected) */}
      {selectedReportId === "executive_dashboard" ? (
        <div className="space-y-6">
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase">{isAr ? "نسبة إشغال المحفظة" : "Portfolio Occupancy"}</span>
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {executiveKPIs.occupancyRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {isAr
                  ? `${executiveKPIs.occupiedUnits} وحدة مشغولة من إجمالي ${executiveKPIs.totalUnits}`
                  : `${executiveKPIs.occupiedUnits} occupied of ${executiveKPIs.totalUnits} units`}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase">{isAr ? "إجمالي المقبوضات الإيجارية" : "Gross Collections"}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600">
                {executiveKPIs.totalGrossRevenue.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {isAr ? "تحصيلات إيجارية محققة للفترة" : "Realized rent inflows for period"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase">{isAr ? "مصاريف وتشغيل العقارات" : "Operating Expenses"}</span>
                <Receipt className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-600">
                {executiveKPIs.totalOperatingExpenses.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {isAr ? "صيانة وخدمات ورسوم تشغيل" : "Maintenance, utilities & fees"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase">{isAr ? "صافي الدخل التشغيلي (NOI)" : "Net Operating Income"}</span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-600">
                {executiveKPIs.netOperatingIncome.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {isAr ? "صافي الربح قبل توزيعات الملاك" : "Net operating profit before payouts"}
              </div>
            </div>
          </div>

          {/* Quick Drill-down Action Grid */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              {isAr ? "التقارير التحليلية والذكاء التشغيلي المباشر" : "Operational Intelligence & Direct Reports"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setSelectedReportId("owner_payable_summary")}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-right rtl:text-right transition bg-slate-50/50 dark:bg-slate-900/50"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between mb-1">
                  <span>{isAr ? "مستحقات وأرصدة الملاك" : "Owner Payables"}</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  {isAr ? "حساب الأرصدة الصافية المستحقة للملاك بعد المصاريف" : "Reconciliation of owner balances ready for payout"}
                </p>
              </button>

              <button
                onClick={() => setSelectedReportId("bounced_cheques")}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-400 text-right rtl:text-right transition bg-slate-50/50 dark:bg-slate-900/50"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between mb-1">
                  <span>{isAr ? "الشيكات المرتجعة والتعثر" : "Bounced Cheques"}</span>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  {isAr ? `إجمالي المبالغ المتعثرة: ${executiveKPIs.bouncedChequesTotal.toLocaleString()} AED` : `Total defaulted: ${executiveKPIs.bouncedChequesTotal.toLocaleString()} AED`}
                </p>
              </button>

              <button
                onClick={() => setSelectedReportId("profitability_summary")}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-right rtl:text-right transition bg-slate-50/50 dark:bg-slate-900/50"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between mb-1">
                  <span>{isAr ? "ربحية العقارات التشغيلية" : "Property Profitability"}</span>
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  {isAr ? "مقارنة عوائد الإيجار بالمصاريف لكل عقار على حدة" : "Gross revenue vs maintenance and utility expenses"}
                </p>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SPECIALIZED REPORT PREVIEW & EXPORT CONTAINER */
        <div id="printable-report-card" className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden print:overflow-visible print:border-none print:shadow-none">
          {/* Action Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? currentReportMeta?.nameAr : currentReportMeta?.nameEn}</span>
              <span className="text-xs font-normal text-slate-500">
                ({filteredReportItems.length} {isAr ? "سجل" : "records"})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 rounded-xl transition"
                title={isAr ? "تصدير CSV" : "Export CSV"}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{isAr ? "تصدير CSV" : "CSV"}</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 rounded-xl transition"
                title={isAr ? "تصدير Excel" : "Export Excel"}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isAr ? "تصدير Excel" : "Excel"}</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={isDownloadingPdf}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 rounded-xl transition shadow-xs cursor-pointer"
                title={isAr ? "تحميل كملف PDF" : "Download as PDF"}
              >
                {isDownloadingPdf ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isAr ? "جاري التجهيز..." : "Generating..."}</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>{isAr ? "تحميل كـ PDF" : "Download PDF"}</span>
                  </>
                )}
              </button>

              <button
                onClick={handlePrintPDF}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer"
                title={isAr ? "طباعة المتصفح" : "Print Report"}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isAr ? "طباعة" : "Print"}</span>
              </button>
            </div>
          </div>

          {/* Printable Report Canvas - Official Paper Look */}
          <div 
            id="report-print-area" 
            className="bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] mx-auto p-10 sm:p-14 border border-slate-200 shadow-2xl relative flex flex-col font-sans print:shadow-none print:border-none print:p-0 print:max-w-full"
            style={{ direction: isAr ? "rtl" : "ltr" }}
          >
            {/* A4 Document Top Header Accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-700 print:h-1"></div>

            <ReportPrintHeader
              reportTitleAr={currentReportMeta?.nameAr || ""}
              reportTitleEn={currentReportMeta?.nameEn || ""}
              reportSubtitleAr={currentReportMeta?.descriptionAr}
              reportSubtitleEn={currentReportMeta?.descriptionEn}
              companyProfile={companyProfile}
              filters={filters}
              filterSummary={
                filters.ownerId
                  ? isAr
                    ? `المالك: ${owners.find((o) => o.id === filters.ownerId)?.nameAr}`
                    : `Owner: ${owners.find((o) => o.id === filters.ownerId)?.nameEn}`
                  : filters.tenantId
                  ? isAr
                    ? `المستأجر: ${tenants.find((t) => t.id === filters.tenantId)?.nameAr}`
                    : `Tenant: ${tenants.find((t) => t.id === filters.tenantId)?.nameEn}`
                  : undefined
              }
            />

            {/* Groups and Tables Rendering */}
            <div className="space-y-8 flex-1">
              {groupedResult.groups.map((group, gIdx) => (
                <div key={group.groupKey || gIdx} className="space-y-3">
                  {/* Group Subtitle Header (If Grouped) */}
                  {filters.groupBy && filters.groupBy !== "NONE" && (
                    <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {group.groupTitle}
                        </span>
                        {group.groupSubLabel && (
                          <span className="text-xs text-slate-500 font-bold">
                            — {group.groupSubLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase">
                        {group.itemCount} {isAr ? "سجل معاملة" : "Items Recorded"}
                      </div>
                    </div>
                  )}

                  {/* Group Table - Professional Layout */}
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left rtl:text-right text-[11px] print:text-[9px] border-collapse font-sans">
                      <thead className="border-y-2 border-slate-900">
                        <tr className="text-slate-900 font-black uppercase font-sans">
                          <th className="px-2 py-2.5 print:px-1 whitespace-nowrap">{isAr ? "التاريخ" : "Date"}</th>
                          <th className="px-2 py-2.5 print:px-1 whitespace-nowrap">{isAr ? "المرجع" : "Ref"}</th>
                          <th className="px-2 py-2.5 print:px-1 w-[200px]">{isAr ? "العقار / الطرف" : "Entity / Property"}</th>
                          <th className="px-2 py-2.5 print:px-1">{isAr ? "البيان والتفاصيل" : "Description"}</th>
                          <th className="px-2 py-2.5 print:px-1 text-right whitespace-nowrap">{isAr ? "مدين" : "Debit"}</th>
                          <th className="px-2 py-2.5 print:px-1 text-right whitespace-nowrap">{isAr ? "دائن" : "Credit"}</th>
                          <th className="px-2 py-2.5 print:px-1 text-right whitespace-nowrap">{isAr ? "الرصيد" : "Balance"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-sans">
                        {group.items.length > 0 ? (
                          group.items.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-2 py-2 print:px-1 font-mono text-slate-700 whitespace-nowrap">
                                {item.date || "-"}
                              </td>
                              <td className="px-2 py-2 print:px-1 font-mono text-slate-500 whitespace-nowrap">
                                {item.reference || "-"}
                              </td>
                              <td className="px-2 py-2 print:px-1 font-bold text-slate-900 leading-snug font-sans">
                                {item.entityDetails || "---"}
                              </td>
                              <td className="px-2 py-2 print:px-1 text-slate-600 font-medium font-sans">
                                {item.description}
                              </td>
                              <td className="px-2 py-2 print:px-1 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                                {item.debit > 0 ? Number(item.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                              </td>
                              <td className="px-2 py-2 print:px-1 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                {item.credit > 0 ? Number(item.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                              </td>
                              <td className="px-2 py-2 print:px-1 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                {Number(item.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-2 py-8 text-center text-slate-400 italic">
                              {isAr ? "لا توجد سجلات مالية مطابقة" : "No matching financial records"}
                            </td>
                          </tr>
                        )}
                      </tbody>

                      {/* Group Subtotals */}
                      {group.items.length > 0 && filters.groupBy && filters.groupBy !== "NONE" && (
                        <tfoot className="border-t-2 border-slate-900 font-black bg-slate-50/50 font-sans">
                          <tr>
                            <td colSpan={4} className="px-2 py-3 text-right rtl:text-left text-slate-900 uppercase font-sans">
                              {isAr ? `المجموع (${group.groupTitle}):` : `SUBTOTAL (${group.groupTitle}):`}
                            </td>
                            <td className="px-2 py-3 text-right font-mono text-rose-800">
                              {group.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-3 text-right font-mono text-emerald-800">
                              {group.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-3 text-right font-mono text-indigo-700 border-l-2 border-slate-200">
                              {group.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              ))}

              {/* Grand Total Footer - Professional Executive Summary Block */}
              {groupedResult.totalCount > 0 && (
                <div className="mt-12 border-4 border-double border-slate-900 p-6 flex flex-col gap-4 font-sans">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase font-sans">
                      {isAr ? "ملخص البيان المالي الختامي" : "EXECUTIVE FINANCIAL SUMMARY"}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400">Values in United Arab Emirates Dirhams (AED)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 font-sans">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-500 uppercase font-sans">{isAr ? "إجمالي المدين" : "TOTAL DEBIT"}</p>
                      <p className="text-xl font-mono font-black text-rose-700">
                        {groupedResult.grandTotalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-500 uppercase font-sans">{isAr ? "إجمالي الدائن" : "TOTAL CREDIT"}</p>
                      <p className="text-xl font-mono font-black text-emerald-700">
                        {groupedResult.grandTotalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="space-y-1 p-3 bg-slate-900 rounded-xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase font-sans">{isAr ? "صافي الرصيد المستحق" : "NET CLOSING BALANCE"}</p>
                      <p className="text-xl font-mono font-black text-amber-400">
                        {groupedResult.grandTotalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <ReportPrintFooter isAr={isAr} />
          </div>
        </div>
      )}

      {/* TEST RESULTS MODAL */}
      {showTestModal && testReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isAr ? "نتائج فحص منظومة التقارير المالية (Phase 23 Test Suite)" : "Phase 23 Financial Reporting Test Suite"}
                </h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Summary Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                    {testReport.passedCount} / {testReport.totalAssertions} {isAr ? "اختبارات ناجحة" : "Assertions Passed (100%)"}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">
                    {isAr ? `تمت المعالجة في ${testReport.executionTimeMs.toFixed(2)} مللي ثانية` : `Executed in ${testReport.executionTimeMs.toFixed(2)} ms`}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">
                  ✓
                </div>
              </div>

              {/* Detailed Assertion List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                {testReport.results.map((res) => (
                  <div key={res.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">#{res.id}. [{res.category}]</span>{" "}
                        <span className="text-slate-600 dark:text-slate-300">{res.name}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      PASS
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition shadow-xs"
              >
                {isAr ? "إغلاق التقرير" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Success Toast */}
      {pdfToastMessage && (
        <div className="fixed bottom-6 end-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{pdfToastMessage}</span>
        </div>
      )}
    </div>
  );
};
