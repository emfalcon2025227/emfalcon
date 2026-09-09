import React, { useState, useMemo } from "react";
import {
  Receipt,
  Search,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Calendar,
  CreditCard,
  Building,
  User,
  ArrowRight,
  Trash2,
  Undo2,
  Mail,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Layers,
  Sparkles,
  CheckCheck,
  Plus,
  Coins,
  FileText,
  Clock,
  PieChart,
  ArrowDownRight,
  Filter,
  MessageCircle,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { Cheque, CollectionRecord } from "../../types";
import { Badge } from "../common/Badge";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { ReceiptVoucherModal } from "./ReceiptVoucherModal";
import { AddChequeModal } from "../cheques/AddChequeModal";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import {
  openWhatsAppDirect,
  formatWhatsAppReceipt,
} from "../../services/automatedEmailService";
import { CollectionsCalendar } from "./CollectionsCalendar";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import {
  isBouncedWithoutLegalAction,
  isChequeInActiveCase,
  getChequeOutstanding,
} from "../../utils/chequeUtils";

interface ChequeCollectionGroup {
  chequeId: string;
  cheque?: Cheque;
  chequeNumber: string;
  bankName: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  dueDate: string;
  totalChequeAmount: number;
  totalCollected: number;
  outstandingBalance: number;
  progressPercent: number;
  isFullyCollected: boolean;
  receipts: CollectionRecord[];
}

export const CollectionsView: React.FC = () => {
  const { t, language } = useLanguage();
  const { canGoBack } = useNavigation();
  const { cheques, cases, collections, tenants, properties, units, leases, owners, deleteCollection } = useData();
  const { currentUser, hasPermission } = useAuth();
  
  const isManager = currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER";
  const canDelete = hasPermission("DELETE_RECORDS") && (isManager || !currentUser);

  const [receiptToDelete, setReceiptToDelete] = useState<CollectionRecord | null>(null);

  const handleDelete = (rcp: CollectionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setReceiptToDelete(rcp);
  };

  const [activeTab, setActiveTab] = useState<"QUEUE" | "HISTORY" | "CALENDAR">("HISTORY");
  const [searchTerm, setSearchTerm] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "MULTI_INSTALLMENT" | "FULLY_COLLECTED" | "PARTIALLY_COLLECTED">("ALL");
  const [expandedChequeIds, setExpandedChequeIds] = useState<string[]>([]);

  const [selectedChequeForPay, setSelectedChequeForPay] = useState<Cheque | null>(null);
  const [selectedReceiptForView, setSelectedReceiptForView] = useState<CollectionRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isAddChequeModalOpen, setIsAddChequeModalOpen] = useState(false);
  const [autoTriggerScan, setAutoTriggerScan] = useState(false);

  const handleResendEmail = async (rcp: CollectionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const tenant = tenants.find((t) => t.id === rcp.tenantId);
    const owner = owners.find((o) => o.id === rcp.ownerId);

    if (!tenant?.email && !owner?.email) {
      alert(language === "ar" ? "لا يوجد بريد إلكتروني مسجل للمستأجر أو المالك" : "No email address registered for this tenant or owner");
      return;
    }
    
    setResendingId(rcp.id);
    const cheque = cheques.find((c) => c.id === rcp.chequeId);
    const prop = cheque ? properties.find((p) => p.id === cheque.propertyId) : null;
    const unit = cheque ? units.find((u) => u.id === cheque.unitId) : null;
    
    try {
      const response = await fetch("/api/notifications/dispatch-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: tenant?.email || owner?.email || "",
          ownerEmail: owner?.email,
          tenantNameAr: tenant?.nameAr || rcp.payerName,
          tenantNameEn: tenant?.nameEn || rcp.payerName,
          receiptNumber: rcp.receiptNumber,
          amount: rcp.amountApplied,
          paymentMethod: rcp.paymentMethod,
          payerName: rcp.payerName,
          chequeNumber: cheque?.chequeNumber || "N/A",
          chequeAmount: cheque?.amount || 0,
          date: rcp.paymentDate,
          tenantName: language === "ar" ? tenant?.nameAr || rcp.payerName : tenant?.nameEn || rcp.payerName,
          propertyName: prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "N/A",
          unitNumber: unit ? unit.unitNumber : "N/A",
          ownerName: owner ? (language === "ar" ? owner.nameAr : owner.nameEn) : "N/A",
          remainingBalance: cheque?.outstanding || 0,
        }),
      });

      let responseText = "";
      try {
        responseText = await response.text();
      } catch (e) {}

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { message: responseText || "Error parsing response" };
      }

      if (response.ok) {
        alert(language === "ar" ? "تم إرسال السند تلقائياً عبر الإيميل للمستأجر والمالك بنجاح!" : "Receipt email resent to tenant and owner successfully!");
      } else {
        alert(data.message || (language === "ar" ? "تجاوز الحد المسموح للإرسال" : "Rate limit exceeded"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "ar" ? "حدث خطأ أثناء الاتصال بالخادم" : "Error connecting to server");
    } finally {
      setResendingId(null);
    }
  };

  const handleWhatsAppShare = (rcp: CollectionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const tenant = tenants.find((t) => t.id === rcp.tenantId);
    if (!tenant || !tenant.phone) {
      alert(language === "ar" ? "لا يوجد رقم هاتف مسجل لهذا المستأجر" : "No phone number registered for this tenant");
      return;
    }
    const cheque = cheques.find((c) => c.id === rcp.chequeId);
    const prop = cheque ? properties.find((p) => p.id === cheque.propertyId) : null;
    const unit = cheque ? units.find((u) => u.id === cheque.unitId) : null;

    const tntName = language === "ar" ? tenant.nameAr : tenant.nameEn;
    const propName = prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "";
    const unitNo = unit ? unit.unitNumber : "";

    const msg = formatWhatsAppReceipt(
      rcp.receiptNumber,
      tntName,
      rcp.amountApplied,
      propName,
      unitNo
    );

    openWhatsAppDirect(tenant.phone, msg);
  };

  // Active Bounced Queue: cheques that have bounced and have NO legal case yet and still have an outstanding balance > 0
  const bouncedQueue = cheques.filter((c) => isBouncedWithoutLegalAction(c, cases));

  const filteredQueue = bouncedQueue.filter((c) => {
    const tenant = tenants.find((t) => t.id === c.tenantId);
    const prop = properties.find((p) => p.id === c.propertyId);
    return (
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          c.chequeNumber,
          c.bankName,
          c.amount,
          c.outstanding,
          c.returnReason,
          tenant?.nameAr,
          tenant?.nameEn,
          tenant?.code,
          tenant?.phone,
          prop?.nameAr,
          prop?.nameEn,
          prop?.code,
        ],
        searchTerm
      )
    );
  });

  // Group receipts by Cheque (Hierarchical Tree Model)
  const chequeGroups: ChequeCollectionGroup[] = useMemo(() => {
    const map = new Map<string, CollectionRecord[]>();

    collections.forEach((col) => {
      const key = col.chequeId || "DIRECT_COLLECTIONS";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(col);
    });

    const groups: ChequeCollectionGroup[] = [];

    map.forEach((records, chqId) => {
      const sortedRecords = [...records].sort((a, b) => {
        const dateA = new Date(a.paymentDate || a.createdAt).getTime();
        const dateB = new Date(b.paymentDate || b.createdAt).getTime();
        return dateB - dateA;
      });

      const chq = cheques.find((c) => c.id === chqId);
      const totalCollected = sortedRecords.reduce((sum, r) => sum + r.amountApplied, 0);
      const totalChequeAmount = chq ? chq.amount : totalCollected;
      const outstandingBalance = chq ? chq.outstanding : Math.max(0, totalChequeAmount - totalCollected);
      const progressPercent =
        totalChequeAmount > 0
          ? Math.min(100, Math.round((totalCollected / totalChequeAmount) * 100))
          : 100;
      const isFullyCollected = outstandingBalance <= 0 || chq?.status === "COLLECTED";
      const primaryRecord = sortedRecords[0];
      const fallbackLease = leases.find((l) => l.tenantId === primaryRecord?.tenantId);

      groups.push({
        chequeId: chqId,
        cheque: chq,
        chequeNumber:
          chq?.chequeNumber ||
          primaryRecord?.transactionReference ||
          (chqId === "DIRECT_COLLECTIONS" ? (language === "ar" ? "سندات دفع مباشرة" : "Direct Receipts") : "Cheque"),
        bankName: chq?.bankName || "N/A",
        tenantId: chq?.tenantId || primaryRecord?.tenantId || "",
        propertyId: chq?.propertyId || fallbackLease?.propertyId || "",
        unitId: chq?.unitId || fallbackLease?.unitId || "",
        dueDate: chq?.dueDate || chq?.chequeDate || primaryRecord?.paymentDate || "",
        totalChequeAmount,
        totalCollected,
        outstandingBalance,
        progressPercent,
        isFullyCollected,
        receipts: sortedRecords,
      });
    });

    return groups.sort((a, b) => {
      const dateA = new Date(a.receipts[0]?.paymentDate || a.receipts[0]?.createdAt || "").getTime();
      const dateB = new Date(b.receipts[0]?.paymentDate || b.receipts[0]?.createdAt || "").getTime();
      return dateB - dateA;
    });
  }, [collections, cheques, language]);

  const filteredHistoryGroups = useMemo(() => {
    return chequeGroups.filter((g) => {
      const tenant = tenants.find((t) => t.id === g.tenantId);
      const prop = properties.find((p) => p.id === g.propertyId);
      const unit = units.find((u) => u.id === g.unitId);

      // Filter by type
      if (historyFilter === "MULTI_INSTALLMENT" && g.receipts.length < 2) return false;
      if (historyFilter === "FULLY_COLLECTED" && !g.isFullyCollected) return false;
      if (historyFilter === "PARTIALLY_COLLECTED" && (g.isFullyCollected || g.totalCollected === 0)) return false;

      if (!searchTerm.trim()) return true;

      const chequeFields = [
        g.chequeNumber,
        g.bankName,
        g.totalChequeAmount,
        g.totalCollected,
        g.outstandingBalance,
        tenant?.nameAr,
        tenant?.nameEn,
        tenant?.phone,
        tenant?.code,
        prop?.nameAr,
        prop?.nameEn,
        unit?.unitNumber,
      ];

      const receiptFields = g.receipts.flatMap((r) => [
        r.receiptNumber,
        r.payerName,
        r.transactionReference,
        r.paymentMethod,
        r.notes,
        r.amountApplied,
        r.collectedBy,
        r.paymentDate,
      ]);

      return matchAnyArabicSearch([...chequeFields, ...receiptFields], searchTerm);
    });
  }, [chequeGroups, historyFilter, searchTerm, tenants, properties, units]);

  const toggleExpand = (id: string) => {
    setExpandedChequeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExpandAll = () => {
    setExpandedChequeIds(filteredHistoryGroups.map((g) => g.chequeId));
  };

  const handleCollapseAll = () => {
    setExpandedChequeIds([]);
  };

  const totalCollectedAED = collections.reduce((sum, c) => sum + (Number(c.amountApplied) || 0), 0);
  const totalOutstandingQueueAED = bouncedQueue.reduce((sum, c) => sum + getChequeOutstanding(c), 0);
  const multiInstallmentChequesCount = chequeGroups.filter((g) => g.receipts.length > 1).length;
  const fullyCollectedChequesCount = chequeGroups.filter((g) => g.isFullyCollected).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t("navCollections")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "سجل سندات القبض التفصيلي، تسلسل دفعات الشيكات، وإدارة التحصيل المالي المباشر"
              : "Hierarchical receipt ledger, installment breakdown, and bounced cheque recovery queue"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAutoTriggerScan(true);
              setIsAddChequeModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{language === "ar" ? "مسح شيك ذكي (AI)" : "Smart Cheque Capture"}</span>
          </button>
          {canGoBack && <CloseBackButton />}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 block uppercase">
            {language === "ar" ? "إجمالي المبالغ المقبوضة" : "Total Collected Cash"}
          </span>
          <span className="text-xl font-black text-emerald-950 font-mono">
            AED {totalCollectedAED.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-700 block mt-0.5">
            {collections.length} {language === "ar" ? "سند قبض رسمي" : "Official Receipts"}
          </span>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-800 block uppercase">
            {language === "ar" ? "المتبقي بالشيكات المرتجعة" : "Bounced Queue Outstanding"}
          </span>
          <span className="text-xl font-black text-amber-950 font-mono">
            AED {totalOutstandingQueueAED.toLocaleString()}
          </span>
          <span className="text-xs text-amber-700 block mt-0.5">
            {bouncedQueue.length} {language === "ar" ? "شيك مرتجع معلق (بدون قضايا)" : "Pending Bounced Cheques"}
          </span>
        </div>

        <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 shadow-2xs">
          <span className="text-[10px] font-bold text-sky-800 block uppercase">
            {language === "ar" ? "شيكات سُددت على دفعات" : "Multi-Installment Cheques"}
          </span>
          <span className="text-xl font-black text-sky-950 font-mono">
            {multiInstallmentChequesCount} {language === "ar" ? "شيك" : "Cheques"}
          </span>
          <span className="text-xs text-sky-700 block mt-0.5">
            {language === "ar" ? "شيكات بأكثر من سند قبض" : "Multiple receipts per cheque"}
          </span>
        </div>

        <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-800 block uppercase">
            {language === "ar" ? "شيكات مكتملة السداد 100%" : "Fully Settled Cheques"}
          </span>
          <span className="text-xl font-black text-purple-950 font-mono">
            {fullyCollectedChequesCount} / {chequeGroups.length}
          </span>
          <span className="text-xs text-purple-700 block mt-0.5">
            {language === "ar" ? "تم استرداد كامل قيمتها" : "100% recovered"}
          </span>
        </div>
      </div>

      {/* Main Tab Switcher & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "HISTORY"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {language === "ar"
                ? `سجل سندات القبض والشيكات (${chequeGroups.length})`
                : `Receipts & Cheques Ledger (${chequeGroups.length})`}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("QUEUE")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "QUEUE"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>
              {language === "ar"
                ? `طابور التحصيل المباشر (${bouncedQueue.length})`
                : `Active Recovery Queue (${bouncedQueue.length})`}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("CALENDAR")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "CALENDAR"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span>
              {language === "ar"
                ? `أجندة التحصيل والودائع`
                : `Collections & Deposits Calendar`}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === "HISTORY"
                ? language === "ar"
                  ? "بحث برقم الشيك، رقم السند، المستأجر..."
                  : "Search cheque #, receipt #, tenant..."
                : language === "ar"
                ? "بحث في طابور التحصيل..."
                : "Search recovery queue..."
            }
            className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
          />
        </div>
      </div>

      {/* Tab 3: Calendar View */}
      {activeTab === "CALENDAR" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CollectionsCalendar 
            cheques={cheques} 
            language={language} 
          />
        </div>
      )}

      {/* Tab 1: Receipts History (Hierarchical Tree / Cheque Grouping) */}
      {activeTab === "HISTORY" && (
        <div className="space-y-4">
          {/* Sub-Filter Toolbar & Expand/Collapse Controls */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 me-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                <span>{language === "ar" ? "تصفية السجل:" : "Filter:"}</span>
              </span>

              <button
                onClick={() => setHistoryFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                {language === "ar" ? "كافة الشيكات والسندات" : "All Cheques & Receipts"} ({chequeGroups.length})
              </button>

              <button
                onClick={() => setHistoryFilter("MULTI_INSTALLMENT")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === "MULTI_INSTALLMENT"
                    ? "bg-sky-700 text-white shadow-2xs"
                    : "bg-white text-sky-800 hover:bg-sky-100 border border-sky-200"
                }`}
              >
                {language === "ar" ? "شيكات مقسطة (أكثر من سند)" : "Multi-Installment"} ({multiInstallmentChequesCount})
              </button>

              <button
                onClick={() => setHistoryFilter("FULLY_COLLECTED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === "FULLY_COLLECTED"
                    ? "bg-emerald-700 text-white shadow-2xs"
                    : "bg-white text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                {language === "ar" ? "مسددة بالكامل (100%)" : "Fully Settled (100%)"} ({fullyCollectedChequesCount})
              </button>

              <button
                onClick={() => setHistoryFilter("PARTIALLY_COLLECTED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === "PARTIALLY_COLLECTED"
                    ? "bg-amber-700 text-white shadow-2xs"
                    : "bg-white text-amber-800 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                {language === "ar" ? "سداد جزئي (قيد المتابعة)" : "Partially Settled"}
              </button>
            </div>

            {/* Quick Expand/Collapse All */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExpandAll}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === "ar" ? "توسيع كافة الشيكات" : "Expand All"}</span>
              </button>
              <button
                onClick={handleCollapseAll}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === "ar" ? "طي الكل" : "Collapse All"}</span>
              </button>
            </div>
          </div>

          {/* Grouped Cheques List (Tree Model) */}
          <div className="space-y-3">
            {filteredHistoryGroups.map((group) => {
              const isExpanded = expandedChequeIds.includes(group.chequeId);
              const tenant = tenants.find((t) => t.id === group.tenantId);
              const prop = properties.find((p) => p.id === group.propertyId);
              const unit = units.find((u) => u.id === group.unitId);
              const isCase = group.cheque && isChequeInActiveCase(group.cheque, cases);

              return (
                <div
                  key={group.chequeId}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                    isExpanded
                      ? "border-amber-400/80 shadow-md ring-1 ring-amber-400/20"
                      : "border-slate-200/80 hover:border-slate-300 shadow-2xs"
                  }`}
                >
                  {/* Master Cheque Row */}
                  <div
                    onClick={() => toggleExpand(group.chequeId)}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                  >
                    {/* Left: Cheque Header & Metadata */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                          isExpanded
                            ? "bg-amber-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                        }`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-sm text-slate-900 flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              {language === "ar" ? "شيك رقم:" : "Cheque #"} {group.chequeNumber}
                            </span>
                          </span>

                          <span className="text-xs text-slate-500 font-medium px-2 py-0.5 bg-slate-100 rounded-md">
                            {group.bankName}
                          </span>

                          {isCase && (
                            <Badge variant="purple" size="sm">
                              {language === "ar" ? "قيد التقاضي (قضية)" : "Under Legal Case"}
                            </Badge>
                          )}

                          {group.isFullyCollected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>{language === "ar" ? "سُدد بالكامل (100%)" : "Fully Settled"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              <Coins className="w-3.5 h-3.5" />
                              <span>
                                {language === "ar"
                                  ? `سداد جزئي (${group.progressPercent}%)`
                                  : `Partial (${group.progressPercent}%)`}
                              </span>
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <Receipt className="w-3 h-3 text-sky-600" />
                            <span>
                              {group.receipts.length}{" "}
                              {language === "ar" ? "سندات قبض / دفعات" : "Receipts"}
                            </span>
                          </span>
                        </div>

                        {/* Tenant & Property subtitle */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A"}</span>
                            {tenant?.phone && <span className="font-mono text-slate-400 text-[11px]">({tenant.phone})</span>}
                          </span>

                          <span className="flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>{prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : ""}</span>
                            {unit && <span className="text-slate-400">/ {language === "ar" ? `وحدة ${unit.unitNumber}` : `Unit #${unit.unitNumber}`}</span>}
                          </span>

                          {group.dueDate && (
                            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                              <Calendar className="w-3 h-3" />
                              <span>{language === "ar" ? "تاريخ الاستحقاق:" : "Due:"} {group.dueDate}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Financial Breakdown & Progress Bar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      {/* Financial Badges */}
                      <div className="flex items-center gap-4 text-start">
                        {/* Total Cheque Amount */}
                        <div className="text-start">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            {language === "ar" ? "القيمة الإجمالية للشيك" : "Original Cheque"}
                          </span>
                          <span className="text-sm font-black text-slate-900 font-mono">
                            AED {group.totalChequeAmount.toLocaleString()}
                          </span>
                        </div>

                        {/* Total Collected */}
                        <div className="text-start">
                          <span className="text-[10px] font-bold text-emerald-700 block uppercase">
                            {language === "ar" ? "إجمالي المقبوض" : "Total Collected"}
                          </span>
                          <span className="text-sm font-black text-emerald-700 font-mono">
                            AED {group.totalCollected.toLocaleString()}
                          </span>
                        </div>

                        {/* Remaining */}
                        <div className="text-start">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            {language === "ar" ? "المتبقي" : "Remaining"}
                          </span>
                          <span
                            className={`text-sm font-black font-mono ${
                              group.outstandingBalance > 0 ? "text-rose-600" : "text-slate-400"
                            }`}
                          >
                            AED {group.outstandingBalance.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Mini Progress & Expand CTA */}
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="w-24 sm:w-28 hidden xl:block">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                            <span>{language === "ar" ? "التحصيل" : "Progress"}</span>
                            <span>{group.progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                group.isFullyCollected
                                  ? "bg-emerald-500"
                                  : group.progressPercent > 50
                                  ? "bg-sky-500"
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${group.progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Quick record payment if still has balance */}
                        {group.outstandingBalance > 0 && group.cheque && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChequeForPay(group.cheque!);
                            }}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer shrink-0"
                            title={language === "ar" ? "تحصيل دفعة جديدة لهذا الشيك" : "Record Next Installment"}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{language === "ar" ? "قبض دفعة" : "Collect"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Sub-Tree: All Payment Vouchers for this Cheque */}
                  {isExpanded && (
                    <div className="bg-slate-50/90 border-t border-slate-200/80 p-4 sm:p-5 animate-in fade-in slide-in-from-top-1 duration-200">
                      {/* Tree Branch Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <span className="text-xs font-bold text-slate-700">
                            {language === "ar"
                              ? `التسلسل الشجري لعمليات وسندات القبض للشيك #${group.chequeNumber}`
                              : `Payment Vouchers & Installment Tree for Cheque #${group.chequeNumber}`}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({group.receipts.length} {language === "ar" ? "سندات مسجلة" : "records"})
                          </span>
                        </div>

                        {group.outstandingBalance > 0 && group.cheque && (
                          <button
                            onClick={() => setSelectedChequeForPay(group.cheque!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{language === "ar" ? "+ تسجيل دفعة جديدة" : "+ Record Payment"}</span>
                          </button>
                        )}
                      </div>

                      {/* Tree Node Container with connecting line */}
                      <div className="relative border-s-2 border-emerald-300/80 ms-3 sm:ms-5 ps-4 sm:ps-6 space-y-3">
                        {group.receipts.map((rcp, index) => {
                          const isLatest = index === 0;
                          const rcpPercentage =
                            group.totalChequeAmount > 0
                              ? Math.round((rcp.amountApplied / group.totalChequeAmount) * 100)
                              : 100;

                          return (
                            <div
                              key={rcp.id}
                              className="relative bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all"
                            >
                              {/* Node Marker on the vertical branch */}
                              <div className="absolute -start-[25px] sm:-start-[33px] top-4 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center shadow-xs">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                              </div>

                              {/* Voucher Content Row */}
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                {/* Left details */}
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono font-black text-xs text-slate-900 flex items-center gap-1">
                                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{rcp.receiptNumber}</span>
                                    </span>

                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 flex items-center gap-1 font-mono">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      <span>{rcp.paymentDate}</span>
                                    </span>

                                    <Badge variant="info" size="sm">
                                      {rcp.paymentMethod.replace("_", " ")}
                                    </Badge>

                                    {isLatest && group.receipts.length > 1 && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                        {language === "ar" ? "أحدث دفعة" : "Latest Installment"}
                                      </span>
                                    )}

                                    <span className="text-[10px] font-bold text-slate-400">
                                      {language === "ar"
                                        ? `الدفعة ${group.receipts.length - index} من ${group.receipts.length}`
                                        : `Installment ${group.receipts.length - index} of ${group.receipts.length}`}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-600 pt-0.5">
                                    <span>
                                      {language === "ar" ? "الدافع:" : "Payer:"}{" "}
                                      <strong className="text-slate-900">{rcp.payerName}</strong>
                                    </span>
                                    {rcp.collectedBy && (
                                      <span className="text-slate-500">
                                        {language === "ar" ? "المحصل:" : "Collector:"}{" "}
                                        <span className="font-medium text-slate-700">{rcp.collectedBy}</span>
                                      </span>
                                    )}
                                    {rcp.transactionReference && (
                                      <span className="text-slate-400 font-mono text-[11px]">
                                        Ref: {rcp.transactionReference}
                                      </span>
                                    )}
                                  </div>

                                  {rcp.notes && (
                                    <p className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 mt-1">
                                      {rcp.notes}
                                    </p>
                                  )}
                                </div>

                                {/* Right: Amount and Action Buttons */}
                                <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                  <div className="text-start md:text-end">
                                    <div className="text-sm sm:text-base font-mono font-black text-emerald-700">
                                      AED {rcp.amountApplied.toLocaleString()}
                                    </div>
                                    <span className="text-[10px] text-emerald-600 font-semibold block">
                                      {rcpPercentage}% {language === "ar" ? "من إجمالي الشيك" : "of total"}
                                    </span>
                                  </div>

                                  {/* Action Buttons for this voucher */}
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setSelectedReceiptForView(rcp)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shadow-2xs"
                                      title={language === "ar" ? "عرض وطباعة سند القبض" : "View / Print Receipt"}
                                    >
                                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                                      <span className="hidden sm:inline">
                                        {language === "ar" ? "طباعة السند" : "Print"}
                                      </span>
                                    </button>

                                    <button
                                      disabled={resendingId === rcp.id}
                                      onClick={(e) => handleResendEmail(rcp, e)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50 border border-emerald-200"
                                      title={language === "ar" ? "إعادة إرسال بالبريد الإلكتروني للمستأجر والمالك" : "Resend email receipt"}
                                    >
                                      <Mail className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="hidden sm:inline">
                                        {resendingId === rcp.id
                                          ? "..."
                                          : language === "ar"
                                          ? "إرسال إيميل"
                                          : "Email"}
                                      </span>
                                    </button>

                                    <button
                                      onClick={(e) => handleWhatsAppShare(rcp, e)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200"
                                      title={language === "ar" ? "مشاركة عبر واتساب" : "Share via WhatsApp"}
                                    >
                                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="hidden sm:inline">
                                        {language === "ar" ? "واتساب" : "WhatsApp"}
                                      </span>
                                    </button>

                                    {isManager && (
                                      <button
                                        onClick={(e) => handleDelete(rcp, e)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 hover:text-amber-950 transition-colors cursor-pointer border border-amber-200"
                                        title={language === "ar" ? "تراجع عن السند وإلغاء أثره المالي" : "Undo receipt"}
                                      >
                                        <Undo2 className="w-3.5 h-3.5 text-amber-700" />
                                        <span className="hidden sm:inline">{language === "ar" ? "تراجع" : "Undo"}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Tree Footer / Cheque Closure Status */}
                      <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                        <div className="text-slate-600 font-medium">
                          {group.isFullyCollected ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {language === "ar"
                                  ? `تم سداد وقبض كامل قيمة الشيك (${group.totalCollected.toLocaleString()} AED) عبر ${group.receipts.length} دفعات.`
                                  : `Fully collected (${group.totalCollected.toLocaleString()} AED) across ${group.receipts.length} installments.`}
                              </span>
                            </span>
                          ) : (
                            <span className="text-amber-800 font-bold flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span>
                                {language === "ar"
                                  ? `متبقي للتحصيل: ${group.outstandingBalance.toLocaleString()} AED من أصل ${group.totalChequeAmount.toLocaleString()} AED`
                                  : `Outstanding balance: ${group.outstandingBalance.toLocaleString()} AED out of ${group.totalChequeAmount.toLocaleString()} AED`}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="text-slate-400 font-mono text-[11px]">
                          {language === "ar" ? "المجموع المقبوض:" : "Total Applied:"} AED {group.totalCollected.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredHistoryGroups.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs shadow-2xs">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-800 text-sm mb-1">{t("noDataFound")}</p>
              <p className="text-slate-400">
                {language === "ar"
                  ? "لا توجد سندات قبض مسجلة تطابق خيارات البحث الحالية"
                  : "No collection vouchers found matching your search filters"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Active Recovery Queue Table */}
      {activeTab === "QUEUE" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-amber-50/50 border-b border-amber-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-900">
                {language === "ar"
                  ? "الشيكات المرتجعة المستحقة للتحصيل المالي المباشر (التي لم يُتخذ فيها إجراء قضائي)"
                  : "Active Bounced Cheques Pending Direct Recovery (Without Court Legal Action)"}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-900">
              {filteredQueue.length} {language === "ar" ? "شيكات معلقة" : "Cheques"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "رقم الشيك والمصرف" : "Cheque # & Bank"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "المستأجر" : "Tenant"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "العقار والوحدة" : "Property / Unit"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "قيمة الشيك" : "Original Amount"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "المتبقي للتحصيل" : "Outstanding"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "سبب الإرجاع" : "Return Reason"}</th>
                  <th className="py-3 px-4 text-end">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredQueue.map((cheque, idx) => {
                  const tenant = tenants.find((t) => t.id === cheque.tenantId);
                  const prop = properties.find((p) => p.id === cheque.propertyId);
                  const unit = units.find((u) => u.id === cheque.unitId);

                  return (
                    <tr key={`${cheque.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="font-mono font-black">#{cheque.chequeNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{cheque.bankName}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{tenant?.phone}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "Property"}
                        </div>
                        <div className="text-[10px] text-slate-400">Unit #{unit?.unitNumber}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600 font-semibold">
                        AED {cheque.amount.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 font-mono font-black text-rose-700">
                        AED {cheque.outstanding.toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant="danger" size="sm">
                          {cheque.returnReason || "BOUNCED"}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-end">
                        <button
                          onClick={() => setSelectedChequeForPay(cheque)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>{language === "ar" ? "تحصيل وقبض" : "Record Payment"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredQueue.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-800">
                {language === "ar"
                  ? "لا توجد شيكات مرتجعة معلقة للتحصيل المباشر"
                  : "All active bounced cheques have been resolved or handled!"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={!!selectedChequeForPay}
        onClose={() => setSelectedChequeForPay(null)}
        cheque={selectedChequeForPay}
        onPaymentSuccess={(rcp) => {
          setSelectedChequeForPay(null);
          setSelectedReceiptForView(rcp);
          
          // Automated notification dispatch upon final confirmation
          const tenant = tenants.find((t) => t.id === rcp.tenantId);
          const owner = owners.find((o) => o.id === rcp.ownerId);
          if ((tenant && tenant.email) || (owner && owner.email)) {
            const cheque = cheques.find((c) => c.id === rcp.chequeId);
            const prop = cheque ? properties.find((p) => p.id === cheque.propertyId) : null;
            const unit = cheque ? units.find((u) => u.id === cheque.unitId) : null;

            fetch("/api/notifications/dispatch-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: tenant?.email || owner?.email || "",
                ownerEmail: owner?.email,
                tenantNameAr: tenant?.nameAr || rcp.payerName,
                tenantNameEn: tenant?.nameEn || rcp.payerName,
                receiptNumber: rcp.receiptNumber,
                amount: rcp.amountApplied,
                paymentMethod: rcp.paymentMethod,
                payerName: rcp.payerName,
                chequeNumber: cheque?.chequeNumber || "N/A",
                chequeAmount: cheque?.amount || 0,
                date: rcp.paymentDate,
                tenantName: language === "ar" ? tenant?.nameAr || rcp.payerName : tenant?.nameEn || rcp.payerName,
                propertyName: prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "N/A",
                unitNumber: unit ? unit.unitNumber : "N/A",
                ownerName: owner ? (language === "ar" ? owner.nameAr : owner.nameEn) : "N/A",
                remainingBalance: cheque?.outstanding || 0,
              }),
            }).catch(err => console.error("Auto-dispatch failed:", err));
          }
        }}
      />

      {/* Receipt Voucher Modal */}
      <ReceiptVoucherModal
        isOpen={!!selectedReceiptForView}
        onClose={() => setSelectedReceiptForView(null)}
        receipt={selectedReceiptForView}
      />

      {/* Confirm Deletion/Undo Modal for Collections */}
      <ConfirmDeleteModal
        isOpen={!!receiptToDelete}
        onClose={() => setReceiptToDelete(null)}
        onConfirm={(options) => {
          if (receiptToDelete) {
            deleteCollection(receiptToDelete.id, options);
            setReceiptToDelete(null);
          }
        }}
        title={language === "ar" ? "حذف سند القبض وحفظه بالسجلات التاريخية" : "Delete & Archive Collection Receipt"}
        itemName={
          receiptToDelete
            ? `${language === "ar" ? "سند قبض رقم" : "Receipt No."} #${receiptToDelete.receiptNumber}`
            : ""
        }
        itemCode={receiptToDelete ? `${receiptToDelete.amountApplied.toLocaleString()} AED` : ""}
        itemType={language === "ar" ? "سند تحصيل مالي" : "Financial Collection Voucher"}
        statusAtDeletion={receiptToDelete?.paymentMethod || "COLLECTED"}
        warningMessage={
          language === "ar"
            ? "عند تأكيد الحذف، سيتم إزالة سند القبض وإعادة المبلغ المستحق لحساب الشيك، مع الاحتفاظ بكامل تفاصيل السند في السجلات التاريخية والأرشيف."
            : "Confirming this will remove the receipt and revert financial impact while archiving the complete record and attachments in historical records."
        }
      />

      <AddChequeModal
        isOpen={isAddChequeModalOpen}
        onClose={() => {
          setIsAddChequeModalOpen(false);
          setAutoTriggerScan(false);
        }}
        autoTriggerCapture={autoTriggerScan}
      />
    </div>
  );
};
