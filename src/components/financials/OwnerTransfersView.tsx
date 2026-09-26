import React, { useState, useMemo } from "react";
import {
  ArrowRightLeft,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Building2,
  Coins,
  Wallet,
  Clock,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { OwnerTransferRecord, OwnerTransferStatus, PaymentMethod } from "../../types";
import { SearchableSelect } from "../common/SearchableSelect";
import { OwnerPaymentVoucherModal } from "./OwnerPaymentVoucherModal";

export const OwnerTransfersView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    owners = [],
    properties = [],
    ownerTransfers = [],
    addOwnerTransfer,
    updateOwnerTransfer,
    updateOwnerTransferStatus,
    reverseOwnerTransfer,
    getOwnerPayable,
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Owner Payment Voucher Modal State
  const [selectedVoucherTransfer, setSelectedVoucherTransfer] = useState<OwnerTransferRecord | null>(null);

  // Add Transfer Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalOwnerId, setModalOwnerId] = useState("");
  const [modalPropertyId, setModalPropertyId] = useState("");
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalTransferDate, setModalTransferDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [modalPaymentMethod, setModalPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [modalBankName, setModalBankName] = useState("");
  const [modalIban, setModalIban] = useState("");
  const [modalRefNumber, setModalRefNumber] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [modalError, setModalError] = useState("");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransferId, setEditingTransferId] = useState("");

  // Reversal Modal State
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [reversalTargetId, setReversalTargetId] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [reversalError, setReversalError] = useState("");

  // Owner Options with Live Balance
  const ownerOptions = useMemo(() => {
    return owners.map((o) => {
      const payable = getOwnerPayable(o.id);
      const ownerName = isAr ? o.nameAr : o.nameEn;
      return {
        id: o.id,
        label: ownerName,
        title: ownerName,
        subLabel: `${isAr ? "رصيد المستحقات:" : "Payable Balance:"} ${payable.currentPayableBalance.toLocaleString()} AED`,
        badge: `${o.code || "OW"} | ${o.bankName || "No Bank"}`,
        extraSearchTerms: [o.nameAr, o.nameEn, o.code || "", o.emiratesId || "", o.phone || "", o.bankName || "", o.iban || ""],
      };
    });
  }, [owners, getOwnerPayable, isAr]);

  // Selected Owner Live Calculation
  const selectedOwnerPayable = useMemo(() => {
    if (!modalOwnerId) return null;
    return getOwnerPayable(modalOwnerId);
  }, [modalOwnerId, getOwnerPayable]);

  // Sync bank details when owner is selected in modal
  const handleOwnerSelect = (ownerId: string) => {
    setModalOwnerId(ownerId);
    const targetOwner = owners.find((o) => o.id === ownerId);
    if (targetOwner) {
      setModalBankName(targetOwner.bankName || "");
      setModalIban(targetOwner.iban || "");
      const payable = getOwnerPayable(ownerId);
      setModalAmount(payable.currentPayableBalance > 0 ? payable.currentPayableBalance : 0);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    let totalPaid = 0;
    let totalPending = 0;
    let totalTransfersCount = ownerTransfers.length;

    ownerTransfers.forEach((t) => {
      if (t.status === "PAID" || t.status === "RECONCILED" || t.status === "COMPLETED") {
        totalPaid += t.amount;
      } else if (t.status === "DRAFT" || t.status === "PENDING_APPROVAL" || t.status === "APPROVED") {
        totalPending += t.amount;
      }
    });

    let totalSystemPayable = 0;
    owners.forEach((o) => {
      totalSystemPayable += getOwnerPayable(o.id).currentPayableBalance;
    });

    return { totalPaid, totalPending, totalSystemPayable, totalTransfersCount };
  }, [ownerTransfers, owners, getOwnerPayable]);

  // Filtered Transfers
  const filteredTransfers = ownerTransfers.filter((t) => {
    const matchesOwner = selectedOwnerFilter === "ALL" || t.ownerId === selectedOwnerFilter;
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const owner = owners.find((o) => o.id === t.ownerId);
    const matchesSearch =
      !q ||
      t.transferNumber.toLowerCase().includes(q) ||
      (t.transactionReferenceNumber && t.transactionReferenceNumber.toLowerCase().includes(q)) ||
      (owner && (owner.nameAr.toLowerCase().includes(q) || owner.nameEn.toLowerCase().includes(q)));
    return matchesOwner && matchesStatus && matchesSearch;
  });

  const handleOpenAddModal = () => {
    setModalOwnerId("");
    setModalPropertyId("");
    setModalTransferDate(new Date().toISOString().split("T")[0]);
    setModalPaymentMethod("BANK_TRANSFER");
    setModalRefNumber("");
    setModalNotes("");
    setModalError("");
    setIsAddModalOpen(true);
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    if (!modalOwnerId) {
      setModalError(isAr ? "يرجى تحديد المالك المستفيد." : "Please select the owner.");
      return;
    }

    if (modalAmount <= 0) {
      setModalError(isAr ? "مبلغ التحويل يجب أن يكون أكبر من الصفر." : "Amount must be greater than zero.");
      return;
    }

    const payload: any = {
      ownerId: modalOwnerId,
      amount: modalAmount,
      transferDate: modalTransferDate,
      paymentMethod: modalPaymentMethod,
      status: "APPROVED",
    };
    if (modalPropertyId && modalPropertyId.trim()) {
      payload.propertyId = modalPropertyId.trim();
    }
    if (modalBankName && modalBankName.trim()) {
      payload.beneficiaryBankName = modalBankName.trim();
    }
    if (modalIban && modalIban.trim()) {
      payload.beneficiaryIban = modalIban.trim();
    }
    if (modalRefNumber && modalRefNumber.trim()) {
      payload.transactionReferenceNumber = modalRefNumber.trim();
    }
    if (modalNotes && modalNotes.trim()) {
      payload.notes = modalNotes.trim();
    }

    const res = await addOwnerTransfer(payload);

    if (res.success) {
      setIsAddModalOpen(false);
    } else {
      setModalError(res.error || (isAr ? "فشل إنشاء سند التحويل" : "Failed to create transfer"));
    }
  };

  const handleOpenEditModal = (t: OwnerTransferRecord) => {
    setEditingTransferId(t.id);
    setModalOwnerId(t.ownerId);
    setModalPropertyId(t.propertyId || "");
    setModalAmount(t.amount);
    setModalTransferDate(t.transferDate);
    setModalPaymentMethod(t.paymentMethod);
    setModalBankName(t.beneficiaryBankName || "");
    setModalIban(t.beneficiaryIban || "");
    setModalRefNumber(t.transactionReferenceNumber || "");
    setModalNotes(t.notes || "");
    setModalError("");
    setIsEditModalOpen(true);
  };

  const handleUpdateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    if (modalAmount <= 0) {
      setModalError(isAr ? "المبلغ يجب أن يكون أكبر من الصفر" : "Amount must be positive");
      return;
    }

    const patchPayload: any = {
      ownerId: modalOwnerId,
      amount: modalAmount,
      transferDate: modalTransferDate,
      paymentMethod: modalPaymentMethod,
    };
    if (modalPropertyId && modalPropertyId.trim()) {
      patchPayload.propertyId = modalPropertyId.trim();
    }
    if (modalBankName && modalBankName.trim()) {
      patchPayload.beneficiaryBankName = modalBankName.trim();
    }
    if (modalIban && modalIban.trim()) {
      patchPayload.beneficiaryIban = modalIban.trim();
    }
    if (modalRefNumber && modalRefNumber.trim()) {
      patchPayload.transactionReferenceNumber = modalRefNumber.trim();
    }
    if (modalNotes && modalNotes.trim()) {
      patchPayload.notes = modalNotes.trim();
    }

    const res = await updateOwnerTransfer(editingTransferId, patchPayload);

    if (res.success) {
      setIsEditModalOpen(false);
    } else {
      setModalError(res.error || "Failed to update transfer");
    }
  };

  const handleExportCSV = () => {
    const headers = isAr 
      ? ["رقم السند", "المالك", "التاريخ", "المبلغ", "الحالة"]
      : ["Ref", "Owner", "Date", "Amount", "Status"];
    
    const rows = filteredTransfers.map(t => {
      const owner = owners.find(o => o.id === t.ownerId);
      return [
        t.transferNumber,
        owner ? (isAr ? owner.nameAr : owner.nameEn) : "—",
        t.transferDate,
        t.amount.toString(),
        t.status
      ];
    });

    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `owner_transfers_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
  };

  const handleOpenReversal = (transferId: string) => {
    setReversalTargetId(transferId);
    setReversalReason("");
    setReversalError("");
    setIsReversalModalOpen(true);
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    setReversalError("");

    if (!reversalReason.trim()) {
      setReversalError(isAr ? "يرجى توضيح سبب الإلغاء/العكس للتدقيق المالي." : "Reason is required for audit.");
      return;
    }

    const res = await reverseOwnerTransfer(reversalTargetId, reversalReason.trim());
    if (res.success) {
      setIsReversalModalOpen(false);
    } else {
      setReversalError(res.error || "Failed to reverse transfer");
    }
  };

  const getStatusBadge = (status: OwnerTransferStatus) => {
    switch (status) {
      case "PAID":
      case "RECONCILED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{isAr ? "تم التحويل بنجاح" : "Paid / Settled"}</span>;
      case "APPROVED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">{isAr ? "معتمد للصرف" : "Approved"}</span>;
      case "DRAFT":
      case "PENDING_APPROVAL":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">{isAr ? "مسودة / قيد المراجعة" : "Draft / Pending"}</span>;
      case "REVERSED":
      case "CANCELLED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">{isAr ? "ملغي / معكوس" : "Reversed"}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{isAr ? "المستحق القائم للملاك" : "Total Owner Payable"}</span>
            <Wallet className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{kpis.totalSystemPayable.toLocaleString()} <span className="text-sm font-normal text-slate-500">AED</span></div>
          <div className="text-xs text-slate-400 mt-1">{isAr ? "صافي رصيد الإيجارات بعد الاستقطاعات" : "Net rent collections ready for transfer"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{isAr ? "إجمالي التحويلات المنفذة" : "Total Paid Out"}</span>
            <Coins className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{kpis.totalPaid.toLocaleString()} <span className="text-sm font-normal text-slate-500">AED</span></div>
          <div className="text-xs text-slate-400 mt-1">{isAr ? "حوالات تم صرفها وتسويتها" : "Disbursed & reconciled transfers"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{isAr ? "تحويلات معلقة" : "Pending Approval"}</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{kpis.totalPending.toLocaleString()} <span className="text-sm font-normal text-slate-500">AED</span></div>
          <div className="text-xs text-slate-400 mt-1">{isAr ? "بانتظار موافقة الصرف" : "Draft or pending transfers"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{isAr ? "عدد الحوالات المسجلة" : "Total Transfers"}</span>
            <FileCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{kpis.totalTransfersCount}</div>
          <div className="text-xs text-slate-400 mt-1">{isAr ? "سندات صرف وتحويل إيجار" : "Total transfer documents"}</div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
            {isAr ? "تحويلات وصرف مستحقات الملاك (Owner Transfers)" : "Owner Disbursements & Transfers"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isAr
              ? "إصدار وإدارة حوالات الإيجارات المحصلة المستحقة للملاك والتحقق من عدم تجاوز الرصيد المتاح"
              : "Generate and manage owner rental transfers with automatic balance validation"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {isAr ? "تصدير CSV" : "Export CSV"}
          </button>
          <button
            id="btn-add-owner-transfer"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            {isAr ? "إصدار تحويل مالك جديد" : "New Owner Transfer"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "بحث برقم الحوالة أو اسم المالك أو المرجع..." : "Search transfers..."}
            className="w-full pr-9 pl-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "جميع الملاك" : "All Owners" },
              ...owners.map((o) => ({
                id: o.id,
                label: isAr ? o.nameAr : o.nameEn,
                subLabel: o.code,
              })),
            ]}
            value={selectedOwnerFilter}
            onChange={(val) => setSelectedOwnerFilter(val)}
            placeholder={isAr ? "فلترة بالمالك..." : "Filter owner..."}
            searchPlaceholder={isAr ? "ابحث بالمالك..." : "Search owner..."}
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "جميع الحالات" : "All Statuses" },
              { id: "APPROVED", label: isAr ? "معتمد للصرف" : "Approved" },
              { id: "PAID", label: isAr ? "تم التحويل" : "Paid" },
              { id: "REVERSED", label: isAr ? "ملغي / معكوس" : "Reversed" }
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            placeholder={isAr ? "فلترة بالحالة..." : "Filter status..."}
            searchPlaceholder={isAr ? "ابحث بالحالة..." : "Search status..."}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">{isAr ? "رقم السند" : "Transfer Ref"}</th>
                <th className="px-5 py-3.5">{isAr ? "المالك" : "Owner"}</th>
                <th className="px-5 py-3.5">{isAr ? "تاريخ الحوالة" : "Transfer Date"}</th>
                <th className="px-5 py-3.5">{isAr ? "طريقة الدفع" : "Payment Method"}</th>
                <th className="px-5 py-3.5">{isAr ? "تفاصيل الحساب البنكي" : "Bank Details"}</th>
                <th className="px-5 py-3.5">{isAr ? "المبلغ" : "Amount"}</th>
                <th className="px-5 py-3.5 text-center">{isAr ? "الحالة" : "Status"}</th>
                <th className="px-5 py-3.5 text-center">{isAr ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredTransfers.map((t) => {
                const owner = owners.find((o) => o.id === t.ownerId);
                const isReversed = t.status === "REVERSED";
                return (
                  <tr
                    key={t.id}
                    className={`transition-colors ${
                      isReversed
                        ? "bg-rose-50/25 hover:bg-rose-50/40 text-slate-400"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td
                      className={`px-5 py-3.5 font-mono font-bold ${
                        isReversed
                          ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                          : "text-slate-900"
                      }`}
                    >
                      {t.transferNumber}
                    </td>
                    <td
                      className={`px-5 py-3.5 ${
                        isReversed ? "line-through decoration-rose-600 decoration-[2px]" : ""
                      }`}
                    >
                      <div
                        className={`font-semibold ${
                          isReversed ? "text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {owner ? (isAr ? owner.nameAr : owner.nameEn) : "—"}
                      </div>
                      <div className="text-xs text-slate-400">{owner?.code || ""}</div>
                    </td>
                    <td
                      className={`px-5 py-3.5 font-mono text-xs ${
                        isReversed
                          ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                          : "text-slate-600"
                      }`}
                    >
                      {t.transferDate}
                    </td>
                    <td
                      className={`px-5 py-3.5 ${
                        isReversed ? "line-through decoration-rose-600 decoration-[2px]" : ""
                      }`}
                    >
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          isReversed
                            ? "bg-slate-100 text-slate-400 opacity-60"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {t.paymentMethod}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3.5 text-xs font-mono ${
                        isReversed
                          ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                          : "text-slate-600"
                      }`}
                    >
                      <div>{t.beneficiaryBankName || owner?.bankName || "—"}</div>
                      <div className="text-slate-400 truncate max-w-[180px]">{t.beneficiaryIban || owner?.iban || "—"}</div>
                    </td>
                    <td
                      className={`px-5 py-3.5 font-bold font-mono ${
                        isReversed
                          ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                          : "text-emerald-700"
                      }`}
                    >
                      {t.amount.toLocaleString()} AED
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      {isReversed ? (
                        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          {isAr ? "محذوف" : "Deleted"}
                        </span>
                      ) : (
                        getStatusBadge(t.status)
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      {isReversed ? (
                        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          {isAr ? "محذوف" : "Deleted"}
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {t.status === "APPROVED" && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(t)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title={isAr ? "تعديل بيانات الحوالة" : "Edit Transfer"}
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => updateOwnerTransferStatus(t.id, "PAID")}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title={isAr ? "تأكيد إتمام التحويل البنكي" : "Mark as Paid"}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {(t.status === "PAID" || t.status === "RECONCILED" || t.status === "COMPLETED") && (
                            <button
                              onClick={() => setSelectedVoucherTransfer(t)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                              title={isAr ? "طباعة سند الدفع الرسمي" : "Print Payment Voucher"}
                            >
                              <Printer className="w-4 h-4" />
                              <span className="hidden xl:inline">{isAr ? "سند دفع" : "Voucher"}</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenReversal(t.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={isAr ? "عكس / إلغاء التحويل" : "Reverse Transfer"}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredTransfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {isAr ? "لا توجد سندات تحويل تطابق معايير البحث." : "No owner transfers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transfer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              {isAr ? "إصدار حوالة جديدة لصالح المالك" : "New Owner Transfer"}
            </h3>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "المالك المستفيد" : "Beneficiary Owner"}
                </label>
                <SearchableSelect
                  options={ownerOptions}
                  value={modalOwnerId}
                  onChange={handleOwnerSelect}
                  placeholder={isAr ? "ابحث واختر المالك..." : "Select Owner..."}
                />
              </div>

              {selectedOwnerPayable && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center pb-2 border-b border-indigo-100/80 mb-1">
                    <span className="text-xs text-slate-500 font-medium">{isAr ? "اسم المالك المستفيد:" : "Owner Name:"}</span>
                    <span className="text-xs font-bold text-indigo-950">
                      {owners.find((o) => o.id === modalOwnerId)?.nameAr || owners.find((o) => o.id === modalOwnerId)?.nameEn || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-indigo-900 font-medium">
                    <span>{isAr ? "إجمالي الإيجار المحصل:" : "Rent Collected:"}</span>
                    <span className="font-mono">{selectedOwnerPayable.totalRentCollected.toLocaleString()} AED</span>
                  </div>
                  <div className="flex justify-between text-xs text-indigo-900 font-medium">
                    <span>{isAr ? "الاستقطاعات (رسوم إدارية ومصاريف):" : "Deductions (Admin Fees + Exp):"}</span>
                    <span className="font-mono text-rose-600">- {(selectedOwnerPayable.totalOwnerCommissions + selectedOwnerPayable.totalOwnerExpenses).toLocaleString()} AED</span>
                  </div>
                  <div className="flex justify-between text-xs text-indigo-900 font-medium">
                    <span>{isAr ? "التحويلات المنفذة سابقاً:" : "Transfers Paid:"}</span>
                    <span className="font-mono text-slate-600">- {selectedOwnerPayable.totalTransfersPaid.toLocaleString()} AED</span>
                  </div>
                  <div className="pt-2 border-t border-indigo-200/80 flex justify-between text-sm font-bold text-indigo-950">
                    <span>{isAr ? "الرصيد المتاح للتحويل حالياً:" : "Current Payable Available:"}</span>
                    <span className="font-mono text-emerald-700">{selectedOwnerPayable.currentPayableBalance.toLocaleString()} AED</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "مبلغ التحويل (AED)" : "Amount (AED)"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={modalAmount || ""}
                    onChange={(e) => setModalAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "تاريخ التحويل" : "Transfer Date"}
                  </label>
                  <input
                    type="date"
                    value={modalTransferDate}
                    onChange={(e) => setModalTransferDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "طريقة الصرف" : "Payment Method"}
                  </label>
                  <SearchableSelect
                    options={[
                      { id: "BANK_TRANSFER", label: isAr ? "تحويل بنكي (Bank Transfer)" : "Bank Transfer" },
                      { id: "CHEQUE", label: isAr ? "شيك مسحوب (Cheque)" : "Cheque" },
                      { id: "CASH", label: isAr ? "نقداً (Cash)" : "Cash" },
                    ]}
                    value={modalPaymentMethod}
                    onChange={(val) => setModalPaymentMethod(val as PaymentMethod)}
                    placeholder={isAr ? "طريقة الصرف..." : "Payment method..."}
                    searchPlaceholder={isAr ? "ابحث بالطريقة..." : "Search method..."}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "المرجع / رقم المعاملة البنكية" : "Ref / Transaction ID"}
                  </label>
                  <input
                    type="text"
                    value={modalRefNumber}
                    onChange={(e) => setModalRefNumber(e.target.value)}
                    placeholder="e.g. FT26055..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "اسم البنك المستفيد" : "Beneficiary Bank"}
                  </label>
                  <input
                    type="text"
                    value={modalBankName}
                    onChange={(e) => setModalBankName(e.target.value)}
                    placeholder="e.g. Emirates NBD"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "رقم الآيبان (IBAN)" : "IBAN"}
                  </label>
                  <input
                    type="text"
                    value={modalIban}
                    onChange={(e) => setModalIban(e.target.value)}
                    placeholder="AE..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "ملاحظات إضافية" : "Notes"}
                </label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder={isAr ? "ملاحظات الدفعة وصرف الأمانات..." : "Notes..."}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-xs"
                >
                  {isAr ? "اعتماد وإصدار التحويل" : "Issue Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {isReversalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-rose-700 mb-2 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-600" />
              {isAr ? "إلغاء وعكس حوالة المالك" : "Reverse Owner Transfer"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {isAr
                ? "سيؤدي عكس الحوالة إلى إعادة إدراج المبلغ في رصيد المالك المستحق وإلغاء القيد مع تسجيل سجل تدقيق مالي غير قابل للحذف."
                : "Reversing this transfer will restore the payable balance to the owner and generate an immutable audit trail."}
            </p>

            {reversalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {reversalError}
              </div>
            )}

            <form onSubmit={handleConfirmReversal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "سبب الإلغاء والعكس (إلزامي للتدقيق)" : "Reversal Reason (Required)"}
                </label>
                <textarea
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder={isAr ? "توضيح سبب عكس الحوالة..." : "Provide clear justification..."}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReversalModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
                >
                  {isAr ? "تراجع" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors shadow-xs"
                >
                  {isAr ? "تأكيد العكس المالي" : "Confirm Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transfer Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {isAr ? "تعديل بيانات حوالة المالك" : "Edit Owner Transfer"}
            </h3>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "المالك المستفيد" : "Beneficiary Owner"}
                </label>
                <SearchableSelect
                  options={ownerOptions}
                  value={modalOwnerId}
                  onChange={handleOwnerSelect}
                  placeholder={isAr ? "ابحث واختر المالك..." : "Select Owner..."}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "مبلغ التحويل (AED)" : "Amount (AED)"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={modalAmount || ""}
                    onChange={(e) => setModalAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "تاريخ التحويل" : "Transfer Date"}
                  </label>
                  <input
                    type="date"
                    value={modalTransferDate}
                    onChange={(e) => setModalTransferDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "طريقة الصرف" : "Payment Method"}
                  </label>
                  <SearchableSelect
                    options={[
                      { id: "BANK_TRANSFER", label: isAr ? "تحويل بنكي (Bank Transfer)" : "Bank Transfer" },
                      { id: "CHEQUE", label: isAr ? "شيك مسحوب (Cheque)" : "Cheque" },
                      { id: "CASH", label: isAr ? "نقداً (Cash)" : "Cash" },
                    ]}
                    value={modalPaymentMethod}
                    onChange={(val) => setModalPaymentMethod(val as PaymentMethod)}
                    placeholder={isAr ? "طريقة الصرف..." : "Payment method..."}
                    searchPlaceholder={isAr ? "ابحث بالطريقة..." : "Search method..."}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "المرجع / رقم المعاملة البنكية" : "Ref / Transaction ID"}
                  </label>
                  <input
                    type="text"
                    value={modalRefNumber}
                    onChange={(e) => setModalRefNumber(e.target.value)}
                    placeholder="e.g. FT26055..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "اسم البنك المستفيد" : "Beneficiary Bank"}
                  </label>
                  <input
                    type="text"
                    value={modalBankName}
                    onChange={(e) => setModalBankName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "رقم الآيبان (IBAN)" : "IBAN"}
                  </label>
                  <input
                    type="text"
                    value={modalIban}
                    onChange={(e) => setModalIban(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "ملاحظات إضافية" : "Notes"}
                </label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-xs"
                >
                  {isAr ? "تحديث سند الحوالة" : "Update Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Owner Official Payment Voucher Modal */}
      {selectedVoucherTransfer && (
        <OwnerPaymentVoucherModal
          isOpen={!!selectedVoucherTransfer}
          onClose={() => setSelectedVoucherTransfer(null)}
          transfer={selectedVoucherTransfer}
          owner={owners.find((o) => o.id === selectedVoucherTransfer.ownerId)}
          properties={properties}
        />
      )}
    </div>
  );
};
