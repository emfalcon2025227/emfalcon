/**
 * Intelligent Document Auto-Cropper & Boundary Detection Engine
 * Emirates Falcon ERP — Phase 57 Forensic Hardening
 *
 * Automatically detects document boundaries (Emirates ID, Bank Cheques)
 * against flatbed scanner backgrounds or desk surfaces, crops with safety margins,
 * and orientates horizontal layout.
 */

export interface CropResult {
  dataUrl: string;
  base64: string;
  wasCropped: boolean;
  width: number;
  height: number;
  aspectRatio: number;
  rotationDegrees: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

export class DocumentAutoCropper {
  /**
   * Automatically detects and crops a document from flatbed scans or camera photos.
   * - EMIRATES_ID: Standard ID-1 aspect ratio (~1.58:1, ~85.6mm x 54mm)
   * - CHEQUE: Standard UAE Cheque aspect ratio (~2.33:1, ~175mm x 75mm)
   */
  static async autoCropDocument(
    sourceDataUrl: string,
    documentType: "EMIRATES_ID" | "CHEQUE" | "GENERAL" = "GENERAL"
  ): Promise<CropResult> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;
          const origAspect = origW / (origH || 1);

          // If image is too small or invalid, return original
          if (origW < 200 || origH < 100) {
            const clean = sourceDataUrl.includes(",") ? sourceDataUrl.split(",")[1] : sourceDataUrl;
            return resolve({
              dataUrl: sourceDataUrl,
              base64: clean,
              wasCropped: false,
              width: origW,
              height: origH,
              aspectRatio: origAspect,
              rotationDegrees: 0,
            });
          }

          // Sample canvas for fast boundary analysis
          const sampleW = Math.min(800, origW);
          const scale = sampleW / origW;
          const sampleH = Math.round(origH * scale);

          const sampleCanvas = document.createElement("canvas");
          sampleCanvas.width = sampleW;
          sampleCanvas.height = sampleH;
          const sCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
          if (!sCtx) {
            const clean = sourceDataUrl.includes(",") ? sourceDataUrl.split(",")[1] : sourceDataUrl;
            return resolve({
              dataUrl: sourceDataUrl,
              base64: clean,
              wasCropped: false,
              width: origW,
              height: origH,
              aspectRatio: origAspect,
              rotationDegrees: 0,
            });
          }

          sCtx.drawImage(img, 0, 0, sampleW, sampleH);
          const imgData = sCtx.getImageData(0, 0, sampleW, sampleH);
          const d = imgData.data;

          // Determine corner background color (average 4 corners)
          const cornerPixels = [
            0, // top-left
            (sampleW - 1) * 4, // top-right
            ((sampleH - 1) * sampleW) * 4, // bottom-left
            ((sampleH - 1) * sampleW + (sampleW - 1)) * 4, // bottom-right
          ];

          let bgR = 0, bgG = 0, bgB = 0;
          for (const cp of cornerPixels) {
            bgR += d[cp];
            bgG += d[cp + 1];
            bgB += d[cp + 2];
          }
          bgR /= 4;
          bgG /= 4;
          bgB /= 4;

          const isNearBackground = (r: number, g: number, b: number, threshold = 32) => {
            const dr = Math.abs(r - bgR);
            const dg = Math.abs(g - bgG);
            const db = Math.abs(b - bgB);
            return (dr + dg + db) / 3 < threshold;
          };

          // Horizontal & Vertical scan for foreground edges
          const rowForeground = new Uint16Array(sampleH);
          const colForeground = new Uint16Array(sampleW);

          for (let y = 0; y < sampleH; y++) {
            const rowOffset = y * sampleW * 4;
            for (let x = 0; x < sampleW; x++) {
              const idx = rowOffset + x * 4;
              if (!isNearBackground(d[idx], d[idx + 1], d[idx + 2])) {
                rowForeground[y]++;
                colForeground[x]++;
              }
            }
          }

          // Significant content threshold (at least 6% of row/col must be non-background)
          const minRowThreshold = Math.max(12, Math.round(sampleW * 0.06));
          const minColThreshold = Math.max(12, Math.round(sampleH * 0.06));

          let top = 0;
          while (top < sampleH && rowForeground[top] < minRowThreshold) top++;

          let bottom = sampleH - 1;
          while (bottom > top && rowForeground[bottom] < minRowThreshold) bottom--;

          let left = 0;
          while (left < sampleW && colForeground[left] < minColThreshold) left++;

          let right = sampleW - 1;
          while (right > left && colForeground[right] < minColThreshold) right--;

          const detectedW = Math.max(1, right - left);
          const detectedH = Math.max(1, bottom - top);
          const fillRatio = (detectedW * detectedH) / (sampleW * sampleH);

          // Convert bounds back to original full resolution coordinates
          const invScale = 1 / scale;
          let cropX = Math.round(left * invScale);
          let cropY = Math.round(top * invScale);
          let cropW = Math.round(detectedW * invScale);
          let cropH = Math.round(detectedH * invScale);

          // Add 2% safety margin to ensure no text/borders are truncated
          const padX = Math.round(cropW * 0.025);
          const padY = Math.round(cropH * 0.025);
          cropX = Math.max(0, cropX - padX);
          cropY = Math.max(0, cropY - padY);
          cropW = Math.min(origW - cropX, cropW + padX * 2);
          cropH = Math.min(origH - cropY, cropH + padY * 2);

          // Auto-orientation check: Emirates ID & Cheques are naturally horizontal (landscape)
          // If the document is oriented portrait (e.g. scanner fed vertically), rotate 90 degrees
          let shouldRotate90 = false;
          if ((documentType === "CHEQUE" || documentType === "EMIRATES_ID") && cropH > cropW) {
            shouldRotate90 = true;
          }

          // If the document already occupies > 85% of the frame, avoid unnecessary re-cropping
          // unless orientation rotation is required
          const shouldCrop = fillRatio < 0.82 && cropW > 200 && cropH > 100;

          if (!shouldCrop && !shouldRotate90) {
            const clean = sourceDataUrl.includes(",") ? sourceDataUrl.split(",")[1] : sourceDataUrl;
            return resolve({
              dataUrl: sourceDataUrl,
              base64: clean,
              wasCropped: false,
              width: origW,
              height: origH,
              aspectRatio: origAspect,
              rotationDegrees: 0,
            });
          }

          // Perform crop & optional rotation on high-res canvas
          const outW = shouldRotate90 ? cropH : cropW;
          const outH = shouldRotate90 ? cropW : cropH;

          const outCanvas = document.createElement("canvas");
          outCanvas.width = outW;
          outCanvas.height = outH;
          const outCtx = outCanvas.getContext("2d");

          if (!outCtx) {
            const clean = sourceDataUrl.includes(",") ? sourceDataUrl.split(",")[1] : sourceDataUrl;
            return resolve({
              dataUrl: sourceDataUrl,
              base64: clean,
              wasCropped: false,
              width: origW,
              height: origH,
              aspectRatio: origAspect,
              rotationDegrees: 0,
            });
          }

          outCtx.imageSmoothingEnabled = true;
          outCtx.imageSmoothingQuality = "high";

          if (shouldRotate90) {
            outCtx.translate(outW / 2, outH / 2);
            outCtx.rotate((90 * Math.PI) / 180);
            outCtx.drawImage(
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
            outCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
          }

          const outDataUrl = outCanvas.toDataURL("image/jpeg", 0.95);
          const cleanB64 = outDataUrl.split(",")[1];

          resolve({
            dataUrl: outDataUrl,
            base64: cleanB64,
            wasCropped: true,
            width: outW,
            height: outH,
            aspectRatio: outW / outH,
            rotationDegrees: shouldRotate90 ? 90 : 0,
            bounds: { x: cropX, y: cropY, width: cropW, height: cropH },
          });
        } catch (err) {
          console.warn("[DocumentAutoCropper] Auto-crop fallback to original:", err);
          const clean = sourceDataUrl.includes(",") ? sourceDataUrl.split(",")[1] : sourceDataUrl;
          resolve({
            dataUrl: sourceDataUrl,
            base64: clean,
            wasCropped: false,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            aspectRatio: (img.naturalWidth || img.width) / ((img.naturalHeight || img.height) || 1),
            rotationDegrees: 0,
          });
        }
      };

      img.onerror = () => {
        const clean = sourceDataUrl.includes(",") ? sourceDataUrl.split(",")[1] : sourceDataUrl;
        resolve({
          dataUrl: sourceDataUrl,
          base64: clean,
          wasCropped: false,
          width: 0,
          height: 0,
          aspectRatio: 1,
          rotationDegrees: 0,
        });
      };

      img.src = sourceDataUrl;
    });
  }

  /**
   * Manually rotates any document image by a multiple of 90 degrees (e.g. 90, 180, 270).
   */
  static async rotateImage(sourceDataUrl: string, degrees: number = 90): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        const rad = (degrees * Math.PI) / 180;
        const isOrthogonal = Math.abs(degrees % 180) === 90;
        const outW = isOrthogonal ? origH : origW;
        const outH = isOrthogonal ? origW : origH;

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(sourceDataUrl);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -origW / 2, -origH / 2);

        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => resolve(sourceDataUrl);
      img.src = sourceDataUrl;
    });
  }
}
