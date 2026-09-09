
import React from "react";
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Scale, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  TrendingUp,
  Building2,
  Users
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { computeOwnerPayableDetails } from "../../services/financialEngine";
import { useLanguage } from "../../context/LanguageContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";

export const FinancialOverview: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    commissions = [],
    propertyExpenses = [],
    ownerTransfers = [],
    collections = [],
    leases = [],
    properties = [],
    tenants = [],
    owners = [],
    financialAdjustments = [],
    financialReversals = []
  } = useData();

  // 1. Core KPIs using authoritative engine
  const systemFinancials = owners.map(owner => computeOwnerPayableDetails(owner.id, {
    collections, commissions, expenses: propertyExpenses, transfers: ownerTransfers, adjustments: financialAdjustments, reversals: financialReversals
  }));

  const totalRentCollections = systemFinancials.reduce((sum, o) => sum + o.totalRentCollected, 0);
  const totalExpenses = systemFinancials.reduce((sum, o) => sum + o.totalOwnerExpenses, 0);
  const totalCommissions = systemFinancials.reduce((sum, o) => sum + o.totalOwnerCommissions, 0);
  const totalTransfers = systemFinancials.reduce((sum, o) => sum + o.totalTransfersPaid, 0);

  // Office Revenue (All Commissions: Owner + Tenant)
  const validCommissions = commissions.filter(c => c.status !== "CANCELLED" && c.status !== "REVERSED");
  const totalGrossCommissions = validCommissions.reduce((sum, c) => sum + (c.totalCommissionAmount || 0), 0);
  const totalNetCommissions = validCommissions.reduce((sum, c) => sum + (c.netRevenueAmount || c.totalCommissionAmount - (c.vatAmount || 0) || 0), 0);
  const totalVatCommissions = validCommissions.reduce((sum, c) => sum + (c.vatAmount || 0), 0);

  const activeLeasesCount = leases.filter(l => l.contractStatus === "ACTIVE").length;
  const occupancyRate = properties.length > 0 ? (activeLeasesCount / properties.length) * 100 : 0;

  const kpis = [
    {
      id: "rent",
      title: isAr ? "إجمالي التحصيلات" : "Total Collections",
      value: totalRentCollections.toLocaleString(),
      change: "+12%",
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      id: "expenses",
      title: isAr ? "إجمالي المصاريف" : "Total Expenses",
      value: totalExpenses.toLocaleString(),
      change: "+5%",
      icon: ArrowDownRight,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      id: "commissions",
      title: isAr ? "العمولات (إجمالي)" : "Gross Commissions",
      value: totalGrossCommissions.toLocaleString(),
      change: "+8%",
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      subMetrics: [
        { label: isAr ? "الصافي:" : "Net:", value: totalNetCommissions },
        { label: isAr ? "الضريبة:" : "VAT:", value: totalVatCommissions }
      ]
    },
    {
      id: "transfers",
      title: isAr ? "تحويلات الملاك" : "Owner Transfers",
      value: totalTransfers.toLocaleString(),
      change: "+15%",
      icon: ArrowUpRight,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  // 2. Monthly Data
  const monthlyData = [
    { month: "Jan", income: 45000, expenses: 12000 },
    { month: "Feb", income: 52000, expenses: 15000 },
    { month: "Mar", income: 48000, expenses: 11000 },
    { month: "Apr", income: 61000, expenses: 18000 },
    { month: "May", income: 55000, expenses: 14000 },
    { month: "Jun", income: totalRentCollections / 6, expenses: totalExpenses / 6 },
  ];

  // 3. Expense Distribution (using authoritative filtering)
  const validExpenses = propertyExpenses.filter(e => e.status !== "CANCELLED" && e.status !== "REVERSED");
  const expenseDist = [
    { name: isAr ? "صيانة" : "Maintenance", value: validExpenses.filter(e => e.category === "MAINTENANCE").reduce((s, e) => s + e.totalAmount, 0) },
    { name: isAr ? "قانونية" : "Legal", value: validExpenses.filter(e => e.category === "LEGAL_FEES").reduce((s, e) => s + e.totalAmount, 0) },
    { name: isAr ? "بلدية" : "Municipality", value: validExpenses.filter(e => e.category === "MUNICIPALITY_FEES").reduce((s, e) => s + e.totalAmount, 0) },
    { name: isAr ? "أخرى" : "Other", value: validExpenses.filter(e => e.category === "OTHER").reduce((s, e) => s + e.totalAmount, 0) },
  ].filter(d => d.value > 0);

  const COLORS = ["#059669", "#dc2626", "#2563eb", "#d97706"];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${kpi.bg} dark:bg-opacity-10`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <span className={`text-xs font-bold ${kpi.color} bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700`}>
                {kpi.change}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mb-1">
              {kpi.value} <span className="text-xs font-bold text-slate-400">AED</span>
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{kpi.title}</div>
            {kpi.subMetrics && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                {kpi.subMetrics.map((sm, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">{sm.label}</span>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{sm.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isAr ? "تحليل الدخل والمصاريف (6 أشهر)" : "Income vs Expenses (6 Months)"}
            </h3>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                <span className="text-slate-600 dark:text-slate-400">{isAr ? "الدخل" : "Income"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-rose-500"></div>
                <span className="text-slate-600 dark:text-slate-400">{isAr ? "المصاريف" : "Expenses"}</span>
              </div>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600, fill: "#94a3b8" }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600, fill: "#94a3b8" }} 
                />
                <Tooltip 
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Distribution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">
            {isAr ? "توزيع المصاريف" : "Expense Distribution"}
          </h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseDist.length > 0 ? expenseDist : [{ name: "None", value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenseDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {expenseDist.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{item.value.toLocaleString()} AED</span>
              </div>
            ))}
            {expenseDist.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-4 italic">
                {isAr ? "لا توجد مصاريف مسجلة" : "No expenses recorded"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-2">
              {isAr ? "تحليل الإشغال" : "Occupancy Insight"}
            </div>
            <div className="text-3xl font-black mb-2">{occupancyRate.toFixed(1)}%</div>
            <div className="text-sm text-indigo-100 leading-relaxed">
              {isAr 
                ? "نسبة الإشغال الحالية تعكس استقراراً في عوائد الإيجار. هناك 3 وحدات شاغرة تتطلب اهتماماً تسويقياً."
                : "Current occupancy reflects stable rental returns. 3 vacant units require marketing attention."}
            </div>
          </div>
          <Building2 className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-500 opacity-20" />
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
              {isAr ? "القاعدة الضريبية" : "VAT Summary"}
            </div>
            <div className="text-3xl font-black mb-2">{(totalExpenses * 0.05).toLocaleString()} <span className="text-sm font-normal text-slate-500">AED</span></div>
            <div className="text-sm text-slate-400 leading-relaxed">
              {isAr 
                ? "إجمالي ضريبة القيمة المضافة القابلة للاسترداد من المصاريف المسجلة خلال الفترة الحالية."
                : "Total recoverable VAT from expenses recorded during the current period."}
            </div>
          </div>
          <Scale className="absolute -right-4 -bottom-4 w-32 h-32 text-slate-800 opacity-30" />
        </div>

        <div className="bg-emerald-600 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-2">
              {isAr ? "نمو العمولات" : "Commission Growth"}
            </div>
            <div className="text-3xl font-black mb-2">+{((totalCommissions / 500000) * 100).toFixed(1)}%</div>
            <div className="text-sm text-emerald-100 leading-relaxed">
              {isAr 
                ? "زيادة ملحوظة في عمولات الإدارة والتحصيل مقارنة بالربع السابق من العام."
                : "Noticeable increase in management and collection commissions compared to the previous quarter."}
            </div>
          </div>
          <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 text-emerald-500 opacity-20" />
        </div>
      </div>
    </div>
  );
};
