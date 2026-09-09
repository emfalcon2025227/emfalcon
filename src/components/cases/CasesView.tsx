import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  Search,
  Calendar,
  LayoutGrid,
  List,
  Eye,
  Plus,
  Handshake,
  CheckCircle2,
  AlertTriangle,
  Building,
  User,
  Archive,
  Trash2,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { Case, CaseStatus } from "../../types";
import { Badge } from "../common/Badge";
import { CaseDetailsPage } from "./CaseDetailsModal";
import { AddCaseModal } from "./AddCaseModal";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import { SearchableSelect } from "../common/SearchableSelect";

export const CasesView: React.FC = () => {
  const { t, language } = useLanguage();
  const { canGoBack } = useNavigation();
  const { cases, tenants, properties, units, owners, archive, deleteCase } = useData();
  const { hasPermission } = useAuth();
  
  const canDelete = hasPermission("DELETE_RECORDS");
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);

  const handleDelete = (c: Case, e: React.MouseEvent) => {
    e.stopPropagation();
    setCaseToDelete(c);
  };

  const confirmDeleteCase = (options?: { keepAttachments?: boolean; reason?: string }) => {
    if (caseToDelete) {
      deleteCase(caseToDelete.id, options);
      setCaseToDelete(null);
    }
  };

  const [viewMode, setViewMode] = useState<"TABLE" | "KANBAN">("TABLE");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const saved = sessionStorage.getItem("ef_case_initial_filter");
    if (saved) {
      sessionStorage.removeItem("ef_case_initial_filter");
      return saved;
    }
    return "ALL";
  });
  const [courtFilter, setCourtFilter] = useState<string>("ALL");
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Return to case if navigated from Property Expenses
  useEffect(() => {
    const returnCaseId = sessionStorage.getItem("returnToCaseId");
    if (returnCaseId && cases.length > 0) {
      const foundCase = cases.find((c) => c.id === returnCaseId);
      if (foundCase) {
        setSelectedCase(foundCase);
      }
      sessionStorage.removeItem("returnToCaseId");
    }
  }, [cases]);

  // Keep selectedCase synchronized with cases in context
  const activeSelectedCase = useMemo(() => {
    if (!selectedCase) return null;
    return cases.find((c) => c.id === selectedCase.id) || selectedCase;
  }, [selectedCase, cases]);

  // If a case is selected, render full-page CaseDetailsPage workspace
  if (activeSelectedCase) {
    return (
      <CaseDetailsPage
        caseItem={activeSelectedCase}
        onClose={() => setSelectedCase(null)}
      />
    );
  }

  const filteredCases = cases.filter((c) => {
    const tenant = tenants.find((t) => t.id === c.tenantId);
    const prop = properties.find((p) => p.id === c.propertyId);

    const matchTerm =
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          c.caseNumber,
          c.courtReferenceNumber,
          c.courtName,
          c.claimAmount,
          tenant?.nameAr,
          tenant?.nameEn,
          tenant?.code,
          tenant?.phone,
          prop?.nameAr,
          prop?.nameEn,
          prop?.code,
        ],
        searchTerm
      );

    const cStatus = (c.status || "").toUpperCase().trim();
    const matchStatus = (() => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "OPEN") {
        return cStatus === "NEW" || cStatus === "UNDER_REVIEW" || cStatus === "LEGAL_NOTICE" || cStatus === "FILED";
      }
      if (statusFilter === "IN_PROGRESS") {
        return cStatus === "IN_PROGRESS" || cStatus === "HEARING_SCHEDULED" || cStatus === "JUDGMENT_ISSUED" || cStatus === "ENFORCEMENT" || cStatus === "SETTLEMENT_IN_PROGRESS";
      }
      if (statusFilter === "CLOSED") {
        return cStatus === "CLOSED" || cStatus === "SETTLED" || cStatus === "ARCHIVED";
      }
      return cStatus === statusFilter.toUpperCase();
    })();

    const matchCourt = courtFilter === "ALL" || matchAnyArabicSearch([c.courtName], courtFilter);

    return matchTerm && matchStatus && matchCourt;
  });

  const totalClaim = cases.reduce((sum, c) => sum + (c.claimAmount || 0), 0);
  const totalPaid = cases.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
  const totalOutstanding = cases.reduce((sum, c) => sum + (c.outstandingAmount || 0), 0);

  const kanbanColumns: { status: CaseStatus; titleEn: string; titleAr: string; color: string }[] = [
    { status: "FILED", titleEn: "Filed in Court", titleAr: "مقيدة بالمحكمة", color: "border-blue-300 bg-blue-50/40" },
    { status: "HEARING_SCHEDULED", titleEn: "Hearings Active", titleAr: "جلسات جارية", color: "border-purple-300 bg-purple-50/40" },
    { status: "JUDGMENT_ISSUED", titleEn: "Judgment / Execution", titleAr: "أحكام وتنفيذ", color: "border-rose-300 bg-rose-50/40" },
    { status: "SETTLEMENT_IN_PROGRESS", titleEn: "Settlement Agreement", titleAr: "تسوية وتقسيط", color: "border-amber-300 bg-amber-50/40" },
    { status: "CLOSED", titleEn: "Closed & Settled", titleAr: "مغلقة ومسددة", color: "border-emerald-300 bg-emerald-50/40" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t("navCases")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "إدارة النزاعات الإيجارية، جلسات التقاضي، قرارات التنفيذ، واتفاقيات التسوية"
              : "Rental dispute cases, judicial litigation proceedings, judgment execution, and settlements"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setViewMode("TABLE")}
              className={`p-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === "TABLE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("KANBAN")}
              className={`p-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === "KANBAN" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Kanban Pipeline"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Add Case Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === "ar" ? "إدراج قضية" : "Add Case"}</span>
          </button>

          {canGoBack && <CloseBackButton />}
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-700 block uppercase">
            {language === "ar" ? "إجمالي المطالبات القضائية" : "Total Principal Claims"}
          </span>
          <span className="text-xl font-black text-purple-950 font-mono">
            AED {totalClaim.toLocaleString()}
          </span>
          <span className="text-xs text-purple-700 block mt-0.5">{cases.length} Dispute Cases</span>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 block uppercase">
            {language === "ar" ? "المبالغ المحصلة عبر القضاء" : "Judicially Recovered"}
          </span>
          <span className="text-xl font-black text-emerald-950 font-mono">
            AED {totalPaid.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-700 block mt-0.5">Recovered via Courts & Settlement</span>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-800 block uppercase">
            {language === "ar" ? "المتبقي تحت التحصيل والتنفيذ" : "Pending Enforcement"}
          </span>
          <span className="text-xl font-black text-rose-950 font-mono">
            AED {totalOutstanding.toLocaleString()}
          </span>
          <span className="text-xs text-rose-700 block mt-0.5">Under Active Litigation</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-1">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === "ar" ? "بحث برقم القضية، المستأجر، المحكمة..." : "Search case #, tenant, court..."}
            className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: language === "ar" ? "كافة المراحل القضائية" : "All Case Statuses" },
              { id: "OPEN", label: language === "ar" ? "قضايا مفتوحة وقيد القيد (Open / Filed)" : "Open / Filed Cases" },
              { id: "IN_PROGRESS", label: language === "ar" ? "جلسات وأحكام جارية (In Progress / Hearings)" : "In Progress / Hearings" },
              { id: "CLOSED", label: language === "ar" ? "قضايا مغلقة ومسددة (Closed / Settled)" : "Closed / Settled Cases" },
              { id: "NEW", label: "NEW (جديدة)" },
              { id: "FILED", label: "FILED (مقيدة بالمحكمة)" },
              { id: "HEARING_SCHEDULED", label: "HEARING_SCHEDULED (جلسات جارية)" },
              { id: "JUDGMENT_ISSUED", label: "JUDGMENT_ISSUED (صدر حكم)" },
              { id: "SETTLEMENT_IN_PROGRESS", label: "SETTLEMENT (تسوية)" },
              { id: "ENFORCEMENT", label: "ENFORCEMENT (قيد التنفيذ)" },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            placeholder={language === "ar" ? "المرحلة القضائية..." : "Case status..."}
            searchPlaceholder={language === "ar" ? "ابحث بالمرحلة..." : "Search status..."}
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: language === "ar" ? "كافة المحاكم" : "All Courts" },
              { id: "RDSC", label: "RDSC Dubai (فض المنازعات دبي)" },
              { id: "ADJD", label: "ADJD Abu Dhabi (قضاء أبوظبي)" },
              { id: "Sharjah", label: "Sharjah Tribunal (لجنة الشارقة)" },
            ]}
            value={courtFilter}
            onChange={(val) => setCourtFilter(val)}
            placeholder={language === "ar" ? "المحكمة..." : "Judicial Court..."}
            searchPlaceholder={language === "ar" ? "ابحث بمحكمة..." : "Search court..."}
          />
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === "TABLE" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "رقم القضية والمحكمة" : "Case # & Tribunal"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "المستأجر المدعى عليه" : "Tenant (Defendant)"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "المالك والعقار" : "Owner & Property"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "المطالبة المالية" : "Claim Amount"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "المستشار المكلف" : "Legal Counsel"}</th>
                  <th className="py-3 px-4 text-start">{language === "ar" ? "المرحلة القضائية" : "Judicial Status"}</th>
                  <th className="py-3 px-4 text-end">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCases.map((c, idx) => {
                  const tenant = tenants.find((t) => t.id === c.tenantId);
                  const prop = properties.find((p) => p.id === c.propertyId);
                  const unit = units.find((u) => u.id === c.unitId);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5 font-mono text-purple-950">
                          <Scale className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>{c.caseNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{c.courtName}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{tenant?.code}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {owners.find(o => o.id === c.ownerId)?.[language === "ar" ? "nameAr" : "nameEn"] || c.ownerName || "Owner"}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "Property"} • Unit #{unit?.unitNumber}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        <div>AED {(c.claimAmount || 0).toLocaleString()}</div>
                        {(c.paidAmount || c.totalPaid || 0) > 0 && (
                          <div className="text-[10px] text-emerald-700 font-bold">
                            Paid: AED {(c.paidAmount ?? c.totalPaid ?? 0).toLocaleString()}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800">
                        {c.responsibleUserName}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            c.status === "CLOSED"
                              ? "success"
                              : c.status === "SETTLEMENT_IN_PROGRESS"
                              ? "warning"
                              : c.status === "ENFORCEMENT"
                              ? "danger"
                              : "purple"
                          }
                          size="sm"
                        >
                          {c.status.replace(/_/g, " ")}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedCase(c)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-700" />
                            <span>{language === "ar" ? "تفاصيل الملف" : "Case File"}</span>
                          </button>
                          {canDelete && (
                            <button
                              onClick={(e) => handleDelete(c, e)}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title={language === "ar" ? "حذف" : "Delete"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredCases.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-xs">
              {t("noDataFound")}
            </div>
          )}
        </div>
      )}

      {/* KANBAN VIEW */}
      {viewMode === "KANBAN" && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kanbanColumns.map((col) => {
            const colCases = filteredCases.filter((c) => c.status === col.status);

            return (
              <div
                key={col.status}
                className={`p-3.5 rounded-2xl border space-y-3 ${col.color}`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <h4 className="font-black text-xs text-slate-900">
                    {language === "ar" ? col.titleAr : col.titleEn}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-800 shadow-2xs">
                    {colCases.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {colCases.map((c, idx) => {
                    const tenant = tenants.find((t) => t.id === c.tenantId);

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCase(c)}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-purple-950 text-xs">{c.caseNumber}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.claimDate}</span>
                        </div>
                        <div className="font-bold text-slate-900 text-xs">
                          {tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A"}
                        </div>
                        <div className="font-mono font-black text-slate-900 text-xs">
                          AED {c.claimAmount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {c.courtName}
                        </div>
                      </div>
                    );
                  })}

                  {colCases.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-[11px]">
                      {language === "ar" ? "لا توجد قضايا" : "No cases"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Case Modal */}
      <AddCaseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Delete Case Confirmation Modal */}
      {caseToDelete && (() => {
        const tenant = tenants.find((t) => t.id === caseToDelete.tenantId);
        const prop = properties.find((p) => p.id === caseToDelete.propertyId);
        const caseDocs = (caseToDelete.caseDocuments || []).map((d: any) => ({
          id: d.id,
          fileName: d.fileName || d.title || "مستند قضية",
          fileUrl: d.fileUrl || d.url,
          category: d.category || "قضايا",
          driveWebViewLink: d.driveWebViewLink,
        }));
        return (
          <ConfirmDeleteModal
            isOpen={!!caseToDelete}
            onClose={() => setCaseToDelete(null)}
            onConfirm={confirmDeleteCase}
            title={language === "ar" ? "حذف القضية وحفظها بالسجلات التاريخية" : "Delete & Archive Case to History"}
            itemName={`قضية رقم #${caseToDelete.caseNumber} (${tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : ""})`}
            itemCode={`#${caseToDelete.caseNumber}`}
            itemType={language === "ar" ? "قضية قانونية" : "Legal Case"}
            entityType="CASE"
            entityId={caseToDelete.id}
            statusAtDeletion={caseToDelete.status}
            attachmentsCount={caseDocs.length}
            attachments={caseDocs}
          />
        );
      })()}
    </div>
  );
};
