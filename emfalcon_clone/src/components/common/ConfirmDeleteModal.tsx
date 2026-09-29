import React, { useState } from "react";
import {
  AlertTriangle,
  Trash2,
  X,
  Archive,
  FileText,
  CheckCircle2,
  ShieldCheck,
  FolderArchive,
  ShieldAlert,
  Lock,
  Scale,
  CreditCard,
  Building2,
  Home,
  ChevronDown,
  ChevronUp,
  Info,
  DollarSign,
  AlertOctagon,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { Badge } from "./Badge";
import { useData } from "../../context/DataContext";
import {
  DeleteIntegrityCheckResult,
  EntityIntegrityType,
  IntegrityBlockerCategory,
} from "../../utils/integrityChecker";

export interface AttachmentItemSummary {
  id: string;
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  category?: string;
  driveWebViewLink?: string;
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options?: { keepAttachments?: boolean; reason?: string }) => void;
  title?: string;
  itemName: string;
  itemCode?: string;
  itemType?: string;
  entityType?: EntityIntegrityType;
  entityId?: string;
  integrityResult?: DeleteIntegrityCheckResult;
  statusAtDeletion?: string;
  warningMessage?: string;
  linkedItemsCount?: number;
  linkedItemsLabel?: string;
  attachmentsCount?: number;
  attachments?: AttachmentItemSummary[];
  isLoading?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemCode,
  itemType,
  entityType,
  entityId,
  integrityResult: propIntegrityResult,
  statusAtDeletion,
  warningMessage,
  linkedItemsCount,
  linkedItemsLabel,
  attachmentsCount = 0,
  attachments = [],
  isLoading = false,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { checkDeleteIntegrity } = useData();

  // Attachment retention decision: default is TRUE (keep attachments in archive)
  const [keepAttachments, setKeepAttachments] = useState<boolean>(true);
  const [deletionReason, setDeletionReason] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  // Compute integrity check if not explicitly provided
  let integrity: DeleteIntegrityCheckResult | undefined = propIntegrityResult;
  if (!integrity && entityType && entityId && checkDeleteIntegrity) {
    integrity = checkDeleteIntegrity(entityType, entityId);
  }

  const isBlocked = integrity ? !integrity.canDelete : false;
  const totalAttachments = Math.max(attachmentsCount, attachments.length);
  const hasAttachments = totalAttachments > 0;

  const toggleCategoryExpand = (key: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleConfirmClick = () => {
    if (isBlocked) return;
    onConfirm({
      keepAttachments: hasAttachments ? keepAttachments : true,
      reason: deletionReason.trim() || undefined,
    });
  };

  const renderIcon = (iconType: IntegrityBlockerCategory["iconType"]) => {
    switch (iconType) {
      case "lease":
        return <FileText className="w-4 h-4 text-rose-600" />;
      case "cheque":
        return <CreditCard className="w-4 h-4 text-rose-600" />;
      case "case":
        return <Scale className="w-4 h-4 text-rose-600" />;
      case "unit":
        return <Home className="w-4 h-4 text-rose-600" />;
      case "property":
        return <Building2 className="w-4 h-4 text-rose-600" />;
      case "money":
        return <DollarSign className="w-4 h-4 text-rose-600" />;
      default:
        return <AlertOctagon className="w-4 h-4 text-rose-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 fade-in duration-150 p-6 space-y-4 max-h-[96vh] overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isBlocked
                ? "bg-rose-50 border-rose-200 text-rose-700 ring-4 ring-rose-500/10"
                : "bg-amber-50 border-amber-100 text-amber-700"
            }`}
          >
            {isBlocked ? <ShieldAlert className="w-6 h-6 animate-pulse" /> : <Archive className="w-6 h-6" />}
          </div>

          <div className="flex-1">
            <h3
              className={`text-base font-black leading-snug ${
                isBlocked ? "text-rose-950" : "text-slate-900"
              }`}
            >
              {isBlocked
                ? isAr
                  ? "لا يمكن حذف السجل - توجد معوقات والتزامات نشطة"
                  : "Deletion Blocked - Active Obligations Found"
                : title || (isAr ? "حذف ونقل إلى السجلات التاريخية" : "Delete & Move to Historical Archive")}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {isBlocked
                ? isAr
                  ? "يمنع النظام حذف هذا السجل حرصاً على سلامة وتكامل البيانات والالتزامات المالية والتعاقدية. يرجى معالجة الموانع الموضحة أدناه أولاً."
                  : "Deletion is blocked to maintain referential data integrity and financial accountability. Please resolve the active dependencies below."
                : isAr
                ? "سيتم إزالة السجل من القوائم النشطة مع الاحتفاظ بحالته وكامل بياناته ومرفقاته بصورة دائمة في السجلات التاريخية والأرشيف."
                : "The record will be removed from active views while permanently preserving its snapshot in the historical archive."}
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Item Summary Card */}
        <div
          className={`p-3.5 rounded-2xl border space-y-2 ${
            isBlocked
              ? "bg-rose-50/40 border-rose-200/80"
              : "bg-slate-50 border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              {itemType && (
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  {itemType}
                </span>
              )}
              <span className="text-sm font-bold text-slate-900 block mt-0.5">{itemName}</span>
            </div>
            {itemCode && (
              <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0 shadow-2xs">
                {itemCode}
              </span>
            )}
          </div>

          {statusAtDeletion && (
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                {isAr ? "الحالة المحفوظة بالسجل التاريخي:" : "Historical Retained Status:"}
              </span>
              <Badge variant="neutral" size="sm">
                <ShieldCheck className="w-3 h-3 me-1 text-emerald-600" />
                <span className="font-bold">{statusAtDeletion}</span>
              </Badge>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* CASE 1: DELETION IS BLOCKED (موانع تكامل البيانات النشطة) */}
        {/* ========================================================= */}
        {isBlocked && integrity && (
          <div className="space-y-3 pt-1">
            {/* Blocker Banner */}
            <div className="p-3.5 bg-rose-600 text-white rounded-2xl shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-200 shrink-0" />
                <span className="text-xs font-bold">
                  {isAr
                    ? `توجد (${integrity.blockers.length}) موانع رئيسية و (${integrity.totalBlockersCount}) سجلات مرتبطة نشطة`
                    : `(${integrity.blockers.length}) Blocking Constraints & (${integrity.totalBlockersCount}) Active Records`}
                </span>
              </div>
              <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
                {isAr ? "حذف محظور" : "BLOCKED"}
              </span>
            </div>

            {/* List of Blocker Categories */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pe-1">
              {integrity.blockers.map((cat) => {
                const isExpanded = expandedCategories[cat.key] ?? true;
                return (
                  <div
                    key={cat.key}
                    className="border border-rose-200 bg-rose-50/50 rounded-2xl p-3.5 space-y-2 transition-all"
                  >
                    {/* Category Title Header */}
                    <div
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleCategoryExpand(cat.key)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                          {renderIcon(cat.iconType)}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-rose-950">
                            {isAr ? cat.titleAr : cat.titleEn}
                          </h4>
                          <p className="text-[11px] text-rose-800/90 mt-0.5">
                            {isAr ? cat.descriptionAr : cat.descriptionEn}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {cat.totalAmount !== undefined && cat.totalAmount > 0 && (
                          <span className="text-[11px] font-bold font-mono px-2 py-0.5 bg-rose-200/80 text-rose-950 rounded-lg">
                            {cat.totalAmount.toLocaleString()} {isAr ? "د.إ" : "AED"}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-700 text-white rounded-full">
                          {cat.count}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-rose-700" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-rose-700" />
                        )}
                      </div>
                    </div>

                    {/* Expandable Items List */}
                    {isExpanded && (
                      <div className="pt-2 space-y-1.5 border-t border-rose-200/60">
                        <div className="text-[10px] font-bold text-rose-900 mb-1 flex items-center gap-1">
                          <Info className="w-3 h-3 text-rose-700" />
                          <span>{isAr ? "تفاصيل السجلات المانعة للحذف:" : "Blocking items detail:"}</span>
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {cat.items.map((item, idx) => (
                            <div
                              key={`${item.id}-${idx}`}
                              className="p-2 bg-white/90 rounded-xl border border-rose-200/80 flex items-center justify-between text-xs gap-2"
                            >
                              <div className="truncate flex-1">
                                <span className="font-bold text-slate-900 block truncate">
                                  {item.title}
                                </span>
                                {item.subtitle && (
                                  <span className="text-[10px] text-slate-500 block truncate">
                                    {item.subtitle}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0 text-end">
                                {item.amount !== undefined && item.amount > 0 && (
                                  <span className="text-xs font-mono font-bold text-rose-900">
                                    {item.amount.toLocaleString()} {isAr ? "د.إ" : "AED"}
                                  </span>
                                )}
                                {item.statusBadge && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-md border border-rose-200">
                                    {item.statusBadge}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Resolution Guidance Box */}
                        <div className="mt-2 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-[11px] text-amber-950 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-amber-900">
                              {isAr ? "طريقة فك الارتباط والمعالجة:" : "How to Resolve:"}
                            </span>
                            <span>{isAr ? cat.resolutionGuidanceAr : cat.resolutionGuidanceEn}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CASE 2: RECORD IS CLEAN & CAN BE DELETED SAFELY */}
        {/* ========================================================= */}
        {!isBlocked && (
          <>
            {/* Integrity Verified Badge */}
            {integrity?.canDelete && (
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-[11px]">
                  {isAr
                    ? "تم التحقق من تكامل البيانات: السجل خالٍ من أي التزامات أو عقود نشطة تعيقه وجاهز للأرشفة التاريخية بأمان."
                    : "Integrity Verified: No active obligations found. Safe to archive and delete."}
                </span>
              </div>
            )}

            {/* Permanent Historical Retention Notice */}
            <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed text-[11px]">
                <span className="font-bold block mb-0.5 text-blue-950">
                  {isAr ? "الأرشفة التاريخية الإلزامية:" : "Permanent Historical Record Protection:"}
                </span>
                {isAr
                  ? "لا يتم مسح السجلات نهائياً؛ بل يتم حفظ نسخة طبق الأصل مع تاريخ وحالة السجل في (سجل التدقيق والأرشيف التاريخي) لحماية البيانات وتدقيق العمليات المالية والتعاقدية."
                  : "Records are never destroyed; an exact snapshot with historical status is preserved in the Historical & Audit Registry for compliance."}
              </div>
            </div>

            {/* Linked Items Warning Box (if any non-blocking notice) */}
            {linkedItemsCount !== undefined && linkedItemsCount > 0 && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>{isAr ? "تنبيه السجلات المرتبطة:" : "Linked Records Notice:"}</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {warningMessage ||
                    (isAr
                      ? `هذا السجل مرتبط بـ (${linkedItemsCount}) ${linkedItemsLabel || "عناصر أخرى"}. سيتم تحرير الارتباط وحفظ الأثر التاريخي.`
                      : `This record is associated with (${linkedItemsCount}) ${linkedItemsLabel || "other records"}.`)}
                </p>
              </div>
            )}

            {/* Attachment Retention Option */}
            {hasAttachments ? (
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderArchive className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold text-amber-950">
                      {isAr ? "المرفقات والملفات المرتبطة:" : "Linked Documents & Attachments:"}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-200/70 text-amber-900 font-mono font-bold text-[10px] rounded-full">
                    {totalAttachments} {isAr ? "مرفق" : "files"}
                  </span>
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto ps-1 pe-1">
                    {attachments.map((att, idx) => (
                      <div
                        key={`${att.id || idx}-${idx}`}
                        className="flex items-center justify-between text-[11px] bg-white/80 p-2 rounded-xl border border-amber-200/60"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{att.fileName}</span>
                        </div>
                        {att.fileSize ? (
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {(att.fileSize / 1024).toFixed(1)} KB
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 pt-1 border-t border-amber-200/60">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs p-2 rounded-xl hover:bg-amber-100/50 transition-colors">
                    <input
                      type="radio"
                      name="attachment_choice"
                      checked={keepAttachments === true}
                      onChange={() => setKeepAttachments(true)}
                      className="mt-0.5 text-amber-700 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {isAr
                          ? "الاحتفاظ بالمرفقات في الأرشيف الإلكتروني والسجلات التاريخية (موصى به)"
                          : "Keep all attachments in the Electronic Archive & Historical Log (Recommended)"}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5 leading-relaxed">
                        {isAr
                          ? "تبقى الملفات وصور الشيكات ومستندات القضايا محفوظة ومتاحة للعرض والتحميل في أي وقت."
                          : "Scans and documents remain preserved and viewable in the Electronic Archive at all times."}
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs p-2 rounded-xl hover:bg-amber-100/50 transition-colors">
                    <input
                      type="radio"
                      name="attachment_choice"
                      checked={keepAttachments === false}
                      onChange={() => setKeepAttachments(false)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="font-bold text-rose-700 block">
                        {isAr
                          ? "حذف المرفقات والملفات المرتبطة مع هذا السجل"
                          : "Delete associated attachments as well"}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5 leading-relaxed">
                        {isAr
                          ? "سيتم إزالة الملفات المرفقة من الأرشيف الإلكتروني مع الإبقاء على بيانات السجل النصية."
                          : "Will delete linked file scans from the archive while keeping metadata snapshot."}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            ) : null}

            {/* Optional Deletion / Archive Reason */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">
                {isAr ? "سبب الحذف / الأرشفة (اختياري لتوثيق السجل):" : "Deletion / Archiving Reason (Optional):"}
              </label>
              <input
                type="text"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder={
                  isAr
                    ? "مثال: انتهاء العقد بالتراضي، تصحيح إدخال مكرر، تسوية ودية..."
                    : "e.g., Mutual contract termination, duplicate correction..."
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
              />
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              isBlocked
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "text-slate-700 bg-slate-100 hover:bg-slate-200"
            }`}
          >
            {isBlocked ? (isAr ? "إغلاق والتراجع" : "Close & Dismiss") : isAr ? "إلغاء" : "Cancel"}
          </button>

          {isBlocked ? (
            <button
              type="button"
              disabled={true}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-100/80 border border-rose-200 cursor-not-allowed select-none"
            >
              <Lock className="w-4 h-4 text-rose-500" />
              <span>{isAr ? "الحذف محظور لوجود معوقات" : "Deletion Blocked"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>
                {isLoading
                  ? isAr
                    ? "جاري الحفظ والأرشفة..."
                    : "Archiving..."
                  : isAr
                  ? "تأكيد الحذف والأرشفة"
                  : "Confirm Delete & Archive"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
