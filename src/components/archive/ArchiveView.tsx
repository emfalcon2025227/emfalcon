import React, { useState, useEffect } from "react";
import {
  Archive,
  Search,
  FileText,
  Download,
  Calendar,
  Scale,
  Receipt,
  CreditCard,
  Upload,
  Cloud,
  CheckCircle2,
  ExternalLink,
  Eye,
  Trash2,
  Filter,
  Plus,
  RefreshCw,
  LogOut,
  ShieldCheck,
  AlertCircle,
  FolderOpen,
  Image as ImageIcon,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";
import { Cheque, Case, ElectronicArchiveItem, CaseDocumentItem } from "../../types";
import { ChequeImageUploadModal } from "./ChequeImageUploadModal";
import { CaseDocumentUploadModal } from "../cases/CaseDocumentUploadModal";
import { DocumentPreviewModal, PreviewableDocument } from "../common/DocumentPreviewModal";
import { useAuth } from "../../context/AuthContext";
import {
  googleSignIn,
  googleLogout,
  initAuth,
  getGoogleUser,
  getAccessToken,
} from "../../services/googleDriveService";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";

export const ArchiveView: React.FC = () => {
  const { t, language } = useLanguage();
  const {
    archive,
    cheques,
    cases,
    tenants,
    properties,
    units,
    deleteArchiveItem,
    syncArchiveItemToDrive,
    syncChequeToDrive,
  } = useData();
  const { hasPermission } = useAuth();
  
  const canDelete = hasPermission("DELETE_RECORDS");

  // Sub-view Tab: "ALL" | "CHEQUES" | "CASES"
  const [activeTab, setActiveTab] = useState<"ALL" | "CHEQUES" | "CASES">("CHEQUES");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  // Google Drive Auth State
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Modals State
  const [selectedChequeForUpload, setSelectedChequeForUpload] = useState<Cheque | null>(null);
  const [selectedCaseForUpload, setSelectedCaseForUpload] = useState<Case | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewableDocument | null>(null);

  // Syncing loaders
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [batchSyncing, setBatchSyncing] = useState(false);

  // Initialize Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        setAuthError(null);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUser(res.user);
      }
    } catch (err: any) {
      setAuthError(err.customMessageAr || err.message || "Failed to sign in with Google");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };

  // Sync single archive item to drive
  const handleSyncArchiveItem = async (id: string) => {
    setSyncingId(id);
    try {
      await syncArchiveItemToDrive(id);
    } finally {
      setSyncingId(null);
    }
  };

  // Sync single cheque scan to drive
  const handleSyncCheque = async (chequeId: string) => {
    setSyncingId(chequeId);
    try {
      await syncChequeToDrive(chequeId);
    } finally {
      setSyncingId(null);
    }
  };

  // Batch sync all unsynced items
  const handleBatchSync = async () => {
    if (!googleUser) {
      alert(
        language === "ar"
          ? "يرجى تسجيل الدخول بحساب Google أولاً لتفعيل المزامنة"
          : "Please sign in with Google first to enable sync"
      );
      return;
    }

    setBatchSyncing(true);
    try {
      // Sync cheques with images that lack drive link
      const unsyncedCheques = cheques.filter((c) => c.imageUrl && !c.driveWebViewLink);
      for (const c of unsyncedCheques) {
        await syncChequeToDrive(c.id);
      }

      // Sync archive items lacking drive link
      const unsyncedArchive = archive.filter((a) => !a.driveWebViewLink);
      for (const a of unsyncedArchive) {
        await syncArchiveItemToDrive(a.id);
      }
    } finally {
      setBatchSyncing(false);
    }
  };

  // Calculations for stats
  const totalArchivedDocs = archive.length;
  const chequesWithScans = cheques.filter((c) => Boolean(c.imageUrl)).length;
  const totalSyncedToDrive =
    archive.filter((a) => Boolean(a.driveWebViewLink)).length +
    cheques.filter((c) => Boolean(c.driveWebViewLink)).length;

  // Filtered lists
  const filteredArchive = archive.filter((item) => {
    const matchTerm =
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          item.fileName,
          item.recordTitle,
          item.category,
          item.uploadedByName,
          ...(item.tags || []),
        ],
        searchTerm
      );
    const matchCat = filterCategory === "ALL" || item.category === filterCategory;
    return matchTerm && matchCat;
  });

  const filteredCheques = cheques.filter((c) => {
    const tenant = tenants.find((t) => t.id === c.tenantId);
    return (
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          c.chequeNumber,
          c.bankName,
          c.drawerName,
          c.accountNumber,
          tenant?.nameAr,
          tenant?.nameEn,
          tenant?.code,
        ],
        searchTerm
      )
    );
  });

  const filteredCases = cases.filter((c) => {
    const tenant = tenants.find((t) => t.id === c.tenantId);
    return (
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          c.caseNumber,
          c.courtReferenceNumber,
          c.courtName,
          tenant?.nameAr,
          tenant?.nameEn,
          tenant?.code,
        ],
        searchTerm
      )
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Google Drive Sync Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {language === "ar" ? "الأرشيف الإلكتروني والتخزين السحابي" : "Electronic Archive & Cloud Storage"}
            </h2>
            <Badge variant="warning" size="sm">
              <Cloud className="w-3 h-3 me-1" />
              Google Drive Enabled
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "تحميل وأرشفة الصور والملفات وأوراق القضايا مع مزامنتها في Google Drive"
              : "Upload and archive individual payment scans, court papers, and sync automatically to Google Drive"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBatchSync}
            disabled={batchSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${batchSyncing ? "animate-spin" : ""}`} />
            <span>
              {batchSyncing
                ? language === "ar"
                  ? "جاري المزامنة الشاملة..."
                  : "Syncing All..."
                : language === "ar"
                ? "مزامنة الكل مع Drive"
                : "Sync All to Drive"}
            </span>
          </button>
        </div>
      </div>

      {/* Google Drive Connection & Stats Banner */}
      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/15 shrink-0">
              <Cloud className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {language === "ar" ? "تكامل Google Drive المباشر" : "Google Drive Integration"}
                </span>
                {googleUser ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    {language === "ar" ? "متصل ومفعل" : "Connected"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                    {language === "ar" ? "يتطلب تسجيل الدخول" : "Sign-in Required"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {googleUser
                  ? `${language === "ar" ? "الحساب المتصل:" : "Connected Account:"} ${googleUser.email || "Google Account"}`
                  : language === "ar"
                  ? "سجّل الدخول بحساب Google لرفع الملفات ومستندات القضايا تلقائياً لمجلدك"
                  : "Sign in with Google to automatically back up scans and court documents to your drive"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {googleUser ? (
              <div className="flex items-center gap-2">
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-blue-300" />
                  <span>{language === "ar" ? "فتح مجلد Drive" : "Open Google Drive"}</span>
                  <ExternalLink className="w-3 h-3 text-slate-300" />
                </a>

                <button
                  onClick={handleGoogleSignOut}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/40 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{language === "ar" ? "خروج" : "Sign Out"}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white text-slate-800 hover:bg-slate-50 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-[1.02]"
              >
                {/* Official Google 'G' icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>
                  {isSigningIn
                    ? language === "ar"
                      ? "جاري تسجيل الدخول..."
                      : "Connecting..."
                    : language === "ar"
                    ? "تسجيل الدخول عبر Google Drive"
                    : "Sign in with Google Drive"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mini stats counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-700/80 text-xs">
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === "ar" ? "الصور المؤرشفة:" : "Archived Scans:"}
            </span>
            <span className="text-base font-black text-amber-400 font-mono">
              {chequesWithScans} / {cheques.length}
            </span>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === "ar" ? "قضايا لها مستندات:" : "Cases with Documents:"}
            </span>
            <span className="text-base font-black text-purple-300 font-mono">
              {cases.filter((c) => (c.caseDocuments?.length || 0) > 0 || (c.documents?.length || 0) > 0).length} / {cases.length}
            </span>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === "ar" ? "إجمالي الملفات في الأرشيف:" : "Total Archived Files:"}
            </span>
            <span className="text-base font-black text-emerald-400 font-mono">
              {totalArchivedDocs}
            </span>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === "ar" ? "المحفوظة في Google Drive:" : "Synced to Google Drive:"}
            </span>
            <span className="text-base font-black text-blue-300 font-mono">
              {totalSyncedToDrive} {language === "ar" ? "ملف" : "files"}
            </span>
          </div>
        </div>

        {authError && (
          <div className="mt-3 p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
            <span>{authError}</span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setActiveTab("CHEQUES")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "CHEQUES"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <CreditCard className="w-4 h-4 text-amber-600" />
            <span>{language === "ar" ? "الصور المؤرشفة" : "Archived Scans"}</span>
            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-mono text-[10px]">
              {cheques.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("CASES")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "CASES"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Scale className="w-4 h-4 text-purple-600" />
            <span>{language === "ar" ? "أوراق وملفات القضايا" : "Court Papers & Dossiers"}</span>
            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded-full font-mono text-[10px]">
              {cases.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "ALL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Archive className="w-4 h-4 text-slate-600" />
            <span>{language === "ar" ? "جميع السجلات المؤرشفة" : "All Archive Records"}</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full font-mono text-[10px]">
              {archive.length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              language === "ar"
                ? "بحث برقم الشيك، المستأجر، رقم القضية..."
                : "Search by cheque #, tenant, case #..."
            }
            className="w-full ps-10 pe-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800 shadow-2xs"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ARCHIVED SCANS (الصور المؤرشفة)  */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "CHEQUES" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCheques.map((cheque, idx) => {
              const tenant = tenants.find((t) => t.id === cheque.tenantId);
              const prop = properties.find((p) => p.id === cheque.propertyId);
              const unit = units.find((u) => u.id === cheque.unitId);
              const hasImage = Boolean(cheque.imageUrl);
              const isDriveSynced = Boolean(cheque.driveWebViewLink || cheque.driveFileId);

              return (
                <div
                  key={`${cheque.id}-${idx}`}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          #{cheque.chequeNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {cheque.bankName}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant={
                        cheque.status === "BOUNCED"
                          ? "danger"
                          : cheque.status === "CLEARED" || cheque.status === "COLLECTED"
                          ? "success"
                          : "warning"
                      }
                      size="sm"
                    >
                      {cheque.status}
                    </Badge>
                  </div>

                  {/* Cheque Image / Placeholder Area */}
                  <div className="p-4 space-y-3">
                    {hasImage && cheque.imageUrl ? (
                      <div
                        onClick={() =>
                          setPreviewDocument({
                            id: cheque.id,
                            title: `Cheque #${cheque.chequeNumber} (${cheque.bankName})`,
                            fileName: `Cheque_${cheque.chequeNumber}.jpg`,
                            previewUrl: cheque.imageUrl,
                            driveFileId: cheque.driveFileId,
                            driveWebViewLink: cheque.driveWebViewLink,
                            fileType: "image/jpeg",
                            category: "CHEQUES",
                          })
                        }
                        className="relative h-40 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 group cursor-pointer"
                      >
                        <img
                          src={cheque.imageUrl}
                          alt={`Cheque #${cheque.chequeNumber}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-2xs">
                          <Eye className="w-4 h-4" />
                          <span>{language === "ar" ? "معاينة مكبرة" : "Expand Preview"}</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setSelectedChequeForUpload(cheque)}
                        className="h-40 rounded-2xl bg-amber-50/40 hover:bg-amber-50/80 border-2 border-dashed border-amber-200/80 hover:border-amber-400 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center p-4"
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-amber-900 text-xs">
                          {language === "ar" ? "تحميل الصورة" : "Upload Scan"}
                        </span>
                        <span className="text-[10px] text-amber-700/80">
                          {language === "ar"
                            ? "انقر لتحميل وحفظ الصورة في الأرشيف وGoogle Drive"
                            : "Click to upload & sync to Google Drive"}
                        </span>
                      </div>
                    )}

                    {/* Metadata summary */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">
                          {language === "ar" ? "الساحب / المستأجر:" : "Drawer / Tenant:"}
                        </span>
                        <span className="font-bold text-slate-800 truncate max-w-[160px]">
                          {cheque.drawerName ||
                            (tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">
                          {language === "ar" ? "القيمة:" : "Amount:"}
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          AED {cheque.amount.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 text-[11px]">
                          {language === "ar" ? "تاريخ الاستحقاق:" : "Due Date:"}
                        </span>
                        <span className="font-mono text-slate-700">{cheque.dueDate}</span>
                      </div>

                      {prop && (
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 text-[11px]">
                            {language === "ar" ? "العقار والوحدة:" : "Property / Unit:"}
                          </span>
                          <span className="font-medium text-slate-700 truncate max-w-[150px]">
                            {language === "ar" ? prop.nameAr : prop.nameEn} #{unit?.unitNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Google Drive Link or Sync status */}
                    {isDriveSynced && cheque.driveWebViewLink ? (
                      <a
                        href={cheque.driveWebViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold text-[11px] underline"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Google Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : hasImage ? (
                      <button
                        onClick={() => handleSyncCheque(cheque.id)}
                        disabled={syncingId === cheque.id}
                        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold text-[11px] cursor-pointer"
                      >
                        <Cloud className="w-3.5 h-3.5 text-blue-600" />
                        <span>
                          {syncingId === cheque.id
                            ? language === "ar"
                              ? "جاري المزامنة..."
                              : "Syncing..."
                            : language === "ar"
                            ? "مزامنة للـ Drive"
                            : "Sync to Drive"}
                        </span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        {language === "ar" ? "بانتظار الصورة" : "No image yet"}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedChequeForUpload(cheque)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                      >
                        <Upload className="w-3 h-3" />
                        <span>
                          {hasImage
                            ? language === "ar"
                              ? "تحديث الصورة"
                              : "Update Scan"
                            : language === "ar"
                            ? "تحميل صورة"
                            : "Upload Scan"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCheques.length === 0 && (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
              {language === "ar" ? "لم يتم العثور على شيكات مطابقة للبحث" : "No cheques found matching search"}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: COURT CASES PAPERS & LEGAL DOSSIERS (أوراق وقضايا المحاكم) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "CASES" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {filteredCases.map((caseItem, idx) => {
              const tenant = tenants.find((t) => t.id === caseItem.tenantId);
              const prop = properties.find((p) => p.id === caseItem.propertyId);
              const unit = units.find((u) => u.id === caseItem.unitId);
              const caseDocs = caseItem.caseDocuments || [];
              const linkedChequeCount = caseItem.linkedChequeIds?.length || 0;

              return (
                <div
                  key={`${caseItem.id}-${idx}`}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden"
                >
                  {/* Case Header */}
                  <div className="p-4 sm:p-5 bg-purple-50/40 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                        <Scale className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-purple-950 text-sm">
                            {caseItem.caseNumber}
                          </span>
                          {caseItem.courtReferenceNumber && (
                            <span className="font-mono text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-semibold">
                              {caseItem.courtReferenceNumber}
                            </span>
                          )}
                          <Badge variant="purple" size="sm">
                            {caseItem.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-600 block mt-0.5">
                          {caseItem.courtName} — {tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "Tenant"} — {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "Property"} #{unit?.unitNumber}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedCaseForUpload(caseItem)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{language === "ar" ? "إرفاق ورقة قضائية جديدة" : "Attach Court Paper"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Case Documents List */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{language === "ar" ? "الأوراق والمستندات القضائية المؤرشفة في هذا الملف:" : "Archived Court Papers & Evidence:"}</span>
                      <span className="text-slate-400 font-mono">
                        {caseDocs.length} {language === "ar" ? "مستندات" : "docs"} • {linkedChequeCount} {language === "ar" ? "شيكات مرتبطة" : "linked cheques"}
                      </span>
                    </div>

                    {caseDocs.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {caseDocs.map((doc, idx) => {
                          const isSynced = Boolean(doc.driveWebViewLink || doc.driveFileId);
                          return (
                            <div
                              key={`${doc.id}-${idx}`}
                              className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col justify-between gap-2.5 transition-all"
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="overflow-hidden">
                                  <span className="font-bold text-slate-900 text-xs block truncate">
                                    {doc.title}
                                  </span>
                                  <span className="text-[10px] text-purple-800 font-semibold block">
                                    {doc.documentType.replace(/_/g, " ")}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {doc.fileName}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px]">
                                {isSynced && doc.driveWebViewLink ? (
                                  <a
                                    href={doc.driveWebViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-emerald-700 font-bold underline"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Drive</span>
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    {language === "ar" ? "محلي" : "Local"}
                                  </span>
                                )}

                                <button
                                  onClick={() =>
                                    setPreviewDocument({
                                      id: doc.id,
                                      title: doc.title,
                                      fileName: doc.fileName,
                                      previewUrl: doc.fileUrl,
                                      driveFileId: doc.driveFileId,
                                      driveWebViewLink: doc.driveWebViewLink,
                                      documentType: doc.documentType,
                                      fileType: doc.mimeType || "application/pdf",
                                      category: "COURT_CASES",
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold text-[10px] cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>{language === "ar" ? "معاينة" : "Preview"}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                        {language === "ar"
                          ? "لا توجد أوراق قضائية مرفقة بعد. انقر على 'إرفاق ورقة قضائية جديدة' لرفع صحيفة الدعوى أو مذكرات الدفاع."
                          : "No court documents attached yet. Click 'Attach Court Paper' to upload statement of claim or defense memos."}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCases.length === 0 && (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
              {language === "ar" ? "لم يتم العثور على ملفات قضايا مطابقة" : "No cases found matching search"}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: ALL ARCHIVED RECORDS TABLE (جميع الوثائق والسجلات)      */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "ALL" && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {["ALL", "CHEQUES", "CASES", "TENANTS", "LEASES", "PROPERTIES", "OWNERS"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filterCategory === cat
                    ? "bg-slate-900 text-white"
                    : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4 text-start">{language === "ar" ? "اسم الملف" : "File Name"}</th>
                    <th className="py-3 px-4 text-start">{language === "ar" ? "التصنيف" : "Category"}</th>
                    <th className="py-3 px-4 text-start">{language === "ar" ? "السجل المرتبط" : "Linked Record"}</th>
                    <th className="py-3 px-4 text-start">{language === "ar" ? "تاريخ الرفع" : "Upload Date"}</th>
                    <th className="py-3 px-4 text-start">{language === "ar" ? "Google Drive" : "Google Drive"}</th>
                    <th className="py-3 px-4 text-end">{language === "ar" ? "الإجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredArchive.map((item, idx) => {
                    const isSynced = Boolean(item.driveWebViewLink || item.driveFileId);
                    return (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="font-mono">{item.fileName}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            {(item.fileSize / 1024).toFixed(1)} KB
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant="neutral" size="sm">
                            {item.category}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {item.recordTitle}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4">
                          {isSynced && item.driveWebViewLink ? (
                            <a
                              href={item.driveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[10px]"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{language === "ar" ? "في Drive" : "In Drive"}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <button
                              onClick={() => handleSyncArchiveItem(item.id)}
                              disabled={syncingId === item.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[10px] cursor-pointer"
                            >
                              <Cloud className="w-3 h-3 text-blue-600" />
                              <span>
                                {syncingId === item.id
                                  ? language === "ar"
                                    ? "جاري..."
                                    : "Syncing..."
                                  : language === "ar"
                                  ? "مزامنة"
                                  : "Sync"}
                              </span>
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() =>
                                setPreviewDocument({
                                  id: item.id,
                                  title: item.recordTitle,
                                  fileName: item.fileName,
                                  previewUrl: item.previewUrl,
                                  driveFileId: item.driveFileId,
                                  driveWebViewLink: item.driveWebViewLink,
                                  fileSize: item.fileSize,
                                  fileType: item.fileType,
                                  fileHash: item.fileHash,
                                  category: item.category,
                                  uploadDate: item.uploadDate,
                                })
                              }
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {canDelete && (
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      language === "ar"
                                        ? "هل أنت متأكد من حذف هذا الملف من الأرشيف؟"
                                        : "Are you sure you want to delete this archived file?"
                                    )
                                  ) {
                                    deleteArchiveItem(item.id);
                                  }
                                }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

            {filteredArchive.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-xs">
                {language === "ar" ? "لا توجد وثائق في هذا التصنيف" : "No archived files in this category"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cheque Scan Upload Modal */}
      <ChequeImageUploadModal
        isOpen={Boolean(selectedChequeForUpload)}
        onClose={() => setSelectedChequeForUpload(null)}
        cheque={selectedChequeForUpload}
      />

      {/* Case Document Upload Modal */}
      <CaseDocumentUploadModal
        isOpen={Boolean(selectedCaseForUpload)}
        onClose={() => setSelectedCaseForUpload(null)}
        caseItem={selectedCaseForUpload}
      />

      {/* Native In-App Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
      />
    </div>
  );
};
