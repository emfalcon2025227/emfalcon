import React, { useState, useMemo } from "react";
import {
  MessageSquare,
  Send,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Users,
  Building2,
  FileText,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { OperationalCommunication, Owner, Tenant, Property } from "../../types";

export const UnifiedCommunicationCenter: React.FC = () => {
  const { language, dir } = useLanguage();
  const { currentUser } = useAuth();
  const {
    operationalCommunications,
    addOperationalCommunication,
    owners,
    tenants,
    properties,
    leases,
  } = useData();

  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [recipientTypeFilter, setRecipientTypeFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Composer state
  const [targetType, setTargetType] = useState<"TENANT" | "OWNER">("TENANT");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<"WHATSAPP" | "EMAIL" | "SMS" | "PORTAL_MESSAGE">("WHATSAPP");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Pre-built UAE Real Estate templates
  const templates = [
    {
      id: "RENT_RECEIPT",
      titleAr: "إشعار استلام دفعة إيجارية / سند قبض",
      titleEn: "Rent Receipt Notification",
      subjectAr: "تأكيد استلام دفعة إيجار - صقر الإمارات للعقارات",
      subjectEn: "Rent Payment Receipt Confirmation - Emirates Falcon",
      bodyAr: "عزيزي {name}، نود إعلامكم باستلام وتوثيق الدفعة الإيجارية بنجاح لوحدتكم في {property}. شكراً لتعاملكم الراقي معنا.",
      bodyEn: "Dear {name}, we confirm receipt and registration of your rental payment for your unit in {property}. Thank you for choosing Emirates Falcon.",
    },
    {
      id: "CHEQUE_REMINDER",
      titleAr: "تذكير بموعد استحقاق شيك إيجاري",
      titleEn: "Cheque Due Date Reminder",
      subjectAr: "تذكير بموعد إيداع الشيك الإيجاري القادم",
      subjectEn: "Upcoming Rent Cheque Deposit Reminder",
      bodyAr: "نود تذكيركم بأن الشيك الإيجاري المستحق لعقدكم في {property} سيتم تقديمه للصرف بتاريخ {dueDate}. يرجى التكرم بتوفير الرصيد الكافي.",
      bodyEn: "This is a friendly reminder that your rent cheque for {property} is due for deposit on {dueDate}. Please ensure sufficient balance.",
    },
    {
      id: "LEASE_RENEWAL",
      titleAr: "إشعار تجديد عقد الإيجار السنوي",
      titleEn: "Lease Renewal Notice",
      subjectAr: "إشعار تجديد عقد الإيجار السنوي - صقر الإمارات",
      subjectEn: "Annual Lease Renewal Notice - Emirates Falcon",
      bodyAr: "نود إعلامكم بقرب انتهاء مدة عقد الإيجار الحالي لعقاركم في {property}. يرجى التواصل معنا لتأكيد رغبتكم في التجديد وإعداد المستندات.",
      bodyEn: "Your current lease agreement for {property} is approaching expiration. Please contact us to confirm your renewal intention.",
    },
    {
      id: "OWNER_PAYOUT",
      titleAr: "إشعار تحويل مستحقات المالك للبنك",
      titleEn: "Owner Net Payout Notification",
      subjectAr: "إشعار تحويل الدفعة الإيجارية لحسابكم البنكي",
      subjectEn: "Rental Payout Transfer Confirmation",
      bodyAr: "سعادة المالك {name}، تم بنجاح تحويل صافي مستحقات الإيجارات المحصلة لعقاراتكم إلى حسابكم البنكي المعتمد. تجدون كشف الحساب مرفقاً في البوابة.",
      bodyEn: "Dear Owner {name}, net collected rental payouts have been successfully transferred to your registered bank account.",
    },
  ];

  const handleApplyTemplate = (tmplId: string) => {
    setSelectedTemplate(tmplId);
    const tmpl = templates.find((t) => t.id === tmplId);
    if (!tmpl) return;

    setSubject(language === "ar" ? tmpl.subjectAr : tmpl.subjectEn);
    setMessageBody(language === "ar" ? tmpl.bodyAr : tmpl.bodyEn);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId || !messageBody.trim()) return;

    setIsSending(true);

    let recipientName = "";
    let recipientPhone = "";
    let recipientEmail = "";

    if (targetType === "OWNER") {
      const owner = owners.find((o) => o.id === selectedTargetId);
      if (owner) {
        recipientName = language === "ar" ? owner.nameAr : owner.nameEn;
        recipientPhone = owner.phone;
        recipientEmail = owner.email;
      }
    } else {
      const tenant = tenants.find((t) => t.id === selectedTargetId);
      if (tenant) {
        recipientName = language === "ar" ? tenant.nameAr : tenant.nameEn;
        recipientPhone = tenant.phone;
        recipientEmail = tenant.email;
      }
    }

    try {
      addOperationalCommunication({
        direction: "OUTBOUND",
        channel: selectedChannel,
        senderId: currentUser?.id || "STAFF",
        senderName: currentUser?.nameAr || currentUser?.nameEn || "Falcon Admin",
        recipientId: selectedTargetId,
        recipientName: recipientName || "Client",
        recipient: recipientPhone || recipientEmail || "Client",
        status: "DELIVERED",
        subject: subject.trim() || (language === "ar" ? "إشعار صقر الإمارات" : "Falcon Real Estate Notice"),
        body: messageBody.trim(),
        category: targetType === "OWNER" ? "OWNER_NOTICE" : "TENANT_NOTICE",
        deliveryStatus: "DELIVERED",
        sentAt: new Date().toISOString(),
        relatedEntityType: targetType,
        relatedEntityId: selectedTargetId,
        metadata: {
          phone: recipientPhone || undefined,
          email: recipientEmail || undefined,
        },
      });

      setSuccessToast(
        language === "ar"
          ? `تم إرسال الرسالة بنجاح عبر قناة ${selectedChannel} إلى ${recipientName}`
          : `Message successfully dispatched via ${selectedChannel} to ${recipientName}`
      );
      setMessageBody("");
      setSubject("");
      setSelectedTemplate("");
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  // Filtered communications log
  const filteredComms = useMemo(() => {
    return operationalCommunications
      .filter((c) => {
        if (channelFilter !== "ALL" && c.channel !== channelFilter) return false;
        if (recipientTypeFilter !== "ALL" && c.relatedEntityType !== recipientTypeFilter) return false;

        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const matchSubject = (c.subject || "").toLowerCase().includes(term);
        const matchBody = (c.body || "").toLowerCase().includes(term);
        const matchRecipient = (c.recipientName || "").toLowerCase().includes(term);
        const matchSender = (c.senderName || "").toLowerCase().includes(term);
        return matchSubject || matchBody || matchRecipient || matchSender;
      })
      .sort((a, b) => new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime());
  }, [operationalCommunications, channelFilter, recipientTypeFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <MessageSquare className="w-6 h-6 text-amber-700" />
          <span>{language === "ar" ? "مركز الاتصال الموحد" : "Unified Communication Center"}</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {language === "ar"
            ? "إدارة جميع الرسائل والإشعارات مع المُلاك والمستأجرين عبر الواتساب والبريد الإلكتروني والرسائل النصية"
            : "Centralized communications with owners & tenants across WhatsApp, Email, SMS, and Portal"}
        </p>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Dispatcher / Composer */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-700" />
              <span>{language === "ar" ? "إرسال رسالة جديدة" : "Compose Message"}</span>
            </h3>
          </div>

          <form onSubmit={handleSendMessage} className="space-y-3.5 text-xs">
            {/* Target Category Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setTargetType("TENANT");
                  setSelectedTargetId("");
                }}
                className={`py-1.5 font-bold rounded-lg transition-all ${
                  targetType === "TENANT" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                {language === "ar" ? "مستأجر" : "Tenant"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType("OWNER");
                  setSelectedTargetId("");
                }}
                className={`py-1.5 font-bold rounded-lg transition-all ${
                  targetType === "OWNER" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                {language === "ar" ? "مالك" : "Owner"}
              </button>
            </div>

            {/* Recipient Dropdown */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {targetType === "OWNER" ? (language === "ar" ? "اختر المالك" : "Select Owner") : (language === "ar" ? "اختر المستأجر" : "Select Tenant")}
              </label>
              <select
                required
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden"
              >
                <option value="">{language === "ar" ? "— اختر من القائمة —" : "— Select Recipient —"}</option>
                {targetType === "OWNER"
                  ? owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {language === "ar" ? o.nameAr : o.nameEn} ({o.code})
                      </option>
                    ))
                  : tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {language === "ar" ? t.nameAr || t.nameEn : t.nameEn} ({t.phone})
                      </option>
                    ))}
              </select>
            </div>

            {/* Channel Selection */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === "ar" ? "قناة الإرسال" : "Channel"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannel("WHATSAPP")}
                  className={`py-2 px-3 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                    selectedChannel === "WHATSAPP"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel("EMAIL")}
                  className={`py-2 px-3 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                    selectedChannel === "EMAIL"
                      ? "bg-blue-50 text-blue-800 border-blue-300 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
              </div>
            </div>

            {/* Ready Templates */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{language === "ar" ? "قوالب عقارية جاهزة" : "Pre-built Templates"}</span>
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleApplyTemplate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-hidden"
              >
                <option value="">{language === "ar" ? "— اختر نموذج رسالة —" : "— Select Template —"}</option>
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {language === "ar" ? tmpl.titleAr : tmpl.titleEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === "ar" ? "عنوان الموضوع" : "Subject"}
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={language === "ar" ? "موضوع الرسالة..." : "Subject..."}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 outline-hidden"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === "ar" ? "نص الرسالة" : "Message Body"}
              </label>
              <textarea
                required
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={language === "ar" ? "اكتب تفاصيل الرسالة هنا..." : "Write message text..."}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? (language === "ar" ? "جارٍ الإرسال..." : "Sending...") : (language === "ar" ? "إرسال الإشعار الآن" : "Dispatch Message")}</span>
            </button>
          </form>
        </div>

        {/* Right: Message Log & Filter */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar" ? "سجل الرسائل والإشعارات الصادرة والواردة" : "Communication Feed"}
              </h3>
              <p className="text-xs text-slate-500">
                {language === "ar" ? `${filteredComms.length} رسالة مسجلة في النظام` : `${filteredComms.length} messages logged`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Channel Filter */}
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden"
              >
                <option value="ALL">{language === "ar" ? "جميع القنوات" : "All Channels"}</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="PORTAL_MESSAGE">Portal</option>
              </select>

              {/* Recipient Type Filter */}
              <select
                value={recipientTypeFilter}
                onChange={(e) => setRecipientTypeFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden"
              >
                <option value="ALL">{language === "ar" ? "الجميع" : "All"}</option>
                <option value="OWNER">{language === "ar" ? "المُلاك" : "Owners"}</option>
                <option value="TENANT">{language === "ar" ? "المستأجرون" : "Tenants"}</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "بحث بالمستلم، الموضوع، أو نص الرسالة..." : "Search recipient, subject, or message..."}
              className="w-full ps-9 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-slate-900 font-medium"
            />
          </div>

          {/* Feed List */}
          {filteredComms.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p>{language === "ar" ? "لا توجد رسائل مطابقة" : "No messages found"}</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[600px] pe-1">
              {filteredComms.map((comm) => (
                <div
                  key={comm.id}
                  className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 text-xs space-y-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          comm.channel === "WHATSAPP"
                            ? "bg-emerald-100 text-emerald-900"
                            : comm.channel === "EMAIL"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {comm.channel}
                      </span>

                      <span className="font-bold text-slate-900">
                        {comm.direction === "OUTBOUND" ? (language === "ar" ? "إلى: " : "To: ") : (language === "ar" ? "من: " : "From: ")}
                        {comm.recipientName || comm.senderName}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      {comm.sentAt ? comm.sentAt.slice(0, 16).replace("T", " ") : comm.createdAt?.slice(0, 10)}
                    </span>
                  </div>

                  <div className="font-bold text-slate-800 text-[11px]">{comm.subject}</div>
                  <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{comm.body}</p>

                  <div className="pt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      {language === "ar" ? "الحالة: " : "Status: "}
                      <span className="font-bold text-emerald-700">{comm.deliveryStatus || "DELIVERED"}</span>
                    </span>
                    <span className="font-mono">{comm.id.slice(0, 8)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
