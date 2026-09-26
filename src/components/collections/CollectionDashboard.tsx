import React, { useMemo } from "react";
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  BarChart3,
  Calendar,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";

export const CollectionDashboard: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { tenants, getTenantReceivablePosition, paymentPromises, collectionActions, cheques } = useData();

  const bouncedChequesCount = useMemo(() => cheques.filter(c => c.status === "BOUNCED").length, [cheques]);

  const metrics = useMemo(() => {
    const allPositions = tenants.map(t => getTenantReceivablePosition(t.id));
    
    const totalOutstanding = allPositions.reduce((sum, p) => sum + p.outstanding, 0);
    const totalOverdue = allPositions.reduce((sum, p) => sum + (p.outstanding - p.aging.current), 0);
    const totalBouncedAmount = allPositions.reduce((sum, p) => sum + p.bouncedChequeAmount, 0);
    
    const aging = {
      current: allPositions.reduce((sum, p) => sum + p.aging.current, 0),
      days1_30: allPositions.reduce((sum, p) => sum + p.aging.days1_30, 0),
      days31_60: allPositions.reduce((sum, p) => sum + p.aging.days31_60, 0),
      days61_90: allPositions.reduce((sum, p) => sum + p.aging.days61_90, 0),
      days91_120: allPositions.reduce((sum, p) => sum + p.aging.days91_120, 0),
      days121Plus: allPositions.reduce((sum, p) => sum + p.aging.days121Plus, 0),
    };

    const activePromises = paymentPromises.filter(p => p.status === "ACTIVE");
    const totalPromised = activePromises.reduce((sum, p) => sum + p.amountPromised, 0);
    const brokenPromisesCount = paymentPromises.filter(p => p.status === "BROKEN").length;

    return {
      totalOutstanding,
      totalOverdue,
      totalBouncedAmount,
      totalPromised,
      brokenPromisesCount,
      aging,
      criticalCount: allPositions.filter(p => p.priority === "CRITICAL").length,
      highPriorityCount: allPositions.filter(p => p.priority === "HIGH").length,
    };
  }, [tenants, getTenantReceivablePosition, paymentPromises]);

  const agingData = [
    { name: isAr ? "حالي" : "Current", value: metrics.aging.current, color: "#10b981" },
    { name: "1-30", value: metrics.aging.days1_30, color: "#fbbf24" },
    { name: "31-60", value: metrics.aging.days31_60, color: "#f59e0b" },
    { name: "61-90", value: metrics.aging.days61_90, color: "#ea580c" },
    { name: "91-120", value: metrics.aging.days91_120, color: "#dc2626" },
    { name: "121+", value: metrics.aging.days121Plus, color: "#7f1d1d" },
  ];

  const cards = [
    {
      label: isAr ? "إجمالي المديونية" : "Total Outstanding",
      value: metrics.totalOutstanding,
      icon: TrendingUp,
      color: "emerald",
      subLabel: isAr ? "إجمالي ذمم المستأجرين" : "Total tenant receivables",
    },
    {
      label: isAr ? "إجمالي المتأخرات" : "Total Overdue",
      value: metrics.totalOverdue,
      icon: Clock,
      color: "rose",
      subLabel: isAr ? "مبالغ تجاوزت موعد الاستحقاق" : "Amounts past due date",
    },
    {
      label: isAr ? "شيكات مرتجعة" : "Bounced Amount",
      value: metrics.totalBouncedAmount,
      icon: AlertTriangle,
      color: "amber",
      subLabel: isAr ? "قيد المتابعة والتحصيل" : "Under recovery collection",
    },
    {
      label: isAr ? "مبالغ موعودة" : "Promised Amount",
      value: metrics.totalPromised,
      icon: CheckCircle2,
      color: "indigo",
      subLabel: isAr ? "وعود سداد نشطة" : "Active payment promises",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2 rounded-xl bg-${card.color}-50 dark:bg-${card.color}-950/30 text-${card.color}-600 dark:text-${card.color}-400`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                <ArrowUpRight className="w-3 h-3" />
                <span>+2.4%</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {card.value.toLocaleString()} <span className="text-xs font-normal text-slate-400">AED</span>
            </div>
            <div className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{card.label}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{card.subLabel}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Distribution */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>{isAr ? "توزيع أعمار الديون" : "Debt Aging Distribution"}</span>
          </h3>
          
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {agingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Status */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>{isAr ? "حالات التحصيل الحرجة" : "Critical Collection Priority"}</span>
          </h3>
          
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/50">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-white font-bold">
                   {metrics.criticalCount}
                 </div>
                 <div>
                   <div className="font-bold text-rose-700 dark:text-rose-400">{isAr ? "حرجة جداً" : "Critical Priority"}</div>
                   <div className="text-[10px] text-rose-600/70">{isAr ? "تتطلب إجراء قانوني فوري" : "Requires immediate legal action"}</div>
                 </div>
               </div>
               <ArrowUpRight className="w-5 h-5 text-rose-600" />
             </div>

             <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/50">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold">
                   {metrics.highPriorityCount}
                 </div>
                 <div>
                   <div className="font-bold text-amber-700 dark:text-amber-400">{isAr ? "عالية الأولوية" : "High Priority"}</div>
                   <div className="text-[10px] text-amber-600/70">{isAr ? "متابعة مكثفة مطلوبة" : "Intensive follow-up required"}</div>
                 </div>
               </div>
               <ArrowUpRight className="w-5 h-5 text-amber-600" />
             </div>

             <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-slate-500">{isAr ? "وعود السداد المكسورة" : "Broken Promises"}</div>
                  <div className="text-sm font-bold text-rose-600">{metrics.brokenPromisesCount}</div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                   <div 
                    className="bg-rose-500 h-full" 
                    style={{ width: `${Math.min(100, (metrics.brokenPromisesCount / (paymentPromises.length || 1)) * 100)}%` }} 
                   />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
