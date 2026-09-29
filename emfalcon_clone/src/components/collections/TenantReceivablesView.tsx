import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  User,
  Building2,
  Phone,
  Mail,
  AlertCircle,
  Clock,
  ArrowRight,
  MoreVertical,
  MessageSquare,
  HandCoins,
  Gavel,
  CheckCircle2,
  BadgePercent,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { SearchableSelect } from "../common/SearchableSelect";

export const TenantReceivablesView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { tenants, properties, leases, getTenantReceivablePosition } = useData();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const receivablePositions = useMemo(() => {
    return tenants.map(t => {
      const pos = getTenantReceivablePosition(t.id);
      const activeLease = leases.find(l => l.tenantId === t.id && (l.contractStatus === "ACTIVE" || l.contractStatus === "RENEWED"));
      const property = activeLease ? properties.find(p => p.id === activeLease.propertyId) : null;
      
      return {
        ...pos,
        tenant: t,
        lease: activeLease,
        property
      };
    });
  }, [tenants, getTenantReceivablePosition, leases, properties]);

  const filteredData = receivablePositions.filter(p => {
    const matchesSearch = 
      p.tenant.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tenant.nameAr.includes(searchQuery) ||
      p.tenant.id.includes(searchQuery);
    
    const matchesProperty = propertyFilter === "ALL" || p.property?.id === propertyFilter;
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    const matchesPriority = priorityFilter === "ALL" || p.priority === priorityFilter;
    
    return matchesSearch && matchesProperty && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isAr ? "بحث بالاسم أو المعرف..." : "Search by name or ID..."}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="w-48">
          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "كل الحالات" : "All Statuses" },
              { id: "CURRENT", label: isAr ? "منتظم" : "Current" },
              { id: "DUE_SOON", label: isAr ? "يستحق قريباً" : "Due Soon" },
              { id: "OVERDUE", label: isAr ? "متأخر" : "Overdue" },
              { id: "SEVERELY_OVERDUE", label: isAr ? "متأخر جداً" : "Severely Overdue" },
              { id: "LEGAL_ESCALATION", label: isAr ? "تصعيد قانوني" : "Legal Escalation" },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            placeholder={isAr ? "اختر الحالة..." : "Select status..."}
          />
        </div>

        <div className="w-48">
          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "كل الأولويات" : "All Priorities" },
              { id: "LOW", label: isAr ? "منخفضة" : "Low" },
              { id: "MEDIUM", label: isAr ? "متوسطة" : "Medium" },
              { id: "HIGH", label: isAr ? "عالية" : "High" },
              { id: "CRITICAL", label: isAr ? "حرجة" : "Critical" },
            ]}
            value={priorityFilter}
            onChange={(val) => setPriorityFilter(val)}
            placeholder={isAr ? "اختر الأولوية..." : "Select priority..."}
          />
        </div>
      </div>

      {/* Grid of Receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredData.map((pos) => (
          <div key={pos.tenantId} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-full hover:border-emerald-200 transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/30 group-hover:text-emerald-600 transition-all">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                    {isAr ? pos.tenant.nameAr : pos.tenant.nameEn}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <Building2 className="w-3 h-3" />
                    <span>{pos.property ? (isAr ? pos.property.nameAr : pos.property.nameEn) : "---"}</span>
                    {pos.lease && <span className="text-emerald-600 font-bold ml-1 rtl:mr-1">#{pos.lease.leaseNumber}</span>}
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                pos.priority === "CRITICAL" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" :
                pos.priority === "HIGH" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
                "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
              }`}>
                {pos.priority}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "إجمالي المستحق" : "Total Due"}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{Number(pos.totalDue || 0).toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">{isAr ? "إجمالي المحصل" : "Total Paid"}</div>
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{Number(pos.totalPaid || 0).toLocaleString()}</div>
              </div>
              <div className={`p-3 rounded-2xl ${pos.outstanding > 0 ? "bg-rose-50 dark:bg-rose-950/30" : "bg-slate-50 dark:bg-slate-900/50"}`}>
                <div className={`text-[10px] font-bold uppercase mb-1 ${pos.outstanding > 0 ? "text-rose-600" : "text-slate-400"}`}>
                  {isAr ? "المتبقي" : "Outstanding"}
                </div>
                <div className={`text-sm font-bold ${pos.outstanding > 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                  {Number(pos.outstanding || 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-3 flex-1">
               {/* Details Break-down */}
               <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{isAr ? "شيكات مرتجعة" : "Bounced Cheques"}</span>
                  </div>
                  <div className={`text-right font-bold ${pos.bouncedChequeAmount > 0 ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>
                    {Number(pos.bouncedChequeAmount || 0).toLocaleString()} AED
                  </div>

                  <div className="flex items-center gap-2 text-slate-500">
                    <BadgePercent className="w-3.5 h-3.5" />
                    <span>{isAr ? "رسوم إدارية" : "Admin Fees"}</span>
                  </div>
                  <div className="text-right font-bold text-slate-900 dark:text-white">
                    {Number(pos.administrativeFeesDue || 0).toLocaleString()} AED
                  </div>

                  <div className="flex items-center gap-2 text-slate-500">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{isAr ? "صيانة/قضايا" : "Maint/Legal"}</span>
                  </div>
                  <div className="text-right font-bold text-slate-900 dark:text-white">
                    {(pos.maintenanceChargesDue + pos.legalChargesDue).toLocaleString()} AED
                  </div>
               </div>

               {/* Aging Preview */}
               <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-2">
                 <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">{isAr ? "أعمار الديون" : "Debt Aging"}</div>
                 <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                    {Object.entries(pos.aging).map(([key, val], idx) => (
                      <div 
                        key={key} 
                        className={`h-full ${
                          idx === 0 ? "bg-emerald-500" : 
                          idx === 1 ? "bg-amber-400" : 
                          idx === 2 ? "bg-amber-500" : 
                          idx === 3 ? "bg-orange-600" : 
                          idx === 4 ? "bg-rose-600" : "bg-rose-900"
                        }`}
                        style={{ width: `${pos.outstanding > 0 ? ((val as number) / pos.outstanding) * 100 : 0}%` }}
                      />
                    ))}
                 </div>
               </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 pt-6 border-t border-slate-50 dark:border-slate-700">
              <div className="flex items-center gap-2">
                 <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-600 hover:text-white transition-all">
                   <Phone className="w-4 h-4" />
                 </button>
                 <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-600 hover:text-white transition-all">
                   <MessageSquare className="w-4 h-4" />
                 </button>
              </div>
              
              <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10">
                <span>{isAr ? "إجراء تحصيل" : "Collect Debt"}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
