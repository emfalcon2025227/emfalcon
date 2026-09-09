import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Building,
  User,
  Filter,
  CreditCard,
  Scale,
  CheckCircle2,
  X,
  FileText,
  ShieldAlert,
  Edit3,
  RotateCcw,
  Stamp,
  Check,
  Building2,
  Sparkles,
  Layers,
  ShieldCheck,
  FileDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import { downloadElementAsPdf } from "../../utils/pdfExportUtils";

export const ReportsView: React.FC = () => {
  const { t, language } = useLanguage();
  const { canGoBack } = useNavigation();
  const { cheques, collections, cases, tenants, owners, properties, units, companyProfile } = useData();

  const [activeReport, setActiveReport] = useState<"BOUNCED" | "OWNERS" | "CASES" | "RISK">("BOUNCED");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [testReport, setTestReport] = useState<Phase11TestReport | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfToastMessage, setPdfToastMessage] = useState<string | null>(null);

  const handleDownloadPDF = async () => {
    setIsDownloadingPdf(true);
    try {
      let reportName = "Emirates_Falcon_Report";
      if (activeReport === "BOUNCED") {
        reportName = "Bounced_Cheques_Recovery_Report";
      } else if (activeReport === "OWNERS") {
        reportName = "Owner_Consolidated_Statements_Report";
      } else if (activeReport === "CASES") {
        reportName = "Dispute_Cases_Aging_Report";
      } else if (activeReport === "RISK") {
        reportName = "Tenant_Risk_Assessment_Matrix_Report";
      }
      const timestamp = new Date().toISOString().split("T")[0];
      const fileName = `${reportName}_${timestamp}.pdf`;

      let targetElement = document.getElementById("report-print-area");

      // If print preview is not open, open preview to render the official A4 document sheet
      if (!targetElement || !showPrintPreview) {
        setShowPrintPreview(true);
        // Brief pause to allow the modal DOM element to mount and render
        await new Promise((resolve) => setTimeout(resolve, 350));
        targetElement = document.getElementById("report-print-area");
      }

      if (targetElement) {
        const success = await downloadElementAsPdf(targetElement, {
          fileName,
          orientation: "p",
          scale: 2,
        });

        if (success) {
          setPdfToastMessage(
            language === "ar"
              ? "تم حفظ التقرير كملف PDF بنجاح!"
              : "Report successfully saved as a PDF document!"
          );
          setTimeout(() => setPdfToastMessage(null), 4000);
        } else {
          setPdfToastMessage(
            language === "ar"
              ? "تعذر إنشاء ملف PDF تلقائياً. يمكنك استخدام خيار طباعة المتصفح."
              : "Could not generate PDF automatically. You can use the Print button as fallback."
          );
          setTimeout(() => setPdfToastMessage(null), 4000);
        }
      }
    } catch (err) {
      console.error("[ReportsView] Error downloading PDF:", err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  useEffect(() => {
    (window as any).runPhase11ReportingTests = runPhase11ReportingTests;
    (window as any).runPhase26FinalUITestSuite = runPhase26FinalUITestSuite;
    (window as any).runPhase27SystemWideQATestSuite = runPhase27SystemWideQATestSuite;
    (window as any).runPhase28ProductionReadinessTests = runPhase28ProductionReadinessTests;
  }, []);

  const handleRunTests = () => {
    const report = runPhase11ReportingTests();
    setTestReport(report);
    setShowTestModal(true);
  };

  // Admin Direct Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [companyNameAr, setCompanyNameAr] = useState("");
  const [companyNameEn, setCompanyNameEn] = useState("");
  const [companyTRN, setCompanyTRN] = useState("");
  const [reportTitleOverride, setReportTitleOverride] = useState("");
  const [reportSubtitleOverride, setReportSubtitleOverride] = useState("");
  const [executiveNotes, setExecutiveNotes] = useState("");
  const [stampType, setStampType] = useState<"NONE" | "APPROVED" | "CONFIDENTIAL" | "CERTIFIED" | "LEGAL_RDC">("APPROVED");
  const [preparerTitle, setPreparerTitle] = useState("إعداد وتدقيق الإدارة المالية (Financial Auditing)");
  const [approverTitle, setApproverTitle] = useState("اعتماد المدير العام (Executive Managing Director)");
  const [showLogoInPrint, setShowLogoInPrint] = useState(true);
  const [isInsideIframe, setIsInsideIframe] = useState(false);

  useEffect(() => {
    setIsInsideIframe(window.self !== window.top);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const printReportType = params.get("printReportType");
    if (printReportType) {
      if (["BOUNCED", "OWNERS", "CASES", "RISK"].includes(printReportType)) {
        setActiveReport(printReportType as any);
        setShowPrintPreview(true);
      }
      
      // Clean query parameter to prevent loop
      const url = new URL(window.location.href);
      url.searchParams.delete("printReportType");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const getPrintUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("printReportType", activeReport);
    return url.toString();
  };

  // Reset/Initialize report edit controls when activeReport or companyProfile changes
  useEffect(() => {
    setCompanyNameAr(companyProfile.nameAr);
    setCompanyNameEn(companyProfile.nameEn);
    setCompanyTRN(companyProfile.vatTrn);
    
    if (activeReport === "BOUNCED") {
      setReportTitleOverride(language === "ar" ? "تقرير الشيكات المرتجعة واسترداد الديون" : "Bounced Cheques & Recovery Status Report");
      setReportSubtitleOverride(language === "ar" ? "بيان تفصيلي بالشيكات المرتجعة والمبالغ المستردة والمتبقية" : "Detailed breakdown of dishonored cheques, recovered amounts & outstanding balance");
      setExecutiveNotes(language === "ar" ? "ملاحظة الإدارة: يتم متابعة كافة الحالات المتعثرة عبر الدائرة القانونية مع التوصية باتخاذ الإجراءات القانوية فوراً." : "Executive Note: All defaulted accounts are actively monitored with recommended legal escalation.");
    } else if (activeReport === "OWNERS") {
      setReportTitleOverride(language === "ar" ? "كشف حساب الملاك الموحد والمطالبات" : "Owner Financial Statements & Consolidated Claims");
      setReportSubtitleOverride(language === "ar" ? "تقرير إجمالي المستحقات والتحصيل الفعلي والمتبقي بذمة المستأجرين" : "Consolidated owner claims, cash collected & net due balances");
      setExecutiveNotes(language === "ar" ? "توصية الإدارة: يتم تحويل التحصيلات النقدية بانتظام لحسابات الملاك المصرفية المعتمدة." : "Executive Note: Recovered cash is disbursed periodically to certified owner bank accounts.");
    } else if (activeReport === "CASES") {
      setReportTitleOverride(language === "ar" ? "كشف القضايا والنزاعات القانونية النشطة" : "Active Rental Disputes & Litigation Report");
      setReportSubtitleOverride(language === "ar" ? "متابعة القضايا المنظورة أمام مركز فض المنازعات الإيجارية (RDC)" : "Monitoring active lawsuits filed before Dubai Rental Dispute Center");
      setExecutiveNotes(language === "ar" ? "ملاحظة الدائرة القانونية: القضايا قيد المتابعة اليومية مع الاستشاريين القانونيين لاستصدار الأحكام التنفيذية." : "Legal Note: Litigation cases are monitored daily to secure enforceable judicial decrees.");
    } else {
      setReportTitleOverride(language === "ar" ? "مصفوفة تصنيف ومؤشرات مخاطر المستأجرين" : "Tenant Risk Classification Matrix");
      setReportSubtitleOverride(language === "ar" ? "تقييم تصنيف المخاطر الائتمانية والتعثر المالي للعملاء" : "Credit risk scoring, default history & tenant risk matrix");
      setExecutiveNotes(language === "ar" ? "توجيه الإدارة: حظر تجديد عقود المستأجرين المصنفين مرتفعي الخطورة دون تقديم ضمانات سداد بنكية مؤكدة." : "Management Directive: Block contract renewal for High-Risk tenants without verified bank guarantees.");
    }
  }, [activeReport, companyProfile, language]);

  // Export to Excel handler
  const handleExportExcel = () => {
    let exportData: any[] = [];
    let fileName = "Emirates_Falcon_Report.xlsx";

    if (activeReport === "BOUNCED") {
      fileName = "Bounced_Cheques_Recovery_Report.xlsx";
      exportData = cheques.map((c) => {
        const tenant = tenants.find((t) => t.id === c.tenantId);
        const prop = properties.find((p) => p.id === c.propertyId);
        return {
          "Cheque #": c.chequeNumber,
          Bank: c.bankName,
          Amount: c.amount,
          Outstanding: c.outstanding,
          "Due Date": c.dueDate,
          Status: c.status,
          "Return Reason": c.returnReason || "N/A",
          Tenant: tenant ? tenant.nameEn : "N/A",
          Property: prop ? prop.nameEn : "N/A",
        };
      });
    } else if (activeReport === "OWNERS") {
      fileName = "Owner_Consolidated_Statements.xlsx";
      exportData = owners.map((o) => {
        const ownerCheques = cheques.filter((c) => c.ownerId === o.id);
        const ownerBounced = ownerCheques.filter((c) => c.originalStatus === "BOUNCED");
        const totalBounced = ownerBounced.reduce((sum, c) => sum + c.amount, 0);
        const ownerCollections = collections.filter((col) => col.ownerId === o.id);
        const totalCollected = ownerCollections.reduce((sum, col) => sum + col.amountApplied, 0);

        return {
          "Owner Code": o.code,
          "Owner Name (EN)": o.nameEn,
          "Owner Name (AR)": o.nameAr,
          Phone: o.phone,
          "IBAN Account": o.iban,
          "Total Bounced Amount (AED)": totalBounced,
          "Recovered Cash (AED)": totalCollected,
          "Net Outstanding (AED)": totalBounced - totalCollected,
        };
      });
    } else if (activeReport === "CASES") {
      fileName = "Dispute_Cases_Aging_Report.xlsx";
      exportData = cases.map((cs) => {
        const tenant = tenants.find((t) => t.id === cs.tenantId);
        return {
          "Case #": cs.caseNumber,
          "Court Name": cs.courtName,
          "Claim Date": cs.claimDate || cs.filingDate || "",
          "Claim Amount": cs.claimAmount || 0,
          "Paid Amount": cs.paidAmount || cs.totalPaid || 0,
          "Outstanding Amount": cs.outstandingAmount || cs.outstanding || 0,
          Status: cs.status,
          Tenant: tenant ? tenant.nameEn : "N/A",
          "Responsible Officer": cs.responsibleUserName || "",
        };
      });
    } else {
      fileName = "Tenant_Risk_Assessment_Matrix.xlsx";
      exportData = tenants.map((t) => ({
        "Tenant Code": t.code,
        "Tenant Name": t.nameEn,
        Phone: t.phone,
        "Risk Score (100)": t.riskScore,
        "Risk Level": t.riskLevel,
        "Bounced Cheques Count": t.bouncedChequesCount || 0,
        "Total Bounced Amount (AED)": t.totalBouncedAmount || 0,
        "Active Cases Count": t.activeCasesCount || 0,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t("navReports")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "التقارير التحليلية، كشوف حسابات الملاك، وتقارير التعثر المالي القابلة للتصدير"
              : "Executive analytical reporting, owner financial statements, and Excel data export engine"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleRunTests}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{language === "ar" ? "تشغيل اختبارات المرحلة 11 (50 اختبار)" : "Run Phase 11 Tests (50)"}</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            {isDownloadingPdf ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{language === "ar" ? "جاري تحضير PDF..." : "Preparing PDF..."}</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>{language === "ar" ? "تحميل كـ PDF" : "Download as PDF"}</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{language === "ar" ? "معاينة وطباعة التقرير" : "Preview & Print"}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{language === "ar" ? "تصدير إلى Excel" : "Export to Excel (.xlsx)"}</span>
          </button>

          {canGoBack && <CloseBackButton />}
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap gap-2">
        <button
          onClick={() => setActiveReport("BOUNCED")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeReport === "BOUNCED"
              ? "bg-amber-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {language === "ar" ? "تقرير الشيكات المرتجعة والتحصيل" : "Bounced Cheques & Recovery"}
        </button>

        <button
          onClick={() => setActiveReport("OWNERS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeReport === "OWNERS"
              ? "bg-amber-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {language === "ar" ? "كشف حسابات الملاك والمستحقات" : "Owner Financial Statements"}
        </button>

        <button
          onClick={() => setActiveReport("CASES")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeReport === "CASES"
              ? "bg-amber-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {language === "ar" ? "تقرير القضايا والتقاضي الإيجاري" : "Rental Disputes & Legal Aging"}
        </button>

        <button
          onClick={() => setActiveReport("RISK")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeReport === "RISK"
              ? "bg-amber-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {language === "ar" ? "مصفوفة تصنيف مخاطر المستأجرين" : "Tenant Risk Score Matrix"}
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {activeReport === "BOUNCED" && (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4 text-start">Cheque #</th>
                  <th className="py-3 px-4 text-start">Bank</th>
                  <th className="py-3 px-4 text-start">Tenant</th>
                  <th className="py-3 px-4 text-start">Total Amount</th>
                  <th className="py-3 px-4 text-start">Outstanding</th>
                  <th className="py-3 px-4 text-start">Return Reason</th>
                  <th className="py-3 px-4 text-start">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {cheques.filter((c) => c.originalStatus === "BOUNCED").map((c) => {
                  const tenant = tenants.find((t) => t.id === c.tenantId);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">#{c.chequeNumber}</td>
                      <td className="py-3 px-4">{c.bankName}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : ""}</td>
                      <td className="py-3 px-4 font-mono">AED {Number(c.amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-700">AED {Number(c.outstanding || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-rose-600">{c.returnReason || "N/A"}</td>
                      <td className="py-3 px-4"><Badge variant="danger" size="sm">{c.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === "OWNERS" && (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4 text-start">Owner Code & Name</th>
                  <th className="py-3 px-4 text-start">IBAN / Bank</th>
                  <th className="py-3 px-4 text-start">Total Bounced Claims</th>
                  <th className="py-3 px-4 text-start">Recovered Collections</th>
                  <th className="py-3 px-4 text-start">Pending Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {owners.map((o) => {
                  const ownerCheques = cheques.filter((c) => c.ownerId === o.id);
                  const ownerBounced = ownerCheques.filter((c) => c.originalStatus === "BOUNCED");
                  const totalBounced = ownerBounced.reduce((sum, c) => sum + c.amount, 0);
                  const ownerCollections = collections.filter((col) => col.ownerId === o.id);
                  const totalCollected = ownerCollections.reduce((sum, col) => sum + col.amountApplied, 0);

                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{language === "ar" ? o.nameAr : o.nameEn}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{o.code}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500">{o.iban}</td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-700">AED {totalBounced.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">AED {totalCollected.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono font-black text-amber-900">AED {(totalBounced - totalCollected).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === "CASES" && (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4 text-start">Case #</th>
                  <th className="py-3 px-4 text-start">Court / Tribunal</th>
                  <th className="py-3 px-4 text-start">Tenant</th>
                  <th className="py-3 px-4 text-start">Claim Amount</th>
                  <th className="py-3 px-4 text-start">Paid Amount</th>
                  <th className="py-3 px-4 text-start">Counsel</th>
                  <th className="py-3 px-4 text-start">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {cases.map((cs) => {
                  const tenant = tenants.find((t) => t.id === cs.tenantId);
                  return (
                    <tr key={cs.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-purple-950">{cs.caseNumber}</td>
                      <td className="py-3 px-4">{cs.courtName}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : ""}</td>
                      <td className="py-3 px-4 font-mono font-bold">AED {(cs.claimAmount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-emerald-700 font-bold">AED {(cs.paidAmount ?? cs.totalPaid ?? 0).toLocaleString()}</td>
                      <td className="py-3 px-4">{cs.responsibleUserName}</td>
                      <td className="py-3 px-4"><Badge variant="purple" size="sm">{cs.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === "RISK" && (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4 text-start">Tenant Code & Name</th>
                  <th className="py-3 px-4 text-start">Phone</th>
                  <th className="py-3 px-4 text-start">Risk Score</th>
                  <th className="py-3 px-4 text-start">Risk Level</th>
                  <th className="py-3 px-4 text-start">Bounced Cheques</th>
                  <th className="py-3 px-4 text-start">Total Default Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{language === "ar" ? t.nameAr : t.nameEn}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{t.code}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">{t.phone}</td>
                    <td className="py-3 px-4 font-mono font-black">{t.riskScore}/100</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={t.riskLevel === "HIGH" ? "danger" : t.riskLevel === "MEDIUM" ? "warning" : "success"}
                        size="sm"
                      >
                        {t.riskLevel} Risk
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-rose-700">{t.bouncedChequesCount || 0}</td>
                    <td className="py-3 px-4 font-mono font-black text-rose-800">AED {(t.totalBouncedAmount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF Print Preview Modal */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-4 sm:p-6 no-print">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #report-print-area, #report-print-area * {
                visibility: visible !important;
              }
              #report-print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                padding: 1.5rem !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
          
          <div className="bg-slate-100 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Controls Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-3">
              {isInsideIframe && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
                  <div className="space-y-1">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <span>⚠️ تنبيه لتشغيل الطباعة بنجاح</span>
                      <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 text-amber-950 rounded-md font-bold uppercase font-mono">iFrame Sandbox</span>
                    </span>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      {language === "ar"
                        ? "أنت تتصفح النظام داخل بيئة معاينة آمنة تمنع فتح شاشة الطباعة الخاصة بالمتصفح. يرجى فتح النظام في علامة تبويب جديدة مستقلة لتتمكن من طباعة التقرير المالي كـ PDF مباشرة."
                        : "You are currently viewing the app inside a secure preview iFrame, which blocks browser print dialogs. Please open the app in a new tab to print the report successfully."}
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

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-700" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {language === "ar" ? "معاينة وتعديل التقرير الرسمي (PDF)" : "Official Report PDF Preview & Live Edit"}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      {language === "ar" ? "تقرير معتمد جاهز للطباعة بدقة A4 مع إمكانية التعديل التفاعلي المباشر لمدير النظام" : "Corporate certified finance report with live admin editing controls"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Admin Direct Edit Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                      isEditMode
                        ? "bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300 animate-pulse"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>
                      {isEditMode
                        ? (language === "ar" ? "إيقاف التعديل المباشر" : "Disable Live Edit")
                        : (language === "ar" ? "تفعيل التعديل المباشر" : "Enable Live Admin Edit")}
                    </span>
                  </button>

                  {/* Direct PDF Download Button */}
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isDownloadingPdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {isDownloadingPdf ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{language === "ar" ? "جاري التحميل..." : "Downloading..."}</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="w-4 h-4" />
                        <span>{language === "ar" ? "تحميل PDF المعتمد" : "Download PDF"}</span>
                      </>
                    )}
                  </button>

                  {isInsideIframe ? (
                    <a
                      href={getPrintUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-xs text-center"
                    >
                      <Printer className="w-4 h-4" />
                      <span>{language === "ar" ? "افتح للطباعة ↗" : "Open to Print ↗"}</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>{language === "ar" ? "طباعة المتصفح" : "Browser Print"}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowPrintPreview(false)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Toolbar Controls for Admin Customization */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap text-xs">
                {/* Stamp Selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 min-w-[200px]">
                  <Stamp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-bold text-slate-600 text-[11px] shrink-0">{language === "ar" ? "الختم الرسمي:" : "Seal:"}</span>
                  <SearchableSelect
                    options={[
                      { id: "APPROVED", label: language === "ar" ? "ختم معتمد APPROVED" : "APPROVED Seal" },
                      { id: "CONFIDENTIAL", label: language === "ar" ? "ختم سرّي للغاية" : "CONFIDENTIAL" },
                      { id: "CERTIFIED", label: language === "ar" ? "نسخة رسمية مطابقة للأصل" : "CERTIFIED COPY" },
                      { id: "LEGAL_RDC", label: language === "ar" ? "الدائرة القانونية RDC" : "LEGAL RDC" },
                      { id: "NONE", label: language === "ar" ? "بدون ختم" : "No Stamp" },
                    ]}
                    value={stampType}
                    onChange={(val) => setStampType(val as any)}
                    placeholder={language === "ar" ? "اختر الختم..." : "Select seal..."}
                  />
                </div>

                {/* Show/Hide Logo */}
                <button
                  type="button"
                  onClick={() => setShowLogoInPrint(!showLogoInPrint)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                    showLogoInPrint ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  {showLogoInPrint ? (language === "ar" ? "✓ شعار الشركة ظاهر" : "✓ Logo Shown") : (language === "ar" ? "إخفاء الشعار" : "Hide Logo")}
                </button>

                {/* Reset to Original Data */}
                <button
                  type="button"
                  onClick={() => {
                    setCompanyNameAr(companyProfile?.nameAr || "صقر الامارات للعقارات");
                    setCompanyNameEn(companyProfile?.nameEn || "Emirates Falcon Property Management L.L.C");
                    setCompanyTRN(companyProfile?.vatTrn || "100293847500003");
                    if (activeReport === "BOUNCED") {
                      setReportTitleOverride(language === "ar" ? "تقرير الشيكات المرتجعة واسترداد الديون" : "Bounced Cheques & Recovery Status Report");
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{language === "ar" ? "استعادة البيانات الأصلية" : "Reset Data"}</span>
                </button>
              </div>

              {/* Admin Edit Notification Banner */}
              {isEditMode && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-900 flex items-center gap-2 animate-fadeIn">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {language === "ar"
                      ? "وضع التعديل التفاعلي مفعل لمدير النظام: يمكنك الضغط والتعديل المباشر على أي عنوان، فقرة، جدول أو رقم داخل ورقة التقرير أدناه قبل طباعته كـ PDF."
                      : "Direct Live Edit Mode is active: Click on any header, paragraph, table cell, or figure on the report sheet below to edit directly before printing."}
                  </span>
                </div>
              )}
            </div>

            {/* A4 Paper Document Viewer */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex justify-center bg-slate-200/50">
              <div
                id="report-print-area"
                className="bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-10 sm:p-14 shadow-2xl border border-slate-200 relative flex flex-col font-sans print:shadow-none print:border-none print:p-0"
                style={{ direction: language === "ar" ? "rtl" : "ltr" }}
              >
                {/* A4 Document Top Header Accent */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-700 print:h-1"></div>

                {/* Optional Official Stamp Watermark / Stamp */}
                {stampType !== "NONE" && (
                  <div className="absolute top-10 end-10 pointer-events-none opacity-85 select-none z-20">
                    <div className={`w-28 h-28 border-4 border-dashed rounded-full flex flex-col items-center justify-center text-center rotate-[-12deg] p-1 ${
                      stampType === "APPROVED" ? "border-emerald-700 text-emerald-800 bg-emerald-50/20" :
                      stampType === "CONFIDENTIAL" ? "border-rose-700 text-rose-800 bg-rose-50/20" :
                      stampType === "CERTIFIED" ? "border-blue-700 text-blue-800 bg-blue-50/20" :
                      "border-purple-800 text-purple-900 bg-purple-50/20"
                    }`}>
                      <div className="w-full border-b border-current pb-0.5 text-[8px] font-black uppercase">
                        {stampType === "APPROVED" ? "VERIFIED & APPROVED" :
                         stampType === "CONFIDENTIAL" ? "CONFIDENTIAL REPORT" :
                         stampType === "CERTIFIED" ? "CERTIFIED ORIGINAL" :
                         "RDC LITIGATION DEPT"}
                      </div>
                      <div className="text-xs font-black my-1">
                        {stampType === "APPROVED" ? "معتمد رسمياً" :
                         stampType === "CONFIDENTIAL" ? "سرّي للغاية" :
                         stampType === "CERTIFIED" ? "مطابق للأصل" :
                         "الدائرة القانونية"}
                      </div>
                      <div className="text-[7px] font-mono">
                        EMIRATES FALCON • {new Date().toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Corporate Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6 gap-4">
                  <div className="flex items-start gap-3">
                    {showLogoInPrint && (
                      <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center p-1">
                        <img 
                          src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo} 
                          alt="Company Logo" 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                    )}
                    <div>
                      <h1 
                        contentEditable={isEditMode}
                        suppressContentEditableWarning
                        onBlur={(e) => setCompanyNameAr(e.currentTarget.textContent || "")}
                        className={`text-lg font-black text-slate-900 font-sans ${isEditMode ? "outline-dashed outline-2 outline-amber-400 bg-amber-50/50 px-1 rounded" : ""}`}
                      >
                        {companyNameAr}
                      </h1>
                      <h2 
                        contentEditable={isEditMode}
                        suppressContentEditableWarning
                        onBlur={(e) => setCompanyNameEn(e.currentTarget.textContent || "")}
                        className={`text-xs font-semibold text-slate-500 font-sans mt-0.5 ${isEditMode ? "outline-dashed outline-2 outline-amber-400 bg-amber-50/50 px-1 rounded" : ""}`}
                      >
                        {companyNameEn}
                      </h2>
                      <p 
                        contentEditable={isEditMode}
                        suppressContentEditableWarning
                        onBlur={(e) => setCompanyTRN(e.currentTarget.textContent || "")}
                        className={`text-[10px] text-slate-400 font-mono mt-2 ${isEditMode ? "outline-dashed outline-2 outline-amber-400 bg-amber-50/50 px-1 rounded" : ""}`}
                      >
                        TRN: {companyTRN} {companyProfile.commercialRegisterNumber || companyProfile.commercialRegisterNo ? `| CR NO: ${companyProfile.commercialRegisterNumber || companyProfile.commercialRegisterNo}` : ""}
                      </p>
                      <p className="text-[9px] text-slate-400 font-sans mt-0.5">
                        {language === "ar" ? (companyProfile.addressAr || companyProfile.address) : (companyProfile.addressEn || companyProfile.address)} | Tel: {companyProfile.phone}
                      </p>
                    </div>
                  </div>

                  <div className="text-end">
                    <div className="inline-flex p-2 bg-slate-100 rounded-xl border border-slate-200 font-black text-sm text-slate-800">
                      EFPM
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-3">
                      {language === "ar" ? "التاريخ:" : "DATE:"} <span className="text-slate-900">{new Date().toLocaleDateString(language === "ar" ? "ar-AE" : "en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </p>
                    <p className="text-[9px] text-slate-400 font-black uppercase mt-1">
                      {language === "ar" ? "المسؤول: المدير العام" : "OFFICIAL STATUS: CERTIFIED"}
                    </p>
                  </div>
                </div>

                {/* Report Title Section */}
                <div className="text-center my-4">
                  <span className="px-3 py-1 bg-amber-50 text-amber-900 text-[10px] font-bold rounded-md uppercase border border-amber-200">
                    OFFICIAL STATEMENT
                  </span>
                  <h2 
                    contentEditable={isEditMode}
                    suppressContentEditableWarning
                    onBlur={(e) => setReportTitleOverride(e.currentTarget.textContent || "")}
                    className={`text-base font-black text-slate-900 mt-2 ${isEditMode ? "outline-dashed outline-2 outline-amber-400 bg-amber-50/50 px-2 py-1 rounded" : ""}`}
                  >
                    {reportTitleOverride}
                  </h2>
                  <p 
                    contentEditable={isEditMode}
                    suppressContentEditableWarning
                    onBlur={(e) => setReportSubtitleOverride(e.currentTarget.textContent || "")}
                    className={`text-xs text-slate-500 mt-1 ${isEditMode ? "outline-dashed outline-2 outline-amber-400 bg-amber-50/50 px-2 py-0.5 rounded" : ""}`}
                  >
                    {reportSubtitleOverride}
                  </p>
                  <div className="w-16 h-1 bg-amber-700 mx-auto mt-2.5"></div>
                </div>

                {/* Quick Metrics Header */}
                <div className="grid grid-cols-3 gap-3 my-5">
                  {activeReport === "BOUNCED" && (() => {
                    const bouncedList = cheques.filter(c => c.originalStatus === "BOUNCED");
                    const totalBounced = bouncedList.reduce((sum, c) => sum + c.amount, 0);
                    const totalOutstanding = bouncedList.reduce((sum, c) => sum + c.outstanding, 0);
                    const totalRecovered = totalBounced - totalOutstanding;
                    return (
                      <>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "إجمالي المطالبات المتعثرة" : "Total Default Claims"}</p>
                          <p className={`text-xs font-black text-slate-900 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalBounced.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "المبالغ المستردة نقداً" : "Recovered Cash"}</p>
                          <p className={`text-xs font-black text-emerald-800 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalRecovered.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "المستحقات المعلقة" : "Pending Recovery"}</p>
                          <p className={`text-xs font-black text-rose-700 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalOutstanding.toLocaleString()}</p>
                        </div>
                      </>
                    );
                  })()}

                  {activeReport === "OWNERS" && (() => {
                    let totalBounced = 0;
                    let totalCollected = 0;
                    owners.forEach((o) => {
                      const ownerCheques = cheques.filter((c) => c.ownerId === o.id);
                      const ownerBounced = ownerCheques.filter((c) => c.originalStatus === "BOUNCED");
                      totalBounced += ownerBounced.reduce((sum, c) => sum + c.amount, 0);
                      const ownerCollections = collections.filter((col) => col.ownerId === o.id);
                      totalCollected += ownerCollections.reduce((sum, col) => sum + col.amountApplied, 0);
                    });
                    return (
                      <>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "إجمالي المستحقات للملاك" : "Total Owners Claims"}</p>
                          <p className={`text-xs font-black text-slate-900 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalBounced.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "التحصيل الفعلي المسترد" : "Actual Collected"}</p>
                          <p className={`text-xs font-black text-emerald-800 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalCollected.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "المتبقي في ذمة المستأجرين" : "Net Due Balance"}</p>
                          <p className={`text-xs font-black text-amber-900 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {(totalBounced - totalCollected).toLocaleString()}</p>
                        </div>
                      </>
                    );
                  })()}

                  {activeReport === "CASES" && (() => {
                    const totalClaim = cases.reduce((sum, c) => sum + (c.claimAmount || 0), 0);
                    const totalPaid = cases.reduce((sum, c) => sum + (c.paidAmount ?? c.totalPaid ?? 0), 0);
                    const totalPending = totalClaim - totalPaid;
                    return (
                      <>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "مجموع المطالبات القضائية" : "Total Litigated Claims"}</p>
                          <p className={`text-xs font-black text-slate-900 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalClaim.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "المتحصل عبر المحاكم" : "Recovered via Courts"}</p>
                          <p className={`text-xs font-black text-emerald-800 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalPaid.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "المتبقي تحت التقاضي" : "Outstanding In Court"}</p>
                          <p className={`text-xs font-black text-purple-900 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalPending.toLocaleString()}</p>
                        </div>
                      </>
                    );
                  })()}

                  {activeReport === "RISK" && (() => {
                    const avgRisk = Math.round(tenants.reduce((sum, t) => sum + t.riskScore, 0) / Math.max(1, tenants.length));
                    const totalDefault = tenants.reduce((sum, t) => sum + (t.totalBouncedAmount || 0), 0);
                    const highRiskCount = tenants.filter(t => t.riskLevel === "HIGH").length;
                    return (
                      <>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "متوسط مؤشر المخاطر" : "Avg Risk Index"}</p>
                          <p className={`text-xs font-black text-slate-900 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{avgRisk}/100</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "المستأجرين مرتفعي الخطورة" : "High Risk Tenants"}</p>
                          <p className={`text-xs font-black text-rose-700 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{highRiskCount} {language === "ar" ? "أشخاص" : "Accounts"}</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-500">{language === "ar" ? "إجمالي التعثر المالي" : "Total Risk Default"}</p>
                          <p className={`text-xs font-black text-rose-900 mt-1 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalDefault.toLocaleString()}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Table Data Block (Supports Inline Content Editing) */}
                <div className="flex-1 mt-6">
                  {activeReport === "BOUNCED" && (
                    <table className="w-full text-start text-[9.5px] border-collapse font-sans">
                      <thead className="border-y-2 border-slate-900 text-slate-900 font-black uppercase font-sans">
                        <tr>
                          <th className="py-2.5 px-2 text-start border-e border-slate-200">Cheque #</th>
                          <th className="py-2.5 px-2 text-start border-e border-slate-200">Bank Details</th>
                          <th className="py-2.5 px-2 text-start border-e border-slate-200">Tenant Party</th>
                          <th className="py-2.5 px-2 text-start border-e border-slate-200 text-right">Amount (AED)</th>
                          <th className="py-2.5 px-2 text-start border-e border-slate-200 text-right">Outstanding</th>
                          <th className="py-2.5 px-2 text-start border-e border-slate-200">Return Reason</th>
                          <th className="py-2.5 px-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {cheques.filter(c => c.originalStatus === "BOUNCED").map((c) => {
                          const tenant = tenants.find((t) => t.id === c.tenantId);
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                              <td className={`py-2 px-2 border-e border-slate-200 font-mono font-bold text-slate-950 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>#{c.chequeNumber}</td>
                              <td className={`py-2 px-2 border-e border-slate-200 font-medium ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{c.bankName}</td>
                              <td className={`py-2 px-2 border-e border-slate-200 font-black text-indigo-900 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : ""}</td>
                              <td className={`py-2 px-2 border-e border-slate-200 font-mono text-right font-bold ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{Number(c.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className={`py-2 px-2 border-e border-slate-200 font-mono text-right font-black text-rose-800 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{Number(c.outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className={`py-2 px-2 border-e border-slate-200 text-[8.5px] italic ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{c.returnReason || "N/A"}</td>
                              <td className={`py-2 px-2 text-center font-black ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>
                                <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded-[2px]">{c.status}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {activeReport === "OWNERS" && (
                    <table className="w-full text-start text-[10px] border border-slate-300">
                      <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                        <tr>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Owner Name</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Code</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">IBAN / Bank Account</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Total Bounced</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Recovered</th>
                          <th className="py-2 px-3 text-start">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                        {owners.map((o) => {
                          const ownerCheques = cheques.filter((c) => c.ownerId === o.id);
                          const ownerBounced = ownerCheques.filter((c) => c.originalStatus === "BOUNCED");
                          const totalBounced = ownerBounced.reduce((sum, c) => sum + c.amount, 0);
                          const ownerCollections = collections.filter((col) => col.ownerId === o.id);
                          const totalCollected = ownerCollections.reduce((sum, col) => sum + col.amountApplied, 0);

                          return (
                            <tr key={o.id}>
                              <td className={`py-2 px-3 border-e border-slate-200 font-bold ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{language === "ar" ? o.nameAr : o.nameEn}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 font-mono ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{o.code}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 font-mono text-[9px] ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{o.iban}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 font-mono ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalBounced.toLocaleString()}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 font-mono text-emerald-800 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {totalCollected.toLocaleString()}</td>
                              <td className={`py-2 px-3 font-mono font-black text-amber-950 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {(totalBounced - totalCollected).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {activeReport === "CASES" && (
                    <table className="w-full text-start text-[10px] border border-slate-300">
                      <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                        <tr>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Case Number</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Court / Tribunal</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Tenant</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Claim Amount</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Paid Amount</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Counsel</th>
                          <th className="py-2 px-3 text-start">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                        {cases.map((cs) => {
                          const tenant = tenants.find((t) => t.id === cs.tenantId);
                          return (
                            <tr key={cs.id}>
                              <td className={`py-2 px-3 border-e border-slate-200 font-mono font-bold ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{cs.caseNumber}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{cs.courtName}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 font-bold ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : ""}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 font-mono ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {(cs.claimAmount || 0).toLocaleString()}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 font-mono text-emerald-800 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {(cs.paidAmount ?? cs.totalPaid ?? 0).toLocaleString()}</td>
                              <td className={`py-2 px-3 border-e border-slate-200 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{cs.responsibleUserName}</td>
                              <td className={`py-2 px-3 font-bold ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{cs.status}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {activeReport === "RISK" && (
                    <table className="w-full text-start text-[10px] border border-slate-300">
                      <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                        <tr>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Tenant Name</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Phone</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Risk Index</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Class</th>
                          <th className="py-2 px-3 text-start border-e border-slate-300">Bounced Count</th>
                          <th className="py-2 px-3 text-start">Total Default Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                        {tenants.map((t) => (
                          <tr key={t.id}>
                            <td className={`py-2 px-3 border-e border-slate-200 font-bold ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{language === "ar" ? t.nameAr : t.nameEn}</td>
                            <td className={`py-2 px-3 border-e border-slate-200 font-mono ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{t.phone}</td>
                            <td className={`py-2 px-3 border-e border-slate-200 font-mono font-black ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{t.riskScore}/100</td>
                            <td className={`py-2 px-3 border-e border-slate-200 font-bold ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{t.riskLevel} Risk</td>
                            <td className={`py-2 px-3 border-e border-slate-200 font-mono text-center ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>{t.bouncedChequesCount || 0}</td>
                            <td className={`py-2 px-3 font-mono font-black text-rose-800 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/30" : ""}`} contentEditable={isEditMode} suppressContentEditableWarning>AED {(t.totalBouncedAmount || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Customizable Executive Commentary Box */}
                <div className="mt-6 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl">
                  <p className="text-[10px] font-bold text-amber-900 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-700" />
                    <span>{language === "ar" ? "توصيات وملاحظات الإدارة التنفيذية:" : "Executive Recommendations & Remarks:"}</span>
                  </p>
                  <div
                    contentEditable={isEditMode}
                    suppressContentEditableWarning
                    onBlur={(e) => setExecutiveNotes(e.currentTarget.textContent || "")}
                    className={`text-[10px] text-amber-950 font-medium leading-relaxed ${
                      isEditMode ? "outline-dashed outline-2 outline-amber-500 bg-white p-2 rounded" : ""
                    }`}
                  >
                    {executiveNotes}
                  </div>
                </div>

                {/* Audit & Signatory Section */}
                <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-6 text-center">
                  <div>
                    <p 
                      contentEditable={isEditMode}
                      suppressContentEditableWarning
                      onBlur={(e) => setPreparerTitle(e.currentTarget.textContent || "")}
                      className={`text-[10px] font-bold text-slate-700 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`}
                    >
                      {preparerTitle}
                    </p>
                    <div className="mt-8 mx-auto w-40 border-b border-dashed border-slate-400"></div>
                    <p className="text-[9px] text-slate-400 mt-1 font-mono">Sign / Verification</p>
                  </div>

                  <div>
                    <p 
                      contentEditable={isEditMode}
                      suppressContentEditableWarning
                      onBlur={(e) => setApproverTitle(e.currentTarget.textContent || "")}
                      className={`text-[10px] font-bold text-slate-700 ${isEditMode ? "outline-dashed outline-1 outline-amber-400" : ""}`}
                    >
                      {approverTitle}
                    </p>
                    <div className="mt-8 mx-auto w-40 border-b border-dashed border-slate-400"></div>
                    <p className="text-[9px] text-slate-400 mt-1 font-mono">Official Corporate Stamp</p>
                  </div>
                </div>

                {/* Verification Notice */}
                <div className="mt-6 pt-3 border-t border-slate-100 flex justify-between items-center text-[8px] text-slate-400">
                  <p>Certified statement generated by Emirates Falcon system integration engine.</p>
                  <p className="font-mono">Page 1 of 1</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Results Modal */}
      {showTestModal && testReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">Phase 11 Reporting & Analytics Test Suite</h3>
                <p className="text-xs text-slate-300 mt-0.5">50 Comprehensive Tests Verification Report</p>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 bg-emerald-100 text-emerald-800 font-black text-sm rounded-2xl">
                  Passed: {testReport.passCount} / {testReport.totalTests}
                </div>
                <div className="px-4 py-2 bg-rose-100 text-rose-800 font-black text-sm rounded-2xl">
                  Failed: {testReport.failCount}
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Timestamp: {testReport.timestamp}
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-2 flex-1">
              {testReport.results.map((res) => (
                <div
                  key={res.testId}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                    res.passed ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" : "bg-rose-50/50 border-rose-200 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-mono text-[11px]">
                      {res.testId}
                    </span>
                    <span>{res.testName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {res.passed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-200 text-emerald-900 text-[10px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-200 text-rose-900 text-[10px]">
                        <X className="w-3.5 h-3.5" /> FAILED
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Success / Status Toast Notification */}
      {pdfToastMessage && (
        <div className="fixed bottom-6 end-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{pdfToastMessage}</span>
        </div>
      )}
    </div>
  );
};
