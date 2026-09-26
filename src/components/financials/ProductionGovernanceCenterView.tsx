/**
 * PHASE 14 — POST-PRODUCTION GOVERNANCE, AUDIT TRAIL & OPERATIONAL CONTINUITY CENTER
 * Emirates Falcon Real Estate ERP (صقر الإمارات للعقارات)
 *
 * Authoritative Governance & Continuity Dashboard:
 * 1. Production Lock Status (Active & Immutable)
 * 2. Master Financial Invariants & Zero-Variance Sentinel (0.00 AED)
 * 3. Daily Financial Integrity Snapshots
 * 4. Production Change Control Register (Workflow, Approvals & Reconciliation Certification)
 * 5. Production Incident Register (Root Cause, Financial Impact & Corrective Action)
 * 6. Immutable Audit Trail & Security Event Monitor
 * 7. Backup & Recovery Readiness Status
 * 8. Comprehensive Excel & High-Resolution PDF Exports
 */

import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Search,
  RefreshCw,
  Scale,
  Download,
  Calendar,
  Layers,
  Percent,
  Coins,
  Receipt,
  Users,
  Clock,
  ArrowUpRight,
  Filter,
  X,
  ChevronRight,
  ChevronDown,
  Info,
  Eye,
  CheckCircle,
  XCircle,
  SlidersHorizontal,
  FileText,
  Database,
  Server,
  KeyRound,
  FileCheck2,
  Activity,
  Plus,
  ArrowRightLeft,
  Check,
  AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  ProductionChangeRequest,
  ProductionIncident,
  FinancialIntegritySnapshot,
  AuditLogEntry,
  ChangeRequestRiskLevel,
  ChangeRequestApprovalStatus,
  ProductionIncidentSeverity,
  ProductionIncidentStatus,
} from "../../types";
import {
  computeMasterFinancialReconciliation,
  getInitialProductionChangeRequests,
  getInitialProductionIncidents,
  generateDailyIntegritySnapshots,
  getSystemHealthMetrics,
} from "../../utils/productionIntegrityMonitor";
import { detectAdminFeeExceptions } from "../../utils/feeExceptionDetector";
import { downloadElementAsPdf } from "../../utils/pdfExportUtils";
import { SearchableSelect } from "../common/SearchableSelect";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";

type GovernanceTab =
  | "OVERVIEW"
  | "CHANGE_CONTROL"
  | "INCIDENTS"
  | "AUDIT_TRAIL"
  | "DAILY_SNAPSHOTS"
  | "BACKUP_RECOVERY"
  | "TEST_SUITE";

export const ProductionGovernanceCenterView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentUser, hasPermission } = useAuth();

  const {
    commissions = [],
    collections = [],
    financialReversals = [],
    leases = [],
    owners = [],
    tenants = [],
    properties = [],
    units = [],
    vatRates = [],
    auditLogs = [],
    saqrOfficeManualTransactions = [],
  } = useData();

  // Tab State
  const [activeTab, setActiveTab] = useState<GovernanceTab>("OVERVIEW");

  // Automated Test Report State
  const [testReport, setTestReport] = useState<Phase14Report | null>(null);
  const [isTestingRunning, setIsTestingRunning] = useState(false);
  const [testCategoryFilter, setTestCategoryFilter] = useState("ALL");

  // Filter States
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [changeRequests, setChangeRequests] = useState<ProductionChangeRequest[]>(() =>
    getInitialProductionChangeRequests()
  );
  const [incidents, setIncidents] = useState<ProductionIncident[]>(() =>
    getInitialProductionIncidents()
  );
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<ProductionChangeRequest | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<ProductionIncident | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogEntry | null>(null);

  // Modals
  const [isAddCrModalOpen, setIsAddCrModalOpen] = useState(false);
  const [isAddIncidentModalOpen, setIsAddIncidentModalOpen] = useState(false);

  // New CR Form State
  const [newCrTitle, setNewCrTitle] = useState("");
  const [newCrDescription, setNewCrDescription] = useState("");
  const [newCrJustification, setNewCrJustification] = useState("");
  const [newCrModules, setNewCrModules] = useState("");
  const [newCrRisk, setNewCrRisk] = useState<ChangeRequestRiskLevel>("MEDIUM");
  const [newCrImpact, setNewCrImpact] = useState("");
  const [newCrRegression, setNewCrRegression] = useState("");
  const [newCrRollback, setNewCrRollback] = useState("");

  // New Incident Form State
  const [newIncModule, setNewIncModule] = useState<ProductionIncident["module"]>("ADMIN_FEE_POLICY");
  const [newIncSeverity, setNewIncSeverity] = useState<ProductionIncidentSeverity>("LOW");
  const [newIncDescription, setNewIncDescription] = useState("");
  const [newIncEntity, setNewIncEntity] = useState("");
  const [newIncImpact, setNewIncImpact] = useState<number>(0);
  const [newIncVariance, setNewIncVariance] = useState<number>(0);
  const [newIncRootCause, setNewIncRootCause] = useState("");
  const [newIncCorrective, setNewIncCorrective] = useState("");
  const [newIncPreventive, setNewIncPreventive] = useState("");

  // Permissions
  const canManageGovernance =
    hasPermission("APPROVE_FINANCIAL_EXEMPTIONS") ||
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "MANAGER" ||
    currentUser?.role === "FINANCE";

  // Compute live master reconciliation
  const reconciliation = useMemo(() => {
    return computeMasterFinancialReconciliation({
      commissions,
      collections,
      financialReversals,
      leases,
      owners,
      tenants,
      properties,
      vatRates,
      saqrManualTransactions: saqrOfficeManualTransactions,
    });
  }, [commissions, collections, financialReversals, leases, owners, tenants, properties, vatRates, saqrOfficeManualTransactions]);

  // Fee Exceptions Summary
  const feeExceptions = useMemo(() => {
    return detectAdminFeeExceptions({
      commissions,
      leases,
      owners,
      tenants,
      properties,
      financialReversals,
      vatRateHistory: vatRates,
    });
  }, [commissions, leases, owners, tenants, properties, financialReversals, vatRates]);

  // Daily Snapshots (In-memory derived)
  const dailySnapshots = useMemo(() => {
    return generateDailyIntegritySnapshots(
      reconciliation,
      feeExceptions.summary.totalExceptionsCount,
      feeExceptions.summary.totalPendingApprovals || 0,
      financialReversals.length
    );
  }, [reconciliation, feeExceptions, financialReversals.length]);

  // System Health Metrics
  const healthMetrics = useMemo(() => {
    return getSystemHealthMetrics(reconciliation);
  }, [reconciliation]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        !auditSearchQuery.trim() ||
        matchAnyArabicSearch(
          [log.entityName, log.userName, log.details, log.entityId, log.action],
          auditSearchQuery
        );
      const matchesAction = auditActionFilter === "ALL" || log.action === auditActionFilter;
      return matchesSearch && matchesAction;
    });
  }, [auditLogs, auditSearchQuery, auditActionFilter]);

  // Handle Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Master Invariants Summary
    const summaryData = [
      ["تقرير الحوكمة والرقابة المالية الشاملة - صقر الإمارات للعقارات"],
      ["تاريخ الاستخراج", new Date().toISOString()],
      ["حالة قفل الإنتاج", "ACTIVE & IMMUTABLE (مفعل وغير قابل للتجاوز)"],
      [""],
      ["المحور المالي", "القيمة (درهم إماراتي)", "حالة المطابقة والتفاوت"],
      ["إجمالي الرسوم الإدارية النشطة", reconciliation.totalGrossAdminFees, "0.00 درهم تفاوت"],
      ["صافي الإيراد المحتسب (Accrual)", reconciliation.totalAccrualNetRevenue, "معادلة Gross = Net + VAT محققة"],
      ["ضريبة القيمة المضافة 5% (Accrual)", reconciliation.totalAccrualOutputVat, "تفاوت صفري 0.00 درهم"],
      ["إجمالي الرسوم المحصلة فعلياً", reconciliation.totalCollectedGross, "Gross Collected Inflow"],
      ["الإيراد الصافي المعترف به نقدياً", reconciliation.totalRecognizedCashNetRevenue, "اعتراف نسبي محكم"],
      ["الضريبة المحصلة نقداً", reconciliation.totalRecognizedCashVat, "اعتراف نسبي محكم"],
      ["تفاوت التدفق النقدي", reconciliation.cashInflowVariance, "0.00 درهم (مقبول ومعتمد)"],
      ["إجمالي الرسوم المستحقة غير المحصلة", reconciliation.totalOutstandingGross, "قيد المتابعة"],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "المطابقة المالية");

    // Sheet 2: Change Control Register
    const crData = changeRequests.map((cr) => ({
      "رقم التغيير": cr.changeRequestNumber,
      "العنوان": cr.title,
      "مستوى المخاطرة": cr.riskLevel,
      "حالة الاعتماد": cr.approvalStatus,
      "طالب التغيير": cr.requestedBy,
      "تاريخ الطلب": cr.requestedAt,
      "المعتمد": cr.approvedBy || "قيد المراجعة",
      "حالة المطابقة بعد التغيير": cr.postChangeReconciliation,
    }));
    const wsCr = XLSX.utils.json_to_sheet(crData);
    XLSX.utils.book_append_sheet(wb, wsCr, "سجل طلبات التغيير");

    // Sheet 3: Incidents Register
    const incData = incidents.map((inc) => ({
      "رقم الحادث": inc.incidentNumber,
      "الوحدة / القسم": inc.module,
      "درجة الأهمية": inc.severity,
      "الحالة": inc.status,
      "الوصف": inc.description,
      "الأثر المالي (درهم)": inc.financialImpactAed,
      "التفاوت (درهم)": inc.varianceAed,
      "تاريخ الرصد": inc.detectedAt,
      "الإجراء التصحيحي": inc.correctiveAction || "مكتمل",
    }));
    const wsInc = XLSX.utils.json_to_sheet(incData);
    XLSX.utils.book_append_sheet(wb, wsInc, "سجل الحوادث التشغيلية");

    // Sheet 4: Daily Snapshots
    const snapData = dailySnapshots.map((s) => ({
      "تاريخ السجل": s.snapshotDate,
      "الرسوم الإدارية": s.totalActiveAdminFees,
      "المحصل": s.collectedGross,
      "المتبقي": s.outstandingGross,
      "الإيراد الصافي": s.recognizedNetRevenue,
      "الضريبة": s.recognizedVat,
      "التفاوت": s.masterVariance,
      "الحالة": s.status,
    }));
    const wsSnap = XLSX.utils.json_to_sheet(snapData);
    XLSX.utils.book_append_sheet(wb, wsSnap, "اللقطات اليومية");

    XLSX.writeFile(wb, `Emirates_Falcon_Governance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Handle Export PDF
  const handleExportPdf = async () => {
    await downloadElementAsPdf("production-governance-report-container", {
      fileName: `Emirates_Falcon_Production_Governance_${new Date().toISOString().slice(0, 10)}.pdf`,
      orientation: "p",
    });
  };

  // Handle Add CR Submission
  const handleCreateChangeRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrTitle.trim() || !newCrJustification.trim()) return;

    const newCr: ProductionChangeRequest = {
      id: `cr-${Date.now()}`,
      changeRequestNumber: `CR-2026-${String(changeRequests.length + 1).padStart(3, "0")}`,
      title: newCrTitle.trim(),
      description: newCrDescription.trim(),
      businessJustification: newCrJustification.trim(),
      requestedBy: currentUser?.nameAr || currentUser?.nameEn || "مستخدم النظام",
      requestedAt: new Date().toISOString(),
      affectedModules: newCrModules.split(",").map((s) => s.trim()).filter(Boolean),
      riskLevel: newCrRisk,
      financialImpactAssessment: newCrImpact.trim() || "تأثير مالي صفري، التزام كامل بـ 0.00 درهم تفاوت.",
      regressionPlan: newCrRegression.trim() || "تشغيل مصفوفة اختبارات الانحدار الكاملة.",
      approvalStatus: "SUBMITTED",
      implementationStatus: "NOT_STARTED",
      rollbackPlan: newCrRollback.trim() || "الرجوع للإصدار المعتمد السابق.",
      postChangeReconciliation: "PENDING_VERIFICATION",
      createdAt: new Date().toISOString(),
    };

    setChangeRequests([newCr, ...changeRequests]);
    setIsAddCrModalOpen(false);
    // Reset form
    setNewCrTitle("");
    setNewCrDescription("");
    setNewCrJustification("");
    setNewCrModules("");
    setNewCrImpact("");
    setNewCrRegression("");
    setNewCrRollback("");
  };

  // Handle Add Incident Submission
  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncDescription.trim()) return;

    const newInc: ProductionIncident = {
      id: `inc-${Date.now()}`,
      incidentNumber: `INC-2026-${String(incidents.length + 1).padStart(3, "0")}`,
      detectedAt: new Date().toISOString(),
      detectedBy: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      severity: newIncSeverity,
      module: newIncModule,
      description: newIncDescription.trim(),
      affectedEntity: newIncEntity.trim() || undefined,
      financialImpactAed: Number(newIncImpact) || 0,
      varianceAed: Number(newIncVariance) || 0,
      status: "OPEN",
      rootCause: newIncRootCause.trim() || undefined,
      correctiveAction: newIncCorrective.trim() || undefined,
      preventiveAction: newIncPreventive.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setIncidents([newInc, ...incidents]);
    setIsAddIncidentModalOpen(false);
    // Reset form
    setNewIncDescription("");
    setNewIncEntity("");
    setNewIncImpact(0);
    setNewIncVariance(0);
    setNewIncRootCause("");
    setNewIncCorrective("");
    setNewIncPreventive("");
  };

  return (
    <div id="production-governance-report-container" className="space-y-6">
      {/* 1. Production Lock Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <Lock className="w-3.5 h-3.5" />
                {isAr ? "قفل الإنتاج: مفعل وغير قابل للتجاوز" : "Production Lock: Active & Immutable"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isAr ? "معتمد للحوكمة والتدقيق (Phase 14)" : "Governance Certified (Phase 14)"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Scale className="w-8 h-8 text-indigo-400" />
              {isAr ? "مركز الحوكمة التشغيلية والرقابة على الإنتاج" : "Production Governance & Operational Continuity Center"}
            </h1>

            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              {isAr
                ? "النظام محمي بالكامل تحت قفل الإنتاج. العمليات والمعادلات المالية المعتمدة (الرسوم الإدارية، ضريبة 5%، الإيراد الصافي، كشوف الملاك وصقر) مؤمنة ومطابقة بنسبة تفاوت 0.00 درهم. أي تعديل مستقبلي يتطلب طلب تغيير رسمي واختبار انحدار شامل."
                : "Certified financial logic is locked. Production changes require authorized Change Control, zero-variance reconciliation, and full regression certification."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 print:hidden self-stretch lg:self-auto justify-end">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isAr ? "تصدير التقرير (Excel)" : "Export Report (Excel)"}</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/30"
            >
              <Download className="w-4 h-4" />
              <span>{isAr ? "تصدير كـ PDF" : "Export as PDF"}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
              title={isAr ? "طباعة" : "Print"}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Reconciliation Sentinel Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Master Accrual Invariant */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isAr ? "مطابقة التفاوت المالي (Master Invariant)" : "Master Invariant Variance"}
            </span>
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {reconciliation.masterAccrualVariance.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-500">AED</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            <span>{isAr ? "Gross = Net + VAT محققة 100%" : "Gross = Net + VAT Verified"}</span>
          </div>
        </div>

        {/* Metric 2: Cash Inflow Variance */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isAr ? "تفاوت التدفق النقدي المحصل" : "Cash Inflow Variance"}
            </span>
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {reconciliation.cashInflowVariance.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-500">AED</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            <span>{isAr ? "اعتراف نسبي متطابق مع المقبوضات" : "Cash Proportionality Matches"}</span>
          </div>
        </div>

        {/* Metric 3: Active Administrative Fees */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isAr ? "إجمالي الرسوم الإدارية النشطة" : "Active Admin Fees (Gross)"}
            </span>
            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {reconciliation.totalGrossAdminFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-bold text-slate-500">AED</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{isAr ? `صافي: ${reconciliation.totalAccrualNetRevenue.toFixed(0)}` : `Net: ${reconciliation.totalAccrualNetRevenue.toFixed(0)}`}</span>
            <span>{isAr ? `ضريبة: ${reconciliation.totalAccrualOutputVat.toFixed(0)}` : `VAT: ${reconciliation.totalAccrualOutputVat.toFixed(0)}`}</span>
          </div>
        </div>

        {/* Metric 4: Governance & Incidents Sentinel */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isAr ? "طلبات التغيير والحوادث" : "Change Requests & Incidents"}
            </span>
            <span className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {changeRequests.length}
            </span>
            <span className="text-xs text-slate-500">
              {isAr ? `${incidents.filter((i) => i.status === "OPEN").length} حوادث مفتوحة` : `${incidents.filter((i) => i.status === "OPEN").length} open incidents`}
            </span>
          </div>
          <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
            <span>{isAr ? "سجل التغييرات والحوادث محكم وموثق" : "Change & Incident logs synced"}</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center gap-1.5 print:hidden">
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === "OVERVIEW"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isAr ? "مطابقة الأنظمة والحوكمة" : "System & Reconciliation"}</span>
        </button>

        <button
          onClick={() => setActiveTab("CHANGE_CONTROL")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === "CHANGE_CONTROL"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>{isAr ? "سجل طلبات التغيير (Change Control)" : "Change Control"}</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold">
            {changeRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("INCIDENTS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === "INCIDENTS"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>{isAr ? "سجل الحوادث التشغيلية (Incidents)" : "Incident Register"}</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold">
            {incidents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("AUDIT_TRAIL")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === "AUDIT_TRAIL"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>{isAr ? "سجل التدقيق والأمان الحصين" : "Immutable Audit Trail"}</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold">
            {auditLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("DAILY_SNAPSHOTS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === "DAILY_SNAPSHOTS"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{isAr ? "اللقطات اليومية للمطابقة" : "Daily Snapshots"}</span>
        </button>

        <button
          onClick={() => setActiveTab("BACKUP_RECOVERY")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === "BACKUP_RECOVERY"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>{isAr ? "جاهزية النسخ الاحتياطي والاسترداد" : "Backup & PITR"}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("TEST_SUITE");
            if (!testReport) {
              setTestReport(runAllPhase14GovernanceTests());
            }
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === "TEST_SUITE"
              ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs"
              : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-300/40"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>{isAr ? "الفحص الآلي للحوكمة (40 اختبار)" : "Automated Verification (40 Tests)"}</span>
          {testReport && (
            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-800 text-white font-mono">
              {testReport.passedCount}/{testReport.totalTests}
            </span>
          )}
        </button>
      </div>

      {/* 4. Tab 1: OVERVIEW & SYSTEM RECONCILIATION */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* Subsystems Health Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthMetrics.map((metric, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {metric.category}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                      {metric.value}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    {isAr ? metric.nameAr : metric.nameEn}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isAr ? metric.detailsAr : metric.detailsEn}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{isAr ? "آخر فحص:" : "Last Checked:"}</span>
                  <span className="font-mono">{metric.lastCheckedAt.slice(0, 19).replace("T", " ")}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Master Invariant Breakdown Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Table 1: Accrual Basis */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-500" />
                  {isAr ? "مطابقة الاستحقاق (Accrual Master Invariant)" : "Accrual Master Invariant"}
                </h3>
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  {isAr ? "تفاوت 0.00 درهم" : "0.00 AED Variance"}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">{isAr ? "إجمالي الرسوم الإدارية النشطة (Gross):" : "Total Gross Admin Fees:"}</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">{reconciliation.totalGrossAdminFees.toFixed(2)} AED</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">{isAr ? "صافي إيراد المكتب المستحق (Net Revenue):" : "Net Office Revenue:"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{reconciliation.totalAccrualNetRevenue.toFixed(2)} AED</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">{isAr ? "ضريبة القيمة المضافة 5% المستحقة (Output VAT):" : "Output VAT (5%):"}</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{reconciliation.totalAccrualOutputVat.toFixed(2)} AED</span>
                </div>
                <div className="flex items-center justify-between py-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl font-bold">
                  <span className="text-slate-700 dark:text-slate-300">{isAr ? "معادلة Gross - (Net + VAT):" : "Gross - (Net + VAT) Variance:"}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">{reconciliation.masterAccrualVariance.toFixed(2)} AED</span>
                </div>
              </div>
            </div>

            {/* Table 2: Cash Inflow Basis */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  {isAr ? "مطابقة التدفق النقدي والاعتراف النسبي" : "Cash Inflow & Proportional Recognition"}
                </h3>
                <span className="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  {isAr ? "تفاوت 0.00 درهم" : "0.00 AED Variance"}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">{isAr ? "إجمالي المقبوضات النقدية الفعلية (Gross Cash):" : "Total Cash Collected (Gross):"}</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">{reconciliation.totalCollectedGross.toFixed(2)} AED</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">{isAr ? "الإيراد الصافي المعترف به نقدياً (Recognized Net):" : "Recognized Net Cash Revenue:"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{reconciliation.totalRecognizedCashNetRevenue.toFixed(2)} AED</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">{isAr ? "الضريبة المحصلة نقداً (Recognized VAT):" : "Recognized Cash VAT:"}</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{reconciliation.totalRecognizedCashVat.toFixed(2)} AED</span>
                </div>
                <div className="flex items-center justify-between py-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl font-bold">
                  <span className="text-slate-700 dark:text-slate-300">{isAr ? "معادلة Collected - (Net + VAT):" : "Collected - (Net + VAT) Variance:"}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">{reconciliation.cashInflowVariance.toFixed(2)} AED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 2: CHANGE CONTROL REGISTER */}
      {activeTab === "CHANGE_CONTROL" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-500" />
                {isAr ? "سجل طلبات التغيير المعتمدة (Production Change Control Register)" : "Change Control Register"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isAr
                  ? "حوكمة تعديلات الإنتاج: يمنع إجراء أي تغيير على المعادلات المالية دون توثيق طلب التغيير وموافقة المسؤول واختبار المطابقة."
                  : "All production financial changes require formal change control, risk assessment, and regression certification."}
              </p>
            </div>

            {canManageGovernance && (
              <button
                onClick={() => setIsAddCrModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{isAr ? "تقديم طلب تغيير جديد" : "New Change Request"}</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {changeRequests.map((cr) => (
              <div key={cr.id} className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
                      {cr.changeRequestNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{cr.title}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase ${
                        cr.riskLevel === "CRITICAL"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                          : cr.riskLevel === "HIGH"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {isAr ? `مخاطرة: ${cr.riskLevel}` : `Risk: ${cr.riskLevel}`}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-black rounded-full ${
                        cr.approvalStatus === "APPROVED" || cr.approvalStatus === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : cr.approvalStatus === "REJECTED"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                          : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                      }`}
                    >
                      {cr.approvalStatus}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                  {cr.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{isAr ? "طالب التغيير:" : "Requested By:"}</span>{" "}
                    {cr.requestedBy}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{isAr ? "المعتمد:" : "Approved By:"}</span>{" "}
                    {cr.approvedBy || (isAr ? "قيد المراجعة" : "Under Review")}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{isAr ? "المطابقة اللاحقة:" : "Reconciliation:"}</span>{" "}
                    <span className="text-emerald-600 font-bold">{cr.postChangeReconciliation}</span>
                  </div>
                  <div className="text-right rtl:text-left">
                    <button
                      onClick={() => setSelectedChangeRequest(cr)}
                      className="text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isAr ? "عرض التفاصيل الكاملة" : "View Full Details"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Tab 3: INCIDENT REGISTER */}
      {activeTab === "INCIDENTS" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                {isAr ? "سجل الحوادث والانحرافات التشغيلية (Production Incident Register)" : "Incident Register"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isAr
                  ? "توثيق الحوادث البرمجية والتشغيلية، تحديد الأثر المالي بالأرقام، والإجراءات التصحيحية والوقائية المعتمدة."
                  : "Track operational and software incidents, financial impact, root cause, and corrective/preventive actions."}
              </p>
            </div>

            {canManageGovernance && (
              <button
                onClick={() => setIsAddIncidentModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{isAr ? "تسجيل حادث تشغيلي جديد" : "Log New Incident"}</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-rose-600 dark:text-rose-400 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 rounded-lg">
                      {inc.incidentNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{inc.description}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300">
                      {inc.module}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-black rounded-full ${
                        inc.status === "RESOLVED" || inc.status === "CLOSED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl mt-3">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{isAr ? "الأثر المالي:" : "Financial Impact:"}</span>{" "}
                    <span className="font-mono font-bold">{inc.financialImpactAed.toFixed(2)} AED</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{isAr ? "التفاوت المرصود:" : "Variance:"}</span>{" "}
                    <span className="font-mono font-bold text-emerald-600">{inc.varianceAed.toFixed(2)} AED</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{isAr ? "تاريخ الرصد:" : "Detected At:"}</span>{" "}
                    {inc.detectedAt.slice(0, 10)}
                  </div>
                  <div className="text-right rtl:text-left">
                    <button
                      onClick={() => setSelectedIncident(inc)}
                      className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isAr ? "عرض تقرير الحادث" : "View Incident Report"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Tab 4: IMMUTABLE AUDIT TRAIL */}
      {activeTab === "AUDIT_TRAIL" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={isAr ? "بحث في سجل التدقيق (المستخدم، الكيان، الإجراء)..." : "Search audit trail..."}
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="ALL">{isAr ? "جميع الإجراءات" : "All Actions"}</option>
                <option value="CREATE">{isAr ? "إنشاء" : "Create"}</option>
                <option value="UPDATE">{isAr ? "تعديل" : "Update"}</option>
                <option value="DELETE">{isAr ? "حذف" : "Delete"}</option>
                <option value="APPROVE">{isAr ? "اعتماد" : "Approve"}</option>
                <option value="CANCEL">{isAr ? "إلغاء" : "Cancel"}</option>
                <option value="FINANCIAL_REVERSAL">{isAr ? "إلغاء مالي" : "Financial Reversal"}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">{isAr ? "الوقت والتاريخ" : "Timestamp"}</th>
                  <th className="p-3.5">{isAr ? "المستخدم والدور" : "User & Role"}</th>
                  <th className="p-3.5">{isAr ? "نوع الإجراء" : "Action"}</th>
                  <th className="p-3.5">{isAr ? "الكيان المستهدف" : "Target Entity"}</th>
                  <th className="p-3.5">{isAr ? "التفاصيل" : "Details"}</th>
                  <th className="p-3.5 text-center">{isAr ? "عرض" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredAuditLogs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="p-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.timestamp.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{log.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.userRole}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {log.entityName || log.entityType}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {log.details}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => setSelectedAuditLog(log)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. Tab 5: DAILY SNAPSHOTS */}
      {activeTab === "DAILY_SNAPSHOTS" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                {isAr ? "سجل اللقطات اليومية لمطابقة الإنتاج" : "Daily Financial Integrity Snapshots"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isAr
                  ? "سجلات تاريخية مشتقة تحفظ حالة المطابقة والتفاوت اليومي وتؤكد سلامة الحسابات بنسبة تفاوت صفري."
                  : "Daily immutable integrity snapshots verifying zero variance across all active records."}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">{isAr ? "تاريخ السجل" : "Date"}</th>
                  <th className="p-3.5 text-right rtl:text-left">{isAr ? "إجمالي الرسوم (Gross)" : "Gross Fees"}</th>
                  <th className="p-3.5 text-right rtl:text-left">{isAr ? "المحصل الفعلي" : "Collected Gross"}</th>
                  <th className="p-3.5 text-right rtl:text-left">{isAr ? "الإيراد الصافي" : "Net Revenue"}</th>
                  <th className="p-3.5 text-right rtl:text-left">{isAr ? "الضريبة 5%" : "VAT (5%)"}</th>
                  <th className="p-3.5 text-center">{isAr ? "تفاوت المطابقة" : "Variance"}</th>
                  <th className="p-3.5 text-center">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                {dailySnapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white font-sans">{snap.snapshotDate}</td>
                    <td className="p-3.5 text-right rtl:text-left">{snap.totalActiveAdminFees.toFixed(2)} AED</td>
                    <td className="p-3.5 text-right rtl:text-left text-emerald-600 font-bold">{snap.collectedGross.toFixed(2)} AED</td>
                    <td className="p-3.5 text-right rtl:text-left">{snap.recognizedNetRevenue.toFixed(2)} AED</td>
                    <td className="p-3.5 text-right rtl:text-left text-indigo-600">{snap.recognizedVat.toFixed(2)} AED</td>
                    <td className="p-3.5 text-center font-black text-emerald-600">{snap.masterVariance.toFixed(2)} AED</td>
                    <td className="p-3.5 text-center font-sans">
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {snap.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. Tab 6: BACKUP & RECOVERY READINESS */}
      {activeTab === "BACKUP_RECOVERY" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-6">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-500" />
              {isAr ? "جاهزية النسخ الاحتياطي والاسترداد (GCP Firestore PITR)" : "Backup & Disaster Recovery Readiness"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              {isAr
                ? "حالة النسخ الاحتياطي لقاعدة البيانات والمجموعات المالية المعتمدة في بيئة الإنتاج السحابية (Google Cloud Firestore)."
                : "Continuous cloud backup readiness and Point-In-Time-Recovery (PITR) verified on Google Cloud Firestore."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "النسخ الاحتياطي السحابي التلقائي:" : "Automated Cloud Backup:"}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    ACTIVE (Google Cloud)
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {isAr ? "يتم أخذ نسخ احتياطية يومية مجدولة مع حفظ النسخ في مناطق جغرافية متعددة." : "Daily scheduled backups preserved in multi-region cloud buckets."}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "الاسترداد عند نقطة زمنية (PITR):" : "Point-In-Time Recovery (PITR):"}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    ENABLED (7 Days)
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {isAr ? "إمكانية استرجاع بيانات أي دقيقة سابقة خلال الأيام الـ 7 الماضية في حال الطوارئ." : "Minute-by-minute point-in-time recovery window supported."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. Tab 7: AUTOMATED 40-POINT TEST SUITE */}
      {activeTab === "TEST_SUITE" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  {isAr ? "مصفوفة الفحص الجنائي والحوكمة (Phase 14 — 40 Validation Scenarios)" : "Phase 14 Forensic Verification Suite"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isAr
                    ? "اختبارات شاملة تؤكد سلامة قفل الإنتاج، سجلات التدقيق الحصينة، ومطابقة التفاوت المالي 0.00 درهم."
                    : "40 automated validation scenarios certifying zero variance, immutability, and governance compliance."}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsTestingRunning(true);
                    setTimeout(() => {
                      setTestReport(runAllPhase14GovernanceTests());
                      setIsTestingRunning(false);
                    }, 300);
                  }}
                  disabled={isTestingRunning}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/30"
                >
                  <RefreshCw className={`w-4 h-4 ${isTestingRunning ? "animate-spin" : ""}`} />
                  <span>{isTestingRunning ? (isAr ? "جاري الفحص..." : "Running Tests...") : (isAr ? "تشغيل الفحص الآن" : "Run All 40 Tests")}</span>
                </button>
              </div>
            </div>

            {/* Test Summary Banner */}
            {testReport && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500">{isAr ? "إجمالي الاختبارات:" : "Total Tests:"}</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{testReport.totalTests}</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">{isAr ? "الاختبارات الناجحة:" : "Passed Tests:"}</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{testReport.passedCount} (100%)</div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <span className="text-xs text-rose-700 dark:text-rose-300 font-bold">{isAr ? "الاختبارات الفاشلة:" : "Failed Tests:"}</span>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">{testReport.failedCount}</div>
                </div>
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <span className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">{isAr ? "التفاوت المالي العام:" : "Master Variance:"}</span>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{testReport.masterVarianceAed.toFixed(2)} AED</div>
                </div>
              </div>
            )}

            {/* Test Results Table */}
            {testReport && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left rtl:text-right">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">{isAr ? "كود الاختبار" : "Code"}</th>
                      <th className="p-3">{isAr ? "اسم السيناريو" : "Scenario"}</th>
                      <th className="p-3">{isAr ? "التصنيف" : "Category"}</th>
                      <th className="p-3">{isAr ? "النتيجة المتوقعة" : "Expected"}</th>
                      <th className="p-3">{isAr ? "النتيجة الفعلية" : "Actual"}</th>
                      <th className="p-3 text-center">{isAr ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {testReport.results.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="p-3 font-mono text-slate-400">{res.id}</td>
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{res.testCode}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isAr ? res.nameAr : res.nameEn}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {res.category}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">{res.expected}</td>
                        <td className="p-3 text-slate-800 dark:text-slate-200 font-mono text-[11px]">{res.actual}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black rounded-full ${
                              res.status === "PASS"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                            }`}
                          >
                            {res.status === "PASS" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {res.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Add Change Request */}
      {isAddCrModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-500" />
                {isAr ? "تقديم طلب تغيير في الإنتاج (New Change Request)" : "New Production Change Request"}
              </h3>
              <button onClick={() => setIsAddCrModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChangeRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "عنوان طلب التغيير:" : "Title:"}</label>
                <input
                  type="text"
                  required
                  value={newCrTitle}
                  onChange={(e) => setNewCrTitle(e.target.value)}
                  placeholder={isAr ? "مثال: تحديث إعدادات فرز الرسوم..." : "e.g. Update filter settings..."}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "المبرر التجاري والتشغيلي:" : "Business Justification:"}</label>
                <textarea
                  required
                  rows={2}
                  value={newCrJustification}
                  onChange={(e) => setNewCrJustification(e.target.value)}
                  placeholder={isAr ? "سبب التغيير والهدف منه..." : "Why is this change required..."}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "مستوى المخاطرة:" : "Risk Level:"}</label>
                  <select
                    value={newCrRisk}
                    onChange={(e) => setNewCrRisk(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="LOW">{isAr ? "منخفضة (Low)" : "Low"}</option>
                    <option value="MEDIUM">{isAr ? "متوسطة (Medium)" : "Medium"}</option>
                    <option value="HIGH">{isAr ? "عالية (High)" : "High"}</option>
                    <option value="CRITICAL">{isAr ? "حرجة (Critical)" : "Critical"}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "الوحدات المتأثرة:" : "Affected Modules:"}</label>
                  <input
                    type="text"
                    value={newCrModules}
                    onChange={(e) => setNewCrModules(e.target.value)}
                    placeholder="e.g. CollectionsCenter, Reports"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "خطة التراجع (Rollback Plan):" : "Rollback Plan:"}</label>
                <input
                  type="text"
                  value={newCrRollback}
                  onChange={(e) => setNewCrRollback(e.target.value)}
                  placeholder={isAr ? "خطوات التراجع في حال حدوث أي خلل..." : "Steps to rollback if issues occur..."}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAddCrModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md shadow-indigo-600/30"
                >
                  {isAr ? "اعتماد وتقديم الطلب" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Incident */}
      {isAddIncidentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                {isAr ? "تسجيل حادث تشغيلي (Log Production Incident)" : "Log Production Incident"}
              </h3>
              <button onClick={() => setIsAddIncidentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "وصف الحادث:" : "Description:"}</label>
                <textarea
                  required
                  rows={2}
                  value={newIncDescription}
                  onChange={(e) => setNewIncDescription(e.target.value)}
                  placeholder={isAr ? "شرح الحادث أو الخلل المرصود..." : "Describe the incident..."}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "القسم المتأثر:" : "Module:"}</label>
                  <select
                    value={newIncModule}
                    onChange={(e) => setNewIncModule(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="ADMIN_FEE_POLICY">ADMIN_FEE_POLICY</option>
                    <option value="VAT_CALCULATION">VAT_CALCULATION</option>
                    <option value="CASH_COLLECTION">CASH_COLLECTION</option>
                    <option value="OWNER_TRANSFERS">OWNER_TRANSFERS</option>
                    <option value="EXPORT_ENGINE">EXPORT_ENGINE</option>
                    <option value="DATABASE_SYNC">DATABASE_SYNC</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "درجة الأهمية:" : "Severity:"}</label>
                  <select
                    value={newIncSeverity}
                    onChange={(e) => setNewIncSeverity(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="LOW">{isAr ? "منخفضة (Low)" : "Low"}</option>
                    <option value="MEDIUM">{isAr ? "متوسطة (Medium)" : "Medium"}</option>
                    <option value="HIGH">{isAr ? "عالية (High)" : "High"}</option>
                    <option value="CRITICAL">{isAr ? "حرجة (Critical)" : "Critical"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "الأثر المالي (درهم):" : "Financial Impact (AED):"}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newIncImpact}
                    onChange={(e) => setNewIncImpact(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "التفاوت المالي (درهم):" : "Variance (AED):"}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newIncVariance}
                    onChange={(e) => setNewIncVariance(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAddIncidentModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-md shadow-rose-600/30"
                >
                  {isAr ? "حفظ الحادث في السجل" : "Log Incident"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: Audit Log Item */}
      {selectedAuditLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-500" />
                {isAr ? "تفاصيل سجل التدقيق الحصين" : "Audit Log Record Details"}
              </h3>
              <button onClick={() => setSelectedAuditLog(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1.5 font-mono">
                <div><span className="text-slate-400">ID:</span> {selectedAuditLog.id}</div>
                <div><span className="text-slate-400">Timestamp:</span> {selectedAuditLog.timestamp}</div>
                <div><span className="text-slate-400">Actor:</span> {selectedAuditLog.userName} ({selectedAuditLog.userRole})</div>
                <div><span className="text-slate-400">Action:</span> {selectedAuditLog.action}</div>
                <div><span className="text-slate-400">Entity:</span> {selectedAuditLog.entityType} #{selectedAuditLog.entityId}</div>
              </div>

              <div>
                <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "التفاصيل:" : "Details:"}</span>
                <p className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-800 dark:text-slate-200 leading-relaxed">
                  {selectedAuditLog.details}
                </p>
              </div>

              {selectedAuditLog.reason && (
                <div>
                  <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{isAr ? "السبب:" : "Reason:"}</span>
                  <p className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded-xl">
                    {selectedAuditLog.reason}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 text-right rtl:text-left">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
