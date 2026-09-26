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
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { Owner, Property, Unit, Lease, Tenant, Cheque, CollectionRecord } from "../../types";
import { useLanguage } from "../../context/LanguageContext";

interface OwnerOccupancyAnalyticsProps {
  owner: Owner;
  properties: Property[];
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

export const OwnerOccupancyAnalytics: React.FC<OwnerOccupancyAnalyticsProps> = ({
  owner,
  properties,
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

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("ALL");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("ALL");
  const [activeMetric, setActiveMetric] = useState<"occupancy" | "rent" | "status">("occupancy");

  // Owner Properties
  const ownerProperties = useMemo(() => {
    return properties.filter((p) => p.ownerId === owner.id);
  }, [properties, owner.id]);

  const ownerPropertyIds = useMemo(() => new Set(ownerProperties.map((p) => p.id)), [ownerProperties]);

  // Owner Units
  const ownerUnits = useMemo(() => {
    return units.filter((u) => ownerPropertyIds.has(u.propertyId));
  }, [units, ownerPropertyIds]);

  // Filter units by selected property
  const filteredUnits = useMemo(() => {
    if (selectedPropertyId === "ALL") return ownerUnits;
    return ownerUnits.filter((u) => u.propertyId === selectedPropertyId);
  }, [ownerUnits, selectedPropertyId]);

  // Target Units (after unit filter)
  const targetUnits = useMemo(() => {
    if (selectedUnitId === "ALL") return filteredUnits;
    return filteredUnits.filter((u) => u.id === selectedUnitId);
  }, [filteredUnits, selectedUnitId]);

  const targetUnitIds = useMemo(() => new Set(targetUnits.map((u) => u.id)), [targetUnits]);

  // Filter leases belonging to target units
  const targetLeases = useMemo(() => {
    return leases
      .filter((l) => targetUnitIds.has(l.unitId))
      .sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
  }, [leases, targetUnitIds]);

  // Statistics & Charts
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

    // Status Distribution
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

    // Rent Evolution
    const rentEvolution = targetLeases.map((l, index) => {
      const unitObj = ownerUnits.find((u) => u.id === l.unitId);
      const propObj = ownerProperties.find((p) => p.id === l.propertyId);
      const tenant = tenants.find((t) => t.id === l.tenantId);
      return {
        leaseLabel: `L${index + 1} (${unitObj?.unitNumber || "Unit"})`,
        annualRent: Number(l.annualRent || 0),
        tenantName: tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "N/A",
        unitNumber: unitObj?.unitNumber || "---",
        propertyName: propObj ? (isAr ? propObj.nameAr : propObj.nameEn) : "---",
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
  }, [targetUnits, targetLeases, ownerUnits, ownerProperties, tenants, isAr]);

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
                  ? `تحليلات الإشغال ونسب العقود للمالك (${owner.nameAr || owner.nameEn})`
                  : `Owner Portfolio Occupancy & Lease Analytics (${owner.nameEn || owner.nameAr})`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? "معدلات الإشغال التاريخية، القيمة الإيجارية السنوية، وتوزيع العقود لمحفظة المالك"
                  : "Portfolio occupancy ratios, rental revenue trajectory, and lease distributions"}
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Metric Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Property Filter */}
          {ownerProperties.length > 1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={selectedPropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value);
                  setSelectedUnitId("ALL");
                }}
                className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden font-bold cursor-pointer"
              >
                <option value="ALL">
                  {isAr ? `كافة العقارات (${ownerProperties.length})` : `All Properties (${ownerProperties.length})`}
                </option>
                {ownerProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {isAr ? p.nameAr : p.nameEn}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Unit Filter */}
          {filteredUnits.length > 1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden font-bold cursor-pointer"
              >
                <option value="ALL">
                  {isAr ? `كافة الوحدات (${filteredUnits.length})` : `All Units (${filteredUnits.length})`}
                </option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {isAr ? `وحدة ${u.unitNumber} (${u.status === "OCCUPIED" ? "مؤجرة" : "شاغرة"})` : `Unit ${u.unitNumber}`}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {isAr ? "الدخل الإيجاري" : "Rent Trend"}
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
            <span>{isAr ? "نسبة إشغال المحفظة" : "Portfolio Occupancy"}</span>
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
            {ownerProperties.length} {isAr ? "عقارات" : "properties"} | {stats.totalUnitsCount} {isAr ? "وحدات" : "units"}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "إجمالي الدخل الإيجاري" : "Lifetime Revenue"}</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.lifetimeRevenue.toLocaleString()} <span className="text-xs font-normal text-slate-400">AED</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "عبر كافة العقود المبرمة" : "From all portfolio leases"}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "الوحدات المستهدفة" : "Target Units"}</span>
            <Home className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {stats.totalUnitsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {selectedUnitId === "ALL" ? (isAr ? "كامل المحفظة" : "Full Portfolio") : (isAr ? "وحدة محددة" : "Single Unit")}
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
                {isAr ? "نسبة الإشغال السنوية للمحفظة العقارية (%)" : "Yearly Portfolio Occupancy vs Vacancy (%)"}
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
                {isAr ? "مسار تطور الإيجار السنوي عبر عقود المحفظة (AED)" : "Annual Rent Progression Across Portfolio Leases (AED)"}
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
                      <linearGradient id="ownerRentGradient" x1="0" y1="0" x2="0" y2="1">
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
                        return `${label} - ${item?.propertyName || ""} (${item?.tenantName || ""})`;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="annualRent"
                      stroke="#4F46E5"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#ownerRentGradient)"
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

        {/* 3. CONTRACT STATUS DISTRIBUTION */}
        {activeMetric === "status" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? "توزيع حالات العقود لمحفظة المالك" : "Owner Portfolio Contract Status Breakdown"}
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
