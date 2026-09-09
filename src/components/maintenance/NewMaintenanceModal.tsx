import React, { useState, useEffect } from "react";
import {
  X,
  Wrench,
  Building,
  Home,
  User,
  AlertTriangle,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Plus,
  Phone,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  CostBearer,
  MaintenancePriority,
  MaintenanceStatus,
  PaymentMethod,
  DocumentOptimizationResult,
} from "../../types";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { DocumentUpload } from "../common/DocumentUpload";

interface NewMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUnitId?: string;
  initialPropertyId?: string;
}

export const NewMaintenanceModal: React.FC<NewMaintenanceModalProps> = ({
  isOpen,
  onClose,
  initialUnitId,
  initialPropertyId,
}) => {
  const {
    properties,
    units,
    tenants,
    leases,
    owners,
    technicians,
    maintenanceSettings,
    addMaintenanceRequest,
  } = useData();
  const { t, language, formatAED } = useLanguage();
  const { currentUser } = useAuth();
  const isTenant = currentUser?.role === "TENANT";

  // Form State
  const [propertyId, setPropertyId] = useState<string>(initialPropertyId || "");
  const [unitId, setUnitId] = useState<string>(initialUnitId || "");
  const [tenantId, setTenantId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [leaseId, setLeaseId] = useState<string>("");

  const [requestedBy, setRequestedBy] = useState<string>("");
  const [requesterPhone, setRequesterPhone] = useState<string>("");
  const [requestDate, setRequestDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [requestTime, setRequestTime] = useState<string>(
    new Date().toTimeString().split(" ")[0].substring(0, 5)
  );

  const [category, setCategory] = useState<string>("عام");
  const [priority, setPriority] = useState<MaintenancePriority>("NORMAL");
  const [status, setStatus] = useState<MaintenanceStatus>("OPEN");
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [initialNote, setInitialNote] = useState<string>("");

  const [costBearer, setCostBearer] = useState<CostBearer>(
    maintenanceSettings.defaultCostBearer || "OWNER"
  );
  const [laborCost, setLaborCost] = useState<number>(0);
  const [partsCost, setPartsCost] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);

  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string>("");
  const [initialAttachment, setInitialAttachment] = useState<DocumentOptimizationResult | null>(null);

  // Error State
  const [error, setError] = useState<string | null>(null);

  // Available filtered units for selected property
  const availableUnits = propertyId
    ? units.filter((u) => u.propertyId === propertyId)
    : units;

  // Auto-detect Property, Owner, Tenant & Lease when Unit changes
  useEffect(() => {
    if (unitId) {
      const selectedUnit = units.find((u) => u.id === unitId);
      if (selectedUnit) {
        if (!propertyId || propertyId !== selectedUnit.propertyId) {
          setPropertyId(selectedUnit.propertyId);
        }

        const prop = properties.find((p) => p.id === selectedUnit.propertyId);
        if (prop) {
          setOwnerId(prop.ownerId);
        }

        // Check for active lease on this unit
        const activeLease = leases.find(
          (l) => l.unitId === unitId && l.contractStatus === "ACTIVE"
        );
        if (activeLease) {
          setLeaseId(activeLease.id);
          setTenantId(activeLease.tenantId);
          const tnt = tenants.find((t) => t.id === activeLease.tenantId);
          if (tnt) {
            setRequestedBy(tnt.nameAr || tnt.nameEn || "");
            setRequesterPhone(tnt.phone || "");
          }
        } else if (selectedUnit.currentTenantId) {
          setTenantId(selectedUnit.currentTenantId);
          const tnt = tenants.find((t) => t.id === selectedUnit.currentTenantId);
          if (tnt) {
            setRequestedBy(tnt.nameAr || tnt.nameEn || "");
            setRequesterPhone(tnt.phone || "");
          }
        }
      }
    }
  }, [unitId, units, properties, leases, tenants]);

  // When property changes, reset unit if not matching
  const handlePropertyChange = (newPropId: string) => {
    setPropertyId(newPropId);
    const prop = properties.find((p) => p.id === newPropId);
    if (prop) {
      setOwnerId(prop.ownerId);
    }
    const unitMatch = units.find(
      (u) => u.id === unitId && u.propertyId === newPropId
    );
    if (!unitMatch) {
      setUnitId("");
      setTenantId("");
      setLeaseId("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!propertyId) {
      setError(language === "ar" ? "يرجى تحديد العقار" : "Please select a property");
      return;
    }
    if (!unitId) {
      setError(language === "ar" ? "يرجى تحديد الوحدة العقارية" : "Please select a unit");
      return;
    }
    if (!issueDescription.trim()) {
      setError(
        language === "ar"
          ? "يرجى إدخال وصف المشكلة أو طلب الصيانة"
          : "Please enter maintenance issue description"
      );
      return;
    }

    const prop = properties.find((p) => p.id === propertyId);
    const unit = units.find((u) => u.id === unitId);
    const owner = owners.find((o) => o.id === (ownerId || prop?.ownerId));
    const tenant = tenants.find((t) => t.id === tenantId);
    const lease = leases.find((l) => l.id === leaseId);
    const tech = technicians.find((t) => t.id === assignedTechnicianId);

    const totalCost = (Number(laborCost) || 0) + (Number(partsCost) || 0) + (Number(otherCost) || 0);

    const initialStatus: MaintenanceStatus = assignedTechnicianId ? "IN_PROGRESS" : status;

    addMaintenanceRequest({
      requestDate,
      requestTime,
      requestedBy: requestedBy.trim() || (tenant ? tenant.nameAr || tenant.nameEn : "طلب مباشر"),
      requesterPhone: requesterPhone.trim() || tenant?.phone || "",
      propertyId,
      propertyNameAr: prop?.nameAr || prop?.nameEn || "",
      propertyNameEn: prop?.nameEn || prop?.nameAr || "",
      unitId,
      unitNumber: unit?.unitNumber || "",
      ownerId: owner?.id || prop?.ownerId || "",
      ownerNameAr: owner?.nameAr || owner?.nameEn || "",
      ownerNameEn: owner?.nameEn || owner?.nameAr || "",
      tenantId: tenant?.id,
      tenantNameAr: tenant?.nameAr,
      tenantNameEn: tenant?.nameEn,
      tenantPhone: tenant?.phone,
      leaseId: lease?.id,
      leaseNumber: lease?.leaseNumber,
      category,
      priority,
      status: initialStatus,
      issueDescription: issueDescription.trim(),
      notes: initialNote.trim() ? [initialNote.trim()] : [],
      assignedTechnicianId: tech?.id,
      assignedTechnicianName: tech?.name,
      assignedTechnicianPhone: tech?.phone,
      assignedTechnicianCompany: tech?.company,
      assignedAt: tech ? new Date().toISOString() : undefined,
      assignedByUserId: tech ? currentUser?.id : undefined,
      assignedByUserName: tech ? (currentUser?.nameAr || currentUser?.nameEn) : undefined,
      laborCost: Number(laborCost) || 0,
      partsCost: Number(partsCost) || 0,
      otherCost: Number(otherCost) || 0,
      totalCost,
      paidAmount: 0,
      remainingAmount: totalCost,
      costBearer,
      attachments: initialAttachment
        ? [
            {
              id: "att-" + Date.now(),
              maintenanceRequestId: "",
              fileName: initialAttachment.optimizedFileName || initialAttachment.originalFileName,
              fileType: initialAttachment.originalMimeType,
              fileSize: initialAttachment.optimizedSizeBytes,
              fileUrl: initialAttachment.dataUrl,
              uploadedAt: new Date().toISOString(),
              uploadedBy: currentUser?.nameAr || currentUser?.nameEn || "المستخدم",
              category: "ISSUE_PHOTO",
              notes: "Initial request attachment",
            },
          ]
        : [],
    });

    onClose();
  };

  if (!isOpen) return null;

  // Searchable select options
  const propertySelectOptions: SearchableOption[] = properties
    .filter((p) => {
      if (isTenant && currentUser?.tenantId) {
        const myLeases = leases.filter(l => l.tenantId === currentUser.tenantId);
        return myLeases.some(l => l.propertyId === p.id);
      }
      return true;
    })
    .map((p) => {
      const owner = owners.find((o) => o.id === p.ownerId);
      const ownerName = owner ? owner.nameAr || owner.nameEn : "";
      return {
        id: p.id,
        label: p.nameAr || p.nameEn,
        subLabel: ownerName ? `المالك: ${ownerName}` : p.community || p.emirate || "",
        badge: p.code || undefined,
      };
    });

  const unitSelectOptions: SearchableOption[] = availableUnits
    .filter((u) => {
      if (isTenant && currentUser?.tenantId) {
        const myLeases = leases.filter(l => l.tenantId === currentUser.tenantId);
        return myLeases.some(l => l.unitId === u.id);
      }
      return true;
    })
    .map((u) => {
      const activeLease = leases.find(
        (l) => l.unitId === u.id && l.contractStatus === "ACTIVE"
      );
      const tnt = activeLease
        ? tenants.find((t) => t.id === activeLease.tenantId)
        : null;
      const tenantName = tnt ? tnt.nameAr || tnt.nameEn : "";
      return {
        id: u.id,
        label: `${language === "ar" ? "وحدة رقم" : "Unit #"}: ${u.unitNumber}`,
        subLabel: tenantName
          ? `المستأجر: ${tenantName}`
          : language === "ar"
          ? "شاغرة"
          : "Vacant",
        badge: u.type || "سكني",
      };
    });

  const categorySelectOptions: SearchableOption[] = [
    ...maintenanceSettings.categories.map((c) => ({
      id: c.nameAr,
      label: language === "ar" ? c.nameAr : c.nameEn || c.nameAr,
      subLabel: c.nameEn,
    })),
    { id: "سباكة", label: "سباكة", subLabel: "Plumbing" },
    { id: "كهرباء", label: "كهرباء", subLabel: "Electrical" },
    { id: "تكييف", label: "تكييف وتبريد", subLabel: "AC & HVAC" },
    { id: "نجارة وأبواب", label: "نجارة وأبواب", subLabel: "Carpentry" },
    { id: "دهانات وديكور", label: "دهانات وديكور", subLabel: "Painting" },
    { id: "أجهزة كهربائية", label: "أجهزة كهربائية", subLabel: "Appliances" },
    { id: "مكافحة حشرات", label: "مكافحة حشرات", subLabel: "Pest Control" },
    { id: "تسريب مياه وعزل", label: "تسريب مياه وعزل", subLabel: "Waterproofing" },
    { id: "عام", label: "عام", subLabel: "General" },
  ];

  const prioritySelectOptions: SearchableOption[] = [
    { id: "LOW", label: "منخفضة - Low", subLabel: "SLA: 72h", badge: "72h" },
    { id: "NORMAL", label: "عادية - Normal", subLabel: "SLA: 48h", badge: "48h" },
    { id: "HIGH", label: "عالية - High", subLabel: "SLA: 24h", badge: "24h" },
    { id: "URGENT", label: "طارئة وعاجلة - Urgent", subLabel: "SLA: 4h", badge: "4h" },
  ];

  const technicianSelectOptions: SearchableOption[] = technicians.map((t) => ({
    id: t.id,
    label: t.name,
    subLabel: t.company ? `${t.serviceType} (${t.company})` : t.serviceType,
    badge: t.phone,
  }));

  const costBearerSelectOptions: SearchableOption[] = [
    { id: "OWNER", label: "المالك (Owner)" },
    { id: "TENANT", label: "المستأجر (Tenant)" },
    { id: "MANAGEMENT", label: "إدارة العقارات (Management)" },
    { id: "PER_CONTRACT", label: "حسب شروط العقد (Per Contract)" },
    { id: "OTHER", label: "أخرى (Other)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {language === "ar" ? "تسجيل طلب صيانة جديد" : "New Maintenance Request"}
              </h2>
              <p className="text-xs text-slate-500">
                {language === "ar"
                  ? "ربط الطلب بالعقار والوحدة والمستأجر والمالك مع معاينة فورية للبيانات"
                  : "Link maintenance request to property, unit, tenant and owner with live compiled summary"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Live Compiled Maintenance Information Text Box */}
          {(() => {
            const prop = properties.find((p) => p.id === propertyId);
            const unit = units.find((u) => u.id === unitId);
            const tenant = tenants.find((t) => t.id === tenantId);
            const owner = owners.find((o) => o.id === (ownerId || prop?.ownerId));
            const lease = leases.find((l) => l.id === leaseId);
            const tech = technicians.find((t) => t.id === assignedTechnicianId);
            const propName = prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "";
            const tenantName = tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "";
            const ownerName = owner ? (language === "ar" ? owner.nameAr : owner.nameEn) : "";
            const totalEstimatedCost = (Number(laborCost) || 0) + (Number(partsCost) || 0) + (Number(otherCost) || 0);

            const getPriorityBadge = (p: string) => {
              switch (p) {
                case "URGENT": return { label: language === "ar" ? "طارئة وعاجلة (4h)" : "Urgent (4h)", bg: "bg-rose-100 text-rose-800" };
                case "HIGH": return { label: language === "ar" ? "عالية (24h)" : "High (24h)", bg: "bg-orange-100 text-orange-800" };
                case "NORMAL": return { label: language === "ar" ? "عادية (48h)" : "Normal (48h)", bg: "bg-blue-100 text-blue-800" };
                default: return { label: language === "ar" ? "منخفضة (72h)" : "Low (72h)", bg: "bg-slate-100 text-slate-800" };
              }
            };
            const prio = getPriorityBadge(priority);

            return (
              <div className="p-4 bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                  <Wrench className="w-4 h-4 text-amber-700" />
                  <span>
                    {language === "ar"
                      ? "📋 معلومات مجمعة عن طلب الصيانة (معاينة فورية للبيانات المدخلة):"
                      : "📋 Compiled Maintenance Summary & Live Preview:"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs text-amber-950 bg-white p-3.5 rounded-xl border border-amber-200">
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "العقار والوحدة:" : "Property & Unit:"}</span>
                    <strong className="text-amber-950 truncate block" title={propName || "—"}>
                      {propName || "—"} {unit ? `• وحدة ${unit.unitNumber}` : ""}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المستأجر المقيم:" : "Tenant:"}</span>
                    <strong className="text-amber-950 truncate block" title={tenantName || "—"}>{tenantName || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المالك المسجل:" : "Owner:"}</span>
                    <strong className="text-amber-950 truncate block" title={ownerName || "—"}>{ownerName || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "رقم العقد الإيجاري:" : "Lease #:"}</span>
                    <strong className="font-mono text-amber-950">{lease?.leaseNumber || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "نوع التصنيف:" : "Category:"}</span>
                    <strong className="text-amber-950">{category}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "مستوى الأولوية (SLA):" : "Priority:"}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${prio.bg}`}>
                      {prio.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الفني المعين:" : "Technician:"}</span>
                    <strong className="text-amber-950 truncate block" title={tech?.name || "—"}>{tech?.name || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "متحمل التكلفة:" : "Cost Bearer:"}</span>
                    <strong className="text-amber-950">
                      {costBearer === "OWNER" ? "المالك" : costBearer === "TENANT" ? "المستأجر" : costBearer === "MANAGEMENT" ? "الإدارة" : "حسب العقد"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "إجمالي التكلفة التقديرية:" : "Total Cost:"}</span>
                    <strong className="font-mono text-emerald-950 font-bold">{formatAED(totalEstimatedCost)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "مقدم الطلب:" : "Requested By:"}</span>
                    <strong className="text-amber-950 truncate block">{requestedBy || "—"}</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Section 1: Property & Unit Selector */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === "ar" ? "بيانات العقار والوحدة" : "Property & Unit Details"}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Property */}
              <div>
                <SearchableSelect
                  label={language === "ar" ? "العقار" : "Property"}
                  required
                  options={propertySelectOptions}
                  value={propertyId}
                  onChange={(val) => handlePropertyChange(val)}
                  placeholder={language === "ar" ? "-- اختر العقار --" : "-- Select Property --"}
                  searchPlaceholder={language === "ar" ? "ابحث باسم العقار أو المالك أو الكود..." : "Search property or owner..."}
                />
              </div>

              {/* Unit */}
              <div>
                <SearchableSelect
                  label={language === "ar" ? "الوحدة العقارية" : "Unit"}
                  required
                  disabled={!propertyId}
                  options={unitSelectOptions}
                  value={unitId}
                  onChange={(val) => setUnitId(val)}
                  placeholder={language === "ar" ? "-- اختر الوحدة --" : "-- Select Unit --"}
                  searchPlaceholder={language === "ar" ? "ابحث برقم الوحدة أو اسم المستأجر..." : "Search unit or tenant..."}
                />
              </div>
            </div>

            {/* Auto-detected Tenant & Owner summary card */}
            {unitId && (
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold text-slate-500">
                    {language === "ar" ? "المستأجر الحالي:" : "Current Tenant:"}
                  </span>
                  <span className="font-bold text-slate-900">
                    {tenants.find((t) => t.id === tenantId)?.nameAr ||
                      tenants.find((t) => t.id === tenantId)?.nameEn ||
                      (language === "ar" ? "شاغرة حالياً" : "Vacant")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold text-slate-500">
                    {language === "ar" ? "المالك:" : "Owner:"}
                  </span>
                  <span className="font-bold text-slate-900">
                    {owners.find((o) => o.id === ownerId)?.nameAr ||
                      owners.find((o) => o.id === ownerId)?.nameEn ||
                      "-"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Requester & Timing Details */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === "ar" ? "مقدم الطلب والتوقيت" : "Requester & Schedule"}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "اسم مقدم الطلب" : "Requested By"}
                </label>
                <input
                  type="text"
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                  placeholder={language === "ar" ? "اسم المستأجر أو المبلغ" : "Name"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "رقم الهاتف" : "Phone Number"}
                </label>
                <input
                  type="text"
                  value={requesterPhone}
                  onChange={(e) => setRequesterPhone(e.target.value)}
                  placeholder="050xxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "تاريخ الطلب" : "Request Date"}
                </label>
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "وقت الطلب" : "Request Time"}
                </label>
                <input
                  type="time"
                  value={requestTime}
                  onChange={(e) => setRequestTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Classification & Priority */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === "ar" ? "تصنيف الصيانة والأولوية" : "Category & Priority"}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <SearchableSelect
                  label={language === "ar" ? "نوع / تصنيف الصيانة" : "Category"}
                  options={categorySelectOptions}
                  value={category}
                  onChange={(val) => setCategory(val)}
                  placeholder={language === "ar" ? "-- اختر التصنيف --" : "-- Select Category --"}
                  searchPlaceholder={language === "ar" ? "ابحث بنوع الصيانة (سباكة، كهرباء، تكييف...)..." : "Search category..."}
                />
              </div>

              <div>
                <SearchableSelect
                  label={language === "ar" ? "درجة الأهمية / الأولوية" : "Priority / SLA"}
                  options={prioritySelectOptions}
                  value={priority}
                  onChange={(val) => setPriority(val as MaintenancePriority)}
                  placeholder={language === "ar" ? "-- اختر الأولوية --" : "-- Select Priority --"}
                  searchPlaceholder={language === "ar" ? "ابحث بالأولوية (عادية، طارئة...)..." : "Search priority..."}
                />
              </div>

              {!isTenant && (
                <div>
                  <SearchableSelect
                    label={language === "ar" ? "تعيين فني الصيانة" : "Assign Technician"}
                    options={technicianSelectOptions}
                    value={assignedTechnicianId}
                    onChange={(val) => setAssignedTechnicianId(val)}
                    placeholder={language === "ar" ? "-- تعيين لاحقاً --" : "-- Assign Later --"}
                    searchPlaceholder={language === "ar" ? "ابحث باسم الفني أو الشركة أو التخصص..." : "Search technician..."}
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {language === "ar" ? "وصف العطل / المشكلة بالتفصيل *" : "Issue Description *"}
              </label>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                required
                rows={3}
                placeholder={
                  language === "ar"
                    ? "اشرح تفاصيل المشكلة وموقعها داخل الوحدة بدقة..."
                    : "Describe the maintenance issue..."
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
              />
            </div>

            {/* Document / Photo Upload Pipeline */}
            <div className="pt-1">
              <DocumentUpload
                label={language === "ar" ? "إرفاق صورة أو تقرير العطل (اختياري)" : "Attach Photo or Report (Optional)"}
                defaultProfile="PHOTO"
                onOptimized={setInitialAttachment}
              />
            </div>
          </div>

          {/* Section 4: Cost & Financial Responsibility */}
          {!isTenant && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === "ar" ? "التكاليف والمسؤولية المالية" : "Costs & Responsibility"}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <SearchableSelect
                  label={language === "ar" ? "الطرف المتحمل للتكلفة" : "Cost Bearer"}
                  options={costBearerSelectOptions}
                  value={costBearer}
                  onChange={(val) => setCostBearer(val as CostBearer)}
                  placeholder={language === "ar" ? "-- اختر الملتزم بتكلفة الصيانة --" : "-- Select Cost Bearer --"}
                  searchPlaceholder={language === "ar" ? "ابحث بالطرف المتحمل (المالك، المستأجر...)..." : "Search cost bearer..."}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "أجور الأيدي العاملة (AED)" : "Labor Cost (AED)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={laborCost || ""}
                  onChange={(e) => setLaborCost(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "قطع الغيار والمواد (AED)" : "Parts Cost (AED)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={partsCost || ""}
                  onChange={(e) => setPartsCost(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "الإجمالي التقديري" : "Estimated Total"}
                </label>
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-black text-slate-900 flex items-center justify-between">
                  <span>AED</span>
                  <span>{((laborCost || 0) + (partsCost || 0) + (otherCost || 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {language === "ar" ? "ملاحظة أولية / توجيهات خاصة" : "Initial Note"}
              </label>
              <input
                type="text"
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                placeholder={
                  language === "ar"
                    ? "أي تعليمات لفريق الصيانة أو الفني..."
                    : "Any instructions..."
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
              />
            </div>

        {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "ar" ? "حفظ وإنشاء الطلب" : "Create Request"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
