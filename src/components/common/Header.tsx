import React, { useState } from "react";
import {
  Globe,
  Bell,
  LogOut,
  Search,
  Menu,
  Key,
  GitFork,
  User,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { ChangeMyPasswordModal } from "./ChangeMyPasswordModal";
import { RemixAndShareModal } from "./RemixAndShareModal";
import { isBouncedWithoutLegalAction } from "../../utils/chequeUtils";

interface HeaderProps {
  onToggleSidebar?: () => void;
  onOpenNotifications?: () => void;
  onOpenGlobalSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar = () => {},
  onOpenNotifications = () => {},
  onOpenGlobalSearch = () => {},
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { currentUser, logout, canRemixAndShare, loginMode } = useAuth();
  const { cheques, cases, notifications, companyProfile, maintenanceRequests } = useData();

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isRemixAndShareOpen, setIsRemixAndShareOpen] = useState(false);

  const isTenantMode = loginMode === "TENANT";
  const isPortalMode = loginMode === "TENANT" || loginMode === "OWNER" || currentUser?.role === "TENANT" || currentUser?.role === "OWNER" || currentUser?.role === "PROPERTY_OWNER";
  
  const bouncedCount = cheques.filter((c) => isBouncedWithoutLegalAction(c, cases)).length;
  const activeCasesCount = cases.filter((c) => {
    const s = (c.status || "").toUpperCase().trim();
    return s !== "CLOSED" && s !== "ARCHIVED" && s !== "SETTLED";
  }).length;
  const urgentMaintCount = (maintenanceRequests || []).filter(
    (m) =>
      (m.priority === "URGENT" || (m as any).isEmergency) &&
      m.status !== "COMPLETED" &&
      m.status !== "CANCELLED" &&
      m.status !== "REJECTED"
  ).length;
  const totalAlerts = isPortalMode ? 0 : (bouncedCount + activeCasesCount + urgentMaintCount);

  const logoSrc = companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo;
  const companyName = language === "ar" 
    ? companyProfile.nameAr 
    : companyProfile.nameEn;

  return (
    <header id="main-app-header" className="shrink-0 sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-5 lg:px-6 py-3 transition-all shadow-xs print:hidden">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Left Side: Mobile Menu Button & Brand Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100/90 active:bg-slate-200 transition-all border border-slate-200/80 cursor-pointer flex items-center justify-center shadow-2xs"
            aria-label="Toggle navigation menu"
            title={language === "ar" ? "القائمة الرئيسية والصفحات" : "Main Menu & Navigation"}
          >
            <Menu className="w-5 h-5 text-slate-800" />
          </button>

          <div id="header-brand-container" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div id="header-brand-logo" className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden shadow-xs ring-2 ring-amber-500/30 shrink-0 bg-white flex items-center justify-center p-0.5">
              <img src={logoSrc} alt={companyName} className="w-full h-full object-contain" />
            </div>
            <div id="header-brand-text" className="flex flex-col justify-center min-w-0">
              <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight tracking-tight">
                {isTenantMode 
                  ? (language === "ar" ? "بوابة المستأجرين" : "Tenant Portal")
                  : companyName}
              </h1>
              <p className="text-[11px] sm:text-xs text-amber-700 font-semibold leading-tight">
                {isTenantMode
                  ? (language === "ar" ? "نظام إدارة العقارات الذكي" : "Smart Property Management")
                  : (language === "ar" ? "إدارة العقارات والمبيعات" : "Property & Sales Management")}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Quick Search Bar */}
        {!isPortalMode && (
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <button
              onClick={onOpenGlobalSearch}
              className="w-full flex items-center justify-start px-3.5 py-2 text-xs text-slate-400 bg-slate-100/80 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors text-start cursor-pointer gap-2"
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span>{t("searchPlaceholder")}</span>
            </button>
          </div>
        )}

        {/* Right Side: Logged-in User Info, Language, Notifications, Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Logged-in User Badge (Static, display only) */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200/80 shadow-2xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
            <div className="flex flex-col text-start">
              <span className="font-bold text-slate-900 text-xs leading-tight">
                {language === "ar" ? currentUser?.nameAr : currentUser?.nameEn}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 leading-tight">
                {currentUser?.role ? t(`role_${currentUser.role}` as any) : ""}
              </span>
            </div>
          </div>

          {/* Remix & Share Option - Granted EXCLUSIVELY to Super Admin & System Creator */}
          {canRemixAndShare && (
            <button
              onClick={() => setIsRemixAndShareOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 transition-all shadow-xs cursor-pointer border border-amber-500/40"
              title={language === "ar" ? "خيارات المشاركة والريمكس (حصرية للمسؤول والمبتكر)" : "Remix & Share Options (Super Admin & Creator Only)"}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{language === "ar" ? "ريمكس والمشاركة" : "Remix & Share"}</span>
            </button>
          )}

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
            title="تبديل اللغة / Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-600" />
            <span>{language === "ar" ? "EN" : "عربي"}</span>
          </button>

          {/* Notifications Trigger */}
          {!isPortalMode && (
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="View notifications and reminders"
            >
              <Bell className="w-5 h-5" />
              {totalAlerts > 0 && (
                <span className="absolute top-1.5 end-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                </span>
              )}
            </button>
          )}

          {/* User Avatar, Change Password & Logout Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 ps-2 border-s border-slate-200">
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title={language === "ar" ? "تغيير كلمة المرور الخاصة بي" : "Change My Password"}
            >
              <Key className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">{language === "ar" ? "كلمة المرور" : "Password"}</span>
            </button>

            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0" title={currentUser?.nameAr || currentUser?.nameEn}>
              {currentUser?.nameEn ? currentUser.nameEn.charAt(0) : "A"}
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title={t("logout")}
              aria-label={t("logout")}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{language === "ar" ? "تسجيل خروج" : "Logout"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Change My Password Modal */}
      <ChangeMyPasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Remix & Share Modal (Super Admin & System Creator Only) */}
      <RemixAndShareModal
        isOpen={isRemixAndShareOpen}
        onClose={() => setIsRemixAndShareOpen(false)}
      />
    </header>
  );
};

