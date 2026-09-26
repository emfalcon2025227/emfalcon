import React, { useRef } from "react";
import {
  Printer,
  Download,
  X,
  FileText,
  Building2,
  User,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Lease, Cheque, Owner, Tenant, Property, Unit } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { exportElementToPdf } from "../../utils/pdfExportUtils";
import { CompanyLetterheadFrame } from "../common/CompanyLetterheadFrame";

interface ChequesBundlePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: Lease | null;
  cheques?: Cheque[];
  owner?: Owner | null;
  tenant?: Tenant | null;
  property?: Property | null;
  unit?: Unit | null;
}

export const ChequesBundlePrintModal: React.FC<ChequesBundlePrintModalProps> = ({
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
  const { companyProfile, logAudit } = useData();
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !lease) return null;

  // Active cheques for this contract
  const activeCheques = cheques
    .filter(
      (c) =>
        (c.leaseId === lease.id || c.leaseId === lease.leaseNumber) &&
        c.status !== "REPLACED" &&
        c.status !== "CANCELLED"
    )
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Replaced / historic cheques (kept in audit history, excluded from active set)
  const replacedCheques = cheques.filter(
    (c) =>
      (c.leaseId === lease.id || c.leaseId === lease.leaseNumber) &&
      (c.status === "REPLACED" || c.status === "CANCELLED")
  );

  const totalActiveAmount = activeCheques.reduce((sum, c) => sum + (c.amount || 0), 0);

  const handlePrint = () => {
    logAudit(
      "DOCUMENT_PRINT",
      "LEASE",
      lease.id,
      lease.leaseNumber,
      `Printed All Active Cheques PDF Bundle for Lease #${lease.leaseNumber}`
    );
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    try {
      logAudit(
        "DOCUMENT_EXPORT",
        "LEASE",
        lease.id,
        lease.leaseNumber,
        `Exported All Active Cheques PDF Bundle for Lease #${lease.leaseNumber}`
      );
      await exportElementToPdf(printAreaRef.current, {
        fileName: `Active_Cheques_Bundle_${lease.leaseNumber}.pdf`,
        title: `صور وسجل شيكات العقد - ${lease.leaseNumber}`,
        orientation: "p",
      });
    } catch (err) {
      console.error("Failed to export PDF:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Top Control Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between no-print border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">
                {isAr ? "إنشاء PDF الشيكات النشطة للعقد" : "Generate All Active Cheques PDF"}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? `عقد إيجار رقم: ${lease.leaseNumber}` : `Lease Contract #${lease.leaseNumber}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-slate-700"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "تحميل PDF" : "Download PDF"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md border border-emerald-500/30"
            >
              <Printer className="w-4 h-4" />
              <span>{isAr ? "طباعة الملف" : "Print Document"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Canvas */}
        <div className="p-6 md:p-8 bg-slate-100 flex justify-center overflow-x-auto">
          <div
            ref={printAreaRef}
            className="bg-white p-8 rounded-2xl shadow-lg border border-slate-300 w-full max-w-4xl font-sans text-slate-900 print:shadow-none print:border-none print:w-full print:p-0 print:m-0"
          >
            <CompanyLetterheadFrame showLetterhead={true}>
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between border-b-4 border-emerald-500">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                      {isAr ? "حافظة ومستند الشيكات المعتمدة" : "OFFICIAL CHEQUES PORTFOLIO"}
                    </span>
                    <h2 className="text-xl font-black mt-0.5">
                      {isAr ? "ملف صور وسجل شيكات عقد الإيجار" : "Active Lease Cheques Portfolio"}
                    </h2>
                  </div>

                  <div className="text-left font-mono">
                    <div className="text-xs text-slate-400">{isAr ? "رقم العقد" : "Contract No"}</div>
                    <div className="text-lg font-black text-emerald-400">{lease.leaseNumber}</div>
                  </div>
                </div>

                {/* Summary Metadata Card */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <div className="text-slate-500 font-bold">{isAr ? "المستأجر:" : "Tenant:"}</div>
                    <div className="font-black text-slate-900 mt-0.5 font-mono">
                      {tenant?.nameAr || tenant?.nameEn || lease.tenantId}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 font-bold">{isAr ? "المالك:" : "Owner:"}</div>
                    <div className="font-black text-slate-900 mt-0.5 font-mono">
                      {owner?.nameAr || owner?.nameEn || lease.ownerId}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 font-bold">{isAr ? "العقار والوحدة:" : "Unit:"}</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {property?.nameAr || property?.nameEn || lease.propertyId} / {unit?.unitNumber || lease.unitId}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 font-bold">{isAr ? "إجمالي الشيكات النشطة:" : "Active Cheques Total:"}</div>
                    <div className="font-black text-emerald-600 mt-0.5 font-mono text-sm">
                      AED {totalActiveAmount.toLocaleString()} ({activeCheques.length})
                    </div>
                  </div>
                </div>

                {/* Active Cheques Cards Grid */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{isAr ? "قائمة الشيكات النشطة المعتمدة في السداد:" : "Active Approved Cheques Schedule:"}</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeCheques.map((chq, idx) => (
                      <div
                        key={chq.id || idx}
                        className="bg-white p-4 rounded-xl border border-slate-300 shadow-xs space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-[10px] font-black font-mono text-slate-400">#{idx + 1}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                            {chq.status || "ACTIVE"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-[10px] text-slate-400 font-bold">{isAr ? "رقم الشيك:" : "Cheque No:"}</div>
                            <div className="font-black font-mono text-slate-900 text-sm">{chq.chequeNumber || "N/A"}</div>
                          </div>

                          <div>
                            <div className="text-[10px] text-slate-400 font-bold">{isAr ? "المبلغ:" : "Amount:"}</div>
                            <div className="font-black font-mono text-emerald-600 text-sm">
                              {chq.amount.toLocaleString()} AED
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] text-slate-400 font-bold">{isAr ? "البنك:" : "Bank:"}</div>
                            <div className="font-bold text-slate-800">{chq.bankName || "—"}</div>
                          </div>

                          <div>
                            <div className="text-[10px] text-slate-400 font-bold">{isAr ? "تاريخ الاستحقاق:" : "Due Date:"}</div>
                            <div className="font-bold font-mono text-slate-800">{chq.dueDate}</div>
                          </div>
                        </div>

                        {/* Image Preview if available */}
                        {chq.imageUrl && (
                          <div className="pt-2 border-t border-slate-100">
                            <img
                              src={chq.imageUrl}
                              alt={`Cheque ${chq.chequeNumber}`}
                              className="w-full h-24 object-cover rounded-lg border border-slate-200"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Replaced Cheques Audit Table */}
                {replacedCheques.length > 0 && (
                  <div className="pt-4 border-t-2 border-dashed border-slate-200 space-y-2">
                    <h5 className="text-xs font-black uppercase text-rose-700 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{isAr ? "سجل الشيكات المستبدلة/الملغاة (مستبعدة من كشف السداد النشط):" : "Replaced Cheques Audit Trail:"}</span>
                    </h5>

                    <table className="w-full text-[11px] text-right border border-rose-200 rounded-lg overflow-hidden bg-rose-50/50">
                      <thead>
                        <tr className="bg-rose-100 text-rose-900 font-bold">
                          <th className="p-2">{isAr ? "رقم الشيك السابق" : "Old Cheque No"}</th>
                          <th className="p-2">{isAr ? "المبلغ" : "Amount"}</th>
                          <th className="p-2">{isAr ? "الحالة" : "Status"}</th>
                          <th className="p-2">{isAr ? "السبب / الشيك البديل" : "Reason / Replaced By"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-200 font-mono">
                        {replacedCheques.map((c) => (
                          <tr key={c.id}>
                            <td className="p-2 font-bold line-through text-slate-600">{c.chequeNumber}</td>
                            <td className="p-2 font-bold">{c.amount.toLocaleString()} AED</td>
                            <td className="p-2 font-bold text-rose-800">{c.status}</td>
                            <td className="p-2 text-slate-600 text-[10px]">
                              {c.notes || (isAr ? "تم استبداله بشيك جديد" : "Replaced by new cheque")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CompanyLetterheadFrame>
          </div>
        </div>
      </div>
    </div>
  );
};
