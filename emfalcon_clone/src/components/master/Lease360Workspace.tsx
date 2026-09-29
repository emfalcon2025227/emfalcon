import React, { useState, useMemo } from "react";
import {
  FileText,
  User,
  Building2,
  Home,
  CreditCard,
  Receipt,
  Wrench,
  FolderOpen,
  TrendingUp,
  Clock,
  ShieldCheck,
  Printer,
  Download,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Users,
  RotateCw,
  KeyRound,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { OfficePrintHeader } from "../common/OfficePrintHeader";
import { Lease, Tenant, Property, Unit, Owner, Cheque, CollectionRecord, MaintenanceRequest, CommissionObligation } from "../../types";
import { LeaseOccupancyAnalytics } from "./LeaseOccupancyAnalytics";

interface Lease360WorkspaceProps {
  leaseId: string;
  onClose?: () => void;
  onNavigateToProperty?: (propertyId: string) => void;
  onNavigateToUnit?: (unitId: string) => void;
  onNavigateToTenant?: (tenantId: string) => void;
  onNavigateToOwner?: (ownerId: string) => void;
  onOpenRenew?: (lease: Lease) => void;
}

export const Lease360Workspace: React.FC<Lease360WorkspaceProps> = ({
  leaseId,
  onClose,
  onNavigateToProperty,
  onNavigateToUnit,
  onNavigateToTenant,
  onNavigateToOwner,
  onOpenRenew,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    leases,
    properties,
    units,
    tenants,
    owners,
    cheques,
    collections,
    commissions,
    maintenanceRequests,
    archive,
    auditLogs,
    collectSecurityDeposit,
    refundOrSettleSecurityDeposit,
  } = useData();

  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "analytics"
    | "parties"
    | "financials"
    | "payments"
    | "cheques"
    | "commissions"
    | "maintenance"
    | "documents"
    | "timeline"
    | "securityDeposit"
  >("overview");

  // Security Deposit Modal States
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<string>("BANK_TRANSFER");
  const [collectPayerName, setCollectPayerName] = useState<string>("");
  const [collectChequeNumber, setCollectChequeNumber] = useState<string>("");
  const [collectBankName, setCollectBankName] = useState<string>("");
  const [collectIsUndated, setCollectIsUndated] = useState<boolean>(false);
  const [collectReference, setCollectReference] = useState<string>("");
  const [collectNotes, setCollectNotes] = useState<string>("");
  const [isSubmittingCollect, setIsSubmittingCollect] = useState(false);

  // Settlement Modal States
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [maintDeduction, setMaintDeduction] = useState<number>(0);
  const [rentDeduction, setRentDeduction] = useState<number>(0);
  const [earlyTermDeduction, setEarlyTermDeduction] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);
  const [otherDeductionReason, setOtherDeductionReason] = useState<string>("");
  const [refundMethod, setRefundMethod] = useState<string>("BANK_TRANSFER");
  const [refundRecipient, setRefundRecipient] = useState<string>("");
  const [settleNotes, setSettleNotes] = useState<string>("");
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const [settleError, setSettleError] = useState<string>("");

  // Target Lease
  const lease = useMemo(() => {
    return leases.find((l) => l.id === leaseId) || leases[0];
  }, [leases, leaseId]);

  // Linked Entities
  const property = useMemo(() => {
    if (!lease) return null;
    return properties.find((p) => p.id === lease.propertyId) || null;
  }, [properties, lease]);

  const unit = useMemo(() => {
    if (!lease) return null;
    return units.find((u) => u.id === lease.unitId) || null;
  }, [units, lease]);

  const tenant = useMemo(() => {
    if (!lease) return null;
    return tenants.find((t) => t.id === lease.tenantId) || null;
  }, [tenants, lease]);

  const owner = useMemo(() => {
    if (!lease && !property) return null;
    return owners.find((o) => o.id === lease?.ownerId || o.id === property?.ownerId) || null;
  }, [owners, lease, property]);

  // Linked Financials
  const leaseCheques = useMemo(() => {
    if (!lease) return [];
    return cheques.filter((c) => c.leaseId === lease.id);
  }, [cheques, lease]);

  const leaseCollections = useMemo(() => {
    if (!lease) return [];
    return collections.filter((c) => c.tenantId === lease.tenantId);
  }, [collections, lease]);

  const leaseCommissions = useMemo(() => {
    if (!lease) return [];
    return commissions.filter((c) => c.leaseId === lease.id);
  }, [commissions, lease]);

  const leaseMaintenance = useMemo(() => {
    if (!lease) return [];
    return maintenanceRequests.filter((m) => m.propertyId === lease.propertyId && (m.unitId === lease.unitId || !m.unitId));
  }, [maintenanceRequests, lease]);

  // Financial Calculations
  const financialSummary = useMemo(() => {
    if (!lease) return { annualRent: 0, totalCollected: 0, balanceRemaining: 0, paidInstallments: 0, totalInstallments: 0 };
    const annualRent = Number(lease.annualRent || 0);
    const installments = lease.installments || [];
    const paidInstallments = installments.filter((i) => i.status === "COLLECTED").length;
    
    let totalCollected = 0;
    installments.forEach((i) => {
      if (i.status === "COLLECTED") totalCollected += Number(i.amount || 0);
    });

    const balanceRemaining = Math.max(0, annualRent - totalCollected);

    return {
      annualRent,
      totalCollected,
      balanceRemaining,
      paidInstallments,
      totalInstallments: installments.length,
    };
  }, [lease]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!lease) return;
    const wb = XLSX.utils.book_new();

    // Lease overview sheet
    const summaryData = [
      { [isAr ? "البند" : "Field"]: isAr ? "رقم العقد" : "Lease Number", [isAr ? "القيمة" : "Value"]: lease.leaseNumber || lease.id },
      { [isAr ? "البند" : "Field"]: isAr ? "رقم إيجاري" : "Ejari Number", [isAr ? "القيمة" : "Value"]: lease.ejariNumber || "---" },
      { [isAr ? "البند" : "Field"]: isAr ? "العقار" : "Property", [isAr ? "القيمة" : "Value"]: property ? (isAr ? property.nameAr : property.nameEn) : "---" },
      { [isAr ? "البند" : "Field"]: isAr ? "الوحدة" : "Unit", [isAr ? "القيمة" : "Value"]: unit?.unitNumber || "---" },
      { [isAr ? "البند" : "Field"]: isAr ? "المستأجر" : "Tenant", [isAr ? "القيمة" : "Value"]: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "---" },
      { [isAr ? "البند" : "Field"]: isAr ? "المالك" : "Owner", [isAr ? "القيمة" : "Value"]: owner ? (isAr ? owner.nameAr : owner.nameEn) : "---" },
      { [isAr ? "البند" : "Field"]: isAr ? "تاريخ البدء" : "Start Date", [isAr ? "القيمة" : "Value"]: lease.startDate },
      { [isAr ? "البند" : "Field"]: isAr ? "تاريخ الانتهاء" : "End Date", [isAr ? "القيمة" : "Value"]: lease.endDate },
      { [isAr ? "البند" : "Field"]: isAr ? "الإيجار السنوي" : "Annual Rent", [isAr ? "القيمة" : "Value"]: lease.annualRent || 0 },
      { [isAr ? "البند" : "Field"]: isAr ? "حالة العقد" : "Contract Status", [isAr ? "القيمة" : "Value"]: lease.contractStatus },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Installments sheet
    if (lease.installments && lease.installments.length > 0) {
      const instData = lease.installments.map((inst) => ({
        [isAr ? "رقم الدفعة" : "Installment #"]: inst.installmentNumber,
        [isAr ? "تاريخ الاستحقاق" : "Due Date"]: inst.dueDate,
        [isAr ? "المبلغ" : "Amount"]: inst.amount,
        [isAr ? "الحالة" : "Status"]: inst.status,
        [isAr ? "رقم الشيك" : "Cheque #"]: inst.chequeNumber || "---",
      }));
      const wsInst = XLSX.utils.json_to_sheet(instData);
      XLSX.utils.book_append_sheet(wb, wsInst, "Installments");
    }

    XLSX.writeFile(wb, `Lease360_${lease.leaseNumber || lease.id}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (!lease) {
    return (
      <div className="p-8 text-center text-slate-500">
        {isAr ? "لم يتم العثور على العقد المطلوب" : "Lease not found"}
      </div>
    );
  }

  const tabs = [
    { id: "overview", labelAr: "نظرة عامة والتحليلات", labelEn: "Overview & Summary", icon: FileText, count: null },
    { id: "analytics", labelAr: "تحليلات المستأجر والإشغال", labelEn: "Tenant & Occupancy", icon: TrendingUp, count: null },
    { id: "parties", labelAr: "أطراف العقد والوحدة", labelEn: "Parties & Unit", icon: Users, count: null },
    { id: "financials", labelAr: "جدول الأقساط", labelEn: "Installments", icon: Calendar, count: lease.installments?.length || 0 },
    { id: "payments", labelAr: "المقبوضات وسندات القبض", labelEn: "Collections", icon: Receipt, count: leaseCollections.length },
    { id: "cheques", labelAr: "شيكات العقد", labelEn: "Cheques", icon: CreditCard, count: leaseCheques.length },
    { id: "commissions", labelAr: "الرسوم الإدارية", labelEn: "Admin Fees", icon: DollarSign, count: leaseCommissions.length },
    { id: "maintenance", labelAr: "الصيانة", labelEn: "Maintenance", icon: Wrench, count: leaseMaintenance.length },
    { id: "securityDeposit", labelAr: "أمانات التأمين (2020)", labelEn: "Security Deposit (2020)", icon: ShieldCheck, count: (lease.securityDeposit || 0) > 0 ? 1 : null },
    { id: "documents", labelAr: "المستندات", labelEn: "Documents", icon: FolderOpen, count: archive.filter((a) => a.recordId === lease.id).length },
  ];

  return (
    <div className="space-y-6">
      {/* Printable Header */}
      <OfficePrintHeader
        titleAr={`كشف ملف العقد الشامل 360 (عقد #${lease.leaseNumber || lease.id.slice(0, 8)})`}
        titleEn={`LEASE 360 COMPREHENSIVE DOSSIER (#${lease.leaseNumber || lease.id.slice(0, 8)})`}
        subtitleAr={`المستأجر: ${tenant ? tenant.nameAr : "---"} | العقار: ${property ? property.nameAr : "---"} | الوحدة: ${unit?.unitNumber || "---"}`}
        subtitleEn={`Tenant: ${tenant ? tenant.nameEn : "---"} | Property: ${property ? property.nameEn : "---"} | Unit: ${unit?.unitNumber || "---"}`}
        hideOnScreen={true}
        extraInfo={[
          { labelAr: "الإيجار السنوي", labelEn: "Annual Rent", value: `${(lease.annualRent || 0).toLocaleString()} AED` },
          { labelAr: "فترة العقد", labelEn: "Lease Period", value: `${lease.startDate} - ${lease.endDate}` },
          { labelAr: "حالة العقد", labelEn: "Contract Status", value: lease.contractStatus },
        ]}
      />

      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <span>{isAr ? "العقود الإيجارية" : "Leases"}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            <span className="text-white">{isAr ? `عقد #${lease.leaseNumber || lease.id.slice(0, 8)}` : `Lease #${lease.leaseNumber || lease.id.slice(0, 8)}`}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                lease.contractStatus === "ACTIVE"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : lease.contractStatus === "EXPIRED"
                  ? "bg-slate-500/20 text-slate-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {lease.contractStatus}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-indigo-400" />
            <span>
              {isAr
                ? `عقد إيجار رقم ${lease.leaseNumber || lease.id.slice(0, 8)}`
                : `Lease Contract #${lease.leaseNumber || lease.id.slice(0, 8)}`}
            </span>
          </h1>
          <p className="text-xs text-slate-300 flex items-center gap-3">
            <span>
              {isAr ? "المستأجر:" : "Tenant:"} {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "---"}
            </span>
            <span>•</span>
            <span>
              {isAr ? "العقار:" : "Property:"} {property ? (isAr ? property.nameAr : property.nameEn) : "---"}
            </span>
            <span>•</span>
            <span>
              {isAr ? "الوحدة:" : "Unit:"} {unit?.unitNumber || "---"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenRenew && lease.contractStatus === "ACTIVE" && (
            <button
              onClick={() => onOpenRenew(lease)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-200 bg-indigo-900/60 border border-indigo-700/50 hover:bg-indigo-800/60 rounded-xl transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{isAr ? "تجديد العقد" : "Renew Lease"}</span>
            </button>
          )}
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
            <span>{isAr ? "طباعة الملف 360" : "Print Dossier"}</span>
          </button>
          <CloseBackButton onClose={onClose} variant="dark" />
        </div>
      </div>

      {/* Synchronized Tabs Navigation */}
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

      {/* TAB 1: OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Financial & Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "القيمة الإيجارية السنوية" : "Annual Rent"}</span>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {financialSummary.annualRent.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {lease.paymentFrequency || (isAr ? "دفعات ربع سنوية" : "Quarterly")}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "المبالغ المحصلة" : "Total Collected"}</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {financialSummary.totalCollected.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {financialSummary.paidInstallments} {isAr ? "من" : "of"} {financialSummary.totalInstallments} {isAr ? "دفعات محصلة" : "collected installments"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "الرصيد المتبقي" : "Balance Remaining"}</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {financialSummary.balanceRemaining.toLocaleString()} AED
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {isAr ? "مستحق على الدفعات القادمة" : "Due on upcoming installments"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500">{isAr ? "شيكات العقد" : "Cheques Count"}</span>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {leaseCheques.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {leaseCheques.filter((c) => c.status === "COLLECTED" || c.status === "CLEARED").length} {isAr ? "شيكات مصروفة" : "cleared"}
              </div>
            </div>
          </div>

          {/* Connected Parties & Unit Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tenant Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>{isAr ? "المستأجر" : "Tenant"}</span>
                </span>
                {tenant && onNavigateToTenant && (
                  <button
                    onClick={() => onNavigateToTenant(tenant.id)}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <span>{isAr ? "الملف الشامل" : "Tenant 360"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </h3>

              {tenant ? (
                <div className="space-y-3 text-xs">
                  <div className="font-bold text-base text-slate-900 dark:text-white">
                    {isAr ? tenant.nameAr : tenant.nameEn}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400 block">{isAr ? "الهاتف:" : "Phone:"}</span>
                      <span className="font-mono">{tenant.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? "الهوية الوطنية:" : "Emirates ID:"}</span>
                      <span className="font-mono">{tenant.emiratesId || "---"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? "البريد الإلكتروني:" : "Email:"}</span>
                      <span>{tenant.email || "---"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? "الجنسية:" : "Nationality:"}</span>
                      <span>{tenant.nationality || "---"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-4">
                  {isAr ? "لم يتم تحديد المستأجر" : "No tenant assigned"}
                </div>
              )}
            </div>

            {/* Property & Unit Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>{isAr ? "العقار والوحدة" : "Property & Unit"}</span>
                </span>
                {property && onNavigateToProperty && (
                  <button
                    onClick={() => onNavigateToProperty(property.id)}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <span>{isAr ? "العقار الشامل" : "Property 360"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </h3>

              <div className="space-y-3 text-xs">
                <div className="font-bold text-base text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{property ? (isAr ? property.nameAr : property.nameEn) : "---"}</span>
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 text-xs rounded-lg font-mono">
                    {isAr ? `وحدة ${unit?.unitNumber || "---"}` : `Unit ${unit?.unitNumber || "---"}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 block">{isAr ? "المنطقة / المجتمع:" : "Community:"}</span>
                    <span>{property?.community || "---"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{isAr ? "النوع / الطابق:" : "Type / Floor:"}</span>
                    <span>{unit?.type || property?.type || "---"} (Fl. {unit?.floor || 1})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{isAr ? "المالك:" : "Owner:"}</span>
                    <span>{owner ? (isAr ? owner.nameAr : owner.nameEn) : "---"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{isAr ? "رقم إيجاري:" : "Ejari:"}</span>
                    <span className="font-mono">{lease.ejariNumber || "---"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Lease Occupancy & Tenant Distribution Analytics Component */}
          <LeaseOccupancyAnalytics
            lease={lease}
            tenant={tenant}
            unit={unit}
            property={property}
            allLeases={leases}
            allTenants={tenants}
            cheques={cheques}
            collections={collections}
            onNavigateToTenant={onNavigateToTenant}
            onNavigateToUnit={onNavigateToUnit}
          />
        </div>
      )}

      {/* TAB 2: DEDICATED ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <LeaseOccupancyAnalytics
          lease={lease}
          tenant={tenant}
          unit={unit}
          property={property}
          allLeases={leases}
          allTenants={tenants}
          cheques={cheques}
          collections={collections}
          onNavigateToTenant={onNavigateToTenant}
          onNavigateToUnit={onNavigateToUnit}
        />
      )}

      {/* TAB 3: PARTIES & SPECS TAB */}
      {activeTab === "parties" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "بيانات المستأجر الكاملة" : "Tenant Full Details"}</span>
            </h3>
            {tenant ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">{isAr ? tenant.nameAr : tenant.nameEn}</div>
                  <div className="text-slate-400 text-[11px]">{tenant.emiratesId}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-slate-400 block">{isAr ? "الهاتف" : "Phone"}</span>
                    <span className="font-bold">{tenant.phone}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-slate-400 block">{isAr ? "البريد الإلكتروني" : "Email"}</span>
                    <span className="font-bold">{tenant.email || "-"}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-slate-400 block">{isAr ? "الجنسية" : "Nationality"}</span>
                    <span className="font-bold">{tenant.nationality || "-"}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-slate-400 block">{isAr ? "رقم الجواز / بديل" : "Passport / Alt"}</span>
                    <span className="font-bold">{tenant.passportNo || tenant.alternatePhone || "-"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">{isAr ? "لا توجد بيانات مستأجر" : "No tenant data"}</div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "بيانات المالك والوحدة" : "Owner & Unit Details"}</span>
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">
                  {owner ? (isAr ? owner.nameAr : owner.nameEn) : isAr ? "المالك غير محدد" : "Owner not specified"}
                </div>
                <div className="text-slate-400 text-[11px]">{owner?.iban || "---"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "رقم الوحدة" : "Unit Number"}</span>
                  <span className="font-bold font-mono">{unit?.unitNumber || "---"}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "اسم العقار" : "Property"}</span>
                  <span className="font-bold">{property ? (isAr ? property.nameAr : property.nameEn) : "---"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("securityDeposit")}
                  className="p-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition rounded-xl text-start border border-transparent hover:border-indigo-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 block">{isAr ? "مبلغ التأمين (حساب 2020)" : "Security Deposit (2020)"}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      lease.securityDepositStatus === "HELD"
                        ? "bg-emerald-100 text-emerald-700"
                        : lease.securityDepositStatus === "SETTLED" || lease.securityDepositStatus === "REFUNDED"
                        ? "bg-blue-100 text-blue-700"
                        : lease.securityDepositStatus === "CARRIED_FORWARD"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {lease.securityDepositStatus || "PENDING"}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-600">{(lease.securityDeposit || 0).toLocaleString()} AED</span>
                </button>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "رقم إيجاري" : "Ejari #"}</span>
                  <span className="font-bold font-mono">{lease.ejariNumber || "---"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FINANCIAL INSTALLMENTS */}
      {activeTab === "financials" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "جدول دفعات وأقساط العقد" : "Installment Schedule"} ({lease.installments?.length || 0})</span>
            </span>
            <span className="text-xs font-mono font-bold text-indigo-600">
              {isAr ? "الإجمالي:" : "Total:"} {(lease.annualRent || 0).toLocaleString()} AED
            </span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الدفعة" : "Inst #"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                  <th className="px-4 py-3">{isAr ? "المبلغ المستحق" : "Amount"}</th>
                  <th className="px-4 py-3">{isAr ? "رقم الشيك" : "Cheque Number"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(lease.installments || []).map((inst) => (
                  <tr key={inst.installmentNumber} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      #{inst.installmentNumber}
                    </td>
                    <td className="px-4 py-3 font-mono">{inst.dueDate}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {Number(inst.amount || 0).toLocaleString()} AED
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {inst.chequeNumber || "---"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          inst.status === "COLLECTED"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                            : inst.status === "BOUNCED"
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                            : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {inst.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENTS & COLLECTIONS */}
      {activeTab === "payments" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "سندات القبض والمقبوضات المحصلة" : "Payment Collections"} ({leaseCollections.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم السند" : "Receipt #"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ التحصيل" : "Date"}</th>
                  <th className="px-4 py-3">{isAr ? "طريقة الدفع" : "Method"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaseCollections.map((col) => (
                  <tr key={col.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {col.receiptNumber || col.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{col.paymentDate || col.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-medium">{col.paymentMethod}</td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-emerald-600 dark:text-emerald-400">
                      {(col.amountApplied || col.amountEntered).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: CHEQUES */}
      {activeTab === "cheques" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "شيكات العقد المسجلة" : "Linked Lease Cheques"} ({leaseCheques.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الشيك" : "Cheque #"}</th>
                  <th className="px-4 py-3">{isAr ? "البنك" : "Bank"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                  <th className="px-4 py-3">{isAr ? "المبلغ" : "Amount"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaseCheques.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{c.chequeNumber}</td>
                    <td className="px-4 py-3">{c.bankName}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{c.dueDate}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {Number(c.amount || 0).toLocaleString()} AED
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          c.status === "COLLECTED" || c.status === "CLEARED"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                            : c.status === "BOUNCED"
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                            : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: COMMISSIONS */}
      {activeTab === "commissions" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "الرسوم والعمولات الإدارية للعقد" : "Administrative Fees & Commissions"} ({leaseCommissions.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "النوع" : "Type"}</th>
                  <th className="px-4 py-3">{isAr ? "الطرف الملزم" : "Party"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                  <th className="px-4 py-3 text-right">{isAr ? "المبلغ الإجمالي" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaseCommissions.map((comm) => (
                  <tr key={comm.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-medium">{comm.commissionType}</td>
                    <td className="px-4 py-3">{comm.partyType}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{comm.dueDate}</td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-indigo-600">
                      {Number(comm.totalCommissionAmount || 0).toLocaleString()} AED
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: MAINTENANCE */}
      {activeTab === "maintenance" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "طلبات الصيانة المرتبطة" : "Maintenance Requests"} ({leaseMaintenance.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم الطلب" : "Request #"}</th>
                  <th className="px-4 py-3">{isAr ? "التصنيف" : "Category"}</th>
                  <th className="px-4 py-3">{isAr ? "الوصف" : "Description"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaseMaintenance.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold">{m.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium">{m.category}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{m.issueDescription}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "مستندات وأرشيف العقد" : "Documents Archive"}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {archive
              .filter((a) => a.recordId === lease.id || a.recordTitle?.includes(lease.leaseNumber || lease.id))
              .map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 flex items-start gap-3"
                >
                  <FileText className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{doc.fileName}</div>
                    <div className="text-[10px] text-slate-400">{doc.category} • {(doc.fileSize / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 10: SECURITY DEPOSIT GOVERNANCE (حساب 2020) */}
      {activeTab === "securityDeposit" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-200 dark:border-amber-900/40 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isAr ? "أمانات تأمين الصيانة (حساب 2020 - تأمينات مستأجرين)" : "Tenant Security Deposit (Liability Account 2020)"}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? "مبالغ أمانات محتجزة للمستأجر لضمان الصيانة والسلامة، ومفصولة تماماً عن إيرادات المكتب ومستحقات الملاك."
                  : "Custodial liability funds held on behalf of tenant, strictly separated from office revenue and owner funds."}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {((lease.securityDeposit || 0) > 0 && lease.securityDepositStatus !== "HELD" && lease.securityDepositStatus !== "SETTLED" && lease.securityDepositStatus !== "REFUNDED" && lease.securityDepositStatus !== "CARRIED_FORWARD") && (
                <button
                  type="button"
                  onClick={() => {
                    setCollectAmount(lease.securityDeposit || 0);
                    setCollectPayerName(tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "");
                    setIsCollectModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{isAr ? "تحصيل أمانة التأمين" : "Collect Security Deposit"}</span>
                </button>
              )}

              {lease.securityDepositStatus === "HELD" && (
                <button
                  type="button"
                  onClick={() => {
                    setMaintDeduction(0);
                    setRentDeduction(0);
                    setEarlyTermDeduction(0);
                    setOtherDeduction(0);
                    setOtherDeductionReason("");
                    setRefundRecipient(tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "");
                    setSettleError("");
                    setIsSettleModalOpen(true);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>{isAr ? "تسوية ورد التأمين" : "Settle / Refund Deposit"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                {isAr ? "مبلغ التأمين المقيد" : "Deposit Amount"}
              </span>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {(lease.securityDeposit || 0).toLocaleString()} AED
              </div>
              <span className="text-[10px] text-slate-400">
                {isAr ? "حساب الأمانات 2020" : "Liability Acc 2020"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                {isAr ? "حالة الأمانة" : "Deposit Status"}
              </span>
              <div>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                  lease.securityDepositStatus === "HELD"
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : lease.securityDepositStatus === "SETTLED" || lease.securityDepositStatus === "REFUNDED"
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : lease.securityDepositStatus === "CARRIED_FORWARD"
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}>
                  {lease.securityDepositStatus === "HELD" ? (isAr ? "محتجز بالأمانات (HELD)" : "Held in Trust")
                    : lease.securityDepositStatus === "SETTLED" ? (isAr ? "تمت التسوية (SETTLED)" : "Settled")
                    : lease.securityDepositStatus === "REFUNDED" ? (isAr ? "تم الرد بالكامل (REFUNDED)" : "Fully Refunded")
                    : lease.securityDepositStatus === "CARRIED_FORWARD" ? (isAr ? "مرحل من عقد سابق" : "Carried Forward")
                    : (isAr ? "قيد الانتظار (PENDING)" : "Pending Collection")}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {lease.securityDepositCollectedDate ? (isAr ? `بتاريخ ${lease.securityDepositCollectedDate}` : `Date: ${lease.securityDepositCollectedDate}`) : (isAr ? "لم يحصل بعد" : "Not yet collected")}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                {isAr ? "رقم إيصال القبض" : "Receipt Voucher #"}
              </span>
              <div className="text-sm font-mono font-bold text-slate-800 dark:text-white">
                {lease.securityDepositReceiptNumber || "---"}
              </div>
              <span className="text-[10px] text-slate-400">
                {lease.securityDepositPaymentMethod || "---"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                {isAr ? "بيانات الشيك / البنك" : "Cheque / Bank"}
              </span>
              <div className="text-sm font-medium text-slate-800 dark:text-white truncate">
                {lease.securityDepositChequeNumber ? (
                  <span>شيك #{lease.securityDepositChequeNumber} {lease.securityDepositIsUndatedCheque && "(بدون تاريخ)"}</span>
                ) : (
                  lease.securityDepositBankName || "---"
                )}
              </div>
              <span className="text-[10px] text-slate-400 truncate block">
                {lease.securityDepositBankName || (isAr ? "نقدي / تحويل بنكي" : "Cash / Wire")}
              </span>
            </div>
          </div>

          {/* Carried Forward Notification */}
          {lease.carriedForwardFromLeaseId && (
            <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 p-4 rounded-2xl flex items-start gap-3">
              <RotateCw className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs text-blue-900 dark:text-blue-200">
                <div className="font-bold">
                  {isAr ? "تم ترحيل هذا التأمين من العقد السابق بنجاح" : "Security deposit carried forward from previous lease"}
                </div>
                <div className="text-blue-700 dark:text-blue-300">
                  {isAr
                    ? `معرف العقد السابق: #${lease.carriedForwardFromLeaseId}. تقتضي القواعد المحاسبية عدم تكرار قيد القبض أو مطالبة المستأجر بمبلغ إضافي.`
                    : `Previous lease: #${lease.carriedForwardFromLeaseId}. Accounting rules preserve the liability without duplicating cash flow.`}
                </div>
              </div>
            </div>
          )}

          {/* Settlement Details (if settled) */}
          {lease.securityDepositSettlement && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{isAr ? "تفاصيل التسوية النهائية لرد الأمانة" : "Final Settlement Breakdown"}</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "إجمالي المحتجز" : "Total Held"}</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-white">
                    {lease.securityDepositSettlement.totalHeldAmount.toLocaleString()} AED
                  </span>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/30">
                  <span className="text-rose-500 block">{isAr ? "إجمالي الخصومات" : "Total Deductions"}</span>
                  <span className="font-bold font-mono text-rose-700 dark:text-rose-300">
                    {lease.securityDepositSettlement.totalDeductions.toLocaleString()} AED
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-emerald-600 block">{isAr ? "صافي المبلغ المردود" : "Net Refund"}</span>
                  <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300">
                    {lease.securityDepositSettlement.netRefundAmount.toLocaleString()} AED
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                  <span className="text-slate-400 block">{isAr ? "تاريخ التسوية" : "Settled Date"}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {lease.securityDepositSettlement.settlementDate}
                  </span>
                </div>
              </div>

              {/* Deductions breakdown */}
              {lease.securityDepositSettlement.totalDeductions > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "تفصيل بنود الخصم المحاسبي:" : "Deduction Allocations Breakdown:"}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "خصم الصيانة" : "Maintenance"}</span>
                      <span className="font-mono font-bold text-rose-600">{(lease.securityDepositSettlement.maintenanceDeduction || 0).toLocaleString()} AED</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "خصم متأخرات إيجار" : "Rent Arrears"}</span>
                      <span className="font-mono font-bold text-rose-600">{(lease.securityDepositSettlement.rentDeduction || 0).toLocaleString()} AED</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "خصم إنهاء مبكر" : "Early Termination"}</span>
                      <span className="font-mono font-bold text-rose-600">{(lease.securityDepositSettlement.earlyTerminationDeduction || 0).toLocaleString()} AED</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "خصومات أخرى" : "Other"}</span>
                      <span className="font-mono font-bold text-rose-600">{(lease.securityDepositSettlement.otherDeductions || 0).toLocaleString()} AED</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audit History Timeline */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? "سجل الحركات والتدقيق للأمانة" : "Security Deposit Audit History"} ({lease.securityDepositHistory?.length || 0})</span>
            </h4>

            {(!lease.securityDepositHistory || lease.securityDepositHistory.length === 0) ? (
              <div className="text-xs text-slate-400 italic py-3 text-center">
                {isAr ? "لا توجد سجلات حركات سابقة لهذه الأمانة" : "No history recorded yet"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">{isAr ? "التاريخ" : "Date"}</th>
                      <th className="px-4 py-3">{isAr ? "نوع الحركة" : "Action"}</th>
                      <th className="px-4 py-3">{isAr ? "المبلغ" : "Amount"}</th>
                      <th className="px-4 py-3">{isAr ? "رقم السند" : "Receipt #"}</th>
                      <th className="px-4 py-3">{isAr ? "المسؤول" : "Performed By"}</th>
                      <th className="px-4 py-3">{isAr ? "ملاحظات" : "Notes"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lease.securityDepositHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-4 py-3 font-mono text-slate-500">{h.date.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.action === "COLLECTION"
                              ? "bg-emerald-100 text-emerald-700"
                              : h.action === "SETTLEMENT" || h.action === "REFUND"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {h.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                          {h.amount.toLocaleString()} AED
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                          {h.receiptNumber || "---"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{h.performedBy}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{h.notes || "---"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: COLLECT SECURITY DEPOSIT */}
      {isCollectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 dark:text-white">
                  {isAr ? "تحصيل أمانة تأمين صيانة (حساب 2020)" : "Collect Security Deposit (Acc 2020)"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCollectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (collectAmount <= 0) return;
                setIsSubmittingCollect(true);
                const res = await collectSecurityDeposit({
                  leaseId: lease.id,
                  amount: collectAmount,
                  paymentMethod: collectMethod as any,
                  payerName: collectPayerName || (tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : undefined),
                  chequeNumber: collectChequeNumber || undefined,
                  bankName: collectBankName || undefined,
                  isUndatedCheque: collectIsUndated,
                  transactionReference: collectReference || undefined,
                  notes: collectNotes || undefined,
                });
                setIsSubmittingCollect(false);
                if (res.success) {
                  setIsCollectModalOpen(false);
                } else {
                  alert(res.error || (isAr ? "فشل تحصيل التأمين" : "Failed to collect deposit"));
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {isAr ? "مبلغ التأمين (AED) *" : "Deposit Amount (AED) *"}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={0.01}
                  value={collectAmount || ""}
                  onChange={(e) => setCollectAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {isAr ? "طريقة التحصيل *" : "Payment Method *"}
                </label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="BANK_TRANSFER">{isAr ? "تحويل بنكي" : "Bank Transfer"}</option>
                  <option value="CHEQUE">{isAr ? "شيك" : "Cheque"}</option>
                  <option value="CASH">{isAr ? "نقدي" : "Cash"}</option>
                </select>
              </div>

              {collectMethod === "CHEQUE" && (
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 uppercase mb-1">
                      {isAr ? "رقم الشيك *" : "Cheque # *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={collectChequeNumber}
                      onChange={(e) => setCollectChequeNumber(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 uppercase mb-1">
                      {isAr ? "اسم البنك *" : "Bank Name *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={collectBankName}
                      onChange={(e) => setCollectBankName(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 rounded-lg text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={collectIsUndated}
                      onChange={(e) => setCollectIsUndated(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                      {isAr ? "شيك ضمان بدون تاريخ (Undated Guarantee Cheque)" : "Undated Guarantee Cheque"}
                    </span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {isAr ? "اسم الدافع" : "Payer Name"}
                </label>
                <input
                  type="text"
                  value={collectPayerName}
                  onChange={(e) => setCollectPayerName(e.target.value)}
                  placeholder={tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {isAr ? "ملاحظات إضافية" : "Notes"}
                </label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCollect || collectAmount <= 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {isSubmittingCollect ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "تأكيد التحصيل وإصدار السند" : "Confirm Collection")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SETTLE & REFUND SECURITY DEPOSIT */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-slate-900 dark:text-white">
                  {isAr ? "تسوية ورد أمانة التأمين للمستأجر" : "Settle / Refund Security Deposit"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                {settleError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSettleError("");
                setIsSubmittingSettle(true);
                const res = await refundOrSettleSecurityDeposit({
                  leaseId: lease.id,
                  deductions: {
                    rentDeduction: rentDeduction,
                    maintenanceDeduction: maintDeduction,
                    earlyTerminationDeduction: earlyTermDeduction,
                    otherDeductions: otherDeduction,
                  },
                  refundPaymentMethod: refundMethod as any,
                  refundReference: refundRecipient || undefined,
                  notes: otherDeductionReason ? `[سبب الخصومات الأخرى: ${otherDeductionReason}] ${settleNotes}` : settleNotes || undefined,
                });
                setIsSubmittingSettle(false);
                if (res.success) {
                  setIsSettleModalOpen(false);
                } else {
                  setSettleError(res.error || (isAr ? "فشلت عملية التسوية" : "Failed to settle deposit"));
                }
              }}
              className="space-y-3 text-xs"
            >
              {/* Total Held Info */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40 flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  {isAr ? "إجمالي مبلغ الأمانة المحتجز حالياً:" : "Current Held Deposit:"}
                </span>
                <span className="font-black font-mono text-base text-amber-900 dark:text-amber-200">
                  {(lease.securityDeposit || 0).toLocaleString()} AED
                </span>
              </div>

              {/* Deductions Breakdown Inputs */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? "الاستقطاعات والخصومات المستحقة:" : "Deductions & Offsets:"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">{isAr ? "خصم الصيانة والأضرار" : "Maintenance / Repairs"}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={maintDeduction || ""}
                      onChange={(e) => setMaintDeduction(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">{isAr ? "خصم متأخرات الإيجار" : "Rent Arrears"}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={rentDeduction || ""}
                      onChange={(e) => setRentDeduction(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">{isAr ? "خصم غرامة إنهاء مبكر" : "Early Termination Fee"}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={earlyTermDeduction || ""}
                      onChange={(e) => setEarlyTermDeduction(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">{isAr ? "خصومات أخرى" : "Other Deductions"}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={otherDeduction || ""}
                      onChange={(e) => setOtherDeduction(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>

                {otherDeduction > 0 && (
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">{isAr ? "سبب الخصومات الأخرى *" : "Other Deductions Reason *"}</label>
                    <input
                      type="text"
                      required
                      value={otherDeductionReason}
                      onChange={(e) => setOtherDeductionReason(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Calculated Net Refund */}
              {(() => {
                const totalDed = (maintDeduction || 0) + (rentDeduction || 0) + (earlyTermDeduction || 0) + (otherDeduction || 0);
                const netRefund = Math.max(0, (lease.securityDeposit || 0) - totalDed);
                return (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase block font-bold">
                        {isAr ? "صافي المبلغ المردود للمستأجر:" : "Net Refund to Tenant:"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {isAr ? `إجمالي الخصومات: AED ${totalDed.toLocaleString()}` : `Total Deductions: AED ${totalDed.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-800 dark:text-emerald-300">
                      {netRefund.toLocaleString()} AED
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">{isAr ? "طريقة رد المبلغ" : "Refund Method"}</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="BANK_TRANSFER">{isAr ? "تحويل بنكي" : "Bank Transfer"}</option>
                    <option value="CHEQUE">{isAr ? "شيك" : "Cheque"}</option>
                    <option value="CASH">{isAr ? "نقدي" : "Cash"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">{isAr ? "اسم المستلم" : "Recipient Name"}</label>
                  <input
                    type="text"
                    value={refundRecipient}
                    onChange={(e) => setRefundRecipient(e.target.value)}
                    placeholder={tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : ""}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">{isAr ? "ملاحظات التسوية" : "Settlement Notes"}</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {isSubmittingSettle ? (isAr ? "جاري المعالجة..." : "Processing...") : (isAr ? "اعتماد التسوية وإصدار القيد" : "Confirm Settlement")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
