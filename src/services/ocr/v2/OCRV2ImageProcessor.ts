/**
 * OCR V2 Image Processor & Adaptive Preprocessing
 * Emirates Falcon ERP — Phase 57-H.12
 */

import { ImageVariant, OCRV2PreprocessOptions } from "./OCRV2Types";

export class OCRV2ImageProcessor {
  /**
   * Generates a deterministic hash for duplicate detection and in-flight locks.
   */
  static generateHash(dataUrlOrBuffer: string): string {
    let hash = 0;
    const str = dataUrlOrBuffer.substring(0, 1000); // sample start for speed
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `img_v2_${Math.abs(hash)}_${str.length}`;
  }

  /**
   * Validates binary payload integrity.
   */
  static validatePayload(dataUrl: string): { valid: boolean; mime: string; sizeKb: number; error?: string } {
    if (!dataUrl || typeof dataUrl !== "string") {
      return { valid: false, mime: "", sizeKb: 0, error: "Empty or invalid data payload" };
    }

    let mime = "image/jpeg";
    let base64Data = dataUrl.trim();

    if (base64Data.includes(",")) {
      const parts = base64Data.split(",");
      base64Data = parts[parts.length - 1].replace(/[\r\n\s]/g, "");
      const mimeMatch = parts[0].match(/data:([^;]+);base64/);
      if (mimeMatch) {
        mime = mimeMatch[1];
      }
    } else {
      base64Data = base64Data.replace(/[\r\n\s]/g, "");
    }

    if (!base64Data || base64Data.length < 50) {
      return { valid: false, mime, sizeKb: 0, error: "Base64 payload too small to be valid image" };
    }

    const sizeKb = Math.round((base64Data.length * 0.75) / 1024);
    return { valid: true, mime, sizeKb };
  }

  /**
   * Adaptive preprocessing pipeline simulating canvas transforms and variant selection.
   */
  static async processImage(dataUrl: string, options: OCRV2PreprocessOptions): Promise<{ processedDataUrl: string; variant: ImageVariant }> {
    const validation = this.validatePayload(dataUrl);
    if (!validation.valid) {
      throw new Error(`Image payload validation failed: ${validation.error}`);
    }

    const variant = options.variant || "enhanced";
    
    // In browser or SSR environment, return normalized/variant data or canvas transformed output
    if (typeof window === "undefined" || !window.document) {
      return { processedDataUrl: dataUrl, variant };
    }

    try {
      return await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          const minWidth = options.minWidth || 1200;
          if (width < minWidth) {
            const scale = minWidth / width;
            width = minWidth;
            height = Math.round(height * scale);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ processedDataUrl: dataUrl, variant });
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Apply adaptive enhancements based on variant
          if (variant === "high_contrast" || variant === "enhanced") {
            try {
              const imgData = ctx.getImageData(0, 0, width, height);
              const data = imgData.data;
              const contrast = 1.25; // 25% contrast boost
              const intercept = 128 * (1 - contrast);
              for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, data[i] * contrast + intercept));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * contrast + intercept));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * contrast + intercept));
              }
              ctx.putImageData(imgData, 0, 0);
            } catch (e) {
              // Ignore CORS or taint exceptions
            }
          }

          const mime = validation.mime === "image/png" ? "image/png" : "image/jpeg";
          const quality = mime === "image/jpeg" ? 0.92 : undefined;
          const processedDataUrl = canvas.toDataURL(mime, quality);
          resolve({ processedDataUrl, variant });
        };
        img.onerror = () => {
          resolve({ processedDataUrl: dataUrl, variant });
        };
        img.src = dataUrl;
      });
    } catch (e) {
      return { processedDataUrl: dataUrl, variant };
    }
  }
}
