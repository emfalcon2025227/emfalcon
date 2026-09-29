import React, { useState, useEffect, useRef } from "react";
import { Camera, RefreshCw, Check, AlertCircle, X, FileText, Upload, Sparkles, SwitchCamera } from "lucide-react";
import { Modal } from "./Modal";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { DocumentCategory, ElectronicArchiveItem } from "../../types";

interface DocumentScannerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  defaultCategory?: DocumentCategory;
  recordName?: string;
  onScanSuccess?: (archiveItem: ElectronicArchiveItem) => void;
}

export const DocumentScanner: React.FC<DocumentScannerProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  defaultCategory = "LEASES" as DocumentCategory,
  recordName = "",
  onScanSuccess,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { uploadAndArchiveDocument } = useData();

  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [docTitle, setDocTitle] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setCategory(defaultCategory);
      setDocTitle(
        recordName
          ? `${isAr ? "مستند مسح ضوئي لـ" : "Scanned Document for"} ${recordName}`
          : `${isAr ? "مستند جديد" : "New Document"} - ${new Date().toLocaleDateString()}`
      );
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async (mode: "environment" | "user") => {
    try {
      stopCamera();
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: mode,
          },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
        setCameraActive(true);
        setErrorMsg(null);
      } else {
        throw new Error("getUserMedia not supported");
      }
    } catch (err) {
      console.warn("Camera access failed or unavailable:", err);
      setCameraActive(false);
      setErrorMsg(
        isAr
          ? "تعذر الوصول إلى الكاميرا. يرجى التأكد من منح صلاحية الكاميرا أو استخدام رفع ملف."
          : "Camera access unavailable. Please grant camera permission or upload a file."
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const toggleCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCapturedImage(event.target.result as string);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAttachment = async () => {
    if (!capturedImage) return;
    setIsScanning(true);
    setErrorMsg(null);

    try {
      const fileName = `${docTitle || "Scanned_Doc"}_${Date.now()}.jpg`;
      const archiveItem = await uploadAndArchiveDocument(capturedImage, {
        category,
        entityType,
        entityId,
        fileName,
        mimeType: "image/jpeg",
        description: isAr ? "تم المسح الضوئي بالكاميرا وإرفاقه تلقائياً" : "Scanned via camera and attached automatically",
        tags: [category, entityType, "scanned"],
      });

      setSuccessMsg(isAr ? "تم حفظ وإرفاق المستند بنجاح!" : "Document successfully scanned and attached!");
      setIsScanning(false);

      if (onScanSuccess) {
        onScanSuccess(archiveItem);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setIsScanning(false);
      setErrorMsg(err?.message || (isAr ? "فشل حفظ المستند" : "Failed to save document"));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isAr ? "مسح ضوئي للمستندات والشيكات" : "Document & Cheque Scanner"}>
      <div className="space-y-4">
        {/* Category & Title Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {isAr ? "تصنيف المستند" : "Document Category"}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="LEASES">{isAr ? "عقود الإيجار (Leases)" : "Leases"}</option>
              <option value="CHEQUES">{isAr ? "شيكات بنكية (Cheques)" : "Cheques"}</option>
              <option value="EMIRATES_ID">{isAr ? "هويات وإقامات (Emirates ID)" : "Emirates ID / Identity"}</option>
              <option value="MAINTENANCE">{isAr ? "صيانة وفواتير (Maintenance)" : "Maintenance"}</option>
              <option value="PAYMENTS">{isAr ? "سندات ومستندات مالية (Payments)" : "Payments / Financial"}</option>
              <option value="OTHER">{isAr ? "أخرى (Other)" : "Other"}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {isAr ? "عنوان المستند" : "Document Title"}
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder={isAr ? "أدخل عنوان المستند..." : "Enter document title..."}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Viewport / Capture Area */}
        <div className="relative aspect-[16/10] bg-black rounded-xl overflow-hidden border-2 border-slate-800 shadow-inner flex items-center justify-center">
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Target Guide Frame */}
              <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-lg pointer-events-none flex flex-col items-center justify-center text-white/80 p-4 text-center">
                <Sparkles className="w-8 h-8 mb-2 text-amber-400 animate-pulse" />
                <span className="text-xs font-semibold bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                  {isAr ? "ضع المستند أو الشيك داخل الإطار" : "Position document or cheque inside frame"}
                </span>
              </div>

              {/* Camera Switcher Button */}
              {cameraActive && (
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full backdrop-blur-sm transition-all shadow-md"
                  title={isAr ? "تبديل الكاميرا" : "Switch Camera"}
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <img src={capturedImage} alt="Captured Document" className="w-full h-full object-contain bg-slate-950" />
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all">
              <Upload className="w-4 h-4" />
              <span>{isAr ? "رفع من الجهاز" : "Upload File"}</span>
              <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="flex items-center gap-2">
            {!capturedImage ? (
              <button
                type="button"
                onClick={handleCapture}
                disabled={!cameraActive}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
              >
                <Camera className="w-4 h-4" />
                <span>{isAr ? "التقاط الصورة" : "Capture Photo"}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{isAr ? "إعادة التقاط" : "Retake"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttachment}
                  disabled={isScanning}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
                >
                  {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isAr ? "حفظ وإرفاق بالسجل الحالي" : "Save & Attach to Record"}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
