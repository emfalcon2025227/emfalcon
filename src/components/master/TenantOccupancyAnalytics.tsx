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
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Tenant, Lease, Property, Unit, Cheque, CollectionRecord } from "../../types";
import { useLanguage } from "../../context/LanguageContext";

interface TenantOccupancyAnalyticsProps {
  tenant: Tenant;
  leases: Lease[];
  units: Unit[];
  properties: Property[];
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

export const TenantOccupancyAnalytics: React.FC<TenantOccupancyAnalyticsProps> = ({
  tenant,
  leases,
  units,
  properties,
  cheques = [],
  collections = [],
  onNavigateToUnit,
  className = "",
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [selectedUnitId, setSelectedUnitId] = useState<string>("ALL");
  const [activeMetric, setActiveMetric] = useState<"occupancy" | "rent" | "status">("occupancy");

  // Filter leases belonging to this tenant
  const tenantLeases = useMemo(() => {
    return leases
      .filter((l) => l.tenantId === tenant.id)
      .sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
  }, [leases, tenant.id]);

  // Unique units rented by this tenant
  const tenantUnits = useMemo(() => {
    const unitIds = new Set(tenantLeases.map((l) => l.unitId));
    return units.filter((u) => unitIds.has(u.id));
  }, [tenantLeases, units]);

  // Filter leases by selected unit
  const targetLeases = useMemo(() => {
    if (selectedUnitId === "ALL") return tenantLeases;
    return tenantLeases.filter((l) => l.unitId === selectedUnitId);
  }, [tenantLeases, selectedUnitId]);

  // Statistics & Charts
  const stats = useMemo(() => {
    if (targetLeases.length === 0) {
      return {
        totalLeases: 0,
        totalRentCommitted: 0,
        avgRent: 0,
        totalOccupiedDays: 0,
        historicalTimeline: [],
        statusDistribution: [],
        rentEvolution: [],
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];

    let totalRentCommitted = 0;
    let totalOccupiedDays = 0;

    targetLeases.forEach((l) => {
      totalRentCommitted += Number(l.annualRent || 0);
      const s = new Date(l.startDate || "2024-01-01");
      const e = new Date(l.endDate || l.startDate || "2024-01-01");
      const endCapped = e > now ? now : e;
      const days = Math.max(0, Math.floor((endCapped.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
      totalOccupiedDays += days;
    });

    const avgRent = Math.round(totalRentCommitted / targetLeases.length);

    // Multi-Year Occupancy / Active Days Breakdown
    const historicalTimeline = years.map((year) => {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year, 11, 31).getTime();
      const daysInYear = 365;

      let occupiedDaysInYear = 0;
      let revenueInYear = 0;

      targetLeases.forEach((l) => {
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

      const yearOccupancyPct = Math.min(100, Math.round((occupiedDaysInYear / daysInYear) * 100));

      return {
        year: year.toString(),
        occupancyRate: yearOccupancyPct,
        occupiedDays: occupiedDaysInYear,
        revenue: revenueInYear,
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
      const u = units.find((item) => item.id === l.unitId);
      const prop = properties.find((p) => p.id === l.propertyId);
      return {
        leaseLabel: `L${index + 1} (${u?.unitNumber || "Unit"})`,
        annualRent: Number(l.annualRent || 0),
        unitNumber: u?.unitNumber || "---",
        propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "---",
      };
    });

    return {
      totalLeases: targetLeases.length,
      totalRentCommitted,
      avgRent,
      totalOccupiedDays,
      historicalTimeline,
      statusDistribution,
      rentEvolution,
    };
  }, [targetLeases, units, properties, isAr]);

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
                  ? `تحليلات الإشغال وتاريخ العقود للمستأجر (${tenant.nameAr || tenant.nameEn})`
                  : `Tenant Occupancy & Lease History (${tenant.nameEn || tenant.nameAr})`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? "توزيع العقود التأجيرية، الالتزامات المالية السنوية، وتاريخ إشغال الوحدات"
                  : "Lease portfolio distribution, annual rent progression, and tenancy occupancy history"}
              </p>
            </div>
          </div>
        </div>

        {/* Unit Selector & Metric Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {tenantUnits.length > 1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden font-bold cursor-pointer"
              >
                <option value="ALL">
                  {isAr ? `كافة الوحدات المستأجرة (${tenantUnits.length})` : `All Leased Units (${tenantUnits.length})`}
                </option>
                {tenantUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {isAr ? `وحدة ${u.unitNumber}` : `Unit ${u.unitNumber}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveMetric("occupancy")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeMetric === "occupancy"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {isAr ? "فترات الإشغال" : "Occupancy"}
            </button>
            <button
              onClick={() => setActiveMetric("rent")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeMetric === "rent"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {isAr ? "الالتزام الإيجاري" : "Rent Trend"}
            </button>
            <button
              onClick={() => setActiveMetric("status")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeMetric === "status"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {isAr ? "حالات العقود" : "Contracts"}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "إجمالي أيام الإشغال" : "Total Occupied Days"}</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.totalOccupiedDays} <span className="text-xs font-normal text-slate-400">{isAr ? "يوم" : "days"}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "عبر تاريخ تعامل المستأجر" : "Across tenant lifetime"}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "إجمالي العقود المبرمة" : "Total Leases"}</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalLeases}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {tenantUnits.length} {isAr ? "وحدات سكنية / تجارية" : "leased units"}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "إجمالي الالتزام الإيجاري" : "Committed Rent"}</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalRentCommitted.toLocaleString()} <span className="text-xs font-normal text-slate-400">AED</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? "متوسط العقد:" : "Avg lease:"} {stats.avgRent.toLocaleString()} AED
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{isAr ? "الوحدات المستأجرة" : "Leased Units"}</span>
            <Home className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {tenantUnits.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {selectedUnitId === "ALL" ? (isAr ? "عرض كافة الوحدات" : "All Units") : (isAr ? "وحدة محددة" : "Selected Unit")}
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
                {isAr ? "نسبة التغطية والتواجد الإيجاري السنوي للمستأجر (%)" : "Yearly Tenancy Active Ratio (%)"}
              </span>
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
                    formatter={(val: any) => [`${val}%`, isAr ? "نسبة الإشغال" : "Occupancy Rate"]}
                  />
                  <Bar dataKey="occupancyRate" fill="#10B981" radius={[6, 6, 0, 0]} />
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
                {isAr ? "مسار الالتزامات الإيجارية السنوية عبر العقود (AED)" : "Annual Rent Progression Across Leases (AED)"}
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full">
              {stats.rentEvolution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.rentEvolution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tenantRentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
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
                    />
                    <Area
                      type="monotone"
                      dataKey="annualRent"
                      stroke="#059669"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#tenantRentGradient)"
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
                {isAr ? "توزيع حالات عقود المستأجر" : "Tenant Contract Status Breakdown"}
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
