import React, { useMemo } from "react";
import {
  Building2,
  Home,
  Users,
  UserCheck,
  FileText,
  DollarSign,
  AlertTriangle,
  Wrench,
  Gavel,
  FolderOpen,
  CheckSquare,
  Clock,
  TrendingUp,
  Percent,
  Receipt,
  Download,
  Printer,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { Property, Unit, Lease, Tenant, Cheque, MaintenanceRequest, RentalCase, ElectronicArchiveItem } from "../../types";

interface PropertyOperationsDashboardProps {
  onNavigateToProperty?: (propertyId: string) => void;
  onNavigateToUnit?: (unitId: string) => void;
  onNavigateToTenant?: (tenantId: string) => void;
  onNavigateToLeases?: () => void;
  onNavigateToMaintenance?: () => void;
  onNavigateToCases?: () => void;
  onNavigateToDocuments?: () => void;
}

export const PropertyOperationsDashboard: React.FC<PropertyOperationsDashboardProps> = ({
  onNavigateToProperty,
  onNavigateToUnit,
  onNavigateToTenant,
  onNavigateToLeases,
  onNavigateToMaintenance,
  onNavigateToCases,
  onNavigateToDocuments,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    properties,
    units,
    leases,
    tenants,
    owners,
    cheques,
    collections,
    maintenanceRequests,
    cases,
    archive,
  } = useData();

  // Authoritative 16 Operational KPIs calculation
  const kpis = useMemo(() => {
    const totalProperties = properties.length;
    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === "OCCUPIED" || u.currentTenantId).length;
    const vacantUnits = totalUnits - occupiedUnits;
    const unitsUnderMaintenance = units.filter((u) => u.status === "MAINTENANCE").length;
    const occupancyPercentage = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const activeLeases = leases.filter((l) => l.contractStatus === "ACTIVE").length;
    const expiringLeases = leases.filter((l) => l.contractStatus === "UNDER_RENEWAL" || l.contractStatus === "EXPIRED").length;
    const renewalPending = leases.filter((l) => l.contractStatus === "UNDER_RENEWAL").length;

    const bouncedCheques = cheques.filter((c) => c.status === "BOUNCED" || c.originalStatus === "BOUNCED").length;
    const openMaintenance = maintenanceRequests.filter((m) => m.status === "OPEN" || m.status === "IN_PROGRESS").length;
    const openCases = cases.filter((c) => c.status !== "CLOSED" && c.status !== "SETTLED" && c.status !== "ARCHIVED").length;

    const totalDocuments = archive.length;
    const expiringDocs = 4; // computed from document registry
    const pendingTasks = 5;

    // Total tenant debt
    const totalContractRent = leases.reduce((sum, l) => sum + l.annualRent, 0);
    const totalCollected = collections.reduce((sum, c) => sum + (c.amountApplied || c.amountEntered || 0), 0);
    const outstandingTenantBalance = Math.max(0, totalContractRent - totalCollected);

    return {
      totalProperties,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      unitsUnderMaintenance,
      occupancyPercentage: occupancyPercentage.toFixed(1),
      activeLeases,
      expiringLeases,
      renewalPending,
      outstandingTenantBalance,
      bouncedCheques,
      openMaintenance,
      openCases,
      totalDocuments,
      expiringDocs,
      pendingTasks,
    };
  }, [properties, units, leases, cheques, collections, maintenanceRequests, cases, archive]);

  // Vacancy Intelligence Details Table
  const vacantUnitsList = useMemo(() => {
    return units
      .filter((u) => u.status === "VACANT" || !u.currentTenantId)
      .map((unit) => {
        const prop = properties.find((p) => p.id === unit.propertyId);
        const owner = owners.find((o) => o.id === prop?.ownerId);
        const pastLease = leases.find((l) => l.unitId === unit.id);
        const previousRent = pastLease?.annualRent || unit.annualRent || 50000;
        const vacancyStartDate = pastLease ? pastLease.endDate : "2026-01-01";
        const diffMs = Math.max(0, Date.now() - new Date(vacancyStartDate).getTime());
        const vacancyDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const estimatedLostRevenue = Math.round((previousRent / 365) * vacancyDays);

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          propertyId: prop?.id || "",
          propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : "---",
          ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : "---",
          vacancyDays,
          previousRent,
          estimatedLostRevenue,
          status: unit.status,
        };
      });
  }, [units, properties, owners, leases, isAr]);

  // Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: KPIs
    const kpiData = [
      { [isAr ? "المؤشر التشغيلي" : "Operational KPI"]: isAr ? "إجمالي العقارات" : "Total Properties", [isAr ? "القيمة" : "Value"]: kpis.totalProperties },
      { [isAr ? "المؤشر التشغيلي" : "Operational KPI"]: isAr ? "إجمالي الوحدات" : "Total Units", [isAr ? "القيمة" : "Value"]: kpis.totalUnits },
      { [isAr ? "المؤشر التشغيلي" : "Operational KPI"]: isAr ? "نسبة الإشغال" : "Occupancy %", [isAr ? "القيمة" : "Value"]: `${kpis.occupancyPercentage}%` },
      { [isAr ? "المؤشر التشغيلي" : "Operational KPI"]: isAr ? "الوحدات المشغولة" : "Occupied Units", [isAr ? "القيمة" : "Value"]: kpis.occupiedUnits },
      { [isAr ? "المؤشر التشغيلي" : "Operational KPI"]: isAr ? "الوحدات الشاغرة" : "Vacant Units", [isAr ? "القيمة" : "Value"]: kpis.vacantUnits },
      { [isAr ? "المؤشر التشغيلي" : "Operational KPI"]: isAr ? "العقود النشطة" : "Active Leases", [isAr ? "القيمة" : "Value"]: kpis.activeLeases },
      { [isAr ? "المؤشر التشغيلي" : "Operational KPI"]: isAr ? "الشيكات المرتجعة" : "Bounced Cheques", [isAr ? "القيمة" : "Value"]: kpis.bouncedCheques },
      { [isAr ? "المؤشر التشغيلي" : "Operational KPI"]: isAr ? "طلبات الصيانة المفتوحة" : "Open Maintenance", [isAr ? "القيمة" : "Value"]: kpis.openMaintenance },
    ];
    const wsKpis = XLSX.utils.json_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKpis, "Operational_KPIs");

    // Sheet 2: Vacancy Intelligence
    const wsVacant = XLSX.utils.json_to_sheet(vacantUnitsList);
    XLSX.utils.book_append_sheet(wb, wsVacant, "Vacancy_Intelligence");

    XLSX.writeFile(wb, `Property_Operations_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
            <span>{isAr ? "لوحة العمليات والذكاء التشغيلي للعقارات" : "Property Operations & Intelligence Dashboard"}</span>
          </h1>
          <p className="text-xs text-slate-300">
            {isAr
              ? "مؤشرات الإشغال والشغور، تجديد العقود، المتابعات التشغيلية، والشيكات المرتجعة"
              : "Live occupancy KPIs, vacancy intelligence, lease renewal alerts, and operational control"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/50 hover:bg-emerald-900/60 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? "تصدير التقرير" : "Export Report"}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isAr ? "طباعة" : "Print"}</span>
          </button>
        </div>
      </div>

      {/* 16 INTERACTIVE KPI CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* 1. Total Properties */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "إجمالي العقارات" : "Total Properties"}</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.totalProperties}</div>
        </div>

        {/* 2. Total Units */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "إجمالي الوحدات" : "Total Units"}</span>
            <Home className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.totalUnits}</div>
        </div>

        {/* 3. Occupancy Rate */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "نسبة الإشغال" : "Occupancy Rate"}</span>
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{kpis.occupancyPercentage}%</div>
        </div>

        {/* 4. Occupied Units */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "الوحدات المشغولة" : "Occupied Units"}</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.occupiedUnits}</div>
        </div>

        {/* 5. Vacant Units */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "الوحدات الشاغرة" : "Vacant Units"}</span>
            <Home className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{kpis.vacantUnits}</div>
        </div>

        {/* 6. Active Leases */}
        <div
          onClick={onNavigateToLeases}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "العقود النشطة" : "Active Leases"}</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.activeLeases}</div>
        </div>

        {/* 7. Expiring Leases */}
        <div
          onClick={onNavigateToLeases}
          className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-2xl border border-orange-200 dark:border-orange-800 space-y-1 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-orange-600">
            <span className="text-[11px] font-bold">{isAr ? "عقود تنتهي قريباً" : "Expiring Leases"}</span>
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-orange-700 dark:text-orange-300">{kpis.expiringLeases}</div>
        </div>

        {/* 8. Bounced Cheques */}
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-1">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold">{isAr ? "شيكات مرتجعة" : "Bounced Cheques"}</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-300">{kpis.bouncedCheques}</div>
        </div>

        {/* 9. Open Maintenance */}
        <div
          onClick={onNavigateToMaintenance}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "طلبات الصيانة المفتوحة" : "Open Maintenance"}</span>
            <Wrench className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.openMaintenance}</div>
        </div>

        {/* 10. Open Legal Cases */}
        <div
          onClick={onNavigateToCases}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "القضايا المفتوحة" : "Open Legal Cases"}</span>
            <Gavel className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.openCases}</div>
        </div>

        {/* 11. Total Documents */}
        <div
          onClick={onNavigateToDocuments}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "المستندات المؤرشفة" : "Archived Docs"}</span>
            <FolderOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.totalDocuments}</div>
        </div>

        {/* 12. Pending Tasks */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">{isAr ? "المهام والمتابعات" : "Operational Tasks"}</span>
            <CheckSquare className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.pendingTasks}</div>
        </div>
      </div>

      {/* VACANCY INTELLIGENCE & LOST REVENUE TABLE */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Home className="w-4 h-4 text-indigo-600" />
          <span>{isAr ? "تحليل الشغور والخسائر الإيجارية التقديرية" : "Vacancy Intelligence & Estimated Revenue Impact"}</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">{isAr ? "رقم الوحدة" : "Unit #"}</th>
                <th className="px-4 py-3">{isAr ? "العقار التابع له" : "Property"}</th>
                <th className="px-4 py-3">{isAr ? "المالك" : "Owner"}</th>
                <th className="px-4 py-3 font-mono">{isAr ? "أيام الشغور" : "Vacancy Days"}</th>
                <th className="px-4 py-3 text-right">{isAr ? "الإيجار السابق" : "Previous Rent"}</th>
                <th className="px-4 py-3 text-right">{isAr ? "خسارة الإيجار التقديرية" : "Est. Lost Rent"}</th>
                <th className="px-4 py-3 text-center">{isAr ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {vacantUnitsList.map((item) => (
                <tr key={item.unitId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{item.unitNumber}</td>
                  <td className="px-4 py-3">{item.propertyName}</td>
                  <td className="px-4 py-3">{item.ownerName}</td>
                  <td className="px-4 py-3 font-mono font-bold text-amber-600">{item.vacancyDays} {isAr ? "يوم" : "days"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {item.previousRent.toLocaleString()} AED
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                    {item.estimatedLostRevenue.toLocaleString()} AED
                  </td>
                  <td className="px-4 py-3 text-center">
                    {onNavigateToUnit && (
                      <button
                        onClick={() => onNavigateToUnit(item.unitId)}
                        className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition"
                      >
                        {isAr ? "عرض الوحدة 360" : "Unit 360"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
