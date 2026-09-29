import React, { useState } from "react";
import {
  HandCoins,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { SearchableSelect } from "../common/SearchableSelect";
import { PaymentPromise, PromiseStatus } from "../../types";

export const PromisesView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { paymentPromises, tenants, addPaymentPromise, updatePaymentPromise, fulfillPaymentPromise } = useData();
  const { hasPermission } = useAuth();
  const hasEditSavedPermission = hasPermission("EDIT_SAVED_FINANCIAL_RECORDS");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleAddPromise = () => {
    if (!selectedTenantId || !amount || !expectedDate) return;

    addPaymentPromise({
      tenantId: selectedTenantId,
      leaseId: "", 
      amountPromised: parseFloat(amount),
      promiseDate,
      expectedPaymentDate: expectedDate,
      status: "ACTIVE",
      notes,
    });

    setIsAddModalOpen(false);
    setSelectedTenantId("");
    setAmount("");
    setNotes("");
  };

  const getStatusColor = (status: PromiseStatus) => {
    switch (status) {
      case "FULFILLED": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
      case "PARTIALLY_FULFILLED": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400";
      case "BROKEN": return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400";
      case "CANCELLED": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
      default: return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <HandCoins className="w-6 h-6 text-emerald-600" />
          <span>{isAr ? "وعود السداد المتعاقد عليها" : "Contracted Payment Promises"}</span>
        </h3>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? "إضافة وعد سداد" : "Add Payment Promise"}</span>
        </button>
      </div>

      {/* Stats row for Promises */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl">
               <TrendingUp className="w-6 h-6" />
            </div>
            <div>
               <div className="text-[10px] font-bold text-slate-400 uppercase">{isAr ? "إجمالي الوعود" : "Total Promised"}</div>
               <div className="text-xl font-bold text-slate-900 dark:text-white">
                 {paymentPromises.reduce((sum, p) => sum + p.amountPromised, 0).toLocaleString()} <span className="text-xs">AED</span>
               </div>
            </div>
         </div>
         <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl">
               <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
               <div className="text-[10px] font-bold text-slate-400 uppercase">{isAr ? "إجمالي المحصل" : "Total Fulfilled"}</div>
               <div className="text-xl font-bold text-slate-900 dark:text-white">
                 {paymentPromises.reduce((sum, p) => sum + p.amountFulfilled, 0).toLocaleString()} <span className="text-xs">AED</span>
               </div>
            </div>
         </div>
         <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 border-rose-100 dark:border-rose-900/50">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl">
               <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
               <div className="text-[10px] font-bold text-slate-400 uppercase">{isAr ? "وعود مكسورة" : "Broken Promises"}</div>
               <div className="text-xl font-bold text-rose-600">
                 {paymentPromises.filter(p => p.status === "BROKEN").length}
               </div>
            </div>
         </div>
      </div>

      {/* Grid of Promises */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {paymentPromises.length === 0 ? (
           <div className="md:col-span-2 py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 italic">
              <HandCoins className="w-16 h-16 mb-4 opacity-10" />
              {isAr ? "لا توجد وعود سداد حالياً" : "No payment promises found"}
           </div>
        ) : (
          paymentPromises.sort((a, b) => a.expectedPaymentDate.localeCompare(b.expectedPaymentDate)).map((promise) => {
            const tenant = tenants.find(t => t.id === promise.tenantId);
            const isOverdue = new Date(promise.expectedPaymentDate) < new Date() && promise.status === "ACTIVE";
            
            return (
              <div key={promise.id} className={`bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border ${isOverdue ? "border-rose-200 dark:border-rose-900 animate-pulse-subtle" : "border-slate-100 dark:border-slate-700"} flex flex-col transition-all group hover:border-emerald-200`}>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-all">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "Unknown Tenant"}
                      </h4>
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">#{promise.promiseNumber}</div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(promise.status)}`}>
                    {promise.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "المبلغ الموعود" : "Promised Amount"}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{promise.amountPromised.toLocaleString()} AED</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">{isAr ? "تاريخ السداد المتوقع" : "Expected Payment"}</div>
                    <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                       <Calendar className="w-5 h-5" />
                       <span>{new Date(promise.expectedPaymentDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl">
                     <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "ملاحظات" : "Notes"}</div>
                     <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{promise.notes || (isAr ? "لا توجد ملاحظات" : "No notes")}"</p>
                  </div>
                  
                  {promise.amountFulfilled > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                         <span>{isAr ? "التقدم" : "Progress"}</span>
                         <span>{Math.round((promise.amountFulfilled / promise.amountPromised) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                         <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(promise.amountFulfilled / promise.amountPromised) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between">
                   <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{isAr ? "سجل في: " : "Logged on: "} {new Date(promise.createdAt).toLocaleDateString()}</span>
                   </div>
                   
                   <div className="flex gap-2">
                      {promise.status === "ACTIVE" && (
                        <>
                          <button 
                            onClick={() => updatePaymentPromise(promise.id, { status: "BROKEN", brokenDate: new Date().toISOString() })}
                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                            title={isAr ? "تعليم كمكسور" : "Mark as broken"}
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => fulfillPaymentPromise(promise.id, promise.amountPromised)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10"
                          >
                            <Receipt className="w-4 h-4" />
                            <span>{isAr ? "سداد بالكامل" : "Full Fulfillment"}</span>
                          </button>
                        </>
                      )}
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add Promise */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <HandCoins className="w-6 h-6 text-emerald-600" />
              <span>{isAr ? "إضافة وعد سداد جديد" : "Add New Payment Promise"}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "المستأجر" : "Tenant"}</label>
                <SearchableSelect
                  options={tenants.map((t) => ({
                    id: t.id,
                    label: isAr ? t.nameAr : t.nameEn,
                    subLabel: t.phone ? `${isAr ? "هاتف:" : "Phone:"} ${t.phone}` : undefined,
                    badge: t.phone ? `${isAr ? "معرّف:" : "ID:"} ${t.id}` : undefined,
                  }))}
                  value={selectedTenantId}
                  onChange={(val) => setSelectedTenantId(val)}
                  placeholder={isAr ? "اختر المستأجر..." : "Select tenant..."}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "المبلغ الموعود" : "Promised Amount"}</label>
                <div className="relative">
                  <input
                    type="number"
                    className="w-full pl-4 pr-12 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">AED</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "تاريخ السداد المتوقع" : "Expected Payment Date"}</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "ملاحظات وشروط" : "Terms & Notes"}</label>
                <textarea
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm h-24 resize-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isAr ? "مثال: سيقوم بالتحويل البنكي يوم الخميس" : "e.g. Will do bank transfer on Thursday"}
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleAddPromise}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                {isAr ? "حفظ الوعد" : "Save Promise"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
