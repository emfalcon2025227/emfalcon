import React, { useState, useEffect } from "react";
import { MessageSquare, Mail, Send, CheckCircle2, AlertTriangle, Search, Filter, Phone, ShieldCheck, X, Settings } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import { NotificationLog } from "../../types";
import { CommunicationProviderSettings } from "../settings/CommunicationProviderSettings";

export const NotificationsView: React.FC = () => {
  const { t, language } = useLanguage();
  const { notifications, tenants, cheques, dispatchWhatsAppReminder, runAutomatedChequeReminders } = useData();

  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isSending, setIsSending] = useState(false);
  const [sendNoticeResult, setSendNoticeResult] = useState<string | null>(null);
  const [testReport, setTestReport] = useState<Phase13TestReport | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    (window as any).runPhase13CommunicationTests = runPhase13CommunicationTests;
    
    // Auto-run reminders silently once a day per session
    const autoRun = async () => {
      try {
        await runAutomatedChequeReminders();
      } catch (e) {
        console.error("Auto reminders background error", e);
      }
    };
    
    // Slight delay to not block UI rendering
    const timer = setTimeout(() => {
      autoRun();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleRunTests = () => {
    runPhase13CommunicationTests().then(report => {
      // setTestReport(report);
      // setShowTestModal(true);
    });
    // setTestReport(report);
    // setShowTestModal(true);
  };

  const handleRunReminders = async () => {
    setIsSending(true);
    try {
      const res = await runAutomatedChequeReminders();
      setSendNoticeResult(language === "ar" ? `تم التشغيل التلقائي بنجاح. أُرسل ${res.count} تنبيهات عبر SMTP.` : `Automated job run. ${res.count} SMTP reminders sent.`);
    } catch (err) {
      setSendNoticeResult("Error running automated job");
    } finally {
      setIsSending(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    const term = (searchTerm || "").toLowerCase();
    const matchTerm =
      (n.recipient || "").toLowerCase().includes(term) ||
      (n.content || "").toLowerCase().includes(term) ||
      (n.id || "").toLowerCase().includes(term);

    const matchChannel = channelFilter === "ALL" || n.type === channelFilter;
    const matchStatus = statusFilter === "ALL" || n.status === statusFilter;

    return matchTerm && matchChannel && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t("navNotifications")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "سجل الإخطارات والإنذارات عبر واتساب والرسائل القصيرة للشيكات المرتجعة"
              : "Automated WhatsApp and SMS payment reminders, legal notices, and delivery tracking"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>{language === "ar" ? "إعدادات مزودي الاتصال" : "Communication Providers"}</span>
          </button>
          <button
            onClick={handleRunReminders}
            disabled={isSending}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-white text-xs font-bold transition-colors shadow-xs ${isSending ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'}`}
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? (language === "ar" ? "جاري الإرسال..." : "Sending...") : (language === "ar" ? "تشغيل التنبيهات التلقائية (7 أيام)" : "Run Auto-Reminders (7 Days)")}</span>
          </button>
          <button
            onClick={handleRunTests}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{language === "ar" ? "اختبارات المرحلة 13 (50 اختبار)" : "Run Phase 13 Tests (50)"}</span>
          </button>
        </div>
      </div>

      {/* Integration Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-5 rounded-2xl shadow-md border border-slate-700/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-white mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            {language === "ar" ? "حالة الربط والإشعارات النشطة" : "Active Integrations & Notifications"}
          </h3>
          <p className="text-[11px] text-slate-400 max-w-xl leading-relaxed">
            {language === "ar" 
              ? "تصل الإشعارات تلقائياً من البريد الإلكتروني (emfalcon2025227@gmail.com) ومن خلال رقم الواتساب (+971502025227). هذه الإعدادات تعمل بشكل مؤقت لحين اعتماد واستخدام WhatsApp API الرسمي."
              : "Notifications arrive automatically from email (emfalcon2025227@gmail.com) and via WhatsApp number (+971502025227). This configuration is active temporarily until the official WhatsApp API is deployed."}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-mono text-white">emfalcon2025227@gmail.com</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-mono text-white">+971 50 202 5227</span>
          </div>
        </div>
      </div>

      {sendNoticeResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center justify-between">
          <span>{sendNoticeResult}</span>
          <button onClick={() => setSendNoticeResult(null)} className="text-emerald-600">✕</button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-1">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === "ar" ? "بحث برقم الهاتف، النص..." : "Search recipient, content..."}
            className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: language === "ar" ? "كافة القنوات" : "All Channels" },
              { id: "WHATSAPP", label: "WhatsApp (واتساب)" },
              { id: "SMS", label: "SMS (رسائل نصية)" },
              { id: "EMAIL", label: "Email (بريد إلكتروني)" },
            ]}
            value={channelFilter}
            onChange={(val) => setChannelFilter(val)}
            placeholder={language === "ar" ? "اختر القناة..." : "Select channel..."}
          />
        </div>

        <div>
          <SearchableSelect
            options={[
              { id: "ALL", label: language === "ar" ? "كافة الحالات" : "All Statuses" },
              { id: "DELIVERED", label: "DELIVERED (تم التسليم)" },
              { id: "SENT", label: "SENT (تم الإرسال)" },
              { id: "FAILED", label: "FAILED (فشل الإرسال)" },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            placeholder={language === "ar" ? "اختر الحالة..." : "Select status..."}
          />
        </div>
      </div>

      {/* Notifications Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4 text-start">{language === "ar" ? "القناة والمستلم" : "Channel & Recipient"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "محتوى الإشعار" : "Notification Content"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "التوقيت" : "Timestamp"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "الحالة" : "Delivery Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredNotifications.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      {n.type === "WHATSAPP" ? (
                        <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : n.type === "SMS" ? (
                        <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                      ) : (
                        <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>{n.type}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{n.recipient}</div>
                  </td>

                  <td className="py-3 px-4 max-w-md">
                    <p className="text-slate-800 line-clamp-2 text-[11px] leading-relaxed">{n.content}</p>
                  </td>

                  <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                    {n.sentAt}
                  </td>

                  <td className="py-3 px-4">
                    <Badge
                      variant={n.status === "DELIVERED" ? "success" : n.status === "FAILED" ? "danger" : "info"}
                      size="sm"
                    >
                      {n.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredNotifications.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs">
            {t("noDataFound")}
          </div>
        )}
      </div>

      {/* Test Results Modal */}
      {showTestModal && testReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">Phase 12 Notification & Communication Center Test Suite</h3>
                <p className="text-xs text-slate-300 mt-0.5">40 Comprehensive Tests Verification Report</p>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 bg-emerald-100 text-emerald-800 font-black text-sm rounded-2xl">
                  Passed: {testReport.passCount} / {testReport.totalTests}
                </div>
                <div className="px-4 py-2 bg-rose-100 text-rose-800 font-black text-sm rounded-2xl">
                  Failed: {testReport.failCount}
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Timestamp: {testReport.timestamp}
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-2 flex-1">
              {testReport.results.map((res) => (
                <div
                  key={res.testId}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                    res.passed ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" : "bg-rose-50/50 border-rose-200 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-mono text-[11px]">
                      {res.testId}
                    </span>
                    <span>{res.testName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {res.passed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-200 text-emerald-900 text-[10px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-200 text-rose-900 text-[10px]">
                        <X className="w-3.5 h-3.5" /> FAILED
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Communication Provider Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">
                  {language === "ar" ? "إعدادات مزودي الاتصال المتقدمة" : "Advanced Communication Provider Settings"}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">WhatsApp Business (Meta Cloud API) & Gmail SMTP</p>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <CommunicationProviderSettings />
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {language === "ar" ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
