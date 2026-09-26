import React, { useState, useMemo } from "react";
import {
  Building2,
  TrendingUp,
  DollarSign,
  FileText,
  CreditCard,
  Wrench,
  MessageSquare,
  Globe,
  LogOut,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { OwnerPortalOverview } from "./OwnerPortalOverview";
import { OwnerPropertiesReview } from "./OwnerPropertiesReview";
import { OwnerStatementView } from "./OwnerStatementView";
import { OwnerChequesView } from "./OwnerChequesView";
import { OwnerMaintenanceView } from "./OwnerMaintenanceView";
import { OwnerCommunicationHub } from "./OwnerCommunicationHub";

export const OwnerPortalView: React.FC = () => {
  const { language, toggleLanguage, formatAED, dir } = useLanguage();
  const { currentUser, logout, loginMode } = useAuth();
  const {
    owners,
    properties,
    units,
    leases,
    cheques,
    tenants,
    maintenanceRequests,
    companyProfile,
    isDataLoaded
  } = useData();

  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "PROPERTIES" | "STATEMENT" | "CHEQUES" | "MAINTENANCE" | "COMMUNICATIONS"
  >("OVERVIEW");

  // Allow admin/staff to preview for any owner if not logged in as a specific owner
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(() => {
    if (currentUser?.ownerId) return currentUser.ownerId;
    return owners[0]?.id || "own-mahmoud";
  });

  // Effective Owner determination (Strictly locked if logged in as an OWNER user)
  const activeOwnerId = useMemo(() => {
    if (currentUser?.ownerId) return currentUser.ownerId;
    return selectedOwnerId || owners[0]?.id;
  }, [currentUser?.ownerId, selectedOwnerId, owners]);

  const currentOwner = useMemo(() => {
    return owners.find((o) => o.id === activeOwnerId) || owners[0] || null;
  }, [owners, activeOwnerId]);

  // Securely filter all real estate entities strictly by activeOwnerId
  const ownerProperties = useMemo(() => {
    if (!currentOwner) return [];
    return properties.filter((p) => p.ownerId === currentOwner.id);
  }, [properties, currentOwner]);

  const ownerPropertyIds = useMemo(() => {
    return new Set(ownerProperties.map((p) => p.id));
  }, [ownerProperties]);

  const ownerUnits = useMemo(() => {
    return units.filter((u) => ownerPropertyIds.has(u.propertyId));
  }, [units, ownerPropertyIds]);

  const ownerUnitIds = useMemo(() => {
    return new Set(ownerUnits.map((u) => u.id));
  }, [ownerUnits]);

  const ownerLeases = useMemo(() => {
    return leases.filter((l) => ownerPropertyIds.has(l.propertyId) || ownerUnitIds.has(l.unitId));
  }, [leases, ownerPropertyIds, ownerUnitIds]);

  const ownerCheques = useMemo(() => {
    return cheques.filter(
      (c) =>
        c.ownerId === currentOwner?.id ||
        ownerPropertyIds.has(c.propertyId) ||
        ownerUnitIds.has(c.unitId)
    );
  }, [cheques, currentOwner, ownerPropertyIds, ownerUnitIds]);

  const ownerMaintenance = useMemo(() => {
    return maintenanceRequests.filter((m) => ownerUnitIds.has(m.unitId));
  }, [maintenanceRequests, ownerUnitIds]);

  if (!isDataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-amber-600 animate-spin"></div>
          <p className="text-slate-500 font-bold">{language === "ar" ? "جاري مزامنة البيانات..." : "Syncing data..."}</p>
        </div>
      </div>
    );
  }

  if (!currentOwner) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">
            {language === "ar" ? "لم يتم العثور على سجل للمالك" : "Owner Profile Not Found"}
          </h2>
          <p className="text-xs text-slate-500">
            {language === "ar"
              ? "يرجى التأكد من ربط حساب المستخدم بسجل المالك الصحيح في قاعدة البيانات."
              : "Please verify that the user profile is linked to an active owner record."}
          </p>
          <button
            onClick={logout}
            className="py-2 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
          >
            {language === "ar" ? "تسجيل الخروج" : "Sign Out"}
          </button>
        </div>
      </div>
    );
  }

  const isStaffPreview = !currentUser?.ownerId && currentUser?.role !== "OWNER" && currentUser?.role !== "PROPERTY_OWNER";

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 pb-16 font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand Logo & Portal Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black text-white tracking-wide">
                    {language === "ar" ? "بوابة المالك الاستثمارية" : "Owner Investment Portal"}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                    Falcon VIP
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === "ar" ? companyProfile.nameAr : companyProfile.nameEn}
                </p>
              </div>
            </div>

            {/* Right Controls: Staff Owner Switcher + Language + Logout */}
            <div className="flex items-center gap-3">
              {/* Staff Switcher */}
              {isStaffPreview && (
                <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                  <span className="text-amber-400 font-bold text-[11px]">
                    {language === "ar" ? "معاينة المالك:" : "Preview Owner:"}
                  </span>
                  <select
                    value={activeOwnerId}
                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                    className="bg-transparent text-white font-bold outline-hidden cursor-pointer"
                  >
                    {owners.map((o) => (
                      <option key={o.id} value={o.id} className="bg-slate-800 text-white">
                        {language === "ar" ? o.nameAr : o.nameEn} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Language Switch */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === "ar" ? "English" : "العربية"}</span>
              </button>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold border border-rose-500/30 transition-colors cursor-pointer"
                title={language === "ar" ? "تسجيل الخروج" : "Logout"}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{language === "ar" ? "خروج" : "Logout"}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Owner Identity Ribbon */}
      <div className="bg-white border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100/70 border border-amber-200 text-amber-900 flex items-center justify-center font-black text-lg shadow-xs shrink-0">
                {(currentOwner.nameAr || currentOwner.nameEn || "O").charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-black text-slate-900">
                    {language === "ar" ? currentOwner.nameAr : currentOwner.nameEn}
                  </h2>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {currentOwner.code}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" />
                    {language === "ar" ? "مالك نشط ومعتمد" : "Active & Verified"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                  {currentOwner.phone && <span>{currentOwner.phone}</span>}
                  {currentOwner.email && <span>• {currentOwner.email}</span>}
                  {currentOwner.bankName && (
                    <span>• {currentOwner.bankName} ({currentOwner.iban ? currentOwner.iban.slice(-6) : "—"})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Portfolio Quick Badges */}
            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 text-[10px] block font-bold">{language === "ar" ? "العقارات" : "Properties"}</span>
                <span className="font-black text-slate-900">{ownerProperties.length}</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 text-[10px] block font-bold">{language === "ar" ? "الوحدات" : "Units"}</span>
                <span className="font-black text-slate-900">{ownerUnits.length}</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 text-[10px] block font-bold">{language === "ar" ? "العقود النشطة" : "Active Leases"}</span>
                <span className="font-black text-emerald-700">
                  {ownerLeases.filter((l) => l.contractStatus === "ACTIVE").length}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pt-4 mt-2 border-t border-slate-100 no-scrollbar">
            <button
              onClick={() => setActiveTab("OVERVIEW")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "OVERVIEW"
                  ? "bg-amber-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>{language === "ar" ? "لوحة القيادة المالية" : "Financial Overview"}</span>
            </button>

            <button
              onClick={() => setActiveTab("PROPERTIES")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "PROPERTIES"
                  ? "bg-amber-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>{language === "ar" ? "مراجعة العقارات والوحدات" : "Properties & Units"}</span>
            </button>

            <button
              onClick={() => setActiveTab("STATEMENT")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "STATEMENT"
                  ? "bg-amber-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{language === "ar" ? "كشف حساب المالك" : "Owner Statement"}</span>
            </button>

            <button
              onClick={() => setActiveTab("CHEQUES")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "CHEQUES"
                  ? "bg-amber-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{language === "ar" ? "سجل الشيكات" : "Cheque Register"}</span>
            </button>

            <button
              onClick={() => setActiveTab("MAINTENANCE")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "MAINTENANCE"
                  ? "bg-amber-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>{language === "ar" ? "بلاغات الصيانة" : "Maintenance"}</span>
            </button>

            <button
              onClick={() => setActiveTab("COMMUNICATIONS")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "COMMUNICATIONS"
                  ? "bg-amber-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{language === "ar" ? "مركز التواصل والطلبات" : "Communications"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Views Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === "OVERVIEW" && (
          <OwnerPortalOverview
            owner={currentOwner}
            properties={ownerProperties}
            units={ownerUnits}
            leases={ownerLeases}
            cheques={ownerCheques}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === "PROPERTIES" && (
          <OwnerPropertiesReview
            properties={ownerProperties}
            units={ownerUnits}
            leases={ownerLeases}
            tenants={tenants}
            cheques={ownerCheques}
          />
        )}

        {activeTab === "STATEMENT" && (
          <OwnerStatementView
            owner={currentOwner}
            properties={ownerProperties}
            leases={ownerLeases}
          />
        )}

        {activeTab === "CHEQUES" && (
          <OwnerChequesView
            cheques={ownerCheques}
            properties={ownerProperties}
            units={ownerUnits}
            tenants={tenants}
          />
        )}

        {activeTab === "MAINTENANCE" && (
          <OwnerMaintenanceView
            maintenanceRequests={ownerMaintenance}
            properties={ownerProperties}
            units={ownerUnits}
          />
        )}

        {activeTab === "COMMUNICATIONS" && (
          <OwnerCommunicationHub
            owner={currentOwner}
            properties={ownerProperties}
          />
        )}
      </main>
    </div>
  );
};
