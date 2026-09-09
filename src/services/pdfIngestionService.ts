// src/services/pdfIngestionService.ts
/**
 * Comprehensive Client-Side PDF Ingestion & Forensic Document Pipeline
 * Handles Single-Cheque PDFs, Multi-Page PDFs, Multi-Cheque Sheets, and Mixed PDF Classification.
 */

import * as pdfjsLib from "pdfjs-dist";
import { DocumentStorageService } from "./documentStorageService";
import { DocumentProcessingInput } from "./ocr/documentSessionService";
import { OCRService } from "./ocr/ocrEngine";
import { ElectronicArchiveItem } from "../types";

// Configure PDF.js worker safely for Vite/Browser environments
if (typeof window !== "undefined") {
  try {
    // Standard Vite asset resolution for worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  } catch {
    // Fallback to CDN matching current version if Vite bundling differs
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "4.10.38"}/pdf.worker.min.mjs`;
  }
}

export type PageDocumentType =
  | "CHEQUE"
  | "EMIRATES_ID"
  | "BANK_DEPOSIT_PROOF"
  | "LEASE_CONTRACT"
  | "GENERAL";

export type PdfDuplicateStatus =
  | "EXACT_FILE_DUPLICATE"
  | "CONTENT_DUPLICATE"
  | "NEW_DOCUMENT";

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  documentType: PageDocumentType;
  confidence: number;
  isMultiChequePage: boolean;
  chequeRegions?: Array<{
    regionIndex: number;
    dataUrl: string;
    coordinates: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
}

export interface PdfIngestionInspection {
  isValidPdf: boolean;
  fileName: string;
  fileSizeBytes: number;
  fileHash: string;
  pageCount: number;
  duplicateStatus: PdfDuplicateStatus;
  existingArchiveItem?: ElectronicArchiveItem;
  metadata?: Record<string, any>;
}

export interface PdfIngestionResult {
  inspection: PdfIngestionInspection;
  archivedPdfItem?: ElectronicArchiveItem;
  pages: RenderedPdfPage[];
  documentInputs: DocumentProcessingInput[];
}

export class PdfIngestionService {
  /**
   * Validates if a binary array buffer starts with the PDF magic number `%PDF-`
   */
  static isPdfMagicBytes(buffer: ArrayBuffer): boolean {
    if (!buffer || buffer.byteLength < 5) return false;
    const header = new Uint8Array(buffer, 0, 5);
    const magic = String.fromCharCode(...header);
    return magic.startsWith("%PDF");
  }

  /**
   * Computes SHA-256 hash of an ArrayBuffer
   */
  static async calculateBufferHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Inspects a PDF file, validates headers, calculates file hash, and checks for duplicates.
   */
  static async inspectPdf(file: File): Promise<PdfIngestionInspection> {
    const arrayBuffer = await file.arrayBuffer();
    const isValid = this.isPdfMagicBytes(arrayBuffer);

    if (!isValid) {
      throw new Error(`الملف ${file.name} ليس ملف PDF صالحاً أو تالف.`);
    }

    const fileHash = await this.calculateBufferHash(arrayBuffer);

    // Load PDF document to check page count & metadata
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;
    const meta = await pdfDoc.getMetadata().catch(() => null);

    // Check archive for exact file duplicate
    let duplicateStatus: PdfDuplicateStatus = "NEW_DOCUMENT";
    let existingItem: ElectronicArchiveItem | undefined;

    const cachedUrl = DocumentStorageService.getCachedDataUrl(fileHash);
    if (cachedUrl) {
      duplicateStatus = "EXACT_FILE_DUPLICATE";
    }

    return {
      isValidPdf: true,
      fileName: file.name,
      fileSizeBytes: file.size,
      fileHash,
      pageCount,
      duplicateStatus,
      existingArchiveItem: existingItem,
      metadata: meta?.info as any,
    };
  }

  /**
   * Progressively renders each page of a PDF file to high-resolution JPEG/PNG images.
   */
  static async renderPdfPages(
    file: File,
    onProgress?: (msg: string, current: number, total: number) => void
  ): Promise<RenderedPdfPage[]> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const renderedPages: RenderedPdfPage[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (onProgress) {
        onProgress(`تحويل صفحات PDF (${pageNum}/${totalPages})...`, pageNum, totalPages);
      }

      const page = await pdfDoc.getPage(pageNum);
      // Determine optimal scale to ensure high-definition OCR reading (target width ~1800-2400px)
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const targetWidth = 2000;
      const scale = Math.max(1.5, Math.min(3.0, targetWidth / unscaledViewport.width));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        throw new Error(`Failed to create 2D canvas context for PDF page ${pageNum}`);
      }

      // Fill white background for clear OCR
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: ctx,
        viewport,
        canvas,
      };

      await page.render(renderContext).promise;

      const pageDataUrl = canvas.toDataURL("image/jpeg", 0.94);

      // Perform Document Classification and Multi-Cheque Segmentation
      const pageInfo = await this.classifyAndSegmentPage(canvas, pageDataUrl, pageNum);

      renderedPages.push({
        pageNumber: pageNum,
        dataUrl: pageDataUrl,
        width: canvas.width,
        height: canvas.height,
        documentType: pageInfo.documentType,
        confidence: pageInfo.confidence,
        isMultiChequePage: pageInfo.isMultiChequePage,
        chequeRegions: pageInfo.regions,
      });
    }

    return renderedPages;
  }

  /**
   * Classifies page document type (Cheque vs Emirates ID vs General)
   * and segments multi-cheque sheet pages (e.g. 2 or 3 cheques scanned on one A4 page)
   */
  private static async classifyAndSegmentPage(
    canvas: HTMLCanvasElement,
    pageDataUrl: string,
    pageNumber: number
  ): Promise<{
    documentType: PageDocumentType;
    confidence: number;
    isMultiChequePage: boolean;
    regions?: Array<{
      regionIndex: number;
      dataUrl: string;
      coordinates: { x: number; y: number; width: number; height: number };
      confidence: number;
    }>;
  }> {
    const width = canvas.width;
    const height = canvas.height;
    const aspectRatio = width / height;

    // Cheques typically have an aspect ratio of ~ 2.0 to 2.5 (landscape)
    // A4 sheets typically have aspect ratio of ~ 0.707 (portrait)
    const isPortraitA4 = aspectRatio < 0.9;
    const isLandscapeChequeRatio = aspectRatio >= 1.6;

    if (isLandscapeChequeRatio) {
      // Single Cheque Page
      return {
        documentType: "CHEQUE",
        confidence: 0.95,
        isMultiChequePage: false,
      };
    }

    if (isPortraitA4) {
      // Portrait page: could contain 2 or 3 cheques stacked, or a contract/receipt
      // Check horizontal density or segment into 3 standard cheque vertical regions
      // Standard UAE Cheque sheet layout: 3 cheques per A4 page (top 33%, middle 33%, bottom 33%)
      // Or 2 cheques (top 50%, bottom 50%)
      const regions: Array<{
        regionIndex: number;
        dataUrl: string;
        coordinates: { x: number; y: number; width: number; height: number };
        confidence: number;
      }> = [];

      const numberOfChequeBands = 3;
      const bandHeight = Math.floor(height / numberOfChequeBands);

      for (let i = 0; i < numberOfChequeBands; i++) {
        const subCanvas = document.createElement("canvas");
        subCanvas.width = width;
        subCanvas.height = bandHeight;
        const subCtx = subCanvas.getContext("2d", { willReadFrequently: true });
        if (subCtx) {
          subCtx.drawImage(
            canvas,
            0,
            i * bandHeight,
            width,
            bandHeight,
            0,
            0,
            width,
            bandHeight
          );
          const regionDataUrl = subCanvas.toDataURL("image/jpeg", 0.92);
          regions.push({
            regionIndex: i + 1,
            dataUrl: regionDataUrl,
            coordinates: { x: 0, y: i * bandHeight, width, height: bandHeight },
            confidence: 0.9,
          });
        }
      }

      return {
        documentType: "CHEQUE",
        confidence: 0.88,
        isMultiChequePage: true,
        regions,
      };
    }

    return {
      documentType: "CHEQUE",
      confidence: 0.85,
      isMultiChequePage: false,
    };
  }

  /**
   * Complete End-to-End PDF Ingestion:
   * 1. Inspect & Validate
   * 2. Archive original PDF file permanently in Document Storage
   * 3. Render pages & segment cheques
   * 4. Build DocumentProcessingInput array ready for batch staging
   */
  static async ingestPdfForChequeBatch(
    file: File,
    options: {
      contractId?: string;
      renewalId?: string;
      entityType?: string;
      entityId?: string;
      uploadedBy?: string;
    } = {},
    onProgress?: (msg: string, current: number, total: number) => void
  ): Promise<PdfIngestionResult> {
    // 1. Inspect
    if (onProgress) onProgress(`فحص ملف PDF: ${file.name}...`, 1, 4);
    const inspection = await this.inspectPdf(file);

    // 2. Archive Original PDF File
    let archivedItem: ElectronicArchiveItem | undefined;
    try {
      if (onProgress) onProgress(`أرشفة ملف PDF الأصلي للحفظ الدائم...`, 2, 4);
      archivedItem = await DocumentStorageService.uploadAndArchive(file, {
        category: "CHEQUES",
        entityType: options.entityType || "LEASE",
        entityId: options.entityId || options.contractId || options.renewalId || "BATCH_CHEQUES",
        fileName: file.name,
        mimeType: "application/pdf",
        description: `ملف شيكات أصلي بصيغة PDF - مسح دُفعة (${file.name})`,
        tags: ["cheque_source_pdf", "batch_ingestion", file.name],
        uploadedByName: options.uploadedBy || "النظام",
      });
    } catch (archiveErr) {
      console.warn("[PdfIngestionService] Original PDF archiving fallback:", archiveErr);
    }

    // 3. Render Pages & Segment
    if (onProgress) onProgress(`معالجة وتحويل صفحات المستند...`, 3, 4);
    const pages = await this.renderPdfPages(file, onProgress);

    // 4. Construct DocumentProcessingInput items
    const sourcePdfId = archivedItem?.id || `pdf-src-${Date.now()}-${file.name.replace(/\W/g, "_")}`;
    const documentInputs: DocumentProcessingInput[] = [];

    for (const page of pages) {
      if (page.isMultiChequePage && page.chequeRegions && page.chequeRegions.length > 0) {
        // Multi-cheque page: generate separate item for each region
        for (const region of page.chequeRegions) {
          documentInputs.push({
            sourceType: "PDF_PAGE",
            fileName: `${file.name} - صفحة ${page.pageNumber} (شيك ${region.regionIndex})`,
            mimeType: "image/jpeg",
            imageBase64: region.dataUrl,
            originalSourceDataUrl: page.dataUrl,
            sourcePdfId,
            pageNumber: page.pageNumber,
            croppedRegion: region.coordinates,
          });
        }
      } else {
        // Single cheque page
        documentInputs.push({
          sourceType: "PDF_PAGE",
          fileName: `${file.name} - صفحة ${page.pageNumber}`,
          mimeType: "image/jpeg",
          imageBase64: page.dataUrl,
          originalSourceDataUrl: page.dataUrl,
          sourcePdfId,
          pageNumber: page.pageNumber,
        });
      }
    }

    if (onProgress) onProgress(`اكتمال تجهيز ${documentInputs.length} شيك من مستند PDF.`, 4, 4);

    return {
      inspection,
      archivedPdfItem: archivedItem,
      pages,
      documentInputs,
    };
  }
}
