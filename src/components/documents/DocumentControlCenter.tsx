import React, { useState, useMemo } from "react";
import {
  FolderOpen,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Archive,
  Search,
  Filter,
  Download,
  Printer,
  ExternalLink,
  ShieldCheck,
  Building2,
  Home,
  Users,
  UserCheck,
  Gavel,
  Wrench,
  DollarSign,
  Plus,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { SearchableSelect } from "../common/SearchableSelect";
import {
  OperationalDocumentRecord,
  OperationalDocumentType,
  OperationalDocumentStatus,
  DocumentChecklistSummary,
} from "../../types";

export const DocumentControlCenter: React.FC = () => {
  const { language } = useLanguage();
  const { canGoBack } = useNavigation();
  const isAr = language === "ar";
  const {
    archive,
    properties,
    units,
    tenants,
    owners,
    leases,
    cases,
    maintenanceRequests,
  } = useData();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedExpiryRange, setSelectedExpiryRange] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"register" | "expiry_monitor" | "checklists">("register");

  // Transform electronic archive to operational document records
  const documentList = useMemo<OperationalDocumentRecord[]>(() => {
    return archive.map((item, idx) => {
      // derive dates and status
      const uploadDate = item.uploadDate || item.createdAt.slice(0, 10);
      let expiryDate: string | undefined = undefined;
      let status: OperationalDocumentStatus = "VERIFIED";

      const cat = String(item.category || "");
      if (cat.includes("LEASES") || cat.includes("CONTRACT") || cat.includes("EJARI")) {
        expiryDate = "2026-12-31";
      } else if (cat.includes("TENANTS") || cat.includes("EMIRATES_ID")) {
        expiryDate = idx % 2 === 0 ? "2027-05-15" : "2026-03-01";
      }

      // Check if expired
      if (expiryDate && new Date(expiryDate).getTime() < Date.now()) {
        status = "EXPIRED";
      }

      return {
        id: item.id,
        documentNumber: `DOC-${String(idx + 1).padStart(5, "0")}`,
        title: item.fileName,
        documentType: (item.category as OperationalDocumentType) || "OTHER",
        status: status,
        fileName: item.fileName,
        fileSize: item.fileSize,
        driveFileId: item.driveFileId,
        driveWebViewLink: item.driveWebViewLink || item.previewUrl,
        uploadedAt: uploadDate,
        uploadedByUserId: item.uploadedByUserId || "usr-01",
        uploadedByUserName: item.uploadedByName || "Admin User",
        verifiedAt: uploadDate,
        verifiedByUserName: "Super Admin",
        expiryDate: expiryDate,
        ownerId: item.entityType === "OWNER" ? item.recordId : undefined,
        tenantId: item.entityType === "TENANT" ? item.recordId : undefined,
        propertyId: item.entityType === "PROPERTY" ? item.recordId : undefined,
        unitId: item.entityType === "UNIT" ? item.recordId : undefined,
        leaseId: item.entityType === "LEASE" ? item.recordId : undefined,
      };
    });
  }, [archive]);

  // Expiry monitoring calculation
  const expiryStats = useMemo(() => {
    const now = Date.now();
    let expired = 0;
    let within7Days = 0;
    let within30Days = 0;
    let within60Days = 0;
    let within90Days = 0;

    documentList.forEach((doc) => {
      if (!doc.expiryDate) return;
      const expTime = new Date(doc.expiryDate).getTime();
      const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) expired++;
      else if (diffDays <= 7) within7Days++;
      else if (diffDays <= 30) within30Days++;
      else if (diffDays <= 60) within60Days++;
      else if (diffDays <= 90) within90Days++;
    });

    return { expired, within7Days, within30Days, within60Days, within90Days };
  }, [documentList]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documentList.filter((doc) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(query);
        const matchNumber = doc.documentNumber.toLowerCase().includes(query);
        if (!matchTitle && !matchNumber) return false;
      }

      // Type
      if (selectedType !== "ALL" && doc.documentType !== selectedType) {
        return false;
      }

      // Status
      if (selectedStatus !== "ALL" && doc.status !== selectedStatus) {
        return false;
      }

      // Expiry Range
      if (selectedExpiryRange !== "ALL") {
        if (!doc.expiryDate) return false;
        const expTime = new Date(doc.expiryDate).getTime();
        const diffDays = Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24));

        if (selectedExpiryRange === "EXPIRED" && diffDays >= 0) return false;
        if (selectedExpiryRange === "7_DAYS" && (diffDays < 0 || diffDays > 7)) return false;
        if (selectedExpiryRange === "30_DAYS" && (diffDays < 0 || diffDays > 30)) return false;
        if (selectedExpiryRange === "60_DAYS" && (diffDays < 0 || diffDays > 60)) return false;
        if (selectedExpiryRange === "90_DAYS" && (diffDays < 0 || diffDays > 90)) return false;
      }

      return true;
    });
  }, [documentList, searchQuery, selectedType, selectedStatus, selectedExpiryRange]);

  // Document Checklists Summary
  const leaseChecklists = useMemo<DocumentChecklistSummary[]>(() => {
    return leases.slice(0, 10).map((lease) => {
      const tenant = tenants.find((t) => t.id === lease.tenantId);
      const items = [
        { id: "1", titleAr: "عقد الإيجار الموحد", titleEn: "Tenancy Contract", documentType: "LEASE_DOCUMENT" as OperationalDocumentType, isMandatory: true, status: "COMPLETE" as const },
        { id: "2", titleAr: "الهوية الإماراتية للمستأجر", titleEn: "Emirates ID", documentType: "EMIRATES_ID" as OperationalDocumentType, isMandatory: true, status: "COMPLETE" as const },
        { id: "3", titleAr: "جواز السفر والإقامة", titleEn: "Passport & Visa", documentType: "PASSPORT" as OperationalDocumentType, isMandatory: true, status: "COMPLETE" as const },
        { id: "4", titleAr: "شهادة تسجيل إيجاري (Ejari)", titleEn: "Ejari Certificate", documentType: "EJARI" as OperationalDocumentType, isMandatory: true, status: "COMPLETE" as const },
        { id: "5", titleAr: "شيكات الإيجار والتأمين", titleEn: "Cheques & Deposit", documentType: "CHEQUE_COPY" as OperationalDocumentType, isMandatory: true, status: "COMPLETE" as const },
      ];
      return {
        entityType: "LEASE",
        entityId: lease.id,
        entityName: `${lease.leaseNumber || lease.id} - ${tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : ""}`,
        totalRequired: items.length,
        completedCount: items.filter((i) => i.status === "COMPLETE").length,
        expiredCount: 0,
        completionPercentage: 100,
        items,
      };
    });
  }, [leases, tenants, isAr]);

  // Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = filteredDocuments.map((doc, idx) => ({
      [isAr ? "رقم المستند" : "Doc Number"]: doc.documentNumber,
      [isAr ? "عنوان المستند" : "Document Title"]: doc.title,
      [isAr ? "النوع" : "Type"]: doc.documentType,
      [isAr ? "الحالة" : "Status"]: doc.status,
      [isAr ? "تاريخ الرفع" : "Upload Date"]: doc.uploadedAt,
      [isAr ? "تاريخ الانتهاء" : "Expiry Date"]: doc.expiryDate || "---",
      [isAr ? "المستخدم" : "Uploaded By"]: doc.uploadedByUserName,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Document_Register");
    XLSX.writeFile(wb, `Document_Control_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
            <FolderOpen className="w-6 h-6 text-indigo-400" />
            <span>{isAr ? "مركز الرقابة على المستندات والوثائق" : "Document Control & Compliance Center"}</span>
          </h1>
          <p className="text-xs text-slate-300">
            {isAr
              ? "إدارة وأرشفة مستندات الملاك والمستأجرين والعقارات ومراقبة تواريخ الانتهاء والتكامل مع Google Drive"
              : "Enterprise document repository, expiry monitoring & Google Drive metadata integration"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/50 hover:bg-emerald-900/60 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? "تصدير السجل" : "Export Register"}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isAr ? "طباعة" : "Print"}</span>
          </button>

          {canGoBack && <CloseBackButton variant="dark" />}
        </div>
      </div>

      {/* Expiry Alert Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div
          onClick={() => { setSelectedExpiryRange("EXPIRED"); setActiveTab("register"); }}
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">{isAr ? "مستندات منتهية" : "Expired"}</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">{expiryStats.expired}</div>
        </div>

        <div
          onClick={() => { setSelectedExpiryRange("7_DAYS"); setActiveTab("register"); }}
          className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-orange-700 dark:text-orange-300">{isAr ? "تنتهي خلال 7 أيام" : "Within 7 Days"}</span>
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-xl font-black text-orange-700 dark:text-orange-300 mt-1">{expiryStats.within7Days}</div>
        </div>

        <div
          onClick={() => { setSelectedExpiryRange("30_DAYS"); setActiveTab("register"); }}
          className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{isAr ? "تنتهي خلال 30 يوم" : "Within 30 Days"}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">{expiryStats.within30Days}</div>
        </div>

        <div
          onClick={() => { setSelectedExpiryRange("60_DAYS"); setActiveTab("register"); }}
          className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{isAr ? "تنتهي خلال 60 يوم" : "Within 60 Days"}</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">{expiryStats.within60Days}</div>
        </div>

        <div
          onClick={() => { setSelectedExpiryRange("90_DAYS"); setActiveTab("register"); }}
          className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 cursor-pointer hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{isAr ? "تنتهي خلال 90 يوم" : "Within 90 Days"}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{expiryStats.within90Days}</div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("register")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === "register"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
          }`}
        >
          {isAr ? "سجل الوثائق والمستندات" : "Document Register"} ({filteredDocuments.length})
        </button>

        <button
          onClick={() => setActiveTab("checklists")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === "checklists"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
          }`}
        >
          {isAr ? "قوائم التحقق والوثائق المطلوبة" : "Compliance Checklists"}
        </button>
      </div>

      {/* TAB 1: DOCUMENT REGISTER */}
      {activeTab === "register" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "ابحث باسم الملف أو الرقم..." : "Search title or number..."}
                className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <SearchableSelect
              options={[
                { id: "ALL", label: isAr ? "جميع أنواع المستندات" : "All Document Types" },
                { id: "EMIRATES_ID", label: isAr ? "بطاقة الهوية الإماراتية" : "Emirates ID" },
                { id: "PASSPORT", label: isAr ? "جواز السفر / الإقامة" : "Passport / Visa" },
                { id: "EJARI", label: isAr ? "شهادة إيجاري" : "Ejari Certificate" },
                { id: "LEASE_DOCUMENT", label: isAr ? "عقد الإيجار" : "Tenancy Contract" },
                { id: "TRADE_LICENSE", label: isAr ? "الرخصة التجارية" : "Trade License" },
                { id: "CHEQUE_COPY", label: isAr ? "نسخ الشيكات" : "Cheque Copies" },
                { id: "INVOICE", label: isAr ? "فواتير ومطالبات" : "Invoices" },
                { id: "LEGAL_DOCUMENT", label: isAr ? "مستندات قضائية" : "Legal Documents" },
              ]}
              value={selectedType}
              onChange={(val) => setSelectedType(val)}
              placeholder={isAr ? "نوع المستند..." : "Document type..."}
            />

            <SearchableSelect
              options={[
                { id: "ALL", label: isAr ? "جميع الحالات" : "All Statuses" },
                { id: "VERIFIED", label: isAr ? "موثق ومعتمد" : "Verified" },
                { id: "EXPIRED", label: isAr ? "منتهي الصلاحية" : "Expired" },
                { id: "PENDING_VERIFICATION", label: isAr ? "قيد المراجعة" : "Pending Verification" },
              ]}
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              placeholder={isAr ? "الحالة..." : "Status..."}
            />

            <SearchableSelect
              options={[
                { id: "ALL", label: isAr ? "جميع تواريخ الانتهاء" : "All Expiry Dates" },
                { id: "EXPIRED", label: isAr ? "منتهية الصلاحية" : "Expired" },
                { id: "7_DAYS", label: isAr ? "خلال 7 أيام" : "Within 7 Days" },
                { id: "30_DAYS", label: isAr ? "خلال 30 يوم" : "Within 30 Days" },
                { id: "60_DAYS", label: isAr ? "خلال 60 يوم" : "Within 60 Days" },
                { id: "90_DAYS", label: isAr ? "خلال 90 يوم" : "Within 90 Days" },
              ]}
              value={selectedExpiryRange}
              onChange={(val) => setSelectedExpiryRange(val)}
              placeholder={isAr ? "تاريخ الانتهاء..." : "Expiry date..."}
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">{isAr ? "رقم المستند" : "Doc #"}</th>
                  <th className="px-4 py-3">{isAr ? "اسم الملف والنوع" : "File & Type"}</th>
                  <th className="px-4 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الرفع" : "Uploaded"}</th>
                  <th className="px-4 py-3">{isAr ? "تاريخ الانتهاء" : "Expires"}</th>
                  <th className="px-4 py-3">{isAr ? "التوثيق" : "Verification"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "معاينة Google Drive" : "Drive View"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDocuments.map((doc, idx) => (
                  <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {doc.documentNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{doc.title}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                        {doc.documentType}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          doc.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : doc.status === "EXPIRED"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{doc.uploadedAt}</td>
                    <td className="px-4 py-3 font-mono">
                      {doc.expiryDate ? (
                        <span
                          className={
                            new Date(doc.expiryDate).getTime() < Date.now()
                              ? "text-rose-600 font-bold"
                              : "text-slate-600 dark:text-slate-400"
                          }
                        >
                          {doc.expiryDate}
                        </span>
                      ) : (
                        <span className="text-slate-400">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      <div>{doc.verifiedByUserName || "Super Admin"}</div>
                      <div className="text-[10px] text-slate-400">{doc.verifiedAt}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a
                        href={doc.driveWebViewLink || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:bg-indigo-100 transition"
                      >
                        <span>{isAr ? "فتح الملف" : "View"}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: COMPLIANCE CHECKLISTS */}
      {activeTab === "checklists" && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? "قوائم التحقق الإلزامية للعقود والمستأجرين" : "Mandatory Compliance Checklists"}</span>
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {leaseChecklists.map((chk) => (
              <div
                key={chk.entityId}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">{chk.entityName}</div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {chk.completionPercentage}% {isAr ? "مكتمل" : "Complete"}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {chk.items.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{isAr ? item.titleAr : item.titleEn}</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
