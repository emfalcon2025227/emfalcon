import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Gavel,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { Case, CaseDocumentItem } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { SearchableSelect } from "../common/SearchableSelect";

interface CaseDocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: Case | null;
  onUploaded?: (doc: CaseDocumentItem) => void;
}

const DOCUMENT_TYPES = [
  { value: "STATEMENT_OF_CLAIM", labelAr: "صحيفة الدعوى واللائحة الجوابية", labelEn: "Statement of Claim" },
  { value: "BOUNCE_CERTIFICATE", labelAr: "شهادة ارتداد الشيك / إفادة البنك", labelEn: "Cheque Bounce Certificate" },
  { value: "CHEQUE_COPY", labelAr: "صورة الشيكات البنكية والسندات", labelEn: "Cheque Scans & Vouchers" },
  { value: "LEASE_CONTRACT", labelAr: "عقد الإيجار الموثق (إيجاري / توثيق)", labelEn: "Certified Lease Contract" },
  { value: "JUDGMENT_DECREE", labelAr: "الحكم القضائي والسند التنفيذي", labelEn: "Court Judgment Decree" },
  { value: "EXECUTION_ORDER", labelAr: "قرار الحجز والتنفيذ القضائي", labelEn: "Execution Order" },
  { value: "EXPERT_REPORT", labelAr: "تقرير الخبير الحسابي المعتمد", labelEn: "Court Expert Accounting Report" },
  { value: "LEGAL_NOTICE", labelAr: "الإنذار العدلي والإخطار القانوني", labelEn: "Legal Notice & Notary Service" },
  { value: "PAYMENT_RECEIPT", labelAr: "سند قبض / إيصال تسوية مالية", labelEn: "Payment / Settlement Receipt" },
  { value: "POWER_OF_ATTORNEY", labelAr: "سند الوكالة القانونية للمحامي", labelEn: "Power of Attorney (POA)" },
  { value: "OTHER", labelAr: "مستندات ومذكرات قانونية أخرى", labelEn: "Other Legal Documents" },
];

export const CaseDocumentUploadModal: React.FC<CaseDocumentUploadModalProps> = ({
  isOpen,
  onClose,
  caseItem,
  onUploaded,
}) => {
  const { language } = useLanguage();
  const { addCaseDocument, tenants } = useData();

  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<CaseDocumentItem["documentType"]>("STATEMENT_OF_CLAIM");
  const [notes, setNotes] = useState("");
  const [fileData, setFileData] = useState<{
    name: string;
    url: string;
    size: number;
    mimeType: string;
  } | null>(null);
  const [syncToDrive, setSyncToDrive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when opened
  React.useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDocType("STATEMENT_OF_CLAIM");
      setNotes("");
      setFileData(null);
      setUploadSuccess(false);
      setDriveLink(null);
      setErrorMessage(null);
    }
  }, [isOpen, caseItem]);

  if (!caseItem) return null;

  const tenant = tenants.find((t) => t.id === caseItem.tenantId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title) {
      // Auto set title from file name without extension
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(cleanName);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileData({
        name: file.name,
        url: reader.result as string,
        size: file.size,
        mimeType: file.type || "application/pdf",
      });
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(cleanName);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileData({
        name: file.name,
        url: reader.result as string,
        size: file.size,
        mimeType: file.type || "application/pdf",
      });
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileData) {
      setErrorMessage(
        language === "ar"
          ? "يرجى تحديد أو إرفاق ملف الوثيقة أولاً"
          : "Please attach a document file first"
      );
      return;
    }

    if (!title.trim()) {
      setErrorMessage(
        language === "ar"
          ? "يرجى إدخال عنوان أو مسمى الوثيقة القضائية"
          : "Please enter a document title"
      );
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      // Use canonical gateway via DataContext or directly if possible.
      // Since addCaseDocument is already refactored, let's keep it.
      // But wait, addCaseDocument was refactored in turn 1. 
      // I need to ensure fileData.url passed to addCaseDocument is compatible.
      // It currently takes DataURL. DocumentStorageService handles DataURL by fetching/blob conversion.
      
      const res = await addCaseDocument(
        caseItem.id,
        {
          caseId: caseItem.id,
          title: title.trim(),
          documentType: docType,
          fileName: fileData.name,
          fileUrl: fileData.url,
          fileSize: fileData.size,
          mimeType: fileData.mimeType,
          notes: notes.trim() || undefined,
        },
        syncToDrive
      );

      if (res.success) {
        setUploadSuccess(true);
        if (res.driveLink) {
          setDriveLink(res.driveLink);
        }
        if (res.document && onUploaded) {
          onUploaded(res.document);
        }
      } else {
        setErrorMessage(
          res.error === "NO_AUTH"
            ? language === "ar"
              ? "تم حفظ الوثيقة محلياً في الأرشيف. للمزامنة مع جوجل درايف يرجى تسجيل الدخول إلى Google."
              : "Document saved locally. Please connect Google Drive to sync online."
            : res.error || "Failed to upload document"
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        language === "ar"
          ? `إدراج وأرشفة ورقة قضائية / مستند للقضية #${caseItem.caseNumber}`
          : `Upload Court Paper / Document for Case #${caseItem.caseNumber}`
      }
      subtitle={`${caseItem.courtName} — ${tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : ""}`}
      icon={<Gavel className="w-5 h-5 text-amber-600" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Case Info Banner */}
        <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold text-amber-950 block">
                {caseItem.courtName} — {caseItem.courtReferenceNumber || caseItem.caseNumber}
              </span>
              <span className="text-[11px] text-amber-800">
                {language === "ar" ? "المطالبة المالية:" : "Claim Amount:"} AED{" "}
                {caseItem.claimAmount.toLocaleString()}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-amber-200/70 text-amber-900 rounded-lg font-bold text-[10px]">
            {caseItem.status}
          </span>
        </div>

        {/* Document Type & Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {language === "ar" ? "نوع المستند القضائي *" : "Document Type *"}
            </label>
            <SearchableSelect
              options={DOCUMENT_TYPES.map((dt) => ({
                id: dt.value,
                label: language === "ar" ? dt.labelAr : dt.labelEn,
              }))}
              value={docType}
              onChange={(val) => setDocType(val as any)}
              placeholder={language === "ar" ? "اختر النوع..." : "Select type..."}
              searchPlaceholder={language === "ar" ? "ابحث بالنوع..." : "Search type..."}
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {language === "ar" ? "عنوان / مسمى الوثيقة *" : "Document Title *"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                language === "ar"
                  ? "مثال: صحيفة افتتاح الدعوى الإيجارية 2026"
                  : "e.g. Statement of Claim RDSC 2026"
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 font-medium"
              required
            />
          </div>
        </div>

        {/* File Drop Area */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            {language === "ar" ? "الملف أو الصورة *" : "Document File or Image *"}
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/70 hover:bg-amber-50/30 rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {fileData ? (
              <div className="space-y-1.5 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-900 text-sm">{fileData.name}</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {(fileData.size / 1024).toFixed(1)} KB — {fileData.mimeType}
                </span>
                <span className="text-[10px] text-amber-700 font-semibold underline">
                  {language === "ar" ? "انقر للاستبدال" : "Click to replace"}
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="font-bold text-slate-800">
                  {language === "ar"
                    ? "اسحب ملف القضية هنا أو انقر للاختيار"
                    : "Drag court paper here or click to browse"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {language === "ar"
                    ? "يدعم PDF, Word, JPG, PNG حتى 25 ميجابايت"
                    : "Supports PDF, Word, JPG, PNG up to 25MB"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            {language === "ar" ? "ملاحظات إضافية على المستند (اختياري)" : "Additional Notes (Optional)"}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={
              language === "ar"
                ? "أي تفاصيل أو قرارات مرتبطة بهذا المستند..."
                : "Any legal notes or context regarding this document..."
            }
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 font-medium resize-none"
          />
        </div>

        {/* Sync with Google Drive Option */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 block text-xs">
                {language === "ar" ? "مزامنة فورية مع Google Drive" : "Instant Sync to Google Drive"}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {language === "ar"
                  ? `حفظ في مجلد Emirates Falcon / Court Cases / Case ${caseItem.caseNumber}`
                  : `Save to Emirates Falcon / Court Cases / Case ${caseItem.caseNumber}`}
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={syncToDrive}
            onChange={(e) => setSyncToDrive(e.target.checked)}
            className="w-4 h-4 text-amber-600 rounded-sm focus:ring-amber-500 cursor-pointer"
          />
        </div>

        {/* Status Alerts */}
        {uploadSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">
                {language === "ar"
                  ? "تم حفظ وأرشفة الوثيقة بنجاح في ملف القضية والأرشيف الإلكتروني"
                  : "Court paper successfully attached and archived"}
              </span>
            </div>
            {driveLink && (
              <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60">
                <span className="text-[11px] text-emerald-800">
                  {language === "ar" ? "الرابط في Google Drive:" : "Google Drive Link:"}
                </span>
                <a
                  href={driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold underline"
                >
                  <span>{language === "ar" ? "فتح في Drive" : "Open in Drive"}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            {language === "ar" ? "إغلاق" : "Close"}
          </button>

          <button
            type="submit"
            disabled={isUploading || !fileData || !title.trim()}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            {isUploading ? (
              <span>{language === "ar" ? "جاري الرفع والأرشفة..." : "Uploading..."}</span>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>{language === "ar" ? "إدراج وأرشفة المستند" : "Attach & Archive Document"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
