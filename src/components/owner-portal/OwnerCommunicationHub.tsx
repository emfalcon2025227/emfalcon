import React, { useState, useMemo } from "react";
import {
  MessageSquare,
  Send,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Owner, Property } from "../../types";
import {
  isAuthorizedForOwnerPortal,
  filterOwnerPortalCommunications,
} from "../../utils/portalNotificationFilter";

interface OwnerCommunicationHubProps {
  owner: Owner;
  properties: Property[];
}

export const OwnerCommunicationHub: React.FC<OwnerCommunicationHubProps> = ({
  owner,
  properties,
}) => {
  const { language, dir } = useLanguage();
  const {
    notifications,
    operationalCommunications,
    addOperationalCommunication,
  } = useData();

  const [inquirySubject, setInquirySubject] = useState("");
  const [inquiryBody, setInquiryBody] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Communications strictly authorized for this owner portal
  const ownerCommunications = useMemo(() => {
    return filterOwnerPortalCommunications(operationalCommunications, owner.id)
      .sort((a, b) => new Date(b.sentAt || b.createdAt || 0).getTime() - new Date(a.sentAt || a.createdAt || 0).getTime());
  }, [operationalCommunications, owner.id]);

  // Notifications strictly authorized for this owner portal (excluding internal ERP & Admin fee alerts)
  const ownerNotifications = useMemo(() => {
    return notifications
      .filter((n) => isAuthorizedForOwnerPortal(n, owner.id, owner.phone))
      .sort((a, b) => new Date(b.sentAt || b.createdAt || 0).getTime() - new Date(a.sentAt || a.createdAt || 0).getTime());
  }, [notifications, owner.phone, owner.id]);

  const handleSubmitInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquirySubject.trim() || !inquiryBody.trim()) return;

    setIsSubmitting(true);
    try {
      addOperationalCommunication({
        direction: "INBOUND",
        channel: "PORTAL_MESSAGE",
        status: "DELIVERED",
        recipient: "Emirates Falcon Real Estate Management",
        senderId: owner.id,
        senderName: language === "ar" ? owner.nameAr : owner.nameEn,
        recipientId: "OFFICE",
        recipientName: "Emirates Falcon Real Estate Management",
        subject: inquirySubject.trim(),
        body: inquiryBody.trim(),
        category: "OWNER_INQUIRY",
        deliveryStatus: "DELIVERED",
        sentAt: new Date().toISOString(),
        relatedEntityType: "OWNER",
        relatedEntityId: owner.id,
        metadata: {
          propertyId: selectedPropertyId || undefined,
        },
      });

      setInquirySubject("");
      setInquiryBody("");
      setSelectedPropertyId("");
      setSuccessMessage(
        language === "ar"
          ? "تم إرسال رسالتك بنجاح إلى فريق إدارة العقارات وسيتم الرد خلال ساعات العمل."
          : "Your inquiry has been submitted successfully to property management."
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Inquiry Form */}
      <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar" ? "إرسال طلب / استفسار للإدارة" : "New Management Request"}
              </h3>
              <p className="text-xs text-slate-500">
                {language === "ar" ? "تواصل مباشر مع فريق الحسابات وإدارة العقارات" : "Direct line to property managers"}
              </p>
            </div>
          </div>

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmitInquiry} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "العقار ذو الصلة (اختياري)" : "Related Property (Optional)"}
              </label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-hidden"
              >
                <option value="">{language === "ar" ? "— استفسار عام / غير محدد —" : "— General Inquiry —"}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {language === "ar" ? p.nameAr : p.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "موضوع الطلب" : "Subject"}
              </label>
              <input
                type="text"
                required
                value={inquirySubject}
                onChange={(e) => setInquirySubject(e.target.value)}
                placeholder={
                  language === "ar"
                    ? "مثال: استفسار عن تحويل الدفعة، طلب صيانة عامة، تقرير شاغر..."
                    : "e.g., Transfer inquiry, maintenance request, vacancy update..."
                }
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "تفاصيل الرسالة" : "Message Body"}
              </label>
              <textarea
                required
                rows={4}
                value={inquiryBody}
                onChange={(e) => setInquiryBody(e.target.value)}
                placeholder={
                  language === "ar"
                    ? "يرجى كتابة تفاصيل استفسارك أو طلبك بوضوح..."
                    : "Describe your inquiry or request clearly..."
                }
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? (language === "ar" ? "جارٍ الإرسال..." : "Sending...") : (language === "ar" ? "إرسال الرسالة الآن" : "Submit Message")}</span>
            </button>
          </form>
        </div>

        {/* Contact Info Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Phone className="w-3.5 h-3.5 text-amber-700" />
            <span>+971 2 666 8888</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Mail className="w-3.5 h-3.5 text-amber-700" />
            <span>owners@falcon.ae</span>
          </div>
        </div>
      </div>

      {/* Communications History & Dispatches */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <h3 className="text-sm font-black text-slate-900 mb-1">
          {language === "ar" ? "سجل الرسائل والإشعارات المتبادلة" : "Communication & Dispatch History"}
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          {language === "ar"
            ? "جميع الرسائل والإشعارات الرسمية والتحويلات المرسلة إليك"
            : "All official notices, WhatsApp alerts, and inquiries"}
        </p>

        {ownerCommunications.length === 0 && ownerNotifications.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p>{language === "ar" ? "لا توجد مراسلات سابقة مسجلة" : "No communication history found"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ownerCommunications.map((msg) => (
              <div
                key={msg.id}
                className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        msg.direction === "INBOUND"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-blue-100 text-blue-900"
                      }`}
                    >
                      {msg.direction === "INBOUND"
                        ? (language === "ar" ? "مرسل من المالك" : "From Owner")
                        : (language === "ar" ? "إشعار من الإدارة" : "From Office")}
                    </span>
                    <span className="font-bold text-slate-900">{msg.subject || (language === "ar" ? "رسالة إدارية" : "Notice")}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {msg.sentAt ? msg.sentAt.slice(0, 16).replace("T", " ") : msg.createdAt?.slice(0, 10)}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}

            {ownerNotifications.map((notif) => (
              <div
                key={notif.id}
                className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900">
                      WhatsApp / SMS
                    </span>
                    <span className="font-bold text-slate-900">{notif.type}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {notif.sentAt ? notif.sentAt.slice(0, 16).replace("T", " ") : notif.createdAt?.slice(0, 10)}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{notif.content || notif.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
