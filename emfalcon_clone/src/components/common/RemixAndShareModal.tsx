import React, { useState } from "react";
import {
  Share2,
  Sparkles,
  GitFork,
  Copy,
  Check,
  Download,
  Upload,
  ExternalLink,
  ShieldCheck,
  X,
  Send,
  Lock,
  QrCode,
  FileCode2,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";

interface RemixAndShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemixAndShareModal: React.FC<RemixAndShareModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const { currentUser, canRemixAndShare } = useAuth();
  const { exportDatabaseJSON, importDatabaseJSON } = useData();

  const [activeTab, setActiveTab] = useState<"SHARE" | "REMIX">("SHARE");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  if (!isOpen) return null;

  const appUrl = window.location.origin || "https://ais-pre-rfvgsztf7bn4dvu432pnlk-405724254259.europe-west3.run.app";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyInvite = () => {
    const inviteText = language === "ar"
      ? `رابط الوصول لنظام إدارة الصكوك المعتمد (Falcon System):\n${appUrl}\n\nاسم المستخدم للوصول: ${currentUser?.username || "mahmoud"}`
      : `Access link for Falcon Real Estate & Cheques Management System:\n${appUrl}\n\nUser: ${currentUser?.username || "mahmoud"}`;
    navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Falcon Real Estate & Cheques Management System",
          text: language === "ar" ? "نظام إدارة العقارات والشيكات والمطالبات المالية" : "Real Estate & Cheques Dispute Management System",
          url: appUrl,
        });
      } catch (e) {
        console.error("Native share failed or cancelled", e);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(
      language === "ar"
        ? `رابط نظام إدارة العقارات والشيكات (Falcon System):\n${appUrl}`
        : `Falcon Real Estate & Cheques System:\n${appUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleExportRemix = () => {
    try {
      const jsonStr = exportDatabaseJSON();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Falcon_Remix_State_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({
        type: "success",
        message: language === "ar" ? "تم تصدير حزمة الريمكس وتنزيل ملف الحالة بنجاح!" : "Remix package exported successfully!",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: language === "ar" ? "فشل تصدير ملف الريمكس" : "Failed to export remix file",
      });
    }
  };

  const handleImportRemix = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const ok = importDatabaseJSON(content);
        if (ok) {
          setFeedback({
            type: "success",
            message: language === "ar" ? "تم استيراد حزمة الريمكس وتحديث النظام بنجاح!" : "Remix state restored successfully!",
          });
        } else {
          setFeedback({
            type: "error",
            message: language === "ar" ? "صيغة حزمة الريمكس غير صالحة" : "Invalid remix file format",
          });
        }
      } catch (err) {
        setFeedback({
          type: "error",
          message: language === "ar" ? "خطأ في قراءة حزمة الريمكس" : "Error reading remix package",
        });
      }
    };
    reader.readAsText(file);
  };

  // Guard access if not authorized
  if (!canRemixAndShare) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-rose-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center font-bold">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-black text-slate-900 text-lg">
            {language === "ar" ? "غير مصرح بالوصول" : "Access Restricted"}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {language === "ar"
              ? "عذراً! ميزة المشاركة وإعادة النسخ (Remix & Share) مقتصرة حصرياً على المسؤول الرئيسي ومبتكر النظام فقط."
              : "Remix & Share features are strictly restricted to Super Admin and System Creator only."}
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            {language === "ar" ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-md">
              <GitFork className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">
                  {language === "ar" ? "خيارات المشاركة والريمكس (Remix & Share)" : "Remix & Share Console"}
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                  <span>{language === "ar" ? "حصري للمسؤول" : "Super Admin Only"}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {language === "ar"
                  ? "مشاركة التطبيق، تصدير واستيراد حزمة الريمكس للمسؤول الرئيسي ومبتكر النظام"
                  : "Share application link & export/import complete Remix package"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab("SHARE")}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "SHARE"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Share2 className="w-4 h-4 text-amber-600" />
            <span>{language === "ar" ? "مشاركة التطبيق (Share App)" : "Share App"}</span>
          </button>
          <button
            onClick={() => setActiveTab("REMIX")}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "REMIX"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <GitFork className="w-4 h-4 text-amber-600" />
            <span>{language === "ar" ? "إعادة النسخ والريمكس (Remix State)" : "Remix State"}</span>
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
          </div>
        )}

        {/* TAB 1: SHARE */}
        {activeTab === "SHARE" && (
          <div className="space-y-4 text-xs">
            {/* Direct App Link */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                {language === "ar" ? "رابط تشغيل التطبيق (Application URL)" : "Application Live URL"}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={appUrl}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? (language === "ar" ? "تم النسخ" : "Copied") : (language === "ar" ? "نسخ الرابط" : "Copy")}</span>
                </button>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                onClick={handleCopyInvite}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-800 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Copy className="w-5 h-5 text-amber-600" />
                <span>{copiedInvite ? (language === "ar" ? "تم نسخ الدعوة" : "Copied!") : (language === "ar" ? "نسخ نص الدعوة" : "Copy Invite")}</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl font-bold text-emerald-800 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Send className="w-5 h-5 text-emerald-600" />
                <span>{language === "ar" ? "إرسال واتساب" : "WhatsApp"}</span>
              </button>

              <button
                onClick={handleNativeShare}
                className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl font-bold text-blue-800 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all col-span-2 sm:col-span-1"
              >
                <Share2 className="w-5 h-5 text-blue-600" />
                <span>{language === "ar" ? "مشاركة النظام" : "Native Share"}</span>
              </button>
            </div>

            {/* QR Code toggle */}
            <div className="pt-2">
              <button
                onClick={() => setShowQR(!showQR)}
                className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold border border-amber-200 rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <QrCode className="w-4 h-4 text-amber-700" />
                <span>{showQR ? (language === "ar" ? "إخفاء رمز QR" : "Hide QR Code") : (language === "ar" ? "عرض رمز QR للمسح المباشر" : "Show QR Code")}</span>
              </button>

              {showQR && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-36 h-36 bg-white border-2 border-slate-900 rounded-2xl mx-auto flex items-center justify-center p-2 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(appUrl)}`}
                      alt="QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {language === "ar" ? "امسح رمز QR بواسطة كاميرا الهاتف للانتقال المباشر للنظام" : "Scan QR code with phone camera to open app"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: REMIX STATE */}
        {activeTab === "REMIX" && (
          <div className="space-y-4 text-xs">
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-700" />
                <span>{language === "ar" ? "إعادة نسخ وحفظ حزمة الريمكس (Remix Snapshot)" : "Remix & Clone Application State"}</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {language === "ar"
                  ? "تتيح لك هذه الأداة كمسؤول رئيسي ومبتكر النظام تصدير وتأمين كامل قاعدة البيانات بحالة ريمكس جاهزة للتشغيل."
                  : "Export full database, properties, tenants, and audit logs as a self-contained Remix bundle."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Export Remix */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
                    <Download className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900">{language === "ar" ? "تصدير حزمة الريمكس" : "Export Remix Package"}</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {language === "ar" ? "تحميل ملف JSON يحتوي كافة بيانات وحالة النظام الحالية." : "Download full system JSON backup."}
                  </p>
                </div>
                <button
                  onClick={handleExportRemix}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{language === "ar" ? "تصدير حزمة الريمكس" : "Export Remix JSON"}</span>
                </button>
              </div>

              {/* Import Remix */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900">{language === "ar" ? "استيراد حزمة ريمكس" : "Import Remix Package"}</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {language === "ar" ? "استعادة حالة نظام سابقة من ملف ريمكس محلي." : "Upload & apply a saved remix snapshot."}
                  </p>
                </div>
                <label className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-center">
                  <Upload className="w-4 h-4" />
                  <span>{language === "ar" ? "رفع ملف الريمكس" : "Upload Remix JSON"}</span>
                  <input type="file" accept=".json" onChange={handleImportRemix} className="hidden" />
                </label>
              </div>
            </div>

            <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-slate-500" />
                <span>{language === "ar" ? "معرّف التطبيق بالبيئة (Applet ID):" : "AI Studio Applet ID:"}</span>
              </div>
              <span className="font-mono font-bold text-slate-800">1f3ed13b-ad6e-42e5-91b7-9eb0225a5b58</span>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-bold">
            {language === "ar" ? "صلاحية حصرية للمسؤول ومبتكر النظام" : "Exclusive to Super Admin & System Creator"}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors text-xs"
          >
            {language === "ar" ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
};
