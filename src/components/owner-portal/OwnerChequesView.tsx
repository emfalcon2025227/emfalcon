import React, { useState, useMemo } from "react";
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Filter,
  DollarSign,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { Cheque, Property, Unit, Tenant } from "../../types";

interface OwnerChequesViewProps {
  cheques: Cheque[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
}

export const OwnerChequesView: React.FC<OwnerChequesViewProps> = ({
  cheques,
  properties,
  units,
  tenants,
}) => {
  const { language, formatAED } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("ALL");

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = cheques.length;
    const collected = cheques.filter((c) => c.status === "COLLECTED" || c.status === "CLEARED");
    const pending = cheques.filter((c) => c.status === "POST_DATED" || (c.status as string) === "PENDING");
    const deposited = cheques.filter((c) => c.status === "DEPOSITED");
    const bounced = cheques.filter((c) => c.status === "BOUNCED");

    return {
      total,
      totalAmt: cheques.reduce((s, c) => s + (c.amount || 0), 0),
      collectedCount: collected.length,
      collectedAmt: collected.reduce((s, c) => s + (c.amount || 0), 0),
      pendingCount: pending.length,
      pendingAmt: pending.reduce((s, c) => s + (c.amount || 0), 0),
      depositedCount: deposited.length,
      depositedAmt: deposited.reduce((s, c) => s + (c.amount || 0), 0),
      bouncedCount: bounced.length,
      bouncedAmt: bounced.reduce((s, c) => s + (c.amount || 0), 0),
    };
  }, [cheques]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "COLLECTED" && c.status !== "COLLECTED" && c.status !== "CLEARED") return false;
        if (statusFilter === "PENDING" && c.status !== "POST_DATED" && (c.status as string) !== "PENDING") return false;
        if (statusFilter === "DEPOSITED" && c.status !== "DEPOSITED") return false;
        if (statusFilter === "BOUNCED" && c.status !== "BOUNCED") return false;
      }

      if (selectedPropertyId !== "ALL" && c.propertyId !== selectedPropertyId) {
        return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const matchNum = (c.chequeNumber || "").toLowerCase().includes(term);
      const matchBank = (c.bankName || "").toLowerCase().includes(term);
      const matchDrawer = (c.drawerName || "").toLowerCase().includes(term);
      return matchNum || matchBank || matchDrawer;
    });
  }, [cheques, statusFilter, selectedPropertyId, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">{language === "ar" ? "إجمالي الشيكات" : "Total Cheques"}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900">{formatAED(metrics.totalAmt)}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">{metrics.total} {language === "ar" ? "شيك" : "cheques"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700">{language === "ar" ? "محصلة ومودعة" : "Cleared"}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-950">{formatAED(metrics.collectedAmt)}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">{metrics.collectedCount} {language === "ar" ? "شيك محصل" : "cleared"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700">{language === "ar" ? "شيكات مؤجلة (PDC)" : "Pending PDCs"}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-950">{formatAED(metrics.pendingAmt)}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">{metrics.pendingCount} {language === "ar" ? "قيد الاستحقاق" : "pending"}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-700">{language === "ar" ? "شيكات مرتجعة" : "Bounced"}</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${metrics.bouncedCount > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-black ${metrics.bouncedCount > 0 ? "text-rose-600" : "text-slate-900"}`}>{formatAED(metrics.bouncedAmt)}</div>
          <div className="text-[11px] text-rose-700 font-medium mt-1">{metrics.bouncedCount} {language === "ar" ? "مرتجع" : "bounced"}</div>
        </div>
      </div>

      {/* Search & Filter Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === "ar" ? "بحث برقم الشيك، اسم البنك، أو اسم الساحب..." : "Search cheque number, bank, or drawer..."}
            className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-900 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Property Filter */}
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden"
          >
            <option value="ALL">{language === "ar" ? "جميع العقارات" : "All Properties"}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {language === "ar" ? p.nameAr : p.nameEn}
              </option>
            ))}
          </select>

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
              onClick={() => setStatusFilter("COLLECTED")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "COLLECTED" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {language === "ar" ? "محصل" : "Cleared"}
            </button>
            <button
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "PENDING" ? "bg-white text-amber-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {language === "ar" ? "مؤجل" : "Pending"}
            </button>
            <button
              onClick={() => setStatusFilter("BOUNCED")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "BOUNCED" ? "bg-white text-rose-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {language === "ar" ? "مرتجع" : "Bounced"}
            </button>
          </div>
        </div>
      </div>

      {/* Cheques Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                <th className="py-3 px-4 text-start">{language === "ar" ? "رقم الشيك" : "Cheque #"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "البنك المسحوب عليه" : "Bank"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "العقار / الوحدة" : "Property / Unit"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "المستأجر / الساحب" : "Tenant / Drawer"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4 text-end">{language === "ar" ? "المبلغ (درهم)" : "Amount (AED)"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p>{language === "ar" ? "لا توجد شيكات مطابقة للبحث أو الفلتر" : "No cheques found matching filters"}</p>
                  </td>
                </tr>
              ) : (
                filteredCheques.map((c) => {
                  const prop = properties.find((p) => p.id === c.propertyId);
                  const unit = units.find((u) => u.id === c.unitId);
                  const tenant = tenants.find((t) => t.id === c.tenantId);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {c.chequeNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {c.bankName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {c.dueDate}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "—"}
                        {unit && <span className="text-slate-400 font-mono text-[11px]"> • {unit.unitNumber}</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {c.drawerName || (tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "—")}
                      </td>
                      <td className="py-3 px-4">
                        {c.status === "COLLECTED" || c.status === "CLEARED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            {language === "ar" ? "محصل" : "Cleared"}
                          </span>
                        ) : c.status === "BOUNCED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            {language === "ar" ? "مرتجع" : "Bounced"}
                          </span>
                        ) : c.status === "DEPOSITED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3" />
                            {language === "ar" ? "أودع بالبنك" : "Deposited"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            {language === "ar" ? "مؤجل بالخزينة" : "In Vault"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatAED(c.amount)}
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
