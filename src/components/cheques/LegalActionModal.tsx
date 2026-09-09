import React, { useState } from "react";
import {
  Scale,
  Building,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Link as LinkIcon,
  FileText,
  CreditCard,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Lock,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Cheque, RentalCase } from "../../types";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";

interface LegalActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: Cheque | null;
  onOpenCaseDetails?: (caseItem: RentalCase) => void;
}

export const LegalActionModal: React.FC<LegalActionModalProps> = ({
  isOpen,
  onClose,
  cheque,
  onOpenCaseDetails,
}) => {
  const { language, t } = useLanguage();
  const {
    tenants,
    owners,
    properties,
    units,
    leases,
    cases,
    linkChequesToCase,
    createCaseFromCheque,
    getNextCaseNumber,
  } = useData();
  const { users, currentUser } = useAuth();

  const [workflowMode, setWorkflowMode] = useState<"SELECT_TYPE" | "LINK_EXISTING" | "CREATE_NEW">("SELECT_TYPE");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [isConfirmingLink, setIsConfirmingLink] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form Fields for Create New Case
  const [emirate, setEmirate] = useState<string>("Sharjah");
  const [city, setCity] = useState<string>("Khor Fakkan");
  const [courtName, setCourtName] = useState<string>("Sharjah Rental Dispute Tribunal - Khor Fakkan");
  const [caseNumber, setCaseNumber] = useState<string>("");
  const [courtReferenceNumber, setCourtReferenceNumber] = useState<string>("");
  const [responsibleUserId, setResponsibleUserId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  if (!isOpen || !cheque) return null;

  const tenant = tenants.find((t) => t.id === cheque.tenantId);
  const owner = owners.find((o) => o.id === cheque.ownerId);
  const prop = properties.find((p) => p.id === cheque.propertyId);
  const unit = units.find((u) => u.id === cheque.unitId);
  const lease = leases.find((l) => l.id === cheque.leaseId);

  // Find active cases for this tenant
  const tenantActiveCases = cases.filter(
    (c) => c.tenantId === cheque.tenantId && c.status !== "CLOSED" && c.status !== "ARCHIVED"
  );

  // Check if this cheque is already linked to another active case
  const existingLinkedCase = cases.find(
    (c) => c.linkedChequeIds?.includes(cheque.id) && c.status !== "CLOSED" && c.status !== "ARCHIVED"
  );

  // Initialize auto case number when entering CREATE_NEW
  const handleSelectCreateNew = () => {
    const genNo = getNextCaseNumber();
    setCaseNumber(genNo);
    setNotes(
      language === "ar"
        ? `دعوى إيجارية ناشئة عن الشيك المرتجع رقم ${cheque.chequeNumber} - مسحوب على ${cheque.bankName} - بمبلغ ${cheque.amount.toLocaleString()} درهم`
        : `Rental dispute case initiated from returned cheque #${cheque.chequeNumber} (${cheque.bankName}) - Amount AED ${cheque.amount.toLocaleString()}`
    );
    setWorkflowMode("CREATE_NEW");
  };

  const handleLinkExistingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) return;

    if (!isConfirmingLink) {
      setIsConfirmingLink(true);
      return;
    }

    const res = linkChequesToCase(selectedCaseId, [cheque.id], "Linked from Legal Action Modal");
    if (res.success) {
      setFeedback({
        type: "success",
        message:
          language === "ar"
            ? `تم ربط الشيك رقم ${cheque.chequeNumber} بالقضية المحددة بنجاح!`
            : `Cheque #${cheque.chequeNumber} successfully linked to case!`,
      });
      setTimeout(() => {
        setFeedback(null);
        setIsConfirmingLink(false);
        onClose();
      }, 1500);
    } else {
      setFeedback({
        type: "error",
        message: res.error || (language === "ar" ? "تعذر ربط الشيك بالقضية" : "Failed to link cheque"),
      });
    }
  };

  const handleCreateNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedUser = users.find((u) => u.id === responsibleUserId);
    const responsibleUserName = assignedUser
      ? (language === "ar" ? assignedUser.nameAr : assignedUser.nameEn)
      : (language === "ar" ? "غير محدد" : "Unassigned");

    try {
      const createdCase = createCaseFromCheque({
        chequeId: cheque.id,
        caseNumber: caseNumber || undefined,
        courtName: `${courtName} (${emirate} / ${city})`,
        courtReferenceNumber: courtReferenceNumber || undefined,
        emirate,
        city,
        responsibleUserId: responsibleUserId || undefined,
        responsibleUserName,
        legalFeesClaimed: 0,
        notes,
      });

      setFeedback({
        type: "success",
        message:
          language === "ar"
            ? `تم إنشاء القضية ${createdCase.caseNumber} وربط الشيك المرتجع بها بنجاح!`
            : `Case ${createdCase.caseNumber} created and cheque linked successfully!`,
      });

      setTimeout(() => {
        setFeedback(null);
        onClose();
        if (onOpenCaseDetails) {
          onOpenCaseDetails(createdCase);
        }
      }, 1500);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || (language === "ar" ? "حدث خطأ أثناء إنشاء القضية" : "Failed to create case"),
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        language === "ar"
          ? `إجراء قانوني لشيك مرتجع: #${cheque.chequeNumber}`
          : `Legal Action for Returned Cheque: #${cheque.chequeNumber}`
      }
      subtitle={
        language === "ar"
          ? `المستأجر: ${tenant ? tenant.nameAr : "غير محدد"} — المبلغ: AED ${cheque.amount.toLocaleString()}`
          : `Tenant: ${tenant ? tenant.nameEn : "N/A"} — Amount: AED ${cheque.amount.toLocaleString()}`
      }
      icon={<Scale className="w-5 h-5 text-amber-600" />}
      maxWidth="3xl"
    >
      <div className="space-y-4 text-xs">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Check if Already Linked Warning */}
        {existingLinkedCase && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <ShieldAlert className="w-5 h-5 text-amber-700" />
              <span>
                {language === "ar"
                  ? "هذا الشيك مرتبط بالفعل بقضية قانونية أخرى."
                  : "This cheque is already linked to another active legal case."}
              </span>
            </div>
            <p className="text-amber-800 text-xs">
              {language === "ar"
                ? `القضية المرتبطة: ${existingLinkedCase.caseNumber} (${existingLinkedCase.courtName}) — الحالة: ${existingLinkedCase.status}`
                : `Linked Case: ${existingLinkedCase.caseNumber} (${existingLinkedCase.courtName}) — Status: ${existingLinkedCase.status}`}
            </p>
            <div className="flex items-center gap-2 pt-1">
              {onOpenCaseDetails && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenCaseDetails(existingLinkedCase);
                  }}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{language === "ar" ? "عرض القضية المرتبطة" : "View Linked Case"}</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Cheque Details Summary Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-700" />
              <span className="font-black text-slate-900 text-sm">
                {language === "ar" ? `شيك رقم: ${cheque.chequeNumber}` : `Cheque No: ${cheque.chequeNumber}`}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold text-[10px]">
                {cheque.returnReason || "INSUFFICIENT_FUNDS"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold block">{language === "ar" ? "المبلغ المستحق" : "Outstanding"}</span>
              <span className="text-sm font-black text-rose-700 font-mono">
                AED {cheque.outstanding.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-slate-500 font-bold block">{language === "ar" ? "البنك المسحوب عليه" : "Bank"}</span>
              <span className="font-bold text-slate-800">{cheque.bankName}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block">{language === "ar" ? "تاريخ الاستحقاق" : "Cheque Date"}</span>
              <span className="font-bold text-slate-800">{cheque.chequeDate}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block">{language === "ar" ? "تاريخ الإرتجاع" : "Returned Date"}</span>
              <span className="font-bold text-slate-800">{cheque.returnedDate || cheque.chequeDate}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block">{language === "ar" ? "حالة التحصيل" : "Collection Status"}</span>
              <span className="font-bold text-slate-800">{cheque.collectionStatus}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 font-bold">{language === "ar" ? "المستأجر: " : "Tenant: "}</span>
              <span className="font-black text-slate-900">{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold">{language === "ar" ? "المؤجر: " : "Owner: "}</span>
              <span className="font-bold text-slate-800">{owner ? (language === "ar" ? owner.nameAr : owner.nameEn) : "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold">{language === "ar" ? "العقار / الوحدة: " : "Prop / Unit: "}</span>
              <span className="font-bold text-slate-800">
                {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : ""} {unit ? `(${unit.unitNumber})` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* WORKFLOW STEP 1: SELECT ACTION TYPE */}
        {workflowMode === "SELECT_TYPE" && !existingLinkedCase && (
          <div className="space-y-4 pt-2">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar"
                  ? "هل تريد ربط هذا الشيك بقضية موجودة أم إنشاء قضية جديدة؟"
                  : "Do you want to link this cheque to an existing case or create a new case?"}
              </h3>
              <p className="text-slate-500 text-xs">
                {language === "ar"
                  ? "اختر الخيار المناسب لمتابعة الإجراءات القانونية والمطالبة القضائية"
                  : "Select an option to proceed with judicial claims and legal proceedings"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Option 1: Link to Existing Case */}
              <button
                onClick={() => setWorkflowMode("LINK_EXISTING")}
                className="p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 hover:border-blue-400 transition-all text-right flex flex-col justify-between space-y-3 cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                  <Badge variant="default">{tenantActiveCases.length} {language === "ar" ? "قضايا نشطة" : "Active Cases"}</Badge>
                </div>
                <div>
                  <h4 className="font-black text-blue-950 text-sm group-hover:text-blue-700 transition-colors">
                    {language === "ar" ? "ربط بقضية موجودة" : "Link to Existing Case"}
                  </h4>
                  <p className="text-blue-800/80 text-xs mt-1 leading-relaxed">
                    {language === "ar"
                      ? "إضافة الشيك المرتجع إلى قضية إيجارية جارية ومفتوحة لنفس المستأجر"
                      : "Add this returned cheque to an active open rental case for the same tenant"}
                  </p>
                </div>
              </button>

              {/* Option 2: Create New Case */}
              <button
                onClick={handleSelectCreateNew}
                className="p-5 rounded-2xl border-2 border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 hover:border-purple-400 transition-all text-right flex flex-col justify-between space-y-3 cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5" />
                  </div>
                  <Badge variant="purple">{language === "ar" ? "قضية جديدة" : "New Case"}</Badge>
                </div>
                <div>
                  <h4 className="font-black text-purple-950 text-sm group-hover:text-purple-700 transition-colors">
                    {language === "ar" ? "إنشاء قضية جديدة" : "Create New Case"}
                  </h4>
                  <p className="text-purple-800/80 text-xs mt-1 leading-relaxed">
                    {language === "ar"
                      ? "فتح ملف قضية جديدة وتعبئة كافة البيانات والمستندات تلقائياً من الشيك"
                      : "File a new dispute case pre-populated with cheque info & attached files"}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* WORKFLOW STEP 2A: LINK TO EXISTING CASE */}
        {workflowMode === "LINK_EXISTING" && (
          <form onSubmit={handleLinkExistingSubmit} className="space-y-4 pt-1">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span>{language === "ar" ? "اختر القضية النشطة لربط الشيك بها" : "Select Active Case to Link Cheque"}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setWorkflowMode("SELECT_TYPE");
                  setIsConfirmingLink(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                ← {language === "ar" ? "الرجوع للخيارات" : "Back to options"}
              </button>
            </div>

            {tenantActiveCases.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                <p className="text-slate-600 font-bold">
                  {language === "ar"
                    ? "لا توجد قضايا إيجارية نشطة حالية لهذا المستأجر."
                    : "No active rental cases found for this tenant."}
                </p>
                <button
                  type="button"
                  onClick={handleSelectCreateNew}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition-all shadow-xs"
                >
                  + {language === "ar" ? "إنشاء قضية جديدة لهذا الشيك" : "Create New Case for this Cheque"}
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {tenantActiveCases.map((c) => (
                  <label
                    key={c.id}
                    className={`block p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      selectedCaseId === c.id
                        ? "border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="selectedCase"
                          value={c.id}
                          checked={selectedCaseId === c.id}
                          onChange={(e) => {
                            setSelectedCaseId(e.target.value);
                            setIsConfirmingLink(false);
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <span className="font-black text-slate-900 text-sm block">
                            {c.caseNumber} {c.courtReferenceNumber ? `(${c.courtReferenceNumber})` : ""}
                          </span>
                          <span className="text-[11px] text-slate-500 block">{c.courtName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="purple">{c.status}</Badge>
                        <span className="text-xs font-black text-purple-900 font-mono block mt-1">
                          AED {c.claimAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Confirmation Alert Box */}
            {isConfirmingLink && selectedCaseId && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 font-bold flex items-center justify-between">
                <span>
                  {language === "ar"
                    ? "هل أنت متأكد من ربط الشيك بالقضية المحددة؟"
                    : "Are you sure you want to link this cheque to the selected case?"}
                </span>
                <span className="text-xs bg-amber-200 text-amber-950 px-2.5 py-1 rounded-xl">
                  {language === "ar" ? "اضغط للتأكيد" : "Click to confirm"}
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
              {tenantActiveCases.length > 0 && (
                <button
                  type="submit"
                  disabled={!selectedCaseId}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isConfirmingLink
                      ? language === "ar"
                        ? "تأكيد واستكمال الربط"
                        : "Confirm & Complete Link"
                      : language === "ar"
                      ? "ربط الشيك بالقضية المحددة"
                      : "Link Cheque to Selected Case"}
                  </span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* WORKFLOW STEP 2B: CREATE NEW CASE */}
        {workflowMode === "CREATE_NEW" && (
          <form onSubmit={handleCreateNewSubmit} className="space-y-4 pt-1">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-600" />
                <span>{language === "ar" ? "إنشاء قضية إيجارية جديدة وتعبئة البيانات تلقائياً" : "Create New Case (Auto Pre-populated)"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setWorkflowMode("SELECT_TYPE")}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                ← {language === "ar" ? "الرجوع للخيارات" : "Back to options"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "الإمارة" : "Emirate"} *</label>
                <SearchableSelect
                  options={[
                    { id: "Sharjah", label: "الشارقة (Sharjah)" },
                    { id: "Dubai", label: "دبي (Dubai)" },
                    { id: "Abu Dhabi", label: "أبوظبي (Abu Dhabi)" },
                    { id: "Ajman", label: "عجمان (Ajman)" },
                    { id: "RAK", label: "رأس الخيمة (RAK)" },
                    { id: "Fujairah", label: "الفجيرة (Fujairah)" },
                    { id: "UAQ", label: "أم القيوين (UAQ)" },
                  ]}
                  value={emirate}
                  onChange={(val) => setEmirate(val)}
                  placeholder={language === "ar" ? "اختر الإمارة..." : "Select Emirate..."}
                  searchPlaceholder={language === "ar" ? "ابحث عن إمارة..." : "Search emirate..."}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "المدينة / مقر المحكمة" : "City / Court Location"} *</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="خورفكان / Khor Fakkan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "اسم المحكمة / المركز القضائي" : "Court / Tribunal Name"} *</label>
                <input
                  type="text"
                  required
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">{language === "ar" ? "رقم القضية الداخلي" : "Internal Case Number"} *</label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                    <Lock className="w-3 h-3 text-amber-700" />
                    {language === "ar" ? "مسلسل تلقائي (محمي)" : "Auto-Locked"}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  readOnly
                  disabled
                  value={caseNumber}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "رقم القيد بالمحكمة (إن وجد)" : "Court Reference No."}</label>
                <input
                  type="text"
                  value={courtReferenceNumber}
                  onChange={(e) => setCourtReferenceNumber(e.target.value)}
                  placeholder="RDT-2026-99"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <SearchableSelect
                  label={language === "ar" ? "المستشار / المحامي المسؤول (اختياري)" : "Responsible Officer (Optional)"}
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
              <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "تفاصيل ولائحة الدعوى" : "Case Filing Grounds & Notes"}</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-purple-950 font-bold">
              <span>{language === "ar" ? "إجمالي المطالبة المالية للشيك:" : "Total Principal Claim:"}</span>
              <span className="text-base font-black font-mono">
                AED {cheque.outstanding.toLocaleString()}
              </span>
            </div>

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
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{language === "ar" ? "قيد القضية وربط الشيك والمرفقات" : "Create Case & Link Attachments"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
