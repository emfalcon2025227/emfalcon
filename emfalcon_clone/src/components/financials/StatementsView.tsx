import React, { useState, useMemo } from "react";
import {
  FileText,
  Printer,
  Download,
  FileSpreadsheet,
  Calendar,
  Building2,
  User,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Coins,
  Receipt,
  Scale,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { SearchableSelect } from "../common/SearchableSelect";
import { FinancialFilterBar } from "../common/FinancialFilterBar";
import { OwnerStatementReport, TenantStatementReport } from "../../services/financialEngine";

export const StatementsView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    owners = [],
    tenants = [],
    properties = [],
    leases = [],
    getOwnerStatement,
    getTenantStatement,
    companyProfile,
  } = useData();

  const [statementType, setStatementType] = useState<"OWNER" | "TENANT">("OWNER");

  // Owner Filter States
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(owners[0]?.id || "");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("ALL");
  const [ownerDateFrom, setOwnerDateFrom] = useState<string>("");
  const [ownerDateTo, setOwnerDateTo] = useState<string>("");

  // Tenant Filter States
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenants[0]?.id || "");
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>("ALL");
  const [tenantDateFrom, setTenantDateFrom] = useState<string>("");
  const [tenantDateTo, setTenantDateTo] = useState<string>("");

  // Searchable Select Options
  const ownerOptions = useMemo(() => {
    return owners.map((o) => {
      const name = isAr ? o.nameAr : o.nameEn;
      return {
        id: o.id,
        label: name,
        title: name,
        subLabel: `${isAr ? "رقم المالك:" : "Code:"} ${o.code || "OW"} | ${isAr ? "الهاتف:" : "Phone:"} ${o.phone}`,
        badge: o.code || "OW",
        extraSearchTerms: [o.code || "", o.emiratesId || "", o.phone || ""],
      };
    });
  }, [owners, isAr]);

  const tenantOptions = useMemo(() => {
    return tenants.map((t) => {
      const name = isAr ? t.nameAr : t.nameEn;
      return {
        id: t.id,
        label: name,
        title: name,
        subLabel: `${isAr ? "رقم المستأجر:" : "Code:"} ${t.code || "TNT"} | ${isAr ? "الهاتف:" : "Phone:"} ${t.phone}`,
        badge: t.code || "TNT",
        extraSearchTerms: [t.code || "", t.emiratesId || "", t.phone || ""],
      };
    });
  }, [tenants, isAr]);

  // Derived Statements
  const [filters, setFilters] = useState({ fromDate: "", toDate: "" });

  const ownerStatement: OwnerStatementReport | null = useMemo(() => {
    if (statementType !== "OWNER" || !selectedOwnerId) return null;
    return getOwnerStatement(selectedOwnerId, {
      propertyId: selectedPropertyId !== "ALL" ? selectedPropertyId : undefined,
      dateFrom: filters.fromDate || undefined,
      dateTo: filters.toDate || undefined,
    });
  }, [statementType, selectedOwnerId, selectedPropertyId, filters, getOwnerStatement]);

  const tenantStatement: TenantStatementReport | null = useMemo(() => {
    if (statementType !== "TENANT" || !selectedTenantId) return null;
    return getTenantStatement(selectedTenantId, {
      leaseId: selectedLeaseId !== "ALL" ? selectedLeaseId : undefined,
      dateFrom: filters.fromDate || undefined,
      dateTo: filters.toDate || undefined,
    });
  }, [statementType, selectedTenantId, selectedLeaseId, filters, getTenantStatement]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const isOwner = statementType === "OWNER";
    const report = isOwner ? ownerStatement : tenantStatement;
    if (!report) return;

    const headers = isAr
      ? ["التاريخ", "المرجع", "النوع", "البيان", "مدين", "دائن", "الرصيد التراكمي"]
      : ["Date", "Ref", "Type", "Description", "Debit", "Credit", "Running Balance"];

    const rows = report.transactions.map((tx) => [
      tx.date,
      tx.reference,
      tx.eventType,
      tx.description,
      tx.debit.toString(),
      tx.credit.toString(),
      tx.runningBalance.toString(),
    ]);

    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${isOwner ? "owner" : "tenant"}_statement_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            {isAr ? "كشوفات الحسابات الرسمية (Financial Statements)" : "Financial Statements"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isAr
              ? "استخراج وطباعة كشف حساب معتمد ومفصل للملاك والمستأجرين مع رصيد تراكمي مستمر"
              : "Generate official, running-balance statements for Owners and Tenants"}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStatementType("OWNER")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statementType === "OWNER" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {isAr ? "كشف حساب مالك" : "Owner Statement"}
          </button>
          <button
            onClick={() => setStatementType("TENANT")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statementType === "TENANT" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {isAr ? "كشف حساب مستأجر" : "Tenant Statement"}
          </button>
        </div>
      </div>

      <FinancialFilterBar onFilterChange={setFilters} />

      {/* Filter Parameters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden space-y-4">
        {statementType === "OWNER" ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? "اختيار المالك" : "Select Owner"}
              </label>
              <SearchableSelect
                options={ownerOptions}
                value={selectedOwnerId}
                onChange={setSelectedOwnerId}
                placeholder={isAr ? "ابحث عن المالك..." : "Select Owner..."}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? "تصفية العقار" : "Property"}
              </label>
              <SearchableSelect
                options={[
                  { id: "ALL", label: isAr ? "جميع عقارات المالك" : "All Properties" },
                  ...properties
                    .filter((p) => !selectedOwnerId || p.ownerId === selectedOwnerId)
                    .map((p) => ({
                      id: p.id,
                      label: isAr ? p.nameAr : p.nameEn,
                      subLabel: p.code,
                    })),
                ]}
                value={selectedPropertyId}
                onChange={(val) => setSelectedPropertyId(val)}
                placeholder={isAr ? "جميع عقارات المالك..." : "All Properties..."}
                searchPlaceholder={isAr ? "ابحث بالعقار..." : "Search property..."}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? "من تاريخ" : "From Date"}
              </label>
              <input
                type="date"
                value={ownerDateFrom}
                onChange={(e) => setOwnerDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? "إلى تاريخ" : "To Date"}
              </label>
              <input
                type="date"
                value={ownerDateTo}
                onChange={(e) => setOwnerDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? "اختيار المستأجر" : "Select Tenant"}
              </label>
              <SearchableSelect
                options={tenantOptions}
                value={selectedTenantId}
                onChange={setSelectedTenantId}
                placeholder={isAr ? "ابحث عن المستأجر..." : "Select Tenant..."}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? "عقد الإيجار" : "Lease Contract"}
              </label>
              <SearchableSelect
                options={[
                  { id: "ALL", label: isAr ? "جميع العقود" : "All Leases" },
                  ...leases
                    .filter((l) => !selectedTenantId || l.tenantId === selectedTenantId)
                    .map((l) => ({
                      id: l.id,
                      label: l.leaseNumber,
                      subLabel: `${Number(l.annualRent || 0).toLocaleString()} AED`,
                    })),
                ]}
                value={selectedLeaseId}
                onChange={(val) => setSelectedLeaseId(val)}
                placeholder={isAr ? "جميع العقود..." : "All Leases..."}
                searchPlaceholder={isAr ? "ابحث برقم العقد..." : "Search lease..."}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? "من تاريخ" : "From Date"}
              </label>
              <input
                type="date"
                value={tenantDateFrom}
                onChange={(e) => setTenantDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isAr ? "إلى تاريخ" : "To Date"}
              </label>
              <input
                type="date"
                value={tenantDateTo}
                onChange={(e) => setTenantDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Official Printable Statement Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 print:p-0 print:border-none print:shadow-none space-y-6">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6 gap-4">
          <div className="flex items-center gap-3.5">
            {companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center p-1 shadow-xs">
                <img
                  src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo}
                  alt="Office Logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}
            <div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-serif">
                {isAr ? companyProfile.nameAr : companyProfile.nameEn}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {companyProfile.nameEn} • {isAr ? (companyProfile.addressAr || companyProfile.address) : (companyProfile.addressEn || companyProfile.address)}
              </div>
              {companyProfile.vatTrn && (
                <div className="text-xs text-slate-400 font-mono mt-0.5">TRN / الضريبة: {companyProfile.vatTrn}</div>
              )}
            </div>
          </div>

          <div className="text-left font-mono text-xs text-slate-500 space-y-1">
            <div className="font-bold text-slate-900 text-sm">
              {statementType === "OWNER"
                ? isAr ? "كشف حساب مالك عقار" : "OWNER STATEMENT"
                : isAr ? "كشف حساب مستأجر" : "TENANT STATEMENT"}
            </div>
            <div>{isAr ? "تاريخ الإصدار:" : "Date:"} {new Date().toISOString().split("T")[0]}</div>
            <div>{isAr ? "العملة:" : "Currency:"} AED (درهم إماراتي)</div>
          </div>
        </div>

        {/* Statement Beneficiary Details & KPI Cards */}
        {statementType === "OWNER" && ownerStatement && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase">{isAr ? "بيانات المالك" : "Owner Info"}</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{ownerStatement.ownerName}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {isAr ? "الفترة:" : "Period:"} {ownerStatement.dateFrom || "البداية"} {isAr ? "إلى" : "to"} {ownerStatement.dateTo || "اليوم"}
                </div>
              </div>

              <div className="flex md:justify-end items-center gap-6">
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-semibold uppercase">{isAr ? "الرصيد الافتتاحي" : "Opening Balance"}</div>
                  <div className="text-base font-bold font-mono text-slate-800">{ownerStatement.openingBalance.toLocaleString()} AED</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-semibold uppercase">{isAr ? "الرصيد الختامي المتبقي" : "Closing Payable"}</div>
                  <div className="text-xl font-black font-mono text-emerald-700">{ownerStatement.closingBalance.toLocaleString()} AED</div>
                </div>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <div className="text-xs font-semibold text-emerald-800">{isAr ? "إجمالي الإيجارات المحصلة" : "Total Rent Inflow"}</div>
                <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5">+{ownerStatement.totalCredits.toLocaleString()} AED</div>
              </div>
              <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl">
                <div className="text-xs font-semibold text-rose-800">{isAr ? "إجمالي المصاريف والعمولات" : "Deductions & Expenses"}</div>
                <div className="text-lg font-bold font-mono text-rose-700 mt-0.5">
                  -{ownerStatement.totalDebits.toLocaleString()} AED
                </div>
              </div>
              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                <div className="text-xs font-semibold text-indigo-800">{isAr ? "صافي المستحق النهائي" : "Net Payable Available"}</div>
                <div className="text-lg font-bold font-mono text-indigo-700 mt-0.5">{ownerStatement.closingBalance.toLocaleString()} AED</div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">{isAr ? "التاريخ" : "Date"}</th>
                    <th className="px-4 py-3">{isAr ? "المرجع" : "Ref"}</th>
                    <th className="px-4 py-3">{isAr ? "نوع الحركة" : "Type"}</th>
                    <th className="px-4 py-3">{isAr ? "البيان والتفاصيل" : "Description"}</th>
                    <th className="px-4 py-3 text-rose-700">{isAr ? "مدين / استقطاع (Debit)" : "Debit"}</th>
                    <th className="px-4 py-3 text-emerald-700">{isAr ? "دائن / إيداع (Credit)" : "Credit"}</th>
                    <th className="px-4 py-3 font-mono">{isAr ? "الرصيد التراكمي" : "Balance"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-3 text-slate-500">{ownerStatement.dateFrom || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">INIT</td>
                    <td className="px-4 py-3 text-slate-500">{isAr ? "رصيد افتتاحي" : "Opening Balance"}</td>
                    <td className="px-4 py-3 text-slate-600 font-sans">{isAr ? "الرصيد المدور من الفترات السابقة" : "Balance brought forward"}</td>
                    <td className="px-4 py-3 text-slate-400">—</td>
                    <td className="px-4 py-3 text-slate-400">—</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{ownerStatement.openingBalance.toLocaleString()} AED</td>
                  </tr>

                  {ownerStatement.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-600">{tx.date}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{tx.reference}</td>
                      <td className="px-4 py-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {tx.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-700">{tx.description}</td>
                      <td className="px-4 py-3 text-rose-600 font-bold">
                        {tx.debit > 0 ? `-${tx.debit.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-emerald-600 font-bold">
                        {tx.credit > 0 ? `+${tx.credit.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {tx.runningBalance.toLocaleString()} AED
                      </td>
                    </tr>
                  ))}

                  {ownerStatement.transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                        {isAr ? "لا توجد حركات مسجلة خلال الفترة المحددة." : "No transactions found in this period."}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 font-sans text-slate-800">
                      {isAr ? "الإجمالي والرصيد المستحق النهائي للمالك:" : "Closing Balance Available for Transfer:"}
                    </td>
                    <td className="px-4 py-3 font-mono text-rose-700">-{ownerStatement.totalDebits.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-emerald-700">+{ownerStatement.totalCredits.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-indigo-900 text-sm">{ownerStatement.closingBalance.toLocaleString()} AED</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Tenant Statement Sheet */}
        {statementType === "TENANT" && tenantStatement && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase">{isAr ? "بيانات المستأجر" : "Tenant Info"}</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{tenantStatement.tenantName}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {isAr ? "الفترة:" : "Period:"} {tenantStatement.dateFrom || "البداية"} {isAr ? "إلى" : "to"} {tenantStatement.dateTo || "اليوم"}
                </div>
              </div>

              <div className="flex md:justify-end items-center gap-6">
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-semibold uppercase">{isAr ? "إجمالي المطالبات" : "Total Invoiced"}</div>
                  <div className="text-base font-bold font-mono text-rose-700">{Number(tenantStatement.totalDebits || 0).toLocaleString()} AED</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-semibold uppercase">{isAr ? "المتبقي غير المسدد" : "Outstanding Balance"}</div>
                  <div className="text-xl font-black font-mono text-rose-700">{Number(tenantStatement.closingBalance || 0).toLocaleString()} AED</div>
                </div>
              </div>
            </div>

            {/* Categorized KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-700">{isAr ? "القيمة الإيجارية للعقد" : "Contract Rent"}</div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                  {(tenantStatement.contractRentalValue || 0).toLocaleString()} AED
                </div>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <div className="text-[11px] font-semibold text-emerald-800">{isAr ? "الإيجار المحصل" : "Rent Collected"}</div>
                <div className="text-sm font-bold font-mono text-emerald-700 mt-1">
                  {(tenantStatement.totalCollectedRent || 0).toLocaleString()} AED
                </div>
              </div>
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <div className="text-[11px] font-semibold text-amber-800">{isAr ? "شيكات آجلة (PDC)" : "PDC Pending"}</div>
                <div className="text-sm font-bold font-mono text-amber-700 mt-1">
                  {(tenantStatement.totalPdcPending || 0).toLocaleString()} AED
                </div>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="text-[11px] font-semibold text-blue-800">{isAr ? "الرسوم الإدارية" : "Admin Fees"}</div>
                <div className="text-sm font-bold font-mono text-blue-700 mt-1">
                  {(tenantStatement.totalAdminFees || 0).toLocaleString()} AED
                </div>
              </div>
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                <div className="text-[11px] font-semibold text-purple-800">{isAr ? "رسوم التوثيق/التصديق" : "Attestation Fees"}</div>
                <div className="text-sm font-bold font-mono text-purple-700 mt-1">
                  {(tenantStatement.totalAttestationFees || 0).toLocaleString()} AED
                </div>
              </div>
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
                <div className="text-[11px] font-semibold text-rose-800">{isAr ? "صافي المستحق النهائي" : "Net Outstanding"}</div>
                <div className="text-sm font-black font-mono text-rose-700 mt-1">
                  {Number(tenantStatement.closingBalance || 0).toLocaleString()} AED
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">{isAr ? "التاريخ" : "Date"}</th>
                    <th className="px-4 py-3">{isAr ? "المرجع" : "Ref"}</th>
                    <th className="px-4 py-3">{isAr ? "الفئة والنوع" : "Category / Type"}</th>
                    <th className="px-4 py-3">{isAr ? "البيان والتفاصيل" : "Description"}</th>
                    <th className="px-4 py-3 text-rose-700">{isAr ? "مطالبة / مستحق (Debit)" : "Debit"}</th>
                    <th className="px-4 py-3 text-emerald-700">{isAr ? "سداد / مقبوض (Credit)" : "Credit"}</th>
                    <th className="px-4 py-3 font-mono">{isAr ? "الرصيد المستحق" : "Balance"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {tenantStatement.transactions.map((tx) => {
                    const categoryBadge = tx.category === "ADMIN_FEE"
                      ? "bg-blue-100 text-blue-800"
                      : tx.category === "ATTESTATION_FEE"
                      ? "bg-purple-100 text-purple-800"
                      : tx.category === "RENT"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700";

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-600">{tx.date}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{tx.reference}</td>
                        <td className="px-4 py-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${categoryBadge}`}>
                            {tx.category === "ADMIN_FEE"
                              ? isAr ? "رسوم إدارية" : "Admin Fee"
                              : tx.category === "ATTESTATION_FEE"
                              ? isAr ? "توثيق وتصديق" : "Attestation Fee"
                              : tx.category === "RENT"
                              ? isAr ? "إيجار" : "Rent"
                              : tx.eventType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-700">{tx.description}</td>
                        <td className="px-4 py-3 text-rose-600 font-bold">
                          {tx.debit > 0 ? tx.debit.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-emerald-600 font-bold">
                          {tx.credit > 0 ? tx.credit.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {tx.runningBalance.toLocaleString()} AED
                        </td>
                      </tr>
                    );
                  })}

                  {tenantStatement.transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                        {isAr ? "لا توجد حركات مسجلة للمستأجر." : "No transactions found."}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 font-sans text-slate-800">
                      {isAr ? "إجمالي المطالبات والمسدد والرصيد المتبقي:" : "Totals & Net Outstanding:"}
                    </td>
                    <td className="px-4 py-3 font-mono text-rose-700">{Number(tenantStatement.totalDebits || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-emerald-700">{Number(tenantStatement.totalCredits || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-rose-700 text-sm">{Number(tenantStatement.closingBalance || 0).toLocaleString()} AED</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Official Footer / Signature Box */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 text-xs text-slate-500">
          <div>
            <div className="font-semibold text-slate-700">{isAr ? "إعداد المحاسب القانوني:" : "Prepared By Accountant:"}</div>
            <div className="mt-8 border-t border-dashed border-slate-300 w-48 pt-1">
              {isAr ? "التوقيع والختم المالي" : "Signature & Stamp"}
            </div>
          </div>
          <div className="text-left">
            <div className="font-semibold text-slate-700">{isAr ? "اعتماد الإدارة العامة:" : "Approved By Management:"}</div>
            <div className="mt-8 border-t border-dashed border-slate-300 w-48 pt-1 mr-auto">
              {isAr ? "التوقيع والاعتماد" : "Signature"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
