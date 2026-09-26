import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Percent,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Users,
} from "lucide-react";
import { Unit, Lease, Tenant, Cheque, CollectionRecord } from "../../types";
import { useLanguage } from "../../context/LanguageContext";

interface UnitOccupancyAnalyticsProps {
  unit: Unit;
  leases: Lease[];
  tenants: Tenant[];
  cheques?: Cheque[];
  collections?: CollectionRecord[];
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10B981", // Emerald
  EXPIRED: "#64748B", // Slate
  UNDER_RENEWAL: "#3B82F6", // Blue
  TERMINATED: "#EF4444", // Rose
  DRAFT: "#F59E0B", // Amber
  PENDING_SIGNATURE: "#8B5CF6", // Purple
};

export const UnitOccupancyAnalytics: React.FC<UnitOccupancyAnalyticsProps> = ({
  unit,
  leases,
  tenants,
  cheques = [],
  collections = [],
  className = "",
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [timeframe, setTimeframe] = useState<"all" | "3y" | "1y">("all");
  const [activeMetric, setActiveMetric] = useState<"occupancy" | "rent" | "status">("occupancy");

  // Filter unit's historical leases (strictly for this unit, chronological)
  const unitLeases = useMemo(() => {
    return leases
      .filter((l) => l.unitId === unit.id)
      .sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
  }, [leases, unit.id]);

  // Overall Statistics & Lifetime Metrics
  const stats = useMemo(() => {
    if (unitLeases.length === 0) {
      return {
        totalLeases: 0,
        lifetimeRevenue: 0,
        occupancyRate: 0,
        vacancyRate: 100,
        totalOccupiedDays: 0,
        totalVacantDays: 0,
        avgLeaseDurationDays: 0,
        activeTenantsCount: 0,
        rentGrowthRate: 0,
        historicalTimeline: [],
        statusDistribution: [],
        rentEvolution: [],
      };
    }

    const now = new Date();
    const firstStartDate = new Date(unitLeases[0].startDate || "2024-01-01");
    const totalDaysSpan = Math.max(
      30,
      Math.floor((now.getTime() - firstStartDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    let totalOccupiedDays = 0;
    let lifetimeRevenue = 0;
    const uniqueTenants = new Set<string>();

    unitLeases.forEach((l) => {
      const s = new Date(l.startDate || "2024-01-01");
      const e = new Date(l.endDate || l.startDate || "2024-01-01");
      const endCapped = e > now ? now : e;
      const days = Math.max(0, Math.floor((endCapped.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
      totalOccupiedDays += days;
      lifetimeRevenue += Number(l.annualRent || 0);
      if (l.tenantId) uniqueTenants.add(l.tenantId);
    });

    const occupancyRate = Math.min(100, Math.max(0, Math.round((totalOccupiedDays / totalDaysSpan) * 100)));
    const vacancyRate = 100 - occupancyRate;
    const totalVacantDays = Math.max(0, totalDaysSpan - totalOccupiedDays);
    const avgLeaseDurationDays = Math.round(totalOccupiedDays / Math.max(1, unitLeases.length));

    // Rent Growth calculation between first and last lease
    let rentGrowthRate = 0;
    if (unitLeases.length >= 2) {
      const firstRent = Number(unitLeases[0].annualRent || 0);
      const lastRent = Number(unitLeases[unitLeases.length - 1].annualRent || 0);
      if (firstRent > 0) {
        rentGrowthRate = Math.round(((lastRent - firstRent) / firstRent) * 100);
      }
    }

    // Status Distribution
    const statusCounts: Record<string, number> = {};
    unitLeases.forEach((l) => {
      const st = l.contractStatus || "EXPIRED";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const statusDistribution = Object.keys(statusCounts).map((statusKey) => {
      const labelMapAr: Record<string, string> = {
        ACTIVE: "نشط وساري",
        EXPIRED: "منتهي",
        UNDER_RENEWAL: "قيد التجديد",
        TERMINATED: "مفسوخ / قضائي",
        DRAFT: "مسودة",
        PENDING_SIGNATURE: "بانتظار التوقيع",
      };
      const labelMapEn: Record<string, string> = {
        ACTIVE: "Active",
        EXPIRED: "Expired",
        UNDER_RENEWAL: "Under Renewal",
        TERMINATED: "Terminated",
        DRAFT: "Draft",
        PENDING_SIGNATURE: "Pending",
      };

      return {
        name: isAr ? labelMapAr[statusKey] || statusKey : labelMapEn[statusKey] || statusKey,
        rawStatus: statusKey,
        value: statusCounts[statusKey],
        color: STATUS_COLORS[statusKey] || "#64748B",
      };
    });

    // Rent Evolution across sequential leases
    const rentEvolution = unitLeases.map((l, index) => {
      const tenant = tenants.find((t) => t.id === l.tenantId);
      const startYear = l.startDate ? new Date(l.startDate).getFullYear() : 2024 + index;
      return {
        leaseLabel: `L${index + 1} (${startYear})`,
        annualRent: Number(l.annualRent || 0),
        tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : isAr ? "غير محدد" : "N/A",
        status: l.contractStatus,
        startDate: l.startDate,
        endDate: l.endDate,
      };
    });

    // Multi-Year Occupancy Breakdown (Grouped by Year)
    const currentYear = now.getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];
    const historicalTimeline = years.map((year) => {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year, 11, 31).getTime();
      const yearDays = 365;

      let occupiedDaysInYear = 0;
      let revenueInYear = 0;

      unitLeases.forEach((l) => {
        const lStart = new Date(l.startDate || "2024-01-01").getTime();
        const lEnd = new Date(l.endDate || l.startDate || "2024-01-01").getTime();

        const overlapStart = Math.max(yearStart, lStart);
        const overlapEnd = Math.min(yearEnd, lEnd);

        if (overlapEnd >= overlapStart) {
          const days = Math.floor((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
          occupiedDaysInYear += days;
          revenueInYear += Math.round((Number(l.annualRent || 0) / 365) * days);
        }
      });

      const yearOccupancyPct = Math.min(100, Math.round((occupiedDaysInYear / yearDays) * 100));
      const yearVacancyPct = 100 - yearOccupancyPct;

      return {
        year: year.toString(),
        occupancyRate: yearOccupancyPct,
        vacancyRate: yearVacancyPct,
        occupiedDays: occupiedDaysInYear,
        vacantDays: Math.max(0, yearDays - occupiedDaysInYear),
        revenue: revenueInYear,
      };
    });

    return {
      totalLeases: unitLeases.length,
      lifetimeRevenue,
      occupancyRate,
      vacancyRate,
      totalOccupiedDays,
      totalVacantDays,
      avgLeaseDurationDays,
      activeTenantsCount: uniqueTenants.size,
      rentGrowthRate,
      historicalTimeline,
      statusDistribution,
      rentEvolution,
    };
  }, [unitLeases, tenants, isAr]);

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
                {isAr ? `تحليلات الإشغال والعقود التاريخية (الوحدة ${unit.unitNumber})` : `Occupancy & Historical Lease Analytics (Unit #${unit.unitNumber})`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? "مؤشرات أداء الإشغال الزمني، نمو القيمة الإيجارية، وتوزيع الدورات التأجيرية للوحدة"
                  : "Time-series occupancy metrics, rental value growth, and tenancy cycle distributions"}
              </p>
            </div>
          </div>
        </div>

        {/* View Selection Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveMetric("occupancy")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMetric === "occupancy"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {isAr ? "نسب الإشغال السنوية" : "Occupancy Rates"}
          </button>
          <button
            onClick={() => setActiveMetric("rent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMetric === "rent"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {isAr ? "تطور الإيجار" : "Rent Evolution"}
          </button>
          <button
            onClick={() => setActiveMetric("status")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMetric === "status"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {isAr ? "توزيع العقود" : "Contract Types"}
          </button>
        </div>
      </div>

      {/* Primary KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Lifetime Occupancy Rate */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "معدل الإشغال التاريخي" : "Lifetime Occupancy"}</span>
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.occupancyRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.totalOccupiedDays} {isAr ? "يوم إشغال فعلي" : "occupied days"}
          </div>
        </div>

        {/* Total Tenancy Cycles */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "إجمالي العقود والمستأجرين" : "Contracts & Tenants"}</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalLeases}{" "}
            <span className="text-xs font-bold text-slate-400">
              ({stats.activeTenantsCount} {isAr ? "مستأجرين" : "tenants"})
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "متوسط مدة العقد:" : "Avg lease length:"} {stats.avgLeaseDurationDays} {isAr ? "يوم" : "days"}
          </div>
        </div>

        {/* Total Generated Revenue */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "إجمالي الدخل التاريخي" : "Lifetime Revenue"}</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.lifetimeRevenue.toLocaleString()}{" "}
            <span className="text-xs font-normal text-slate-400">AED</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "عبر كافة الدورات التعاقدية" : "Across all tenancy contracts"}
          </div>
        </div>

        {/* Rent Growth / Current Rent */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "نمو القيمة الإيجارية" : "Rent Growth"}</span>
            <ArrowUpRight className="w-4 h-4 text-blue-600" />
          </div>
          <div className={`text-2xl font-black mt-1 ${stats.rentGrowthRate >= 0 ? "text-blue-600" : "text-rose-600"}`}>
            {stats.rentGrowthRate >= 0 ? `+${stats.rentGrowthRate}%` : `${stats.rentGrowthRate}%`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "الحالي:" : "Current:"} {(unit.annualRent || 0).toLocaleString()} AED/سنة
          </div>
        </div>
      </div>

      {/* Interactive Charts Area */}
      <div className="pt-2">
        {/* 1. OCCUPANCY TIMELINE CHART */}
        {activeMetric === "occupancy" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? "نسبة الإشغال مقابل الشغور السنوية للوحدة (%)" : "Yearly Occupancy vs. Vacancy Ratio (%)"}
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
                <BarChart data={stats.historicalTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                {isAr ? "تطور القيمة الإيجارية السنوية عبر العقود (AED)" : "Annual Rent Progression Across Leases (AED)"}
              </span>
              <span className="text-xs text-indigo-600 font-mono font-bold">
                {unitLeases.length} {isAr ? "عقود مسجلة" : "contracts"}
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full">
              {stats.rentEvolution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.rentEvolution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415520" />
                    <XAxis dataKey="leaseLabel" tick={{ fill: "#64748B", fontSize: 12 }} />
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
                        return `${label} - ${item?.tenantName || ""}`;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="annualRent"
                      stroke="#4F46E5"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#rentGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  {isAr ? "لا توجد بيانات عقود كافية لتتبع تطور الإيجار" : "No contract history available for rent trend"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. CONTRACT STATUS DISTRIBUTION */}
        {activeMetric === "status" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? "توزيع حالات العقود الإيجارية لهذه الوحدة" : "Lease Status Distribution for this Unit"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="h-64 w-full">
                {stats.statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {stats.statusDistribution.map((entry, index) => (
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
                        formatter={(val: any, name: any) => [`${val} ${isAr ? "عقد" : "contracts"}`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    {isAr ? "لا توجد عقود مسجلة" : "No contracts found"}
                  </div>
                )}
              </div>

              {/* Status Breakdown Legend List */}
              <div className="space-y-2 text-xs">
                {stats.statusDistribution.map((item) => (
                  <div
                    key={item.rawStatus}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                    </div>
                    <div className="font-mono font-black text-slate-900 dark:text-white">
                      {item.value} {isAr ? "عقد" : "contracts"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Tenancy Cycle Breakdown Table */}
      {unitLeases.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700/80 space-y-3">
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isAr ? "سجل الدورات التأجيرية وفترات الإشغال" : "Tenancy Cycles & Occupancy Periods"}</span>
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5">{isAr ? "رقم العقد" : "Lease #"}</th>
                  <th className="px-3.5 py-2.5">{isAr ? "المستأجر" : "Tenant"}</th>
                  <th className="px-3.5 py-2.5">{isAr ? "الفترة الإيجارية" : "Period"}</th>
                  <th className="px-3.5 py-2.5">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-3.5 py-2.5 text-right">{isAr ? "الإيجار السنوي" : "Annual Rent"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {unitLeases.map((lease, idx) => {
                  const t = tenants.find((item) => item.id === lease.tenantId);
                  const isCurrent = lease.contractStatus === "ACTIVE";
                  return (
                    <tr
                      key={lease.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/60 ${
                        isCurrent ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          <span>{lease.leaseNumber || `L-${idx + 1}`}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold">
                        {t ? (isAr ? t.nameAr : t.nameEn) : isAr ? "غير محدد" : "N/A"}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500">
                        {lease.startDate} ➔ {lease.endDate}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            lease.contractStatus === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : lease.contractStatus === "UNDER_RENEWAL"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : lease.contractStatus === "TERMINATED"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {lease.contractStatus === "ACTIVE"
                            ? isAr ? "نشط" : "Active"
                            : lease.contractStatus === "EXPIRED"
                            ? isAr ? "منتهي" : "Expired"
                            : lease.contractStatus === "UNDER_RENEWAL"
                            ? isAr ? "قيد التجديد" : "Under Renewal"
                            : lease.contractStatus === "TERMINATED"
                            ? isAr ? "مفسوخ" : "Terminated"
                            : lease.contractStatus || "N/A"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {Number(lease.annualRent || 0).toLocaleString()} AED
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
