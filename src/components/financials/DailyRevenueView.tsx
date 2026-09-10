import React, { useState, useMemo } from "react";
import {
  BadgePercent,
  Plus,
  Search,
  Filter,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Receipt,
  Printer,
  FileSpreadsheet,
  Building2,
  User,
  Hash,
  Calendar,
  Lock,
  ArrowRight
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  CommissionObligation,
  CommissionType,
  PaymentMethod,
  Lease
} from "../../types";
import { calculateCommissionAmount, DEFAULT_COMMISSION_SETTINGS } from "../../services/financialEngine";
import { SearchableSelect } from "../common/SearchableSelect";

export const DailyRevenueView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentUser } = useAuth();
  const {
    commissions = [],
    leases = [],
    owners = [],
    tenants = [],
    properties = [],
    vatRates = [],
    addCommissionObligation,
    collectAdministrativeFee,
    reverseCommissionObligation,
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [partyFilter, setPartyFilter] = useState<"ALL" | "OWNER" | "TENANT">("ALL");
  const [typeFilter, setTypeFilter] = useState<CommissionType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COLLECTED">("ALL");

  // New Revenue Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalType, setModalType] = useState<CommissionType>("ADMIN_FEE");
  const [modalLeaseId, setModalLeaseId] = useState("");
  const [modalPartyType, setModalPartyType] = useState<"OWNER" | "TENANT">("TENANT");
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalDueDate, setModalDueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [modalNotes, setModalNotes] = useState("");
  const [modalError, setModalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Collection Modal State
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<CommissionObligation | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [collectRef, setCollectRef] = useState("");
  const [collectNotes, setCollectNotes] = useState("");
  const [collectError, setCollectError] = useState("");
  const [isCollecting, setIsCollecting] = useState(false);

  const revenueTypes: Array<{ value: CommissionType; labelAr: string; labelEn: string }> = [
    { value: "ADMIN_FEE", labelAr: "رسوم إدارية (5%)", labelEn: "Admin Fee (5%)" },
    { value: "BOUNCED_CHEQUE_PENALTY", labelAr: "غرامة شيك مرتجع", labelEn: "Bounced Cheque Penalty" },
    { value: "CLEANING_FEE", labelAr: "رسوم نظافة", labelEn: "Cleaning Fee" },
    { value: "SECURITY_FEE", labelAr: "رسوم حراسة وأمن", labelEn: "Security Fee" },
    { value: "OTHER_REVENUE", labelAr: "إيرادات مكتبية أخرى", labelEn: "Other Office Revenue" },
  ];

  // Authoritative Filtered Revenue
  const filteredRevenue = useMemo(() => {
    return commissions.filter((c) => {
      const isDailyRevenueType = [
        "ADMIN_FEE",
        "BOUNCED_CHEQUE_PENALTY",
        "CLEANING_FEE",
        "SECURITY_FEE",
        "OTHER_REVENUE"
      ].includes(c.commissionType);
      
      if (!isDailyRevenueType) return false;
      if (partyFilter !== "ALL" && c.partyType !== partyFilter) return false;
      if (typeFilter !== "ALL" && c.commissionType !== typeFilter) return false;
      
      if (statusFilter === "PENDING") {
        if (c.status === "COLLECTED" || c.status === "FULLY_COLLECTED" || c.status === "CANCELLED" || c.status === "REVERSED") return false;
      } else if (statusFilter === "COLLECTED") {
        if (c.status !== "COLLECTED" && c.status !== "FULLY_COLLECTED") return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const lease = leases.find(l => l.id === c.leaseId);
        return (
          c.businessKey.toLowerCase().includes(q) ||
          (lease?.leaseNumber || "").toLowerCase().includes(q) ||
          (c.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [commissions, partyFilter, typeFilter, statusFilter, searchQuery, leases]);

  const metrics = useMemo(() => {
    let pendingCount = 0;
    let pendingAmount = 0;
    let collectedToday = 0;
    const today = new Date().toISOString().split("T")[0];

    filteredRevenue.forEach(c => {
      if (c.status === "PENDING" || c.status === "PARTIALLY_COLLECTED") {
        pendingCount++;
        pendingAmount += c.outstandingBalance;
      }
      // Assuming collectionDate exists for collected items
      if (c.collectionDate === today) {
        collectedToday += c.collectedAmount;
      }
    });

    return { pendingCount, pendingAmount, collectedToday };
  }, [filteredRevenue]);

  const handleAddRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setIsSubmitting(true);

    const lease = leases.find(l => l.id === modalLeaseId);
    if (!lease) {
      setModalError(isAr ? "يرجى تحديد عقد الإيجار" : "Please select a lease");
      setIsSubmitting(false);
      return;
    }

    if (modalAmount <= 0) {
      setModalError(isAr ? "المبلغ يجب أن يكون أكبر من الصفر" : "Amount must be positive");
      setIsSubmitting(false);
      return;
    }

    // Determine calculation parameters based on Phase 53 rules
    const partyId = modalPartyType === "OWNER" ? lease.ownerId : lease.tenantId;
    
    // For Phase 53, if it's ADMIN_FEE, it's 5% inclusive. 
    // If it's a fixed penalty, we use the amount as base.
    const isPercentage = modalType === "ADMIN_FEE";
    
    const calc = calculateCommissionAmount(
      isPercentage ? lease.annualRent : modalAmount * (100 / 5), // hack to reuse 5% calc if we want to reverse-derive from fixed? 
      // Actually, better to use the specific logic for fixed amounts
      modalPartyType,
      isPercentage ? 5 : 5, // Default 5%
      DEFAULT_COMMISSION_SETTINGS,
      modalType,
      modalDueDate,
      vatRates,
      owners,
      tenants,
      partyId,
      lease.adminFeePolicy,
      modalType === "ADMIN_FEE" // Force inclusive for admin fee
    );

    // If it's not percentage, override with manual amount
    const finalTotal = isPercentage ? calc.amount : modalAmount;
    let finalVat = 0;
    let finalNet = finalTotal;

    if (modalType === "ADMIN_FEE") {
        finalVat = calc.vatAmount;
        finalNet = calc.netRevenue;
    }

    const res = addCommissionObligation({
      leaseId: lease.id,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      ownerId: lease.ownerId,
      tenantId: lease.tenantId,
      partyType: modalPartyType,
      commissionType: modalType,
      calculationBasis: isPercentage ? "PERCENTAGE_OF_RENT" : "FIXED_AMOUNT",
      baseAmount: isPercentage ? lease.annualRent : modalAmount,
      ratePercentage: isPercentage ? 5 : undefined,
      fixedAmount: isPercentage ? undefined : modalAmount,
      totalCommissionAmount: finalTotal,
      vatAmount: finalVat,
      vatRate: modalType === "ADMIN_FEE" ? calc.vatRate : 0,
      netRevenueAmount: finalNet,
      dueDate: modalDueDate,
      notes: modalNotes,
      isVatInclusive: modalType === "ADMIN_FEE",
      businessKeySequence: Date.now().toString(), // Unique sequence for this revenue item
    });

    if (res.success) {
      setIsAddModalOpen(false);
      setModalLeaseId("");
      setModalAmount(0);
      setModalNotes("");
    } else {
      setModalError(res.error || "Error");
    }
    setIsSubmitting(false);
  };

  const handleCollectRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setCollectError("");
    setIsCollecting(true);

    if (!selectedRevenue) return;
    if (collectAmount <= 0) {
      setCollectError(isAr ? "المبلغ غير صالح" : "Invalid amount");
      setIsCollecting(false);
      return;
    }

    const res = await collectAdministrativeFee(
      selectedRevenue.id,
      collectAmount,
      collectMethod,
      collectRef,
      collectNotes,
      crypto.randomUUID().split("-")[0]
    );

    if (res.success) {
      setIsCollectModalOpen(false);
      setSelectedRevenue(null);
    } else {
      setCollectError(res.error || "Error");
    }
    setIsCollecting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl">
                <BadgePercent className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {isAr ? "مركز الإيرادات اليومية" : "Daily Revenue Center"}
                </h2>
                <p className="text-xs text-slate-500">{isAr ? "إدارة الرسوم الإدارية، غرامات الشيكات، ورسوم الخدمات" : "Manage administrative fees, penalties, and service charges"}</p>
              </div>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? "تسجيل إيراد جديد" : "Record New Revenue"}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{isAr ? "إيرادات قيد التحصيل" : "Pending Revenue"}</span>
              <div className="text-lg font-black text-amber-600 font-mono">AED {metrics.pendingAmount.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">{metrics.pendingCount} {isAr ? "مطالبة" : "claims"}</div>
            </div>
            <div className="space-y-1 border-x border-slate-100 dark:border-slate-700 px-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{isAr ? "محصل اليوم" : "Collected Today"}</span>
              <div className="text-lg font-black text-emerald-600 font-mono">AED {metrics.collectedToday.toLocaleString()}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{isAr ? "إجمالي السجلات" : "Total Records"}</span>
              <div className="text-lg font-black text-slate-900 dark:text-white font-mono">{filteredRevenue.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "بحث بالرقم المرجعي، العقد، أو الملاحظات..." : "Search by ref, lease, or notes..."}
            className="w-full pr-9 pl-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
        >
          <option value="ALL">{isAr ? "جميع الأنواع" : "All Types"}</option>
          {revenueTypes.map(t => (
            <option key={t.value} value={t.value}>{isAr ? t.labelAr : t.labelEn}</option>
          ))}
        </select>
        <select
          value={partyFilter}
          onChange={(e) => setPartyFilter(e.target.value as any)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
        >
          <option value="ALL">{isAr ? "جميع الأطراف" : "All Parties"}</option>
          <option value="TENANT">{isAr ? "المستأجرين" : "Tenants"}</option>
          <option value="OWNER">{isAr ? "الملاك" : "Owners"}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
        >
          <option value="ALL">{isAr ? "جميع الحالات" : "All Status"}</option>
          <option value="PENDING">{isAr ? "قيد الانتظار" : "Pending"}</option>
          <option value="COLLECTED">{isAr ? "تم التحصيل" : "Collected"}</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-tighter text-slate-500 border-b border-slate-100 dark:border-slate-700">
                <th className="py-4 px-4">{isAr ? "المرجع والتاريخ" : "Ref & Date"}</th>
                <th className="py-4 px-4">{isAr ? "النوع والجهة" : "Type & Party"}</th>
                <th className="py-4 px-4 text-left">{isAr ? "المبلغ الإجمالي" : "Gross Amount"}</th>
                <th className="py-4 px-4 text-left">{isAr ? "الضريبة" : "VAT (5%)"}</th>
                <th className="py-4 px-4 text-left">{isAr ? "صافي الإيراد" : "Net Revenue"}</th>
                <th className="py-4 px-4">{isAr ? "الحالة" : "Status"}</th>
                <th className="py-4 px-4 text-center">{isAr ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700 text-xs">
              {filteredRevenue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold italic">
                    {isAr ? "لا توجد سجلات إيرادات مطابقة." : "No matching revenue records."}
                  </td>
                </tr>
              ) : (
                filteredRevenue.map((rev) => {
                  const lease = leases.find(l => l.id === rev.leaseId);
                  const party = rev.partyType === "OWNER" 
                    ? owners.find(o => o.id === rev.ownerId)
                    : tenants.find(t => t.id === rev.tenantId);
                  
                  const typeLabel = revenueTypes.find(t => t.value === rev.commissionType);

                  return (
                    <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                      <td className="py-4 px-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white uppercase">{rev.businessKey.split(':').pop()}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {rev.dueDate}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{isAr ? typeLabel?.labelAr : typeLabel?.labelEn}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {party ? (isAr ? party.nameAr : party.nameEn) : "N/A"}
                          <span className="px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[9px] uppercase">
                            {rev.partyType === "OWNER" ? (isAr ? "مالك" : "Owner") : (isAr ? "مستأجر" : "Tenant")}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-left font-mono font-bold text-slate-900 dark:text-white">
                        {rev.totalCommissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-left font-mono text-slate-500">
                        {rev.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        <div className="text-[9px]">{rev.vatRate ? `${rev.vatRate}%` : "0%"}</div>
                      </td>
                      <td className="py-4 px-4 text-left font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {rev.netRevenueAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || rev.totalCommissionAmount.toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        {rev.status === "COLLECTED" || rev.status === "FULLY_COLLECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" />
                            {isAr ? "تم التحصيل" : "Collected"}
                          </span>
                        ) : rev.status === "REVERSED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                            <RotateCcw className="w-3 h-3" />
                            {isAr ? "ملغي" : "Reversed"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
                            <Clock className="w-3 h-3" />
                            {isAr ? "قيد الانتظار" : "Pending"}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {rev.status === "PENDING" || rev.status === "PARTIALLY_COLLECTED" ? (
                          <button
                            onClick={() => {
                              setSelectedRevenue(rev);
                              setCollectAmount(rev.outstandingBalance);
                              setIsCollectModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 transition shadow-sm"
                          >
                            {isAr ? "تحصيل الآن" : "Collect Now"}
                          </button>
                        ) : (
                          <div className="text-slate-300">
                             <Lock className="w-4 h-4 mx-auto" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                {isAr ? "تسجيل إيراد مكتبي جديد" : "Record New Office Revenue"}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                <RotateCcw className="w-5 h-5 text-slate-400 rotate-45" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold border border-rose-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddRevenue} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "نوع الإيراد *" : "Revenue Type *"}</label>
                  <select
                    value={modalType}
                    onChange={(e) => setModalType(e.target.value as CommissionType)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  >
                    {revenueTypes.map(t => (
                      <option key={t.value} value={t.value}>{isAr ? t.labelAr : t.labelEn}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "الطرف المستحق عليه *" : "Responsible Party *"}</label>
                  <select
                    value={modalPartyType}
                    onChange={(e) => setModalPartyType(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  >
                    <option value="TENANT">{isAr ? "المستأجر" : "Tenant"}</option>
                    <option value="OWNER">{isAr ? "المالك" : "Owner"}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "عقد الإيجار المرتبط *" : "Linked Lease *"}</label>
                <SearchableSelect
                  options={leases.map(l => {
                    const owner = owners.find(o => o.id === l.ownerId);
                    const tenant = tenants.find(t => t.id === l.tenantId);
                    const property = properties.find(p => p.id === l.propertyId);
                    return {
                      id: l.id,
                      label: l.leaseNumber,
                      subLabel: isAr 
                        ? `المالك: ${owner?.nameAr || "غير معروف"} | المستأجر: ${tenant?.nameAr || "غير معروف"} | عقار: ${property?.nameAr || ""}`
                        : `Owner: ${owner?.nameEn || "Unknown"} | Tenant: ${tenant?.nameEn || "Unknown"} | Prop: ${property?.nameEn || ""}`
                    };
                  })}
                  value={modalLeaseId}
                  onChange={setModalLeaseId}
                  placeholder={isAr ? "اختر العقد أو المالك أو المستأجر..." : "Select lease, owner or tenant..."}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "المبلغ (درهم) *" : "Amount (AED) *"}</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.01"
                      value={modalAmount}
                      onChange={(e) => setModalAmount(parseFloat(e.target.value) || 0)}
                      disabled={modalType === "ADMIN_FEE"}
                      className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition ${modalType === "ADMIN_FEE" ? "opacity-50" : ""}`}
                      placeholder="0.00"
                    />
                  </div>
                  {modalType === "ADMIN_FEE" && (
                    <p className="text-[10px] text-amber-600 font-bold">{isAr ? "* تحسب تلقائياً بنسبة 5% من الإيجار وشاملة للضريبة" : "* Auto-calculated at 5% of rent, VAT inclusive"}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "تاريخ الاستحقاق *" : "Due Date *"}</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={modalDueDate}
                      onChange={(e) => setModalDueDate(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "ملاحظات إضافية" : "Additional Notes"}</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  placeholder={isAr ? "اكتب أي تفاصيل إضافية هنا..." : "Enter any extra details..."}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ المطالبة" : "Save Claim")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {isCollectModalOpen && selectedRevenue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                {isAr ? "تحصيل إيراد مكتبي" : "Collect Office Revenue"}
              </h3>
              <button onClick={() => setIsCollectModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                <RotateCcw className="w-5 h-5 text-slate-400 rotate-45" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{isAr ? "المبلغ المستحق:" : "Outstanding:"}</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">AED {selectedRevenue.outstandingBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{isAr ? "الجهة المسؤولة:" : "Party:"}</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedRevenue.partyType === "OWNER" ? (isAr ? "المالك" : "Owner") : (isAr ? "المستأجر" : "Tenant")}</span>
              </div>
            </div>

            {collectError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold border border-rose-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {collectError}
              </div>
            )}

            <form onSubmit={handleCollectRevenue} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "مبلغ التحصيل (درهم) *" : "Collection Amount (AED) *"}</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "طريقة الدفع *" : "Payment Method *"}</label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value as PaymentMethod)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition"
                >
                  <option value="BANK_TRANSFER">{isAr ? "تحويل بنكي" : "Bank Transfer"}</option>
                  <option value="CASH">{isAr ? "نقدي (عبر الإيداعات اليومية)" : "Cash (Via Daily Deposits)"}</option>
                  <option value="CHEQUE">{isAr ? "شيك" : "Cheque"}</option>
                  <option value="CREDIT_CARD">{isAr ? "بطاقة ائتمان" : "Credit Card"}</option>
                </select>
              </div>

              {collectMethod === "CASH" && (
                <div className="p-3 bg-amber-50 text-amber-900 text-[11px] rounded-xl border border-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {isAr ? "تنبيه الرقابة المالية:" : "Financial Control Notice:"}
                    </span>
                    <span>
                      {isAr
                        ? "يتم إيداع الرسوم الإدارية النقدية والمطابقة البنكية لها من خلال شاشة الإيداعات اليومية."
                        : "Cash admin fees must be settled and banked via Daily Deposits."}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase">{isAr ? "المرجع / رقم الإيصال" : "Ref / Receipt #"}</label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={collectRef}
                    onChange={(e) => setCollectRef(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    placeholder="Ref..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isCollecting}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isCollecting ? (isAr ? "جاري التحصيل..." : "Collecting...") : (isAr ? "إتمام التحصيل" : "Complete Collection")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
