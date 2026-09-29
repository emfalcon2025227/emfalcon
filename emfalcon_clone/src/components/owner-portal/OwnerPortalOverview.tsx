import React, { useMemo } from "react";
import {
  Building2,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileText,
  ShieldCheck,
  Percent,
  Calendar,
  Layers,
  Users,
  Wallet,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Owner, Property, Unit, Lease, Cheque } from "../../types";
import { computeOwnerPayableDetails } from "../../services/financialEngine";

interface OwnerPortalOverviewProps {
  owner: Owner;
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  cheques: Cheque[];
  onNavigateTab: (tab: "PROPERTIES" | "STATEMENT" | "CHEQUES" | "MAINTENANCE" | "COMMUNICATIONS") => void;
}

export const OwnerPortalOverview: React.FC<OwnerPortalOverviewProps> = ({
  owner,
  properties = [],
  units = [],
  leases = [],
  cheques = [],
  onNavigateTab,
}) => {
  const { language, formatAED, dir } = useLanguage();
  const {
    collections,
    commissionObligations,
    propertyExpenses,
    ownerTransfers,
    financialAdjustments,
    financialReversals,
    maintenanceRequests,
  } = useData();

  // Authoritative financial calculations derived strictly from financialEngine
  const payableDetails = useMemo(() => {
    return computeOwnerPayableDetails(owner.id, {
      collections,
      commissions: commissionObligations,
      expenses: propertyExpenses,
      transfers: ownerTransfers,
      adjustments: financialAdjustments,
      reversals: financialReversals,
    });
  }, [
    owner.id,
    collections,
    commissionObligations,
    propertyExpenses,
    ownerTransfers,
    financialAdjustments,
    financialReversals,
  ]);

  // Unit occupancy analytics
  const unitStats = useMemo(() => {
    if (!units) return { total: 0, occupied: 0, vacant: 0, maintenance: 0, occupancyRate: 0 };
    const total = units.length;
    const occupied = units.filter((u) => u.status === "OCCUPIED").length;
    const vacant = units.filter((u) => u.status === "VACANT").length;
    const maintenance = units.filter((u) => u.status === "MAINTENANCE").length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, vacant, maintenance, occupancyRate };
  }, [units]);

  // Total annualized contract value
  const totalAnnualRent = useMemo(() => {
    if (!leases) return 0;
    return leases
      .filter((l) => l.contractStatus === "ACTIVE")
      .reduce((sum, l) => sum + (l.annualRent || 0), 0);
  }, [leases]);

  // Cheque breakdown
  const chequeStats = useMemo(() => {
    if (!cheques) return { totalCount: 0, collectedCount: 0, collectedAmt: 0, pendingCount: 0, pendingAmt: 0, depositedCount: 0, bouncedCount: 0, bouncedAmt: 0 };
    const totalCount = cheques.length;
    const collected = cheques.filter((c) => c.status === "COLLECTED" || c.status === "CLEARED");
    const pending = cheques.filter((c) => c.status === "POST_DATED" || (c.status as string) === "PENDING");
    const deposited = cheques.filter((c) => c.status === "DEPOSITED");
    const bounced = cheques.filter((c) => c.status === "BOUNCED");

    const totalCollectedAmt = collected.reduce((s, c) => s + (c.amount || 0), 0);
    const totalPendingAmt = pending.reduce((s, c) => s + (c.amount || 0), 0);
    const totalBouncedAmt = bounced.reduce((s, c) => s + (c.amount || 0), 0);

    return {
      totalCount,
      collectedCount: collected.length,
      collectedAmt: totalCollectedAmt,
      pendingCount: pending.length,
      pendingAmt: totalPendingAmt,
      depositedCount: deposited.length,
      bouncedCount: bounced.length,
      bouncedAmt: totalBouncedAmt,
    };
  }, [cheques]);

  // Pending maintenance count
  const activeMaintenanceCount = useMemo(() => {
    if (!maintenanceRequests || !units) return 0;
    const unitIds = new Set(units.map((u) => u.id));
    return maintenanceRequests.filter(
      (m) => unitIds.has(m.unitId) && m.status !== "COMPLETED" && m.status !== "CANCELLED" && m.status !== "REJECTED"
    ).length;
  }, [units, maintenanceRequests]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Available Balance Card */}
        <div className="lg:col-span-1 bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 end-0 -mt-6 -me-6 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
                {language === "ar" ? "صافي المستحق للمالك (جاهز للصرف)" : "Net Payable Balance"}
              </span>
              <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
                <Wallet className="w-5 h-5 text-amber-200" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tight mb-1">
              {formatAED(payableDetails.currentPayableBalance)}
            </div>
            <p className="text-xs text-amber-100/90 leading-relaxed">
              {language === "ar"
                ? "الرصيد الصافي المتاح للتحويل بعد خصم الرسوم والمصروفات"
                : "Net available funds ready for bank transfer"}
            </p>
          </div>

          <div className="pt-5 mt-5 border-t border-white/15 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-amber-200/80 font-medium text-[11px]">
                {language === "ar" ? "إجمالي المحول سابقاً" : "Total Transferred"}
              </div>
              <div className="font-bold text-sm text-white mt-0.5">
                {formatAED(payableDetails.totalTransfersPaid)}
              </div>
            </div>
            <div>
              <div className="text-amber-200/80 font-medium text-[11px]">
                {language === "ar" ? "تحويلات قيد الاعتماد" : "Pending Payouts"}
              </div>
              <div className="font-bold text-sm text-amber-300 mt-0.5">
                {formatAED(payableDetails.totalTransfersPending)}
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown of Collected & Deductions */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Collections */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">
                  {language === "ar" ? "إجمالي الإيجارات المحصلة" : "Gross Rent Collected"}
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatAED(payableDetails.totalRentCollected)}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{language === "ar" ? "إجمالي القيمة التعاقدية" : "Annual Leased Value"}</span>
              <span className="font-bold text-slate-700">{formatAED(totalAnnualRent)}</span>
            </div>
          </div>

          {/* Management Fees / Commissions */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">
                  {language === "ar" ? "أتعاب الإدارة والعمولات" : "Management Commissions"}
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatAED(payableDetails.totalOwnerCommissions)}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{language === "ar" ? "النسبة المعمول بها" : "Default Rate"}</span>
              <span className="font-bold text-indigo-700">5.0% + VAT</span>
            </div>
          </div>

          {/* Property Expenses */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">
                  {language === "ar" ? "مصروفات العقارات المستقطعة" : "Owner-Borne Expenses"}
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatAED(payableDetails.totalOwnerExpenses)}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{language === "ar" ? "تعديلات محاسبية" : "Adjustments"}</span>
              <span className="font-bold text-slate-700">{formatAED(payableDetails.totalAdjustments)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Operational Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">
                {language === "ar" ? "العقارات المملوكة" : "Properties Owned"}
              </div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {properties.length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-slate-500 font-medium">
                {language === "ar" ? "نسبة الإشغال" : "Occupancy Rate"}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-lg font-black text-slate-900">{unitStats.occupancyRate}%</span>
                <span className="text-[11px] text-slate-500 font-bold">
                  {unitStats.occupied} / {unitStats.total}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">
                {language === "ar" ? "الشيكات المحصلة" : "Cleared Cheques"}
              </div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {chequeStats.collectedCount} / {chequeStats.totalCount}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${chequeStats.bouncedCount > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">
                {language === "ar" ? "شيكات مرتجعة" : "Bounced Cheques"}
              </div>
              <div className={`text-lg font-black mt-0.5 ${chequeStats.bouncedCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
                {chequeStats.bouncedCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cheques Cash Flow Register Preview & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cheque Health Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar" ? "محفظة الشيكات والتدفقات النقدية" : "Cheque Portfolio & Cash Flow"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "ar" ? "حالة تحصيل الشيكات الإيجارية لعقاراتك" : "Status of rent cheques for your portfolio"}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab("CHEQUES")}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
            >
              {language === "ar" ? "عرض سجل الشيكات كاملًا ←" : "View Full Cheque Register →"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{language === "ar" ? "شيكات محصلة" : "Cleared"}</span>
              </div>
              <div className="text-base font-black text-emerald-950">
                {formatAED(chequeStats.collectedAmt)}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1">
                {chequeStats.collectedCount} {language === "ar" ? "شيك" : "cheques"}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold mb-1">
                <Clock className="w-4 h-4" />
                <span>{language === "ar" ? "شيكات قيد الاستحقاق (PDC)" : "Pending / PDCs"}</span>
              </div>
              <div className="text-base font-black text-amber-950">
                {formatAED(chequeStats.pendingAmt)}
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-1">
                {chequeStats.pendingCount} {language === "ar" ? "شيك" : "cheques"}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-bold mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>{language === "ar" ? "شيكات مرتجعة" : "Bounced"}</span>
              </div>
              <div className="text-base font-black text-rose-950">
                {formatAED(chequeStats.bouncedAmt)}
              </div>
              <div className="text-[11px] text-rose-700 font-medium mt-1">
                {chequeStats.bouncedCount} {language === "ar" ? "شيك قيد المتابعة القانونية" : "under legal follow-up"}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions & Statement shortcut */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 mb-1">
              {language === "ar" ? "الخدمات والتقارير السريعة" : "Quick Actions & Statements"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {language === "ar" ? "استخراج كشوفات الحساب والتواصل مع الإدارة" : "Generate statements & contact management"}
            </p>

            <div className="space-y-2">
              <button
                onClick={() => onNavigateTab("STATEMENT")}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-amber-50/80 border border-slate-200 text-xs font-bold text-slate-800 hover:text-amber-900 transition-colors cursor-pointer text-start"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span>{language === "ar" ? "كشف حساب المالك المعتمد (PDF/Excel)" : "Certified Owner Statement"}</span>
                </div>
                <span className="text-slate-400">→</span>
              </button>

              <button
                onClick={() => onNavigateTab("PROPERTIES")}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-amber-50/80 border border-slate-200 text-xs font-bold text-slate-800 hover:text-amber-900 transition-colors cursor-pointer text-start"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <span>{language === "ar" ? "مراجعة الوحدات وعقود الإيجار النشطة" : "Review Units & Active Leases"}</span>
                </div>
                <span className="text-slate-400">→</span>
              </button>

              <button
                onClick={() => onNavigateTab("COMMUNICATIONS")}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-amber-50/80 border border-slate-200 text-xs font-bold text-slate-800 hover:text-amber-900 transition-colors cursor-pointer text-start"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-amber-700" />
                  <span>{language === "ar" ? "إرسال استفسار أو إشعار للإدارة" : "Send Management Inquiry"}</span>
                </div>
                <span className="text-slate-400">→</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {language === "ar" ? "حساب موثق لدى صقر الإمارات" : "Emirates Falcon Certified Account"}
            </span>
            <span className="font-mono text-[10px] text-slate-400">{owner.code}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
