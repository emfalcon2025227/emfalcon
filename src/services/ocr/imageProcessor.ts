// src/services/ocr/imageProcessor.ts

export interface OcrPreprocessOptions {
  applyContrast?: boolean;
  applyNormalization?: boolean;
  applySharpening?: boolean;
  convertToGrayscale?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  variant?: "standard" | "high_contrast" | "sharpened" | "low_light";
}

export interface ImageQualityMetrics {
  isAcceptable: boolean;
  score: number; // 0.0 to 1.0
  brightness: number; // 0 to 255
  contrast: number; // std deviation of luminance
  aspectRatio: number;
  width: number;
  height: number;
  issues: string[];
}

export class ImageProcessor {
  /**
   * Generates a fast, reliable hash of the base64 string for deduplication & caching.
   */
  static generateImageHash(base64Image: string): string {
    const clean = base64Image.replace(/^data:image\/[a-z]+;base64,/, "").replace(/[\r\n\s]/g, "");
    // Use sampling DJB2-based hash on head, middle, and tail + length for O(1) performance
    const len = clean.length;
    let hash = 5381;
    const step = Math.max(1, Math.floor(len / 1000));
    for (let i = 0; i < len; i += step) {
      hash = ((hash << 5) + hash) + clean.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return `img_${Math.abs(hash).toString(36)}_${len}`;
  }

  /**
   * Evaluates image quality for OCR readiness without modifying the image.
   */
  static async assessQuality(base64Image: string, documentType: string = "GENERAL"): Promise<ImageQualityMetrics> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve({
            isAcceptable: true,
            score: 0.85,
            brightness: 128,
            contrast: 50,
            aspectRatio: width / (height || 1),
            width,
            height,
            issues: [],
          });
        }

        // Downscale sample for fast histogram analysis
        const sampleWidth = 400;
        const sampleHeight = Math.max(100, Math.round(400 * (height / (width || 1))));
        canvas.width = sampleWidth;
        canvas.height = sampleHeight;
        ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);

        const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
        const d = imgData.data;

        let totalBrightness = 0;
        const pixelCount = d.length / 4;
        const luminanceArr: number[] = new Array(pixelCount);

        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          totalBrightness += lum;
          luminanceArr[i / 4] = lum;
        }

        const avgBrightness = totalBrightness / pixelCount;

        // Contrast calculation (Standard Deviation of luminance)
        let sumSquaredDiff = 0;
        for (let i = 0; i < pixelCount; i++) {
          sumSquaredDiff += Math.pow(luminanceArr[i] - avgBrightness, 2);
        }
        const contrast = Math.sqrt(sumSquaredDiff / pixelCount);

        const aspectRatio = width / (height || 1);
        const issues: string[] = [];

        if (avgBrightness < 35) issues.push("TOO_DARK");
        if (avgBrightness > 245) issues.push("TOO_BRIGHT");
        if (contrast < 20) issues.push("LOW_CONTRAST");

        if (documentType === "CHEQUE" && aspectRatio < 1.3) {
          issues.push("SUBOPTIMAL_CHEQUE_ASPECT_RATIO");
        } else if (documentType === "EMIRATES_ID" && aspectRatio < 0.9) {
          issues.push("SUBOPTIMAL_ID_ASPECT_RATIO");
        }

        if (width < 300 || height < 150) {
          issues.push("CRITICAL_LOW_RESOLUTION");
        } else if (width < 800) {
          issues.push("SUBOPTIMAL_RESOLUTION_WARNING");
        }

        const isAcceptable = width >= 200 && height >= 100;
        let score = 0.95;
        if (issues.includes("SUBOPTIMAL_RESOLUTION_WARNING")) score -= 0.1;
        if (issues.includes("LOW_CONTRAST")) score -= 0.1;
        if (issues.includes("TOO_DARK") || issues.includes("TOO_BRIGHT")) score -= 0.15;
        if (!isAcceptable) score = 0.2;

        resolve({
          isAcceptable,
          score: Math.max(0.3, Math.min(1.0, score)),
          brightness: Math.round(avgBrightness),
          contrast: Math.round(contrast),
          aspectRatio,
          width,
          height,
          issues,
        });
      };

      img.onerror = () => {
        resolve({
          isAcceptable: false,
          score: 0,
          brightness: 0,
          contrast: 0,
          aspectRatio: 1,
          width: 0,
          height: 0,
          issues: ["IMAGE_DECODE_FAILED"],
        });
      };

      img.src = base64Image.startsWith("data:") ? base64Image : `data:image/jpeg;base64,${base64Image}`;
    });
  }

  /**
   * Main entry point to preprocess an image for OCR.
   * Can apply grayscale, normalization, adaptive contrast, and sharpening.
   */
  static async process(base64Image: string, options: OcrPreprocessOptions = {}): Promise<string> {
    const defaultOptions: OcrPreprocessOptions = {
      applyContrast: true,
      applyNormalization: true,
      applySharpening: true,
      convertToGrayscale: true,
      maxWidth: 2400,
      maxHeight: 2400,
      minWidth: 1200,
      ...options,
    };

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Upscale if too small for high-precision OCR
          if (defaultOptions.minWidth && width < defaultOptions.minWidth && width > 0) {
            const scale = defaultOptions.minWidth / width;
            width = defaultOptions.minWidth;
            height = Math.round(height * scale);
          }

          // Resize if exceeding max limits
          if (defaultOptions.maxWidth && width > defaultOptions.maxWidth) {
            height = Math.round((height * defaultOptions.maxWidth) / width);
            width = defaultOptions.maxWidth;
          }
          if (defaultOptions.maxHeight && height > defaultOptions.maxHeight) {
            width = Math.round((width * defaultOptions.maxHeight) / height);
            height = defaultOptions.maxHeight;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Could not get 2d context for image processing");

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Draw initial image
          ctx.drawImage(img, 0, 0, width, height);

          // If no filters are needed, return the resized image immediately
          if (!defaultOptions.convertToGrayscale && !defaultOptions.applyNormalization && !defaultOptions.applyContrast && !defaultOptions.applySharpening) {
             resolve(canvas.toDataURL("image/jpeg", 0.95));
             return;
          }
          
          let imageData = ctx.getImageData(0, 0, width, height);

          if (defaultOptions.convertToGrayscale) {
            imageData = this.grayscale(imageData);
          }
          if (defaultOptions.applyNormalization) {
            imageData = this.normalize(imageData);
          }
          if (defaultOptions.applyContrast) {
            imageData = this.adaptiveContrast(imageData);
          }
          if (defaultOptions.applySharpening) {
            imageData = this.sharpen(imageData, width, height);
          }

          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.95));
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error("Failed to load image for preprocessing"));
      
      // Handle both pure base64 and data URLs
      img.src = base64Image.startsWith("data:") ? base64Image : `data:image/jpeg;base64,${base64Image}`;
    });
  }

  private static grayscale(imageData: ImageData): ImageData {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Standard luminance formula
      const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = avg;       // R
      data[i + 1] = avg;   // G
      data[i + 2] = avg;   // B
    }
    return imageData;
  }

  private static normalize(imageData: ImageData): ImageData {
    const data = imageData.data;
    let min = 255;
    let max = 0;

    // Find min and max luminance
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i]; // Grayscale assumption
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const range = max - min;
    if (range === 0) return imageData;

    // Stretch to 0-255
    for (let i = 0; i < data.length; i += 4) {
      const v = ((data[i] - min) / range) * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    return imageData;
  }

  private static adaptiveContrast(imageData: ImageData): ImageData {
    const data = imageData.data;
    const contrast = 45; // Moderate adaptive contrast
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) { // RGB
        data[i + j] = Math.min(255, Math.max(0, factor * (data[i + j] - 128) + 128));
      }
    }
    return imageData;
  }

  private static sharpen(imageData: ImageData, width: number, height: number): ImageData {
    // 3x3 Convolution matrix for high-clarity sharpening
    const weights = [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0
    ];
    
    const side = 3;
    const halfSide = 1;
    const src = imageData.data;
    const sw = width;
    const sh = height;
    
    // Create new array for destination
    const dst = new Uint8ClampedArray(src.length);
    
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = y + cy - halfSide;
            const scx = x + cx - halfSide;
            
            // Edge handling (clamp)
            const cY = Math.min(Math.max(scy, 0), sh - 1);
            const cX = Math.min(Math.max(scx, 0), sw - 1);
            
            const srcOff = (cY * sw + cX) * 4;
            const wt = weights[cy * side + cx];
            
            r += src[srcOff] * wt;
            g += src[srcOff + 1] * wt;
            b += src[srcOff + 2] * wt;
          }
        }
        
        dst[dstOff] = Math.min(255, Math.max(0, r));
        dst[dstOff + 1] = Math.min(255, Math.max(0, g));
        dst[dstOff + 2] = Math.min(255, Math.max(0, b));
        dst[dstOff + 3] = src[dstOff + 3]; // preserve alpha
      }
    }
    
    return new ImageData(dst, sw, sh);
  }
}

