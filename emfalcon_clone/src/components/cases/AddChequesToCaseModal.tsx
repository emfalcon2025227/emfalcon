import React, { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Search,
  Building,
  User,
  Calendar,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Case, Cheque } from "../../types";
import { Badge } from "../common/Badge";

interface AddChequesToCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: Case | null;
}

export const AddChequesToCaseModal: React.FC<AddChequesToCaseModalProps> = ({
  isOpen,
  onClose,
  caseItem,
}) => {
  const { language, t } = useLanguage();
  const { cheques, tenants, cases, linkChequesToCase } = useData();

  const [selectedChequeIds, setSelectedChequeIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !caseItem) return null;

  const tenant = tenants.find((t) => t.id === caseItem.tenantId);

  // Eligible cheques: belongs to case tenant AND is returned/bounced AND not linked to another case AND outstanding > 0
  const eligibleCheques = cheques.filter((c) => {
    if (c.tenantId !== caseItem.tenantId) return false;

    // Exclude collected cheques or cheques with no remaining balance
    if (c.status === "COLLECTED" || c.outstanding <= 0) return false;

    // Exclude cheques already linked to THIS case
    const isAlreadyInThisCase = caseItem.linkedChequeIds?.includes(c.id);
    if (isAlreadyInThisCase) return false;

    // Exclude cheques linked to ANOTHER active case
    const isLinkedToAnotherActiveCase = cases.some(
      (cas) => cas.id !== caseItem.id && cas.linkedChequeIds?.includes(c.id) && cas.status !== "CLOSED" && cas.status !== "ARCHIVED"
    );
    if (isLinkedToAnotherActiveCase) return false;

    const isBounced = c.originalStatus === "BOUNCED" || c.status === "BOUNCED" || c.status === "UNDER_LEGAL";
    if (!isBounced) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchNo = c.chequeNumber?.toLowerCase().includes(term);
      const matchBank = c.bankName?.toLowerCase().includes(term);
      const matchReason = c.returnReason?.toLowerCase().includes(term);
      return matchNo || matchBank || matchReason;
    }

    return true;
  });

  const handleToggle = (id: string) => {
    setSelectedChequeIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedChequeIds.length === eligibleCheques.length) {
      setSelectedChequeIds([]);
    } else {
      setSelectedChequeIds(eligibleCheques.map((c) => c.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedChequeIds.length === 0) return;

    setErrorMsg(null);

    const res = linkChequesToCase(
      caseItem.id,
      selectedChequeIds,
      `Linked via Add Cheques to Case Modal`
    );

    if (res.success) {
      setSelectedChequeIds([]);
      onClose();
    } else {
      if (res.error?.startsWith("CONFLICT_LINKED:")) {
        setErrorMsg(
          language === "ar"
            ? `بعض الشيكات المختارة مرتبطة بالفعل بقضايا نشطة أخرى: ${res.error.replace(
                "CONFLICT_LINKED:",
                ""
              )}`
            : `Some selected cheques are already linked to other active cases: ${res.error.replace(
                "CONFLICT_LINKED:",
                ""
              )}`
        );
      } else {
        setErrorMsg(res.error || (language === "ar" ? "تعذر إضافة الشيكات للقضية" : "Failed to add cheques"));
      }
    }
  };

  const totalSelectedAmount = cheques
    .filter((c) => selectedChequeIds.includes(c.id))
    .reduce((sum, c) => sum + c.outstanding, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        language === "ar"
          ? `إضافة شيكات مرتجعة إلى القضية: ${caseItem.caseNumber}`
          : `Add Returned Cheques to Case: ${caseItem.caseNumber}`
      }
      subtitle={
        language === "ar"
          ? `المستأجر: ${tenant ? tenant.nameAr : "غير محدد"} — يمكنك اختيار شيك أو أكثر من قائمة شيكات المستأجر`
          : `Tenant: ${tenant ? tenant.nameEn : "N/A"} — Select one or more bounced cheques`
      }
      icon={<CreditCard className="w-5 h-5 text-purple-600" />}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Search & Select All Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "ابحث برقم الشيك أو البنك..." : "Search cheque no or bank..."}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200"
            >
              {selectedChequeIds.length === eligibleCheques.length && eligibleCheques.length > 0
                ? language === "ar"
                  ? "إلغاء تحديد الكل"
                  : "Deselect All"
                : language === "ar"
                ? "تحديد كافة الشيكات"
                : "Select All Eligible"}
            </button>
            <span className="text-slate-500 font-bold text-[11px]">
              {selectedChequeIds.length} / {eligibleCheques.length} {language === "ar" ? "محدد" : "selected"}
            </span>
          </div>
        </div>

        {/* Eligible Cheques List */}
        {eligibleCheques.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <p className="font-bold text-slate-600">
              {language === "ar"
                ? "لا توجد شيكات مرتجعة أخرى متاحة لهذا المستأجر لإضافتها للقضية."
                : "No other available bounced cheques found for this tenant."}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {eligibleCheques.map((c) => {
              const isChecked = selectedChequeIds.includes(c.id);
              const otherCase = cases.find(
                (cas) => cas.id !== caseItem.id && cas.linkedChequeIds?.includes(c.id) && cas.status !== "CLOSED"
              );

              return (
                <label
                  key={c.id}
                  className={`block p-3 rounded-2xl border transition-all cursor-pointer ${
                    isChecked
                      ? "border-purple-600 bg-purple-50/70 shadow-xs ring-2 ring-purple-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(c.id)}
                        className="w-4 h-4 text-purple-600 rounded-md"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">
                            {language === "ar" ? `شيك رقم: ${c.chequeNumber}` : `Cheque #${c.chequeNumber}`}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                            {c.bankName}
                          </span>
                          {c.returnReason && (
                            <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-bold">
                              {c.returnReason}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
                          <span>{language === "ar" ? `التاريخ: ${c.chequeDate}` : `Date: ${c.chequeDate}`}</span>
                          {otherCase && (
                            <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                              ⚠️ {language === "ar" ? `مرتبط بـ ${otherCase.caseNumber}` : `Linked in ${otherCase.caseNumber}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-bold block">{language === "ar" ? "المبلغ المستحق" : "Outstanding"}</span>
                      <span className="text-xs font-black text-rose-700 font-mono">
                        AED {c.outstanding.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* Financial Calculation Bar */}
        {selectedChequeIds.length > 0 && (
          <div className="p-3 bg-purple-900 text-white rounded-2xl flex items-center justify-between font-bold">
            <span>
              {language === "ar"
                ? `المبلغ الإجمالي للشيكات المحددة (${selectedChequeIds.length}):`
                : `Total for selected cheques (${selectedChequeIds.length}):`}
            </span>
            <span className="text-sm font-black font-mono text-purple-200">
              AED {totalSelectedAmount.toLocaleString()}
            </span>
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={selectedChequeIds.length === 0}
            className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {language === "ar"
                ? `إضافة الشيكات المحددة (${selectedChequeIds.length})`
                : `Add Selected Cheques (${selectedChequeIds.length})`}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
