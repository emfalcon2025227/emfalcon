import React, { useState, useEffect } from "react";
import { Filter, Calendar, UserCheck, Users, Building2, Layers } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { SearchableSelect } from "../common/SearchableSelect";

interface FilterBarProps {
  onFilterChange: (filters: { fromDate: string; toDate: string; ownerId: string; tenantId: string; propertyId: string }) => void;
  showDateRange?: boolean;
  showEntityFilters?: boolean;
  owners?: any[];
  tenants?: any[];
  properties?: any[];
  defaultMode?: "all" | "owner" | "tenant";
}

export const FinancialFilterBar: React.FC<FilterBarProps> = ({ 
  onFilterChange, 
  showDateRange = true,
  showEntityFilters = false,
  owners = [],
  tenants = [],
  properties = [],
  defaultMode = "all"
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [filterMode, setFilterMode] = useState<"all" | "owner" | "tenant">(defaultMode);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");

  useEffect(() => {
    setFilterMode(defaultMode);
  }, [defaultMode]);

  const handleFilter = () => {
    onFilterChange({ 
      fromDate, 
      toDate, 
      ownerId: filterMode === "tenant" ? "" : ownerId, 
      tenantId: filterMode === "owner" ? "" : tenantId, 
      propertyId 
    });
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setOwnerId("");
    setTenantId("");
    setPropertyId("");
    onFilterChange({ fromDate: "", toDate: "", ownerId: "", tenantId: "", propertyId: "" });
  };

  const handleModeChange = (newMode: "all" | "owner" | "tenant") => {
    setFilterMode(newMode);
    if (newMode === "owner") {
      setTenantId("");
      onFilterChange({ fromDate, toDate, ownerId, tenantId: "", propertyId });
    } else if (newMode === "tenant") {
      setOwnerId("");
      onFilterChange({ fromDate, toDate, ownerId: "", tenantId, propertyId });
    } else {
      onFilterChange({ fromDate, toDate, ownerId, tenantId, propertyId });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>{isAr ? "فلاتر التقرير المحاسبي" : "Financial Report Filters"}</span>
        </div>

        {showEntityFilters && (
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => handleModeChange("owner")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === "owner"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isAr ? "فلتر الملاك فقط" : "Owner Report Filter"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("tenant")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === "tenant"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isAr ? "فلتر المستأجرين فقط" : "Tenant Report Filter"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === "all"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isAr ? "جميع الفلاتر" : "All Filters"}</span>
            </button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {showDateRange && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "من تاريخ" : "From Date"}</label>
              <input 
                type="date" 
                value={fromDate} 
                onChange={(e) => {
                  const val = e.target.value;
                  setFromDate(val);
                  onFilterChange({ fromDate: val, toDate, ownerId: filterMode === "tenant" ? "" : ownerId, tenantId: filterMode === "owner" ? "" : tenantId, propertyId });
                }} 
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "إلى تاريخ" : "To Date"}</label>
              <input 
                type="date" 
                value={toDate} 
                onChange={(e) => {
                  const val = e.target.value;
                  setToDate(val);
                  onFilterChange({ fromDate, toDate: val, ownerId: filterMode === "tenant" ? "" : ownerId, tenantId: filterMode === "owner" ? "" : tenantId, propertyId });
                }} 
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" 
              />
            </div>
          </>
        )}
        
        {showEntityFilters && (
          <>
            {(filterMode === "owner" || filterMode === "all") && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "اختيار المالك" : "Owner"}</label>
                <SearchableSelect 
                  options={owners.map(o => ({ 
                    id: o.id, 
                    title: isAr ? o.nameAr : o.nameEn, 
                    subLabel: `المالك: ${isAr ? o.nameAr : o.nameEn}` 
                  }))}
                  value={ownerId}
                  onChange={(val) => {
                    setOwnerId(val);
                    onFilterChange({ fromDate, toDate, ownerId: val, tenantId: filterMode === "owner" ? "" : tenantId, propertyId });
                  }}
                  placeholder={isAr ? "-- اختر المالك --" : "-- Select Owner --"}
                  searchPlaceholder={isAr ? "ابحث عن المالك بالاسم أو الكود..." : "Search owner by name..."}
                />
              </div>
            )}

            {(filterMode === "tenant" || filterMode === "all") && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "اختيار المستأجر" : "Tenant"}</label>
                <SearchableSelect 
                  options={tenants.map(t => ({ 
                    id: t.id, 
                    title: isAr ? t.nameAr : t.nameEn, 
                    subLabel: `المستأجر: ${isAr ? t.nameAr : t.nameEn}` 
                  }))}
                  value={tenantId}
                  onChange={(val) => {
                    setTenantId(val);
                    onFilterChange({ fromDate, toDate, ownerId: filterMode === "tenant" ? "" : ownerId, tenantId: val, propertyId });
                  }}
                  placeholder={isAr ? "-- اختر المستأجر --" : "-- Select Tenant --"}
                  searchPlaceholder={isAr ? "ابحث عن المستأجر بالاسم أو الكود..." : "Search tenant by name..."}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "اختيار العقار" : "Property"}</label>
              <SearchableSelect 
                options={properties.map(p => {
                  const owner = owners.find(o => o.id === p.ownerId);
                  return {
                    id: p.id,
                    title: isAr ? p.nameAr : p.nameEn,
                    subLabel: `المالك: ${owner ? (isAr ? owner.nameAr : owner.nameEn) : "---"}`
                  };
                })}
                value={propertyId}
                onChange={(val) => {
                  setPropertyId(val);
                  onFilterChange({ fromDate, toDate, ownerId: filterMode === "tenant" ? "" : ownerId, tenantId: filterMode === "owner" ? "" : tenantId, propertyId: val });
                }}
                placeholder={isAr ? "-- اختر العقار --" : "-- Select Property --"}
                searchPlaceholder={isAr ? "ابحث عن العقار بالاسم أو الكود..." : "Search property by name..."}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={handleFilter} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xs">
          {isAr ? "تطبيق الفلتر" : "Apply Filter"}
        </button>
        <button onClick={handleClear} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
          {isAr ? "مسح الفلتر" : "Clear Filter"}
        </button>
      </div>
    </div>
  );
};
