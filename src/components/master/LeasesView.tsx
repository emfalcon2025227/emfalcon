import React, { useState, useRef } from "react";
import { Plus, Search, FileSpreadsheet, AlertTriangle, CheckCircle2, RotateCw, Calendar, Building, User, Trash2, Edit2, Sparkles, Upload, FileText, X, ExternalLink, DollarSign, Ban, Eye } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData, isOccupyingLeaseStatus } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Lease } from "../../types";
import { Modal } from "../common/Modal";
import { Badge } from "../common/Badge";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { LeaseWorkspacePage } from "./LeaseWorkspaceModal";
import { Lease360Workspace } from "./Lease360Workspace";
import { LeaseEditorModal } from "./LeaseEditorModal";
import { LeaseRenewalsTab } from "../leases/LeaseRenewalsTab";
import { DeferredPaymentsTab } from "../leases/DeferredPaymentsTab";
import { LeaseTerminationModal } from "../leases/LeaseTerminationModal";
import { getPropertyTypeLabel } from "../../data/propertyOptions";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import { DraggableWrapper } from "../common/DraggableWrapper";
import { getLeaseRenewalEligibility } from "../../utils/leaseRenewalRules";
import { LeaseRenewalRuleNoticeModal } from "../common/LeaseRenewalRuleNoticeModal";

interface LeasesViewProps {
  onNavigateToRenewLease?: (lease: Lease) => void;
}

export const LeasesView: React.FC<LeasesViewProps> = ({ onNavigateToRenewLease }) => {
  const { t, language } = useLanguage();
  const { leases, properties, units, tenants, archive, addLease, updateLease, renewLease, deleteLease, addArchiveItem, deleteArchiveItem, getNextLeaseNumber } = useData();
  const { hasPermission, currentUser } = useAuth();
  const canDelete = hasPermission("DELETE_RECORDS");
  const leaseFileInputRef = useRef<HTMLInputElement>(null);
  const [tempRecordId, setTempRecordId] = useState("");
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [leaseToDelete, setLeaseToDelete] = useState<Lease | null>(null);

  const currentRecordId = editingLease ? editingLease.id : tempRecordId;
  const attachedDocs = archive.filter((a) => a.recordId === currentRecordId || a.entityId === currentRecordId);



  const handleDelete = (lease: Lease, e: React.MouseEvent) => {
    e.stopPropagation();
    setLeaseToDelete(lease);
  };

  const confirmDelete = (options?: { keepAttachments?: boolean; reason?: string }) => {
    if (leaseToDelete) {
      deleteLease(leaseToDelete.id, options);
      setLeaseToDelete(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    const saved = sessionStorage.getItem("ef_lease_initial_filter");
    if (saved) {
      sessionStorage.removeItem("ef_lease_initial_filter");
      return saved;
    }
    return "ALL";
  });
  const [activeMainTab, setActiveMainTab] = useState<"LEASES" | "RENEWALS" | "DEFERRED">("LEASES");
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewingLease, setRenewingLease] = useState<Lease | null>(null);
  const [renewalNoticeLease, setRenewalNoticeLease] = useState<Lease | null>(null);
  const [terminatingLease, setTerminatingLease] = useState<Lease | null>(null);
  const [selectedWorkspaceLease, setSelectedWorkspaceLease] = useState<Lease | null>(null);
  const [selected360LeaseId, setSelected360LeaseId] = useState<string | null>(null);

  // Form State for Add / Edit
  const [leaseNumber, setLeaseNumber] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [annualRent, setAnnualRent] = useState<number | string>("");
  const [paymentFrequency, setPaymentFrequency] = useState<Lease["paymentFrequency"]>("QUARTERLY_4_CHEQUES");
  const [ejariNumber, setEjariNumber] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState<number | string>("");
  const [contractStatus, setContractStatus] = useState<Lease["contractStatus"]>("ACTIVE");

  const handleLeaseFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      addArchiveItem({
        fileName: file.name,
        category: "LEASES",
        recordId: currentRecordId,
        recordTitle: leaseNumber || "Lease Contract",
        fileType: file.type || "application/pdf",
        fileSize: file.size,
        previewUrl: reader.result as string,
        isPrivate: true,
        storagePath: "leases/" + file.name,
        uploadedByUserId: currentUser?.id || "u-1",
        uploadedByName: currentUser?.nameAr || currentUser?.username || "Admin",
        tags: ["lease", "contract", "ejari"],
        entityType: "LEASE",
        entityId: currentRecordId,
      });
      if (leaseFileInputRef.current) leaseFileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const filteredLeases = leases.filter((lease) => {
    const prop = properties.find((p) => p.id === lease.propertyId);
    const tenant = tenants.find((t) => t.id === lease.tenantId);
    const unit = units.find((u) => u.id === lease.unitId);

    const matchTerm =
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          lease.leaseNumber,
          lease.ejariNumber,
          prop?.nameAr,
          prop?.nameEn,
          prop?.code,
          tenant?.nameAr,
          tenant?.nameEn,
          tenant?.code,
          tenant?.phone,
          unit?.unitNumber,
        ],
        searchTerm
      );

    const status = (lease.contractStatus || (lease as any).status || "").toUpperCase().trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = lease.endDate ? new Date(lease.endDate) : null;
    const daysRemaining = end && !isNaN(end.getTime()) ? Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24)) : 999;

    const matchStatus = (() => {
      if (selectedStatus === "ALL") return true;
      if (selectedStatus === "ACTIVE") {
        if (status === "TERMINATED" || status === "CANCELLED" || status === "EXPIRED") return false;
        return status === "ACTIVE" || status === "RENEWED" || status === "UNDER_RENEWAL" || status === "PENDING_APPROVAL" || status === "PENDING" || status === "DRAFT" || !status || (end ? daysRemaining >= 0 : true);
      }
      if (selectedStatus === "RENEWED") {
        return status === "RENEWED";
      }
      if (selectedStatus === "EXPIRED") {
        if (status === "TERMINATED" || status === "CANCELLED") return false;
        return status === "EXPIRED" || (daysRemaining < 0 && status !== "RENEWED" && status !== "UNDER_RENEWAL");
      }
      if (selectedStatus === "EXPIRING_15") {
        return daysRemaining >= 0 && daysRemaining <= 15 && status !== "TERMINATED" && status !== "CANCELLED";
      }
      if (selectedStatus === "EXPIRING_30") {
        return daysRemaining >= 0 && daysRemaining <= 30 && status !== "TERMINATED" && status !== "CANCELLED";
      }
      if (selectedStatus === "TERMINATED") {
        return status === "TERMINATED";
      }
      if (selectedStatus === "CANCELLED") {
        return status === "CANCELLED";
      }
      return status === selectedStatus.toUpperCase();
    })();

    return matchTerm && matchStatus;
  });

  const handleOpenAdd = () => {
    setEditingLease(null);
    setLeaseNumber(getNextLeaseNumber());
    setTempRecordId("temp-" + Date.now());
    setPropertyId("");
    setUnitId("");
    setTenantId("");
    const start = new Date().toISOString().split("T")[0];
    setStartDate(start);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setEndDate(nextYear.toISOString().split("T")[0]);
    setAnnualRent("");
    setPaymentFrequency("QUARTERLY_4_CHEQUES");
    setEjariNumber("");
    setSecurityDeposit("");
    setContractStatus("ACTIVE");
    setIsAddEditModalOpen(true);
  };

  const handleOpenEdit = (lease: Lease, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingLease(lease);
    setLeaseNumber(lease.leaseNumber || "");
    setTempRecordId(lease.id);
    setPropertyId(lease.propertyId || "");
    setUnitId(lease.unitId || "");
    setTenantId(lease.tenantId || "");
    setStartDate(lease.startDate || "");
    setEndDate(lease.endDate || "");
    setAnnualRent(lease.annualRent !== undefined ? lease.annualRent : "");
    setPaymentFrequency((lease.paymentFrequency as any) || "QUARTERLY_4_CHEQUES");
    setEjariNumber(lease.ejariNumber || "");
    setSecurityDeposit(lease.securityDeposit !== undefined ? lease.securityDeposit : "");
    setContractStatus(lease.contractStatus || "ACTIVE");
    setIsAddEditModalOpen(true);
  };

  const handleOpenRenew = (lease: Lease) => {
    const eligibility = getLeaseRenewalEligibility(lease, language as any);
    if (!eligibility.isEligible) {
      setRenewalNoticeLease(lease);
      return;
    }

    if (onNavigateToRenewLease) {
      onNavigateToRenewLease(lease);
    } else {
      setRenewingLease(lease);
      setIsRenewModalOpen(true);
    }
  };

  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);

  const applyDurationYears = (years: number) => {
    if (!startDate) {
      const today = new Date().toISOString().split("T")[0];
      setStartDate(today);
      const endD = new Date(today);
      endD.setFullYear(endD.getFullYear() + years);
      endD.setDate(endD.getDate() - 1);
      setEndDate(endD.toISOString().split("T")[0]);
    } else {
      const endD = new Date(startDate);
      endD.setFullYear(endD.getFullYear() + years);
      endD.setDate(endD.getDate() - 1);
      setEndDate(endD.toISOString().split("T")[0]);
    }
  };

  const handleAddEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmSaveOpen) {
      setIsConfirmSaveOpen(true);
      return;
    }
    executeSaveLease();
  };

  const executeSaveLease = () => {
    const prop = properties.find((p) => p.id === propertyId);
    const parsedRent = typeof annualRent === "number" ? annualRent : parseFloat(annualRent as string) || 0;
    const parsedDeposit = typeof securityDeposit === "number" ? securityDeposit : parseFloat(securityDeposit as string) || 0;

    const cheques =
      paymentFrequency === "ONE_CHEQUE"
        ? 1
        : paymentFrequency === "TWO_CHEQUES"
        ? 2
        : paymentFrequency === "QUARTERLY_4_CHEQUES"
        ? 4
        : paymentFrequency === "BI_MONTHLY_6_CHEQUES"
        ? 6
        : 12;

    const generatedNumber = leaseNumber.trim() || getNextLeaseNumber();

    if (editingLease) {
      updateLease(editingLease.id, {
        leaseNumber: generatedNumber,
        tenantId,
        ownerId: prop?.ownerId || editingLease.ownerId || "ow-01",
        propertyId,
        unitId,
        startDate,
        endDate,
        annualRent: parsedRent,
        paymentFrequency,
        chequesCount: cheques,
        installmentsCount: cheques,
        securityDeposit: parsedDeposit,
        ejariNumber: ejariNumber.trim(),
        contractStatus: contractStatus || "ACTIVE",
      });
    } else {
      addLease({
        leaseNumber: generatedNumber,
        tenantId,
        ownerId: prop?.ownerId || "ow-01",
        propertyId,
        unitId,
        startDate,
        endDate,
        annualRent: parsedRent,
        paymentFrequency,
        chequesCount: cheques,
        securityDeposit: parsedDeposit,
        ejariNumber: ejariNumber.trim(),
        installmentsCount: cheques,
        installments: [],
        contractStatus: contractStatus || "ACTIVE",
      });
    }
    setIsConfirmSaveOpen(false);
    setIsAddEditModalOpen(false);
  };

  if (selected360LeaseId) {
    return (
      <Lease360Workspace
        leaseId={selected360LeaseId}
        onClose={() => setSelected360LeaseId(null)}
        onOpenRenew={(l) => {
          setSelected360LeaseId(null);
          handleOpenRenew(l);
        }}
      />
    );
  }

  if (selectedWorkspaceLease) {
    return (
      <LeaseWorkspacePage
        lease={selectedWorkspaceLease}
        onClose={() => setSelectedWorkspaceLease(null)}
        onOpenRenew={(l) => {
          setSelectedWorkspaceLease(null);
          handleOpenRenew(l);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DraggableWrapper formId="LEASES" elementId="header-info">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t("navLeases")}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar"
                ? "عقود الإيجار الموثقة، طلبات التجديد المتكاملة، ومتابعة الدفعات المؤجلة"
                : "Registered tenancy contracts, integrated renewals, and deferred payment tracking"}
            </p>
          </div>
        </DraggableWrapper>

        <div className="flex items-center gap-2">
          {activeMainTab === "RENEWALS" && (
            <button
              onClick={() => {
                setRenewingLease(null);
                setIsRenewModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>{language === "ar" ? "طلب تجديد جديد" : "New Renewal"}</span>
            </button>
          )}

          <DraggableWrapper formId="LEASES" elementId="btn-add-lease">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "ar" ? "تحرير عقد جديد" : "Create New Lease"}</span>
            </button>
          </DraggableWrapper>
        </div>
      </div>

      {/* Main Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl w-fit border border-slate-200/80">
        <button
          onClick={() => setActiveMainTab("LEASES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMainTab === "LEASES"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {language === "ar" ? "عقود الإيجار (الأساسية)" : "Tenancy Leases"}
        </button>

        <button
          onClick={() => setActiveMainTab("RENEWALS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMainTab === "RENEWALS"
              ? "bg-white text-amber-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>{language === "ar" ? "طلبات التجديد والاعتماد" : "Lease Renewals"}</span>
        </button>

        <button
          onClick={() => setActiveMainTab("DEFERRED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMainTab === "DEFERRED"
              ? "bg-white text-emerald-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>{language === "ar" ? "الدفعات المؤجلة (Deferred)" : "Deferred Payments"}</span>
        </button>
      </div>

      {activeMainTab === "RENEWALS" && (
        <LeaseRenewalsTab
          onOpenRenewModal={() => {
            if (onNavigateToRenewLease && leases.length > 0) {
              onNavigateToRenewLease(leases[0]);
            } else {
              setRenewingLease(null);
              setIsRenewModalOpen(true);
            }
          }}
        />
      )}

      {activeMainTab === "DEFERRED" && <DeferredPaymentsTab />}

      {activeMainTab === "LEASES" && (
        <>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DraggableWrapper formId="LEASES" elementId="filter-search">
          <div className="relative sm:col-span-2">
            <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "بحث برقم العقد، إيجاري، المستأجر، العقار..." : "Search by lease #, Ejari, tenant, property..."}
              className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
            />
          </div>
        </DraggableWrapper>

        <DraggableWrapper formId="LEASES" elementId="filter-status">
          <div>
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة حالات العقود" : "All Lease Statuses" },
                { id: "ACTIVE", label: language === "ar" ? "ACTIVE (عقود سارية)" : "ACTIVE (Active Leases)" },
                { id: "EXPIRING_15", label: language === "ar" ? "تجديد خلال 15 يوم" : "Expiring in 15 Days" },
                { id: "EXPIRING_30", label: language === "ar" ? "تجديد خلال 30 يوم" : "Expiring in 30 Days" },
                { id: "RENEWED", label: language === "ar" ? "RENEWED (عقود مجددة)" : "RENEWED (Renewed)" },
                { id: "EXPIRED", label: language === "ar" ? "EXPIRED (عقود منتهيـة)" : "EXPIRED (Expired)" },
                { id: "TERMINATED", label: language === "ar" ? "TERMINATED (مفسوخة)" : "TERMINATED (Terminated)" },
                { id: "CANCELLED", label: language === "ar" ? "CANCELLED (ملغاة)" : "CANCELLED (Cancelled)" },
              ]}
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              placeholder={language === "ar" ? "حالة العقد..." : "Lease status..."}
              searchPlaceholder={language === "ar" ? "ابحث بالحالة..." : "Search status..."}
            />
          </div>
        </DraggableWrapper>
      </div>

      {/* Leases Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4 text-start">{language === "ar" ? "رقم العقد وإيجاري" : "Lease & Ejari #"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "المستأجر" : "Tenant"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "العقار والوحدة" : "Property / Unit"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "الإيجار والدفعات" : "Annual Rent / Cheques"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "فترة العقد" : "Period"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4 text-end">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLeases.map((lease) => {
                const prop = properties.find((p) => p.id === lease.propertyId);
                const unit = units.find((u) => u.id === lease.unitId);
                const tenant = tenants.find((t) => t.id === lease.tenantId);

                const today = new Date().getTime();
                const end = new Date(lease.endDate).getTime();
                const daysRemaining = Math.ceil((end - today) / (1000 * 3600 * 24));

                let rowBg = "hover:bg-slate-50/70";
                if (daysRemaining <= 0) {
                  rowBg = "bg-rose-50 hover:bg-rose-100";
                } else if (daysRemaining <= 30) {
                  rowBg = "bg-amber-50 hover:bg-amber-100";
                }

                return (
                  <tr key={lease.id} className={`${rowBg} transition-colors`}>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="font-mono text-slate-900">{lease.leaseNumber}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {lease.ejariNumber ? `Ejari: ${lease.ejariNumber}` : "No Ejari registered"}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {tenant ? (
                        <div>
                          <div className="font-bold text-slate-900">
                            {language === "ar" ? tenant.nameAr : tenant.nameEn}
                          </div>
                          <Badge
                            variant={
                              tenant.riskLevel === "HIGH"
                                ? "danger"
                                : tenant.riskLevel === "MEDIUM"
                                ? "warning"
                                : "success"
                            }
                            size="sm"
                            className="mt-0.5"
                          >
                            {tenant.riskLevel} Risk
                          </Badge>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "Property"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">Unit #{unit?.unitNumber}</span>
                        {unit && (
                          <div 
                            className={`w-1.5 h-1.5 rounded-full ${
                              unit.status === "OCCUPIED" ? "bg-emerald-500" : unit.status === "MAINTENANCE" ? "bg-amber-500" : "bg-slate-300"
                            }`}
                            title={unit.status}
                          />
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 font-mono">
                        AED {(lease.annualRent || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {lease.chequesCount || lease.installmentsCount || 1} Cheque(s) ({((lease.paymentFrequency || "ANNUAL").replace(/_/g, " "))})
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div className="text-slate-800">{lease.startDate}</div>
                      <div className="text-slate-400">→ {lease.endDate}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <Badge
                          variant={
                            daysRemaining <= 0
                              ? "danger"
                              : lease.contractStatus === "ACTIVE"
                              ? "success"
                              : lease.contractStatus === "RENEWED"
                              ? "info"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {daysRemaining <= 0 ? "EXPIRED" : lease.contractStatus}
                        </Badge>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${daysRemaining > 0 ? "text-emerald-800 bg-emerald-100" : "text-rose-800 bg-rose-100"}`}>
                          {daysRemaining > 0 ? `${daysRemaining} Days Remaining` : `${Math.abs(daysRemaining)} Days Expired`}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelected360LeaseId(lease.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-colors cursor-pointer"
                          title={language === "ar" ? "الملف الشامل للعقد 360" : "Lease 360 Dossier"}
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-700" />
                          <span>360</span>
                        </button>
                        <button
                          onClick={(e) => handleOpenEdit(lease, e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
                          title={language === "ar" ? "تعديل العقد" : "Edit Contract"}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>{language === "ar" ? "تعديل" : "Edit"}</span>
                        </button>
                        <button
                          onClick={() => handleOpenRenew(lease)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition-colors cursor-pointer"
                          title={language === "ar" ? "تجديد العقد" : "Renew Contract"}
                        >
                          <RotateCw className="w-3.5 h-3.5 text-amber-700" />
                          <span>{language === "ar" ? "تجديد" : "Renew"}</span>
                        </button>
                        <button
                          onClick={() => setSelectedWorkspaceLease(lease)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer"
                          title={language === "ar" ? "مركز المدفوعات" : "Payment Center"}
                        >
                          <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{language === "ar" ? "المدفوعات" : "Payments"}</span>
                        </button>
                        {lease.contractStatus === "ACTIVE" && (
                          <button
                            onClick={() => setTerminatingLease(lease)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer"
                            title={language === "ar" ? "فسخ / إنهاء العقد مبكراً" : "Early Lease Termination"}
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-700" />
                            <span>{language === "ar" ? "فسخ" : "Terminate"}</span>
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(lease, e)}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          title={language === "ar" ? "حذف العقد" : "Delete Contract"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLeases.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs">
            {t("noDataFound")}
          </div>
        )}
      </div>
      </>
      )}

      {/* Comprehensive Add / Edit Lease Modal */}
      <LeaseEditorModal
        isOpen={isAddEditModalOpen || isRenewModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setIsRenewModalOpen(false);
        }}
        editingLease={editingLease || renewingLease}
      />

      {/* Lease Renewal Rule Governance Notice Modal */}
      <LeaseRenewalRuleNoticeModal
        isOpen={!!renewalNoticeLease}
        onClose={() => setRenewalNoticeLease(null)}
        lease={renewalNoticeLease}
        tenantName={tenants.find((t) => t.id === renewalNoticeLease?.tenantId)?.[language === "ar" ? "nameAr" : "nameEn"]}
        propertyName={properties.find((p) => p.id === renewalNoticeLease?.propertyId)?.[language === "ar" ? "nameAr" : "nameEn"]}
        unitNumber={units.find((u) => u.id === renewalNoticeLease?.unitId)?.unitNumber}
      />

      {/* Lease Creation / Edition Pre-Submission Confirmation Modal */}
      <Modal
        isOpen={isConfirmSaveOpen}
        onClose={() => setIsConfirmSaveOpen(false)}
        title={language === "ar" ? "تأكيد صحة بيانات العقد قبل الاعتماد" : "Verify Lease Details"}
        subtitle={language === "ar" ? "يرجى مراجعة بيانات العقد قبل إرساله للاعتماد النهائي" : "Please review details before sending for approval"}
        icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
            <span>
              {language === "ar"
                ? "هل أنت متأكد من أن جميع بيانات العقد صحيحة وطبق الأوراق الرسمية؟"
                : "Are you sure all lease details are accurate and verified against official documents?"}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">{language === "ar" ? "المستأجر:" : "Tenant:"}</span>
              <span className="font-bold text-slate-900">
                {tenants.find((t) => t.id === tenantId)?.[language === "ar" ? "nameAr" : "nameEn"] || tenantId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{language === "ar" ? "العقار والوحدة:" : "Property & Unit:"}</span>
              <span className="font-bold text-slate-900">
                {properties.find((p) => p.id === propertyId)?.[language === "ar" ? "nameAr" : "nameEn"]} • {units.find((u) => u.id === unitId)?.unitNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{language === "ar" ? "الفترة الزمنية:" : "Period:"}</span>
              <span className="font-bold font-mono text-slate-900">
                {startDate} → {endDate}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{language === "ar" ? "قيمة الإيجار السنوي:" : "Annual Rent:"}</span>
              <span className="font-black font-mono text-emerald-700">
                AED {Number(annualRent).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsConfirmSaveOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              {language === "ar" ? "تراجع / تعديل" : "Go Back"}
            </button>
            <button
              type="button"
              onClick={executeSaveLease}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{language === "ar" ? "حفظ وإرسال للاعتماد" : "Save & Submit for Approval"}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {leaseToDelete && (() => {
        const tenant = tenants.find(t => t.id === leaseToDelete.tenantId);
        const prop = properties.find(p => p.id === leaseToDelete.propertyId);
        const unit = units.find(u => u.id === leaseToDelete.unitId);
        const linkedDocs = archive.filter(a => a.recordId === leaseToDelete.id || a.entityId === leaseToDelete.id);
        return (
          <ConfirmDeleteModal
            isOpen={!!leaseToDelete}
            onClose={() => setLeaseToDelete(null)}
            onConfirm={confirmDelete}
            title={language === "ar" ? "حذف عقد الإيجار وحفظه تاريخياً" : "Delete & Move Lease to Historical Archive"}
            itemName={`${leaseToDelete.leaseNumber} (${tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : ""})`}
            itemCode={leaseToDelete.leaseNumber}
            itemType={language === "ar" ? "عقد إيجار" : "Lease Agreement"}
            entityType="LEASE"
            entityId={leaseToDelete.id}
            statusAtDeletion={leaseToDelete.contractStatus}
            attachmentsCount={linkedDocs.length}
            attachments={linkedDocs.map(d => ({
              id: d.id,
              fileName: d.fileName,
              fileUrl: d.previewUrl,
              fileSize: d.fileSize,
              category: d.category,
              driveWebViewLink: d.driveWebViewLink,
            }))}
          />
        );
      })()}

      {/* Lease Early Termination Modal */}
      {terminatingLease && (
        <LeaseTerminationModal
          isOpen={!!terminatingLease}
          onClose={() => setTerminatingLease(null)}
          lease={terminatingLease}
          onSuccess={() => setTerminatingLease(null)}
        />
      )}
    </div>
  );
};
