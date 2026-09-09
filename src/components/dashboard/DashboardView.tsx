import React, { useMemo, useState, useEffect, useRef } from "react";
import { 
  Building2, 
  Users, 
  FileText, 
  Wrench,
  AlertTriangle,
  CreditCard,
  Scale,
  Calendar,
  Bell,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Activity,
  ShieldCheck,
  Home,
  FileSpreadsheet,
  AlertCircle,
  Database,
  Server,
  Lock,
  ChevronRight,
  Info,
  Receipt,
  TrendingUp,
  Flame,
  Siren,
  Percent,
  Eye,
  Zap,
  Phone,
  Check,
  ShieldAlert
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useNavigation } from "../../context/NavigationContext";
import { detectAdminFeeExceptions } from "../../utils/feeExceptionDetector";
import { calculateFinalSystemHealthScore } from "../../utils/finalSystemHealthScore";
import { getFinalProductionBaseline } from "../../utils/finalProductionBaseline";
import { getActiveAlerts } from "../../utils/productionAlertEngine";
import { RiskAssessmentDashboard } from "./RiskAssessmentDashboard";
import { ExecutiveMaintenanceDashboard } from "./ExecutiveMaintenanceDashboard";
import { MaintenanceDetailsModal } from "../maintenance/MaintenanceDetailsModal";
import { MaintenanceRequest, Lease } from "../../types";
import { DepositDelayAlert } from "./alerts/DepositDelayAlert";

interface DashboardViewProps {
  onNavigateToCheques?: () => void;
  onNavigateToBouncedCheques?: () => void;
  onNavigateToProperties?: () => void;
  onNavigateToTenants?: () => void;
  onNavigateToLeases?: () => void;
  onNavigateToMaintenance?: () => void;
  onNavigateToCases?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToUnits?: () => void;
  onNavigateToCollections?: () => void;
  onNavigateToOwners?: () => void;
  onSelectTenant?: (tenant: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToCheques,
  onNavigateToBouncedCheques,
  onNavigateToProperties,
  onNavigateToTenants,
  onNavigateToLeases,
  onNavigateToMaintenance,
  onNavigateToCases,
  onNavigateToNotifications,
  onNavigateToUnits,
  onNavigateToCollections,
  onNavigateToOwners,
  onSelectTenant
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const { navigateTo } = useNavigation();

  const { 
    properties, 
    units, 
    tenants, 
    leases, 
    cheques, 
    cases, 
    maintenanceRequests, 
    collectionActions,
    collections,
    ownerTransfers,
    owners = [],
    commissions = [],
    financialReversals = [],
    vatRates = []
  } = useData();

  // Admin Fee & Contract Exceptions Detection for Dashboard Monitoring
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

  const activeContractExceptionsCount = feeExceptionsData.summary.totalActiveExceptions;

  const handleOpenContractExceptions = () => {
    navigateTo("FINANCIALS");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("set-financials-tab", { detail: { tab: "EXCEPTION_CENTER" } }));
      window.dispatchEvent(new CustomEvent("set-fee-exceptions-filter", { detail: { filter: "ACTIVE" } }));
    }, 100);
  };

  // Selected tab state
  const [activeTab, setActiveTab] = useState<"OPERATIONS" | "MAINTENANCE" | "RISK">("OPERATIONS");
  const [isUrgentAlertDismissed, setIsUrgentAlertDismissed] = useState(false);
  const [selectedMaintRequestForDetails, setSelectedMaintRequestForDetails] = useState<MaintenanceRequest | null>(null);

  // Translations
  const dTrans = {
    ar: {
      title: "صقر الإمارات للعقارات",
      subtitle: "لوحة العمليات التشغيلية والإدارة التنفيذية",
      status: "معتمد تشغيلياً",
      health: "صحة النظام",
      tabUnified: "لوحة التحكم التنفيذية الموحدة",
      tabOperations: "العمليات والشاغر والمركز المالي",
      tabMaintenance: "إشعارات ومؤشرات الصيانة التنفيذية",
      tabFinancial: "التحليلات والمركز المالي",
      tabRisk: "التنبؤ الذكي للمخاطر (AI)",
      kpiBouncedAmount: "إجمالي الشيكات المرتجعة",
      kpiCollectedAmount: "إجمالي المبالغ المحصلة",
      kpiOutstandingAmount: "المبالغ المتبقية غير المحصلة",
      kpiCollectionRate: "نسبة التحصيل الإجمالية",
      kpiBouncedCount: "عدد الشيكات المرتجعة",
      kpiOpenCases: "القضايا الإيجارية المفتوحة",
      kpiCasesClaimAmount: "مطالبات القضايا الإيجارية",
      kpiUpcomingHearings: "الجلسات القضائية القادمة",
      chartTitle: "مقارنة التحصيلات بالشيكات المرتجعة (6 أشهر الأخيرة)",
      pieTitle: "أسباب إرجاع الشيكات المرتجعة",
      noReasons: "لا توجد بيانات شيكات مرتجعة كافية للرسم البياني",
      collectedLabel: "التحصيلات",
      bouncedLabel: "المرتجع",
      followUpsTitle: "متابعات ومراجعات مطلوبة",
      followUpWith: "متابعة مع المستأجر:",
      noDetails: "لا توجد تفاصيل",
      followUpDate: "تاريخ المتابعة:",
      contractsTitle: "العقود الإيجارية",
      expiredContracts: "عقود منتهية",
      expiring15: "تجديد خلال 15 يوم",
      expiring30: "تجديد خلال 30 يوم",
      activeContracts: "عقود سارية",
      contractExceptions: "استثناءات العقود",
      contractExceptionsSubtitle: "إعفاءات وتخفيضات رسوم تتطلب مراجعة",
      unitsTitle: "الوحدات الإيجارية",
      vacantUnits: "وحدات شاغرة",
      rentedUnits: "وحدات مؤجرة",
      totalUnits: "إجمالي الوحدات المسجلة",
      casesTitle: "القضايا الإيجارية",
      caseOpen: "مفتوحة",
      caseInProgress: "قيد التنفيذ",
      caseClosed: "مغلقة",
      opsTitle: "مؤشرات العمليات",
      bouncedChequesOps: "الشيكات المرتجعة",
      openMaintenanceOps: "طلبات الصيانة المفتوحة",
      pendingChequesOps: "الشيكات المعلقة",
      dataHealthy: "سليمة",
      securityProtected: "محمي",
      backupReady: "جاهز",
      dataLabel: "البيانات:",
      securityLabel: "الأمان:",
      backupLabel: "النسخ الاحتياطي:",
      criticalAlerts: "توجد تنبيهات نظام حيوية",
      versionLabel: "الإصدار"
    },
    en: {
      title: "Emirates Falcon ERP",
      subtitle: "Real Estate Operations & Executive Control Center",
      status: "Production Accepted",
      health: "System Health",
      tabUnified: "Unified Executive Control",
      tabOperations: "Operations, Vacancy & Financial Center",
      tabMaintenance: "Executive Maintenance & Indicators",
      tabFinancial: "Financial Analytics",
      tabRisk: "Intelligent Risk Assessment (AI)",
      kpiBouncedAmount: "Total Bounced Amount",
      kpiCollectedAmount: "Total Collected Amount",
      kpiOutstandingAmount: "Total Outstanding Amount",
      kpiCollectionRate: "Collection Rate",
      kpiBouncedCount: "Bounced Cheques Count",
      kpiOpenCases: "Open Rental Cases",
      kpiCasesClaimAmount: "Cases Claim Amount",
      kpiUpcomingHearings: "Upcoming Hearings",
      chartTitle: "Collections vs Bounced (Last 6 Months)",
      pieTitle: "Bounced Return Reasons",
      noReasons: "Not enough data for visualization",
      collectedLabel: "Collected",
      bouncedLabel: "Bounced",
      followUpsTitle: "Pending Follow-ups",
      followUpWith: "Follow-up with Tenant:",
      noDetails: "No details",
      followUpDate: "Follow-up Date:",
      contractsTitle: "Rental Contracts",
      expiredContracts: "Expired Contracts",
      expiring15: "Expiring in 15 Days",
      expiring30: "Expiring in 30 Days",
      activeContracts: "Active Contracts",
      contractExceptions: "Contract Exceptions",
      contractExceptionsSubtitle: "Fee exemptions & reductions requiring review",
      unitsTitle: "Property Units",
      vacantUnits: "Vacant Units",
      rentedUnits: "Rented Units",
      totalUnits: "Total Registered Units",
      casesTitle: "Rental Cases",
      caseOpen: "Open",
      caseInProgress: "In Progress",
      caseClosed: "Closed",
      opsTitle: "Operations Overview",
      bouncedChequesOps: "Bounced",
      openMaintenanceOps: "Open Maintenance Requests",
      pendingChequesOps: "Pending Items",
      dataHealthy: "Healthy",
      securityProtected: "Protected",
      backupReady: "Ready",
      dataLabel: "Data:",
      securityLabel: "Security:",
      backupLabel: "Backup:",
      criticalAlerts: "Critical System Alerts Active",
      versionLabel: "Version"
    }
  };

  const t = isAr ? dTrans.ar : dTrans.en;

  const getTenantName = (id: string) => {
    const tenant = tenants.find((tenantItem) => tenantItem.id === id);
    if (!tenant) return isAr ? "غير معروف" : "Unknown";
    return isAr ? tenant.nameAr : tenant.nameEn;
  };

  const navToLeases = (filter: string) => {
    sessionStorage.setItem("ef_lease_initial_filter", filter);
    onNavigateToLeases?.();
  };

  const navToUnits = (filter: string) => {
    sessionStorage.setItem("ef_unit_initial_filter", filter);
    onNavigateToUnits?.();
  };

  const navToCases = (filter: string) => {
    sessionStorage.setItem("ef_case_initial_filter", filter);
    onNavigateToCases?.();
  };

  // Date Logic for Leases (Robust matching for active, expired, expiring 15/30)
  const { activeLeases, expiredLeases, expiring15, expiring30 } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const d15 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15, 23, 59, 59).getTime();
    const d30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59).getTime();

    const isCancelledOrTerminated = (st?: string) => {
      const s = (st || "").toUpperCase().trim();
      return s === "TERMINATED" || s === "CANCELLED";
    };

    const isLeaseActive = (l: Lease) => {
      const status = (l.contractStatus || (l as any).status || "").toUpperCase().trim();
      if (isCancelledOrTerminated(status)) return false;
      if (status === "EXPIRED") return false;

      // Recognized active states
      if (
        status === "ACTIVE" ||
        status === "RENEWED" ||
        status === "UNDER_RENEWAL" ||
        status === "PENDING_APPROVAL" ||
        status === "PENDING" ||
        status === "DRAFT" ||
        !status
      ) {
        return true;
      }

      // Check date if endDate exists
      if (l.endDate) {
        const end = new Date(l.endDate).getTime();
        if (!isNaN(end)) {
          return end >= todayStart;
        }
      }

      return false;
    };

    const isLeaseExpired = (l: Lease) => {
      const status = (l.contractStatus || (l as any).status || "").toUpperCase().trim();
      if (isCancelledOrTerminated(status)) return false;
      if (status === "EXPIRED") return true;

      // If endDate has passed and status is not actively RENEWED or UNDER_RENEWAL
      if (l.endDate) {
        const end = new Date(l.endDate).getTime();
        if (!isNaN(end) && end < todayStart && status !== "RENEWED" && status !== "UNDER_RENEWAL" && status !== "ACTIVE") {
          return true;
        }
      }
      return false;
    };

    const active = leases.filter(isLeaseActive);
    const expired = leases.filter(isLeaseExpired);

    const exp15 = active.filter((l) => {
      if (!l.endDate) return false;
      const ed = new Date(l.endDate).getTime();
      return !isNaN(ed) && ed >= todayStart && ed <= d15;
    });

    const exp30 = active.filter((l) => {
      if (!l.endDate) return false;
      const ed = new Date(l.endDate).getTime();
      return !isNaN(ed) && ed >= todayStart && ed <= d30;
    });

    return { activeLeases: active, expiredLeases: expired, expiring15: exp15, expiring30: exp30 };
  }, [leases]);

  // Unit Stats
  const vacantUnits = useMemo(() => units.filter((u) => (u.status || "").toUpperCase() === "VACANT"), [units]);
  const rentedUnits = useMemo(() => units.filter((u) => {
    const s = (u.status || "").toUpperCase();
    return s === "OCCUPIED" || s === "RENTED";
  }), [units]);

  // Case Stats
  const openCases = useMemo(() => cases.filter((c) => {
    const s = (c.status || "").toUpperCase();
    return s === "NEW" || s === "UNDER_REVIEW" || s === "LEGAL_NOTICE" || s === "FILED";
  }), [cases]);

  const inProgressCases = useMemo(() => cases.filter((c) => {
    const s = (c.status || "").toUpperCase();
    return s === "IN_PROGRESS" || s === "HEARING_SCHEDULED" || s === "JUDGMENT_ISSUED" || s === "ENFORCEMENT" || s === "SETTLEMENT_IN_PROGRESS";
  }), [cases]);

  const closedCases = useMemo(() => cases.filter((c) => {
    const s = (c.status || "").toUpperCase();
    return s === "CLOSED" || s === "SETTLED" || s === "ARCHIVED";
  }), [cases]);

  // Employee Notifications (Follow-ups)
  const pendingFollowUps = useMemo(() => collectionActions.filter((a) => {
    const s = (a.status || "").toUpperCase();
    return s === "OPEN" || s === "ESCALATED" || s === "PROMISED" || s === "NO_RESPONSE";
  }).filter((a) => a.nextFollowUpDate).sort((a, b) => {
    return new Date(a.nextFollowUpDate!).getTime() - new Date(b.nextFollowUpDate!).getTime();
  }), [collectionActions]);

  // Operations counters
  const pendingCheques = useMemo(() => cheques.filter((c) => {
    const s = (c.status || "").toUpperCase();
    return s === "PENDING" || s === "POST_DATED";
  }), [cheques]);

  const pendingChequesToday = useMemo(() => {
    const today = new Date();
    return pendingCheques.filter((c) => {
      if (!c.dueDate) return false;
      const d = new Date(c.dueDate);
      return d.getDate() === today.getDate() && 
             d.getMonth() === today.getMonth() && 
             d.getFullYear() === today.getFullYear();
    }).length;
  }, [pendingCheques]);

  const newMaintenanceRequestsCount = useMemo(() => {
    return maintenanceRequests.filter(
      (r) => (r.status || "").toUpperCase() === "OPEN" || (r.status || "").toUpperCase() === "NEW"
    ).length;
  }, [maintenanceRequests]);

  const bouncedChequesList = useMemo(() => cheques.filter((c) => {
    const s = (c.status || "").toUpperCase();
    const orig = ((c as any).originalStatus || "").toUpperCase();
    return s === "BOUNCED" || orig === "BOUNCED";
  }), [cheques]);

  // Urgent Maintenance alerts calculation
  const urgentMaintenanceRequests = useMemo(() => {
    return maintenanceRequests.filter(
      (r) => 
        (r.priority === "URGENT" || (r as any).isEmergency) &&
        r.status !== "COMPLETED" &&
        r.status !== "CANCELLED" &&
        r.status !== "REJECTED"
    );
  }, [maintenanceRequests]);
  const urgentMaintenanceCount = urgentMaintenanceRequests.length;

  const prevUrgentCountRef = useRef<number>(urgentMaintenanceCount);

  // Gentle audio chime synthesizer tone when a new critical/urgent ticket arrives
  const playUrgentChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12); // D6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch (e) {
      // Audio playback restriction or unsupported
    }
  };

  // Immediate real-time response: When a new urgent request arrives,
  // ensure the alert banner is immediately visible on the operations screen without page refresh
  useEffect(() => {
    if (urgentMaintenanceCount > prevUrgentCountRef.current) {
      setIsUrgentAlertDismissed(false);
      playUrgentChime();
    }
    prevUrgentCountRef.current = urgentMaintenanceCount;
  }, [urgentMaintenanceCount]);

  useEffect(() => {
    const handleUrgentEvent = () => {
      setIsUrgentAlertDismissed(false);
      playUrgentChime();
    };
    window.addEventListener("urgent-maintenance-received", handleUrgentEvent);
    return () => window.removeEventListener("urgent-maintenance-received", handleUrgentEvent);
  }, []);

  // Core Financial calculations from the old dashboard view
  const financialKPIs = useMemo(() => {
    // 1. Total Bounced Cheques Amount
    const totalBouncedAmount = bouncedChequesList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    // 2. Total Collected Amount
    const totalCollectedAmount = collections.reduce((sum, c) => sum + (c.amountApplied || c.amountEntered || 0), 0);

    // 3. Total Outstanding Tenant Balance
    const totalContractRent = leases.reduce((sum, l) => sum + (l.annualRent || 0), 0);
    const totalOutstandingAmount = Math.max(0, totalContractRent - totalCollectedAmount);

    // 4. Collection Rate
    const collectionRate = totalContractRent > 0 ? (totalCollectedAmount / totalContractRent) * 100 : 0;

    // 5. Bounced Count
    const bouncedCount = bouncedChequesList.length;

    // 6. Open Cases Count
    const openCasesCount = cases.filter(c => c.status !== "CLOSED" && c.status !== "SETTLED" && c.status !== "ARCHIVED").length;

    // 7. Cases Claim Amount
    const casesClaimAmount = cases.reduce((sum, c) => sum + (Number(c.claimAmount) || 0), 0);

    // 8. Upcoming Hearings Count (either labeled HEARING_SCHEDULED or has sessions/hearings)
    const upcomingHearingsCount = cases.filter(c => {
      const hasSessions = c.sessions && c.sessions.length > 0;
      const hasHearings = c.hearings && c.hearings.length > 0;
      return c.status === "HEARING_SCHEDULED" || hasSessions || hasHearings;
    }).length;

    return {
      totalBouncedAmount,
      totalCollectedAmount,
      totalOutstandingAmount,
      collectionRate,
      bouncedCount,
      openCasesCount,
      casesClaimAmount,
      upcomingHearingsCount,
    };
  }, [bouncedChequesList, collections, leases, cases]);

  // Real-time Monthly trends chart data
  const monthlyChartData = useMemo(() => {
    const result = [];
    const now = new Date();
    const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();
      
      const label = isAr ? monthNamesAr[mMonth] : monthNamesEn[mMonth];
      
      // Calculate real collections in this month/year
      const monthCollections = collections.filter(c => {
        const cDate = new Date(c.paymentDate || c.createdAt || "");
        return cDate.getFullYear() === mYear && cDate.getMonth() === mMonth;
      }).reduce((sum, c) => sum + (c.amountApplied || c.amountEntered || 0), 0);

      // Calculate real bounced cheques in this month/year
      const monthBounced = cheques.filter(c => {
        const cStatus = c.status === "BOUNCED" || c.originalStatus === "BOUNCED";
        const cDate = new Date(c.dueDate || c.createdAt || "");
        return cStatus && cDate.getFullYear() === mYear && cDate.getMonth() === mMonth;
      }).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      result.push({
        name: label,
        [isAr ? "التحصيلات" : "Collected"]: monthCollections,
        [isAr ? "المرتجع" : "Bounced"]: monthBounced,
      });
    }
    return result;
  }, [collections, cheques, isAr]);

  // Real-time Pie chart data for Bounced cheque return reasons
  const bounceReasonsChartData = useMemo(() => {
    const reasonsMap: Record<string, number> = {};
    bouncedChequesList.forEach(c => {
      const reason = c.returnReason || "OTHER";
      reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;
    });

    const getReasonLabel = (reason: string) => {
      switch (reason) {
        case "INSUFFICIENT_FUNDS": return isAr ? "عدم كفاية الرصيد" : "Insufficient Funds";
        case "SIGNATURE_MISMATCH": return isAr ? "عدم مطابقة التوقيع" : "Signature Mismatch";
        case "ACCOUNT_CLOSED": return isAr ? "الحساب مغلق" : "Account Closed";
        case "REFER_TO_DRAWER": return isAr ? "الرجوع للساحب" : "Refer to Drawer";
        case "PAYMENT_STOPPED": return isAr ? "إيقاف صرف الشيك" : "Payment Stopped";
        default: return isAr ? "أسباب أخرى" : "Other Reasons";
      }
    };

    return Object.entries(reasonsMap).map(([reason, count]) => ({
      name: getReasonLabel(reason),
      value: count,
    })).sort((a, b) => b.value - a.value);
  }, [bouncedChequesList, isAr]);

  const PIE_COLORS = ["#e11d48", "#f59e0b", "#d97706", "#2563eb", "#6366f1", "#4f46e5", "#0d9488"];

  // System Health
  const healthResult = calculateFinalSystemHealthScore({ properties, leases, cheques });
  const baseline = getFinalProductionBaseline();
  const activeAlerts = getActiveAlerts();

  return (
    <div className="space-y-6 pb-12 w-full print:p-0">
      
      <DepositDelayAlert />

      {/* Executive Header */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between border border-slate-800 relative overflow-hidden gap-4">
        <div className="absolute top-0 right-0 p-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight mb-0.5">
            {t.title}
          </h1>
          <h2 className="text-amber-400 font-bold text-xs tracking-wide uppercase">
            {t.subtitle}
          </h2>
        </div>

        {/* Quick Navigation Buttons Bar - All buttons visible top-level without scrolling */}
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => {
              document.getElementById("operations-sec")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="px-3 py-1.5 text-xs font-black rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs cursor-pointer transition-all flex items-center gap-1"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{t.tabOperations}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              document.getElementById("maintenance-sec")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="px-3 py-1.5 text-xs font-black rounded-lg bg-slate-700 hover:bg-slate-600 text-white cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>{isAr ? "الصيانة التنفيذية" : "Maintenance"}</span>
            {urgentMaintenanceCount > 0 && (
              <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                {urgentMaintenanceCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              document.getElementById("financial-sec")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="px-3 py-1.5 text-xs font-black rounded-lg bg-slate-700 hover:bg-slate-600 text-white cursor-pointer transition-all flex items-center gap-1"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isAr ? "المركز المالي" : "Financials"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              document.getElementById("risk-sec")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="px-3 py-1.5 text-xs font-black rounded-lg bg-slate-700 hover:bg-slate-600 text-white cursor-pointer transition-all flex items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isAr ? "مخاطر النظام AI" : "AI Risk"}</span>
          </button>
        </div>

        <div className="relative z-10 hidden xl:flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl border border-slate-700 shrink-0">
          <div className="text-end">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isAr ? "الاعتماد" : "Status"}</div>
            <div className="text-emerald-400 font-black text-xs uppercase">{t.status}</div>
          </div>
          <div className="w-px h-6 bg-slate-600"></div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isAr ? "صحة النظام" : "Health"}</div>
            <div className="text-emerald-400 font-black text-xs">{healthResult.overallScore}%</div>
          </div>
        </div>
      </div>

      {/* DISMISSIBLE URGENT MAINTENANCE POPUP ALERT */}
      {urgentMaintenanceCount > 0 && !isUrgentAlertDismissed && (
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white p-5 rounded-2xl shadow-2xl border-2 border-rose-500 relative overflow-hidden urgent-flicker">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shrink-0">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black text-white">
                    {isAr ? "⚠️ تنبيه إداري عاجل: توجد بلاغات صيانة طارئة تتطلب تدخلاً فورياً!" : "⚠️ Urgent Alert: Emergency Maintenance Requests Require Immediate Action!"}
                  </h3>
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase animate-ping">
                    {isAr ? "طارئ" : "Emergency"}
                  </span>
                  <span className="bg-rose-600/60 text-rose-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {isAr ? "تحديث فوري مباشر" : "Live Real-Time Sync"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-rose-100 mt-1 max-w-3xl leading-relaxed">
                  {isAr 
                    ? `يوجد حالياً (${urgentMaintenanceCount}) بلاغ صيانة عاجل مفتوح في النظام لم يتم التعامل معه بعد. يستمر وميض التنبيه (Flicker) ولا يختفي حتى يقوم الموظف باتخاذ إجراء تنفيذي وتغيير حالة البلاغ.` 
                    : `There are currently (${urgentMaintenanceCount}) urgent maintenance requests pending action. The warning flicker remains active until an employee takes action and updates the ticket status.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              <button
                onClick={() => setActiveTab("MAINTENANCE")}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isAr ? "لوحة الصيانة التنفيذية" : "Executive Maintenance Board"}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsUrgentAlertDismissed(true)}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2.5 rounded-xl border border-white/20 transition-all cursor-pointer"
                title={isAr ? "إغلاق التنبيه المؤقت" : "Dismiss Alert"}
              >
                ✕ {isAr ? "إغلاق التنبيه" : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION A: Important Alerts / Employee Tasks */}
      {pendingFollowUps.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border-2 border-amber-200 overflow-hidden">
          <div className="bg-amber-50 px-5 py-3 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-700" />
              <h3 className="font-black text-amber-900 uppercase text-sm tracking-wide">
                {t.followUpsTitle}
              </h3>
            </div>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingFollowUps.slice(0, 4).map(action => (
              <div key={action.id} className="p-4 hover:bg-amber-50/50 transition-colors flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {t.followUpWith} {getTenantName(action.tenantId)}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      {action.actionType} - {action.notes || t.noDetails}
                    </p>
                    <span className="text-[10px] font-mono text-slate-400 block mt-1">
                      {t.followUpDate} {action.nextFollowUpDate ? new Date(action.nextFollowUpDate).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN RENDER ENGINE (UNIFIED SINGLE-PAGE MERGED VIEW) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-12"
      >
        {/* SECTION 1: OPERATIONS, VACANCY & FINANCIAL ANALYTICS */}
        <div id="operations-sec" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-200 pb-3 flex items-center gap-3">
            <span className="w-1.5 h-6 bg-slate-900 rounded-full"></span>
            <h2 className="text-lg font-black text-slate-900">{t.tabOperations}</h2>
          </div>

          {/* Quick Statistics Summary Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {isAr ? "إجمالي الوحدات النشطة" : "Total Active Units"}
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {rentedUnits.length}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {isAr ? "شيكات مستحقة اليوم" : "Pending Cheques Today"}
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {pendingChequesToday}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {isAr ? "طلبات صيانة جديدة" : "New Maintenance Requests"}
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {newMaintenanceRequestsCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: REAL ESTATE OPERATIONS & VACANCY PANELS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* Leases Dashboard Panel */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <h3 className="font-black text-slate-900 uppercase text-xs tracking-wide">
                          {t.contractsTitle}
                        </h3>
                      </div>
                      <button onClick={() => navToLeases("ALL")} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg transition-colors cursor-pointer">
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="p-3 grid grid-cols-2 gap-2">
                      <div 
                        onClick={() => navToLeases("EXPIRED")}
                        className="bg-rose-50/80 rounded-lg p-2 border border-rose-200 cursor-pointer hover:bg-rose-100/80 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-2xs text-rose-600 shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-sm font-black text-rose-900 leading-none">{expiredLeases.length}</div>
                            <div className="text-[10px] font-bold text-rose-700 uppercase mt-0.5">{t.expiredContracts}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-600 transition-colors rtl:rotate-180" />
                      </div>

                      <div 
                        onClick={() => navToLeases("ACTIVE")}
                        className="bg-emerald-50/80 rounded-lg p-2 border border-emerald-200 cursor-pointer hover:bg-emerald-100/80 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-2xs text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-sm font-black text-emerald-900 leading-none">{activeLeases.length}</div>
                            <div className="text-[10px] font-bold text-emerald-700 uppercase mt-0.5">{t.activeContracts}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-400 group-hover:text-emerald-600 transition-colors rtl:rotate-180" />
                      </div>

                      <div 
                        onClick={() => navToLeases("EXPIRING_15")}
                        className="bg-amber-50/80 rounded-lg p-2 border border-amber-200 cursor-pointer hover:bg-amber-100/80 transition-colors"
                      >
                        <div className="text-sm font-black text-amber-900 leading-none">{expiring15.length}</div>
                        <div className="text-[10px] font-bold text-amber-800 uppercase leading-tight mt-0.5">{t.expiring15}</div>
                      </div>

                      <div 
                        onClick={() => navToLeases("EXPIRING_30")}
                        className="bg-yellow-50/80 rounded-lg p-2 border border-yellow-200 cursor-pointer hover:bg-yellow-100/80 transition-colors"
                      >
                        <div className="text-sm font-black text-yellow-900 leading-none">{expiring30.length}</div>
                        <div className="text-[10px] font-bold text-yellow-800 uppercase leading-tight mt-0.5">{t.expiring30}</div>
                      </div>

                      {/* Contract & Fee Exceptions Dedicated Widget */}
                      <div 
                        onClick={handleOpenContractExceptions}
                        className={`col-span-2 rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between group ${
                          activeContractExceptionsCount > 0
                            ? "bg-rose-50/70 border-rose-200/90 hover:bg-rose-100/80 shadow-2xs"
                            : "bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/80"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-2xs shrink-0 ${
                            activeContractExceptionsCount > 0 ? "bg-white text-rose-600" : "bg-white text-slate-500"
                          }`}>
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-800">{t.contractExceptions}</span>
                              {activeContractExceptionsCount > 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 font-mono">
                                  🔴 {activeContractExceptionsCount}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  0 {isAr ? "سليم" : "None"}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{t.contractExceptionsSubtitle}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-600 transition-colors rtl:rotate-180" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Units Dashboard Panel */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                          <Home className="w-4 h-4" />
                        </div>
                        <h3 className="font-black text-slate-900 uppercase text-xs tracking-wide">
                          {t.unitsTitle}
                        </h3>
                      </div>
                      <button onClick={() => navToUnits("ALL")} className="text-sky-600 hover:bg-sky-50 p-1 rounded-lg transition-colors cursor-pointer">
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="p-3 grid grid-cols-2 gap-2">
                      <div 
                        onClick={() => navToUnits("VACANT")}
                        className="bg-emerald-50/80 rounded-lg p-2 border border-emerald-200 cursor-pointer hover:bg-emerald-100/80 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-2xs text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-base font-black text-emerald-900 leading-none">{vacantUnits.length}</div>
                            <div className="text-[10px] font-bold text-emerald-700 uppercase mt-0.5">{t.vacantUnits}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-400 group-hover:text-emerald-600 transition-colors rtl:rotate-180" />
                      </div>

                      <div 
                        onClick={() => navToUnits("OCCUPIED")}
                        className="bg-indigo-50/80 rounded-lg p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100/80 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-2xs text-indigo-600 shrink-0">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-base font-black text-indigo-900 leading-none">{rentedUnits.length}</div>
                            <div className="text-[10px] font-bold text-indigo-700 uppercase mt-0.5">{t.rentedUnits}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 transition-colors rtl:rotate-180" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3.5 py-1.5 border-t border-slate-100 bg-slate-50/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t.totalUnits}</span>
                    <span className="text-xs font-black text-slate-900">{units.length}</span>
                  </div>
                </div>

                {/* Rental Cases Status Panel */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                        <Scale className="w-4 h-4" />
                      </div>
                      <h3 className="font-black text-slate-900 uppercase text-xs tracking-wide">
                        {t.casesTitle}
                      </h3>
                    </div>
                    <button onClick={() => navToCases("ALL")} className="text-amber-600 hover:bg-amber-50 p-1 rounded-lg transition-colors cursor-pointer">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="p-3 grid grid-cols-3 gap-2">
                    <div onClick={() => navToCases("OPEN")} className="bg-amber-50/80 rounded-lg p-2 border border-amber-200 cursor-pointer hover:bg-amber-100/80 text-center flex flex-col items-center justify-center">
                      <div className="text-base font-black text-amber-900 mb-0.5">{openCases.length}</div>
                      <div className="text-[10px] font-bold text-amber-800 uppercase leading-tight">{t.caseOpen}</div>
                    </div>
                    <div onClick={() => navToCases("IN_PROGRESS")} className="bg-blue-50/80 rounded-lg p-2 border border-blue-200 cursor-pointer hover:bg-blue-100/80 text-center flex flex-col items-center justify-center">
                      <div className="text-base font-black text-blue-900 mb-0.5">{inProgressCases.length}</div>
                      <div className="text-[10px] font-bold text-blue-800 uppercase leading-tight">{t.caseInProgress}</div>
                    </div>
                    <div onClick={() => navToCases("CLOSED")} className="bg-slate-50/80 rounded-lg p-2 border border-slate-200 cursor-pointer hover:bg-slate-100/80 text-center flex flex-col items-center justify-center">
                      <div className="text-base font-black text-slate-900 mb-0.5">{closedCases.length}</div>
                      <div className="text-[10px] font-bold text-slate-700 uppercase leading-tight">{t.caseClosed}</div>
                    </div>
                  </div>
                </div>

                {/* Operations Overview & Action Counters */}
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h3 className="font-black text-slate-900 uppercase text-xs tracking-wide">
                        {t.opsTitle}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="p-2.5 space-y-1.5">
                    <div onClick={onNavigateToBouncedCheques} className="flex items-center justify-between p-2 rounded-lg bg-rose-50/80 border border-rose-100 cursor-pointer hover:bg-rose-100/80 transition-colors">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span className="text-xs font-bold text-rose-900">{t.bouncedChequesOps}</span>
                      </div>
                      <div className="text-xs font-black text-rose-700">{bouncedChequesList.length}</div>
                    </div>
                    
                    <div 
                      onClick={() => setActiveTab("MAINTENANCE")} 
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                        urgentMaintenanceCount > 0 
                          ? "bg-rose-50/80 border-2 border-rose-400 urgent-flicker hover:bg-rose-100" 
                          : "bg-blue-50/80 border border-blue-100 hover:bg-blue-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {urgentMaintenanceCount > 0 ? (
                          <Flame className="w-3.5 h-3.5 text-rose-600 animate-bounce" />
                        ) : (
                          <Wrench className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        <div>
                          <span className={`text-xs font-bold ${urgentMaintenanceCount > 0 ? "text-rose-900" : "text-blue-900"}`}>
                            {t.openMaintenanceOps}
                          </span>
                          {urgentMaintenanceCount > 0 && (
                            <span className="block text-[9px] font-black text-rose-600">
                              ⚠️ ({urgentMaintenanceCount}) {isAr ? "بلاغ عاجل" : "urgent"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {urgentMaintenanceCount > 0 && (
                          <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                            {urgentMaintenanceCount} {isAr ? "عاجل" : "Urgent"}
                          </span>
                        )}
                        <div className={`text-xs font-black ${urgentMaintenanceCount > 0 ? "text-rose-700" : "text-blue-700"}`}>
                          {maintenanceRequests.filter(m => m.status === "OPEN" || m.status === "IN_PROGRESS").length}
                        </div>
                      </div>
                    </div>

                    <div onClick={onNavigateToCheques} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-xs font-bold text-slate-900">{t.pendingChequesOps}</span>
                      </div>
                      <div className="text-xs font-black text-slate-700">{pendingCheques.length}</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* SECTION 2: FINANCIAL ANALYTICS & EXECUTIVE FINANCIAL CENTER */}
              <div id="financial-sec" className="space-y-6 pt-2 scroll-mt-20">
                
                {/* Financial Center Section Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-emerald-600 rounded-full"></div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        {isAr ? "التحليلات والمركز المالي التنفيذي" : "Financial Analytics & Executive Center"}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500">
                        {isAr ? "مؤشرات السيولة، كفاءة التحصيل، الشيكات المرتجعة، والمطالبات المالية" : "Liquidity, collection rates, bounced cheques, and financial claims"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* The Authoritative 8 financial KPI Cards from Emirates Falcon ERP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Total Bounced Cheques Amount */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                      <Flame className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                      {isAr ? "مرتجع حرج" : "CRITICAL"}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {financialKPIs.totalBouncedAmount.toLocaleString()} <span className="text-xs font-bold text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.kpiBouncedAmount}
                  </div>
                </div>

                {/* 2. Total Collected Amount */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      {isAr ? "محصل بالكامل" : "COLLECTED"}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {financialKPIs.totalCollectedAmount.toLocaleString()} <span className="text-xs font-bold text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.kpiCollectedAmount}
                  </div>
                </div>

                {/* 3. Total Outstanding Tenant Balance */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                      {isAr ? "مستحق السداد" : "OUTSTANDING"}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {financialKPIs.totalOutstandingAmount.toLocaleString()} <span className="text-xs font-bold text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.kpiOutstandingAmount}
                  </div>
                </div>

                {/* 4. Total Collection Rate */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-700">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {isAr ? "معدل التحصيل" : "COLLECTION RATE"}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {financialKPIs.collectionRate.toFixed(1)}%
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.kpiCollectionRate}
                  </div>
                </div>

                {/* 5. Bounced Cheques Count */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                      {isAr ? "عدد البنود" : "ITEMS COUNT"}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {financialKPIs.bouncedCount}
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.kpiBouncedCount}
                  </div>
                </div>

                {/* 6. Open Cases Count */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-purple-50 rounded-xl text-purple-700">
                      <Scale className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                      {isAr ? "منظورة قضائياً" : "DISPUTES"}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {financialKPIs.openCasesCount}
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.kpiOpenCases}
                  </div>
                </div>

                {/* 7. Cases Claim Amount */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-pink-50 rounded-xl text-pink-700">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-pink-700 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100">
                      {isAr ? "مطالبات مالية" : "CLAIMS"}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {financialKPIs.casesClaimAmount.toLocaleString()} <span className="text-xs font-bold text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.kpiCasesClaimAmount}
                  </div>
                </div>

                {/* 8. Upcoming Court Hearings */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-sky-50 rounded-xl text-sky-700">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                      {isAr ? "أجندة الجلسات" : "HEARINGS"}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {financialKPIs.upcomingHearingsCount}
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.kpiUpcomingHearings}
                  </div>
                </div>

              </div>

              {/* Graphical Charts Section (Old Dashboard charts restored dynamically) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Chart 1: Collections vs Bounced (Area/Bar Composed Chart) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-6">
                    {t.chartTitle}
                  </h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={monthlyChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorBounced" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          stroke="#94a3b8" 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                        />
                        <Tooltip 
                          contentStyle={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: "bold" }}
                          formatter={(value: any) => [`${Number(value).toLocaleString()} AED`]}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                        <Area type="monotone" dataKey={isAr ? "التحصيلات" : "Collected"} stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollected)" />
                        <Bar dataKey={isAr ? "المرتجع" : "Bounced"} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Cheque Return Reasons Breakdown (Pie Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">
                      {t.pieTitle}
                    </h3>
                    <div className="h-52 w-full flex items-center justify-center relative">
                      {bounceReasonsChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={bounceReasonsChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {bounceReasonsChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "bold" }}
                              formatter={(value: any) => [`${value} ${isAr ? "شيك" : "cheques"}`]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-xs text-slate-400 font-bold text-center">
                          {t.noReasons}
                        </div>
                      )}
                      
                      {bounceReasonsChartData.length > 0 && (
                        <div className="absolute flex flex-col items-center">
                          <span className="text-xl font-black text-slate-800">{bouncedChequesList.length}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{isAr ? "مرتجع" : "Bounced"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Legend indicator grid */}
                  <div className="mt-4 space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {bounceReasonsChartData.slice(0, 4).map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                          <span className="truncate">{entry.name}</span>
                        </div>
                        <span className="font-mono font-black text-slate-900 shrink-0">{entry.value}</span>
                      </div>
                    ))}
                  </div>

                </div>

              </div>

            </div>

          </div>

        {/* SECTION 2: EXECUTIVE MAINTENANCE DASHBOARD */}
        <div id="maintenance-sec" className="space-y-6 scroll-mt-20">
          <div className="border-b border-slate-200 pb-3 flex items-center gap-3">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
            <h2 className="text-lg font-black text-slate-900">{t.tabMaintenance}</h2>
          </div>
          <ExecutiveMaintenanceDashboard
            onNavigateToMaintenance={onNavigateToMaintenance}
            onSelectTenant={onSelectTenant}
          />
        </div>

        {/* SECTION 3: AI RISK ASSESSMENT DASHBOARD */}
        <div id="risk-sec" className="space-y-6 scroll-mt-20">
          <div className="border-b border-slate-200 pb-3 flex items-center gap-3">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
            <h2 className="text-lg font-black text-slate-900">{t.tabRisk}</h2>
          </div>
          <RiskAssessmentDashboard
            onSelectTenant={onSelectTenant}
            onNavigateToCases={() => navToCases("ALL")}
            onNavigateToCollections={onNavigateToCollections}
          />
        </div>

      </motion.div>

      {/* SECTION G: Minimal System Health Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Database className="w-4 h-4 text-slate-400" />
            <span className="font-bold">{t.dataLabel} <span className="text-emerald-600">{t.dataHealthy}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="font-bold">{t.securityLabel} <span className="text-indigo-600">{t.securityProtected}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <Server className="w-4 h-4 text-slate-400" />
            <span className="font-bold">{t.backupLabel} <span className="text-sky-600">{t.backupReady}</span></span>
          </div>
          {activeAlerts.some(a => a.severity === 'CRITICAL') && (
            <div className="flex items-center gap-1.5 text-rose-600 font-bold bg-rose-100 px-2 py-0.5 rounded animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {t.criticalAlerts}
            </div>
          )}
        </div>
        
        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
          <span>{t.versionLabel} v{baseline.appVersion}</span>
          <span>•</span>
          <span>{baseline.releaseId}</span>
        </div>
      </div>

      {/* Maintenance Details Modal directly available from Operations view */}
      {selectedMaintRequestForDetails && (
        <MaintenanceDetailsModal
          isOpen={!!selectedMaintRequestForDetails}
          request={selectedMaintRequestForDetails}
          onClose={() => setSelectedMaintRequestForDetails(null)}
        />
      )}

    </div>
  );
};
