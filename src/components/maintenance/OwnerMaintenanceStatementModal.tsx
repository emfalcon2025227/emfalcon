import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Download,
  Building,
  User,
  Calendar,
  DollarSign,
  FileText,
  FileSpreadsheet,
  Edit3,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { MaintenanceRequest } from "../../types";
import { SearchableSelect } from "../common/SearchableSelect";
import { OfficePrintHeader } from "../common/OfficePrintHeader";

interface OwnerMaintenanceStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OwnerMaintenanceStatementModal: React.FC<OwnerMaintenanceStatementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { owners, properties, units, tenants, maintenanceRequests } = useData();
  const { t, language, formatAED } = useLanguage();

  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(
    owners[0]?.id || ""
  );
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isInsideIframe, setIsInsideIframe] = useState<boolean>(false);

  useEffect(() => {
    setIsInsideIframe(window.self !== window.top);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("printOwnerStatement") === "true") {
      const oId = params.get("ownerId");
      const pId = params.get("propertyId");
      const fDate = params.get("fromDate");
      const tDate = params.get("toDate");

      if (oId) setSelectedOwnerId(oId);
      if (pId) setSelectedPropertyId(pId);
      if (fDate) setFromDate(fDate);
      if (tDate) setToDate(tDate);

      // Clean URL params to prevent loop
      const url = new URL(window.location.href);
      url.searchParams.delete("printOwnerStatement");
      url.searchParams.delete("ownerId");
      url.searchParams.delete("propertyId");
      url.searchParams.delete("fromDate");
      url.searchParams.delete("toDate");
      window.history.replaceState({}, "", url.toString());
    }
  }, [isOpen]);

  const getPrintUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("printOwnerStatement", "true");
    url.searchParams.set("ownerId", selectedOwnerId);
    url.searchParams.set("propertyId", selectedPropertyId);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    return url.toString();
  };

  if (!isOpen) return null;

  const owner = owners.find((o) => o.id === selectedOwnerId);
  const ownerProperties = properties.filter((p) => p.ownerId === selectedOwnerId);

  const filteredRequests = maintenanceRequests.filter((req) => {
    if (req.ownerId !== selectedOwnerId) return false;
    if (selectedPropertyId !== "ALL" && req.propertyId !== selectedPropertyId) return false;
    if (fromDate && req.requestDate < fromDate) return false;
    if (toDate && req.requestDate > toDate) return false;
    return true;
  });

  const totalCost = filteredRequests.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const totalPaid = filteredRequests.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  const totalRemaining = filteredRequests.reduce((sum, r) => sum + (r.remainingAmount || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      "Request Number",
      "Date",
      "Property",
      "Unit",
      "Category",
      "Description",
      "Cost Bearer",
      "Labor Cost",
      "Parts Cost",
      "Total Cost",
      "Status",
    ];

    const rows = filteredRequests.map((r) => {
      const prop = properties.find((p) => p.id === r.propertyId);
      const u = units.find((un) => un.id === r.unitId);
      return [
        r.requestNumber,
        r.requestDate,
        `"${prop?.nameAr || prop?.nameEn || r.propertyId}"`,
        `"${u?.unitNumber || r.unitId}"`,
        `"${r.category}"`,
        `"${r.issueDescription.replace(/"/g, '""')}"`,
        r.costBearer,
        r.laborCost || 0,
        r.partsCost || 0,
        r.totalCost || 0,
        r.status,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Maintenance_Statement_${owner?.code || "Owner"}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div
        id="owner-maintenance-statement-modal"
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {t("maintOwnerStatementTitle")}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === "ar"
                  ? "كشف حساب تفصيلي بمصاريف الصيانة والإصلاحات للعقارات"
                  : "Detailed expense statement for owner properties"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isEditMode
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditMode ? (language === "ar" ? "قفل التعديل" : "Lock Edit") : (language === "ar" ? "✏️ التعديل المباشر" : "✏️ Live Edit")}</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t("exportExcel")}</span>
            </button>
            {isInsideIframe ? (
              <a
                href={getPrintUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs text-center"
              >
                <Printer className="w-4 h-4" />
                <span>{language === "ar" ? "افتح للطباعة ↗" : "Open to Print ↗"}</span>
              </a>
            ) : (
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>{t("print")}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isInsideIframe && (
          <div className="mx-5 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div className="space-y-1">
              <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                <span>⚠️ تنبيه لتشغيل الطباعة بنجاح</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 text-amber-950 rounded-md font-bold uppercase font-mono">iFrame Sandbox</span>
              </span>
              <p className="text-[11px] leading-relaxed text-amber-800">
                {language === "ar"
                  ? "أنت تتصفح النظام داخل بيئة معاينة آمنة تمنع فتح شاشة الطباعة الخاصة بالمتصفح. يرجى فتح النظام في علامة تبويب جديدة مستقلة لتتمكن من طباعة كشف الحساب كـ PDF مباشرة."
                  : "You are currently viewing the app inside a secure preview iFrame, which blocks browser print dialogs. Please open the app in a new tab to print the statement successfully."}
              </p>
            </div>
            <a
              href={getPrintUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center"
            >
              <span>{language === "ar" ? "افتح في علامة تبويب جديدة ↗" : "Open in New Tab ↗"}</span>
            </a>
          </div>
        )}

        {/* Filter Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
          <div>
            <SearchableSelect
              label={t("maintOwner")}
              options={owners.map((o) => ({
                id: o.id,
                label: o.nameAr || o.nameEn,
                subLabel: o.code,
                badge: o.phone,
              }))}
              value={selectedOwnerId}
              onChange={(val) => {
                setSelectedOwnerId(val);
                setSelectedPropertyId("ALL");
              }}
              placeholder={language === "ar" ? "-- اختر المالك --" : "-- Select Owner --"}
              searchPlaceholder={language === "ar" ? "ابحث باسم المالك أو الكود..." : "Search owner..."}
            />
          </div>

          <div>
            <SearchableSelect
              label={t("maintProperty")}
              options={[
                { id: "ALL", label: language === "ar" ? "كافة عقارات المالك" : "All Properties" },
                ...ownerProperties.map((p) => ({
                  id: p.id,
                  label: p.nameAr || p.nameEn,
                  subLabel: p.code,
                  badge: p.community || p.emirate,
                })),
              ]}
              value={selectedPropertyId}
              onChange={(val) => setSelectedPropertyId(val)}
              placeholder={language === "ar" ? "-- اختر العقار --" : "-- Select Property --"}
              searchPlaceholder={language === "ar" ? "ابحث بأسماء العقارات..." : "Search property..."}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {language === "ar" ? "من تاريخ" : "From Date"}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {language === "ar" ? "إلى تاريخ" : "To Date"}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-medium"
            />
          </div>
        </div>

        {/* Statement Printable Sheet */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <OfficePrintHeader
            titleAr="كشف حساب صيانة المالك"
            titleEn="OWNER MAINTENANCE STATEMENT"
            subtitleAr={owner ? `المالك: ${owner.nameAr || owner.nameEn}` : undefined}
            subtitleEn={owner ? `Owner: ${owner.nameEn || owner.nameAr}` : undefined}
            refNumber={`MAINT-STMT-${selectedOwnerId.slice(-4)}-${new Date().getFullYear()}`}
            extraInfo={[
              { labelAr: "الفترة من", labelEn: "From", value: fromDate || "البداية" },
              { labelAr: "إلى", labelEn: "To", value: toDate || "الآن" },
              { labelAr: "عدد البلاغات", labelEn: "Total Requests", value: filteredRequests.length.toString() },
            ]}
          />

          {/* Statement Header Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">
                {t("maintOwnerStatementTitle")}
              </p>
              <h3 className="text-base font-black text-slate-900 mt-0.5">
                {owner?.nameAr || owner?.nameEn}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {language === "ar" ? "رمز المالك: " : "Owner Code: "} {owner?.code} | {owner?.phone}
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-end">
                <span className="text-[11px] text-slate-500 block">{t("maintTotalCost")}</span>
                <span className="text-base font-black text-slate-900 block">
                  {formatAED(totalCost)}
                </span>
              </div>
              <div className="text-end">
                <span className="text-[11px] text-slate-500 block">{t("maintPaidCost")}</span>
                <span className="text-base font-black text-emerald-600 block">
                  {formatAED(totalPaid)}
                </span>
              </div>
              <div className="text-end">
                <span className="text-[11px] text-slate-500 block">{t("maintRemainingCost")}</span>
                <span className="text-base font-black text-amber-600 block">
                  {formatAED(totalRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3 text-start">{t("maintRequestNumber")}</th>
                    <th className="p-3 text-start">{t("date")}</th>
                    <th className="p-3 text-start">{t("maintProperty")}</th>
                    <th className="p-3 text-start">{language === "ar" ? "الوحدة" : "Unit"}</th>
                    <th className="p-3 text-start">{t("maintCategory")}</th>
                    <th className="p-3 text-start">{t("maintIssueDescription")}</th>
                    <th className="p-3 text-start">{t("maintCostBearer")}</th>
                    <th className="p-3 text-end">{t("maintLaborCost")}</th>
                    <th className="p-3 text-end">{t("maintPartsCost")}</th>
                    <th className="p-3 text-end">{t("total")} (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map((req) => {
                      const prop = properties.find((p) => p.id === req.propertyId);
                      const u = units.find((un) => un.id === req.unitId);
                      return (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 font-mono font-bold text-slate-900 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {req.requestNumber}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 text-slate-600 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {req.requestDate}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 font-medium text-slate-800 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {prop?.nameAr || prop?.nameEn || "—"}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 font-bold text-slate-900 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {u?.unitNumber || "—"}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 text-slate-600 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {req.category}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 text-slate-700 max-w-xs ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : "truncate"}`}
                          >
                            {req.issueDescription}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 text-slate-600 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {t(`maintBearer${req.costBearer}` as any)}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 text-end text-slate-700 font-mono ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {formatAED(req.laborCost || 0)}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 text-end text-slate-700 font-mono ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {formatAED(req.partsCost || 0)}
                          </td>
                          <td 
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                            className={`p-3 text-end font-black text-slate-950 font-mono ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded" : ""}`}
                          >
                            {formatAED(req.totalCost || 0)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        {language === "ar"
                          ? "لا توجد طلبات صيانة مسجلة لهذا المالك خلال الفترة المحددة."
                          : "No maintenance records found for this owner."}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100/90 font-black border-t border-slate-200">
                  <tr>
                    <td colSpan={7} className="p-3 text-start">
                      {language === "ar" ? "الإجمالي الكلي:" : "Grand Total:"}
                    </td>
                    <td className="p-3 text-end font-mono">
                      {formatAED(
                        filteredRequests.reduce((sum, r) => sum + (r.laborCost || 0), 0)
                      )}
                    </td>
                    <td className="p-3 text-end font-mono">
                      {formatAED(
                        filteredRequests.reduce((sum, r) => sum + (r.partsCost || 0), 0)
                      )}
                    </td>
                    <td className="p-3 text-end font-mono text-amber-900">
                      {formatAED(totalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
};
