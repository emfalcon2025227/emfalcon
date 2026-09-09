// src/services/ocr/multiChequeSegmenter.ts
/**
 * Multi-Cheque Flatbed Segmentation Service
 * Detects 1 to 4 cheques placed simultaneously on a flatbed scanner glass or single image.
 * Performs edge analysis, contour bounding box clustering, auto-orientation, and high-resolution cropping.
 */

export interface ChequeRegion {
  id: string;
  index: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  relativeBounds: {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
  confidence: number;
  rotationDegrees: number;
  croppedDataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface MultiChequeSegmentationResult {
  success: boolean;
  totalDetected: number;
  originalWidth: number;
  originalHeight: number;
  originalSourceDataUrl: string;
  cheques: ChequeRegion[];
  segmentationMethod: "CONTOUR_ANALYSIS" | "PROJECTION_CLUSTERING" | "ADAPTIVE_GRID" | "SINGLE_FALLBACK";
  notes: string;
}

export class MultiChequeSegmenter {
  /**
   * Main entry point to detect and segment multiple cheques from a flatbed image.
   */
  static async segmentMultiChequeImage(
    sourceDataUrl: string,
    options: {
      minChequesExpected?: number;
      maxChequesExpected?: number;
      paddingPercent?: number;
    } = {}
  ): Promise<MultiChequeSegmentationResult> {
    const minExpected = options.minChequesExpected || 1;
    const maxExpected = options.maxChequesExpected || 4;
    const padding = options.paddingPercent !== undefined ? options.paddingPercent : 0.02;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = async () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        if (!origW || !origH) {
          return resolve({
            success: false,
            totalDetected: 0,
            originalWidth: 0,
            originalHeight: 0,
            originalSourceDataUrl: sourceDataUrl,
            cheques: [],
            segmentationMethod: "SINGLE_FALLBACK",
            notes: "Invalid image dimensions",
          });
        }

        try {
          // 1. High-Resolution Source Canvas
          const srcCanvas = document.createElement("canvas");
          srcCanvas.width = origW;
          srcCanvas.height = origH;
          const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
          if (!srcCtx) throw new Error("Canvas context creation failed");
          srcCtx.drawImage(img, 0, 0);

          // 2. Fast Downsampled Analysis Canvas
          const analysisW = 800;
          const scale = analysisW / origW;
          const analysisH = Math.round(origH * scale);

          const analysisCanvas = document.createElement("canvas");
          analysisCanvas.width = analysisW;
          analysisCanvas.height = analysisH;
          const aCtx = analysisCanvas.getContext("2d", { willReadFrequently: true });
          if (!aCtx) throw new Error("Analysis canvas creation failed");
          aCtx.drawImage(img, 0, 0, analysisW, analysisH);

          const imgData = aCtx.getImageData(0, 0, analysisW, analysisH);
          const data = imgData.data;

          // 3. Convert to Grayscale & Calculate Background Threshold
          const gray = new Uint8Array(analysisW * analysisH);
          let sumLuma = 0;
          for (let i = 0; i < data.length; i += 4) {
            const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            gray[i / 4] = luma;
            sumLuma += luma;
          }
          const avgLuma = sumLuma / gray.length;

          // 4. Horizontal Projection & Content Band Detection
          // Compute content density per horizontal row
          const rowVariances = new Float32Array(analysisH);
          const rowMeans = new Float32Array(analysisH);

          for (let y = 0; y < analysisH; y++) {
            let rowSum = 0;
            const yOffset = y * analysisW;
            for (let x = 0; x < analysisW; x++) {
              rowSum += gray[yOffset + x];
            }
            const rMean = rowSum / analysisW;
            rowMeans[y] = rMean;

            let diffSum = 0;
            for (let x = 0; x < analysisW; x++) {
              diffSum += Math.abs(gray[yOffset + x] - rMean);
            }
            rowVariances[y] = diffSum / analysisW;
          }

          // Detect active vertical bands (sections with significant detail/ink/borders)
          const isRowActive = new Uint8Array(analysisH);
          const varianceThreshold = 8.0; // threshold for non-uniform content
          for (let y = 0; y < analysisH; y++) {
            // Also check deviation from pure scanner lid (pure white > 240 or pure black < 20)
            const isScannerLid = (rowMeans[y] > 248 && rowVariances[y] < 6) || (rowMeans[y] < 15 && rowVariances[y] < 6);
            isRowActive[y] = !isScannerLid && rowVariances[y] > varianceThreshold ? 1 : 0;
          }

          // Group contiguous active rows into candidate bands
          interface CandidateBand {
            startY: number;
            endY: number;
            height: number;
          }
          const rawBands: CandidateBand[] = [];
          let inBand = false;
          let currentStart = 0;

          for (let y = 0; y < analysisH; y++) {
            if (isRowActive[y] && !inBand) {
              inBand = true;
              currentStart = y;
            } else if (!isRowActive[y] && inBand) {
              // Allow small gaps (e.g. 5 pixels)
              let isGap = true;
              for (let lookahead = y; lookahead < Math.min(analysisH, y + 8); lookahead++) {
                if (isRowActive[lookahead]) {
                  isGap = false;
                  break;
                }
              }
              if (isGap) {
                inBand = false;
                const bandH = y - currentStart;
                if (bandH > analysisH * 0.08) {
                  rawBands.push({ startY: currentStart, endY: y, height: bandH });
                }
              }
            }
          }
          if (inBand) {
            const bandH = analysisH - currentStart;
            if (bandH > analysisH * 0.08) {
              rawBands.push({ startY: currentStart, endY: analysisH, height: bandH });
            }
          }

          // 5. For each band, find horizontal boundaries (startX, endX)
          interface CandidateBox {
            x: number;
            y: number;
            w: number;
            h: number;
            confidence: number;
          }
          const candidateBoxes: CandidateBox[] = [];

          for (const band of rawBands) {
            // Compute column activity within this vertical band
            const colActivity = new Float32Array(analysisW);
            for (let x = 0; x < analysisW; x++) {
              let colSum = 0;
              for (let y = band.startY; y < band.endY; y++) {
                colSum += gray[y * analysisW + x];
              }
              const cMean = colSum / band.height;
              let diff = 0;
              for (let y = band.startY; y < band.endY; y++) {
                diff += Math.abs(gray[y * analysisW + x] - cMean);
              }
              colActivity[x] = diff / band.height;
            }

            let startX = 0;
            let endX = analysisW;
            // Trim leading blank margin
            for (let x = 0; x < analysisW; x++) {
              if (colActivity[x] > 6.0) {
                startX = Math.max(0, x - 5);
                break;
              }
            }
            // Trim trailing blank margin
            for (let x = analysisW - 1; x >= 0; x--) {
              if (colActivity[x] > 6.0) {
                endX = Math.min(analysisW, x + 5);
                break;
              }
            }

            const boxW = endX - startX;
            if (boxW > analysisW * 0.25) {
              candidateBoxes.push({
                x: startX,
                y: band.startY,
                w: boxW,
                h: band.height,
                confidence: 0.9,
              });
            }
          }

          // 6. Heuristic Fallback: If 0 or 1 band found on an A4 page, but aspect ratio suggests 2-3 cheques
          let method: MultiChequeSegmentationResult["segmentationMethod"] = "PROJECTION_CLUSTERING";
          let finalBoxes: CandidateBox[] = candidateBoxes;

          if (finalBoxes.length === 0) {
            // Adaptive Grid 3-Cheque Standard Layout on A4 Flatbed
            method = "ADAPTIVE_GRID";
            const chequeHeightRatio = 0.28;
            const gapRatio = 0.04;
            const startOffset = 0.04;

            for (let i = 0; i < 3; i++) {
              const y = Math.round(analysisH * (startOffset + i * (chequeHeightRatio + gapRatio)));
              const h = Math.round(analysisH * chequeHeightRatio);
              if (y + h <= analysisH) {
                finalBoxes.push({
                  x: Math.round(analysisW * 0.05),
                  y,
                  w: Math.round(analysisW * 0.90),
                  h,
                  confidence: 0.75,
                });
              }
            }
          } else if (finalBoxes.length === 1 && finalBoxes[0].h > analysisH * 0.7) {
            // A single massive box was found (user placed cheques without large gaps) -> Split vertically if tall
            const massive = finalBoxes[0];
            const chequeAspect = massive.w / (massive.h / 3);
            if (chequeAspect >= 1.6 && chequeAspect <= 3.2) {
              // Clearly 3 cheques stacked together!
              method = "ADAPTIVE_GRID";
              const splitCount = 3;
              const unitH = Math.round(massive.h / splitCount);
              finalBoxes = [];
              for (let i = 0; i < splitCount; i++) {
                finalBoxes.push({
                  x: massive.x,
                  y: massive.y + i * unitH,
                  w: massive.w,
                  h: unitH,
                  confidence: 0.82,
                });
              }
            } else if (massive.w / (massive.h / 2) >= 1.6) {
              // 2 cheques stacked
              method = "ADAPTIVE_GRID";
              const splitCount = 2;
              const unitH = Math.round(massive.h / splitCount);
              finalBoxes = [];
              for (let i = 0; i < splitCount; i++) {
                finalBoxes.push({
                  x: massive.x,
                  y: massive.y + i * unitH,
                  w: massive.w,
                  h: unitH,
                  confidence: 0.85,
                });
              }
            }
          }

          // Sort final boxes from top to bottom
          finalBoxes.sort((a, b) => a.y - b.y);

          // 7. Crop High-Resolution Regions & Normalize Orientation
          const resultCheques: ChequeRegion[] = [];

          for (let i = 0; i < finalBoxes.length; i++) {
            const box = finalBoxes[i];
            // Scale back to original dimensions
            const origBoxX = Math.round(box.x / scale);
            const origBoxY = Math.round(box.y / scale);
            const origBoxW = Math.round(box.w / scale);
            const origBoxH = Math.round(box.h / scale);

            // Add margin padding safely
            const padPxX = Math.round(origBoxW * padding);
            const padPxY = Math.round(origBoxH * padding);

            const cropX = Math.max(0, origBoxX - padPxX);
            const cropY = Math.max(0, origBoxY - padPxY);
            const cropW = Math.min(origW - cropX, origBoxW + padPxX * 2);
            const cropH = Math.min(origH - cropY, origBoxH + padPxY * 2);

            // Orientation Check: Standard UAE Cheque is landscape (width > height, ratio ~ 2.0 to 2.4)
            // If fed or scanned vertically (cropH > cropW), rotate 90 degrees
            const shouldRotate90 = cropH > cropW;
            const targetW = shouldRotate90 ? cropH : cropW;
            const targetH = shouldRotate90 ? cropW : cropH;

            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = targetW;
            cropCanvas.height = targetH;
            const cropCtx = cropCanvas.getContext("2d");

            if (cropCtx) {
              cropCtx.imageSmoothingEnabled = true;
              cropCtx.imageSmoothingQuality = "high";

              if (shouldRotate90) {
                cropCtx.translate(targetW / 2, targetH / 2);
                cropCtx.rotate((90 * Math.PI) / 180);
                cropCtx.drawImage(
                  img,
                  cropX,
                  cropY,
                  cropW,
                  cropH,
                  -cropW / 2,
                  -cropH / 2,
                  cropW,
                  cropH
                );
              } else {
                cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
              }

              const croppedDataUrl = cropCanvas.toDataURL("image/jpeg", 0.95);
              const chequeId = `chq_seg_${Date.now()}_${i + 1}`;

              resultCheques.push({
                id: chequeId,
                index: i + 1,
                bounds: {
                  x: cropX,
                  y: cropY,
                  width: cropW,
                  height: cropH,
                },
                relativeBounds: {
                  xPercent: Math.round((cropX / origW) * 1000) / 10,
                  yPercent: Math.round((cropY / origH) * 1000) / 10,
                  widthPercent: Math.round((cropW / origW) * 1000) / 10,
                  heightPercent: Math.round((cropH / origH) * 1000) / 10,
                },
                confidence: box.confidence,
                rotationDegrees: shouldRotate90 ? 90 : 0,
                croppedDataUrl,
                width: targetW,
                height: targetH,
                aspectRatio: Math.round((targetW / targetH) * 100) / 100,
              });
            }
          }

          resolve({
            success: resultCheques.length > 0,
            totalDetected: resultCheques.length,
            originalWidth: origW,
            originalHeight: origH,
            originalSourceDataUrl: sourceDataUrl,
            cheques: resultCheques,
            segmentationMethod: method,
            notes: `تم اكتشاف واقتصاص ${resultCheques.length} شيكات بنجاح من مسح السطح الزجاجي`,
          });
        } catch (err: any) {
          console.error("[MultiChequeSegmenter] Segmentation error:", err);
          // Fallback to single image
          resolve({
            success: true,
            totalDetected: 1,
            originalWidth: origW,
            originalHeight: origH,
            originalSourceDataUrl: sourceDataUrl,
            cheques: [
              {
                id: `chq_seg_fallback_${Date.now()}`,
                index: 1,
                bounds: { x: 0, y: 0, width: origW, height: origH },
                relativeBounds: { xPercent: 0, yPercent: 0, widthPercent: 100, heightPercent: 100 },
                confidence: 0.6,
                rotationDegrees: 0,
                croppedDataUrl: sourceDataUrl,
                width: origW,
                height: origH,
                aspectRatio: Math.round((origW / (origH || 1)) * 100) / 100,
              },
            ],
            segmentationMethod: "SINGLE_FALLBACK",
            notes: "تم استخدام المسح كاملاً كشيك واحد بعد تعذر التجزئة التلقائية",
          });
        }
      };

      img.onerror = () => {
        resolve({
          success: false,
          totalDetected: 0,
          originalWidth: 0,
          originalHeight: 0,
          originalSourceDataUrl: sourceDataUrl,
          cheques: [],
          segmentationMethod: "SINGLE_FALLBACK",
          notes: "Failed to decode source image",
        });
      };

      img.src = sourceDataUrl;
    });
  }

  /**
   * Recrop a specific customized rectangular region from the original source image.
   */
  static async recropCustomRegion(
    originalSourceDataUrl: string,
    bounds: { x: number; y: number; width: number; height: number },
    rotationDegrees: number = 0
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        const x = Math.max(0, Math.min(origW - 10, bounds.x));
        const y = Math.max(0, Math.min(origH - 10, bounds.y));
        const w = Math.max(50, Math.min(origW - x, bounds.width));
        const h = Math.max(30, Math.min(origH - y, bounds.height));

        const isRotatedOrthogonal = Math.abs(rotationDegrees % 180) === 90;
        const outW = isRotatedOrthogonal ? h : w;
        const outH = isRotatedOrthogonal ? w : h;

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(originalSourceDataUrl);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        if (rotationDegrees !== 0) {
          ctx.translate(outW / 2, outH / 2);
          ctx.rotate((rotationDegrees * Math.PI) / 180);
          ctx.drawImage(img, x, y, w, h, -w / 2, -h / 2, w, h);
        } else {
          ctx.drawImage(img, x, y, w, h, 0, 0, outW, outH);
        }

        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => reject(new Error("Failed to load source image for custom recrop"));
      img.src = originalSourceDataUrl;
    });
  }
}
