import React, { useState, useMemo } from "react";
import {
  Building2,
  Layers,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  UserCheck,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { Property, Unit, Lease, Tenant, Cheque } from "../../types";
import { Badge } from "../common/Badge";

interface OwnerPropertiesReviewProps {
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  tenants: Tenant[];
  cheques: Cheque[];
}

export const OwnerPropertiesReview: React.FC<OwnerPropertiesReviewProps> = ({
  properties,
  units,
  leases,
  tenants,
  cheques,
}) => {
  const { language, formatAED } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OCCUPIED" | "VACANT">("ALL");
  const [expandedPropertyIds, setExpandedPropertyIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (propId: string) => {
    setExpandedPropertyIds((prev) => ({
      ...prev,
      [propId]: !prev[propId],
    }));
  };

  // Filter properties
  const filteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      if (selectedPropertyId !== "ALL" && prop.id !== selectedPropertyId) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const matchNameEn = (prop.nameEn || "").toLowerCase().includes(term);
      const matchNameAr = (prop.nameAr || "").includes(term);
      const matchCode = (prop.code || "").toLowerCase().includes(term);
      const matchEmirate = (prop.emirate || "").toLowerCase().includes(term);
      const matchCommunity = (prop.community || "").toLowerCase().includes(term);
      return matchNameEn || matchNameAr || matchCode || matchEmirate || matchCommunity;
    });
  }, [properties, selectedPropertyId, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header with Search and Quick Filters */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              language === "ar"
                ? "بحث باسم العقار، الكود، الإمارة، أو المنطقة..."
                : "Search property name, code, emirate, or community..."
            }
            className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-900 font-medium"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Property Filter dropdown */}
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ALL">
              {language === "ar" ? "جميع العقارات" : "All Properties"} ({properties.length})
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {language === "ar" ? p.nameAr : p.nameEn} ({p.code})
              </option>
            ))}
          </select>

          {/* Status Filter */}
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
              onClick={() => setStatusFilter("OCCUPIED")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "OCCUPIED" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {language === "ar" ? "مؤجرة" : "Occupied"}
            </button>
            <button
              onClick={() => setStatusFilter("VACANT")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "VACANT" ? "bg-white text-rose-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {language === "ar" ? "شاغرة" : "Vacant"}
            </button>
          </div>
        </div>
      </div>

      {/* Properties Cards List */}
      {filteredProperties.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">
            {language === "ar" ? "لم يتم العثور على عقارات مطابقة" : "No matching properties found"}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar" ? "جرب تغيير خيارات البحث أو التصفية" : "Try changing search terms or filter criteria"}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredProperties.map((prop) => {
            const propUnits = units.filter((u) => u.propertyId === prop.id);
            const occupiedUnits = propUnits.filter((u) => u.status === "OCCUPIED");
            const vacantUnits = propUnits.filter((u) => u.status === "VACANT");
            const occupancyPct = propUnits.length > 0 ? Math.round((occupiedUnits.length / propUnits.length) * 100) : 0;

            const propLeases = leases.filter((l) => l.propertyId === prop.id && l.contractStatus === "ACTIVE");
            const totalAnnualRent = propLeases.reduce((sum, l) => sum + (l.annualRent || 0), 0);

            // Filter units for view
            const visibleUnits = propUnits.filter((u) => {
              if (statusFilter === "OCCUPIED") return u.status === "OCCUPIED";
              if (statusFilter === "VACANT") return u.status === "VACANT";
              return true;
            });

            const isExpanded = expandedPropertyIds[prop.id] ?? true; // Default expanded

            return (
              <div
                key={prop.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
              >
                {/* Property Card Header */}
                <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100/70 text-amber-800 flex items-center justify-center font-black text-lg shrink-0 border border-amber-200">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-slate-900">
                          {language === "ar" ? prop.nameAr : prop.nameEn}
                        </h3>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700">
                          {prop.code}
                        </span>
                        <Badge variant="default" className="text-[11px] font-bold">
                          {prop.type || (language === "ar" ? "مبنى سكني" : "Residential")}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {prop.emirate} {prop.community ? `• ${prop.community}` : ""}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-medium">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          {propUnits.length} {language === "ar" ? "وحدة إجمالية" : "total units"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200/70 text-center">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        {language === "ar" ? "نسبة الإشغال" : "Occupancy"}
                      </div>
                      <div className="text-sm font-black text-slate-900 flex items-center gap-1 justify-center mt-0.5">
                        <span className={occupancyPct === 100 ? "text-emerald-700" : "text-amber-700"}>
                          {occupancyPct}%
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          ({occupiedUnits.length}/{propUnits.length})
                        </span>
                      </div>
                    </div>

                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200/70 text-center">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        {language === "ar" ? "إجمالي الإيجار السنوي" : "Annual Rent"}
                      </div>
                      <div className="text-sm font-black text-emerald-800 mt-0.5">
                        {formatAED(totalAnnualRent)}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(prop.id)}
                      className="p-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Units Breakdown Table / Grid */}
                {isExpanded && (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <span>{language === "ar" ? "جدول الوحدات السكنية والتجارية" : "Units & Tenancy Schedule"}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {visibleUnits.length}
                        </span>
                      </h4>
                    </div>

                    {visibleUnits.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        {language === "ar" ? "لا توجد وحدات مطابقة للفلتر المحدد" : "No units match selected status filter"}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-start border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-bold text-[11px] bg-slate-50/50">
                              <th className="py-2.5 px-3 text-start">{language === "ar" ? "رقم الوحدة" : "Unit #"}</th>
                              <th className="py-2.5 px-3 text-start">{language === "ar" ? "النوع / الطابق" : "Type / Floor"}</th>
                              <th className="py-2.5 px-3 text-start">{language === "ar" ? "الحالة" : "Status"}</th>
                              <th className="py-2.5 px-3 text-start">{language === "ar" ? "المستأجر الحالي" : "Tenant"}</th>
                              <th className="py-2.5 px-3 text-start">{language === "ar" ? "مدة العقد" : "Lease Term"}</th>
                              <th className="py-2.5 px-3 text-end">{language === "ar" ? "الإيجار السنوي" : "Annual Rent"}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {visibleUnits.map((u) => {
                              const activeLease = leases.find(
                                (l) => l.unitId === u.id && l.contractStatus === "ACTIVE"
                              );
                              const tenant = activeLease
                                ? tenants.find((t) => t.id === activeLease.tenantId)
                                : null;

                              return (
                                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-3 px-3 font-bold text-slate-900">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                                      <span>{u.unitNumber}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-slate-600">
                                    {u.type || "2BR"} {u.floor ? `• ${language === "ar" ? "طابق" : "Fl."} ${u.floor}` : ""}
                                  </td>
                                  <td className="py-3 px-3">
                                    {u.status === "OCCUPIED" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3" />
                                        {language === "ar" ? "مؤجرة" : "Occupied"}
                                      </span>
                                    ) : u.status === "VACANT" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        <Clock className="w-3 h-3" />
                                        {language === "ar" ? "شاغرة" : "Vacant"}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        <AlertTriangle className="w-3 h-3" />
                                        {language === "ar" ? "صيانة" : "Maintenance"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3">
                                    {tenant ? (
                                      <div className="font-bold text-slate-800">
                                        {language === "ar" ? tenant.nameAr || tenant.nameEn : tenant.nameEn || tenant.nameAr}
                                        {tenant.phone && (
                                          <div className="text-[10px] font-mono text-slate-400 font-normal">
                                            {tenant.phone}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">
                                        {language === "ar" ? "لا يوجد مستأجر حالي" : "No active tenant"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-slate-500">
                                    {activeLease ? (
                                      <div className="text-[11px]">
                                        <span>{activeLease.startDate}</span>
                                        <span className="mx-1">→</span>
                                        <span>{activeLease.endDate}</span>
                                      </div>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-end font-bold text-slate-900 font-mono">
                                    {activeLease ? formatAED(activeLease.annualRent) : formatAED(u.annualRent || 0)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
