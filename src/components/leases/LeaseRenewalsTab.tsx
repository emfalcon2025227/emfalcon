import React, { useState } from "react";
import {
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Printer,
  Eye,
  Building,
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { LeaseRenewalRecord, LeaseRenewalStatus } from "../../types";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";

interface LeaseRenewalsTabProps {
  onOpenRenewModal?: () => void;
}

export const LeaseRenewalsTab: React.FC<LeaseRenewalsTabProps> = ({
  onOpenRenewModal,
}) => {
  const { t, language } = useLanguage();
  const {
    leaseRenewals,
    approveLeaseRenewal,
    rejectLeaseRenewal,
    dispatchRenewalNotification,
  } = useData();
  const { currentUser, hasPermission } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedRenewal, setSelectedRenewal] = useState<LeaseRenewalRecord | null>(null);
  const [rejectingRenewal, setRejectingRenewal] = useState<LeaseRenewalRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [expandedRenewalId, setExpandedRenewalId] = useState<string | null>(null);

  const canApprove = true;

  // Filtering
  const filtered = leaseRenewals.filter((r) => {
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchesSearch =
      searchTerm === "" ||
      matchAnyArabicSearch(
        [
          r.renewalNumber,
          r.originalLeaseNumber,
          r.newLeaseNumber || "",
          r.tenantNameAr || "",
          r.tenantNameEn || "",
          r.propertyNameAr || "",
          r.propertyNameEn || "",
          r.unitNumber || "",
          r.notes || "",
        ],
        searchTerm
      );
    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalCount = leaseRenewals.length;
  const pendingCount = leaseRenewals.filter((r) => r.status === "PENDING_APPROVAL").length;
  const approvedCount = leaseRenewals.filter((r) => r.status === "APPROVED").length;
  const totalRenewedValue = leaseRenewals
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, r) => sum + (r.newAnnualRent || 0), 0);

  const handleApprove = (renewal: LeaseRenewalRecord) => {
    setActionError("");
    setActionSuccess("");
    const res = approveLeaseRenewal(renewal.id);
    if (!res.success) {
      setActionError(res.error || "Failed to approve renewal");
    } else {
      setActionSuccess(
        language === "ar"
          ? `تم اعتماد تجديد العقد #${renewal.renewalNumber} وتفعيل العقد الجديد #${res.newLease?.leaseNumber} بنجاح.`
          : `Renewal #${renewal.renewalNumber} approved successfully.`
      );
    }
  };

  const handleConfirmReject = () => {
    if (!rejectingRenewal) return;
    if (!rejectionReason.trim()) {
      setActionError(language === "ar" ? "يرجى كتابة سبب الرفض" : "Please provide a rejection reason");
      return;
    }

    const res = rejectLeaseRenewal(rejectingRenewal.id, rejectionReason);
    if (!res.success) {
      setActionError(res.error || "Failed to reject renewal");
    } else {
      setActionSuccess(
        language === "ar"
          ? `تم رفض طلب التجديد #${rejectingRenewal.renewalNumber} وإعادة العقد لحالته السابقة.`
          : `Renewal #${rejectingRenewal.renewalNumber} rejected.`
      );
      setRejectingRenewal(null);
      setRejectionReason("");
    }
  };

  const handleSendNotification = async (renewal: LeaseRenewalRecord) => {
    setActionError("");
    setActionSuccess("");
    const res = await dispatchRenewalNotification(renewal.id, "WHATSAPP");
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
            {language === "ar" ? "إجمالي طلبات التجديد" : "Total Renewals"}
          </div>
          <div className="text-xl font-mono font-black text-slate-900">{totalCount}</div>
        </div>

        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl shadow-xs">
          <div className="text-[11px] text-amber-800 font-bold mb-1">
            {language === "ar" ? "بانتظار الاعتماد" : "Pending Approval"}
          </div>
          <div className="text-xl font-mono font-black text-amber-900">{pendingCount}</div>
        </div>

        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl shadow-xs">
          <div className="text-[11px] text-emerald-800 font-bold mb-1">
            {language === "ar" ? "العقود المعتمدة والمجددة" : "Approved & Active"}
          </div>
          <div className="text-xl font-mono font-black text-emerald-900">{approvedCount}</div>
        </div>

        <div className="p-3.5 bg-slate-900 text-white border border-slate-800 rounded-2xl shadow-xs">
          <div className="text-[11px] text-slate-400 font-bold mb-1">
            {language === "ar" ? "إجمالي قيمة التجديدات" : "Total Renewed Rent"}
          </div>
          <div className="text-lg font-mono font-black text-amber-400">
            {totalRenewedValue.toLocaleString()} <span className="text-xs text-slate-300 font-normal">AED</span>
          </div>
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

      {/* Action and Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "بحث برقم التجديد، المستأجر، العقار، الوحدة..." : "Search renewals..."}
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
              <option value="PENDING_APPROVAL">{language === "ar" ? "قيد الاعتماد" : "Pending Approval"}</option>
              <option value="APPROVED">{language === "ar" ? "معتمد ومجدد" : "Approved"}</option>
              <option value="REJECTED">{language === "ar" ? "مرفوض" : "Rejected"}</option>
            </select>
          </div>
        </div>

        {onOpenRenewModal && (
          <button
            onClick={onOpenRenewModal}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{language === "ar" ? "إنشاء طلب تجديد عقد جديد" : "New Renewal Request"}</span>
          </button>
        )}
      </div>

      {/* Renewals Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">{language === "ar" ? "رقم التجديد / العقد" : "Renewal / Lease #"}</th>
                <th className="py-3 px-3">{language === "ar" ? "المستأجر" : "Tenant"}</th>
                <th className="py-3 px-3">{language === "ar" ? "العقار والوحدة" : "Property & Unit"}</th>
                <th className="py-3 px-3">{language === "ar" ? "القيمة السابقة" : "Old Rent"}</th>
                <th className="py-3 px-3">{language === "ar" ? "القيمة الجديدة والزيادة" : "New Rent & Increase"}</th>
                <th className="py-3 px-3">{language === "ar" ? "الفترة الجديدة" : "New Period"}</th>
                <th className="py-3 px-3">{language === "ar" ? "الحالة" : "Status"}</th>
                <th className="py-3 px-3 text-center">{language === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const isExpanded = expandedRenewalId === r.id;
                const increase = r.increasePercentage || 0;
                const isPending = r.status === "PENDING_APPROVAL";
                const isApproved = r.status === "APPROVED";

                return (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-mono font-black text-amber-900">{r.renewalNumber}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {r.newLeaseNumber || r.originalLeaseNumber}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {r.tenantNameAr || r.tenantNameEn || "-"}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">
                          {r.propertyNameAr || r.propertyNameEn || "-"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {language === "ar" ? "الوحدة:" : "Unit:"} {r.unitNumber || "-"}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-600">
                        {Number(r.currentAnnualRent || 0).toLocaleString()} <span className="text-[10px]">AED</span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-black text-emerald-800">
                          {Number(r.newAnnualRent || 0).toLocaleString()} <span className="text-[10px]">AED</span>
                        </div>
                        <div className="text-[10px] font-mono">
                          <span className={increase >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {increase >= 0 ? `+${increase.toFixed(1)}%` : `${increase.toFixed(1)}%`}
                          </span>
                          {" • "}
                          <span className="text-slate-400">
                            {r.installmentsCount} {language === "ar" ? "دفعات" : "inst."}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        <div>{r.newStartDate}</div>
                        <div className="text-slate-400 text-[10px]">→ {r.newEndDate}</div>
                      </td>

                      <td className="py-3 px-3">
                        {isPending && <Badge variant="warning">{language === "ar" ? "قيد الاعتماد" : "Pending"}</Badge>}
                        {isApproved && <Badge variant="success">{language === "ar" ? "معتمد ومجدد" : "Approved"}</Badge>}
                        {r.status === "REJECTED" && <Badge variant="danger">{language === "ar" ? "مرفوض" : "Rejected"}</Badge>}
                        {r.status === "DRAFT" && <Badge variant="neutral">{language === "ar" ? "مسودة" : "Draft"}</Badge>}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Details Toggle */}
                          <button
                            onClick={() => setExpandedRenewalId(isExpanded ? null : r.id)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title={language === "ar" ? "عرض جدول الدفعات" : "View Schedule"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>

                          {/* Approval Actions (Super Admin / Manager) */}
                          {isPending && canApprove && (
                            <>
                              <button
                                onClick={() => handleApprove(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                title={language === "ar" ? "اعتماد وتفعيل التجديد" : "Approve"}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{language === "ar" ? "اعتماد" : "Approve"}</span>
                              </button>

                              <button
                                onClick={() => setRejectingRenewal(r)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title={language === "ar" ? "رفض الطلب" : "Reject"}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* WhatsApp Notification */}
                          <button
                            onClick={() => handleSendNotification(r)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title={language === "ar" ? "إرسال إشعار واتساب للمستأجر" : "Send WhatsApp Alert"}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Schedule Preview */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={8} className="p-4 border-y border-slate-200">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-amber-700" />
                                <span>
                                  {language === "ar" ? "جدول الدفعات والشيكات لعقد التجديد" : "Payment Schedule & Cheques"}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {language === "ar" ? "أنشئ بواسطة:" : "Created by:"}{" "}
                                <span className="font-bold text-slate-800">{r.createdByName}</span> (
                                {r.createdAt?.split("T")[0]})
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              {(r.paymentSchedule || []).map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-700">
                                      {language === "ar" ? `الدفعة ${idx + 1}` : `Inst. #${idx + 1}`}
                                    </span>
                                    <span className="font-mono font-black text-emerald-700">
                                      {item.amount.toLocaleString()} AED
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    {language === "ar" ? "الاستحقاق:" : "Due:"} {item.dueDate}
                                  </div>
                                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                                    <Badge
                                      variant={
                                        item.paymentMethod === "DEFERRED"
                                          ? "warning"
                                          : item.paymentMethod === "CHEQUE"
                                          ? "info"
                                          : "success"
                                      }
                                    >
                                      {item.paymentMethod === "DEFERRED"
                                        ? language === "ar"
                                          ? "مؤجلة"
                                          : "Deferred"
                                        : item.paymentMethod === "CHEQUE"
                                        ? language === "ar"
                                          ? "شيك"
                                          : "Cheque"
                                        : item.paymentMethod}
                                    </Badge>
                                    {item.isAdvance && (
                                      <span className="text-emerald-700 font-bold">
                                        {language === "ar" ? "مقدمة" : "Advance"}
                                      </span>
                                    )}
                                  </div>
                                  {item.deferredDetails && (
                                    <div className="text-[10px] text-amber-800 bg-amber-50 p-1 rounded font-medium">
                                      {language === "ar" ? "تاريخ الاستحقاق المتوقع:" : "Expected Due:"}{" "}
                                      <span className="font-bold font-mono">
                                        {item.deferredDetails.expectedDueDate}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {r.notes && (
                              <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                                <span className="font-bold">{language === "ar" ? "ملاحظات:" : "Notes:"}</span>{" "}
                                {r.notes}
                              </div>
                            )}

                            {r.rejectionReason && (
                              <div className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                                <span className="font-bold">{language === "ar" ? "سبب الرفض:" : "Rejection Reason:"}</span>{" "}
                                {r.rejectionReason}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectingRenewal}
        onClose={() => setRejectingRenewal(null)}
        title={language === "ar" ? "رفض طلب تجديد عقد الإيجار" : "Reject Lease Renewal Request"}
        subtitle={rejectingRenewal ? `${rejectingRenewal.renewalNumber} — ${rejectingRenewal.tenantNameAr || ""}` : ""}
        icon={<XCircle className="w-5 h-5 text-rose-600" />}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>
              {language === "ar"
                ? "سيتم رفض طلب التجديد وإعادة العقد الأصلي إلى حالته السارية المعتادة وتسجيل سبب الرفض في سجل التدقيق."
                : "The renewal request will be rejected, reverting original contract status."}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === "ar" ? "سبب الرفض (إلزامي)" : "Rejection Reason (Mandatory)"} *
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={
                language === "ar"
                  ? "اكتب سبب رفض طلب التجديد (مثال: عدم الاتفاق على القيمة الإيجارية أو عدم تسليم الشيكات)..."
                  : "State the reason for rejection..."
              }
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRejectingRenewal(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
            >
              {language === "ar" ? "تأكيد الرفض" : "Confirm Rejection"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
