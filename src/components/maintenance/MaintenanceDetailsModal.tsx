import React, { useState } from "react";
import {
  X,
  Wrench,
  Building,
  Home,
  User,
  Phone,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  Printer,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Briefcase,
  Layers,
  AlertCircle,
  Eye,
  Download,
  Check,
  CreditCard,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority,
  CostBearer,
  PaymentMethod,
  MaintenanceAttachment,
  MaintenanceInvoice,
} from "../../types";
import { Badge } from "../common/Badge";
import { OfficePrintHeader } from "../common/OfficePrintHeader";
import { SearchableSelect } from "../common/SearchableSelect";
import { DocumentUpload } from "../common/DocumentUpload";
import { DocumentOptimizationResult } from "../../types";

interface MaintenanceDetailsModalProps {
  request: MaintenanceRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (request: MaintenanceRequest) => void;
  onDelete?: (request: MaintenanceRequest) => void;
}

export const MaintenanceDetailsModal: React.FC<MaintenanceDetailsModalProps> = ({
  request,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  const {
    properties,
    units,
    tenants,
    owners,
    technicians,
    maintenanceSettings,
    updateMaintenanceRequest,
    updateMaintenanceStatus,
    postMaintenanceExpense,
    propertyExpenses,
    assignTechnicianToRequest,
    addMaintenanceInvoice,
    addMaintenancePayment,
    deleteMaintenanceInvoice,
    addMaintenanceAttachment,
    deleteMaintenanceAttachment,
    addMaintenanceNote,
    getNextMaintenanceInvoiceNumber,
    deletePropertyExpense,
  } = useData();

  const { t, language, formatAED } = useLanguage();
  const { currentUser, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "INVOICES" | "PAYMENTS" | "ATTACHMENTS" | "TIMELINE" | "FINANCIALS"
  >("OVERVIEW");

  const [isInsideIframe, setIsInsideIframe] = useState(false);

  React.useEffect(() => {
    setIsInsideIframe(window.self !== window.top);
  }, []);

  const getPrintUrl = () => {
    const url = new URL(window.location.href);
    if (request) {
      url.searchParams.set("printWorkOrderId", request.id);
    }
    return url.toString();
  };

  // New Note State
  const [newNote, setNewNote] = useState("");

  // Quick Status Change Modal
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<MaintenanceStatus>("OPEN");
  const [statusChangeNote, setStatusChangeNote] = useState("");
  const [completionDate, setCompletionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [returnReason, setReturnReason] = useState("");

  // Assign Technician State
  const [isAssigningTech, setIsAssigningTech] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [techAssignmentNote, setTechAssignmentNote] = useState("");

  // New Invoice State
  const [isAddingInvoice, setIsAddingInvoice] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendorName, setVendorName] = useState("");
  const [amountBeforeVat, setAmountBeforeVat] = useState<number>(0);
  const [isPaid, setIsPaid] = useState(true);
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<PaymentMethod>("CASH");
  const [invoiceFileBase64, setInvoiceFileBase64] = useState<string>("");
  const [invoiceFileName, setInvoiceFileName] = useState<string>("");

  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDateInput, setPaymentDateInput] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod>("CASH");

  const handleOpenAddInvoice = () => {
    const randomInvSuffix = Date.now() % 10000;
    const autoInvNum = `INV-${new Date().getFullYear()}-${randomInvSuffix}`;
    setInvoiceNumber(autoInvNum);
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setVendorName(request?.assignedTechnicianName || "");
    setAmountBeforeVat(0);
    setIsPaid(true);
    setInvoicePaymentMethod("CASH");
    setInvoiceFileBase64("");
    setInvoiceFileName("");
    setIsAddingInvoice(true);
  };

  // New Attachment State
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [attachmentCategory, setAttachmentCategory] = useState<
    "BEFORE_REPAIR" | "AFTER_REPAIR" | "ISSUE_PHOTO" | "INVOICE" | "QUOTATION" | "TECH_REPORT" | "OTHER"
  >("BEFORE_REPAIR");
  const [attachmentNotes, setAttachmentNotes] = useState("");
  const [attachmentFileBase64, setAttachmentFileBase64] = useState<string>("");
  const [attachmentFileName, setAttachmentFileName] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // Lightbox Preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Financial Edit State
  const [isEditingFinancials, setIsEditingFinancials] = useState(false);
  const [costBearer, setCostBearer] = useState<CostBearer>("OWNER");
  const [laborCost, setLaborCost] = useState<number>(0);
  const [partsCost, setPartsCost] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
  const [paymentDate, setPaymentDate] = useState<string>("");

  // Financial Posting State
  const [postingMsg, setPostingMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleManualPostExpense = () => {
    if (!request) return;
    const res = postMaintenanceExpense(request.id, { forceRepost: true });
    if (res.success) {
      setPostingMsg({
        text: language === "ar"
          ? "تم ترحيل القيد المالي الصارم للصيانة بنجاح وخصمها من حساب الطرف الملتزم!"
          : "Maintenance financial expense posted successfully!",
      });
    } else {
      setPostingMsg({
        text: res.error || (language === "ar" ? "تعذر ترحيل القيد المالي" : "Failed to post expense"),
        isError: true,
      });
    }
    setTimeout(() => setPostingMsg(null), 5000);
  };

  if (!isOpen || !request) return null;

  // Linked Entities
  const property = properties.find((p) => p.id === request.propertyId);
  const unit = units.find((u) => u.id === request.unitId);
  const tenant = request.tenantId ? tenants.find((t) => t.id === request.tenantId) : null;
  const owner = request.ownerId ? owners.find((o) => o.id === request.ownerId) : null;
  const currentTech = technicians.find((t) => t.id === request.assignedTechnicianId);

  // SLA Calculation
  const slaHours =
    maintenanceSettings?.slaHoursByPriority?.[request.priority] || 48;
  const requestDateObj = new Date(request.createdAt || request.requestDate);
  const now = new Date();
  const elapsedHours = (now.getTime() - requestDateObj.getTime()) / (1000 * 60 * 60);
  const isDelayed =
    request.status !== "COMPLETED" &&
    request.status !== "CANCELLED" &&
    request.status !== "REJECTED" &&
    elapsedHours > (maintenanceSettings?.delayedDaysThreshold || 5) * 24;

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addMaintenanceNote(request.id, newNote.trim());
    setNewNote("");
  };

  const handleStatusChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let noteText = statusChangeNote;
    if (selectedNewStatus === "REJECTED" || selectedNewStatus === "CANCELLED") {
      noteText = rejectionReason || statusChangeNote;
    } else if (selectedNewStatus === "RETURNED") {
      noteText = returnReason || statusChangeNote;
    }

    updateMaintenanceStatus(
      request.id,
      selectedNewStatus,
      noteText,
      selectedNewStatus === "COMPLETED" ? completionDate : undefined
    );

    if (selectedNewStatus === "REJECTED" || selectedNewStatus === "CANCELLED") {
      updateMaintenanceRequest(request.id, {
        rejectionReason: rejectionReason || statusChangeNote,
      });
    } else if (selectedNewStatus === "RETURNED") {
      updateMaintenanceRequest(request.id, {
        returnReason: returnReason || statusChangeNote,
      });
    }

    setIsChangingStatus(false);
    setStatusChangeNote("");
    setRejectionReason("");
    setReturnReason("");
  };

  const handleAssignTechSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId) return;
    assignTechnicianToRequest(request.id, selectedTechId, techAssignmentNote);
    setIsAssigningTech(false);
    setSelectedTechId("");
    setTechAssignmentNote("");
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (b64: string) => void,
    nameSetter: (name: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      nameSetter(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveAmount = Number(paymentAmount) || 0;

    if (effectiveAmount <= 0) {
      alert(language === "ar" ? "يرجى تحديد المبلغ بشكل صحيح أكبر من 0." : "Please enter a valid amount greater than 0.");
      return;
    }

    addMaintenancePayment(request.id, {
      amount: effectiveAmount,
      paymentDate: paymentDateInput || new Date().toISOString().split("T")[0],
      paymentMethod: paymentMethodInput,
    });

    setPaymentAmount(0);
    alert(language === "ar" ? "تم تسجيل الدفعة بنجاح" : "Payment recorded successfully");
  };

  const handleAddInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveInvoiceNum = invoiceNumber.trim() || getNextMaintenanceInvoiceNumber();
    const effectiveAmount = Number(amountBeforeVat) || 0;

    if (effectiveAmount <= 0) {
      alert(language === "ar" ? "يرجى تحديد مبلغ الفاتورة بشكل صحيح أكبر من 0." : "Please enter a valid invoice amount greater than 0.");
      return;
    }

    const vatAmount = Math.round(effectiveAmount * 0.05 * 100) / 100;
    const totalAmount = Math.round((effectiveAmount + vatAmount) * 100) / 100;

    addMaintenanceInvoice(request.id, {
      invoiceNumber: effectiveInvoiceNum,
      invoiceDate: invoiceDate || new Date().toISOString().split("T")[0],
      vendorName: vendorName.trim() || request.assignedTechnicianName || (language === "ar" ? "فني معتمد" : "Certified Technician"),
      description: "فاتورة صيانة وإصلاح",
      amount: effectiveAmount,
      vatAmount,
      totalAmount,
      status: isPaid ? "PAID" : "PENDING",
      paymentMethod: invoicePaymentMethod || "CASH",
      paymentDate: isPaid ? (invoiceDate || new Date().toISOString().split("T")[0]) : undefined,
      attachmentUrl: invoiceFileBase64 || undefined,
      attachmentName: invoiceFileName || undefined,
    });

    setIsAddingInvoice(false);
    setInvoiceNumber("");
    setVendorName("");
    setAmountBeforeVat(0);
    setIsPaid(true);
    setInvoiceFileBase64("");
    setInvoiceFileName("");
  };

  const handleAddAttachmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachmentFileBase64) return;

    setIsUploading(true);
    await addMaintenanceAttachment(request.id, {
      fileName: attachmentFileName || `attachment_${Date.now()}`,
      category: attachmentCategory,
      notes: attachmentNotes,
      fileUrl: attachmentFileBase64,
      fileType: (attachmentFileName || "").toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/jpeg",
    });

    setIsUploading(false);
    setIsAddingAttachment(false);
    setAttachmentFileBase64("");
    setAttachmentFileName("");
    setAttachmentNotes("");
  };

  const handleOpenFinancialEdit = () => {
    setCostBearer(request.costBearer || "OWNER");
    setLaborCost(request.laborCost || 0);
    setPartsCost(request.partsCost || 0);
    setOtherCost(request.otherCost || 0);
    setPaymentMethod(request.paymentMethod);
    setPaymentDate(request.paymentDate || "");
    setIsEditingFinancials(true);
  };

  const handleSaveFinancials = (e: React.FormEvent) => {
    e.preventDefault();
    const total = laborCost + partsCost + otherCost;
    const paid = request.paidAmount || 0;
    const remaining = Math.max(0, total - paid);
    
    let collectionStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
    if (paid >= total && total > 0) collectionStatus = "PAID";
    else if (paid > 0) collectionStatus = "PARTIALLY_PAID";

    updateMaintenanceRequest(request.id, {
      costBearer,
      laborCost,
      partsCost,
      otherCost,
      totalCost: total,
      remainingAmount: remaining,
      collectionStatus,
      paymentMethod,
      paymentDate: paymentDate || undefined,
    });
    setIsEditingFinancials(false);
  };

  const handlePrintWorkOrder = () => {
    window.print();
  };

  const getPriorityColor = (p: MaintenancePriority) => {
    switch (p) {
      case "URGENT":
        return "bg-rose-500 text-white font-black";
      case "HIGH":
        return "bg-amber-500 text-slate-950 font-bold";
      case "NORMAL":
        return "bg-sky-500 text-white font-medium";
      case "LOW":
        return "bg-slate-500 text-white font-normal";
    }
  };

  const getStatusBadge = (s: MaintenanceStatus) => {
    switch (s) {
      case "OPEN":
        return <Badge variant="warning">{t("maintStatus_OPEN")}</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="info">{t("maintStatus_IN_PROGRESS")}</Badge>;
      case "COMPLETED":
        return <Badge variant="success">{t("maintStatus_COMPLETED")}</Badge>;
      case "REJECTED":
        return <Badge variant="danger">{t("maintStatus_REJECTED")}</Badge>;
      case "CANCELLED":
        return <Badge variant="neutral">{t("maintStatus_CANCELLED")}</Badge>;
      case "RETURNED":
        return <Badge variant="warning">{t("maintStatus_RETURNED")}</Badge>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div
        id="maintenance-details-modal"
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-sm px-2.5 py-0.5 rounded-md bg-white/10 text-amber-400 font-bold border border-white/10">
                  {request.requestNumber}
                </span>
                {getStatusBadge(request.status)}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${getPriorityColor(
                    request.priority
                  )}`}
                >
                  {t(`maintPriority_${request.priority}` as any)}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {request.category}
                </span>
                {isDelayed && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {language === "ar" ? "متأخر تجاوز المهلة" : "Delayed SLA"}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                {request.issueDescription.substring(0, 70)}
                {request.issueDescription.length > 70 ? "..." : ""}
              </h2>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {isInsideIframe ? (
              <a
                href={getPrintUrl()}
                target="_blank"
                rel="noopener noreferrer"
                title={language === "ar" ? "افتح في نافذة جديدة للطباعة" : "Open in new tab to print"}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">{language === "ar" ? "افتح للطباعة ↗" : "Open to Print ↗"}</span>
              </a>
            ) : (
              <button
                onClick={handlePrintWorkOrder}
                title={language === "ar" ? "طباعة أمر الصيانة" : "Print Work Order"}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">{t("maintPrintRequest")}</span>
              </button>
            )}

            {hasPermission("DELETE_MAINTENANCE") && onDelete && (
              <button
                onClick={() => onDelete(request)}
                title={language === "ar" ? "حذف الطلب" : "Delete Request"}
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Action Ribbon */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">
              {language === "ar" ? "تغيير الحالة السريع:" : "Quick Status:"}
            </span>
            <button
              onClick={() => {
                setSelectedNewStatus("IN_PROGRESS");
                setIsChangingStatus(true);
              }}
              disabled={request.status === "IN_PROGRESS"}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                request.status === "IN_PROGRESS"
                  ? "bg-sky-100 text-sky-800 border border-sky-300"
                  : "bg-white hover:bg-sky-50 text-slate-700 border border-slate-200"
              }`}
            >
              {language === "ar" ? "بدء التنفيذ" : "Start Progress"}
            </button>
            <button
              onClick={() => {
                setSelectedNewStatus("COMPLETED");
                setIsChangingStatus(true);
              }}
              disabled={request.status === "COMPLETED"}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                request.status === "COMPLETED"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200"
              }`}
            >
              {language === "ar" ? "إنجاز الطلب" : "Mark Completed"}
            </button>
            <button
              onClick={() => {
                setSelectedNewStatus("REJECTED");
                setIsChangingStatus(true);
              }}
              disabled={request.status === "REJECTED" || request.status === "CANCELLED"}
              className="px-3 py-1.5 rounded-lg font-bold bg-white hover:bg-rose-50 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              {language === "ar" ? "رفض / إلغاء" : "Reject / Cancel"}
            </button>
            <button
              onClick={() => {
                setSelectedNewStatus("RETURNED");
                setIsChangingStatus(true);
              }}
              disabled={request.status === "RETURNED"}
              className="px-3 py-1.5 rounded-lg font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer"
            >
              {t("maintReturnToTenant")}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAssigningTech(true)}
              className="px-3.5 py-1.5 rounded-lg font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {request.assignedTechnicianName
                  ? language === "ar"
                    ? "تغيير الفني المكلف"
                    : "Change Tech"
                  : t("maintAssignTechnician")}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-5 pt-2 bg-white gap-2 overflow-x-auto shrink-0">
          {[
            { id: "OVERVIEW", label: language === "ar" ? "نظرة عامة والبيانات" : "Overview" },
            {
              id: "INVOICES",
              label: `${t("maintInvoices")} (${request.invoices?.length || 0})`,
            },
            {
              id: "PAYMENTS",
              label: `${language === "ar" ? "التحصيلات والدفعات" : "Payments"} (${request.payments?.length || 0})`,
            },
            {
              id: "ATTACHMENTS",
              label: `${t("maintAttachmentsTitle")} (${request.attachments?.length || 0})`,
            },
            {
              id: "TIMELINE",
              label: `${t("maintTimelineTitle")} (${request.timeline?.length || 0})`,
            },
            { id: "FINANCIALS", label: t("maintCostBreakdown") },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "border-amber-500 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/50">
          {/* Printable Header with Office Logo and Name */}
          <OfficePrintHeader
            titleAr={`أمر عمل صيانة (${request.requestNumber})`}
            titleEn={`MAINTENANCE WORK ORDER (${request.requestNumber})`}
            subtitleAr={`العقار: ${property?.nameAr || property?.nameEn || "—"} | الوحدة: ${unit?.unitNumber || "—"}`}
            subtitleEn={`Property: ${property?.nameEn || property?.nameAr || "—"} | Unit: ${unit?.unitNumber || "—"}`}
            hideOnScreen={true}
            extraInfo={[
              { labelAr: "الحالة", labelEn: "Status", value: request.status },
              { labelAr: "الأولوية", labelEn: "Priority", value: request.priority },
              { labelAr: "تاريخ الطلب", labelEn: "Date", value: request.requestDate },
              { labelAr: "إجمالي التكلفة", labelEn: "Total Cost", value: `AED ${request.totalCost.toLocaleString()}` },
            ]}
          />

          {/* TAB 1: OVERVIEW */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-6">
              {/* Linked Entities Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Property Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase mb-1">
                    <Building className="w-4 h-4 text-amber-500" />
                    <span>{t("maintProperty")}</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {property?.nameAr || property?.nameEn || request.propertyId}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {property?.type ? t(`propType_${property.type}` as any) : "—"}
                  </p>
                </div>

                {/* Unit Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase mb-1">
                    <Home className="w-4 h-4 text-sky-500" />
                    <span>{language === "ar" ? "الوحدة السكنية" : "Unit"}</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {unit ? `${unit.unitNumber} (${unit.floor ? `الطابق ${unit.floor}` : ""})` : request.unitId}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {unit?.type || "—"}
                  </p>
                </div>

                {/* Tenant Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase mb-1">
                    <User className="w-4 h-4 text-emerald-500" />
                    <span>{t("maintTenant")}</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {tenant?.nameAr || tenant?.nameEn || request.requestedBy || "—"}
                  </p>
                  {tenant?.phone && (
                    <a
                      href={`tel:${tenant.phone}`}
                      className="text-[11px] text-amber-800 font-bold hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{tenant.phone}</span>
                    </a>
                  )}
                </div>

                {/* Owner Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase mb-1">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    <span>{t("maintOwner")}</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {owner?.nameAr || owner?.nameEn || "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {owner?.phone || "—"}
                  </p>
                </div>
              </div>

              {/* Issue Description Box */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>{t("maintIssueDescription")}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {request.requestDate} {request.requestTime || ""}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                  {request.issueDescription}
                </div>
                {request.rejectionReason && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    <span className="font-bold">{t("maintRejectionReason")}: </span>
                    <span>{request.rejectionReason}</span>
                  </div>
                )}
                {request.returnReason && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <span className="font-bold">{t("maintReturnReason")}: </span>
                    <span>{request.returnReason}</span>
                  </div>
                )}
              </div>

              {/* Assigned Technician Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-sky-500" />
                    <span>{t("maintAssignedTechnician")}</span>
                  </h3>
                  <button
                    onClick={() => setIsAssigningTech(true)}
                    className="text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer"
                  >
                    {request.assignedTechnicianName ? t("edit") : t("maintAssignTechnician")}
                  </button>
                </div>

                {request.assignedTechnicianName ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-sky-50/50 border border-sky-100">
                    <div>
                      <p className="text-[11px] text-slate-500 font-semibold">{t("maintTechName")}</p>
                      <p className="text-xs font-black text-slate-900 mt-0.5">
                        {request.assignedTechnicianName}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 font-semibold">{t("maintTechCompany")}</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">
                        {request.assignedTechnicianCompany || "شركة صيانة معتمدة"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 font-semibold">{t("maintTechPhone")}</p>
                      {request.assignedTechnicianPhone ? (
                        <a
                          href={`tel:${request.assignedTechnicianPhone}`}
                          className="text-xs font-bold text-sky-800 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{request.assignedTechnicianPhone}</span>
                        </a>
                      ) : (
                        <p className="text-xs text-slate-400">—</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    {language === "ar"
                      ? "لم يتم تكليف فني أو مقاول صيانة بعد."
                      : "No technician assigned yet."}
                  </div>
                )}
              </div>

              {/* Summary Financial Bar */}
              <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400 font-semibold">
                    {t("maintTotalCost")} ({t("maintCostBearer")}: {t(`maintBearer${request.costBearer}` as any)})
                  </p>
                  <p className="text-xl font-black text-amber-400 mt-1">
                    {formatAED(request.totalCost || 0)}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-slate-400 block">{t("maintLaborCost")}</span>
                    <span className="font-bold text-white">{formatAED(request.laborCost || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t("maintPartsCost")}</span>
                    <span className="font-bold text-white">{formatAED(request.partsCost || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t("maintPaidCost")}</span>
                    <span className="font-bold text-emerald-400">{formatAED(request.paidAmount || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{language === "ar" ? "المتبقي" : "Remaining"}</span>
                    <span className="font-bold text-rose-400">{formatAED(request.remainingAmount || 0)}</span>
                  </div>
                </div>
                <button
                  onClick={handleOpenFinancialEdit}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  {language === "ar" ? "تعديل التكاليف" : "Edit Costs"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: INVOICES */}
          {activeTab === "INVOICES" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span>{t("maintInvoicesTitle")}</span>
                </h3>
                <button
                  onClick={handleOpenAddInvoice}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("maintAddInvoice")}</span>
                </button>
              </div>

              {request.invoices && request.invoices.length > 0 ? (
                <div className="space-y-3">
                  {request.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {inv.invoiceNumber}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              inv.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {inv.status === "PAID" ? t("cheque_CLEARED") : t("cheque_PENDING")}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {inv.invoiceDate}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-700">
                          {inv.vendorName}
                        </p>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-end">
                          <p className="text-[11px] text-slate-400 font-semibold">
                            {language === "ar" ? "قبل الضريبة" : "Pre-tax"}
                          </p>
                          <p className="text-xs font-bold text-slate-700">
                            {formatAED(inv.amount)}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-[11px] text-slate-400 font-semibold">
                            {language === "ar" ? "الضريبة 5%" : "VAT 5%"}
                          </p>
                          <p className="text-xs font-bold text-slate-700">
                            {formatAED(inv.vatAmount)}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-[11px] text-slate-400 font-semibold">
                            {t("total")}
                          </p>
                          <p className="text-xs font-black text-slate-950">
                            {formatAED(inv.totalAmount)}
                          </p>
                        </div>

                        {inv.attachmentUrl && (
                          <button
                            onClick={() => setPreviewImage(inv.attachmentUrl!)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                            title={language === "ar" ? "عرض الفاتورة" : "View Invoice"}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => deleteMaintenanceInvoice(request.id, inv.id)}
                          className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer"
                          title={language === "ar" ? "حذف الفاتورة" : "Delete Invoice"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                  {language === "ar"
                    ? "لا توجد فواتير صيانة مضافة لهذا الطلب بعد."
                    : "No maintenance invoices recorded yet."}
                </div>
              )}
            </div>
          )}

          {/* TAB: PAYMENTS */}
          {activeTab === "PAYMENTS" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  <span>{language === "ar" ? "سجل التحصيلات والدفعات" : "Payments History"}</span>
                </h3>
              </div>

              {request.payments && request.payments.length > 0 ? (
                <div className="space-y-3">
                  {request.payments.map((pmt) => (
                    <div key={pmt.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900">
                          {formatAED(pmt.amount)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {pmt.paymentDate}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>{t(`payment_${pmt.paymentMethod}` as any)}</span>
                        <span>{pmt.receivedByUserName || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">
                    {language === "ar" ? "لا توجد دفعات أو تحصيلات مسجلة" : "No payments recorded yet"}
                  </p>
                </div>
              )}

              {/* Add Payment Form */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 mb-4">
                  {language === "ar" ? "تسجيل دفعة جديدة" : "Record New Payment"}
                </h4>
                <form onSubmit={handleAddPaymentSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {language === "ar" ? "المبلغ (AED)" : "Amount (AED)"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {language === "ar" ? "التاريخ" : "Date"}
                      </label>
                      <input
                        type="date"
                        value={paymentDateInput}
                        onChange={(e) => setPaymentDateInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {language === "ar" ? "طريقة الدفع" : "Payment Method"}
                      </label>
                      <SearchableSelect
                        options={[
                          { id: "CASH", label: t("payment_CASH") },
                          { id: "BANK_TRANSFER", label: t("payment_BANK_TRANSFER") },
                          { id: "CREDIT_CARD", label: t("payment_CREDIT_CARD") },
                        ]}
                        value={paymentMethodInput}
                        onChange={(val) => setPaymentMethodInput(val as PaymentMethod)}
                        placeholder="طريقة الدفع"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    {language === "ar" ? "حفظ الدفعة" : "Save Payment"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: ATTACHMENTS & PHOTOS */}
          {activeTab === "ATTACHMENTS" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-500" />
                  <span>{t("maintAttachmentsTitle")}</span>
                </h3>
                <button
                  onClick={() => setIsAddingAttachment(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("maintAddAttachment")}</span>
                </button>
              </div>

              {request.attachments && request.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {request.attachments.map((att, idx) => (
                    <div
                      key={`${att.id}-${idx}`}
                      className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col group"
                    >
                      {/* Image Thumbnail */}
                      <div
                        onClick={() => att.fileUrl && setPreviewImage(att.fileUrl)}
                        className="h-40 bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer relative"
                      >
                        {att.fileUrl ? (
                          <img
                            src={att.fileUrl}
                            alt={att.fileName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <FileText className="w-12 h-12 text-slate-400" />
                        )}
                        <div className="absolute top-2 start-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-950/70 text-white backdrop-blur-xs">
                            {t(`maintAttCat_${att.category}` as any)}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {att.fileName}
                          </p>
                          {att.notes && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                              {att.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                          <span>{att.uploadedAt?.split("T")[0]}</span>
                          <button
                            onClick={() => deleteMaintenanceAttachment(request.id, att.id)}
                            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                            title={language === "ar" ? "حذف المرفق" : "Delete attachment"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                  {language === "ar"
                    ? "لا توجد صور أو مرفقات مرفوعة لهذا الطلب."
                    : "No photos or attachments uploaded yet."}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TIMELINE & AUDIT LOG */}
          {activeTab === "TIMELINE" && (
            <div className="space-y-6">
              {/* Add Note Input */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <label className="block text-xs font-bold text-slate-900">
                  {t("maintAddNoteBtn")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                    placeholder={t("maintNewNotePlaceholder")}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{language === "ar" ? "إضافة" : "Add"}</span>
                  </button>
                </div>
              </div>

              {/* Timeline Log */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>{t("maintTimelineTitle")}</span>
                </h3>

                {request.timeline && request.timeline.length > 0 ? (
                  <div className="relative border-s-2 border-slate-200 ms-3 space-y-6 py-2">
                    {request.timeline.map((event, index) => (
                      <div key={event.id || index} className="relative ms-6">
                        {/* Bullet */}
                        <div className="absolute -start-[31px] top-0.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-xs" />
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span className="font-bold text-slate-900">
                            {language === "ar" ? event.titleAr || (event as any).action : event.titleEn || (event as any).action}
                          </span>
                          <span className="font-mono">{event.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          {event.details || (event as any).description}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {language === "ar" ? "بواسطة: " : "By: "}
                          <span className="font-semibold text-slate-600">
                            {event.userName || (event as any).performedByName || "النظام"}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 text-center py-4">
                    {language === "ar"
                      ? "لا توجد أحداث مسجلة في السجل الزمني."
                      : "No timeline events recorded."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: FINANCIALS */}
          {activeTab === "FINANCIALS" && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    <span>{t("maintCostBreakdown")}</span>
                  </h3>
                  <button
                    onClick={handleOpenFinancialEdit}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all cursor-pointer"
                  >
                    {language === "ar" ? "تعديل تفاصيل التكلفة" : "Edit Details"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t("maintLaborCost")}
                    </span>
                    <span className="text-base font-black text-slate-900 mt-1 block">
                      {formatAED(request.laborCost || 0)}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t("maintPartsCost")}
                    </span>
                    <span className="text-base font-black text-slate-900 mt-1 block">
                      {formatAED(request.partsCost || 0)}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t("maintOtherCost")}
                    </span>
                    <span className="text-base font-black text-slate-900 mt-1 block">
                      {formatAED(request.otherCost || 0)}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[11px] text-amber-900 font-semibold block">
                      {t("total")}
                    </span>
                    <span className="text-base font-black text-amber-950 mt-1 block">
                      {formatAED(request.totalCost || 0)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block">
                      {t("maintCostBearer")}
                    </span>
                    <span className="font-black text-slate-900 mt-0.5 block">
                      {t(`maintBearer${request.costBearer}` as any)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block">
                      {t("maintPaymentMethod")}
                    </span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {request.paymentMethod ? t(`payment_${request.paymentMethod}` as any) : "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block">
                      {t("maintPaymentDate")}
                    </span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {request.paymentDate || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ERP Financial Posting & Expense Records Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-black text-slate-900">
                      {language === "ar" ? "حالة الترحيل المحاسبي القيادي (ERP Ledger Posting)" : "ERP Financial Ledger Posting"}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {request.financialStatus === "POSTED" && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{language === "ar" ? "مرحل محاسبياً" : "Posted to Ledger"}</span>
                      </span>
                    )}
                    {request.financialStatus === "PARTIALLY_POSTED" && (
                      <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[11px] font-black flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{language === "ar" ? "مرحل جزئياً (حسب توزيع التكلفة)" : "Partially Posted"}</span>
                      </span>
                    )}
                    {(!request.financialStatus || request.financialStatus === "NOT_POSTED") && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{language === "ar" ? "غير مرحل" : "Not Posted"}</span>
                      </span>
                    )}
                    {request.financialStatus === "REQUIRES_INVOICE" && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{language === "ar" ? "يتطلب فاتورة/تكلفة" : "Requires Invoice/Cost"}</span>
                      </span>
                    )}

                    <button
                      onClick={handleManualPostExpense}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{language === "ar" ? "ترحيل / إعادة ترحيل القيد المالي" : "Post / Repost Expense"}</span>
                    </button>
                  </div>
                </div>

                {postingMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold ${
                      postingMsg.isError ? "bg-rose-50 text-rose-800 border border-rose-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {postingMsg.text}
                  </div>
                )}

                {/* Linked Expense Records Table */}
                {(() => {
                  const linkedExps = propertyExpenses.filter(
                    (e) => e.sourceType === "MAINTENANCE_REQUEST" && e.sourceId === request.id && e.status !== "CANCELLED"
                  );

                  if (linkedExps.length === 0) {
                    return (
                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                        {language === "ar"
                          ? "لم يتم توليد أي قيود مصروفات في الدفتر المالي لهذه الصيانة بعد. اضغط زر 'ترحيل القيد المالي' لإنشائها فوراً."
                          : "No expense records generated for this maintenance request yet."}
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs text-start">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">{language === "ar" ? "رقم المصروف" : "Expense #"}</th>
                            <th className="p-2.5">{language === "ar" ? "ملتزم التكلفة" : "Cost Bearer"}</th>
                            <th className="p-2.5">{language === "ar" ? "المبلغ الأساسي" : "Amount"}</th>
                            <th className="p-2.5">{language === "ar" ? "الضريبة (VAT)" : "VAT"}</th>
                            <th className="p-2.5">{language === "ar" ? "الإجمالي" : "Total"}</th>
                            <th className="p-2.5">{language === "ar" ? "الحالة" : "Status"}</th>
                            <th className="p-2.5">{language === "ar" ? "تاريخ القيد" : "Date"}</th>
                            <th className="p-2.5">{language === "ar" ? "إجراءات" : "Actions"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                          {linkedExps.map((exp) => {
                            const isReversed = exp.status === "REVERSED" || exp.status === "CANCELLED";
                            return (
                              <tr
                                key={exp.id}
                                className={`transition ${
                                  isReversed
                                    ? "bg-rose-50/25 text-slate-400"
                                    : "hover:bg-slate-50"
                                }`}
                              >
                                <td className={`p-2.5 font-mono font-bold ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[1.5px]" : ""}`}>
                                  {exp.expenseNumber}
                                </td>
                                <td className={`p-2.5 font-bold ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[1.5px]" : "text-amber-800"}`}>
                                  {exp.costBearer}
                                </td>
                                <td className={`p-2.5 ${isReversed ? "line-through decoration-rose-600 decoration-[1.5px]" : ""}`}>
                                  {formatAED(exp.amount)}
                                </td>
                                <td className={`p-2.5 ${isReversed ? "line-through decoration-rose-600 decoration-[1.5px]" : ""}`}>
                                  {formatAED(exp.vatAmount || 0)}
                                </td>
                                <td className={`p-2.5 font-black ${isReversed ? "text-slate-400 line-through decoration-rose-600 decoration-[1.5px]" : "text-slate-900"}`}>
                                  {formatAED(exp.totalAmount)}
                                </td>
                                <td className="p-2.5">
                                  {isReversed ? (
                                    <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
                                      <span className="w-1 h-1 rounded-full bg-rose-600"></span>
                                      {language === "ar" ? "محذوف" : "Deleted"}
                                    </span>
                                  ) : (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      exp.status === "PAID" || exp.status === "PENDING_PAYMENT" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                    }`}>
                                      {exp.status}
                                    </span>
                                  )}
                                </td>
                                <td className={`p-2.5 text-slate-500 font-mono text-[11px] ${isReversed ? "line-through decoration-rose-600 decoration-[1.5px]" : ""}`}>
                                  {exp.expenseDate}
                                </td>
                                <td className="p-2.5 text-center">
                                  {!isReversed && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(language === "ar" ? "هل أنت متأكد من حذف هذا المصروف نهائياً؟" : "Are you sure you want to permanently delete this expense?")) {
                                          deletePropertyExpense(exp.id);
                                        }
                                      }}
                                      className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                      title={language === "ar" ? "حذف المصروف" : "Delete Expense"}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            {t("close")}
          </button>
        </div>
      </div>

      {/* SUB-MODAL 1: STATUS CHANGE */}
      {isChangingStatus && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-500" />
              <span>
                {language === "ar" ? "تحديث حالة طلب الصيانة" : "Update Request Status"}
              </span>
            </h3>

            <form onSubmit={handleStatusChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t("maintStatus")}
                </label>
                <SearchableSelect
                  options={[
                    { id: "OPEN", label: t("maintStatus_OPEN") },
                    { id: "IN_PROGRESS", label: t("maintStatus_IN_PROGRESS") },
                    { id: "COMPLETED", label: t("maintStatus_COMPLETED") },
                    { id: "REJECTED", label: t("maintStatus_REJECTED") },
                    { id: "CANCELLED", label: t("maintStatus_CANCELLED") },
                    { id: "RETURNED", label: t("maintStatus_RETURNED") },
                  ]}
                  value={selectedNewStatus}
                  onChange={(val) => setSelectedNewStatus(val as MaintenanceStatus)}
                  placeholder={t("maintStatus")}
                  searchPlaceholder={language === "ar" ? "ابحث عن حالة..." : "Search status..."}
                />
              </div>

              {selectedNewStatus === "COMPLETED" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t("maintCompletionDate")}
                  </label>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                    required
                  />
                </div>
              )}

              {selectedNewStatus === "RETURNED" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t("maintReturnReason")}
                  </label>
                  <textarea
                    rows={2}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder={t("maintReturnReasonPlaceholder")}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                    required
                  />
                </div>
              )}

              {(selectedNewStatus === "REJECTED" || selectedNewStatus === "CANCELLED") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t("maintRejectionReason")}
                  </label>
                  <textarea
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={language === "ar" ? "سبب الرفض أو الإلغاء..." : "Reason..."}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "ملاحظة للسجل (اختياري)" : "Log Note"}
                </label>
                <input
                  type="text"
                  value={statusChangeNote}
                  onChange={(e) => setStatusChangeNote(e.target.value)}
                  placeholder={language === "ar" ? "أدخل تفاصيل التحديث..." : "Details..."}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangingStatus(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs cursor-pointer"
                >
                  {t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: ASSIGN TECHNICIAN */}
      {isAssigningTech && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-sky-500" />
              <span>{t("maintAssignTechnician")}</span>
            </h3>

            <form onSubmit={handleAssignTechSubmit} className="space-y-4">
              <div>
                <SearchableSelect
                  label={language === "ar" ? "اختر الفني / الشركة" : "Select Technician"}
                  required
                  options={technicians.map((tc) => ({
                    id: tc.id,
                    label: tc.name,
                    subLabel: `${tc.company || (language === "ar" ? "مستقل" : "Freelancer")} • ${tc.phone || ""}`,
                    badge: tc.serviceType || (language === "ar" ? "عام" : "General"),
                  }))}
                  value={selectedTechId}
                  onChange={(val) => setSelectedTechId(val)}
                  placeholder={t("maintSelectTechnicianPlaceholder")}
                  searchPlaceholder={language === "ar" ? "ابحث باسم الفني، الشركة أو التخصص..." : "Search technician..."}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "توجيهات أو ملاحظات للفني" : "Instructions / Notes"}
                </label>
                <textarea
                  rows={2}
                  value={techAssignmentNote}
                  onChange={(e) => setTechAssignmentNote(e.target.value)}
                  placeholder={language === "ar" ? "أي تعليمات بخصوص الزيارة..." : "Instructions..."}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssigningTech(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={!selectedTechId}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white shadow-xs cursor-pointer"
                >
                  {language === "ar" ? "تأكيد التكليف" : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: ADD INVOICE */}
      {isAddingInvoice && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              <span>{t("maintAddInvoice")}</span>
            </h3>

            <form onSubmit={handleAddInvoiceSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {t("maintInvoiceNumber")} *
                    </label>
                    <button
                      type="button"
                      onClick={() => setInvoiceNumber(getNextMaintenanceInvoiceNumber())}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                    >
                      {language === "ar" ? "توليد تلقائي" : "Auto Generate"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder={`INV-${new Date().getFullYear()}-XXXX`}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t("maintInvoiceDate")}
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t("maintVendorName")}
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder={request.assignedTechnicianName || (language === "ar" ? "اسم الشركة المنفذة أو الفني" : "Vendor / Technician Name")}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t("maintAmountBeforeVat")} (AED) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amountBeforeVat || ""}
                    onChange={(e) => setAmountBeforeVat(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t("maintVatAmount")} (5%)
                  </label>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                    {formatAED(amountBeforeVat * 0.05)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t("total")}
                  </label>
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-black text-emerald-950">
                    {formatAED(amountBeforeVat * 1.05)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span>{language === "ar" ? "تم سداد الفاتورة" : "Invoice is Paid"}</span>
                </label>

                {isPaid && (
                  <div className="w-48 shrink-0">
                    <SearchableSelect
                      options={[
                        { id: "CASH", label: t("payment_CASH") },
                        { id: "BANK_TRANSFER", label: t("payment_BANK_TRANSFER") },
                        { id: "CREDIT_CARD", label: t("payment_CREDIT_CARD") },
                      ]}
                      value={invoicePaymentMethod}
                      onChange={(val) => setInvoicePaymentMethod(val as PaymentMethod)}
                      placeholder={language === "ar" ? "طريقة الدفع..." : "Payment method..."}
                      searchPlaceholder={language === "ar" ? "ابحث عن وسيلة..." : "Search method..."}
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <DocumentUpload
                  label={t("maintInvoiceAttachment")}
                  defaultProfile="MAINTENANCE_INVOICE"
                  onOptimized={(result) => {
                    setInvoiceFileBase64(result?.dataUrl || "");
                    setInvoiceFileName(result?.optimizedFileName || result?.originalFileName || "");
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingInvoice(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={amountBeforeVat <= 0}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md hover:shadow-lg cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{t("save")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 4: ADD ATTACHMENT */}
      {isAddingAttachment && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-sky-500" />
              <span>{t("maintAddAttachment")}</span>
            </h3>

            <form onSubmit={handleAddAttachmentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t("maintAttachmentCategory")}
                </label>
                <SearchableSelect
                  options={[
                    { id: "BEFORE_REPAIR", label: t("maintAttCat_BEFORE_REPAIR") },
                    { id: "AFTER_REPAIR", label: t("maintAttCat_AFTER_REPAIR") },
                    { id: "ISSUE_PHOTO", label: t("maintAttCat_ISSUE_PHOTO") },
                    { id: "MAINTENANCE_INVOICE", label: t("maintAttCat_INVOICE") },
                    { id: "QUOTATION", label: t("maintAttCat_QUOTATION") },
                    { id: "TECH_REPORT", label: t("maintAttCat_TECH_REPORT") },
                    { id: "OTHER", label: t("maintAttCat_OTHER") },
                  ]}
                  value={attachmentCategory}
                  onChange={(val) => setAttachmentCategory(val as any)}
                  placeholder={t("maintAttachmentCategory")}
                  searchPlaceholder={language === "ar" ? "ابحث عن تصنيف..." : "Search category..."}
                />
              </div>

              <div className="pt-2">
                <DocumentUpload
                  label={language === "ar" ? "اختيار الصورة / المستند" : "Select Image/File"}
                  defaultProfile={attachmentCategory === "INVOICE" ? "MAINTENANCE_INVOICE" : "PHOTO"}
                  onOptimized={(result) => {
                    setAttachmentFileBase64(result?.dataUrl || "");
                    setAttachmentFileName(result?.optimizedFileName || result?.originalFileName || "");
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "ملاحظات وتوضيح" : "Notes"}
                </label>
                <input
                  type="text"
                  value={attachmentNotes}
                  onChange={(e) => setAttachmentNotes(e.target.value)}
                  placeholder={language === "ar" ? "وصف للصورة أو التقرير..." : "Description..."}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingAttachment(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={!attachmentFileBase64 || isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white shadow-xs cursor-pointer"
                >
                  {isUploading ? t("loading") : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 5: EDIT FINANCIALS */}
      {isEditingFinancials && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <span>{t("maintCostBreakdown")}</span>
            </h3>

            <form onSubmit={handleSaveFinancials} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t("maintCostBearer")}
                </label>
                <SearchableSelect
                  options={[
                    { id: "OWNER", label: t("maintBearerOwner") },
                    { id: "TENANT", label: t("maintBearerTenant") },
                    { id: "MANAGEMENT", label: t("maintBearerManagement") },
                    { id: "PER_CONTRACT", label: t("maintBearerPerContract") },
                    { id: "OTHER", label: t("maintBearerOther") },
                  ]}
                  value={costBearer}
                  onChange={(val) => setCostBearer(val as CostBearer)}
                  placeholder={t("maintCostBearer")}
                  searchPlaceholder={language === "ar" ? "ابحث عن الطرف المتحمل..." : "Search bearer..."}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t("maintLaborCost")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={laborCost}
                    onChange={(e) => setLaborCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t("maintPartsCost")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={partsCost}
                    onChange={(e) => setPartsCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t("maintOtherCost")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={otherCost}
                    onChange={(e) => setOtherCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-black text-amber-950 flex items-center justify-between">
                <span>{t("total")}:</span>
                <span>{formatAED(laborCost + partsCost + otherCost)}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingFinancials(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs cursor-pointer"
                >
                  {t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {previewImage && (
        <div
          className="fixed inset-0 z-70 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 end-0 text-white p-2 hover:bg-white/20 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
