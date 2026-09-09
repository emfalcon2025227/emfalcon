import React, { useState, useMemo } from "react";
import {
  X,
  History,
  Building2,
  User,
  CreditCard,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { Cheque, ChequeStatus, ReturnReason } from "../../types";

interface LegacyChequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newCheque: Cheque) => void;
}

export const LegacyChequeModal: React.FC<LegacyChequeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    tenants,
    properties,
    units,
    owners,
    leases,
    addCheque,
    checkDuplicateCheque,
  } = useData();

  const [leaseId, setLeaseId] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");

  const [chequeNumber, setChequeNumber] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [drawerName, setDrawerName] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [status, setStatus] = useState<ChequeStatus>("POST_DATED");
  const [bouncedReason, setBouncedReason] = useState<ReturnReason>("INSUFFICIENT_FUNDS");
  const [returnedDate, setReturnedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-fill when Lease is selected
  const handleLeaseChange = (selectedLeaseId: string) => {
    setLeaseId(selectedLeaseId);
    if (!selectedLeaseId) return;

    const lease = leases.find((l) => l.id === selectedLeaseId);
    if (lease) {
      setTenantId(lease.tenantId || "");
      setPropertyId(lease.propertyId || "");
      setUnitId(lease.unitId || "");
      if (lease.propertyId) {
        const prop = properties.find((p) => p.id === lease.propertyId);
        if (prop?.ownerId) {
          setOwnerId(prop.ownerId);
        }
      }
      const tenant = tenants.find((t) => t.id === lease.tenantId);
      if (tenant) {
        setDrawerName(tenant.nameAr || tenant.nameEn || "");
      }
    }
  };

  // Lease Options
  const leaseOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      {
        id: "",
        label: isAr ? "-- بدون ربط بعقد حالي (تسجيل شيك حر/سابق) --" : "-- No Lease Link (Unlinked Legacy Cheque) --",
      },
    ];
    leases.forEach((l) => {
      const tenant = tenants.find((t) => t.id === l.tenantId);
      const prop = properties.find((p) => p.id === l.propertyId);
      list.push({
        id: l.id,
        label: `${isAr ? "عقد #" : "Lease #"}${l.leaseNumber || l.id}`,
        subLabel: `${tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : ""} | ${prop ? (isAr ? prop.nameAr : prop.nameEn) : ""}`,
        badge: l.contractStatus,
      });
    });
    return list;
  }, [leases, tenants, properties, isAr]);

  // Tenant Options
  const tenantOptions: SearchableOption[] = useMemo(() => {
    return tenants.map((t) => ({
      id: t.id,
      label: isAr ? t.nameAr : t.nameEn,
      subLabel: `${isAr ? "الهاتف" : "Phone"}: ${t.phone || "—"} | ${isAr ? "الهوية" : "ID"}: ${t.emiratesId || "—"}`,
    }));
  }, [tenants, isAr]);

  // Owner Options
  const ownerOptions: SearchableOption[] = useMemo(() => {
    return owners.map((o) => ({
      id: o.id,
      label: isAr ? o.nameAr : o.nameEn,
      subLabel: `${isAr ? "الهاتف" : "Phone"}: ${o.phone || "—"}`,
    }));
  }, [owners, isAr]);

  // Property Options
  const propertyOptions: SearchableOption[] = useMemo(() => {
    return properties.map((p) => {
      const owner = owners.find((o) => o.id === p.ownerId);
      return {
        id: p.id,
        label: isAr ? p.nameAr : p.nameEn,
        subLabel: owner ? `${isAr ? "المالك" : "Owner"}: ${isAr ? owner.nameAr : owner.nameEn}` : undefined,
      };
    });
  }, [properties, owners, isAr]);

  // Unit Options
  const unitOptions: SearchableOption[] = useMemo(() => {
    const filteredUnits = propertyId
      ? units.filter((u) => u.propertyId === propertyId)
      : units;
    return filteredUnits.map((u) => ({
      id: u.id,
      label: `${isAr ? "وحدة رقم" : "Unit #"} ${u.unitNumber}`,
      subLabel: u.status,
    }));
  }, [units, propertyId, isAr]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmount = parseFloat(amount);
    if (!chequeNumber.trim()) {
      setErrorMsg(isAr ? "يرجى إدخال رقم الشيك." : "Please enter cheque number.");
      return;
    }
    if (!bankName.trim()) {
      setErrorMsg(isAr ? "يرجى إدخال اسم البنك." : "Please enter bank name.");
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setErrorMsg(isAr ? "يرجى إدخال مبلغ صحيح للشيك." : "Please enter valid cheque amount.");
      return;
    }
    if (!tenantId) {
      setErrorMsg(isAr ? "يرجى تحديد المستأجر صاحب الشيك." : "Please select the tenant.");
      return;
    }

    // Duplicate Check
    const dup = checkDuplicateCheque(chequeNumber.trim(), drawerName.trim(), leaseId, tenantId);
    if (dup) {
      setErrorMsg(
        isAr
          ? `الشيك رقم #${chequeNumber} مسجل مسبقاً في النظام لهذا المستأجر/العقد.`
          : `Cheque #${chequeNumber} already exists in the system for this tenant/lease.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const outstandingAmount =
        status === "CLEARED" || status === "COLLECTED" ? 0 : numAmount;

      const newChequeData: Parameters<typeof addCheque>[0] = {
        leaseId: leaseId || "LEGACY_NO_LEASE",
        tenantId,
        ownerId: ownerId || "LEGACY_OWNER",
        propertyId: propertyId || "LEGACY_PROP",
        unitId: unitId || "LEGACY_UNIT",
        chequeNumber: chequeNumber.trim(),
        bankName: bankName.trim(),
        amount: numAmount,
        chequeDate,
        dueDate,
        status,
        originalStatus: status === "BOUNCED" ? "BOUNCED" : "NORMAL",
        returnReason: status === "BOUNCED" ? bouncedReason : undefined,
        returnedDate: status === "BOUNCED" ? returnedDate : undefined,
        collectionStatus: status === "COLLECTED" ? "FULLY_COLLECTED_AFTER_BOUNCE" : "NOT_COLLECTED",
        isLegacy: true,
        notes: `[شيك سابق/تاريخي - Legacy Record] ${notes}`.trim(),
      };

      const created = addCheque(newChequeData);
      if (!created || !created.id) {
        throw new Error("Failed to add legacy cheque");
      }

      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <History className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                {isAr ? "تسجيل شيك قديم / سابق (Legacy Cheque Registration)" : "Legacy Cheque Entry"}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {isAr
                  ? "تسجيل شيكات العقود السابقة أو الشيكات التاريخية التي لم تصدر عبر النظام"
                  : "Register historical or legacy cheques not originated in current system"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Optional Lease Link */}
          <div>
            <SearchableSelect
              label={isAr ? "ربط بعقد إيجاري (اختياري)" : "Link to Lease (Optional)"}
              options={leaseOptions}
              value={leaseId}
              onChange={handleLeaseChange}
              searchPlaceholder={isAr ? "ابحث برقم العقد..." : "Search lease..."}
            />
          </div>

          {/* Tenant & Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <SearchableSelect
                label={isAr ? "المستأجر (Tenant) *" : "Tenant *"}
                options={tenantOptions}
                value={tenantId}
                onChange={(val) => {
                  setTenantId(val);
                  const t = tenants.find((item) => item.id === val);
                  if (t && !drawerName) {
                    setDrawerName(t.nameAr || t.nameEn || "");
                  }
                }}
                searchPlaceholder={isAr ? "اختر المستأجر..." : "Select tenant..."}
              />
            </div>

            <div>
              <SearchableSelect
                label={isAr ? "مالك العقار (Property Owner)" : "Property Owner"}
                options={ownerOptions}
                value={ownerId}
                onChange={(val) => setOwnerId(val)}
                searchPlaceholder={isAr ? "اختر المالك..." : "Select owner..."}
              />
            </div>
          </div>

          {/* Property & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <SearchableSelect
                label={isAr ? "العقار (Property)" : "Property"}
                options={propertyOptions}
                value={propertyId}
                onChange={(val) => {
                  setPropertyId(val);
                  setUnitId("");
                }}
                searchPlaceholder={isAr ? "اختر العقار..." : "Select property..."}
              />
            </div>

            <div>
              <SearchableSelect
                label={isAr ? "الوحدة الإيجارية (Unit)" : "Unit"}
                options={unitOptions}
                value={unitId}
                onChange={(val) => setUnitId(val)}
                searchPlaceholder={isAr ? "اختر الوحدة..." : "Select unit..."}
              />
            </div>
          </div>

          {/* Cheque Core Details */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              {isAr ? "بيانات ورقة الشيك" : "Cheque Instrument Details"}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "رقم الشيك *" : "Cheque Number *"}
                </label>
                <input
                  type="text"
                  required
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "اسم البنك *" : "Bank Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "المبلغ (درهم) *" : "Amount (AED) *"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-black text-emerald-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "تاريخ تحرير الشيك" : "Cheque Date"}
                </label>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "تاريخ الاستحقاق *" : "Due Date *"}
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "اسم الساحب" : "Drawer Name"}
                </label>
                <input
                  type="text"
                  value={drawerName}
                  onChange={(e) => setDrawerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "رقم الحساب" : "Account Number"}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Historical Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? "الحالة الحالية للشيك *" : "Current Cheque Status *"}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ChequeStatus)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="POST_DATED">{isAr ? "شيك آجل (Post-Dated)" : "Post-Dated"}</option>
                <option value="PENDING">{isAr ? "قيد التحصيل (Pending)" : "Pending"}</option>
                <option value="DEPOSITED">{isAr ? "مودع بالبنك (Deposited)" : "Deposited"}</option>
                <option value="CLEARED">{isAr ? "مصروف بنكياً (Cleared)" : "Cleared"}</option>
                <option value="COLLECTED">{isAr ? "تم السداد بسند (Collected)" : "Collected"}</option>
                <option value="BOUNCED">{isAr ? "شيك راجع/مرتجع (Bounced)" : "Bounced"}</option>
              </select>
            </div>

            {status === "BOUNCED" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? "سبب الارتجاع البنكي *" : "Return Reason *"}
                </label>
                <select
                  value={bouncedReason}
                  onChange={(e) => setBouncedReason(e.target.value as ReturnReason)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 font-semibold text-rose-700"
                >
                  <option value="INSUFFICIENT_FUNDS">{isAr ? "عدم كفاية الرصيد" : "Insufficient Funds"}</option>
                  <option value="SIGNATURE_MISMATCH">{isAr ? "اختلاف التوقيع" : "Signature Mismatch"}</option>
                  <option value="ACCOUNT_CLOSED">{isAr ? "الحساب مغلق" : "Account Closed"}</option>
                  <option value="DORMANT_ACCOUNT">{isAr ? "حساب مجمد/خامل" : "Dormant Account"}</option>
                  <option value="STOP_PAYMENT">{isAr ? "أمر إيقاف صرف" : "Stop Payment"}</option>
                  <option value="IRREGULAR_WORDS_FIGURES">{isAr ? "اختلاف الأرقام عن الحروف" : "Words/Figures Mismatch"}</option>
                  <option value="TECHNICAL_REASON">{isAr ? "أسباب فنية أخرى" : "Other Technical Reason"}</option>
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "ملاحظات إضافية وتوثيق تاريخي" : "Historical Notes & Context"}
            </label>
            <input
              type="text"
              placeholder={isAr ? "سجل أي ملاحظات خاصة بهذا الشيك..." : "Enter any specific legacy remarks..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>{isAr ? "جارٍ الحفظ..." : "Saving..."}</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{isAr ? "حفظ وتوثيق الشيك السابق" : "Save Legacy Cheque"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
