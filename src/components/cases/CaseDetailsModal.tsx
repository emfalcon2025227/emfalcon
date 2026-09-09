import React, { useState, useEffect } from "react";
import {
  Scale,
  Calendar,
  Clock,
  CheckCircle2,
  Check,
  AlertTriangle,
  Plus,
  PlusCircle,
  FileText,
  User,
  Building,
  CreditCard,
  Handshake,
  DollarSign,
  Upload,
  Cloud,
  ExternalLink,
  Eye,
  Trash2,
  Download,
  Image as ImageIcon,
  Sparkles,
  Link,
  Search,
  Square,
  CheckSquare,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { Case, CaseStatus, Hearing, Cheque, CaseDocumentItem, PaymentMethod } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { Badge } from "../common/Badge";
import { LegalNoticeGeneratorModal } from "../common/LegalNoticeGeneratorModal";
import { CaseDocumentUploadModal } from "./CaseDocumentUploadModal";
import { ChequeImageUploadModal } from "../archive/ChequeImageUploadModal";
import { AddChequesToCaseModal } from "./AddChequesToCaseModal";
import { AddChequeModal } from "../cheques/AddChequeModal";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { SearchableSelect } from "../common/SearchableSelect";

export interface CaseDetailsPageProps {
  isOpen?: boolean;
  onClose: () => void;
  caseItem: Case | null;
}

export const CaseDetailsPage: React.FC<CaseDetailsPageProps> = ({
  isOpen,
  onClose,
  caseItem,
}) => {
  const { t, language } = useLanguage();
  const { navigateTo } = useNavigation();
  const {
    cases,
    tenants,
    owners,
    properties,
    units,
    cheques,
    propertyExpenses,
    updateCaseStatus,
    addHearingToCase,
    saveSettlementAgreement,
    deleteCaseDocument,
    syncCaseDocumentToDrive,
    unlinkChequeFromCase,
    paySettlementInstallment,
    clearSettlementCheque,
    updateSettlementCheque,
    linkExpenseToCase,
    linkMultipleExpensesToCase,
    unlinkExpenseFromCase,
    updateCaseBouncedFee,
    updateCaseFeesConfig,
    addPropertyExpense,
    deletePropertyExpense,
    legalSettings,
    recordCollection,
  } = useData();
  const { currentUser, hasPermission } = useAuth();
  
  const canDelete = hasPermission("DELETE_RECORDS");
  const canRemoveChequeFromCase =
    hasPermission("DELETE_RECORDS") ||
    hasPermission("MANAGE_CASES") ||
    currentUser?.role === "SYSTEM_OWNER" ||
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "MANAGER";

  const [chequeToUnlink, setChequeToUnlink] = useState<Cheque | null>(null);

  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "HEARINGS" | "SETTLEMENT" | "DOCUMENTS">("OVERVIEW");

  // Legal Fees Management State
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isUpdatingBouncedFee, setIsUpdatingBouncedFee] = useState(false);
  const [newBouncedFee, setNewBouncedFee] = useState(caseItem?.bouncedChequeFeePerUnit ?? legalSettings?.defaultBouncedChequeFee ?? 500);
  const [bouncedFeeEditReason, setBouncedFeeEditReason] = useState("");
  const [expenseToUnlink, setExpenseToUnlink] = useState<any | null>(null);
  const [expenseSearchTerm, setExpenseSearchTerm] = useState("");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [isAddingNewExpense, setIsAddingNewExpense] = useState(false);

  // New Legal Expense Form State
  const [newExpAmount, setNewExpAmount] = useState<number>(0);
  const [newExpDescription, setNewExpDescription] = useState("");
  const [newExpDate, setNewExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [newExpCostBearer, setNewExpCostBearer] = useState<"OWNER" | "TENANT" | "OFFICE">("OWNER");
  const [newExpError, setNewExpError] = useState("");

  // New Hearing State
  const [isAddHearingOpen, setIsAddHearingOpen] = useState(false);
  const [hearingDate, setHearingDate] = useState(new Date().toISOString().split("T")[0]);
  const [hearingTime, setHearingTime] = useState("10:00 AM");
  const [courtRoom, setCourtRoom] = useState("Hall 3 - First Instance");
  const [hearingNotes, setHearingNotes] = useState("");

  // Settlement Agreement State
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState<number>(caseItem?.outstandingAmount ?? 50000);
  const [installmentsCount, setInstallmentsCount] = useState(4);
  const [settlementNotes, setSettlementNotes] = useState("");
  const [settlementSigningDate, setSettlementSigningDate] = useState(new Date().toISOString().split("T")[0]);
  const [draftSchedule, setDraftSchedule] = useState<{amount: number, dueDate: string}[]>([]);

  // Collection on Cheque Inside Case State
  const [collectingCheque, setCollectingCheque] = useState<Cheque | null>(null);
  const [chequeCollectAmount, setChequeCollectAmount] = useState<number>(0);
  const [chequeCollectNotes, setChequeCollectNotes] = useState("");
  const [chequeCollectRef, setChequeCollectRef] = useState("");
  const [chequeCollectPayer, setChequeCollectPayer] = useState("");
  const [chequeCollectMethod, setChequeCollectMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [chequeCollectConfirm, setChequeCollectConfirm] = useState(false);
  const [chequeCollectError, setChequeCollectError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [expenseActionError, setExpenseActionError] = useState("");

  useEffect(() => {
    // Auto-generate draft schedule when amount or count changes
    if (isSettlementOpen) {
      const schedule = Array.from({ length: installmentsCount }).map((_, i) => {
        const d = new Date(settlementSigningDate);
        d.setMonth(d.getMonth() + i + 1);
        return {
          dueDate: d.toISOString().split("T")[0],
          amount: Math.round(settlementAmount / installmentsCount),
        };
      });
      // Adjust the last installment to ensure the total exactly matches settlementAmount
      const sum = schedule.reduce((acc, curr) => acc + curr.amount, 0);
      if (sum !== settlementAmount && schedule.length > 0) {
        schedule[schedule.length - 1].amount += (settlementAmount - sum);
      }
      setDraftSchedule(schedule);
    }
  }, [installmentsCount, settlementAmount, settlementSigningDate, isSettlementOpen]);

  // AI Legal Notice Modal State
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState(false);
  const [legalNoticeType, setLegalNoticeType] = useState<any>("RDC_STATEMENT_OF_CLAIM");

  // Case Document Upload Modal State
  const [isDocUploadOpen, setIsDocUploadOpen] = useState(false);
  const [selectedChequeForUpload, setSelectedChequeForUpload] = useState<Cheque | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CaseDocumentItem | null>(null);
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);

  // Linked Cheques Management State
  const [isAddChequesModalOpen, setIsAddChequesModalOpen] = useState(false);
  const [isAddNewChequeOpen, setIsAddNewChequeOpen] = useState(false);
  const [viewingCheque, setViewingCheque] = useState<Cheque | null>(null);

  // Installment Payment State
  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(null);
  const [expandedInstallments, setExpandedInstallments] = useState<number[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "CHEQUE">("CASH");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentRef, setPaymentRef] = useState("");
  const [instChequeNumber, setInstChequeNumber] = useState("");
  const [instChequeDate, setInstChequeDate] = useState(new Date().toISOString().split("T")[0]);
  const [instBankName, setInstBankName] = useState("");

  // Edit Cheque State (Admin)
  const [editingChequeInstId, setEditingChequeInstId] = useState<string | null>(null);

  // Local state for smooth editing of other fees and description
  const [otherFeesAmountInput, setOtherFeesAmountInput] = useState<string>(
    caseItem?.otherFeesAmount !== undefined && caseItem?.otherFeesAmount !== null ? String(caseItem.otherFeesAmount) : ""
  );
  const [otherFeesDescInput, setOtherFeesDescInput] = useState<string>(
    caseItem?.otherFeesDescription || ""
  );

  const currentCase = caseItem ? (cases.find((c) => c.id === caseItem.id) || caseItem) : null;

  useEffect(() => {
    if (currentCase) {
      setOtherFeesAmountInput(
        currentCase.otherFeesAmount !== undefined && currentCase.otherFeesAmount !== null ? String(currentCase.otherFeesAmount) : ""
      );
      setOtherFeesDescInput(currentCase.otherFeesDescription || "");
    }
  }, [currentCase?.id, currentCase?.otherFeesAmount, currentCase?.otherFeesDescription]);

  if (!caseItem || !currentCase) return null;

  const tenant = tenants.find((t) => t.id === currentCase.tenantId);
  const owner = owners.find((o) => o.id === currentCase.ownerId);
  const prop = properties.find((p) => p.id === currentCase.propertyId);
  const unit = units.find((u) => u.id === currentCase.unitId);
  const linkedChequeIds = currentCase.linkedChequeIds || [];
  const linkedCheques = cheques.filter((c) => linkedChequeIds.includes(c.id));
  const caseDocs = currentCase.caseDocuments || [];

  const caseOutstandingAmount = currentCase.outstandingAmount ?? currentCase.outstanding ?? 0;
  const isEligibleForClosure = caseOutstandingAmount === 0 && linkedCheques.every(c => (c.outstanding ?? 0) === 0);
  
  const unlinkedLegalExpenses = propertyExpenses.filter(e => 
    e.ownerId === currentCase.ownerId && 
    e.category === "LEGAL_FEES" && 
    (!e.legalCaseId || e.legalCaseId === "") &&
    e.status !== "CANCELLED" &&
    e.status !== "REVERSED"
  );

  const suggestedExpenses = unlinkedLegalExpenses.filter(e => 
    e.tenantId === currentCase.tenantId ||
    (e.leaseId === currentCase.leaseId || e.propertyId === currentCase.propertyId || e.unitId === currentCase.unitId)
  );

  const otherEligibleExpenses = unlinkedLegalExpenses.filter(e => 
    !suggestedExpenses.some(se => se.id === e.id)
  );

  const filteredOtherExpenses = otherEligibleExpenses.filter(e => {
    if (!expenseSearchTerm) return true;
    const s = expenseSearchTerm.toLowerCase();
    const expTenant = tenants.find(t => t.id === e.tenantId);
    return (
      e.expenseNumber.toLowerCase().includes(s) ||
      e.description.toLowerCase().includes(s) ||
      expTenant?.nameAr?.toLowerCase().includes(s) ||
      expTenant?.nameEn?.toLowerCase().includes(s) ||
      e.totalAmount.toString().includes(s)
    );
  });

  const handleOtherFeesAmountChange = (valStr: string) => {
    setOtherFeesAmountInput(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      updateCaseFeesConfig(currentCase.id, { otherFeesAmount: num });
    } else if (valStr === "") {
      updateCaseFeesConfig(currentCase.id, { otherFeesAmount: 0 });
    }
  };

  const handleOtherFeesDescChange = (desc: string) => {
    setOtherFeesDescInput(desc);
    updateCaseFeesConfig(currentCase.id, { otherFeesDescription: desc });
  };

  const handleNavigateToPropertyExpenses = () => {
    sessionStorage.setItem("expensePreFillOrigin", "CASES");
    sessionStorage.setItem("returnToCaseId", currentCase.id);
    sessionStorage.setItem(
      "expensePreFill",
      JSON.stringify({
        propertyId: currentCase.propertyId || "",
        unitId: currentCase.unitId || "",
        ownerId: currentCase.ownerId || "",
        tenantId: currentCase.tenantId || "",
        leaseId: currentCase.leaseId || "",
        legalCaseId: currentCase.id,
        category: "LEGAL_FEES",
        costBearer: "OWNER",
        description:
          language === "ar"
            ? `رسوم ومصاريف قضائية وقانونية للقضية رقم #${currentCase.caseNumber}`
            : `Court & Legal fees for Case #${currentCase.caseNumber}`,
        relatesToTenant: true,
      })
    );
    try {
      localStorage.setItem("financials_active_tab", "PROPERTY_EXPENSES");
      window.dispatchEvent(new CustomEvent("set-financials-tab", { detail: { tab: "PROPERTY_EXPENSES" } }));
    } catch (e) {}
    onClose();
    navigateTo("FINANCIALS");
  };

  const [isSubmittingCollect, setIsSubmittingCollect] = useState(false);

  const handleRecordChequeCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingCheque) return;

    if (!chequeCollectConfirm) {
      setChequeCollectConfirm(true);
      return;
    }

    setIsSubmittingCollect(true);
    const res = await recordCollection({
      chequeId: collectingCheque.id,
      amountEntered: chequeCollectAmount,
      bouncedFeeAmount: 0,
      paymentMethod: chequeCollectMethod,
      payerName: chequeCollectPayer || "Tenant Representative",
      transactionReference: chequeCollectRef || undefined,
      notes: chequeCollectNotes || undefined,
      fromCase: true,
    });

    setIsSubmittingCollect(false);
    if (res.success) {
      setCollectingCheque(null);
      setChequeCollectConfirm(false);
      setChequeCollectError("");
    } else {
      setChequeCollectError(res.error || "Failed to record collection.");
    }
  };

  const handleStatusChange = (status: CaseStatus) => {
    setStatusError("");
    const res = updateCaseStatus(currentCase.id, status);
    if (res && !res.success) {
      setStatusError(res.error || "Failed to update status");
    }
  };

  const handleAddNewLegalExpense = () => {
    setNewExpError("");
    if (newExpAmount <= 0) {
      setNewExpError(language === "ar" ? "يرجى إدخال مبلغ صحيح" : "Please enter a valid amount");
      return;
    }
    if (!newExpDescription.trim()) {
      setNewExpError(language === "ar" ? "يرجى إدخال وصف للمصروف" : "Please enter a description");
      return;
    }

    const res = addPropertyExpense({
      propertyId: currentCase.propertyId,
      unitId: currentCase.unitId,
      ownerId: currentCase.ownerId,
      tenantId: currentCase.tenantId,
      leaseId: currentCase.leaseId,
      legalCaseId: currentCase.id,
      category: "LEGAL_FEES",
      description: newExpDescription,
      amount: newExpAmount,
      vatAmount: 0,
      costBearer: newExpCostBearer,
      expenseDate: newExpDate,
      paymentMethod: "CASH", // Default for quick add
      status: "PAID",
      postingStatus: "POSTED",
      expenseLevel: currentCase.unitId ? "UNIT_LEVEL" : "PROPERTY_LEVEL",
      sourceType: "LEGAL_CASE",
      sourceId: currentCase.id,
    });

    if (res.success && res.expense) {
      // Automatically link the newly created expense
      linkExpenseToCase(currentCase.id, res.expense.id);
      
      // Reset form and close
      setIsAddingNewExpense(false);
      setIsAddExpenseModalOpen(false);
      setNewExpAmount(0);
      setNewExpDescription("");
      setNewExpDate(new Date().toISOString().split("T")[0]);
      setSelectedExpenseIds([]);
    } else {
      setNewExpError(res.error || "Failed to add expense");
    }
  };

  const handleAddHearingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addHearingToCase) {
      addHearingToCase(currentCase.id, {
        hearingDate,
        hearingTime,
        courtRoom,
        notes: hearingNotes,
        status: "SCHEDULED",
      });
    }
    setIsAddHearingOpen(false);
    setHearingNotes("");
  };

  const handleSaveSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveSettlementAgreement) {
      saveSettlementAgreement(currentCase.id, {
        totalAgreedAmount: settlementAmount,
        installmentsCount,
        agreementDate: settlementSigningDate,
        notarized: true,
        notes: settlementNotes,
        schedule: draftSchedule.map((inst, i) => ({
          id: `inst-${Date.now()}-${i}`,
          installmentNumber: i + 1,
          dueDate: inst.dueDate,
          amount: inst.amount,
          status: "PENDING",
        })),
      });
    }
    setIsSettlementOpen(false);
  };

  const handlePayInstallment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInstallmentId) return;

    paySettlementInstallment(currentCase.id, payingInstallmentId, {
      amount: paymentAmount,
      method: paymentMethod,
      date: paymentDate,
      reference: paymentRef,
      chequeDetails: paymentMethod === "CHEQUE" ? {
        chequeNumber: instChequeNumber,
        chequeDate: instChequeDate,
        bankName: instBankName
      } : undefined
    });

    setPayingInstallmentId(null);
    setPaymentRef("");
    setInstChequeNumber("");
    setInstBankName("");
  };

  const handleUpdateCheque = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChequeInstId) return;

    updateSettlementCheque(currentCase.id, editingChequeInstId, {
      chequeNumber: instChequeNumber,
      chequeDate: instChequeDate,
      bankName: instBankName
    });

    setEditingChequeInstId(null);
    setInstChequeNumber("");
    setInstBankName("");
  };

  const handleSyncDocToDrive = async (docId: string) => {
    setSyncingDocId(docId);
    try {
      await syncCaseDocumentToDrive(currentCase.id, docId);
    } finally {
      setSyncingDocId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 text-slate-800">
      {/* Dedicated Full-Page Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-lg border border-slate-800">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-2 border border-slate-700/70 shadow-xs active:scale-95 shrink-0"
            title={language === "ar" ? "العودة إلى قائمة القضايا" : "Back to Cases List"}
          >
            {language === "ar" ? <ArrowRight className="w-5 h-5 text-amber-400" /> : <ChevronLeft className="w-5 h-5 text-amber-400" />}
            <span className="text-xs font-bold">
              {language === "ar" ? "العودة للقضايا" : "Back to Cases"}
            </span>
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                {language === "ar" ? "ملف القضية القضائية المتكامل" : "Integrated Legal Case Workspace"}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {currentCase.courtName || "Court"} {currentCase.courtReferenceNumber ? `• #${currentCase.courtReferenceNumber}` : ""}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <h2 className="text-xl md:text-2xl font-black font-mono tracking-tight text-white flex items-center gap-2">
                <Scale className="w-6 h-6 text-purple-400" />
                <span>#{currentCase.caseNumber}</span>
              </h2>
              <Badge
                variant={
                  currentCase.status === "CLOSED"
                    ? "success"
                    : currentCase.status === "SETTLEMENT_IN_PROGRESS"
                    ? "warning"
                    : currentCase.status === "ENFORCEMENT"
                    ? "danger"
                    : "purple"
                }
              >
                {currentCase.status.replace(/_/g, " ")}
              </Badge>
              {tenant && (
                <span className="text-xs text-slate-300 font-medium bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/50">
                  {language === "ar" ? "المدعى عليه:" : "Defendant:"} <strong className="text-white">{language === "ar" ? tenant.nameAr : tenant.nameEn}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons & Status Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setLegalNoticeType("RDC_STATEMENT_OF_CLAIM");
              setIsLegalNoticeOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <Scale className="w-4 h-4 text-amber-300" />
            <span>{language === "ar" ? "صياغة لائحة دعوى (AI)" : "Draft Claim (AI)"}</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/60 w-[380px]">
            <span className="text-slate-400 text-[10px] px-1 font-bold">{language === "ar" ? "الحالة:" : "Status:"}</span>
            <SearchableSelect
              options={[
                { id: "NEW", label: "NEW (جديدة)" },
                { id: "IN_REVIEW", label: "IN_REVIEW (قيد المراجعة)" },
                { id: "FILED", label: "FILED (مقيدة بالمحكمة)" },
                { id: "HEARING_SCHEDULED", label: "HEARING_SCHEDULED (مجدولة جلسة)" },
                { id: "JUDGMENT_ISSUED", label: "JUDGMENT_ISSUED (صدر حكم)" },
                { id: "SETTLEMENT_IN_PROGRESS", label: "SETTLEMENT (تسوية ودية)" },
                { id: "ENFORCEMENT", label: "ENFORCEMENT (قيد التنفيذ الجبري)" },
                isEligibleForClosure
                  ? { id: "CLOSED", label: "CLOSED (مغلقة ومسددة)" }
                  : { id: "CLOSED_DISABLED", label: language === "ar" ? "CLOSED (غير متاح — بانتظار تصفية المستحقات)" : "CLOSED (Unavailable — awaiting clearance)", subLabel: language === "ar" ? "بانتظار تصفية المستحقات" : "Awaiting clearance" },
              ]}
              value={currentCase.status}
              onChange={(val) => {
                setStatusError("");
                if (val === "CLOSED_DISABLED") {
                  setStatusError(
                    language === "ar"
                      ? "لا يمكن إغلاق القضية لوجود مستحقات مالية معلقة. يجب أن تكون كافة مبالغ الشيكات والمصاريف مسددة بالكامل (المتبقي = 0)."
                      : "Cannot close this case because there are outstanding financial obligations. All linked cheques and legal expenses must be paid in full (Outstanding = 0)."
                  );
                  return;
                }
                handleStatusChange(val as any);
              }}
              placeholder={language === "ar" ? "تغيير الحالة..." : "Move to..."}
              searchPlaceholder={language === "ar" ? "ابحث بالحالة..." : "Search status..."}
              className="w-[310px] text-xs"
            />
          </div>
        </div>
      </div>

      {statusError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60 rounded-2xl font-semibold flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-rose-600 rounded-full shrink-0"></span>
            <span>{statusError}</span>
          </div>
          <button
            onClick={() => setStatusError("")}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold px-2 py-0.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Tab Navigation Buttons */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "OVERVIEW" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building className="w-4 h-4 text-purple-600" />
          <span>{language === "ar" ? "بيانات الدعوى والشيكات" : "Overview & Cheques"}</span>
        </button>
        <button
          onClick={() => setActiveTab("HEARINGS")}
          className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "HEARINGS" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>{language === "ar" ? `الجلسات القضائية (${(currentCase.hearings || []).length})` : `Court Hearings (${(currentCase.hearings || []).length})`}</span>
        </button>
        <button
          onClick={() => setActiveTab("SETTLEMENT")}
          className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "SETTLEMENT" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Handshake className="w-4 h-4 text-emerald-600" />
          <span>{language === "ar" ? "اتفاقية التسوية والتقسيط" : "Settlement Agreement"}</span>
        </button>
        <button
          onClick={() => setActiveTab("DOCUMENTS")}
          className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "DOCUMENTS" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4 text-amber-600" />
          <span>
            {language === "ar"
              ? `أوراق ومستندات القضية (${caseDocs.length})`
              : `Court Papers & Docs (${caseDocs.length})`}
          </span>
        </button>
      </div>

      <div className="space-y-6 text-xs">

        {/* TAB 1: OVERVIEW */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-4">
            {isEligibleForClosure && currentCase.status !== "CLOSED" && currentCase.status !== "ARCHIVED" && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/80 rounded-2xl text-emerald-900 dark:text-emerald-200 space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-emerald-600 text-white rounded-full">
                    <Check className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm">
                    {language === "ar"
                      ? "تمت تصفية جميع المستحقات المالية المرتبطة بهذه القضية بالكامل."
                      : "All financial obligations associated with this case have been fully settled."}
                  </h4>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-400 leading-relaxed font-medium">
                  {language === "ar"
                    ? "تم سداد جميع الشيكات الراجعة والمبالغ المستحقة المرتبطة بالقضية. أصبحت القضية الآن مؤهلة للإغلاق والأرشفة. سيتم إغلاق القضية وأرشفتها بعد تأكيد المستخدم."
                    : "All returned cheques and outstanding amounts related to this case have been paid in full. The case is now eligible for closure and archiving. The case will be closed and archived after user confirmation."}
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      if (window.confirm(
                        language === "ar"
                          ? "هل أنت متأكد من رغبتك في إغلاق هذه القضية وأرشفتها نهائياً؟"
                          : "Are you sure you want to close and archive this case permanently?"
                      )) {
                        const res = updateCaseStatus(currentCase.id, "CLOSED");
                        if (!res.success) {
                          setStatusError(res.error || "Failed to close case");
                        } else {
                          setStatusError("");
                          alert(language === "ar" ? "تم إغلاق القضية بنجاح." : "Case closed successfully.");
                        }
                      }
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                  >
                    {language === "ar" ? "إغلاق القضية الآن" : "Close Case Now"}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">{language === "ar" ? "إجمالي المطالبة:" : "Total Claim:"}</span>
                <span className="text-base font-black text-slate-900 font-mono">AED {(currentCase.claimAmount || 0).toLocaleString()}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-800 block uppercase font-bold">{language === "ar" ? "المسدد خلال الدعوى:" : "Recovered Amount:"}</span>
                <span className="text-base font-black text-emerald-950 font-mono">AED {(currentCase.paidAmount ?? currentCase.totalPaid ?? 0).toLocaleString()}</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] text-rose-800 block uppercase font-bold">{language === "ar" ? "المتبقي تحت التنفيذ:" : "Outstanding:"}</span>
                <span className="text-base font-black text-rose-950 font-mono">AED {(currentCase.outstandingAmount ?? currentCase.outstanding ?? 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                <span className="text-slate-500">{language === "ar" ? "أصل الشيكات:" : "Cheques principal:"}</span>
                <span className="font-bold text-slate-800">AED {linkedCheques.reduce((sum, c) => sum + c.outstanding, 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-slate-500">{language === "ar" ? "الرسوم القانونية:" : "Legal costs:"}</span>
                <span className="font-bold text-slate-800">AED {(currentCase.legalFeesClaimed || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                <span className="text-slate-500">{language === "ar" ? "رسوم الشيكات المرتجعة:" : "Bounced fees:"}</span>
                <span className="font-bold text-slate-800">AED {(linkedCheques.length * (currentCase.bouncedChequeFeePerUnit ?? legalSettings?.defaultBouncedChequeFee ?? 500)).toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-900 border-b border-slate-200 pb-1">
                  {language === "ar" ? "أطراف النزاع والعقار" : "Parties & Property"}
                </h5>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "المستأجر المدعى عليه:" : "Tenant (Defendant):"}</span>
                  <span className="font-bold text-slate-800">{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "المالك المدعي:" : "Owner (Plaintiff):"}</span>
                  <span className="font-semibold text-slate-800">{owner ? (language === "ar" ? owner.nameAr : owner.nameEn) : "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "العقار والوحدة المتنازع عليها:" : "Property / Unit:"}</span>
                  <span className="font-semibold text-slate-800">{prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "Property"} - Unit #{unit?.unitNumber}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-900 border-b border-slate-200 pb-1">
                  {language === "ar" ? "بيانات التقاضي والمحكمة" : "Litigation Details"}
                </h5>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "المحكمة:" : "Judicial Tribunal:"}</span>
                  <span className="font-bold text-slate-800">{caseItem.courtName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "المستشار القانوني المكلف:" : "Responsible Counsel:"}</span>
                  <span className="font-semibold text-slate-800">{caseItem.responsibleUserName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "رقم القيد الرسمي بالمحكمة:" : "Court Case #:"}</span>
                  <span className="font-mono font-bold text-purple-900">{caseItem.courtReferenceNumber || "Pending Court Number"}</span>
                </div>
              </div>
            </div>

            {/* Linked Cheques Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-700" />
                  <h5 className="font-bold text-slate-900">
                    {language === "ar" ? "الشيكات المرتبطة بالقضية" : "Linked Returned Cheques"}
                  </h5>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold text-[10px] rounded-md">
                    {linkedCheques.length} {language === "ar" ? "شيكات" : "cheques"}
                  </span>
                </div>

                {/* Case Action Buttons */}
                {caseItem.status !== "CLOSED" && caseItem.status !== "ARCHIVED" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setIsAddChequesModalOpen(true)}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{language === "ar" ? "إضافة شيكات للقضية" : "Add Cheques to Case"}</span>
                    </button>
                    <button
                      onClick={() => setIsAddNewChequeOpen(true)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{language === "ar" ? "إضافة شيك جديد" : "Add New Cheque"}</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 font-bold bg-slate-200 px-2.5 py-1 rounded-xl">
                    🔒 {language === "ar" ? "القضية مغلقة / للقراءة فقط" : "Case Closed (Read-Only)"}
                  </span>
                )}
              </div>

              {linkedCheques.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  {language === "ar" ? "لا توجد شيكات مرتبطة بهذه القضية بعد" : "No linked cheques for this case yet"}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {linkedCheques.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-xs">
                              #{c.chequeNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                              {c.bankName}
                            </span>
                            {c.returnReason && (
                              <span className="text-[10px] text-rose-800 font-bold bg-rose-100 px-2 py-0.5 rounded-md">
                                {c.returnReason}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-3">
                            <span>{language === "ar" ? `الاستحقاق: ${c.chequeDate}` : `Due: ${c.chequeDate}`}</span>
                            <span>{language === "ar" ? `الإرتجاع: ${c.returnedDate || c.chequeDate}` : `Returned: ${c.returnedDate || c.chequeDate}`}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold">
                            {language === "ar" ? "المبلغ" : "Amount"}
                          </span>
                          <span className="font-mono font-black text-rose-700 text-xs">
                            AED {c.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.outstanding > 0 && currentCase.status !== "CLOSED" && currentCase.status !== "ARCHIVED" && (
                            <button
                              onClick={() => {
                                setCollectingCheque(c);
                                setChequeCollectAmount(c.outstanding);
                                setChequeCollectNotes("");
                                setChequeCollectRef("");
                                const chqTenant = tenants.find((t) => t.id === c.tenantId);
                                setChequeCollectPayer(chqTenant ? (language === "ar" ? chqTenant.nameAr : chqTenant.nameEn) : "");
                                setChequeCollectMethod("BANK_TRANSFER");
                                setChequeCollectConfirm(false);
                                setChequeCollectError("");
                              }}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>{language === "ar" ? "تحصيل" : "Collect"}</span>
                            </button>
                          )}

                          <button
                            onClick={() => setViewingCheque(c)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{language === "ar" ? "معاينة" : "View"}</span>
                          </button>

                          {canRemoveChequeFromCase && currentCase.status !== "CLOSED" && currentCase.status !== "ARCHIVED" && (
                            <button
                              onClick={() => setChequeToUnlink(c)}
                              title={language === "ar" ? "إزالة الشيك من القضية" : "Remove cheque from case"}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{language === "ar" ? "حذف من القضية" : "Remove"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legal & Court Fees Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-600" />
                  <h5 className="font-bold text-slate-900">
                    {language === "ar" ? "الرسوم القانونية والمحاكم" : "Legal & Court Fees"}
                  </h5>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-md">
                    {(currentCase.linkedExpenseIds || []).length} {language === "ar" ? "بنود" : "items"}
                  </span>
                </div>
                {caseItem.status !== "CLOSED" && caseItem.status !== "ARCHIVED" && (
                  <button
                    onClick={() => {
                      setIsAddExpenseModalOpen(true);
                      setIsAddingNewExpense(false);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{language === "ar" ? "إدراج الرسوم القانونية والمحاكم" : "Add Legal & Court Fees"}</span>
                  </button>
                )}
              </div>

              {expenseActionError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60 rounded-xl font-semibold flex items-center justify-between gap-3 text-xs shadow-xs mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-rose-600 rounded-full shrink-0"></span>
                    <span>{expenseActionError}</span>
                  </div>
                  <button
                    onClick={() => setExpenseActionError("")}
                    className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold px-1.5 py-0.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Linked Expenses List */}
              {(!currentCase.linkedExpenseIds || currentCase.linkedExpenseIds.length === 0) ? (
                <div className="text-center py-4 text-slate-400 text-xs italic">
                  {language === "ar" ? "لا توجد رسوم قانونية مسجلة ومؤهلة لهذه القضية." : "No legal expenses linked from property expenses yet"}
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        setIsAddExpenseModalOpen(true);
                        setIsAddingNewExpense(true);
                      }}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{language === "ar" ? "تسجيل رسوم قانونية ومحاكم" : "Record Legal & Court Fees"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {propertyExpenses
                    .filter(e => (currentCase.linkedExpenseIds || []).includes(e.id))
                    .map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-xs">
                              #{exp.expenseNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                              {exp.expenseDate}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                            {exp.description}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold">
                            {language === "ar" ? "القيمة" : "Amount"}
                          </span>
                          <span className="font-mono font-black text-slate-900 text-xs">
                            AED {exp.totalAmount.toLocaleString()}
                          </span>
                        </div>
                        {currentCase.status !== "CLOSED" && currentCase.status !== "ARCHIVED" && (
                          <div className="flex items-center gap-1">
                            {exp.sourceType === "LEGAL_CASE" ? (
                              <button
                                onClick={() => {
                                  if (window.confirm(language === "ar" ? "هل أنت متأكد من حذف هذا المصروف نهائياً؟" : "Are you sure you want to permanently delete this expense?")) {
                                    setExpenseActionError("");
                                    deletePropertyExpense(exp.id).then((res) => {
                                      if (res && !res.success) {
                                        setExpenseActionError(res.error || "Failed to delete expense");
                                      }
                                    });
                                  }
                                }}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                title={language === "ar" ? "حذف المصروف نهائياً" : "Delete expense permanently"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setExpenseToUnlink(exp)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title={language === "ar" ? "إزالة الارتباط" : "Unlink expense"}
                              >
                                <Link className="w-4 h-4 rotate-45" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bounced Cheque Fees Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <h5 className="font-bold text-slate-900">
                    {language === "ar" ? "غرامات الشيكات المرتجعة" : "Bounced Cheque Fees"}
                  </h5>
                </div>
                {caseItem.status !== "CLOSED" && caseItem.status !== "ARCHIVED" && (
                  <button
                    onClick={() => {
                      setNewBouncedFee(currentCase.bouncedChequeFeePerUnit ?? legalSettings?.defaultBouncedChequeFee ?? 500);
                      setIsUpdatingBouncedFee(true);
                    }}
                    className="text-[10px] text-rose-600 font-bold hover:underline"
                  >
                    {language === "ar" ? "تعديل رسوم الارتجاع" : "Edit Bounced Fee"}
                  </button>
                )}
              </div>
              <label className="flex items-center gap-3 py-1 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  checked={currentCase.includeBouncedFees ?? false} 
                  onChange={(e) => updateCaseFeesConfig(currentCase.id, { includeBouncedFees: e.target.checked })}
                  disabled={currentCase.status === "CLOSED" || currentCase.status === "ARCHIVED"}
                />
                <span className="font-bold text-xs text-slate-700">
                  {language === "ar" ? "إضافة غرامة الشيكات المرتجعة إلى مبلغ التسوية" : "Include Bounced Cheque Fees in Settlement"}
                </span>
              </label>
              {(currentCase.includeBouncedFees ?? false) && (
                <div className="p-3 bg-white rounded-xl border border-rose-100 flex flex-col gap-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <div className="text-slate-600">
                      <span className="block mb-1">{language === "ar" ? "عدد الشيكات المربوطة:" : "Linked Cheques Count:"} <span className="font-bold text-slate-900">{linkedCheques.length}</span></span>
                      <span className="block">{language === "ar" ? "الغرامة لكل شيك:" : "Fee per Cheque:"} <span className="font-bold text-slate-900">{currentCase.bouncedChequeFeePerUnit ?? legalSettings?.defaultBouncedChequeFee ?? 500} AED</span></span>
                    </div>
                    <div className="text-right flex flex-col justify-end">
                      <span className="text-slate-400 block mb-1">{language === "ar" ? "إجمالي الغرامات:" : "Total Fees:"}</span>
                      <span className="font-mono font-black text-rose-700 text-sm">
                        AED {(linkedCheques.length * (currentCase.bouncedChequeFeePerUnit ?? legalSettings?.defaultBouncedChequeFee ?? 500)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {linkedCheques.length > 0 ? (
                    <div className="pt-2 border-t border-rose-100 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400 font-medium">{language === "ar" ? "الشيكات المحتسبة:" : "Calculated Cheques:"}</span>
                      {linkedCheques.map((chq) => (
                        <span key={chq.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[10px] font-semibold text-rose-800">
                          <span>#{chq.chequeNumber}</span>
                          <span className="text-rose-500">({chq.bankName || "Cheque"})</span>
                          <span className="font-mono text-rose-700">AED {chq.amount?.toLocaleString()}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-rose-100 text-[11px] text-amber-700 flex items-center justify-between">
                      <span>{language === "ar" ? "لا توجد شيكات مربوطة بالقضية حالياً." : "No cheques currently linked to this case."}</span>
                      <button
                        type="button"
                        onClick={() => setIsAddChequesModalOpen(true)}
                        className="text-xs font-bold text-rose-600 hover:underline"
                      >
                        {language === "ar" ? "+ ربط شيكات" : "+ Link Cheques"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Other Fees Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <h5 className="font-bold text-slate-900">
                  {language === "ar" ? "رسوم أخرى" : "Other Fees"}
                </h5>
              </div>
              <label className="flex items-center gap-3 py-1 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  checked={currentCase.includeOtherFees ?? false} 
                  onChange={(e) => updateCaseFeesConfig(currentCase.id, { includeOtherFees: e.target.checked })}
                  disabled={currentCase.status === "CLOSED" || currentCase.status === "ARCHIVED"}
                />
                <span className="font-bold text-xs text-slate-700">
                  {language === "ar" ? "إضافة رسوم أخرى إلى التسوية" : "Include Other Fees in Settlement"}
                </span>
              </label>
              {(currentCase.includeOtherFees ?? false) && (
                <div className="p-3 bg-white rounded-xl border border-purple-100 flex flex-col gap-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">{language === "ar" ? "المبلغ" : "Amount"}</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          className="w-full px-3 py-1.5 pl-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-bold font-mono"
                          value={otherFeesAmountInput}
                          placeholder="0.00"
                          onChange={(e) => handleOtherFeesAmountChange(e.target.value)}
                          disabled={currentCase.status === "CLOSED" || currentCase.status === "ARCHIVED"}
                        />
                        <span className="absolute left-3 top-1.5 text-slate-400 font-mono text-[10px]">AED</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">{language === "ar" ? "الوصف / البيان" : "Description"}</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        value={otherFeesDescInput}
                        placeholder={language === "ar" ? "مثال: مصاريف إدارية، رسوم إضافية..." : "e.g. Admin fees, additional expenses..."}
                        onChange={(e) => handleOtherFeesDescChange(e.target.value)}
                        disabled={currentCase.status === "CLOSED" || currentCase.status === "ARCHIVED"}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Settlement Summary Section */}
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3 text-white">
              <h5 className="font-bold border-b border-slate-800 pb-2">
                {language === "ar" ? "ملخص التسوية" : "Settlement Summary"}
              </h5>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>{language === "ar" ? "الشيكات:" : "Cheques:"}</span>
                  <span className="font-mono">{linkedCheques.reduce((sum, c) => sum + c.outstanding, 0).toLocaleString()} AED</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>{language === "ar" ? "الرسوم القانونية:" : "Legal Fees:"}</span>
                  <span className="font-mono">{(currentCase.legalFeesClaimed || 0).toLocaleString()} AED</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>{language === "ar" ? "غرامات الشيكات:" : "Bounced Fees:"}</span>
                  <span className="font-mono">
                    {((currentCase.includeBouncedFees ?? false) ? 
                      linkedCheques.length * (currentCase.bouncedChequeFeePerUnit ?? legalSettings?.defaultBouncedChequeFee ?? 500) 
                      : 0).toLocaleString()} AED
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>{language === "ar" ? "رسوم أخرى:" : "Other Fees:"}</span>
                  <span className="font-mono">
                    {((currentCase.includeOtherFees ?? false) ? (currentCase.otherFeesAmount || 0) : 0).toLocaleString()} AED
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800 pt-2 font-bold text-sm text-white">
                  <span>{language === "ar" ? "إجمالي التسوية:" : "Total Settlement:"}</span>
                  <span className="font-mono">{currentCase.claimAmount.toLocaleString()} AED</span>
                </div>
                <div className="flex justify-between items-center pt-2 text-emerald-400">
                  <span>{language === "ar" ? "المحصل:" : "Collected:"}</span>
                  <span className="font-mono">{(currentCase.paidAmount ?? currentCase.totalPaid ?? 0).toLocaleString()} AED</span>
                </div>
                <div className="flex justify-between items-center text-amber-400">
                  <span>{language === "ar" ? "المتبقي:" : "Remaining:"}</span>
                  <span className="font-mono">{currentCase.outstanding.toLocaleString()} AED</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HEARINGS */}
        {activeTab === "HEARINGS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900">{language === "ar" ? "سجل الجلسات وقرارات المحكمة" : "Court Hearings Log"}</h4>
              <button
                onClick={() => setIsAddHearingOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === "ar" ? "إضافة موعد جلسة جديدة" : "Schedule Hearing"}</span>
              </button>
            </div>

            <div className="space-y-2">
              {(caseItem.hearings || caseItem.sessions || []).map((h) => {
                const date = (h as any).hearingDate || h.date || "";
                const time = (h as any).hearingTime || h.time || "";
                const room = (h as any).courtRoom || "Hall 4";
                const notes = h.notes || (h as any).summary || (h as any).decision || "No judge notes recorded";
                const status = (h as any).status || "SCHEDULED";
                return (
                  <div key={h.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-purple-700" />
                        <span className="font-mono font-bold text-slate-900">{date}</span>
                        <span className="text-slate-500 font-mono">({time})</span>
                      </div>
                      <Badge variant={status === "COMPLETED" ? "success" : "purple"}>
                        {status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span className="font-bold text-slate-800">{room}: </span>
                      {notes}
                    </div>
                  </div>
                );
              })}

              {(!caseItem.hearings || caseItem.hearings.length === 0) && (!caseItem.sessions || caseItem.sessions.length === 0) && (
                <div className="text-center py-8 text-slate-400">
                  {language === "ar" ? "لم يتم جدولة جلسات بعد" : "No hearings scheduled yet"}
                </div>
              )}
            </div>

            {/* Add Hearing Submodal */}
            {isAddHearingOpen && (
              <form onSubmit={handleAddHearingSubmit} className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-3">
                <h5 className="font-bold text-purple-950">{language === "ar" ? "جدولة جلسة قضائية جديدة" : "Schedule New Hearing Session"}</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={hearingDate}
                      onChange={(e) => setHearingDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Time</label>
                    <input
                      type="text"
                      value={hearingTime}
                      onChange={(e) => setHearingTime(e.target.value)}
                      placeholder="10:30 AM"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Hall / Chamber</label>
                    <input
                      type="text"
                      value={courtRoom}
                      onChange={(e) => setCourtRoom(e.target.value)}
                      placeholder="Chamber 4"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Decision / Hearing Objective Notes</label>
                  <textarea
                    rows={2}
                    value={hearingNotes}
                    onChange={(e) => setHearingNotes(e.target.value)}
                    placeholder="First defense hearing / witness testimony..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddHearingOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-purple-700 rounded-xl"
                  >
                    Save Hearing
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: SETTLEMENT */}
        {activeTab === "SETTLEMENT" && (
          <div className="space-y-4">
            {currentCase.settlement ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 text-sm">
                    {language === "ar" ? "اتفاقية تسوية ودية معتمدة وموثقة" : "Notarized Settlement Agreement Active"}
                  </span>
                  <Badge variant="success">ACTIVE SETTLEMENT</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">{language === "ar" ? "المبلغ المتفق عليه:" : "Agreed Settlement Amount:"}</span>
                    <span className="font-black text-emerald-900 font-mono text-base">AED {currentCase.settlement.totalAgreedAmount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{language === "ar" ? "عدد الأقساط:" : "Installments:"}</span>
                    <span className="font-bold text-slate-800">{currentCase.settlement.installmentsCount} Installments</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h6 className="font-bold text-slate-800 text-[11px]">{language === "ar" ? "جدول سداد أقساط التسوية" : "Installment Schedule"}</h6>
                    {(currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER") && (
                      <button 
                        onClick={() => {
                          if(window.confirm("Are you sure you want to cancel this settlement?")) {
                            saveSettlementAgreement?.(currentCase.id, null as any);
                          }
                        }}
                        className="text-[10px] text-rose-600 font-bold hover:underline"
                      >
                        {language === "ar" ? "إلغاء التسوية" : "Cancel Settlement"}
                      </button>
                    )}
                  </div>
                  
                  {(() => {
                    if (!currentCase.settlement) return null;
                    let sched = currentCase.settlement.schedule || (currentCase.settlement as any).installmentSchedule || [];
                    if (sched.length === 0 && currentCase.settlement.installmentsCount > 0) {
                       sched = Array.from({ length: currentCase.settlement.installmentsCount }).map((_, i) => {
                         const d = new Date(currentCase.settlement?.signedDate || new Date());
                         d.setMonth(d.getMonth() + i + 1);
                         return {
                           id: `inst-fallback-${i}`,
                           installmentNumber: i + 1,
                           dueDate: d.toISOString().split("T")[0],
                           amount: Math.round((currentCase.settlement?.totalAgreedAmount || 0) / (currentCase.settlement?.installmentsCount || 1)),
                           status: "PENDING",
                         };
                       });
                    }
                    return sched.map((inst: any, idx: number) => (
                      <div key={inst.id || idx} className="bg-white rounded-2xl border border-emerald-200 overflow-hidden shadow-xs">
                      <div className="p-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            inst.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                            inst.status === "PROCESSING" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-500"
                          }`}>
                            #{inst.installmentNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{language === "ar" ? "قسط رقم" : "Installment"} #{inst.installmentNumber}</span>
                              <Badge variant={
                                inst.status === "PAID" ? "success" :
                                inst.status === "PROCESSING" ? "warning" :
                                "neutral"
                              }>
                                {inst.status}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 font-mono">
                              <Calendar className="w-3 h-3" />
                              <span>{language === "ar" ? "تاريخ الاستحقاق:" : "Due Date:"} {inst.dueDate}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="font-mono font-black text-slate-900 text-sm">AED {inst.amount.toLocaleString()}</span>
                          {inst.status === "PENDING" && (
                            <button
                              onClick={() => {
                                setPayingInstallmentId(inst.id);
                                setPaymentAmount(inst.amount);
                                setPaymentMethod("CASH");
                              }}
                              className="mt-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer transition-colors"
                            >
                              {language === "ar" ? "تسديد القسط" : "Record Payment"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Payment Details Area */}
                      {(inst.status === "PAID" || inst.status === "PROCESSING") && (
                        <div className="p-3 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                          <div className="space-y-1">
                            <div className="flex justify-between border-b border-slate-100 pb-0.5">
                              <span className="text-slate-400">{language === "ar" ? "طريقة الدفع:" : "Payment Method:"}</span>
                              <span className="font-bold text-slate-700">{inst.paymentMethod}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-0.5">
                              <span className="text-slate-400">{language === "ar" ? "تاريخ السداد:" : "Paid Date:"}</span>
                              <span className="font-bold text-slate-700">{inst.paidDate}</span>
                            </div>
                          </div>

                          {inst.paymentMethod === "CHEQUE" && inst.chequeDetails && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 flex items-center gap-1">
                                  <CreditCard className="w-3 h-3 text-purple-600" />
                                  {language === "ar" ? "بيانات الشيك" : "Cheque Details"}
                                </span>
                                {inst.status === "PROCESSING" && (
                                  <div className="flex gap-1">
                                    {(currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER") && (
                                      <button
                                        onClick={() => {
                                          setEditingChequeInstId(inst.id);
                                          setInstChequeNumber(inst.chequeDetails?.chequeNumber || "");
                                          setInstChequeDate(inst.chequeDetails?.chequeDate || "");
                                          setInstBankName(inst.chequeDetails?.bankName || "");
                                        }}
                                        className="text-[10px] text-blue-600 font-bold hover:underline"
                                      >
                                        {language === "ar" ? "تعديل" : "Edit"}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (window.confirm(language === "ar" ? "هل تم تحصيل وصرف هذا الشيك فعلياً؟" : "Confirm that this cheque has been cleared?")) {
                                          clearSettlementCheque(currentCase.id, inst.id);
                                        }
                                      }}
                                      className="text-[10px] text-emerald-600 font-bold hover:underline"
                                    >
                                      {language === "ar" ? "تأكيد التحصيل" : "Clear Now"}
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400"># {inst.chequeDetails.chequeNumber}</span>
                                <span className="font-bold text-slate-700">{inst.chequeDetails.bankName}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">{language === "ar" ? "تاريخ الاستحقاق:" : "Due Date:"}</span>
                                <span className="font-semibold text-slate-600">{inst.chequeDetails.chequeDate}</span>
                              </div>
                              {inst.chequeDetails.isCleared && (
                                <div className="flex justify-between text-[10px] text-emerald-600 pt-0.5 border-t border-emerald-50">
                                  <span>{language === "ar" ? "تاريخ التحصيل:" : "Cleared Date:"}</span>
                                  <span className="font-bold">{inst.chequeDetails.clearedDate}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Payment Form (Inline) */}
                      {payingInstallmentId === inst.id && (
                        <div className="p-4 bg-emerald-50 border-t border-emerald-200">
                          <form onSubmit={handlePayInstallment} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h6 className="font-bold text-emerald-900">{language === "ar" ? "تسجيل عملية دفع القسط" : "Record Installment Payment"}</h6>
                              <button type="button" onClick={() => setPayingInstallmentId(null)} className="text-slate-400 hover:text-slate-600">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">{language === "ar" ? "مبلغ الدفع" : "Amount"}</label>
                                <input
                                  type="number"
                                  required
                                  max={inst.amount}
                                  value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                                  className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Method *</label>
                                <SearchableSelect
                                  options={[
                                    { id: "CASH", label: "Cash (نقدي)" },
                                    { id: "BANK_TRANSFER", label: "Bank Transfer (تحويل)" },
                                    { id: "CREDIT_CARD", label: "Visa / Card (فيزا)" },
                                    { id: "CHEQUE", label: "Cheque (شيك بنكي)" },
                                  ]}
                                  value={paymentMethod}
                                  onChange={(val) => setPaymentMethod(val as any)}
                                  placeholder={language === "ar" ? "اختر الطريقة..." : "Select method..."}
                                  searchPlaceholder={language === "ar" ? "ابحث بالطريقة..." : "Search method..."}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Date *</label>
                                <input
                                  type="date"
                                  value={paymentDate}
                                  onChange={(e) => setPaymentDate(e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg"
                                />
                              </div>
                            </div>

                            {paymentMethod === "CHEQUE" ? (
                              <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Cheque # *</label>
                                    <input
                                      type="text"
                                      required
                                      value={instChequeNumber}
                                      onChange={(e) => setInstChequeNumber(e.target.value)}
                                      className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Cheque Date *</label>
                                    <input
                                      type="date"
                                      required
                                      value={instChequeDate}
                                      onChange={(e) => setInstChequeDate(e.target.value)}
                                      className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Bank Name *</label>
                                  <input
                                    type="text"
                                    required
                                    value={instBankName}
                                    onChange={(e) => setInstBankName(e.target.value)}
                                    className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Reference / Note</label>
                                <input
                                  type="text"
                                  value={paymentRef}
                                  onChange={(e) => setPaymentRef(e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg"
                                />
                              </div>
                            )}

                            <button
                              type="submit"
                              className="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md"
                            >
                              {paymentMethod === "CHEQUE" 
                                ? (language === "ar" ? "تسجيل الشيك (قيد التحصيل)" : "Record Cheque (Processing)")
                                : (language === "ar" ? "تأكيد الدفع والاستلام" : "Confirm Payment Received")
                              }
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Edit Cheque Form (Admin) */}
                      {editingChequeInstId === inst.id && (
                        <div className="p-4 bg-blue-50 border-t border-blue-200">
                          <form onSubmit={handleUpdateCheque} className="space-y-3">
                            <h6 className="font-bold text-blue-900">{language === "ar" ? "تعديل بيانات الشيك (صلاحية مدير)" : "Edit Cheque Details (Admin)"}</h6>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Cheque #</label>
                                <input
                                  type="text"
                                  required
                                  value={instChequeNumber}
                                  onChange={(e) => setInstChequeNumber(e.target.value)}
                                  className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Cheque Date</label>
                                <input
                                  type="date"
                                  required
                                  value={instChequeDate}
                                  onChange={(e) => setInstChequeDate(e.target.value)}
                                  className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Bank Name</label>
                              <input
                                type="text"
                                required
                                value={instBankName}
                                onChange={(e) => setInstBankName(e.target.value)}
                                className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setEditingChequeInstId(null)} className="flex-1 py-1.5 text-slate-600 font-bold text-xs">
                                {t("cancel")}
                              </button>
                              <button type="submit" className="flex-2 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs">
                                Save Changes
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  ));
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
                <Handshake className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-800">{language === "ar" ? "لا توجد اتفاقية تسوية مسجلة لهذه القضية" : "No settlement agreement registered"}</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  {language === "ar"
                    ? "يمكنك إنشاء اتفاقية تسوية وجدولة الأقساط الودية لوقف إجراءات التقاضي مؤقتاً."
                    : "Create a formal settlement agreement and schedule installments to pause active litigation."}
                </p>
                <button
                  onClick={() => setIsSettlementOpen(true)}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs"
                >
                  {language === "ar" ? "إنشاء اتفاقية تسوية جديدة" : "Draft Settlement Agreement"}
                </button>
              </div>
            )}

            {isSettlementOpen && (
              <form onSubmit={handleSaveSettlement} className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-3">
                <h5 className="font-bold text-purple-950">{language === "ar" ? "تحرير بنود التسوية والتقسيط" : "Draft Settlement Agreement Terms"}</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Agreed Amount (AED) *</label>
                    <input
                      type="number"
                      required
                      value={settlementAmount}
                      onChange={(e) => setSettlementAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Installments Count</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={installmentsCount}
                      onChange={(e) => setInstallmentsCount(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Settlement Notes & Terms</label>
                  <textarea
                    rows={2}
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    placeholder="Tenant to pay monthly via certified manager cheque..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                {draftSchedule.length > 0 && (
                  <div className="space-y-2 mt-4 bg-white p-3 rounded-2xl border border-purple-100">
                    <h6 className="font-bold text-slate-800 text-[11px]">{language === "ar" ? "تخصيص جدول الأقساط" : "Customize Installment Schedule"}</h6>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {draftSchedule.map((inst, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <span className="text-xs font-bold w-6 text-slate-400">{idx + 1}.</span>
                          <input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => {
                              const newSched = [...draftSchedule];
                              newSched[idx].dueDate = e.target.value;
                              setDraftSchedule(newSched);
                            }}
                            className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                          />
                          <input
                            type="number"
                            value={inst.amount}
                            onChange={(e) => {
                              const newSched = [...draftSchedule];
                              newSched[idx].amount = parseFloat(e.target.value) || 0;
                              setDraftSchedule(newSched);
                            }}
                            className="w-24 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                          />
                          <span className="text-xs text-slate-500">AED</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsSettlementOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-purple-700 rounded-xl"
                  >
                    Commit Settlement Agreement
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 4: DOCUMENTS */}
        {activeTab === "DOCUMENTS" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl">
              <div>
                <h4 className="font-bold text-amber-950 text-sm">
                  {language === "ar" ? "أوراق وملفات القضية والأرشيف الإلكتروني" : "Court Papers & Legal Documents"}
                </h4>
                <p className="text-[11px] text-amber-800">
                  {language === "ar"
                    ? "أرشفة صحف الدعوى، مذكرات الدفاع، شهادات الارتجاع، وتقارير الخبير مع حفظها في Google Drive"
                    : "Archive claims, defense memos, bounce certificates, and expert reports with Google Drive sync"}
                </p>
              </div>
              <button
                onClick={() => setIsDocUploadOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{language === "ar" ? "إرفاق ورقة قضائية جديدة" : "Attach Court Paper"}</span>
              </button>
            </div>

            {/* Court Documents List */}
            <div className="space-y-2.5">
              <h5 className="font-bold text-slate-800 text-xs flex items-center justify-between">
                <span>{language === "ar" ? "المستندات والأوراق المرفقة بالملف:" : "Attached Documents in Dossier:"}</span>
                <span className="text-slate-500 font-mono text-[11px]">{caseDocs.length} {language === "ar" ? "وثائق" : "files"}</span>
              </h5>

              {caseDocs.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {caseDocs.map((doc, idx) => {
                    const isSynced = Boolean(doc.driveWebViewLink || doc.driveFileId);
                    return (
                      <div
                        key={`${doc.id}-${idx}`}
                        className="p-3.5 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{doc.title}</span>
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[10px] font-semibold">
                                {doc.documentType.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                              <span>{doc.fileName}</span>
                              <span>•</span>
                              <span className="font-mono">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                              {doc.uploadedByName && (
                                <>
                                  <span>•</span>
                                  <span>{doc.uploadedByName}</span>
                                </>
                              )}
                            </div>
                            {doc.notes && (
                              <p className="text-[10px] text-slate-600 italic mt-1 bg-slate-50 px-2 py-1 rounded-md">
                                {doc.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Google Drive Status & Action */}
                          {isSynced ? (
                            <a
                              href={doc.driveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-[11px] transition-colors"
                              title="View in Google Drive"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{language === "ar" ? "في Google Drive" : "In Drive"}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSyncDocToDrive(doc.id)}
                              disabled={syncingDocId === doc.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl font-bold text-[11px] transition-colors cursor-pointer"
                              title="Sync to Google Drive"
                            >
                              <Cloud className="w-3.5 h-3.5 text-blue-600" />
                              <span>
                                {syncingDocId === doc.id
                                  ? language === "ar"
                                    ? "جاري المزامنة..."
                                    : "Syncing..."
                                  : language === "ar"
                                  ? "مزامنة إلى Drive"
                                  : "Sync to Drive"}
                              </span>
                            </button>
                          )}

                          {/* Preview / Download */}
                          {doc.fileUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                              title={language === "ar" ? "معاينة المستند" : "Preview Document"}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(language === "ar" ? "هل أنت متأكد من حذف هذا المستند من القضية؟" : "Are you sure you want to delete this document?")) {
                                  deleteCaseDocument(caseItem.id, doc.id);
                                }
                              }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-colors cursor-pointer"
                              title={language === "ar" ? "حذف المستند" : "Delete Document"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-700 text-xs">
                    {language === "ar" ? "لم يتم إرفاق أوراق قضائية بعد" : "No court documents attached yet"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {language === "ar"
                      ? "انقر على زر 'إرفاق ورقة قضائية جديدة' أعلاه لرفع صحف الدعوى أو تقارير الخبراء."
                      : "Click 'Attach Court Paper' above to upload statement of claim or expert reports."}
                  </p>
                </div>
              )}
            </div>

            {/* Linked Cheques Scans & Attachments */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <h5 className="font-bold text-slate-800 text-xs">
                {language === "ar" ? "صور الشيكات المرتجعة المرفقة بهذه القضية:" : "Cheque Scans Attached to this Case:"}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {linkedCheques.map((c) => {
                  const hasImage = Boolean(c.imageUrl);
                  const isSynced = Boolean(c.driveWebViewLink || c.driveFileId);
                  return (
                    <div
                      key={c.id}
                      className="p-3 bg-white rounded-2xl border border-slate-200 flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            #{c.chequeNumber}
                          </span>
                          <span className="text-slate-400 block text-[10px]">
                            {c.bankName}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-rose-700 text-xs">
                          AED {c.amount.toLocaleString()}
                        </span>
                      </div>

                      {hasImage && c.imageUrl ? (
                        <div className="relative h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                          <img
                            src={c.imageUrl}
                            alt={`Cheque #${c.chequeNumber}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-16 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-[10px]">
                          {language === "ar" ? "لا توجد صورة شيك مرفقة" : "No cheque scan attached"}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        {isSynced && c.driveWebViewLink ? (
                          <a
                            href={c.driveWebViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] underline"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Google Drive</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            {hasImage ? (language === "ar" ? "محفوظ محلياً" : "Local Archive") : ""}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedChequeForUpload(c)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Upload className="w-3 h-3 text-amber-700" />
                          <span>{hasImage ? (language === "ar" ? "تغيير الصورة / مزامنة" : "Update / Sync") : (language === "ar" ? "تحميل صورة الشيك" : "Upload Scan")}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="pt-6 mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <Scale className="w-4 h-4 text-purple-600" />
            <span>
              {language === "ar"
                ? `قضية رقم #${currentCase.caseNumber} — ${currentCase.courtName || "المحكمة"}`
                : `Case #${currentCase.caseNumber} — ${currentCase.courtName || "Court"}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              {language === "ar" ? <ArrowRight className="w-4 h-4 text-amber-400" /> : <ChevronLeft className="w-4 h-4 text-amber-400" />}
              <span>{language === "ar" ? "إغلاق والعودة لقائمة القضايا" : "Close & Return to Cases List"}</span>
            </button>
          </div>
        </div>

        {/* AI Legal Notice / Statement of Claim Modal */}
        <LegalNoticeGeneratorModal
          isOpen={isLegalNoticeOpen}
          onClose={() => setIsLegalNoticeOpen(false)}
          initialCheques={linkedCheques}
          initialTenant={tenant}
          defaultNoticeType={legalNoticeType}
        />

        {/* Case Document Upload Modal */}
        <CaseDocumentUploadModal
          isOpen={isDocUploadOpen}
          onClose={() => setIsDocUploadOpen(false)}
          caseItem={caseItem}
        />

      {/* MODAL: LINK PROPERTY EXPENSE */}
      <Modal
        isOpen={isAddExpenseModalOpen}
        onClose={() => {
          setIsAddExpenseModalOpen(false);
          setExpenseSearchTerm("");
          setSelectedExpenseIds([]);
          setIsAddingNewExpense(false);
        }}
        title={isAddingNewExpense 
          ? (language === "ar" ? "تسجيل رسوم قانونية جديدة" : "Record New Legal Fee")
          : (language === "ar" ? "ربط رسوم قانونية بالقضية" : "Link Legal Fees to Case")}
        maxWidth="md"
      >
        <div className="space-y-4">
          {!isAddingNewExpense ? (
            <>
              <div className="flex items-center justify-between gap-2 p-3 bg-amber-50/70 rounded-2xl border border-amber-200/60">
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  {language === "ar" 
                    ? "اختر الرسوم القانونية والمصاريف المسجلة للمالك لربطها بهذه القضية، أو سجل رسوماً جديدة."
                    : "Select legal fees registered for the owner to link to this case, or record new fees."}
                </p>
                <button
                  onClick={handleNavigateToPropertyExpenses}
                  className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5"
                  title={language === "ar" ? "الانتقال لشاشة مصاريف العقار" : "Go to Property Expenses"}
                >
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>{language === "ar" ? "شاشة المصاريف" : "Expenses View"}</span>
                </button>
              </div>

              <div className="max-h-[480px] overflow-y-auto pr-1 space-y-6">
                {/* SUGGESTED MATCHES */}
                {suggestedExpenses.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h6 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {language === "ar" ? "رسوم قانونية مقترحة لهذه القضية" : "Suggested Legal Fees for this Case"}
                      </h6>
                    </div>
                    <div className="space-y-2">
                      {suggestedExpenses.map(exp => {
                        const isSelected = selectedExpenseIds.includes(exp.id);
                        const expTenant = tenants.find(t => t.id === exp.tenantId);
                        const expUnit = units.find(u => u.id === exp.unitId);
                        return (
                          <div
                            key={exp.id}
                            onClick={() => {
                              setSelectedExpenseIds(prev => 
                                prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id]
                              );
                            }}
                            className={`w-full p-4 border-2 rounded-2xl transition-all text-right group relative overflow-hidden cursor-pointer ${
                              isSelected 
                                ? "bg-amber-50 border-amber-500 shadow-sm" 
                                : "bg-white border-slate-200 hover:border-amber-300"
                            }`}
                          >
                            {isSelected && <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm transition-colors ${
                                  isSelected ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400"
                                }`}>
                                  {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 text-sm">AED {exp.totalAmount.toLocaleString()}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">#{exp.expenseNumber}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 font-bold mt-0.5">
                                    {expTenant ? (expTenant.nameAr || expTenant.nameEn) : (language === "ar" ? "غير محدد" : "N/A")}
                                    {expUnit && <span className="mx-1 text-slate-300">|</span>}
                                    {expUnit && <span className="text-indigo-600">{language === "ar" ? "وحدة " : "Unit "}{expUnit.unitNumber}</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 justify-end">
                                    <span>{exp.description}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span className="font-mono">{exp.expenseDate}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-left shrink-0">
                                <div className="text-[9px] text-amber-600 font-bold bg-amber-100 px-1.5 py-0.5 rounded uppercase">
                                  {language === "ar" ? "مطابقة ذكية" : "Smart Match"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* OTHER ELIGIBLE */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                    <h6 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {language === "ar" ? "رسوم قانونية أخرى متاحة للمالك" : "Other Available Legal Expenses for Owner"}
                    </h6>
                    {unlinkedLegalExpenses.length > 3 && (
                      <div className="relative">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder={language === "ar" ? "بحث برقم المصروف أو المستأجر..." : "Search by # or tenant..."}
                          value={expenseSearchTerm}
                          onChange={(e) => setExpenseSearchTerm(e.target.value)}
                          className="w-full sm:w-48 pl-8 pr-7 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] focus:ring-2 focus:ring-amber-500/20 outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {unlinkedLegalExpenses.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 px-4">
                        <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-medium">
                          {language === "ar" ? "لا توجد رسوم قانونية ومحاكم مسجلة غير مربوطة لهذه القضية." : "No unlinked legal/court fees registered for this case."}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                          {language === "ar" 
                            ? "يمكنك تسجيل الرسوم بسرعة من هنا مباشرة أو الانتقال لشاشة مصاريف العقار الكاملة." 
                            : "You can quickly add fees directly here or navigate to the full Property Expenses view."}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <button 
                            onClick={() => setIsAddingNewExpense(true)}
                            className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors flex items-center gap-2 shadow-xs"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            {language === "ar" ? "تسجيل سريع ومباشر" : "Quick Add Expense"}
                          </button>
                          <button 
                            onClick={handleNavigateToPropertyExpenses}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                          >
                            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 text-slate-500" />
                            {language === "ar" ? "شاشة مصاريف العقار" : "Property Expenses"}
                          </button>
                        </div>
                      </div>
                    ) : filteredOtherExpenses.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-[10px] italic">
                        {language === "ar" ? "لم يتم العثور على نتائج للبحث" : "No search results found"}
                      </div>
                    ) : (
                      filteredOtherExpenses.map(exp => {
                        const isSelected = selectedExpenseIds.includes(exp.id);
                        const expTenant = tenants.find(t => t.id === exp.tenantId);
                        const expUnit = units.find(u => u.id === exp.unitId);
                        return (
                          <div
                            key={exp.id}
                            onClick={() => {
                              setSelectedExpenseIds(prev => 
                                prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id]
                              );
                            }}
                            className={`w-full p-3 border rounded-xl transition-all text-right group cursor-pointer ${
                              isSelected 
                                ? "bg-amber-50/50 border-amber-400 shadow-xs" 
                                : "bg-white border-slate-200 hover:border-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                  isSelected ? "bg-amber-500 text-white" : "bg-slate-50 text-slate-300"
                                }`}>
                                  {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs">AED {exp.totalAmount.toLocaleString()}</span>
                                    <span className="text-[9px] text-slate-400 font-mono">#{exp.expenseNumber}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-600 font-medium">
                                    {expTenant ? (expTenant.nameAr || expTenant.nameEn) : "—"}
                                    {expUnit && <span className="mx-1 opacity-30">|</span>}
                                    {expUnit && <span>{language === "ar" ? "وحدة " : "Unit "}{expUnit.unitNumber}</span>}
                                  </div>
                                  <div className="text-[9px] text-slate-500 mt-0.5 truncate max-w-[200px]">{exp.expenseDate} - {exp.description}</div>
                                </div>
                              </div>
                              <div className="text-left shrink-0">
                                <div className="text-[9px] text-emerald-600 font-bold">{language === "ar" ? "متاح" : "Available"}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-2 border-t border-slate-100">
                <button
                  onClick={() => setIsAddingNewExpense(true)}
                  className="px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm transition-colors flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 text-amber-600" />
                  {language === "ar" ? "تسجيل جديد" : "New"}
                </button>
                <button
                  disabled={selectedExpenseIds.length === 0}
                  onClick={() => {
                    linkMultipleExpensesToCase(currentCase.id, selectedExpenseIds);
                    setIsAddExpenseModalOpen(false);
                    setExpenseSearchTerm("");
                    setSelectedExpenseIds([]);
                  }}
                  className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    selectedExpenseIds.length > 0
                      ? "bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Link className="w-4 h-4" />
                  <span>
                    {language === "ar" 
                      ? `ربط الرسوم المحددة بالقضية (${selectedExpenseIds.length})` 
                      : `Link Selected Fees to Case (${selectedExpenseIds.length})`}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center shadow-sm">
                      <PlusCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {language === "ar" ? "تسجيل مصروف قانوني جديد" : "Register New Legal Expense"}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {language === "ar" ? "سيتم تسجيل المصروف مالياً وربطه بالقضية تلقائياً" : "Expense will be recorded financially and linked automatically"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleNavigateToPropertyExpenses}
                    className="px-2.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-800 rounded-xl text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 shrink-0"
                    title={language === "ar" ? "تسجيل مفصل من شاشة المصاريف" : "Detailed form in Expenses view"}
                  >
                    <ArrowRight className="w-3 h-3 rtl:rotate-180 text-amber-600" />
                    <span>{language === "ar" ? "شاشة المصاريف الكاملة" : "Full Expenses View"}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {newExpError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-[10px] font-bold flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" />
                      {newExpError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        {language === "ar" ? "المبلغ (AED)" : "Amount (AED)"}
                      </label>
                      <input
                        type="number"
                        value={newExpAmount || ""}
                        onChange={(e) => setNewExpAmount(Number(e.target.value))}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold font-mono focus:ring-2 focus:ring-amber-500/20 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        {language === "ar" ? "التاريخ" : "Date"}
                      </label>
                      <input
                        type="date"
                        value={newExpDate}
                        onChange={(e) => setNewExpDate(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold font-mono focus:ring-2 focus:ring-amber-500/20 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      {language === "ar" ? "البيان / الوصف" : "Description / Description"}
                    </label>
                    <textarea
                      value={newExpDescription}
                      onChange={(e) => setNewExpDescription(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm min-h-[80px] focus:ring-2 focus:ring-amber-500/20 outline-none resize-none"
                      placeholder={language === "ar" ? "مثال: رسوم فتح ملف قضية، رسوم محكمة..." : "e.g. Case opening fee, court fees..."}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      {language === "ar" ? "المتحمل للتكلفة" : "Cost Bearer"}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["OWNER", "TENANT", "OFFICE"] as const).map(bearer => (
                        <button
                          key={bearer}
                          type="button"
                          onClick={() => setNewExpCostBearer(bearer)}
                          className={`p-2.5 rounded-xl border-2 font-bold text-[10px] transition-all ${
                            newExpCostBearer === bearer 
                              ? "bg-amber-600 border-amber-600 text-white shadow-sm" 
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {bearer === "OWNER" ? (language === "ar" ? "المالك" : "Owner") :
                           bearer === "TENANT" ? (language === "ar" ? "المستأجر" : "Tenant") :
                           (language === "ar" ? "المكتب" : "Office")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddingNewExpense(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {language === "ar" ? "رجوع للقائمة" : "Back to List"}
                </button>
                <button
                  onClick={handleAddNewLegalExpense}
                  className="flex-[2] py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {language === "ar" ? "تسجيل وربط بالقضية" : "Record & Link to Case"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: UPDATE BOUNCED FEE */}
      <Modal
        isOpen={isUpdatingBouncedFee}
        onClose={() => setIsUpdatingBouncedFee(false)}
        title={language === "ar" ? "تعديل رسوم معالجة الشيكات المرتجعة" : "Update Bounced Cheque Fee"}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {language === "ar" ? "الرسوم لكل شيك مرتجع (AED):" : "Fee per bounced cheque (AED):"}
            </label>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min={0}
                value={newBouncedFee}
                onChange={(e) => setNewBouncedFee(Number(e.target.value))}
                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setNewBouncedFee(0)}
                className="px-3.5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl font-bold text-xs border border-rose-200 transition-colors cursor-pointer"
              >
                {language === "ar" ? "إلغاء الغرامة (0)" : "Waive (0)"}
              </button>
            </div>

            <div className="space-y-1.5 mb-2">
              <label className="block text-xs font-bold text-slate-700">
                {language === "ar" ? "سبب التعديل أو الإلغاء (إجباري): *" : "Reason for modification/cancellation (Mandatory): *"}
              </label>
              <input
                type="text"
                required
                value={bouncedFeeEditReason}
                onChange={(e) => setBouncedFeeEditReason(e.target.value)}
                placeholder={language === "ar" ? "اكتب سبب تعديل أو إلغاء الغرامة..." : "Enter reason for modifying or cancelling fee..."}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs focus:ring-2 focus:ring-amber-500/20 outline-none"
              />
            </div>

            <p className="text-[10px] text-slate-500 italic leading-relaxed">
              {language === "ar" 
                ? "سيتم ضرب هذه القيمة في عدد الشيكات المرتبطة بالقضية وإضافتها لإجمالي مبلغ المطالبة. وضعها 0 يلغي الغرامة تماماً."
                : "This value will be multiplied by the number of linked cheques and added to the total claim amount. Setting to 0 completely waives the fee."}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsUpdatingBouncedFee(false)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-colors"
            >
              {language === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              onClick={() => {
                if (!bouncedFeeEditReason.trim()) {
                  alert(language === "ar" ? "يرجى كتابة سبب التعديل أو الإلغاء" : "Please enter the reason for modification or cancellation");
                  return;
                }
                updateCaseBouncedFee(currentCase.id, newBouncedFee, bouncedFeeEditReason);
                setIsUpdatingBouncedFee(false);
                setBouncedFeeEditReason("");
              }}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-colors shadow-lg"
            >
              {language === "ar" ? "حفظ التعديل" : "Save Update"}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: CONFIRM UNLINK EXPENSE */}
      <ConfirmDeleteModal
        isOpen={!!expenseToUnlink}
        onClose={() => setExpenseToUnlink(null)}
        onConfirm={() => {
          if (expenseToUnlink) {
            setExpenseActionError("");
            const res = unlinkExpenseFromCase(currentCase.id, expenseToUnlink.id);
            if (res && !res.success) {
              setExpenseActionError(res.error || "Failed to unlink expense");
            }
            setExpenseToUnlink(null);
          }
        }}
        title={language === "ar" ? "إزالة ارتباط المصروف" : "Unlink Legal Expense"}
        itemName={expenseToUnlink?.expenseNumber || ""}
        itemType={language === "ar" ? "مصروف قانوني" : "Legal Expense"}
        warningMessage={
          language === "ar"
            ? `هل أنت متأكد من رغبتك في إزالة المصروف #${expenseToUnlink?.expenseNumber} من هذه القضية؟ سيؤدي ذلك لخصم مبلغ المصروف من إجمالي المطالبة.`
            : `Are you sure you want to unlink expense #${expenseToUnlink?.expenseNumber} from this case? This will subtract its amount from the total claim.`
        }
      />

        {/* Cheque Scan Upload Modal */}
        <ChequeImageUploadModal
          isOpen={Boolean(selectedChequeForUpload)}
          onClose={() => setSelectedChequeForUpload(null)}
          cheque={selectedChequeForUpload}
        />

        {/* Document Preview Modal */}
        {previewDoc && (
          <Modal
            isOpen={Boolean(previewDoc)}
            onClose={() => setPreviewDoc(null)}
            title={previewDoc.title}
            subtitle={previewDoc.fileName}
            icon={<FileText className="w-5 h-5 text-amber-600" />}
            maxWidth="3xl"
          >
            <div className="space-y-4">
              {previewDoc.fileUrl.startsWith("data:image/") || previewDoc.fileUrl.startsWith("http") ? (
                <div className="max-h-[70vh] overflow-auto flex justify-center bg-slate-900 rounded-2xl p-2">
                  <img
                    src={previewDoc.fileUrl}
                    alt={previewDoc.title}
                    referrerPolicy="no-referrer"
                    className="max-h-[65vh] object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="font-bold text-slate-800">{previewDoc.fileName}</p>
                  <p className="text-xs text-slate-500">{previewDoc.documentType}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {previewDoc.driveWebViewLink ? (
                  <a
                    href={previewDoc.driveWebViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs"
                  >
                    <span>{language === "ar" ? "فتح في Google Drive" : "Open in Google Drive"}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <div />
                )}

                <a
                  href={previewDoc.fileUrl}
                  download={previewDoc.fileName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{language === "ar" ? "تنزيل الملف" : "Download File"}</span>
                </a>
              </div>
            </div>
          </Modal>
        )}
        {/* Add Cheques To Case Modal */}
        <AddChequesToCaseModal
          isOpen={isAddChequesModalOpen}
          onClose={() => setIsAddChequesModalOpen(false)}
          caseItem={currentCase}
        />

        {/* Add New Cheque Modal */}
        <AddChequeModal
          isOpen={isAddNewChequeOpen}
          onClose={() => setIsAddNewChequeOpen(false)}
          initialTenantId={currentCase.tenantId}
          initialPropertyId={currentCase.propertyId}
          initialUnitId={currentCase.unitId}
          initialLeaseId={currentCase.leaseId}
          initialOwnerId={currentCase.ownerId}
          linkToCaseId={currentCase.id}
        />

        {/* Viewing Cheque Details Modal */}
        {viewingCheque && (
          <Modal
            isOpen={Boolean(viewingCheque)}
            onClose={() => setViewingCheque(null)}
            title={language === "ar" ? `تفاصيل الشيك رقم #${viewingCheque.chequeNumber}` : `Cheque Details #${viewingCheque.chequeNumber}`}
            subtitle={viewingCheque.bankName}
            icon={<CreditCard className="w-5 h-5 text-purple-700" />}
            maxWidth="2xl"
          >
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "رقم الشيك:" : "Cheque No:"}</span>
                  <span className="font-mono font-black text-slate-900 text-sm">#{viewingCheque.chequeNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "اسم البنك:" : "Bank:"}</span>
                  <span className="font-bold text-slate-900">{viewingCheque.bankName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "قيمة الشيك الأصلية:" : "Original Amount:"}</span>
                  <span className="font-mono font-black text-slate-900 text-sm">AED {viewingCheque.amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "المبلغ المتبقي / المستحق:" : "Outstanding:"}</span>
                  <span className="font-mono font-black text-rose-700 text-sm">AED {viewingCheque.outstanding.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "تاريخ الاستحقاق:" : "Due Date:"}</span>
                  <span className="font-semibold text-slate-800">{viewingCheque.chequeDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === "ar" ? "الحالة القانونية / التشغيلية:" : "Status:"}</span>
                  <Badge variant={viewingCheque.status === "UNDER_LEGAL" ? "purple" : "danger"}>
                    {viewingCheque.status} (Hist: {viewingCheque.originalStatus || "BOUNCED"})
                  </Badge>
                </div>
              </div>

              {viewingCheque.returnReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl">
                  <span className="font-bold block text-[10px] uppercase text-rose-800">
                    {language === "ar" ? "سبب الإرتجاع المبين من البنك:" : "Bank Return Reason:"}
                  </span>
                  <span className="font-bold">{viewingCheque.returnReason}</span>
                </div>
              )}

              {viewingCheque.imageUrl && (
                <div className="p-2 bg-slate-900 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    {language === "ar" ? "صورة الشيك المرفقة:" : "Attached Cheque Image:"}
                  </span>
                  <img
                    src={viewingCheque.imageUrl}
                    alt={viewingCheque.chequeNumber}
                    referrerPolicy="no-referrer"
                    className="max-h-52 object-contain mx-auto rounded-lg"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingCheque(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  {t("close")}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Unlink / Delete Cheque from Case Confirmation Modal */}
        <ConfirmDeleteModal
          isOpen={!!chequeToUnlink}
          onClose={() => setChequeToUnlink(null)}
          onConfirm={() => {
            if (chequeToUnlink && currentCase) {
              unlinkChequeFromCase(currentCase.id, chequeToUnlink.id, "إزالة من ملف القضية بواسطة المسئول");
              setChequeToUnlink(null);
            }
          }}
          title={language === "ar" ? "إزالة الشيك من ملف القضية" : "Remove Cheque from Case"}
          itemName={
            chequeToUnlink
              ? `${language === "ar" ? "الشيك رقم" : "Cheque #"} ${chequeToUnlink.chequeNumber} (${chequeToUnlink.bankName})`
              : ""
          }
          warningMessage={
            language === "ar"
              ? "ملاحظة: سيتم إلغاء ربط هذا الشيك بالقضية وإعادته إلى قائمة الشيكات المرتجعة المستحقة للتحصيل. لن يتم حذف الشيك نهائياً من النظام."
              : "Notice: This cheque will be unlinked from the case and returned to the active bounced cheques list. It will NOT be permanently deleted from the system."
          }
        />

        {collectingCheque && (
          <Modal
            isOpen={!!collectingCheque}
            onClose={() => {
              setCollectingCheque(null);
              setChequeCollectConfirm(false);
              setChequeCollectError("");
            }}
            title={language === "ar" ? "قيد وتحصيل شيك - بوابة القضية" : "Record Cheque Collection - Case Gateway"}
            subtitle={`Case #${currentCase.caseNumber} — Cheque #${collectingCheque.chequeNumber}`}
            maxWidth="xl"
          >
            <form onSubmit={handleRecordChequeCollection} className="space-y-4 text-xs text-left">
              <div className="p-3 bg-emerald-50 text-emerald-950 border border-emerald-200 rounded-xl space-y-1">
                <p className="font-bold">
                  {language === "ar" ? "✓ تحصيل مالي مشروع من داخل القضية" : "✓ Legitimate Payment from Case Gateway"}
                </p>
                <p className="text-[10px] text-emerald-800">
                  {language === "ar"
                    ? "يقوم النظام الآن بتوجيه هذا التدفق المالي كبوابة مأذونة ومفتوحة لتسديد الشيك المحجوز قضائياً."
                    : "The system is authorized to process this payment against the Case-Controlled cheque."}
                </p>
              </div>

              {chequeCollectError && (
                <div className="p-3 bg-rose-50 text-rose-900 border border-rose-200 rounded-xl font-bold">
                  {chequeCollectError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === "ar" ? "المبلغ المراد تحصيله (درهم)" : "Amount to Collect (AED)"} *
                </label>
                <input
                  type="number"
                  min={1}
                  max={collectingCheque.outstanding}
                  required
                  value={chequeCollectAmount}
                  onChange={(e) => setChequeCollectAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {language === "ar" 
                    ? `الحد الأقصى المتاح للسداد: ${collectingCheque.outstanding.toLocaleString()} درهم` 
                    : `Maximum outstanding allowed: AED ${collectingCheque.outstanding.toLocaleString()}`}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === "ar" ? "طريقة التحصيل" : "Payment Method"} *
                </label>
                <select
                  value={chequeCollectMethod}
                  onChange={(e) => setChequeCollectMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="BANK_TRANSFER">{language === "ar" ? "تحويل بنكي مباشر" : "Bank Transfer"}</option>
                  <option value="CASH">{language === "ar" ? "نقداً بالخزينة" : "Cash"}</option>
                  <option value="CREDIT_CARD">{language === "ar" ? "بطاقة بنكية" : "Credit Card"}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === "ar" ? "اسم القائم بالسداد" : "Payer Name"} *
                </label>
                <input
                  type="text"
                  required
                  value={chequeCollectPayer}
                  onChange={(e) => setChequeCollectPayer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === "ar" ? "رقم مرجع المعاملة" : "Transaction Reference"}
                </label>
                <input
                  type="text"
                  value={chequeCollectRef}
                  onChange={(e) => setChequeCollectRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === "ar" ? "ملاحظات التحصيل" : "Collection Notes"}
                </label>
                <textarea
                  value={chequeCollectNotes}
                  onChange={(e) => setChequeCollectNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  rows={2}
                />
              </div>

              {chequeCollectConfirm && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 leading-relaxed font-semibold">
                  {language === "ar"
                    ? "هل أنت متأكد من قيد السند والتحصيل؟ لا يمكن تعديل أو إلغاء السند بعد اعتماده."
                    : "Are you sure you want to authorize and commit this payment? Receipts are legally irreversible once saved."}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (chequeCollectConfirm) {
                      setChequeCollectConfirm(false);
                    } else {
                      setCollectingCheque(null);
                    }
                  }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl font-bold"
                >
                  {chequeCollectConfirm ? (language === "ar" ? "تعديل" : "Edit") : t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl"
                >
                  {chequeCollectConfirm
                    ? (language === "ar" ? "تأكيد نهائي وقيد السند" : "Finalize & Authorize Collection")
                    : (language === "ar" ? "تحصيل واعتماد السند" : "Authorize Collection")}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

export const CaseDetailsModal = CaseDetailsPage;


