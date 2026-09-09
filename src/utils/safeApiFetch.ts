/**
 * Emirates Falcon ERP — Phase 57-H.5 Safe API Transport Utility
 * Protects frontend from "Unexpected token '<', '<!doctype...' is not valid JSON" errors.
 * Inspects HTTP response status, headers, and body before parsing.
 */

export interface SafeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorAr?: string;
  status?: number;
  isHtmlResponse?: boolean;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeApiResponse<T>> {
  try {
    // Guard against excessively large payloads which will trigger Nginx 413 or connection drops
    if (init && init.body && typeof init.body === "string" && init.body.length > 25 * 1024 * 1024) {
       console.warn(`[SafeFetch] Payload too large (${Math.round(init.body.length / 1024 / 1024)}MB). Aborting to prevent network exception.`);
       return {
         success: false,
         status: 413,
         error: "Payload too large. Please upload a smaller or compressed image.",
         errorAr: "حجم الصورة كبير جداً. يرجى رفع صورة بحجم أصغر.",
       };
    }

    const response = await fetch(input, init);
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    // Check if response is HTML or Vite fallback
    const trimmed = rawText.trim();
    if (
      contentType.includes("text/html") ||
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<!doctype") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<head")
    ) {
      console.warn(`[SafeFetch] HTML response intercepted from ${input.toString()} (Status: ${response.status})`);
      return {
        success: false,
        status: response.status,
        isHtmlResponse: true,
        error: `Endpoint returned HTML (Status ${response.status}) instead of JSON payload.`,
        errorAr: `استجابت الخدمة بصفحة ويب HTML (رمز ${response.status}) بدلاً من صيغة البيانات JSON المطلوبة. تم تحويل الطلب لمحرك المعالجة المحلي.`,
      };
    }

    // Try to parse JSON safely
    try {
      const parsed = JSON.parse(rawText);
      if (typeof parsed === "object" && parsed !== null) {
        return {
          success: parsed.success !== undefined ? Boolean(parsed.success) : response.ok,
          data: parsed.data !== undefined ? parsed.data : parsed,
          error: parsed.error,
          errorAr: parsed.errorAr,
          status: response.status,
        };
      }
      return {
        success: response.ok,
        data: parsed,
        status: response.status,
      };
    } catch (parseErr: any) {
      console.warn(`[SafeFetch] Non-JSON payload received from ${input.toString()}:`, rawText.substring(0, 100));
      return {
        success: false,
        status: response.status,
        error: `Invalid JSON response: ${parseErr.message}`,
        errorAr: "استجابة الخادم تحتوي على صيغة بيانات غير متوافقة.",
      };
    }
  } catch (networkErr: any) {
    console.error(`[SafeFetch] Network or transport exception for ${input.toString()}:`, networkErr);
    return {
      success: false,
      error: networkErr.message || "Network request failed",
      errorAr: "تعذر الاتصال بالخادم أو انقطع الاتصال بالشبكة.",
    };
  }
}

export function safeJsonParse<T = any>(jsonString: string, fallback: T = null as any): T {
  if (!jsonString || typeof jsonString !== "string") return fallback;
  try {
    let clean = jsonString.trim();
    // Handle markdown code blocks
    if (clean.startsWith("```json")) {
      clean = clean.substring(7);
    } else if (clean.startsWith("```")) {
      clean = clean.substring(3);
    }
    if (clean.endsWith("```")) {
      clean = clean.substring(0, clean.length - 3);
    }
    clean = clean.trim();
    
    // Ignore HTML pages gracefully
    if (clean.startsWith("<!DOCTYPE") || clean.startsWith("<!doctype") || clean.startsWith("<html")) {
      return fallback;
    }

    return JSON.parse(clean);
  } catch (e) {
    return fallback;
  }
}
