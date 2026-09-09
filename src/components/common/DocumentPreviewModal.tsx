import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  HardDrive,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  AlertCircle,
  Hash,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { fetchDriveFileBlob } from "../../services/googleDriveService";
import { DocumentStorageService } from "../../services/documentStorageService";

export interface PreviewableDocument {
  id?: string;
  title?: string;
  fileName: string;
  category?: string;
  documentType?: string;
  fileType?: string;
  mimeType?: string;
  fileSize?: number;
  previewUrl?: string; // Optional local/cached data URL or object URL
  driveFileId?: string;
  driveWebViewLink?: string;
  fileHash?: string;
  uploadDate?: string;
  entityType?: string;
  entityId?: string;
  syncStatus?: string;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: PreviewableDocument | null;
  documents?: PreviewableDocument[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
  documents = [],
  currentIndex = 0,
  onIndexChange,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [activeIdx, setActiveIdx] = useState<number>(currentIndex);
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loadedBlobUrl, setLoadedBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sync activeIdx when currentIndex or document changes
  useEffect(() => {
    if (document && documents.length > 0) {
      const foundIdx = documents.findIndex(
        (d) =>
          (d.id && d.id === document.id) ||
          (d.driveFileId && d.driveFileId === document.driveFileId) ||
          d.fileName === document.fileName
      );
      if (foundIdx >= 0) {
        setActiveIdx(foundIdx);
        return;
      }
    }
    setActiveIdx(currentIndex);
  }, [currentIndex, document, documents]);

  const activeDoc: PreviewableDocument | null =
    documents.length > 0 ? documents[activeIdx] || document || null : document || null;

  // Reset viewport transforms on document change
  useEffect(() => {
    setZoom(100);
    setRotation(0);
    setFetchError(null);
  }, [activeDoc?.fileName, activeDoc?.driveFileId, activeIdx]);

  // Fetch authenticated Google Drive binary blob if local previewUrl is not available
  useEffect(() => {
    let isCancelled = false;
    let createdUrl: string | null = null;

    async function loadFileBlob() {
      if (!isOpen || !activeDoc) {
        setLoadedBlobUrl(null);
        return;
      }

      // If document already has a valid inline dataUrl or blobUrl, use it immediately
      if (
        activeDoc.previewUrl &&
        (activeDoc.previewUrl.startsWith("data:") ||
          activeDoc.previewUrl.startsWith("blob:") ||
          activeDoc.previewUrl.startsWith("http://localhost") ||
          activeDoc.previewUrl.startsWith("https://"))
      ) {
        setLoadedBlobUrl(activeDoc.previewUrl);
        setIsLoading(false);
        return;
      }

      // Check In-Memory & Session/Local Cache via DocumentStorageService
      const cached =
        (activeDoc.id ? DocumentStorageService.getCachedDataUrl(activeDoc.id) : null) ||
        (activeDoc.fileHash ? DocumentStorageService.getCachedDataUrl(activeDoc.fileHash) : null) ||
        (activeDoc.fileName ? DocumentStorageService.getCachedDataUrl(activeDoc.fileName) : null);

      if (cached) {
        setLoadedBlobUrl(cached);
        setIsLoading(false);
        return;
      }

      // If Google Drive file ID is present and valid, fetch binary securely via Drive API
      if (activeDoc.driveFileId && !activeDoc.driveFileId.startsWith("pending_sync_")) {
        setIsLoading(true);
        setFetchError(null);
        try {
          const result = await fetchDriveFileBlob(activeDoc.driveFileId);
          if (isCancelled) return;

          if (result && result.url) {
            createdUrl = result.url;
            setLoadedBlobUrl(result.url);
          } else {
            // Failed to fetch binary directly (e.g. unauthenticated or restricted)
            setLoadedBlobUrl(null);
          }
        } catch (err: any) {
          if (!isCancelled) {
            console.warn("Could not fetch Drive file binary for in-app preview:", err);
            setFetchError(err.message || "Failed to stream document");
          }
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      } else {
        setLoadedBlobUrl(null);
        setIsLoading(false);
      }
    }

    loadFileBlob();

    return () => {
      isCancelled = true;
      if (createdUrl && createdUrl.startsWith("blob:")) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, activeDoc?.driveFileId, activeDoc?.previewUrl]);

  // Keyboard navigation & zoom
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && documents.length > 1) {
        handlePrev();
      } else if (e.key === "ArrowRight" && documents.length > 1) {
        handleNext();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeIdx, documents.length]);

  if (!isOpen || !activeDoc) return null;

  // Determine file type category
  const mime = (activeDoc.mimeType || activeDoc.fileType || "").toLowerCase();
  const name = (activeDoc.fileName || "").toLowerCase();

  const isImage =
    mime.startsWith("image/") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif") ||
    name.endsWith(".svg");

  const isPdf = mime.includes("pdf") || name.endsWith(".pdf");

  const isSpreadsheet =
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv");

  const isArchive =
    mime.includes("zip") ||
    mime.includes("rar") ||
    mime.includes("tar") ||
    name.endsWith(".zip") ||
    name.endsWith(".rar");

  const handleNext = () => {
    if (documents.length > 1) {
      const next = (activeIdx + 1) % documents.length;
      setActiveIdx(next);
      onIndexChange?.(next);
    }
  };

  const handlePrev = () => {
    if (documents.length > 1) {
      const prev = (activeIdx - 1 + documents.length) % documents.length;
      setActiveIdx(prev);
      onIndexChange?.(prev);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => {
    setZoom(100);
    setRotation(0);
  };
  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation((prev) => (prev - 90 + 360) % 360);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || isNaN(bytes)) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getDrivePreviewEmbedUrl = (fileId: string) => {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  };

  return (
    <div
      id="document-preview-modal-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div
        id="document-preview-modal-container"
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-200 ${
          isFullscreen
            ? "w-full h-full rounded-none"
            : "w-full max-w-5xl h-[92vh] max-h-[850px]"
        }`}
      >
        {/* Header */}
        <div
          id="document-preview-header"
          className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-900/60">
              {isImage ? (
                <ImageIcon className="w-5 h-5" />
              ) : isPdf ? (
                <FileText className="w-5 h-5" />
              ) : isSpreadsheet ? (
                <FileSpreadsheet className="w-5 h-5" />
              ) : isArchive ? (
                <FileArchive className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>

            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {activeDoc.title || activeDoc.fileName}
                </h3>
                {activeDoc.driveFileId && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isAr ? "محفوظ في Drive" : "Drive Synced"}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-mono">{activeDoc.fileName}</span>
                <span>•</span>
                <span>{formatFileSize(activeDoc.fileSize)}</span>
                {activeDoc.category && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {activeDoc.category}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Top action controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pagination Controls if multiple files */}
            {documents.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mr-2 rtl:ml-2 rtl:mr-0">
                <button
                  id="preview-prev-btn"
                  onClick={handlePrev}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                  title={isAr ? "السابق (السهم الأيسر)" : "Previous (Left Arrow)"}
                >
                  {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 px-2 font-mono">
                  {activeIdx + 1} / {documents.length}
                </span>
                <button
                  id="preview-next-btn"
                  onClick={handleNext}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                  title={isAr ? "التالي (السهم الأيمن)" : "Next (Right Arrow)"}
                >
                  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Toggle Fullscreen */}
            <button
              id="preview-fullscreen-toggle"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title={isFullscreen ? (isAr ? "تصغير" : "Exit Fullscreen") : isAr ? "ملء الشاشة" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              id="preview-close-btn"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title={isAr ? "إغلاق (Esc)" : "Close (Esc)"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Toolbar for Images & PDFs */}
        {(isImage || isPdf) && loadedBlobUrl && (
          <div
            id="document-preview-toolbar"
            className="px-4 py-2 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 text-xs"
          >
            <div className="flex items-center gap-1.5">
              <button
                id="preview-zoom-out-btn"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                title={isAr ? "تصغير (-)" : "Zoom Out (-)"}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 w-12 text-center">
                {zoom}%
              </span>
              <button
                id="preview-zoom-in-btn"
                onClick={handleZoomIn}
                disabled={zoom >= 300}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                title={isAr ? "تكبير (+)" : "Zoom In (+)"}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                id="preview-reset-zoom-btn"
                onClick={handleResetZoom}
                className="px-2 py-1 text-[10px] font-bold hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors ml-1 cursor-pointer"
              >
                {isAr ? "100%" : "Reset"}
              </button>
            </div>

            {isImage && (
              <div className="flex items-center gap-1">
                <button
                  id="preview-rotate-ccw-btn"
                  onClick={handleRotateCcw}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                  title={isAr ? "تدوير يسار" : "Rotate Left"}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  id="preview-rotate-cw-btn"
                  onClick={handleRotateCw}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                  title={isAr ? "تدوير يمين" : "Rotate Right"}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Body Viewer */}
        <div
          id="document-preview-body"
          className="flex-1 overflow-auto bg-slate-900/95 dark:bg-slate-950 flex items-center justify-center p-4 relative select-none"
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-slate-300 animate-pulse">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs font-semibold">
                {isAr ? "جاري تحميل المستند من السحابة بأمان..." : "Streaming secure document preview..."}
              </p>
            </div>
          ) : isImage && loadedBlobUrl ? (
            <div
              className="transition-transform duration-150 flex items-center justify-center max-w-full max-h-full"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
              }}
            >
              <img
                src={loadedBlobUrl}
                alt={activeDoc.fileName}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] max-w-[85vw] object-contain rounded-lg shadow-2xl transition-all"
              />
            </div>
          ) : isPdf && loadedBlobUrl ? (
            <div
              className="w-full h-full rounded-xl overflow-hidden bg-white shadow-2xl"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
            >
              <iframe
                src={`${loadedBlobUrl}#toolbar=0&navpanes=0`}
                title={activeDoc.fileName}
                className="w-full h-full border-0 rounded-xl"
              />
            </div>
          ) : activeDoc.driveFileId ? (
            /* Fallback embedded Drive iframe viewer if direct blob retrieval is restricted */
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="w-full h-full rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shadow-xl relative">
                <iframe
                  src={getDrivePreviewEmbedUrl(activeDoc.driveFileId)}
                  title={activeDoc.fileName}
                  className="w-full h-full border-0"
                  allow="autoplay"
                />
              </div>
            </div>
          ) : (
            /* Unsupported or offline file card */
            <div className="max-w-md w-full p-8 text-center bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                {isSpreadsheet ? (
                  <FileSpreadsheet className="w-8 h-8" />
                ) : isArchive ? (
                  <FileArchive className="w-8 h-8" />
                ) : (
                  <FileText className="w-8 h-8" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                  {activeDoc.fileName}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isAr
                    ? "معاينة الملف متاحة عبر التنزيل المباشر أو الفتح في Google Drive"
                    : "Native preview is available via direct download or Google Drive."}
                </p>
              </div>

              {/* Metadata badges */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 text-right rtl:text-right ltr:text-left font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">{isAr ? "الحجم:" : "Size:"}</span>
                  <span>{formatFileSize(activeDoc.fileSize)}</span>
                </div>
                {activeDoc.fileHash && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-sans">{isAr ? "البصمة:" : "Hash:"}</span>
                    <span className="truncate max-w-[200px] text-[10px] text-amber-600">
                      {activeDoc.fileHash}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Metadata & Explicit Drive Link */}
        <div
          id="document-preview-footer"
          className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0"
        >
          {/* Forensic details / Hash info */}
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 overflow-hidden">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? "تخزين آمن ومشفّر" : "Encrypted & Verified"}</span>
            </div>
            {activeDoc.fileHash && (
              <span className="hidden md:inline-flex items-center gap-1 font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                <Hash className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{activeDoc.fileHash}</span>
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Explicit Google Drive button - NEVER redirects automatically, only on click */}
            {activeDoc.driveWebViewLink && (
              <a
                id="preview-open-drive-btn"
                href={activeDoc.driveWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                title={isAr ? "فتح في Google Drive في نافذة جديدة" : "Open in Google Drive in new tab"}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isAr ? "فتح في Google Drive" : "Open in Google Drive"}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {/* Direct Download Button */}
            <button
              id="preview-download-btn"
              type="button"
              onClick={() => {
                if (loadedBlobUrl || activeDoc.previewUrl) {
                  const anchor = window.document.createElement("a");
                  anchor.href = loadedBlobUrl || activeDoc.previewUrl || "";
                  anchor.download = activeDoc.fileName || "document";
                  anchor.target = "_blank";
                  window.document.body.appendChild(anchor);
                  anchor.click();
                  window.document.body.removeChild(anchor);
                } else {
                  DocumentStorageService.downloadArchiveItem(activeDoc);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isAr ? "تنزيل الملف" : "Download"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
