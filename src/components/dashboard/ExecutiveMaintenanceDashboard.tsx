import React, { useMemo, useState } from "react";
import { 
  Wrench, 
  AlertCircle, 
  Flame, 
  Clock, 
  Activity, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Building2, 
  Calendar, 
  User, 
  Phone,
  ShieldCheck,
  TrendingUp,
  Plus,
  Zap,
  Check,
  Play,
  Eye
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { MaintenanceRequest } from "../../types";
import { MaintenanceDetailsModal } from "../maintenance/MaintenanceDetailsModal";

interface ExecutiveMaintenanceDashboardProps {
  onNavigateToMaintenance?: () => void;
  onSelectTenant?: (tenant: any) => void;
}

export const ExecutiveMaintenanceDashboard: React.FC<ExecutiveMaintenanceDashboardProps> = ({
  onNavigateToMaintenance,
  onSelectTenant
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { 
    maintenanceRequests, 
    maintenanceSettings, 
    technicians, 
    properties, 
    units, 
    tenants,
    updateMaintenanceStatus,
    assignTechnicianToRequest
  } = useData();

  const [selectedQuickActionReq, setSelectedQuickActionReq] = useState<MaintenanceRequest | null>(null);
  const [selectedRequestForDetails, setSelectedRequestForDetails] = useState<MaintenanceRequest | null>(null);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  // SLA Threshold in days
  const delayedDaysThreshold = maintenanceSettings?.delayedDaysThreshold || 5;

  // Delayed Check Helper
  const isRequestDelayed = (req: MaintenanceRequest) => {
    if (
      req.status === "COMPLETED" ||
      req.status === "CANCELLED" ||
      req.status === "REJECTED"
    ) {
      return false;
    }
    const created = new Date(req.createdAt || req.requestDate);
    const now = new Date();
    const elapsedDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return elapsedDays > delayedDaysThreshold;
  };

  // KPIs
  const totalCount = maintenanceRequests.length;
  const openCount = maintenanceRequests.filter((r) => r.status === "OPEN").length;
  const inProgressCount = maintenanceRequests.filter((r) => r.status === "IN_PROGRESS").length;
  const urgentCount = maintenanceRequests.filter(
    (r) =>
      r.priority === "URGENT" &&
      r.status !== "COMPLETED" &&
      r.status !== "CANCELLED" &&
      r.status !== "REJECTED"
  ).length;
  const completedCount = maintenanceRequests.filter((r) => r.status === "COMPLETED").length;
  const delayedRequests = useMemo(() => maintenanceRequests.filter(isRequestDelayed), [maintenanceRequests, delayedDaysThreshold]);
  const delayedCount = delayedRequests.length;

  // Urgent and high priority active requests
  const urgentActiveRequests = useMemo(() => {
    return maintenanceRequests.filter(
      (r) => 
        (r.priority === "URGENT" || r.priority === "HIGH") &&
        r.status !== "COMPLETED" &&
        r.status !== "CANCELLED" &&
        r.status !== "REJECTED"
    );
  }, [maintenanceRequests]);

  // Financial KPIs
  const totalCost = maintenanceRequests.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
  const paidCost = maintenanceRequests.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);
  const remainingCost = maintenanceRequests.reduce((sum, r) => sum + (Number(r.remainingAmount) || 0), 0);

  // Cost Bearer breakdown
  const ownerCost = maintenanceRequests
    .filter((r) => r.costBearer === "OWNER")
    .reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
  const tenantCost = maintenanceRequests
    .filter((r) => r.costBearer === "TENANT")
    .reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
  const managementCost = maintenanceRequests
    .filter((r) => r.costBearer === "MANAGEMENT" || r.costBearer === "OFFICE")
    .reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);

  // Category distribution
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    maintenanceRequests.forEach((r) => {
      const cat = r.category || "عام";
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [maintenanceRequests]);

  // Resolution Rate
  const resolvedRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      
      {/* 1. TOP EXECUTIVE MAINTENANCE BANNER & INDICATORS (EXACT MATCH TO ATTACHED DESIGN) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-rose-500/5 blur-3xl pointer-events-none" />

        {/* Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          
          {/* Right/Header info */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                {isAr ? "إشعارات ومؤشرات الصيانة التنفيذية" : "Executive Maintenance Notifications & Indicators"}
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                {isAr 
                  ? "متابعة لحظية لطلبات الصيانة، بلاغات الطوارئ، وتنبيهات تأخير خدمة الوحدات" 
                  : "Real-time monitoring of maintenance requests, emergency reports, and unit service delay alerts"}
              </p>
            </div>
          </div>

          {/* Left/Action Button */}
          {onNavigateToMaintenance && (
            <button
              onClick={onNavigateToMaintenance}
              className="bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25 transition-all self-start sm:self-center cursor-pointer shrink-0"
            >
              <span>{isAr ? "إدارة طلبات الصيانة بالكامل" : "Manage All Maintenance"}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 5 Executive Indicator Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-5">
          
          {/* Card 1: Total Requests (Rightmost in RTL) */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between min-h-[115px] shadow-sm hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                {isAr ? "إجمالي طلبات الصيانة" : "Total Requests"}
              </span>
              <Wrench className="w-4 h-4 text-amber-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl md:text-3xl font-black text-white">
                {totalCount}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              {isAr ? "جميع البلاغات المسجلة" : "All registered tickets"}
            </div>
          </div>

          {/* Card 2: Open Requests */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between min-h-[115px] shadow-sm hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                {isAr ? "طلبات الصيانة المفتوحة" : "Open Requests"}
              </span>
              <AlertCircle className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl md:text-3xl font-black text-cyan-400">
                {openCount}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              {isAr ? "بانتظار التعيين والفحص" : "Awaiting dispatch & check"}
            </div>
          </div>

          {/* Card 3: Urgent & Emergency (FLICKERS CONTINUOUSLY AS LONG AS URGENT COUNT > 0) */}
          <div 
            className={`rounded-2xl p-4 flex flex-col justify-between min-h-[115px] shadow-sm transition-all relative overflow-hidden ${
              urgentCount > 0 
                ? "bg-[#240c17]/95 border-2 border-rose-500 urgent-flicker-dark" 
                : "bg-[#240c17]/90 border border-rose-900/60 hover:border-rose-700/80"
            }`}
          >
            {urgentCount > 0 && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-rose-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                <span>{isAr ? "وميض نشط" : "Flicker Active"}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-200">
                {isAr ? "الصيانة العاجلة والطارئة" : "Urgent & Emergency"}
              </span>
              <Flame className={`w-4 h-4 text-rose-400 ${urgentCount > 0 ? "animate-bounce" : ""}`} />
            </div>
            <div className="my-2">
              <span className="text-2xl md:text-3xl font-black text-rose-400">
                {urgentCount}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-rose-300/80">
              {urgentCount > 0 
                ? (isAr ? "⚠️ يتطلب اتخاذ إجراء لإيقاف الوميض" : "⚠️ Requires action to stop flicker")
                : (isAr ? "لا توجد بلاغات طارئة معلقة" : "No pending emergencies")}
            </div>
          </div>

          {/* Card 4: Delayed SLA Requests */}
          <div className="bg-[#23180b]/90 border border-amber-900/60 rounded-2xl p-4 flex flex-col justify-between min-h-[115px] shadow-sm hover:border-amber-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-200">
                {isAr ? "طلبات الصيانة المتأخرة" : "Delayed Requests"}
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl md:text-3xl font-black text-amber-400">
                {delayedCount}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-amber-300/80">
              {isAr ? `تجاوزت مهلة SLA (${delayedDaysThreshold} أيام)` : `Exceeded SLA (${delayedDaysThreshold}d)`}
            </div>
          </div>

          {/* Card 5: In Progress & Tracking (Leftmost in RTL) */}
          <div className="bg-[#09221b]/90 border border-emerald-900/60 rounded-2xl p-4 flex flex-col justify-between min-h-[115px] shadow-sm hover:border-emerald-700/80 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200">
                {isAr ? "قيد التنفيذ والمتابعة" : "In Progress"}
              </span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="my-2">
              <span className="text-2xl md:text-3xl font-black text-emerald-400">
                {inProgressCount}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-emerald-300/80">
              {isAr ? "مع الفني / قيد المتابعة" : "With technician / Active"}
            </div>
          </div>

        </div>
      </div>

      {/* 2. URGENT & DELAYED TICKETS SPOTLIGHT TABLE */}
      {(urgentActiveRequests.length > 0 || delayedRequests.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-rose-50/70 px-5 py-4 border-b border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500 text-white rounded-xl shadow-sm">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {isAr ? "بلاغات تتطلب تدخل الإدارة الفوري والتوجيه" : "Immediate Management Action & Escalations"}
                </h3>
                <p className="text-xs font-semibold text-rose-700 mt-0.5">
                  {isAr 
                    ? `يوجد ${urgentActiveRequests.length} بلاغ طارئ و ${delayedCount} بلاغ متجاوز لمهلة الخدمة` 
                    : `${urgentActiveRequests.length} urgent tickets & ${delayedCount} SLA-breached tickets`}
                </p>
              </div>
            </div>
            {onNavigateToMaintenance && (
              <button
                onClick={onNavigateToMaintenance}
                className="text-xs font-black text-rose-700 hover:text-rose-800 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition-all"
              >
                {isAr ? "معاينة الكل" : "View All"}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{isAr ? "رقم البلاغ" : "Ticket #"}</th>
                  <th className="py-3 px-4">{isAr ? "العقار / الوحدة" : "Property / Unit"}</th>
                  <th className="py-3 px-4">{isAr ? "المستأجر / المبلغ" : "Tenant / Requester"}</th>
                  <th className="py-3 px-4">{isAr ? "التصنيف والوصف" : "Category & Issue"}</th>
                  <th className="py-3 px-4">{isAr ? "الأولوية" : "Priority"}</th>
                  <th className="py-3 px-4">{isAr ? "الفني المعين" : "Technician"}</th>
                  <th className="py-3 px-4 text-center">{isAr ? "الحالة والمدة" : "Status & SLA"}</th>
                  <th className="py-3 px-4 text-center">{isAr ? "إجراء الموظف" : "Employee Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...urgentActiveRequests, ...delayedRequests.filter(d => !urgentActiveRequests.some(u => u.id === d.id))].slice(0, 6).map((req) => {
                  const isDelayed = isRequestDelayed(req);
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">
                        {req.requestNumber || `#${req.id.slice(0, 6)}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">
                          {req.propertyNameAr || req.propertyNameEn || "عقار غير محدد"}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {req.unitNumber ? `${isAr ? "وحدة:" : "Unit:"} ${req.unitNumber}` : "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">
                          {req.tenantNameAr || req.tenantNameEn || req.requestedBy || "مجهول"}
                        </div>
                        {req.requesterPhone && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {req.requesterPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mb-1">
                          {req.category || "عام"}
                        </span>
                        <div className="text-slate-600 truncate font-medium">
                          {req.issueDescription || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {req.priority === "URGENT" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 urgent-flicker">
                            <Flame className="w-3 h-3" />
                            {isAr ? "طارئة وعاجلة" : "Urgent"}
                          </span>
                        ) : req.priority === "HIGH" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            {isAr ? "عالية" : "High"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {req.priority}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {req.assignedTechnicianName ? (
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {req.assignedTechnicianName}
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                            {isAr ? "غير معين" : "Unassigned"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isDelayed && (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white animate-pulse">
                            {isAr ? "متأخر SLA" : "SLA Breached"}
                          </span>
                        )}
                        <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {req.status === "OPEN" 
                            ? (isAr ? "مفتوح" : "Open") 
                            : req.status === "IN_PROGRESS" 
                            ? (isAr ? "قيد التنفيذ" : "In Progress") 
                            : req.status}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedRequestForDetails(req)}
                            title={isAr ? "عرض التفاصيل الكاملة" : "View Details"}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold p-1.5 rounded-lg transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedQuickActionReq(req);
                              setSelectedTechId(req.assignedTechnicianId || "");
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>{isAr ? "اتخاذ إجراء" : "Take Action"}</span>
                          </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK ACTION MODAL FOR MAINTENANCE TICKETS */}
      {selectedQuickActionReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 text-right space-y-5" dir={isAr ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {isAr ? "اتخاذ إجراء فوري على بلاغ الصيانة" : "Take Action on Maintenance Ticket"}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    {selectedQuickActionReq.requestNumber} - {selectedQuickActionReq.propertyNameAr || selectedQuickActionReq.propertyNameEn}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedQuickActionReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Ticket Info Summary */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? "وصف العطل:" : "Issue:"}</span>
                <span className="font-bold text-slate-800">{selectedQuickActionReq.issueDescription}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? "الأولوية الحالية:" : "Priority:"}</span>
                <span className="font-bold text-rose-600">{selectedQuickActionReq.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? "الحالة الحالية:" : "Status:"}</span>
                <span className="font-bold text-slate-700">{selectedQuickActionReq.status}</span>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                {isAr ? "اختر الإجراء التنفيذي المطلوب:" : "Select Required Action:"}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    updateMaintenanceStatus(selectedQuickActionReq.id, "IN_PROGRESS", "تم بدء العمل الميداني ومعالجة البلاغ من لوحة التحكم");
                    setSelectedQuickActionReq(null);
                  }}
                  className="p-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs flex items-center gap-2 text-right transition-colors"
                >
                  <Play className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div>{isAr ? "بدء التنفيذ الفعلي" : "Set In Progress"}</div>
                    <div className="text-[10px] text-blue-600 font-normal">{isAr ? "تغيير الحالة إلى قيد التنفيذ" : "Mark ticket active"}</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    updateMaintenanceStatus(selectedQuickActionReq.id, "COMPLETED", "تم إنجاز الصيانة وإغلاق البلاغ بنجاح", new Date().toISOString().split("T")[0]);
                    setSelectedQuickActionReq(null);
                  }}
                  className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-2 text-right transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div>{isAr ? "إنجاز وإغلاق البلاغ" : "Mark Completed"}</div>
                    <div className="text-[10px] text-emerald-600 font-normal">{isAr ? "إنهاء العطل وإيقاف الوميض" : "Resolve and close"}</div>
                  </div>
                </button>
              </div>

              {/* Assign Technician */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {isAr ? "تعيين فني مختص للطلب:" : "Assign Technician:"}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                    className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">{isAr ? "-- اختر الفني المعين --" : "-- Select Technician --"}</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.serviceType || t.company || (isAr ? "فني عام" : "General")})
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!selectedTechId}
                    onClick={() => {
                      if (selectedTechId) {
                        assignTechnicianToRequest(selectedQuickActionReq.id, selectedTechId, "تم تعيين الفني من لوحة مؤشرات الصيانة التنفيذية");
                        setSelectedQuickActionReq(null);
                      }
                    }}
                    className="bg-slate-900 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    {isAr ? "تعيين" : "Assign"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {onNavigateToMaintenance && (
                <button
                  onClick={() => {
                    setSelectedQuickActionReq(null);
                    onNavigateToMaintenance();
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>{isAr ? "فتح إدارة الصيانة المتقدمة" : "Open Full Maintenance"}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setSelectedQuickActionReq(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. FINANCIAL & OPERATIONAL EXCELLENCE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Maintenance Financial Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  {isAr ? "المؤشرات المالية للصيانة" : "Maintenance Financials"}
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {isAr ? "د.إ" : "AED"}
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  {isAr ? "إجمالي التكاليف المسجلة" : "Total Cost Incurred"}
                </span>
                <span className="text-sm font-black text-slate-900">
                  {totalCost.toLocaleString()} <span className="text-[10px] text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                </span>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">
                  {isAr ? "المبالغ المسددة والمغلقة" : "Total Paid Amount"}
                </span>
                <span className="text-sm font-black text-emerald-700">
                  {paidCost.toLocaleString()} <span className="text-[10px] text-emerald-500">{isAr ? "د.إ" : "AED"}</span>
                </span>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800">
                  {isAr ? "المتبقي غير المسدد" : "Outstanding Invoices"}
                </span>
                <span className="text-sm font-black text-amber-700">
                  {remainingCost.toLocaleString()} <span className="text-[10px] text-amber-500">{isAr ? "د.إ" : "AED"}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-500 mb-2">
              {isAr ? "توزيع التكاليف حسب جهة التحمل:" : "Cost Bearer Allocation:"}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 font-bold">{isAr ? "المالك" : "Owner"}</div>
                <div className="font-black text-slate-800 mt-0.5">{ownerCost.toLocaleString()}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 font-bold">{isAr ? "المستأجر" : "Tenant"}</div>
                <div className="font-black text-slate-800 mt-0.5">{tenantCost.toLocaleString()}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 font-bold">{isAr ? "الإدارة" : "Office"}</div>
                <div className="font-black text-slate-800 mt-0.5">{managementCost.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  {isAr ? "توزيع الطلبات حسب التخصص" : "Category Breakdown"}
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {categoryStats.length} {isAr ? "تخصصات" : "types"}
              </span>
            </div>

            <div className="space-y-2.5 mt-4">
              {categoryStats.length > 0 ? (
                categoryStats.slice(0, 5).map(([cat, count]) => {
                  const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-700">{cat}</span>
                        <span className="text-slate-900 font-black">{count} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs font-bold">
                  {isAr ? "لا توجد بلاغات مسجلة حتى الآن" : "No maintenance tickets logged"}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500">{isAr ? "معدل الإنجاز الإجمالي:" : "Resolution Rate:"}</span>
            <span className="font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              {resolvedRate}% {isAr ? "مكتمل" : "Resolved"}
            </span>
          </div>
        </div>

        {/* Technician Fleet & Rapid Dispatch */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  {isAr ? "طاقم الفنيين والجاهزية" : "Technician Readiness"}
                </h3>
              </div>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                {technicians.filter(t => t.status === "ACTIVE").length} {isAr ? "نشط" : "Active"}
              </span>
            </div>

            <div className="space-y-2 mt-4 max-h-[190px] overflow-y-auto">
              {technicians.length > 0 ? (
                technicians.slice(0, 4).map((tech) => {
                  const assignedCount = maintenanceRequests.filter(
                    (r) => r.assignedTechnicianId === tech.id && r.status === "IN_PROGRESS"
                  ).length;
                  return (
                    <div key={tech.id} className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs transition-all">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-black">
                          {tech.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{tech.name}</div>
                          <div className="text-[10px] text-slate-400">{tech.serviceType || "فني عام"}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${assignedCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {assignedCount} {isAr ? "قيد التنفيذ" : "Active"}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs font-bold">
                  {isAr ? "لم يتم تسجيل فنيين بعد" : "No technicians registered"}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            {onNavigateToMaintenance && (
              <button
                onClick={onNavigateToMaintenance}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? "إضافة بلاغ صيانة جديد" : "Create Maintenance Ticket"}</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* MAINTENANCE DETAILS MODAL (FULL RECORD) */}
      {selectedRequestForDetails && (
        <MaintenanceDetailsModal
          request={selectedRequestForDetails}
          isOpen={true}
          onClose={() => setSelectedRequestForDetails(null)}
          onEdit={(updatedReq) => {
            setSelectedRequestForDetails(null);
          }}
        />
      )}

    </div>
  );
};
