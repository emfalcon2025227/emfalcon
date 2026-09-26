import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Filter,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { AccountDefinition, AccountType } from "../../types";
import { SearchableSelect } from "../common/SearchableSelect";

export const ChartOfAccountsView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { chartOfAccounts = [], addAccountDefinition, updateAccountDefinition } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountDefinition | null>(null);

  // Form State
  const [accountCode, setAccountCode] = useState("");
  const [accountNameAr, setAccountNameAr] = useState("");
  const [accountNameEn, setAccountNameEn] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("ASSET");
  const [normalBalance, setNormalBalance] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");

  const filteredAccounts = chartOfAccounts.filter((acc) => {
    const matchesType = selectedType === "ALL" || acc.accountType === selectedType;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (acc.accountCode && acc.accountCode.toLowerCase().includes(q)) ||
      (acc.accountNameAr && acc.accountNameAr.toLowerCase().includes(q)) ||
      (acc.accountNameEn && acc.accountNameEn.toLowerCase().includes(q)) ||
      (acc.description && acc.description.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const handleOpenAdd = () => {
    setAccountCode("");
    setAccountNameAr("");
    setAccountNameEn("");
    setAccountType("ASSET");
    setNormalBalance("DEBIT");
    setDescription("");
    setFormError("");
    setEditingAccount(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (acc: AccountDefinition) => {
    setEditingAccount(acc);
    setAccountCode(acc.accountCode);
    setAccountNameAr(acc.accountNameAr);
    setAccountNameEn(acc.accountNameEn);
    setAccountType(acc.accountType);
    setNormalBalance(acc.normalBalance);
    setDescription(acc.description || "");
    setFormError("");
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!accountCode.trim() || !accountNameAr.trim()) {
      setFormError(isAr ? "يرجى تعبئة رمز الحساب والاسم بالعربية" : "Account code and Arabic name are required");
      return;
    }

    if (editingAccount) {
      updateAccountDefinition(editingAccount.id, {
        accountNameAr: accountNameAr.trim(),
        accountNameEn: accountNameEn.trim(),
        accountType,
        normalBalance,
        description: description.trim(),
      });
      setIsAddModalOpen(false);
    } else {
      const res = addAccountDefinition({
        accountCode: accountCode.trim(),
        accountNameAr: accountNameAr.trim(),
        accountNameEn: accountNameEn.trim(),
        accountType,
        normalBalance,
        isActive: true,
        isSystemAccount: false,
        description: description.trim(),
      });
      if (res.success) {
        setIsAddModalOpen(false);
      } else {
        setFormError(res.error || "Error adding account");
      }
    }
  };

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case "ASSET":
        return { ar: "أصول (Assets)", en: "Asset", color: "bg-blue-50 text-blue-700 border-blue-200" };
      case "LIABILITY":
        return { ar: "خصوم والتزامات (Liabilities)", en: "Liability", color: "bg-amber-50 text-amber-700 border-amber-200" };
      case "EQUITY":
        return { ar: "حقوق ملكية (Equity)", en: "Equity", color: "bg-purple-50 text-purple-700 border-purple-200" };
      case "INCOME":
        return { ar: "إيرادات (Income)", en: "Income", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "EXPENSE":
        return { ar: "مصروفات (Expenses)", en: "Expense", color: "bg-rose-50 text-rose-700 border-rose-200" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            {isAr ? "دليل الحسابات المحاسبي (Chart of Accounts)" : "Chart of Accounts"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isAr
              ? "الهيكل المالي الرسمي لحسابات الأصول، الالتزامات، حقوق الملكية، الإيرادات والمصروفات"
              : "Financial structure of Assets, Liabilities, Equity, Income, and Expenses"}
          </p>
        </div>

        <button
          id="btn-add-account"
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          {isAr ? "إضافة حساب جديد" : "Add Account"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "بحث برمز أو اسم الحساب..." : "Search by code or name..."}
            className="w-full pr-9 pl-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {["ALL", "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedType === type
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {type === "ALL" && (isAr ? "الكل" : "All")}
              {type === "ASSET" && (isAr ? "الأصول" : "Assets")}
              {type === "LIABILITY" && (isAr ? "الخصوم" : "Liabilities")}
              {type === "EQUITY" && (isAr ? "حقوق الملكية" : "Equity")}
              {type === "INCOME" && (isAr ? "الإيرادات" : "Income")}
              {type === "EXPENSE" && (isAr ? "المصروفات" : "Expenses")}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">{isAr ? "رمز الحساب" : "Account Code"}</th>
                <th className="px-5 py-3.5">{isAr ? "اسم الحساب" : "Account Name"}</th>
                <th className="px-5 py-3.5">{isAr ? "التصنيف" : "Type"}</th>
                <th className="px-5 py-3.5">{isAr ? "طبيعة الرصيد" : "Normal Balance"}</th>
                <th className="px-5 py-3.5">{isAr ? "الوصف" : "Description"}</th>
                <th className="px-5 py-3.5 text-center">{isAr ? "النوع" : "Classification"}</th>
                <th className="px-5 py-3.5 text-center">{isAr ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map((acc) => {
                const typeMeta = getAccountTypeLabel(acc.accountType);
                return (
                  <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-800">{acc.accountCode}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{acc.accountNameAr}</div>
                      {acc.accountNameEn && <div className="text-xs text-slate-400">{acc.accountNameEn}</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${typeMeta.color}`}>
                        {isAr ? typeMeta.ar : typeMeta.en}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {acc.normalBalance === "DEBIT" ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {isAr ? "مدين (Debit)" : "Debit"}
                        </span>
                      ) : (
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {isAr ? "دائن (Credit)" : "Credit"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate text-xs">{acc.description || "—"}</td>
                    <td className="px-5 py-3.5 text-center">
                      {acc.isSystemAccount ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <ShieldAlert className="w-3 h-3 text-indigo-600" />
                          {isAr ? "نظامي رئيسي" : "System Core"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {isAr ? "مخصص" : "Custom"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title={isAr ? "تعديل الحساب" : "Edit Account"}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {isAr ? "لا توجد حسابات تطابق معايير البحث." : "No accounts match the search criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              {editingAccount
                ? isAr
                  ? "تعديل بيانات الحساب المحاسبي"
                  : "Edit Account Definition"
                : isAr
                ? "إضافة حساب محاسبي جديد"
                : "Add New Chart of Accounts Entry"}
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "رمز الحساب (Account Code)" : "Account Code"}
                </label>
                <input
                  type="text"
                  value={accountCode}
                  disabled={!!editingAccount}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder="مثال: 1030"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "اسم الحساب بالعربية" : "Arabic Account Name"}
                </label>
                <input
                  type="text"
                  value={accountNameAr}
                  onChange={(e) => setAccountNameAr(e.target.value)}
                  placeholder="مثال: حساب بنك دبي الإسلامي"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "اسم الحساب بالإنجليزية (اختياري)" : "English Account Name"}
                </label>
                <input
                  type="text"
                  value={accountNameEn}
                  onChange={(e) => setAccountNameEn(e.target.value)}
                  placeholder="e.g. Dubai Islamic Bank"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "نوع الحساب" : "Account Type"}
                  </label>
                  <SearchableSelect
                    options={[
                      { id: "ASSET", label: isAr ? "أصل (Asset)" : "Asset" },
                      { id: "LIABILITY", label: isAr ? "خصم / التزام (Liability)" : "Liability" },
                      { id: "EQUITY", label: isAr ? "حقوق ملكية (Equity)" : "Equity" },
                      { id: "INCOME", label: isAr ? "إيراد (Income)" : "Income" },
                      { id: "EXPENSE", label: isAr ? "مصروف (Expense)" : "Expense" },
                    ]}
                    value={accountType}
                    onChange={(val) => setAccountType(val as AccountType)}
                    placeholder={isAr ? "نوع الحساب..." : "Account type..."}
                    searchPlaceholder={isAr ? "ابحث عن نوع حساب..." : "Search account type..."}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAr ? "طبيعة الرصيد" : "Normal Balance"}
                  </label>
                  <SearchableSelect
                    options={[
                      { id: "DEBIT", label: isAr ? "مدين (Debit)" : "Debit" },
                      { id: "CREDIT", label: isAr ? "دائن (Credit)" : "Credit" },
                    ]}
                    value={normalBalance}
                    onChange={(val) => setNormalBalance(val as "DEBIT" | "CREDIT")}
                    placeholder={isAr ? "طبيعة الرصيد..." : "Balance..."}
                    searchPlaceholder={isAr ? "ابحث عن طبيعة رصيد..." : "Search balance..."}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAr ? "الوصف والغرض من الحساب" : "Description"}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isAr ? "وصف تفصيلي للعمليات المسجلة على هذا الحساب..." : "Description..."}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-xs"
                >
                  {isAr ? "حفظ الحساب" : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
