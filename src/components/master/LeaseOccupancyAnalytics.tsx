import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Percent,
  FileText,
  DollarSign,
  ArrowUpRight,
  Home,
  Building2,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Layers,
  KeyRound,
} from "lucide-react";
import { Lease, Tenant, Unit, Property, Cheque, CollectionRecord } from "../../types";
import { useLanguage } from "../../context/LanguageContext";

interface LeaseOccupancyAnalyticsProps {
  lease: Lease;
  tenant?: Tenant | null;
  unit?: Unit | null;
  property?: Property | null;
  allLeases?: Lease[];
  allTenants?: Tenant[];
  cheques?: Cheque[];
  collections?: CollectionRecord[];
  onNavigateToTenant?: (tenantId: string) => void;
  onNavigateToUnit?: (unitId: string) => void;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  COLLECTED: "#10B981", // Emerald
  CLEARED: "#10B981",
  PENDING: "#3B82F6", // Blue
  UNDER_COLLECTION: "#3B82F6",
  BOUNCED: "#EF4444", // Rose
  RETURNED: "#EF4444",
  REPLACED: "#F59E0B", // Amber
  CANCELLED: "#64748B", // Slate
};

export const LeaseOccupancyAnalytics: React.FC<LeaseOccupancyAnalyticsProps> = ({
  lease,
  tenant,
  unit,
  property,
  allLeases = [],
  allTenants = [],
  cheques = [],
  collections = [],
  onNavigateToTenant,
  onNavigateToUnit,
  className = "",
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [activeMetric, setActiveMetric] = useState<"occupancy" | "rent" | "payments">("occupancy");

  // Historical leases for this specific unit
  const unitHistoricalLeases = useMemo(() => {
    if (!lease.unitId) return [lease];
    return allLeases
      .filter((l) => l.unitId === lease.unitId)
      .sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
  }, [allLeases, lease.unitId, lease]);

  // Historical leases for this tenant across the company
  const tenantHistoricalLeases = useMemo(() => {
    if (!lease.tenantId) return [lease];
    return allLeases
      .filter((l) => l.tenantId === lease.tenantId)
      .sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
  }, [allLeases, lease.tenantId, lease]);

  // Linked cheques for this lease
  const leaseCheques = useMemo(() => {
    return cheques.filter((c) => c.leaseId === lease.id);
  }, [cheques, lease.id]);

  // Calculation of Contract Timeline & Days Progress
  const timelineStats = useMemo(() => {
    const start = new Date(lease.startDate || "2025-01-01").getTime();
    const end = new Date(lease.endDate || "2026-01-01").getTime();
    const now = new Date().getTime();

    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((now - start) / (1000 * 60 * 60 * 24))));
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const progressPercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    // Multi-Year Historical Occupancy for this specific unit
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];

    const historicalUnitTimeline = years.map((year) => {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year, 11, 31).getTime();
      const daysInYear = 365;

      let occupiedDays = 0;
      let yearRent = 0;

      unitHistoricalLeases.forEach((l) => {
        const lStart = new Date(l.startDate || "2024-01-01").getTime();
        const lEnd = new Date(l.endDate || l.startDate || "2024-01-01").getTime();

        const overlapStart = Math.max(yearStart, lStart);
        const overlapEnd = Math.min(yearEnd, lEnd);

        if (overlapEnd >= overlapStart) {
          const days = Math.floor((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
          occupiedDays += days;
          yearRent += Math.round((Number(l.annualRent || 0) / 365) * days);
        }
      });

      const occupancyRate = Math.min(100, Math.round((occupiedDays / daysInYear) * 100));
      const vacancyRate = 100 - occupancyRate;

      return {
        year: year.toString(),
        occupancyRate,
        vacancyRate,
        revenue: yearRent,
      };
    });

    // Rent Evolution across historical tenants for this unit
    const unitRentEvolution = unitHistoricalLeases.map((l, index) => {
      const t = allTenants.find((item) => item.id === l.tenantId);
      const isCurrent = l.id === lease.id;
      return {
        leaseLabel: `L${index + 1} (${l.startDate?.slice(0, 4) || "---"})`,
        annualRent: Number(l.annualRent || 0),
        tenantName: t ? (isAr ? t.nameAr : t.nameEn) : isAr ? "مستأجر" : "Tenant",
        isCurrent,
      };
    });

    // Payment / Cheque breakdown
    const chequeStatusCounts: Record<string, number> = {};
    leaseCheques.forEach((c) => {
      const st = c.status || "PENDING";
      chequeStatusCounts[st] = (chequeStatusCounts[st] || 0) + 1;
    });

    const chequeDistribution = Object.keys(chequeStatusCounts).map((statusKey) => {
      const labelMapAr: Record<string, string> = {
        COLLECTED: "محصل",
        CLEARED: "مصروف بالبنك",
        PENDING: "مستحق لاحقاً",
        UNDER_COLLECTION: "قيد التحصيل",
        BOUNCED: "مرتجع",
        RETURNED: "مسترد",
        REPLACED: "مستبدل",
        CANCELLED: "ملغى",
      };
      const labelMapEn: Record<string, string> = {
        COLLECTED: "Collected",
        CLEARED: "Cleared",
        PENDING: "Pending",
        UNDER_COLLECTION: "In Clearing",
        BOUNCED: "Bounced",
        RETURNED: "Returned",
        REPLACED: "Replaced",
        CANCELLED: "Cancelled",
      };

      return {
        name: isAr ? labelMapAr[statusKey] || statusKey : labelMapEn[statusKey] || statusKey,
        rawStatus: statusKey,
        value: chequeStatusCounts[statusKey],
        color: STATUS_COLORS[statusKey] || "#64748B",
      };
    });

    return {
      totalDays,
      elapsedDays,
      remainingDays,
      progressPercent,
      historicalUnitTimeline,
      unitRentEvolution,
      chequeDistribution,
    };
  }, [lease, unitHistoricalLeases, allTenants, leaseCheques, isAr]);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-6 shadow-xs ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {isAr
                  ? `تحليلات توزيع المستأجرين والإشغال التاريخي للعقد (#${lease.leaseNumber || lease.id.slice(0, 8)})`
                  : `Lease Tenant Distribution & Historical Occupancy (#${lease.leaseNumber || lease.id.slice(0, 8)})`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? `الوحدة: ${unit?.unitNumber || "---"} | العقار: ${property ? (isAr ? property.nameAr : property.nameEn) : "---"} | المستأجر: ${tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "---"}`
                  : `Unit: ${unit?.unitNumber || "---"} | Property: ${property?.nameEn || property?.nameAr || "---"} | Tenant: ${tenant?.nameEn || tenant?.nameAr || "---"}`}
              </p>
            </div>
          </div>
        </div>

        {/* Metric View Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveMetric("occupancy")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMetric === "occupancy"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {isAr ? "الإشغال والمدة" : "Occupancy & Time"}
          </button>
          <button
            onClick={() => setActiveMetric("rent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMetric === "rent"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {isAr ? "تطور إيجار الوحدة" : "Unit Rent Trend"}
          </button>
          <button
            onClick={() => setActiveMetric("payments")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMetric === "payments"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {isAr ? "أداء الشيكات والتحصيل" : "Payment & Cheques"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "سريان مدة العقد" : "Contract Progress"}</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {timelineStats.progressPercent}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {timelineStats.elapsedDays} {isAr ? "يوم منقضي من" : "elapsed of"} {timelineStats.totalDays} {isAr ? "يوم" : "days"}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "الأيام المتبقية للعقد" : "Remaining Days"}</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {timelineStats.remainingDays} <span className="text-xs font-normal text-slate-400">{isAr ? "يوم" : "days"}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "تاريخ الانتهاء:" : "End Date:"} {lease.endDate}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "تاريخ عقود هذه الوحدة" : "Unit Leases History"}</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {unitHistoricalLeases.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "عقود مسجلة لنفس الوحدة" : "Leases on this unit"}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "عقود المستأجر بالشركة" : "Tenant Portfolio"}</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {tenantHistoricalLeases.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "عقود إجمالية لهذا المستأجر" : "Total leases for tenant"}
          </div>
        </div>
      </div>

      {/* Contract Duration Progress Bar */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isAr ? "مسار مدة العقد الحالية" : "Current Lease Duration Trajectory"}</span>
          </span>
          <span className="text-indigo-600 dark:text-indigo-400 font-mono">
            {timelineStats.elapsedDays} / {timelineStats.totalDays} {isAr ? "يوم" : "days"} ({timelineStats.progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${timelineStats.progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
          <span>{isAr ? "بدء العقد:" : "Start:"} {lease.startDate}</span>
          <span>{isAr ? "انتهاء العقد:" : "End:"} {lease.endDate}</span>
        </div>
      </div>

      {/* Interactive Charts Area */}
      <div className="pt-2">
        {/* 1. OCCUPANCY TIMELINE CHART */}
        {activeMetric === "occupancy" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr
                  ? `نسبة الإشغال والشغور التاريخية للوحدة (${unit?.unitNumber || "الوحدة"}) عبر السنوات (%)`
                  : `Historical Occupancy & Vacancy Ratios for Unit (${unit?.unitNumber || "Unit"}) (%)`}
              </span>
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  {isAr ? "نسبة الإشغال" : "Occupancy %"}
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                  {isAr ? "نسبة الشغور" : "Vacancy %"}
                </span>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineStats.historicalUnitTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415520" />
                  <XAxis dataKey="year" tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis unit="%" domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderRadius: "12px",
                      border: "none",
                      color: "#FFFFFF",
                      fontSize: "12px",
                    }}
                    formatter={(val: any, name: any) => [
                      `${val}%`,
                      name === "occupancyRate" ? (isAr ? "نسبة الإشغال" : "Occupancy Rate") : isAr ? "نسبة الشغور" : "Vacancy Rate",
                    ]}
                  />
                  <Bar dataKey="occupancyRate" name="occupancyRate" fill="#10B981" radius={[6, 6, 0, 0]} stackId="a" />
                  <Bar dataKey="vacancyRate" name="vacancyRate" fill="#94A3B8" radius={[6, 6, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 2. RENT EVOLUTION CHART */}
        {activeMetric === "rent" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr
                  ? `تطور القيمة الإيجارية السنوية للوحدة (${unit?.unitNumber || "الوحدة"}) عبر العقود المتعاقبة (AED)`
                  : `Unit Annual Rent Progression Across Sequential Leases (AED)`}
              </span>
              <span className="text-xs text-indigo-600 font-mono font-bold">
                {timelineStats.unitRentEvolution.length} {isAr ? "عقد مسجل" : "contracts"}
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full">
              {timelineStats.unitRentEvolution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineStats.unitRentEvolution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="leaseRentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415520" />
                    <XAxis dataKey="leaseLabel" tick={{ fill: "#64748B", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderRadius: "12px",
                        border: "none",
                        color: "#FFFFFF",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`${Number(val).toLocaleString()} AED`, isAr ? "الإيجار السنوي" : "Annual Rent"]}
                      labelFormatter={(label, payload) => {
                        const item = payload[0]?.payload;
                        return `${label} - ${item?.tenantName || ""}${item?.isCurrent ? (isAr ? " (العقد الحالي)" : " (Current)") : ""}`;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="annualRent"
                      stroke="#4F46E5"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#leaseRentGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  {isAr ? "لا توجد عقود مسجلة" : "No lease data available"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. CHEQUE & PAYMENT SETTLEMENT DISTRIBUTION */}
        {activeMetric === "payments" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? "توزيع حالات شيكات ودفعات هذا العقد" : "Lease Cheques Settlement Distribution"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="h-64 w-full">
                {timelineStats.chequeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={timelineStats.chequeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {timelineStats.chequeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderRadius: "12px",
                          border: "none",
                          color: "#FFFFFF",
                          fontSize: "12px",
                        }}
                        formatter={(val: any, name: any) => [`${val} ${isAr ? "شيك" : "cheques"}`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    {isAr ? "لا توجد شيكات مرتبطة بهذا العقد" : "No linked cheques"}
                  </div>
                )}
              </div>

              {/* Status Breakdown Legend List */}
              <div className="space-y-2 text-xs">
                {timelineStats.chequeDistribution.map((item) => (
                  <div
                    key={item.rawStatus}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                    </div>
                    <div className="font-mono font-black text-slate-900 dark:text-white">
                      {item.value} {isAr ? "شيك" : "cheques"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
