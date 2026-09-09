import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Printer, X, CheckCircle2, Building2, Eye, Settings, Palette, FileText, Check, Edit3, Image, ShieldAlert, QrCode, Mail, MessageCircle, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { CollectionRecord, Cheque } from "../../types";
import { isCardPayment } from "../../utils/paymentUtils";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { CompanyLetterheadFrame, useCompanyLetterhead } from "../common/CompanyLetterheadFrame";
import {
  dispatchReceiptNotification,
  openWhatsAppDirect,
  formatWhatsAppReceipt,
} from "../../services/automatedEmailService";

interface ReceiptVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: CollectionRecord | null;
}

type ReceiptTheme = "blue" | "slate";

export const ReceiptVoucherModal: React.FC<ReceiptVoucherModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  const { language } = useLanguage();
  const { cheques, tenants, owners, properties, units, leases, collections, paymentAllocations, commissions, archive, companyProfile, logAudit } = useData();
  const { activeLetterhead, hasActiveLetterhead } = useCompanyLetterhead();

  const [printLanguage, setPrintLanguage] = useState<"ar" | "en">(language);

  // 1. Declare all Hooks unconditionally at the top-level
  const [orgNameAr, setOrgNameAr] = useState(companyProfile.nameAr);
  const [orgNameEn, setOrgNameEn] = useState(companyProfile.nameEn);
  const [orgTRN, setOrgTRN] = useState(companyProfile.vatTrn);
  const [customTitleAr, setCustomTitleAr] = useState("سند قبض مالي معتمد تحت الحساب");
  const [customTitleEn, setCustomTitleEn] = useState("Official Rental Collection Receipt");
  const [payerName, setPayerName] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [themeColor, setThemeColor] = useState<ReceiptTheme>("blue");
  const [showLogo, setShowLogo] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [showLetterhead, setShowLetterhead] = useState(true);
  const [showQrCode, setShowQrCode] = useState(true);
  const [activeTab, setActiveTab] = useState<"content" | "design">("content");
  const [isInsideIframe, setIsInsideIframe] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);

  const handleSendReceiptEmail = async () => {
    if (!receipt) return;
    const tnt = tenants.find(t => t.id === receipt.tenantId);
    const own = owners.find(o => o.id === receipt.ownerId);
    const chq = cheques.find(c => c.id === receipt.chequeId);
    const prp = properties.find(p => p.id === (chq ? chq.propertyId : undefined));
    const unt = units.find(u => u.id === (chq ? chq.unitId : undefined));

    if (!tnt?.email && !own?.email) {
      alert(language === "ar" ? "لا يوجد بريد إلكتروني مسجل للمستأجر أو المالك" : "No email found for tenant or owner");
      return;
    }

    setIsSendingEmail(true);
    setEmailStatusMessage(null);
    try {
      const res = await dispatchReceiptNotification({
        recipient: tnt?.email || own?.email || "",
        ownerEmail: own?.email,
        tenantNameAr: tnt?.nameAr || receipt.payerName,
        tenantNameEn: tnt?.nameEn || receipt.payerName,
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amountApplied,
        paymentMethod: receipt.paymentMethod,
        payerName: receipt.payerName,
        chequeNumber: chq?.chequeNumber || "N/A",
        chequeAmount: chq?.amount || 0,
        date: receipt.paymentDate,
        propertyName: prp ? (language === "ar" ? prp.nameAr : prp.nameEn) : "N/A",
        unitNumber: unt ? unt.unitNumber : "N/A",
        ownerName: own ? (language === "ar" ? own.nameAr : own.nameEn) : "N/A",
        remainingBalance: chq?.outstanding || 0,
      });

      if (res.success) {
        setEmailStatusMessage(language === "ar" ? "✅ تم إرسال الإيصال تلقائياً للمستأجر والمالك بنجاح!" : "✅ Receipt email sent successfully to tenant and owner!");
        setTimeout(() => setEmailStatusMessage(null), 4000);
      } else {
        alert(res.error || "Failed to send email");
      }
    } catch (err: any) {
      alert(err?.message || "Error dispatching receipt email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendReceiptWhatsApp = () => {
    if (!receipt) return;
    const tnt = tenants.find(t => t.id === receipt.tenantId);
    const chq = cheques.find(c => c.id === receipt.chequeId);
    const prp = properties.find(p => p.id === (chq ? chq.propertyId : undefined));
    const unt = units.find(u => u.id === (chq ? chq.unitId : undefined));

    const phone = tnt?.phone || "";
    if (!phone) {
      alert(language === "ar" ? "لا يوجد رقم هاتف مسجل للمستأجر" : "No phone number found for tenant");
      return;
    }

    const tntName = language === "ar" ? tnt?.nameAr || receipt.payerName : tnt?.nameEn || receipt.payerName;
    const propName = prp ? (language === "ar" ? prp.nameAr : prp.nameEn) : "";
    const unitNo = unt ? unt.unitNumber : "";

    const msg = formatWhatsAppReceipt(
      receipt.receiptNumber,
      tntName,
      receipt.amountApplied,
      propName,
      unitNo
    );

    openWhatsAppDirect(phone, msg);
  };

  React.useEffect(() => {
    setIsInsideIframe(window.self !== window.top);
  }, []);

  // Synchronize state and log view audit when receipt prop changes
  React.useEffect(() => {
    if (receipt) {
      setPayerName(receipt.payerName);
      setCollectedBy(receipt.collectedBy);
      setOrgNameAr(companyProfile.nameAr);
      setOrgNameEn(companyProfile.nameEn);
      setOrgTRN(companyProfile.vatTrn);
      setPrintLanguage(language);
      setCustomNotes(
        language === "ar"
          ? "الشيك خاضع للقبول والمقاصة النهائية من قبل البنك المسحوب عليه. يعتبر هذا السند ملغياً في حال ارتجاع الشيك لأي سبب."
          : "Receipt is subject to final clearing of the cheque by the respective bank. This receipt is void if the cheque is bounced."
      );
      logAudit(
        "DOCUMENT_VIEW",
        "COLLECTION",
        receipt.id,
        receipt.receiptNumber,
        `Viewed official receipt #${receipt.receiptNumber} (Financial Collection ID: ${receipt.id})`
      );
    }
  }, [receipt, language, companyProfile]);

  if (!receipt) return null;

  const cheque = cheques.find((c) => c.id === receipt.chequeId);
  const tenant = tenants.find((t) => t.id === receipt.tenantId);
  const owner = owners.find((o) => o.id === receipt.ownerId);

  const allocs = paymentAllocations.filter((a) => a.collectionId === receipt.id);

  let resolvedLeaseId = cheque?.leaseId;
  if (!resolvedLeaseId && allocs.length > 0) {
    for (const a of allocs) {
      if (a.targetType === "LEASE_INSTALLMENT") {
        resolvedLeaseId = a.targetId.split(":")[0];
        break;
      }
    }
  }
  const lease = leases.find((l) => l.id === resolvedLeaseId) || leases.find((l) => l.tenantId === receipt.tenantId);
  const prop = cheque
    ? properties.find((p) => p.id === cheque.propertyId)
    : lease
    ? properties.find((p) => p.id === lease.propertyId)
    : properties.find((p) => p.ownerId === receipt.ownerId);
  const unit = cheque
    ? units.find((u) => u.id === cheque.unitId)
    : lease
    ? units.find((u) => u.id === lease.unitId)
    : null;

  const archiveDoc = archive.find((a) => a.recordId === receipt.id || a.entityId === receipt.id);

  const totalReceived = receipt.amountEntered || receipt.amountApplied;
  const totalApplied = receipt.amountApplied;
  const unallocatedAmount = Math.max(0, totalReceived - totalApplied);

  const getPrintUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("printReceiptId", receipt.id);
    return url.toString();
  };

  // Calculate installment breakdown for this cheque
  const chequeCollections = cheque
    ? collections
        .filter((col) => col.chequeId === cheque.id)
        .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime())
    : [];

  const totalAmount = cheque ? cheque.amount : 0;
  const currentOutstanding = cheque ? cheque.outstanding : 0;

  const handlePrint = (langOverride?: "ar" | "en") => {
    if (receipt) {
      logAudit(
        "RECEIPT_PRINT",
        "COLLECTION",
        receipt.id,
        receipt.receiptNumber,
        `Printed / Exported official receipt #${receipt.receiptNumber} (Financial Collection ID: ${receipt.id})`
      );
    }
    if (langOverride) {
      setPrintLanguage(langOverride);
    }
    // Give react state a moment to reflect if language is overridden
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Color theme utility classes
  const themeClasses = {
    emerald: {
      border: "border-emerald-300",
      bg: "bg-emerald-50",
      text: "text-emerald-900",
      accent: "text-emerald-700",
      btn: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500",
      header: "bg-emerald-50/70 border-emerald-100",
    },
    amber: {
      border: "border-amber-300",
      bg: "bg-amber-50",
      text: "text-amber-900",
      accent: "text-amber-700",
      btn: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
      header: "bg-amber-50/70 border-amber-100",
    },
    blue: {
      border: "border-sky-300",
      bg: "bg-sky-50",
      text: "text-sky-900",
      accent: "text-sky-700",
      btn: "bg-sky-600 hover:bg-sky-700 focus:ring-sky-500",
      header: "bg-sky-50/70 border-sky-100",
    },
    slate: {
      border: "border-slate-300",
      bg: "bg-slate-50",
      text: "text-slate-900",
      accent: "text-slate-700",
      btn: "bg-slate-700 hover:bg-slate-800 focus:ring-slate-600",
      header: "bg-slate-100/70 border-slate-200",
    },
  };

  const activeTheme = themeClasses[themeColor];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === "ar" ? "تعديل وإصدار سند القبض الرسمي" : "Customize & Issue Official Receipt"}
      subtitle={language === "ar" ? "لوحة تعديل وتصميم إيصال الاستلام ومواصفات التصدير" : "Interactive customization panel for financial collection voucher"}
      icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
      maxWidth="5xl"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #voucher-print-area, #voucher-print-area * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #voucher-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 3rem !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            z-index: 9999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {isInsideIframe && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="space-y-1">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <span>⚠️ تنبيه لتشغيل الطباعة بنجاح</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 text-amber-950 rounded-md font-bold uppercase font-mono">iFrame Sandbox</span>
            </span>
            <p className="text-[11px] leading-relaxed text-amber-800">
              {language === "ar"
                ? "أنت تتصفح النظام داخل بيئة معاينة آمنة تمنع فتح شاشة الطباعة الخاصة بالمتصفح. يرجى فتح النظام في علامة تبويب جديدة مستقلة لتتمكن من الطباعة كـ PDF مباشرة."
                : "You are currently viewing the app inside a secure preview iFrame, which blocks browser print dialogs. Please open the app in a new tab to print successfully."}
            </p>
          </div>
          <a
            href={getPrintUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center"
          >
            <span>{language === "ar" ? "افتح في علامة تبويب جديدة ↗" : "Open in New Tab ↗"}</span>
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
        
        {/* Left Column: Customizer sidebar controls (hidden in print) */}
        <div className="lg:col-span-5 border-r border-slate-100 pr-0 lg:pr-6 space-y-4 no-print flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-600" />
              <span>{language === "ar" ? "أدوات التخصيص" : "Receipt Customizer"}</span>
            </h4>
            <div className="flex gap-1.5 p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "content" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {language === "ar" ? "المحتوى" : "Content"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("design")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "design" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {language === "ar" ? "التصميم" : "Design"}
              </button>
            </div>
          </div>

          {activeTab === "content" ? (
            <div className="space-y-4 flex-1">
              {/* Print Language Toggle */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {language === "ar" ? "لغة طباعة السند" : "Receipt Print Language"}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintLanguage("ar")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      printLanguage === "ar" 
                        ? "bg-amber-600 border-amber-600 text-white" 
                        : "bg-white border-slate-200 text-slate-500 hover:border-amber-300"
                    }`}
                  >
                    العربية
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintLanguage("en")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      printLanguage === "en" 
                        ? "bg-amber-600 border-amber-600 text-white" 
                        : "bg-white border-slate-200 text-slate-500 hover:border-amber-300"
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Organization Arabic name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {language === "ar" ? "اسم المؤسسة (بالعربية)" : "Organization Name (Arabic)"}
                </label>
                <input
                  type="text"
                  value={orgNameAr}
                  onChange={(e) => setOrgNameAr(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Organization English name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {language === "ar" ? "اسم المؤسسة (بالإنجليزية)" : "Organization Name (English)"}
                </label>
                <input
                  type="text"
                  value={orgNameEn}
                  onChange={(e) => setOrgNameEn(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* TRN Number */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {language === "ar" ? "الرقم الضريبي TRN" : "TRN / Tax Registration Number"}
                </label>
                <input
                  type="text"
                  value={orgTRN}
                  onChange={(e) => setOrgTRN(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Custom Titles */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {language === "ar" ? "العنوان بالعربية" : "Title (Arabic)"}
                  </label>
                  <input
                    type="text"
                    value={customTitleAr}
                    onChange={(e) => setCustomTitleAr(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {language === "ar" ? "العنوان بالإنجليزية" : "Title (English)"}
                  </label>
                  <input
                    type="text"
                    value={customTitleEn}
                    onChange={(e) => setCustomTitleEn(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800"
                  />
                </div>
              </div>

              {/* Payer and Cashier override */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {language === "ar" ? "اسم الدافع" : "Payer Name"}
                  </label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {language === "ar" ? "اسم المستلم المالي" : "Finance Collector"}
                  </label>
                  <input
                    type="text"
                    value={collectedBy}
                    onChange={(e) => setCollectedBy(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              {/* Custom notes / disclaimers */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {language === "ar" ? "شروط وملاحظات الإيصال" : "Voucher Notes & Terms"}
                </label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {/* Theme Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  <span>{language === "ar" ? "سمة اللون الرسمية" : "Official Color Theme"}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["blue", "slate"] as const).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setThemeColor(color)}
                      className={`relative h-10 rounded-xl flex items-center justify-center border capitalize transition-all cursor-pointer ${
                        themeColor === color
                          ? "border-slate-900 bg-white shadow-xs"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full ${
                        color === "blue" ? "bg-sky-600" : "bg-slate-700"
                      }`} />
                      {themeColor === color && (
                        <div className="absolute top-1 right-1 w-3 h-3 bg-slate-900 text-white rounded-full flex items-center justify-center">
                          <Check className="w-2 h-2" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo visibility and watermark options */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-500">
                  {language === "ar" ? "خيارات التصدير والعلامة المائية" : "Export & Visual Branding"}
                </label>
                
                <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLetterhead}
                    onChange={(e) => setShowLetterhead(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 block">
                        {language === "ar" ? "خلفية الورقة الرسمية للشركة" : "Company Letterhead Background"}
                      </span>
                      {hasActiveLetterhead && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                          {language === "ar" ? "قالب نشط" : "Active Template"}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {hasActiveLetterhead
                        ? (language === "ar"
                            ? `تطبيق الورقة الرسمية (${activeLetterhead?.fileName || "القالب المعتمد"}) كخلفية لسند القبض`
                            : `Applies official letterhead template (${activeLetterhead?.fileName}) as receipt background`)
                        : (language === "ar"
                            ? "لم يتم تفعيل قالب ورقة رسمية بعد من إعدادات الشركة"
                            : "No active letterhead template found in company settings")}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLogo}
                    onChange={(e) => setShowLogo(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {language === "ar" ? "إظهار شعار الشركة" : "Show Corporate Logo"}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {language === "ar" ? "تضمين الشعار المعتمد في الزاوية العلوية" : "Includes verified branding on the header"}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {language === "ar" ? "تضمين علامة مائية (مدفوع)" : "Include Paid Watermark"}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {language === "ar" ? "طباعة ختم PAID مائل خلف السند" : "Prints diagonal 'PAID' stamp behind the voucher"}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {language === "ar" ? "تضمين رمز الاستجابة السريعة (QR Code)" : "Include Verification QR Code"}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {language === "ar" ? "يتيح للمستأجرين مسح السند والتحقق الفوري" : "Enables instant smartphone payment verification"}
                    </span>
                  </div>
                </label>
              </div>

              {/* Instructions Box */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-amber-900">
                <span className="text-xs font-bold block">{language === "ar" ? "تصدير وطباعة PDF:" : "Export & PDF Print Instructions:"}</span>
                <p className="text-[10px] leading-relaxed">
                  {language === "ar"
                    ? "عند نقر زر 'تصدير كـ PDF' بالأسفل، يرجى اختيار 'حفظ بتنسيق PDF' (Save as PDF) في وجهة الطابعة، وتفعيل خيار 'خلفيات الرسوم' (Background graphics) في الإعدادات الإضافية للحفاظ على جمالية وهوية السند الملون."
                    : "When clicking 'Export & Print PDF' below, please select 'Save as PDF' in the destination dropdown and make sure to enable 'Background graphics' in the browser settings to keep the rich colors."}
                </p>
              </div>
            </div>
          )}

          {/* Email Dispatch Section */}
        </div>

        {/* Right Column: Live Interactive PDF Preview Area */}
        <div className="lg:col-span-7 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 mb-2 justify-between no-print border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>{language === "ar" ? "معاينة السند المباشرة" : "Live PDF Print Preview"}</span>
            </span>

            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer border ${
                isEditMode
                  ? "bg-amber-600 text-white border-amber-700 shadow-sm animate-pulse"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditMode ? (language === "ar" ? "إيقاف التعديل" : "Lock Edit") : (language === "ar" ? "✏️ التعديل المباشر" : "✏️ Live Edit")}</span>
            </button>
          </div>

          <div className="flex-1 bg-slate-100 p-4 rounded-2xl border border-slate-200 overflow-y-auto max-h-[550px] relative">
            
            {/* Real printable document wrapper */}
            <div
              id="voucher-print-area"
              className={`rounded-xl shadow-xs border border-slate-200/60 printable-voucher relative min-h-[620px] overflow-hidden ${
                showLetterhead && hasActiveLetterhead ? "bg-white/90 backdrop-blur-[1px]" : "bg-white"
              }`}
            >
              <CompanyLetterheadFrame showLetterhead={showLetterhead} className="min-h-[620px] h-full p-6 sm:p-8 flex flex-col justify-between">
                {/* Optional Background Watermark */}
                {showWatermark && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] overflow-hidden select-none z-0">
                    <span className="text-[120px] font-black tracking-widest uppercase rotate-315 select-none font-sans text-emerald-950">
                      PAID / مدفوع
                    </span>
                  </div>
                )}

              <div className="space-y-6 relative z-10">
                {/* Official Customized Header */}
                <div className={`p-4 border-b-2 border-slate-800 flex items-start justify-between rounded-xl ${activeTheme.header}`}>
                  <div className="flex items-center gap-3">
                    {showLogo && (
                      <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm ring-2 ring-white shrink-0 bg-white flex items-center justify-center p-0.5">
                        <img 
                          src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo} 
                          alt="Company Logo" 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                    )}
                    <div>
                      <h3 
                        contentEditable={isEditMode}
                        suppressContentEditableWarning
                        onBlur={(e) => printLanguage === "ar" ? setOrgNameAr(e.currentTarget.textContent || "") : setOrgNameEn(e.currentTarget.textContent || "")}
                        className={`text-xs sm:text-sm font-black text-slate-900 leading-tight ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded px-1" : ""}`}
                      >
                        {language === "ar" ? orgNameAr : orgNameEn}
                      </h3>
                      <p 
                        contentEditable={isEditMode}
                        suppressContentEditableWarning
                        onBlur={(e) => printLanguage === "ar" ? setCustomTitleAr(e.currentTarget.textContent || "") : setCustomTitleEn(e.currentTarget.textContent || "")}
                        className={`text-[10px] font-bold ${activeTheme.accent} mt-0.5 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded px-1" : ""}`}
                      >
                        {language === "ar" ? customTitleAr : customTitleEn}
                      </p>
                      {orgTRN && (
                        <p 
                          contentEditable={isEditMode}
                          suppressContentEditableWarning
                          onBlur={(e) => setOrgTRN(e.currentTarget.textContent || "")}
                          className={`text-[9px] text-slate-500 font-mono mt-0.5 ${isEditMode ? "outline-dashed outline-1 outline-amber-400 bg-amber-50/50 rounded px-1" : ""}`}
                        >
                          TRN: {orgTRN} | UAE
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">
                      {printLanguage === "ar" ? "رقم السند" : "Receipt No."}
                    </span>
                    <span className="text-sm font-black text-slate-900 font-mono">{receipt.receiptNumber}</span>
                    <span className="text-[9px] text-slate-500 block font-mono mt-0.5">{receipt.paymentDate}</span>
                  </div>
                </div>

                {/* Reversal / Void Warning Banner */}
                {receipt.isReversed && (
                  <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-center space-y-1">
                    <div className="text-rose-900 font-black text-xs uppercase flex items-center justify-center gap-1.5 font-sans">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>{printLanguage === "ar" ? "سند ملغى ومحسوم (VOID / REVERSED)" : "VOID / REVERSED RECEIPT"}</span>
                    </div>
                    <div className="text-[10px] text-rose-700 font-bold">
                      {printLanguage === "ar"
                        ? `تاريخ الإلغاء: ${receipt.reversalDate || "غير محدد"} — سبب الإلغاء: ${receipt.reversalReason || "تسوية عكسية"}`
                        : `Cancelled Date: ${receipt.reversalDate || "N/A"} — Reason: ${receipt.reversalReason || "Financial Reversal"}`}
                    </div>
                  </div>
                )}

                {/* Amount Highlight Box */}
                <div className={`p-4 border rounded-xl flex items-center justify-between ${activeTheme.bg} ${activeTheme.border}`}>
                  <div>
                    <span className={`text-[10px] font-bold block uppercase ${activeTheme.accent}`}>
                      {printLanguage === "ar" ? "المبلغ المقبوض الفعلي" : "Total Amount Received"}
                    </span>
                    <span className={`text-2xl font-black font-mono ${activeTheme.text}`}>
                      AED {totalReceived.toLocaleString()}
                    </span>
                    {unallocatedAmount > 0 && (
                      <span className="text-[10px] text-amber-800 bg-amber-100 font-bold px-2 py-0.5 rounded-md border border-amber-300 block mt-1">
                        {printLanguage === "ar"
                          ? `دفعة مقدمة غير مخصصة: AED ${unallocatedAmount.toLocaleString()}`
                          : `Unallocated Advance: AED ${unallocatedAmount.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  <div className="text-end space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 block">
                      {printLanguage === "ar" ? "طريقة الدفع" : "Payment Method"}
                    </span>
                    <span className="text-xs font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block font-mono">
                      {receipt.paymentMethod.replace("_", " ")}
                    </span>
                    {(isCardPayment(receipt.paymentMethod) || receipt.approvalCode) && (
                      <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-mono font-bold">
                        {printLanguage === "ar" ? "رمز الموافقة:" : "Approval Code:"} {receipt.approvalCode || receipt.transactionReference || "APPROVED"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Customizable Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                    <h5 className="font-bold text-slate-900 border-b border-slate-200/80 pb-1">
                      {printLanguage === "ar" ? "بيانات المستأجر والدافع" : "Tenant & Payer Details"}
                    </h5>
                    <div>
                      <span className="text-slate-400 block text-[9px]">{printLanguage === "ar" ? "المستأجر:" : "Tenant:"}</span>
                      <span className="font-bold text-slate-800">
                        {tenant ? (printLanguage === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">{printLanguage === "ar" ? "اسم القائم بالدفع:" : "Payer Name:"}</span>
                      <span className="font-semibold text-slate-800">{payerName}</span>
                    </div>
                    {receipt.transactionReference && (
                      <div>
                        <span className="text-slate-400 block text-[9px]">{printLanguage === "ar" ? "مرجع المعاملة / البنك:" : "Ref / Auth Code:"}</span>
                        <span className="font-mono text-slate-800">{receipt.transactionReference}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                    <h5 className="font-bold text-slate-900 border-b border-slate-200/80 pb-1">
                      {printLanguage === "ar" ? "بيانات العقار والشيك الإيجاري" : "Property & Cheque Details"}
                    </h5>
                    <div>
                      <span className="text-slate-400 block text-[9px]">{printLanguage === "ar" ? "العقار والوحدة:" : "Property / Unit:"}</span>
                      <span className="font-bold text-slate-800">
                        {prop ? (printLanguage === "ar" ? prop.nameAr : prop.nameEn) : "Property"} {unit ? `- Unit #${unit.unitNumber}` : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">{printLanguage === "ar" ? "المالك المستفيد:" : "Owner:"}</span>
                      <span className="font-semibold text-slate-800">
                        {owner ? (printLanguage === "ar" ? owner.nameAr : owner.nameEn) : "Owner"}
                      </span>
                    </div>
                    {lease && (
                      <div>
                        <span className="text-slate-400 block text-[9px]">{printLanguage === "ar" ? "رقم العقد:" : "Lease Contract #:"}</span>
                        <span className="font-mono font-bold text-slate-800">{lease.leaseNumber}</span>
                      </div>
                    )}
                    {cheque && (
                      <div>
                        <span className="text-slate-400 block text-[9px]">{printLanguage === "ar" ? "مرجع الشيك الإيجاري:" : "Ref Cheque #:"}</span>
                        <span className="font-mono font-bold text-slate-900">#{cheque.chequeNumber} ({cheque.bankName})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Target Allocations Breakdown Table */}
                {allocs.length > 0 && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
                    <h5 className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-700" />
                        <span>{printLanguage === "ar" ? "تفاصيل وتوزيع الدفعة المالية" : "Payment Allocations Breakdown"}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        AED {totalApplied.toLocaleString()}
                      </span>
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] text-start">
                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-1 px-2 text-start">{printLanguage === "ar" ? "الشيك المستهدف" : "Target Cheque"}</th>
                            <th className="py-1 px-2 text-start">{printLanguage === "ar" ? "الوصف" : "Description"}</th>
                            <th className="py-1 px-2 text-end">{printLanguage === "ar" ? "المبلغ المخصص (AED)" : "Allocated (AED)"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allocs.map((alloc) => {
                            let targetName = alloc.targetType.replace(/_/g, " ");
                            if (alloc.targetType === "LEASE_INSTALLMENT") {
                              const instNum = alloc.targetId.split(":")[1];
                              targetName = printLanguage === "ar" ? `قسط إيجاري رقم ${instNum}` : `Lease Installment #${instNum}`;
                            } else if (alloc.targetType === "COMMISSION") {
                              targetName = printLanguage === "ar" ? "عمولة / رسوم إدارة" : "Commission / Admin Fee";
                            } else if (alloc.targetType === "CHEQUE") {
                              targetName = printLanguage === "ar" ? "تسوية شيك" : "Cheque Settlement";
                            }
                            return (
                              <tr key={alloc.id}>
                                <td className="py-1 px-2 font-bold text-slate-800">{targetName}</td>
                                <td className="py-1 px-2 text-slate-600">{alloc.targetDescription || alloc.targetId}</td>
                                <td className="py-1 px-2 text-end font-mono font-bold text-slate-900">AED {alloc.allocatedAmount.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Installment History & Remaining Balance Area */}
                {cheque && chequeCollections.length > 0 && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2.5">
                    <h5 className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        <span>{printLanguage === "ar" ? "سجل الدفعات والأقساط المحصلة للشيك" : "Cheque Installments & Payments Log"}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {printLanguage === "ar" ? `القيمة الإجمالية: AED ${totalAmount.toLocaleString()}` : `Total Amount: AED ${totalAmount.toLocaleString()}`}
                      </span>
                    </h5>
                    
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {chequeCollections.map((col, idx) => {
                        const isCurrent = col.id === receipt.id;
                        return (
                          <div
                            key={col.id}
                            className={`flex items-center justify-between p-2 rounded-lg text-[10px] transition-all ${
                              isCurrent 
                                ? "bg-amber-100/50 border border-amber-300 font-bold text-amber-900 shadow-2xs" 
                                : "bg-white border border-slate-100 text-slate-600"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono">#{idx + 1}</span>
                              <span className="font-mono font-semibold">{col.receiptNumber}</span>
                              <span className="text-slate-400 font-mono">{col.paymentDate}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="bg-slate-100 text-slate-500 text-[8px] px-1.5 py-0.5 rounded uppercase font-mono">{col.paymentMethod.replace("_", " ")}</span>
                              <span className="font-mono font-bold text-slate-900">AED {col.amountApplied.toLocaleString()}</span>
                              {isCurrent && (
                                <span className="text-[8px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-black uppercase">
                                  {printLanguage === "ar" ? "الحالي" : "Current"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-[10px] font-bold gap-2">
                      <div className="text-slate-500 flex items-center gap-1">
                        <span>{printLanguage === "ar" ? "إجمالي المسدد:" : "Total Paid:"}</span>
                        <span className="text-slate-900 font-mono">AED {(totalAmount - currentOutstanding).toLocaleString()}</span>
                      </div>
                      <div className="text-amber-800 flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                        <span>{printLanguage === "ar" ? "الرصيد المتبقي المستحق:" : "Remaining Outstanding Balance:"}</span>
                        <span className="font-mono text-xs text-amber-900 font-black">AED {currentOutstanding.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Notes & Conditions */}
                {customNotes && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-[10px] leading-relaxed text-slate-500">
                    <strong className="block text-slate-700 font-bold mb-0.5">{printLanguage === "ar" ? "ملاحظات هامة:" : "Important Disclaimers:"}</strong>
                    {customNotes}
                  </div>
                )}
              </div>

              {/* QR Code Verification Widget for Smartphone Scanning */}
              {showQrCode && (
                <div className="mt-6 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <QrCode className="w-4 h-4 text-amber-600" />
                      <span>{printLanguage === "ar" ? "التحقق الرقمي السريع (QR)" : "Instant Digital QR Verification"}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 max-w-[280px] leading-relaxed">
                      {printLanguage === "ar"
                        ? "امسح الرمز بكاميرا الهاتف الذكي للتحقق من صحة واعتماد هذا السند المالي لدى شركة إمارات فالكون."
                        : "Scan with smartphone camera to instantly verify payment authenticity with Emirates Falcon."}
                    </p>
                    <div className="text-[9px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                      VERIFY ID: #{receipt.receiptNumber} | AED {totalReceived.toLocaleString()}
                    </div>
                  </div>
                  <div className="w-20 h-20 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center">
                    <QRCode
                      value={`${window.location.origin}/verify/receipt/${receipt.id}`}
                      size={68}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Automated Transaction Message & Electronic Archive Doc Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-center">
                <p className="text-[9px] text-slate-400 font-semibold italic">
                  {printLanguage === "ar" 
                    ? `هذا إشعار تلقائي بعملية معاملة من ${companyProfile.nameAr}.` 
                    : `This is an automated transaction message from ${companyProfile.nameEn}.`}
                </p>
                <div className="flex flex-wrap items-center justify-between text-[8px] text-slate-400 font-mono px-2">
                  <span>{printLanguage === "ar" ? `معرف المعاملة: ${receipt.id}` : `Transaction ID: ${receipt.id}`}</span>
                  <span>{printLanguage === "ar" ? `مرجع الأرشيف: ${archiveDoc ? archiveDoc.id : 'doc-rcp-' + receipt.receiptNumber}` : `Archive Ref: ${archiveDoc ? archiveDoc.id : 'doc-rcp-' + receipt.receiptNumber}`}</span>
                </div>
              </div>

              {/* Signatures at Bottom */}
              <div className="pt-8 border-t border-slate-100 grid grid-cols-2 gap-8 text-center text-[10px] mt-8">
                <div>
                  <div className="border-b border-slate-300 pb-8 text-slate-400 italic">
                    {printLanguage === "ar" ? "توقيع المحصل المالي" : "Collector Signature"}
                  </div>
                  <p className="mt-2 font-bold text-slate-800">{collectedBy}</p>
                  <p className="text-[9px] text-slate-400">{printLanguage === "ar" ? "قسم الخزينة والمالية" : "Treasury Department"}</p>
                </div>

                <div>
                  <div className="border-b border-slate-300 pb-8 text-slate-400 italic">
                    {printLanguage === "ar" ? "توقيع الدافع / المستأجر" : "Payer / Tenant Signature"}
                  </div>
                  <p className="mt-2 font-bold text-slate-800">{payerName}</p>
                  <p className="text-[9px] text-slate-400">{printLanguage === "ar" ? "إقرار باستلام السند" : "Acknowledge receipt"}</p>
                </div>
              </div>

              </CompanyLetterheadFrame>
            </div>
          </div>
        </div>

      </div>

      {/* Action Buttons (Hidden in print) */}
      <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {isInsideIframe && (
            <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1.5">
              <span>⚠️ تنبيه: يرجى الضغط على زر "افتح للطباعة ↗" لتفعيل نافذة الطباعة.</span>
            </span>
          )}
          {emailStatusMessage && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-in fade-in">
              {emailStatusMessage}
            </span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-2 self-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            {language === "ar" ? "إغلاق" : "Close"}
          </button>

          {/* Quick WhatsApp Dispatch */}
          <button
            type="button"
            onClick={handleSendReceiptWhatsApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
            title={language === "ar" ? "إرسال تفاصيل الإيصال عبر واتساب للمستأجر" : "Send receipt details via WhatsApp"}
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>{language === "ar" ? "واتساب" : "WhatsApp"}</span>
          </button>

          {/* Quick Automated Email Dispatch */}
          <button
            type="button"
            disabled={isSendingEmail}
            onClick={handleSendReceiptEmail}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title={language === "ar" ? "إرسال الإيصال المالي تلقائياً لكل من المستأجر والمالك" : "Send receipt email to Tenant & Owner"}
          >
            {isSendingEmail ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 text-blue-600" />
            )}
            <span>
              {isSendingEmail
                ? language === "ar" ? "جاري الإرسال..." : "Sending..."
                : language === "ar" ? "إرسال إيميل تلقائي" : "Auto-Email"}
            </span>
          </button>

          {isInsideIframe ? (
            <a
              href={getPrintUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors text-center"
            >
              <Printer className="w-4 h-4" />
              <span>{language === "ar" ? "افتح للطباعة ↗" : "Open to Print ↗"}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => handlePrint()}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${activeTheme.btn}`}
            >
              <Printer className="w-4 h-4" />
              <span>{language === "ar" ? "تصدير وطباعة PDF" : "Export & Print PDF"}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
