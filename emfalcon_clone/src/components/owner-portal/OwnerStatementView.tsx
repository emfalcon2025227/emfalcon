import React, { useState, useMemo } from "react";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building2,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Owner, Property, Lease } from "../../types";
import { generateOwnerStatement } from "../../services/financialEngine";

interface OwnerStatementViewProps {
  owner: Owner;
  properties: Property[];
  leases: Lease[];
}

export const OwnerStatementView: React.FC<OwnerStatementViewProps> = ({
  owner,
  properties,
  leases,
}) => {
  const { language, formatAED } = useLanguage();
  const {
    collections,
    commissionObligations,
    propertyExpenses,
    ownerTransfers,
    financialAdjustments,
    financialReversals,
    companyProfile,
  } = useData();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Authoritative statement report generated via financialEngine
  const statementReport = useMemo(() => {
    return generateOwnerStatement(
      owner.id,
      language === "ar" ? owner.nameAr : owner.nameEn,
      {
        propertyId: selectedPropertyId !== "ALL" ? selectedPropertyId : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
      {
        collections,
        commissions: commissionObligations,
        expenses: propertyExpenses,
        transfers: ownerTransfers,
        adjustments: financialAdjustments,
        reversals: financialReversals,
        leases,
      }
    );
  }, [
    owner.id,
    owner.nameAr,
    owner.nameEn,
    language,
    selectedPropertyId,
    dateFrom,
    dateTo,
    collections,
    commissionObligations,
    propertyExpenses,
    ownerTransfers,
    financialAdjustments,
    financialReversals,
    leases,
  ]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Reference", "Description", "Debit (AED)", "Credit (AED)", "Running Balance (AED)"];
    const rows = statementReport.transactions.map((item) => [
      item.date,
      item.reference,
      `"${item.description.replace(/"/g, '""')}"`,
      item.debit.toFixed(2),
      item.credit.toFixed(2),
      item.runningBalance.toFixed(2),
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Owner_Statement_${owner.code}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Property Selector */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
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
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-hidden"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-hidden"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-[11px] text-amber-700 hover:underline font-bold px-1 cursor-pointer"
              >
                {language === "ar" ? "إلغاء الفترة" : "Clear"}
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Excel / CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{language === "ar" ? "طباعة / PDF" : "Print / PDF"}</span>
          </button>
        </div>
      </div>

      {/* Printable Official Statement Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 sm:p-10 print:p-0 print:border-none print:shadow-none">
        {/* Official Header */}
        <div className="border-b-2 border-slate-900 pb-6 mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 p-1 flex items-center justify-center">
              <img
                src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {language === "ar" ? companyProfile.nameAr : companyProfile.nameEn}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {language === "ar" ? "قسم الحسابات وإدارة العقارات" : "Accounts & Property Management Division"}
              </p>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                TRN: {companyProfile.vatTrn || "100234567800003"}
              </div>
            </div>
          </div>

          <div className="text-end">
            <span className="inline-block px-3 py-1 rounded-lg bg-amber-100/70 text-amber-900 font-black text-xs uppercase tracking-wider mb-1">
              {language === "ar" ? "كشف حساب المالك المعتمد" : "Certified Owner Statement"}
            </span>
            <div className="text-xs text-slate-500">
              {language === "ar" ? "تاريخ الإصدار:" : "Issue Date:"}{" "}
              <span className="font-bold text-slate-800">{new Date().toISOString().slice(0, 10)}</span>
            </div>
          </div>
        </div>

        {/* Owner & Account Details Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/70 mb-6 text-xs">
          <div>
            <div className="text-slate-400 text-[11px] font-bold">{language === "ar" ? "اسم المالك" : "Owner Name"}</div>
            <div className="font-bold text-slate-900 mt-0.5">
              {language === "ar" ? owner.nameAr : owner.nameEn}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px] font-bold">{language === "ar" ? "رمز المالك" : "Owner Code"}</div>
            <div className="font-mono font-bold text-slate-900 mt-0.5">{owner.code}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px] font-bold">{language === "ar" ? "الحساب البنكي / الآيبان" : "Bank / IBAN"}</div>
            <div className="font-mono font-bold text-slate-900 mt-0.5 truncate">
              {owner.bankName ? `${owner.bankName} • ${owner.iban || owner.accountNumber}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px] font-bold">{language === "ar" ? "الفترة المحددة" : "Period"}</div>
            <div className="font-bold text-slate-900 mt-0.5">
              {dateFrom || dateTo ? `${dateFrom || "Start"} → ${dateTo || "End"}` : (language === "ar" ? "كامل السجل المالي" : "All Time Ledger")}
            </div>
          </div>
        </div>

        {/* Summary Metric Totals Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-xl bg-slate-900 text-white mb-6">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">{language === "ar" ? "الرصيد الافتتاحي" : "Opening Bal."}</div>
            <div className="text-sm font-black mt-0.5">{formatAED(statementReport.openingBalance)}</div>
          </div>
          <div>
            <div className="text-[10px] text-emerald-400 font-bold uppercase">{language === "ar" ? "إجمالي التحصيلات (+)" : "Collections (+)"}</div>
            <div className="text-sm font-black text-emerald-300 mt-0.5">{formatAED(statementReport.totalCredits)}</div>
          </div>
          <div>
            <div className="text-[10px] text-rose-400 font-bold uppercase">{language === "ar" ? "إجمالي الاستقطاعات (-)" : "Deductions (-)"}</div>
            <div className="text-sm font-black text-rose-300 mt-0.5">{formatAED(statementReport.totalDebits)}</div>
          </div>
          <div>
            <div className="text-[10px] text-amber-400 font-bold uppercase">{language === "ar" ? "التحويلات المسددة" : "Transfers Paid"}</div>
            <div className="text-sm font-black text-amber-300 mt-0.5">
              {formatAED(
                statementReport.transactions
                  .filter((t) => t.eventType === "OWNER_TRANSFER")
                  .reduce((s, t) => s + (t.debit || 0), 0)
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-amber-200 font-black uppercase">{language === "ar" ? "صافي الرصيد الختامي" : "Closing Payable"}</div>
            <div className="text-base font-black text-amber-400 mt-0.5">{formatAED(statementReport.closingBalance)}</div>
          </div>
        </div>

        {/* Financial Transactions Ledger */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-700 font-bold bg-slate-100/70">
                <th className="py-2.5 px-3 text-start">{language === "ar" ? "التاريخ" : "Date"}</th>
                <th className="py-2.5 px-3 text-start">{language === "ar" ? "رقم المرجع / السند" : "Ref #"}</th>
                <th className="py-2.5 px-3 text-start">{language === "ar" ? "البيان وتفاصيل المعاملة" : "Description"}</th>
                <th className="py-2.5 px-3 text-end text-rose-700">{language === "ar" ? "مدين / خصم (-)" : "Debit (-)"}</th>
                <th className="py-2.5 px-3 text-end text-emerald-700">{language === "ar" ? "دائن / إضافة (+)" : "Credit (+)"}</th>
                <th className="py-2.5 px-3 text-end">{language === "ar" ? "الرصيد التراكمي" : "Running Balance"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {statementReport.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {language === "ar" ? "لا توجد معاملات مسجلة خلال الفترة المحددة" : "No transactions recorded during this period"}
                  </td>
                </tr>
              ) : (
                statementReport.transactions.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{item.date}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{item.reference}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">
                      <div>{item.description}</div>
                      {(item.propertyName || item.tenantName) && (
                        <div className="text-[10px] text-slate-400 mt-0.5 space-x-1 rtl:space-x-reverse">
                          {item.propertyName && <span>{item.propertyName}</span>}
                          {item.unitNumber && <span>• {language === "ar" ? "وحدة" : "Unit"} {item.unitNumber}</span>}
                          {item.tenantName && <span className="text-indigo-600/80 font-bold">• {item.tenantName}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-end font-mono font-bold text-rose-600 whitespace-nowrap">
                      {item.debit > 0 ? formatAED(item.debit) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-end font-mono font-bold text-emerald-600 whitespace-nowrap">
                      {item.credit > 0 ? formatAED(item.credit) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-end font-mono font-black text-slate-900 whitespace-nowrap">
                      {formatAED(item.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Official Certification Footer */}
        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {language === "ar"
                ? "كشف حساب صادر ومعتمد إلكترونياً من صقر الإمارات لإدارة العقارات"
                : "Certified statement generated electronically by Emirates Falcon Real Estate"}
            </span>
          </div>
          <div className="text-end font-mono text-[10px]">
            {language === "ar" ? "ختم وتوقيع الإدارة المالية" : "Financial Management Seal & Signature"}
          </div>
        </div>
      </div>
    </div>
  );
};
