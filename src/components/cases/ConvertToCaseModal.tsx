import React, { useState } from "react";
import { Scale, AlertCircle, CheckCircle2, User, Building } from "lucide-react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";

interface ConvertToCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  chequeIds: string[];
}

export const ConvertToCaseModal: React.FC<ConvertToCaseModalProps> = ({
  isOpen,
  onClose,
  chequeIds,
}) => {
  const { t, language } = useLanguage();
  const { cheques, convertChequesToCase } = useData();
  const { users, currentUser } = useAuth();

  const selectedCheques = cheques.filter((c) => chequeIds.includes(c.id));
  const totalClaim = selectedCheques.reduce((sum, c) => sum + c.outstanding, 0);

  const [courtName, setCourtName] = useState("Sharjah Rental Dispute Tribunal");
  const [courtReferenceNumber, setCourtReferenceNumber] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCheques.length === 0) return;

    const assignedUser = users.find((u) => u.id === responsibleUserId);
    const responsibleUserName = assignedUser
      ? (language === "ar" ? assignedUser.nameAr : assignedUser.nameEn)
      : (language === "ar" ? "غير محدد" : "Unassigned");

    convertChequesToCase({
      chequeIds,
      courtName,
      responsibleUserId: responsibleUserId || "",
      responsibleUserName,
      courtReferenceNumber: courtReferenceNumber || undefined,
      legalFeesClaimed: 0,
      notes: notes || undefined,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === "ar" ? "قيد وإحالة الشيكات كقضية إيجارية" : "Convert Cheques to Rental Dispute Case"}
      subtitle={
        language === "ar"
          ? `إحالة ${selectedCheques.length} شيك مرتجع للمحكمة واللجان القضائية المختصة`
          : `Escalate ${selectedCheques.length} returned cheque(s) to judicial tribunal`
      }
      icon={<Scale className="w-5 h-5 text-purple-600" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Claim Summary Box */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-purple-700 block uppercase">
              {language === "ar" ? "إجمالي المطالبة المالية للشيكات" : "Total Principal Cheque Claim"}
            </span>
            <span className="text-xl font-black text-purple-950 font-mono">
              AED {totalClaim.toLocaleString()}
            </span>
          </div>
          <span className="px-3 py-1 bg-white rounded-xl text-purple-900 font-bold border border-purple-200">
            {selectedCheques.length} Cheque(s)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SearchableSelect
              label={language === "ar" ? "المحكمة / مركز فض المنازعات" : "Judicial Forum / Court"}
              required
              options={[
                { id: "Sharjah Rental Dispute Tribunal", label: "لجنة فض المنازعات الإيجارية - الشارقة", subLabel: "Sharjah Tribunal" },
                { id: "Rental Dispute Settlement Centre - RDSC Dubai", label: "مركز فض المنازعات الإيجارية - دبي", subLabel: "RDSC Dubai" },
                { id: "Abu Dhabi Judicial Department - ADJD Rental Court", label: "دائرة القضاء - لجان الإيجارات بأبوظبي", subLabel: "ADJD Abu Dhabi" },
                { id: "Ajman Rental Committee", label: "لجنة المنازعات الإيجارية - عجمان", subLabel: "Ajman Rental" },
              ]}
              value={courtName}
              onChange={(val) => setCourtName(val)}
              placeholder={language === "ar" ? "-- اختر المحكمة --" : "-- Select Court --"}
              searchPlaceholder={language === "ar" ? "ابحث باسم المحكمة أو الإمارة..." : "Search court or emirate..."}
            />
          </div>

          <div>
            <SearchableSelect
              label={language === "ar" ? "المستشار / المحامي المسؤول (اختياري)" : "Responsible Legal Officer (Optional)"}
              required={false}
              options={[
                {
                  id: "",
                  label: language === "ar" ? "غير محدد (بدون تعيين محامي)" : "Unassigned (No counsel assigned)",
                  subLabel: language === "ar" ? "اختياري - يمكن التعيين لاحقاً" : "Optional - can assign later",
                },
                ...users.map((u) => ({
                  id: u.id,
                  label: language === "ar" ? u.nameAr : u.nameEn,
                  subLabel: u.role,
                  badge: u.email,
                })),
              ]}
              value={responsibleUserId}
              onChange={(val) => setResponsibleUserId(val)}
              placeholder={language === "ar" ? "-- غير محدد (اختياري) --" : "-- Unassigned (Optional) --"}
              searchPlaceholder={language === "ar" ? "ابحث باسم المحامي أو الدور..." : "Search officer..."}
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            {language === "ar" ? "رقم القيد في المحكمة (إن وجد)" : "Court Reference / Case Number"}
          </label>
          <input
            type="text"
            value={courtReferenceNumber}
            onChange={(e) => setCourtReferenceNumber(e.target.value)}
            placeholder="RDSC-2026-9812"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            {language === "ar" ? "تفاصيل وملاحظات لائحة الدعوى" : "Case Filing Notes & Claim Grounds"}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Claim for eviction and recovery of rent arrears..."
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
          />
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === "ar" ? "قيد القضية وتحديث حالة الشيكات" : "File Case & Escalate Cheques"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
