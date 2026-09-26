import React, { useState, useMemo } from "react";
import {
  Wrench,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Filter,
  DollarSign,
  ShieldCheck,
  User,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { MaintenanceRequest, Property, Unit } from "../../types";
import { Badge } from "../common/Badge";

interface OwnerMaintenanceViewProps {
  maintenanceRequests: MaintenanceRequest[];
  properties: Property[];
  units: Unit[];
}

export const OwnerMaintenanceView: React.FC<OwnerMaintenanceViewProps> = ({
  maintenanceRequests,
  properties,
  units,
}) => {
  const { language, formatAED } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [bearerFilter, setBearerFilter] = useState<string>("ALL");

  const metrics = useMemo(() => {
    const total = maintenanceRequests.length;
    const completed = maintenanceRequests.filter((m) => m.status === "COMPLETED");
    const inProgress = maintenanceRequests.filter((m) => m.status === "IN_PROGRESS");
    const pending = maintenanceRequests.filter((m) => m.status === "OPEN");
    const ownerBorne = maintenanceRequests.filter((m) => m.costBearer === "OWNER");
    const totalOwnerCost = ownerBorne.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    return {
      total,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      pendingCount: pending.length,
      ownerBorneCount: ownerBorne.length,
      totalOwnerCost,
    };
  }, [maintenanceRequests]);

  const filteredRequests = useMemo(() => {
    return maintenanceRequests.filter((m) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "COMPLETED" && m.status !== "COMPLETED") return false;
        if (statusFilter === "ACTIVE" && (m.status === "COMPLETED" || m.status === "CANCELLED" || m.status === "REJECTED")) return false;
        if (statusFilter === "PENDING" && m.status !== "OPEN") return false;
      }

      if (bearerFilter !== "ALL") {
        if (bearerFilter === "OWNER" && m.costBearer !== "OWNER") return false;
        if (bearerFilter === "TENANT" && m.costBearer !== "TENANT") return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const matchNum = (m.requestNumber || "").toLowerCase().includes(term);
      const matchCat = (m.category || "").toLowerCase().includes(term);
      const matchDesc = (m.issueDescription || "").toLowerCase().includes(term);
      return matchNum || matchCat || matchDesc;
    });
  }, [maintenanceRequests, statusFilter, bearerFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">{language === "ar" ? "إجمالي البلاغات" : "Total Tickets"}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900">{metrics.total}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">{language === "ar" ? "بلاغ صيانة مسجل" : "tickets recorded"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700">{language === "ar" ? "قيد المعالجة والإصلاح" : "In Progress"}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-950">{metrics.inProgressCount}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">{language === "ar" ? "بلاغ جارٍ متابعته" : "under active repair"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700">{language === "ar" ? "تم الإنجاز والإغلاق" : "Completed"}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-950">{metrics.completedCount}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">{language === "ar" ? "بلاغ مكتمل بنجاح" : "completed"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-700">{language === "ar" ? "تكاليف على المالك" : "Owner Incurred Cost"}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-950">{formatAED(metrics.totalOwnerCost)}</div>
          <div className="text-[11px] text-rose-700 font-medium mt-1">{metrics.ownerBorneCount} {language === "ar" ? "بلاغ مستقطع" : "billed to owner"}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === "ar" ? "بحث برقم البلاغ، العنوان، أو الوصف..." : "Search ticket #, title, or description..."}
            className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-900 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {language === "ar" ? "الكل" : "All"}
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "ACTIVE" ? "bg-white text-amber-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {language === "ar" ? "النشطة" : "Active"}
            </button>
            <button
              onClick={() => setStatusFilter("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "COMPLETED" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {language === "ar" ? "المكتملة" : "Completed"}
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Tickets Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                <th className="py-3 px-4 text-start">{language === "ar" ? "رقم البلاغ" : "Ticket #"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "التاريخ" : "Date"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "العقار / الوحدة" : "Property / Unit"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "نوع العطل والبيان" : "Issue / Details"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "تحمل التكلفة" : "Cost Bearer"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4 text-end">{language === "ar" ? "التكلفة (درهم)" : "Cost (AED)"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p>{language === "ar" ? "لا توجد بلاغات صيانة مسجلة" : "No maintenance tickets found"}</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((m) => {
                  const unit = units.find((u) => u.id === m.unitId);
                  const prop = unit ? properties.find((p) => p.id === unit.propertyId) : null;
                  const cost = m.totalCost || 0;
                  const bearer = m.costBearer || "OWNER";

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {m.requestNumber || `MR-${m.id.slice(0, 6)}`}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {m.requestDate || (m as any).createdAt?.slice(0, 10) || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "—"}
                        {unit && <span className="text-slate-400 font-mono text-[11px]"> • {unit.unitNumber}</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium max-w-xs">
                        <div className="font-bold text-slate-900 truncate">{m.category}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{m.issueDescription}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            bearer === "OWNER"
                              ? "bg-amber-100/70 text-amber-900"
                              : bearer === "TENANT"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {bearer === "OWNER"
                            ? (language === "ar" ? "على المالك" : "Owner")
                            : bearer === "TENANT"
                            ? (language === "ar" ? "على المستأجر" : "Tenant")
                            : (language === "ar" ? "على الإدارة" : "Office")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {m.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            {language === "ar" ? "مكتمل" : "Completed"}
                          </span>
                        ) : m.status === "IN_PROGRESS" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3" />
                            {language === "ar" ? "قيد التنفيذ" : "In Progress"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            {language === "ar" ? "جديد" : "New"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end font-mono font-bold text-slate-900 whitespace-nowrap">
                        {cost > 0 ? formatAED(cost) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
