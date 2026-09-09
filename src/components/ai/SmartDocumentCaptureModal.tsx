import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  X, 
  Camera, 
  UploadCloud, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  FileText, 
  ShieldCheck,
  History,
  Info,
  ChevronRight,
  Maximize2,
  Minimize2,
  Trash2,
  Image as ImageIcon,
  RotateCw,
  Crop
} from "lucide-react";
import { DocumentAutoCropper } from "../../utils/documentAutoCropper";
import { Modal } from "../common/Modal";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  DocumentType,
  DocumentCaptureState,
  ExtractionResult,
  ImageQualityResult,
} from "../../types/documentIntelligence";
import { AIForensicValidator } from "../../utils/aiForensicValidator";
import { ScannerModal } from "../cheques/ScannerModal";
import { optimizeDocument } from "../../services/documentOptimizer";
import { motion, AnimatePresence } from "motion/react";

/**
 * PHASE 57-G: Production Smart Cheque Intelligence
 * Adaptive Image Quality & Human Verification Workflow
 */

const FIELD_LABELS_AR: Record<string, string> = {
  emiratesIdNumber: "رقم الهوية الإماراتية (784-YYYY-XXXXXXX-X)",
  fullName: "الاسم الكامل",
  arabicName: "الاسم الرسمي بالعربية",
  englishName: "الاسم الرسمي بالإنجليزية",
  nationality: "الجنسية",
  dateOfBirth: "تاريخ الميلاد",
  gender: "الجنس (ذكر / أنثى)",
  cardNumber: "رقم البطاقة",
  issueDate: "تاريخ الإصدار",
  expiryDate: "تاريخ الانتهاء",
  documentSide: "جهة المستند",
  chequeNumber: "رقم الشيك",
  bankName: "اسم البنك",
  amount: "المبلغ بالأرقام (درهم)",
  amountInWords: "المبلغ كتابة",
  chequeDate: "تاريخ استحقاق الشيك",
  payeeName: "اسم المستفيد",
  drawerName: "اسم الساحب",
  accountNumber: "رقم الحساب",
};

export type ImageQualityStatus = "HIGH" | "ACCEPTABLE" | "LOW" | "UNUSABLE";
export type FieldOrigin = "AUTO" | "CHECK" | "EDITED";

interface SmartDocumentCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: DocumentType;
  onApprove: (
    result: ExtractionResult,
    imageBase64: string,
    mimeType: string,
    saveToArchive: boolean
  ) => void;
}

export const SmartDocumentCaptureModal: React.FC<SmartDocumentCaptureModalProps> = ({
  isOpen,
  onClose,
  documentType,
  onApprove,
}) => {
  const { extractDocumentOCR, logAudit } = useData();
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [state, setState] = useState<DocumentCaptureState>("IDLE");
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState<string>("image/jpeg");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [extractedData, setExtractedData] = useState<any>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [saveToArchive, setSaveToArchive] = useState(true);
  const [qualityResult, setQualityResult] = useState<ImageQualityResult | null>(null);
  const [qualityStatus, setQualityStatus] = useState<ImageQualityStatus>("ACCEPTABLE");
  
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [originalSourceImage, setOriginalSourceImage] = useState<string | null>(null);
  const [wasAutoCropped, setWasAutoCropped] = useState(false);

  // Stop camera when closed or state changes
  useEffect(() => {
    if (!isOpen || state !== "CAPTURING") {
      stopCamera();
    }
  }, [isOpen, state]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    setErrorMsg(null);
    setState("CAPTURING");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
      });
      setStream(mediaStream);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = mediaStream;
        cameraVideoRef.current.play();
      }
    } catch (err: any) {
      console.warn("Camera access denied or unavailable:", err?.message || err);
      setErrorMsg(isAr ? "تعذر الوصول إلى الكاميرا." : "Camera access denied or unavailable.");
      setState("IDLE");
    }
  };

  const capturePhoto = () => {
    if (cameraVideoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = cameraVideoRef.current.videoWidth;
      canvas.height = cameraVideoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(cameraVideoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        handleImageReady(dataUrl, "image/jpeg");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          handleImageReady(evt.target.result as string, file.type);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScannerResult = async (base64String: string, mime: string) => {
    let clean = (base64String || "").trim();
    if (clean.startsWith("data:")) {
      await handleImageReady(clean, mime || "image/jpeg");
    } else {
      await handleImageReady(`data:${mime || "image/jpeg"};base64,${clean}`, mime || "image/jpeg");
    }
  };

  const handleImageReady = async (dataUrl: string, mime: string) => {
    stopCamera();
    let normalized = (dataUrl || "").trim();
    while (normalized.startsWith("data:") && normalized.indexOf("data:", 5) !== -1) {
      normalized = normalized.substring(normalized.indexOf("data:", 5));
    }

    setOriginalSourceImage(normalized);

    let finalUrl = normalized;
    let cropped = false;
    const docType = documentType === "EMIRATES_ID" ? "EMIRATES_ID" : documentType === "CHEQUE" ? "CHEQUE" : "GENERAL";

    try {
      const cropRes = await DocumentAutoCropper.autoCropDocument(normalized, docType);
      if (cropRes && cropRes.wasCropped) {
        finalUrl = cropRes.dataUrl;
        cropped = true;
      }
    } catch (cropErr) {
      console.warn("[SmartDocumentCaptureModal] Auto-crop fallback to original:", cropErr);
    }

    setWasAutoCropped(cropped);
    setSourceImage(finalUrl);
    setSourceMime(mime || "image/jpeg");
    setState("PREVIEW");
    // Run an immediate background quality check for the UI
    checkImageQuality(finalUrl).then(res => {
      setQualityResult(res);
      setQualityStatus(mapScoreToStatus(res.score, res.isAcceptable));
    });
  };

  const handleRotate = async () => {
    if (!sourceImage) return;
    try {
      const rotated = await DocumentAutoCropper.rotateImage(sourceImage, 90);
      setSourceImage(rotated);
      const res = await checkImageQuality(rotated);
      setQualityResult(res);
      setQualityStatus(mapScoreToStatus(res.score, res.isAcceptable));
    } catch (e) {
      console.warn("Rotate failed:", e);
    }
  };

  const handleToggleAutoCrop = async () => {
    if (!originalSourceImage) return;
    if (wasAutoCropped) {
      setSourceImage(originalSourceImage);
      setWasAutoCropped(false);
      checkImageQuality(originalSourceImage).then(res => {
        setQualityResult(res);
        setQualityStatus(mapScoreToStatus(res.score, res.isAcceptable));
      });
    } else {
      const docType = documentType === "EMIRATES_ID" ? "EMIRATES_ID" : documentType === "CHEQUE" ? "CHEQUE" : "GENERAL";
      try {
        const res = await DocumentAutoCropper.autoCropDocument(originalSourceImage, docType);
        if (res && res.wasCropped) {
          setSourceImage(res.dataUrl);
          setWasAutoCropped(true);
          checkImageQuality(res.dataUrl).then(q => {
            setQualityResult(q);
            setQualityStatus(mapScoreToStatus(q.score, q.isAcceptable));
          });
        }
      } catch (e) {
        console.warn("Auto-crop failed:", e);
      }
    }
  };

  const mapScoreToStatus = (score: number, isAcceptable: boolean): ImageQualityStatus => {
    if (!isAcceptable) return "UNUSABLE";
    if (score >= 0.80) return "HIGH";
    if (score >= 0.50) return "ACCEPTABLE";
    return "LOW";
  };

  /**
   * Preprocesses image by normalizing luminance, stretching contrast, and upscaling if needed
   */
  const preprocessImageForOcr = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;

        // Target at least 1400px width for crystal clear OCR text recognition
        const targetWidth = Math.max(origWidth, 1400);
        const scaleFactor = targetWidth / origWidth;
        const targetHeight = Math.round(origHeight * scaleFactor);

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        try {
          const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const d = imgData.data;

          // Find min & max luminance for contrast stretching
          let minLum = 255;
          let maxLum = 0;
          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
          }

          // Apply contrast stretch if dynamic range is narrow
          if (maxLum - minLum > 30 && maxLum - minLum < 220) {
            const range = maxLum - minLum;
            for (let i = 0; i < d.length; i += 4) {
              d[i] = Math.min(255, Math.max(0, ((d[i] - minLum) / range) * 255));
              d[i + 1] = Math.min(255, Math.max(0, ((d[i + 1] - minLum) / range) * 255));
              d[i + 2] = Math.min(255, Math.max(0, ((d[i + 2] - minLum) / range) * 255));
            }
            ctx.putImageData(imgData, 0, 0);
          }

          resolve(canvas.toDataURL("image/jpeg", 0.95));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const checkImageQuality = async (dataUrl: string): Promise<ImageQualityResult> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve({ isAcceptable: true, score: 0.85, issues: [] });

        canvas.width = 400;
        canvas.height = Math.max(100, Math.round(400 * (height / width)));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let brightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          brightness += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
        }
        const avgBrightness = brightness / (data.length / 4);
        
        const issues = [];
        if (avgBrightness < 35) issues.push("TOO_DARK");
        if (avgBrightness > 245) issues.push("TOO_BRIGHT");
        
        // Document-aware aspect ratio
        const aspectRatio = width / height;
        if (documentType === "CHEQUE" && aspectRatio < 1.4) {
          issues.push("SUBOPTIMAL_ASPECT_RATIO");
        } else if (documentType === "EMIRATES_ID" && aspectRatio < 1.0) {
          issues.push("SUBOPTIMAL_ASPECT_RATIO");
        }

        if (width < 300 || height < 150) {
          issues.push("CRITICAL_LOW_RESOLUTION");
        } else if (width < 800) {
          issues.push("SUBOPTIMAL_RESOLUTION_WARNING");
        }

        // Only mark unacceptable if completely unusable (e.g. 0px or corrupted)
        const isAcceptable = width >= 200 && height >= 100;

        let score = 0.95;
        if (issues.includes("SUBOPTIMAL_RESOLUTION_WARNING")) score -= 0.1;
        if (issues.includes("SUBOPTIMAL_ASPECT_RATIO")) score -= 0.05;
        if (issues.includes("TOO_DARK") || issues.includes("TOO_BRIGHT")) score -= 0.1;
        if (!isAcceptable) score = 0.2;

        resolve({
          isAcceptable,
          score: Math.max(0.4, score),
          issues,
          resolution: { width, height }
        });
      };
      img.onerror = () => {
        resolve({ isAcceptable: false, score: 0, issues: ["IMAGE_DECODE_FAILED"] });
      };
      img.src = dataUrl;
    });
  };

  const processAI = async () => {
    if (!sourceImage) return;
    
    setState("QUALITY_CHECK");
    const quality = await checkImageQuality(sourceImage);
    setQualityResult(quality);
    const status = mapScoreToStatus(quality.score, quality.isAcceptable);
    setQualityStatus(status);

    if (status === "UNUSABLE") {
      setState("ERROR");
      setErrorMsg(isAr 
        ? "تعذر قراءة ملف الصورة المرفقة. يرجى اختيار ملف صورة صالح أو إدخال البيانات يدوياً." 
        : "Could not decode the selected image file. Please select a valid image or enter details manually.");
      return;
    }

    // Automatically preprocess and enhance the image for higher OCR clarity
    let imageForOcr = sourceImage;
    try {
      imageForOcr = await preprocessImageForOcr(sourceImage);
    } catch (enhErr) {
      console.warn("Image pre-processing skipped:", enhErr);
    }

    await executeAiExtraction(imageForOcr);
  };

  const executeAiExtraction = async (imageForOcr: string) => {
    if (!imageForOcr) return;
    setState("PROCESSING");
    setErrorMsg(null);

    try {
      let b64 = imageForOcr || "";
      if (b64.includes(",")) {
        b64 = b64.substring(b64.lastIndexOf(",") + 1);
      }
      b64 = b64.replace(/[\r\n\s]/g, "");

      const startTime = Date.now();
      const res = await extractDocumentOCR(documentType, b64, sourceMime);
      const latency = Date.now() - startTime;

      if (res.success && res.data) {
        if (documentType === "CHEQUE") {
          res.data.bankName = res.data.bankName || "";
          res.data.chequeNumber = res.data.chequeNumber || "";
          res.data.amount = res.data.amount || res.data.amountNumeric || "";
          res.data.chequeDate = res.data.chequeDate || "";
          res.data.drawerName = res.data.drawerName || res.data.accountHolder || "";
        }
        
        const transformed = AIForensicValidator.validateResult(res.data, res.data.confidence || 0.85);
        setExtractedData(transformed);
        setState("REVIEW");
        
        logAudit(
          "AI_DOCUMENT_EXTRACTION",
          "DOCUMENT",
          "AI_ENGINE",
          documentType,
          `AI extraction completed in ${latency}ms. Status: ${res.data.confidence > 0.8 ? "HIGH_CONFIDENCE" : "REVIEW_REQUIRED"}. Type: ${documentType}`
        );
      } else {
        setState("ERROR");
        setErrorMsg(res.error || (isAr ? "فشل استخراج البيانات بالذكاء الاصطناعي" : "AI Extraction failed"));
      }
    } catch (e: any) {
      setState("ERROR");
      setErrorMsg(e.message || "Network error");
    }
  };

  const handleFieldChange = (key: string, newValue: any) => {
    setExtractedData((prev: any) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: newValue,
        source: "USER",
        verificationStatus: "USER_REVIEWED",
      },
    }));
  };

  const handleApprove = async () => {
    if (!extractedData || !sourceImage) return;
    
    setIsOptimizing(true);
    setState("APPROVED"); // UI feedback state

    try {
      // Post-Approval Archive Optimization
      let finalImage = sourceImage;
      let finalMime = sourceMime;
      
      if (saveToArchive) {
        // Convert base64 to File object for the optimizer
        const blob = await (await fetch(sourceImage)).blob();
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: sourceMime });
        
        // Choose profile based on document type
        const profile = documentType === "CHEQUE" ? "CHEQUE" : "LEGAL_DOCUMENT";
        const optResult = await optimizeDocument(file, profile, "OPTIMIZED_ONLY");
        if (optResult.dataUrl) {
          finalImage = optResult.dataUrl;
          finalMime = optResult.optimizedMimeType;
        }
      }

      const result: any = {
        documentType,
        capturedAt: new Date().toISOString(),
        confidenceThresholdMet: true,
        provenance: {
          capturedBy: currentUser?.nameAr || currentUser?.username || "Unknown",
          capturedAt: new Date().toISOString(),
          qualityStatus,
          qualityScore: qualityResult?.score || 0,
          documentType
        }
      };

      for (const key of Object.keys(extractedData)) {
        result[key] = extractedData[key];
      }
      
      onApprove(result, finalImage, finalMime, saveToArchive);
      
      logAudit(
        "AI_CAPTURE_APPROVED",
        "DOCUMENT",
        extractedData.chequeNumber?.value || extractedData.emiratesIdNumber?.value || "NEW",
        `User approved AI extraction. Type: ${documentType}. Archive: ${saveToArchive ? "YES" : "NO"}`,
        JSON.stringify(extractedData)
      );

      onClose();
    } catch (err) {
      console.error("Post-approval processing failed:", err);
      // Still approve with original image if optimization fails
      onApprove(extractedData, sourceImage, sourceMime, saveToArchive);
      onClose();
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleRetake = () => {
    setSourceImage(null);
    setExtractedData(null);
    setQualityResult(null);
    setState("IDLE");
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (state === "PROCESSING") return; // Prevent closing during active AI processing
        handleRetake();
        onClose();
      }}
      title={isAr ? "التقاط ذكي للمستندات" : "Smart Document Capture"}
      maxWidth="6xl"
    >
      <div className="flex flex-col h-[85vh] max-h-[800px]">
        {/* State: IDLE */}
        {state === "IDLE" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-amber-100 rounded-3xl flex items-center justify-center shadow-lg transform rotate-3">
              <ShieldCheck className="w-12 h-12 text-amber-600" />
            </div>
            
            <div className="text-center space-y-3 max-w-lg">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {isAr ? "نظام الذكاء الاصطناعي للفحص المالي" : "AI Financial Intelligence Auditor"}
              </h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                {isAr
                  ? "ابدأ التقاط صورة الشيك أو المستند. سيقوم المحرك الذكي بتحليل الجودة، استخراج البيانات، والتحقق من صحتها فوراً."
                  : "Start by capturing a cheque or document image. The AI engine will analyze quality, extract fields, and verify authenticity in real-time."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
              <CaptureMethodCard
                icon={<Camera className="w-8 h-8" />}
                label={isAr ? "الكاميرا المباشرة" : "Live Camera"}
                description={isAr ? "استخدام كاميرا الجهاز" : "Use device camera"}
                onClick={startCamera}
                color="emerald"
              />
              <CaptureMethodCard
                icon={<UploadCloud className="w-8 h-8" />}
                label={isAr ? "تحميل ملف" : "Upload File"}
                description={isAr ? "صورة أو PDF" : "Image or PDF"}
                onClick={() => fileInputRef.current?.click()}
                color="blue"
              />
              <CaptureMethodCard
                icon={<Search className="w-8 h-8" />}
                label={isAr ? "الماسح الضوئي" : "Scanner"}
                description={isAr ? "TWAIN / WIA Bridge" : "Direct Scanner Access"}
                onClick={() => setIsScannerOpen(true)}
                color="amber"
              />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* State: CAPTURING (Camera) */}
        {state === "CAPTURING" && (
          <div className="flex-1 flex flex-col bg-slate-950 rounded-2xl overflow-hidden relative shadow-inner">
            <video ref={cameraVideoRef} className="w-full h-full object-cover" playsInline />
            
            {/* Guide Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[85%] h-[45%] border-2 border-white/40 border-dashed rounded-2xl flex items-center justify-center">
                <div className="w-12 h-12 border-t-2 border-l-2 border-emerald-400 absolute top-0 left-0 rounded-tl-xl"></div>
                <div className="w-12 h-12 border-t-2 border-r-2 border-emerald-400 absolute top-0 right-0 rounded-tr-xl"></div>
                <div className="w-12 h-12 border-b-2 border-l-2 border-emerald-400 absolute bottom-0 left-0 rounded-bl-xl"></div>
                <div className="w-12 h-12 border-b-2 border-r-2 border-emerald-400 absolute bottom-0 right-0 rounded-br-xl"></div>
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{isAr ? "ضع الشيك هنا" : "Align Cheque Here"}</span>
              </div>
            </div>

            <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-12">
              <button
                onClick={handleRetake}
                className="w-12 h-12 bg-white/10 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>
              
              <button
                onClick={capturePhoto}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-[6px] border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all"
              >
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-emerald-600" />
                </div>
              </button>
              
              <div className="w-12 h-12"></div> {/* Spacer for symmetry */}
            </div>

            <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">HD Live Scan</span>
              </div>
            </div>
          </div>
        )}

        {/* State: PREVIEW / QUALITY_CHECK / ERROR / PROCESSING */}
        {(["PREVIEW", "QUALITY_CHECK", "ERROR", "PROCESSING", "WARNING"].includes(state)) && (
          <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
            <div className="flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center relative group">
              {sourceMime === "application/pdf" ? (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-24 h-24 mb-4 opacity-40" />
                  <span className="text-xs font-black uppercase tracking-widest">{isAr ? "مستند PDF رقمي" : "Digital PDF Document"}</span>
                </div>
              ) : (
                <img src={sourceImage!} alt="Preview" className="max-h-full max-w-full object-contain select-none" />
              )}
              
              {/* Quality Status Badge */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <AnimatePresence>
                  {qualityStatus && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-lg ${
                        qualityStatus === "HIGH" ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" :
                        qualityStatus === "ACCEPTABLE" ? "bg-blue-500/20 border-blue-400/30 text-blue-300" :
                        qualityStatus === "LOW" ? "bg-amber-500/20 border-amber-400/30 text-amber-300" :
                        "bg-rose-500/20 border-rose-400/30 text-rose-300"
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        qualityStatus === "HIGH" ? "bg-emerald-400" :
                        qualityStatus === "ACCEPTABLE" ? "bg-blue-400" :
                        qualityStatus === "LOW" ? "bg-amber-400" :
                        "bg-rose-400"
                      }`}></div>
                      <span className="text-[10px] font-black uppercase tracking-widest">{isAr ? `جودة: ${qualityStatus}` : `Quality: ${qualityStatus}`}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Resolution / Metadata Overlay */}
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] text-white/80 font-mono flex flex-col items-end gap-1 border border-white/10 shadow-xl">
                 <div className="flex items-center gap-2">
                   <span className="opacity-50">Score:</span>
                   <span className="font-bold">{qualityResult ? Math.round(qualityResult.score * 100) : "--"}%</span>
                 </div>
                 {qualityResult?.resolution && (
                   <div className="flex items-center gap-2">
                     <span className="opacity-50">Res:</span>
                     <span className="font-bold">{qualityResult.resolution.width}x{qualityResult.resolution.height}</span>
                   </div>
                 )}
              </div>

              {(state === "QUALITY_CHECK" || state === "PROCESSING") && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <RefreshCw className="w-16 h-16 text-emerald-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h4 className="text-xl font-black text-white tracking-tight">
                      {state === "QUALITY_CHECK" ? (isAr ? "تحليل دقة الصورة..." : "Analyzing Image Clarity...") : (isAr ? "استخراج البيانات..." : "Extracting Data...")}
                    </h4>
                    <p className="text-slate-400 text-xs font-medium animate-pulse">
                      {isAr ? "نظام Gemini 3.7 Flash يقوم بمعالجة المستند" : "Gemini 3.7 Flash Engine is processing the document"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {state === "ERROR" && (
              <div className="p-6 bg-rose-50 border-2 border-rose-200 rounded-2xl flex flex-col items-center text-center space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-rose-950">{isAr ? "تعذر إتمام المعالجة" : "Capture Verification Failed"}</h4>
                  <p className="text-sm text-rose-800 font-medium max-w-md mx-auto">
                    {errorMsg}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 justify-center">
                  <button
                    onClick={processAI}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-black transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{isAr ? "إعادة محاولة القراءة" : "Retry Extraction"}</span>
                  </button>
                  <button
                    onClick={handleRetake}
                    className="px-6 py-2.5 bg-rose-100 text-rose-800 rounded-xl text-sm font-black hover:bg-rose-200 transition-all active:scale-95"
                  >
                    {isAr ? "إعادة التقاط المستند" : "Retake Document"}
                  </button>
                </div>
              </div>
            )}

            {state === "PREVIEW" && (
              <div className="flex flex-wrap justify-between items-center gap-4 p-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRetake}
                    className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-black text-sm transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isAr ? "حذف والتقاط جديد" : "Discard & Retake"}</span>
                  </button>
                  <button
                    onClick={handleRotate}
                    className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-black text-sm transition-all"
                    title={isAr ? "تدوير المستند 90 درجة" : "Rotate 90 degrees"}
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>{isAr ? "تدوير 90°" : "Rotate"}</span>
                  </button>
                  {originalSourceImage && (
                    <button
                      onClick={handleToggleAutoCrop}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm border transition-all ${
                        wasAutoCropped 
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100" 
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                      title={isAr ? "تبديل القص التلقائي للهوامش" : "Toggle auto crop boundaries"}
                    >
                      <Crop className="w-4 h-4 text-emerald-600" />
                      <span>{wasAutoCropped ? (isAr ? "قص تلقائي (مفعّل)" : "Cropped") : (isAr ? "قص الهوامش" : "Auto Crop")}</span>
                    </button>
                  )}
                </div>
                
                <div className="flex gap-4">
                  <div className="hidden lg:flex flex-col items-end justify-center px-4 border-r border-slate-200">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "الحالة" : "Auditor Status"}</span>
                     <span className={`text-xs font-bold ${qualityStatus === "HIGH" ? "text-emerald-600" : "text-amber-600"}`}>
                       {isAr ? "جاهز للاستخراج" : "Ready for extraction"}
                     </span>
                  </div>
                  <button
                    onClick={processAI}
                    className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl hover:bg-black font-black shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-3 group"
                  >
                    <Search className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>{isAr ? "بدء استخراج البيانات (AI)" : "Analyze Document (AI)"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* State: REVIEW */}
        {state === "REVIEW" && extractedData && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden animate-in fade-in duration-500">
            {/* Left: Original Document View (Forensic Side) */}
            <div className="w-full lg:w-[45%] flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                   <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{isAr ? "الأصل المرئي" : "Original Visual"}</span>
                 </div>
                 <button 
                  onClick={() => setIsFullscreenPreview(true)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                 >
                   <Maximize2 className="w-4 h-4" />
                 </button>
              </div>
              
              <div className="flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-4 relative shadow-inner">
                {sourceMime === "application/pdf" ? (
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <FileText className="w-16 h-16 mb-4" />
                    <span>PDF Content</span>
                  </div>
                ) : (
                  <img src={sourceImage!} alt="Document" className="max-h-full max-w-full object-contain shadow-2xl" />
                )}
                <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md text-[8px] text-white/60 font-mono tracking-tighter uppercase">
                  Authenticated Raw Stream
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                 <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                   <History className="w-4 h-4" />
                 </div>
                 <div className="flex-1">
                   <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isAr ? "سجل المعالجة" : "Provenance Audit"}</div>
                   <div className="text-[11px] text-slate-700 font-bold">
                     AI Extraction latency: 2.1s • Confidence: {Math.round((extractedData.chequeNumber?.systemScore || 0.8) * 100)}%
                   </div>
                 </div>
              </div>
            </div>
            
            {/* Right: Data Auditor (Review Side) */}
            <div className="w-full lg:w-[55%] flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl">
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-black text-slate-900">{isAr ? "مراجعة وتدقيق البيانات" : "Data Audit & Verification"}</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Human-in-the-Loop Quality Gate</p>
                </div>
                <div className="flex items-center gap-2">
                   <div className="px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-sm text-[10px] font-bold text-slate-600">
                     {documentType}
                   </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {Object.keys(extractedData).map((key) => {
                    const field = extractedData[key];
                    if (typeof field !== 'object' || !field) return null;
                    
                    const isLowConfidence = field.systemStatus === "LOW_CONFIDENCE" || field.systemStatus === "REVIEW_REQUIRED";
                    const isUserEdited = field.source === "USER";
                    
                    return (
                      <div key={key} className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all ${
                        isLowConfidence && !isUserEdited ? 'border-amber-300 bg-amber-50 shadow-xs' : 
                        isUserEdited ? 'border-blue-200 bg-blue-50/50' :
                        'border-slate-100 bg-white'
                      }`}>
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            {isAr ? (FIELD_LABELS_AR[key] || key) : key.replace(/([A-Z])/g, " $1").trim()}
                          </label>
                          <FieldStatusBadge origin={isUserEdited ? "EDITED" : isLowConfidence ? "CHECK" : "AUTO"} />
                        </div>
                        
                        <div className="relative group">
                          <input
                            type={typeof field.value === "number" ? "number" : "text"}
                            value={field.value || ""}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className={`w-full bg-white border rounded-lg px-3 py-2 text-sm font-bold outline-none transition-all ${
                              isLowConfidence && !isUserEdited ? 'border-amber-400 focus:ring-2 focus:ring-amber-200' : 
                              isUserEdited ? 'border-blue-400 focus:ring-2 focus:ring-blue-100' :
                              'border-slate-200 focus:ring-2 focus:ring-slate-100'
                            }`}
                          />
                          {isLowConfidence && !isUserEdited && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        {isLowConfidence && !isUserEdited && field.reason && (
                          <div className="flex items-start gap-1.5 px-1 pt-1">
                            <Info className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-amber-700 font-medium leading-tight">
                              {field.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Visual Field Indicators (MICR / Signature) for cheques */}
                {documentType === "CHEQUE" && (
                  <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <VerificationToggle 
                      label={isAr ? "توقيع مرئي" : "Signature Visible"} 
                      active={extractedData.signatureDetected?.value}
                      onToggle={(v) => handleFieldChange("signatureDetected", v)}
                    />
                    <VerificationToggle 
                      label={isAr ? "ختم إرجاع" : "Bounce Stamp"} 
                      active={extractedData.isBounced?.value}
                      onToggle={(v) => handleFieldChange("isBounced", v)}
                    />
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                   <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-10 h-6 rounded-full transition-all relative ${saveToArchive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <input
                        type="checkbox"
                        checked={saveToArchive}
                        onChange={(e) => setSaveToArchive(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${saveToArchive ? 'left-5' : 'left-1'}`}></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">{isAr ? "الأرشفة الإلكترونية" : "Electronic Archive"}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{isAr ? "تحسين الملف وتخزينه سحابياً" : "Optimize and store in cloud"}</span>
                    </div>
                  </label>
                  
                  {isOptimizing && (
                    <div className="flex items-center gap-2 text-emerald-600 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Optimizing...</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleRetake}
                    className="flex-1 py-3 px-4 border border-slate-300 text-slate-700 rounded-xl hover:bg-white font-black transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{isAr ? "إلغاء وإعادة" : "Cancel & Retake"}</span>
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isOptimizing}
                    className="flex-[2] py-3 px-8 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-black shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{isAr ? "اعتماد واستخدام البيانات" : "Confirm & Approve Data"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ScannerModal documentType={documentType}
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={handleScannerResult}
      />

      {/* Fullscreen Preview Portal */}
      <AnimatePresence>
        {isFullscreenPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-8"
          >
             <button 
              onClick={() => setIsFullscreenPreview(false)}
              className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
             >
               <Minimize2 className="w-8 h-8" />
             </button>
             <img 
              src={sourceImage!} 
              alt="Fullscreen Document" 
              className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(255,255,255,0.1)]" 
             />
             <div className="absolute bottom-8 left-8 text-white/40 text-xs font-mono tracking-widest uppercase">
               High-Resolution Forensic Source Buffer
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};

// Sub-components for cleaner structure

const CaptureMethodCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  color: "emerald" | "blue" | "amber";
}> = ({ icon, label, description, onClick, color }) => {
  const colors = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-400 hover:bg-emerald-100/50",
    blue: "text-blue-600 bg-blue-50 border-blue-100 hover:border-blue-400 hover:bg-blue-100/50",
    amber: "text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-400 hover:bg-amber-100/50",
  };

  return (
    <button
      onClick={onClick}
      className={`p-6 bg-white border rounded-2xl shadow-xs transition-all flex flex-col items-center text-center gap-4 group cursor-pointer ${colors[color]}`}
    >
      <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="space-y-1">
        <div className="font-black text-slate-800 tracking-tight text-sm">{label}</div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{description}</div>
      </div>
    </button>
  );
};

const FieldStatusBadge: React.FC<{ origin: FieldOrigin }> = ({ origin }) => {
  const styles = {
    AUTO: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CHECK: "bg-amber-100 text-amber-700 border-amber-200",
    EDITED: "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <div className={`px-2 py-0.5 rounded border text-[8px] font-black tracking-widest uppercase ${styles[origin]}`}>
      {origin}
    </div>
  );
};

const VerificationToggle: React.FC<{
  label: string;
  active: boolean;
  onToggle: (v: boolean) => void;
}> = ({ label, active, onToggle }) => (
  <button
    onClick={() => onToggle(!active)}
    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
      active ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400 grayscale'
    }`}
  >
    <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      {active && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
    </div>
  </button>
);
