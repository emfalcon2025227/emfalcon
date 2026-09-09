import React, { useState, useMemo } from "react";
import {
  Building2,
  Home,
  Users,
  UserCheck,
  FileText,
  DollarSign,
  Receipt,
  ArrowRightLeft,
  Wrench,
  FolderOpen,
  Gavel,
  MessageSquare,
  CheckSquare,
  History,
  ShieldCheck,
  Printer,
  FileSpreadsheet,
  Download,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowLeft,
  Search,
  Filter,
  CheckCircle2,
  Camera,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { OfficePrintHeader } from "../common/OfficePrintHeader";
import { DocumentScanner } from "../common/DocumentScanner";
import { Property, Unit, Lease, Tenant, Owner, Cheque, CollectionRecord, PropertyExpenseRecord, MaintenanceRequest, RentalCase, AuditLogEntry, OperationalDocumentRecord, OperationalTask, OperationalCommunicationRecord, DocumentCategory } from "../../types";
import { PropertyOccupancyAnalytics } from "./PropertyOccupancyAnalytics";

interface Property360WorkspaceProps {
  propertyId: string;
  onClose?: () => void;
  onNavigateToUnit?: (unitId: string) => void;
  onNavigateToTenant?: (tenantId: string) => void;
  onNavigateToOwner?: (ownerId: string) => void;
  onNavigateToLease?: (leaseId: string) => void;
}

export const Property360Workspace: React.FC<Property360WorkspaceProps> = ({
  propertyId,
  onClose,
  onNavigateToUnit,
  onNavigateToTenant,
  onNavigateToOwner,
  onNavigateToLease,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    properties,
    units,
    owners,
    tenants,
    leases,
    collections,
    commissions,
    propertyExpenses,
    ownerTransfers,
    maintenanceRequests,
    cases,
    cheques,
    auditLogs,
    companyProfile,
    archive,
  } = useData();

  // Active Tab state
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "analytics"
    | "units"
    | "owners"
    | "tenants"
    | "leases"
    | "financial_summary"
    | "collections"
    | "owner_transfers"
    | "expenses"
    | "maintenance"
    | "documents"
    | "cases"
    | "communications"
    | "tasks"
    | "timeline"
    | "audit"
  >("overview");

  const [unitSearch, setUnitSearch] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Target Property
  const property = useMemo(() => {
    return properties.find((p) => p.id === propertyId) || properties[0];
  }, [properties, propertyId]);

  // Linked Units
  const propertyUnits = useMemo(() => {
    if (!property) return [];
    return units.filter((u) => u.propertyId === property.id);
  }, [units, property]);

  // Linked Owners
  const propertyOwner = useMemo(() => {
    if (!property) return null;
    return owners.find((o) => o.id === property.ownerId) || null;
  }, [owners, property]);

  // Linked Leases
  const propertyLeases = useMemo(() => {
    if (!property) return [];
    return leases.filter((l) => l.propertyId === property.id);
  }, [leases, property]);

  // Active Leases
  const activeLeases = useMemo(() => {
    return propertyLeases.filter((l) => l.contractStatus === "ACTIVE");
  }, [propertyLeases]);

  // Linked Tenants
  const propertyTenants = useMemo(() => {
    const tenantIds = new Set(propertyLeases.map((l) => l.tenantId));
    return tenants.filter((t) => tenantIds.has(t.id));
  }, [tenants, propertyLeases]);

  // Linked Collections
  const propertyCollections = useMemo(() => {
    const propTenantIds = new Set(propertyTenants.map((t) => t.id));
    return collections.filter((c) => {
      const linkedCheque = cheques.find((ch) => ch.id === c.chequeId);
      if (linkedCheque?.propertyId === property?.id) return true;
      return c.tenantId && propTenantIds.has(c.tenantId);
    });
  }, [collections, property, propertyTenants, cheques]);

  // Linked Expenses
  const propertyExpenseList = useMemo(() => {
    if (!property) return [];
    return propertyExpenses.filter((e) => e.propertyId === property.id);
  }, [propertyExpenses, property]);

  // Linked Maintenance Requests
  const propertyMaintenance = useMemo(() => {
    if (!property) return [];
    return maintenanceRequests.filter((m) => m.propertyId === property.id);
  }, [maintenanceRequests, property]);

  // Linked Legal Cases
  const propertyCases = useMemo(() => {
    if (!property) return [];
    return cases.filter((c) => c.propertyId === property.id);
  }, [cases, property]);

  // Linked Owner Transfers
  const propertyTransfers = useMemo(() => {
    if (!property || !propertyOwner) return [];
    return ownerTransfers.filter(
      (t) => t.propertyId === property.id || t.ownerId === propertyOwner.id
    );
  }, [ownerTransfers, property, propertyOwner]);

  // Linked Audit Logs
  const propertyAuditLogs = useMemo(() => {
    if (!property) return [];
    return auditLogs.filter(
      (log) =>
        log.entityId === property.id ||
        propertyUnits.some((u) => u.id === log.entityId) ||
        propertyLeases.some((l) => l.id === log.entityId)
    );
  }, [auditLogs, property, propertyUnits, propertyLeases]);

  // Authoritative Financial Summary Calculations
  const financialSummary = useMemo(() => {
    const grossCollected = propertyCollections.reduce(
      (sum, c) => sum + (c.amountApplied || c.amountEntered || 0),
      0
    );
    const totalExpenses = propertyExpenseList.reduce(
      (sum, e) => sum + (e.totalAmount || e.amount || 0),
      0
    );
    const totalTransfers = propertyTransfers.reduce((sum, t) => sum + t.amount, 0);
    const totalCommissions = commissions
      .filter((com) => com.propertyId === property?.id)
      .reduce((sum, com) => sum + (com.collectedAmount || com.totalCommissionAmount || 0), 0);

    const netOperatingIncome = grossCollected - totalExpenses;
    const ownerNetPayable = grossCollected - totalCommissions - totalExpenses - totalTransfers;

    return {
      grossCollected,
      totalExpenses,
      totalTransfers,
      totalCommissions,
      netOperatingIncome,
      ownerNetPayable,
    };
  }, [propertyCollections, propertyExpenseList, propertyTransfers, commissions, property]);

  // Occupancy Stats
  const occupancyStats = useMemo(() => {
    const total = propertyUnits.length;
    const occupied = propertyUnits.filter((u) => u.status === "OCCUPIED" || u.currentTenantId).length;
    const vacant = total - occupied;
    const rate = total > 0 ? (occupied / total) * 100 : 0;
    return { total, occupied, vacant, rate: rate.toFixed(1) };
  }, [propertyUnits]);

  // Chronological Property Timeline Events
  const timelineEvents = useMemo(() => {
    const events: Array<{
      id: string;
      date: string;
      title: string;
      description: string;
      type: "LEASE" | "PAYMENT" | "MAINTENANCE" | "LEGAL" | "EXPENSE" | "TRANSFER";
    }> = [];

    // Leases
    propertyLeases.forEach((l) => {
      events.push({
        id: `timeline-lease-${l.id}`,
        date: l.startDate,
        title: isAr ? `توقيع عقد إيجار جديد` : `New Lease Agreement`,
        description: isAr
          ? `عقد رقم ${l.leaseNumber || l.id} بقيمة ${Number(l.annualRent || 0).toLocaleString()} درهم`
          : `Lease #${l.leaseNumber || l.id} for AED ${Number(l.annualRent || 0).toLocaleString()}`,
        type: "LEASE",
      });
    });

    // Collections
    propertyCollections.forEach((c) => {
      events.push({
        id: `timeline-col-${c.id}`,
        date: c.paymentDate || c.createdAt.slice(0, 10),
        title: isAr ? `تحصيل دفعة إيجارية` : `Rent Collection`,
        description: isAr
          ? `سند قبض رقم ${c.receiptNumber || c.id.slice(0, 6)} بمبلغ ${(c.amountApplied || c.amountEntered).toLocaleString()} درهم`
          : `Receipt #${c.receiptNumber || c.id.slice(0, 6)} for AED ${(c.amountApplied || c.amountEntered).toLocaleString()}`,
        type: "PAYMENT",
      });
    });

    // Maintenance
    propertyMaintenance.forEach((m) => {
      events.push({
        id: `timeline-mnt-${m.id}`,
        date: m.requestDate || m.createdAt.slice(0, 10),
        title: isAr ? `طلب صيانة (${m.category})` : `Maintenance Request (${m.category})`,
        description: m.issueDescription,
        type: "MAINTENANCE",
      });
    });

    // Expenses
    propertyExpenseList.forEach((e) => {
      events.push({
        id: `timeline-exp-${e.id}`,
        date: e.expenseDate || e.createdAt.slice(0, 10),
        title: isAr ? `تسجيل مصروف تشغيلي` : `Operating Expense`,
        description: `${e.category}: ${e.description} (${(e.totalAmount || e.amount).toLocaleString()} AED)`,
        type: "EXPENSE",
      });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [propertyLeases, propertyCollections, propertyMaintenance, propertyExpenseList, isAr]);

  // Tab definitions
  const tabs = [
    { id: "overview", labelAr: "نظرة عامة", labelEn: "Overview", icon: Building2, count: null },
    { id: "analytics", labelAr: "تحليلات الإشغال والعقود", labelEn: "Occupancy & Leases", icon: TrendingUp, count: propertyUnits.length },
    { id: "units", labelAr: "الوحدات الإيجارية", labelEn: "Units", icon: Home, count: propertyUnits.length },
    { id: "owners", labelAr: "الملاك", labelEn: "Owners", icon: UserCheck, count: propertyOwner ? 1 : 0 },
    { id: "tenants", labelAr: "المستأجرون", labelEn: "Tenants", icon: Users, count: propertyTenants.length },
    { id: "leases", labelAr: "العقود الإيجارية", labelEn: "Leases", icon: FileText, count: propertyLeases.length },
    { id: "financial_summary", labelAr: "الملخص المالي", labelEn: "Financials", icon: DollarSign, count: null },
    { id: "collections", labelAr: "المقبوضات", labelEn: "Collections", icon: Receipt, count: propertyCollections.length },
    { id: "owner_transfers", labelAr: "الحوالات البنكية", labelEn: "Transfers", icon: ArrowRightLeft, count: propertyTransfers.length },
    { id: "expenses", labelAr: "المصاريف التشغيلية", labelEn: "Expenses", icon: DollarSign, count: propertyExpenseList.length },
    { id: "maintenance", labelAr: "طلبات الصيانة", labelEn: "Maintenance", icon: Wrench, count: propertyMaintenance.length },
    { id: "documents", labelAr: "المستندات والملفات", labelEn: "Documents", icon: FolderOpen, count: archive.filter((a) => a.recordId === property?.id || propertyUnits.some((u) => u.id === a.recordId)).length },
    { id: "cases", labelAr: "القضايا الإيجارية", labelEn: "Legal Cases", icon: Gavel, count: propertyCases.length },
    { id: "communications", labelAr: "سجل التواصل", labelEn: "Communications", icon: MessageSquare, count: 0 },
    { id: "tasks", labelAr: "المهام والمتابعات", labelEn: "Tasks", icon: CheckSquare, count: 0 },
    { id: "timeline", labelAr: "الخط الزمني للأحداث", labelEn: "Timeline", icon: History, count: timelineEvents.length },
    { id: "audit", labelAr: "سجل التدقيق", labelEn: "Audit Log", icon: ShieldCheck, count: propertyAuditLogs.length },
  ];

  // Print Handlers
  const handlePrint = () => {
    window.print();
  };

  // Export Excel
  const handleExportExcel = () => {
    if (!property) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Overview & Specs
    const overviewData = [
      { [isAr ? "الخاصية" : "Property"]: isAr ? "اسم العقار" : "Property Name", [isAr ? "القيمة" : "Value"]: isAr ? property.nameAr : property.nameEn },
      { [isAr ? "الخاصية" : "Property"]: isAr ? "الكود" : "Code", [isAr ? "القيمة" : "Value"]: property.code },
      { [isAr ? "الخاصية" : "Property"]: isAr ? "المالك" : "Owner", [isAr ? "القيمة" : "Value"]: propertyOwner ? (isAr ? propertyOwner.nameAr : propertyOwner.nameEn) : "---" },
      { [isAr ? "الخاصية" : "Property"]: isAr ? "إجمالي الوحدات" : "Total Units", [isAr ? "القيمة" : "Value"]: occupancyStats.total },
      { [isAr ? "الخاصية" : "Property"]: isAr ? "نسبة الإشغال" : "Occupancy Rate", [isAr ? "القيمة" : "Value"]: `${occupancyStats.rate}%` },
      { [isAr ? "الخاصية" : "Property"]: isAr ? "إجمالي المقبوضات" : "Gross Collections", [isAr ? "القيمة" : "Value"]: `${financialSummary.grossCollected} AED` },
      { [isAr ? "الخاصية" : "Property"]: isAr ? "إجمالي المصاريف" : "Total Expenses", [isAr ? "القيمة" : "Value"]: `${financialSummary.totalExpenses} AED` },
      { [isAr ? "الخاصية" : "Property"]: isAr ? "صافي الدخل التشغيلي" : "Net Operating Income", [isAr ? "القيمة" : "Value"]: `${financialSummary.netOperatingIncome} AED` },
    ];
    const wsOverview = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, wsOverview, "Property_Overview");

    // Sheet 2: Units
    const unitsData = propertyUnits.map((u) => ({
      [isAr ? "رقم الوحدة" : "Unit Number"]: u.unitNumber,
      [isAr ? "النوع" : "Type"]: u.type,
      [isAr ? "الطابق" : "Floor"]: u.floor || 1,
      [isAr ? "الحالة" : "Status"]: u.status,
      [isAr ? "القيمة الإيجارية السنوية" : "Annual Rent"]: u.annualRent || 0,
      [isAr ? "المستأجر الحالي" : "Current Tenant"]: u.currentTenantId || "---",
    }));
    const wsUnits = XLSX.utils.json_to_sheet(unitsData);
    XLSX.utils.book_append_sheet(wb, wsUnits, "Units");

    XLSX.writeFile(wb, `Property360_${property.code || property.id}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (!property) {
    return (
      <div className="p-8 text-center text-slate-500">
        {isAr ? "لم يتم العثور على العقار المطلوب" : "Property not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Printable Header with Office Logo and Name */}
      <OfficePrintHeader
        titleAr={`كشف ملف العقار الشامل (${property.nameAr || property.nameEn})`}
        titleEn={`PROPERTY 360 COMPREHENSIVE DOSSIER (${property.nameEn || property.nameAr})`}
        subtitleAr={`كود العقار: ${property.code || "---"} | الموقع: ${property.community || "---"} | النوع: ${property.type}`}
        subtitleEn={`Property Code: ${property.code || "---"} | Location: ${property.community || "---"} | Type: ${property.type}`}
        hideOnScreen={true}
        extraInfo={[
          { labelAr: "إجمالي الوحدات", labelEn: "Total Units", value: propertyUnits.length.toString() },
          { labelAr: "الوحدات المشغولة", labelEn: "Occupied Units", value: propertyUnits.filter((u) => u.status === "OCCUPIED" || u.currentTenantId).length.toString() },
          { labelAr: "نسبة الإشغال", labelEn: "Occupancy Rate", value: `${propertyUnits.length > 0 ? ((propertyUnits.filter((u) => u.status === "OCCUPIED" || u.currentTenantId).length / propertyUnits.length) * 100).toFixed(1) : 0}%` },
        ]}
      />

      {/* Header Banner & Breadcrumb */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <span>{isAr ? "العقارات" : "Properties"}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            <span className="text-white">{isAr ? property.nameAr : property.nameEn}</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px]">
              {property.code || "PROP"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-indigo-400" />
            <span>{isAr ? property.nameAr : property.nameEn}</span>
          </h1>
          <p className="text-xs text-slate-300 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{property.community || (isAr ? "دبي، الإمارات العربية المتحدة" : "Dubai, UAE")}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/50 hover:bg-emerald-900/60 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? "تصدير إكسل" : "Export Excel"}</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isAr ? "طباعة التقرير" : "Print Package"}</span>
          </button>
          <CloseBackButton onClose={onClose} variant="dark" />
        </div>
      </div>

      {/* Synchronized 16-Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT AREAS */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "نسبة الإشغال" : "Occupancy Rate"}</span>
              <div className="text-2xl font-black text-indigo-600 mt-1">{occupancyStats.rate}%</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {occupancyStats.occupied} {isAr ? "مشغولة من" : "occupied of"} {occupancyStats.total} {isAr ? "وحدة" : "units"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "إجمالي المقبوضات" : "Gross Collections"}</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {financialSummary.grossCollected.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {propertyCollections.length} {isAr ? "سند قبض محصل" : "receipt vouchers"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "المصاريف التشغيلية" : "Operating Expenses"}</span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {financialSummary.totalExpenses.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {propertyExpenseList.length} {isAr ? "سند مصروف" : "expense vouchers"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "صافي الدخل التشغيلي (NOI)" : "Net Operating Income"}</span>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {financialSummary.netOperatingIncome.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{isAr ? "الإيرادات بعد خصم المصاريف" : "Revenues less expenses"}</div>
            </div>
          </div>

          {/* Property Specifications and Owner Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                {isAr ? "مواصفات وبيانات العقار" : "Property Specifications"}
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "النوع" : "Type"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{property.type || "Residential"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "عدد الطوابق" : "Floors"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{1 || 1}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "رقم القطعة / الأرض" : "Plot / Makani"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{property.plotNumber || "---"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "سنة البناء" : "Built Year"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{2022}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "الكهرباء / DEWA" : "DEWA Premise"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{property.electricityAccountNo || "---"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "رقم سند الملكية" : "Title Deed"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{property.plotNumber || "---"}</span>
                </div>
              </div>
            </div>

            {/* Owner Details Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                {isAr ? "مالك العقار" : "Property Owner"}
              </h3>

              {propertyOwner ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center font-bold text-indigo-600">
                      {propertyOwner.nameAr.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {isAr ? propertyOwner.nameAr : propertyOwner.nameEn}
                      </div>
                      <div className="text-slate-400 text-[11px]">{propertyOwner.code}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1.5 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{propertyOwner.phone || "---"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{propertyOwner.email || "---"}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-slate-400">IBAN:</span>
                      <span>{propertyOwner.iban || "---"}</span>
                    </div>
                  </div>

                  {onNavigateToOwner && (
                    <button
                      onClick={() => onNavigateToOwner(propertyOwner.id)}
                      className="w-full mt-2 py-2 px-3 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 rounded-xl transition flex items-center justify-center gap-1"
                    >
                      <span>{isAr ? "فتح ملف المالك (Owner 360)" : "Open Owner 360"}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-4">
                  {isAr ? "لم يتم ربط مالك لهذا العقار" : "No owner assigned"}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Property & Unit Occupancy / Lease Analytics Component */}
          <PropertyOccupancyAnalytics
            property={property}
            units={units}
            leases={leases}
            tenants={tenants}
            cheques={cheques}
            collections={collections}
            onNavigateToUnit={onNavigateToUnit}
          />
        </div>
      )}

      {/* 2. DEDICATED ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <PropertyOccupancyAnalytics
          property={property}
          units={units}
          leases={leases}
          tenants={tenants}
          cheques={cheques}
          collections={collections}
          onNavigateToUnit={onNavigateToUnit}
        />
      )}

      {/* 3. UNITS TAB */}
      {activeTab === "units" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Home className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "قائمة الوحدات الإيجارية" : "Rental Units"} ({propertyUnits.length})</span>
            </h3>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                placeholder={isAr ? "ابحث برقم الوحدة أو المستأجر..." : "Search unit or tenant..."}
                className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الوحدة" : "Unit Number"}</th>
                  <th className="px-4 py-3">{isAr ? "النوع" : "Type"}</th>
                  <th className="px-4 py-3">{isAr ? "الطابق" : "Floor"}</th>
                  <th className="px-4 py-3">{isAr ? "المساحة (قدم²)" : "Area (sqft)"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3">{isAr ? "المستأجر الحالي" : "Current Tenant"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "القيمة السنوية" : "Annual Rent"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyUnits
                  .filter(
                    (u) =>
                      !unitSearch ||
                      u.unitNumber.toLowerCase().includes(unitSearch.toLowerCase()) ||
                      (u.currentTenantId && u.currentTenantId.toLowerCase().includes(unitSearch.toLowerCase()))
                  )
                  .map((unit) => {
                    const tenantObj = unit.currentTenantId ? tenants.find((t) => t.id === unit.currentTenantId) : null;
                    return (
                      <tr key={unit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white font-mono">
                          {unit.unitNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{unit.type || "Apartment"}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{unit.floor || 1}</td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{unit.areaSqFt || 1200}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              unit.status === "OCCUPIED"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : unit.status === "MAINTENANCE"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : unit.status === "RESERVED"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {unit.status === "OCCUPIED"
                              ? isAr ? "مؤجرة" : "OCCUPIED"
                              : unit.status === "VACANT"
                              ? isAr ? "شاغرة" : "VACANT"
                              : unit.status === "MAINTENANCE"
                              ? isAr ? "قيد الصيانة" : "MAINTENANCE"
                              : unit.status === "RESERVED"
                              ? isAr ? "محجوزة" : "RESERVED"
                              : unit.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {tenantObj ? (isAr ? tenantObj.nameAr : tenantObj.nameEn) : isAr ? "شاغرة" : "Vacant"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600 whitespace-nowrap">
                          {(unit.annualRent || 0).toLocaleString()} AED
                        </td>
                        <td className="px-4 py-3 text-center">
                          {onNavigateToUnit && (
                            <button
                              onClick={() => onNavigateToUnit(unit.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition"
                            >
                              {isAr ? "عرض الوحدة 360" : "Unit 360"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. LEASES TAB */}
      {activeTab === "leases" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "عقود الإيجار المرتبطة" : "Linked Lease Contracts"} ({propertyLeases.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم العقد" : "Lease Number"}</th>
                  <th className="px-4 py-3">{isAr ? "الوحدة" : "Unit"}</th>
                  <th className="px-4 py-3">{isAr ? "المستأجر" : "Tenant"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ البدء" : "Start Date"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الانتهاء" : "End Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "القيمة السنوية" : "Annual Rent"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyLeases.map((lease) => {
                  const tenant = tenants.find((t) => t.id === lease.tenantId);
                  const unit = units.find((u) => u.id === lease.unitId);
                  return (
                    <tr key={lease.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {lease.leaseNumber || lease.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-mono">{unit ? unit.unitNumber : lease.unitId}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : lease.tenantId}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{lease.startDate}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{lease.endDate}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            lease.contractStatus === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {lease.contractStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600 whitespace-nowrap">
                        {Number(lease.annualRent || 0).toLocaleString()} AED
                      </td>
                      <td className="px-4 py-3 text-center">
                        {onNavigateToLease && (
                          <button
                            onClick={() => onNavigateToLease(lease.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition"
                          >
                            {isAr ? "مساحة العقد" : "Workspace"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. FINANCIAL SUMMARY TAB */}
      {activeTab === "financial_summary" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "الملخص المالي ومطابقة الحسابات" : "Authoritative Financial Reconciliation"}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 font-bold">{isAr ? "إجمالي التدفقات الإيجارية" : "Gross Rent Inflow"}</span>
              <div className="text-xl font-black text-emerald-600 mt-1">
                {financialSummary.grossCollected.toLocaleString()} AED
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 font-bold">{isAr ? "إجمالي المصاريف والتشغيل" : "Operating & Maintenance"}</span>
              <div className="text-xl font-black text-rose-600 mt-1">
                {financialSummary.totalExpenses.toLocaleString()} AED
              </div>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{isAr ? "صافي الدخل التشغيلي (NOI)" : "Net Operating Income"}</span>
              <div className="text-xl font-black text-indigo-600 dark:text-indigo-300 mt-1">
                {financialSummary.netOperatingIncome.toLocaleString()} AED
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TIMELINE TAB */}
      {activeTab === "timeline" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "الخط الزمني الموحد لكافة أحداث العقار" : "Unified Property Event Timeline"}</span>
          </h3>

          <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 rtl:before:left-auto rtl:before:right-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
            {timelineEvents.map((evt) => (
              <div key={evt.id} className="relative flex items-start gap-4 pr-6 rtl:pr-0 rtl:pl-6">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 z-10">
                  ✓
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex-1">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-bold text-slate-900 dark:text-white">{evt.title}</span>
                    <span className="font-mono">{evt.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{evt.description}</p>
                </div>
              </div>
            ))}
            {timelineEvents.length === 0 && (
              <div className="text-center py-6 text-slate-400 italic text-xs">
                {isAr ? "لا توجد أحداث مسجلة" : "No registered timeline events found"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. OWNERS TAB */}
      {activeTab === "owners" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "بيانات المالك المرتبط" : "Associated Owner Profiles"}</span>
          </h3>
          {propertyOwner ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {isAr ? propertyOwner.nameAr : propertyOwner.nameEn}
                  </h4>
                  <p className="text-slate-400 font-mono mt-0.5">{propertyOwner.code}</p>
                </div>
                {onNavigateToOwner && (
                  <button
                    onClick={() => onNavigateToOwner(propertyOwner.id)}
                    className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition"
                  >
                    {isAr ? "فتح ملف المالك 360" : "Owner 360"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 block">{isAr ? "رقم الهاتف" : "Phone"}</span>
                  <span className="font-bold">{propertyOwner.phone || "---"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "البريد الإلكتروني" : "Email"}</span>
                  <span className="font-bold">{propertyOwner.email || "---"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">IBAN</span>
                  <span className="font-bold font-mono">{propertyOwner.iban || "---"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 italic text-xs">
              {isAr ? "لم يتم ربط مالك بعد" : "No owner linked yet"}
            </div>
          )}
        </div>
      )}

      {/* 7. TENANTS TAB */}
      {activeTab === "tenants" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "المستأجرون الحاليون والسابقون للعقار" : "Property Tenant History"} ({propertyTenants.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "كود المستأجر" : "Tenant Code"}</th>
                  <th className="px-4 py-3">{isAr ? "الاسم" : "Name"}</th>
                  <th className="px-4 py-3">{isAr ? "الهاتف" : "Phone"}</th>
                  <th className="px-4 py-3">{isAr ? "البريد الإلكتروني" : "Email"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyTenants.map((ten) => (
                  <tr key={ten.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{ten.code}</td>
                    <td className="px-4 py-3 font-bold">{isAr ? ten.nameAr : ten.nameEn}</td>
                    <td className="px-4 py-3">{ten.phone || "---"}</td>
                    <td className="px-4 py-3">{ten.email || "---"}</td>
                  </tr>
                ))}
                {propertyTenants.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا يوجد مستأجرون مسجلون للعقار" : "No tenants found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. COLLECTIONS TAB */}
      {activeTab === "collections" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "مقبوضات وسندات دفع الإيجار للعقار" : "Property Collections & Inflows"} ({propertyCollections.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم السند" : "Receipt #"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Payment Date"}</th>
                  <th className="px-4 py-3">{isAr ? "طريقة الدفع" : "Method"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ المقبوض" : "Amount Paid"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyCollections.map((col) => (
                  <tr key={col.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{col.receiptNumber || col.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{col.paymentDate || col.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">{col.paymentMethod}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      {Number(col.amountApplied || col.amountEntered || 0).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {propertyCollections.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد تدفقات مالية مسجلة" : "No collection records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. BANK TRANSFERS TAB */}
      {activeTab === "owner_transfers" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "الحوالات البنكية المصروفة للملاك" : "Bank Transfers Distributed"} ({propertyTransfers.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم المرجع" : "Reference #"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Transfer Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ المحول" : "Amount Transferred"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyTransfers.map((trsf) => (
                  <tr key={trsf.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{trsf.transferNumber || (trsf as any).referenceNo || trsf.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{trsf.transferDate}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">COMPLETED</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">
                      {trsf.amount.toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {propertyTransfers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد حوالات بنكية مسجلة للعقار" : "No owner bank transfers distributed"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. EXPENSES TAB */}
      {activeTab === "expenses" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "المصاريف التشغيلية والصيانة والمرافق" : "Property Operational Expenses"} ({propertyExpenseList.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "المرجع" : "Ref #"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Expense Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "الوصف" : "Description"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyExpenseList.map((exp) => {
                  const isReversed = exp.status === "REVERSED" || exp.status === "CANCELLED";
                  return (
                    <tr
                      key={exp.id}
                      className={`transition ${
                        isReversed
                          ? "bg-rose-50/25 hover:bg-rose-50/40 text-slate-400 dark:bg-rose-950/10 dark:hover:bg-rose-950/20"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <td
                        className={`px-4 py-3 font-mono font-bold ${
                          isReversed
                            ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {exp.expenseNumber || (exp as any).referenceNo || exp.id.slice(0, 8)}
                      </td>
                      <td
                        className={`px-4 py-3 font-mono ${
                          isReversed
                            ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                            : "text-slate-500"
                        }`}
                      >
                        {exp.expenseDate || exp.createdAt.slice(0, 10)}
                      </td>
                      <td
                        className={`px-4 py-3 font-bold ${
                          isReversed
                            ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {exp.category}
                      </td>
                      <td
                        className={`px-4 py-3 max-w-[200px] truncate ${
                          isReversed ? "line-through decoration-rose-600 decoration-[2px]" : ""
                        }`}
                      >
                        {exp.description}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-bold ${
                          isReversed
                            ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                            : "text-rose-600"
                        }`}
                      >
                        {Number(exp.totalAmount || exp.amount || 0).toLocaleString()} AED
                      </td>
                    </tr>
                  );
                })}
                {propertyExpenseList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد مصاريف تشغيلية مسجلة" : "No expense records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 11. MAINTENANCE TAB */}
      {activeTab === "maintenance" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "طلبات الصيانة والمتابعات الفنية" : "Maintenance Work Orders"} ({propertyMaintenance.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "كود الطلب" : "Request Code"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Request Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "الوصف" : "Issue Description"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "التكلفة" : "Total Cost"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyMaintenance.map((mnt) => (
                  <tr key={mnt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{mnt.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{mnt.requestDate || mnt.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-bold">{mnt.category}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{mnt.issueDescription}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        mnt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {mnt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      {Number(mnt.totalCost || 0).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {propertyMaintenance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد طلبات صيانة" : "No maintenance records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 12. DOCUMENTS TAB */}
      {activeTab === "documents" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "المستندات القانونية والمخططات الملحقة للعقار" : "Property Legal Documents & Blueprints"}</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{isAr ? "مسح ضوئي بالكاميرا" : "Scan Document"}</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "عنوان المستند" : "Document Title"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "رقم النسخة" : "Version"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الرفع" : "Date Uploaded"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {archive
                  .filter((a) => a.recordId === property?.id || propertyUnits.some((u) => u.id === a.recordId))
                  .map((doc, idx) => (
                    <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{doc.fileName || doc.recordTitle || (doc as any).title}</td>
                      <td className="px-4 py-3">{doc.category}</td>
                      <td className="px-4 py-3 font-mono">{(doc as any).version || "1.0"}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{doc.uploadDate || (doc as any).uploadedAt || doc.createdAt?.slice(0, 10) || "---"}</td>
                    </tr>
                  ))}
                {archive.filter((a) => a.recordId === property?.id || propertyUnits.some((u) => u.id === a.recordId)).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد ملفات أو مستندات مرفوعة" : "No blueprints or documents found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 13. LEGAL CASES TAB */}
      {activeTab === "cases" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-rose-600 uppercase tracking-wider flex items-center gap-2">
            <Gavel className="w-4 h-4 text-rose-500" />
            <span>{isAr ? "المنازعات القانونية والقضايا الإيجارية للعقار" : "Disputes & Rental Legal Cases"} ({propertyCases.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم القضية" : "Case Number"}</th>
                  <th className="px-4 py-3">{isAr ? "نوع القضية" : "Case Type"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الرفع" : "Filing Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyCases.map((cs) => (
                  <tr key={cs.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-rose-600">{cs.caseNumber}</td>
                    <td className="px-4 py-3 font-bold">{(cs as any).caseType || cs.courtName || "Eviction / Rental Claim"}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{cs.filingDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cs.status === "CLOSED" || cs.status === "SETTLED" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {cs.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {propertyCases.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد منازعات قانونية مسجلة للعقار" : "Excellent compliance - No legal cases on record"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 14. COMMUNICATIONS TAB */}
      {activeTab === "communications" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "سجل اتصالات ومراسلات العقار" : "Property Correspondence & Interaction Log"}</span>
          </h3>
          <div className="text-center py-8 text-slate-400 italic text-xs">
            {isAr ? "لا توجد مراسلات مسجلة" : "No recent communications on record"}
          </div>
        </div>
      )}

      {/* 15. TASKS TAB */}
      {activeTab === "tasks" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "المهام والمتابعات التشغيلية الجارية" : "Operational Task Follow-ups"}</span>
          </h3>
          <div className="text-center py-8 text-slate-400 italic text-xs">
            {isAr ? "لا توجد مهام معلقة" : "All operational tasks are completed"}
          </div>
        </div>
      )}

      {/* 16. AUDIT LOG TAB */}
      {activeTab === "audit" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "سجل تدقيق التغييرات والتحديثات للعقار" : "Compliance Audit Log"} ({propertyAuditLogs.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "المستخدم" : "User"}</th>
                  <th className="px-4 py-3">{isAr ? "الإجراء" : "Action"}</th>
                  <th className="px-4 py-3">{isAr ? "التفاصيل" : "Details"}</th>
                  <th className="px-4 py-3 font-mono">{isAr ? "التوقيت" : "Timestamp"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {propertyAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{log.userId || "System"}</td>
                    <td className="px-4 py-3 text-indigo-600 font-bold">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[250px] truncate">{log.details}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{log.timestamp}</td>
                  </tr>
                ))}
                {propertyAuditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد سجلات تدقيق" : "No audit log items found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Scanner Modal */}
      <DocumentScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        entityType="PROPERTY"
        entityId={property?.id || ""}
        defaultCategory={"LEASES" as DocumentCategory}
        recordName={property ? (isAr ? property.nameAr : property.nameEn) : ""}
      />
    </div>
  );
};
