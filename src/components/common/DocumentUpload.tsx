import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileCheck2,
  AlertCircle,
  Sparkles,
  Layers,
  X,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { SearchableSelect } from "./SearchableSelect";
import {
  DocumentOptimizationProfile,
  DocumentOptimizationResult,
  OriginalFileRetentionPolicy,
} from "../../types";
import { optimizeDocument, formatBytes } from "../../services/documentOptimizer";

interface DocumentUploadProps {
  label?: string;
  defaultProfile?: DocumentOptimizationProfile;
  retentionPolicy?: OriginalFileRetentionPolicy;
  onOptimized: (result: DocumentOptimizationResult | null) => void;
  accept?: string;
  className?: string;
  required?: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  label,
  defaultProfile = "STANDARD",
  retentionPolicy = "OPTIMIZED_ONLY",
  onOptimized,
  accept = "image/*,application/pdf",
  className = "",
  required = false,
}) => {
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedProfile, setSelectedProfile] = useState<DocumentOptimizationProfile>(defaultProfile);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<DocumentOptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Process all selected files in parallel
      const optimizationPromises = Array.from(files).map((file) =>
        optimizeDocument(file, selectedProfile, retentionPolicy as OriginalFileRetentionPolicy)
      );

      const optResults = await Promise.all(optimizationPromises);
      
      // For now, we continue to call onOptimized for each result, 
      // but we might need to change the API to accept an array if needed.
      // Based on current usage in TenantUpdateMaintenanceModal, we need to adapt.
      optResults.forEach((result) => onOptimized(result));
      
      // Clear file input to allow selecting same files again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setError(err?.message || "Optimization failed");
      onOptimized(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileChange(e.dataTransfer.files);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOptimized(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700">
            {label} {required && <span className="text-red-500">*</span>}
          </label>

          <div className="flex items-center gap-1 text-[10px] text-slate-500 min-w-[170px]">
            <Layers className="w-3 h-3 text-amber-700 shrink-0" />
            <SearchableSelect
              options={[
                { id: "STANDARD", label: language === "ar" ? "قياسي (Standard)" : "Standard" },
                { id: "CHEQUE", label: language === "ar" ? "شيك بنكي (Cheque)" : "Cheque" },
                { id: "LEGAL_DOCUMENT", label: language === "ar" ? "وثيقة قانونية (Legal)" : "Legal Document" },
                { id: "MAINTENANCE_INVOICE", label: language === "ar" ? "فاتورة صيانة (Invoice)" : "Maintenance Invoice" },
                { id: "RECEIPT", label: language === "ar" ? "إيصال دفع (Receipt)" : "Receipt" },
                { id: "PHOTO", label: language === "ar" ? "صورة فوتوغرافية (Photo)" : "Photo" },
              ]}
              value={selectedProfile}
              onChange={(val) => setSelectedProfile(val as DocumentOptimizationProfile)}
              placeholder={language === "ar" ? "نوع المستند..." : "Profile..."}
            />
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e.target.files)}
        multiple
        accept={accept}
        className="hidden"
      />

      {!result && !isProcessing && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-amber-600 bg-amber-50/50"
              : "border-slate-300 hover:border-amber-600 hover:bg-slate-50/80 bg-white"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                {language === "ar" ? "اسحب الملف هنا أو انقر للاختيار" : "Drop file here or click to browse"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {language === "ar"
                  ? "معالجة وتحسين ذكي للصور والـ PDF قبل التخزين الآمن"
                  : "Adaptive pipeline for images & PDFs before Drive sync"}
              </p>
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-4 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-600 border-t-transparent" />
          <div className="text-xs font-bold text-amber-900">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-700 animate-pulse" />
              {language === "ar" ? "جاري معالجة وتحسين المستند..." : "Optimizing & processing document..."}
            </span>
          </div>
        </div>
      )}

      {result && !isProcessing && (
        <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                {result.originalMimeType.includes("pdf") ? (
                  <FileText className="w-4 h-4" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{result.originalFileName}</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {formatBytes(result.originalSizeBytes)} &bull; {result.compressionMethod}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title={language === "ar" ? "إزالة الملف" : "Remove file"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Optimization Summary Badge */}
          <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[10px] font-bold">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {result.compressionApplied ? (
                <span>
                  {language === "ar" ? "تم التحسين:" : "Optimized:"}{" "}
                  <span className="font-mono">{formatBytes(result.optimizedSizeBytes)}</span>
                </span>
              ) : (
                <span>{language === "ar" ? "تم الحفظ بجودة أصلية كاملة" : "Preserved in full original quality"}</span>
              )}
            </div>

            {result.compressionApplied && result.sizeSavedPercentage > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono">
                {language === "ar" ? `وفرت ${result.sizeSavedPercentage}%` : `Saved ${result.sizeSavedPercentage}%`}
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
