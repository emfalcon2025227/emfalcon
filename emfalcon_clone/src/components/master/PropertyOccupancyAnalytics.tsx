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
  Filter,
  Layers,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { Property, Unit, Lease, Tenant, Cheque, CollectionRecord } from "../../types";
import { useLanguage } from "../../context/LanguageContext";

interface PropertyOccupancyAnalyticsProps {
  property: Property;
  units: Unit[];
  leases: Lease[];
  tenants: Tenant[];
  cheques?: Cheque[];
  collections?: CollectionRecord[];
  onNavigateToUnit?: (unitId: string) => void;
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

export const PropertyOccupancyAnalytics: React.FC<PropertyOccupancyAnalyticsProps> = ({
  property,
  units,
  leases,
  tenants,
  cheques = [],
  collections = [],
  onNavigateToUnit,
  className = "",
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  // Filter selection: "ALL" for property aggregate, or specific unit ID
  const [selectedUnitId, setSelectedUnitId] = useState<string>("ALL");
  const [activeMetric, setActiveMetric] = useState<"occupancy" | "rent" | "status">("occupancy");

  // Property units
  const propertyUnits = useMemo(() => {
    return units.filter((u) => u.propertyId === property.id);
  }, [units, property.id]);

  const targetUnits = useMemo(() => {
    if (selectedUnitId === "ALL") return propertyUnits;
    return propertyUnits.filter((u) => u.id === selectedUnitId);
  }, [propertyUnits, selectedUnitId]);

  const targetUnitIds = useMemo(() => new Set(targetUnits.map((u) => u.id)), [targetUnits]);

  // Filter leases for target units
  const targetLeases = useMemo(() => {
    return leases
      .filter((l) => targetUnitIds.has(l.unitId))
      .sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
  }, [leases, targetUnitIds]);

  // Overall Statistics & Analytics calculations
  const stats = useMemo(() => {
    const totalUnitsCount = targetUnits.length;
    const occupiedUnitsCount = targetUnits.filter((u) => u.status === "OCCUPIED").length;
    const vacantUnitsCount = targetUnits.filter((u) => u.status === "VACANT").length;
    const currentOccupancyRate = totalUnitsCount > 0 ? Math.round((occupiedUnitsCount / totalUnitsCount) * 100) : 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];

    let lifetimeRevenue = 0;
    targetLeases.forEach((l) => {
      lifetimeRevenue += Number(l.annualRent || 0);
    });

    // Multi-Year Occupancy Rate Breakdown
    const historicalTimeline = years.map((year) => {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year, 11, 31).getTime();
      const daysInYear = 365;
      const totalPossibleUnitDays = Math.max(1, totalUnitsCount * daysInYear);

      let totalOccupiedDays = 0;
      let yearRevenue = 0;

      targetLeases.forEach((l) => {
        const lStart = new Date(l.startDate || "2024-01-01").getTime();
        const lEnd = new Date(l.endDate || l.startDate || "2024-01-01").getTime();

        const overlapStart = Math.max(yearStart, lStart);
        const overlapEnd = Math.min(yearEnd, lEnd);

        if (overlapEnd >= overlapStart) {
          const days = Math.floor((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
          totalOccupiedDays += days;
          yearRevenue += Math.round((Number(l.annualRent || 0) / 365) * days);
        }
      });

      const yearOccupancyRate = Math.min(100, Math.round((totalOccupiedDays / totalPossibleUnitDays) * 100));
      const yearVacancyRate = 100 - yearOccupancyRate;

      return {
        year: year.toString(),
        occupancyRate: yearOccupancyRate,
        vacancyRate: yearVacancyRate,
        revenue: yearRevenue,
      };
    });

    // Contract Status Distribution
    const statusCounts: Record<string, number> = {};
    targetLeases.forEach((l) => {
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
    const rentEvolution = targetLeases.map((l, index) => {
      const unitObj = propertyUnits.find((u) => u.id === l.unitId);
      const tenant = tenants.find((t) => t.id === l.tenantId);
      return {
        leaseLabel: `L${index + 1} (${unitObj?.unitNumber || "Unit"})`,
        annualRent: Number(l.annualRent || 0),
        tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "N/A",
        unitNumber: unitObj?.unitNumber || "---",
      };
    });

    return {
      totalUnitsCount,
      occupiedUnitsCount,
      vacantUnitsCount,
      currentOccupancyRate,
      totalLeasesCount: targetLeases.length,
      lifetimeRevenue,
      historicalTimeline,
      statusDistribution,
      rentEvolution,
    };
  }, [targetUnits, targetLeases, propertyUnits, tenants, isAr]);

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
                  ? `تحليلات نسب الإشغال وتوزيع العقود (${property.nameAr || property.nameEn})`
                  : `Occupancy & Lease Analytics (${property.nameEn || property.nameAr})`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? "مؤشرات نسب الإشغال التاريخية، القيمة الإيجارية، وتوزيع العقود على مستوى المبنى أو الوحدة"
                  : "Historical occupancy ratios, rental revenue progression, and contract distribution"}
              </p>
            </div>
          </div>
        </div>

        {/* Unit Selector & Metric Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Unit Filter Dropdown */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden font-bold cursor-pointer"
            >
              <option value="ALL">
                {isAr ? `كافة وحدات العقار (${propertyUnits.length} وحدة)` : `All Property Units (${propertyUnits.length})`}
              </option>
              {propertyUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {isAr ? `وحدة ${u.unitNumber} (${u.status === "OCCUPIED" ? "مؤجرة" : "شاغرة"})` : `Unit ${u.unitNumber} (${u.status})`}
                </option>
              ))}
            </select>
          </div>

          {/* Metric View Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveMetric("occupancy")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeMetric === "occupancy"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {isAr ? "نسب الإشغال" : "Occupancy"}
            </button>
            <button
              onClick={() => setActiveMetric("rent")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeMetric === "rent"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {isAr ? "تطور الإيجار" : "Rent Trend"}
            </button>
            <button
              onClick={() => setActiveMetric("status")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeMetric === "status"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {isAr ? "توزيع العقود" : "Contracts"}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "نسبة الإشغال الحالية" : "Current Occupancy"}</span>
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.currentOccupancyRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.occupiedUnitsCount} {isAr ? "مشغولة" : "occupied"} / {stats.vacantUnitsCount} {isAr ? "شاغرة" : "vacant"}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "إجمالي العقود التاريخية" : "Total Leases"}</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalLeasesCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {selectedUnitId === "ALL" ? (isAr ? "لكافة وحدات المبنى" : "Across all units") : (isAr ? "لهذه الوحدة" : "For this unit")}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "إجمالي الدخل الإيجاري" : "Total Revenue"}</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.lifetimeRevenue.toLocaleString()} <span className="text-xs font-normal text-slate-400">AED</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "عبر العقود المسجلة" : "From recorded leases"}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "الوحدات المحددة" : "Selected Units"}</span>
            <Home className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {stats.totalUnitsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {selectedUnitId === "ALL" ? (isAr ? "عرض شامل للعقار" : "Full Property View") : (isAr ? "عرض وحدة منفردة" : "Single Unit")}
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
                {isAr
                  ? `نسبة الإشغال مقابل الشغور السنوية (${selectedUnitId === "ALL" ? "العقار بالكامل" : `الوحدة ${targetUnits[0]?.unitNumber}`}) (%)`
                  : `Yearly Occupancy vs Vacancy Ratio (%)`}
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
                {isAr ? "مسار تطور القيمة الإيجارية السنوية (AED)" : "Annual Rent Trend Across Leases (AED)"}
              </span>
              <span className="text-xs text-indigo-600 font-mono font-bold">
                {stats.rentEvolution.length} {isAr ? "عقد مسجل" : "contracts"}
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full">
              {stats.rentEvolution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.rentEvolution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="propRentGradient" x1="0" y1="0" x2="0" y2="1">
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
                        return `${label} - ${item?.tenantName || ""}`;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="annualRent"
                      stroke="#4F46E5"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#propRentGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  {isAr ? "لا توجد عقود مسجلة للوحدات المحددة" : "No contract data available"}
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
                {isAr ? "توزيع حالات العقود الإيجارية" : "Lease Status Breakdown"}
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
    </div>
  );
};
