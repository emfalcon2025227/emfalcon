import React, { useState, useMemo } from "react";
import {
  Home,
  Building2,
  Users,
  UserCheck,
  FileText,
  DollarSign,
  Receipt,
  Wrench,
  FolderOpen,
  Gavel,
  History,
  ShieldCheck,
  Printer,
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
  ArrowLeft,
  Search,
  CheckCircle2,
  CheckSquare,
  Camera,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { OfficePrintHeader } from "../common/OfficePrintHeader";
import { DocumentScanner } from "../common/DocumentScanner";
import { Unit, Property, Lease, Tenant, Owner, Cheque, CollectionRecord, MaintenanceRequest, RentalCase, DocumentCategory } from "../../types";
import { getUnitEffectiveOccupancy } from "../../utils/unitOccupancyGovernance";
import { UnitOccupancyAnalytics } from "./UnitOccupancyAnalytics";

interface Unit360WorkspaceProps {
  unitId: string;
  onClose?: () => void;
  onNavigateToProperty?: (propertyId: string) => void;
  onNavigateToTenant?: (tenantId: string) => void;
  onNavigateToOwner?: (ownerId: string) => void;
  onNavigateToLease?: (leaseId: string) => void;
}

export const Unit360Workspace: React.FC<Unit360WorkspaceProps> = ({
  unitId,
  onClose,
  onNavigateToProperty,
  onNavigateToTenant,
  onNavigateToOwner,
  onNavigateToLease,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    units,
    properties,
    owners,
    tenants,
    leases,
    collections,
    maintenanceRequests,
    cheques,
    cases,
    archive,
    auditLogs,
  } = useData();

  const [activeTab, setActiveTab] = useState<
    "overview" | "analytics" | "tenants" | "leases" | "cheques" | "payments" | "maintenance" | "documents" | "cases" | "timeline"
  >("overview");

  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Target Unit (Strict search by ID)
  const unit = useMemo(() => {
    return units.find((u) => u.id === unitId) || null;
  }, [units, unitId]);

  // Target Property
  const property = useMemo(() => {
    if (!unit) return null;
    return properties.find((p) => p.id === unit.propertyId) || null;
  }, [properties, unit]);

  // Target Owner
  const owner = useMemo(() => {
    if (!property) return null;
    return owners.find((o) => o.id === property.ownerId) || null;
  }, [owners, property]);

  // Authoritative Unit Occupancy Governance (Single Source of Truth)
  const occupancySummary = useMemo(() => {
    if (!unit) return null;
    return getUnitEffectiveOccupancy(unit.id, unit, leases);
  }, [unit, leases]);

  // Linked Leases (Strictly for this specific unit, sorted by date descending)
  const unitLeases = useMemo(() => {
    if (!unit) return [];
    return leases
      .filter((l) => l.unitId === unit.id)
      .sort((a, b) => new Date(b.startDate || b.createdAt || 0).getTime() - new Date(a.startDate || a.createdAt || 0).getTime());
  }, [leases, unit]);

  // Current Active Occupying Lease (Only if active/occupying for this unit)
  const currentLease = useMemo(() => {
    if (occupancySummary?.activeLease) {
      return occupancySummary.activeLease;
    }
    return null;
  }, [occupancySummary]);

  // Current Tenant (Strictly for this unit based on occupying lease or authoritative status)
  const currentTenant = useMemo(() => {
    if (!unit) return null;
    if (occupancySummary?.activeLease?.tenantId) {
      return tenants.find((t) => t.id === occupancySummary.activeLease!.tenantId) || null;
    }
    if ((unit.status === "OCCUPIED" || occupancySummary?.effectiveStatus === "OCCUPIED") && unit.currentTenantId) {
      return tenants.find((t) => t.id === unit.currentTenantId) || null;
    }
    return null;
  }, [tenants, unit, occupancySummary]);

  // Past Leases for this unit
  const pastLeases = useMemo(() => {
    if (!currentLease) return unitLeases;
    return unitLeases.filter((l) => l.id !== currentLease.id);
  }, [unitLeases, currentLease]);

  // Linked Cheques (All cheques associated with this unit or its leases)
  const unitCheques = useMemo(() => {
    if (!unit) return [];
    const unitLeaseIds = new Set(unitLeases.map((l) => l.id));
    return cheques.filter((c) => (c.unitId && c.unitId === unit.id) || (c.leaseId && unitLeaseIds.has(c.leaseId)));
  }, [cheques, unitLeases, unit]);

  // Linked Payments (All payments linked to this unit's cheques)
  const unitPayments = useMemo(() => {
    if (!unit) return [];
    const unitChequeIds = new Set(unitCheques.map((c) => c.id));
    return collections.filter((c) => {
      if (c.chequeId && unitChequeIds.has(c.chequeId)) return true;
      return false;
    });
  }, [collections, unit, unitCheques]);

  // Linked Maintenance
  const unitMaintenance = useMemo(() => {
    if (!unit) return [];
    return maintenanceRequests.filter((m) => m.unitId === unit.id);
  }, [maintenanceRequests, unit]);

  // Linked Cases (Strictly for this unit or its leases)
  const unitCases = useMemo(() => {
    if (!unit) return [];
    const unitLeaseIds = new Set(unitLeases.map((l) => l.id));
    return cases.filter((c) => c.unitId === unit.id || (c.leaseId && unitLeaseIds.has(c.leaseId)));
  }, [cases, unit, unitLeases]);

  // Effective authoritative status
  const effectiveStatus = occupancySummary?.effectiveStatus || unit?.status || "VACANT";

  // Vacancy Intelligence calculations
  const vacancyInfo = useMemo(() => {
    const isOccupied = effectiveStatus === "OCCUPIED" && !!currentTenant;
    const lastEndedLease = pastLeases.find((l) => l.endDate);
    const vacancyStartDate = currentLease ? currentLease.endDate : lastEndedLease?.endDate || "2026-01-01";
    const diffMs = Math.max(0, Date.now() - new Date(vacancyStartDate).getTime());
    const vacancyDays = isOccupied ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const previousRent = lastEndedLease?.annualRent || unit?.annualRent || 50000;
    const estimatedLostRevenue = isOccupied ? 0 : Math.round((previousRent / 365) * vacancyDays);

    return {
      isOccupied,
      effectiveStatus,
      vacancyStartDate,
      vacancyDays,
      previousRent,
      estimatedLostRevenue,
    };
  }, [unit, currentTenant, currentLease, pastLeases, effectiveStatus]);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Export Excel handler
  const handleExportExcel = () => {
    if (!unit) return;
    const wb = XLSX.utils.book_new();

    const unitInfo = [
      { [isAr ? "الحقل" : "Field"]: isAr ? "رقم الوحدة" : "Unit Number", [isAr ? "القيمة" : "Value"]: unit.unitNumber },
      { [isAr ? "الحقل" : "Field"]: isAr ? "العقار" : "Property", [isAr ? "القيمة" : "Value"]: property ? (isAr ? property.nameAr : property.nameEn) : "---" },
      { [isAr ? "الحقل" : "Field"]: isAr ? "المالك" : "Owner", [isAr ? "القيمة" : "Value"]: owner ? (isAr ? owner.nameAr : owner.nameEn) : "---" },
      { [isAr ? "الحقل" : "Field"]: isAr ? "الحالة" : "Status", [isAr ? "القيمة" : "Value"]: unit.status },
      { [isAr ? "الحقل" : "Field"]: isAr ? "المستأجر الحالي" : "Current Tenant", [isAr ? "القيمة" : "Value"]: currentTenant ? (isAr ? currentTenant.nameAr : currentTenant.nameEn) : (isAr ? "شاغرة" : "Vacant") },
      { [isAr ? "الحقل" : "Field"]: isAr ? "الإيجار السنوي" : "Annual Rent", [isAr ? "القيمة" : "Value"]: `${unit.annualRent || 0} AED` },
      { [isAr ? "الحقل" : "Field"]: isAr ? "أيام الشغور" : "Vacancy Days", [isAr ? "القيمة" : "Value"]: vacancyInfo.vacancyDays },
    ];

    const wsInfo = XLSX.utils.json_to_sheet(unitInfo);
    XLSX.utils.book_append_sheet(wb, wsInfo, "Unit_Profile");
    XLSX.writeFile(wb, `Unit360_${unit.unitNumber}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (!unit) {
    return (
      <div className="p-8 text-center text-slate-500">
        {isAr ? "لم يتم العثور على الوحدة المطلوبة" : "Unit not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Printable Header with Office Logo and Name */}
      <OfficePrintHeader
        titleAr={`كشف ملف الوحدة الإيجارية الشامل (${unit.unitNumber})`}
        titleEn={`UNIT 360 COMPREHENSIVE DOSSIER (Unit ${unit.unitNumber})`}
        subtitleAr={`العقار: ${property ? (isAr ? property.nameAr : property.nameEn) : "---"} | المالك: ${owner ? (isAr ? owner.nameAr : owner.nameEn) : "---"}`}
        subtitleEn={`Property: ${property ? (isAr ? property.nameEn : property.nameAr) : "---"} | Owner: ${owner ? (isAr ? owner.nameEn : owner.nameAr) : "---"}`}
        hideOnScreen={true}
        extraInfo={[
          { labelAr: "الحالة", labelEn: "Status", value: effectiveStatus === "OCCUPIED" ? (isAr ? "مؤجرة" : "OCCUPIED") : effectiveStatus === "VACANT" ? (isAr ? "شاغرة" : "VACANT") : effectiveStatus },
          { labelAr: "الإيجار السنوي", labelEn: "Annual Rent", value: `AED ${(unit.annualRent || 0).toLocaleString()}` },
          { labelAr: "المستأجر الحالي", labelEn: "Tenant", value: currentTenant ? (isAr ? currentTenant.nameAr : currentTenant.nameEn) : (isAr ? "شاغرة" : "Vacant") },
        ]}
      />

      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            {property && (
              <button
                onClick={() => onNavigateToProperty && onNavigateToProperty(property.id)}
                className="hover:underline flex items-center gap-1"
              >
                <span>{isAr ? property.nameAr : property.nameEn}</span>
              </button>
            )}
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            <span className="text-white">{isAr ? `وحدة رقم ${unit.unitNumber}` : `Unit #${unit.unitNumber}`}</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                effectiveStatus === "OCCUPIED"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : effectiveStatus === "MAINTENANCE"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : effectiveStatus === "RESERVED"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {effectiveStatus === "OCCUPIED"
                ? isAr ? "🟢 مؤجرة" : "OCCUPIED"
                : effectiveStatus === "VACANT"
                ? isAr ? "🟢 شاغرة" : "VACANT"
                : effectiveStatus === "MAINTENANCE"
                ? isAr ? "🟡 قيد الصيانة" : "MAINTENANCE"
                : effectiveStatus === "RESERVED"
                ? isAr ? "🔵 محجوزة" : "RESERVED"
                : effectiveStatus}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
            <Home className="w-6 h-6 text-indigo-400" />
            <span>{isAr ? `الوحدة الإيجارية ${unit.unitNumber}` : `Rental Unit ${unit.unitNumber}`}</span>
          </h1>
          <p className="text-xs text-slate-300">
            {isAr
              ? `النوع: ${unit.type || "شقة سكني"} | الطابق: ${unit.floor || 1} | المساحة: ${unit.areaSqFt || 1200} قدم²`
              : `Type: ${unit.type || "Apartment"} | Floor: ${unit.floor || 1} | Area: ${unit.areaSqFt || 1200} sqft`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/50 hover:bg-emerald-900/60 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? "تصدير إكسل" : "Export"}</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isAr ? "طباعة الوحدة" : "Print Profile"}</span>
          </button>
          <CloseBackButton onClose={onClose} variant="dark" />
        </div>
      </div>

      {/* Occupancy Mismatch / Governance Alert */}
      {occupancySummary?.isMismatch && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-4 rounded-2xl text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">
              {isAr ? "تنبيه حوكمة حالة الوحدة والعقد:" : "Unit Occupancy Governance Notice:"}
            </div>
            <div>
              {isAr ? occupancySummary.reasonAr : occupancySummary.reasonEn}
            </div>
          </div>
        </div>
      )}

      {/* Synchronized Unit Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "overview", labelAr: "نظرة عامة والشاغر", labelEn: "Overview & Vacancy", icon: Home, count: null },
          { id: "analytics", labelAr: "تحليلات الإشغال والعقود", labelEn: "Occupancy & Leases", icon: TrendingUp, count: unitLeases.length },
          { id: "tenants", labelAr: "المستأجرون", labelEn: "Tenants", icon: Users, count: currentTenant ? 1 : 0 },
          { id: "leases", labelAr: "سجل العقود", labelEn: "Lease History", icon: FileText, count: unitLeases.length },
          { id: "cheques", labelAr: "الشيكات", labelEn: "Cheques", icon: DollarSign, count: unitCheques.length },
          { id: "payments", labelAr: "الدفعات والمقبوضات", labelEn: "Payments", icon: Receipt, count: unitPayments.length },
          { id: "maintenance", labelAr: "الصيانة", labelEn: "Maintenance", icon: Wrench, count: unitMaintenance.length },
          { id: "documents", labelAr: "المستندات", labelEn: "Documents", icon: FolderOpen, count: archive.filter((a) => a.recordId === unit.id).length },
          { id: "cases", labelAr: "القضايا", labelEn: "Cases", icon: Gavel, count: unitCases.length },
        ].map((tab) => {
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
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. OVERVIEW & VACANCY TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "القيمة الإيجارية السنوية" : "Annual Rent"}</span>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {(unit.annualRent || currentLease?.annualRent || 0).toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{isAr ? "القيمة المعتمدة للوحدة" : "Authoritative unit rent"}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "حالة الإشغال" : "Occupancy Status"}</span>
              <div
                className={`text-2xl font-black mt-1 ${
                  vacancyInfo.effectiveStatus === "OCCUPIED"
                    ? "text-emerald-600"
                    : vacancyInfo.effectiveStatus === "MAINTENANCE"
                    ? "text-amber-600"
                    : vacancyInfo.effectiveStatus === "RESERVED"
                    ? "text-blue-600"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {vacancyInfo.effectiveStatus === "OCCUPIED"
                  ? isAr ? "مؤجرة" : "Occupied"
                  : vacancyInfo.effectiveStatus === "VACANT"
                  ? isAr ? "شاغرة" : "Vacant"
                  : vacancyInfo.effectiveStatus === "MAINTENANCE"
                  ? isAr ? "قيد الصيانة" : "Under Maintenance"
                  : vacancyInfo.effectiveStatus === "RESERVED"
                  ? isAr ? "محجوزة" : "Reserved"
                  : vacancyInfo.effectiveStatus}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {vacancyInfo.effectiveStatus === "OCCUPIED"
                  ? isAr
                    ? `مؤجرة للمستأجر: ${currentTenant ? (isAr ? currentTenant.nameAr : currentTenant.nameEn) : "---"}`
                    : `Occupied by: ${currentTenant?.nameEn || currentTenant?.nameAr || "---"}`
                  : `${vacancyInfo.vacancyDays} ${isAr ? "أيام شغور" : "days vacant"}`}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "طلبات الصيانة المنجزة" : "Maintenance Requests"}</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {unitMaintenance.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {isAr ? "إجمالي التكلفة:" : "Total cost:"}{" "}
                {unitMaintenance.reduce((sum, m) => sum + m.totalCost, 0).toLocaleString()} AED
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "خسارة الإيجار التقديرية" : "Est. Lost Revenue"}</span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {vacancyInfo.estimatedLostRevenue.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {isAr ? "بناءً على أيام الشغور" : "Based on vacancy duration"}
              </div>
            </div>
          </div>

          {/* Unit Specs & Linked Relations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                {isAr ? "العقار والمالك التابع له" : "Linked Property & Owner"}
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block">{isAr ? "العقار" : "Property"}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {property ? (isAr ? property.nameAr : property.nameEn) : "---"}
                    </span>
                  </div>
                  {property && onNavigateToProperty && (
                    <button
                      onClick={() => onNavigateToProperty(property.id)}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 rounded-lg hover:bg-indigo-100"
                    >
                      {isAr ? "فتح العقار 360" : "Property 360"}
                    </button>
                  )}
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block">{isAr ? "المالك" : "Owner"}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {owner ? (isAr ? owner.nameAr : owner.nameEn) : "---"}
                    </span>
                  </div>
                  {owner && onNavigateToOwner && (
                    <button
                      onClick={() => onNavigateToOwner(owner.id)}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 rounded-lg hover:bg-indigo-100"
                    >
                      {isAr ? "فتح المالك 360" : "Owner 360"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Current Occupant Details */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                {isAr ? "المستأجر الحالي والعقد" : "Current Tenant & Lease"}
              </h3>

              {currentTenant ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">{isAr ? "المستأجر" : "Tenant"}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {isAr ? currentTenant.nameAr : currentTenant.nameEn}
                      </span>
                    </div>
                    {onNavigateToTenant && (
                      <button
                        onClick={() => onNavigateToTenant(currentTenant.id)}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 rounded-lg hover:bg-indigo-100"
                      >
                        {isAr ? "ملف المستأجر 360" : "Tenant 360"}
                      </button>
                    )}
                  </div>

                  {currentLease && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 block">{isAr ? "العقد الحالي" : "Current Lease"}</span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {currentLease.leaseNumber || currentLease.id.slice(0, 8)}
                        </span>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {currentLease.startDate} ➔ {currentLease.endDate}
                        </div>
                      </div>
                      {onNavigateToLease && (
                        <button
                          onClick={() => onNavigateToLease(currentLease.id)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 rounded-lg hover:bg-indigo-100"
                        >
                          {isAr ? "مساحة العقد" : "Lease"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-6 text-center">
                  {isAr ? "الوحدة شاغرة حالياً وجاهزة للتأجير" : "Unit is currently vacant and available for lease"}
                </div>
              )}
            </div>
          </div>

          {/* Integrated Interactive Occupancy & Historical Lease Analytics Component */}
          <UnitOccupancyAnalytics
            unit={unit}
            leases={leases}
            tenants={tenants}
            cheques={cheques}
            collections={collections}
          />
        </div>
      )}

      {/* 2. DEDICATED ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <UnitOccupancyAnalytics
          unit={unit}
          leases={leases}
          tenants={tenants}
          cheques={cheques}
          collections={collections}
        />
      )}

      {/* 3. CHEQUES TAB */}
      {activeTab === "cheques" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "شيكات الوحدة الإيجارية" : "Unit Cheques"} ({unitCheques.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الشيك" : "Cheque #"}</th>
                  <th className="px-4 py-3">{isAr ? "البنك" : "Bank"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {unitCheques.map((chq) => (
                  <tr key={chq.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{chq.chequeNumber}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{chq.bankName}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{chq.chequeDate}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          chq.status === "CLEARED" || chq.status === "COLLECTED"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : chq.status === "BOUNCED"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {chq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {chq.amount.toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {unitCheques.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد شيكات مستلمة لهذه الوحدة" : "No cheques found for this unit"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TENANTS TAB */}
      {activeTab === "tenants" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "المستأجرون المرتبطون بالوحدة" : "Unit Tenant History"}</span>
          </h3>
          {currentTenant ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {isAr ? currentTenant.nameAr : currentTenant.nameEn}
                  </h4>
                  <p className="text-slate-400 font-mono mt-0.5">{currentTenant.code}</p>
                </div>
                {onNavigateToTenant && (
                  <button
                    onClick={() => onNavigateToTenant(currentTenant.id)}
                    className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition"
                  >
                    {isAr ? "فتح ملف المستأجر 360" : "Tenant 360"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 block">{isAr ? "الهاتف" : "Phone"}</span>
                  <span className="font-bold">{currentTenant.phone || "---"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "البريد الإلكتروني" : "Email"}</span>
                  <span className="font-bold">{currentTenant.email || "---"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 italic text-xs">
              {isAr ? "الوحدة شاغرة حالياً ولا يوجد مستأجر مرتبط بها" : "Unit is currently vacant. No active tenant."}
            </div>
          )}
        </div>
      )}

      {/* 4. LEASES TAB */}
      {activeTab === "leases" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "تاريخ العقود الإيجارية للوحدة" : "Unit Lease History"} ({unitLeases.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم العقد" : "Lease Number"}</th>
                  <th className="px-4 py-3">{isAr ? "فترة العقد" : "Period"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "الإيجار السنوي" : "Annual Rent"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {unitLeases.map((lease) => (
                  <tr key={lease.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{lease.leaseNumber || lease.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{lease.startDate} ➔ {lease.endDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        lease.contractStatus === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {lease.contractStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">
                      {Number(lease.annualRent || 0).toLocaleString()} AED
                    </td>
                    <td className="px-4 py-3 text-center">
                      {onNavigateToLease && (
                        <button
                          onClick={() => onNavigateToLease(lease.id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition"
                        >
                          {isAr ? "مساحة العقد" : "Lease"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {unitLeases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد عقود مسجلة لهذه الوحدة" : "No lease history found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. PAYMENTS TAB */}
      {activeTab === "payments" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "سندات المقبوضات المستلمة للوحدة" : "Unit Received Payments"} ({unitPayments.length})</span>
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
                {unitPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{pay.receiptNumber || pay.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{pay.paymentDate || pay.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">{pay.paymentMethod}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      {Number(pay.amountApplied || pay.amountEntered || 0).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {unitPayments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد سندات دفع مسجلة" : "No payment records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. MAINTENANCE TAB */}
      {activeTab === "maintenance" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "طلبات صيانة الوحدة" : "Unit Maintenance Requests"} ({unitMaintenance.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "كود الطلب" : "Code"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "الوصف" : "Description"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "التكلفة" : "Cost"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {unitMaintenance.map((mnt) => (
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
                {unitMaintenance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد طلبات صيانة لهذه الوحدة" : "No maintenance records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. DOCUMENTS TAB */}
      {activeTab === "documents" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "المستندات والصور الملحقة بالوحدة" : "Unit Attached Documents"}</span>
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
                  <th className="px-4 py-3">{isAr ? "اسم الملف" : "File Name"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "النسخة" : "Version"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الرفع" : "Uploaded At"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {archive
                  .filter((a) => a.recordId === unit.id)
                  .map((doc, idx) => (
                    <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{doc.fileName || doc.recordTitle || (doc as any).title}</td>
                      <td className="px-4 py-3">{doc.category}</td>
                      <td className="px-4 py-3 font-mono">{(doc as any).version || "1.0"}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{doc.uploadDate || (doc as any).uploadedAt || doc.createdAt?.slice(0, 10) || "---"}</td>
                    </tr>
                  ))}
                {archive.filter((a) => a.recordId === unit.id).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد مستندات مرفوعة لهذه الوحدة" : "No uploaded documents found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. CASES TAB */}
      {activeTab === "cases" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-rose-600 uppercase tracking-wider flex items-center gap-2">
            <Gavel className="w-4 h-4 text-rose-500" />
            <span>{isAr ? "القضايا والمنازعات المرتبطة بالوحدة" : "Unit Rental Disputes"} ({unitCases.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم القضية" : "Case Number"}</th>
                  <th className="px-4 py-3">{isAr ? "نوع القضية" : "Case Type"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Filing Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {unitCases.map((cs) => (
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
                {unitCases.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد منازعات قانونية مسجلة لهذه الوحدة" : "No legal cases found"}
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
        entityType="UNIT"
        entityId={unit.id}
        defaultCategory={"LEASES" as DocumentCategory}
        recordName={unit.unitNumber}
      />
    </div>
  );
};
