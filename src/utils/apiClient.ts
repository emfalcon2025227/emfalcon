import { auth } from "../lib/firebase";

/**
 * Resolves API path against optional VITE_API_BASE_URL.
 *
 * Production/combined-server mode keeps same-origin /api/* requests.
 * When the React/Vite dev server is running separately on 5173, route API
 * calls to the Express backend on the same host at port 3000 instead of
 * allowing Vite's SPA fallback to return index.html with HTTP 200.
 */
export function resolveApiUrl(endpoint: RequestInfo | URL): string {
  if (typeof endpoint !== "string") {
    return (endpoint as any)?.url || "";
  }
  if (!endpoint) return "";
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const configuredBase =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_API_BASE_URL as string)) ||
    "";

  if (configuredBase) {
    const cleanBase = configuredBase.endsWith("/")
      ? configuredBase.slice(0, -1)
      : configuredBase;
    return `${cleanBase}${cleanEndpoint}`;
  }

  // In split dev mode Vite serves the UI on 5173 while Express owns /api/*
  // on port 3000. Do not let Vite's SPA fallback answer an API request.
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port } = window.location;
    if (port === "5173") {
      return `${protocol}//${hostname}:3000${cleanEndpoint}`;
    }
  }

  // Combined server / production deployments intentionally use same-origin.
  return cleanEndpoint;
}

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
      isTransportFailure: true,
      errorType: "TRANSPORT_FAILURE",
      message: `استجاب الخادم بصيغة غير متوافقة (${formatType}, رمز الحالة: ${response.status}) للمسار: ${endpoint}.`,
      statusCode: response.status,
    } as unknown as T;

    return safeErrorResult;
  }

  try {
    return await response.json();
  } catch (parseErr: any) {
    console.warn(`[apiClient] JSON parse failure for ${endpoint}:`, parseErr);
    return {
      success: false,
      error: "INVALID_JSON",
      isTransportFailure: true,
      errorType: "TRANSPORT_FAILURE",
      message: `استجاب الخادم برمز (${response.status}) لكن استجابة البيانات غير صالحة.`,
      statusCode: response.status,
    } as unknown as T;
  }
}

/**
 * Drop-in wrapper around fetch that automatically injects Firebase ID token
 * and transparently protects response.json() from unhandled HTML parse crashes.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawEndpoint = typeof input === "string" ? input : (input as any)?.url || "API endpoint";
  const resolvedUrl = typeof input === "string" ? resolveApiUrl(input) : input;
  const token = await getAuthToken();
  
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(resolvedUrl, {
    credentials: "include",
    ...init,
    headers,
  });

  // Transparently override response.json() to prevent "Unexpected token '<'" exceptions
  const originalJson = response.json.bind(response);

  response.json = async <T = any>(): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch (_) {}

      const isHtml = contentType.includes("text/html") || bodyText.trim().startsWith("<");
      const formatType = isHtml ? "HTML" : (contentType.split(";")[0] || "non-JSON");

      console.warn(`[apiClient] Intercepted non-JSON response from ${rawEndpoint} (Resolved: ${typeof resolvedUrl === "string" ? resolvedUrl : response.url}, Status: ${response.status}, Format: ${formatType})`);

      const errorPayload = {
        success: false,
        error: isHtml ? "HTML_RESPONSE_INTERCEPTED" : "NON_JSON_RESPONSE",
        isTransportFailure: true,
        errorType: "TRANSPORT_FAILURE",
        message: `استجاب الخادم بصيغة غير متوافقة (${formatType}, رمز الحالة: ${response.status}) للمسار: ${rawEndpoint}.`,
        statusCode: response.status,
        raw: bodyText.slice(0, 150),
      } as unknown as T;

      return errorPayload;
    }

    try {
      return await originalJson();
    } catch (parseErr: any) {
      if (!response.ok) {
        return {
          success: false,
          error: "INVALID_JSON",
          isTransportFailure: true,
          errorType: "TRANSPORT_FAILURE",
          message: `استجاب الخادم برمز (${response.status}) لكن محتوى الاستجابة غير صالح: ${parseErr.message}`,
          statusCode: response.status,
        } as unknown as T;
      }
      throw new Error(`تعذر معالجة بيانات الخادم من ${rawEndpoint}: ${parseErr.message}`);
    }
  };

  return response;
}
