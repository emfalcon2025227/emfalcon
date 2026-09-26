import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

export interface PdfExportOptions {
  fileName?: string;
  title?: string;
  orientation?: "p" | "l";
  scale?: number;
  marginMm?: number;
}

let _cachedCanvasCtx: CanvasRenderingContext2D | null = null;
function getHelperCanvasCtx(): CanvasRenderingContext2D | null {
  if (!_cachedCanvasCtx && typeof document !== "undefined") {
    try {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      _cachedCanvasCtx = c.getContext("2d", { willReadFrequently: true });
    } catch {
      _cachedCanvasCtx = null;
    }
  }
  return _cachedCanvasCtx;
}

/**
 * Converts an OKLCH CSS color function string into a standard rgb(...) or rgba(...) string
 * so any canvas rasterizer can parse it without throwing unsupported color function errors.
 * Handles space-separated and comma-separated formats, as well as the '/' alpha separator.
 */
export function oklchToRgbString(oklchStr: string): string {
  if (!oklchStr) return "rgb(0, 0, 0)";

  // First try the browser's native canvas context parsing
  try {
    const ctx = getHelperCanvasCtx();
    if (ctx) {
      ctx.fillStyle = "rgb(0, 0, 0)";
      ctx.fillStyle = oklchStr;
      if (ctx.fillStyle && !ctx.fillStyle.includes("oklch") && !ctx.fillStyle.includes("oklab")) {
        return ctx.fillStyle;
      }
    }
  } catch {
    // Continue to mathematical parser
  }

  try {
    const cleanStr = oklchStr.trim().toLowerCase();
    const match = /oklch\(\s*([^/)]+?)(?:\s*\/\s*([^)]+?))?\)/i.exec(cleanStr);
    if (!match) return "rgb(0, 0, 0)";

    const [, paramsStr, alphaStr] = match;
    const parts = paramsStr.trim().split(/[\s,]+/).filter(p => p.length > 0);
    if (parts.length < 3) return "rgb(0, 0, 0)";

    let p0 = parts[0] === "none" ? "0" : parts[0];
    let p1 = parts[1] === "none" ? "0" : parts[1];
    let p2 = parts[2] === "none" ? "0" : parts[2];

    let l = parseFloat(p0);
    if (p0.endsWith("%")) l /= 100;

    let c = parseFloat(p1);
    if (p1.endsWith("%")) {
      c = (parseFloat(p1) / 100) * 0.4;
    }

    let h = parseFloat(p2);
    if (p2.endsWith("deg")) h = parseFloat(p2);
    else if (p2.endsWith("rad")) h = (parseFloat(p2) * 180) / Math.PI;
    else if (p2.endsWith("turn")) h = parseFloat(p2) * 360;

    let a = 1;
    if (alphaStr) {
      const cleanAlpha = alphaStr.trim() === "none" ? "1" : alphaStr.trim();
      a = parseFloat(cleanAlpha);
      if (cleanAlpha.endsWith("%")) a /= 100;
    }

    if (isNaN(l)) l = 0;
    if (isNaN(c)) c = 0;
    if (isNaN(h)) h = 0;
    if (isNaN(a)) a = 1;

    l = Math.max(0, Math.min(1, l));
    c = Math.max(0, c);

    const hRad = (h * Math.PI) / 180;
    const aLab = c * Math.cos(hRad);
    const bLab = c * Math.sin(hRad);

    const l_ = Math.pow(l + 0.3963377774 * aLab + 0.2158037573 * bLab, 3);
    const m_ = Math.pow(l - 0.1055613458 * aLab - 0.0638541728 * bLab, 3);
    const s_ = Math.pow(l - 0.0894841775 * aLab - 1.2914855480 * bLab, 3);

    const rLin = +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
    const gLin = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
    const bLin = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;

    const toSrgb = (val: number) => {
      val = Math.max(0, Math.min(1, val));
      return val <= 0.0031308
        ? Math.round(val * 12.92 * 255)
        : Math.round((1.055 * Math.pow(val, 1 / 2.4) - 0.055) * 255);
    };

    const r = toSrgb(rLin);
    const g = toSrgb(gLin);
    const b = toSrgb(bLin);

    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch (err) {
    console.warn("[pdfExportUtils] Color conversion failed for:", oklchStr, err);
    return "rgb(128, 128, 128)";
  }
}

/**
 * Replaces all occurrences of oklch(...), oklab(...), and color-mix(...) in a CSS string with parsed rgb/rgba strings.
 */
export function replaceOklchInCssText(cssText: string): string {
  if (!cssText) return cssText;
  let cleanCss = cssText;
  
  const oklchRegex = /oklch\s*\((?:[^)(]+|\([^)(]*\))*\)/gi;
  const oklabRegex = /oklab\s*\((?:[^)(]+|\([^)(]*\))*\)/gi;
  const colorMixRegex = /color-mix\s*\((?:[^)(]+|\([^)(]*\))*\)/gi;

  if (cleanCss.includes("oklch")) {
    cleanCss = cleanCss.replace(oklchRegex, (fullMatch) => {
      return oklchToRgbString(fullMatch);
    });
  }
  
  if (cleanCss.includes("oklch")) {
    cleanCss = cleanCss.replace(/oklch[^(]*\([^)]*\)/gi, "rgb(128, 128, 128)");
  }

  if (cleanCss.includes("oklab")) {
    cleanCss = cleanCss.replace(oklabRegex, "rgb(128, 128, 128)");
  }
  
  if (cleanCss.includes("color-mix")) {
    cleanCss = cleanCss.replace(colorMixRegex, "rgb(150, 150, 150)");
  }
  
  return cleanCss;
}

/**
 * Enhanced replacement that guarantees no 'oklch' remains in the string
 */
export function sanitizeStyleValue(value: string): string {
  const sanitized = replaceOklchInCssText(value);
  if (sanitized.includes("oklch") || sanitized.includes("oklab")) {
     return "rgb(128, 128, 128)";
  }
  return sanitized;
}

/**
 * Downloads a DOM element as a high-quality A4 PDF document.
 * @param elementOrId HTMLElement reference or element ID
 * @param options Export configuration options
 */
export async function downloadElementAsPdf(
  elementOrId: HTMLElement | string,
  options: PdfExportOptions = {}
): Promise<boolean> {
  const {
    fileName = "Report.pdf",
    orientation = "p",
    scale = 2,
    marginMm = 0,
  } = options;

  let element: HTMLElement | null = null;
  if (typeof elementOrId === "string") {
    element = document.getElementById(elementOrId);
  } else {
    element = elementOrId;
  }

  if (!element) {
    console.error(`[pdfExportUtils] Target element for PDF export not found:`, elementOrId);
    return false;
  }

  try {
    // 0. Ensure fonts are fully loaded before rasterization
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
      } catch (fontErr) {
        console.warn("[pdfExportUtils] Font readiness wait warning:", fontErr);
      }
    }

    // 1. Capture element to high-res canvas with html2canvas-pro
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 1280,
      onclone: (clonedDoc: Document) => {
        // Inject styles to guarantee connected Arabic font rendering and remove any letter-spacing
        try {
          const style = clonedDoc.createElement("style");
          style.textContent = `
            * {
              font-family: 'Cairo', 'Tajawal', 'Alexandria', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
              letter-spacing: 0 !important;
              word-spacing: normal !important;
              font-feature-settings: 'liga' 1, 'calt' 1, 'ccmp' 1, 'locl' 1 !important;
              text-rendering: optimizeLegibility !important;
              -webkit-font-smoothing: antialiased !important;
            }
            .font-mono {
              font-family: 'JetBrains Mono', 'Cairo', monospace !important;
            }
          `;
          clonedDoc.head.appendChild(style);

          // Apply Company Profile custom styles and background to the clone
          const companyProfileStr = localStorage.getItem("ef_company_profile_v12");
          if (companyProfileStr) {
            const parsed = JSON.parse(companyProfileStr);
            const profile = parsed.companyProfile || parsed; // Handle different storage structures

            if (profile.customReportCss) {
              const customStyle = clonedDoc.createElement("style");
              customStyle.textContent = profile.customReportCss;
              clonedDoc.head.appendChild(customStyle);
            }

            if (profile.reportBackgroundUrl) {
              const bgStyle = clonedDoc.createElement("style");
              bgStyle.textContent = `
                #printable-report-card, #report-print-area, .report-sheet, .printable-document {
                  position: relative;
                  background-color: transparent !important;
                }
                #printable-report-card::before, #report-print-area::before, .report-sheet::before, .printable-document::before {
                  content: "";
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background-image: url('${profile.reportBackgroundUrl}');
                  background-size: cover;
                  background-position: center;
                  background-repeat: no-repeat;
                  opacity: ${profile.reportBackgroundOpacity ?? 0.15};
                  pointer-events: none;
                  z-index: 0;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #printable-report-card > *, #report-print-area > *, .report-sheet > *, .printable-document > * {
                  position: relative;
                  z-index: 1;
                }
              `;
              clonedDoc.head.appendChild(bgStyle);
            }
          }
        } catch (styleErr) {
          console.warn("[pdfExportUtils] Could not append clone style:", styleErr);
        }

        // Ensure the element and its parents are visible in the clone
        const clonedEl = clonedDoc.getElementById(element.id) || clonedDoc.body.querySelector('*');
        if (clonedEl instanceof HTMLElement) {
          clonedEl.style.overflow = "visible";
          clonedEl.style.height = "auto";
          clonedEl.style.maxHeight = "none";
        }
      },
    });

    const imgData = canvas.toDataURL("image/png");

    // 2. Initialize jsPDF
    const pdf = new jsPDF({
      orientation: orientation,
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = orientation === "p" ? 210 : 297;
    const pdfPageHeight = orientation === "p" ? 297 : 210;

    const contentWidth = pdfWidth - marginMm * 2;
    const imgHeightMm = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = imgHeightMm;
    let position = marginMm;

    // First page
    pdf.addImage(
      imgData,
      "PNG",
      marginMm,
      position,
      contentWidth,
      imgHeightMm,
      undefined,
      "FAST"
    );
    heightLeft -= pdfPageHeight;

    // Subsequent pages if report content spans multiple pages
    while (heightLeft > 0) {
      position = heightLeft - imgHeightMm + marginMm;
      pdf.addPage();
      pdf.addImage(
        imgData,
        "PNG",
        marginMm,
        position,
        contentWidth,
        imgHeightMm,
        undefined,
        "FAST"
      );
      heightLeft -= pdfPageHeight;
    }

    // 3. Trigger download
    const finalFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    pdf.save(finalFileName);
    return true;
  } catch (err) {
    console.error("[pdfExportUtils] Error generating PDF:", err);
    return false;
  }
}

export const exportElementToPdf = downloadElementAsPdf;

