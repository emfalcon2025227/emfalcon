import {
  DocumentOptimizationProfile,
  DocumentOptimizationResult,
  DocumentMetadata,
  OriginalFileRetentionPolicy,
  DocumentCategory,
} from "../types";

export interface ProfileConfig {
  maxDimension: number;
  quality: number;
  preferredMimeType: "image/jpeg" | "image/webp" | "image/png" | "original";
  minSizeThresholdBytes: number; // Don't compress below this threshold (e.g. 200KB)
  enforceHighClarity: boolean;
}

export const OPTIMIZATION_PROFILES: Record<DocumentOptimizationProfile, ProfileConfig> = {
  CHEQUE: {
    maxDimension: 2400,
    quality: 0.92,
    preferredMimeType: "image/jpeg",
    minSizeThresholdBytes: 300 * 1024,
    enforceHighClarity: true,
  },
  LEGAL_DOCUMENT: {
    maxDimension: 2600,
    quality: 0.95,
    preferredMimeType: "image/jpeg",
    minSizeThresholdBytes: 400 * 1024,
    enforceHighClarity: true,
  },
  MAINTENANCE_INVOICE: {
    maxDimension: 2048,
    quality: 0.90,
    preferredMimeType: "image/jpeg",
    minSizeThresholdBytes: 250 * 1024,
    enforceHighClarity: true,
  },
  RECEIPT: {
    maxDimension: 2048,
    quality: 0.90,
    preferredMimeType: "image/jpeg",
    minSizeThresholdBytes: 200 * 1024,
    enforceHighClarity: true,
  },
  PHOTO: {
    maxDimension: 1920,
    quality: 0.80,
    preferredMimeType: "image/jpeg",
    minSizeThresholdBytes: 250 * 1024,
    enforceHighClarity: false,
  },
  HIGH_QUALITY: {
    maxDimension: 2400,
    quality: 0.92,
    preferredMimeType: "image/jpeg",
    minSizeThresholdBytes: 300 * 1024,
    enforceHighClarity: true,
  },
  STANDARD: {
    maxDimension: 2048,
    quality: 0.85,
    preferredMimeType: "image/jpeg",
    minSizeThresholdBytes: 250 * 1024,
    enforceHighClarity: false,
  },
};

/**
 * Calculates Emirates Falcon Standard Google Drive Folder Path
 */
export function getStandardDrivePath(
  category: DocumentCategory | string,
  entityType?: string,
  entityId?: string,
  referenceNumber?: string
): string {
  const root = "Emirates Falcon";
  const ref = referenceNumber || entityId || "GENERAL";

  switch (category) {
    case "LEASES":
    case "CONTRACT":
      return `${root}/Contracts/${ref}/`;
    case "PAYMENTS":
      return `${root}/Payments/${ref}/`;
    case "MAINTENANCE":
      return `${root}/Maintenance/${ref}/`;
    case "CHEQUES":
      return `${root}/Cheques/`;
    case "CASES":
    case "COURT_CASES":
      return `${root}/Court Cases/${ref}/`;
    case "ARCHIVE":
    default:
      return `${root}/Archive/${entityType || "General"}/${entityId || "Misc"}/`;
  }
}

/**
 * Optimizes an Image or PDF document using browser client-side pipeline
 */
export async function optimizeDocument(
  file: File,
  profileName: DocumentOptimizationProfile = "STANDARD",
  retentionPolicy: OriginalFileRetentionPolicy = "OPTIMIZED_ONLY"
): Promise<DocumentOptimizationResult> {
  const documentId = `doc-opt-${Date.now()}-${Date.now() % 10000}`;
  const originalFileName = file.name;
  const originalMimeType = file.type || "application/octet-stream";
  const originalSizeBytes = file.size;
  const profile = OPTIMIZATION_PROFILES[profileName] || OPTIMIZATION_PROFILES.STANDARD;

  // 1. Read original file data URL
  const originalDataUrl = await readFileAsDataUrl(file);

  // 2. Handling PDF files
  if (originalMimeType === "application/pdf" || (originalFileName || "").toLowerCase().endsWith(".pdf")) {
    // For PDFs: preserve searchable text, vector elements, signatures, page counts
    // Browser client-side safe pass-through with metadata verification
    return {
      documentId,
      originalFileName,
      originalMimeType: "application/pdf",
      originalSizeBytes,
      optimizedFileName: originalFileName,
      optimizedMimeType: "application/pdf",
      optimizedSizeBytes: originalSizeBytes,
      compressionApplied: false,
      compressionMethod: "PDF_VECTOR_PRESERVATION",
      compressionQuality: 1.0,
      sizeSavedBytes: 0,
      sizeSavedPercentage: 0,
      isOriginalKept: true,
      dataUrl: originalDataUrl,
      originalDataUrl: retentionPolicy === "KEEP_ORIGINAL" ? originalDataUrl : undefined,
    };
  }

  // 3. Handling Image files
  const isImage = originalMimeType.startsWith("image/") || /\.(jpg|jpeg|png|webp|bmp)$/i.test(originalFileName);

  if (!isImage) {
    // Non-image, non-pdf generic document -> pass through safely
    return {
      documentId,
      originalFileName,
      originalMimeType,
      originalSizeBytes,
      optimizedFileName: originalFileName,
      optimizedMimeType: originalMimeType,
      optimizedSizeBytes: originalSizeBytes,
      compressionApplied: false,
      compressionMethod: "PASSTHROUGH_INTEGRITY",
      compressionQuality: 1.0,
      sizeSavedBytes: 0,
      sizeSavedPercentage: 0,
      isOriginalKept: true,
      dataUrl: originalDataUrl,
      originalDataUrl: retentionPolicy === "KEEP_ORIGINAL" ? originalDataUrl : undefined,
    };
  }

  // Check if image is already small -> avoid unnecessary recompression
  if (originalSizeBytes <= profile.minSizeThresholdBytes) {
    return {
      documentId,
      originalFileName,
      originalMimeType,
      originalSizeBytes,
      optimizedFileName: originalFileName,
      optimizedMimeType: originalMimeType,
      optimizedSizeBytes: originalSizeBytes,
      compressionApplied: false,
      compressionMethod: "PRESERVED_BELOW_THRESHOLD",
      compressionQuality: 1.0,
      sizeSavedBytes: 0,
      sizeSavedPercentage: 0,
      isOriginalKept: true,
      dataUrl: originalDataUrl,
      originalDataUrl: retentionPolicy === "KEEP_ORIGINAL" ? originalDataUrl : undefined,
    };
  }

  // 4. Perform adaptive image compression via HTML Canvas
  try {
    const img = await loadImageElement(originalDataUrl);
    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    // Calculate dimensions within profile constraints
    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (origWidth > profile.maxDimension || origHeight > profile.maxDimension) {
      if (origWidth >= origHeight) {
        targetWidth = profile.maxDimension;
        targetHeight = Math.round((origHeight / origWidth) * profile.maxDimension);
      } else {
        targetHeight = profile.maxDimension;
        targetWidth = Math.round((origWidth / origHeight) * profile.maxDimension);
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not initialize canvas 2D rendering context");
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Target mime type (PNG if source is transparent PNG and high clarity needed, else JPEG/WebP)
    const targetMime = originalMimeType === "image/png" && profile.enforceHighClarity
      ? "image/png"
      : "image/jpeg";

    const optimizedDataUrl = canvas.toDataURL(targetMime, profile.quality);
    const optimizedSizeBytes = estimateDataUrlSizeBytes(optimizedDataUrl);

    // 5. Quality Control & Verification
    // If optimized size is greater than or equal to original, or compression failed -> Fall back to original
    if (optimizedSizeBytes >= originalSizeBytes) {
      return {
        documentId,
        originalFileName,
        originalMimeType,
        originalSizeBytes,
        optimizedFileName: originalFileName,
        optimizedMimeType: originalMimeType,
        optimizedSizeBytes: originalSizeBytes,
        compressionApplied: false,
        compressionMethod: "FALLBACK_ORIGINAL_SMALLER",
        compressionQuality: 1.0,
        sizeSavedBytes: 0,
        sizeSavedPercentage: 0,
        isOriginalKept: true,
        dataUrl: originalDataUrl,
        originalDataUrl: retentionPolicy === "KEEP_ORIGINAL" ? originalDataUrl : undefined,
        imageDimensions: { width: origWidth, height: origHeight },
      };
    }

    const sizeSavedBytes = originalSizeBytes - optimizedSizeBytes;
    const sizeSavedPercentage = Math.round((sizeSavedBytes / originalSizeBytes) * 100);

    const ext = targetMime === "image/png" ? ".png" : ".jpg";
    const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    const optimizedFileName = `${baseName}_opt${ext}`;

    return {
      documentId,
      originalFileName,
      originalMimeType,
      originalSizeBytes,
      optimizedFileName,
      optimizedMimeType: targetMime,
      optimizedSizeBytes,
      compressionApplied: true,
      compressionMethod: `ADAPTIVE_CANVAS_${targetMime.toUpperCase().replace("IMAGE/", "")}`,
      compressionQuality: profile.quality,
      sizeSavedBytes,
      sizeSavedPercentage,
      isOriginalKept: retentionPolicy === "KEEP_ORIGINAL",
      dataUrl: optimizedDataUrl,
      originalDataUrl: retentionPolicy === "KEEP_ORIGINAL" ? originalDataUrl : undefined,
      imageDimensions: { width: targetWidth, height: targetHeight },
    };
  } catch (err: any) {
    // If any error occurs, safely fall back to original file
    return {
      documentId,
      originalFileName,
      originalMimeType,
      originalSizeBytes,
      optimizedFileName: originalFileName,
      optimizedMimeType: originalMimeType,
      optimizedSizeBytes: originalSizeBytes,
      compressionApplied: false,
      compressionMethod: "FALLBACK_ON_ERROR",
      compressionQuality: 1.0,
      sizeSavedBytes: 0,
      sizeSavedPercentage: 0,
      isOriginalKept: true,
      dataUrl: originalDataUrl,
      error: err?.message || "Optimization error, fallback to original",
    };
  }
}

// Helpers
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

function estimateDataUrlSizeBytes(dataUrl: string): number {
  const base64Index = dataUrl.indexOf(";base64,");
  if (base64Index === -1) return dataUrl.length;
  const base64Str = dataUrl.substring(base64Index + 8);
  return Math.round((base64Str.length * 3) / 4);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
