import React, { useState } from "react";
import {
  Clock,
  Search,
  Filter,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  User,
  Calendar,
  XCircle,
  CreditCard,
  Phone,
  ShieldAlert,
  ArrowDownLeft,
  FileCheck,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { DeferredPaymentRecord, PaymentMethod } from "../../types";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";

export const DeferredPaymentsTab: React.FC = () => {
  const { t, language } = useLanguage();
  const {
    deferredPayments,
    collectDeferredPayment,
    cancelDeferredPayment,
    dispatchDeferredReminderNotification,
    dispatchPaymentReceiptNotification,
  } = useData();
  const { currentUser, hasPermission } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [collectingRecord, setCollectingRecord] = useState<DeferredPaymentRecord | null>(null);
  const [cancellingRecord, setCancellingRecord] = useState<DeferredPaymentRecord | null>(null);

  // Collection modal state
  const [collectionAmount, setCollectionAmount] = useState<number>(0);
  const [collectionMethod, setCollectionMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [collectionNotes, setCollectionNotes] = useState<string>("");
  const [cancelReason, setCancelReason] = useState<string>("");

  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];

  // Helper to determine status with overdue check
  const getDynamicStatus = (def: DeferredPaymentRecord) => {
    if (def.status === "COLLECTED" || def.status === "CANCELLED") return def.status;
    if (def.expectedDueDate < todayStr) return "OVERDUE";
    // Check if within 5 days
    const dueObj = new Date(def.expectedDueDate);
    const todayObj = new Date(todayStr);
    const diffDays = Math.ceil((dueObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 5 && diffDays >= 0) return "DUE_SOON";
    return "PENDING";
  };

  // Filtered List
  const filtered = deferredPayments.filter((def) => {
    const dynStatus = getDynamicStatus(def);
    const matchesStatus = statusFilter === "ALL" || dynStatus === statusFilter;
    const matchesSearch =
      searchTerm === "" ||
      matchAnyArabicSearch(
        [
          def.deferredNumber,
          def.leaseNumber || "",
          def.tenantName || "",
          def.propertyName || "",
          def.unitNumber || "",
          def.responsiblePerson || "",
          def.deferralReason || "",
          def.notes || "",
        ],
        searchTerm
      );
    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalDeferredAmount = deferredPayments
    .filter((d) => d.status !== "CANCELLED")
    .reduce((sum, d) => sum + (d.deferredAmount || 0), 0);

  const totalCollectedAmount = deferredPayments
    .filter((d) => d.status !== "CANCELLED")
    .reduce((sum, d) => sum + (d.collectedAmount || 0), 0);

  const totalOutstandingAmount = deferredPayments
    .filter((d) => d.status !== "CANCELLED" && d.status !== "COLLECTED")
    .reduce((sum, d) => sum + (d.outstandingAmount || 0), 0);

  const overdueCount = deferredPayments.filter(
    (d) => d.status === "PENDING" && d.expectedDueDate < todayStr
  ).length;

  const handleOpenCollection = (def: DeferredPaymentRecord) => {
    setCollectingRecord(def);
    setCollectionAmount(def.outstandingAmount);
    setCollectionMethod("BANK_TRANSFER");
    setTransactionRef("");
    setCollectionNotes("");
    setActionError("");
  };

  const handleExecuteCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingRecord) return;
    if (collectionAmount <= 0 || collectionAmount > collectingRecord.outstandingAmount) {
      setActionError(language === "ar" ? "المبلغ المدخل غير صالح" : "Invalid collection amount");
      return;
    }

    const res = await collectDeferredPayment({
      deferredId: collectingRecord.id,
      amount: collectionAmount,
      paymentMethod: collectionMethod,
      transactionReference: transactionRef,
      notes: collectionNotes,
    });

    if (!res.success) {
      setActionError(res.error || "Failed to collect payment");
    } else {
      setActionSuccess(
        language === "ar"
          ? `تم تحصيل مبلغ ${collectionAmount.toLocaleString()} درهم بنجاح وإصدار سند قبض إلكتروني رقم #${res.receipt?.receiptNumber}.`
          : `Collection receipt #${res.receipt?.receiptNumber} generated successfully.`
      );
      if (res.receipt) {
        dispatchPaymentReceiptNotification(res.receipt.id, "WHATSAPP").catch(console.error);
      }
      setCollectingRecord(null);
    }
  };

  const handleConfirmCancel = () => {
    if (!cancellingRecord) return;
    if (!cancelReason.trim()) {
      setActionError(language === "ar" ? "سبب الإلغاء إلزامي" : "Cancellation reason is mandatory");
      return;
    }

    const res = cancelDeferredPayment(cancellingRecord.id, cancelReason);
    if (!res.success) {
      setActionError(res.error || "Failed to cancel deferred payment");
    } else {
      setActionSuccess(
        language === "ar"
          ? `تم إلغاء الدفعة المؤجلة #${cancellingRecord.deferredNumber} بنجاح.`
          : `Deferred payment #${cancellingRecord.deferredNumber} cancelled.`
      );
      setCancellingRecord(null);
      setCancelReason("");
    }
  };

  const handleSendReminder = async (
    def: DeferredPaymentRecord,
    targetType: "TENANT" | "RESPONSIBLE_EMPLOYEE"
  ) => {
    setActionError("");
    setActionSuccess("");
    const res = await dispatchDeferredReminderNotification(def.id, targetType);
    if (res.success) {
      setActionSuccess(res.message);
    } else {
      setActionError(res.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <div className="text-[11px] text-slate-500 font-bold mb-1">
            {language === "ar" ? "إجمالي الدفعات المؤجلة" : "Total Deferred Value"}
          </div>
          <div className="text-xl font-mono font-black text-slate-900">
            {totalDeferredAmount.toLocaleString()} <span className="text-xs text-slate-400 font-normal">AED</span>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl shadow-xs">
          <div className="text-[11px] text-amber-800 font-bold mb-1">
            {language === "ar" ? "الرصيد المتبقي للتحصيل" : "Outstanding Balance"}
          </div>
          <div className="text-xl font-mono font-black text-amber-900">
            {totalOutstandingAmount.toLocaleString()} <span className="text-xs text-amber-700 font-normal">AED</span>
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl shadow-xs">
          <div className="text-[11px] text-emerald-800 font-bold mb-1">
            {language === "ar" ? "المبالغ المحصلة فعلياً" : "Collected Amount"}
          </div>
          <div className="text-xl font-mono font-black text-emerald-900">
            {totalCollectedAmount.toLocaleString()} <span className="text-xs text-emerald-700 font-normal">AED</span>
          </div>
        </div>

        <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl shadow-xs">
          <div className="text-[11px] text-rose-800 font-bold mb-1">
            {language === "ar" ? "دفعات متأخرة عن موعدها" : "Overdue Count"}
          </div>
          <div className="text-xl font-mono font-black text-rose-700">{overdueCount}</div>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess("")} className="text-emerald-700 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError("")} className="text-rose-700 hover:text-rose-900">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "بحث برقم الدفعة، المستأجر، العقار، الموظف المسؤول..." : "Search deferred payments..."}
              className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 cursor-pointer"
            >
              <option value="ALL">{language === "ar" ? "كل الحالات" : "All Statuses"}</option>
              <option value="PENDING">{language === "ar" ? "معلقة (قيد الانتظار)" : "Pending"}</option>
              <option value="DUE_SOON">{language === "ar" ? "تستحق قريباً (خلال 5 أيام)" : "Due Soon"}</option>
              <option value="OVERDUE">{language === "ar" ? "متأخرة عن الاستحقاق" : "Overdue"}</option>
              <option value="COLLECTED">{language === "ar" ? "تم التحصيل بالكامل" : "Collected"}</option>
              <option value="CANCELLED">{language === "ar" ? "ملغاة" : "Cancelled"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deferred Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">{language === "ar" ? "رقم الدفعة / العقد" : "Deferred # / Lease"}</th>
                <th className="py-3 px-3">{language === "ar" ? "المستأجر" : "Tenant"}</th>
                <th className="py-3 px-3">{language === "ar" ? "العقار والوحدة" : "Property & Unit"}</th>
                <th className="py-3 px-3">{language === "ar" ? "المبلغ المؤجل" : "Deferred Amount"}</th>
                <th className="py-3 px-3">{language === "ar" ? "المتبقي للتحصيل" : "Outstanding"}</th>
                <th className="py-3 px-3">{language === "ar" ? "تاريخ الاستحقاق المتوقع" : "Expected Due Date"}</th>
                <th className="py-3 px-3">{language === "ar" ? "المسؤول والملاحظات" : "Responsible & Reason"}</th>
                <th className="py-3 px-3">{language === "ar" ? "الحالة" : "Status"}</th>
                <th className="py-3 px-3 text-center">{language === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((def) => {
                const dynStatus = getDynamicStatus(def);
                const isOverdue = dynStatus === "OVERDUE";
                const isDueSoon = dynStatus === "DUE_SOON";
                const isCollected = def.status === "COLLECTED";

                return (
                  <tr
                    key={def.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isOverdue ? "bg-rose-50/30" : isDueSoon ? "bg-amber-50/20" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-mono font-black text-slate-900">{def.deferredNumber}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{def.leaseNumber || "-"}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{def.tenantName || "-"}</div>
                      {def.tenantPhone && (
                        <div className="text-[10px] text-slate-500 font-mono">{def.tenantPhone}</div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">{def.propertyName || "-"}</div>
                      <div className="text-[10px] text-slate-500">
                        {language === "ar" ? "الوحدة:" : "Unit:"} {def.unitNumber || "-"}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {Number(def.deferredAmount || 0).toLocaleString()} <span className="text-[10px]">AED</span>
                    </td>

                    <td className="py-3 px-3 font-mono font-black">
                      <span className={def.outstandingAmount > 0 ? "text-amber-800" : "text-emerald-700"}>
                        {Number(def.outstandingAmount || 0).toLocaleString()} <span className="text-[10px]">AED</span>
                      </span>
                      {def.collectedAmount > 0 && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {language === "ar" ? "محصل:" : "Paid:"} {Number(def.collectedAmount || 0).toLocaleString()}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div
                        className={`font-mono font-bold text-xs ${
                          isOverdue
                            ? "text-rose-700 font-black"
                            : isDueSoon
                            ? "text-amber-800 font-black"
                            : "text-slate-800"
                        }`}
                      >
                        {def.expectedDueDate}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {def.allowedDays} {language === "ar" ? "يوماً مهلة" : "days grace"}
                      </div>
                    </td>

                    <td className="py-3 px-3 max-w-[160px]">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {def.responsiblePerson || "-"}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate" title={def.deferralReason}>
                        {def.deferralReason || "-"}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {dynStatus === "PENDING" && (
                        <Badge variant="neutral">{language === "ar" ? "معلقة" : "Pending"}</Badge>
                      )}
                      {dynStatus === "DUE_SOON" && (
                        <Badge variant="warning">{language === "ar" ? "تستحق قريباً" : "Due Soon"}</Badge>
                      )}
                      {dynStatus === "OVERDUE" && (
                        <Badge variant="danger">{language === "ar" ? "متأخرة" : "Overdue"}</Badge>
                      )}
                      {dynStatus === "COLLECTED" && (
                        <Badge variant="success">{language === "ar" ? "محصلة بالكامل" : "Collected"}</Badge>
                      )}
                      {dynStatus === "CANCELLED" && (
                        <Badge variant="danger">{language === "ar" ? "ملغاة" : "Cancelled"}</Badge>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Collect Button */}
                        {!isCollected && def.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleOpenCollection(def)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            title={language === "ar" ? "تسجيل سند تحصيل" : "Collect"}
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{language === "ar" ? "تحصيل" : "Collect"}</span>
                          </button>
                        )}

                        {/* WhatsApp Tenant Reminder */}
                        {!isCollected && def.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleSendReminder(def, "TENANT")}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title={language === "ar" ? "إرسال تذكير واتساب للمستأجر" : "WhatsApp Tenant Reminder"}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Cancel Button */}
                        {!isCollected && def.status !== "CANCELLED" && (
                          <button
                            onClick={() => setCancellingRecord(def)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={language === "ar" ? "إلغاء الدفعة المؤجلة" : "Cancel"}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs">
            {t("noDataFound")}
          </div>
        )}
      </div>

      {/* Collect Deferred Payment Modal */}
      <Modal
        isOpen={!!collectingRecord}
        onClose={() => setCollectingRecord(null)}
        title={language === "ar" ? "تحصيل دفعة إيجارية مؤجلة" : "Collect Deferred Rent Payment"}
        subtitle={
          collectingRecord
            ? `${collectingRecord.deferredNumber} • ${collectingRecord.tenantName || ""}`
            : ""
        }
        icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
        maxWidth="md"
      >
        {collectingRecord && (
          <form onSubmit={handleExecuteCollection} className="space-y-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{language === "ar" ? "المبلغ المؤجل الأصلي:" : "Original Amount:"}</span>
                <span className="font-mono font-bold text-slate-900">
                  {Number(collectingRecord.deferredAmount || 0).toLocaleString()} AED
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === "ar" ? "المتبقي للتحصيل:" : "Outstanding Balance:"}</span>
                <span className="font-mono font-black text-amber-800">
                  {Number(collectingRecord.outstandingAmount || 0).toLocaleString()} AED
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === "ar" ? "تاريخ الاستحقاق المتوقع:" : "Expected Due Date:"}</span>
                <span className="font-mono font-bold text-slate-900">{collectingRecord.expectedDueDate}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "مبلغ التحصيل (درهم)" : "Collection Amount (AED)"} *
              </label>
              <input
                type="number"
                min={1}
                max={collectingRecord.outstandingAmount}
                required
                value={collectionAmount || ""}
                onChange={(e) => setCollectionAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-black text-emerald-800 text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "طريقة التحصيل" : "Payment Method"} *
              </label>
              <select
                value={collectionMethod}
                onChange={(e) => setCollectionMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-800 cursor-pointer"
              >
                <option value="BANK_TRANSFER">{language === "ar" ? "تحويل بنكي (Bank Transfer)" : "Bank Transfer"}</option>
                <option value="CASH">{language === "ar" ? "نقداً (Cash)" : "Cash"}</option>
                <option value="CHEQUE">{language === "ar" ? "شيك بنكي (Cheque)" : "Cheque"}</option>
                <option value="CREDIT_CARD">{language === "ar" ? "بطاقة ائتمان (Credit Card)" : "Credit Card"}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "رقم المرجع / الحوالة / الشيك" : "Transaction / Reference #"}
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="REF-12345..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "ملاحظات التحصيل" : "Collection Notes"}
              </label>
              <input
                type="text"
                value={collectionNotes}
                onChange={(e) => setCollectionNotes(e.target.value)}
                placeholder={language === "ar" ? "ملاحظات السداد..." : "Notes..."}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCollectingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{language === "ar" ? "تأكيد التحصيل وإصدار سند القبض" : "Confirm & Issue Receipt"}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={!!cancellingRecord}
        onClose={() => setCancellingRecord(null)}
        title={language === "ar" ? "إلغاء الدفعة المؤجلة" : "Cancel Deferred Payment"}
        subtitle={cancellingRecord ? `${cancellingRecord.deferredNumber} • ${cancellingRecord.tenantName || ""}` : ""}
        icon={<XCircle className="w-5 h-5 text-rose-600" />}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === "ar" ? "سبب الإلغاء (إلزامي في سجل التدقيق)" : "Cancellation Reason (Mandatory)"} *
            </label>
            <textarea
              required
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={language === "ar" ? "اكتب سبب إلغاء الدفعة المؤجلة..." : "Reason for cancelling..."}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCancellingRecord(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
            >
              {language === "ar" ? "تأكيد الإلغاء" : "Confirm Cancel"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
