import React, { useState } from "react";
import {
  X,
  User,
  Phone,
  Mail,
  ShieldAlert,
  CreditCard,
  Scale,
  FileSpreadsheet,
  FolderLock,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Tenant } from "../../types";
import { Badge } from "../common/Badge";
import { LegalNoticeGeneratorModal } from "../common/LegalNoticeGeneratorModal";

interface TenantDetailsDrawerProps {
  tenant: Tenant | null;
  onClose: () => void;
  onSelectCheque?: (chequeId: string) => void;
  onSelectCase?: (caseId: string) => void;
  onNavigateToLeases?: (leaseId?: string) => void;
  onNavigateToUnits?: (unitId?: string) => void;
}

export const TenantDetailsDrawer: React.FC<TenantDetailsDrawerProps> = ({
  tenant,
  onClose,
  onSelectCheque,
  onSelectCase,
  onNavigateToLeases,
  onNavigateToUnits,
}) => {
  const { t, language } = useLanguage();
  const { leases, cheques, collections, cases, archive, properties, units, dispatchWhatsAppReminder } = useData();

  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "LEASES" | "CHEQUES" | "CASES" | "ARCHIVE">("OVERVIEW");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [whatsAppFeedback, setWhatsAppFeedback] = useState<string | null>(null);
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState(false);

  if (!tenant) return null;

  const tenantLeases = leases.filter((l) => l.tenantId === tenant.id);
  const tenantCheques = cheques.filter((c) => c.tenantId === tenant.id);
  const tenantBouncedCheques = tenantCheques.filter((c) => c.originalStatus === "BOUNCED");
  const tenantCollections = collections.filter((col) => col.tenantId === tenant.id);
  const tenantCases = cases.filter((cas) => cas.tenantId === tenant.id);
  const tenantDocs = archive.filter((a) => a.entityType === "TENANT" && a.entityId === tenant.id);

  const totalChequesAmount = tenantCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalBouncedAmount = tenantBouncedCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalOutstanding = tenantBouncedCheques.reduce((sum, c) => sum + c.outstanding, 0);
  const totalCollected = tenantCollections.reduce((sum, col) => sum + col.amountApplied, 0);

  const handleSendReminder = async (chqId: string) => {
    setIsSendingWhatsApp(true);
    setWhatsAppFeedback(null);
    const res = await dispatchWhatsAppReminder(chqId);
    setWhatsAppFeedback(res.message);
    setIsSendingWhatsApp(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-end duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 text-white flex items-center justify-center font-black text-lg shadow-sm">
              {tenant.nameEn.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
                  {tenant.code}
                </span>
                <Badge
                  variant={
                    tenant.riskLevel === "HIGH"
                      ? "danger"
                      : tenant.riskLevel === "MEDIUM"
                      ? "warning"
                      : "success"
                  }
                  size="sm"
                >
                  {tenant.riskLevel} RISK ({tenant.riskScore}/100)
                </Badge>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                {language === "ar" ? tenant.nameAr : tenant.nameEn}
              </h3>
              <p className="text-xs text-slate-500">{language === "ar" ? tenant.nameEn : tenant.nameAr}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 bg-white overflow-x-auto">
          {[
            { id: "OVERVIEW", label: language === "ar" ? "نظرة شاملة 360°" : "360° Overview" },
            { id: "LEASES", label: `${t("navLeases")} (${tenantLeases.length})` },
            { id: "CHEQUES", label: `${t("navBouncedCheques")} (${tenantCheques.length})` },
            { id: "CASES", label: `${t("navCases")} (${tenantCases.length})` },
            { id: "ARCHIVE", label: `${t("electronicArchive")} (${tenantDocs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-2 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-amber-700 text-amber-900"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {whatsAppFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
              <span>{whatsAppFeedback}</span>
              <button
                onClick={() => setWhatsAppFeedback(null)}
                className="text-emerald-600 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === "OVERVIEW" && (
            <div className="space-y-6">
              {/* Dynamic Risk Gauge Card */}
              <div
                className={`p-5 rounded-2xl border ${
                  tenant.riskLevel === "HIGH"
                    ? "bg-rose-50/70 border-rose-200"
                    : tenant.riskLevel === "MEDIUM"
                    ? "bg-amber-50/70 border-amber-200"
                    : "bg-emerald-50/70 border-emerald-200"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert
                      className={`w-5 h-5 ${
                        tenant.riskLevel === "HIGH"
                          ? "text-rose-600"
                          : tenant.riskLevel === "MEDIUM"
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    />
                    <h4 className="text-sm font-bold text-slate-900">
                      {language === "ar" ? "مؤشر المخاطر الائتمانية والسلوكية" : "Credit & Payment Risk Index"}
                    </h4>
                  </div>
                  <span className="text-xl font-black font-mono">
                    {tenant.riskScore} <span className="text-xs font-normal text-slate-500">/ 100</span>
                  </span>
                </div>

                {/* Visual Risk Bar */}
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      tenant.riskLevel === "HIGH"
                        ? "bg-rose-600"
                        : tenant.riskLevel === "MEDIUM"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${tenant.riskScore}%` }}
                  />
                </div>

                <div className="text-xs space-y-1 text-slate-700">
                  <p className="font-bold text-slate-800">
                    {language === "ar" ? "العوامل المؤثرة على التقييم:" : "Contributing Factors:"}
                  </p>
                  <ul className="list-disc ps-4 space-y-0.5 text-[11px] text-slate-600">
                    {(tenant.riskFactors || []).map((factor, idx) => (
                      <li key={idx}>{factor}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Financial Summary Scorecard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    {language === "ar" ? "إجمالي الشيكات" : "Total Cheques"}
                  </span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    AED {totalChequesAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{tenantCheques.length} Cheques</span>
                </div>

                <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-600 block uppercase">
                    {language === "ar" ? "شيكات مرتجعة" : "Bounced"}
                  </span>
                  <span className="text-sm font-black text-rose-700 font-mono">
                    AED {totalBouncedAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-rose-600 block mt-0.5">{tenantBouncedCheques.length} Bounced</span>
                </div>

                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700 block uppercase">
                    {language === "ar" ? "المتبقي للتحصيل" : "Outstanding"}
                  </span>
                  <span className="text-sm font-black text-amber-800 font-mono">
                    AED {totalOutstanding.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-amber-600 block mt-0.5">Active Claim</span>
                </div>

                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 block uppercase">
                    {language === "ar" ? "تم تحصيله" : "Collected"}
                  </span>
                  <span className="text-sm font-black text-emerald-800 font-mono">
                    AED {totalCollected.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5">{tenantCollections.length} Receipts</span>
                </div>
              </div>

              {/* KYC & Identity Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {language === "ar" ? "بيانات الهوية والتواصل الرسمية" : "Official KYC & Contact Details"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {language === "ar" ? "النوع:" : "Type:"} <strong className="text-slate-800">{tenant.type}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {language === "ar" ? "الهوية الإماراتية:" : "Emirates ID:"}{" "}
                      <strong className="text-slate-800 font-mono">{tenant.emiratesId || "N/A"}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {language === "ar" ? "الهاتف:" : "Phone:"} <strong className="text-slate-800 font-mono">{tenant.phone}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {language === "ar" ? "البريد:" : "Email:"} <strong className="text-slate-800">{tenant.email}</strong>
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setIsLegalNoticeOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-800 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Scale className="w-3.5 h-3.5 text-amber-300" />
                    <span>{language === "ar" ? "صياغة إخطار قانوني للمستأجر (AI)" : "Draft Legal Notice (AI)"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "LEASES" && (
            <div className="space-y-3">
              {tenantLeases.map((lease) => {
                const prop = properties.find((p) => p.id === lease.propertyId);
                const unit = units.find((u) => u.id === lease.unitId);

                return (
                  <div key={lease.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 font-mono">{lease.leaseNumber}</span>
                      <Badge variant={lease.contractStatus === "ACTIVE" ? "success" : "neutral"} size="sm">
                        {lease.contractStatus}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600 grid grid-cols-2 gap-2">
                      <div>
                        {language === "ar" ? "العقار والوحدة:" : "Unit:"}{" "}
                        <strong className="text-slate-800">
                          {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "Property"} - Unit {unit?.unitNumber}
                        </strong>
                      </div>
                      <div>
                        {language === "ar" ? "الإيجار السنوي:" : "Rent:"}{" "}
                        <strong className="text-slate-800 font-mono">AED {Number(lease.annualRent || 0).toLocaleString()}</strong>
                      </div>
                      <div>
                        {language === "ar" ? "الفترة:" : "Period:"}{" "}
                        <span>
                          {lease.startDate} → {lease.endDate}
                        </span>
                      </div>
                      <div>
                        {language === "ar" ? "رقم إيجاري / توثيق:" : "Ejari #:"}{" "}
                        <span className="font-mono">{lease.ejariNumber || "N/A"}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {onNavigateToUnits && (
                          <button
                            type="button"
                            onClick={() => onNavigateToUnits(unit?.id)}
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer"
                          >
                            {language === "ar" ? "← فتح صفحة الوحدات" : "Open Units Page →"}
                          </button>
                        )}
                      </div>

                      {onNavigateToLeases && (
                        <button
                          type="button"
                          onClick={() => onNavigateToLeases(lease.id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200/80 cursor-pointer"
                        >
                          {language === "ar" ? "عرض وإدارة العقد في صفحة العقود" : "View in Leases Page"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {tenantLeases.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs text-slate-400 mb-2">{language === "ar" ? "لا توجد عقود مسجلة لهذا المستأجر" : "No active leases"}</p>
                  {onNavigateToLeases && (
                    <button
                      type="button"
                      onClick={() => onNavigateToLeases()}
                      className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 cursor-pointer"
                    >
                      {language === "ar" ? "+ إنشاء عقد جديد في صفحة العقود" : "+ New Lease in Leases"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "CHEQUES" && (
            <div className="space-y-3">
              {tenantCheques.map((chq) => (
                <div
                  key={chq.id}
                  className={`p-4 rounded-2xl border ${
                    chq.originalStatus === "BOUNCED"
                      ? "bg-rose-50/40 border-rose-200"
                      : "bg-white border-slate-200"
                  } shadow-2xs space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-bold text-slate-900 font-mono">#{chq.chequeNumber}</span>
                      <span className="text-[11px] text-slate-500">{chq.bankName}</span>
                    </div>
                    <Badge
                      variant={
                        chq.status === "BOUNCED"
                          ? "danger"
                          : chq.status === "COLLECTED"
                          ? "success"
                          : chq.status === "UNDER_LEGAL"
                          ? "purple"
                          : "neutral"
                      }
                      size="sm"
                    >
                      {chq.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="text-slate-400 me-1">{language === "ar" ? "المبلغ:" : "Amount:"}</span>
                      <span className="font-bold text-slate-900 font-mono">AED {chq.amount.toLocaleString()}</span>
                      {chq.outstanding > 0 && chq.outstanding < chq.amount && (
                        <span className="ms-2 text-[10px] text-amber-700 font-semibold">
                          (Outstanding: AED {chq.outstanding.toLocaleString()})
                        </span>
                      )}
                    </div>

                    {chq.originalStatus === "BOUNCED" && chq.outstanding > 0 && (
                      <button
                        onClick={() => handleSendReminder(chq.id)}
                        disabled={isSendingWhatsApp}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>{language === "ar" ? "تذكير واتساب" : "WhatsApp"}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {tenantCheques.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">No cheques recorded</p>}
            </div>
          )}

          {activeTab === "CASES" && (
            <div className="space-y-3">
              {tenantCases.map((cas) => (
                <div key={cas.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-slate-900">{cas.caseNumber}</span>
                    </div>
                    <Badge variant={cas.status === "CLOSED" ? "success" : "warning"} size="sm">
                      {cas.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600 grid grid-cols-2 gap-2">
                    <div>
                      {language === "ar" ? "المحكمة:" : "Court:"} <span>{cas.courtName}</span>
                    </div>
                    <div>
                      {language === "ar" ? "المطالبة المالية:" : "Claim:"}{" "}
                      <strong className="text-slate-900 font-mono">AED {cas.claimAmount.toLocaleString()}</strong>
                    </div>
                    <div>
                      {language === "ar" ? "الجلسات المسجلة:" : "Sessions:"} <span>{cas.sessions.length}</span>
                    </div>
                    <div>
                      {language === "ar" ? "تاريخ القيد:" : "Filing Date:"} <span>{cas.filingDate}</span>
                    </div>
                  </div>
                </div>
              ))}
              {tenantCases.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">No rental dispute cases</p>}
            </div>
          )}

          {activeTab === "ARCHIVE" && (
            <div className="space-y-3">
              {tenantDocs.map((doc, idx) => (
                <div key={`${doc.id}-${idx}`} className="p-3 rounded-2xl border border-slate-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FolderLock className="w-4 h-4 text-amber-700" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">{doc.fileName}</h5>
                      <span className="text-[10px] text-slate-400">{doc.category} — {doc.uploadDate}</span>
                    </div>
                  </div>
                  <Badge variant="info" size="sm">
                    {doc.fileSize}
                  </Badge>
                </div>
              ))}
              {tenantDocs.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">No KYC documents stored</p>}
            </div>
          )}
        </div>

        {/* AI Legal Notice Generator Modal */}
        <LegalNoticeGeneratorModal
          isOpen={isLegalNoticeOpen}
          onClose={() => setIsLegalNoticeOpen(false)}
          initialCheques={tenantBouncedCheques}
          initialTenant={tenant}
          defaultNoticeType={tenantBouncedCheques.length > 0 ? "EVICTION_NOTICE_30_DAYS" : "CHEQUE_PAYMENT_DEMAND"}
        />
      </div>
    </div>
  );
};
