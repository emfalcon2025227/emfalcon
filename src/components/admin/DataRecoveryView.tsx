import React, { useState } from "react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { HistoricalRecord, Tenant, Owner, Property, Unit } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  RotateCcw, 
  Trash2, 
  History, 
  Search, 
  Filter, 
  Calendar, 
  User as UserIcon, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Eye,
  X,
  FileText,
  Building2,
  Home,
  Phone,
  Mail,
  CreditCard,
  ShieldAlert,
  MapPin,
  Maximize2,
  DollarSign,
  Layers,
  ExternalLink
} from "lucide-react";
import { SearchableSelect } from "../common/SearchableSelect";

export const DataRecoveryView: React.FC = () => {
  const { language } = useLanguage();
  const { 
    historicalRecords, 
    restoreHistoricalRecord, 
    deleteHistoricalRecord,
    tenants,
    owners,
    properties,
    units
  } = useData();
  const [activeTab, setActiveTab] = useState<"DELETIONS" | "VERSIONS">("DELETIONS");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [previewRecord, setPreviewRecord] = useState<HistoricalRecord | null>(null);
  const [leaseSubTab, setLeaseSubTab] = useState<"ALL" | "CONTRACT" | "TENANT" | "OWNER" | "PROPERTY">("ALL");

  const isAr = language === "ar";

  const filteredRecords = historicalRecords.filter((r) => {
    const isTabMatch = activeTab === "DELETIONS" ? r.recordType === "DELETION" : r.recordType === "VERSION";
    const isSearchMatch = r.entityTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.entityCode.toLowerCase().includes(searchTerm.toLowerCase());
    const isTypeMatch = filterType === "ALL" || r.entityType === filterType;
    return isTabMatch && isSearchMatch && isTypeMatch;
  });

  const handleRestore = (id: string) => {
    const res = restoreHistoricalRecord(id);
    if (res.success) {
      setMessage({ text: res.message || (isAr ? "تمت الاستعادة بنجاح" : "Restored successfully"), type: "success" });
    } else {
      setMessage({ text: res.message || "Error", type: "error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeletePermanent = (id: string) => {
    if (window.confirm(isAr ? "هل أنت متأكد من حذف هذا السجل نهائياً؟" : "Are you sure you want to delete this record permanently?")) {
      deleteHistoricalRecord(id);
      setMessage({ text: isAr ? "تم الحذف النهائي بنجاح" : "Permanently deleted successfully", type: "success" });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Helper to resolve related entity information from snapshot or database
  const resolveLeaseRelations = (data: any) => {
    // 1. Tenant Resolution
    let resolvedTenant: Partial<Tenant> | null = data?.tenantSnapshot || null;
    if (!resolvedTenant && data?.tenantId) {
      resolvedTenant = tenants.find((t) => t.id === data.tenantId) || null;
    }
    if (!resolvedTenant && data?.tenantId) {
      const histTenant = historicalRecords.find(
        (h) => (h.originalId === data.tenantId || h.entityCode === data.tenantId) && h.entityType === "TENANT"
      );
      if (histTenant?.snapshotData) resolvedTenant = histTenant.snapshotData;
    }
    if (!resolvedTenant) {
      resolvedTenant = {
        nameAr: data?.tenantNameAr || data?.tenantName || (isAr ? "مستأجر غير محدد" : "Unassigned Tenant"),
        nameEn: data?.tenantNameEn || data?.tenantName || "Unassigned Tenant",
        phone: data?.tenantPhone,
        email: data?.tenantEmail,
        emiratesId: data?.tenantEmiratesId,
      };
    }

    // 2. Property Resolution
    let resolvedProperty: (Partial<Property> & { address?: string }) | null = data?.propertySnapshot || null;
    if (!resolvedProperty && data?.propertyId) {
      resolvedProperty = properties.find((p) => p.id === data.propertyId) || null;
    }
    if (!resolvedProperty && data?.propertyId) {
      const histProp = historicalRecords.find(
        (h) => (h.originalId === data.propertyId || h.entityCode === data.propertyId) && h.entityType === "PROPERTY"
      );
      if (histProp?.snapshotData) resolvedProperty = histProp.snapshotData;
    }
    if (!resolvedProperty) {
      resolvedProperty = {
        nameAr: data?.propertyNameAr || data?.propertyName || (isAr ? "عقار غير محدد" : "Unassigned Property"),
        nameEn: data?.propertyNameEn || data?.propertyName || "Unassigned Property",
        code: data?.propertyCode,
        address: data?.propertyAddress || [data?.emirate, data?.community].filter(Boolean).join(" - "),
        type: data?.propertyType,
      };
    }

    // 3. Owner Resolution
    let resolvedOwner: (Partial<Owner> & { nationality?: string }) | null = data?.ownerSnapshot || null;
    if (!resolvedOwner && (data?.ownerId || resolvedProperty?.ownerId)) {
      const ownerId = data?.ownerId || resolvedProperty?.ownerId;
      resolvedOwner = owners.find((o) => o.id === ownerId) || null;
    }
    if (!resolvedOwner && (data?.ownerId || resolvedProperty?.ownerId)) {
      const ownerId = data?.ownerId || resolvedProperty?.ownerId;
      const histOwner = historicalRecords.find(
        (h) => (h.originalId === ownerId || h.entityCode === ownerId) && h.entityType === "OWNER"
      );
      if (histOwner?.snapshotData) resolvedOwner = histOwner.snapshotData;
    }
    if (!resolvedOwner) {
      resolvedOwner = {
        nameAr: data?.ownerNameAr || data?.ownerName || (isAr ? "مالك غير محدد" : "Unassigned Owner"),
        nameEn: data?.ownerNameEn || data?.ownerName || "Unassigned Owner",
        phone: data?.ownerPhone,
        email: data?.ownerEmail,
      };
    }

    // 4. Unit Resolution
    let resolvedUnit: Partial<Unit> | null = data?.unitSnapshot || null;
    if (!resolvedUnit && data?.unitId) {
      resolvedUnit = units.find((u) => u.id === data.unitId) || null;
    }
    if (!resolvedUnit && data?.unitId) {
      const histUnit = historicalRecords.find(
        (h) => (h.originalId === data.unitId || h.entityCode === data.unitId) && h.entityType === "UNIT"
      );
      if (histUnit?.snapshotData) resolvedUnit = histUnit.snapshotData;
    }
    if (!resolvedUnit) {
      resolvedUnit = {
        unitNumber: data?.unitNumber || "N/A",
        floor: data?.floor,
        annualRent: data?.unitRentAmount || data?.annualRent,
      };
    }

    return {
      tenant: resolvedTenant,
      owner: resolvedOwner,
      property: resolvedProperty,
      unit: resolvedUnit,
    };
  };

  const InfoBox: React.FC<{ 
    label: string; 
    value: string | number | undefined | null; 
    icon?: any;
    badgeColor?: string;
    highlight?: boolean;
  }> = ({ 
    label, 
    value, 
    icon: Icon,
    badgeColor,
    highlight
  }) => {
    if (value === undefined || value === null || value === "") return null;
    return (
      <div className={`flex flex-col p-3 rounded-xl border transition-all ${
        highlight 
          ? "bg-blue-50/70 border-blue-200 shadow-sm" 
          : "bg-slate-50 border-slate-100 hover:bg-white hover:shadow-sm"
      }`}>
        <div className="flex items-center gap-1.5 mb-1">
          {Icon && <Icon className={`w-3.5 h-3.5 ${highlight ? "text-blue-600" : "text-slate-400"}`} />}
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">{label}</span>
        </div>
        {badgeColor ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${badgeColor}`}>
            {value}
          </span>
        ) : (
          <span className={`text-sm font-semibold break-all ${highlight ? "text-blue-900" : "text-slate-700"}`}>
            {value}
          </span>
        )}
      </div>
    );
  };

  const SectionHeader = ({ 
    title, 
    icon: Icon, 
    badge 
  }: { 
    title: string; 
    icon?: any; 
    badge?: string; 
  }) => (
    <div className="col-span-full flex items-center justify-between border-b border-slate-200 pb-2 mb-2 mt-4 first:mt-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-blue-600" />}
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h4>
      </div>
      {badge && (
        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
          {badge}
        </span>
      )}
    </div>
  );

  const renderLeaseDeepPreview = (record: HistoricalRecord) => {
    const data = record.snapshotData || {};
    const { tenant, owner, property, unit } = resolveLeaseRelations(data);

    const contractAmount = data.totalAmount || data.annualRent || 0;
    const isShowingAll = leaseSubTab === "ALL";

    const propertyAddress = (property as any)?.address || 
      [property?.emirate, property?.community, property?.plotNumber ? `Plot ${property.plotNumber}` : ""].filter(Boolean).join(" - ");

    return (
      <div className="space-y-6">
        {/* Main Lease Hero Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white p-6 shadow-xl">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-blue-200 mb-1">
                <FileText className="w-4 h-4" />
                <span>{isAr ? "عقد إيجار محفوظ في السجل التاريخي" : "Historical Lease Record"}</span>
                {data.contractStatus && (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-sm">
                    {data.contractStatus}
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-black font-mono tracking-tight">
                {data.leaseNumber || data.id || record.entityCode}
              </h2>
              {data.ejariNumber && (
                <p className="text-xs text-blue-200 mt-1 font-mono">
                  {isAr ? "رقم إيجاري (Ejari):" : "Ejari #:"} <span className="text-white font-bold">{data.ejariNumber}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col md:items-end bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/10">
              <span className="text-[11px] text-blue-200 uppercase font-medium">
                {isAr ? "القيمة الإيجارية السنوية" : "Annual Rent Value"}
              </span>
              <span className="text-2xl font-black text-white">
                {Number(contractAmount).toLocaleString()} <span className="text-sm font-normal">AED</span>
              </span>
              <div className="flex items-center gap-2 text-[11px] text-blue-200 mt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{data.startDate || "---"} → {data.endDate || "---"}</span>
              </div>
            </div>
          </div>

          {/* Quick Sub-tabs Navigation */}
          <div className="relative z-10 flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/15">
            {[
              { id: "ALL", labelAr: "عرض شامل للكل", labelEn: "All Details", icon: Layers },
              { id: "CONTRACT", labelAr: "تفاصيل العقد", labelEn: "Contract", icon: FileText },
              { id: "TENANT", labelAr: "بيانات المستأجر", labelEn: "Tenant", icon: UserIcon },
              { id: "OWNER", labelAr: "بيانات المالك", labelEn: "Owner", icon: ShieldAlert },
              { id: "PROPERTY", labelAr: "العقار والوحدة", labelEn: "Property & Unit", icon: Building2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = leaseSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setLeaseSubTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive 
                      ? "bg-white text-blue-900 shadow-md scale-105" 
                      : "bg-white/10 text-white/90 hover:bg-white/20"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {isAr ? tab.labelAr : tab.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. Tenant Section */}
        {(isShowingAll || leaseSubTab === "TENANT") && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {isAr ? (tenant?.nameAr || tenant?.nameEn) : (tenant?.nameEn || tenant?.nameAr)}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isAr ? "الطرف الثاني (المستأجر)" : "Second Party (Tenant)"}
                    {tenant?.code && ` • #${tenant.code}`}
                  </p>
                </div>
              </div>
              {tenant?.riskLevel && (
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  tenant.riskLevel === "LOW" ? "bg-emerald-50 text-emerald-700" :
                  tenant.riskLevel === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                }`}>
                  {isAr ? `مستوى المخاطر: ${tenant.riskLevel}` : `Risk: ${tenant.riskLevel}`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <InfoBox label={isAr ? "الاسم بالعربية" : "Name (AR)"} value={tenant?.nameAr} icon={UserIcon} />
              <InfoBox label={isAr ? "الاسم بالإنجليزية" : "Name (EN)"} value={tenant?.nameEn} icon={UserIcon} />
              <InfoBox label={isAr ? "رقم الهاتف" : "Phone"} value={tenant?.phone} icon={Phone} highlight />
              <InfoBox label={isAr ? "البريد الإلكتروني" : "Email"} value={tenant?.email} icon={Mail} />
              <InfoBox label={isAr ? "رقم الهوية الإماراتية" : "Emirates ID"} value={tenant?.emiratesId} icon={CreditCard} />
              <InfoBox label={isAr ? "رقم الرخصة التجارية" : "Trade License #"} value={tenant?.tradeLicenseNo} icon={FileText} />
              <InfoBox label={isAr ? "الجنسية" : "Nationality"} value={tenant?.nationality} />
              <InfoBox label={isAr ? "نوع المستأجر" : "Tenant Type"} value={tenant?.type} />
              <InfoBox label={isAr ? "حالة المستأجر" : "Tenant Status"} value={tenant?.status} />
            </div>
          </div>
        )}

        {/* 2. Owner Section */}
        {(isShowingAll || leaseSubTab === "OWNER") && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {isAr ? (owner?.nameAr || owner?.nameEn) : (owner?.nameEn || owner?.nameAr)}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isAr ? "الطرف الأول (المالك)" : "First Party (Owner)"}
                    {owner?.code && ` • #${owner.code}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <InfoBox label={isAr ? "اسم المالك (عربي)" : "Owner Name (AR)"} value={owner?.nameAr} icon={UserIcon} />
              <InfoBox label={isAr ? "اسم المالك (إنجليزي)" : "Owner Name (EN)"} value={owner?.nameEn} icon={UserIcon} />
              <InfoBox label={isAr ? "رقم الهاتف" : "Phone"} value={owner?.phone} icon={Phone} highlight />
              <InfoBox label={isAr ? "البريد الإلكتروني" : "Email"} value={owner?.email} icon={Mail} />
              <InfoBox label={isAr ? "الجنسية" : "Nationality"} value={(owner as any)?.nationality} />
              <InfoBox label={isAr ? "اسم البنك" : "Bank Name"} value={owner?.bankName} icon={Building2} />
              <InfoBox label={isAr ? "رقم الآيبان (IBAN)" : "IBAN"} value={owner?.iban} icon={CreditCard} />
              <InfoBox label={isAr ? "كود المالك" : "Owner Code"} value={owner?.code} />
            </div>
          </div>
        )}

        {/* 3. Property & Unit Section */}
        {(isShowingAll || leaseSubTab === "PROPERTY") && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {isAr ? (property?.nameAr || property?.nameEn) : (property?.nameEn || property?.nameAr)}
                    {unit?.unitNumber && ` • ${isAr ? "وحدة رقم" : "Unit #"} ${unit.unitNumber}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isAr ? "بيانات العين المؤجرة والموقع" : "Leased Premises & Property Details"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <InfoBox label={isAr ? "اسم العقار (عربي)" : "Property Name (AR)"} value={property?.nameAr} icon={Building2} />
              <InfoBox label={isAr ? "اسم العقار (إنجليزي)" : "Property Name (EN)"} value={property?.nameEn} icon={Building2} />
              <InfoBox label={isAr ? "كود العقار" : "Property Code"} value={property?.code} />
              <InfoBox label={isAr ? "العنوان والموقع" : "Address"} value={propertyAddress} icon={MapPin} highlight />
              <InfoBox label={isAr ? "نوع العقار" : "Property Type"} value={property?.type} />
              <InfoBox label={isAr ? "رقم الوحدة" : "Unit Number"} value={unit?.unitNumber || data.unitNumber} icon={Home} highlight />
              <InfoBox label={isAr ? "الطابق" : "Floor"} value={unit?.floor || data.floor} />
              <InfoBox label={isAr ? "المساحة (قدم مربع)" : "Area (Sq.Ft)"} value={unit?.areaSqFt || data.areaSqFt} icon={Maximize2} />
              <InfoBox label={isAr ? "نوع الوحدة" : "Unit Type"} value={unit?.type} />
            </div>
          </div>
        )}

        {/* 4. Financials & Installments Section */}
        {(isShowingAll || leaseSubTab === "CONTRACT") && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {isAr ? "البيانات المالية وجدولة الدفعات" : "Financial Terms & Installments"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr ? "تفاصيل المبالغ والرسوم وتواريخ السداد" : "Breakdown of rent, deposit, fees and dates"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <InfoBox label={isAr ? "إجمالي العقد" : "Total Contract Value"} value={`${Number(contractAmount).toLocaleString()} AED`} icon={DollarSign} highlight />
              <InfoBox label={isAr ? "مبلغ التأمين المسترد" : "Security Deposit"} value={data.securityDeposit ? `${Number(data.securityDeposit).toLocaleString()} AED` : undefined} icon={CreditCard} />
              <InfoBox label={isAr ? "الرسوم الإدارية" : "Administrative Fees"} value={data.commission ? `${Number(data.commission).toLocaleString()} AED` : undefined} />
              <InfoBox label={isAr ? "رسوم الخدمات" : "Service Charges"} value={data.serviceCharges ? `${Number(data.serviceCharges).toLocaleString()} AED` : undefined} />
              <InfoBox label={isAr ? "عدد الدفعات" : "Installments Count"} value={data.installmentsCount || data.chequesCount} />
              <InfoBox label={isAr ? "طريقة الدفع" : "Payment Method"} value={data.paymentMethod} />
              <InfoBox label={isAr ? "تاريخ بدء العقد" : "Start Date"} value={data.startDate} icon={Calendar} highlight />
              <InfoBox label={isAr ? "تاريخ انتهاء العقد" : "End Date"} value={data.endDate} icon={Calendar} highlight />
              <InfoBox label={isAr ? "حالة العقد عند الحفظ" : "Status"} value={data.contractStatus || record.statusAtDeletion} />
            </div>

            {/* Installments Table if available */}
            {Array.isArray(data.installments) && data.installments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  {isAr ? "جدول الشيكات والدفعات المجدولة" : "Scheduled Payments & Cheques"}
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="p-2.5">{isAr ? "الدفعة" : "Installment"}</th>
                        <th className="p-2.5">{isAr ? "المبلغ" : "Amount"}</th>
                        <th className="p-2.5">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                        <th className="p-2.5">{isAr ? "رقم الشيك" : "Cheque #"}</th>
                        <th className="p-2.5">{isAr ? "الحالة" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.installments.map((inst: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-700">#{inst.installmentNumber || idx + 1}</td>
                          <td className="p-2.5 font-semibold text-blue-700">{inst.amount?.toLocaleString()} AED</td>
                          <td className="p-2.5 text-slate-600">{inst.dueDate}</td>
                          <td className="p-2.5 font-mono text-slate-600">{inst.chequeNumber || "---"}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              {inst.status || "PENDING"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOtherRecordPreview = (record: HistoricalRecord) => {
    const data = record.snapshotData || {};
    const type = record.entityType;

    const renderTenantDetails = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionHeader title={isAr ? "البيانات الشخصية" : "Personal Info"} icon={UserIcon} />
        <InfoBox label={isAr ? "الاسم (عربي)" : "Name (AR)"} value={data.nameAr} icon={UserIcon} />
        <InfoBox label={isAr ? "الاسم (إنجليزي)" : "Name (EN)"} value={data.nameEn} icon={UserIcon} />
        <InfoBox label={isAr ? "رقم الهاتف" : "Phone"} value={data.phone} icon={Phone} highlight />
        <InfoBox label={isAr ? "البريد الإلكتروني" : "Email"} value={data.email} icon={Mail} />
        <SectionHeader title={isAr ? "التوثيق والهوية" : "Documentation"} icon={CreditCard} />
        <InfoBox label={isAr ? "الهوية الإماراتية" : "Emirates ID"} value={data.emiratesId} />
        <InfoBox label={isAr ? "رخصة تجارية" : "Trade License"} value={data.tradeLicenseNo} />
        <InfoBox label={isAr ? "الرمز" : "Code"} value={data.code} />
        <InfoBox label={isAr ? "الجنسية" : "Nationality"} value={data.nationality} />
      </div>
    );

    const renderOwnerDetails = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionHeader title={isAr ? "بيانات المالك" : "Owner Details"} icon={UserIcon} />
        <InfoBox label={isAr ? "الاسم (عربي)" : "Name (AR)"} value={data.nameAr} icon={UserIcon} />
        <InfoBox label={isAr ? "الاسم (إنجليزي)" : "Name (EN)"} value={data.nameEn} icon={UserIcon} />
        <InfoBox label={isAr ? "الكود" : "Code"} value={data.code} />
        <SectionHeader title={isAr ? "التواصل والبنك" : "Contact & Banking"} icon={Phone} />
        <InfoBox label={isAr ? "رقم الهاتف" : "Phone"} value={data.phone} icon={Phone} highlight />
        <InfoBox label={isAr ? "البريد الإلكتروني" : "Email"} value={data.email} icon={Mail} />
        <InfoBox label={isAr ? "الجنسية" : "Nationality"} value={data.nationality} />
        <InfoBox label={isAr ? "اسم البنك" : "Bank Name"} value={data.bankName} />
        <InfoBox label={isAr ? "رقم الآيبان (IBAN)" : "IBAN"} value={data.iban} />
      </div>
    );

    const renderPropertyDetails = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionHeader title={isAr ? "بيانات العقار" : "Property Details"} icon={Building2} />
        <InfoBox label={isAr ? "الاسم (عربي)" : "Name (AR)"} value={data.nameAr} icon={Building2} />
        <InfoBox label={isAr ? "الاسم (إنجليزي)" : "Name (EN)"} value={data.nameEn} icon={Building2} />
        <InfoBox label={isAr ? "الكود" : "Code"} value={data.code} />
        <SectionHeader title={isAr ? "الموقع والمواصفات" : "Location & Specs"} icon={MapPin} />
        <InfoBox label={isAr ? "العنوان" : "Address"} value={data.address || [data.emirate, data.community].filter(Boolean).join(" - ")} icon={MapPin} highlight />
        <InfoBox label={isAr ? "النوع" : "Type"} value={data.type} />
        <InfoBox label={isAr ? "عدد الوحدات" : "Total Units"} value={data.totalUnits} />
      </div>
    );

    const renderUnitDetails = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionHeader title={isAr ? "بيانات الوحدة" : "Unit Details"} icon={Home} />
        <InfoBox label={isAr ? "رقم الوحدة" : "Unit Number"} value={data.unitNumber} icon={Home} highlight />
        <InfoBox label={isAr ? "الطابق" : "Floor"} value={data.floor} />
        <InfoBox label={isAr ? "المساحة (قدم مربع)" : "Area (SqFt)"} value={data.areaSqFt} icon={Maximize2} />
        <SectionHeader title={isAr ? "البيانات المالية" : "Financial Info"} icon={DollarSign} />
        <InfoBox label={isAr ? "الإيجار السنوي" : "Annual Rent"} value={`${(data.annualRent || data.rentAmount)?.toLocaleString()} AED`} highlight />
        <InfoBox label={isAr ? "الحالة" : "Status"} value={data.status} />
        <InfoBox label={isAr ? "النوع" : "Type"} value={data.type} />
      </div>
    );

    const renderChequeDetails = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionHeader title={isAr ? "بيانات الشيك" : "Cheque Info"} icon={FileText} />
        <InfoBox label={isAr ? "رقم الشيك" : "Cheque #"} value={data.chequeNumber} icon={FileText} highlight />
        <InfoBox label={isAr ? "المبلغ" : "Amount"} value={`${data.amount?.toLocaleString()} AED`} icon={DollarSign} highlight />
        <InfoBox label={isAr ? "تاريخ الاستحقاق" : "Due Date"} value={data.dueDate} icon={Calendar} />
        <InfoBox label={isAr ? "البنك" : "Bank"} value={data.bankName} icon={Building2} />
        <InfoBox label={isAr ? "اسم الساحر" : "Drawer"} value={data.drawerName} icon={UserIcon} />
        <InfoBox label={isAr ? "الحالة" : "Status"} value={data.status} />
      </div>
    );

    const renderCaseDetails = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionHeader title={isAr ? "بيانات القضية" : "Case Info"} icon={FileText} />
        <InfoBox label={isAr ? "رقم القضية" : "Case #"} value={data.caseNumber} icon={FileText} highlight />
        <InfoBox label={isAr ? "المحكمة" : "Court"} value={data.courtName} icon={Building2} />
        <InfoBox label={isAr ? "الحالة" : "Status"} value={data.status} />
        <InfoBox label={isAr ? "تاريخ الفتح" : "Open Date"} value={data.openDate} icon={Calendar} />
        <InfoBox label={isAr ? "المستأجر" : "Tenant"} value={data.tenantName} icon={UserIcon} />
      </div>
    );

    const renderCollectionDetails = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SectionHeader title={isAr ? "بيانات التحصيل" : "Collection Details"} icon={FileText} />
        <InfoBox label={isAr ? "رقم السند" : "Receipt #"} value={data.receiptNumber} icon={FileText} highlight />
        <InfoBox label={isAr ? "المبلغ" : "Amount"} value={`${data.amount?.toLocaleString()} AED`} icon={DollarSign} highlight />
        <InfoBox label={isAr ? "طريقة الدفع" : "Method"} value={data.paymentMethod} />
        <InfoBox label={isAr ? "تاريخ الدفع" : "Date"} value={data.paymentDate} icon={Calendar} />
        <SectionHeader title={isAr ? "التصنيف" : "Classification"} />
        <InfoBox label={isAr ? "النوع" : "Type"} value={data.type} />
        <InfoBox label={isAr ? "الحالة" : "Status"} value={data.status} />
      </div>
    );

    const renderGenericDetails = () => {
      const skipFields = ["id", "createdAt", "updatedAt", "lastModified", "createdBy", "attachments", "retainedAttachments"];
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(data).map(([key, value]) => {
            if (skipFields.includes(key)) return null;
            if (value === null || value === undefined || value === "") return null;
            if (typeof value === "object") return null;
            return <div key={key}><InfoBox label={key} value={String(value)} /></div>;
          })}
        </div>
      );
    };

    switch (type) {
      case "TENANT": return renderTenantDetails();
      case "OWNER": return renderOwnerDetails();
      case "PROPERTY": return renderPropertyDetails();
      case "UNIT": return renderUnitDetails();
      case "CHEQUE": return renderChequeDetails();
      case "CASE": return renderCaseDetails();
      case "COLLECTION": return renderCollectionDetails();
      default: return renderGenericDetails();
    }
  };

  const entityTypes = [
    { value: "ALL", labelAr: "الكل", labelEn: "All" },
    { value: "LEASE", labelAr: "عقود إيجار", labelEn: "Leases" },
    { value: "TENANT", labelAr: "مستأجرين", labelEn: "Tenants" },
    { value: "CHEQUE", labelAr: "شيكات", labelEn: "Cheques" },
    { value: "PROPERTY", labelAr: "عقارات", labelEn: "Properties" },
    { value: "UNIT", labelAr: "وحدات", labelEn: "Units" },
    { value: "OWNER", labelAr: "ملاك", labelEn: "Owners" },
    { value: "COLLECTION", labelAr: "تحصيلات", labelEn: "Collections" },
    { value: "CASE", labelAr: "قضايا", labelEn: "Cases" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isAr ? "مركز استعادة البيانات والتراجع" : "Data Recovery & Undo Center"}
          </h1>
          <p className="text-slate-500 text-sm">
            {isAr 
              ? "معاينة واستعادة السجلات المحذوفة بدقة شاملة لكافة الأطراف والعقود" 
              : "Preview and restore deleted records with comprehensive relational party details"}
          </p>
        </div>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`p-4 rounded-xl flex items-center gap-3 shadow-sm ${
            message.type === "success" 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span className="font-medium text-sm">{message.text}</span>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("DELETIONS")}
          className={`px-6 py-3 font-semibold text-sm transition-colors relative ${
            activeTab === "DELETIONS" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            {isAr ? "السجلات المحذوفة" : "Deleted Records"}
          </div>
          {activeTab === "DELETIONS" && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("VERSIONS")}
          className={`px-6 py-3 font-semibold text-sm transition-colors relative ${
            activeTab === "VERSIONS" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            {isAr ? "سجل التعديلات (تراجع)" : "Change History (Undo)"}
          </div>
          {activeTab === "VERSIONS" && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className={`absolute ${isAr ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
          <input
            type="text"
            placeholder={isAr ? "بحث برقم العقد، الاسم، العقار، أو الكود..." : "Search by lease #, name, property, or code..."}
            className={`w-full ${isAr ? "pr-10 pl-4" : "pl-10 pr-4"} py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <SearchableSelect
            className="w-40"
            options={entityTypes.map((t) => ({
              id: t.value,
              label: isAr ? t.labelAr : t.labelEn,
            }))}
            value={filterType}
            onChange={(val) => setFilterType(val as string)}
            placeholder={isAr ? "الكل..." : "All..."}
            searchPlaceholder={isAr ? "ابحث..." : "Search..."}
          />
        </div>
      </div>

      {/* Records List */}
      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record) => {
              const isLease = record.entityType === "LEASE";
              return (
                <motion.div
                  key={record.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className={`p-3 rounded-xl h-fit shrink-0 ${
                        isLease 
                          ? "bg-blue-100 text-blue-700" 
                          : activeTab === "DELETIONS" ? "bg-red-50 text-red-600" : "bg-purple-50 text-purple-600"
                      }`}>
                        {isLease ? <FileText className="w-5 h-5" /> : activeTab === "DELETIONS" ? <Trash2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 
                            onClick={() => {
                              setLeaseSubTab("ALL");
                              setPreviewRecord(record);
                            }}
                            className="font-bold text-slate-800 hover:text-blue-600 cursor-pointer transition-colors text-base truncate flex items-center gap-1.5"
                            title={isAr ? "انقر لمعاينة التفاصيل الكاملة للسجل" : "Click to view full record details"}
                          >
                            <span>{record.entityTitle}</span>
                            <Eye className="w-3.5 h-3.5 opacity-60 text-blue-600 inline" />
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                            isLease ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {record.entityType}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(record.deletedAt || record.versionDate || "").toLocaleString(isAr ? "ar-AE" : "en-US")}
                          </span>
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            {record.deletedByUserName}
                          </span>
                        </div>

                        {record.deletionReason && (
                          <p className="text-xs text-slate-600 bg-amber-50/80 p-2 rounded-lg mt-1 border-s-2 border-amber-400 italic">
                            "{record.deletionReason}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => {
                          setLeaseSubTab("ALL");
                          setPreviewRecord(record);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        {isAr ? (isLease ? "معاينة بيانات العقد" : "معاينة البيانات") : "Preview"}
                      </button>

                      <button
                        onClick={() => handleRestore(record.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {activeTab === "DELETIONS" ? (isAr ? "استعادة" : "Restore") : (isAr ? "تراجع" : "Undo")}
                      </button>

                      {activeTab === "DELETIONS" && (
                        <button
                          onClick={() => handleDeletePermanent(record.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={isAr ? "حذف نهائي" : "Permanent Delete"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
            >
              <div className="mx-auto w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium text-sm">
                {isAr ? "لا توجد سجلات مطابقة لخيارات البحث" : "No matching records found"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewRecord(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-slate-50 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{previewRecord.entityTitle}</h2>
                    <p className="text-xs text-slate-500">
                      {isAr 
                        ? "معاينة كاملة للسجل التاريخي المحفوظ مع بيانات الأطراف والربط" 
                        : "Complete preview of historical record with relational party details"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewRecord(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                {/* Meta Audit Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold">{isAr ? "تاريخ الحفظ:" : "Logged:"}</span>
                    <span>{new Date(previewRecord.deletedAt || previewRecord.versionDate || "").toLocaleString(isAr ? "ar-AE" : "en-US")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <UserIcon className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold">{isAr ? "المسؤول:" : "Logged by:"}</span>
                    <span>{previewRecord.deletedByUserName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500">{isAr ? "النوع:" : "Type:"}</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded">
                      {previewRecord.entityType}
                    </span>
                  </div>
                </div>

                {/* Specific Detailed Render */}
                {previewRecord.entityType === "LEASE" ? (
                  renderLeaseDeepPreview(previewRecord)
                ) : (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    {renderOtherRecordPreview(previewRecord)}
                  </div>
                )}

                {/* Retained Attachments */}
                {previewRecord.retainedAttachments && previewRecord.retainedAttachments.length > 0 && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        {isAr ? "المرفقات والوثائق المحفوظة" : "Retained Attachments"}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {previewRecord.retainedAttachments.map((att, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="p-2 bg-white rounded-lg shadow-xs text-blue-600">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{att.fileName}</div>
                            <div className="text-[10px] text-slate-400 uppercase">{att.category || "ATTACHMENT"}</div>
                          </div>
                          {att.fileUrl && (
                            <a
                              href={att.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setPreviewRecord(null)}
                  className="px-5 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {isAr ? "إغلاق" : "Close"}
                </button>
                <button
                  onClick={() => {
                    handleRestore(previewRecord.id);
                    setPreviewRecord(null);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  <RotateCcw className="w-4 h-4" />
                  {activeTab === "DELETIONS" ? (isAr ? "استعادة السجل الآن" : "Restore Record Now") : (isAr ? "تراجع واستعادة النسخة" : "Undo & Restore")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
