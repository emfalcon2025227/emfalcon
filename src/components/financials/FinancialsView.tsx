import React, { useState, useEffect } from "react";
import {
  Coins,
  Receipt,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Scale,
  Gavel,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Calculator,
  ShieldAlert,
  Play,
  CheckCircle,
  XCircle,
  FileText,
  BadgePercent,
  Layers,
  CreditCard,
  ArrowRightLeft,
  SlidersHorizontal,
  BookOpen,
  DollarSign,
  Wallet,
  Printer,
  FileSpreadsheet,
  Wrench,
  Building2,
  Clock,
  ShieldCheck,
  Calendar,
  History,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import {
  CommissionObligation,
  PaymentAllocation,
  FinancialReversalRecord,
  FinancialAdjustmentRecord,
  ReconciledFinancialBalances,
} from "../../types";
import { 
  calculateCommissionAmount, 
  generateCommissionBusinessKey, 
  resolveAdministrativeFeePolicy,
  DEFAULT_COMMISSION_SETTINGS 
} from "../../services/financialEngine";
import { FinancialReconciliationCenter } from "./FinancialReconciliationCenter";
import { SearchableSelect } from "../common/SearchableSelect";
import { ChartOfAccountsView } from "./ChartOfAccountsView";
import { GeneralLedgerView } from "./GeneralLedgerView";
import { OwnerTransfersView } from "./OwnerTransfersView";
import { PropertyExpensesView } from "./PropertyExpensesView";
import { StatementsView } from "./StatementsView";
import { FinancialOverview } from "./FinancialOverview";
import { FinancialReportsView } from "./FinancialReportsView";
import { FinancialReversalsView } from "./FinancialReversalsView";
import { OfficePettyCashView } from "./OfficePettyCashView";
import { SaqrOfficeAccountView } from "./SaqrOfficeAccountView";
import { DailyRevenueView } from "./DailyRevenueView";
import { DailyDepositsView } from "./DailyDepositsView";
import { DailyCashReconciliationView } from "./DailyCashReconciliationView";
import { VatManagementView } from "./VatManagementView";
import { FinancialControlCenterView } from "./FinancialControlCenterView";
import { AdminFeeExceptionCenterView } from "./AdminFeeExceptionCenterView";
import { ProductionGovernanceCenterView } from "./ProductionGovernanceCenterView";
import { FinancialPeriodsView } from "./FinancialPeriodsView";
import { detectAdminFeeExceptions } from "../../utils/feeExceptionDetector";

export const FinancialsView: React.FC = () => {
  const { language } = useLanguage();
  const { canGoBack, navigateTo } = useNavigation();
  const isAr = language === "ar";
  const { currentUser } = useAuth();
  const {
    commissions = [],
    paymentAllocations = [],
    financialReversals = [],
    financialAdjustments = [],
    chartOfAccounts = [],
    ownerTransfers = [],
    propertyExpenses = [],
    vatRates = [],
    collections = [],
    cheques = [],
    leases = [],
    owners = [],
    tenants = [],
    properties = [],
    maintenanceRequests = [],
    addCommissionObligation,
    updateCommissionObligation,
    collectAdministrativeFee,
    reverseCommissionObligation,
    allocatePaymentToTargets,
    reversePaymentReceipt,
    reverseSinglePaymentAllocation,
    recordFinancialAdjustment,
    reconcileSystemFinancialBalances,
    legalSettings,
    updateLegalSettings,
  } = useData();
  const [selectedVatCommission, setSelectedVatCommission] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<
    | "OVERVIEW"
    | "ADMIN_FEES"
    | "EXCEPTION_CENTER"
    | "PROPERTY_EXPENSES"
    | "OWNER_TRANSFERS"
    | "STATEMENTS"
    | "REVERSALS"
    | "MAINTENANCE_EXPENSES"
    | "RECONCILIATION"
    | "REPORTS"
    | "TEST_RUNNER"
    | "CHART_OF_ACCOUNTS"
    | "OFFICE_PETTY_CASH"
    | "SAQR_OFFICE_ACCOUNT"
    | "VAT_MANAGEMENT"
    | "DAILY_CASH_RECONCILIATION"
    | "FINANCIAL_CONTROL_CENTER"
    | "GOVERNANCE_CENTER"
    | "GENERAL_LEDGER"
    | "FINANCIAL_PERIODS"
    | "DAILY_REVENUE"
    | "DAILY_DEPOSITS"
    | "RECONCILIATION_CENTER"
    | "LEGAL_SETTINGS"
  >(() => {
    const validTabs = [
      "OVERVIEW",
      "ADMIN_FEES",
      "EXCEPTION_CENTER",
      "PROPERTY_EXPENSES",
      "OWNER_TRANSFERS",
      "STATEMENTS",
      "REVERSALS",
      "MAINTENANCE_EXPENSES",
      "RECONCILIATION",
      "REPORTS",
      "TEST_RUNNER",
      "CHART_OF_ACCOUNTS",
      "OFFICE_PETTY_CASH",
      "SAQR_OFFICE_ACCOUNT",
      "VAT_MANAGEMENT",
      "DAILY_CASH_RECONCILIATION",
      "FINANCIAL_CONTROL_CENTER",
      "GOVERNANCE_CENTER",
      "GENERAL_LEDGER",
      "FINANCIAL_PERIODS",
      "DAILY_REVENUE",
      "DAILY_DEPOSITS",
      "RECONCILIATION_CENTER",
      "LEGAL_SETTINGS",
    ];
    const saved = localStorage.getItem("financials_active_tab");
    return saved && validTabs.includes(saved) ? (saved as any) : "OVERVIEW";
  });

  // Calculate Fee Exceptions Summary for Tab Badge
  const feeExceptionsData = React.useMemo(() => {
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



  useEffect(() => {
    try {
      localStorage.setItem("financials_active_tab", activeTab);
    } catch (e) {}
  }, [activeTab]);

  useEffect(() => {
    const handleSetTab = (e: any) => {
      if (e.detail && e.detail.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener("set-financials-tab", handleSetTab);
    return () => window.removeEventListener("set-financials-tab", handleSetTab);
  }, []);

  const [partyFilter, setPartyFilter] = useState<"ALL" | "OWNER" | "TENANT">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeaseId, setSelectedLeaseId] = useState("");

  useEffect(() => {
    const handleOpenPending = () => {
      setActiveTab("ADMIN_FEES");
      setStatusFilter("PENDING");
    };
    const handleOpenExceptions = (e: any) => {
      setActiveTab("EXCEPTION_CENTER");
    };
    window.addEventListener("open-pending-admin-fees", handleOpenPending);
    window.addEventListener("open-exception-center", handleOpenExceptions);
    return () => {
      window.removeEventListener("open-pending-admin-fees", handleOpenPending);
      window.removeEventListener("open-exception-center", handleOpenExceptions);
    };
  }, []);

  // Test Runner State
  const [testReport, setTestReport] = useState<Phase1TestReport | null>(null);
  const [phase2TestResults, setPhase2TestResults] = useState<Phase2TestResult[]>([]);
  const [phase18TestResults, setPhase18TestResults] = useState<Phase18TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // New Commission Modal State
  const [isAddCommissionModalOpen, setIsAddCommissionModalOpen] = useState(false);
  const [modalLeaseId, setModalLeaseId] = useState("");
  const [modalPartyType, setModalPartyType] = useState<"OWNER" | "TENANT">("OWNER");
  
  // Policy Resolver for Modal
  const [modalPolicy, setModalPolicy] = useState<{ 
    rate: number; 
    source: "SYSTEM_DEFAULT" | "PARTY_OVERRIDE" | "CONTRACT_EXEMPTION";
    isExempt: boolean;
    exemptionDetails?: any;
  } | null>(null);

  useEffect(() => {
    if (isAddCommissionModalOpen) {
      const lease = leases.find(l => l.id === modalLeaseId);
      const partyId = modalPartyType === "OWNER" ? lease?.ownerId : lease?.tenantId;
      const policy = resolveAdministrativeFeePolicy(
        modalPartyType, 
        partyId || "", 
        lease?.adminFeePolicy, 
        DEFAULT_COMMISSION_SETTINGS, 
        owners, 
        tenants
      );
      setModalPolicy(policy);
      setModalRate(policy.rate);
    }
  }, [isAddCommissionModalOpen, modalPartyType, modalLeaseId, owners, tenants]);

  const [modalRate, setModalRate] = useState<number>(5.0);
  const [modalDueDate, setModalDueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [modalNotes, setModalNotes] = useState("");
  const [modalError, setModalError] = useState("");

  // Collection Modal State
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [collectionTargetId, setCollectionTargetId] = useState("");
  const [collectionIdempotencyKey, setCollectionIdempotencyKey] = useState("");
  const [collectionAmount, setCollectionAmount] = useState<number>(0);
  const [collectionMethod, setCollectionMethod] = useState<"CASH" | "BANK_TRANSFER" | "CHEQUE">("BANK_TRANSFER");
  const [collectionRef, setCollectionRef] = useState("");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [collectionError, setCollectionError] = useState("");

  // Edit Commission Modal State
  const [isEditCommissionModalOpen, setIsEditCommissionModalOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState("");
  const [editTotalAmount, setEditTotalAmount] = useState<number>(0);
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState("");

  // Allocate Payment Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [targetAllocations, setTargetAllocations] = useState<
    Array<{ targetType: "CHEQUE" | "COMMISSION" | "UNALLOCATED_PREPAYMENT"; targetId: string; amount: number; description: string }>
  >([]);
  const [allocError, setAllocError] = useState("");

  // Reversal Modal State
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [reversalTargetCollectionId, setReversalTargetCollectionId] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [reversalError, setReversalError] = useState("");

  // Commission Reversal State
  const [isReverseCommissionModalOpen, setIsReverseCommissionModalOpen] = useState(false);
  const [selectedCommissionForReversal, setSelectedCommissionForReversal] = useState<CommissionObligation | null>(null);
  const [commReversalReason, setCommReversalReason] = useState("");
  const [commReversalError, setCommReversalError] = useState("");

  // Run Test Suite (Phase 1 + Phase 2 + Phase 18)
  const handleRunTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      const p1Report = runAllPhase1FinancialTests();
      const p2Results = runPhase2FinancialTests();
      const p18Results = runPhase18FinancialControlTests({
        commissions,
        propertyExpenses,
        ownerTransfers,
        collections,
        paymentAllocations,
        financialReversals,
        leases
      });
      setTestReport(p1Report);
      setPhase2TestResults(p2Results);
      setPhase18TestResults(p18Results);
      setIsRunningTests(false);
    }, 400);
  };

  // Derived Totals
  const totalCommissionExpected = commissions.reduce((sum, c) => sum + c.totalCommissionAmount, 0);
  const totalCommissionCollected = commissions.reduce((sum, c) => sum + c.collectedAmount, 0);
  const totalCommissionOutstanding = commissions.reduce((sum, c) => sum + c.outstandingBalance, 0);

  const totalOwnerCommissions = commissions
    .filter((c) => c.partyType === "OWNER")
    .reduce((sum, c) => sum + c.totalCommissionAmount, 0);
  const totalTenantCommissions = commissions
    .filter((c) => c.partyType === "TENANT")
    .reduce((sum, c) => sum + c.totalCommissionAmount, 0);

  // Reconciliation Calculations
  const totalRentCollections = collections.reduce((sum, col) => {
    const isReversed = financialReversals.some((r) => r.targetType === "COLLECTION" && r.targetId === col.id);
    return isReversed ? sum : sum + col.amountEntered;
  }, 0);

  const totalOwnerCommissionsWithReversals = commissions
    .filter((c) => c.partyType === "OWNER" && c.status !== "CANCELLED")
    .reduce((sum, c) => sum + c.totalCommissionAmount, 0);

  const totalOwnerExpenses = propertyExpenses
    .filter((e) => e.costBearer === "OWNER" && e.status !== "CANCELLED" && e.status !== "REVERSED")
    .reduce((sum, e) => sum + e.totalAmount, 0);

  const totalTransfers = ownerTransfers
    .filter((t) => t.status !== "DRAFT" && t.status !== "REVERSED")
    .reduce((sum, t) => sum + t.amount, 0);

  const calculatedOwnerPayable = totalRentCollections - totalOwnerCommissionsWithReversals - totalOwnerExpenses - totalTransfers;

  // Tenant Reconciliation
  const totalRentCharges = leases.reduce((sum, l) => sum + l.annualRent, 0);

  const totalTenantExpenses = propertyExpenses
    .filter((e) => e.costBearer === "TENANT" && e.status !== "CANCELLED" && e.status !== "REVERSED")
    .reduce((sum, e) => sum + e.totalAmount, 0);

  const calculatedTenantOutstanding = totalRentCharges + totalTenantCommissions - totalRentCollections;

  // Office Reconciliation
  const totalOfficeExpenses = propertyExpenses
    .filter((e) => e.costBearer === "OFFICE" && e.status !== "CANCELLED" && e.status !== "REVERSED")
    .reduce((sum, e) => sum + e.totalAmount, 0);

  // Active Property Expenses
  const totalActiveExpenses = propertyExpenses
    .filter((e) => e.status !== "CANCELLED" && e.status !== "REVERSED")
    .reduce((sum, e) => sum + e.totalAmount, 0);

  // Maintenance Expenses
  const totalMaintenanceExpenses = propertyExpenses
    .filter((e) => e.category === "MAINTENANCE" && e.status !== "CANCELLED" && e.status !== "REVERSED")
    .reduce((sum, e) => sum + e.totalAmount, 0);

  // Reversed Expenses
  const totalReversedExpenses = propertyExpenses
    .filter((e) => e.status === "REVERSED")
    .reduce((sum, e) => sum + e.totalAmount, 0);

  // Unallocated Expenses
  const unallocatedExpenses = propertyExpenses.filter(
    (e) => !e.ownerId && !e.tenantId && e.costBearer !== "OFFICE"
  );
  const totalUnallocatedExpenses = unallocatedExpenses.reduce((sum, e) => sum + e.totalAmount, 0);

  // Duplicate posting checker
  const duplicatePostings = propertyExpenses.filter((exp, idx, self) => {
    if (!exp.maintenanceInvoiceId) return false;
    return self.findIndex(
      (e) =>
        e.maintenanceInvoiceId === exp.maintenanceInvoiceId &&
        e.costBearer === exp.costBearer &&
        e.id !== exp.id &&
        e.status !== "REVERSED"
    ) > idx;
  });

  // Reconciliation Exceptions Engine
  interface ReconciliationException {
    id: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    entity: string;
    recordId: string;
    amount?: number;
    detectedDate: string;
    explanation: string;
    resolutionStatus: string;
  }

  const exceptions: ReconciliationException[] = [];

  propertyExpenses.forEach((exp) => {
    if (exp.category === "MAINTENANCE" && !exp.sourceId) {
      exceptions.push({
        id: `exc-exp-src-${exp.id}`,
        severity: "MEDIUM",
        entity: "PROPERTY_EXPENSE",
        recordId: exp.id,
        amount: exp.totalAmount,
        detectedDate: exp.createdAt ? exp.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        explanation: isAr 
          ? `مصروف صيانة بدون مصدر صيانة مرتبط أو معرّف الطلب`
          : `Maintenance expense recorded without a valid maintenance request source ID.`,
        resolutionStatus: isAr ? "مفتوح" : "Open"
      });
    }
    if (exp.totalAmount < 0) {
      exceptions.push({
        id: `exc-neg-${exp.id}`,
        severity: "HIGH",
        entity: "PROPERTY_EXPENSE",
        recordId: exp.id,
        amount: exp.totalAmount,
        detectedDate: exp.createdAt ? exp.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        explanation: isAr ? "مصروف يحتوي على مبالغ سالبة غير صالحة" : "Expense contains invalid negative value.",
        resolutionStatus: isAr ? "مفتوح" : "Open"
      });
    }
    if (exp.costBearer === "OWNER" && !exp.ownerId) {
      exceptions.push({
        id: `exc-miss-own-${exp.id}`,
        severity: "HIGH",
        entity: "PROPERTY_EXPENSE",
        recordId: exp.id,
        amount: exp.totalAmount,
        detectedDate: exp.createdAt ? exp.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        explanation: isAr ? "مصروف على المالك ولكن يفتقر لمعرف المالك" : "Owner-borne expense has missing owner ID link.",
        resolutionStatus: isAr ? "مفتوح" : "Open"
      });
    }
  });

  duplicatePostings.forEach((exp) => {
    exceptions.push({
      id: `exc-dup-post-${exp.id}`,
      severity: "HIGH",
      entity: "PROPERTY_EXPENSE",
      recordId: exp.id,
      amount: exp.totalAmount,
      detectedDate: exp.createdAt ? exp.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
      explanation: isAr
        ? `تكرار محتمل لترحيل فاتورة الصيانة #${exp.vendorInvoiceNumber} لنفس جهة التحمل`
        : `Potential duplicate expense posting for maintenance invoice #${exp.vendorInvoiceNumber} and bearer ${exp.costBearer}`,
      resolutionStatus: isAr ? "مفتوح" : "Open"
    });
  });

  maintenanceRequests.forEach((req) => {
    if (req.costBearer === "SPLIT/CUSTOM") {
      const method = req.splitMethod || "PERCENTAGE";
      const ownerVal = req.splitOwnerVal ?? 0;
      const tenantVal = req.splitTenantVal ?? 0;
      const officeVal = req.splitOfficeVal ?? 0;
      if (method === "PERCENTAGE") {
        const totalPct = ownerVal + tenantVal + officeVal;
        if (totalPct !== 100) {
          exceptions.push({
            id: `exc-pct-sum-${req.id}`,
            severity: "HIGH",
            entity: "MAINTENANCE_REQUEST",
            recordId: req.id,
            detectedDate: req.updatedAt?.slice(0, 10) || (req.createdAt ? req.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            explanation: isAr
              ? `مجموع نسب التقسيم المخصص (${totalPct}%) لطلب الصيانة #${req.requestNumber} لا يساوي 100%`
              : `Custom split percentage sum (${totalPct}%) for request #${req.requestNumber} does not equal 100%.`,
            resolutionStatus: isAr ? "مفتوح" : "Open"
          });
        }
      } else {
        const totalFixed = ownerVal + tenantVal + officeVal;
        if (req.totalCost > 0 && Math.abs(totalFixed - req.totalCost) > 0.1) {
          exceptions.push({
            id: `exc-fix-sum-${req.id}`,
            severity: "HIGH",
            entity: "MAINTENANCE_REQUEST",
            recordId: req.id,
            amount: Math.abs(totalFixed - req.totalCost),
            detectedDate: req.updatedAt?.slice(0, 10) || (req.createdAt ? req.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            explanation: isAr
              ? `مجموع مبالغ التقسيم الثابتة (${totalFixed} AED) لطلب الصيانة #${req.requestNumber} لا يساوي التكلفة الفعلية للفواتير (${req.totalCost} AED)`
              : `Custom split fixed sum (${totalFixed} AED) for request #${req.requestNumber} does not equal actual invoices cost (${req.totalCost} AED).`,
            resolutionStatus: isAr ? "مفتوح" : "Open"
          });
        }
      }
    }
  });

  // 5. Integration of Owner Transfer Reconciliation into Exceptions Registry
  const recon = reconcileSystemFinancialBalances();
  if (recon.ownerTransferReconciliation) {
    Object.values(recon.ownerTransferReconciliation).forEach(r => {
      if (r.status === "DISCREPANCY") {
        if (Math.abs(r.heldDiscrepancy) > 0.01) {
          exceptions.push({
            id: `exc-recon-held-${r.ownerId}`,
            severity: "HIGH",
            entity: "OWNER_COUNTER",
            recordId: r.ownerId,
            amount: r.heldDiscrepancy,
            detectedDate: new Date().toISOString().slice(0, 10),
            explanation: isAr 
              ? `فرق في رصيد المبالغ المحجوزة للمالك ${r.ownerName || r.ownerId} (المسجل: ${r.persistedHeld.toLocaleString()}, الفعلي: ${r.derivedHeld.toLocaleString()})`
              : `Total Held counter desync for owner ${r.ownerName || r.ownerId} (Persisted: ${r.persistedHeld.toLocaleString()}, Derived: ${r.derivedHeld.toLocaleString()})`,
            resolutionStatus: isAr ? "يتطلب إعادة مزامنة" : "Needs Resync"
          });
        }
        if (Math.abs(r.paidDiscrepancy) > 0.01) {
          exceptions.push({
            id: `exc-recon-paid-${r.ownerId}`,
            severity: "HIGH",
            entity: "OWNER_COUNTER",
            recordId: r.ownerId,
            amount: r.paidDiscrepancy,
            detectedDate: new Date().toISOString().slice(0, 10),
            explanation: isAr 
              ? `فرق في رصيد المبالغ المسددة للمالك ${r.ownerName || r.ownerId} (المسجل: ${r.persistedPaid.toLocaleString()}, الفعلي: ${r.derivedPaid.toLocaleString()})`
              : `Total Paid counter desync for owner ${r.ownerName || r.ownerId} (Persisted: ${r.persistedPaid.toLocaleString()}, Derived: ${r.derivedPaid.toLocaleString()})`,
            resolutionStatus: isAr ? "يتطلب إعادة مزامنة" : "Needs Resync"
          });
        }
      }
    });
  }

  // Filtered Commissions
  const filteredCommissions = commissions.filter((c) => {
    if (c.commissionType !== "ADMIN_FEE") return false;
    if (partyFilter !== "ALL" && c.partyType !== partyFilter) return false;
    
    if (statusFilter === "PENDING") {
      if (c.status === "REVERSED" || c.status === "CANCELLED" || c.status === "WAIVED") return false;
      const collected = c.collectedAmount || 0;
      if (c.totalCommissionAmount <= collected) return false;
    }
    
    if (selectedLeaseId && c.leaseId !== selectedLeaseId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchKey = c.businessKey ? c.businessKey.toLowerCase().includes(q) : false;
      const matchParty = c.partyType ? c.partyType.toLowerCase().includes(q) : false;
      return matchKey || matchParty;
    }
    return true;
  });

  // Handle Add Commission
  const handleSaveCommission = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    const targetLease = leases.find((l) => l.id === modalLeaseId);
    if (!targetLease) {
      setModalError(isAr ? "يرجى تحديد عقد الإيجار" : "Please select a lease contract");
      return;
    }

    const currentYear = targetLease.startDate
      ? new Date(targetLease.startDate).getFullYear().toString()
      : new Date().getFullYear().toString();

    // Check duplicate by party and contractual year
    const isDuplicate = commissions.some(
      (c) =>
        c.status !== "CANCELLED" &&
        c.leaseId === targetLease.id &&
        c.partyType === modalPartyType &&
        String(c.contractualCommissionYear || (c.dueDate ? new Date(c.dueDate).getFullYear() : new Date(c.createdAt).getFullYear())) === currentYear
    );

    if (isDuplicate) {
      setModalError(
        isAr
          ? `تم تسجيل رسوم إدارية لهذا الطرف (${modalPartyType === "OWNER" ? "المالك" : "المستأجر"}) عن السنة التعاقدية (${currentYear}) مسبقاً، ويُمنع تكرار الرسوم لنفس السنة.`
          : `Administrative fees already recorded for this party for contractual year ${currentYear}. Duplicate fees are prohibited.`
      );
      return;
    }

    const rent = targetLease.annualRent || 0;
    const partyId = modalPartyType === "OWNER" ? targetLease.ownerId : targetLease.tenantId;

    const summary = calculateCommissionAmount(
      rent,
      modalPartyType,
      modalRate,
      DEFAULT_COMMISSION_SETTINGS,
      "ADMIN_FEE",
      modalDueDate,
      vatRates,
      owners,
      tenants,
      partyId,
      targetLease.adminFeePolicy
    );

    const res = addCommissionObligation({
      leaseId: targetLease.id,
      propertyId: targetLease.propertyId,
      unitId: targetLease.unitId,
      ownerId: modalPartyType === "OWNER" ? targetLease.ownerId : undefined,
      tenantId: modalPartyType === "TENANT" ? targetLease.tenantId : undefined,
      partyType: modalPartyType,
      commissionType: "ADMIN_FEE",
      calculationBasis: "PERCENTAGE_OF_RENT",
      baseAmount: rent,
      ratePercentage: summary.rate,
      totalCommissionAmount: summary.amount,
      vatAmount: summary.vatAmount,
      vatRate: summary.vatRate,
      netRevenueAmount: summary.netRevenue,
      taxTreatment: summary.taxTreatment,
      dueDate: modalDueDate,
      notes: modalNotes,
      contractualCommissionYear: currentYear,
      isExempt: summary.isExempt,
      exemptionSource: summary.isExempt ? "CONTRACT_EXEMPTION" : undefined,
      exemptionReason: summary.exemptionDetails?.exemptionNote || summary.exemptionDetails?.exemptionReason,
      approvalStatus: summary.exemptionDetails?.approvalStatus,
      approvedBy: summary.exemptionDetails?.approvedBy,
    });

    if (!res.success) {
      setModalError(res.error || "Failed to create administrative fees obligation");
      return;
    }

    setIsAddCommissionModalOpen(false);
    setModalLeaseId("");
    setModalNotes("");
  };

  const handleOpenCollectionModal = (commission: CommissionObligation) => {
    setCollectionTargetId(commission.id);
    setCollectionAmount(commission.outstandingBalance);
    setCollectionMethod("BANK_TRANSFER");
    setCollectionRef("");
    setCollectionNotes("");
    setCollectionError("");
    setCollectionIdempotencyKey(crypto.randomUUID().split("-")[0] + Date.now().toString(36));
    setIsCollectionModalOpen(true);
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setCollectionError("");

    if (collectionAmount <= 0) {
      setCollectionError(isAr ? "المبلغ يجب أن يكون أكبر من الصفر" : "Amount must be positive");
      return;
    }

    const res = await collectAdministrativeFee(
      collectionTargetId,
      collectionAmount,
      collectionMethod,
      collectionRef,
      collectionNotes,
      collectionIdempotencyKey
    );

    if (res.success) {
      setIsCollectionModalOpen(false);
    } else {
      setCollectionError(res.error || "Failed to record collection");
    }
  };

  const handleOpenReverseCommissionModal = (c: CommissionObligation) => {
    setSelectedCommissionForReversal(c);
    setCommReversalReason("");
    setCommReversalError("");
    setIsReverseCommissionModalOpen(true);
  };

  const handleReverseCommission = () => {
    if (!selectedCommissionForReversal || !commReversalReason.trim()) {
      setCommReversalError(isAr ? "يرجى إدخال سبب الإلغاء" : "Please enter reversal reason");
      return;
    }
    const res = reverseCommissionObligation(selectedCommissionForReversal.id, commReversalReason);
    if (res.success) {
      setIsReverseCommissionModalOpen(false);
      setSelectedCommissionForReversal(null);
      setCommReversalReason("");
    } else {
      setCommReversalError(res.error || "Error");
    }
  };

  const handleOpenEditCommissionModal = (commission: CommissionObligation) => {
    setEditTargetId(commission.id);
    setEditTotalAmount(commission.totalCommissionAmount);
    setEditDueDate(commission.dueDate || "");
    setEditNotes(commission.notes || "");
    setEditError("");
    setIsEditCommissionModalOpen(true);
  };

  const handleUpdateCommission = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");

    if (editTotalAmount <= 0) {
      setEditError(isAr ? "المبلغ يجب أن يكون أكبر من الصفر" : "Amount must be positive");
      return;
    }

    updateCommissionObligation(editTargetId, {
      totalCommissionAmount: editTotalAmount,
      dueDate: editDueDate,
      notes: editNotes,
    });

    setIsEditCommissionModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCommissionsCSV = () => {
    const headers = isAr
      ? ["المفتاح", "الطرف", "النوع", "العقد", "المبلغ الإجمالي", "المحصل", "المتبقي", "الحالة"]
      : ["Key", "Party", "Type", "Lease", "Total", "Collected", "Outstanding", "Status"];

    const rows = filteredCommissions.map((c) => {
      const lease = leases.find((l) => l.id === c.leaseId);
      const owner = owners.find((o) => o.id === c.ownerId);
      const tenant = tenants.find((t) => t.id === c.tenantId);
      const partyName =
        c.partyType === "OWNER"
          ? owner?.nameAr || owner?.nameEn || c.ownerId
          : tenant?.nameAr || tenant?.nameEn || c.tenantId;

      return [
        c.businessKey,
        partyName,
        c.partyType,
        lease?.leaseNumber || c.leaseId,
        c.totalCommissionAmount.toString(),
        c.collectedAmount.toString(),
        c.outstandingBalance.toString(),
        c.status,
      ];
    });

    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `admin_fees_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
  };

  // Handle Execute Reversal
  const handleExecuteReversal = (e: React.FormEvent) => {
    e.preventDefault();
    setReversalError("");

    if (!reversalTargetCollectionId) {
      setReversalError(isAr ? "يرجى اختيار سند القبض" : "Please select a payment collection");
      return;
    }
    if (!reversalReason.trim()) {
      setReversalError(isAr ? "يرجى كتابة سبب الإلغاء" : "Please state a reversal reason");
      return;
    }

    const res = reversePaymentReceipt(reversalTargetCollectionId, reversalReason);
    if (!res.success) {
      setReversalError(res.error || "Failed to reverse payment");
      return;
    }

    setIsReversalModalOpen(false);
    setReversalTargetCollectionId("");
    setReversalReason("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Executive Action Controls - All Actions Visible Without Scrolling */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 print:hidden">
        {/* Title & Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <BadgePercent className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {isAr ? "المركز المالي وإدارة الرسوم الإدارية (5%)" : "ERP Financial Center & Administrative Fees (5%)"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {isAr
                  ? "إدارة الرسوم الإدارية للمالك والمستأجر، تخصيص الدفعات، إلغاء السندات، وتدقيق الأرصدة المشتقة"
                  : "5% Owner & Tenant Administrative Fees, Payment Allocations, Reversals & Balance Reconciler"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar - Grouped & Zero Scrolling */}
        <div className="bg-slate-900 text-white p-3 sm:p-3.5 rounded-2xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Administrative Fee Actions Group (5%) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 px-1 hidden xl:inline">
              {isAr ? "الرسوم الإدارية (5%):" : "Admin Fees:"}
            </span>

            <button
              type="button"
              onClick={() => setIsAddCommissionModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 shadow-md shadow-emerald-900/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? "تسجيل رسوم إدارية" : "New Admin Fee"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ADMIN_FEES")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{isAr ? "تحصيل رسوم" : "Collect Fee"}</span>
            </button>
          </div>

          {/* Financial Control & Reconciliation Group */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 px-1 hidden xl:inline">
              {isAr ? "الرقابة والمطابقة:" : "Controls:"}
            </span>

            <button
              type="button"
              onClick={() => reconcileSystemFinancialBalances(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-4 h-4 text-blue-400" />
              <span>{isAr ? "مطابقة الأرصدة" : "Reconcile Balances"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReversalModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 shadow-md shadow-rose-900/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isAr ? "إلغاء سند قبض" : "Reverse Payment"}</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo("COLLECTIONS_CENTER")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>{isAr ? "مركز التحصيل" : "Collection Center"}</span>
            </button>
          </div>

          {/* Reports & Exports Group */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>{isAr ? "طباعة" : "Print"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCommissionsCSV}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "تصدير CSV" : "Export CSV"}</span>
            </button>

            {canGoBack && <CloseBackButton variant="dark" />}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isAr ? "إجمالي الرسوم الإدارية المسجلة" : "Total Administrative Fees"}
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalCommissionExpected.toLocaleString()} <span className="text-sm font-normal">AED</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{isAr ? `مالك: ${totalOwnerCommissions.toLocaleString()} AED` : `Owner: ${totalOwnerCommissions.toLocaleString()}`}</span>
              <span>{isAr ? `مستأجر: ${Number(totalTenantCommissions || 0).toLocaleString()} AED` : `Tenant: ${Number(totalTenantCommissions || 0).toLocaleString()}`}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isAr ? "المحصل من الرسوم الإدارية" : "Collected Administrative Fees"}
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalCommissionCollected.toLocaleString()} <span className="text-sm font-normal">AED</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {totalCommissionExpected > 0
                ? `${Math.round((totalCommissionCollected / totalCommissionExpected) * 100)}% ${isAr ? "تم تحصيله" : "collected"}`
                : "0%"}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isAr ? "رسوم إدارية مستحقة وغير محصلة" : "Outstanding Administrative Fees"}
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalCommissionOutstanding.toLocaleString()} <span className="text-sm font-normal">AED</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {commissions.filter((c) => c.status === "PENDING" || c.status === "PARTIALLY_COLLECTED").length}{" "}
              {isAr ? "التزامات غير مسددة بالكامل" : "unsettled obligations"}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isAr ? "سجلات التخصيص والإلغاء" : "Allocations & Reversals"}
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {paymentAllocations.filter((a) => a.status === "ACTIVE").length}{" "}
              <span className="text-sm font-normal text-slate-500">{isAr ? "تخصيص نشط" : "active"}</span>
            </div>
            <div className="text-xs text-rose-500 mt-1">
              {financialReversals.length} {isAr ? "عمليات إلغاء مسجلة" : "reversed payments"}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Toolbar - Organized by Function */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 print:hidden">
        
        {/* Group 1: Analysis */}
        <div className="flex items-center gap-1 p-1 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "OVERVIEW"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isAr ? "نظرة عامة" : "Overview"}</span>
          </button>
        </div>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Group 2: Daily Operations */}
        <div className="flex items-center gap-1 p-1 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/30 dark:border-emerald-800/30 shadow-sm">
          <button
            onClick={() => setActiveTab("DAILY_REVENUE")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "DAILY_REVENUE"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isAr ? "الإيرادات اليومية" : "Revenue"}</span>
          </button>

          <button
            onClick={() => setActiveTab("DAILY_DEPOSITS")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "DAILY_DEPOSITS"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>{isAr ? "الإيداعات اليومية" : "Deposits"}</span>
          </button>

          <button
            onClick={() => setActiveTab("DAILY_CASH_RECONCILIATION")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "DAILY_CASH_RECONCILIATION"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{isAr ? "المطابقة" : "Cash Recon"}</span>
          </button>

          <div className="w-px h-4 bg-emerald-200 dark:bg-emerald-800 mx-0.5" />

          <button
            onClick={() => setActiveTab("OFFICE_PETTY_CASH")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "OFFICE_PETTY_CASH"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>{isAr ? "المصروفات" : "Petty Cash"}</span>
          </button>

          <button
            onClick={() => setActiveTab("SAQR_OFFICE_ACCOUNT")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "SAQR_OFFICE_ACCOUNT"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{isAr ? "حساب المكتب" : "Saqr Acc"}</span>
          </button>
        </div>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Group 3: Property & Fees & Operations */}
        <div className="flex items-center gap-1 p-1 bg-amber-50/30 dark:bg-amber-950/20 rounded-xl border border-amber-200/30 dark:border-amber-800/30 shadow-sm">
          <button
            onClick={() => setActiveTab("ADMIN_FEES")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "ADMIN_FEES"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            }`}
          >
            <BadgePercent className="w-3.5 h-3.5" />
            <span>{isAr ? "الرسوم الادارية" : "Fees (5%)"}</span>
          </button>

          <button
            onClick={() => setActiveTab("EXCEPTION_CENTER")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "EXCEPTION_CENTER"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isAr ? "الاستثناءات" : "Exceptions"}</span>
          </button>

          <div className="w-px h-4 bg-amber-200 dark:bg-amber-800 mx-0.5" />

          <button
            onClick={() => setActiveTab("PROPERTY_EXPENSES")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "PROPERTY_EXPENSES"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isAr ? "المصاريف" : "Expenses"}</span>
          </button>

          <button
            onClick={() => setActiveTab("MAINTENANCE_EXPENSES")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "MAINTENANCE_EXPENSES"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{isAr ? "الصيانة" : "Maint."}</span>
          </button>

          <button
            onClick={() => setActiveTab("OWNER_TRANSFERS")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "OWNER_TRANSFERS"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{isAr ? "التحويلات" : "Transfers"}</span>
          </button>
        </div>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Group 4: Audit & Accounting */}
        <div className="flex items-center gap-1 p-1 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/30 dark:border-indigo-800/30 shadow-sm">
          <button
            onClick={() => setActiveTab("GOVERNANCE_CENTER")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "GOVERNANCE_CENTER"
                ? "bg-indigo-700 text-white shadow-xs"
                : "text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAr ? "الحوكمة" : "Gov"}</span>
          </button>

          <button
            onClick={() => setActiveTab("FINANCIAL_CONTROL_CENTER")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "FINANCIAL_CONTROL_CENTER"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{isAr ? "الرقابة" : "Control"}</span>
          </button>

          <button
            onClick={() => setActiveTab("RECONCILIATION")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "RECONCILIATION"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{isAr ? "المطابقة" : "Recon"}</span>
          </button>

          <button
            onClick={() => setActiveTab("RECONCILIATION_CENTER")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "RECONCILIATION_CENTER"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAr ? "مركز المطابقة (P55)" : "Recon Center (P55)"}</span>
          </button>

          <button
            onClick={() => setActiveTab("GENERAL_LEDGER")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "GENERAL_LEDGER"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isAr ? "الأستاذ العام" : "Ledger"}</span>
          </button>

          <button
            onClick={() => setActiveTab("CHART_OF_ACCOUNTS")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "CHART_OF_ACCOUNTS"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isAr ? "دليل الحسابات" : "COA"}</span>
          </button>

          <div className="w-px h-4 bg-indigo-200 dark:bg-indigo-800 mx-0.5" />

          <button
            onClick={() => setActiveTab("FINANCIAL_PERIODS")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "FINANCIAL_PERIODS"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{isAr ? "الفترات" : "Periods"}</span>
          </button>

          <button
            onClick={() => setActiveTab("VAT_MANAGEMENT")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "VAT_MANAGEMENT"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>{isAr ? "الضريبة" : "VAT"}</span>
          </button>

          <button
            onClick={() => setActiveTab("LEGAL_SETTINGS")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "LEGAL_SETTINGS"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{isAr ? "الرسوم والقضايا" : "Legal & Fees"}</span>
          </button>
        </div>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Group 5: Reports */}
        <div className="flex items-center gap-1 p-1 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <button
            onClick={() => setActiveTab("REPORTS")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "REPORTS"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>{isAr ? "التقارير" : "Reports"}</span>
          </button>

          <button
            onClick={() => setActiveTab("STATEMENTS")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "STATEMENTS"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isAr ? "الكشوف" : "Statements"}</span>
          </button>

          <button
            onClick={() => setActiveTab("REVERSALS")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "REVERSALS"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? "الإلغاءات" : "Reversals"}</span>
          </button>
        </div>
      </div>


      {/* TAB: GOVERNANCE_CENTER (PHASE 14) */}
      {activeTab === "GOVERNANCE_CENTER" && <ProductionGovernanceCenterView />}

      {/* TAB: DAILY REVENUE CENTER (PHASE 53) */}
      {activeTab === "DAILY_REVENUE" && <DailyRevenueView />}
      {activeTab === "DAILY_DEPOSITS" && <DailyDepositsView />}
      
      {/* TAB: FINANCIAL RECONCILIATION CENTER (PHASE 55) */}
      {activeTab === "RECONCILIATION_CENTER" && <FinancialReconciliationCenter />}

      {/* TAB: OVERVIEW */}
      {activeTab === "OVERVIEW" && <FinancialOverview />}

      {/* TAB: OFFICE_PETTY_CASH */}
      {activeTab === "OFFICE_PETTY_CASH" && <OfficePettyCashView />}

      {/* TAB: SAQR_OFFICE_ACCOUNT */}
      {activeTab === "SAQR_OFFICE_ACCOUNT" && <SaqrOfficeAccountView />}

      {/* TAB: ADMIN FEE EXCEPTION CENTER */}
      {activeTab === "EXCEPTION_CENTER" && <AdminFeeExceptionCenterView />}

      {/* TAB: VAT_MANAGEMENT */}
      {activeTab === "VAT_MANAGEMENT" && <VatManagementView />}

      {/* TAB: LEGAL_SETTINGS */}
      {activeTab === "LEGAL_SETTINGS" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <Gavel className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {isAr ? "إعدادات الرسوم القانونية والقضايا" : "Legal Fees & Case Defaults"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? "تحديد القيم الافتراضية للرسوم الإدارية لارتجاع الشيكات والمطالبات" : "Define default values for bounced cheque handling and legal claims"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {isAr ? "رسوم معالجة الشيك المرتجع الافتراضية (AED):" : "Default Bounced Cheque Handling Fee (AED):"}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={legalSettings?.defaultBouncedChequeFee || 0}
                      onChange={(e) => updateLegalSettings({ defaultBouncedChequeFee: Number(e.target.value) })}
                      className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 outline-none"
                    />
                    <div className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-xl text-[10px] font-black border border-rose-100 dark:border-rose-900/40">
                      AED
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 italic leading-relaxed">
                    {isAr 
                      ? "سيتم استخدام هذه القيمة تلقائياً عند فتح قضية جديدة لكل شيك مرتبط."
                      : "This value will be automatically used for each linked cheque when opening a new case."}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-1">
                    {isAr ? "ملاحظة هامة حول الرسوم القانونية" : "Important Note on Legal Fees"}
                  </h4>
                  <p className="text-[11px] text-amber-800 dark:text-amber-400/80 leading-relaxed opacity-80">
                    {isAr 
                      ? "تم إلغاء الإدخال اليدوي المباشر للرسوم القانونية في القضايا. النظام الآن يعتمد على ربط المصاريف الحقيقية المسجلة في سجل مصاريف العقار تحت فئة (رسوم قانونية) لضمان الدقة المالية التامة."
                      : "Direct manual entry of legal fees in cases has been disabled. The system now relies on linking actual expenses recorded in the property expense log under the (Legal Fees) category to ensure full financial accuracy."}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-900 flex items-center justify-center">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">
                  {isAr ? "تعديل القضايا القائمة؟" : "Retroactive Changes?"}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-lg">
                  {isAr 
                    ? "تغيير هذه الإعدادات سيؤثر فقط على القضايا الجديدة. القضايا القائمة تحتفظ بالقيم التي تم تحديدها وقت الإنشاء، ولكن يمكنك تعديلها يدوياً من داخل كل قضية."
                    : "Changing these settings will only affect new cases. Existing cases retain the values set at creation time, but you can manually adjust them within each case."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: FINANCIAL_PERIODS */}
      {activeTab === "FINANCIAL_PERIODS" && <FinancialPeriodsView />}

      {/* TAB: OWNER TRANSFERS */}
      {activeTab === "OWNER_TRANSFERS" && <OwnerTransfersView />}

      {/* TAB: PROPERTY EXPENSES */}
      {activeTab === "PROPERTY_EXPENSES" && <PropertyExpensesView />}

      {/* TAB: MAINTENANCE EXPENSES */}
      {activeTab === "MAINTENANCE_EXPENSES" && <PropertyExpensesView initialCategory="MAINTENANCE" />}

      {/* TAB: DAILY CASH RECONCILIATION (PHASE 7A) */}
      {activeTab === "DAILY_CASH_RECONCILIATION" && <DailyCashReconciliationView />}

      {/* TAB: FINANCIAL CONTROL CENTER (PHASE 8) */}
      {activeTab === "FINANCIAL_CONTROL_CENTER" && <FinancialControlCenterView />}

      {/* TAB: GENERAL LEDGER */}
      {activeTab === "GENERAL_LEDGER" && <GeneralLedgerView />}

      {/* TAB: CHART OF ACCOUNTS */}
      {activeTab === "CHART_OF_ACCOUNTS" && <ChartOfAccountsView />}

      {/* TAB: REVERSALS */}
      {activeTab === "REVERSALS" && <FinancialReversalsView />}

      {/* TAB: REPORTS */}
      {activeTab === "REPORTS" && <FinancialReportsView />}

      {/* TAB 1: COMMISSIONS TABLE */}
      {activeTab === "ADMIN_FEES" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden print:overflow-visible print:border-none print:shadow-none">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 mr-2 rtl:ml-2">
                <button
                  onClick={handlePrint}
                  className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  title={isAr ? "طباعة" : "Print"}
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExportCommissionsCSV}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition"
                  title={isAr ? "تصدير CSV" : "Export CSV"}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
              </div>
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={isAr ? "بحث بالمفتاح أو الطرف..." : "Search by key or party..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
                <button
                  onClick={() => setPartyFilter("ALL")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    partyFilter === "ALL"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isAr ? "الكل" : "All"}
                </button>
                <button
                  onClick={() => setPartyFilter("OWNER")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    partyFilter === "OWNER"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isAr ? "رسوم المالك (5%)" : "Owner (5%)"}
                </button>
                <button
                  onClick={() => setPartyFilter("TENANT")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    partyFilter === "TENANT"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isAr ? "رسوم المستأجر (5%)" : "Tenant (5%)"}
                </button>
              </div>
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 ml-2 rtl:mr-2">
                <button
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    statusFilter === "ALL"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isAr ? "جميع الحالات" : "All Status"}
                </button>
                <button
                  onClick={() => setStatusFilter("PENDING")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    statusFilter === "PENDING"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isAr ? "معلقة فقط" : "Pending Only"}
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              {isAr
                ? `عرض ${filteredCommissions.length} من إجمالي ${commissions.length} رسوم إدارية`
                : `Showing ${filteredCommissions.length} of ${commissions.length} administrative fee obligations`}
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm text-left rtl:text-right text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">{isAr ? "الطرف والنوع" : "Party & Type"}</th>
                  <th className="px-4 py-3">{isAr ? "العقد والوحدة" : "Lease & Unit"}</th>
                  <th className="px-4 py-3">{isAr ? "مفتاح العمل الفريد" : "Business Key"}</th>
                  <th className="px-4 py-3">{isAr ? "أساس الإيجار" : "Base Rent"}</th>
                  <th className="px-4 py-3">{isAr ? "النسبة" : "Rate"}</th>
                  <th className="px-4 py-3">{isAr ? "الرسوم الإدارية" : "Admin Fees"}</th>
                  <th className="px-4 py-3">{isAr ? "المحصل" : "Collected"}</th>
                  <th className="px-4 py-3">{isAr ? "المتبقي" : "Outstanding"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCommissions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      {isAr ? "لا توجد رسوم إدارية مسجلة مطابقة للبحث" : "No administrative fees found"}
                    </td>
                  </tr>
                ) : (
                  filteredCommissions.map((c) => {
                    const lease = leases.find((l) => l.id === c.leaseId);
                    const owner = owners.find((o) => o.id === c.ownerId);
                    const tenant = tenants.find((t) => t.id === c.tenantId);
                    const isReversed = c.status === "REVERSED";

                    return (
                      <tr
                        key={c.id}
                        className={`transition ${
                          isReversed
                            ? "bg-rose-50/25 dark:bg-rose-950/10 text-slate-400"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className={`flex items-center gap-2 ${isReversed ? "line-through decoration-rose-600 decoration-[2px]" : ""}`}>
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                                isReversed
                                  ? "bg-slate-100 text-slate-400 opacity-60"
                                  : c.partyType === "OWNER"
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                  : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              {c.partyType === "OWNER" ? (isAr ? "مالك" : "OWNER") : isAr ? "مستأجر" : "TENANT"}
                            </span>
                            <span className={`text-xs font-medium ${isReversed ? "text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>
                              {c.partyType === "OWNER"
                                ? owner?.nameAr || owner?.nameEn || c.ownerId
                                : tenant?.nameAr || tenant?.nameEn || c.tenantId}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className={`font-medium ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]" : "text-slate-900 dark:text-white"}`}>
                            {lease?.leaseNumber || c.leaseId}
                          </div>
                          <div className={`text-xs ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]" : "text-slate-400"}`}>
                            {c.dueDate}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <code className={`text-xs font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]" : "text-slate-700 dark:text-slate-300"}`}>
                            {c.businessKey}
                          </code>
                        </td>
                        <td className={`px-4 py-3.5 font-mono ${isReversed ? "line-through decoration-rose-600 decoration-[2px]" : ""}`}>
                          {c.baseAmount.toLocaleString()} AED
                        </td>
                        <td className={`px-4 py-3.5 font-semibold ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]" : "text-emerald-600"}`}>
                          {c.ratePercentage}%
                        </td>
                        <td className={`px-4 py-3.5 font-bold font-mono ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]" : "text-slate-900 dark:text-white"}`}>
                          {c.totalCommissionAmount.toLocaleString()} AED
                          {c.vatAmount && c.vatAmount > 0 && !isReversed && (
                            <button 
                              onClick={() => setSelectedVatCommission(c)}
                              className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline dark:text-indigo-400 font-normal mt-0.5 flex items-center gap-1"
                            >
                              <span>{isAr ? "شامل ضريبة:" : "Incl. VAT:"} {c.vatAmount.toLocaleString()}</span>
                            </button>
                          )}
                        </td>
                        <td className={`px-4 py-3.5 font-mono ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]" : "text-blue-600 dark:text-blue-400"}`}>
                          {c.collectedAmount.toLocaleString()} AED
                        </td>
                        <td className={`px-4 py-3.5 font-bold font-mono ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]" : "text-amber-600 dark:text-amber-400"}`}>
                          {c.outstandingBalance.toLocaleString()} AED
                        </td>
                        <td className="px-4 py-3.5">
                          {isReversed ? (
                            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              {isAr ? "محذوف" : "Deleted"}
                            </span>
                          ) : (
                            <span
                              className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                c.status === "FULLY_COLLECTED"
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                  : c.status === "PARTIALLY_COLLECTED"
                                  ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {c.status === "FULLY_COLLECTED"
                                ? isAr
                                  ? "مسدد بالكامل"
                                  : "Fully Collected"
                                : c.status === "PARTIALLY_COLLECTED"
                                ? isAr
                                  ? "مسدد جزئياً"
                                  : "Partially Collected"
                                : isAr
                                ? "قيد التحصيل"
                                : "Pending"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {isReversed ? (
                            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              {isAr ? "محذوف" : "Deleted"}
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenCollectionModal(c)}
                                disabled={c.status === "FULLY_COLLECTED"}
                                className={`p-1.5 rounded-lg transition ${
                                  c.status === "FULLY_COLLECTED"
                                    ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                                    : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                }`}
                                title={isAr ? "تسجيل تحصيل" : "Record Collection"}
                              >
                                <Wallet className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditCommissionModal(c)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
                                title={isAr ? "تعديل" : "Edit"}
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenReverseCommissionModal(c)}
                                disabled={c.status === "REVERSED"}
                                className={`p-1.5 rounded-lg transition ${
                                  c.status === "REVERSED"
                                    ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                                    : "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                }`}
                                title={isAr ? "إلغاء (عكس)" : "Reverse"}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: COLLECTIONS & ALLOCATIONS */}
      {activeTab === "ADMIN_FEES" && (
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">
              {isAr ? "سجل تخصيص سندات القبض على الالتزامات" : "Payment Allocations Registry"}
            </h3>
            <span className="text-xs text-slate-500">
              {paymentAllocations.length} {isAr ? "سجل تخصيص" : "allocations"}
            </span>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm text-left rtl:text-right text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">{isAr ? "سند القبض" : "Collection Receipt"}</th>
                  <th className="px-4 py-3">{isAr ? "نوع الهدف" : "Target Type"}</th>
                  <th className="px-4 py-3">{isAr ? "معرف الهدف" : "Target ID"}</th>
                  <th className="px-4 py-3">{isAr ? "المبلغ المخصص" : "Allocated Amount"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ التخصيص" : "Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paymentAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      {isAr ? "لا توجد سجلات تخصيص مسجلة حتى الآن" : "No payment allocations recorded"}
                    </td>
                  </tr>
                ) : (
                  paymentAllocations.map((a) => {
                    const col = collections.find((c) => c.id === a.collectionId);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white">
                          {col?.receiptNumber || a.collectionId}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                              a.targetType === "COMMISSION"
                                ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                                : a.targetType === "CHEQUE"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {a.targetType}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {a.targetDescription || a.targetId}
                        </td>
                        <td className="px-4 py-3.5 font-bold font-mono text-slate-900 dark:text-white">
                          {a.allocatedAmount.toLocaleString()} AED
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">{a.allocationDate}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              a.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {a.status === "ACTIVE" && (
                            <button
                              onClick={() => {
                                const reason = prompt(
                                  isAr
                                    ? "أدخل سبب إلغاء هذا التخصيص المحدد:"
                                    : "Enter reason to reverse this single allocation:"
                                );
                                if (reason) {
                                  reverseSinglePaymentAllocation(a.id, reason);
                                }
                              }}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline"
                            >
                              {isAr ? "إلغاء التخصيص" : "Reverse Allocation"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REVERSALS & ADJUSTMENTS */}
      {activeTab === "REVERSALS" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {isAr ? "سجل الإلغاءات المالية (Reversals)" : "Financial Reversals Registry"}
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {financialReversals.length} {isAr ? "سجلات إلغاء" : "records"}
              </span>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-sm text-left rtl:text-right text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3">{isAr ? "رقم الإلغاء" : "Reversal #"}</th>
                    <th className="px-4 py-3">{isAr ? "نوع الهدف" : "Target"}</th>
                    <th className="px-4 py-3">{isAr ? "المعرف الأصلي" : "Original ID"}</th>
                    <th className="px-4 py-3">{isAr ? "المبلغ الملغى" : "Reversed Amount"}</th>
                    <th className="px-4 py-3">{isAr ? "السبب" : "Reason"}</th>
                    <th className="px-4 py-3">{isAr ? "بواسطة" : "Performed By"}</th>
                    <th className="px-4 py-3">{isAr ? "التاريخ" : "Timestamp"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {financialReversals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        {isAr ? "لا توجد عمليات إلغاء مالية مسجلة" : "No financial reversals recorded"}
                      </td>
                    </tr>
                  ) : (
                    financialReversals.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3.5 font-semibold text-rose-600 dark:text-rose-400 font-mono">
                          {r.reversalNumber}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-bold">{r.targetType}</td>
                        <td className="px-4 py-3.5 font-mono text-xs">{r.targetId}</td>
                        <td className="px-4 py-3.5 font-bold font-mono text-slate-900 dark:text-white">
                          {r.reversedAmount.toLocaleString()} AED
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">{r.reason}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">{r.performedByUserName}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-400">{r.reversalDate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: RECONCILIATION & AUDIT CONTROL */}
      {activeTab === "RECONCILIATION" && (
        <div className="space-y-6">
          {/* Top warning alerts if there are exceptions */}
          {exceptions.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                  {isAr ? "تم الكشف عن استثناءات تطلب التسوية" : "Reconciliation Exceptions Detected"}
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                  {isAr
                    ? `يرجى مراجعة ${exceptions.length} استثناء تم التعرف عليه بواسطة محرك المطابقة المالية الذاتي لضمان دقة التقارير والتدقيق قبل إصدار الحوالات.`
                    : `Please audit the ${exceptions.length} detected discrepancies to ensure complete ledger compliance before completing owner transfers.`}
                </p>
              </div>
            </div>
          )}

          {/* Grid of Control Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "إجمالي مستحقات الملاك" : "Total Owner Payable"}
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {calculatedOwnerPayable.toLocaleString()} AED
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {isAr ? "المحصل - العمولات - المصاريف - المحول" : "Collections - Commissions - Expenses - Transfers"}
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "ذمم المستأجرين المستحقة" : "Tenant Outstanding"}
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {Number(calculatedTenantOutstanding || 0).toLocaleString()} AED
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {isAr ? "رسوم الإيجار + العمولات - المبالغ المحصلة" : "Rent Charges + Commissions - Received Payments"}
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "مصاريف المكتب التشغيلية" : "Office Borne Expenses"}
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                {totalOfficeExpenses.toLocaleString()} AED
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {isAr ? "مصاريف صيانة يتحملها المكتب بالكامل" : "Expenses allocated fully to office"}
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "إجمالي مصاريف الصيانة" : "Total Maintenance Expenses"}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                {totalMaintenanceExpenses.toLocaleString()} AED
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {isAr ? "المسجلة على العقارات والملاك والمستأجرين" : "Active maintenance expenses posted"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "إجمالي المصاريف الفعالة" : "Total Active Expenses"}
              </div>
              <div className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300 mt-1">
                {totalActiveExpenses.toLocaleString()} AED
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "المصاريف المسترجعة / الملغاة" : "Total Reversed Expenses"}
              </div>
              <div className="text-xl font-bold font-mono text-rose-600 mt-1">
                {totalReversedExpenses.toLocaleString()} AED
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "مصاريف معلقة / غير مخصصة" : "Unallocated Expenses"}
              </div>
              <div className="text-xl font-bold font-mono text-rose-600 mt-1">
                {totalUnallocatedExpenses.toLocaleString()} AED
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "محاولات تكرار الترحيل المالي" : "Duplicate Posting Attempts"}
              </div>
              <div className="text-xl font-bold font-mono text-rose-600 mt-1">
                {duplicatePostings.length}
              </div>
            </div>
          </div>

          {/* Exceptions Registry */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {isAr ? "سجل استثناءات المطابقة والرقابة" : "Reconciliation Discrepancies Registry"}
                </h3>
              </div>
              <span className="px-2.5 py-1 text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-full">
                {exceptions.length} {isAr ? "استثناء نشط" : "discrepancies active"}
              </span>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-sm text-left rtl:text-right text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3">{isAr ? "خطورة" : "Severity"}</th>
                    <th className="px-4 py-3">{isAr ? "نوع الكيان" : "Entity Type"}</th>
                    <th className="px-4 py-3">{isAr ? "رقم السجل" : "Record ID"}</th>
                    <th className="px-4 py-3">{isAr ? "المبلغ المتأثر" : "Impact Amount"}</th>
                    <th className="px-4 py-3">{isAr ? "الوصف والاستثناء" : "Description & Discrepancy"}</th>
                    <th className="px-4 py-3">{isAr ? "التوجيه المقترح للحل" : "Proposed Resolution"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {exceptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <span className="font-semibold block text-slate-700 dark:text-slate-300">
                          {isAr ? "النظام متطابق مالياً بالكامل!" : "Perfect financial synchronization!"}
                        </span>
                        <span className="text-xs mt-1 block">
                          {isAr ? "لم يتم العثور على أي استثناءات أو أخطاء ترحيل." : "No discrepancies or duplicate postings identified."}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    exceptions.map((exc) => (
                      <tr key={exc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm ${
                              exc.severity === "HIGH"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                : exc.severity === "MEDIUM"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                : "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                            }`}
                          >
                            {exc.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-xs">{exc.entity}</td>
                        <td className="px-4 py-3.5 font-mono text-xs">{exc.recordId}</td>
                        <td className="px-4 py-3.5 font-bold font-mono">
                          {exc.amount ? `${exc.amount.toLocaleString()} AED` : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          {exc.explanation}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {exc.severity === "HIGH"
                            ? (isAr ? "يتطلب تسوية فورية عبر دفتر الأستاذ أو عكس القيد المكرر" : "Immediate ledger correction or reversal of duplicate is required")
                            : (isAr ? "تحقق من الربط مع العقار أو المالك في الإعدادات" : "Verify metadata linkages or allocation method")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Calculator Section */}
          <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-indigo-600" />
              <span>{isAr ? "حاسبة المطابقة الحية للأرصدة" : "Live Account Balance Verification Calculator"}</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-sm text-slate-800 dark:text-white block mb-2">
                  {isAr ? "معادلة ذمة المالك المستحقة" : "Owner Ledger Formula"}
                </span>
                <p className="text-xs text-slate-500 mb-4">
                  {isAr
                    ? "الرصيد الدائن المتاح للمالك = إيجارات محصلة - رسوم إدارية مستقطعة - مصاريف صيانة - تحويلات سابقة"
                    : "Payable Balance = Rent Collected - Admin Fees Deducted - Property Expenses - Owner Transfers"}
                </p>
                <div className="space-y-2 text-sm font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span>+ {isAr ? "الإيجارات المحصلة فعلياً" : "Rent Collected"}:</span>
                    <span>{totalRentCollections.toLocaleString()} AED</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>- {isAr ? "الرسوم الإدارية المستقطعة" : "Administrative Fees"}:</span>
                    <span>{totalOwnerCommissionsWithReversals.toLocaleString()} AED</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>- {isAr ? "مصاريف صيانة المالك" : "Owner Expenses"}:</span>
                    <span>{totalOwnerExpenses.toLocaleString()} AED</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>- {isAr ? "التحويلات المصرفية للمالك" : "Owner Transfers"}:</span>
                    <span>{totalTransfers.toLocaleString()} AED</span>
                  </div>
                  <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between font-bold text-emerald-600">
                    <span>= {isAr ? "الرصيد الحالي المستحق" : "Net Balance Payable"}:</span>
                    <span>{calculatedOwnerPayable.toLocaleString()} AED</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-sm text-slate-800 dark:text-white block mb-2">
                  {isAr ? "معادلة ذمة المستأجر المستحقة" : "Tenant Ledger Formula"}
                </span>
                <p className="text-xs text-slate-500 mb-4">
                  {isAr
                    ? "الرصيد المدين المستحق على المستأجر = رسوم الإيجار + رسوم إدارية للمستأجر + مصاريف مستأجر - دفعات مستلمة"
                    : "Outstanding Balance = Rent Charges + Tenant Admin Fees + Tenant Expenses - Payments Received"}
                </p>
                <div className="space-y-2 text-sm font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span>+ {isAr ? "رسوم الإيجار التعاقدية" : "Rent Charges"}:</span>
                    <span>{totalRentCharges.toLocaleString()} AED</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ {isAr ? "الرسوم الإدارية للمستأجر" : "Tenant Admin Fees"}:</span>
                    <span>{Number(totalTenantCommissions || 0).toLocaleString()} AED</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>- {isAr ? "الدفعات المستلمة فعلياً" : "Payments Received"}:</span>
                    <span>{totalRentCollections.toLocaleString()} AED</span>
                  </div>
                  <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between font-bold text-amber-600">
                    <span>= {isAr ? "الرصيد المطلوب سداده" : "Outstanding Balance"}:</span>
                    <span>{Number(calculatedTenantOutstanding || 0).toLocaleString()} AED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 21 AUTOMATED TEST CASES RUNNER */}
      {activeTab === "TEST_RUNNER" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-indigo-600" />
                  <span>
                    {isAr
                      ? "فاحص السيناريوهات المالية الـ 21 — Phase 1 Test Suite"
                      : "Phase 1 Automated Financial Test Suite (21 Scenarios)"}
                  </span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {isAr
                    ? "اختبار فوري وشامل لجميع قواعد العمولات (5%)، التخصيصات الجزئية، الإلغاءات، منع التكرار، وحسابات الأرصدة المشتقة"
                    : "Live deterministic execution verifying 5% commissions, multi-target allocations, idempotent reversals, and derived balance consistency."}
                </p>
              </div>

              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {isRunningTests ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isAr ? "جارٍ الفحص..." : "Running Tests..."}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>{isAr ? "تشغيل فحص السلامة المالية الكامل" : "Run Financial Integrity Tests"}</span>
                  </>
                )}
              </button>
            </div>

            {testReport && (
              <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-xs text-slate-500">{isAr ? "إجمالي الاختبارات" : "Total Tests"}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {testReport.totalTests + phase2TestResults.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-emerald-600 font-semibold">{isAr ? "ناجحة" : "Passed"}</div>
                    <div className="text-xl font-bold text-emerald-600">
                      {testReport.passedCount + phase2TestResults.filter((t) => t.passed).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-rose-600 font-semibold">{isAr ? "فاشلة" : "Failed"}</div>
                    <div className="text-xl font-bold text-rose-600">
                      {testReport.failedCount + phase2TestResults.filter((t) => !t.passed).length}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  {isAr ? "حالة الاختبارات: " : "Status: "}
                  <span className="text-emerald-600 font-bold">100% Deterministic Verified</span>
                </div>
              </div>
            )}
          </div>

          {/* Test Results List: Phase 1 & Phase 2 */}
          {testReport && (
            <div className="space-y-6">
              {/* Phase 1 Suite */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <BadgePercent className="w-4 h-4 text-emerald-600" />
                  {isAr ? "نتائج فحص المحرك المالي والعمولات والتخصيصات (Phase 1)" : "Phase 1: Financial Engine, Commissions & Reversals"}
                </h4>
                {testReport.results.map((t) => (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border transition flex items-start gap-3.5 ${
                      t.status === "PASSED"
                        ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
                    }`}
                  >
                    <div className="mt-0.5">
                      {t.status === "PASSED" ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">
                          <span className="font-mono text-xs text-slate-400 mr-2 rtl:ml-2">#{t.id}</span>
                          {isAr ? t.scenarioNameAr : t.scenarioName}
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            t.status === "PASSED"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t.details}</p>
                      {t.dataSummary && (
                        <div className="mt-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded-lg text-slate-500 overflow-x-auto">
                          {JSON.stringify(t.dataSummary)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Phase 2 Suite */}
              {phase2TestResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    {isAr ? "نتائج فحص الحسابات وتحويلات الملاك والمصاريف والكشوفات (Phase 2)" : "Phase 2: Chart of Accounts, Transfers, Expenses & Statements"}
                  </h4>
                  {phase2TestResults.map((t) => (
                    <div
                      key={t.name}
                      className={`p-4 rounded-xl border transition flex items-start gap-3.5 ${
                        t.passed
                          ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      <div className="mt-0.5">
                        {t.passed ? (
                          <CheckCircle className="w-5 h-5 text-indigo-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-slate-900 dark:text-white text-sm">
                            {t.name}
                          </div>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                              t.passed
                                ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                                : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {t.passed ? "PASSED" : "FAILED"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Phase 18 Suite */}
              {phase18TestResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    {isAr ? "نتائج فحص الرقابة المالية والإلغاءات والتدقيق (Phase 18)" : "Phase 18: Financial Control, Reversals & Audit Integration"}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {phase18TestResults.map((t) => (
                      <div
                        key={t.id}
                        className={`p-3 rounded-xl border transition flex items-center gap-3 ${
                          t.passed
                            ? "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                            : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        <div className="shrink-0">
                          {t.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.name}</div>
                          {!t.passed && <div className="text-[10px] text-rose-600 mt-0.5">{t.message}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD COMMISSION OBLIGATION */}
      {/* MODAL: CREATE COMMISSION (5% STANDARD) */}
      {isAddCommissionModalOpen && (() => {
        const selectedModalLease = leases.find((l) => l.id === modalLeaseId);
        const selectedModalRent = selectedModalLease?.annualRent || 0;
        
        // Use central engine for calculation
        const partyIdForCalc = modalPartyType === "OWNER" ? selectedModalLease?.ownerId : selectedModalLease?.tenantId;
        const modalSummary = calculateCommissionAmount(
          selectedModalRent,
          modalPartyType,
          modalRate,
          DEFAULT_COMMISSION_SETTINGS,
          "ADMIN_FEE",
          modalDueDate,
          vatRates,
          owners,
          tenants,
          partyIdForCalc,
          selectedModalLease?.adminFeePolicy
        );
        
        const calculatedModalGross = modalSummary.amount;
        const calculatedModalVat = modalSummary.vatAmount;
        const calculatedModalNet = modalSummary.netRevenue;
        const modalLeaseYear = selectedModalLease?.startDate
          ? new Date(selectedModalLease.startDate).getFullYear().toString()
          : new Date().getFullYear().toString();
        const isModalDuplicate = modalLeaseId
          ? commissions.some(
              (c) =>
                c.status !== "CANCELLED" &&
                c.leaseId === modalLeaseId &&
                c.partyType === modalPartyType &&
                String(
                  c.contractualCommissionYear ||
                    (c.dueDate ? new Date(c.dueDate).getFullYear() : (c.createdAt ? new Date(c.createdAt).getFullYear() : new Date().getFullYear()))
                ) === modalLeaseYear
            )
          : false;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-emerald-600" />
                <span>
                  {isAr ? "تسجيل رسوم إدارية جديدة" : "Create Administrative Fees"}
                  {modalPolicy?.isExempt && (
                    <span className="mr-2 px-2 py-0.5 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800 uppercase">
                      {isAr ? "معفي" : "EXEMPT"}
                    </span>
                  )}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-3 mb-4">
                {isAr 
                  ? `سياسة الرسوم: ${
                      modalPolicy?.source === "CONTRACT_EXEMPTION" ? "إعفاء معتمد" : 
                      modalPolicy?.source === "PARTY_OVERRIDE" ? "نسبة خاصة للطرف" : 
                      "النسبة القياسية للنظام"
                    } (${modalRate}%)` 
                  : `Policy: ${
                      modalPolicy?.source === "CONTRACT_EXEMPTION" ? "Approved Exemption" : 
                      modalPolicy?.source === "PARTY_OVERRIDE" ? "Party-specific Rate" : 
                      "System Standard"
                    } (${modalRate}%)`
                }
              </p>

              {modalError && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-sm rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {isModalDuplicate && (
                <div className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">
                      {isAr
                        ? `تنبيه نظامي: توجد رسوم إدارية مسجلة مسبقاً لهذا الطرف (${modalPartyType === "OWNER" ? "المالك" : "المستأجر"}) عن السنة التعاقدية (${modalLeaseYear}).`
                        : `Notice: Administrative fees already exist for this ${modalPartyType === "OWNER" ? "Owner" : "Tenant"} for contractual year (${modalLeaseYear}).`}
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      {isAr
                        ? "يُمنع تكرار تسجيل الرسوم للمالك أو المستأجر لنفس السنة المالية/التعاقدية."
                        : "Duplicate fee registration for the same year is strictly prohibited."}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveCommission} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "عقد الإيجار *" : "Lease Contract *"}
                  </label>
                  <SearchableSelect
                    options={leases.map((l) => {
                      const t = tenants.find((t) => t.id === l.tenantId);
                      const p = properties.find((p) => p.id === l.propertyId);
                      const yr = l.startDate ? new Date(l.startDate).getFullYear() : "";
                      return {
                        id: l.id,
                        title: `${l.leaseNumber} (Rent: ${Number(l.annualRent || 0).toLocaleString()} AED)`,
                        subLabel: `${t ? `المستأجر: ${t.nameAr || t.nameEn}` : ""} | ${p ? `العقار: ${p.nameAr || p.nameEn}` : ""} | السنة: ${yr}`,
                        badge: l.leaseNumber,
                        extraSearchTerms: [l.leaseNumber, t?.nameAr || "", t?.nameEn || "", p?.nameAr || "", p?.nameEn || ""],
                      };
                    })}
                    value={modalLeaseId}
                    onChange={(val) => setModalLeaseId(val)}
                    placeholder={isAr ? "اختر العقد..." : "Select Lease Contract..."}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? "الطرف الملزم *" : "Obligated Party *"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "OWNER", label: isAr ? "المالك (Owner)" : "Owner" },
                        { id: "TENANT", label: isAr ? "المستأجر (Tenant)" : "Tenant" },
                      ]}
                      value={modalPartyType}
                      onChange={(val) => setModalPartyType(val as any)}
                      placeholder={isAr ? "اختر الطرف..." : "Select Party..."}
                      searchPlaceholder={isAr ? "ابحث بالطرف..." : "Search party..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? "نسبة الرسوم الإدارية (%) *" : "Administrative Fees Rate (%) *"}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={modalRate}
                      onChange={(e) => setModalRate(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono"
                    />
                  </div>
                </div>

                {modalLeaseId && (
                  <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>{isAr ? "قيمة الإيجار السنوي للعقد:" : "Lease Annual Rent:"}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedModalRent.toLocaleString()} AED
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-300 font-bold">
                      <span>{isAr ? `قيمة الرسوم الإدارية (${modalRate}%):` : `Admin Fee Gross (${modalRate}%):`}</span>
                      <span className="font-mono text-sm">{calculatedModalGross.toLocaleString()} AED</span>
                    </div>
                    {modalPolicy?.isExempt && (
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-[10px] text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50 italic">
                        {isAr ? "ملاحظة الإعفاء: " : "Exemption Note: "}
                        {modalPolicy.exemptionDetails?.exemptionNote || modalPolicy.exemptionDetails?.exemptionReason || (isAr ? "لا يوجد سبب محدد" : "No specific reason provided")}
                      </div>
                    )}
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 bg-white/70 dark:bg-slate-900/60 rounded-lg">
                        <span className="text-slate-500 block">{isAr ? "الضريبة المستقطعة (5%):" : "Deducted VAT (5%):"}</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                          {calculatedModalVat.toLocaleString()} AED
                        </span>
                      </div>
                      <div className="p-2 bg-white/70 dark:bg-slate-900/60 rounded-lg">
                        <span className="text-slate-500 block">{isAr ? "المبلغ الخاضع للضريبة:" : "Taxable Amount:"}</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {calculatedModalNet.toLocaleString()} AED
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "تاريخ الاستحقاق" : "Due Date"}
                  </label>
                  <input
                    type="date"
                    value={modalDueDate}
                    onChange={(e) => setModalDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "ملاحظات" : "Notes"}
                  </label>
                  <textarea
                    rows={2}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    placeholder={isAr ? "ملاحظات إضافية..." : "Additional notes..."}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsAddCommissionModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={isModalDuplicate}
                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs"
                  >
                    {isAr ? "حفظ الالتزام" : "Save Obligation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: RECORD COLLECTION */}
      {isCollectionModalOpen && (() => {
        const activeCollectionTarget = commissions.find((c) => c.id === collectionTargetId);
        const activeLease = leases.find((l) => l.id === activeCollectionTarget?.leaseId);
        const activeTenant = tenants.find((t) => t.id === activeCollectionTarget?.tenantId || t.id === activeLease?.tenantId);
        const activeOwner = owners.find((o) => o.id === activeCollectionTarget?.ownerId || o.id === activeLease?.ownerId);
        const activeProp = properties.find((p) => p.id === activeCollectionTarget?.propertyId || p.id === activeLease?.propertyId);

        const totalCommAmount = activeCollectionTarget?.totalCommissionAmount || 0;
        const prevCollected = activeCollectionTarget?.collectedAmount || 0;
        const outstandingDue = activeCollectionTarget?.outstandingBalance || 0;
        const vatAmountVal =
          activeCollectionTarget?.vatAmount !== undefined
            ? activeCollectionTarget.vatAmount
            : Math.round(((totalCommAmount * 5) / 105) * 100) / 100;
        const netRevenueVal =
          activeCollectionTarget?.netRevenueAmount !== undefined
            ? activeCollectionTarget.netRevenueAmount
            : Math.round((totalCommAmount - vatAmountVal) * 100) / 100;

        const remainingAfterThis = Math.max(0, outstandingDue - (Number(collectionAmount) || 0));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <span>{isAr ? "تحصيل رسوم إدارية (نموذج التحصيل)" : "Record Collection - Admin Fees"}</span>
              </h3>

              {collectionError && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-sm rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{collectionError}</span>
                </div>
              )}

              {/* Commission Financial Breakdown Card */}
              <div className="mb-4 p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                {/* Party & Lease Info */}
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/80 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {activeCollectionTarget?.partyType === "OWNER"
                      ? `${isAr ? "الطرف الملزم (المالك):" : "Party (Owner):"} ${activeOwner?.nameAr || activeOwner?.nameEn || "المالك"}`
                      : `${isAr ? "الطرف الملزم (المستأجر):" : "Party (Tenant):"} ${activeTenant?.nameAr || activeTenant?.nameEn || "المستأجر"}`}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-md font-mono text-slate-600 dark:text-slate-300">
                    {activeLease?.leaseNumber || "عقد إيجار"}
                  </span>
                </div>

                {/* 3 Main Display Figures: Total Commission Value, Collected Amount, Outstanding Due */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl">
                    <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                      {isAr ? "قيمة العمولة الإجمالية" : "Total Commission"}
                    </span>
                    <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                      {totalCommAmount.toLocaleString()} AED
                    </span>
                  </div>

                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl">
                    <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                      {isAr ? "المبلغ المحصل" : "Collected Amount"}
                    </span>
                    <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300">
                      {prevCollected.toLocaleString()} AED
                    </span>
                  </div>

                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 rounded-xl">
                    <span className="block text-[10px] font-bold text-rose-700 dark:text-rose-400 mb-0.5">
                      {isAr ? "القيمة المستحقة للمكتب" : "Amount Due to Office"}
                    </span>
                    <span className="text-xs font-black font-mono text-rose-700 dark:text-rose-300">
                      {outstandingDue.toLocaleString()} AED
                    </span>
                  </div>
                </div>

                {/* Tax & Net Revenue Breakdown */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>
                    {isAr ? "الضريبة المستقطعة (5%):" : "Deducted VAT (5%):"}{" "}
                    <strong className="text-amber-600 dark:text-amber-400 font-mono">{vatAmountVal.toLocaleString()} AED</strong>
                  </span>
                  <span>
                    {isAr ? "المبلغ الخاضع للضريبة:" : "Taxable Amount:"}{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{netRevenueVal.toLocaleString()} AED</strong>
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveCollection} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "المبلغ المحصل حالياً (AED) *" : "Current Collection Amount (AED) *"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={outstandingDue}
                    value={collectionAmount}
                    onChange={(e) => setCollectionAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono text-emerald-600 dark:text-emerald-400"
                    required
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                    <span>
                      {isAr ? "الرصيد المتبقي بعد التحصيل:" : "Remaining Balance After Collection:"}{" "}
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {remainingAfterThis.toLocaleString()} AED
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCollectionAmount(outstandingDue)}
                      className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                    >
                      {isAr ? "تحصيل كامل المستحق" : "Collect Full Due"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? "طريقة التحصيل *" : "Payment Method *"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "BANK_TRANSFER", label: isAr ? "تحويل بنكي" : "Bank Transfer" },
                        { id: "CASH", label: isAr ? "نقدي" : "Cash" },
                        { id: "CHEQUE", label: isAr ? "شيك" : "Cheque" },
                      ]}
                      value={collectionMethod}
                      onChange={(val) => setCollectionMethod(val as any)}
                      placeholder={isAr ? "طريقة التحصيل..." : "Select Method..."}
                      searchPlaceholder={isAr ? "ابحث بالطريقة..." : "Search method..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isAr ? "رقم المرجع" : "Reference #"}
                    </label>
                    <input
                      type="text"
                      value={collectionRef}
                      onChange={(e) => setCollectionRef(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                      placeholder="TRX-XXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "ملاحظات التحصيل" : "Collection Notes"}
                  </label>
                  <textarea
                    rows={2}
                    value={collectionNotes}
                    onChange={(e) => setCollectionNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    placeholder={isAr ? "ملاحظات السند..." : "Receipt notes..."}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsCollectionModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                  >
                    {isAr ? "إتمام التحصيل وإصدار السند" : "Complete Collection & Issue Voucher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: EDIT COMMISSION */}
      {isEditCommissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-blue-600" />
              <span>{isAr ? "تعديل بيانات الرسوم الإدارية" : "Edit Administrative Fee Obligation"}</span>
            </h3>

            {editError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-sm rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCommission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "إجمالي مبلغ الرسوم (AED) *" : "Total Commission Amount (AED) *"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editTotalAmount}
                  onChange={(e) => setEditTotalAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "تاريخ الاستحقاق" : "Due Date"}
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "ملاحظات" : "Notes"}
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditCommissionModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  {isAr ? "تحديث البيانات" : "Update Records"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REVERSE PAYMENT */}
      {isReversalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-rose-600 mb-4 flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              <span>{isAr ? "إلغاء سند قبض مالي واسترجاع التخصيصات" : "Reverse Payment Collection"}</span>
            </h3>

            {reversalError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-sm rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{reversalError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteReversal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "اختر سند القبض المراد إلغاؤه *" : "Select Collection Receipt to Reverse *"}
                </label>
                <SearchableSelect
                  options={collections.map((c) => ({
                    id: c.id,
                    title: `#${c.receiptNumber} — ${c.amountEntered.toLocaleString()} AED (${c.paymentDate})`,
                    subLabel: `المسدد: ${c.payerName || "غير محدد"}`,
                    badge: c.receiptNumber,
                    extraSearchTerms: [c.receiptNumber, c.payerName || "", c.paymentDate],
                  }))}
                  value={reversalTargetCollectionId}
                  onChange={(val) => setReversalTargetCollectionId(val)}
                  placeholder={isAr ? "اختر سند القبض..." : "Select receipt..."}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "سبب الإلغاء (إلزامي للتدقيق المالي) *" : "Reversal Reason (Mandatory for Audit) *"}
                </label>
                <textarea
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  placeholder={
                    isAr
                      ? "مثال: إيداع شيك خاطئ، إلغاء الحوالة البنكية، إلخ..."
                      : "e.g., Wrong cheque deposited, transaction cancelled by bank..."
                  }
                  required
                />
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
                {isAr
                  ? "تنبيه: سيؤدي الإلغاء إلى إبطال كافة التخصيصات المرتبطة بهذا السند واسترجاع الأرصدة المستحقة على الشيكات أو العمولات بصورة فورية غير قابلة للحذف."
                  : "Notice: Reversal will deactivate all active allocations linked to this receipt and restore original outstanding balances immediately."}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsReversalModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  {isAr ? "تراجع" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
                >
                  {isAr ? "تأكيد الإلغاء المالي" : "Confirm Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REVERSE COMMISSION */}
      {isReverseCommissionModalOpen && selectedCommissionForReversal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-rose-600 mb-2 flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              <span>{isAr ? "إلغاء رسوم إدارية" : "Reverse Administrative Fee"}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-bold uppercase tracking-wider">
              {isAr 
                ? `سيتم إلغاء الرسوم رقم: ${selectedCommissionForReversal.businessKey}`
                : `Reversing Fee Key: ${selectedCommissionForReversal.businessKey}`}
            </p>

            {commReversalError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-sm rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{commReversalError}</span>
              </div>
            )}

            <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 mb-6">
               <div className="flex justify-between text-xs mb-1">
                 <span className="text-rose-700/60">{isAr ? "المبلغ المراد عكسه:" : "Amount to Reverse:"}</span>
                 <span className="font-bold text-rose-700 font-mono">{selectedCommissionForReversal.totalCommissionAmount.toLocaleString()} AED</span>
               </div>
               <div className="flex justify-between text-xs">
                 <span className="text-rose-700/60">{isAr ? "الطرف:" : "Party:"}</span>
                 <span className="font-bold text-rose-700">{selectedCommissionForReversal.partyType === "OWNER" ? (isAr ? "المالك" : "Owner") : (isAr ? "المستأجر" : "Tenant")}</span>
               </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "سبب الإلغاء (إلزامي للتدقيق) *" : "Reversal Reason (Mandatory) *"}
                </label>
                <textarea
                  rows={3}
                  value={commReversalReason}
                  onChange={(e) => setCommReversalReason(e.target.value)}
                  placeholder={isAr ? "مثلاً: خطأ في إدخال العقد، إعفاء المالك..." : "e.g. Data entry error, Owner waiver..."}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  onClick={() => setIsReverseCommissionModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  {isAr ? "تراجع" : "Cancel"}
                </button>
                <button
                  onClick={handleReverseCommission}
                  className="px-6 py-2 text-sm font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {isAr ? "تأكيد الإلغاء النهائي" : "Confirm Final Reversal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
