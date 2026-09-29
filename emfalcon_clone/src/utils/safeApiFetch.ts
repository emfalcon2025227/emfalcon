/**
 * Emirates Falcon ERP — Phase 57-H.5 Safe API Transport Utility
 * Protects frontend from "Unexpected token '<', '<!doctype...' is not valid JSON" errors.
 * Inspects HTTP response status, headers, and body before parsing.
 */

import { getAuthToken, resolveApiUrl } from "./apiClient";

export interface SafeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorAr?: string;
  status?: number;
  isHtmlResponse?: boolean;
  isTransportFailure?: boolean;
  errorType?: "TRANSPORT_FAILURE" | "GEMINI_EXTRACTION_FAILURE" | "LOCAL_OCR_FAILURE" | "UNKNOWN";
  trace?: {
    traceId: string;
    requestedEndpoint: string;
    resolvedUrl: string;
    origin?: string;
    responseUrl?: string;
    status?: number;
    contentType?: string;
    redirected?: boolean;
    isHtml?: boolean;
  };
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeApiResponse<T>> {
  const traceId = `TRACE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const rawEndpoint = typeof input === "string" ? input : (input as any)?.url || "API endpoint";
  const resolvedUrl = typeof input === "string" ? resolveApiUrl(input) : input;
  const currentOrigin = typeof window !== "undefined" ? window.location?.origin : "server";

  try {
    // Guard against excessively large payloads which will trigger Nginx 413 or connection drops
    if (init && init.body && typeof init.body === "string" && init.body.length > 25 * 1024 * 1024) {
       console.warn(`[SafeFetch] Payload too large (${Math.round(init.body.length / 1024 / 1024)}MB). Aborting to prevent network exception.`);
       return {
         success: false,
         status: 413,
         isTransportFailure: true,
         errorType: "TRANSPORT_FAILURE",
         error: "Payload too large. Please upload a smaller or compressed image.",
         errorAr: "حجم الصورة كبير جداً. يرجى رفع صورة بحجم أصغر.",
         trace: { traceId, requestedEndpoint: rawEndpoint, resolvedUrl: String(resolvedUrl), origin: currentOrigin },
       };
    }

    const token = await getAuthToken();
    const headers = new Headers(init?.headers || {});
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(resolvedUrl, {
      credentials: "include",
      ...init,
      headers,
    });
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    const isHtmlContentType = contentType.toLowerCase().includes("text/html");
    const trimmed = rawText.trim();
    const isHtmlBody =
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<!doctype") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<head");

    const isHtml = isHtmlContentType || isHtmlBody;
    const isRedirected = response.redirected || (response.url && response.url !== String(resolvedUrl));

    const requestTrace = {
      traceId,
      requestedEndpoint: rawEndpoint,
      resolvedUrl: String(resolvedUrl),
      origin: currentOrigin,
      responseUrl: response.url || String(resolvedUrl),
      status: response.status,
      contentType,
      redirected: isRedirected,
      isHtml,
    };

    if (isHtml || (isRedirected && isHtml)) {
      console.warn(`[SafeFetch] TRANSPORT_FAILURE: Intercepted HTML/Redirect (Status: ${response.status}, Content-Type: ${contentType}) for ${rawEndpoint} [Resolved: ${resolvedUrl}]`, requestTrace);

      return {
        success: false,
        status: response.status,
        isHtmlResponse: true,
        isTransportFailure: true,
        errorType: "TRANSPORT_FAILURE",
        error: `Endpoint returned HTML (Status ${response.status}) instead of JSON payload. Requested: ${rawEndpoint}, Resolved: ${resolvedUrl}`,
        errorAr: "تعذر الاتصال بخدمة OCR المركزية. تم إيقاف المعالجة لأن استجابة الخدمة لم تكن JSON صحيحة.",
        trace: requestTrace,
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
          trace: requestTrace,
        };
      }
      return {
        success: response.ok,
        data: parsed,
        status: response.status,
        trace: requestTrace,
      };
    } catch (parseErr: any) {
      console.warn(`[SafeFetch] Non-JSON payload received from ${rawEndpoint}:`, rawText.substring(0, 100));
      return {
        success: false,
        status: response.status,
        isTransportFailure: true,
        errorType: "TRANSPORT_FAILURE",
        error: `Non-JSON response from endpoint: ${parseErr.message}`,
        errorAr: "استجابة الخادم تحتوي على صيغة بيانات غير متوافقة.",
        trace: requestTrace,
      };
    }
  } catch (networkErr: any) {
    console.error(`[SafeFetch] Network or transport exception for ${rawEndpoint}:`, networkErr);
    return {
      success: false,
      isTransportFailure: true,
      errorType: "TRANSPORT_FAILURE",
      error: networkErr.message || "Network request failed",
      errorAr: "تعذر الاتصال بالخادم أو انقطع الاتصال بالشبكة.",
      trace: {
        traceId,
        requestedEndpoint: rawEndpoint,
        resolvedUrl: String(resolvedUrl),
        origin: currentOrigin,
      },
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
