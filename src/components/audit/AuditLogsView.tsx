import React, { useState } from "react";
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  User,
  Calendar,
  FileText,
  Trash2,
  Edit3,
  PlusCircle,
  Download,
  AlertCircle,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";
import { SearchableSelect } from "../common/SearchableSelect";
import { AuditLogEntry } from "../../types";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";

export const AuditLogsView: React.FC = () => {
  const { t, language } = useLanguage();
  const { auditLogs } = useData();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [filterEntity, setFilterEntity] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Filter logic
  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [log.entityName, log.userName, log.details, log.entityId],
        searchTerm
      );

    const matchesAction = filterAction === "ALL" || log.action === filterAction;
    const matchesEntity = filterEntity === "ALL" || log.entityType === filterEntity;

    return matchesSearch && matchesAction && matchesEntity;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "DELETE":
        return <Badge variant="danger">{language === "ar" ? "حذف" : "Delete"}</Badge>;
      case "UPDATE":
      case "STATUS_CHANGE":
      case "USER_ROLE_CHANGE":
      case "USER_STATUS_CHANGE":
        return <Badge variant="warning">{language === "ar" ? "تعديل / تغيير" : "Update"}</Badge>;
      case "CREATE":
      case "DOCUMENT_UPLOAD":
      case "HEARING_ADDED":
      case "CONVERT_TO_CASE":
      case "DATA_IMPORT":
        return <Badge variant="success">{language === "ar" ? "إنشاء / إضافة" : "Create"}</Badge>;
      case "FINANCIAL_PAYMENT":
      case "OVERPAYMENT_ADJUSTMENT":
        return <Badge variant="info">{language === "ar" ? "معاملة مالية" : "Financial"}</Badge>;
      default:
        return <Badge variant="neutral">{action}</Badge>;
    }
  };

  const exportToCsv = () => {
    const headers = ["Timestamp", "Action", "Entity Type", "Target Name", "User Name", "Role", "Details"];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.action,
      l.entityType,
      `"${l.entityName.replace(/"/g, '""')}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      l.userRole,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_trail_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <History className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {language === "ar" ? "سجل التدقيق والرقابة الأمنية (Audit Logs)" : "Operational & Security Audit Trail"}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {language === "ar"
                  ? "تسجيل دقيق لكافة عمليات الإنشاء، التعديل، والحذف على العقود والمستأجرين والمستندات ببيانات المستخدم المنفذ."
                  : "Comprehensive tamper-proof log of all creations, updates, and deletions on leases, tenants, and records."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={exportToCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{language === "ar" ? "تصدير السجلات (CSV)" : "Export Audit CSV"}</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {language === "ar" ? "إجمالي السجلات" : "Total Audit Events"}
            </span>
            <History className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{auditLogs.length}</div>
          <div className="text-xs text-slate-400 mt-1">
            {language === "ar" ? "محفوظة في السجل الآمن" : "Securely logged"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {language === "ar" ? "عمليات الحذف" : "Deletions"}
            </span>
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 mt-2">
            {auditLogs.filter((l) => l.action === "DELETE").length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {language === "ar" ? "مع الأرشيف التاريخي" : "With historical archive"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {language === "ar" ? "عمليات التعديل والتغيير" : "Updates & Changes"}
            </span>
            <Edit3 className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            {auditLogs.filter((l) => l.action === "UPDATE" || l.action === "STATUS_CHANGE").length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {language === "ar" ? "تتبع التغييرات" : "Change tracking"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {language === "ar" ? "العمليات الجديدة" : "Creations"}
            </span>
            <PlusCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {auditLogs.filter((l) => l.action === "CREATE" || l.action === "DOCUMENT_UPLOAD").length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {language === "ar" ? "إضافات جديدة" : "New records"}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${language === "ar" ? "right-3.5" : "left-3.5"}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              language === "ar"
                ? "البحث في السجلات (اسم السجل، المستخدم، التفاصيل)..."
                : "Search logs by target name, user, or details..."
            }
            className={`w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 ${
              language === "ar" ? "pr-10 pl-4" : "pl-10 pr-4"
            }`}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 min-w-[160px]">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "جميع العمليات" : "All Actions" },
                { id: "CREATE", label: language === "ar" ? "إنشاء" : "Create" },
                { id: "UPDATE", label: language === "ar" ? "تعديل" : "Update" },
                { id: "DELETE", label: language === "ar" ? "حذف" : "Delete" },
                { id: "STATUS_CHANGE", label: language === "ar" ? "تغيير الحالة" : "Status Change" },
                { id: "FINANCIAL_PAYMENT", label: language === "ar" ? "دفعة مالية" : "Financial Payment" },
              ]}
              value={filterAction}
              onChange={(val) => setFilterAction(val)}
              placeholder={language === "ar" ? "نوع العملية..." : "Action..."}
            />
          </div>

          <div className="min-w-[160px]">
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "جميع الكيانات" : "All Entities" },
                { id: "LEASE", label: language === "ar" ? "عقود الإيجار" : "Leases" },
                { id: "TENANT", label: language === "ar" ? "المستأجرين" : "Tenants" },
                { id: "CHEQUE", label: language === "ar" ? "الشيكات" : "Cheques" },
                { id: "PROPERTY", label: language === "ar" ? "العقارات" : "Properties" },
                { id: "UNIT", label: language === "ar" ? "الوحدات" : "Units" },
                { id: "CASE", label: language === "ar" ? "القضايا" : "Cases" },
                { id: "COLLECTION", label: language === "ar" ? "سندات القبض" : "Collections" },
              ]}
              value={filterEntity}
              onChange={(val) => setFilterEntity(val)}
              placeholder={language === "ar" ? "الكيان..." : "Entity..."}
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">{language === "ar" ? "التوقيت الدقيق" : "Timestamp"}</th>
                <th className="py-3.5 px-4">{language === "ar" ? "نوع العملية" : "Action"}</th>
                <th className="py-3.5 px-4">{language === "ar" ? "الكيان المستهدف" : "Entity Type"}</th>
                <th className="py-3.5 px-4">{language === "ar" ? "اسم السجل" : "Target Name"}</th>
                <th className="py-3.5 px-4">{language === "ar" ? "المستخدم المنفذ" : "Executed By"}</th>
                <th className="py-3.5 px-4">{language === "ar" ? "التفاصيل" : "Details"}</th>
                <th className="py-3.5 px-4 text-center">{language === "ar" ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <History className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p>{language === "ar" ? "لا توجد سجلات تدقيق مطابقة" : "No matching audit logs found"}</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-slate-500">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-900">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-600">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[200px] truncate" title={log.entityName}>
                      {log.entityName}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {log.userName?.charAt(0) || "U"}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 text-xs">{log.userName}</div>
                          <div className="text-[10px] text-slate-400 uppercase">{log.userRole}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs max-w-[250px] truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                        title={language === "ar" ? "عرض التفاصيل الكاملة" : "View Full Details"}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={language === "ar" ? "تفاصيل سجل التدقيق والرقابة" : "Audit Log Complete Details"}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-sm text-slate-700">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-400 block">
                  {language === "ar" ? "نوع العملية" : "Action Type"}
                </span>
                <div className="mt-1 font-semibold">{getActionBadge(selectedLog.action)}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">
                  {language === "ar" ? "التوقيت الدقيق" : "Timestamp"}
                </span>
                <div className="mt-1 font-mono text-xs">{selectedLog.timestamp}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">
                  {language === "ar" ? "الكيان والسجل المستهدف" : "Target Entity"}
                </span>
                <div className="mt-1 font-semibold text-slate-900">
                  {selectedLog.entityType}: {selectedLog.entityName}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">
                  {language === "ar" ? "المستخدم المنفذ" : "Executed By"}
                </span>
                <div className="mt-1 font-semibold text-slate-900">
                  {selectedLog.userName} ({selectedLog.userRole})
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {language === "ar" ? "تفاصيل الحدث والسبب" : "Event Description & Reason"}
              </span>
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-indigo-900">
                {selectedLog.details}
              </div>
            </div>

            {(selectedLog.oldValue || selectedLog.newValue) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLog.oldValue && (
                  <div>
                    <span className="text-xs font-semibold text-red-600 uppercase tracking-wider block mb-1">
                      {language === "ar" ? "القيمة أو الحالة السابقة" : "Previous State / Value"}
                    </span>
                    <pre className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-mono text-red-900 overflow-x-auto max-h-40">
                      {selectedLog.oldValue}
                    </pre>
                  </div>
                )}
                {selectedLog.newValue && (
                  <div>
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block mb-1">
                      {language === "ar" ? "القيمة أو الحالة الجديدة" : "Updated State / Value"}
                    </span>
                    <pre className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono text-emerald-900 overflow-x-auto max-h-40">
                      {selectedLog.newValue}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === "ar" ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
