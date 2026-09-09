/**
 * OCR V2 Response Parser & Sanitizer
 * Emirates Falcon ERP — Phase 57-H.12
 */

export class OCRV2ResponseParser {
  static parseJson<T = Record<string, any>>(rawResponse: string, fallback: T): T {
    if (!rawResponse || typeof rawResponse !== "string") {
      return fallback;
    }

    try {
      let clean = rawResponse.trim();
      
      // Remove markdown code fences
      if (clean.startsWith("```json")) {
        clean = clean.substring(7);
      } else if (clean.startsWith("```")) {
        clean = clean.substring(3);
      }
      if (clean.endsWith("```")) {
        clean = clean.substring(0, clean.length - 3);
      }
      clean = clean.trim();

      // Guard against HTML gateway error responses (502, 504, 404)
      if (clean.startsWith("<!DOCTYPE") || clean.startsWith("<!doctype") || clean.startsWith("<html")) {
        console.error("[OCRV2ResponseParser] Received HTML error page instead of JSON");
        return fallback;
      }

      // Find first { and last }
      const firstBrace = clean.indexOf("{");
      const lastBrace = clean.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }

      return JSON.parse(clean);
    } catch (e) {
      console.error("[OCRV2ResponseParser] JSON parse error:", e);
      return fallback;
    }
  }
}
