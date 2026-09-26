import React, { useState } from "react";
import { Mail, MessageCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { openWhatsAppDirect } from "../../services/automatedEmailService";

interface QuickCommunicationButtonsProps {
  // Email dispatch handler
  onSendEmail?: () => Promise<{ success: boolean; message?: string; error?: string }>;
  emailRecipient?: string;
  emailLabel?: string;

  // WhatsApp params
  phone?: string;
  whatsAppText?: string;
  whatsAppLabel?: string;

  // Visual options
  size?: "sm" | "md";
  showLabels?: boolean;
  className?: string;
}

export const QuickCommunicationButtons: React.FC<QuickCommunicationButtonsProps> = ({
  onSendEmail,
  emailRecipient,
  emailLabel = "إرسال إيميل",
  phone,
  whatsAppText = "",
  whatsAppLabel = "واتساب",
  size = "sm",
  showLabels = true,
  className = "",
}) => {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  const handleEmailClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSendEmail) return;

    try {
      setIsSendingEmail(true);
      const res = await onSendEmail();
      if (res.success) {
        setEmailSentSuccess(true);
        setTimeout(() => setEmailSentSuccess(false), 3500);
      } else {
        alert(res.error || "فشل إرسال البريد الإلكتروني");
      }
    } catch (err: any) {
      alert(err?.message || "حدث خطأ أثناء إرسال البريد الإلكتروني");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) {
      alert("رقم الهاتف غير مسجل لإرسال واتساب");
      return;
    }
    openWhatsAppDirect(phone, whatsAppText);
  };

  const btnSizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";
  const iconSizeClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Automated Email Dispatch Button */}
      {onSendEmail && (
        <button
          type="button"
          onClick={handleEmailClick}
          disabled={isSendingEmail || !emailRecipient}
          title={emailRecipient ? `إرسال بريد تلقائي إلى ${emailRecipient}` : "البريد الإلكتروني غير متوفر"}
          className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-all shadow-2xs ${
            emailSentSuccess
              ? "bg-emerald-600 text-white"
              : !emailRecipient
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 hover:border-sky-300"
          } ${btnSizeClass}`}
        >
          {isSendingEmail ? (
            <Loader2 className={`${iconSizeClass} animate-spin`} />
          ) : emailSentSuccess ? (
            <CheckCircle2 className={iconSizeClass} />
          ) : (
            <Mail className={iconSizeClass} />
          )}
          {showLabels && (
            <span>
              {emailSentSuccess
                ? "تم الإرسال ✓"
                : isSendingEmail
                ? "جارٍ الإرسال..."
                : emailLabel}
            </span>
          )}
        </button>
      )}

      {/* Direct WhatsApp Button */}
      {phone && (
        <button
          type="button"
          onClick={handleWhatsAppClick}
          title={`مراسلة عبر واتساب (${phone})`}
          className={`inline-flex items-center gap-1.5 font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 transition-all shadow-2xs ${btnSizeClass}`}
        >
          <MessageCircle className={iconSizeClass} />
          {showLabels && <span>{whatsAppLabel}</span>}
        </button>
      )}
    </div>
  );
};
