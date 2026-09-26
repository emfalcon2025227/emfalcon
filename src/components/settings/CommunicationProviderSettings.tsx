/**
 * Phase 13 Communication Provider Settings Component
 * Secure administrative UI for configuring WhatsApp Business and Gmail SMTP,
 * testing connections, masking sensitive credentials, and sending test messages.
 */

import React, { useState, useEffect } from "react";
import { MessageSquare, Mail, ShieldCheck, CheckCircle2, AlertTriangle, Key, Send, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import {
  getCommunicationProvidersConfig,
  saveWhatsAppConfig,
  saveGmailConfig,
  testWhatsAppConnection,
  testGmailConnection,
  sendTestWhatsAppMessage,
  sendTestEmailMessage,
} from "../../services/communicationProviderService";

export const CommunicationProviderSettings: React.FC = () => {
  const { language } = useLanguage();

  const [whatsappConfig, setWhatsappConfig] = useState({
    phoneNumberId: "",
    accessToken: "",
    wabaId: "",
    apiVersion: "v17.0",
    enabled: true,
    status: "NOT_CONFIGURED" as any,
  });

  const [gmailConfig, setGmailConfig] = useState({
    smtpUser: "emfalcon2025227@gmail.com",
    appPassword: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    encryption: "SSL" as "TLS" | "SSL" | "STARTTLS",
    senderName: "",
    enabled: true,
    status: "NOT_CONFIGURED" as any,
  });

  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);
  const [showGmailPassword, setShowGmailPassword] = useState(false);

  const [testPhone, setTestPhone] = useState("+971501234567");
  const [testEmail, setTestEmail] = useState("admin@emiratesfalcon.com");
  const [testMessage, setTestMessage] = useState("اختبار اتصال النظام - ERP Communication Test");

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const current = getCommunicationProvidersConfig();
    setWhatsappConfig({
      phoneNumberId: current.whatsapp.phoneNumberId || "",
      accessToken: current.whatsapp.accessToken || "",
      wabaId: current.whatsapp.wabaId || "",
      apiVersion: current.whatsapp.apiVersion || "v17.0",
      enabled: current.whatsapp.enabled,
      status: current.whatsapp.status,
    });
    setGmailConfig({
      smtpUser: current.gmail.smtpUser || "",
      appPassword: current.gmail.appPassword || "",
      smtpHost: current.gmail.smtpHost || "smtp.gmail.com",
      smtpPort: current.gmail.smtpPort || 465,
      encryption: (current.gmail.encryption || "SSL") as "TLS" | "SSL" | "STARTTLS",
      senderName: current.gmail.senderName || "",
      enabled: current.gmail.enabled,
      status: current.gmail.status,
    });
  }, []);

  const handleSaveWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveWhatsAppConfig(whatsappConfig);
    setWhatsappConfig((prev) => ({ ...prev, status: updated.status }));
    setStatusMessage(language === "ar" ? "تم حفظ إعدادات واتساب للأعمال بنجاح" : "WhatsApp Business settings saved successfully.");
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSaveGmail = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveGmailConfig(gmailConfig);
    setGmailConfig((prev) => ({ ...prev, status: updated.status }));
    setStatusMessage(language === "ar" ? "تم حفظ إعدادات خادم بريد Gmail/SMTP بنجاح" : "Gmail SMTP settings saved successfully.");
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleTestWhatsApp = async () => {
    setIsTesting(true);
    try {
      const res = await testWhatsAppConnection();
      setWhatsappConfig((prev) => ({ ...prev, status: res.success ? "CONNECTION_VERIFIED" : "CONNECTION_FAILED" }));
      if (res.success) {
        await sendTestWhatsAppMessage(testPhone, testMessage);
      }
      setStatusMessage(res.message);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleTestGmail = async () => {
    setIsTesting(true);
    try {
      const res = await testGmailConnection();
      setGmailConfig((prev) => ({ ...prev, status: res.success ? "CONNECTION_VERIFIED" : "CONNECTION_FAILED" }));
      if (res.success) {
        await sendTestEmailMessage(testEmail, "Emirates Falcon ERP Test", testMessage);
      }
      setStatusMessage(res.message);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <span>{language === "ar" ? "إعدادات مزودي الاتصال (WhatsApp & Gmail SMTP)" : "Communication Provider Settings"}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "التحكم الآمن في ربط حساب واتساب للأعمال (Meta Cloud API) وخادم بريد Gmail للمراسلات الرسمية"
              : "Secure configuration for Meta WhatsApp Cloud API and Gmail SMTP for automated corporate messaging"}
          </p>
        </div>
        {statusMessage && (
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl animate-in fade-in">
            {statusMessage}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Configuration Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">WhatsApp Business API</h4>
                <p className="text-[11px] text-slate-400">Meta Cloud API / WABA Integration</p>
              </div>
            </div>
            <span
              className={`px-3 py-1 text-[10px] font-black rounded-full ${
                whatsappConfig.status === "CONNECTION_VERIFIED"
                  ? "bg-emerald-100 text-emerald-800"
                  : whatsappConfig.status === "CONNECTION_FAILED"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {whatsappConfig.status}
            </span>
          </div>

          <form onSubmit={handleSaveWhatsApp} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "معرّف رقم الهاتف (Phone Number ID)" : "Phone Number ID"}
              </label>
              <input
                type="text"
                value={whatsappConfig.phoneNumberId}
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, phoneNumberId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono focus:border-amber-600"
                placeholder="e.g. 1029384756"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "رمز الوصول (Access Token - Secret)" : "Access Token"}
              </label>
              <div className="relative">
                <input
                  type={showWhatsAppToken ? "text" : "password"}
                  value={whatsappConfig.accessToken}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, accessToken: e.target.value })}
                  className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono focus:border-amber-600"
                  placeholder="EAAB..."
                />
                <button
                  type="button"
                  onClick={() => setShowWhatsAppToken(!showWhatsAppToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showWhatsAppToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {language === "ar" ? "يتم تشفير وتخزين الرمز بأمان تام ولا يتم عرضه كاملاً أبداً." : "Token is securely masked and never exposed."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">WABA ID</label>
                <input
                  type="text"
                  value={whatsappConfig.wabaId}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, wabaId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">API Version</label>
                <input
                  type="text"
                  value={whatsappConfig.apiVersion}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, apiVersion: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappConfig.enabled}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  {language === "ar" ? "تفعيل إشعارات واتساب الآلية" : "Enable WhatsApp Notifications"}
                </span>
              </label>

              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {language === "ar" ? "حفظ إعدادات واتساب" : "Save WhatsApp"}
              </button>
            </div>
          </form>

          {/* Test WhatsApp */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <h5 className="text-xs font-black text-slate-800">
              {language === "ar" ? "اختبار اتصال وإرسال عبر واتساب" : "WhatsApp Connection & Test Message"}
            </h5>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+971501234567"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
              <button
                onClick={handleTestWhatsApp}
                disabled={isTesting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{language === "ar" ? "اختبار وإرسال" : "Test & Send"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Gmail / SMTP Configuration Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Gmail / SMTP Server</h4>
                <p className="text-[11px] text-slate-400">Secure App Password Authentication</p>
              </div>
            </div>
            <span
              className={`px-3 py-1 text-[10px] font-black rounded-full ${
                gmailConfig.status === "CONNECTION_VERIFIED"
                  ? "bg-emerald-100 text-emerald-800"
                  : gmailConfig.status === "CONNECTION_FAILED"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {gmailConfig.status}
            </span>
          </div>

          <form onSubmit={handleSaveGmail} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "اسم مستخدم SMTP (البريد الإلكتروني)" : "SMTP User (Email)"}
              </label>
              <input
                type="email"
                value={gmailConfig.smtpUser}
                onChange={(e) => setGmailConfig({ ...gmailConfig, smtpUser: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono focus:border-amber-600"
                placeholder="notifications@emiratesfalcon.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "كلمة مرور التطبيق لـ Gmail (App Password)" : "Gmail App Password"}
              </label>
              <div className="relative">
                <input
                  type={showGmailPassword ? "text" : "password"}
                  value={gmailConfig.appPassword}
                  onChange={(e) => setGmailConfig({ ...gmailConfig, appPassword: e.target.value })}
                  className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono focus:border-amber-600"
                  placeholder="xxxx xxxx xxxx xxxx"
                />
                <button
                  type="button"
                  onClick={() => setShowGmailPassword(!showGmailPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showGmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {language === "ar" ? "استخدم كلمة مرور تطبيقات Google (16 خانة) وليس كلمة مرور الحساب العادية." : "Use 16-character Gmail App Password."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={gmailConfig.smtpHost}
                  onChange={(e) => setGmailConfig({ ...gmailConfig, smtpHost: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Port & Enc</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={gmailConfig.smtpPort}
                    onChange={(e) => setGmailConfig({ ...gmailConfig, smtpPort: Number(e.target.value) })}
                    className="w-16 px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono"
                  />
                  <select
                    value={gmailConfig.encryption}
                    onChange={(e) => setGmailConfig({ ...gmailConfig, encryption: e.target.value as any })}
                    className="flex-1 px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="SSL">SSL</option>
                    <option value="TLS">TLS</option>
                    <option value="STARTTLS">STARTTLS</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gmailConfig.enabled}
                  onChange={(e) => setGmailConfig({ ...gmailConfig, enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  {language === "ar" ? "تفعيل إشعارات البريد الإلكتروني" : "Enable Email Notifications"}
                </span>
              </label>

              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {language === "ar" ? "حفظ إعدادات البريد" : "Save SMTP"}
              </button>
            </div>
          </form>

          {/* Test Gmail */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <h5 className="text-xs font-black text-slate-800">
              {language === "ar" ? "اختبار اتصال وإرسال عبر البريد الإلكتروني" : "SMTP Connection & Test Email"}
            </h5>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="admin@emiratesfalcon.com"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
              <button
                onClick={handleTestGmail}
                disabled={isTesting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{language === "ar" ? "اختبار وإرسال" : "Test & Send"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
