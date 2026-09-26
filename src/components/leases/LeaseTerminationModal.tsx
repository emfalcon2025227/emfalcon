import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCheck,
  Upload,
  Calendar,
  DollarSign,
  User,
  Building,
  Home,
  Clock,
  ArrowRight,
  Sparkles,
  Zap,
  Info,
  Lock,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Lease, ElectronicArchiveItem } from "../../types";
import {
  validateLeaseTermination,
  LeaseTerminationValidationResult,
} from "../../utils/leaseTerminationValidator";
import { DocumentStorageService } from "../../services/documentStorageService";

interface LeaseTerminationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: Lease | null;
  onTerminatedSuccessfully?: () => void;
  onSuccess?: () => void;
}

export const LeaseTerminationModal: React.FC<LeaseTerminationModalProps> = ({
  isOpen,
  onClose,
  lease,
  onTerminatedSuccessfully,
  onSuccess,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    tenants,
    properties,
    units,
    owners,
    cheques,
    propertyExpenses,
    archive,
    addArchiveItem,
    updateLease,
    updateChequeStatus,
    logAudit,
    addCommissionObligation,
  } = useData();
  const { currentUser, hasPermission } = useAuth();

  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [waiveFee, setWaiveFee] = useState<boolean>(false);
  const [waiverReason, setWaiverReason] = useState<string>("");
  const [terminationNotes, setTerminationNotes] = useState<string>("");

  // Document Upload states
  const [uploadingElectricity, setUploadingElectricity] = useState(false);
  const [uploadingMunicipality, setUploadingMunicipality] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  const tenant = useMemo(() => {
    return tenants.find((t) => t.id === lease?.tenantId);
  }, [tenants, lease?.tenantId]);

  const property = useMemo(() => {
    return properties.find((p) => p.id === lease?.propertyId);
  }, [properties, lease?.propertyId]);

  const unit = useMemo(() => {
    return units.find((u) => u.id === lease?.unitId);
  }, [units, lease?.unitId]);

  const owner = useMemo(() => {
    return owners.find((o) => o.id === lease?.ownerId);
  }, [owners, lease?.ownerId]);

  const canWaiveFee = useMemo(() => {
    return (
      !currentUser ||
      currentUser.role === "SYSTEM_OWNER" ||
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "MANAGER" ||
      hasPermission("EDIT_SAVED_FINANCIAL_RECORDS") ||
      hasPermission("MANAGE_MASTER_DATA")
    );
  }, [currentUser, hasPermission]);

  const validationResult: LeaseTerminationValidationResult | null = useMemo(() => {
    if (!lease) return null;
    return validateLeaseTermination({
      lease,
      effectiveTerminationDate: effectiveDate,
      cheques,
      propertyExpenses,
      archive,
      waiveEarlyTerminationFee: waiveFee,
      isAuthorizedToWaive: canWaiveFee,
      waiverReason,
    });
  }, [
    lease,
    effectiveDate,
    cheques,
    propertyExpenses,
    archive,
    waiveFee,
    canWaiveFee,
    waiverReason,
  ]);

  if (!isOpen || !lease || !validationResult) return null;

  // File Upload Handlers for Clearances
  const handleClearanceUpload = async (
    type: "ELECTRICITY" | "MUNICIPALITY",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isElectricity = type === "ELECTRICITY";
    if (isElectricity) setUploadingElectricity(true);
    else setUploadingMunicipality(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const category = "OTHER";
        const docTitle = isElectricity
          ? `براءة ذمة الكهرباء والمياه - عقد ${lease.leaseNumber}`
          : `براءة ذمة البلدية وإلغاء إيجاري - عقد ${lease.leaseNumber}`;
        const docTypeTag = isElectricity ? "ELECTRICITY_CLEARANCE" : "MUNICIPALITY_CLEARANCE";

        const archiveItem: ElectronicArchiveItem = {
          id: `arch-clr-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
          recordId: lease.id,
          recordTitle: docTitle,
          category,
          entityId: lease.id,
          entityType: "LEASE",
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileHash: `hash-${Date.now()}`,
          isPrivate: false,
          storagePath: `clearances/${lease.id}/${file.name}`,
          downloadToken: `tok-${Date.now()}`,
          tags: ["CLEARANCE", docTypeTag, lease.id, lease.leaseNumber, lease.tenantId],
          previewUrl: base64,
          uploadedByName: currentUser?.nameAr || currentUser?.nameEn || "المستخدم",
          uploadedByUserId: currentUser?.id,
          uploadDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        addArchiveItem(archiveItem);
        DocumentStorageService.setCachedDataUrl(archiveItem.id, base64);
        if (isElectricity) setUploadingElectricity(false);
        else setUploadingMunicipality(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      if (isElectricity) setUploadingElectricity(false);
      else setUploadingMunicipality(false);
    }
  };

  // Execution Handler (Single Atomic Execution Guard)
  const handleExecuteTermination = async () => {
    if (isSubmitting) return; // Prevent double click / concurrency
    setSubmissionError("");

    if (!validationResult.isEligibleForTermination) {
      setSubmissionError(
        isAr
          ? "لا يمكن إنهاء العقد لوجود موانع نظامية أو التزامات مالية قائمة."
          : "Cannot terminate lease due to existing blocking reasons or unpaid obligations."
      );
      return;
    }

    if (validationResult.isEarlyTermination && waiveFee && !waiverReason.trim()) {
      setSubmissionError(
        isAr ? "يرجى توضيح سبب إعفاء غرامة الفسخ المبكر (30%)." : "Please specify a waiver reason."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const nowIso = new Date().toISOString();
      const termDate = new Date(effectiveDate);

      // 1. Cancel remaining post-dated cheques after termination date
      const leaseCheques = cheques.filter((c) => c.leaseId === lease.id);
      const remainingCheques = leaseCheques.filter((c) => {
        const cDate = new Date(c.dueDate || c.chequeDate);
        return (
          cDate > termDate &&
          c.status !== "COLLECTED" &&
          c.status !== "CANCELLED" &&
          c.status !== "REPLACED" &&
          c.status !== "BOUNCED"
        );
      });

      for (const chq of remainingCheques) {
        updateChequeStatus(
          chq.id,
          "CANCELLED",
          `إلغاء الشيك بسبب فسخ العقد #${lease.leaseNumber} بتاريخ ${effectiveDate}`
        );
      }

      // 2. If Early Termination Fee applies and not waived, record as Owner entitlement / receivable
      if (
        validationResult.isEarlyTermination &&
        validationResult.appliedEarlyTerminationFee > 0 &&
        !validationResult.isFeeWaived
      ) {
        // Record as commission/receivable obligation to owner
        addCommissionObligation({
          leaseId: lease.id,
          partyType: "TENANT",
          tenantId: lease.tenantId,
          ownerId: lease.ownerId,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          commissionType: "OTHER_REVENUE",
          baseAmount: validationResult.remainingFutureContractValue,
          totalCommissionAmount: validationResult.appliedEarlyTerminationFee,
          vatAmount: 0, // STRICT RULE: No VAT on early termination penalty
          netRevenueAmount: validationResult.appliedEarlyTerminationFee,
          calculationBasis: "FIXED_AMOUNT",
          dueDate: effectiveDate,
          notes: `غرامة فسخ مبكر 30% لعقد #${lease.leaseNumber} (القيمة المتبقية: AED ${validationResult.remainingFutureContractValue.toLocaleString()})`,
        });
      }

      // 3. Update lease contract status to TERMINATED
      updateLease(lease.id, {
        contractStatus: "TERMINATED",
      });

      // 4. Log Exhaustive Audit Trail
      logAudit(
        "STATUS_CHANGE",
        "LEASE",
        lease.id,
        lease.leaseNumber,
        `تم فسخ العقد #${lease.leaseNumber} بتاريخ ${effectiveDate}. نوع الإنهاء: ${
          validationResult.isEarlyTermination ? "فسخ مبكر (Early Termination)" : "انتهاء طبيعي (Natural Expiry)"
        }. القيمة المتبقية: AED ${validationResult.remainingFutureContractValue}. غرامة الفسخ (30%): AED ${
          validationResult.appliedEarlyTerminationFee
        } (${validationResult.isFeeWaived ? `معفاة: ${waiverReason}` : "مطبقة"}). الملاحظات: ${terminationNotes || "لا يوجد"}`,
        JSON.stringify({
          contractStatus: lease.contractStatus,
          endDate: lease.endDate,
        }),
        JSON.stringify({
          contractStatus: "TERMINATED",
          effectiveTerminationDate: effectiveDate,
          isEarlyTermination: validationResult.isEarlyTermination,
          remainingFutureContractValue: validationResult.remainingFutureContractValue,
          appliedEarlyTerminationFee: validationResult.appliedEarlyTerminationFee,
          isFeeWaived: validationResult.isFeeWaived,
          waiverReason: validationResult.waiverReason,
          electricityClearanceDocId: validationResult.electricityClearanceItem?.id,
          municipalityClearanceDocId: validationResult.municipalityClearanceItem?.id,
        })
      );

      setIsSubmitting(false);
      onClose();
      if (onTerminatedSuccessfully) {
        onTerminatedSuccessfully();
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setSubmissionError(err.message || "Failed to terminate lease");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? "إجراءات وحوكمة إنهاء وفسخ عقد الإيجار" : "Lease Termination & Governance"}
      size="2xl"
    >
      <div className="space-y-6">
        {/* Header Summary Banner */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-mono font-bold text-lg">
                  {lease.leaseNumber}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {lease.contractStatus}
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  {isAr ? tenant?.nameAr || tenant?.nameEn : tenant?.nameEn || tenant?.nameAr}
                </span>
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-emerald-400" />
                  {isAr ? property?.nameAr || property?.nameEn : property?.nameEn || property?.nameAr}
                </span>
                <span className="flex items-center gap-1">
                  <Home className="w-3.5 h-3.5 text-blue-400" />
                  {isAr ? `الوحدة ${unit?.unitNumber || "-"}` : `Unit ${unit?.unitNumber || "-"}`}
                </span>
              </div>
            </div>

            <div className="text-end">
              <div className="text-xs text-slate-400">{isAr ? "نهاية العقد المجدولة" : "Scheduled End Date"}</div>
              <div className="text-sm font-mono font-bold text-white">{lease.endDate}</div>
            </div>
          </div>
        </div>

        {/* Input Parameters: Effective Termination Date */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isAr ? "تاريخ سريان الفسخ / الإخلاء الفعلي *" : "Effective Termination Date *"}
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isAr ? "نوع الإنهاء المحتسب" : "Termination Classification"}
              </label>
              <div
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-between border ${
                  validationResult.isEarlyTermination
                    ? "bg-amber-50 text-amber-900 border-amber-200"
                    : "bg-emerald-50 text-emerald-900 border-emerald-200"
                }`}
              >
                <span>
                  {validationResult.isEarlyTermination
                    ? isAr
                      ? "فسخ مبكر (Early Termination)"
                      : "Early Termination"
                    : isAr
                    ? "انتهاء طبيعي (Natural Expiry)"
                    : "Natural Expiry"}
                </span>
                <span className="font-mono text-[11px]">
                  {validationResult.isEarlyTermination
                    ? `${validationResult.daysRemainingInContract} ${isAr ? "يوم متبقي" : "days left"}`
                    : isAr
                    ? "مكتمل المدة"
                    : "Full Term"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Early Termination Fee Breakdown (30% LOCKED RULE) */}
        {validationResult.isEarlyTermination && (
          <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                {isAr ? "احتساب غرامة الفسخ المبكر المعتمدة (30%)" : "Early Termination Fee (30%)"}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-200/60 text-indigo-900 font-bold">
                {isAr ? "نسبة ثابتة 30% بدون ضريبة" : "Locked 30% No VAT"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                <div className="text-slate-500 text-[11px]">{isAr ? "القيمة المتبقية من العقد" : "Remaining Future Rent"}</div>
                <div className="text-sm font-mono font-bold text-slate-800 mt-0.5">
                  AED {validationResult.remainingFutureContractValue.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                <div className="text-slate-500 text-[11px]">{isAr ? "النسبة النظامية" : "Fee Rate"}</div>
                <div className="text-sm font-mono font-bold text-indigo-600 mt-0.5">30.00%</div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                <div className="text-slate-500 text-[11px]">{isAr ? "قيمة الغرامة المستحقة" : "Calculated Fee"}</div>
                <div className="text-sm font-mono font-black text-rose-600 mt-0.5">
                  AED {validationResult.calculatedEarlyTerminationFee.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Waiver Option */}
            <div className="pt-2 border-t border-indigo-100/80">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waiveFee}
                    onChange={(e) => setWaiveFee(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    {isAr ? "إعفاء المستأجر من غرامة الفسخ المبكر (Waiver)" : "Waive Early Termination Fee"}
                  </span>
                </label>

                {!canWaiveFee && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {isAr ? "تتطلب صلاحية إدارة" : "Admin Only"}
                  </span>
                )}
              </div>

              {waiveFee && (
                <div className="mt-2.5 space-y-1">
                  <input
                    type="text"
                    required
                    placeholder={isAr ? "سبب الإعفاء الإلزامي للمراجعة والتدقيق..." : "Mandatory waiver reason for audit..."}
                    value={waiverReason}
                    onChange={(e) => setWaiverReason(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clearance Documents Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              {isAr ? "براءات الذمة والمستندات الإلزامية للفسخ" : "Mandatory Clearance Certificates"}
            </h4>
            <span className="text-[10px] text-slate-500">{isAr ? "وثيقتان إلزاميتان" : "2 Mandatory Docs"}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Electricity Clearance */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-between ${
                validationResult.electricityClearanceAttached
                  ? "bg-emerald-50/50 border-emerald-200"
                  : "bg-rose-50/50 border-rose-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {isAr ? "1. براءة ذمة الكهرباء والمياه" : "1. Electricity & Water Clearance"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {validationResult.electricityClearanceAttached
                      ? validationResult.electricityClearanceItem?.fileName || (isAr ? "مرفقة ومحققة" : "Attached")
                      : isAr
                      ? "مفقودة — غير مرفقة بالأرشيف"
                      : "Missing — Not found in archive"}
                  </div>
                </div>

                {validationResult.electricityClearanceAttached ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                )}
              </div>

              {!validationResult.electricityClearanceAttached && (
                <label className="w-full mt-1 py-1.5 px-3 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingElectricity ? (isAr ? "جارٍ الرفع..." : "Uploading...") : isAr ? "رفع الشهادة الآن" : "Upload Certificate"}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handleClearanceUpload("ELECTRICITY", e)}
                  />
                </label>
              )}
            </div>

            {/* 2. Municipality Clearance */}
            <div
              className={`p-3 rounded-xl border flex flex-col justify-between ${
                validationResult.municipalityClearanceAttached
                  ? "bg-emerald-50/50 border-emerald-200"
                  : "bg-rose-50/50 border-rose-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {isAr ? "2. براءة ذمة البلدية / إيجاري" : "2. Municipality / Ejari Clearance"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {validationResult.municipalityClearanceAttached
                      ? validationResult.municipalityClearanceItem?.fileName || (isAr ? "مرفقة ومحققة" : "Attached")
                      : isAr
                      ? "مفقودة — غير مرفقة بالأرشيف"
                      : "Missing — Not found in archive"}
                  </div>
                </div>

                {validationResult.municipalityClearanceAttached ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                )}
              </div>

              {!validationResult.municipalityClearanceAttached && (
                <label className="w-full mt-1 py-1.5 px-3 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingMunicipality ? (isAr ? "جارٍ الرفع..." : "Uploading...") : isAr ? "رفع الشهادة الآن" : "Upload Certificate"}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handleClearanceUpload("MUNICIPALITY", e)}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Outstanding Obligations / Blocking Reasons List */}
        {validationResult.outstandingObligations.length > 0 && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-rose-900">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                {isAr ? "التزامات مالية قائمة مرتبطة بالعقد (تمنع الفسخ)" : "Outstanding Financial Obligations (Blocking)"}
              </span>
              <span className="font-mono">
                AED {validationResult.totalOutstandingObligations.toLocaleString()}
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {validationResult.outstandingObligations.map((item) => (
                <div
                  key={item.id}
                  className="p-2 bg-white rounded-lg border border-rose-200 text-xs flex items-center justify-between shadow-2xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{isAr ? item.titleAr : item.titleEn}</div>
                    <div className="text-[11px] text-slate-500">{item.details}</div>
                  </div>
                  <div className="font-mono font-bold text-rose-700 whitespace-nowrap">
                    AED {item.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final Validation Outcome Preview */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            validationResult.isEligibleForTermination
              ? "bg-emerald-50 border-emerald-300 text-emerald-950"
              : "bg-rose-50 border-rose-300 text-rose-950"
          }`}
        >
          <div className="flex items-center gap-3">
            {validationResult.isEligibleForTermination ? (
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="text-xs font-black uppercase tracking-wider">
                {validationResult.isEligibleForTermination
                  ? isAr
                    ? "جاهز للفسخ النظامي (READY FOR TERMINATION)"
                    : "READY FOR TERMINATION"
                  : isAr
                  ? "الفسخ محظور نظامياً (TERMINATION BLOCKED)"
                  : "TERMINATION BLOCKED"}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {validationResult.isEligibleForTermination
                  ? isAr
                    ? "تم استيفاء جميع براءات الذمة ولا توجد التزامات مالية مانعة للفسخ."
                    : "All clearances and obligations satisfied."
                  : isAr
                  ? `${validationResult.blockReasonsAr.length} أسباب تمنع إتمام الفسخ حالياً.`
                  : `${validationResult.blockReasonsEn.length} blocking issues require resolution.`}
              </div>
            </div>
          </div>

          <div className="text-end">
            <span
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${
                validationResult.isEligibleForTermination
                  ? "bg-emerald-200/80 text-emerald-900"
                  : "bg-rose-200/80 text-rose-900"
              }`}
            >
              {validationResult.isEligibleForTermination ? (isAr ? "مؤهل للفسخ" : "APPROVED") : isAr ? "محظور" : "BLOCKED"}
            </span>
          </div>
        </div>

        {/* Blocking Reasons Details */}
        {!validationResult.isEligibleForTermination && (
          <ul className="list-disc list-inside space-y-1 text-xs text-rose-700 bg-rose-50/70 p-3 rounded-lg border border-rose-200">
            {(isAr ? validationResult.blockReasonsAr : validationResult.blockReasonsEn).map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        )}

        {/* Termination Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isAr ? "ملاحظات وتفاصيل الفسخ الإدارية" : "Administrative Termination Notes"}
          </label>
          <textarea
            rows={2}
            value={terminationNotes}
            onChange={(e) => setTerminationNotes(e.target.value)}
            placeholder={isAr ? "أدخل أي ملاحظات إدارية حول حالة الوحدة أو التسوية..." : "Enter termination notes..."}
            className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
          />
        </div>

        {submissionError && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-700 text-xs font-bold">
            {submissionError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            {isAr ? "إلغاء وتراجع" : "Cancel"}
          </button>

          <button
            type="button"
            disabled={!validationResult.isEligibleForTermination || isSubmitting}
            onClick={handleExecuteTermination}
            className={`px-5 py-2 text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              validationResult.isEligibleForTermination && !isSubmitting
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 hover:scale-[1.02]"
                : "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>
              {isSubmitting
                ? isAr
                  ? "جارٍ التنفيذ والفسخ..."
                  : "Executing..."
                : isAr
                ? "اعتماد فسخ العقد نهائياً"
                : "Confirm & Finalize Termination"}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
