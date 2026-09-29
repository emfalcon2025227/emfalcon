import React, { useState } from "react";
import { Building, AlertCircle, Plus } from "lucide-react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { getAllUaeBanks, isDuplicateBank, saveCustomBank } from "../../utils/bankUtils";
import { UaeBank } from "../../data/uaeBanks";

interface AddBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBankAdded: (newBank: UaeBank) => void;
  initialBankName?: string;
}

export const AddBankModal: React.FC<AddBankModalProps> = ({
  isOpen,
  onClose,
  onBankAdded,
  initialBankName = "",
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [bankNameInput, setBankNameInput] = useState<string>(initialBankName);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setBankNameInput(initialBankName);
      setErrorMsg(null);
    }
  }, [isOpen, initialBankName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = bankNameInput.trim();
    if (!trimmed) {
      setErrorMsg(isAr ? "يرجى إدخال اسم البنك" : "Please enter a valid bank name");
      return;
    }

    const allBanks = getAllUaeBanks();
    if (isDuplicateBank(allBanks, trimmed)) {
      setErrorMsg(
        isAr
          ? "هذا البنك موجود بالفعل في قائمة البنوك، يُرجى اختياره مباشرة من القائمة."
          : "This bank already exists in the bank list. Please select it from the dropdown."
      );
      return;
    }

    const newBank = saveCustomBank(trimmed);
    onBankAdded(newBank);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? "إضافة بنك جديد (+ Add New Bank)" : "Add New Bank (+ Add New Bank)"}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center gap-2">
          <Building className="w-5 h-5 text-indigo-600 shrink-0" />
          <p className="text-slate-600 leading-relaxed font-medium">
            {isAr
              ? "سيتم إضافة اسم البنك الجديد وتوفيره في قائمة البنوك المعتمدة لاستخدامه في كافة العقود والشيكات."
              : "The new bank name will be saved and immediately available across all contracts and cheques."}
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {isAr ? "اسم البنك *" : "Bank Name *"}
          </label>
          <input
            type="text"
            value={bankNameInput}
            onChange={(e) => {
              setBankNameInput(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder={
              isAr
                ? "مثال: بنك الشارقة / Bank of Sharjah"
                : "e.g., Bank of Sharjah"
            }
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            autoFocus
          />
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="font-bold">{errorMsg}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? "إضافة البنك" : "Add Bank"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
