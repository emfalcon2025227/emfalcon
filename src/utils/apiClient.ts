import { auth } from "../lib/firebase";

/**
 * Helper to retrieve current user's Firebase Auth ID token
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return await currentUser.getIdToken();
    }
  } catch (err) {
    console.warn("[apiClient] Failed to retrieve Firebase ID token:", err);
  }
  return null;
}

/**
 * Returns default headers with Authorization Bearer token attached if available
 */
export async function getAuthHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Safe JSON parser helper to inspect response status and Content-Type before parsing.
 * Prevents: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON.
 */
export async function safeParseJsonResponse<T = any>(
  response: Response,
  endpointHint?: string
): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const endpoint = endpointHint || response.url || "API endpoint";

  // Check if content-type is HTML or plain text
  if (!contentType.includes("application/json")) {
    let preview = "";
    try {
      const text = await response.text();
      preview = text.trim().slice(0, 150);
    } catch (_) {}

    const isHtml = contentType.includes("text/html") || preview.startsWith("<");
    const formatType = isHtml ? "HTML" : (contentType.split(";")[0] || "non-JSON");

    console.warn(`[apiClient] Intercepted non-JSON response from ${endpoint} (Status: ${response.status}, Format: ${formatType})`);

    const safeErrorResult = {
      success: false,
      error: isHtml ? "HTML_RESPONSE_INTERCEPTED" : "NON_JSON_RESPONSE",
      message: `استجاب الخادم بصيغة غير متوافقة (${formatType}, رمز الحالة: ${response.status}) للمسار: ${endpoint}.`,
      statusCode: response.status,
    } as unknown as T;

    if (!response.ok) {
      return safeErrorResult;
    }

    throw new Error(`استجاب الخادم بصفحة ويب (${formatType}) بدلاً من صيغة البيانات JSON المطلوبة (رمز الحالة: ${response.status}).`);
  }

  try {
    return await response.json();
  } catch (parseErr: any) {
    console.warn(`[apiClient] JSON parse failure for ${endpoint}:`, parseErr);
    if (!response.ok) {
      return {
        success: false,
        error: "INVALID_JSON",
        message: `استجاب الخادم برمز خطأ (${response.status}) لكن استجابة البيانات غير صالحة.`,
        statusCode: response.status,
      } as unknown as T;
    }
    throw new Error(`تعذر معالجة بيانات الخادم من ${endpoint}: ${parseErr.message}`);
  }
}

/**
 * Drop-in wrapper around fetch that automatically injects Firebase ID token
 * and transparently protects response.json() from unhandled HTML parse crashes.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers,
  });

  // Transparently override response.json() to prevent "Unexpected token '<'" exceptions
  const originalJson = response.json.bind(response);
  const endpoint = typeof input === "string" ? input : (input as any)?.url || response.url || "API endpoint";

  response.json = async <T = any>(): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch (_) {}

      const isHtml = contentType.includes("text/html") || bodyText.trim().startsWith("<");
      const formatType = isHtml ? "HTML" : (contentType.split(";")[0] || "non-JSON");

      console.warn(`[apiClient] Intercepted non-JSON response from ${endpoint} (Status: ${response.status}, Format: ${formatType})`);

      const errorPayload = {
        success: false,
        error: isHtml ? "HTML_RESPONSE_INTERCEPTED" : "NON_JSON_RESPONSE",
        message: `استجاب الخادم بصيغة غير متوافقة (${formatType}, رمز الحالة: ${response.status}) للمسار: ${endpoint}.`,
        statusCode: response.status,
        raw: bodyText.slice(0, 150),
      } as unknown as T;

      if (!response.ok) {
        return errorPayload;
      }

      throw new Error(`استجاب الخادم بصفحة ويب (${formatType}) بدلاً من صيغة البيانات JSON المطلوبة (رمز الحالة: ${response.status}) من ${endpoint}.`);
    }

    try {
      return await originalJson();
    } catch (parseErr: any) {
      if (!response.ok) {
        return {
          success: false,
          error: "INVALID_JSON",
          message: `استجاب الخادم برمز (${response.status}) لكن محتوى الاستجابة غير صالح: ${parseErr.message}`,
          statusCode: response.status,
        } as unknown as T;
      }
      throw new Error(`تعذر معالجة بيانات الخادم من ${endpoint}: ${parseErr.message}`);
    }
  };

  return response;
}

