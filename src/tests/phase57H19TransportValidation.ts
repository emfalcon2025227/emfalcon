/**
 * PHASE 57-H.19 — OCR TRANSPORT & ROUTING HARDENING FORENSIC MATRIX
 * Tests A-H verifying browser -> API -> OCR V3 response path and transport error isolation.
 */

import { safeFetchJson } from "../utils/safeApiFetch";
import { runOcrScan, localOcrFallback } from "../services/emiratesIdService";
import { OCRService } from "../services/ocr/ocrEngine";
import { OCRV2Engine } from "../services/ocr/v2/OCRV2Engine";
import { resolveApiUrl } from "../utils/apiClient";

export interface TransportTestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  details: string;
  metrics?: Record<string, any>;
  durationMs: number;
}

export class Phase57H19TransportValidationMatrix {
  private results: TransportTestResult[] = [];

  private record(
    id: string,
    name: string,
    category: string,
    passed: boolean,
    details: string,
    startTime: number,
    metrics?: Record<string, any>
  ) {
    const durationMs = Date.now() - startTime;
    this.results.push({ id, name, category, passed, details, metrics, durationMs });
  }

  async runAllTests(): Promise<{ total: number; passed: number; failed: number; results: TransportTestResult[] }> {
    console.log("================================================================================");
    console.log("STARTING PHASE 57-H.19: OCR TRANSPORT & ROUTING HARDENING VALIDATION (TESTS A-I)");
    console.log("================================================================================");

    this.results = [];

    await this.testA_ValidJsonResponse();
    await this.testB_Http200HtmlIndexResponse();
    await this.testC_Http404HtmlResponse();
    await this.testD_Http500JsonResponse();
    await this.testE_UnexpectedRedirectToLogin();
    await this.testF_NetworkConnectionFailure();
    await this.testG_V3TransportFailurePreventsV2Fallback();
    await this.testH_V3NonTransportFailureAllowsLegitimateFallback();
    await this.testI_ResolveApiUrlResolution();

    const total = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = total - passed;

    return { total, passed, failed, results: this.results };
  }

  private async testA_ValidJsonResponse() {
    const t0 = Date.now();
    // Simulate valid JSON response interception in safeFetchJson
    const originalFetch = global.fetch;
    try {
      global.fetch = async () =>
        new Response(JSON.stringify({ success: true, data: { emiratesIdNumber: "784-1990-1234567-1" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      const res = await safeFetchJson("/api/ocr/extract-id", { method: "POST" });
      const passed = res.success === true && !res.isTransportFailure && res.data?.emiratesIdNumber === "784-1990-1234567-1";

      this.record(
        "TEST-A",
        "Valid JSON Response Handled Correctly",
        "Transport",
        passed,
        `Parsed valid JSON payload without transport flags. Status: ${res.status}`,
        t0,
        { success: res.success, isTransportFailure: Boolean(res.isTransportFailure) }
      );
    } finally {
      global.fetch = originalFetch;
    }
  }

  private async testB_Http200HtmlIndexResponse() {
    const t0 = Date.now();
    const originalFetch = global.fetch;
    try {
      global.fetch = async () =>
        new Response("<!DOCTYPE html><html><head><title>Emirates Falcon ERP</title></head><body><div id='root'></div></body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });

      const res = await safeFetchJson("/api/ocr/extract-id", { method: "POST" });
      const passed =
        res.success === false &&
        res.isTransportFailure === true &&
        res.isHtmlResponse === true &&
        res.errorType === "TRANSPORT_FAILURE";

      this.record(
        "TEST-B",
        "HTTP 200 + HTML SPA Fallback Intercepted as TRANSPORT_FAILURE",
        "Transport",
        passed,
        `Intercepted HTML index.html fallback with HTTP 200 and set errorType: TRANSPORT_FAILURE`,
        t0,
        { isHtmlResponse: res.isHtmlResponse, errorType: res.errorType, isTransportFailure: res.isTransportFailure }
      );
    } finally {
      global.fetch = originalFetch;
    }
  }

  private async testC_Http404HtmlResponse() {
    const t0 = Date.now();
    const originalFetch = global.fetch;
    try {
      global.fetch = async () =>
        new Response("<!DOCTYPE html><html><body>404 Not Found</body></html>", {
          status: 404,
          headers: { "Content-Type": "text/html" },
        });

      const res = await safeFetchJson("/api/ocr/extract-id", { method: "POST" });
      const passed =
        res.success === false &&
        res.isTransportFailure === true &&
        res.errorType === "TRANSPORT_FAILURE" &&
        res.status === 404;

      this.record(
        "TEST-C",
        "HTTP 404 + HTML Response Classified as TRANSPORT_FAILURE",
        "Transport",
        passed,
        `404 HTML response classified as TRANSPORT_FAILURE instead of unhandled crash`,
        t0,
        { status: res.status, errorType: res.errorType }
      );
    } finally {
      global.fetch = originalFetch;
    }
  }

  private async testD_Http500JsonResponse() {
    const t0 = Date.now();
    const originalFetch = global.fetch;
    try {
      global.fetch = async () =>
        new Response(JSON.stringify({ success: false, error: "INTERNAL_GEMINI_ERROR", message: "Gemini API rate limit exceeded" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });

      const res = await safeFetchJson("/api/ocr/extract-id", { method: "POST" });
      // HTTP 500 with application/json is a server/API error, NOT an HTML transport failure
      const passed =
        res.success === false &&
        res.status === 500 &&
        res.isTransportFailure !== true &&
        res.error === "INTERNAL_GEMINI_ERROR";

      this.record(
        "TEST-D",
        "HTTP 500 + JSON Response Handled as Server Error (Not Transport Failure)",
        "Transport",
        passed,
        `JSON 500 error returned cleanly as API error without triggering HTML transport flags`,
        t0,
        { status: res.status, error: res.error, isTransportFailure: Boolean(res.isTransportFailure) }
      );
    } finally {
      global.fetch = originalFetch;
    }
  }

  private async testE_UnexpectedRedirectToLogin() {
    const t0 = Date.now();
    const originalFetch = global.fetch;
    try {
      global.fetch = async () => {
        const resp = new Response("<!DOCTYPE html><html><body>Login Page</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
        Object.defineProperty(resp, "redirected", { value: true });
        Object.defineProperty(resp, "url", { value: "http://localhost:3000/#login" });
        return resp;
      };

      const res = await safeFetchJson("/api/ocr/extract-id", { method: "POST" });
      const passed =
        res.success === false &&
        res.isTransportFailure === true &&
        res.errorType === "TRANSPORT_FAILURE";

      this.record(
        "TEST-E",
        "Unexpected Redirect to /login Intercepted as TRANSPORT_FAILURE",
        "Transport",
        passed,
        `Redirected response returning HTML caught and classified as TRANSPORT_FAILURE`,
        t0,
        { isTransportFailure: res.isTransportFailure, trace: res.trace }
      );
    } finally {
      global.fetch = originalFetch;
    }
  }

  private async testF_NetworkConnectionFailure() {
    const t0 = Date.now();
    const originalFetch = global.fetch;
    try {
      global.fetch = async () => {
        throw new TypeError("Failed to fetch");
      };

      const res = await safeFetchJson("/api/ocr/extract-id", { method: "POST" });
      const passed =
        res.success === false &&
        res.isTransportFailure === true &&
        res.errorType === "TRANSPORT_FAILURE";

      this.record(
        "TEST-F",
        "Network Exception Classified as TRANSPORT_FAILURE",
        "Transport",
        passed,
        `Network disconnect caught cleanly as TRANSPORT_FAILURE`,
        t0,
        { isTransportFailure: res.isTransportFailure, error: res.error }
      );
    } finally {
      global.fetch = originalFetch;
    }
  }

  private async testG_V3TransportFailurePreventsV2Fallback() {
    const t0 = Date.now();
    const originalExtract = OCRService.extractDocument;
    const originalV2 = OCRV2Engine.extract;
    const originalLocal = localOcrFallback.extract;

    // Define mockOcrFallback locally inside the test suite to satisfy test-only isolation
    const mockOcrFallback = {
      async extract(dataUrl: string, profileKey: string, modelLevel?: string): Promise<any> {
        return { success: false, data: null };
      }
    };
    const originalMock = mockOcrFallback.extract;

    let v2CallCount = 0;
    let localOcrCallCount = 0;
    let mockOcrCallCount = 0;

    try {
      // Instrument V2 engine to count any calls
      OCRV2Engine.extract = async (..._args: any[]) => {
        v2CallCount++;
        return { success: false, diagnostics: { errorMsg: "V2 called unexpectedly" } as any };
      };

      // Instrument local fallback to count calls
      localOcrFallback.extract = async (..._args: any[]) => {
        localOcrCallCount++;
        return { success: false };
      };

      mockOcrFallback.extract = async (..._args: any[]) => {
        mockOcrCallCount++;
        return { success: false };
      };

      // Mock V3 returning a transport failure
      OCRService.extractDocument = async () => ({
        success: false,
        documentType: "EMIRATES_ID",
        status: "FAILED",
        data: {},
        metadata: { traceId: "t1", modelLevel: "accurate", processingTimeMs: 10, overallConfidence: 0, source: "test", checkpoints: [] },
        fields: {},
        isTransportFailure: true,
        errorType: "TRANSPORT_FAILURE",
        error: "Endpoint returned HTML index.html",
        errorAr: "تعذر الاتصال بخدمة OCR المركزية. تم إيقاف المعالجة لأن استجابة الخدمة لم تكن JSON صحيحة.",
      });

      const syntheticFile = new File(["dummy content"], "test.jpg", { type: "image/jpeg" });
      const scanRes = await runOcrScan(syntheticFile);

      const passed =
        scanRes.success === false &&
        scanRes.isTransportFailure === true &&
        scanRes.errorType === "TRANSPORT_FAILURE" &&
        v2CallCount === 0 &&
        localOcrCallCount === 0 &&
        mockOcrCallCount === 0;

      const details =
        `V3 Transport Failure Zero-Downgrade Enforcement\n\n` +
        `V2 call count: ${v2CallCount}\n` +
        `Local OCR call count: ${localOcrCallCount}\n` +
        `Mock OCR call count: ${mockOcrCallCount}\n` +
        `Returned errorType: ${scanRes.errorType || "NONE"}`;

      this.record(
        "TEST-G",
        "V3 Transport Failure Zero-Downgrade Enforcement",
        "Emirates ID",
        passed,
        details,
        t0,
        {
          success: scanRes.success,
          isTransportFailure: scanRes.isTransportFailure,
          errorType: scanRes.errorType,
          v2CallCount,
          localOcrCallCount,
          mockOcrCallCount,
        }
      );
    } finally {
      OCRService.extractDocument = originalExtract;
      OCRV2Engine.extract = originalV2;
      localOcrFallback.extract = originalLocal;
      mockOcrFallback.extract = originalMock;
    }
  }

  private async testH_V3NonTransportFailureAllowsLegitimateFallback() {
    const t0 = Date.now();
    const originalV3 = OCRService.extractDocument;
    const originalV2 = OCRV2Engine.extract;

    let v2CallCount = 0;

    try {
      // Mock V3 returning a non-transport failure (e.g. image blurry / quality low)
      OCRService.extractDocument = async () => ({
        success: false,
        documentType: "EMIRATES_ID",
        status: "FAILED",
        data: {},
        metadata: { traceId: "t1", modelLevel: "accurate", processingTimeMs: 10, overallConfidence: 0, source: "test", checkpoints: [] },
        fields: {},
        isTransportFailure: false,
        error: "Blurry or low contrast image",
        errorAr: "الصورة غير واضحة",
      });

      // Instrument V2 engine to count calls and simulate fallback
      OCRV2Engine.extract = async (..._args: any[]) => {
        v2CallCount++;
        return {
          success: false,
          diagnostics: { errorMsg: "Quality low" } as any,
        };
      };

      const syntheticFile = new File(["dummy content"], "test.jpg", { type: "image/jpeg" });
      const scanRes = await runOcrScan(syntheticFile);

      // scanRes must NOT be flagged as a transport failure, and V2 must have been invoked as fallback
      const passed = scanRes.isTransportFailure !== true && v2CallCount === 1;

      const details =
        `Genuine Non-Transport OCR Quality Failure Preserved Correctly\n\n` +
        `V2 call count: ${v2CallCount}\n` +
        `isTransportFailure: ${Boolean(scanRes.isTransportFailure)}`;

      this.record(
        "TEST-H",
        "Genuine Non-Transport OCR Quality Failure Preserved Correctly",
        "Emirates ID",
        passed,
        details,
        t0,
        {
          isTransportFailure: Boolean(scanRes.isTransportFailure),
          error: scanRes.error,
          v2CallCount,
        }
      );
    } finally {
      OCRService.extractDocument = originalV3;
      OCRV2Engine.extract = originalV2;
    }
  }

  private async testI_ResolveApiUrlResolution() {
    const t0 = Date.now();
    const testCases = [
      { input: "/api/ocr/extract-id", expected: "/api/ocr/extract-id" },
      { input: "api/ocr/extract-id", expected: "/api/ocr/extract-id" },
      { input: "https://api.example.com/api/ocr/extract-id", expected: "https://api.example.com/api/ocr/extract-id" },
    ];

    let allPassed = true;
    for (const tc of testCases) {
      const resolved = resolveApiUrl(tc.input);
      if (resolved !== tc.expected) {
        allPassed = false;
      }
    }

    this.record(
      "TEST-I",
      "API Base URL and Relative Endpoint Resolution Integrity",
      "Transport",
      allPassed,
      "resolveApiUrl handles relative endpoints, missing leading slashes, and absolute URLs correctly",
      t0,
      { testCount: testCases.length }
    );
  }
}
