import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { KeyRound, Mail, CheckCircle2 } from "lucide-react";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setEmail("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={language === "ar" ? "استعادة كلمة المرور" : "Reset Password"}
      subtitle={
        language === "ar"
          ? "أدخل بريدك الإلكتروني المسجل لإرسال رابط إعادة التعيين"
          : "Enter your authorized work email to receive reset instructions"
      }
      icon={<KeyRound className="w-5 h-5" />}
      maxWidth="md"
    >
      {submitted ? (
        <div className="py-6 text-center space-y-3">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-900">
            {language === "ar" ? "تم إرسال تعليمات إعادة التعيين" : "Reset Link Sent"}
          </h4>
          <p className="text-xs text-slate-600 max-w-xs mx-auto">
            {language === "ar"
              ? `تم إرسال بريد إلكتروني رسمي يحتوي على رمز التحقق المؤقت إلى ${email}. يرجى التواصل مع المدير العام للنظام في حال واجهتك أي صعوبة.`
              : `A verification link has been dispatched to ${email}. Contact Super Admin if you need immediate clearance.`}
          </p>
          <div className="pt-4">
            <button
              onClick={handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              {t("close")}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t("usernameOrEmail")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@sdi.ae"
                className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors"
            >
              {language === "ar" ? "إرسال رابط التعيين" : "Send Reset Link"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
