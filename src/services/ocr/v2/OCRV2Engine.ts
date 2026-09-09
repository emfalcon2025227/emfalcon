/**
 * OCR V2 Central Engine
 * Emirates Falcon ERP — Phase 57-H.12
 */

import { OCRProfileKey, OCRModelLevel, OCRV2Result } from "./OCRV2Types";
import { OCR_V2_PROFILES } from "./OCRV2Profiles";
import { OCRV2ImageProcessor } from "./OCRV2ImageProcessor";
import { OCRV2ModelRouter } from "./OCRV2ModelRouter";
import { OCRV2ResponseParser } from "./OCRV2ResponseParser";
import { OCRV2Normalizer } from "./OCRV2Normalizer";
import { OCRV2Validator } from "./OCRV2Validator";
import { OCRV2Confidence } from "./OCRV2Confidence";
import { OCRV2Diagnostics } from "./OCRV2Diagnostics";

export class OCRV2Engine {
  static async extract(dataUrl: string, profileKey: OCRProfileKey, modelLevel?: OCRModelLevel): Promise<OCRV2Result> {
    const diagnostics = new OCRV2Diagnostics();
    const startTime = Date.now();
    const traceId = `trace_${crypto.randomUUID().split("-")[0]}`;

    diagnostics.addCheckpoint("01", "INPUT_RECEIVED", "PASS", `Profile: ${profileKey}`);

    // 1. Validate payload
    const payloadValidation = OCRV2ImageProcessor.validatePayload(dataUrl);
    if (!payloadValidation.valid) {
      diagnostics.addCheckpoint("02", "BINARY_VALIDATED", "FAIL", payloadValidation.error);
      return {
        success: false,
        status: "FAILED",
        profile: profileKey,
        data: {},
        fields: {},
        diagnostics: {
          traceId,
          model: "none",
          attempts: 0,
          processingMs: Date.now() - startTime,
          imageVariant: "original",
          errorCode: "INVALID_PAYLOAD",
          errorMsg: payloadValidation.error,
          checkpoints: diagnostics.getCheckpoints()
        }
      };
    }
    diagnostics.addCheckpoint("02", "BINARY_VALIDATED", "PASS", `MIME: ${payloadValidation.mime}, Size: ${payloadValidation.sizeKb}KB`);

    // 2. Preprocess
    const profile = OCR_V2_PROFILES[profileKey] || OCR_V2_PROFILES.GENERAL_DOCUMENT;
    const processed = await OCRV2ImageProcessor.processImage(dataUrl, profile.preprocessingOptions);
    diagnostics.addCheckpoint("04", "IMAGE_NORMALIZED", "PASS", `Variant: ${processed.variant}`);

    // 3. Model Routing
    const modelSequence = OCRV2ModelRouter.getModelSequence(profileKey, modelLevel);
    const prompt = OCRV2ModelRouter.getPromptForProfile(profileKey);

    let rawJsonText = "";
    let usedModel = modelSequence[0];
    let attempts = 0;

    for (const model of modelSequence) {
      attempts++;
      usedModel = model;
      diagnostics.addCheckpoint("07", "MODEL_REQUEST_SENT", "PASS", `Attempt ${attempts} with model ${model}`);

      try {
        const response = await fetch("/api/ocr/v2/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType: profileKey,
            imagePayload: processed.processedDataUrl,
            mimeType: payloadValidation.mime,
            model,
            prompt
          })
        });

        let jsonRes = await response.json().catch(() => null); if (!jsonRes) continue;
        if (jsonRes.success && jsonRes.rawText) {
          rawJsonText = jsonRes.rawText;
          diagnostics.addCheckpoint("08", "MODEL_RESPONSE_RECEIVED", "PASS", `Received response from ${model}`);
          break;
        } else if (jsonRes.success && jsonRes.data) {
          rawJsonText = JSON.stringify(jsonRes.data);
          diagnostics.addCheckpoint("08", "MODEL_RESPONSE_RECEIVED", "PASS", `Received structured data from ${model}`);
          break;
        } else if (jsonRes.error) {
          if (jsonRes.error.includes("GEMINI_AUTH_UNAUTHORIZED") || jsonRes.error.includes("Gemini API")) {
             return {
               success: false,
               status: "FAILED",
               profile: profileKey,
               data: {},
               fields: {},
               diagnostics: {
                 traceId,
                 model: usedModel,
                 attempts,
                 processingMs: Date.now() - startTime,
                 imageVariant: processed.variant,
                 errorCode: "GEMINI_AUTH_UNAUTHORIZED",
                 errorMsg: "تأكد من إعداد مفتاح Gemini API صحيح في الإعدادات. المفتاح الحالي غير صالح.",
                 checkpoints: diagnostics.getCheckpoints()
               }
             };
          }
          console.warn("[OCRV2Engine] Model error:", jsonRes.error);
        }
      } catch (e: any) {
        console.warn(`[OCRV2Engine] Model ${model} network error:`, e);
      }
    }

    if (!rawJsonText) {
      diagnostics.addCheckpoint("08", "MODEL_RESPONSE_RECEIVED", "FAIL", "All model attempts failed or returned empty");
      return {
        success: false,
        status: "FAILED",
        profile: profileKey,
        data: {},
        fields: {},
        diagnostics: {
          traceId,
          model: usedModel,
          attempts,
          processingMs: Date.now() - startTime,
          imageVariant: processed.variant,
          errorCode: "OCR_API_FAILURE",
          errorMsg: "All vision model attempts failed to extract text.",
          checkpoints: diagnostics.getCheckpoints()
        }
      };
    }

    // 4. Parse response
    const parsedData = OCRV2ResponseParser.parseJson(rawJsonText, {});
    diagnostics.addCheckpoint("09", "RESPONSE_PARSED", "PASS");

    // 5. Normalize data
    const normalizedData = OCRV2Normalizer.normalizeData(profileKey, parsedData);
    diagnostics.addCheckpoint("10", "DATA_NORMALIZED", "PASS");

    // 6. Validate fields
    const fields = OCRV2Validator.validateFields(profileKey, normalizedData);
    diagnostics.addCheckpoint("11", "FIELD_VALIDATION", "PASS");

    // 7. Confidence & Status
    const confidenceEval = OCRV2Confidence.evaluate(fields);
    diagnostics.addCheckpoint("12", "CONFIDENCE_CALCULATED", "PASS", `Confidence: ${confidenceEval.overallConfidence}%`);

    const processingMs = Date.now() - startTime;
    diagnostics.addCheckpoint("15", "COMPLETE", "PASS", `Final Status: ${confidenceEval.status}`);

    const hasExtractedData = Object.keys(normalizedData).length > 0 && Object.values(normalizedData).some(v => v !== "" && v !== null);

    return {
      success: hasExtractedData && confidenceEval.status !== "FAILED",
      status: hasExtractedData ? confidenceEval.status : "FAILED",
      profile: profileKey,
      data: normalizedData,
      fields,
      diagnostics: {
        traceId,
        model: usedModel,
        attempts,
        processingMs,
        imageVariant: processed.variant,
        checkpoints: diagnostics.getCheckpoints()
      }
    };
  }
}
