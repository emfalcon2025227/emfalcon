import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, ShieldAlert, Shield, Search, Filter, Lock, CheckCircle2, 
  XCircle, AlertTriangle, Key, UserCheck, Calendar, Info, RefreshCw, Plus, Trash2, Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth, isSystemOwnerUser } from "../../context/AuthContext";
import { PERMISSION_REGISTRY, PermissionDefinition, PermissionRiskLevel } from "../../data/permissionRegistry";
import { User, UserRole, UserPermissionOverride } from "../../types";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";

export const SecurityPermissionCenter: React.FC = () => {
  const { language } = useLanguage();
  const { 
    currentUser, users, userPermissionOverrides, 
    getEffectivePermission, addUserPermissionOverride, revokeUserPermissionOverride 
  } = useAuth();

  const isCurrentSystemOwner = isSystemOwnerUser(currentUser);

  // User Selection
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    // Default to first non-owner staff user if possible, or current user
    const firstStaff = users.find(u => u.id !== currentUser?.id && u.role !== "TENANT");
    return firstStaff ? firstStaff.id : (currentUser?.id || "");
  });

  const targetUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || currentUser;
  }, [users, selectedUserId, currentUser]);

  const isTargetSystemOwner = isSystemOwnerUser(targetUser);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"ALL" | "GRANTED" | "DENIED" | "INHERITED" | "ADMIN_ONLY">("ALL");

  // Modal State for Adding Override
  const [activeOverrideModal, setActiveOverrideModal] = useState<{
    permission: PermissionDefinition;
    effect: "GRANT" | "DENY";
  } | null>(null);

  const [overrideReason, setOverrideReason] = useState("");
  const [overrideExpiration, setOverrideExpiration] = useState("");
  const [overrideFeedback, setOverrideFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Unique Modules
  const availableModules = useMemo(() => {
    const mods = new Set<string>();
    PERMISSION_REGISTRY.forEach(p => mods.add(p.module));
    return Array.from(mods);
  }, []);

  // Filtered Permissions Matrix
  const permissionRows = useMemo(() => {
    if (!targetUser) return [];

    return PERMISSION_REGISTRY.map((perm) => {
      const effective = getEffectivePermission(perm.permissionId, targetUser.id);
      
      // Find active override for this perm & target user
      const activeOverride = userPermissionOverrides.find(o => 
        o.userId === targetUser.id && 
        o.permissionId === perm.permissionId && 
        o.status === "ACTIVE" &&
        (!o.expiresAt || new Date(o.expiresAt).getTime() > Date.now())
      );

      return {
        definition: perm,
        effective,
        override: activeOverride
      };
    }).filter(({ definition, effective, override }) => {
      // Search Filter
      const matchSearch = 
        definition.permissionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        definition.screen.toLowerCase().includes(searchQuery.toLowerCase()) ||
        definition.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        definition.descriptionAr.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      // Module Filter
      if (selectedModule !== "ALL" && definition.module !== selectedModule) return false;

      // Risk Filter
      if (selectedRisk !== "ALL" && definition.riskLevel !== selectedRisk) return false;

      // Status Filter
      if (selectedStatusFilter === "GRANTED" && !effective.granted) return false;
      if (selectedStatusFilter === "DENIED" && effective.granted) return false;
      if (selectedStatusFilter === "INHERITED" && effective.source !== "ROLE") return false;
      if (selectedStatusFilter === "ADMIN_ONLY" && !definition.adminOnly) return false;

      return true;
    });
  }, [targetUser, searchQuery, selectedModule, selectedRisk, selectedStatusFilter, userPermissionOverrides, getEffectivePermission]);

  // Statistics
  const stats = useMemo(() => {
    if (!targetUser) return { total: 0, granted: 0, denied: 0, activeOverrides: 0, adminOnly: 0 };

    let granted = 0;
    let denied = 0;
    let activeOverrides = 0;
    let adminOnly = 0;

    PERMISSION_REGISTRY.forEach((perm) => {
      const eff = getEffectivePermission(perm.permissionId, targetUser.id);
      if (eff.granted) granted++;
      else denied++;
      if (eff.override) activeOverrides++;
      if (perm.adminOnly) adminOnly++;
    });

    return {
      total: PERMISSION_REGISTRY.length,
      granted,
      denied,
      activeOverrides,
      adminOnly
    };
  }, [targetUser, userPermissionOverrides, getEffectivePermission]);

  const handleOpenOverrideModal = (perm: PermissionDefinition, effect: "GRANT" | "DENY") => {
    if (!isCurrentSystemOwner) {
      alert(language === "ar" ? "فقط مالك النظام SYSTEM_OWNER مصرح له بإدارة وصرف استثناءات الصلاحيات" : "Only SYSTEM_OWNER can manage permission overrides");
      return;
    }
    if (isTargetSystemOwner) {
      alert(language === "ar" ? "مالك النظام يمتلك صلاحيات جزرية مطلقة ولا يحتاج للاستثناءات" : "SYSTEM_OWNER has root access");
      return;
    }
    if (perm.adminOnly && effect === "GRANT" && targetUser?.role !== "SUPER_ADMIN" && targetUser?.role !== "MANAGER") {
      alert(language === "ar" ? "تنبيه أمان: هذه الصلاحية تصنف Admin-Only ولا يمكن تفويضها للموظفين العاديين" : "Admin-Only permissions cannot be granted to non-admin staff");
      return;
    }
    setActiveOverrideModal({ permission: perm, effect });
    setOverrideReason("");
    setOverrideExpiration("");
    setOverrideFeedback(null);
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOverrideModal || !targetUser) return;

    const res = addUserPermissionOverride({
      userId: targetUser.id,
      permissionId: activeOverrideModal.permission.permissionId,
      effect: activeOverrideModal.effect,
      reason: overrideReason,
      expiresAt: overrideExpiration ? new Date(overrideExpiration).toISOString() : null
    });

    if (res.success) {
      setOverrideFeedback({
        type: "success",
        message: language === "ar" ? "تم تسجيل وحفظ الاستثناء بنجاح" : "Permission override granted successfully"
      });
      setTimeout(() => {
        setActiveOverrideModal(null);
      }, 1200);
    } else {
      setOverrideFeedback({
        type: "error",
        message: res.error || "Failed to save override"
      });
    }
  };

  const handleRevokeOverride = (overrideId: string) => {
    if (!isCurrentSystemOwner) return;
    if (window.confirm(language === "ar" ? "هل أنت متأكد من رغبتك في إلغاء هذا الاستثناء وإعادة الصلاحية للحالة الافتراضية؟" : "Revoke this override?")) {
      revokeUserPermissionOverride(overrideId);
    }
  };

  const getRiskBadge = (risk: PermissionRiskLevel) => {
    switch (risk) {
      case "CRITICAL":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">CRITICAL / حرج</span>;
      case "HIGH":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">HIGH / عالٍ</span>;
      case "MEDIUM":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">MEDIUM / متوسط</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">LOW / عادي</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {language === "ar" ? "مركز إدارة الصلاحيات والأمان" : "Security & Permission Center"}
                </h2>
                <p className="text-xs text-amber-300 font-medium mt-0.5">
                  EMIRATES FALCON ERP — CENTRAL PERMISSION MATRIX & EXCEPTION ENGINE
                </p>
              </div>
            </div>
          </div>

          {/* User selector */}
          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 min-w-[300px]">
            <label className="text-[11px] font-bold text-amber-400 block mb-1.5">
              {language === "ar" ? "اختر المستهدف لعرض واستثناء الصلاحيات:" : "Target User Selection:"}
            </label>
            <SearchableSelect
              options={users.map((u) => ({
                id: u.id,
                title: `${u.nameAr || u.nameEn} (@${u.username})`,
                subtitle: `المسمى الوظيفي: ${u.role}${isSystemOwnerUser(u) ? " (مالك النظام ROOT)" : ""}`,
                badge: isSystemOwnerUser(u) ? "SYSTEM_OWNER" : u.role,
              }))}
              value={selectedUserId}
              onChange={(val) => setSelectedUserId(val)}
              placeholder={language === "ar" ? "ابحث عن مستخدم..." : "Select User..."}
            />
          </div>
        </div>

        {/* Selected User Header Banner */}
        {targetUser && (
          <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold block">{language === "ar" ? "اسم المستخدم والبريد" : "User Identifier"}</span>
              <div className="text-sm font-black text-white mt-1 flex items-center gap-2">
                <span>{targetUser.nameAr || targetUser.nameEn}</span>
                {isTargetSystemOwner && (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-extrabold">
                    ROOT OWNER
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 block mt-0.5">@{targetUser.username} — {targetUser.email}</span>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold block">{language === "ar" ? "المسمى الوظيفي الأساسي" : "Primary Role"}</span>
              <div className="text-sm font-black text-amber-400 mt-1">
                {targetUser.role}
              </div>
              <span className="text-xs text-slate-400 block mt-0.5">
                {isTargetSystemOwner ? "صلاحيات جزرية مطلقة غير قابلة للتعديل" : "محدد عبر مصفوفة الأدوار الوظيفية"}
              </span>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold block">{language === "ar" ? "حالة الصلاحيات النشطة" : "Active Effective Rate"}</span>
              <div className="text-sm font-black text-emerald-400 mt-1">
                {stats.granted} / {stats.total} ({Math.round((stats.granted / stats.total) * 100)}%)
              </div>
              <span className="text-xs text-slate-400 block mt-0.5">{stats.activeOverrides} استثناءات خاصة نشطة</span>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold block">{language === "ar" ? "الصلاحيات المحمية للإدارة" : "Admin-Only Directives"}</span>
              <div className="text-sm font-black text-rose-400 mt-1">
                {stats.adminOnly} {language === "ar" ? "صلاحيات حصرية" : "Protected"}
              </div>
              <span className="text-xs text-slate-400 block mt-0.5">
                {isTargetSystemOwner || targetUser.role === "SUPER_ADMIN" ? "متاحة لحساب الإدارة" : "محظورة عن الموظف العادي"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Warning Box for non-System Owners viewing matrix */}
      {!isCurrentSystemOwner && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-900 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <span>
            {language === "ar" 
              ? "وضع العرض فقط: إدارة استثناءات الصلاحيات ومصفوفة الموظفين مقتصرة حصرياً على مالك النظام الثابت (SYSTEM_OWNER)." 
              : "Read-only mode: Permission matrix management is exclusively restricted to SYSTEM_OWNER."}
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "ar" ? "ابحث باسم الصلاحية، الشاشة، أو الكود..." : "Search permissions..."}
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Filter by Module */}
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">{language === "ar" ? "جميع الوظائف (Modules)" : "All Modules"}</option>
              {availableModules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Filter by Risk Level */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">{language === "ar" ? "جميع مستويات الخطورة" : "All Risk Levels"}</option>
              <option value="CRITICAL">CRITICAL (حرج)</option>
              <option value="HIGH">HIGH (عالي)</option>
              <option value="MEDIUM">MEDIUM (متوسط)</option>
              <option value="LOW">LOW (عادي)</option>
            </select>

            {/* Filter by Effective Status */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">{language === "ar" ? "جميع الحالات" : "All Statuses"}</option>
              <option value="GRANTED">{language === "ar" ? "الممنوحة فقط (Granted)" : "Granted Only"}</option>
              <option value="DENIED">{language === "ar" ? "المحظورة فقط (Denied)" : "Denied Only"}</option>
              <option value="INHERITED">{language === "ar" ? "موروثة من الدور (Role)" : "Inherited"}</option>
              <option value="ADMIN_ONLY">{language === "ar" ? "حصرية للإدارة (Admin-Only)" : "Admin-Only"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Permission Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700" />
            <h3 className="text-xs font-black text-slate-800">
              {language === "ar" ? `مصفوفة الصلاحيات والاستثناءات للمستخدم: (${targetUser?.nameAr || targetUser?.nameEn})` : `Permission Matrix for: ${targetUser?.nameAr}`}
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            {permissionRows.length} {language === "ar" ? "صلاحية معروضة" : "Permissions Shown"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="p-3">Module</th>
                <th className="p-3">{language === "ar" ? "الشاشة / الإجراء" : "Screen & Action"}</th>
                <th className="p-3">Permission ID</th>
                <th className="p-3">{language === "ar" ? "الخطورة" : "Risk"}</th>
                <th className="p-3">{language === "ar" ? "الدور الأساسي" : "Role Base"}</th>
                <th className="p-3">{language === "ar" ? "الاستثناء الخاص" : "User Override"}</th>
                <th className="p-3">{language === "ar" ? "الصلاحية النافذة" : "Effective"}</th>
                <th className="p-3 text-center">{language === "ar" ? "التحكم والإجراء" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionRows.map(({ definition, effective, override }) => {
                return (
                  <tr key={definition.permissionId} className="hover:bg-amber-50/30 transition-colors">
                    {/* Module */}
                    <td className="p-3 font-bold text-slate-900">
                      <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px]">
                        {definition.module}
                      </span>
                    </td>

                    {/* Screen & Action */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{definition.screen}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{definition.descriptionAr}</div>
                    </td>

                    {/* Permission ID */}
                    <td className="p-3">
                      <code className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-800">
                        {definition.permissionId}
                      </code>
                      {definition.adminOnly && (
                        <div className="text-[9px] text-rose-600 font-extrabold mt-1">
                          [ADMIN ONLY]
                        </div>
                      )}
                    </td>

                    {/* Risk Level */}
                    <td className="p-3">
                      {getRiskBadge(definition.riskLevel)}
                    </td>

                    {/* Role Base */}
                    <td className="p-3">
                      {effective.source === "ROLE" || effective.source === "SYSTEM_OWNER" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>مسموح</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>غير مسند</span>
                        </span>
                      )}
                    </td>

                    {/* User Override */}
                    <td className="p-3">
                      {override ? (
                        <div className="space-y-1">
                          {override.effect === "GRANT" ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md text-[10px] border border-emerald-200 inline-block">
                              GRANT (منح استثنائي)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-extrabold rounded-md text-[10px] border border-rose-200 inline-block">
                              DENY (حظر استثنائي)
                            </span>
                          )}
                          {override.reason && (
                            <div className="text-[10px] text-slate-500 italic max-w-[150px] truncate">
                              "{override.reason}"
                            </div>
                          )}
                          {override.expiresAt && (
                            <div className="text-[9px] text-amber-700 font-bold">
                              ينتهي: {new Date(override.expiresAt).toLocaleDateString("ar-AE")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-normal">لا يوجد استثناء</span>
                      )}
                    </td>

                    {/* Effective Status */}
                    <td className="p-3">
                      {effective.granted ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-1 rounded-xl border border-emerald-200">
                            مسموح (EFFECTIVE)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="font-black text-rose-800 bg-rose-50 px-2 py-1 rounded-xl border border-rose-200">
                            ممنوع (DENIED)
                          </span>
                        </div>
                      )}
                      <div className="text-[9px] text-slate-400 mt-1">
                        المصدر: {effective.source}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="p-3 text-center">
                      {isCurrentSystemOwner && !isTargetSystemOwner ? (
                        <div className="flex items-center justify-center gap-1.5">
                          {override ? (
                            <button
                              onClick={() => handleRevokeOverride(override.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 rounded-xl text-[11px] font-bold transition-all border border-slate-200 cursor-pointer flex items-center gap-1"
                              title="إلغاء الاستثناء"
                            >
                              <RotateCcwIcon className="w-3 h-3" />
                              <span>إلغاء</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenOverrideModal(definition, "GRANT")}
                                disabled={definition.adminOnly && targetUser?.role !== "SUPER_ADMIN" && targetUser?.role !== "MANAGER"}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-[11px] font-extrabold border border-emerald-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                + منح
                              </button>
                              <button
                                onClick={() => handleOpenOverrideModal(definition, "DENY")}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-[11px] font-extrabold border border-rose-200 cursor-pointer transition-all"
                              >
                                - حظر
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">محمي</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Modal */}
      <AnimatePresence>
        {activeOverrideModal && targetUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                    activeOverrideModal.effect === "GRANT" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {activeOverrideModal.effect === "GRANT" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {activeOverrideModal.effect === "GRANT" ? "تسجيل منح استثنائي (GRANT)" : "تسجيل حظر استثنائي (DENY)"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      للمستخدم: {targetUser.nameAr} (@{targetUser.username})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveOverrideModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              {overrideFeedback && (
                <div className={`p-3 rounded-2xl text-xs font-bold ${
                  overrideFeedback.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}>
                  {overrideFeedback.message}
                </div>
              )}

              <form onSubmit={handleSaveOverride} className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">الصلاحية المستهدفة:</span>
                  <div className="font-mono text-xs font-black text-slate-900">{activeOverrideModal.permission.permissionId}</div>
                  <div className="text-xs text-slate-600 mt-1">{activeOverrideModal.permission.descriptionAr}</div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    مبرر وسسبب الاستثناء (Reason required for Audit): *
                  </label>
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    required
                    placeholder="اكتب سبب منح أو حظر هذه الصلاحية للموظف..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    تاريخ انتهاء الاستثناء (اختياري - يترك فارغاً للاستثناء الدائم):
                  </label>
                  <input
                    type="date"
                    value={overrideExpiration}
                    onChange={(e) => setOverrideExpiration(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveOverrideModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl text-xs font-black text-white cursor-pointer shadow-md ${
                      activeOverrideModal.effect === "GRANT" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    حفظ الاستثناء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RotateCcwIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
