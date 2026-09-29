import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  FileText,
  ShieldCheck,
  Cpu,
  UserCheck,
  AlertCircle,
  Eye,
  Settings,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { DocumentStorageService } from "../../services/documentStorageService";
import {
  EmiratesIdData,
  getEmiratesIdReaderStatus,
  scanEmiratesIdCard,
  runOcrScan,
  getExpiryStatus,
  getEmiratesIdSettings,
} from "../../services/emiratesIdService";
import { Badge } from "../common/Badge";

interface EmiratesIdScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "OWNER" | "TENANT";
  entityId?: string;
  onConfirm: (data: EmiratesIdData) => void;
}

export const EmiratesIdScannerModal: React.FC<EmiratesIdScannerModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  onConfirm,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const { owners, tenants, logAudit, addArchiveItem } = useData();
  const { hasPermission, currentUser } = useAuth();

  // Step state
  // "IDLE" | "CONNECTING" | "SCANNING" | "CONFIRMATION" | "ERROR"
  const [step, setStep] = useState<"IDLE" | "CONNECTING" | "SCANNING" | "CONFIRMATION" | "ERROR">("IDLE");
  const [activeTab, setActiveTab] = useState<"READER" | "OCR">("READER");

  // Error state
  const [errorDetails, setErrorDetails] = useState<{ code: string; message: string; messageAr: string }>({
    code: "",
    message: "",
    messageAr: "",
  });

  // Data states
  const [scannedData, setScannedData] = useState<EmiratesIdData | null>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    name: string;
    type: string;
    code: string;
  } | null>(null);

  // Status and reader details
  const [readerInfo, setReaderInfo] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setStep("IDLE");
    setScannedData(null);
    setOcrFile(null);
    setIsProcessingOcr(false);
    setDuplicateWarning(null);
    setErrorDetails({ code: "", message: "", messageAr: "" });
  };

  if (!isOpen) return null;

  // 1. Permission Check
  const canReadIdentity = hasPermission("identity.read");
  if (!canReadIdentity) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-xl space-y-4 text-center">
          <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto" />
          <h3 className="text-base font-black text-slate-900">
            {isAr ? "صلاحية مرفوضة" : "Permission Denied"}
          </h3>
          <p className="text-xs text-slate-500">
            {isAr
              ? "عذراً، لا تمتلك الصلاحية الكافية للوصول إلى أدوات قراءة الهوية الإماراتية. يرجى مراجعة مسؤول النظام."
              : "You do not have the required permissions to access Emirates ID reader toolkit."}
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {isAr ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    );
  }

  // Check Duplicates across both Owners and Tenants
  const checkDuplicateEmiratesId = (eidNumber: string): boolean => {
    const cleanId = eidNumber.replace(/[^\d]/g, "");
    if (!cleanId) return false;

    // Check Owners
    for (const owner of owners) {
      if (owner.id !== entityId) {
        const cleanOwnerId = (owner.emiratesId || "").replace(/[^\d]/g, "");
        if (cleanOwnerId === cleanId) {
          setDuplicateWarning({
            name: isAr ? owner.nameAr : owner.nameEn,
            type: isAr ? "مالك عقاري" : "Property Owner",
            code: owner.code,
          });
          // Log duplicate event
          logAudit(
            "EMIRATES_ID_DUPLICATE_DETECTED" as any,
            "EMIRATES_ID" as any,
            owner.id,
            owner.nameEn,
            `Duplicate Emirates ID detected: EID ${eidNumber} is already registered to Owner ${owner.nameEn}`
          );
          return true;
        }
      }
    }

    // Check Tenants
    for (const tenant of tenants) {
      if (tenant.id !== entityId) {
        const cleanTenantId = (tenant.emiratesId || "").replace(/[^\d]/g, "");
        if (cleanTenantId === cleanId) {
          setDuplicateWarning({
            name: isAr ? tenant.nameAr : tenant.nameEn,
            type: isAr ? "مستأجر" : "Tenant",
            code: tenant.code,
          });
          // Log duplicate event
          logAudit(
            "EMIRATES_ID_DUPLICATE_DETECTED" as any,
            "EMIRATES_ID" as any,
            tenant.id,
            tenant.nameEn,
            `Duplicate Emirates ID detected: EID ${eidNumber} is already registered to Tenant ${tenant.nameEn}`
          );
          return true;
        }
      }
    }

    setDuplicateWarning(null);
    return false;
  };

  // Trigger Local Bridge Read
  const handleStartScan = async () => {
    setDuplicateWarning(null);
    setStep("CONNECTING");

    // Audit log read started
    logAudit(
      "EMIRATES_ID_READ_STARTED" as any,
      "EMIRATES_ID" as any,
      entityId || "NEW",
      entityType,
      `Emirates ID read session initiated by employee ${currentUser?.nameAr || currentUser?.username || "Admin"}`
    );

    // 1. Check Local Bridge Status
    const status = await getEmiratesIdReaderStatus();
    if (status.status === "UNAVAILABLE" || status.status === "ERROR" || status.status === "NOT_CONFIGURED") {
      setErrorDetails({
        code: status.status === "ERROR" ? "BRIDGE_UNAUTHORIZED" : "BRIDGE_NOT_RUNNING",
        message: status.messageEn,
        messageAr: status.messageAr,
      });
      setStep("ERROR");
      logAudit(
        "EMIRATES_ID_READ_FAILED" as any,
        "EMIRATES_ID" as any,
        entityId || "NEW",
        entityType,
        `Read failed: Secure local bridge is offline or unauthorized`
      );
      return;
    }

    setStep("SCANNING");
    setReaderInfo(status.readerModel || "PC/SC Compatible Reader");

    // 2. Scan Emirates ID Card
    const scanResult = await scanEmiratesIdCard();
    if (!scanResult.success || !scanResult.data) {
      setErrorDetails({
        code: scanResult.errorCategory || "CARD_READ_FAILED",
        message: scanResult.error || "Failed to communicate with reader",
        messageAr: scanResult.errorAr || "فشل الاتصال بقارئ البطاقات المحلي",
      });
      setStep("ERROR");
      logAudit(
        "EMIRATES_ID_READ_FAILED" as any,
        "EMIRATES_ID" as any,
        entityId || "NEW",
        entityType,
        `Read failed: Card read error or timeout. Category: ${scanResult.errorCategory || "UNKNOWN"}`
      );
      return;
    }

    // Success! Check duplicates
    const isDuplicate = checkDuplicateEmiratesId(scanResult.data.emiratesIdNumber);
    setScannedData(scanResult.data);
    setStep("CONFIRMATION");

    logAudit(
      "EMIRATES_ID_READ_SUCCESS" as any,
      "EMIRATES_ID" as any,
      entityId || "NEW",
      entityType,
      `Emirates ID successfully read via Local Bridge reader.`
    );
  };

  // Trigger OCR Upload Fallback
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrFile(file);
    setIsProcessingOcr(true);
    setDuplicateWarning(null);

    // Log Document Upload
    logAudit(
      "EMIRATES_ID_DOCUMENT_UPLOADED" as any,
      "EMIRATES_ID" as any,
      entityId || "NEW",
      entityType,
      `Emirates ID copy uploaded for OCR: ${file.name}`
    );

    try {
      const ocrResult = await runOcrScan(file);
      setIsProcessingOcr(false);

      if (ocrResult.success && ocrResult.data) {
        const fullOcrData: EmiratesIdData = {
          emiratesIdNumber: ocrResult.data.emiratesIdNumber || "",
          fullName: ocrResult.data.fullName || "",
          arabicName: ocrResult.data.arabicName || "",
          englishName: ocrResult.data.englishName || "",
          dateOfBirth: ocrResult.data.dateOfBirth || "",
          gender: ocrResult.data.gender || "",
          nationality: ocrResult.data.nationality || "",
          cardNumber: ocrResult.data.cardNumber || "",
          issueDate: ocrResult.data.issueDate || "",
          expiryDate: ocrResult.data.expiryDate || "",
          identitySource: "OCR",
          verificationStatus: "UNVERIFIED",
          captureDate: new Date().toISOString(),
          readerInformation: ocrResult.data.readerInformation || "OCR V2 Model",
        };

        checkDuplicateEmiratesId(fullOcrData.emiratesIdNumber);
        setScannedData(fullOcrData);
        setStep("CONFIRMATION");

        // Add file to Electronic Archive via canonical gateway
        await DocumentStorageService.uploadAndArchive(file, {
          category: "EMIRATES_ID",
          entityType: entityType,
          entityId: entityId || "temp-" + Date.now(),
          fileName: file.name,
          mimeType: file.type || "image/png",
          description: "Uploaded via Emirates ID OCR scan module",
          uploadedByUserId: currentUser?.id,
          uploadedByName: currentUser?.nameAr || currentUser?.username || "System Admin",
          tags: ["EMIRATES_ID_OCR"]
        });
      } else {
        setErrorDetails({
          code: "OCR_FAILED",
          message: ocrResult.error || "OCR failed to parse document.",
          messageAr: ocrResult.errorAr || "فشلت معالجة المستند المرفق واستخراج البيانات.",
        });
        setStep("ERROR");
      }
    } catch {
      setIsProcessingOcr(false);
      setErrorDetails({
        code: "OCR_FAILED",
        message: "Error processing OCR pipeline.",
        messageAr: "حدث خطأ أثناء معالجة وقراءة صورة الهوية.",
      });
      setStep("ERROR");
    }
  };

  // Confirm and Save identity data back to parent page
  const handleConfirmSave = () => {
    if (!scannedData) return;

    if (duplicateWarning) {
      // Hard block saving if duplicate is found
      return;
    }

    onConfirm(scannedData);

    // Audit log save
    logAudit(
      "EMIRATES_ID_CONFIRMED" as any,
      "EMIRATES_ID" as any,
      entityId || "NEW",
      entityType,
      `Emirates ID ${scannedData.emiratesIdNumber} confirmed and saved successfully to ${entityType} profile.`
    );

    onClose();
  };

  const sysSettings = getEmiratesIdSettings();
  const warningDays = sysSettings.expiryWarningDays || 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-700">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {isAr ? "ربط وتأكيد الهوية الإماراتية" : "Emirates ID Identity Integration"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isAr
                  ? "قراءة وتأكيد الهوية باستخدام القارئ الإلكتروني الرسمي أو الفحص البصري للمستند."
                  : "Read and confirm Emirates ID using the official card reader or visual OCR fallback."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Tab Navigation if in IDLE/ERROR */}
          {(step === "IDLE" || step === "ERROR") && (
            <div className="flex border-b border-slate-100 p-1 bg-slate-50 rounded-xl">
              <button
                onClick={() => setActiveTab("READER")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "READER"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>{isAr ? "القارئ الإلكتروني الذكي" : "Smart Card Reader"}</span>
              </button>
              {sysSettings.allowOcrFallback && (
                <button
                  onClick={() => setActiveTab("OCR")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "OCR"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isAr ? "تحميل صورة الهوية / OCR" : "Upload Copy / OCR"}</span>
                </button>
              )}
            </div>
          )}

          {/* STEP: IDLE */}
          {step === "IDLE" && activeTab === "READER" && (
            <div className="text-center py-10 space-y-5">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-700 animate-pulse">
                <Cpu className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-xs font-black text-slate-800">
                  {isAr ? "جاهز لقراءة الهوية الإماراتية" : "Ready to read Emirates ID Card"}
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {isAr
                    ? "يرجى إدخال الهوية في قارئ البطاقات المتصل بجهازك، ثم اضغط على زر قراءة لإدخال البيانات تلقائياً."
                    : "Please insert the physical Emirates ID card into the connected smart reader, then click read."}
                </p>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={handleStartScan}
                  className="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Cpu className="w-4 h-4" />
                  <span>{isAr ? "بدء قراءة الهوية" : "Read Emirates ID"}</span>
                </button>
              </div>
            </div>
          )}

          {step === "IDLE" && activeTab === "OCR" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-amber-500 rounded-3xl p-8 text-center cursor-pointer relative bg-slate-50/50 hover:bg-white transition-all">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, application/pdf"
                  onChange={handleOcrUpload}
                  disabled={isProcessingOcr}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {isProcessingOcr ? (
                  <div className="space-y-4">
                    <RefreshCw className="w-10 h-10 text-amber-600 animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        {isAr ? "جاري فحص وقراءة الصورة بصرياً..." : "Processing OCR Scan..."}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {isAr ? "يرجى الانتظار، يتم استخراج الأرقام والأسماء." : "Please wait while extracting data."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        {isAr ? "اسحب وأسقط صورة الهوية هنا" : "Drag and drop Emirates ID copy"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {isAr ? "يدعم الملفات من نوع PNG, JPEG, PDF" : "Supports PNG, JPEG, PDF formats"}
                      </p>
                    </div>
                    <span className="inline-block px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold">
                      {isAr ? "اختر ملفاً" : "Browse Files"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP: CONNECTING / SCANNING */}
          {(step === "CONNECTING" || step === "SCANNING") && (
            <div className="text-center py-16 space-y-6">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-amber-100 border-t-amber-700 animate-spin" />
                <Cpu className="w-6 h-6 text-amber-700" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                  {step === "CONNECTING"
                    ? (isAr ? "جاري الاتصال بالجسر..." : "Connecting to local bridge...")
                    : (isAr ? "جاري قراءة البيانات الموثقة..." : "Reading authenticated card blocks...")}
                </h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  {isAr
                    ? "يقوم النظام الآن بمخاطبة جسر الخدمة الآمن على 127.0.0.1 والتحقق من صلاحية شهادات ICP."
                    : "The system is communicating with local bridge service at 127.0.0.1 and validating Toolkit payload."}
                </p>
              </div>
            </div>
          )}

          {/* STEP: ERROR */}
          {step === "ERROR" && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-4">
              <div className="flex gap-3">
                <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-black text-rose-900">
                    {isAr ? "فشل الاتصال / خطأ في القراءة" : "Reader / Connection Failure"}
                  </h4>
                  <p className="text-[11px] text-rose-700 leading-relaxed font-semibold">
                    {isAr ? errorDetails.messageAr : errorDetails.message}
                  </p>
                  
                  {/* Standard Toolkit activations reminder */}
                  {errorDetails.code === "BRIDGE_NOT_RUNNING" && (
                    <div className="text-[10px] text-slate-500 mt-2 p-3 bg-white/80 rounded-xl border border-rose-100 space-y-1">
                      <span className="font-bold text-slate-700 block">
                        {isAr ? "تنبيه التفعيل البرمجي:" : "Software Integration Status:"}
                      </span>
                      <span>
                        {isAr
                          ? "تمت برمجة وتكامل واجهة الخدمة برمجياً؛ يتطلب التفعيل اللحظي مع الأجهزة الحقيقية تثبيت وتثبيث برنامج Emirates ID Toolkit الرسمي وتوصيل قارئ بطاقة ذكي متوافق (PC/SC)."
                          : "Software integration is complete; final real-hardware activation requires installation/configuration of the official Emirates ID Toolkit and a compatible PC/SC reader."}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  onClick={resetState}
                  className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {isAr ? "إعادة المحاولة" : "Try Again"}
                </button>
              </div>
            </div>
          )}

          {/* STEP: CONFIRMATION VIEW */}
          {step === "CONFIRMATION" && scannedData && (
            <div className="space-y-5 animate-in fade-in duration-300">
              
              {/* Duplicate Warn Banner */}
              {duplicateWarning && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs font-bold space-y-1.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{isAr ? "تنبيه: تم اكتشاف هوية مكررة ومسجلة مسبقاً!" : "Warning: Duplicate Identity Detected!"}</span>
                  </div>
                  <p className="text-[11px] text-rose-700 font-normal leading-relaxed">
                    {isAr
                      ? `رقم الهوية المدخل مسجل مسبقاً باسم المالك/المستأجر: [${duplicateWarning.name}] ذو الرمز التريسي (${duplicateWarning.code})، بصفته (${duplicateWarning.type}). تم حظر الحفظ لمنع التكرار.`
                      : `This Emirates ID number is already assigned to ${duplicateWarning.type}: [${duplicateWarning.name}] with Code: ${duplicateWarning.code}. Overwrite block is active.`}
                  </p>
                </div>
              )}

              {/* Source Banner */}
              <div className={`p-3 rounded-xl flex items-center justify-between text-[11px] font-bold ${
                scannedData.identitySource === "OFFICIAL_TOOLKIT"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                  : "bg-amber-50 text-amber-800 border border-amber-100"
              }`}>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {scannedData.identitySource === "OFFICIAL_TOOLKIT"
                      ? (isAr ? "تمت القراءة من حزمة أجهزة الهوية الإماراتية الرسمية" : "Read from Official Emirates ID Toolkit")
                      : (isAr ? "مستخرج من المستند المرفوع بصرياً (OCR)" : "Extracted from uploaded document")}
                  </span>
                </div>
                <Badge variant={scannedData.identitySource === "OFFICIAL_TOOLKIT" ? "success" : "warning"}>
                  {scannedData.identitySource}
                </Badge>
              </div>

              {/* Main ID Details Grid */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col sm:flex-row gap-5">
                
                {/* Photo space */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-24 h-32 bg-slate-200 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center relative shadow-inner">
                    {scannedData.photoBase64 ? (
                      <img
                        src={scannedData.photoBase64}
                        alt="EID Photo"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <UserCheck className="w-10 h-10 text-slate-400" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {isAr ? "الصورة الشخصية" : "Cardholder Photo"}
                  </span>
                </div>

                {/* Details list */}
                <div className="grid grid-cols-2 gap-4 flex-1 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? "رقم الهوية الإماراتية" : "Emirates ID Number"}
                    </span>
                    <span className="font-mono font-black text-slate-900 block mt-0.5 text-sm">
                      {scannedData.emiratesIdNumber}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? "تاريخ انتهاء الهوية" : "Expiry Date"}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-slate-800">
                        {scannedData.expiryDate}
                      </span>
                      {(() => {
                        const status = getExpiryStatus(scannedData.expiryDate, warningDays);
                        return (
                          <Badge
                            variant={
                              status === "EXPIRED"
                                ? "danger"
                                : status === "EXPIRING_SOON"
                                ? "warning"
                                : "success"
                            }
                            size="sm"
                          >
                            {status}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? "الاسم الكامل (إنجليزي)" : "Full Name (English)"}
                    </span>
                    <span className="font-bold text-slate-800 block mt-0.5">
                      {scannedData.englishName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? "الاسم الكامل (عربي)" : "Full Name (Arabic)"}
                    </span>
                    <span className="font-bold text-slate-800 block mt-0.5">
                      {scannedData.arabicName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? "الجنسية" : "Nationality"}
                    </span>
                    <span className="font-medium text-slate-700 block mt-0.5">
                      {scannedData.nationality}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? "تاريخ الميلاد / الجنس" : "Date of Birth / Gender"}
                    </span>
                    <span className="font-medium text-slate-700 block mt-0.5">
                      {scannedData.dateOfBirth} - {scannedData.gender}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? "رقم بطاقة الهوية / تاريخ الإصدار" : "Card Number / Issue Date"}
                    </span>
                    <span className="font-mono text-slate-600 block mt-0.5">
                      #{scannedData.cardNumber} ({scannedData.issueDate})
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? "وسيط وأجهزة الاستخراج" : "Capture Device Info"}
                    </span>
                    <span className="font-medium text-slate-600 block mt-0.5 text-[10px]">
                      {scannedData.readerInformation}
                    </span>
                  </div>
                </div>

              </div>

              {/* Confirm Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={resetState}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  {isAr ? "قراءة أخرى" : "Read Again"}
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={!!duplicateWarning}
                  className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                    duplicateWarning
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-emerald-700 hover:bg-emerald-800"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isAr ? "تأكيد وحفظ الهوية" : "Confirm & Save"}</span>
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
