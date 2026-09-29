import React, { useState, useMemo } from "react";
import {
  Users,
  Building2,
  Home,
  FileText,
  DollarSign,
  Receipt,
  AlertTriangle,
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
  MessageSquare,
  CheckSquare,
  Scale,
  Eye,
  Camera,
  TrendingUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { OfficePrintHeader } from "../common/OfficePrintHeader";
import { DocumentPreviewModal } from "../common/DocumentPreviewModal";
import { DocumentScanner } from "../common/DocumentScanner";
import { Tenant, Lease, Property, Unit, Cheque, CollectionRecord, MaintenanceRequest, RentalCase, CollectionAction, PaymentPromise, ElectronicArchiveItem, DocumentCategory } from "../../types";
import { TenantOccupancyAnalytics } from "./TenantOccupancyAnalytics";

interface Tenant360WorkspaceProps {
  tenantId: string;
  onClose?: () => void;
  onNavigateToProperty?: (propertyId: string) => void;
  onNavigateToUnit?: (unitId: string) => void;
  onNavigateToLease?: (leaseId: string) => void;
  onNavigateToOwner?: (ownerId: string) => void;
}

export const Tenant360Workspace: React.FC<Tenant360WorkspaceProps> = ({
  tenantId,
  onClose,
  onNavigateToProperty,
  onNavigateToUnit,
  onNavigateToLease,
  onNavigateToOwner,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    tenants,
    leases,
    properties,
    units,
    owners,
    cheques,
    collections,
    maintenanceRequests,
    cases,
    collectionActions,
    paymentPromises,
    archive,
    auditLogs,
  } = useData();

  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "analytics"
    | "leases"
    | "payments"
    | "cheques"
    | "bounced"
    | "collections"
    | "promises"
    | "maintenance"
    | "cases"
    | "documents"
    | "timeline"
  >("overview");

  const [previewDocument, setPreviewDocument] = useState<ElectronicArchiveItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Target Tenant
  const tenant = useMemo(() => {
    return tenants.find((t) => t.id === tenantId) || tenants[0];
  }, [tenants, tenantId]);

  // Linked Leases
  const tenantLeases = useMemo(() => {
    if (!tenant) return [];
    return leases
      .filter((l) => l.tenantId === tenant.id)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leases, tenant]);

  // Active Lease
  const activeLease = useMemo(() => {
    return tenantLeases.find((l) => l.contractStatus === "ACTIVE") || null;
  }, [tenantLeases]);

  // Active Property & Unit
  const currentProperty = useMemo(() => {
    if (!activeLease) return null;
    return properties.find((p) => p.id === activeLease.propertyId) || null;
  }, [properties, activeLease]);

  const currentUnit = useMemo(() => {
    if (!activeLease) return null;
    return units.find((u) => u.id === activeLease.unitId) || null;
  }, [units, activeLease]);

  // Linked Cheques
  const tenantCheques = useMemo(() => {
    if (!tenant) return [];
    return cheques
      .filter((c) => c.tenantId === tenant.id)
      .sort((a, b) => new Date(b.chequeDate).getTime() - new Date(a.chequeDate).getTime());
  }, [cheques, tenant]);

  // Bounced Cheques
  const bouncedCheques = useMemo(() => {
    return tenantCheques.filter(
      (c) => c.status === "BOUNCED" || c.originalStatus === "BOUNCED"
    );
  }, [tenantCheques]);

  // Linked Payments / Collections
  const tenantPayments = useMemo(() => {
    if (!tenant) return [];
    return collections
      .filter((c) => c.tenantId === tenant.id)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [collections, tenant]);

  // Linked Maintenance Requests
  const tenantMaintenance = useMemo(() => {
    if (!tenant) return [];
    return maintenanceRequests.filter((m) => m.tenantId === tenant.id);
  }, [maintenanceRequests, tenant]);

  // Linked Legal Cases
  const tenantCases = useMemo(() => {
    if (!tenant) return [];
    return cases.filter((c) => c.tenantId === tenant.id);
  }, [cases, tenant]);

  // Collection Actions & Promises
  const tenantCollectionActions = useMemo(() => {
    if (!tenant) return [];
    return (collectionActions || []).filter((a) => a.tenantId === tenant.id);
  }, [collectionActions, tenant]);

  const tenantPromises = useMemo(() => {
    if (!tenant) return [];
    return (paymentPromises || []).filter((p) => p.tenantId === tenant.id);
  }, [paymentPromises, tenant]);

  // Authoritative Risk Calculation Parity
  const riskDetails = useMemo(() => {
    const bouncedCount = bouncedCheques.length;
    const activeCasesCount = tenantCases.filter((c) => c.status !== "SETTLED" && c.status !== "CLOSED").length;
    const brokenPromisesCount = tenantPromises.filter((p) => p.status === "BROKEN").length;

    let level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    const reasons: string[] = [];

    if (activeCasesCount > 0 || bouncedCount >= 2 || brokenPromisesCount >= 2) {
      level = "CRITICAL";
      if (activeCasesCount > 0) reasons.push(isAr ? `توجد ${activeCasesCount} قضايا إيجارية نشطة` : `${activeCasesCount} active legal cases`);
      if (bouncedCount >= 2) reasons.push(isAr ? `تكرار شيكات مرتجعة (${bouncedCount})` : `Multiple bounced cheques (${bouncedCount})`);
      if (brokenPromisesCount >= 2) reasons.push(isAr ? `إخلال بوعود سداد متعددة` : `Multiple broken payment promises`);
    } else if (bouncedCount === 1 || brokenPromisesCount === 1) {
      level = "HIGH";
      if (bouncedCount === 1) reasons.push(isAr ? "يوجد شيك مرتجع واحد" : "1 bounced cheque on record");
      if (brokenPromisesCount === 1) reasons.push(isAr ? "إخلال بوعد سداد" : "1 broken payment promise");
    } else if (tenantLeases.length > 0 && activeLease?.paymentFrequency === "MONTHLY") {
      level = "MEDIUM";
      reasons.push(isAr ? "دفعات شهرية منتظمة" : "Monthly installment schedule");
    } else {
      level = "LOW";
      reasons.push(isAr ? "سجل ائتماني ممتاز وملتزم" : "Excellent payment track record");
    }

    return { level, reasons };
  }, [bouncedCheques, tenantCases, tenantPromises, tenantLeases, activeLease, isAr]);

  // Total Outstanding Debt Calculation
  const financialSummary = useMemo(() => {
    const totalContractValue = tenantLeases.reduce((sum, l) => sum + l.annualRent, 0);
    const totalPaid = tenantPayments.reduce(
      (sum, p) => sum + (p.amountApplied || p.amountEntered || 0),
      0
    );
    const totalBouncedAmount = bouncedCheques.reduce(
      (sum, b) => sum + (b.outstanding !== undefined ? b.outstanding : b.amount),
      0
    );
    const outstandingBalance = Math.max(0, totalContractValue - totalPaid);

    return {
      totalContractValue,
      totalPaid,
      totalBouncedAmount,
      outstandingBalance,
    };
  }, [tenantLeases, tenantPayments, bouncedCheques]);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Export Excel
  const handleExportExcel = () => {
    if (!tenant) return;
    const wb = XLSX.utils.book_new();

    const tenantProfile = [
      { [isAr ? "البيان" : "Field"]: isAr ? "اسم المستأجر" : "Tenant Name", [isAr ? "القيمة" : "Value"]: isAr ? tenant.nameAr : tenant.nameEn },
      { [isAr ? "البيان" : "Field"]: isAr ? "الهوية الإماراتية" : "Emirates ID", [isAr ? "القيمة" : "Value"]: tenant.emiratesId || "---" },
      { [isAr ? "البيان" : "Field"]: isAr ? "رقم الهاتف" : "Phone", [isAr ? "القيمة" : "Value"]: tenant.phone },
      { [isAr ? "البيان" : "Field"]: isAr ? "البريد الإلكتروني" : "Email", [isAr ? "القيمة" : "Value"]: tenant.email || "---" },
      { [isAr ? "البيان" : "Field"]: isAr ? "مستوى المخاطر" : "Risk Level", [isAr ? "القيمة" : "Value"]: riskDetails.level },
      { [isAr ? "البيان" : "Field"]: isAr ? "إجمالي العقود" : "Total Contract Value", [isAr ? "القيمة" : "Value"]: `${financialSummary.totalContractValue} AED` },
      { [isAr ? "البيان" : "Field"]: isAr ? "إجمالي المسدد" : "Total Paid", [isAr ? "القيمة" : "Value"]: `${financialSummary.totalPaid} AED` },
      { [isAr ? "البيان" : "Field"]: isAr ? "الرصيد المستحق" : "Outstanding Balance", [isAr ? "القيمة" : "Value"]: `${financialSummary.outstandingBalance} AED` },
    ];

    const ws = XLSX.utils.json_to_sheet(tenantProfile);
    XLSX.utils.book_append_sheet(wb, ws, "Tenant_360");
    XLSX.writeFile(wb, `Tenant360_${tenant.code || tenant.id}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (!tenant) {
    return (
      <div className="p-8 text-center text-slate-500">
        {isAr ? "لم يتم العثور على المستأجر" : "Tenant not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Printable Header with Office Logo and Name */}
      <OfficePrintHeader
        titleAr={`كشف حساب وسجل المستأجر الشامل (${tenant.nameAr || tenant.nameEn})`}
        titleEn={`TENANT 360 COMPREHENSIVE DOSSIER (${tenant.nameEn || tenant.nameAr})`}
        subtitleAr={`كود المستأجر: ${tenant.code || "---"} | هاتف: ${tenant.phone || "---"} | الهوية: ${tenant.emiratesId || tenant.passportNo || tenant.passportNumber || "---"}`}
        subtitleEn={`Tenant Code: ${tenant.code || "---"} | Phone: ${tenant.phone || "---"} | ID: ${tenant.emiratesId || tenant.passportNo || tenant.passportNumber || "---"}`}
        hideOnScreen={true}
        extraInfo={[
          { labelAr: "إجمالي العقود", labelEn: "Total Leases", value: tenantLeases.length.toString() },
          { labelAr: "العقود السارية", labelEn: "Active Leases", value: tenantLeases.filter((l) => l.contractStatus === "ACTIVE").length.toString() },
          { labelAr: "مستوى المخاطر", labelEn: "Risk Level", value: riskDetails.level },
        ]}
      />

      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <span>{isAr ? "المستأجرون" : "Tenants"}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            <span className="text-white">{isAr ? tenant.nameAr : tenant.nameEn}</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                riskDetails.level === "CRITICAL"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : riskDetails.level === "HIGH"
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                  : riskDetails.level === "MEDIUM"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {isAr ? `مستوى المخاطر: ${riskDetails.level}` : `Risk: ${riskDetails.level}`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>{isAr ? tenant.nameAr : tenant.nameEn}</span>
          </h1>
          <p className="text-xs text-slate-300 flex items-center gap-3">
            <span>{isAr ? "الهاتف:" : "Phone:"} {tenant.phone}</span>
            <span>•</span>
            <span>{isAr ? "الهوية:" : "EID:"} {tenant.emiratesId || "784-XXXX-XXXXXXX-X"}</span>
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
            <span>{isAr ? "طباعة الملف 360" : "Print Profile"}</span>
          </button>
          <CloseBackButton onClose={onClose} variant="dark" />
        </div>
      </div>

      {/* Synchronized Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "overview", labelAr: "نظرة عامة والمخاطر", labelEn: "Overview & Risk", icon: Users, count: null },
          { id: "analytics", labelAr: "تحليلات الإشغال والعقود", labelEn: "Occupancy & Leases", icon: TrendingUp, count: tenantLeases.length },
          { id: "leases", labelAr: "العقود الإيجارية", labelEn: "Leases", icon: FileText, count: tenantLeases.length },
          { id: "payments", labelAr: "سندات القبض", labelEn: "Receipts", icon: Receipt, count: tenantPayments.length },
          { id: "cheques", labelAr: "الشيكات", labelEn: "Cheques", icon: DollarSign, count: tenantCheques.length },
          { id: "bounced", labelAr: "الشيكات المرتجعة", labelEn: "Bounced", icon: AlertTriangle, count: bouncedCheques.length },
          { id: "collections", labelAr: "إجراءات التحصيل", labelEn: "Collections", icon: MessageSquare, count: tenantCollectionActions.length },
          { id: "promises", labelAr: "وعود السداد", labelEn: "Promises", icon: CheckSquare, count: tenantPromises.length },
          { id: "maintenance", labelAr: "الصيانة", labelEn: "Maintenance", icon: Wrench, count: tenantMaintenance.length },
          { id: "cases", labelAr: "القضايا", labelEn: "Cases", icon: Gavel, count: tenantCases.length },
          { id: "documents", labelAr: "المستندات", labelEn: "Documents", icon: FolderOpen, count: archive.filter((a) => a.recordId === tenant.id).length },
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

      {/* 1. OVERVIEW & RISK TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "إجمالي الالتزامات الإيجارية" : "Total Contract Value"}</span>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {financialSummary.totalContractValue.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{tenantLeases.length} {isAr ? "عقود إيجارية" : "lease agreements"}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "إجمالي المسدد" : "Total Paid"}</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {financialSummary.totalPaid.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{tenantPayments.length} {isAr ? "سندات قبض مسددة" : "receipts paid"}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "الرصيد المتبقي المستحق" : "Outstanding Balance"}</span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {financialSummary.outstandingBalance.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{isAr ? "ذمم إيجارية غير مسددة" : "Unpaid rent receivables"}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "الشيكات المرتجعة" : "Bounced Cheques"}</span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {financialSummary.totalBouncedAmount.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{bouncedCheques.length} {isAr ? "شيكات مرتجعة" : "bounced cheques"}</div>
            </div>
          </div>

          {/* Risk Factors & Active Occupancy */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Indicator Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {isAr ? "تقييم المخاطر الائتمانية والتشغيلية" : "Credit & Operational Risk Assessment"}
              </h3>

              <div className="space-y-3">
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    riskDetails.level === "CRITICAL"
                      ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-800 dark:text-rose-300"
                      : riskDetails.level === "HIGH"
                      ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 text-orange-800 dark:text-orange-300"
                      : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  <div>
                    <div className="text-xs font-black uppercase">{isAr ? "مستوى المخاطر الحالي" : "Current Risk Tier"}</div>
                    <div className="text-lg font-black">{riskDetails.level}</div>
                  </div>
                  <ShieldCheck className="w-8 h-8 opacity-80" />
                </div>

                <div className="space-y-1.5 pt-2 text-xs">
                  <div className="font-bold text-slate-700 dark:text-slate-300">{isAr ? "أسباب التقييم الائتماني:" : "Risk Factors:"}</div>
                  {riskDetails.reasons.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Property & Lease */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                {isAr ? "العقار والوحدة الحالية" : "Active Occupancy & Lease"}
              </h3>

              {activeLease && currentProperty && currentUnit ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">{isAr ? "العقار والوحدة" : "Property & Unit"}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {isAr ? currentProperty.nameAr : currentProperty.nameEn} — {isAr ? `وحدة ${currentUnit.unitNumber}` : `Unit #${currentUnit.unitNumber}`}
                      </span>
                    </div>
                    {onNavigateToProperty && (
                      <button
                        onClick={() => onNavigateToProperty(currentProperty.id)}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 rounded-lg hover:bg-indigo-100"
                      >
                        {isAr ? "العقار 360" : "Property 360"}
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">{isAr ? "العقد الحالي" : "Active Lease"}</span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {activeLease.leaseNumber || activeLease.id.slice(0, 8)} ({Number(activeLease.annualRent || 0).toLocaleString()} AED)
                      </span>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {activeLease.startDate} ➔ {activeLease.endDate}
                      </div>
                    </div>
                    {onNavigateToLease && (
                      <button
                        onClick={() => onNavigateToLease(activeLease.id)}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 rounded-lg hover:bg-indigo-100"
                      >
                        {isAr ? "مساحة العقد" : "Lease"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-6 text-center">
                  {isAr ? "لا يوجد عقد إيجار نشط حالياً للمستأجر" : "No active lease currently on record"}
                </div>
              )}
            </div>
          </div>
          
          {/* Identity & Personal Details */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "البيانات الشخصية والهوية" : "Identity & Personal Details"}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <span className="text-slate-400 block">{isAr ? "الجنسية" : "Nationality"}</span>
                <span className="font-bold text-slate-900 dark:text-white">{tenant.nationality || "-"}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <span className="text-slate-400 block">{isAr ? "تاريخ الميلاد" : "Date of Birth"}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{tenant.dateOfBirth || "-"}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <span className="text-slate-400 block">{isAr ? "الجنس" : "Gender"}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {tenant.gender === "MALE" ? (isAr ? "ذكر" : "Male") : tenant.gender === "FEMALE" ? (isAr ? "أنثى" : "Female") : "-"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <span className="text-slate-400 block">{isAr ? "تاريخ إنتهاء الهوية" : "ID Expiry Date"}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{tenant.expiryDate || "-"}</span>
              </div>
            </div>
          </div>

          {/* Interactive Tenant Occupancy & Lease History Analytics */}
          <TenantOccupancyAnalytics
            tenant={tenant}
            leases={leases}
            units={units}
            properties={properties}
            cheques={cheques}
            collections={collections}
            onNavigateToUnit={onNavigateToUnit}
          />
        </div>
      )}

      {/* 2. DEDICATED ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <TenantOccupancyAnalytics
          tenant={tenant}
          leases={leases}
          units={units}
          properties={properties}
          cheques={cheques}
          collections={collections}
          onNavigateToUnit={onNavigateToUnit}
        />
      )}

      {/* 3. LEASES TAB */}
      {activeTab === "leases" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "العقود الإيجارية للمستأجر" : "Tenant Leases"} ({tenantLeases.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم العقد" : "Lease Number"}</th>
                  <th className="px-4 py-3">{isAr ? "العقار" : "Property"}</th>
                  <th className="px-4 py-3">{isAr ? "الوحدة" : "Unit"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ البدء" : "Start Date"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الانتهاء" : "End Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "الإيجار السنوي" : "Annual Rent"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenantLeases.map((lease) => {
                  const prop = properties.find((p) => p.id === lease.propertyId);
                  const unit = units.find((u) => u.id === lease.unitId);
                  return (
                    <tr key={lease.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{lease.leaseNumber || lease.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-medium">{prop ? (isAr ? prop.nameAr : prop.nameEn) : "---"}</td>
                      <td className="px-4 py-3 font-mono">{unit?.unitNumber || "---"}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{lease.startDate}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{lease.endDate}</td>
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
                {tenantLeases.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد عقود إيجارية مسجلة" : "No leases found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. PAYMENTS TAB */}
      {activeTab === "payments" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "سندات القبض والمقبوضات المستلمة" : "Payments Received"} ({tenantPayments.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم السند" : "Receipt #"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ السند" : "Date"}</th>
                  <th className="px-4 py-3">{isAr ? "العقار" : "Property"}</th>
                  <th className="px-4 py-3">{isAr ? "طريقة الدفع" : "Method"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ المقبوض" : "Amount Paid"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenantPayments.map((pay) => {
                  const prop = properties.find((p) => p.id === (pay as any).propertyId || p.ownerId === pay.ownerId);
                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{pay.receiptNumber || pay.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{pay.paymentDate || pay.createdAt.slice(0, 10)}</td>
                      <td className="px-4 py-3 font-medium">{prop ? (isAr ? prop.nameAr : prop.nameEn) : "---"}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-bold">{pay.paymentMethod}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                        {Number(pay.amountApplied || pay.amountEntered || 0).toLocaleString()} AED
                      </td>
                    </tr>
                  );
                })}
                {tenantPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد دفعات مسجلة" : "No payment records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CHEQUES TAB */}
      {activeTab === "cheques" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "شيكات الإيجار المستلمة" : "Lease Cheques"} ({tenantCheques.length})</span>
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
                {tenantCheques.map((chq) => (
                  <tr key={chq.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{chq.chequeNumber}</td>
                    <td className="px-4 py-3">{chq.bankName}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{chq.chequeDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        chq.status === "CLEARED" || chq.status === "COLLECTED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : chq.status === "BOUNCED"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {chq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {chq.amount.toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {tenantCheques.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد شيكات مستلمة" : "No cheques found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. BOUNCED CHEQUES TAB */}
      {activeTab === "bounced" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-rose-600 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>{isAr ? "سجل الشيكات المرتجعة" : "Bounced Cheques History"} ({bouncedCheques.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الشيك" : "Cheque #"}</th>
                  <th className="px-4 py-3">{isAr ? "البنك" : "Bank"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الارتجاع" : "Bounced Date"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ المتأخر" : "Amount Outstanding"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bouncedCheques.map((chq) => (
                  <tr key={chq.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-rose-600">{chq.chequeNumber}</td>
                    <td className="px-4 py-3 font-medium">{chq.bankName}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{chq.chequeDate}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      {(chq.outstanding !== undefined ? chq.outstanding : chq.amount).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {bouncedCheques.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "سجل ائتماني نظيف - لا توجد شيكات مرتجعة" : "Excellent record - No bounced cheques"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. COLLECTIONS / ACTIONS TAB */}
      {activeTab === "collections" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "إجراءات المتابعة والتحصيل القانوني" : "Collection Actions"} ({tenantCollectionActions.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3">{isAr ? "النوع" : "Action Type"}</th>
                  <th className="px-4 py-3">{isAr ? "التفاصيل" : "Details"}</th>
                  <th className="px-4 py-3">{isAr ? "النتيجة" : "Outcome"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenantCollectionActions.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono text-slate-500">{act.actionDate}</td>
                    <td className="px-4 py-3 font-bold text-indigo-600">{act.actionType}</td>
                    <td className="px-4 py-3 max-w-[250px] truncate">{act.result || act.notes || (act as any).details || "---"}</td>
                    <td className="px-4 py-3">{act.result || (act as any).outcome || "---"}</td>
                  </tr>
                ))}
                {tenantCollectionActions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد إجراءات تحصيل مسجلة" : "No collection actions on record"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. PROMISES TAB */}
      {activeTab === "promises" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "وعود السداد والالتزامات المالية" : "Payment Promises"} ({tenantPromises.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "تاريخ الوعد" : "Promise Date"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ المحدد للسداد" : "Due Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ الموعود" : "Promised Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenantPromises.map((prm) => (
                  <tr key={prm.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono text-slate-500">{prm.promiseDate}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{prm.expectedPaymentDate || (prm as any).dueDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        prm.status === "FULFILLED" || (prm.status as string) === "KEPT"
                          ? "bg-emerald-100 text-emerald-800"
                          : prm.status === "BROKEN"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {prm.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {(prm.amountPromised || (prm as any).amount || 0).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
                {tenantPromises.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد وعود سداد مسجلة" : "No payment promises found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. MAINTENANCE TAB */}
      {activeTab === "maintenance" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "طلبات الصيانة المقدمة من المستأجر" : "Maintenance Requests"} ({tenantMaintenance.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الطلب" : "Reference #"}</th>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Request Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "الوصف" : "Issue Description"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenantMaintenance.map((mnt) => (
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
                  </tr>
                ))}
                {tenantMaintenance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد طلبات صيانة مقدمة" : "No maintenance records found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. CASES TAB */}
      {activeTab === "cases" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-rose-600 uppercase tracking-wider flex items-center gap-2">
            <Gavel className="w-4 h-4 text-rose-500" />
            <span>{isAr ? "القضايا والمنازعات القانونية" : "Rental Disputes & Legal Cases"} ({tenantCases.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم القضية" : "Case Number"}</th>
                  <th className="px-4 py-3">{isAr ? "نوع القضية" : "Case Type"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ البدء" : "Filing Date"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenantCases.map((cs) => (
                  <tr key={cs.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-rose-600">{cs.caseNumber}</td>
                    <td className="px-4 py-3 font-bold">{(cs as any).caseType || cs.courtName || "Eviction / Rental Claim"}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{cs.filingDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cs.status === "SETTLED" || cs.status === "CLOSED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}>
                        {cs.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {tenantCases.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "سجل قانوني ممتاز - لا توجد قضايا إيجارية" : "No legal cases on record"}
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "المستندات القانونية وبطاقات الهوية" : "Tenant Documents"}</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{isAr ? "مسح ضوئي بالكميرا" : "Scan Document"}</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "اسم المستند" : "Document Title"}</th>
                  <th className="px-4 py-3">{isAr ? "الفئة" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "رقم النسخة" : "Version"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الإضافة" : "Date Uploaded"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "معاينة" : "Preview"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {archive
                  .filter((a) => a.recordId === tenant.id || a.entityId === tenant.id)
                  .map((doc, idx) => (
                    <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{doc.fileName || doc.recordTitle || (doc as any).title}</td>
                      <td className="px-4 py-3">{doc.category}</td>
                      <td className="px-4 py-3 font-mono">{(doc as any).version || "1.0"}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{doc.uploadDate || (doc as any).uploadedAt || doc.createdAt?.slice(0, 10) || "---"}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setPreviewDocument(doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isAr ? "معاينة" : "View"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                {archive.filter((a) => a.recordId === tenant.id || a.entityId === tenant.id).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      {isAr ? "لا توجد ملفات مرفوعة" : "No uploaded files found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
        documents={archive.filter((a) => a.recordId === tenant.id || a.entityId === tenant.id)}
      />

      {/* Document Scanner Modal */}
      <DocumentScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        entityType="TENANT"
        entityId={tenant.id}
        defaultCategory={"EMIRATES_ID" as DocumentCategory}
        recordName={tenant.nameAr || tenant.nameEn}
      />
    </div>
  );
};
