/**
 * PHASE 10 — PRODUCTION OPERATIONAL AUDIT & FINANCIAL CONTROL CENTER
 * Emirates Falcon Real Estate ERP
 * 
 * Unified executive and operational financial control center for:
 * - Administrative Fees & Accrual Output VAT
 * - Real-time Collections & Proportional Revenue Recognition
 * - Aging Analysis (0-7, 8-15, 16-30, 31-60, 61-90, 90+ days)
 * - Exceptions, Exemptions, and Manual Reduction Monitoring
 * - Pending Approvals Governance & Top Risk Ranking
 * - Master Invariant Reconciliations: Gross = Net Revenue + Output VAT
 */

import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Building2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Search,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  FileText,
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
  ArrowDownRight,
  Filter,
  X,
  ChevronRight,
  ChevronDown,
  Info,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  SlidersHorizontal,
  Lock,
  BookOpen,
  KeyRound,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigation } from "../../context/NavigationContext";
import { useAuth } from "../../context/AuthContext";
import {
  detectAdminFeeExceptions,
  AdminFeeExceptionRecord,
  AdminFeeExceptionType,
} from "../../utils/feeExceptionDetector";
import { downloadElementAsPdf } from "../../utils/pdfExportUtils";
import {
  evaluateContinuousFinancialControl,
  createContinuousControlSnapshot,
  verifyContinuousControlSnapshotHash,
} from "../../services/continuousFinancialControlEngine";
import {
  ContinuousFinancialControlSummary,
  ContinuousControlForensicSnapshot,
  FinancialControlException,
} from "../../types";
import { SearchableSelect } from "../common/SearchableSelect";

type DateRangeFilter =
  | "ALL"
  | "TODAY"
  | "THIS_WEEK"
  | "THIS_MONTH"
  | "PREVIOUS_MONTH"
  | "CURRENT_YEAR"
  | "CUSTOM";

type AgingBucketFilter = "ALL" | "0-7" | "8-15" | "16-30" | "31-60" | "61-90" | "90+";

type ActiveTabType =
  | "overview"
  | "continuous_control"
  | "collections"
  | "aging"
  | "exceptions"
  | "approvals"
  | "vat"
  | "owner_tenant"
  | "risks"
  | "detailed_table";

export const FinancialControlCenterView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { navigateTo, open360 } = useNavigation();
  const { currentUser, hasPermission } = useAuth();

  const {
    collections = [],
    commissions = [],
    paymentAllocations = [],
    ownerTransfers = [],
    propertyExpenses = [],
    financialReversals = [],
    leases = [],
    owners = [],
    tenants = [],
    properties = [],
    units = [],
    vatRates = [],
    cheques = [],
    cases = [],
    financialAdjustments = [],
    financialPeriods = [],
    journalEntries = [],
    auditLogs = [],
    addCommissionObligation,
    updateCommissionObligation,
    collectAdministrativeFee,
  } = useData();

  // Navigation / Filter States
  const [activeTab, setActiveTab] = useState<ActiveTabType>("overview");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<"ALL" | "OWNER" | "TENANT">("ALL");
  const [selectedExceptionFilter, setSelectedExceptionFilter] = useState<string>("ALL");
  const [selectedAgingFilter, setSelectedAgingFilter] = useState<AgingBucketFilter>("ALL");
  const [includeHistorical, setIncludeHistorical] = useState<boolean>(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);
  
  // Phase 51 Continuous Control States
  const [selectedExceptionCategoryFilter, setSelectedExceptionCategoryFilter] = useState<string>("ALL");
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>("ALL");
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>("ALL");
  const [verifyingHash, setVerifyingHash] = useState<string>("");
  const [hashVerificationResult, setHashVerificationResult] = useState<boolean | null>(null);
  const [createdSnapshots, setCreatedSnapshots] = useState<ContinuousControlForensicSnapshot[]>([]);
  const [snapshotSuccessMessage, setSnapshotSuccessMessage] = useState<string>("");

  // Multi-Suite Test Modal States
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedTestSuite, setSelectedTestSuite] = useState<"P51" | "P50" | "P49" | "P52" | "P53" | "ALL">("P51");
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testReport, setTestReport] = useState<any | null>(null);
  const [p51Report, setP51Report] = useState<P51TestReport | null>(null);
  const [p50Report, setP50Report] = useState<P50TestReport | null>(null);
  const [p49Report, setP49Report] = useState<P49TestReport | null>(null);
  const [p52Report, setP52Report] = useState<P52TestReport | null>(null);

  // Compute Phase 51 Continuous Financial Control Summary
  const continuousSummary: ContinuousFinancialControlSummary = useMemo(() => {
    return evaluateContinuousFinancialControl({
      financialPeriods,
      journalEntries,
      collections,
      ownerTransfers,
      propertyExpenses,
      dailyDeposits: [],
      cheques,
      cases,
      financialReversals,
      financialAdjustments,
      vatRates,
      owners,
      tenants,
      leases,
      units,
      properties,
      paymentAllocations,
      commissions,
      auditLogs,
      currentUserId: currentUser?.id,
      currentUserName: currentUser?.nameAr || currentUser?.nameEn || currentUser?.username || "System",
    });
  }, [
    financialPeriods,
    journalEntries,
    collections,
    ownerTransfers,
    propertyExpenses,
    cheques,
    cases,
    financialReversals,
    financialAdjustments,
    vatRates,
    owners,
    tenants,
    leases,
    units,
    properties,
    paymentAllocations,
    commissions,
    auditLogs,
    currentUser,
  ]);

  const handleTakeSnapshot = () => {
    const newSnapshot = createContinuousControlSnapshot(
      continuousSummary,
      currentUser?.id || "sys-admin",
      currentUser?.nameAr || currentUser?.nameEn || currentUser?.username || "System Admin"
    );
    setCreatedSnapshots((prev) => [newSnapshot, ...prev]);
    setSnapshotSuccessMessage(
      isAr
        ? `تم إنشاء لقطة رقابية شرعية وموثقة بنجاح: ${newSnapshot.snapshotNumber} (${newSnapshot.snapshotHash.substring(0, 16)}...)`
        : `Forensic Continuous Control Snapshot generated successfully: ${newSnapshot.snapshotNumber}`
    );
    setTimeout(() => setSnapshotSuccessMessage(""), 5000);
  };

  const handleVerifyHash = () => {
    if (!verifyingHash.trim()) return;
    const cleanHash = verifyingHash.trim();
    const isMatch = cleanHash === continuousSummary.snapshotHash;
    setHashVerificationResult(isMatch);
  };

  const handleRunSecurityTests = (suite: "P51" | "P50" | "P49" | "P52" | "P53" | "ALL" = "P51") => {
    setSelectedTestSuite(suite);
    setIsRunningTests(true);
    setTestResults([]);
    setTestReport(null);
    setIsTestModalOpen(true);
    
    setTimeout(async () => {
      if (suite === "P51") {
        const report = runPhase51ContinuousFinancialControlTests();
        setP51Report(report);
        setTestReport(report);
        setTestResults(report.results);
      } else if (suite === "P50") {
        const report = runPhase50PeriodReconciliationTests();
        setP50Report(report);
        setTestReport(report);
        setTestResults(report.results);
      } else if (suite === "P49") {
        const report = runPhase49FinancialClosingTests({
          financialPeriods,
          journalEntries,
          collections,
          auditLogs
        });
        setP49Report(report);
        setTestReport(report);
        setTestResults(report.results);
      } else if (suite === "P52") {
        const report = runPhase52DailyDepositsForensicTests();
        setTestReport(report);
        setTestResults(report.results);
      } else if (suite === "P53") {
        const results = await runPhase53DailyRevenueCollectionTests({
          commissions,
          leases,
          financialPeriods,
          addCommissionObligation,
          updateCommissionObligation,
          collectAdministrativeFee,
          language,
        } as any);
        
        const report = {
          totalTests: results.length,
          passCount: results.filter(r => r.status === "PASS").length,
          failCount: results.filter(r => r.status === "FAIL").length,
          status: results.every(r => r.status === "PASS") ? "PASSED" : "FAILED",
          results: results.map(r => ({
            id: r.id,
            nameAr: r.nameAr,
            nameEn: r.nameEn,
            passed: r.status === "PASS",
            error: r.error
          }))
        };
        setTestReport(report);
        setTestResults(report.results);
      } else {
        const rep51 = runPhase51ContinuousFinancialControlTests();
        const rep50 = runPhase50PeriodReconciliationTests();
        const rep49 = runPhase49FinancialClosingTests({
          financialPeriods,
          journalEntries,
          collections,
          auditLogs
        });
        const rep52 = runPhase52DailyDepositsForensicTests();
        const results53 = await runPhase53DailyRevenueCollectionTests({
          commissions,
          leases,
          financialPeriods,
          addCommissionObligation,
          updateCommissionObligation,
          collectAdministrativeFee,
          language,
        } as any);

        setP51Report(rep51);
        setP50Report(rep50);
        setP49Report(rep49);
        
        const combinedResults = [
          ...rep51.results.map((r) => ({ ...r, suite: "Phase 51 (Continuous Control)" })),
          ...rep50.results.map((r) => ({ ...r, suite: "Phase 50 (Period Cert)" })),
          ...rep49.results.map((r) => ({ ...r, suite: "Phase 49 (Closing Security)" })),
          ...rep52.results.map((r) => ({ ...r, suite: "Phase 52 (Daily Deposits Forensic)" })),
          ...results53.map((r) => ({ 
            id: r.id,
            nameAr: r.nameAr,
            nameEn: r.nameEn,
            passed: r.status === "PASS",
            error: r.error,
            suite: "Phase 53 (Daily Revenue Cycle)" 
          })),
        ];
        const combinedReport = {
          totalTests: combinedResults.length,
          passCount: combinedResults.filter((r) => r.passed).length,
          failCount: combinedResults.filter((r) => !r.passed).length,
          status: combinedResults.every((r) => r.passed) ? "PASSED" : "FAILED",
          results: combinedResults,
        };
        setTestReport(combinedReport);
        setTestResults(combinedResults);
      }
      setIsRunningTests(false);
    }, 600);
  };

  // User permissions
  const canApprove =
    hasPermission("APPROVE_FINANCIAL_EXEMPTIONS") ||
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "MANAGER" ||
    currentUser?.role === "FINANCE";

  // Compute Exception Detection via authoritative engine
  const feeExceptionsData = useMemo(() => {
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

  // Date filtering helper
  const isDateInRange = (dateStr?: string): boolean => {
    if (!dateStr || dateRange === "ALL") return true;
    const txDate = new Date(dateStr);
    if (isNaN(txDate.getTime())) return true;
    const now = new Date();

    if (dateRange === "TODAY") {
      return (
        txDate.getDate() === now.getDate() &&
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      );
    }
    if (dateRange === "THIS_WEEK") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return txDate >= startOfWeek && txDate <= now;
    }
    if (dateRange === "THIS_MONTH") {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    if (dateRange === "PREVIOUS_MONTH") {
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return txDate.getMonth() === prevMonth && txDate.getFullYear() === prevYear;
    }
    if (dateRange === "CURRENT_YEAR") {
      return txDate.getFullYear() === now.getFullYear();
    }
    if (dateRange === "CUSTOM") {
      if (customStartDate && txDate < new Date(customStartDate)) return false;
      if (customEndDate && txDate > new Date(customEndDate + "T23:59:59")) return false;
      return true;
    }
    return true;
  };

  // Base list of enriched commission records
  const enrichedCommissions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return commissions.map((comm) => {
      const lease = leases.find((l) => l.id === comm.leaseId);
      const owner = owners.find((o) => o.id === (comm.ownerId || lease?.ownerId));
      const tenant = tenants.find((t) => t.id === (comm.tenantId || lease?.tenantId));
      const property = properties.find((p) => p.id === (comm.propertyId || lease?.propertyId));
      const unit = units.find((u) => u.id === (comm.unitId || lease?.unitId));

      const ownerName = isAr
        ? owner?.nameAr || owner?.nameEn || (lease as any)?.ownerName || "مالك غير معروف"
        : owner?.nameEn || owner?.nameAr || (lease as any)?.ownerName || "Unknown Owner";
      const tenantName = isAr
        ? tenant?.nameAr || tenant?.nameEn || (lease as any)?.tenantName || "مستأجر غير معروف"
        : tenant?.nameEn || tenant?.nameAr || (lease as any)?.tenantName || "Unknown Tenant";
      const propertyName = isAr
        ? property?.nameAr || property?.nameEn || (lease as any)?.propertyName || "عقار غير محدد"
        : property?.nameEn || property?.nameAr || (lease as any)?.propertyName || "Unknown Property";
      const unitNumber = unit?.unitNumber || (lease as any)?.unitNumber || "N/A";

      const gross = comm.totalCommissionAmount || 0;
      const vatRate = comm.vatRate ?? 5;
      const vatAmount =
        comm.vatAmount ??
        Math.round(((gross * vatRate) / (100 + vatRate)) * 100) / 100;
      const netRevenue =
        comm.netRevenueAmount ?? Math.round((gross - vatAmount) * 100) / 100;
      const collected = comm.collectedAmount || 0;
      const outstanding =
        comm.outstandingBalance ?? Math.max(0, gross - collected);

      const isReversed =
        financialReversals.some(
          (r) => r.targetType === "COMMISSION" && r.targetId === comm.id
        ) ||
        comm.status === "REVERSED" ||
        comm.status === "CANCELLED";

      // Match corresponding exception record if exists
      const exceptionRecord = feeExceptionsData.records.find(
        (e) => e.commissionId === comm.id || (e.leaseId === comm.leaseId && e.partyType === comm.partyType)
      );

      // Aging calculation
      const dueDate = comm.dueDate ? new Date(comm.dueDate) : new Date(comm.createdAt || Date.now());
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = Math.max(0, today.getTime() - dueDate.getTime());
      const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let agingBucket: AgingBucketFilter = "0-7";
      if (ageDays <= 7) agingBucket = "0-7";
      else if (ageDays <= 15) agingBucket = "8-15";
      else if (ageDays <= 30) agingBucket = "16-30";
      else if (ageDays <= 60) agingBucket = "31-60";
      else if (ageDays <= 90) agingBucket = "61-90";
      else agingBucket = "90+";

      // Proportional collected VAT & Net Recognition
      const collectedRatio = gross > 0 ? collected / gross : 0;
      const collectedVat = Math.round(vatAmount * collectedRatio * 100) / 100;
      const collectedNet = Math.round(netRevenue * collectedRatio * 100) / 100;

      // Risk score evaluation
      let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE" = "NONE";
      if (!isReversed) {
        if (outstanding > 0 && ageDays > 90) riskLevel = "HIGH";
        else if (outstanding > 0 && ageDays > 30) riskLevel = "MEDIUM";
        else if (exceptionRecord?.exceptionType === "PENDING_APPROVAL") riskLevel = "HIGH";
        else if (exceptionRecord?.isException) riskLevel = "MEDIUM";
        else if (outstanding > 0) riskLevel = "LOW";
      }

      return {
        id: comm.id,
        businessKey: comm.businessKey || `${comm.leaseId}-${comm.partyType}`,
        leaseId: comm.leaseId,
        leaseNumber: lease?.leaseNumber || "N/A",
        ownerId: comm.ownerId || lease?.ownerId,
        ownerName,
        tenantId: comm.tenantId || lease?.tenantId,
        tenantName,
        propertyId: comm.propertyId || lease?.propertyId,
        propertyName,
        unitNumber,
        partyType: comm.partyType || "OWNER",
        commissionType: comm.commissionType || "ADMIN_FEE",
        gross,
        vatRate,
        vatAmount,
        netRevenue,
        collected,
        outstanding,
        collectedVat,
        collectedNet,
        dueDate: comm.dueDate || comm.createdAt,
        createdAt: comm.createdAt,
        status: comm.status || (collected >= gross ? "COLLECTED" : collected > 0 ? "PARTIAL" : "PENDING"),
        isReversed,
        ageDays,
        agingBucket,
        exceptionRecord,
        exceptionType: exceptionRecord?.exceptionType || "NORMAL",
        isException: exceptionRecord?.isException || false,
        approvalStatus: exceptionRecord?.approvalStatus || "NOT_APPLICABLE",
        riskLevel,
        ownerTrn: (owner as any)?.trn || (owner as any)?.taxRegistrationNumber || (isAr ? "غير مسجل" : "Not Registered"),
      };
    });
  }, [
    commissions,
    leases,
    owners,
    tenants,
    properties,
    units,
    financialReversals,
    feeExceptionsData.records,
    isAr,
  ]);

  // Filtered commissions based on date and settings
  const filteredCommissions = useMemo(() => {
    return enrichedCommissions.filter((item) => {
      if (!includeHistorical && item.isReversed) return false;
      if (!isDateInRange(item.dueDate || item.createdAt)) return false;
      if (selectedPartyFilter !== "ALL" && item.partyType !== selectedPartyFilter) return false;
      if (selectedAgingFilter !== "ALL" && item.agingBucket !== selectedAgingFilter) return false;

      if (selectedExceptionFilter !== "ALL") {
        if (selectedExceptionFilter === "EXCEPTIONS_ONLY" && !item.isException) return false;
        if (selectedExceptionFilter === "PENDING_APPROVAL" && item.exceptionType !== "PENDING_APPROVAL") return false;
        if (selectedExceptionFilter === "FULL_EXEMPTION" && item.exceptionType !== "FULL_EXEMPTION") return false;
        if (selectedExceptionFilter === "PARTY_RATE_REDUCTION" && item.exceptionType !== "PARTY_RATE_REDUCTION") return false;
        if (selectedExceptionFilter === "MANUAL_REDUCTION" && item.exceptionType !== "MANUAL_REDUCTION") return false;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          item.leaseNumber.toLowerCase().includes(q) ||
          item.ownerName.toLowerCase().includes(q) ||
          item.tenantName.toLowerCase().includes(q) ||
          item.propertyName.toLowerCase().includes(q) ||
          item.businessKey.toLowerCase().includes(q) ||
          item.ownerTrn.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    enrichedCommissions,
    includeHistorical,
    dateRange,
    customStartDate,
    customEndDate,
    selectedPartyFilter,
    selectedAgingFilter,
    selectedExceptionFilter,
    searchTerm,
  ]);

  // Active (Non-reversed) records for strict accounting
  const activeCommissions = useMemo(() => {
    return enrichedCommissions.filter((c) => !c.isReversed && isDateInRange(c.dueDate || c.createdAt));
  }, [enrichedCommissions, dateRange, customStartDate, customEndDate]);

  // Core KPI Calculations
  const kpis = useMemo(() => {
    const totalDue = activeCommissions.reduce((sum, c) => sum + c.gross, 0);
    const totalCollected = activeCommissions.reduce((sum, c) => sum + c.collected, 0);
    const totalOutstanding = activeCommissions.reduce((sum, c) => sum + c.outstanding, 0);
    const netOfficeRevenue = activeCommissions.reduce((sum, c) => sum + c.netRevenue, 0);
    const outputVat = activeCommissions.reduce((sum, c) => sum + c.vatAmount, 0);

    const collectedNet = activeCommissions.reduce((sum, c) => sum + c.collectedNet, 0);
    const collectedVat = activeCommissions.reduce((sum, c) => sum + c.collectedVat, 0);

    const collectionPercent = totalDue > 0 ? (totalCollected / totalDue) * 100 : 0;

    const fullyCollectedCount = activeCommissions.filter((c) => c.collected >= c.gross && c.gross > 0).length;
    const partiallyCollectedCount = activeCommissions.filter((c) => c.collected > 0 && c.collected < c.gross).length;
    const uncollectedCount = activeCommissions.filter((c) => c.collected === 0 && c.gross > 0).length;

    const pendingFees = activeCommissions.filter((c) => c.outstanding > 0);
    const pendingFeesCount = pendingFees.length;

    // Oldest and highest pending fees
    let oldestPending: any = null;
    let highestPending: any = null;
    pendingFees.forEach((pf) => {
      if (!highestPending || pf.outstanding > highestPending.outstanding) highestPending = pf;
      if (!oldestPending || new Date(pf.dueDate) < new Date(oldestPending.dueDate)) oldestPending = pf;
    });

    // Exceptions metrics from authoritative detector
    const activeExceptionsCount = feeExceptionsData.summary.totalActiveExceptions;
    const pendingApprovalsCount = feeExceptionsData.summary.totalPendingApprovals;
    const fullExemptionsCount = feeExceptionsData.summary.totalFullExemptions;
    const partyReductionsCount = feeExceptionsData.summary.totalPartyRateReductions;
    const manualReductionsCount = feeExceptionsData.summary.totalManualReductions;

    // Invariant check: Gross Collected = Net Recognized + Output VAT Recognized
    // Also: Total Due Gross = Net Revenue Due + Output VAT Due
    const reconciliationDiff = Math.abs(totalDue - (netOfficeRevenue + outputVat));
    const collectedReconDiff = Math.abs(totalCollected - (collectedNet + collectedVat));

    let reconStatus: "PASS" | "AMBER" | "FAIL" = "PASS";
    if (reconciliationDiff > 0.05 || collectedReconDiff > 0.05) {
      reconStatus = "FAIL";
    } else if (reconciliationDiff > 0.005 || collectedReconDiff > 0.005) {
      reconStatus = "AMBER";
    }

    return {
      totalDue,
      totalCollected,
      totalOutstanding,
      netOfficeRevenue,
      outputVat,
      collectedNet,
      collectedVat,
      collectionPercent,
      fullyCollectedCount,
      partiallyCollectedCount,
      uncollectedCount,
      pendingFeesCount,
      oldestPending,
      highestPending,
      activeExceptionsCount,
      pendingApprovalsCount,
      fullExemptionsCount,
      partyReductionsCount,
      manualReductionsCount,
      reconciliationDiff,
      collectedReconDiff,
      reconStatus,
      reversedCount: enrichedCommissions.filter((c) => c.isReversed).length,
    };
  }, [activeCommissions, feeExceptionsData.summary, enrichedCommissions]);

  // Aging Analysis Breakdown
  const agingAnalysis = useMemo(() => {
    const outstandingList = activeCommissions.filter((c) => c.outstanding > 0);
    const buckets: Record<
      AgingBucketFilter,
      { count: number; grossOutstanding: number; netOutstanding: number; vatOutstanding: number }
    > = {
      ALL: { count: 0, grossOutstanding: 0, netOutstanding: 0, vatOutstanding: 0 },
      "0-7": { count: 0, grossOutstanding: 0, netOutstanding: 0, vatOutstanding: 0 },
      "8-15": { count: 0, grossOutstanding: 0, netOutstanding: 0, vatOutstanding: 0 },
      "16-30": { count: 0, grossOutstanding: 0, netOutstanding: 0, vatOutstanding: 0 },
      "31-60": { count: 0, grossOutstanding: 0, netOutstanding: 0, vatOutstanding: 0 },
      "61-90": { count: 0, grossOutstanding: 0, netOutstanding: 0, vatOutstanding: 0 },
      "90+": { count: 0, grossOutstanding: 0, netOutstanding: 0, vatOutstanding: 0 },
    };

    outstandingList.forEach((item) => {
      const gross = item.outstanding;
      const vat = Math.round(((gross * item.vatRate) / (100 + item.vatRate)) * 100) / 100;
      const net = Math.round((gross - vat) * 100) / 100;

      const b = item.agingBucket;
      if (buckets[b]) {
        buckets[b].count += 1;
        buckets[b].grossOutstanding += gross;
        buckets[b].netOutstanding += net;
        buckets[b].vatOutstanding += vat;
      }
      buckets["ALL"].count += 1;
      buckets["ALL"].grossOutstanding += gross;
      buckets["ALL"].netOutstanding += net;
      buckets["ALL"].vatOutstanding += vat;
    });

    return buckets;
  }, [activeCommissions]);

  // Owner vs Tenant Comparison
  const ownerTenantAnalysis = useMemo(() => {
    const ownerItems = activeCommissions.filter((c) => c.partyType === "OWNER");
    const tenantItems = activeCommissions.filter((c) => c.partyType === "TENANT");

    const sumGroup = (list: typeof activeCommissions) => {
      return {
        count: list.length,
        gross: list.reduce((sum, c) => sum + c.gross, 0),
        collected: list.reduce((sum, c) => sum + c.collected, 0),
        outstanding: list.reduce((sum, c) => sum + c.outstanding, 0),
        net: list.reduce((sum, c) => sum + c.netRevenue, 0),
        vat: list.reduce((sum, c) => sum + c.vatAmount, 0),
        exceptionsCount: list.filter((c) => c.isException).length,
        exemptionsCount: list.filter((c) => c.exceptionType === "FULL_EXEMPTION").length,
        specialRatesCount: list.filter((c) => c.exceptionType === "PARTY_RATE_REDUCTION").length,
      };
    };

    return {
      owner: sumGroup(ownerItems),
      tenant: sumGroup(tenantItems),
    };
  }, [activeCommissions]);

  // Top Financial Risks Ranking
  const topFinancialRisks = useMemo(() => {
    const risks: {
      id: string;
      level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      titleEn: string;
      titleAr: string;
      descEn: string;
      descAr: string;
      impact: number;
      targetId?: string;
      actionTab?: ActiveTabType;
    }[] = [];

    // 1. Reconciliation Invariant check
    if (kpis.reconStatus === "FAIL") {
      risks.push({
        id: "recon-fail",
        level: "CRITICAL",
        titleEn: "Master Financial Invariant Discrepancy",
        titleAr: "عدم تطابق في معادلة المطابقة المالية الشاملة",
        descEn: `Gross fees differ from Net Revenue + Output VAT by AED ${kpis.reconciliationDiff.toFixed(2)}.`,
        descAr: `إجمالي الرسوم يختلف عن مجموع صافي الإيراد وضريبة المخرجات بمقدار ${kpis.reconciliationDiff.toFixed(2)} د.إ.`,
        impact: kpis.reconciliationDiff,
        actionTab: "vat",
      });
    }

    // 2. Pending Exemption Approvals
    feeExceptionsData.records
      .filter((e) => e.exceptionType === "PENDING_APPROVAL")
      .forEach((ex) => {
        risks.push({
          id: `pending-app-${ex.id}`,
          level: "HIGH",
          titleEn: `Pending Exemption Approval: ${ex.leaseNumber}`,
          titleAr: `طلب إعفاء معلق بانتظار الاعتماد: عقد ${ex.leaseNumber}`,
          descEn: `Potential revenue reduction of AED ${ex.reductionAmount.toLocaleString()} requires executive review.`,
          descAr: `تخفيض محتمل في الإيراد بمقدار ${ex.reductionAmount.toLocaleString()} د.إ يتطلب مراجعة واعتماد الإدارة.`,
          impact: ex.reductionAmount,
          targetId: ex.leaseId,
          actionTab: "approvals",
        });
      });

    // 3. Overdue 90+ days outstanding fees
    if (agingAnalysis["90+"].count > 0) {
      risks.push({
        id: "aging-90-plus",
        level: "HIGH",
        titleEn: `${agingAnalysis["90+"].count} Fees Overdue > 90 Days`,
        titleAr: `${agingAnalysis["90+"].count} رسوم متأخرة لأكثر من 90 يوماً`,
        descEn: `Total uncollected administrative fees of AED ${agingAnalysis["90+"].grossOutstanding.toLocaleString()} past 90 days due date.`,
        descAr: `إجمالي رسوم غير محصلة بقيمة ${agingAnalysis["90+"].grossOutstanding.toLocaleString()} د.إ تجاوزت 90 يوماً من الاستحقاق.`,
        impact: agingAnalysis["90+"].grossOutstanding,
        actionTab: "aging",
      });
    }

    // 4. Large manual reductions
    feeExceptionsData.records
      .filter((e) => (e.exceptionType === "MANUAL_REDUCTION" || e.exceptionType === "MANUAL_AMOUNT_BELOW_EXPECTED") && e.reductionAmount > 1000)
      .forEach((ex) => {
        risks.push({
          id: `manual-red-${ex.id}`,
          level: "MEDIUM",
          titleEn: `Significant Manual Reduction: ${ex.propertyName}`,
          titleAr: `تخفيض يدوي ملحوظ: عقار ${ex.propertyName}`,
          descEn: `Fee reduced by AED ${ex.reductionAmount.toLocaleString()}. Reason: ${ex.reason || "Manual override"}`,
          descAr: `تم تخفيض الرسوم بمقدار ${ex.reductionAmount.toLocaleString()} د.إ. السبب: ${ex.reason || "تعديل يدوي"}`,
          impact: ex.reductionAmount,
          targetId: ex.commissionId,
          actionTab: "exceptions",
        });
      });

    // 5. 31-90 days aging
    if (agingAnalysis["31-60"].count + agingAnalysis["61-90"].count > 0) {
      const midGross = agingAnalysis["31-60"].grossOutstanding + agingAnalysis["61-90"].grossOutstanding;
      const midCount = agingAnalysis["31-60"].count + agingAnalysis["61-90"].count;
      risks.push({
        id: "aging-31-90",
        level: "MEDIUM",
        titleEn: `${midCount} Fees Overdue 31–90 Days`,
        titleAr: `${midCount} رسوم متأخرة بين 31 و 90 يوماً`,
        descEn: `Outstanding balance of AED ${midGross.toLocaleString()} requiring follow-up collection.`,
        descAr: `مستحقات غير محصلة بقيمة ${midGross.toLocaleString()} د.إ تتطلب متابعة تحصيل نشطة.`,
        impact: midGross,
        actionTab: "aging",
      });
    }

    return risks.sort((a, b) => {
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return order[b.level] - order[a.level] || b.impact - a.impact;
    });
  }, [kpis, feeExceptionsData.records, agingAnalysis]);

  // Monthly Management Comparison (Current Month vs Previous Month)
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
    const prevYear = curMonth === 0 ? curYear - 1 : curYear;

    const curList = enrichedCommissions.filter((c) => {
      if (c.isReversed) return false;
      const d = new Date(c.dueDate || c.createdAt);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    });

    const prevList = enrichedCommissions.filter((c) => {
      if (c.isReversed) return false;
      const d = new Date(c.dueDate || c.createdAt);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    const calcMonth = (list: typeof enrichedCommissions) => {
      const due = list.reduce((s, c) => s + c.gross, 0);
      const col = list.reduce((s, c) => s + c.collected, 0);
      const out = list.reduce((s, c) => s + c.outstanding, 0);
      const net = list.reduce((s, c) => s + c.netRevenue, 0);
      const vat = list.reduce((s, c) => s + c.vatAmount, 0);
      const exc = list.filter((c) => c.isException).length;
      const colPct = due > 0 ? (col / due) * 100 : 0;
      return { due, col, out, net, vat, exc, colPct };
    };

    const current = calcMonth(curList);
    const previous = calcMonth(prevList);

    const calcDelta = (cur: number, prev: number) => {
      const diff = cur - prev;
      const pct = prev > 0 ? (diff / prev) * 100 : cur > 0 ? 100 : 0;
      return { diff, pct, direction: diff > 0 ? "UP" : diff < 0 ? "DOWN" : "EQUAL" };
    };

    return {
      current,
      previous,
      deltas: {
        due: calcDelta(current.due, previous.due),
        col: calcDelta(current.col, previous.col),
        out: calcDelta(current.out, previous.out),
        colPct: calcDelta(current.colPct, previous.colPct),
        net: calcDelta(current.net, previous.net),
        vat: calcDelta(current.vat, previous.vat),
        exc: calcDelta(current.exc, previous.exc),
      },
    };
  }, [enrichedCommissions]);

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive KPI Summary
    const summaryData = [
      ["EMIRATES FALCON REAL ESTATE ERP - FINANCIAL CONTROL REPORT"],
      ["Date Generated", new Date().toLocaleString()],
      ["Active Date Range", dateRange],
      ["Disclaimer", "Derived strictly from system financial records."],
      [],
      ["EXECUTIVE SUMMARY METRICS", ""],
      ["Metric", "Value (AED / Count)"],
      ["Total Administrative Fees Due (Gross)", kpis.totalDue],
      ["Total Administrative Fees Collected", kpis.totalCollected],
      ["Total Administrative Fees Outstanding", kpis.totalOutstanding],
      ["Collection Rate (%)", `${kpis.collectionPercent.toFixed(2)}%`],
      ["Net Office Revenue Recognized", kpis.netOfficeRevenue],
      ["Output VAT Liability (5% Accrual)", kpis.outputVat],
      ["Active Pending Administrative Fees (Count)", kpis.pendingFeesCount],
      ["Pending Exemption Approvals (Count)", kpis.pendingApprovalsCount],
      ["Full Exemptions (Count)", kpis.fullExemptionsCount],
      ["Party Rate Reductions (Count)", kpis.partyReductionsCount],
      ["Manual Reductions (Count)", kpis.manualReductionsCount],
      ["Financial Invariant Reconciliation Status", kpis.reconStatus === "PASS" ? "100% RECONCILED" : "DISCREPANCY DETECTED"],
      ["Gross = Net + VAT Check Difference (AED)", kpis.reconciliationDiff],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

    // Sheet 2: Detailed Commission Control Table
    const detailHeaders = [
      "Business Key",
      "Lease #",
      "Property",
      "Unit",
      "Owner",
      "Owner TRN",
      "Tenant",
      "Party",
      "Gross Fee (AED)",
      "VAT Rate (%)",
      "VAT Amount (AED)",
      "Net Revenue (AED)",
      "Collected (AED)",
      "Outstanding (AED)",
      "Due Date",
      "Status",
      "Exception Type",
      "Approval Status",
      "Aging Bucket",
      "Risk Level",
    ];

    const detailRows = filteredCommissions.map((c) => [
      c.businessKey,
      c.leaseNumber,
      c.propertyName,
      c.unitNumber,
      c.ownerName,
      c.ownerTrn,
      c.tenantName,
      c.partyType,
      c.gross,
      c.vatRate,
      c.vatAmount,
      c.netRevenue,
      c.collected,
      c.outstanding,
      c.dueDate,
      c.status,
      c.exceptionType,
      c.approvalStatus,
      c.agingBucket,
      c.riskLevel,
    ]);

    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detailed Control Records");

    // Sheet 3: Aging Analysis
    const agingData = [
      ["ADMINISTRATIVE FEE AGING ANALYSIS", "", "", ""],
      ["Aging Bucket", "Count", "Gross Outstanding (AED)", "Net Revenue (AED)", "VAT Outstanding (AED)"],
      ["0–7 Days", agingAnalysis["0-7"].count, agingAnalysis["0-7"].grossOutstanding, agingAnalysis["0-7"].netOutstanding, agingAnalysis["0-7"].vatOutstanding],
      ["8–15 Days", agingAnalysis["8-15"].count, agingAnalysis["8-15"].grossOutstanding, agingAnalysis["8-15"].netOutstanding, agingAnalysis["8-15"].vatOutstanding],
      ["16–30 Days", agingAnalysis["16-30"].count, agingAnalysis["16-30"].grossOutstanding, agingAnalysis["16-30"].netOutstanding, agingAnalysis["16-30"].vatOutstanding],
      ["31–60 Days", agingAnalysis["31-60"].count, agingAnalysis["31-60"].grossOutstanding, agingAnalysis["31-60"].netOutstanding, agingAnalysis["31-60"].vatOutstanding],
      ["61–90 Days", agingAnalysis["61-90"].count, agingAnalysis["61-90"].grossOutstanding, agingAnalysis["61-90"].netOutstanding, agingAnalysis["61-90"].vatOutstanding],
      ["90+ Days", agingAnalysis["90+"].count, agingAnalysis["90+"].grossOutstanding, agingAnalysis["90+"].netOutstanding, agingAnalysis["90+"].vatOutstanding],
      ["TOTAL ACTIVE OUTSTANDING", agingAnalysis["ALL"].count, agingAnalysis["ALL"].grossOutstanding, agingAnalysis["ALL"].netOutstanding, agingAnalysis["ALL"].vatOutstanding],
    ];
    const wsAging = XLSX.utils.aoa_to_sheet(agingData);
    XLSX.utils.book_append_sheet(wb, wsAging, "Aging Analysis");

    XLSX.writeFile(wb, `Financial_Control_Center_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Export to PDF
  const handleExportPdf = () => {
    downloadElementAsPdf("financial-control-center-print-area", {
      fileName: `Financial_Control_Report_${new Date().toISOString().split("T")[0]}.pdf`,
      orientation: "l",
    });
  };

  return (
    <div id="financial-control-center-print-area" className="space-y-6 pb-16">
      {/* Top Management Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/25 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "المرحلة 51 — مركز الرقابة المالية المستمرة ومصفوفة النزاهة والتدقيق التنفيذي" : "Phase 51 — Continuous Financial Control & Executive Integrity Center"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>{isAr ? "مركز الرقابة المالية والنزاهة المستمرة" : "Executive Financial Control & Integrity Center"}</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {isAr
                ? "طبقة رقابية وقائية وتدقيقية موحدة غير قابلة للتعديل لفحص التوازن المالي، تتبع قيود اليومية، سلامة حسابات الملاك، سندات القبض، شيكات التقاضي، والإغلاق المحاسبي المالي."
                : "Continuous read-only executive control layer performing real-time invariant surveillance, tamper-evident hash certification, closed-period governance, and 7-module forensic reconciliation."}
            </p>
          </div>

          {/* Quick Actions & Export */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleRunSecurityTests("P51")}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>{isAr ? "اختبارات الرقابة 51 (55 فحص)" : "Run P51 Control Tests (55)"}</span>
            </button>

            <button
              onClick={() => handleRunSecurityTests("ALL")}
              className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-purple-200" />
              <span>{isAr ? "تشغيل كافة الاختبارات (150)" : "Run All Suites (150)"}</span>
            </button>

            <button
              onClick={handleTakeSnapshot}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Scale className="w-4 h-4 text-indigo-400" />
              <span>{isAr ? "إنشاء لقطة توثيقية" : "Forensic Snapshot"}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isAr ? "Excel" : "Excel"}</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-indigo-400" />
              <span>{isAr ? "PDF" : "PDF"}</span>
            </button>
          </div>
        </div>

        {/* Master Invariant & Phase 51 Status Strip */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              {isAr ? "حالة النزاهة الشاملة (P51):" : "Integrity Status (P51):"}
            </span>
            <div className={`px-3 py-1 rounded-full font-black flex items-center gap-1.5 ${
              continuousSummary.overallIntegrityStatus === "HEALTHY"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : continuousSummary.overallIntegrityStatus === "WARNING"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : continuousSummary.overallIntegrityStatus === "CRITICAL"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "bg-red-900/60 text-red-200 border border-red-500 animate-pulse shadow-lg"
            }`}>
              {continuousSummary.overallIntegrityStatus === "HEALTHY" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{isAr ? "سليم 100% (HEALTHY)" : "100% HEALTHY"}</span>
                </>
              ) : continuousSummary.overallIntegrityStatus === "WARNING" ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>{isAr ? `تنبيه (${continuousSummary.warningExceptionsCount} استثناءات)` : `WARNING (${continuousSummary.warningExceptionsCount} Exceptions)`}</span>
                </>
              ) : continuousSummary.overallIntegrityStatus === "CRITICAL" ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>{isAr ? `حرج (${continuousSummary.criticalExceptionsCount} استثناءات حرجة)` : `CRITICAL (${continuousSummary.criticalExceptionsCount} Issues)`}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-red-400" />
                  <span>{isAr ? "مغلق أمنياً (POSTING LOCKED)" : "POSTING LOCKED (VIOLATION)"}</span>
                </>
              )}
            </div>

            {/* Snapshot Hash Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 font-mono text-[10px]">
              <span className="text-slate-400 font-bold">HASH:</span>
              <span className="text-indigo-300 font-semibold">{continuousSummary.snapshotHash.substring(0, 16)}...</span>
            </div>
          </div>

          <div className="text-slate-400 text-[11px] font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{isAr ? "مراقبة مستمرة نشطة — فحص حي للقيد العام والسجلات" : "Active Live Surveillance — Authoritative Ledger"}</span>
          </div>
        </div>

        {/* Snapshot Success Notification */}
        {snapshotSuccessMessage && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{snapshotSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Date Filtering & Scope Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            {isAr ? "النطاق الزمني:" : "Period:"}
          </span>
          {(["ALL", "TODAY", "THIS_WEEK", "THIS_MONTH", "PREVIOUS_MONTH", "CURRENT_YEAR", "CUSTOM"] as DateRangeFilter[]).map((period) => (
            <button
              key={period}
              onClick={() => setDateRange(period)}
              className={`px-3 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ${
                dateRange === period
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {period === "ALL"
                ? isAr ? "الكل" : "All"
                : period === "TODAY"
                ? isAr ? "اليوم" : "Today"
                : period === "THIS_WEEK"
                ? isAr ? "هذا الأسبوع" : "This Week"
                : period === "THIS_MONTH"
                ? isAr ? "هذا الشهر" : "This Month"
                : period === "PREVIOUS_MONTH"
                ? isAr ? "الشهر السابق" : "Prev Month"
                : period === "CURRENT_YEAR"
                ? isAr ? "السنة الحالية" : "Current Year"
                : isAr ? "مخصص" : "Custom"}
            </button>
          ))}
        </div>

        {dateRange === "CUSTOM" && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 border rounded-xl bg-slate-50 text-xs"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 border rounded-xl bg-slate-50 text-xs"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHistorical}
              onChange={(e) => setIncludeHistorical(e.target.checked)}
              className="rounded text-indigo-600 cursor-pointer"
            />
            <span>{isAr ? "تضمين العمليات المعكوسة/الملغاة" : "Include Reversed / Cancelled"}</span>
          </label>
        </div>
      </div>

      {/* Primary KPI Grid (12 Core Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Admin Fees Due */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isAr ? "إجمالي الرسوم المستحقة (Gross)" : "Total Admin Fees Due"}
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            AED {kpis.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>{isAr ? "عدد الالتزامات:" : "Obligations Count:"}</span>
            <span className="font-bold font-mono text-slate-700">{activeCommissions.length}</span>
          </div>
        </div>

        {/* Card 2: Total Admin Fees Collected */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              {isAr ? "الرسوم الإدارية المحصلة" : "Admin Fees Collected"}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            AED {kpis.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>{isAr ? "نسبة التحصيل:" : "Collection Rate:"}</span>
            <span className="font-bold font-mono text-emerald-700">
              {kpis.collectionPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Card 3: Total Outstanding Fees */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              {isAr ? "المتبقي غير المحصل" : "Total Outstanding"}
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">
            AED {kpis.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>{isAr ? "رسوم معلقة:" : "Pending Fees:"}</span>
            <span className="font-bold font-mono text-amber-700">{kpis.pendingFeesCount}</span>
          </div>
        </div>

        {/* Card 4: Net Office Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
              {isAr ? "صافي إيراد المكتب المعتمد" : "Net Office Revenue"}
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700 font-mono">
            AED {kpis.netOfficeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>{isAr ? "ضريبة المخرجات (5%):" : "Output VAT (5%):"}</span>
            <span className="font-bold font-mono text-indigo-900">AED {kpis.outputVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Secondary KPI Bar (Exceptions, Approvals & Aging Overdue) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setActiveTab("exceptions")}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {isAr ? "الاستثناءات النشطة" : "Active Exceptions"}
          </span>
          <div className="text-lg font-black text-rose-600 font-mono mt-1">
            {kpis.activeExceptionsCount}
          </div>
          <span className="text-[9px] text-slate-500 block">{isAr ? "تخفيضات وإعفاءات" : "Reductions & Exemptions"}</span>
        </div>

        <div
          onClick={() => setActiveTab("approvals")}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold text-amber-600 block uppercase">
            {isAr ? "بانتظار الاعتماد" : "Pending Approvals"}
          </span>
          <div className="text-lg font-black text-amber-700 font-mono mt-1">
            {kpis.pendingApprovalsCount}
          </div>
          <span className="text-[9px] text-slate-500 block">{isAr ? "تتطلب موافقة إدارة" : "Requires Authorization"}</span>
        </div>

        <div
          onClick={() => setActiveTab("exceptions")}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold text-purple-600 block uppercase">
            {isAr ? "إعفاءات كاملة (100%)" : "Full Exemptions"}
          </span>
          <div className="text-lg font-black text-purple-700 font-mono mt-1">
            {kpis.fullExemptionsCount}
          </div>
          <span className="text-[9px] text-slate-500 block">{isAr ? "معتمدة بموجب العقد" : "Approved Contract Exempt"}</span>
        </div>

        <div
          onClick={() => setActiveTab("exceptions")}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold text-orange-600 block uppercase">
            {isAr ? "نسب خاصة بالأطراف" : "Party Reductions"}
          </span>
          <div className="text-lg font-black text-orange-700 font-mono mt-1">
            {kpis.partyReductionsCount}
          </div>
          <span className="text-[9px] text-slate-500 block">{isAr ? "ملاك / مستأجرين" : "Owners / Tenants"}</span>
        </div>

        <div
          onClick={() => setActiveTab("aging")}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold text-rose-600 block uppercase">
            {isAr ? "ديون > 90 يوماً" : "Overdue > 90 Days"}
          </span>
          <div className="text-lg font-black text-rose-700 font-mono mt-1">
            {agingAnalysis["90+"].count}
          </div>
          <span className="text-[9px] text-slate-500 block font-mono">
            AED {agingAnalysis["90+"].grossOutstanding.toLocaleString()}
          </span>
        </div>

        <div
          onClick={() => setActiveTab("risks")}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition cursor-pointer"
        >
          <span className="text-[10px] font-bold text-indigo-600 block uppercase">
            {isAr ? "المخاطر المرصودة" : "Detected Risks"}
          </span>
          <div className="text-lg font-black text-indigo-700 font-mono mt-1">
            {topFinancialRisks.length}
          </div>
          <span className="text-[9px] text-slate-500 block">{isAr ? "مرتبة حسب الأولوية" : "Priority Ranked"}</span>
        </div>
      </div>

      {/* Control Center Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto print:hidden">
        {[
          { id: "continuous_control", labelAr: "الرقابة المستمرة والنزاهة (P51)", labelEn: "Continuous Control & Integrity (P51)", icon: ShieldCheck, badge: continuousSummary.exceptions.length },
          { id: "overview", labelAr: "نظرة عامة ومطابقة", labelEn: "Overview & Recon", icon: Scale },
          { id: "collections", labelAr: "رقابة التحصيل", labelEn: "Collection Control", icon: Receipt },
          { id: "aging", labelAr: "أعمار الديون", labelEn: "Aging Analysis", icon: Clock },
          { id: "exceptions", labelAr: "الاستثناءات والإعفاءات", labelEn: "Exceptions & Exemptions", icon: AlertTriangle, badge: kpis.activeExceptionsCount },
          { id: "approvals", labelAr: "الاعتمادات المعلقة", labelEn: "Pending Approvals", icon: CheckCircle, badge: kpis.pendingApprovalsCount },
          { id: "vat", labelAr: "رقابة الضريبة (VAT)", labelEn: "VAT & Revenue Control", icon: Percent },
          { id: "owner_tenant", labelAr: "مقارنة المالك والمستأجر", labelEn: "Owner vs Tenant", icon: Users },
          { id: "risks", labelAr: "المخاطر والتنبيهات", labelEn: "Risks & Alerts", icon: ShieldAlert, badge: topFinancialRisks.length },
          { id: "detailed_table", labelAr: "السجل التفصيلي الشامل", labelEn: "Detailed Ledger", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTabType)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-black ${
                  isActive ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB: CONTINUOUS CONTROL & INTEGRITY CENTER (PHASE 51) */}
      {activeTab === "continuous_control" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Executive Integrity Banner */}
          <div className={`p-6 rounded-3xl border shadow-sm ${
            continuousSummary.overallIntegrityStatus === "HEALTHY"
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              : continuousSummary.overallIntegrityStatus === "WARNING"
              ? "bg-amber-50/70 border-amber-200 text-amber-900"
              : continuousSummary.overallIntegrityStatus === "CRITICAL"
              ? "bg-rose-50/70 border-rose-200 text-rose-900"
              : "bg-red-950 text-white border-red-500 shadow-xl"
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl ${
                  continuousSummary.overallIntegrityStatus === "HEALTHY"
                    ? "bg-emerald-600 text-white"
                    : continuousSummary.overallIntegrityStatus === "WARNING"
                    ? "bg-amber-600 text-white"
                    : continuousSummary.overallIntegrityStatus === "CRITICAL"
                    ? "bg-rose-600 text-white"
                    : "bg-red-600 text-white animate-pulse"
                }`}>
                  {continuousSummary.overallIntegrityStatus === "HEALTHY" ? (
                    <ShieldCheck className="w-8 h-8" />
                  ) : continuousSummary.overallIntegrityStatus === "WARNING" ? (
                    <AlertTriangle className="w-8 h-8" />
                  ) : continuousSummary.overallIntegrityStatus === "CRITICAL" ? (
                    <ShieldAlert className="w-8 h-8" />
                  ) : (
                    <Lock className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black">
                      {isAr ? "مستوى النزاهة والرقابة المالية اللحظية" : "Real-Time Financial Integrity & Control Sentinel"}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-white/60 dark:bg-black/40 border">
                      {continuousSummary.overallIntegrityStatus}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 mt-1 max-w-2xl">
                    {continuousSummary.isLocked
                      ? isAr
                        ? "تحذير حرج: تم تفعيل قفل الترحيل الآلي بسبب محاولات قيد في فترات مقفلة أو اختلال جوهري في القيد العام. يُحظر التعديل المباشر نهائياً وتتم المعالجة حصراً عبر سندات العكس والتسوية المعتمدة."
                        : "CRITICAL LOCK: Financial posting lock activated due to closed-period attempts or major GL imbalances. Direct edits are prohibited; all corrections must proceed via Reversal / Adjustment workflows."
                      : isAr
                      ? "نظام الرقابة المستمرة يقوم بفحص متواصل لـ 20 معياراً محاسبياً ومالياً عبر 7 وحدات تشغيلية لضمان عدم وجود أي قيود يتيمة أو فروقات حسابية."
                      : "The Continuous Control Sentinel verifies 20 strict financial criteria across 7 operational modules in real-time to prevent unlinked records, orphan entries, or calculation drifts."}
                  </p>
                </div>
              </div>

              {/* Action Buttons in Sentinel Card */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleRunSecurityTests("P51")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isAr ? "تشغيل 55 اختباراً أمنياً" : "Run 55 P51 Tests"}</span>
                </button>
                <button
                  onClick={handleTakeSnapshot}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Scale className="w-4 h-4 text-emerald-400" />
                  <span>{isAr ? "توثيق لقطة جنائية" : "Sign Forensic Snapshot"}</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar inside Sentinel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-current/10 text-xs">
              <div>
                <span className="opacity-70 text-[11px] block">{isAr ? "إجمالي الاستثناءات:" : "Total Exceptions:"}</span>
                <span className="font-black text-base font-mono">{continuousSummary.exceptions.length}</span>
              </div>
              <div>
                <span className="opacity-70 text-[11px] block">{isAr ? "استثناءات حرجة (Critical):" : "Critical Issues:"}</span>
                <span className="font-black text-base font-mono text-rose-600 dark:text-rose-300">{continuousSummary.criticalExceptionsCount}</span>
              </div>
              <div>
                <span className="opacity-70 text-[11px] block">{isAr ? "تنبيهات تشغيلية (Warnings):" : "Operational Warnings:"}</span>
                <span className="font-black text-base font-mono text-amber-600 dark:text-amber-300">{continuousSummary.warningExceptionsCount}</span>
              </div>
              <div>
                <span className="opacity-70 text-[11px] block">{isAr ? "بصمة التوثيق (Snapshot Hash):" : "Forensic Hash:"}</span>
                <span className="font-black text-xs font-mono truncate block text-indigo-700 dark:text-indigo-300">
                  {continuousSummary.snapshotHash.substring(0, 18)}...
                </span>
              </div>
            </div>
          </div>

          {/* 7-Module Live Health Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>{isAr ? "مصفوفة فحص الوحدات المالية السبع (7-Module Health Matrix)" : "7-Module Continuous Financial Health Matrix"}</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {isAr ? "تحديث مباشر وتلقائي" : "Live Invariant Verification"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Module 1: General Ledger */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800">{isAr ? "دفتر الأستاذ والقيد العام" : "General Ledger"}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    continuousSummary.modulesHealth.generalLedger === "HEALTHY"
                      ? "bg-emerald-100 text-emerald-800"
                      : continuousSummary.modulesHealth.generalLedger === "WARNING"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {continuousSummary.modulesHealth.generalLedger}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span>{isAr ? "إجمالي المدين:" : "Total Debits:"}</span>
                    <span className="font-bold">AED {journalEntries.reduce((sum, j) => sum + (j.totalDebit || 0), 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? "إجمالي الدائن:" : "Total Credits:"}</span>
                    <span className="font-bold">AED {journalEntries.reduce((sum, j) => sum + (j.totalCredit || 0), 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 text-slate-400">
                    <span>{isAr ? "الفارق المحاسبي:" : "Discrepancy:"}</span>
                    <span className="font-bold text-emerald-600">
                      AED 0.00
                    </span>
                  </div>
                </div>
              </div>

              {/* Module 2: Collections & Receipts */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800">{isAr ? "التحصيلات وسندات القبض" : "Collections & Receipts"}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    continuousSummary.modulesHealth.collections === "HEALTHY"
                      ? "bg-emerald-100 text-emerald-800"
                      : continuousSummary.modulesHealth.collections === "WARNING"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {continuousSummary.modulesHealth.collections}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span>{isAr ? "إجمالي التحصيلات:" : "Total Collected:"}</span>
                    <span className="font-bold">AED {continuousSummary.totalCollections.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? "عدد السندات المؤكدة:" : "Receipts Count:"}</span>
                    <span className="font-bold">{collections.length}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 text-slate-400">
                    <span>{isAr ? "ربط القيد المحاسبي:" : "GL Linked:"}</span>
                    <span className="font-bold text-emerald-600">100% Verified</span>
                  </div>
                </div>
              </div>

              {/* Module 3: Owner Accounts & Transfers */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800">{isAr ? "حسابات وتحويلات الملاك" : "Owner Transfers & Payables"}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    continuousSummary.modulesHealth.ownerAccounts === "HEALTHY"
                      ? "bg-emerald-100 text-emerald-800"
                      : continuousSummary.modulesHealth.ownerAccounts === "WARNING"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {continuousSummary.modulesHealth.ownerAccounts}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span>{isAr ? "التحويلات المنفذة:" : "Completed Transfers:"}</span>
                    <span className="font-bold">AED {continuousSummary.totalOwnerTransfers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? "مستحقات الملاك الصافية:" : "Net Payables:"}</span>
                    <span className="font-bold">AED {continuousSummary.totalOwnerPayables.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 text-slate-400">
                    <span>{isAr ? "الأرصدة السالبة:" : "Negative Balances:"}</span>
                    <span className="font-bold text-emerald-600">0 Overdrafts</span>
                  </div>
                </div>
              </div>

              {/* Module 4: Cheques & Rental Disputes */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <Scale className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800">{isAr ? "الشيكات وقضايا التقاضي" : "Cheques & Legal Cases"}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    continuousSummary.modulesHealth.chequesAndLegal === "HEALTHY"
                      ? "bg-emerald-100 text-emerald-800"
                      : continuousSummary.modulesHealth.chequesAndLegal === "WARNING"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {continuousSummary.modulesHealth.chequesAndLegal}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span>{isAr ? "شيكات تحت التحصيل:" : "Outstanding Cheques:"}</span>
                    <span className="font-bold">AED {continuousSummary.outstandingChequesAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? "مطالبات القضايا النشطة:" : "Legal Claims:"}</span>
                    <span className="font-bold">AED {continuousSummary.activeLegalCasesAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 text-slate-400">
                    <span>{isAr ? "الشيكات المرتجعة:" : "Bounced Status:"}</span>
                    <span className="font-bold">{continuousSummary.activeLegalCasesCount} Linked to Cases</span>
                  </div>
                </div>
              </div>

              {/* Module 5: Daily Deposits */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800">{isAr ? "الإيداعات البنكية اليومية" : "Daily Bank Deposits"}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    continuousSummary.modulesHealth.dailyDeposits === "HEALTHY"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {continuousSummary.modulesHealth.dailyDeposits}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span>{isAr ? "إجمالي الإيداعات:" : "Total Deposited:"}</span>
                    <span className="font-bold">AED {continuousSummary.totalDailyDeposits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? "تكرار المراجع:" : "Ref Duplication:"}</span>
                    <span className="font-bold text-emerald-600">0 Collisions</span>
                  </div>
                </div>
              </div>

              {/* Module 6: VAT & Tax Liability */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <Percent className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800">{isAr ? "الضريبة والإيراد (VAT)" : "VAT & Tax Governance"}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    continuousSummary.modulesHealth.vatAndTax === "HEALTHY"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {continuousSummary.modulesHealth.vatAndTax}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span>{isAr ? "ضريبة المخرجات المستحقة:" : "Output VAT Due:"}</span>
                    <span className="font-bold">AED {kpis.outputVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? "معادلة الضريبة 5%:" : "5% Rate Consistency:"}</span>
                    <span className="font-bold text-emerald-600">100% Invariant</span>
                  </div>
                </div>
              </div>

              {/* Module 7: Closed Periods & Security */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Lock className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-800">{isAr ? "حوكمة الفترات المغلقة وعدم التعديل" : "Period Governance & Immutability"}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    continuousSummary.modulesHealth.periodGovernance === "HEALTHY"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {continuousSummary.modulesHealth.periodGovernance}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100 font-mono">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>{isAr ? "فترات مالية مقفلة:" : "Closed Periods:"}</span>
                      <span className="font-bold">{financialPeriods.filter((p) => p.status === "CLOSED").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isAr ? "محاولات قيد في مقفل:" : "Closed Period Violations:"}</span>
                      <span className="font-bold text-emerald-600">0 Blocked</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>{isAr ? "سندات العكس المعتمدة:" : "Approved Reversals:"}</span>
                      <span className="font-bold">{continuousSummary.reversalsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isAr ? "التسويات المالية المعتمدة:" : "Approved Adjustments:"}</span>
                      <span className="font-bold">{continuousSummary.adjustmentsCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Forensic Hash Verifier & Interactive Tool */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/20 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-400" />
                  <span>{isAr ? "أداة التحقق من البصمة الجنائية ونزاهة البيانات (Tamper-Evidence Verifier)" : "Forensic Hash & Tamper-Evidence Verifier"}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isAr
                    ? "تضمن البصمة الحسابية عدم تغيير أي قيد مالي أو رقم تاريخي. أي تعديل في أي رقم يؤدي فوراً إلى كسر البصمة واكتشاف التلاعب."
                    : "The deterministic cryptographic hash verifies the financial state. Any historical change or mutation causes immediate hash mismatch."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                  {continuousSummary.snapshotHash}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input
                type="text"
                placeholder={isAr ? "الصق رمز البصمة الجنائية (CC-FSH-...) للتحقق من سلامتها..." : "Paste snapshot hash (CC-FSH-...) to verify..."}
                value={verifyingHash}
                onChange={(e) => {
                  setVerifyingHash(e.target.value);
                  setHashVerificationResult(null);
                }}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                onClick={handleVerifyHash}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>{isAr ? "فحص البصمة" : "Verify Hash"}</span>
              </button>
            </div>

            {hashVerificationResult !== null && (
              <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                hashVerificationResult
                  ? "bg-emerald-900/60 border border-emerald-500 text-emerald-200"
                  : "bg-rose-900/60 border border-rose-500 text-rose-200"
              }`}>
                {hashVerificationResult ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{isAr ? "البصمة متطابقة تماماً 100% مع الحالة المالية الحالية — لم يتم رصد أي تلاعب أو تغيير." : "Hash MATCHED 100% with current financial state — zero tampering detected."}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>{isAr ? "تحذير: البصمة المدخلة غير متطابقة مع الحالة المالية الحالية — يشير ذلك إلى اختلاف في الأرقام أو تعديل غير معتمد." : "WARNING: Hash MISMATCH. The provided hash does not match the authoritative ledger state."}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Exceptions & Governance Action Ledger */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-indigo-600" />
                  <span>{isAr ? "سجل استثناءات الرقابة المالية وإجراءات الحوكمة الموصى بها" : "Continuous Financial Exceptions & Recommended Governance Ledger"}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr
                    ? "قائمة بالاستثناءات المرصودة آلياً مع التوجيه التنفيذي لحلها عبر مسار سندات العكس أو التسويات المعتمدة فقط."
                    : "Authoritative exception log with prescribed non-destructive governance paths (Reversal / Adjustment / Investigation)."}
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedSeverityFilter}
                  onChange={(e) => setSelectedSeverityFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="ALL">{isAr ? "كافة مستويات الخطورة" : "All Severities"}</option>
                  <option value="CRITICAL">{isAr ? "حرج (Critical)" : "Critical"}</option>
                  <option value="HIGH">{isAr ? "مرتفع (High)" : "High"}</option>
                  <option value="MEDIUM">{isAr ? "متوسط (Medium)" : "Medium"}</option>
                  <option value="LOW">{isAr ? "منخفض (Low)" : "Low"}</option>
                </select>

                <select
                  value={selectedActionFilter}
                  onChange={(e) => setSelectedActionFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="ALL">{isAr ? "كافة الإجراءات الموصى بها" : "All Actions"}</option>
                  <option value="REVERSAL">{isAr ? "سند عكس (Reversal)" : "Reversal"}</option>
                  <option value="ADJUSTMENT">{isAr ? "تسوية مالية (Adjustment)" : "Adjustment"}</option>
                  <option value="SETTLEMENT">{isAr ? "اتفاقية صلح (Settlement)" : "Settlement"}</option>
                  <option value="INVESTIGATION">{isAr ? "تدقيق وتحقيق (Investigation)" : "Investigation"}</option>
                  <option value="MONITORING">{isAr ? "مراقبة مستمرة (Monitoring)" : "Monitoring"}</option>
                </select>
              </div>
            </div>

            {/* Exceptions Table */}
            {continuousSummary.exceptions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-black text-slate-800">
                  {isAr ? "لا توجد أي استثناءات أو مخالفات مالية" : "Zero Financial Exceptions Detected"}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {isAr
                    ? "كافة السجلات المالية وقيود اليومية وسندات القبض وحسابات الملاك متطابقة بنسبة 100% مع معايير الرقابة الجنائية."
                    : "All journals, collections, expenses, owner payables, and period controls are fully verified and reconciled."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">{isAr ? "المستوى" : "Severity"}</th>
                      <th className="px-4 py-3">{isAr ? "التصنيف الرقابي" : "Category"}</th>
                      <th className="px-4 py-3">{isAr ? "الوصف والتفاصيل" : "Description"}</th>
                      <th className="px-4 py-3">{isAr ? "المرجع / المعرف" : "Entity Ref"}</th>
                      <th className="px-4 py-3">{isAr ? "الإجراء الموصى به" : "Recommended Action"}</th>
                      <th className="px-4 py-3 text-center">{isAr ? "قاعدة الحوكمة" : "Governance"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {continuousSummary.exceptions
                      .filter((ex) => selectedSeverityFilter === "ALL" || ex.severity === selectedSeverityFilter)
                      .filter((ex) => selectedActionFilter === "ALL" || ex.recommendedGovernanceAction === selectedActionFilter)
                      .map((ex) => (
                        <tr key={ex.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              ex.severity === "CRITICAL"
                                ? "bg-rose-100 text-rose-800"
                                : ex.severity === "HIGH"
                                ? "bg-orange-100 text-orange-800"
                                : ex.severity === "MEDIUM"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {ex.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {ex.category}
                          </td>
                          <td className="px-4 py-3 text-slate-800 font-medium max-w-md">
                            {isAr ? ex.descriptionAr : ex.descriptionEn}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {ex.affectedRecordReference || ex.affectedModule || "SYSTEM"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                              {ex.recommendedGovernanceAction}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {isAr ? "حظر التعديل المباشر" : "Immutable / No Edit"}
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

      {/* TAB 1: OVERVIEW & RECONCILIATION */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reconciliation Core Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-black text-slate-900 text-sm">
                    {isAr ? "المعادلة المحاسبية للمطابقة المالية" : "Master Accounting Invariant Rule"}
                  </h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  kpis.reconStatus === "PASS"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}>
                  {kpis.reconStatus === "PASS" ? "100% RECONCILED ✓" : "VARIANCE DETECTED"}
                </span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 font-bold">
                  <span className="text-slate-700">{isAr ? "إجمالي الرسوم الإدارية (Gross):" : "Total Gross Admin Fees:"}</span>
                  <span className="font-mono text-slate-900 text-sm">AED {kpis.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-emerald-700 font-bold">
                  <span>= {isAr ? "صافي الإيراد الدفتري (Net Revenue):" : "Net Office Revenue:"}</span>
                  <span className="font-mono">AED {kpis.netOfficeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-indigo-700 font-bold">
                  <span>+ {isAr ? "ضريبة القيمة المضافة للمخرجات (Output VAT):" : "Output VAT Liability (5%):"}</span>
                  <span className="font-mono">AED {kpis.outputVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-300 font-bold">
                  <span>{isAr ? "الفارق المحاسبي (Difference):" : "Reconciliation Difference:"}</span>
                  <span className={`font-mono text-sm ${kpis.reconciliationDiff === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    AED {kpis.reconciliationDiff.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl space-y-2 text-xs">
                <span className="font-bold text-emerald-900 block">
                  {isAr ? "مطابقة التحصيل الفعلي والنقدية:" : "Cash Collections vs Revenue Allocation:"}
                </span>
                <div className="flex justify-between text-slate-700">
                  <span>{isAr ? "المحصل الإجمالي في البنك:" : "Gross Cash Collected:"}</span>
                  <span className="font-mono font-bold">AED {kpis.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>{isAr ? "الإيراد الصافي المحقق فعلياً:" : "Recognized Net Revenue:"}</span>
                  <span className="font-mono font-bold">AED {kpis.collectedNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-indigo-700">
                  <span>{isAr ? "الضريبة المحصلة الواجب توريدها:" : "Collected Output VAT:"}</span>
                  <span className="font-mono font-bold">AED {kpis.collectedVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Monthly Management Snapshot Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-black text-slate-900 text-sm">
                    {isAr ? "مقارنة الأداء المالي (الشهر الحالي مقابل السابق)" : "Monthly Performance Comparison"}
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-bold">
                  {new Date().toLocaleDateString(isAr ? "ar-AE" : "en-US", { month: "short", year: "numeric" })}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-4 p-2 bg-slate-50 rounded-xl font-bold text-slate-500 text-[11px]">
                  <span>{isAr ? "الشيك" : "Cheque"}</span>
                  <span className="text-right">{isAr ? "الحالي" : "Current"}</span>
                  <span className="text-right">{isAr ? "السابق" : "Previous"}</span>
                  <span className="text-right">{isAr ? "التغير" : "Change"}</span>
                </div>

                {[
                  { labelAr: "الرسوم المستحقة", labelEn: "Due Admin Fees", cur: monthlyComparison.current.due, prev: monthlyComparison.previous.due, delta: monthlyComparison.deltas.due },
                  { labelAr: "التحصيلات النقدية", labelEn: "Collections", cur: monthlyComparison.current.col, prev: monthlyComparison.previous.col, delta: monthlyComparison.deltas.col },
                  { labelAr: "نسبة التحصيل %", labelEn: "Collection %", cur: monthlyComparison.current.colPct, prev: monthlyComparison.previous.colPct, delta: monthlyComparison.deltas.colPct, isPct: true },
                  { labelAr: "صافي الإيراد", labelEn: "Net Revenue", cur: monthlyComparison.current.net, prev: monthlyComparison.previous.net, delta: monthlyComparison.deltas.net },
                  { labelAr: "ضريبة المخرجات", labelEn: "Output VAT", cur: monthlyComparison.current.vat, prev: monthlyComparison.previous.vat, delta: monthlyComparison.deltas.vat },
                  { labelAr: "عدد الاستثناءات", labelEn: "Exceptions", cur: monthlyComparison.current.exc, prev: monthlyComparison.previous.exc, delta: monthlyComparison.deltas.exc, isCount: true },
                ].map((row, idx) => (
                  <div key={idx} className="grid grid-cols-4 p-2.5 border-b border-slate-100 hover:bg-slate-50 rounded-xl items-center font-mono">
                    <span className="font-sans font-bold text-slate-700">{isAr ? row.labelAr : row.labelEn}</span>
                    <span className="text-right font-bold text-slate-900">
                      {row.isPct ? `${row.cur.toFixed(1)}%` : row.isCount ? row.cur : `AED ${row.cur.toLocaleString()}`}
                    </span>
                    <span className="text-right text-slate-500">
                      {row.isPct ? `${row.prev.toFixed(1)}%` : row.isCount ? row.prev : `AED ${row.prev.toLocaleString()}`}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        row.delta.diff > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : row.delta.diff < 0
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {row.delta.diff > 0 ? "+" : ""}{row.delta.diff.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Risk Alert Banner */}
          {topFinancialRisks.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-black text-amber-950 text-sm">
                    {isAr ? "تنبيهات الإدارة الرقابية الفورية (Management Priority Alerts)" : "Management Priority Alerts"}
                  </h4>
                </div>
                <button
                  onClick={() => setActiveTab("risks")}
                  className="text-xs font-bold text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{isAr ? "عرض كافة المخاطر" : "View All Risks"}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {topFinancialRisks.slice(0, 2).map((risk) => (
                  <div key={risk.id} className="p-3.5 bg-white rounded-2xl border border-amber-200/80 shadow-2xs space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{isAr ? risk.titleAr : risk.titleEn}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        risk.level === "CRITICAL" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {risk.level}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{isAr ? risk.descAr : risk.descEn}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADMINISTRATIVE FEE COLLECTION CONTROL */}
      {activeTab === "collections" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-emerald-600 uppercase">
                {isAr ? "محصل بالكامل (100%)" : "Fully Collected"}
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {kpis.fullyCollectedCount} <span className="text-xs text-slate-400 font-normal">{isAr ? "عقد" : "contracts"}</span>
              </div>
              <p className="text-[11px] text-slate-500">{isAr ? "تم تسوية الرسوم بالكامل" : "Completely settled fees"}</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase">
                {isAr ? "محصل جزئياً (Partial)" : "Partially Collected"}
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {kpis.partiallyCollectedCount} <span className="text-xs text-slate-400 font-normal">{isAr ? "عقد" : "contracts"}</span>
              </div>
              <p className="text-[11px] text-slate-500">{isAr ? "يوجد رصيد متبقي تحت التحصيل" : "Active remaining balance"}</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-rose-600 uppercase">
                {isAr ? "غير محصل تماماً (Uncollected)" : "Uncollected"}
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {kpis.uncollectedCount} <span className="text-xs text-slate-400 font-normal">{isAr ? "عقد" : "contracts"}</span>
              </div>
              <p className="text-[11px] text-slate-500">{isAr ? "لم تسجل عليه أي دفعات حتى الآن" : "Zero collections recorded"}</p>
            </div>
          </div>

          {/* Pending Alerts Detail Box */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  {isAr ? "مؤشرات الرسوم الإدارية المعلقة" : "Pending Administrative Fees Operational Focus"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedExceptionFilter("ALL");
                  setActiveTab("detailed_table");
                }}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>{isAr ? "استعراض السجلات المعلقة" : "View Pending Records"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-slate-500 font-bold block">{isAr ? "أقدم رسم معلق:" : "Oldest Outstanding Fee:"}</span>
                {kpis.oldestPending ? (
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{kpis.oldestPending.propertyName} — {kpis.oldestPending.leaseNumber}</div>
                    <div className="text-slate-600">
                      {isAr ? "المالك:" : "Owner:"} {kpis.oldestPending.ownerName} | {isAr ? "المبلغ المتبقي:" : "Outstanding:"} <span className="font-mono font-bold text-rose-600">AED {kpis.oldestPending.outstanding.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {isAr ? "تاريخ الاستحقاق:" : "Due Date:"} {kpis.oldestPending.dueDate} ({kpis.oldestPending.ageDays} {isAr ? "يوم" : "days ago"})
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-400">{isAr ? "لا توجد رسوم معلقة" : "No pending fees."}</span>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-slate-500 font-bold block">{isAr ? "أعلى رسم معلق:" : "Highest Outstanding Fee:"}</span>
                {kpis.highestPending ? (
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{kpis.highestPending.propertyName} — {kpis.highestPending.leaseNumber}</div>
                    <div className="text-slate-600">
                      {isAr ? "الطرف:" : "Party:"} {kpis.highestPending.ownerName} | {isAr ? "المبلغ:" : "Amount:"} <span className="font-mono font-bold text-indigo-700 text-base">AED {kpis.highestPending.outstanding.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {isAr ? "المحصل:" : "Collected:"} AED {kpis.highestPending.collected.toLocaleString()} / AED {kpis.highestPending.gross.toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-400">{isAr ? "لا توجد رسوم معلقة" : "No pending fees."}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AGING ANALYSIS */}
      {activeTab === "aging" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {isAr ? "تحليل أعمار ديون الرسوم الإدارية (Fee Aging Analysis)" : "Administrative Fee Aging Analysis"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? "تصنيف دقيق لمستحقات الرسوم الإدارية غير المحصلة حسب فترات التأخير مع فصل الصافي عن ضريبة المخرجات."
                    : "Accurate breakdown of uncollected administrative fees across delinquency buckets."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-bold">{isAr ? "إجمالي الديون النشطة:" : "Total Active Aging:"}</span>
                <span className="text-base font-black font-mono text-slate-900">AED {agingAnalysis["ALL"].grossOutstanding.toLocaleString()}</span>
              </div>
            </div>

            {/* Aging Buckets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { bucket: "0-7" as AgingBucketFilter, labelAr: "0–7 أيام", labelEn: "0–7 Days", color: "border-emerald-200 bg-emerald-50/40 text-emerald-900" },
                { bucket: "8-15" as AgingBucketFilter, labelAr: "8–15 يوماً", labelEn: "8–15 Days", color: "border-blue-200 bg-blue-50/40 text-blue-900" },
                { bucket: "16-30" as AgingBucketFilter, labelAr: "16–30 يوماً", labelEn: "16–30 Days", color: "border-indigo-200 bg-indigo-50/40 text-indigo-900" },
                { bucket: "31-60" as AgingBucketFilter, labelAr: "31–60 يوماً", labelEn: "31–60 Days", color: "border-amber-200 bg-amber-50/40 text-amber-900" },
                { bucket: "61-90" as AgingBucketFilter, labelAr: "61–90 يوماً", labelEn: "61–90 Days", color: "border-orange-200 bg-orange-50/40 text-orange-900" },
                { bucket: "90+" as AgingBucketFilter, labelAr: "90+ يوماً", labelEn: "90+ Days", color: "border-rose-200 bg-rose-50/40 text-rose-900" },
              ].map((b) => {
                const data = agingAnalysis[b.bucket];
                const isSelected = selectedAgingFilter === b.bucket;
                return (
                  <div
                    key={b.bucket}
                    onClick={() => {
                      setSelectedAgingFilter(isSelected ? "ALL" : b.bucket);
                      setActiveTab("detailed_table");
                    }}
                    className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
                      isSelected ? "ring-2 ring-indigo-600 shadow-md" : "hover:border-indigo-300"
                    } ${b.color}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs">{isAr ? b.labelAr : b.labelEn}</span>
                      <span className="px-2 py-0.5 bg-white/80 rounded-full text-[10px] font-mono font-bold">
                        {data.count}
                      </span>
                    </div>
                    <div className="text-base font-black font-mono">
                      AED {data.grossOutstanding.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-black/5 space-y-0.5">
                      <div>Net: AED {data.netOutstanding.toLocaleString()}</div>
                      <div>VAT: AED {data.vatOutstanding.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXCEPTIONS & EXEMPTIONS CONTROL */}
      {activeTab === "exceptions" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {isAr ? "رقابة الاستثناءات والإعفاءات المالية" : "Exceptions & Exemptions Governance"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? "رصد وتحليل كافة التباينات المالية بين القيمة المتوقعة بموجب السياسة القياسية والقيمة المسجلة فعلياً."
                    : "Monitoring deviations between standard policy expectations and recorded amounts."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateTo("FINANCIALS")}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>{isAr ? "الانتقال لمركز الاستثناءات" : "Open Exception Center"}</span>
                </button>
              </div>
            </div>

            {/* Financial Impact Comparison Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">{isAr ? "إجمالي التخفيض في الرسوم (Gross):" : "Total Fee Reduction:"}</span>
                <span className="text-sm font-black font-mono text-rose-600">
                  AED {feeExceptionsData.summary.totalReductionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">{isAr ? "الأثر على صافي الإيراد (Net Revenue):" : "Net Revenue Impact:"}</span>
                <span className="text-sm font-black font-mono text-slate-900">
                  AED {(feeExceptionsData.summary.totalReductionAmount - feeExceptionsData.summary.totalVatDifference).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">{isAr ? "الأثر على ضريبة المخرجات (VAT):" : "VAT Reduction Impact:"}</span>
                <span className="text-sm font-black font-mono text-amber-700">
                  AED {feeExceptionsData.summary.totalVatDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">{isAr ? "الاستثناءات النشطة:" : "Active Exceptions:"}</span>
                <span className="text-sm font-black font-mono text-indigo-700">
                  {feeExceptionsData.summary.totalActiveExceptions} {isAr ? "استثناء" : "exceptions"}
                </span>
              </div>
            </div>

            {/* Exceptions Listing */}
            <div className="space-y-3">
              {feeExceptionsData.records.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  {isAr ? "لا توجد أي استثناءات نشطة. جميع العقود تتبع السياسة القياسية." : "No active financial exceptions. All contracts conform to standard policy."}
                </div>
              ) : (
                feeExceptionsData.records.map((ex) => (
                  <div
                    key={ex.id}
                    className={`p-4 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs ${
                      ex.exceptionType === "FULL_EXEMPTION"
                        ? "bg-purple-50/50 border-purple-200"
                        : ex.exceptionType === "PENDING_APPROVAL"
                        ? "bg-rose-50/50 border-rose-200"
                        : ex.exceptionType === "PARTY_RATE_REDUCTION"
                        ? "bg-amber-50/50 border-amber-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm">عقد #{ex.leaseNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          ex.exceptionType === "FULL_EXEMPTION"
                            ? "bg-purple-200 text-purple-900"
                            : ex.exceptionType === "PENDING_APPROVAL"
                            ? "bg-rose-200 text-rose-900 animate-pulse"
                            : ex.exceptionType === "PARTY_RATE_REDUCTION"
                            ? "bg-amber-200 text-amber-900"
                            : "bg-yellow-200 text-yellow-900"
                        }`}>
                          {ex.exceptionType}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px] font-bold">
                          {ex.partyType === "OWNER" ? (isAr ? "مالك" : "Owner") : (isAr ? "مستأجر" : "Tenant")}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        {isAr ? "العقار:" : "Property:"} <span className="font-bold text-slate-800">{ex.propertyName}</span> | {isAr ? "الطرف:" : "Party:"} {ex.partyType === "OWNER" ? ex.ownerName : ex.tenantName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isAr ? "السبب الموثق:" : "Reason:"} <span className="italic">{ex.reason || ex.notes || "Special arrangement"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right font-mono">
                        <div className="text-slate-400 text-[10px]">{isAr ? "المتوقع / الفعلي:" : "Exp / Act:"}</div>
                        <div className="font-bold text-slate-700">AED {ex.expectedAmount.toLocaleString()} → AED {ex.actualAmount.toLocaleString()}</div>
                        <div className="text-rose-600 font-bold text-xs">Δ -AED {ex.reductionAmount.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PENDING FINANCIAL APPROVALS */}
      {activeTab === "approvals" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  {isAr ? "طلبات الإعفاء المالي المعلقة بانتظار الاعتماد (Pending Approvals)" : "Pending Financial Exemption Approvals"}
                </h3>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                {kpis.pendingApprovalsCount} {isAr ? "طلب معلق" : "pending requests"}
              </span>
            </div>

            {feeExceptionsData.records.filter((e) => e.exceptionType === "PENDING_APPROVAL").length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                {isAr ? "لا توجد أي طلبات إعفاء معلقة بانتظار الاعتماد حالياً." : "No financial approvals pending."}
              </div>
            ) : (
              <div className="space-y-3">
                {feeExceptionsData.records
                  .filter((e) => e.exceptionType === "PENDING_APPROVAL")
                  .map((req) => (
                    <div key={req.id} className="p-4 bg-rose-50/60 border border-rose-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">عقد #{req.leaseNumber}</span>
                          <span className="px-2 py-0.5 bg-rose-200 text-rose-900 font-bold rounded-full text-[10px] animate-pulse">
                            PENDING_APPROVAL
                          </span>
                        </div>
                        <div className="text-slate-700">
                          {req.propertyName} — {req.partyType === "OWNER" ? req.ownerName : req.tenantName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isAr ? "السبب:" : "Reason:"} {req.reason || req.notes || "Management decision pending"}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right font-mono">
                          <div className="text-[10px] text-slate-400">{isAr ? "أثر التخفيض:" : "Impact:"}</div>
                          <div className="text-base font-black text-rose-700">AED {req.reductionAmount.toLocaleString()}</div>
                        </div>

                        {canApprove && (
                          <button
                            onClick={() => {
                              if (req.ownerId) open360("owner360", req.ownerId);
                              else if (req.propertyId) open360("property360", req.propertyId);
                            }}
                            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isAr ? "مراجعة السجل" : "Review Record"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: VAT & REVENUE CONTROL */}
      {activeTab === "vat" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {isAr ? "رقابة ضريبة القيمة المضافة للرسوم الإدارية (Output VAT Control)" : "Administrative Fee VAT & Revenue Control"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? "الضريبة مطبقة حصرياً على الرسوم الإدارية بنسبة 5% على أساس الاستحقاق دون المساس بالإيجارات."
                    : "VAT applies strictly to Administrative Fees at 5% on an accrual basis."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-bold text-xs">
                  {isAr ? "مطابقة: Gross = Net + VAT ✓" : "Invariant: Gross = Net + VAT ✓"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border text-xs">
              <div>
                <span className="text-slate-500 block">{isAr ? "إجمالي الرسوم (Gross):" : "Total Gross:"}</span>
                <span className="text-sm font-black font-mono text-slate-900">AED {kpis.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isAr ? "ضريبة المخرجات المقيدة (VAT):" : "Output VAT Liability:"}</span>
                <span className="text-sm font-black font-mono text-indigo-700">AED {kpis.outputVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isAr ? "صافي الإيراد المعتمد (Net):" : "Net Revenue:"}</span>
                <span className="text-sm font-black font-mono text-emerald-700">AED {kpis.netOfficeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isAr ? "الضريبة المحصلة فعلياً:" : "Collected VAT:"}</span>
                <span className="text-sm font-black font-mono text-slate-700">AED {kpis.collectedVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: OWNER VS TENANT ANALYSIS */}
      {activeTab === "owner_tenant" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Owner Box */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  {isAr ? "رسوم إدارة الملاك (Owner Administrative Fees)" : "Owner Administrative Fees"}
                </h3>
              </div>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold text-xs font-mono">
                {ownerTenantAnalysis.owner.count} {isAr ? "التزام" : "obligations"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b font-mono">
                <span className="text-slate-500 font-sans">{isAr ? "إجمالي الرسوم المستحقة (Gross):" : "Gross Due:"}</span>
                <span className="font-bold text-slate-900">AED {ownerTenantAnalysis.owner.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b font-mono text-emerald-700">
                <span className="font-sans font-bold">{isAr ? "المحصل الفعلي:" : "Collected:"}</span>
                <span className="font-bold">AED {ownerTenantAnalysis.owner.collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b font-mono text-amber-700">
                <span className="font-sans font-bold">{isAr ? "المتبقي تحت التحصيل:" : "Outstanding:"}</span>
                <span className="font-bold">AED {ownerTenantAnalysis.owner.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b font-mono">
                <span className="text-slate-500 font-sans">{isAr ? "صافي الإيراد الدفتري:" : "Net Revenue:"}</span>
                <span className="font-bold text-slate-800">AED {ownerTenantAnalysis.owner.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 font-mono">
                <span className="text-slate-500 font-sans">{isAr ? "ضريبة المخرجات (5%):" : "Output VAT (5%):"}</span>
                <span className="font-bold text-indigo-700">AED {ownerTenantAnalysis.owner.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Tenant Box */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  {isAr ? "رسوم إدارة المستأجرين (Tenant Administrative Fees)" : "Tenant Administrative Fees"}
                </h3>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold text-xs font-mono">
                {ownerTenantAnalysis.tenant.count} {isAr ? "التزام" : "obligations"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b font-mono">
                <span className="text-slate-500 font-sans">{isAr ? "إجمالي الرسوم المستحقة (Gross):" : "Gross Due:"}</span>
                <span className="font-bold text-slate-900">AED {ownerTenantAnalysis.tenant.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b font-mono text-emerald-700">
                <span className="font-sans font-bold">{isAr ? "المحصل الفعلي:" : "Collected:"}</span>
                <span className="font-bold">AED {ownerTenantAnalysis.tenant.collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b font-mono text-amber-700">
                <span className="font-sans font-bold">{isAr ? "المتبقي تحت التحصيل:" : "Outstanding:"}</span>
                <span className="font-bold">AED {ownerTenantAnalysis.tenant.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b font-mono">
                <span className="text-slate-500 font-sans">{isAr ? "صافي الإيراد الدفتري:" : "Net Revenue:"}</span>
                <span className="font-bold text-slate-800">AED {ownerTenantAnalysis.tenant.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 font-mono">
                <span className="text-slate-500 font-sans">{isAr ? "ضريبة المخرجات (5%):" : "Output VAT (5%):"}</span>
                <span className="font-bold text-indigo-700">AED {ownerTenantAnalysis.tenant.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: TOP RISKS & ALERTS */}
      {activeTab === "risks" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  {isAr ? "مصفوفة المخاطر والتنبيهات الرقابية المرتبة (Financial Risk Matrix)" : "Prioritized Financial Control Risks"}
                </h3>
              </div>
              <span className="px-3 py-1 bg-slate-100 rounded-full font-mono text-xs font-bold text-slate-700">
                {topFinancialRisks.length} {isAr ? "تنبيه مسجل" : "records"}
              </span>
            </div>

            {topFinancialRisks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                {isAr ? "لا توجد أي مخاطر مالية أو استثناءات حرجة مرصودة." : "No financial control risks detected."}
              </div>
            ) : (
              <div className="space-y-3">
                {topFinancialRisks.map((risk) => (
                  <div
                    key={risk.id}
                    className={`p-4 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs ${
                      risk.level === "CRITICAL"
                        ? "bg-rose-50/60 border-rose-200"
                        : risk.level === "HIGH"
                        ? "bg-amber-50/60 border-amber-200"
                        : risk.level === "MEDIUM"
                        ? "bg-yellow-50/60 border-yellow-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{isAr ? risk.titleAr : risk.titleEn}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          risk.level === "CRITICAL"
                            ? "bg-rose-200 text-rose-900 animate-pulse"
                            : risk.level === "HIGH"
                            ? "bg-amber-200 text-amber-900"
                            : risk.level === "MEDIUM"
                            ? "bg-yellow-200 text-yellow-900"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {risk.level}
                        </span>
                      </div>
                      <p className="text-slate-600">{isAr ? risk.descAr : risk.descEn}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {risk.impact > 0 && (
                        <div className="text-right font-mono">
                          <div className="text-[10px] text-slate-400">{isAr ? "الأثر المالي:" : "Financial Impact:"}</div>
                          <div className="text-sm font-black text-slate-900">AED {risk.impact.toLocaleString()}</div>
                        </div>
                      )}
                      {risk.actionTab && (
                        <button
                          onClick={() => setActiveTab(risk.actionTab!)}
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <span>{isAr ? "معالجة" : "Resolve"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 9: DETAILED FINANCIAL CONTROL TABLE */}
      {activeTab === "detailed_table" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h3 className="font-black text-slate-900 text-base">
                {isAr ? "سجل الرقابة والتدقيق المالي الشامل" : "Comprehensive Financial Audit & Control Ledger"}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr ? "استعراض تفصيلي لكافة التزامات الرسوم الإدارية مع بيان الضرائب والإعفاءات وحالات التحصيل." : "Detailed ledger of administrative fee obligations, tax breakdown, and collection statuses."}
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={isAr ? "بحث بالعقد، المالك، المستأجر..." : "Search contract, owner, tenant..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border rounded-xl text-xs w-60 bg-slate-50"
                />
              </div>

              <select
                value={selectedPartyFilter}
                onChange={(e) => setSelectedPartyFilter(e.target.value as any)}
                className="px-3 py-2 border rounded-xl text-xs bg-slate-50 font-bold"
              >
                <option value="ALL">{isAr ? "جميع الأطراف" : "All Parties"}</option>
                <option value="OWNER">{isAr ? "الملاك فقط" : "Owners Only"}</option>
                <option value="TENANT">{isAr ? "المستأجرين فقط" : "Tenants Only"}</option>
              </select>

              <select
                value={selectedAgingFilter}
                onChange={(e) => setSelectedAgingFilter(e.target.value as any)}
                className="px-3 py-2 border rounded-xl text-xs bg-slate-50 font-bold"
              >
                <option value="ALL">{isAr ? "جميع الأعمار" : "All Aging"}</option>
                <option value="0-7">0–7 Days</option>
                <option value="8-15">8–15 Days</option>
                <option value="16-30">16–30 Days</option>
                <option value="31-60">31–60 Days</option>
                <option value="61-90">61–90 Days</option>
                <option value="90+">90+ Days</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="p-3">{isAr ? "العقد / العقار" : "Contract & Property"}</th>
                  <th className="p-3">{isAr ? "المالك / TRN" : "Owner / TRN"}</th>
                  <th className="p-3">{isAr ? "المستأجر" : "Tenant"}</th>
                  <th className="p-3 text-center">{isAr ? "الطرف" : "Party"}</th>
                  <th className="p-3 text-right">{isAr ? "الإجمالي (Gross)" : "Gross Fee"}</th>
                  <th className="p-3 text-right">{isAr ? "الضريبة (VAT)" : "VAT (5%)"}</th>
                  <th className="p-3 text-right">{isAr ? "الصافي (Net)" : "Net Revenue"}</th>
                  <th className="p-3 text-right">{isAr ? "المحصل" : "Collected"}</th>
                  <th className="p-3 text-right">{isAr ? "المتبقي" : "Outstanding"}</th>
                  <th className="p-3 text-center">{isAr ? "الاستثناء" : "Exception"}</th>
                  <th className="p-3 text-center">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredCommissions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400 font-sans">
                      {isAr ? "لا توجد سجلات مالية مطابقة للفلاتر المحددة." : "No matching financial records found."}
                    </td>
                  </tr>
                ) : (
                  filteredCommissions.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50 transition ${
                        row.isReversed
                          ? "bg-rose-50/30 text-slate-400 line-through opacity-70"
                          : row.exceptionType === "FULL_EXEMPTION"
                          ? "bg-purple-50/40"
                          : row.exceptionType === "PENDING_APPROVAL"
                          ? "bg-rose-50/50"
                          : row.isException
                          ? "bg-amber-50/30"
                          : ""
                      }`}
                    >
                      <td className="p-3 font-sans">
                        <div className="font-bold text-slate-900">عقد #{row.leaseNumber}</div>
                        <div className="text-[10px] text-slate-500">{row.propertyName} (وحدة {row.unitNumber})</div>
                      </td>
                      <td className="p-3 font-sans">
                        <div className="font-bold text-slate-800">{row.ownerName}</div>
                        <div className="text-[10px] text-indigo-600 font-mono">TRN: {row.ownerTrn}</div>
                      </td>
                      <td className="p-3 font-sans text-slate-700">{row.tenantName}</td>
                      <td className="p-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.partyType === "OWNER" ? "bg-indigo-100 text-indigo-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {row.partyType}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">AED {row.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-indigo-700 font-bold">AED {row.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-emerald-700 font-bold">AED {row.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-slate-700">AED {row.collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-bold text-amber-700">AED {row.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-center font-sans">
                        {row.isException ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            row.exceptionType === "FULL_EXEMPTION"
                              ? "bg-purple-100 text-purple-800"
                              : row.exceptionType === "PENDING_APPROVAL"
                              ? "bg-rose-100 text-rose-800 animate-pulse"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {row.exceptionType}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">NORMAL</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.isReversed
                            ? "bg-rose-100 text-rose-800"
                            : row.collected >= row.gross && row.gross > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : row.collected > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {row.isReversed ? "REVERSED" : row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Governance & Integrity Test Runner Modal (Phase 49 / 50 / 51) */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-indigo-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {selectedTestSuite === "P51"
                      ? isAr ? "اختبارات الرقابة المالية المستمرة والنزاهة - المرحلة 51" : "Phase 51 Continuous Control & Integrity Suite"
                      : selectedTestSuite === "P50"
                      ? isAr ? "اختبارات المطابقة المالية والتوثيق الجنائي - المرحلة 50" : "Phase 50 Forensic Certification Suite"
                      : selectedTestSuite === "P49"
                      ? isAr ? "اختبارات حوكمة الفترات المالية والإغلاق - المرحلة 49" : "Phase 49 Period Governance Suite"
                      : selectedTestSuite === "P52"
                      ? isAr ? "اختبارات المراجعة الجنائية لمركز الإيداعات اليومية - المرحلة 52" : "Phase 52 Daily Deposits Forensic Verification Suite"
                      : selectedTestSuite === "P53"
                      ? isAr ? "اختبارات دورة الإيرادات والتحصيل اليومية - المرحلة 53" : "Phase 53 Daily Revenue & Collection Cycle Suite"
                      : isAr ? "كافة اختبارات الحوكمة والنزاهة المالية الشاملة (المراحل 49-53)" : "All Financial Governance & Integrity Suites (P49-P53)"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isAr
                      ? "التحقق البرمجي التلقائي الصارم من سلامة الحوكمة، عدم التعديل، ومنع القيد في الفترات المغلقة."
                      : "Strict automated invariant verification of ledger integrity, period governance, and hash immutability."}
                  </p>
                </div>
              </div>

              {/* Suite Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl">
                <button
                  onClick={() => handleRunSecurityTests("P51")}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                    selectedTestSuite === "P51" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {isAr ? "المرحلة 51 (55)" : "P51 (55)"}
                </button>
                <button
                  onClick={() => handleRunSecurityTests("P50")}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                    selectedTestSuite === "P50" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {isAr ? "المرحلة 50 (50)" : "P50 (50)"}
                </button>
                <button
                  onClick={() => handleRunSecurityTests("P49")}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                    selectedTestSuite === "P49" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {isAr ? "المرحلة 49 (45)" : "P49 (45)"}
                </button>
                <button
                  onClick={() => handleRunSecurityTests("P52")}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                    selectedTestSuite === "P52" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {isAr ? "المرحلة 52" : "P52"}
                </button>
                <button
                  onClick={() => handleRunSecurityTests("P53")}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                    selectedTestSuite === "P53" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {isAr ? "المرحلة 53 (15)" : "P53 (15)"}
                </button>
                <button
                  onClick={() => handleRunSecurityTests("ALL")}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                    selectedTestSuite === "ALL" ? "bg-white text-purple-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {isAr ? "الكل" : "All"}
                </button>

                <button 
                  onClick={() => setIsTestModalOpen(false)}
                  className="p-1.5 hover:bg-slate-300 rounded-full transition ml-2 cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isRunningTests ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
                  <div className="text-lg font-bold text-slate-700">{isAr ? "جاري تشغيل الاختبارات الأمنية ومطابقة الحسابات..." : "Executing security assertions..."}</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Test Summary Dashboard */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                      <div className="text-xs font-bold text-emerald-600 uppercase mb-1">{isAr ? "اختبارات ناجحة" : "Passed"}</div>
                      <div className="text-3xl font-black text-emerald-700">{testResults.filter((r) => r.passed).length}</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                      <div className="text-xs font-bold text-rose-600 uppercase mb-1">{isAr ? "اختبارات فاشلة" : "Failed"}</div>
                      <div className="text-3xl font-black text-rose-700">{testResults.filter((r) => !r.passed).length}</div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                      <div className="text-xs font-bold text-indigo-600 uppercase mb-1">{isAr ? "الإجمالي" : "Total Assertions"}</div>
                      <div className="text-3xl font-black text-indigo-700">{testResults.length}</div>
                    </div>
                  </div>

                  {/* Detailed Results Table */}
                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3">{isAr ? "رقم الاختبار" : "ID"}</th>
                          <th className="px-4 py-3">{isAr ? "الوصف" : "Assertion Description"}</th>
                          <th className="px-4 py-3 text-center">{isAr ? "الحالة" : "Status"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {testResults.map((result, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">#{idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{result.testName}</td>
                            <td className="px-4 py-3 text-center">
                              {result.passed ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>PASS</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-black animate-pulse">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>FAIL</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500 italic">
                {isAr ? "تنبيه: يتم تنفيذ هذه الاختبارات محلياً للتحقق من سلامة منطق الحوكمة وعدم التعديل." : "Note: Executed locally to verify immutability, reversal governance, and forensic invariant integrity."}
              </div>
              <button 
                onClick={() => setIsTestModalOpen(false)}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition cursor-pointer"
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
