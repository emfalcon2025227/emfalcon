/**
 * Official Emirates ID / ICP Toolkit Integration Service
 * Secure Local Bridge Connector for PC/SC-compatible Readers
 */

export interface EmiratesIdSettings {
  enableReader: boolean;
  enableLocalBridge: boolean;
  bridgeUrl: string;
  bridgePort: string;
  allowedOrigin: string;
  pairingStatus: "PAIRED" | "UNPAIRED" | "FAILED";
  toolkitDetection: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
  toolkitVersion: string;
  selectedReader: string;
  autoDetectReader: boolean;
  requireConfirmation: boolean;
  allowOcrFallback: boolean;
  allowArchiving: boolean;
  expiryWarningDays: number;
  environment: "TEST" | "PRODUCTION";
  pairingToken?: string;
}

export interface EmiratesIdData {
  emiratesIdNumber: string;
  fullName: string;
  arabicName: string;
  englishName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | string;
  nationality: string;
  cardNumber: string;
  issueDate: string;
  expiryDate: string;
  identitySource: "OFFICIAL_TOOLKIT" | "UPLOADED_DOCUMENT" | "OCR";
  verificationStatus: "VERIFIED" | "PENDING" | "EXPIRED" | "UNVERIFIED";
  captureDate: string;
  readerInformation: string;
  photoBase64?: string; // photo if officially available
}

export const DEFAULT_SETTINGS: EmiratesIdSettings = {
  enableReader: true,
  enableLocalBridge: true,
  bridgeUrl: "http://127.0.0.1",
  bridgePort: "13984",
  allowedOrigin: typeof window !== "undefined" ? window.location.origin : "",
  pairingStatus: "UNPAIRED",
  toolkitDetection: "UNKNOWN",
  toolkitVersion: "",
  selectedReader: "HID OMNIKEY 3121 USB Smart Card Reader",
  autoDetectReader: true,
  requireConfirmation: true,
  allowOcrFallback: true,
  allowArchiving: true,
  expiryWarningDays: 30,
  environment: "PRODUCTION",
};

// LocalStorage helpers
export function getEmiratesIdSettings(): EmiratesIdSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const stored = localStorage.getItem("emirates_id_settings");
  if (!stored) {
    return DEFAULT_SETTINGS;
  }
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveEmiratesIdSettings(settings: EmiratesIdSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("emirates_id_settings", JSON.stringify(settings));
}

export interface EmiratesIdReaderStatus {
  status: "CONNECTED" | "UNAVAILABLE" | "ERROR" | "NOT_CONFIGURED";
  messageAr: string;
  messageEn: string;
  readerModel?: string;
  firmwareVersion?: string;
}

/**
 * Synchronous status check for testing suite
 */
export function getEmiratesIdReaderStatusSync(): EmiratesIdReaderStatus {
  const settings = getEmiratesIdSettings();
  if (!settings.enableReader) {
    return {
      status: "NOT_CONFIGURED",
      messageAr: "تم تعطيل قارئ الهوية من إعدادات النظام.",
      messageEn: "Emirates ID reader is disabled in system settings.",
    };
  }
  if (settings.environment === "PRODUCTION") {
    return {
      status: "UNAVAILABLE",
      messageAr: "جسر الاتصال المحلي غير متصل. يرجى تشغيل برنامج الجسر المحلي.",
      messageEn: "Secure Local Bridge not running. Please launch the local bridge daemon.",
    };
  }
  return {
    status: "CONNECTED",
    messageAr: "جسر الاتصال المحلي متصل (بيئة تجريبية). القارئ: OMNIKEY 3121",
    messageEn: "Secure Local Bridge Connected (TEST environment). Reader: OMNIKEY 3121",
    readerModel: settings.selectedReader,
    firmwareVersion: "v1.0.4-sandbox",
  };
}

/**
 * Pings the Local Bridge to verify live status
 */
export async function getEmiratesIdReaderStatus(): Promise<EmiratesIdReaderStatus> {
  const settings = getEmiratesIdSettings();
  if (!settings.enableReader) {
    return {
      status: "NOT_CONFIGURED",
      messageAr: "تم تعطيل قارئ الهوية من إعدادات النظام.",
      messageEn: "Emirates ID reader is disabled in system settings.",
    };
  }

  if (settings.environment === "TEST") {
    return {
      status: "CONNECTED",
      messageAr: "جسر الاتصال المحلي متصل (بيئة تجريبية). القارئ: OMNIKEY 3121",
      messageEn: "Secure Local Bridge Connected (TEST environment). Reader: OMNIKEY 3121",
      readerModel: settings.selectedReader,
      firmwareVersion: "v1.0.4-sandbox",
    };
  }

  // Block default/temporary credentials in PRODUCTION environment
  if (settings.environment === "PRODUCTION") {
    if (!settings.pairingToken) {
      return {
        status: "NOT_CONFIGURED",
        messageAr: "رمز الإقران مفقود. يرجى إعداد رمز إقران صالح.",
        messageEn: "Pairing token is missing. Please configure a valid pairing token.",
      };
    }
    if (settings.pairingToken === "session-token-temporary-2026") {
      return {
        status: "ERROR",
        messageAr: "رمز الإقران المؤقت غير مسموح به في بيئة الإنتاج.",
        messageEn: "Temporary pairing token is prohibited in production environment.",
      };
    }
  }

  // Attempt real HTTP ping to Secure Local Bridge on 127.0.0.1
  const bridgeEndpoint = `${settings.bridgeUrl}:${settings.bridgePort}/api/status`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(bridgeEndpoint, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Origin-Check": settings.allowedOrigin,
        "Authorization": `Bearer ${settings.pairingToken}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401 || res.status === 403) {
      return {
        status: "ERROR",
        messageAr: "جسر الاتصال المحلي رفض الطلب (غير مصرح به). يرجى إعادة إقران الجهاز.",
        messageEn: "Secure Local Bridge rejected request (Unauthorized). Please re-pair device.",
      };
    }

    if (res.ok) {
      const data = await res.json();
      return {
        status: "CONNECTED",
        messageAr: `قارئ الهوية متصل وجاهز للاستخدام. الجهاز: ${data.reader || settings.selectedReader}`,
        messageEn: `Emirates ID reader is connected and online. Device: ${data.reader || settings.selectedReader}`,
        readerModel: data.reader || settings.selectedReader,
        firmwareVersion: data.version || "v2.5.4",
      };
    }

    return {
      status: "UNAVAILABLE",
      messageAr: "فشل الاتصال بجسر الهوية المحلي. الرجاء تشغيل برنامج الجسر المحلي.",
      messageEn: "Failed to communicate with Local Bridge. Please ensure the bridge is running.",
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      status: "UNAVAILABLE",
      messageAr: "جسر الخدمة المحلي غير متصل. تأكد من تشغيل Bridge Service على localhost منفذ 13984.",
      messageEn: "Secure Local Bridge not running. Ensure Bridge Service is listening on 127.0.0.1:13984.",
    };
  }
}

/**
 * Initiates card scan session
 */
export async function scanEmiratesIdCard(): Promise<{
  success: boolean;
  data?: EmiratesIdData;
  error?: string;
  errorAr?: string;
  errorCategory?: string;
}> {
  const settings = getEmiratesIdSettings();
  if (!settings.enableReader) {
    return {
      success: false,
      error: "Emirates ID reader is disabled in settings.",
      errorAr: "قارئ الهوية معطل في الإعدادات.",
      errorCategory: "PERMISSION_DENIED",
    };
  }

  if (settings.environment === "TEST") {
    return { success: false, error: "EID_SIMULATION_REMOVED: Mocking Emirates ID hardware is prohibited in production build.", errorAr: "محاكاة جهاز قارئ الهوية محظورة في بيئة الإنتاج الحقيقية." };
  }

  // Block default/temporary credentials in PRODUCTION environment
  if (settings.environment === "PRODUCTION") {
    if (!settings.pairingToken) {
      return {
        success: false,
        error: "BRIDGE_NOT_CONFIGURED: Pairing token is missing.",
        errorAr: "رمز الإقران مفقود. يرجى إعداد رمز إقران صالح.",
        errorCategory: "BRIDGE_NOT_CONFIGURED",
      };
    }
    if (settings.pairingToken === "session-token-temporary-2026") {
      return {
        success: false,
        error: "BRIDGE_UNAUTHORIZED: Temporary/default credentials are prohibited in PRODUCTION environment.",
        errorAr: "مخالفة أمنية: يمنع استخدام الرموز المؤقتة أو الافتراضية في بيئة الإنتاج الحقيقية.",
        errorCategory: "BRIDGE_UNAUTHORIZED",
      };
    }
  }

  // Real device scan via localhost bridge
  const bridgeEndpoint = `${settings.bridgeUrl}:${settings.bridgePort}/api/scan`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const res = await fetch(bridgeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Origin-Check": settings.allowedOrigin,
        "Authorization": `Bearer ${settings.pairingToken}`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        nonce: crypto.randomUUID().split("-")[0],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        error: "Bridge rejected origin or token credentials.",
        errorAr: "جسر الخدمة رفض الرمز التعريفي أو نطاق Origin للطلب.",
        errorCategory: "BRIDGE_UNAUTHORIZED",
      };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.message || "Failed to scan card from the local reader.",
        errorAr: errData.messageAr || "فشل قراءة البطاقة من القارئ المحلي المتصل.",
        errorCategory: errData.category || "CARD_READ_FAILED",
      };
    }

    const scanResult = await res.json();
    return {
      success: true,
      data: {
        ...scanResult.data,
        identitySource: "OFFICIAL_TOOLKIT",
        verificationStatus: "VERIFIED",
        captureDate: new Date().toISOString(),
        readerInformation: settings.selectedReader,
      },
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return {
        success: false,
        error: "Operation timed out. Please insert card and try again.",
        errorAr: "انتهت مهلة قراءة البطاقة. يرجى إدخال البطاقة والمحاولة مرة أخرى.",
        errorCategory: "TIMEOUT",
      };
    }
    return {
      success: false,
      error: "Could not connect to the secure local bridge. Is it running?",
      errorAr: "لا يمكن الاتصال بـ Secure Local Bridge. هل البرنامج قيد التشغيل؟",
      errorCategory: "BRIDGE_NOT_RUNNING",
    };
  }
}

import { OCRService } from "./ocr/ocrEngine";
import { OCRV2Engine } from "./ocr/v2/OCRV2Engine";

export const localOcrFallback = {
  async extract(dataUrl: string, profileKey: string, modelLevel?: string): Promise<any> {
    return { success: false, data: null };
  }
};

/**
 * Real OCR extraction from uploaded ID card image using the centralized OCR Engine V3
 */
export async function runOcrScan(file: File): Promise<{
  success: boolean;
  data?: Partial<EmiratesIdData>;
  error?: string;
  errorAr?: string;
  isTransportFailure?: boolean;
  errorType?: string;
}> {
  try {
    let dataUrl = "";
    if (typeof FileReader !== "undefined") {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else if (file && typeof file.arrayBuffer === "function") {
      const arrayBuffer = await file.arrayBuffer();
      const b64 = Buffer.from(arrayBuffer).toString("base64");
      dataUrl = `data:${file.type || "image/jpeg"};base64,${b64}`;
    } else {
      dataUrl = "data:image/jpeg;base64,";
    }

    const mimeType = file.type || "image/jpeg";
    const cleanB64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

    // Primary: Centralized OCR Engine V3
    const v3Res = await OCRService.extractDocument(cleanB64, "EMIRATES_ID", "accurate", mimeType);

    // CRITICAL REQUIREMENT (Section 2):
    // If V3 failed due to a TRANSPORT / ROUTING failure (isTransportFailure, isHtmlResponse, errorType === "TRANSPORT_FAILURE"),
    // DO NOT fall back to OCR V2, Tesseract, or any other OCR engine!
    // Immediately terminate and return structured transport failure to the UI.
    if (v3Res.isTransportFailure || (v3Res as any).isHtmlResponse || v3Res.errorType === "TRANSPORT_FAILURE") {
      return {
        success: false,
        isTransportFailure: true,
        errorType: "TRANSPORT_FAILURE",
        error: v3Res.error || "Transport failure connecting to central OCR engine.",
        errorAr: v3Res.errorAr || "تعذر الاتصال بخدمة OCR المركزية. تم إيقاف المعالجة لأن استجابة الخدمة لم تكن JSON صحيحة.",
      };
    }

    if (v3Res.success && v3Res.data && Object.keys(v3Res.data).length > 0) {
      const d = v3Res.data as any;
      return {
        success: true,
        data: {
          emiratesIdNumber: d.emiratesIdNumber || d.idNumber || d.cardNumber || "",
          fullName: d.fullName || d.englishName || d.arabicName || d.name || "",
          arabicName: d.arabicName || d.nameArabic || "",
          englishName: d.englishName || d.fullName || d.nameEnglish || "",
          dateOfBirth: d.dateOfBirth || d.dob || d.birthDate || "",
          gender: d.gender || d.sex || "",
          nationality: d.nationality || d.country || "",
          cardNumber: d.cardNumber || d.emiratesIdNumber || "",
          issueDate: d.issueDate || d.dateOfIssue || "",
          expiryDate: d.expiryDate || d.dateOfExpiry || "",
          identitySource: "OCR",
          verificationStatus: "UNVERIFIED",
          captureDate: new Date().toISOString(),
          readerInformation: v3Res.metadata?.source || "OCR Engine V3",
        },
      };
    }

    // Secondary fallback: ONLY for genuine non-transport OCR engine parsing failures
    const v2Res = await OCRV2Engine.extract(dataUrl, "EMIRATES_ID", "accurate");

    if (v2Res.success && v2Res.data) {
      const d = v2Res.data as any;
      return {
        success: true,
        data: {
          emiratesIdNumber: d.emiratesIdNumber || d.idNumber || d.cardNumber || "",
          fullName: d.fullName || d.englishName || d.arabicName || d.name || "",
          arabicName: d.arabicName || d.nameArabic || "",
          englishName: d.englishName || d.fullName || d.nameEnglish || "",
          dateOfBirth: d.dateOfBirth || d.dob || d.birthDate || "",
          gender: d.gender || d.sex || "",
          nationality: d.nationality || d.country || "",
          cardNumber: d.cardNumber || d.emiratesIdNumber || "",
          issueDate: d.issueDate || d.dateOfIssue || "",
          expiryDate: d.expiryDate || d.dateOfExpiry || "",
          identitySource: "OCR",
          verificationStatus: "UNVERIFIED",
          captureDate: new Date().toISOString(),
          readerInformation: v2Res.diagnostics?.model || "OCR V2 Engine",
        },
      };
    }

    // Tertiary fallback: Local OCR
    const localRes = await localOcrFallback.extract(dataUrl, "EMIRATES_ID", "accurate");
    if (localRes.success && localRes.data) {
      return {
        success: true,
        data: localRes.data,
      };
    }

    return {
      success: false,
      error: v3Res.error || v2Res.diagnostics?.errorMsg || "Failed to extract Emirates ID details.",
      errorAr: v3Res.errorAr || v2Res.diagnostics?.errorMsg || "تعذر استخراج بيانات الهوية آلياً من الصورة المرفقة.",
    };
  } catch (err: any) {
    return {
      success: false,
      isTransportFailure: true,
      errorType: "TRANSPORT_FAILURE",
      error: err?.message || "OCR service connection failed.",
      errorAr: "تعذر الاتصال بخدمة OCR المركزية. حدث خطأ في الاتصال بالخادم.",
    };
  }
}

/**
 * Calculates Expiry Status
 */
export function getExpiryStatus(expiryDateStr?: string, warningDays: number = 30): "VALID" | "EXPIRING_SOON" | "EXPIRED" | "UNVERIFIED" {
  if (!expiryDateStr) return "UNVERIFIED";
  const expDate = new Date(expiryDateStr);
  if (isNaN(expDate.getTime())) return "UNVERIFIED";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);

  if (expDate < today) {
    return "EXPIRED";
  }

  const warningLimit = new Date();
  warningLimit.setDate(today.getDate() + warningDays);
  warningLimit.setHours(0, 0, 0, 0);

  if (expDate <= warningLimit) {
    return "EXPIRING_SOON";
  }

  return "VALID";
}
