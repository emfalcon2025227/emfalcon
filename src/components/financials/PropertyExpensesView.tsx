import React, { useState, useMemo, useEffect } from "react";
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Building2,
  Coins,
  Wrench,
  FileSpreadsheet,
  Tag,
  DollarSign,
  Layers,
  ArrowDownLeft,
  Briefcase,
  AlertCircle,
  FileText,
  User,
  Scale,
  Calendar,
  Layers3,
  Paperclip,
  Printer,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigation } from "../../context/NavigationContext";
import { PropertyExpenseRecord, PropertyExpenseCategory, CostBearerType, PaymentMethod } from "../../types";
import { SearchableSelect } from "../common/SearchableSelect";
import { UnifiedDocumentPreviewModal } from "../printing/UnifiedDocumentPreviewModal";
import { buildUnifiedFinancialDocuments } from "../../utils/financialDocumentMapper";
import { UnifiedFinancialDocument } from "../../types/unifiedPrinting";

interface PropertyExpensesViewProps {
  initialCategory?: PropertyExpenseCategory | "ALL";
}

export const PropertyExpensesView: React.FC<PropertyExpensesViewProps> = ({ initialCategory = "ALL" }) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { navigateTo } = useNavigation();
  const {
    properties = [],
    units = [],
    owners = [],
    tenants = [],
    leases = [],
    cases: rentalCases = [],
    maintenanceRequests = [],
    propertyExpenses = [],
    addPropertyExpense,
    updatePropertyExpense,
    reversePropertyExpense,
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [bearerFilter, setBearerFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalPropertyId, setModalPropertyId] = useState("");
  const [modalUnitId, setModalUnitId] = useState("");
  const [modalOwnerId, setModalOwnerId] = useState("");
  const [modalTenantId, setModalTenantId] = useState("");
  const [modalLeaseId, setModalLeaseId] = useState("");
  const [modalLegalCaseId, setModalLegalCaseId] = useState("");
  const [modalMaintenanceRequestId, setModalMaintenanceRequestId] = useState("");
  const [modalCategory, setModalCategory] = useState<PropertyExpenseCategory>("MAINTENANCE");
  const [modalCostBearer, setModalCostBearer] = useState<CostBearerType>("OWNER");
  const [modalDescription, setModalDescription] = useState("");
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalVatPercentage, setModalVatPercentage] = useState<number>(5);
  const [modalExpenseDate, setModalExpenseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [modalVendorName, setModalVendorName] = useState("");
  const [modalVendorInvoiceNumber, setModalVendorInvoiceNumber] = useState("");
  const [modalPaymentMethod, setModalPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [modalNotes, setModalNotes] = useState("");
  const [modalSupportingDoc, setModalSupportingDoc] = useState("");
  const [modalPaymentStatus, setModalPaymentStatus] = useState<"PAID" | "PENDING_PAYMENT">("PAID");
  const [modalPostingStatus, setModalPostingStatus] = useState<"POSTED" | "NOT_POSTED">("POSTED");
  const [modalLevel, setModalLevel] = useState<"PROPERTY_LEVEL" | "UNIT_LEVEL" | "LEASE_LEVEL" | "TENANT_LEVEL" | "OWNER_LEVEL" | "OFFICE_LEVEL">("PROPERTY_LEVEL");
  const [modalRelatesToTenant, setModalRelatesToTenant] = useState(false);
  const [modalError, setModalError] = useState("");

  // Print Voucher Modal State
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<UnifiedFinancialDocument | null>(null);

  const handlePrintExpenseVoucher = (exp: PropertyExpenseRecord) => {
    const docList = buildUnifiedFinancialDocuments({
      propertyExpenses: [exp],
      owners,
      tenants,
      properties,
      units,
      leases,
    });
    if (docList.length > 0) {
      setSelectedDocForPrint(docList[0]);
    }
  };

  // Listen for pre-fill data from Legal Cases or other screens
  useEffect(() => {
    const prefillStr = sessionStorage.getItem("expensePreFill");
    if (prefillStr) {
      try {
        const data = JSON.parse(prefillStr);
        if (data.ownerId) setModalOwnerId(data.ownerId);
        if (data.propertyId) setModalPropertyId(data.propertyId);
        if (data.unitId) setModalUnitId(data.unitId);
        if (data.tenantId) {
          setModalTenantId(data.tenantId);
          setModalRelatesToTenant(true);
        }
        if (data.leaseId) setModalLeaseId(data.leaseId);
        if (data.legalCaseId) setModalLegalCaseId(data.legalCaseId);
        if (data.category) setModalCategory(data.category);
        if (data.description) setModalDescription(data.description);
        if (data.costBearer) setModalCostBearer(data.costBearer);
        setIsAddModalOpen(true);
      } catch (err) {
        console.error("Failed to parse expensePreFill", err);
      }
      sessionStorage.removeItem("expensePreFill");
    }
  }, []);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState("");

  // Reversal Modal State
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [reversalExpenseId, setReversalExpenseId] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [reversalError, setReversalError] = useState("");

  // Owners list for select
  const ownerOptions = useMemo(() => {
    return owners.map((o) => ({
      id: o.id,
      title: isAr ? o.nameAr : o.nameEn,
      subLabel: `${isAr ? "رقم الهاتف:" : "Phone:"} ${o.phone || "—"}`,
      badge: isAr ? "مالك" : "OWNER",
    }));
  }, [owners, isAr]);

  // Property Options based on chosen owner (Cascade)
  const filteredPropertyOptions = useMemo(() => {
    let list = properties;
    if (modalOwnerId) {
      list = list.filter((p) => p.ownerId === modalOwnerId);
    }
    return list.map((p) => {
      const owner = owners.find((o) => o.id === p.ownerId);
      const propName = isAr ? p.nameAr : p.nameEn;
      return {
        id: p.id,
        title: propName,
        label: propName,
        subLabel: `${isAr ? "المالك:" : "Owner:"} ${owner ? (isAr ? owner.nameAr : owner.nameEn) : "—"}`,
        badge: p.code || "PROP",
        extraSearchTerms: [p.code || "", owner?.nameAr || "", owner?.nameEn || ""],
      };
    });
  }, [properties, owners, modalOwnerId, isAr]);

  // Units Options based on chosen Property (Cascade)
  const filteredUnitOptions = useMemo(() => {
    let list = units;
    if (modalPropertyId) {
      list = list.filter((u) => u.propertyId === modalPropertyId);
    }
    return list.map((u) => ({
      id: u.id,
      title: `${isAr ? "وحدة" : "Unit"} ${u.unitNumber}`,
      subLabel: `${isAr ? "الطابق:" : "Floor:"} ${u.floor} | ${isAr ? "النوع:" : "Type:"} ${u.type}`,
      badge: u.unitNumber,
    }));
  }, [units, modalPropertyId, isAr]);

  // Leases Options based on chosen Unit (Cascade)
  const filteredLeaseOptions = useMemo(() => {
    let list = leases;
    if (modalUnitId) {
      list = list.filter((l) => l.unitId === modalUnitId);
    } else if (modalPropertyId) {
      list = list.filter((l) => l.propertyId === modalPropertyId);
    }
    return list.map((l) => {
      const t = tenants.find((tenant) => tenant.id === l.tenantId);
      return {
        id: l.id,
        title: `${l.leaseNumber} (${Number(l.annualRent || 0).toLocaleString()} AED)`,
        subLabel: `${isAr ? "المستأجر:" : "Tenant:"} ${t ? (isAr ? t.nameAr : t.nameEn) : "—"}`,
        badge: l.contractStatus,
      };
    });
  }, [leases, tenants, modalUnitId, modalPropertyId, isAr]);

  // Cases Options based on chosen Tenant / Unit / Property / Owner (Cascade)
  const filteredCaseOptions = useMemo(() => {
    let list = rentalCases || [];
    if (modalTenantId) {
      list = list.filter((c) => c.tenantId === modalTenantId);
    } else if (modalUnitId) {
      list = list.filter((c) => c.unitId === modalUnitId);
    } else if (modalPropertyId) {
      list = list.filter((c) => c.propertyId === modalPropertyId);
    } else if (modalOwnerId) {
      list = list.filter((c) => c.ownerId === modalOwnerId);
    }

    return [
      { id: "", title: isAr ? "— بدون ربط بقضية معينة —" : "— Not linked to specific case —" },
      ...list.map((c) => {
        const cTenant = tenants.find(t => t.id === c.tenantId);
        const cProp = properties.find(p => p.id === c.propertyId);
        const cUnit = units.find(u => u.id === c.unitId);
        const tenantName = cTenant ? (isAr ? cTenant.nameAr || cTenant.nameEn : cTenant.nameEn) : "";
        const propTitle = cProp ? (isAr ? cProp.nameAr : cProp.nameEn) : "—";
        return {
          id: c.id,
          title: `${c.caseNumber} - ${tenantName || (isAr ? "قضية إيجارية" : "Rental Case")}`,
          subLabel: `${isAr ? "العقار:" : "Property:"} ${propTitle} | ${isAr ? "الوحدة:" : "Unit:"} ${cUnit?.unitNumber || "—"} | ${isAr ? "المطالبة:" : "Claim:"} ${c.claimAmount?.toLocaleString()} AED`,
          badge: c.caseNumber,
          extraSearchTerms: [c.caseNumber, c.courtName, tenantName, propTitle, cUnit?.unitNumber || ""]
        };
      })
    ];
  }, [rentalCases, modalTenantId, modalUnitId, modalPropertyId, modalOwnerId, tenants, properties, units, isAr]);

  // Maintenance Requests Options based on chosen Unit / Property (Cascade)
  const filteredMaintenanceOptions = useMemo(() => {
    let list = maintenanceRequests || [];
    if (modalUnitId) {
      list = list.filter((m) => m.unitId === modalUnitId);
    } else if (modalPropertyId) {
      list = list.filter((m) => m.propertyId === modalPropertyId);
    }
    return list.map((m) => ({
      id: m.id,
      title: `${m.requestNumber} - ${m.category}`,
      subLabel: `${isAr ? "التكلفة:" : "Cost:"} ${m.totalCost.toLocaleString()} AED | ${isAr ? "الحالة:" : "Status:"} ${m.status}`,
      badge: m.requestNumber,
    }));
  }, [maintenanceRequests, modalUnitId, modalPropertyId, isAr]);

  // When owner is select
  const handleOwnerSelect = (ownerId: string) => {
    setModalOwnerId(ownerId);
    setModalPropertyId("");
    setModalUnitId("");
    setModalLeaseId("");
    setModalTenantId("");
  };

  // When property is chosen, auto-detect owner
  const handlePropertySelect = (propertyId: string) => {
    setModalPropertyId(propertyId);
    const prop = properties.find((p) => p.id === propertyId);
    if (prop) {
      setModalOwnerId(prop.ownerId);
    }
    setModalUnitId("");
    setModalLeaseId("");
    setModalTenantId("");
  };

  // When unit is chosen, find active lease
  const handleUnitSelect = (unitId: string) => {
    setModalUnitId(unitId);
    const activeLease = leases.find((l) => l.unitId === unitId && l.contractStatus === "ACTIVE");
    if (activeLease) {
      setModalLeaseId(activeLease.id);
      setModalTenantId(activeLease.tenantId || "");
      setModalRelatesToTenant(true);
      setModalLevel("UNIT_LEVEL");
    } else {
      setModalLeaseId("");
      setModalTenantId("");
      setModalRelatesToTenant(false);
      setModalLevel("UNIT_LEVEL");
    }
  };

  // Category change side-effects
  const handleCategoryChange = (cat: PropertyExpenseCategory) => {
    setModalCategory(cat);
    // Intelligent defaults
    if (cat === "LEGAL_FEES" || cat === "MUNICIPALITY_FEES") {
      setModalRelatesToTenant(true);
    } else {
      setModalRelatesToTenant(false);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    let totalAll = 0;
    let totalOwner = 0;
    let totalTenant = 0;
    let totalOffice = 0;

    propertyExpenses.forEach((e) => {
      if (e.status !== "REVERSED") {
        totalAll += e.totalAmount;
        if (e.costBearer === "OWNER") totalOwner += e.totalAmount;
        else if (e.costBearer === "TENANT") totalTenant += e.totalAmount;
        else if (e.costBearer === "OFFICE") totalOffice += e.totalAmount;
      }
    });

    return { totalAll, totalOwner, totalTenant, totalOffice };
  }, [propertyExpenses]);

  // Filtered Expenses
  const filteredExpenses = propertyExpenses.filter((e) => {
    const matchesBearer = bearerFilter === "ALL" || e.costBearer === bearerFilter;
    const matchesCategory = categoryFilter === "ALL" || e.category === categoryFilter;
    const matchesProperty = propertyFilter === "ALL" || e.propertyId === propertyFilter;
    const q = searchQuery.toLowerCase().trim();
    const prop = properties.find((p) => p.id === e.propertyId);
    const owner = owners.find((o) => o.id === e.ownerId);
    const matchesSearch =
      !q ||
      (e.expenseNumber || "").toLowerCase().includes(q) ||
      (e.description || "").toLowerCase().includes(q) ||
      (e.vendorName && e.vendorName.toLowerCase().includes(q)) ||
      (e.vendorInvoiceNumber && e.vendorInvoiceNumber.toLowerCase().includes(q)) ||
      (prop && ((prop.nameAr || "").toLowerCase().includes(q) || (prop.nameEn || "").toLowerCase().includes(q))) ||
      (owner && ((owner.nameAr || "").toLowerCase().includes(q) || (owner.nameEn || "").toLowerCase().includes(q)));
    return matchesBearer && matchesCategory && matchesProperty && matchesSearch;
  });

  const handleOpenAddModal = () => {
    setModalOwnerId("");
    setModalPropertyId(properties[0]?.id || "");
    if (properties[0]) {
      handlePropertySelect(properties[0].id);
    }
    setModalUnitId("");
    setModalLeaseId("");
    setModalTenantId("");
    setModalLegalCaseId("");
    setModalMaintenanceRequestId("");
    setModalCategory("MAINTENANCE");
    setModalCostBearer("OWNER");
    setModalDescription("");
    setModalAmount(0);
    setModalVatPercentage(5);
    setModalExpenseDate(new Date().toISOString().split("T")[0]);
    setModalVendorName("");
    setModalVendorInvoiceNumber("");
    setModalPaymentMethod("BANK_TRANSFER");
    setModalNotes("");
    setModalSupportingDoc("");
    setModalPaymentStatus("PAID");
    setModalPostingStatus("POSTED");
    setModalLevel("PROPERTY_LEVEL");
    setModalRelatesToTenant(false);
    setModalError("");
    setIsAddModalOpen(true);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    if (!modalPropertyId) {
      setModalError(isAr ? "يرجى تحديد العقار." : "Please select a property.");
      return;
    }

    if (modalAmount <= 0) {
      setModalError(isAr ? "مبلغ المصروف يجب أن يكون أكبر من الصفر." : "Amount must be greater than zero.");
      return;
    }

    if (!modalDescription.trim()) {
      setModalError(isAr ? "يرجى كتابة بيان ووصف المصروف." : "Description is required.");
      return;
    }

    // Category Intelligent Validation
    if (modalRelatesToTenant) {
      if (!modalTenantId) {
        setModalError(isAr ? "يرجى تحديد المستأجر المرتبط بالمصروف." : "Tenant is required for this expense.");
        return;
      }
      if (!modalLeaseId) {
        setModalError(isAr ? "يرجى تحديد عقد الإيجار المرتبط." : "Lease is required for this expense.");
        return;
      }
    }

    // Double Posting Prevention for Maintenance Request
    if (modalCategory === "MAINTENANCE" && modalMaintenanceRequestId) {
      const alreadyPosted = propertyExpenses.some(
        (exp) => exp.status !== "REVERSED" && exp.sourceId === modalMaintenanceRequestId
      );
      if (alreadyPosted) {
        setModalError(
          isAr
            ? "هذا المصروف مرتبط مسبقًا بسجل صيانة مالي. لا يمكن تسجيله مرة أخرى لتجنب الخصم المزدوج."
            : "This expense is already linked to a posted maintenance financial record. Duplicate posting is blocked."
        );
        return;
      }
    }

    const vatAmount = (modalAmount * modalVatPercentage) / 100;
    const docs = modalSupportingDoc ? [modalSupportingDoc] : [];

    const res = addPropertyExpense({
      propertyId: modalPropertyId,
      unitId: modalUnitId || undefined,
      ownerId: modalOwnerId,
      tenantId: modalRelatesToTenant ? modalTenantId || undefined : undefined,
      leaseId: modalRelatesToTenant ? modalLeaseId || undefined : undefined,
      legalCaseId: modalCategory === "LEGAL_FEES" ? modalLegalCaseId || undefined : undefined,
      category: modalCategory,
      description: modalDescription.trim(),
      amount: modalAmount,
      vatAmount,
      costBearer: modalCostBearer,
      expenseDate: modalExpenseDate,
      paymentMethod: modalPaymentMethod,
      vendorName: modalVendorName.trim() || undefined,
      vendorInvoiceNumber: modalVendorInvoiceNumber.trim() || undefined,
      status: modalPaymentStatus === "PAID" ? "PAID" : "PENDING_PAYMENT",
      postingStatus: modalPostingStatus,
      expenseLevel: modalLevel,
      supportingDocuments: docs,
      sourceType: modalMaintenanceRequestId ? "MAINTENANCE_REQUEST" : "OTHER",
      sourceId: modalMaintenanceRequestId || undefined,
      notes: modalNotes.trim() || undefined,
    });

    if (res.success) {
      setIsAddModalOpen(false);
      const origin = sessionStorage.getItem("expensePreFillOrigin");
      const returnCaseId = sessionStorage.getItem("returnToCaseId");
      if (origin === "CASES" || returnCaseId) {
        sessionStorage.removeItem("expensePreFillOrigin");
        const targetCaseId = modalLegalCaseId || returnCaseId;
        if (targetCaseId) {
          sessionStorage.setItem("returnToCaseId", targetCaseId);
        }
        navigateTo("CASES");
      }
    } else {
      setModalError(res.error || "Failed to add expense");
    }
  };

  const handleOpenEditModal = (exp: PropertyExpenseRecord) => {
    setEditingExpenseId(exp.id);
    setModalOwnerId(exp.ownerId || "");
    setModalPropertyId(exp.propertyId);
    setModalUnitId(exp.unitId || "");
    setModalLeaseId(exp.leaseId || "");
    setModalTenantId(exp.tenantId || "");
    setModalLegalCaseId(exp.legalCaseId || "");
    setModalMaintenanceRequestId(exp.sourceId || "");
    setModalCategory(exp.category);
    setModalCostBearer(exp.costBearer);
    setModalDescription(exp.description);
    setModalAmount(exp.amount);
    const vatPct = exp.amount > 0 ? ((exp.vatAmount || 0) / exp.amount) * 100 : 0;
    setModalVatPercentage(Math.round(vatPct));
    setModalExpenseDate(exp.expenseDate);
    setModalVendorName(exp.vendorName || "");
    setModalVendorInvoiceNumber(exp.vendorInvoiceNumber || "");
    setModalPaymentMethod(exp.paymentMethod || "BANK_TRANSFER");
    setModalNotes(exp.notes || "");
    setModalSupportingDoc(exp.supportingDocuments?.[0] || "");
    setModalPaymentStatus(exp.status === "PAID" ? "PAID" : "PENDING_PAYMENT");
    setModalPostingStatus(exp.postingStatus || "POSTED");
    setModalLevel(exp.expenseLevel || "PROPERTY_LEVEL");
    setModalRelatesToTenant(!!exp.leaseId);
    setModalError("");
    setIsEditModalOpen(true);
  };

  const handleUpdateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    if (modalAmount <= 0) {
      setModalError(isAr ? "المبلغ يجب أن يكون أكبر من الصفر" : "Amount must be positive");
      return;
    }

    const vatAmount = (modalAmount * modalVatPercentage) / 100;
    const docs = modalSupportingDoc ? [modalSupportingDoc] : [];

    const res = updatePropertyExpense(editingExpenseId, {
      propertyId: modalPropertyId,
      unitId: modalUnitId || undefined,
      ownerId: modalOwnerId || undefined,
      tenantId: modalRelatesToTenant ? modalTenantId || undefined : undefined,
      leaseId: modalRelatesToTenant ? modalLeaseId || undefined : undefined,
      legalCaseId: modalCategory === "LEGAL_FEES" ? modalLegalCaseId || undefined : undefined,
      category: modalCategory,
      description: modalDescription.trim(),
      amount: modalAmount,
      vatAmount,
      costBearer: modalCostBearer,
      expenseDate: modalExpenseDate,
      paymentMethod: modalPaymentMethod,
      vendorName: modalVendorName.trim() || undefined,
      vendorInvoiceNumber: modalVendorInvoiceNumber.trim() || undefined,
      status: modalPaymentStatus === "PAID" ? "PAID" : "PENDING_PAYMENT",
      postingStatus: modalPostingStatus,
      expenseLevel: modalLevel,
      supportingDocuments: docs,
      sourceType: modalMaintenanceRequestId ? "MAINTENANCE_REQUEST" : "OTHER",
      sourceId: modalMaintenanceRequestId || undefined,
      notes: modalNotes.trim() || undefined,
    });

    if (res.success) {
      setIsEditModalOpen(false);
    } else {
      setModalError(res.error || "Failed to update expense");
    }
  };

  const handleExportCSV = () => {
    const headers = isAr 
      ? ["رقم السند", "العقار", "التصنيف", "البيان", "المتحمل", "التاريخ", "المبلغ"]
      : ["Ref", "Property", "Category", "Description", "Bearer", "Date", "Amount"];
    
    const rows = filteredExpenses.map(e => {
      const prop = properties.find(p => p.id === e.propertyId);
      return [
        e.expenseNumber,
        prop ? (isAr ? prop.nameAr : prop.nameEn) : "—",
        e.category,
        e.description,
        e.costBearer,
        e.expenseDate,
        e.totalAmount.toString()
      ];
    });

    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `property_expenses_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
  };

  const handleOpenReversal = (id: string) => {
    setReversalExpenseId(id);
    setReversalReason("");
    setReversalError("");
    setIsReversalModalOpen(true);
  };

  const handleConfirmReversal = (e: React.FormEvent) => {
    e.preventDefault();
    setReversalError("");

    if (!reversalReason.trim()) {
      setReversalError(isAr ? "يرجى كتابة سبب الإلغاء." : "Please write a reason for reversal.");
      return;
    }

    const res = reversePropertyExpense(reversalExpenseId, reversalReason);
    if (res.success) {
      setIsReversalModalOpen(false);
    } else {
      setReversalError(res.error || "Failed to reverse expense");
    }
  };

  const getCategoryMeta = (cat: PropertyExpenseCategory) => {
    switch (cat) {
      case "MAINTENANCE":
        return { ar: "صيانة وتشغيل", en: "Maintenance", color: "bg-amber-50 text-amber-700 border-amber-200" };
      case "UTILITIES":
        return { ar: "كهرباء ومياه DEWA", en: "Utilities", color: "bg-blue-50 text-blue-700 border-blue-200" };
      case "MUNICIPALITY_FEES":
        return { ar: "رسوم بلدية وتوثيق", en: "Municipality", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
      case "LEGAL_FEES":
        return { ar: "رسوم قانونية ومحاكم", en: "Legal Fees", color: "bg-rose-50 text-rose-700 border-rose-200" };
      case "CLEANING":
        return { ar: "نظافة وحراسة", en: "Cleaning & Security", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      default:
        return { ar: "مصروفات أخرى", en: "Other", color: "bg-slate-50 text-slate-700 border-slate-200" };
    }
  };

  const getBearerBadge = (bearer: CostBearerType, isReversed?: boolean) => {
    const extraStyle = isReversed ? "opacity-60 line-through decoration-rose-600 decoration-[1.5px]" : "";
    switch (bearer) {
      case "OWNER":
        return (
          <span className={`px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-100 text-emerald-800 ${extraStyle}`}>
            {isAr ? "على المالك" : "OWNER"}
          </span>
        );
      case "TENANT":
        return (
          <span className={`px-2 py-0.5 text-xs font-bold rounded-md bg-blue-100 text-blue-800 ${extraStyle}`}>
            {isAr ? "على المستأجر" : "TENANT"}
          </span>
        );
      default:
        return (
          <span className={`px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-800 ${extraStyle}`}>
            {isAr ? "على المكتب" : "OFFICE"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" id="property-expenses-view-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            {isAr ? "إدارة مصاريف العقارات التشغيلية والقانونية" : "Operational & Legal Property Expenses"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? "تسجيل ومتابعة التكاليف الحكومية، البلدية، رسوم المحاكم، والصيانة الطارئة والربط مع المستأجرين"
              : "Track municipal, legal court fees, operations, and link tenant responsibility accounts"}
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
            id="btn-add-property-expense"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            {isAr ? "تسجيل مصروف جديد" : "New Property Expense"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">{isAr ? "إجمالي المصروفات" : "Total Expenses"}</div>
          <div className="text-lg font-bold font-mono text-slate-900 mt-1">{kpis.totalAll.toLocaleString()} AED</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">{isAr ? "المسدد عن المالك" : "Owner Borne"}</div>
          <div className="text-lg font-bold font-mono text-emerald-600 mt-1">{kpis.totalOwner.toLocaleString()} AED</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">{isAr ? "المستحق على المستأجر" : "Tenant Borne"}</div>
          <div className="text-lg font-bold font-mono text-blue-600 mt-1">{kpis.totalTenant.toLocaleString()} AED</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">{isAr ? "مصروفات عامة للمكتب" : "Office Overhead"}</div>
          <div className="text-lg font-bold font-mono text-slate-600 mt-1">{kpis.totalOffice.toLocaleString()} AED</div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "بحث بالبيان، المورد، رقم الفاتورة..." : "Search expenses..."}
            className="w-full pr-9 pl-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "جميع المتحملين للتكلفة" : "All Cost Bearers" },
              { id: "OWNER", label: isAr ? "على حساب المالك" : "Owner Borne" },
              { id: "TENANT", label: isAr ? "على حساب المستأجر" : "Tenant Borne" },
              { id: "OFFICE", label: isAr ? "على حساب المكتب" : "Office Overhead" },
            ]}
            value={bearerFilter}
            onChange={(val) => setBearerFilter(val)}
            placeholder={isAr ? "المتحمل للتكلفة..." : "Cost Bearer..."}
            searchPlaceholder={isAr ? "ابحث بالمتحمل..." : "Search bearer..."}
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "جميع التصنيفات" : "All Categories" },
              { id: "MAINTENANCE", label: isAr ? "صيانة وتشغيل" : "Maintenance" },
              { id: "UTILITIES", label: isAr ? "كهرباء ومياه DEWA" : "Utilities" },
              { id: "MUNICIPALITY_FEES", label: isAr ? "رسوم بلدية وتوثيق" : "Municipality" },
              { id: "LEGAL_FEES", label: isAr ? "رسوم قانونية ومحاكم" : "Legal Fees" },
              { id: "CLEANING", label: isAr ? "نظافة وحراسة" : "Cleaning & Security" },
              { id: "OTHER", label: isAr ? "مصروفات أخرى" : "Other" },
            ]}
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
            placeholder={isAr ? "التصنيف..." : "Category..."}
            searchPlaceholder={isAr ? "ابحث بالتصنيف..." : "Search category..."}
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "جميع العقارات" : "All Properties" },
              ...properties.map((p) => ({
                id: p.id,
                label: isAr ? p.nameAr : p.nameEn,
                subLabel: p.code,
              })),
            ]}
            value={propertyFilter}
            onChange={(val) => setPropertyFilter(val)}
            placeholder={isAr ? "العقار..." : "Property..."}
            searchPlaceholder={isAr ? "ابحث بالعقار..." : "Search property..."}
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">{isAr ? "رقم السند" : "Expense Ref"}</th>
                <th className="px-5 py-3.5">{isAr ? "العقار / المالك" : "Property / Owner"}</th>
                <th className="px-5 py-3.5">{isAr ? "التصنيف" : "Category"}</th>
                <th className="px-5 py-3.5">{isAr ? "البيان والمورد" : "Description & Vendor"}</th>
                <th className="px-5 py-3.5">{isAr ? "المتحمل للتكلفة" : "Cost Bearer"}</th>
                <th className="px-5 py-3.5">{isAr ? "التاريخ" : "Date"}</th>
                <th className="px-5 py-3.5">{isAr ? "المبلغ الإجمالي" : "Total Amount"}</th>
                <th className="px-5 py-3.5 text-center">{isAr ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp) => {
                const prop = properties.find((p) => p.id === exp.propertyId);
                const owner = owners.find((o) => o.id === exp.ownerId);
                const catMeta = getCategoryMeta(exp.category);
                const isReversed = exp.status === "REVERSED" || exp.status === "CANCELLED";

                return (
                  <tr
                    key={exp.id}
                    className={`transition-colors ${
                      isReversed
                        ? "bg-rose-50/30 hover:bg-rose-50/50 text-slate-400"
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
                      {exp.expenseNumber}
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
                        {prop ? (isAr ? prop.nameAr : prop.nameEn) : "—"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {owner ? (isAr ? owner.nameAr : owner.nameEn) : ""}
                      </div>
                    </td>
                    <td
                      className={`px-5 py-3.5 ${
                        isReversed ? "line-through decoration-rose-600 decoration-[2px]" : ""
                      }`}
                    >
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${catMeta.color} ${
                          isReversed ? "opacity-60 line-through decoration-rose-600 decoration-[1.5px]" : ""
                        }`}
                      >
                        {isAr ? catMeta.ar : catMeta.en}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3.5 ${
                        isReversed ? "line-through decoration-rose-600 decoration-[2px]" : ""
                      }`}
                    >
                      <div
                        className={`font-medium ${
                          isReversed ? "text-slate-400" : "text-slate-800"
                        }`}
                      >
                        {exp.description}
                      </div>
                      {exp.vendorName && (
                        <div className="text-xs text-slate-400">
                          {isAr ? "المورد:" : "Vendor:"} {exp.vendorName}{" "}
                          {exp.vendorInvoiceNumber && `(#${exp.vendorInvoiceNumber})`}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-5 py-3.5 ${
                        isReversed ? "line-through decoration-rose-600 decoration-[2px]" : ""
                      }`}
                    >
                      {getBearerBadge(exp.costBearer, isReversed)}
                    </td>
                    <td
                      className={`px-5 py-3.5 font-mono text-xs ${
                        isReversed
                          ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                          : "text-slate-600"
                      }`}
                    >
                      {exp.expenseDate}
                    </td>
                    <td
                      className={`px-5 py-3.5 font-bold font-mono ${
                        isReversed
                          ? "text-slate-400 line-through decoration-rose-600 decoration-[2px]"
                          : "text-slate-900"
                      }`}
                    >
                      {exp.totalAmount.toLocaleString()} AED
                      {(exp.vatAmount || 0) ? (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          VAT: {(exp.vatAmount || 0)} AED
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      {isReversed ? (
                        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          {isAr ? "محذوف" : "Deleted"}
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {exp.sourceType === "MAINTENANCE_REQUEST" || exp.sourceType === "LEGAL_CASE" || exp.sourceType === "LEASE_RENEWAL" ? (
                            <div 
                              className={`text-[11px] px-2 py-1 rounded-md text-center font-semibold border ${
                                exp.sourceType === "LEGAL_CASE" 
                                  ? "text-purple-700 bg-purple-50 border-purple-200" 
                                  : exp.sourceType === "LEASE_RENEWAL"
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                  : "text-amber-700 bg-amber-50 border-amber-200"
                              }`}
                              title={isAr ? "هذا المصروف يدار بشكل تلقائي من الشاشة الأصلية" : "This expense is managed from the source screen"}
                            >
                              {exp.sourceType === "MAINTENANCE_REQUEST" && (isAr ? "يدار من الصيانة" : "From Maintenance")}
                              {exp.sourceType === "LEGAL_CASE" && (isAr ? "يدار من شاشة القضايا" : "From Legal Cases")}
                              {exp.sourceType === "LEASE_RENEWAL" && (isAr ? "يدار من تجديد العقود" : "From Renewals")}
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handlePrintExpenseVoucher(exp)}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title={isAr ? "طباعة سند الصرف" : "Print Voucher"}
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(exp)}
                                className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title={isAr ? "تعديل" : "Edit"}
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenReversal(exp.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title={isAr ? "عكس وإلغاء المصروف" : "Reverse Expense"}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {isAr ? "لا توجد مصاريف عقارية مسجلة تطابق معايير البحث." : "No property expenses found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-hidden">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-5xl h-full max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-4rem)] flex flex-col shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                {isAr ? "تسجيل قيد مصروف عقاري تفصيلي" : "Record Property Expense"}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 overflow-y-auto flex-1 space-y-3.5">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Context Selector Cascade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-indigo-500" />
                      {isAr ? "المالك (اختياري للتصفية)" : "Owner (Optional filter)"}
                    </label>
                    <SearchableSelect
                      options={ownerOptions}
                      value={modalOwnerId}
                      onChange={handleOwnerSelect}
                      placeholder={isAr ? "اختر المالك..." : "Select Owner..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-indigo-500" />
                      {isAr ? "العقار المستهدف *" : "Property *"}
                    </label>
                    <SearchableSelect
                      options={filteredPropertyOptions}
                      value={modalPropertyId}
                      onChange={handlePropertySelect}
                      placeholder={isAr ? "ابحث واختر العقار..." : "Select Property..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Layers3 className="w-3 h-3 text-indigo-500" />
                      {isAr ? "الوحدة الفرعية (اختياري)" : "Unit (Optional)"}
                    </label>
                    <SearchableSelect
                      options={filteredUnitOptions}
                      value={modalUnitId}
                      onChange={handleUnitSelect}
                      placeholder={isAr ? "اختر الوحدة..." : "Select Unit..."}
                    />
                  </div>
                </div>

                {/* Relates to tenant toggle */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="relatesToTenantCheck"
                    checked={modalRelatesToTenant}
                    onChange={(e) => setModalRelatesToTenant(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="relatesToTenantCheck" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    {isAr ? "يرتبط المصروف بمستأجر وعقد محدد" : "Expense relates to a specific tenant/lease"}
                  </label>
                </div>

                {modalRelatesToTenant && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 bg-indigo-50/40 rounded-xl border border-indigo-100/60">
                    <div>
                      <label className="block text-xs font-bold text-indigo-950 mb-1">
                        {isAr ? "عقد الإيجار المرتبط *" : "Linked Lease *"}
                      </label>
                      <SearchableSelect
                        options={filteredLeaseOptions}
                        value={modalLeaseId}
                        onChange={(val) => {
                          setModalLeaseId(val);
                          const lease = leases.find((l) => l.id === val);
                          if (lease) setModalTenantId(lease.tenantId || "");
                        }}
                        placeholder={isAr ? "اختر عقد الإيجار..." : "Select Lease..."}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-indigo-950 mb-1">
                        {isAr ? "المستأجر المرتبط *" : "Linked Tenant *"}
                      </label>
                      <SearchableSelect
                        options={[
                          { id: "", label: isAr ? "— اختر المستأجر —" : "— Select Tenant —" },
                          ...tenants.map((t) => ({
                            id: t.id,
                            label: isAr ? t.nameAr || t.nameEn : t.nameEn,
                            subLabel: t.code,
                          })),
                        ]}
                        value={modalTenantId}
                        onChange={(val) => setModalTenantId(val)}
                        placeholder={isAr ? "اختر المستأجر..." : "Select Tenant..."}
                        searchPlaceholder={isAr ? "ابحث بالمستأجر..." : "Search tenant..."}
                      />
                    </div>
                  </div>
                )}

                {/* Category, cost bearer and level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "تصنيف المصروف *" : "Category *"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "MAINTENANCE", label: isAr ? "صيانة وتشغيل" : "Maintenance" },
                        { id: "UTILITIES", label: isAr ? "كهرباء ومياه DEWA" : "Utilities" },
                        { id: "MUNICIPALITY_FEES", label: isAr ? "رسوم بلدية وتوثيق" : "Municipality" },
                        { id: "LEGAL_FEES", label: isAr ? "رسوم قانونية ومحاكم" : "Legal Fees" },
                        { id: "CLEANING", label: isAr ? "نظافة وحراسة" : "Cleaning" },
                        { id: "OTHER", label: isAr ? "أخرى" : "Other" },
                      ]}
                      value={modalCategory}
                      onChange={(val) => handleCategoryChange(val as PropertyExpenseCategory)}
                      placeholder={isAr ? "التصنيف..." : "Category..."}
                      searchPlaceholder={isAr ? "ابحث بالتصنيف..." : "Search category..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "الطرف المتحمل للتكلفة *" : "Cost Bearer *"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "OWNER", label: isAr ? "على المالك (خصم من الإيجار)" : "Owner" },
                        { id: "TENANT", label: isAr ? "على المستأجر (مطالبة)" : "Tenant" },
                        { id: "OFFICE", label: isAr ? "على المكتب (مصروف عام)" : "Office" },
                      ]}
                      value={modalCostBearer}
                      onChange={(val) => setModalCostBearer(val as CostBearerType)}
                      placeholder={isAr ? "المتحمل للتكلفة..." : "Cost Bearer..."}
                      searchPlaceholder={isAr ? "ابحث بالمتحمل..." : "Search bearer..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "مستوى قيد المصروف" : "Expense Level"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "PROPERTY_LEVEL", label: isAr ? "على مستوى العقار" : "Property Level" },
                        { id: "UNIT_LEVEL", label: isAr ? "على مستوى الوحدة" : "Unit Level" },
                        { id: "LEASE_LEVEL", label: isAr ? "على مستوى العقد" : "Lease Level" },
                        { id: "TENANT_LEVEL", label: isAr ? "على مستوى المستأجر" : "Tenant Level" },
                        { id: "OWNER_LEVEL", label: isAr ? "على مستوى المالك" : "Owner Level" },
                        { id: "OFFICE_LEVEL", label: isAr ? "على مستوى المكتب" : "Office Level" },
                      ]}
                      value={modalLevel}
                      onChange={(val) => setModalLevel(val as any)}
                      placeholder={isAr ? "مستوى القيد..." : "Expense Level..."}
                      searchPlaceholder={isAr ? "ابحث بالمستوى..." : "Search level..."}
                    />
                  </div>
                </div>

                {/* Legal Case Link */}
                {modalCategory === "LEGAL_FEES" && (
                  <div className="bg-rose-50/40 p-2.5 rounded-xl border border-rose-100">
                    <label className="block text-xs font-bold text-rose-950 mb-1 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-rose-600" />
                      {isAr ? "ربط بقضية إيجارية / قانونية (اختياري)" : "Link to Legal/Rental Case (Optional)"}
                    </label>
                    <SearchableSelect
                      options={filteredCaseOptions}
                      value={modalLegalCaseId}
                      onChange={(val) => setModalLegalCaseId(val)}
                      placeholder={isAr ? "اختر القضية القانونية..." : "Select Legal Case..."}
                    />
                  </div>
                )}

                {/* Maintenance Request Link */}
                {modalCategory === "MAINTENANCE" && (
                  <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-100">
                    <label className="block text-xs font-bold text-amber-950 mb-1 flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-amber-600" />
                      {isAr ? "ربط بطلب صيانة معتمد (لمنع الازدواجية)" : "Link to Maintenance Ticket (Prevents Duplicate)"}
                    </label>
                    <SearchableSelect
                      options={filteredMaintenanceOptions}
                      value={modalMaintenanceRequestId}
                      onChange={(val) => setModalMaintenanceRequestId(val)}
                      placeholder={isAr ? "اختر طلب صيانة..." : "Select Maintenance Request..."}
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "بيان ووصف المصروف *" : "Description *"}
                  </label>
                  <input
                    type="text"
                    value={modalDescription}
                    onChange={(e) => setModalDescription(e.target.value)}
                    placeholder={isAr ? "مثال: رسوم تسجيل دعوى منازعة إيجارية" : "Description..."}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Date, amount & VAT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "تاريخ تسجيل المصروف *" : "Expense Date *"}
                    </label>
                    <input
                      type="date"
                      value={modalExpenseDate}
                      onChange={(e) => setModalExpenseDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "المبلغ الأساسي (AED) *" : "Base Amount (AED) *"}
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={modalAmount || ""}
                      onChange={(e) => setModalAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 focus:ring-indigo-500 font-mono font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "ضريبة القيمة المضافة" : "VAT Percentage"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "5", label: "5% VAT" },
                        { id: "0", label: "0% (معفى)" },
                      ]}
                      value={modalVatPercentage.toString()}
                      onChange={(val) => setModalVatPercentage(parseFloat(val) || 0)}
                      placeholder={isAr ? "الضريبة..." : "VAT..."}
                      searchPlaceholder={isAr ? "ابحث بالضريبة..." : "Search VAT..."}
                    />
                  </div>

                  {/* Calculated total */}
                  <div className="p-2 bg-indigo-50/50 border border-indigo-100 rounded-xl flex flex-col justify-center items-center h-[38px]">
                    <span className="text-[10px] font-medium text-slate-500">{isAr ? "الإجمالي مع الضريبة" : "Total with VAT"}</span>
                    <span className="font-bold font-mono text-indigo-700 text-sm">
                      {(modalAmount + (modalAmount * modalVatPercentage) / 100).toLocaleString()} AED
                    </span>
                  </div>
                </div>

                {/* Vendor details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "اسم المورد / الفني / الجهة الحكومية" : "Supplier / Vendor / Government"}
                    </label>
                    <input
                      type="text"
                      value={modalVendorName}
                      onChange={(e) => setModalVendorName(e.target.value)}
                      placeholder="e.g. Dubai Rental Dispute Center"
                      className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "رقم الفاتورة / مرجع الإيصال" : "Invoice/Receipt No."}
                    </label>
                    <input
                      type="text"
                      value={modalVendorInvoiceNumber}
                      onChange={(e) => setModalVendorInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-90234"
                      className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                </div>

                {/* Status and Method */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "حالة الدفع" : "Payment Status"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "PAID", label: isAr ? "مدفوع (PAID)" : "Paid" },
                        { id: "PENDING_PAYMENT", label: isAr ? "مستحق وغير مدفوع" : "Pending" },
                      ]}
                      value={modalPaymentStatus}
                      onChange={(val) => setModalPaymentStatus(val as any)}
                      placeholder={isAr ? "حالة الدفع..." : "Status..."}
                      searchPlaceholder={isAr ? "ابحث بالحالة..." : "Search status..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "وسيلة الدفع" : "Payment Method"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "BANK_TRANSFER", label: isAr ? "تحويل بنكي" : "Bank Transfer" },
                        { id: "CHEQUE", label: isAr ? "شيك" : "Cheque" },
                        { id: "CASH", label: isAr ? "نقدي" : "Cash" },
                      ]}
                      value={modalPaymentMethod}
                      onChange={(val) => setModalPaymentMethod(val as any)}
                      placeholder={isAr ? "وسيلة الدفع..." : "Method..."}
                      searchPlaceholder={isAr ? "ابحث بالوسيلة..." : "Search method..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "حالة الترحيل لدفتر الأستاذ" : "Posting Status"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "POSTED", label: isAr ? "مرحل فورياً" : "Posted Immediately" },
                        { id: "NOT_POSTED", label: isAr ? "غير مرحل (معلق)" : "Not Posted" },
                      ]}
                      value={modalPostingStatus}
                      onChange={(val) => setModalPostingStatus(val as any)}
                      placeholder={isAr ? "حالة الترحيل..." : "Posting..."}
                      searchPlaceholder={isAr ? "ابحث بالحالة..." : "Search posting..."}
                    />
                  </div>
                </div>

                {/* Supporting document */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Paperclip className="w-3 h-3 text-slate-500" />
                    {isAr ? "مستندات مؤيدة (رابط الملف)" : "Supporting Document (File URL)"}
                  </label>
                  <input
                    type="url"
                    value={modalSupportingDoc}
                    onChange={(e) => setModalSupportingDoc(e.target.value)}
                    placeholder="https://drive.google.com/file/..."
                    className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "ملاحظات إضافية" : "Additional Notes"}
                  </label>
                  <textarea
                    rows={1.5}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder={isAr ? "تفاصيل إضافية عن العملية..." : "Write details..."}
                    className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 resize-none"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="p-4 border-t border-slate-100 shrink-0 flex items-center justify-end gap-3 bg-slate-50/50">
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
                  {isAr ? "حفظ وترحيل المصروف" : "Save & Post Expense"}
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
              {isAr ? "عكس وإلغاء قيد المصروف" : "Reverse Property Expense"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {isAr
                ? "سيتم إلغاء المصروف وإعادة احتساب رصيد المالك/المستأجر مع إنشاء قيد عكسي في سجل التدقيق."
                : "Reversing this expense will update owner/tenant derived balances and log an audit reversal."}
            </p>

            {reversalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {reversalError}
              </div>
            )}

            <form onSubmit={handleConfirmReversal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "سبب الإلغاء والعكس (إلزامي)" : "Reason (Required)"}
                </label>
                <textarea
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder={isAr ? "توضيح سبب عكس قيد المصروف..." : "Reason..."}
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

      {/* Edit Expense Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-hidden">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-5xl h-full max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-4rem)] flex flex-col shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                {isAr ? "تعديل بيانات المصروف العقاري" : "Edit Property Expense"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 overflow-y-auto flex-1 space-y-3.5">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Context Selector Cascade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-indigo-500" />
                      {isAr ? "المالك (اختياري للتصفية)" : "Owner (Optional filter)"}
                    </label>
                    <SearchableSelect
                      options={ownerOptions}
                      value={modalOwnerId}
                      onChange={handleOwnerSelect}
                      placeholder={isAr ? "اختر المالك..." : "Select Owner..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-indigo-500" />
                      {isAr ? "العقار المستهدف *" : "Property *"}
                    </label>
                    <SearchableSelect
                      options={filteredPropertyOptions}
                      value={modalPropertyId}
                      onChange={handlePropertySelect}
                      placeholder={isAr ? "ابحث واختر العقار..." : "Select Property..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Layers3 className="w-3 h-3 text-indigo-500" />
                      {isAr ? "الوحدة الفرعية (اختياري)" : "Unit (Optional)"}
                    </label>
                    <SearchableSelect
                      options={filteredUnitOptions}
                      value={modalUnitId}
                      onChange={handleUnitSelect}
                      placeholder={isAr ? "اختر الوحدة..." : "Select Unit..."}
                    />
                  </div>
                </div>

                {/* Relates to tenant toggle */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="editRelatesToTenantCheck"
                    checked={modalRelatesToTenant}
                    onChange={(e) => setModalRelatesToTenant(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="editRelatesToTenantCheck" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    {isAr ? "يرتبط المصروف بمستأجر وعقد محدد" : "Expense relates to a specific tenant/lease"}
                  </label>
                </div>

                {modalRelatesToTenant && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 bg-blue-50/40 rounded-xl border border-blue-100/60">
                    <div>
                      <label className="block text-xs font-bold text-blue-950 mb-1">
                        {isAr ? "عقد الإيجار المرتبط *" : "Linked Lease *"}
                      </label>
                      <SearchableSelect
                        options={filteredLeaseOptions}
                        value={modalLeaseId}
                        onChange={(val) => {
                          setModalLeaseId(val);
                          const lease = leases.find((l) => l.id === val);
                          if (lease) setModalTenantId(lease.tenantId || "");
                        }}
                        placeholder={isAr ? "اختر عقد الإيجار..." : "Select Lease..."}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-blue-950 mb-1">
                        {isAr ? "المستأجر المرتبط *" : "Linked Tenant *"}
                      </label>
                      <SearchableSelect
                        options={[
                          { id: "", label: isAr ? "— اختر المستأجر —" : "— Select Tenant —" },
                          ...tenants.map((t) => ({
                            id: t.id,
                            label: isAr ? t.nameAr || t.nameEn : t.nameEn,
                            subLabel: t.code,
                          })),
                        ]}
                        value={modalTenantId}
                        onChange={(val) => setModalTenantId(val)}
                        placeholder={isAr ? "اختر المستأجر..." : "Select Tenant..."}
                        searchPlaceholder={isAr ? "ابحث بالمستأجر..." : "Search tenant..."}
                      />
                    </div>
                  </div>
                )}

                {/* Category, cost bearer and level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "تصنيف المصروف *" : "Category *"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "MAINTENANCE", label: isAr ? "صيانة وتشغيل" : "Maintenance" },
                        { id: "UTILITIES", label: isAr ? "كهرباء ومياه DEWA" : "Utilities" },
                        { id: "MUNICIPALITY_FEES", label: isAr ? "رسوم بلدية وتوثيق" : "Municipality" },
                        { id: "LEGAL_FEES", label: isAr ? "رسوم قانونية ومحاكم" : "Legal Fees" },
                        { id: "CLEANING", label: isAr ? "نظافة وحراسة" : "Cleaning" },
                        { id: "OTHER", label: isAr ? "أخرى" : "Other" },
                      ]}
                      value={modalCategory}
                      onChange={(val) => handleCategoryChange(val as PropertyExpenseCategory)}
                      placeholder={isAr ? "التصنيف..." : "Category..."}
                      searchPlaceholder={isAr ? "ابحث بالتصنيف..." : "Search category..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "الطرف المتحمل للتكلفة *" : "Cost Bearer *"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "OWNER", label: isAr ? "على المالك (خصم من الإيجار)" : "Owner" },
                        { id: "TENANT", label: isAr ? "على المستأجر (مطالبة)" : "Tenant" },
                        { id: "OFFICE", label: isAr ? "على المكتب (مصروف عام)" : "Office" },
                      ]}
                      value={modalCostBearer}
                      onChange={(val) => setModalCostBearer(val as CostBearerType)}
                      placeholder={isAr ? "المتحمل للتكلفة..." : "Cost Bearer..."}
                      searchPlaceholder={isAr ? "ابحث بالمتحمل..." : "Search bearer..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "مستوى قيد المصروف" : "Expense Level"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "PROPERTY_LEVEL", label: isAr ? "على مستوى العقار" : "Property Level" },
                        { id: "UNIT_LEVEL", label: isAr ? "على مستوى الوحدة" : "Unit Level" },
                        { id: "LEASE_LEVEL", label: isAr ? "على مستوى العقد" : "Lease Level" },
                        { id: "TENANT_LEVEL", label: isAr ? "على مستوى المستأجر" : "Tenant Level" },
                        { id: "OWNER_LEVEL", label: isAr ? "على مستوى المالك" : "Owner Level" },
                        { id: "OFFICE_LEVEL", label: isAr ? "على مستوى المكتب" : "Office Level" },
                      ]}
                      value={modalLevel}
                      onChange={(val) => setModalLevel(val as any)}
                      placeholder={isAr ? "مستوى القيد..." : "Expense Level..."}
                      searchPlaceholder={isAr ? "ابحث بالمستوى..." : "Search level..."}
                    />
                  </div>
                </div>

                {/* Legal Case Link */}
                {modalCategory === "LEGAL_FEES" && (
                  <div className="bg-rose-50/40 p-2.5 rounded-xl border border-rose-100">
                    <label className="block text-xs font-bold text-rose-950 mb-1 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-rose-600" />
                      {isAr ? "ربط بقضية إيجارية / قانونية (اختياري)" : "Link to Legal/Rental Case (Optional)"}
                    </label>
                    <SearchableSelect
                      options={filteredCaseOptions}
                      value={modalLegalCaseId}
                      onChange={(val) => setModalLegalCaseId(val)}
                      placeholder={isAr ? "اختر القضية القانونية..." : "Select Legal Case..."}
                    />
                  </div>
                )}

                {/* Maintenance Request Link */}
                {modalCategory === "MAINTENANCE" && (
                  <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-100">
                    <label className="block text-xs font-bold text-amber-950 mb-1 flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-amber-600" />
                      {isAr ? "ربط بطلب صيانة معتمد (لمنع الازدواجية)" : "Link to Maintenance Ticket (Prevents Duplicate)"}
                    </label>
                    <SearchableSelect
                      options={filteredMaintenanceOptions}
                      value={modalMaintenanceRequestId}
                      onChange={(val) => setModalMaintenanceRequestId(val)}
                      placeholder={isAr ? "اختر طلب صيانة..." : "Select Maintenance Request..."}
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "بيان ووصف المصروف *" : "Description *"}
                  </label>
                  <input
                    type="text"
                    value={modalDescription}
                    onChange={(e) => setModalDescription(e.target.value)}
                    placeholder={isAr ? "مثال: رسوم تسجيل دعوى منازعة إيجارية" : "Description..."}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Date, amount & VAT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "تاريخ تسجيل المصروف *" : "Expense Date *"}
                    </label>
                    <input
                      type="date"
                      value={modalExpenseDate}
                      onChange={(e) => setModalExpenseDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "المبلغ الأساسي (AED) *" : "Base Amount (AED) *"}
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={modalAmount || ""}
                      onChange={(e) => setModalAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 focus:ring-indigo-500 font-mono font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "ضريبة القيمة المضافة" : "VAT Percentage"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "5", label: "5% VAT" },
                        { id: "0", label: "0% (معفى)" },
                      ]}
                      value={modalVatPercentage.toString()}
                      onChange={(val) => setModalVatPercentage(parseFloat(val) || 0)}
                      placeholder={isAr ? "الضريبة..." : "VAT..."}
                      searchPlaceholder={isAr ? "ابحث بالضريبة..." : "Search VAT..."}
                    />
                  </div>

                  {/* Calculated total */}
                  <div className="p-2 bg-blue-50/50 border border-blue-100 rounded-xl flex flex-col justify-center items-center h-[38px]">
                    <span className="text-[10px] font-medium text-slate-500">{isAr ? "الإجمالي مع الضريبة" : "Total with VAT"}</span>
                    <span className="font-bold font-mono text-blue-700 text-sm">
                      {(modalAmount + (modalAmount * modalVatPercentage) / 100).toLocaleString()} AED
                    </span>
                  </div>
                </div>

                {/* Vendor details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "اسم المورد / الفني / الجهة الحكومية" : "Supplier / Vendor / Government"}
                    </label>
                    <input
                      type="text"
                      value={modalVendorName}
                      onChange={(e) => setModalVendorName(e.target.value)}
                      placeholder="e.g. Dubai Rental Dispute Center"
                      className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "رقم الفاتورة / مرجع الإيصال" : "Invoice/Receipt No."}
                    </label>
                    <input
                      type="text"
                      value={modalVendorInvoiceNumber}
                      onChange={(e) => setModalVendorInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-90234"
                      className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                </div>

                {/* Status and Method */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "حالة الدفع" : "Payment Status"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "PAID", label: isAr ? "مدفوع (PAID)" : "Paid" },
                        { id: "PENDING_PAYMENT", label: isAr ? "مستحق وغير مدفوع" : "Pending" },
                      ]}
                      value={modalPaymentStatus}
                      onChange={(val) => setModalPaymentStatus(val as any)}
                      placeholder={isAr ? "حالة الدفع..." : "Status..."}
                      searchPlaceholder={isAr ? "ابحث بالحالة..." : "Search status..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "وسيلة الدفع" : "Payment Method"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "BANK_TRANSFER", label: isAr ? "تحويل بنكي" : "Bank Transfer" },
                        { id: "CHEQUE", label: isAr ? "شيك" : "Cheque" },
                        { id: "CASH", label: isAr ? "نقدي" : "Cash" },
                      ]}
                      value={modalPaymentMethod}
                      onChange={(val) => setModalPaymentMethod(val as any)}
                      placeholder={isAr ? "وسيلة الدفع..." : "Method..."}
                      searchPlaceholder={isAr ? "ابحث بالوسيلة..." : "Search method..."}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isAr ? "حالة الترحيل لدفتر الأستاذ" : "Posting Status"}
                    </label>
                    <SearchableSelect
                      options={[
                        { id: "POSTED", label: isAr ? "مرحل فورياً" : "Posted Immediately" },
                        { id: "NOT_POSTED", label: isAr ? "غير مرحل (معلق)" : "Not Posted" },
                      ]}
                      value={modalPostingStatus}
                      onChange={(val) => setModalPostingStatus(val as any)}
                      placeholder={isAr ? "حالة الترحيل..." : "Posting..."}
                      searchPlaceholder={isAr ? "ابحث بالحالة..." : "Search posting..."}
                    />
                  </div>
                </div>

                {/* Supporting document */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Paperclip className="w-3 h-3 text-slate-500" />
                    {isAr ? "مستندات مؤيدة (رابط الملف)" : "Supporting Document (File URL)"}
                  </label>
                  <input
                    type="url"
                    value={modalSupportingDoc}
                    onChange={(e) => setModalSupportingDoc(e.target.value)}
                    className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "ملاحظات إضافية" : "Additional Notes"}
                  </label>
                  <textarea
                    rows={1.5}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 resize-none"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="p-4 border-t border-slate-100 shrink-0 flex items-center justify-end gap-3 bg-slate-50/50">
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
                  {isAr ? "تحديث السجل المالي" : "Update Financial Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Unified Expense Voucher Print Modal */}
      <UnifiedDocumentPreviewModal
        isOpen={!!selectedDocForPrint}
        onClose={() => setSelectedDocForPrint(null)}
        document={selectedDocForPrint}
      />
    </div>
  );
};
