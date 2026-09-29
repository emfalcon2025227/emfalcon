import React, { useState, useMemo } from "react";
import {
  UserCheck,
  Building2,
  Home,
  Users,
  FileText,
  DollarSign,
  Receipt,
  ArrowRightLeft,
  Wrench,
  FolderOpen,
  Gavel,
  History,
  ShieldCheck,
  Printer,
  Download,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Search,
  CheckCircle2,
  Calendar,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { OfficePrintHeader } from "../common/OfficePrintHeader";
import { Owner, Property, Unit, Lease, Tenant, CollectionRecord, PropertyExpenseRecord, OwnerTransferRecord, CommissionObligation } from "../../types";
import { computeOwnerPayableDetails } from "../../services/financialEngine";
import { OwnerOccupancyAnalytics } from "./OwnerOccupancyAnalytics";

interface Owner360WorkspaceProps {
  ownerId: string;
  onClose?: () => void;
  onNavigateToProperty?: (propertyId: string) => void;
  onNavigateToUnit?: (unitId: string) => void;
  onNavigateToTenant?: (tenantId: string) => void;
  onNavigateToLease?: (leaseId: string) => void;
}

export const Owner360Workspace: React.FC<Owner360WorkspaceProps> = ({
  ownerId,
  onClose,
  onNavigateToProperty,
  onNavigateToUnit,
  onNavigateToTenant,
  onNavigateToLease,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    owners,
    properties,
    units,
    leases,
    tenants,
    cheques,
    collections,
    commissions,
    propertyExpenses,
    ownerTransfers,
    maintenanceRequests,
    archive,
    auditLogs,
    companyProfile,
    getOwnerPayable,
  } = useData();

  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "analytics"
    | "properties"
    | "units"
    | "leases"
    | "financial_summary"
    | "collections"
    | "transfers"
    | "commissions"
    | "expenses"
    | "maintenance"
    | "documents"
    | "timeline"
  >("overview");

  // Target Owner
  const owner = useMemo(() => {
    return owners.find((o) => o.id === ownerId) || owners[0];
  }, [owners, ownerId]);

  // Linked Properties
  const ownerProperties = useMemo(() => {
    if (!owner) return [];
    return properties.filter((p) => p.ownerId === owner.id);
  }, [properties, owner]);

  // Linked Units
  const ownerUnits = useMemo(() => {
    const propIds = new Set(ownerProperties.map((p) => p.id));
    return units.filter((u) => propIds.has(u.propertyId));
  }, [units, ownerProperties]);

  // Linked Leases
  const ownerLeases = useMemo(() => {
    const propIds = new Set(ownerProperties.map((p) => p.id));
    return leases.filter((l) => propIds.has(l.propertyId) || l.ownerId === owner?.id);
  }, [leases, ownerProperties, owner]);

  // Active Leases
  const activeLeases = useMemo(() => {
    return ownerLeases.filter((l) => l.contractStatus === "ACTIVE");
  }, [ownerLeases]);

  // Linked Collections
  const ownerCollections = useMemo(() => {
    const propIds = new Set(ownerProperties.map((p) => p.id));
    return collections.filter((c) => {
      if (c.ownerId === owner?.id) return true;
      const linkedCheque = cheques.find((ch) => ch.id === c.chequeId);
      return linkedCheque && propIds.has(linkedCheque.propertyId);
    });
  }, [collections, owner, ownerProperties, cheques]);

  // Linked Transfers
  const ownerTransferList = useMemo(() => {
    if (!owner) return [];
    return ownerTransfers.filter((t) => t.ownerId === owner.id);
  }, [ownerTransfers, owner]);

  // Linked Commissions (Admin Fees)
  const ownerCommissions = useMemo(() => {
    if (!owner) return [];
    return commissions.filter((c) => c.ownerId === owner.id);
  }, [commissions, owner]);

  // Linked Expenses
  const ownerExpenses = useMemo(() => {
    const propIds = new Set(ownerProperties.map((p) => p.id));
    return propertyExpenses.filter(
      (e) => e.ownerId === owner?.id || (e.propertyId && propIds.has(e.propertyId))
    );
  }, [propertyExpenses, owner, ownerProperties]);

  // Linked Maintenance
  const ownerMaintenance = useMemo(() => {
    const propIds = new Set(ownerProperties.map((p) => p.id));
    return maintenanceRequests.filter(
      (m) => m.ownerId === owner?.id || (m.propertyId && propIds.has(m.propertyId))
    );
  }, [maintenanceRequests, owner, ownerProperties]);

  // Authoritative Owner Payable Reconciliation
  const payableDetails = useMemo(() => {
    if (!owner) {
      return {
        totalRentCollected: 0,
        totalOwnerCommissions: 0,
        totalOwnerExpenses: 0,
        totalTransfersPaid: 0,
        totalTransfersPending: 0,
        totalAdjustments: 0,
        currentPayableBalance: 0,
        netRemainingBalance: 0,
        grossRentCollected: 0,
        totalDeductions: 0,
        totalTransferred: 0,
      };
    }
    const res = getOwnerPayable(owner.id);
    return {
      ...res,
      grossRentCollected: res.totalRentCollected,
      totalDeductions: res.totalOwnerCommissions + res.totalOwnerExpenses,
      totalTransferred: res.totalTransfersPaid,
    };
  }, [owner, getOwnerPayable]);

  // Occupancy metrics across owner portfolio
  const portfolioOccupancy = useMemo(() => {
    const total = ownerUnits.length;
    const occupied = ownerUnits.filter((u) => u.status === "OCCUPIED" || u.currentTenantId).length;
    const vacant = total - occupied;
    const rate = total > 0 ? (occupied / total) * 100 : 0;
    return { total, occupied, vacant, rate: rate.toFixed(1) };
  }, [ownerUnits]);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Export Excel handler
  const handleExportExcel = () => {
    if (!owner) return;
    const wb = XLSX.utils.book_new();

    const ownerProfile = [
      { [isAr ? "البيان" : "Field"]: isAr ? "اسم المالك" : "Owner Name", [isAr ? "القيمة" : "Value"]: isAr ? owner.nameAr : owner.nameEn },
      { [isAr ? "البيان" : "Field"]: isAr ? "الكود" : "Code", [isAr ? "القيمة" : "Value"]: owner.code },
      { [isAr ? "البيان" : "Field"]: isAr ? "رقم التسجيل الضريبي (TRN)" : "Tax Registration Number (TRN)", [isAr ? "القيمة" : "Value"]: owner.trn || (isAr ? "غير مسجل" : "Not Registered") },
      { [isAr ? "البيان" : "Field"]: isAr ? "الهاتف" : "Phone", [isAr ? "القيمة" : "Value"]: owner.phone },
      { [isAr ? "البيان" : "Field"]: isAr ? "الآيبان البنكي" : "IBAN", [isAr ? "القيمة" : "Value"]: owner.iban || "---" },
      { [isAr ? "البيان" : "Field"]: isAr ? "إجمالي العقارات" : "Total Properties", [isAr ? "القيمة" : "Value"]: ownerProperties.length },
      { [isAr ? "البيان" : "Field"]: isAr ? "إجمالي الوحدات" : "Total Units", [isAr ? "القيمة" : "Value"]: ownerUnits.length },
      { [isAr ? "البيان" : "Field"]: isAr ? "إجمالي الإيرادات المحصلة" : "Gross Rent Inflow", [isAr ? "القيمة" : "Value"]: `${payableDetails.grossRentCollected} AED` },
      { [isAr ? "البيان" : "Field"]: isAr ? "إجمالي الخصومات والعمولات" : "Total Deductions", [isAr ? "القيمة" : "Value"]: `${payableDetails.totalDeductions} AED` },
      { [isAr ? "البيان" : "Field"]: isAr ? "إجمالي الحوالات المنفذة" : "Transferred to Owner", [isAr ? "القيمة" : "Value"]: `${payableDetails.totalTransferred} AED` },
      { [isAr ? "البيان" : "Field"]: isAr ? "صافي الرصيد المستحق للمالك" : "Net Owner Payable", [isAr ? "القيمة" : "Value"]: `${payableDetails.currentPayableBalance} AED` },
    ];

    const ws = XLSX.utils.json_to_sheet(ownerProfile);
    XLSX.utils.book_append_sheet(wb, ws, "Owner_360");
    XLSX.writeFile(wb, `Owner360_${owner.code || owner.id}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (!owner) {
    return (
      <div className="p-8 text-center text-slate-500">
        {isAr ? "لم يتم العثور على المالك" : "Owner not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Printable Header with Office Logo and Name */}
      <OfficePrintHeader
        titleAr={`كشف حساب ملف المالك الشامل (${owner.nameAr || owner.nameEn})`}
        titleEn={`OWNER 360 COMPREHENSIVE STATEMENT (${owner.nameEn || owner.nameAr})`}
        subtitleAr={`كود المالك: ${owner.code || "---"} | هاتف: ${owner.phone || "---"} | IBAN: ${owner.iban || "---"}`}
        subtitleEn={`Owner Code: ${owner.code || "---"} | Phone: ${owner.phone || "---"} | IBAN: ${owner.iban || "---"}`}
        hideOnScreen={true}
        extraInfo={[
          { labelAr: "إجمالي العقارات", labelEn: "Properties", value: ownerProperties.length.toString() },
          { labelAr: "إجمالي الوحدات", labelEn: "Units", value: ownerUnits.length.toString() },
          { labelAr: "نسبة الإشغال", labelEn: "Occupancy", value: `${portfolioOccupancy.rate}%` },
          { labelAr: "صافي المستحق", labelEn: "Net Payable", value: `AED ${payableDetails.currentPayableBalance.toLocaleString()}` },
        ]}
      />

      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <span>{isAr ? "الملاك" : "Owners"}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            <span className="text-white">{isAr ? owner.nameAr : owner.nameEn}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
              {owner.code || "OWN"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-indigo-400" />
            <span>{isAr ? owner.nameAr : owner.nameEn}</span>
          </h1>
          <p className="text-xs text-slate-300 flex items-center gap-3">
            <span>{isAr ? "الهاتف:" : "Phone:"} {owner.phone}</span>
            <span>•</span>
            <span>{isAr ? "IBAN:" : "IBAN:"} {owner.iban || "AE-- ---- ---- ---- ---- ---"}</span>
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
            <span>{isAr ? "كشف حساب المالك" : "Print Statement"}</span>
          </button>
          <CloseBackButton onClose={onClose} variant="dark" />
        </div>
      </div>

      {/* Synchronized Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "overview", labelAr: "نظرة عامة ومستحقات", labelEn: "Overview & Balance", icon: UserCheck, count: null },
          { id: "analytics", labelAr: "تحليلات الإشغال والعقود", labelEn: "Occupancy & Leases", icon: TrendingUp, count: ownerUnits.length },
          { id: "properties", labelAr: "العقارات", labelEn: "Properties", icon: Building2, count: ownerProperties.length },
          { id: "units", labelAr: "الوحدات الإيجارية", labelEn: "Units", icon: Home, count: ownerUnits.length },
          { id: "leases", labelAr: "العقود", labelEn: "Leases", icon: FileText, count: ownerLeases.length },
          { id: "collections", labelAr: "المقبوضات", labelEn: "Collections", icon: Receipt, count: ownerCollections.length },
          { id: "transfers", labelAr: "الحوالات المنفذة", labelEn: "Transfers", icon: ArrowRightLeft, count: ownerTransferList.length },
          { id: "commissions", labelAr: "الرسوم الإدارية", labelEn: "Admin Fees", icon: DollarSign, count: ownerCommissions.length },
          { id: "expenses", labelAr: "المصاريف", labelEn: "Expenses", icon: DollarSign, count: ownerExpenses.length },
          { id: "maintenance", labelAr: "الصيانة", labelEn: "Maintenance", icon: Wrench, count: ownerMaintenance.length },
          { id: "documents", labelAr: "المستندات", labelEn: "Documents", icon: FolderOpen, count: archive.filter((a) => a.recordId === owner.id).length },
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

      {/* 1. OVERVIEW & PAYABLE TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Authoritative Owner Payable Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "إجمالي الإيرادات المحصلة" : "Gross Collected"}</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {payableDetails.grossRentCollected.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{ownerCollections.length} {isAr ? "سند قبض محصل" : "receipt vouchers"}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "إجمالي الخصومات والعمولات" : "Total Deductions"}</span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {payableDetails.totalDeductions.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {isAr ? "عمولات ومصاريف وصيانة" : "Commissions, expenses & maintenance"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "الحوالات المنفذة للمالك" : "Transferred to Owner"}</span>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {payableDetails.totalTransferred.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{ownerTransferList.length} {isAr ? "حوالات بنكية" : "bank transfers"}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {isAr ? "صافي الرصيد المستحق للمالك" : "Net Owner Payable"}
              </span>
              <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                {payableDetails.currentPayableBalance.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-500 mt-1">{isAr ? "الرصيد الجاهز للصرف" : "Balance ready for payout"}</div>
            </div>
          </div>

          {/* Properties & Portfolio Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>{isAr ? "محفظة عقارات المالك" : "Properties Portfolio"} ({ownerProperties.length})</span>
              </h3>

              <div className="space-y-3">
                {ownerProperties.map((prop) => {
                  const propUnits = ownerUnits.filter((u) => u.propertyId === prop.id);
                  return (
                    <div
                      key={prop.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">
                          {isAr ? prop.nameAr : prop.nameEn}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {propUnits.length} {isAr ? "وحدة إيجارية" : "units"} • {prop.type || "Residential"}
                        </div>
                      </div>
                      {onNavigateToProperty && (
                        <button
                          onClick={() => onNavigateToProperty(prop.id)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 rounded-lg hover:bg-indigo-100"
                        >
                          {isAr ? "العقار 360" : "Property 360"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bank Accounts & Identity Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>{isAr ? "بيانات الهوية والحسابات البنكية" : "Identity & Bank Details"}</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "اسم البنك" : "Bank Name"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{owner.bankName || ""}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "رقم الحساب الدولي (IBAN)" : "IBAN"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{owner.iban || "AE45 0260 0000 0000 0000 000"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "رقم الهوية / الجواز" : "National ID / Passport"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{owner.emiratesId || owner.passportNo || "784-XXXX-XXXXXXX-X"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "الجنسية" : "Nationality"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{owner.nationality || "-"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "تاريخ الميلاد" : "Date of Birth"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{owner.dateOfBirth || "-"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "الجنس" : "Gender"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {owner.gender === "MALE" ? (isAr ? "ذكر" : "Male") : owner.gender === "FEMALE" ? (isAr ? "أنثى" : "Female") : "-"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "إنتهاء الهوية" : "ID Expiry"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{owner.expiryDate || "-"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "رقم التسجيل الضريبي (TRN)" : "Tax Registration Number (TRN)"}</span>
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">{owner.trn || (isAr ? "غير مسجل" : "Not Registered")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Owner Portfolio Occupancy & Lease Analytics Component */}
          <OwnerOccupancyAnalytics
            owner={owner}
            properties={properties}
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
        <OwnerOccupancyAnalytics
          owner={owner}
          properties={properties}
          units={units}
          leases={leases}
          tenants={tenants}
          cheques={cheques}
          collections={collections}
          onNavigateToUnit={onNavigateToUnit}
        />
      )}

      {/* 3. PROPERTIES TAB */}
      {activeTab === "properties" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "عقارات المالك" : "Owner Properties"} ({ownerProperties.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "كود العقار" : "Property Code"}</th>
                  <th className="px-4 py-3">{isAr ? "اسم العقار" : "Property Name"}</th>
                  <th className="px-4 py-3">{isAr ? "النوع" : "Type"}</th>
                  <th className="px-4 py-3">{isAr ? "المنطقة" : "Community"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ownerProperties.map((prop) => (
                  <tr key={prop.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{prop.code}</td>
                    <td className="px-4 py-3 font-medium">{isAr ? prop.nameAr : prop.nameEn}</td>
                    <td className="px-4 py-3">{prop.type}</td>
                    <td className="px-4 py-3">{prop.community || "---"}</td>
                    <td className="px-4 py-3 text-center">
                      {onNavigateToProperty && (
                        <button
                          type="button"
                          onClick={() => onNavigateToProperty(prop.id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition"
                        >
                          {isAr ? "عرض التفاصيل" : "View 360"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {ownerProperties.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد عقارات مسجلة لهذا المالك" : "No properties registered for this owner"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. UNITS TAB */}
      {activeTab === "units" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Home className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "الوحدات الإيجارية للمالك" : "Owner Units"} ({ownerUnits.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الوحدة" : "Unit Number"}</th>
                  <th className="px-4 py-3">{isAr ? "العقار التابع" : "Property"}</th>
                  <th className="px-4 py-3">{isAr ? "النوع" : "Type"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "الإيجار السنوي" : "Annual Rent"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ownerUnits.map((unit) => {
                  const prop = properties.find((p) => p.id === unit.propertyId);
                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{unit.unitNumber}</td>
                      <td className="px-4 py-3">{prop ? (isAr ? prop.nameAr : prop.nameEn) : "---"}</td>
                      <td className="px-4 py-3">{unit.type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          unit.status === "OCCUPIED"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {unit.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">
                        {(unit.annualRent || 0).toLocaleString()} AED
                      </td>
                      <td className="px-4 py-3 text-center">
                        {onNavigateToUnit && (
                          <button
                            type="button"
                            onClick={() => onNavigateToUnit(unit.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition"
                          >
                            {isAr ? "عرض الوحدة" : "Unit 360"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {ownerUnits.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد وحدات مسجلة" : "No units found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LEASES TAB */}
      {activeTab === "leases" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "العقود الإيجارية للمالك" : "Owner Leases"} ({ownerLeases.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم العقد" : "Lease Number"}</th>
                  <th className="px-4 py-3">{isAr ? "العقار" : "Property"}</th>
                  <th className="px-4 py-3">{isAr ? "الوحدة" : "Unit"}</th>
                  <th className="px-4 py-3">{isAr ? "المستأجر" : "Tenant"}</th>
                  <th className="px-4 py-3">{isAr ? "الفترة" : "Period"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "القيمة الإيجارية" : "Rent Value"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ownerLeases.map((lease) => {
                  const prop = properties.find((p) => p.id === lease.propertyId);
                  const unit = units.find((u) => u.id === lease.unitId);
                  const tenant = tenants.find((t) => t.id === lease.tenantId);
                  return (
                    <tr key={lease.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{lease.leaseNumber || lease.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">{prop ? (isAr ? prop.nameAr : prop.nameEn) : "---"}</td>
                      <td className="px-4 py-3 font-mono">{unit?.unitNumber || "---"}</td>
                      <td className="px-4 py-3">{tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "---"}</td>
                      <td className="px-4 py-3 text-slate-500 text-[10px] whitespace-nowrap">{lease.startDate} ➔ {lease.endDate}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lease.contractStatus === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
                            type="button"
                            onClick={() => onNavigateToLease(lease.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition"
                          >
                            {isAr ? "عرض العقد" : "Workspace"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {ownerLeases.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد عقود إيجارية" : "No leases found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. COLLECTIONS TAB */}
      {activeTab === "collections" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "سندات القبض والمقبوضات للمالك" : "Owner Collections"} ({ownerCollections.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم السند" : "Receipt #"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Payment Date"}</th>
                  <th className="px-4 py-3">{isAr ? "المستأجر" : "Tenant"}</th>
                  <th className="px-4 py-3">{isAr ? "طريقة الدفع" : "Method"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ المقبوض" : "Amount Paid"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ownerCollections.map((col) => {
                  const tenant = tenants.find((t) => t.id === col.tenantId);
                  return (
                    <tr key={col.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{col.receiptNumber || col.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{col.paymentDate || col.createdAt.slice(0, 10)}</td>
                      <td className="px-4 py-3">{tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : col.tenantId || "---"}</td>
                      <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">{col.paymentMethod}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                        {Number(col.amountApplied || col.amountEntered || 0).toLocaleString()} AED
                      </td>
                    </tr>
                  );
                })}
                {ownerCollections.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد مقبوضات مسجلة" : "No collection records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TRANSFERS TAB */}
      {activeTab === "transfers" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "الحوالات المالية المصروفة للمالك" : "Owner Transfers"} ({ownerTransferList.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الحوالة / السند" : "Reference #"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الحوالة" : "Transfer Date"}</th>
                  <th className="px-4 py-3">{isAr ? "طريقة التحويل" : "Payment Method"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ المحول" : "Amount Transferred"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ownerTransferList.map((trsf) => (
                  <tr key={trsf.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{trsf.transferNumber || (trsf as any).referenceNo || trsf.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{trsf.transferDate}</td>
                    <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-400">{trsf.paymentMethod || "Bank Transfer"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {isAr ? "مكتملة" : "COMPLETED"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">
                      {trsf.amount.toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {ownerTransferList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد حوالات مالية مسجلة" : "No owner transfers found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. COMMISSIONS TAB */}
      {activeTab === "commissions" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "العمولات والرسوم الإدارية المخصومة" : "Admin Fees & Commissions"} ({ownerCommissions.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم المطالبة" : "Reference #"}</th>
                  <th className="px-4 py-3">{isAr ? "نوع الرسوم" : "Fee Type"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ownerCommissions.map((comm) => (
                  <tr key={comm.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{comm.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-bold">{comm.feeCategory || (comm as any).feeType || (isAr ? "عمولة إدارة عقار" : "Management Commission")}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{comm.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        comm.status === "COLLECTED" || (comm as any).isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {comm.status === "COLLECTED" || (comm as any).isPaid ? (isAr ? "مدفوعة" : "Paid") : (isAr ? "مستحقة" : "Unpaid")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      {Number(comm.collectedAmount || comm.totalCommissionAmount || 0).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {ownerCommissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد رسوم إدارية مسجلة" : "No commission records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. EXPENSES TAB */}
      {activeTab === "expenses" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "المصاريف المخصومة من حساب المالك" : "Owner Expenses"} ({ownerExpenses.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "كود السند" : "Reference"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Expense Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "الوصف" : "Description"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ownerExpenses.map((exp) => {
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
                {ownerExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد مصاريف مسجلة" : "No expenses found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. MAINTENANCE TAB */}
      {activeTab === "maintenance" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "طلبات صيانة العقارات المملوكة" : "Owner Maintenance Portfolio"} ({ownerMaintenance.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الطلب" : "Reference #"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Request Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "الوصف" : "Description"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "التكلفة" : "Total Cost"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ownerMaintenance.map((mnt) => (
                  <tr key={mnt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{mnt.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{mnt.requestDate || mnt.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-bold">{mnt.category}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{mnt.issueDescription}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        mnt.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {mnt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      {Number(mnt.totalCost || 0).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {ownerMaintenance.length === 0 && (
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

      {/* 10. DOCUMENTS TAB */}
      {activeTab === "documents" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "المستندات والملفات الملحقة" : "Attached Documents"}</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "اسم المستند" : "Document Title"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "رقم النسخة" : "Version"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الإضافة" : "Date Uploaded"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {archive
                  .filter((a) => a.recordId === owner.id)
                  .map((doc, idx) => (
                    <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{doc.fileName || doc.recordTitle || (doc as any).title}</td>
                      <td className="px-4 py-3">{doc.category}</td>
                      <td className="px-4 py-3 font-mono">{(doc as any).version || "1.0"}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{doc.uploadDate || (doc as any).uploadedAt || doc.createdAt?.slice(0, 10) || "---"}</td>
                    </tr>
                  ))}
                {archive.filter((a) => a.recordId === owner.id).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد مستندات مرفوعة" : "No uploaded documents found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
