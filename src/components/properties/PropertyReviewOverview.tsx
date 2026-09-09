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
  TrendingUp,
  Download,
  Printer,
  Filter,
  PieChart,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Property, Unit, Lease, Tenant, Owner } from "../../types";
import { Badge } from "../common/Badge";

export const PropertyReviewOverview: React.FC = () => {
  const { language, formatAED } = useLanguage();
  const {
    properties,
    units,
    leases,
    tenants,
    owners,
    cheques,
    maintenanceRequests,
  } = useData();

  const [searchTerm, setSearchTerm] = useState("");
  const [emirateFilter, setEmirateFilter] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [expandedPropertyIds, setExpandedPropertyIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (propId: string) => {
    setExpandedPropertyIds((prev) => ({
      ...prev,
      [propId]: !prev[propId],
    }));
  };

  // Distinct emirates for dropdown
  const emirates = useMemo(() => {
    const set = new Set(properties.map((p) => p.emirate).filter(Boolean));
    return Array.from(set);
  }, [properties]);

  // Overall portfolio analytics
  const portfolioAnalytics = useMemo(() => {
    const totalProps = properties.length;
    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === "OCCUPIED").length;
    const vacantUnits = units.filter((u) => u.status === "VACANT").length;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    const activeLeases = leases.filter((l) => l.contractStatus === "ACTIVE");
    const totalAnnualizedRent = activeLeases.reduce((s, l) => s + (l.annualRent || 0), 0);

    return {
      totalProps,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      totalAnnualizedRent,
    };
  }, [properties, units, leases]);

  // Filter properties
  const filteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      if (emirateFilter !== "ALL" && prop.emirate !== emirateFilter) return false;
      if (ownerFilter !== "ALL" && prop.ownerId !== ownerFilter) return false;
      if (typeFilter !== "ALL" && prop.type !== typeFilter) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const matchNameEn = (prop.nameEn || "").toLowerCase().includes(term);
      const matchNameAr = (prop.nameAr || "").includes(term);
      const matchCode = (prop.code || "").toLowerCase().includes(term);
      const matchCommunity = (prop.community || "").toLowerCase().includes(term);
      return matchNameEn || matchNameAr || matchCode || matchCommunity;
    });
  }, [properties, emirateFilter, ownerFilter, typeFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-amber-700" />
            <span>{language === "ar" ? "نظرة شاملة ومراجعة العقارات" : "Property Portfolio Review"}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "متابعة أداء المحفظة العقارية، نسب الإشغال، الإيرادات التعاقدية، وتفاصيل الوحدات"
              : "Overview of real estate assets, occupancy rates, contracted revenues, and unit mix"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{language === "ar" ? "طباعة التقرير" : "Print"}</span>
          </button>
        </div>
      </div>

      {/* KPI Top Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">{language === "ar" ? "إجمالي العقارات" : "Properties"}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{portfolioAnalytics.totalProps}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {portfolioAnalytics.totalUnits} {language === "ar" ? "وحدة إجمالية" : "total units"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700">{language === "ar" ? "نسبة الإشغال العام" : "Occupancy Rate"}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-950">{portfolioAnalytics.occupancyRate}%</div>
          <div className="text-[11px] text-blue-700 font-medium mt-1">
            {portfolioAnalytics.occupiedUnits} {language === "ar" ? "مؤجرة" : "occupied"} • {portfolioAnalytics.vacantUnits} {language === "ar" ? "شاغرة" : "vacant"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700">{language === "ar" ? "القيمة التأجيرية السنوية" : "Annual Leased Value"}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-950">{formatAED(portfolioAnalytics.totalAnnualizedRent)}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            {leases.filter((l) => l.contractStatus === "ACTIVE").length} {language === "ar" ? "عقد نشط" : "active leases"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">{language === "ar" ? "المُلاك المسجلون" : "Owners"}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{owners.length}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {language === "ar" ? "محافظ عقارية مدارة" : "managed portfolios"}
          </div>
        </div>
      </div>

      {/* Search & Multi-Filter Bar */}
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
                ? "بحث باسم العقار، الكود، المنطقة..."
                : "Search property name, code, community..."
            }
            className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-900 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Emirate Filter */}
          <select
            value={emirateFilter}
            onChange={(e) => setEmirateFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden"
          >
            <option value="ALL">{language === "ar" ? "جميع الإمارات" : "All Emirates"}</option>
            {emirates.map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </select>

          {/* Owner Filter */}
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden"
          >
            <option value="ALL">{language === "ar" ? "جميع المُلاك" : "All Owners"}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {language === "ar" ? o.nameAr : o.nameEn} ({o.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Properties Visual Grid */}
      <div className="space-y-4">
        {filteredProperties.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">{language === "ar" ? "لا توجد عقارات مطابقة للبحث" : "No properties found"}</p>
          </div>
        ) : (
          filteredProperties.map((prop) => {
            const propUnits = units.filter((u) => u.propertyId === prop.id);
            const occupied = propUnits.filter((u) => u.status === "OCCUPIED");
            const vacant = propUnits.filter((u) => u.status === "VACANT");
            const occPct = propUnits.length > 0 ? Math.round((occupied.length / propUnits.length) * 100) : 0;

            const propLeases = leases.filter((l) => l.propertyId === prop.id && l.contractStatus === "ACTIVE");
            const rentVal = propLeases.reduce((s, l) => s + (l.annualRent || 0), 0);
            const owner = owners.find((o) => o.id === prop.ownerId);

            const isExpanded = expandedPropertyIds[prop.id] ?? false;

            return (
              <div
                key={prop.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-slate-900">
                          {language === "ar" ? prop.nameAr : prop.nameEn}
                        </h3>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {prop.code}
                        </span>
                        {owner && (
                          <span className="text-xs text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {language === "ar" ? `المالك: ${owner.nameAr}` : `Owner: ${owner.nameEn}`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {prop.emirate} {prop.community ? `• ${prop.community}` : ""}
                        </span>
                        <span>•</span>
                        <span>{propUnits.length} {language === "ar" ? "وحدة" : "units"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-center">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{language === "ar" ? "الإشغال" : "Occupancy"}</div>
                      <div className="text-sm font-black text-slate-900">{occPct}%</div>
                    </div>

                    <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 text-center">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{language === "ar" ? "الإيجار السنوي" : "Annual Rent"}</div>
                      <div className="text-sm font-black text-emerald-700">{formatAED(rentVal)}</div>
                    </div>

                    <button
                      onClick={() => toggleExpand(prop.id)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-600 mb-3">
                      {language === "ar" ? "الوحدات والمستأجرون" : "Units & Current Tenants"}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {propUnits.map((u) => {
                        const lease = leases.find((l) => l.unitId === u.id && l.contractStatus === "ACTIVE");
                        const tenant = lease ? tenants.find((t) => t.id === lease.tenantId) : null;

                        return (
                          <div key={u.id} className="p-3 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
                            <div className="flex items-center justify-between font-bold mb-1">
                              <span className="text-slate-900">{u.unitNumber}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.status === "OCCUPIED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {u.status === "OCCUPIED" ? (language === "ar" ? "مؤجرة" : "Occupied") : (language === "ar" ? "شاغرة" : "Vacant")}
                              </span>
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              {tenant ? (language === "ar" ? tenant.nameAr || tenant.nameEn : tenant.nameEn) : (language === "ar" ? "— شاغرة —" : "— Vacant —")}
                            </div>
                            <div className="text-emerald-800 font-mono font-bold mt-1">
                              {formatAED(lease?.annualRent || u.annualRent || 0)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
