import React, { useState } from "react";
import {
  FileText,
  X,
  CheckCircle2,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { CompanyLetterheadTemplate } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { Badge } from "../common/Badge";

interface LetterheadPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CompanyLetterheadTemplate | null;
  onSetActive?: (id: string) => void;
  isAdmin?: boolean;
}

export const LetterheadPreviewModal: React.FC<LetterheadPreviewModalProps> = ({
  isOpen,
  onClose,
  template,
  onSetActive,
  isAdmin = true,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [zoom, setZoom] = useState<number>(100);

  if (!isOpen || !template) return null;

  const isPdf =
    template.fileType.toLowerCase().includes("pdf") ||
    template.fileUrl.startsWith("data:application/pdf");

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = template.fileUrl;
    link.download = template.fileName || "company_letterhead";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {template.fileName}
                {template.isActive ? (
                  <Badge variant="success" className="gap-1 py-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isAr ? "القالب الرسمي النشط" : "Active Official Template"}
                  </Badge>
                ) : (
                  <Badge variant="default" className="py-0.5">
                    {isAr ? "مسودة / غير نشط" : "Inactive"}
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? "نوع الملف:" : "File Type:"} {template.fileType.toUpperCase()} | {formatFileSize(template.fileSize)} | {isAr ? "تاريخ الرفع:" : "Uploaded:"} {new Date(template.uploadedAt).toLocaleDateString(isAr ? "ar-AE" : "en-US")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPdf && (
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 text-slate-300">
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 15))}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                  title={isAr ? "تصغير" : "Zoom Out"}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 font-mono">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 15))}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                  title={isAr ? "تكبير" : "Zoom In"}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(100)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                  title={isAr ? "إعادة الضبط" : "Reset Zoom"}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Canvas Preview */}
        <div className="p-6 overflow-auto bg-slate-100 flex-1 flex items-center justify-center min-h-[450px]">
          {isPdf ? (
            <div className="w-full h-[600px] bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
              <iframe
                src={template.fileUrl}
                title={template.fileName}
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="relative max-w-full overflow-auto p-4 flex justify-center">
              {/* Simulated A4 Container Frame */}
              <div
                className="bg-white shadow-xl rounded-lg border border-slate-300 transition-all duration-200 relative overflow-hidden"
                style={{
                  width: `${(595 * zoom) / 100}px`,
                  minHeight: `${(842 * zoom) / 100}px`,
                }}
              >
                <img
                  src={template.fileUrl}
                  alt={template.fileName}
                  className="w-full h-full object-contain pointer-events-none select-none"
                />

                {/* Decorative Sample Document Content Overlay */}
                <div className="absolute inset-0 p-12 pointer-events-none flex flex-col justify-between opacity-30 border border-dashed border-emerald-400/40 m-6 rounded">
                  <div className="text-center text-xs font-semibold text-slate-500 tracking-wider uppercase border-b pb-2">
                    {isAr ? "معاينة الورقة الرسمية مع نص مستند توضيحي" : "Letterhead Watermark & Document Overlay Sample"}
                  </div>
                  <div className="space-y-3 text-slate-400 text-[10px]">
                    <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-2 bg-slate-200 rounded w-full"></div>
                    <div className="h-2 bg-slate-200 rounded w-5/6"></div>
                    <div className="h-2 bg-slate-200 rounded w-2/3"></div>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-[9px] text-slate-400">
                    <span>{isAr ? "صفحة 1 من 1" : "Page 1 of 1"}</span>
                    <span>{isAr ? "صقر الإمارات للعقارات" : "Emirates Falcon ERP"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            <span>
              {isAr
                ? "يتم استخدام هذه الورقة الرسمية كخلفية معتمدة للتقارير والخطابات الرسمية."
                : "This letterhead template is used as the background for official reports and correspondence."}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isAr ? "تحميل الملف" : "Download File"}
            </button>

            {!template.isActive && onSetActive && isAdmin && (
              <button
                onClick={() => {
                  onSetActive(template.id);
                  onClose();
                }}
                className="px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isAr ? "اعتماد كقالب رسمي نشط" : "Set as Active Letterhead"}
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
            >
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
