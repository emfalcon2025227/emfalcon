import React, { useState } from "react";
import {
  Plus,
  Search,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Scale,
  Receipt,
  MessageSquare,
  Sparkles,
  Filter,
  CheckSquare,
  Square,
  ArrowUpDown,
  Calendar,
  Building,
  Check,
  X,
  Upload,
  Image as ImageIcon,
  Cloud,
  ExternalLink,
  Edit3,
  Trash2,
  Mail,
  Lock,
  Undo2,
  Printer,
  ArrowRightLeft,
  Ban,
  History,
  Clock,
  Eye,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { Cheque, ChequeStatus, ReturnReason } from "../../types";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import { Modal } from "../common/Modal";
import { AddChequeModal } from "./AddChequeModal";
import { ReplaceChequeModal } from "./ReplaceChequeModal";
import { LegalNoticeGeneratorModal } from "../common/LegalNoticeGeneratorModal";
import { ChequeImageUploadModal } from "../archive/ChequeImageUploadModal";
import { ReceiptVoucherModal } from "../collections/ReceiptVoucherModal";
import { CollectionsView } from "../collections/CollectionsView";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { Tenant } from "../../types";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import {
  isBouncedWithoutLegalAction,
  isChequeInActiveCase,
  getChequeOutstanding,
} from "../../utils/chequeUtils";

interface ChequesViewProps {
  bouncedOnly?: boolean;
  onOpenCollectionModal?: (cheque: Cheque) => void;
  onOpenConvertToCaseModal?: (chequeIds: string[]) => void;
}

export const ChequesView: React.FC<ChequesViewProps> = ({
  bouncedOnly = false,
  onOpenCollectionModal,
  onOpenConvertToCaseModal,
}) => {
  const { t, language } = useLanguage();
  const { navigateTo, canGoBack } = useNavigation();
  const {
    cheques,
    cases,
    tenants,
    properties,
    units,
    owners,
    collections,
    updateChequeStatus,
    bulkUpdateCheques,
    dispatchWhatsAppReminder,
    dispatchEmailReminder,
    deleteCheque,
  } = useData();
  const { currentUser, hasPermission } = useAuth();
  
  const isManager = currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER";
  const canDelete = hasPermission("DELETE_RECORDS") && hasPermission("EDIT_SAVED_FINANCIAL_RECORDS");

  const [chequeToDelete, setChequeToDelete] = useState<Cheque | null>(null);

  const handleDelete = (cheque: Cheque, e: React.MouseEvent) => {
    e.stopPropagation();
    setChequeToDelete(cheque);
  };

  const confirmDeleteCheque = (options?: { keepAttachments?: boolean; reason?: string }) => {
    if (chequeToDelete) {
      deleteCheque(chequeToDelete.id, options);
      setChequeToDelete(null);
    }
  };

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(bouncedOnly ? "BOUNCED" : "ALL");
  const [reasonFilter, setReasonFilter] = useState<string>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [selectedChequeIds, setSelectedChequeIds] = useState<string[]>([]);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCollectionsModalOpen, setIsCollectionsModalOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [autoTriggerScan, setAutoTriggerScan] = useState(false);
  const [replacingCheque, setReplacingCheque] = useState<Cheque | null>(null);
  const [selectedChequeForScan, setSelectedChequeForScan] = useState<Cheque | null>(null);
  const [statusChangeCheque, setStatusChangeCheque] = useState<Cheque | null>(null);
  const [newStatus, setNewStatus] = useState<ChequeStatus>("BOUNCED");
  const [newReturnReason, setNewReturnReason] = useState<ReturnReason | "">("");
  const [selectedReceiptForReprint, setSelectedReceiptForReprint] = useState<any>(null);
  const [viewingAuditCheque, setViewingAuditCheque] = useState<Cheque | null>(null);
  const [viewingProof, setViewingProof] = useState<{ title: string; url: string; fileName?: string } | null>(null);

  // AI Legal Notice Modal State
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState(false);
  const [legalNoticeCheques, setLegalNoticeCheques] = useState<Cheque[]>([]);
  const [legalNoticeTenant, setLegalNoticeTenant] = useState<Tenant | null>(null);
  const [legalNoticeType, setLegalNoticeType] = useState<any>("EVICTION_NOTICE_30_DAYS");

  // Notifications feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const filteredCheques = cheques.filter((c) => {
    // If viewing Bounced Cheques screen, ONLY show bounced cheques that:
    // 1. Have NOT been collected or were partially collected (outstanding > 0)
    // 2. Are NOT converted/linked to legal cases
    // 3. Are NOT fully collected (outstanding <= 0 or status COLLECTED)
    if (bouncedOnly) {
      if (!isBouncedWithoutLegalAction(c, cases)) return false;
    }

    const tenant = tenants.find((t) => t.id === c.tenantId);
    const prop = properties.find((p) => p.id === c.propertyId);

    const matchTerm =
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          c.chequeNumber,
          c.bankName,
          c.accountNumber,
          c.returnReason,
          c.notes,
          c.amount,
          tenant?.nameAr,
          tenant?.nameEn,
          tenant?.code,
          tenant?.phone,
          prop?.nameAr,
          prop?.nameEn,
          prop?.code,
        ],
        searchTerm
      );

    let matchStatus = true;
    if (bouncedOnly) {
      if (statusFilter === "PARTIAL") {
        matchStatus = (Number(c.totalApplied) || 0) > 0 && getChequeOutstanding(c) > 0;
      } else if (statusFilter === "UNCOLLECTED") {
        matchStatus = (Number(c.totalApplied) || 0) === 0;
      }
    } else {
      if (statusFilter === "BOUNCED_PENDING_RECOVERY" || statusFilter === "BOUNCED") {
        matchStatus = isBouncedWithoutLegalAction(c, cases);
      } else if (statusFilter === "UNDER_LEGAL") {
        matchStatus = isChequeInActiveCase(c, cases);
      } else if (statusFilter === "COLLECTED") {
        matchStatus = c.status === "COLLECTED" || getChequeOutstanding(c) <= 0;
      } else if (statusFilter !== "ALL") {
        matchStatus = c.status === statusFilter;
      }
    }
    const matchReason = reasonFilter === "ALL" || c.returnReason === reasonFilter;
    const matchProp = propertyFilter === "ALL" || c.propertyId === propertyFilter;

    return matchTerm && matchStatus && matchReason && matchProp;
  });

  const totalAmount = filteredCheques.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalOutstanding = filteredCheques.reduce((sum, c) => sum + getChequeOutstanding(c), 0);
  const isAllSelected =
    filteredCheques.length > 0 && selectedChequeIds.length === filteredCheques.length;

  const handleToggleSelect = (id: string) => {
    setSelectedChequeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedChequeIds([]);
    } else {
      setSelectedChequeIds(filteredCheques.map((c, idx) => c.id));
    }
  };

  const handleSelectBouncedOnly = () => {
    const bouncedIds = filteredCheques
      .filter((c) => c.originalStatus === "BOUNCED" || c.status === "BOUNCED")
      .map((c, idx) => c.id);
    setSelectedChequeIds(bouncedIds);
  };

  const handleBulkStatusChange = (status: ChequeStatus) => {
    bulkUpdateCheques(selectedChequeIds, { status });
    setActionNotice(
      language === "ar"
        ? `تم تحديث حالة ${selectedChequeIds.length} شيك بنجاح`
        : `Updated status for ${selectedChequeIds.length} cheques`
    );
    setSelectedChequeIds([]);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleSingleStatusSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusChangeCheque) return;

    updateChequeStatus(
      statusChangeCheque.id,
      newStatus,
      newStatus === "BOUNCED" ? (newReturnReason || undefined) : undefined
    );

    setStatusChangeCheque(null);
  };

  const handleSendWhatsApp = async (chqId: string) => {
    const res = await dispatchWhatsAppReminder(chqId);
    setActionNotice(res.message);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleSendEmail = async (chqId: string) => {
    const res = await dispatchEmailReminder(chqId);
    setActionNotice(res.message);
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {bouncedOnly ? t("navBouncedCheques") : t("navCheques")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {bouncedOnly
              ? language === "ar"
                ? "قائمة الشيكات المرتجعة، متابعة التحصيل القانوني والودي، وإشعارات الإنذار"
                : "Bounced cheque register, collection queue, dispute escalation, and notice dispatch"
              : language === "ar"
              ? "سجل الشيكات الإيجارية، الصرف البنكي، والمسح الذكي بالذكاء الاصطناعي"
              : "Cheque ledger, deposit clearance, and automated AI OCR extraction"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedChequeIds.length > 0 && onOpenConvertToCaseModal && (
            <button
              onClick={() => onOpenConvertToCaseModal(selectedChequeIds)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Scale className="w-4 h-4" />
              <span>
                {language === "ar"
                  ? `قيد قضية (${selectedChequeIds.length})`
                  : `File Case (${selectedChequeIds.length})`}
              </span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingCheque(null);
              setAutoTriggerScan(true);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{language === "ar" ? "مسح شيك ذكي (AI)" : "Smart Cheque Capture"}</span>
          </button>

          <button
            onClick={() => {
              setEditingCheque(null);
              setAutoTriggerScan(false);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === "ar" ? "إضافة شيك يدوياً" : "Add Cheque Manually"}</span>
          </button>

          <button
            onClick={() => navigateTo("COLLECTIONS")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>{language === "ar" ? "التحصيلات والسندات" : "Collections & Receipts"}</span>
          </button>

          {canGoBack && <CloseBackButton />}
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-emerald-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {language === "ar" ? "إجمالي قيمة الشيكات المفلترة" : "Total Filtered Value"}
          </span>
          <span className="text-xl font-black text-slate-900 font-mono">
            AED {totalAmount.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 block mt-0.5">
            {filteredCheques.length} {language === "ar" ? "شيك في السجل" : "cheques in ledger"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {language === "ar" ? "المبلغ المتبقي للتحصيل" : "Outstanding Amount"}
          </span>
          <span className="text-xl font-black text-rose-600 font-mono">
            AED {totalOutstanding.toLocaleString()}
          </span>
          <span className="text-xs text-rose-700 block mt-0.5">
            {language === "ar" ? "قيد المطالبة والتحصيل" : "Pending Realization"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              {language === "ar" ? "الشيكات المحددة للعمليات الجماعية" : "Selection Summary"}
            </span>
            <span className="text-xl font-black text-slate-900 font-mono">
              {selectedChequeIds.length} / {filteredCheques.length}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSelectAll}
              className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
            >
              {isAllSelected
                ? language === "ar"
                  ? "إلغاء تحديد الكل"
                  : "Deselect All"
                : language === "ar"
                ? "تحديد الكل"
                : "Select All"}
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={handleSelectBouncedOnly}
              className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
            >
              {language === "ar" ? "تحديد المرتجع فقط" : "Select Bounced"}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-1">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === "ar" ? "بحث برقم الشيك، المستأجر..." : "Search cheque #, tenant..."}
            className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
          />
        </div>

        <div>
          <SearchableSelect
            options={
              bouncedOnly
                ? [
                    { id: "ALL", label: language === "ar" ? "كافة المرتجعات المعلقة (بدون قضايا)" : "All Pending Bounced Items" },
                    { id: "UNCOLLECTED", label: language === "ar" ? "شيكات لم يتم تحصيلها (0% مدفوع)" : "Uncollected (0% Paid)" },
                    { id: "PARTIAL", label: language === "ar" ? "شيكات محصل منها جزئياً (متبقي رصيد)" : "Partially Collected" },
                  ]
                : [
                    { id: "ALL", label: language === "ar" ? "كافة الحالات" : "All Statuses" },
                    { id: "BOUNCED", label: language === "ar" ? "شيكات مرتجعة بانتظار التحصيل (بدون قضايا)" : "Bounced (Pending Recovery)" },
                    { id: "UNDER_LEGAL", label: language === "ar" ? "قيد التقاضي (محولة لقضايا)" : "UNDER LEGAL (Under Case)" },
                    { id: "COLLECTED", label: "COLLECTED (تم التحصيل بالكامل)" },
                    { id: "CLEARED", label: "CLEARED (تم الصرف)" },
                    { id: "PENDING", label: "PENDING (تحت التحصيل)" },
                    { id: "DEPOSITED", label: "DEPOSITED (تم الإيداع)" },
                    { id: "POST_DATED", label: language === "ar" ? "شيكات فعالة مؤجلة (PDC Cheques)" : "POST_DATED (Active PDC Cheques)" },
                  ]
            }
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            placeholder={language === "ar" ? "فلترة الحالة..." : "Filter status..."}
            searchPlaceholder={language === "ar" ? "ابحث بالحالة..." : "Search status..."}
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: language === "ar" ? "كافة أسباب الإرجاع" : "All Return Reasons" },
              { id: "INSUFFICIENT_FUNDS", label: "عدم كفاية الرصيد (Insufficient Funds)" },
              { id: "SIGNATURE_MISMATCH", label: "عدم مطابقة التوقيع (Signature Mismatch)" },
              { id: "ACCOUNT_CLOSED", label: "الحساب مغلق (Account Closed)" },
              { id: "POST_DATED", label: "شيك مؤجل التاريخ (Post-Dated)" },
              { id: "STOPPED_PAYMENT", label: "أمر إيقاف صرف (Stopped Payment)" },
              { id: "TECHNICAL_ERROR", label: "خطأ تقني / بنكي (Technical Error)" },
            ]}
            value={reasonFilter}
            onChange={(val) => setReasonFilter(val)}
            placeholder={language === "ar" ? "سبب الإرجاع..." : "Return reason..."}
            searchPlaceholder={language === "ar" ? "ابحث بالسبب..." : "Search reason..."}
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: language === "ar" ? "كافة العقارات" : "All Properties" },
              ...properties.map((p) => {
                const owner = owners.find((o) => o.id === p.ownerId);
                const ownerName = owner ? (language === "ar" ? owner.nameAr : owner.nameEn) : "";
                return {
                  id: p.id,
                  label: language === "ar" ? p.nameAr : p.nameEn,
                  subLabel: ownerName ? `المالك: ${ownerName}` : p.community || p.emirate,
                  badge: p.code || undefined,
                };
              }),
            ]}
            value={propertyFilter}
            onChange={(val) => setPropertyFilter(val)}
            placeholder={language === "ar" ? "-- تصفية بحسب العقار --" : "-- Filter Property --"}
            searchPlaceholder={language === "ar" ? "ابحث باسم العقار أو المالك..." : "Search property or owner..."}
          />
        </div>
      </div>

      {/* Bulk Action Toolbar if items selected */}
      {selectedChequeIds.length > 0 && (
        <div className="p-3 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-xs">
              {selectedChequeIds.length} {language === "ar" ? "شيكات محددة" : "selected"}
            </span>
            <button
              onClick={() => setSelectedChequeIds([])}
              className="text-slate-300 hover:text-white underline text-xs cursor-pointer"
            >
              {language === "ar" ? "إلغاء التحديد" : "Clear"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const selected = cheques.filter((c) => selectedChequeIds.includes(c.id));
                const tObj = tenants.find((t) => t.id === selected[0]?.tenantId) || null;
                setLegalNoticeCheques(selected);
                setLegalNoticeTenant(tObj);
                setLegalNoticeType("EVICTION_NOTICE_30_DAYS");
                setIsLegalNoticeOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Scale className="w-3.5 h-3.5 text-amber-300" />
              <span>{language === "ar" ? "صياغة إنذار عدلي (AI)" : "Draft AI Legal Notice"}</span>
            </button>

            {onOpenConvertToCaseModal && (
              <button
                onClick={() => onOpenConvertToCaseModal(selectedChequeIds)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === "ar" ? "تحويل لقضية إيجارية" : "Convert to Case"}</span>
              </button>
            )}

            <button
              onClick={() => handleBulkStatusChange("DEPOSITED")}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
            >
              {language === "ar" ? "تعيين: تم الإيداع" : "Mark Deposited"}
            </button>
            <button
              onClick={() => handleBulkStatusChange("CLEARED")}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
            >
              {language === "ar" ? "تعيين: تم الصرف" : "Mark Cleared"}
            </button>
            <button
              onClick={() => handleBulkStatusChange("BOUNCED")}
              className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer"
            >
              {language === "ar" ? "تعيين: مرتجع" : "Mark Bounced"}
            </button>
          </div>
        </div>
      )}

      {/* Cheques Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold select-none">
              <tr>
                <th className="py-3.5 px-4 text-start w-12">
                  <div
                    onClick={handleSelectAll}
                    className="flex items-center justify-center p-1 rounded-lg hover:bg-slate-200/70 cursor-pointer transition-colors"
                    title={isAllSelected ? "Deselect All" : "Select All"}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-amber-700" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-4 text-start">{language === "ar" ? "رقم الشيك والمصرف" : "Cheque # & Bank"}</th>
                <th className="py-3.5 px-4 text-start">{language === "ar" ? "المستأجر" : "Tenant"}</th>
                <th className="py-3.5 px-4 text-start">{language === "ar" ? "المالك والعقار" : "Owner & Property"}</th>
                <th className="py-3.5 px-4 text-start">{language === "ar" ? "المبلغ الأصلي" : "Original Amount"}</th>
                <th className="py-3.5 px-4 text-start">{language === "ar" ? "الرصيد المتبقي" : "Outstanding"}</th>
                <th className="py-3.5 px-4 text-start">{language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</th>
                <th className="py-3.5 px-4 text-start">{language === "ar" ? "الحالة والسبب" : "Status & Reason"}</th>
                <th className="py-3.5 px-4 text-end">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCheques.map((cheque, idx) => {
                const tenant = tenants.find((t) => t.id === cheque.tenantId);
                const prop = properties.find((p) => p.id === cheque.propertyId);
                const unit = units.find((u) => u.id === cheque.unitId);
                const isSelected = selectedChequeIds.includes(cheque.id);

                return (
                  <tr
                    key={`${cheque.id}-${idx}`}
                    onClick={() => {
                      setEditingCheque(cheque);
                      setIsAddModalOpen(true);
                    }}
                    className={`transition-colors cursor-pointer select-none ${
                      isSelected
                        ? "bg-amber-50/80 font-medium text-slate-900 border-s-4 border-amber-600"
                        : "hover:bg-amber-50/40"
                    }`}
                  >
                    <td
                      className="py-3 px-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(cheque.id);
                      }}
                    >
                      <div className="flex items-center justify-center p-1 rounded-lg hover:bg-amber-100/50 cursor-pointer">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-700" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-mono font-black text-slate-900">#{cheque.chequeNumber}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">{cheque.bankName}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A"}
                      </div>
                      {tenant && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            tenant.riskLevel === "HIGH"
                              ? "bg-rose-100 text-rose-700"
                              : tenant.riskLevel === "MEDIUM"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {tenant.riskLevel} Risk
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 line-clamp-1">
                        {owners.find(o => o.id === cheque.ownerId)?.[language === "ar" ? "nameAr" : "nameEn"] || cheque.ownerName || "Owner"}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "Property"} • Unit #{unit?.unitNumber}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-black text-slate-900 dark:text-white">
                      AED {cheque.amount.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold">
                      <span
                        className={
                          (cheque.outstanding ?? cheque.amount) > 0
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : "text-emerald-600 dark:text-emerald-400 font-bold"
                        }
                      >
                        AED {(cheque.outstanding ?? cheque.amount).toLocaleString()}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-800">
                      {cheque.dueDate}
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          cheque.status === "BOUNCED"
                            ? "danger"
                            : cheque.status === "CLEARED" || cheque.status === "COLLECTED"
                            ? "success"
                            : cheque.status === "UNDER_LEGAL"
                            ? "purple"
                            : cheque.status === "DEPOSITED"
                            ? "info"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {cheque.status}
                      </Badge>
                      {cheque.returnReason && (
                        <div className="text-[10px] text-rose-600 font-semibold mt-0.5 truncate max-w-[130px]">
                          {cheque.returnReason.replace("_", " ")}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-end">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Cheque Scan Image & Drive Sync Button */}
                        <button
                          onClick={() => setSelectedChequeForScan(cheque)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                            cheque.imageUrl
                              ? cheque.driveWebViewLink
                                ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                : "text-amber-800 bg-amber-50 hover:bg-amber-100"
                              : "text-slate-400 hover:text-amber-700 hover:bg-slate-100"
                          }`}
                          title={
                            cheque.imageUrl
                              ? cheque.driveWebViewLink
                                ? language === "ar"
                                  ? "الصور متوفرة ومحفوظة في Google Drive"
                                  : "Cheque scan available & synced in Drive"
                                : language === "ar"
                                ? "معاينة وتحديث الصورة"
                                : "View & update cheque scan"
                              : language === "ar"
                              ? "تحميل الصورة"
                              : "Upload cheque scan"
                          }
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {cheque.driveWebViewLink && (
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          )}
                        </button>

                        {/* Audit History / Timeline Button */}
                        <button
                          onClick={() => setViewingAuditCheque(cheque)}
                          className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                          title={language === "ar" ? "سجل تتبع وتدقيق حركة الشيك (Timeline)" : "View Cheque Audit Trail / Timeline"}
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Send Email Alert (SMTP) Button */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!tenant?.email) {
                              alert(language === "ar" ? "المستأجر لا يملك بريداً إلكترونياً مسجلاً" : "Tenant has no registered email address");
                              return;
                            }
                            const isBounced = cheque.status === "BOUNCED";
                            const alertType = isBounced ? "BOUNCED" : "APPROACHING_DUE";
                            try {
                              const res = await fetch('/api/notifications/dispatch', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  channel: 'email',
                                  recipient: tenant.email,
                                  tenantName: tenant.nameAr || tenant.nameEn,
                                  chequeNumber: cheque.chequeNumber,
                                  amountAED: cheque.amount,
                                  dueDate: cheque.dueDate,
                                  template: alertType
                                })
                              });
                              const data = await res.json();
                              if (data.success) {
                                alert(language === "ar" ? `تم إرسال تنبيه البريد الإلكتروني بنجاح إلى ${tenant.email}` : `Email alert sent successfully to ${tenant.email}`);
                              } else {
                                alert(language === "ar" ? `فشل إرسال البريد: ${data.error || data.message || 'خطأ غير معروف'}` : `Failed to send email: ${data.error || data.message || 'Unknown error'}`);
                              }
                            } catch (err: any) {
                              alert(language === "ar" ? `خطأ في الاتصال: ${err.message}` : `Connection error: ${err.message}`);
                            }
                          }}
                          className="p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                          title={
                            cheque.status === "BOUNCED"
                              ? (language === "ar" ? "إرسال إنذار شيك مرتجع عبر البريد الإلكتروني (SMTP)" : "Send Bounced Cheque Email Alert (SMTP)")
                              : (language === "ar" ? "إرسال تنبيه الاستحقاق عبر البريد الإلكتروني (SMTP)" : "Send Approaching Due Email Alert (SMTP)")
                          }
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>

                        {/* Custom Administrative Actions & Lock Checking */}
                        {(() => {
                          const hasEditSavedPermission = hasPermission("EDIT_SAVED_FINANCIAL_RECORDS");
                          // Any cheque that exists (has an id) is considered "saved"
                          // If user doesn't have the specific permission, it's locked.
                          const isLockedForUser = !hasEditSavedPermission;
                          const hasCollections = collections.some((col) => col.chequeId === cheque.id);

                          return (
                            <>
                              {/* Edit Cheque Details Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isLockedForUser) {
                                    alert(language === "ar"
                                      ? "عذراً، هذا السجل المالي محفوظ ومقفل. لا يمكن التعديل عليه إلا من قبل مدير النظام أو من يملك صلاحية 'تعديل السجلات المالية المحفوظة'."
                                      : "Sorry, this financial record is saved and locked. Editing is restricted to System Administrators or users with 'Edit Saved Financial Records' permission.");
                                    return;
                                  }
                                  setEditingCheque(cheque);
                                  setIsAddModalOpen(true);
                                }}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isLockedForUser
                                    ? "text-slate-300 bg-slate-100 cursor-not-allowed"
                                    : "text-slate-600 hover:text-amber-800 hover:bg-amber-50"
                                }`}
                                title={
                                  isLockedForUser
                                    ? (language === "ar" ? "السجل مقفل (يتطلب صلاحية تعديل السجلات المحفوظة)" : "Record locked (Requires edit permission)")
                                    : (language === "ar" ? "تعديل البيانات" : "Edit Details")
                                }
                              >
                                {isLockedForUser ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Edit3 className="w-3.5 h-3.5" />}
                              </button>
                              
                              {canDelete && !isLockedForUser && (
                                <button
                                  onClick={(e) => handleDelete(cheque, e)}
                                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  title={language === "ar" ? "حذف الشيك" : "Delete Cheque"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Quick Status Picker Button */}
                              <button
                                onClick={() => {
                                  if (isLockedForUser) {
                                    alert(language === "ar"
                                      ? "عذراً، هذا السجل المالي محفوظ ومقفل. تعديل الحالة يتطلب صلاحية 'تعديل السجلات المالية المحفوظة'."
                                      : "Sorry, this financial record is saved and locked. Status changes require 'Edit Saved Financial Records' permission.");
                                    return;
                                  }
                                  setStatusChangeCheque(cheque);
                                  setNewStatus(cheque.status);
                                  setNewReturnReason(cheque.returnReason || "INSUFFICIENT_FUNDS");
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                                  isLockedForUser
                                    ? "text-slate-300 bg-slate-50 cursor-not-allowed"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                                title={isLockedForUser ? "Locked" : "Change Status"}
                              >
                                {isLockedForUser && <Lock className="w-2.5 h-2.5 inline me-1" />}
                                Status
                              </button>

                              {/* Reprint Receipt Button if has collections */}
                              {hasCollections && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newestCol = collections
                                      .filter((col) => col.chequeId === cheque.id)
                                      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
                                    if (newestCol) {
                                      setSelectedReceiptForReprint(newestCol);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold shadow-xs transition-colors cursor-pointer font-sans"
                                  title={language === "ar" ? "إعادة طباعة السند الرسمي للمستأجر" : "Reprint Tenant's Official Receipt"}
                                >
                                  <Printer className="w-3 h-3 text-white" />
                                  <span>{language === "ar" ? "إعادة طباعة" : "Reprint"}</span>
                                </button>
                              )}
                            </>
                          );
                        })()}

                        {/* Direct Collect Button if Bounced and outstanding > 0 */}
                        {cheque.outstanding > 0 && onOpenCollectionModal && (
                          <button
                            onClick={() => onOpenCollectionModal(cheque)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold shadow-xs transition-colors cursor-pointer"
                            title={language === "ar" ? "تحصيل مالي" : "Record Payment"}
                          >
                            <Receipt className="w-3 h-3" />
                            <span>{language === "ar" ? "تحصيل" : "Collect"}</span>
                          </button>
                        )}

                        {/* Replace Cheque Action (If not replaced, cancelled, cleared, collected, or locked by active legal case) */}
                        {cheque.status !== "REPLACED" && cheque.status !== "CANCELLED" && cheque.status !== "CLEARED" && cheque.status !== "COLLECTED" && !isChequeInActiveCase(cheque.id, cases) && (
                          <button
                            onClick={() => setReplacingCheque(cheque)}
                            className="p-1 rounded-lg text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                            title={language === "ar" ? "استبدال الشيك (Replace Cheque)" : "Replace Cheque"}
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}

                        {/* Direct AI Legal Notice for Bounced */}
                        {cheque.originalStatus === "BOUNCED" && (
                          <button
                            onClick={() => {
                              const tObj = tenants.find((t) => t.id === cheque.tenantId) || null;
                              setLegalNoticeCheques([cheque]);
                              setLegalNoticeTenant(tObj);
                              setLegalNoticeType("CHEQUE_PAYMENT_DEMAND");
                              setIsLegalNoticeOpen(true);
                            }}
                            className="p-1 rounded-lg text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                            title={language === "ar" ? "صياغة إشعار قانوني بالذكاء الاصطناعي" : "Draft AI Legal Notice"}
                          >
                            <Scale className="w-4 h-4" />
                          </button>
                        )}

                        {/* Direct WhatsApp & Email Reminder for Bounced */}
                        {cheque.originalStatus === "BOUNCED" && cheque.outstanding > 0 && (
                          <>
                            <button
                              onClick={() => handleSendWhatsApp(cheque.id)}
                              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title={language === "ar" ? "إرسال تذكير واتساب" : "Send WhatsApp Notice"}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSendEmail(cheque.id)}
                              className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title={language === "ar" ? "إرسال إشعار بريد إلكتروني" : "Send Email Notice"}
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredCheques.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs">
            {t("noDataFound")}
          </div>
        )}
      </div>

      {/* Add / Edit / Scan Cheque Modal */}
      <AddChequeModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCheque(null);
          setAutoTriggerScan(false);
        }}
        initialStatus={bouncedOnly ? "BOUNCED" : "PENDING"}
        editingCheque={editingCheque}
        autoTriggerCapture={autoTriggerScan}
      />

      {/* Change Status Modal */}
      <Modal
        isOpen={!!statusChangeCheque}
        onClose={() => setStatusChangeCheque(null)}
        title={language === "ar" ? "تأكيد تغيير الحالة" : "Confirm Status Change"}
        subtitle={statusChangeCheque ? `Cheque #${statusChangeCheque.chequeNumber} — AED ${statusChangeCheque.amount.toLocaleString()}` : ""}
        icon={<CreditCard className="w-5 h-5 text-amber-700" />}
        maxWidth="md"
      >
        {statusChangeCheque && (() => {
          const tenantObj = tenants.find((t) => t.id === statusChangeCheque.tenantId);
          const propObj = properties.find((p) => p.id === statusChangeCheque.propertyId);
          const ownerObj = owners.find((o) => o.id === statusChangeCheque.ownerId) || owners.find((o) => o.id === propObj?.ownerId);
          const unitObj = units.find((u) => u.id === statusChangeCheque.unitId);

          return (
            <form onSubmit={handleSingleStatusSave} className="space-y-4">
              {/* Bounced Warning Banner */}
              {newStatus === "BOUNCED" && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs space-y-1">
                  <div className="font-black flex items-center gap-1.5 text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{language === "ar" ? "تنبيه تسجيل شيك مرتجع (Bounced Cheque)" : "Bounced Cheque Warning"}</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    {language === "ar"
                      ? "أنت على وشك تسجيل هذا الشيك كشيك مرتجع. سيتم تحويله إلى سجل الشيكات الراجعة وتحديث القضايا وفق دورة النظام المعتمدة."
                      : "You are about to mark this cheque as BOUNCED. It will be linked to the bounced cheque ledger for legal follow-up."}
                  </p>
                </div>
              )}

              {/* Full Cheque Details Breakdown */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "ar" ? "المستأجر:" : "Tenant:"}</span>
                  <span className="font-bold text-slate-900">
                    {tenantObj ? (language === "ar" ? tenantObj.nameAr : tenantObj.nameEn) : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "ar" ? "المالك:" : "Owner:"}</span>
                  <span className="font-bold text-slate-900">
                    {ownerObj ? (language === "ar" ? ownerObj.nameAr : ownerObj.nameEn) : statusChangeCheque.ownerName || "Owner"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "ar" ? "العقار والوحدة:" : "Property & Unit:"}</span>
                  <span className="font-bold text-slate-900">
                    {propObj ? (language === "ar" ? propObj.nameAr : propObj.nameEn) : "N/A"} {unitObj ? `• Unit #${unitObj.unitNumber}` : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "ar" ? "رقم الشيك:" : "Cheque #:"}</span>
                  <span className="font-mono font-bold text-slate-900">#{statusChangeCheque.chequeNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "ar" ? "القيمة:" : "Amount:"}</span>
                  <span className="font-mono font-black text-amber-700">AED {statusChangeCheque.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "ar" ? "تاريخ الاستحقاق:" : "Due Date:"}</span>
                  <span className="font-mono text-slate-900">{statusChangeCheque.dueDate}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">{language === "ar" ? "الحالة الحالية:" : "Current Status:"}</span>
                  <Badge variant="neutral" size="sm">{statusChangeCheque.status}</Badge>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الإجراء المطلوب / الحالة الجديدة" : "Requested New Status"} *
                </label>
                <SearchableSelect
                  options={[
                    { id: "PENDING", label: "PENDING (تحت التحصيل)" },
                    { id: "DEPOSITED", label: "DEPOSITED (تم الإيداع بالبنك)" },
                    { id: "CLEARED", label: "CLEARED (تم الصرف بنجاح)" },
                    { id: "BOUNCED", label: "BOUNCED (مرتجع)" },
                    { id: "UNDER_LEGAL", label: "UNDER LEGAL (محال للقضاء الإيجاري)" },
                    { id: "COLLECTED", label: "COLLECTED (تم التحصيل)" },
                  ]}
                  value={newStatus}
                  onChange={(val) => setNewStatus(val as any)}
                  placeholder={language === "ar" ? "اختر الحالة..." : "Select status..."}
                  searchPlaceholder={language === "ar" ? "ابحث عن حالة..." : "Search status..."}
                />
              </div>

              {newStatus === "BOUNCED" && (
                <div>
                  <label className="block text-xs font-bold text-rose-800 mb-1">
                    {language === "ar" ? "سبب الإرجاع المصرفي" : "Bank Return Reason"} *
                  </label>
                  <SearchableSelect
                    options={[
                      { id: "INSUFFICIENT_FUNDS", label: "عدم كفاية الرصيد (Insufficient Funds)" },
                      { id: "SIGNATURE_MISMATCH", label: "عدم مطابقة التوقيع (Signature Mismatch)" },
                      { id: "ACCOUNT_CLOSED", label: "الحساب مغلق (Account Closed)" },
                      { id: "POST_DATED", label: "شيك مؤجل التاريخ (Post-Dated)" },
                      { id: "STOPPED_PAYMENT", label: "أمر إيقاف صرف (Stopped Payment)" },
                      { id: "TECHNICAL_ERROR", label: "خطأ تقني / بنكي (Technical Error)" },
                    ]}
                    value={newReturnReason}
                    onChange={(val) => setNewReturnReason(val as any)}
                    placeholder={language === "ar" ? "اختر سبب الإرجاع..." : "Select reason..."}
                    searchPlaceholder={language === "ar" ? "ابحث عن سبب..." : "Search reason..."}
                  />
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusChangeCheque(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {language === "ar" ? "إلغاء / تراجع" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs cursor-pointer ${
                    newStatus === "BOUNCED" ? "bg-rose-700 hover:bg-rose-800" : "bg-amber-700 hover:bg-amber-800"
                  }`}
                >
                  {newStatus === "BOUNCED"
                    ? language === "ar"
                      ? "تأكيد تسجيل الشيك كمرتجع"
                      : "Confirm Mark as Bounced"
                    : language === "ar"
                    ? "تأكيد العملية"
                    : "Confirm Action"}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* AI Legal Notice Generator Modal */}
      <LegalNoticeGeneratorModal
        isOpen={isLegalNoticeOpen}
        onClose={() => setIsLegalNoticeOpen(false)}
        
        initialTenant={legalNoticeTenant}
        defaultNoticeType={legalNoticeType}
      />

      {/* Cheque Scan Upload & Drive Sync Modal */}
      <ChequeImageUploadModal
        isOpen={Boolean(selectedChequeForScan)}
        onClose={() => setSelectedChequeForScan(null)}
        cheque={selectedChequeForScan}
      />

      {/* Receipt Voucher Modal for Reprinting */}
      <ReceiptVoucherModal
        isOpen={!!selectedReceiptForReprint}
        onClose={() => setSelectedReceiptForReprint(null)}
        receipt={selectedReceiptForReprint}
      />

      {/* Collections & Receipts Modal */}
      <Modal
        isOpen={isCollectionsModalOpen}
        onClose={() => setIsCollectionsModalOpen(false)}
        title={language === "ar" ? "التحصيلات والسندات" : "Collections & Receipts"}
        subtitle={
          language === "ar"
            ? "سجل سندات القبض التفصيلي، تسلسل دفعات الشيكات، وإدارة التحصيل المالي المباشر"
            : "Hierarchical receipt ledger, installment breakdown, and bounced cheque recovery queue"
        }
        maxWidth="full"
        icon={<Receipt className="w-5 h-5 text-emerald-600" />}
      >
        <CollectionsView />
      </Modal>

      {/* Delete Cheque Confirmation Modal */}
      {chequeToDelete && (() => {
        const tenant = tenants.find((t) => t.id === chequeToDelete.tenantId);
        const prop = properties.find((p) => p.id === chequeToDelete.propertyId);
        const unit = units.find((u) => u.id === chequeToDelete.unitId);
        const chequeDocs: any[] = [];
        if (chequeToDelete.imageUrl || chequeToDelete.driveFileId) {
          chequeDocs.push({
            id: `cheque-doc-${chequeToDelete.id}`,
            fileName: `صورة شيك رقم ${chequeToDelete.chequeNumber}.jpg`,
            fileUrl: chequeToDelete.imageUrl,
            category: "صورة شيك",
            driveWebViewLink: chequeToDelete.driveWebViewLink,
          });
        }
        return (
          <ConfirmDeleteModal
            isOpen={!!chequeToDelete}
            onClose={() => setChequeToDelete(null)}
            onConfirm={confirmDeleteCheque}
            title={language === "ar" ? "حذف الشيك وحفظه بالسجلات التاريخية" : "Delete & Archive Cheque to History"}
            itemName={`شيك #${chequeToDelete.chequeNumber} (${tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : ""})`}
            itemCode={`#${chequeToDelete.chequeNumber}`}
            itemType={language === "ar" ? "شيك بنكي" : "Bank Cheque"}
            entityType="CHEQUE"
            entityId={chequeToDelete.id}
            statusAtDeletion={chequeToDelete.status}
            attachmentsCount={chequeDocs.length}
            attachments={chequeDocs}
          />
        );
      })()}

      {/* Replace Cheque Modal */}
      {replacingCheque && (
        <ReplaceChequeModal
          originalCheque={replacingCheque}
          isOpen={true}
          onClose={() => setReplacingCheque(null)}
        />
      )}

      {/* Attachment / Proof Viewer Modal */}
      {viewingProof && (
        <Modal
          isOpen={true}
          onClose={() => setViewingProof(null)}
          title={viewingProof.title}
        >
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-slate-900/5 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              {viewingProof.url.startsWith("data:application/pdf") ? (
                <iframe
                  src={viewingProof.url}
                  className="w-full h-96 rounded-lg border-0"
                  title="PDF Document Viewer"
                />
              ) : (
                <img
                  src={viewingProof.url}
                  alt={viewingProof.title}
                  className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-xs"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <a
                href={viewingProof.url}
                download={viewingProof.fileName || "proof-document"}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 rotate-180" />
                <span>{language === "ar" ? "تحميل المرفق" : "Download File"}</span>
              </a>

              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                {language === "ar" ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cheque Lifecycle Audit Trail Modal */}
      {viewingAuditCheque && (
        <Modal
          isOpen={true}
          onClose={() => setViewingAuditCheque(null)}
          title={
            language === "ar"
              ? `سجل التدقيق والتتبع — الشيك #${viewingAuditCheque.chequeNumber}`
              : `Audit Trail — Cheque #${viewingAuditCheque.chequeNumber}`
          }
        >
          <div className="space-y-4 text-xs">
            {/* Header info badge */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">{language === "ar" ? "معرف الشيك المركزي" : "Central Cheque ID"}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingAuditCheque.id}</span>
              </div>
              <div className="text-right rtl:text-left">
                <span className="text-slate-400 block">{language === "ar" ? "الحالة الحالية" : "Current Status"}</span>
                <span className="font-bold">
                  <Badge variant="neutral" size="sm">{viewingAuditCheque.status}</Badge>
                </span>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                <span>{language === "ar" ? "التسلسل الزمني للعمليات والحركات" : "Operational Timeline"}</span>
              </h4>

              {(!viewingAuditCheque.auditTrail || viewingAuditCheque.auditTrail.length === 0) ? (
                <div className="py-8 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-1 stroke-[1.5]" />
                  <p>{language === "ar" ? "لا توجد سجلات تدقيق سابقة لهذا الشيك بعد." : "No audit entries recorded for this cheque yet."}</p>
                </div>
              ) : (
                <div className="relative border-s-2 border-indigo-200 dark:border-indigo-900 ms-3 space-y-4 py-1">
                  {viewingAuditCheque.auditTrail.map((entry, idx) => (
                    <div key={idx} className="relative ps-4 group">
                      <div className="absolute -start-1.5 top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-indigo-700 dark:text-indigo-400">
                            {entry.action}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(entry.timestamp).toLocaleString(language === "ar" ? "ar-AE" : "en-GB")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                          <span>
                            {language === "ar" ? "الحالة:" : "Status:"}{" "}
                            <strong className="text-slate-800 dark:text-white">
                              {entry.previousStatus || "INIT"} → {entry.newStatus}
                            </strong>
                          </span>
                          {entry.userName && (
                            <span className="text-slate-400">
                              • {language === "ar" ? "بواسطة:" : "By:"} {entry.userName}
                            </span>
                          )}
                        </div>

                        {entry.notes && (
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            {entry.notes}
                          </div>
                        )}

                        {entry.referenceNumber && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {language === "ar" ? "المرجع:" : "Ref:"} {entry.referenceNumber}
                          </div>
                        )}

                        {entry.proofUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewingProof({
                                title: language === "ar"
                                  ? `مرفق عملية (${entry.action}) - شيك #${viewingAuditCheque.chequeNumber}`
                                  : `Proof for ${entry.action} - Cheque #${viewingAuditCheque.chequeNumber}`,
                                url: entry.proofUrl!,
                              })
                            }
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-[11px] font-bold cursor-pointer pt-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{language === "ar" ? "عرض الوثيقة المرفقة للعملية" : "View Attached Proof"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingAuditCheque(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer"
              >
                {language === "ar" ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
