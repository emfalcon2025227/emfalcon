import React, { useState } from "react";
import {
  Lock,
  User,
  ShieldCheck,
  Building2,
  Globe,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

export const LoginView: React.FC = () => {
  const { t, language, toggleLanguage, dir } = useLanguage();
  const { login, users } = useAuth();
  const { companyProfile } = useData();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"STAFF" | "TENANT" | "OWNER">(() => {
    if (typeof window !== "undefined") {
      const fullUrl = (window.location.pathname + window.location.hash + window.location.search).toLowerCase();
      if (fullUrl.includes("owner-login") || fullUrl.includes("mode=owner")) {
        return "OWNER";
      }
      if (fullUrl.includes("tenant-login") || fullUrl.includes("mode=tenant")) {
        return "TENANT";
      }
    }
    return "STAFF";
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await login(username, password, loginMode);
      if (!res.success) {
        setError(res.error || (language === "ar" ? "خطأ في بيانات الدخول" : "Authentication failed"));
      }
    } catch {
      setError(language === "ar" ? "غير قادر على الاتصال بخادم المصادقة" : "Unable to communicate with authentication server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-amber-500 selection:text-white">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 start-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 end-1/4 w-96 h-96 bg-amber-700/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar with Language Toggle */}
      <header className="p-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm ring-2 ring-slate-200/20 shrink-0 bg-white flex items-center justify-center p-0.5">
            <img src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo} alt="Company Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-wide">
              {language === "ar" ? companyProfile.nameAr : companyProfile.nameEn}
            </h1>
            <p className="text-[11px] text-amber-400/90 font-medium">
              {language === "ar" ? "نظام إدارة العقارات والشيكات والقضايا" : "Real Estate ERP & Portal Suite"}
            </p>
          </div>
        </div>

        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-200 border border-white/10 backdrop-blur-xs transition-colors"
        >
          <Globe className="w-4 h-4 text-amber-400" />
          <span>{language === "ar" ? "English" : "العربية"}</span>
        </button>
      </header>

      {/* Center Auth Card */}
      <main className="flex-1 flex items-center justify-center p-4 z-10 my-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl text-slate-800 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center mb-8">
            {/* Login Mode 3-Way Toggle */}
            <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-2xl mb-8 border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => { setLoginMode("STAFF"); setError(null); }}
                className={`py-2 px-1 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  loginMode === "STAFF" 
                    ? "bg-white text-amber-800 shadow-sm" 
                    : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{language === "ar" ? "الموظفون" : "Staff"}</span>
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode("TENANT"); setError(null); }}
                className={`py-2 px-1 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  loginMode === "TENANT" 
                    ? "bg-white text-amber-800 shadow-sm" 
                    : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{language === "ar" ? "المستأجرون" : "Tenants"}</span>
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode("OWNER"); setError(null); }}
                className={`py-2 px-1 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  loginMode === "OWNER" 
                    ? "bg-white text-amber-800 shadow-sm" 
                    : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{language === "ar" ? "المُلاك" : "Owners"}</span>
              </button>
            </div>

            <div className="w-14 h-14 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-center justify-center mx-auto mb-4 text-amber-800 shadow-xs">
              {loginMode === "STAFF" && <ShieldCheck className="w-7 h-7" />}
              {loginMode === "TENANT" && <User className="w-7 h-7" />}
              {loginMode === "OWNER" && <Building2 className="w-7 h-7" />}
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {loginMode === "STAFF" && (language === "ar" ? "تسجيل دخول الموظفين" : "Staff Sign In")}
              {loginMode === "TENANT" && (language === "ar" ? "بوابة المستأجر الذكية" : "Tenant Portal Sign In")}
              {loginMode === "OWNER" && (language === "ar" ? "بوابة المالك الاستثمارية" : "Owner Portal Sign In")}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
              {loginMode === "STAFF" && (language === "ar" ? "لوحة التحكم المركزية للعمليات العقارية والمالية" : "Central control panel for operations & finances")}
              {loginMode === "TENANT" && (language === "ar" ? "متابعة عقود الإيجار، الدفعات، وطلبات الصيانة" : "Track your leases, payments, and maintenance")}
              {loginMode === "OWNER" && (language === "ar" ? "متابعة أداء العقارات، كشوفات الحساب، والتحويلات المالية" : "Track property performance, statements, and payouts")}
            </p>
          </div>

          {error && (
            error === "auth/operation-not-allowed" ? (
              <div className="mb-6 p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-slate-800 text-xs shadow-xs animate-in fade-in duration-200">
                <div className="flex items-start gap-3 mb-3.5">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-black text-slate-900 text-sm mb-1">
                      {language === "ar" ? "تفعيل تسجيل الدخول بالبريد الإلكتروني" : "Enable Email/Password Sign-In"}
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      {language === "ar" 
                        ? "يجب تفعيل موفر تسجيل الدخول (البريد الإلكتروني وكلمة المرور) في لوحة تحكم Firebase الخاصة بك لتشغيل النظام بشكل كامل."
                        : "Email/Password sign-in must be toggled ON in your Firebase Console settings to activate authentication."}
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 rounded-xl p-4 border border-amber-200/50 space-y-3 mb-4">
                  <h4 className="font-bold text-slate-900 text-xs">
                    {language === "ar" ? "خطوات التفعيل السريعة:" : "Quick Activation Steps:"}
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-slate-600 text-[11px] leading-relaxed">
                    <li>
                      <span className="font-semibold text-slate-900">
                        {language === "ar" ? "افتح لوحة تحكم Firebase:" : "Open Firebase Console:"}
                      </span>{" "}
                      <a 
                        href="https://console.firebase.google.com/project/gen-lang-client-0196715356/authentication/providers" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-amber-700 hover:text-amber-800 underline font-bold inline-flex items-center gap-0.5"
                      >
                        {language === "ar" ? "انقر للذهاب مباشرة" : "Click to Go Directly"}
                      </a>
                    </li>
                    <li>
                      {language === "ar" 
                        ? "انقر على علامة التبويب (Sign-in method / طريقة تسجيل الدخول) في الأعلى." 
                        : "Click on the 'Sign-in method' tab at the top of the screen."}
                    </li>
                    <li>
                      {language === "ar" 
                        ? "اختر موفر (Email/Password / البريد الإلكتروني وكلمة المرور) وقم بتفعيله (Enable) ثم احفظ التغييرات (Save)." 
                        : "Select 'Email/Password', toggle the switch to Enabled, and click 'Save'."}
                    </li>
                  </ol>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[10px] text-slate-400 font-mono">ID: gen-lang-client-0196715356</span>
                  <button
                    type="button"
                    onClick={() => { setError(null); }}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                  >
                    {language === "ar" ? "إعادة المحاولة" : "Try Again"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t("usernameOrEmail")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={loginMode === "OWNER" ? "owner@falcon.ae or owner_mahmoud" : (loginMode === "TENANT" ? "tenant email or username" : "admin or user@falcon.ae")}
                  className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-900 font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {t("password")}
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(true)}
                  className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                >
                  {t("forgotPassword")}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-900 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-bold text-xs shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLoading ? t("loggingIn") : (loginMode === "OWNER" ? (language === "ar" ? "دخول بوابة المالك" : "Enter Owner Portal") : t("loginButton"))}</span>
              {dir === "rtl" ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-400 z-10">
        <p>© 2026 {language === "ar" ? `${companyProfile.nameAr}. جميع الحقوق محفوظة.` : `${companyProfile.nameEn}. All rights reserved.`}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{t("confidential")}</p>
      </footer>

      <ForgotPasswordModal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
      />
    </div>
  );
};
