import React, { useState } from "react";
import { Key, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Sparkles, LogOut, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

export const ForcePasswordChangeModal: React.FC = () => {
  const { language } = useLanguage();
  const { currentUser, changeOwnPassword, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentUser) return null;

  // Check if force password change is required
  const isRequired =
    currentUser.mustChangePassword === true ||
    currentUser.isFirstLoginCompleted === false ||
    currentUser.portalAccountStatus === "PENDING_ACTIVATION" ||
    currentUser.portalAccountStatus === "PASSWORD_CHANGE_REQUIRED";

  if (!isRequired) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentPassword) {
      setFeedback({
        type: "error",
        message: language === "ar" ? "يرجى إدخال كلمة المرور المؤقتة الحالية" : "Please enter your current temporary password",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        type: "error",
        message: language === "ar" ? "كلمة المرور الجديدة غير متطابقة مع التأكيد" : "New passwords do not match",
      });
      return;
    }

    if (newPassword.trim().length < 6) {
      setFeedback({
        type: "error",
        message: language === "ar" ? "كلمة المرور الجديدة يجب أن تكون 6 رموز على الأقل" : "New password must be at least 6 characters",
      });
      return;
    }

    if (newPassword === currentPassword) {
      setFeedback({
        type: "error",
        message: language === "ar" ? "يجب اختيار كلمة مرور جديدة تختلف عن كلمة المرور المؤقتة" : "New password must be different from temporary password",
      });
      return;
    }

    setIsSubmitting(true);
    const res = await changeOwnPassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({
        type: "success",
        message: language === "ar" ? "تم تعيين كلمة المرور الجديدة وتفعيل حسابك بنجاح!" : "New password set and account activated successfully!",
      });
    } else {
      setFeedback({
        type: "error",
        message: res.error || (language === "ar" ? "تعذر تغيير كلمة المرور" : "Failed to change password"),
      });
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 overflow-hidden">
        {/* Close / Return to Login Button */}
        <button
          type="button"
          onClick={handleLogout}
          title={language === "ar" ? "إلغاء والعودة لصفحة تسجيل الدخول" : "Cancel and return to login"}
          className="absolute top-4 start-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Decorative Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center justify-center mx-auto shadow-sm">
            <Key className="w-8 h-8 text-amber-700 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {language === "ar" ? "تفعيل الحساب - تغيير كلمة المرور" : "First Login - Set Password"}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto font-medium">
            {language === "ar"
              ? "مرحباً بك! تم إنشاء حسابك بكلمة مرور مؤقتة. للوصول الآمن للوحة التحكم، يرجى تعيين كلمة مرور شخصية جديدة."
              : "Welcome! Your account was set up with a temporary password. Please set a new secure password to proceed."}
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {feedback.type === "success" ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Temporary Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === "ar" ? "كلمة المرور المؤقتة الحالية" : "Current Temporary Password"}
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={language === "ar" ? "أدخل كلمة المرور الحالية..." : "Enter temporary password..."}
                className="w-full pl-3 pr-10 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 focus:bg-white transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === "ar" ? "كلمة المرور الجديدة" : "New Password"}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={language === "ar" ? "6 رموز على الأقل..." : "At least 6 characters..."}
                className="w-full pl-3 pr-10 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 focus:bg-white transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === "ar" ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={language === "ar" ? "أعد كتابة كلمة المرور..." : "Re-enter new password..."}
                className="w-full pl-3 pr-10 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 focus:bg-white transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>{language === "ar" ? "تأكيد وتفعيل الحساب" : "Confirm & Activate Account"}</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>{language === "ar" ? "تسجيل الخروج والعودة لصفحة تسجيل الدخول" : "Sign Out & Return to Login"}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
