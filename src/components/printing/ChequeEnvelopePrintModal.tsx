import React, { useRef, useState, useMemo } from "react";
import { Printer, Download, X, Mail, FileEdit, ChevronLeft, ChevronRight, Layers, FileText } from "lucide-react";
import { Lease, Cheque, Owner, Tenant, Property, Unit } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { exportElementToPdf } from "../../utils/pdfExportUtils";

interface ChequeEnvelopePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: Lease | null;
  cheques?: Cheque[];
  owner?: Owner | null;
  tenant?: Tenant | null;
  property?: Property | null;
  unit?: Unit | null;
}

interface EnvelopeChequeItem {
  id: string;
  chequeNumber: string;
  dueDate: string;
  amount: number;
  contents: string[];
  statusLabel: string;
  installmentNumbers: number[];
}

export const ChequeEnvelopePrintModal: React.FC<ChequeEnvelopePrintModalProps> = ({
  isOpen,
  onClose,
  lease,
  cheques = [],
  owner,
  tenant,
  property,
  unit,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { logAudit } = useData();
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Strictly temporary screen-only note - NEVER saved to Lease, Cheque, or Firestore
  const [envelopeNotes, setEnvelopeNotes] = useState<string>("");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [printMode, setPrintMode] = useState<"current" | "all">("current");

  // Filter and prepare schedule items strictly read-only from existing contract / cheque data
  const scheduleItems = useMemo<EnvelopeChequeItem[]>(() => {
    if (!lease) return [];

    // Filter active cheques for this lease (STRICTLY excluding REPLACED and CANCELLED cheques)
    const activeCheques = (cheques || [])
      .filter(
        (c) =>
          (c.leaseId === lease.id || c.leaseId === lease.leaseNumber) &&
          c.status !== "REPLACED" &&
          c.status !== "CANCELLED"
      )
      .sort((a, b) => new Date(a.dueDate || a.chequeDate).getTime() - new Date(b.dueDate || b.chequeDate).getTime());

    if (activeCheques.length > 0) {
      return activeCheques.map((c) => {
        // Collect ALL matching installments for this cheque (fixing .find() limitation)
        const matchingInstallments = (lease.installments || []).filter((inst) => {
          if (c.id && inst.chequeId && inst.chequeId === c.id) return true;
          if (c.chequeNumber && inst.chequeNumber) {
            const normC = String(c.chequeNumber).trim().toLowerCase();
            const normI = String(inst.chequeNumber).trim().toLowerCase();
            if (normC && normC === normI) return true;
          }
          return false;
        });

        // STATUS RULE: Display "محصل" / "Collected" ONLY if collected/cleared. ALL other statuses MUST BE COMPLETELY BLANK ("")
        const isCollected =
          c.status === "COLLECTED" ||
          c.status === "CLEARED" ||
          matchingInstallments.some((inst) => inst.status === "COLLECTED" || inst.status === "CLEARED");
        const statusLabel = isCollected ? (isAr ? "محصل" : "Collected") : "";

        // Contents gathered strictly from existing contract data - NO synthetic/invented defaults
        const contentLines: string[] = [];
        if (matchingInstallments.length > 1) {
          matchingInstallments.forEach((inst) => {
            const desc = (inst.notes || "").trim();
            const amtStr = inst.amount ? `${inst.amount.toLocaleString()} AED` : "";
            if (desc && amtStr) {
              contentLines.push(`${desc} — ${amtStr}`);
            } else if (desc) {
              contentLines.push(desc);
            } else if (amtStr) {
              contentLines.push(amtStr);
            }
          });
        } else if (matchingInstallments.length === 1) {
          const inst = matchingInstallments[0];
          const desc = (inst.notes || c.notes || "").trim();
          if (desc) {
            contentLines.push(desc);
          }
        } else if (c.notes && c.notes.trim()) {
          contentLines.push(c.notes.trim());
        }

        return {
          id: c.id,
          chequeNumber: c.chequeNumber || "—",
          dueDate: c.dueDate || c.chequeDate || "—",
          amount: c.amount || 0, // Cheque's original recorded amount - never recalculated or redistributed
          contents: contentLines,
          statusLabel,
          installmentNumbers: matchingInstallments.map((i) => i.installmentNumber).filter(Boolean),
        };
      });
    }

    // Fallback for legacy contracts without separate cheque records:
    // Group lease.installments by chequeNumber or chequeId so multiple installments sharing a cheque are grouped together
    const grouped = new Map<string, typeof lease.installments>();
    (lease.installments || []).forEach((inst) => {
      const key = (inst.chequeNumber && inst.chequeNumber.trim()) || inst.chequeId || `inst-${inst.installmentNumber}`;
      const existing = grouped.get(key) || [];
      existing.push(inst);
      grouped.set(key, existing);
    });

    const items: EnvelopeChequeItem[] = [];
    grouped.forEach((insts, key) => {
      const isCollected = insts.some((i) => i.status === "COLLECTED" || i.status === "CLEARED");
      const statusLabel = isCollected ? (isAr ? "محصل" : "Collected") : "";

      const contentLines: string[] = [];
      if (insts.length > 1) {
        insts.forEach((inst) => {
          const desc = (inst.notes || "").trim();
          const amtStr = inst.amount ? `${inst.amount.toLocaleString()} AED` : "";
          if (desc && amtStr) {
            contentLines.push(`${desc} — ${amtStr}`);
          } else if (desc) {
            contentLines.push(desc);
          } else if (amtStr) {
            contentLines.push(amtStr);
          }
        });
      } else if (insts.length === 1 && insts[0].notes && insts[0].notes.trim()) {
        contentLines.push(insts[0].notes.trim());
      }

      // If multiple installments share this cheque, the cheque amount is the sum of those installments
      const totalAmount = insts.reduce((sum, i) => sum + (i.amount || 0), 0);

      items.push({
        id: key,
        chequeNumber: insts[0].chequeNumber || "—",
        dueDate: insts[0].dueDate || "—",
        amount: totalAmount,
        contents: contentLines,
        statusLabel,
        installmentNumbers: insts.map((i) => i.installmentNumber).filter(Boolean),
      });
    });

    return items;
  }, [lease, cheques, isAr]);

  // Ensure selected index is always valid
  const currentCheque = scheduleItems[selectedIdx] || scheduleItems[0] || null;

  // Unconditional Hooks execution check
  if (!isOpen || !lease) return null;

  const handlePrintCurrent = () => {
    setPrintMode("current");
    logAudit(
      "DOCUMENT_PRINT",
      "LEASE",
      lease.id,
      lease.leaseNumber,
      `Printed Current Cheque Envelope (${currentCheque?.chequeNumber || "N/A"}) for Lease #${lease.leaseNumber}`
    );
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintAll = () => {
    setPrintMode("all");
    logAudit(
      "DOCUMENT_PRINT",
      "LEASE",
      lease.id,
      lease.leaseNumber,
      `Printed All Cheque Envelopes (${scheduleItems.length} cheques) for Lease #${lease.leaseNumber}`
    );
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    try {
      logAudit(
        "DOCUMENT_EXPORT",
        "LEASE",
        lease.id,
        lease.leaseNumber,
        `Exported Cheque Envelope PDF (${printMode === "all" ? "All" : currentCheque?.chequeNumber || "Current"}) for Lease #${lease.leaseNumber}`
      );
      const fileNameSuffix = printMode === "all" ? "All_Cheques" : `Cheque_${currentCheque?.chequeNumber || selectedIdx + 1}`;
      await exportElementToPdf(printAreaRef.current, {
        fileName: `Envelope_${lease.leaseNumber}_${fileNameSuffix}.pdf`,
        title: `ظرف الشيكات - عقد ${lease.leaseNumber}`,
        orientation: "l",
      });
    } catch (err) {
      console.error("Failed to export PDF:", err);
    }
  };

  // Render a single envelope sheet according to 225mm x 115mm Landscape standard
  const renderEnvelopeSheet = (item: EnvelopeChequeItem, index: number, total: number) => {
    return (
      <div
        key={item.id || index}
        className="envelope-print-sheet bg-white p-4 rounded-xl shadow-md border border-slate-300 font-sans text-slate-900 box-border flex flex-col justify-between"
        style={{
          width: "225mm",
          height: "115mm",
          minWidth: "225mm",
          minHeight: "115mm",
          maxWidth: "225mm",
          maxHeight: "115mm",
        }}
      >
        {/* Top Header Strip */}
        <div>
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5 mb-2">
            <div>
              <div className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>{isAr ? "صقر الإمارات للعقارات" : "EMIRATES FALCON REAL ESTATE"}</span>
                <span className="text-slate-400 font-normal">|</span>
                <span className="text-amber-700">{isAr ? "ظرف الشيك" : "CHEQUE ENVELOPE"}</span>
              </div>
              <div className="text-[9px] text-slate-600 font-bold">
                {tenant?.nameAr || tenant?.nameEn || lease.tenantId} — {property?.nameAr || property?.nameEn || lease.propertyId} (الوحدة {unit?.unitNumber || lease.unitId})
              </div>
            </div>
            <div className="text-left font-mono">
              <div className="text-[8px] text-slate-500 uppercase">{isAr ? "رقم العقد" : "Contract No"}</div>
              <div className="text-xs font-black text-slate-900">{lease.leaseNumber}</div>
            </div>
          </div>

          {/* Contract & Parties Compact Strip */}
          <div className="grid grid-cols-2 gap-2 text-[9px] bg-slate-50 p-1.5 rounded border border-slate-200 mb-2">
            <div>
              <span className="font-bold text-slate-600">{isAr ? "المالك: " : "Owner: "}</span>
              <span className="font-semibold text-slate-900">{owner?.nameAr || owner?.nameEn || lease.ownerId}</span>
            </div>
            <div className="text-left font-mono">
              <span className="font-bold text-slate-600">{isAr ? "نهاية العقد: " : "Contract End: "}</span>
              <span className="text-slate-900 font-semibold">{lease.endDate}</span>
            </div>
          </div>

          {/* Cheque Primary Details Box */}
          <div className="bg-slate-900 text-white rounded p-2 mb-2 flex items-center justify-between font-mono">
            <div>
              <div className="text-[8px] text-amber-400 uppercase font-sans font-bold">
                {isAr ? "رقم الشيك" : "Cheque Number"}
              </div>
              <div className="text-sm font-black tracking-wider text-white">
                {item.chequeNumber}
              </div>
            </div>

            <div>
              <div className="text-[8px] text-slate-400 uppercase font-sans font-bold">
                {isAr ? "تاريخ الاستحقاق" : "Due Date"}
              </div>
              <div className="text-xs font-bold text-slate-200">
                {item.dueDate}
              </div>
            </div>

            <div>
              <div className="text-[8px] text-emerald-400 uppercase font-sans font-bold text-left">
                {isAr ? "مبلغ الشيك" : "Amount"}
              </div>
              <div className="text-sm font-black text-emerald-300 text-left">
                {item.amount.toLocaleString()} AED
              </div>
            </div>

            {item.statusLabel && (
              <div className="bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[9px] px-2 py-0.5 rounded font-black font-sans">
                {item.statusLabel}
              </div>
            )}
          </div>

          {/* Contents & Description Section */}
          <div className="border border-slate-300 rounded p-1.5 text-[9px] mb-2 bg-slate-50/50">
            <div className="font-bold text-slate-700 text-[8px] uppercase mb-1 flex items-center justify-between">
              <span>{isAr ? "محتويات الشيك / بيان الدفعات:" : "Cheque Contents / Payment Description:"}</span>
              {item.installmentNumbers.length > 0 && (
                <span className="font-mono text-slate-500 font-normal">
                  {isAr ? `(أقساط رقم: ${item.installmentNumbers.join(", ")})` : `(Installment #${item.installmentNumbers.join(", ")})`}
                </span>
              )}
            </div>

            {item.contents.length > 0 ? (
              <div className="space-y-0.5 font-sans text-slate-800">
                {item.contents.map((line, lIdx) => (
                  <div key={lIdx} className="flex items-center gap-1.5 font-semibold text-[9px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 italic text-[8px]">
                {isAr ? "— لا توجد تفاصيل إضافية مسجلة للدفعة —" : "— No additional payment breakdown recorded —"}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Notes & Envelope Footer */}
        <div>
          {envelopeNotes.trim() && (
            <div className="border border-amber-300 bg-amber-50/60 rounded px-2 py-1 text-[8px] text-amber-900 mb-1.5 font-sans">
              <span className="font-bold">{isAr ? "ملاحظات: " : "Notes: "}</span>
              <span>{envelopeNotes.trim()}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[8px] text-slate-500 font-mono border-t border-slate-200 pt-1">
            <span>{isAr ? `فترة العقد: ${lease.startDate} إلى ${lease.endDate}` : `Contract Period: ${lease.startDate} to ${lease.endDate}`}</span>
            <span className="font-bold text-slate-700">{isAr ? `شيك ${index + 1} من ${total}` : `Cheque ${index + 1} of ${total}`}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 overflow-y-auto">
      {/* Dynamic Print CSS enforcing exact 225mm x 115mm Landscape Envelope Size & Multi-page printing */}
      <style>{`
        @media print {
          @page {
            size: 225mm 115mm landscape;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .envelope-print-sheet {
            width: 225mm !important;
            height: 115mm !important;
            max-width: 225mm !important;
            max-height: 115mm !important;
            margin: 0 auto !important;
            padding: 5mm 7mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .envelope-print-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Top Control Bar (Screen only) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 no-print border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">
                {isAr ? "طباعة ظرف الشيكات (225x115mm)" : "Print Cheque Envelope (225x115mm)"}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? `عقد إيجار رقم: ${lease.leaseNumber}` : `Lease Contract #${lease.leaseNumber}`}
                {scheduleItems.length > 0 && ` (${scheduleItems.length} ${isAr ? "شيكات نشطة" : "active cheques"})`}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
              title={isAr ? "تصدير بصيغة PDF" : "Export as PDF"}
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "تصدير PDF" : "Export PDF"}</span>
            </button>

            <button
              onClick={handlePrintCurrent}
              disabled={!currentCheque}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-600 disabled:opacity-50"
              title={isAr ? "طباعة الشيك المحدد حاليًا فقط" : "Print currently selected cheque only"}
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>{isAr ? "طباعة الشيك الحالي" : "Print Current"}</span>
            </button>

            <button
              onClick={handlePrintAll}
              disabled={scheduleItems.length === 0}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md border border-amber-500/30 disabled:opacity-50"
              title={isAr ? "طباعة جميع الشيكات (صفحة مستقلة لكل شيك)" : "Print all cheques (one envelope per page)"}
            >
              <Printer className="w-4 h-4" />
              <span>{isAr ? "طباعة جميع الشيكات" : "Print All"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode & Cheque Selector Bar (Screen only) */}
        {scheduleItems.length > 0 && (
          <div className="px-6 py-2.5 bg-slate-800 text-slate-200 no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 text-xs">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setPrintMode("current")}
                className={`px-3 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  printMode === "current"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isAr ? "معاينة الشيك الحالي" : "Current Cheque"}</span>
              </button>
              <button
                onClick={() => setPrintMode("all")}
                className={`px-3 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  printMode === "all"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isAr ? `عرض الكل (${scheduleItems.length})` : `All (${scheduleItems.length})`}</span>
              </button>
            </div>

            {/* Pagination / Cheque Navigation (Active in Current mode) */}
            {printMode === "current" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIdx((prev) => Math.max(0, prev - 1))}
                  disabled={selectedIdx <= 0}
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className={`w-4 h-4 ${isAr ? "" : "rotate-180"}`} />
                </button>

                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-amber-400">{selectedIdx + 1}</span>
                  <span className="text-slate-400">/</span>
                  <span>{scheduleItems.length}</span>
                  <span className="text-slate-400 font-sans mr-2">
                    ({isAr ? "شيك رقم: " : "Cheque: "}
                    <strong className="text-white font-mono">{currentCheque?.chequeNumber}</strong>)
                  </span>
                </div>

                <button
                  onClick={() => setSelectedIdx((prev) => Math.min(scheduleItems.length - 1, prev + 1))}
                  disabled={selectedIdx >= scheduleItems.length - 1}
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className={`w-4 h-4 ${isAr ? "" : "rotate-180"}`} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Temporary Notes Input Field (Screen only - Not saved to DB) */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 no-print flex items-center gap-3">
          <FileEdit className="w-4 h-4 text-amber-700 shrink-0" />
          <div className="flex-1">
            <input
              type="text"
              value={envelopeNotes}
              onChange={(e) => setEnvelopeNotes(e.target.value)}
              placeholder={
                isAr
                  ? "ملاحظات إضافية على الظرف (مؤقتة للشاشة والطباعة الحالية فقط، لا يتم حفظها في قاعدة البيانات)..."
                  : "Temporary envelope notes for this print session only (never saved to database)..."
              }
              className="w-full text-xs bg-white border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Physical Envelope Container (225mm x 115mm aspect preview) */}
        <div className="p-6 bg-slate-200 flex flex-col items-center gap-6 overflow-x-auto max-h-[60vh] overflow-y-auto">
          {scheduleItems.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-slate-500 text-xs font-bold border border-slate-300">
              {isAr ? "لا توجد شيكات أو دفعات نشطة للطباعة في هذا العقد." : "No active cheques or installments available to print."}
            </div>
          ) : (
            <div ref={printAreaRef} className="space-y-6">
              {printMode === "current" && currentCheque ? (
                renderEnvelopeSheet(currentCheque, selectedIdx, scheduleItems.length)
              ) : (
                scheduleItems.map((item, idx) =>
                  renderEnvelopeSheet(item, idx, scheduleItems.length)
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
