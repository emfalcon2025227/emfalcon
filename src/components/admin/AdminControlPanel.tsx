import React, { useState } from "react";
import { createPortal } from "react-dom";
import { 
  ShieldAlert, Users, Database, RefreshCw, Trash2, Download, Upload, 
  CheckCircle2, AlertTriangle, Key, UserPlus, Lock, Unlock, Sliders, FileText, Settings, ShieldCheck, Edit3, Eye, EyeOff, Shield 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SearchableSelect } from "../common/SearchableSelect";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth, ROLE_PERMISSIONS } from "../../context/AuthContext";
import { UserRole, Permission, User } from "../../types";

export const AdminControlPanel: React.FC = () => {
  const { language } = useLanguage();
  const { 
    owners, properties, units, tenants, leases, cheques, cases, collections, auditLogs,
    clearTable, resetDatabase, exportDatabaseJSON, importDatabaseJSON 
  } = useData();
  const { users, currentUser, createUser, updateUser, updateUserStatus, updateUserRole, resetUserPassword, hasPermission, deleteUser, canRemixAndShare } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<"USERS" | "TABLES" | "MIGRATION" | "SYSTEM">("USERS");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // New user form state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userToDeleteConfirm, setUserToDeleteConfirm] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNameAr, setNewNameAr] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("PROPERTY_MANAGER");
  const [newPhone, setNewPhone] = useState("+971501234567");
  const [newPassword, setNewPassword] = useState("Falcon@1234");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Edit user modal state
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNameAr, setEditNameAr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("PROPERTY_MANAGER");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Change password modal state
  const [userToChangePassword, setUserToChangePassword] = useState<User | null>(null);
  const [passInput, setPassInput] = useState("");
  const [showPassInput, setShowPassInput] = useState(false);

  const showMsg = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newNameAr || !newPassword) {
      showMsg("error", language === "ar" ? "يرجى ملء كافة الحقول المطلوبة بما فيها كلمة المرور" : "Please fill all required fields including password");
      return;
    }
    const res = createUser({
      username: newUsername,
      email: newEmail,
      nameAr: newNameAr,
      nameEn: newNameEn || newNameAr,
      role: newRole,
      phone: newPhone,
      password: newPassword,
      isActive: true,
    });
    if (res.success) {
      showMsg("success", language === "ar" ? "تم إنشاء المستخدم وتعيين كلمة المرور بنجاح" : "User created with password successfully");
      setShowAddUserModal(false);
      setNewUsername("");
      setNewEmail("");
      setNewNameAr("");
      setNewNameEn("");
      setNewPassword("Falcon@1234");
    } else {
      showMsg("error", res.error || "Error creating user");
    }
  };

  const handleOpenEditUser = (u: User) => {
    setUserToEdit(u);
    setEditUsername(u.username || "");
    setEditEmail(u.email || "");
    setEditNameAr(u.nameAr || "");
    setEditNameEn(u.nameEn || "");
    setEditRole(u.role || "PROPERTY_MANAGER");
    setEditPhone(u.phone || "");
    setEditPassword(u.password || "");
    setShowEditPassword(false);
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    if (!editUsername || !editEmail || !editNameAr) {
      showMsg("error", language === "ar" ? "يرجى تعبئة الحقول الأساسية" : "Please fill required fields");
      return;
    }
    updateUser(userToEdit.id, {
      username: editUsername,
      email: editEmail,
      nameAr: editNameAr,
      nameEn: editNameEn || editNameAr,
      role: editRole,
      phone: editPhone,
      ...(editPassword ? { password: editPassword } : {}),
    });
    showMsg("success", language === "ar" ? `تم تحديث بيانات المستخدم (${editNameAr}) بنجاح` : `User details updated successfully`);
    setUserToEdit(null);
  };

  const handleOpenChangePassword = (u: User) => {
    setUserToChangePassword(u);
    setPassInput(u.password || "Falcon@1234");
    setShowPassInput(false);
  };

  const handleSavePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToChangePassword) return;
    if (!passInput || passInput.trim().length < 4) {
      showMsg("error", language === "ar" ? "كلمة المرور يجب أن لا تقل عن 4 رموز" : "Password must be at least 4 characters");
      return;
    }
    resetUserPassword(userToChangePassword.id, passInput);
    showMsg("success", language === "ar" ? `تم تحديث كلمة المرور للمستخدم (@${userToChangePassword.username}) إلى: ${passInput}` : `Password updated for @${userToChangePassword.username}`);
    setUserToChangePassword(null);
  };

  const handleClearTableAction = (tableName: string, tableLabel: string) => {
    const confirmMsg = language === "ar" 
      ? `هل أنت متأكد تماماً من رغبتك في حذف وتفريغ كافة بيانات جدول (${tableLabel})؟`
      : `Are you sure you want to clear all records in (${tableLabel})?`;
    if (window.confirm(confirmMsg)) {
      clearTable(tableName);
      showMsg("success", language === "ar" ? `تم تفريغ جدول ${tableLabel} بنجاح` : `Successfully cleared ${tableLabel}`);
    }
  };

  const handleFactoryReset = async () => {
    const confirmMsg = language === "ar"
      ? "تحذير خطير: سيتم تصفير وإعادة تعيين قاعدة البيانات بالكامل وحذف كافة السجلات والمستأجرين والعقارات والشيكات! هل أنت متأكد؟"
      : "DANGER WARNING: This will perform a full factory reset and wipe all system data! Are you sure?";
    if (window.confirm(confirmMsg)) {
      await resetDatabase();
      showMsg("success", language === "ar" ? "تم تصفير وإعادة تعيين النظام بنجاح" : "System factory reset completed");
    }
  };

  const handleExportBackup = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Falcon_DB_Backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg("success", language === "ar" ? "تم تصدير النسخة الاحتياطية بنجاح" : "Database backup exported successfully");
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const success = importDatabaseJSON(content);
        if (success) {
          showMsg("success", language === "ar" ? "تم استيراد ونقل قاعدة البيانات بنجاح!" : "Database successfully imported and restored!");
        } else {
          showMsg("error", language === "ar" ? "ملف النسخة الاحتياطية غير صالح" : "Invalid backup file format");
        }
      } catch (err) {
        showMsg("error", language === "ar" ? "خطأ في قراءة الملف" : "Error reading backup file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              {language === "ar" ? "لوحة تحكم المسؤول المتقدمة (Admin Control Panel)" : "Advanced Admin Control Panel"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === "ar"
                ? "إدارة المستخدمين، صلاحيات الأدوار (RBAC)، تفريغ الجداول، تصفير النظام، ونقل قاعدة البيانات"
                : "Manage users, RBAC permissions, table purging, system reset, and database migration"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {currentUser?.nameAr || currentUser?.nameEn} ({currentUser?.role})
          </span>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm ${
          feedback.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
        }`}>
          {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSubTab("USERS")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === "USERS" ? "bg-amber-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{language === "ar" ? "المستخدمين والصلاحيات" : "Users & RBAC"}</span>
        </button>

        <button
          onClick={() => setActiveSubTab("TABLES")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === "TABLES" ? "bg-amber-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>{language === "ar" ? "إدارة وتفريغ جداول البيانات" : "Table Data Purging"}</span>
        </button>

        <button
          onClick={() => setActiveSubTab("MIGRATION")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === "MIGRATION" ? "bg-amber-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Download className="w-4 h-4" />
          <span>{language === "ar" ? "النسخ الاحتياطي ونقل القاعدة" : "Backup & Migration"}</span>
        </button>

        <button
          onClick={() => setActiveSubTab("SYSTEM")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === "SYSTEM" ? "bg-rose-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>{language === "ar" ? "إعادة ضبط مصنع النظام" : "Factory Reset"}</span>
        </button>
      </div>

      {/* SUBTAB 1: USERS & RBAC */}
      {activeSubTab === "USERS" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar" ? "إدارة مستخدمي النظام وصلاحيات الأدوار (RBAC)" : "System Users & Role-Based Permissions Management"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "ar" ? "إنشاء وتعديل صلاحيات وحالة حسابات المستخدمين" : "Create and configure access control for system operators"}
              </p>
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{language === "ar" ? "إضافة مستخدم جديد" : "Create New User"}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4 text-start">User</th>
                  <th className="py-3 px-4 text-start">Username / Email</th>
                  <th className="py-3 px-4 text-start">Role</th>
                  <th className="py-3 px-4 text-start">Status</th>
                  <th className="py-3 px-4 text-start">Actions / Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {users.map((u) => {
                  const rolePermissions = ROLE_PERMISSIONS[u.role] || [];
                  const isProtected = u.id === "usr-01" || u.email.toLowerCase() === "m_hamed@msn.com" || u.email.toLowerCase() === "emfalcon2025227@gmail.com" || u.username.toLowerCase() === "mahmoud";
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-xs">
                            {u.nameEn.charAt(0)}
                          </div>
                          <div>
                            <div>{u.nameAr}</div>
                            <div className="text-[10px] text-slate-400">{u.nameEn}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-[11px] text-slate-800">@{u.username}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <SearchableSelect
                          className="w-44"
                          options={[
                            { id: "SUPER_ADMIN", label: "SUPER_ADMIN (مدير عام)" },
                            { id: "MANAGER", label: "MANAGER (مدير تنفيذي)" },
                            { id: "FINANCE", label: "FINANCE (محاسب)" },
                            { id: "LEGAL", label: "LEGAL (مستشار قانوني)" },
                            { id: "PROPERTY_MANAGER", label: "PROPERTY_MANAGER (مشرف عقارات)" },
                            { id: "DATA_ENTRY", label: "DATA_ENTRY (مدخل بيانات)" },
                          ]}
                          value={u.role}
                          onChange={(val) => hasPermission("EDIT_USER") && !isProtected && updateUserRole(u.id, val as UserRole)}
                          disabled={!hasPermission("EDIT_USER") || isProtected}
                          placeholder={language === "ar" ? "اختر الدور..." : "Select role..."}
                          searchPlaceholder={language === "ar" ? "ابحث بالدور..." : "Search role..."}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => hasPermission("EDIT_USER") && !isProtected && updateUserStatus(u.id, !u.isActive)}
                          disabled={!hasPermission("EDIT_USER") || isProtected}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            u.isActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          } ${(!hasPermission("EDIT_USER") || isProtected) ? "opacity-75 cursor-not-allowed" : ""}`}
                        >
                          {u.isActive ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {u.isActive ? (isProtected ? (language === "ar" ? "نشط دائم (Protected)" : "Active (Protected)") : "نشط (Active)") : "معطل (Disabled)"}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 my-1">
                          {hasPermission("EDIT_USER") && (
                            <>
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                title={language === "ar" ? "تعديل بيانات المستخدم" : "Edit User Details"}
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                <span>{language === "ar" ? "تعديل البيانات" : "Edit"}</span>
                              </button>

                              <button
                                onClick={() => handleOpenChangePassword(u)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                title={language === "ar" ? "تغيير كلمة السر" : "Change Password"}
                              >
                                <Key className="w-3.5 h-3.5 text-amber-600" />
                                <span>{language === "ar" ? "تغيير كلمة السر" : "Password"}</span>
                              </button>
                            </>
                          )}

                          {(hasPermission("DELETE_USER") || hasPermission("MANAGE_USERS") || currentUser?.role === "SUPER_ADMIN") && (
                            <>
                              {isProtected ? (
                                <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                                  <span>{language === "ar" ? "مسؤول رئيسي محمي" : "Protected Primary Admin"}</span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setUserToDeleteConfirm(u)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>{language === "ar" ? "حذف" : "Delete"}</span>
                                </button>
                              )}
                            </>
                          )}

                          {u.id === currentUser?.id && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                              {language === "ar" ? "حسابك" : "Logged in"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TABLE DATA PURGING */}
      {activeSubTab === "TABLES" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              {language === "ar" ? "حذف وتفريغ بيانات الجداول (Table Data Purging)" : "Select Table Data Purging"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar"
                ? "يمكنك حذف بيانات جدول محدد بالكامل دون التأثير على بقية جداول النظام."
                : "Safely purge individual database tables without affecting other modules."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { id: "owners", label: language === "ar" ? "الملاك (Owners)" : "Owners", count: owners.length },
              { id: "properties", label: language === "ar" ? "العقارات (Properties)" : "Properties", count: properties.length },
              { id: "units", label: language === "ar" ? "الوحدات (Units)" : "Units", count: units.length },
              { id: "tenants", label: language === "ar" ? "المستأجرين (Tenants)" : "Tenants", count: tenants.length },
              { id: "leases", label: language === "ar" ? "عقود الإيجار (Leases)" : "Leases", count: leases.length },
              { id: "cheques", label: language === "ar" ? "الشيكات المالية (Cheques)" : "Cheques", count: cheques.length },
              { id: "cases", label: language === "ar" ? "القضايا الإيجارية (Cases)" : "Rental Cases", count: cases.length },
              { id: "collections", label: language === "ar" ? "سندات التحصيلات (Collections)" : "Collections", count: collections.length },
              { id: "auditLogs", label: language === "ar" ? "سجل التدقيق (Audit Logs)" : "Audit Logs", count: auditLogs.length },
            ].map((tbl) => (
              <div key={tbl.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">{tbl.label}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{tbl.count} records</div>
                </div>
                <button
                  onClick={() => handleClearTableAction(tbl.id, tbl.label)}
                  disabled={tbl.count === 0}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === "ar" ? "تفريغ" : "Clear"}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: BACKUP, REMIX & MIGRATION */}
      {activeSubTab === "MIGRATION" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900">
                  {language === "ar" ? "نسخ احتياطي، ريمكس ونقل قاعدة البيانات (Remix, Backup & Migration)" : "Database Backup, Remix & Migration"}
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                  <span>{language === "ar" ? "خاص بالمسؤول الرئيسي والمبتكر" : "Super Admin & Creator Only"}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {language === "ar"
                  ? "تصدير حزمة الريمكس كاملة بملف JSON، أو استيراد حالة قاعدة بيانات سابقة ونقلها بين الأنظمة."
                  : "Export or import full Remix database state as a secure JSON file."}
              </p>
            </div>
          </div>

          {!canRemixAndShare ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-rose-900 text-sm">
                {language === "ar" ? "خيارات الريمكس والمشاركة محظورة" : "Remix & Share Options Restricted"}
              </h4>
              <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
                {language === "ar"
                  ? "خيارات الريمكس، المشاركة ونقل قاعدة البيانات مخصصة حصرية فقط للمسؤول الرئيسي ومبتكر النظام ولا يمتلك أي مستخدم آخر هذه الصلاحيات."
                  : "Remixing, sharing, and database transfer options are granted exclusively to the Super Admin and System Creator."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-3">
                    <Download className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {language === "ar" ? "تصدير حزمة الريمكس الكاملة (JSON Remix Export)" : "Export Full Remix Package"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {language === "ar"
                      ? "يقوم بتنزيل ملف ريمكس يحتوي كافة الملاك، العقارات، الشيكات، المستأجرين، السجلات المالية والقضايا."
                      : "Downloads a complete snapshot of all tables, risk settings, and audit logs."}
                  </p>
                </div>
                <button
                  onClick={handleExportBackup}
                  className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{language === "ar" ? "تصدير وتحميل حزمة الريمكس" : "Download Remix Package"}</span>
                </button>
              </div>

              {/* Import / Transfer */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {language === "ar" ? "استيراد واستعادة حزمة ريمكس (JSON Import & Restore)" : "Import & Restore Remix Snapshot"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {language === "ar"
                      ? "استعادة البيانات من ملف ريمكس سابق ونقلها مباشرة إلى هذا النظام."
                      : "Restore database from a previously exported remix backup file."}
                  </p>
                </div>
                <div>
                  <label className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>{language === "ar" ? "اختر ملف حزمة الريمكس للاستيراد" : "Upload & Restore Remix File"}</span>
                    <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: FACTORY RESET */}
      {activeSubTab === "SYSTEM" && (
        <div className="bg-white rounded-3xl border border-rose-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-black text-rose-900 uppercase">
                {language === "ar" ? "تصفير وإعادة تعيين النظام بالكامل (Factory Reset)" : "Complete System Factory Reset"}
              </h3>
              <p className="text-xs text-rose-600 mt-0.5">
                {language === "ar" ? "إجراء لا يمكن التراجع عنه — يحذف كافة البيانات ويعيد النظام لحالته الأولى الفارغة" : "Irreversible action — wipes all records and restores factory default"}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-relaxed">
            {language === "ar"
              ? "عند الضغط أدناه، سيتم مسح كافة الملاك، العقارات، الشيكات المرتجعة، المستأجرين، القضايا، وسجلات التدقيق تماماً من الذاكرة المحلية وقاعدة البيانات."
              : "Clicking below will permanently erase all owners, properties, tenants, cheques, cases, and audit history from local storage."}
          </div>

          <div>
            <button
              onClick={handleFactoryReset}
              className="px-6 py-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{language === "ar" ? "تنفيذ التصفير الكامل وإعادة ضبط المصنع" : "Execute Full Factory Reset"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="font-black text-slate-900 text-base">
                {language === "ar" ? "إضافة مستخدم جديد للنظام" : "Create New System User"}
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "اسم المستخدم (Username)" : "Username"}</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. ahmed.manager"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "البريد الإلكتروني" : "Email Address"}</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ahmed@falcon.ae"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "الاسم بالعربي" : "Arabic Name"}</label>
                <input
                  type="text"
                  required
                  value={newNameAr}
                  onChange={(e) => setNewNameAr(e.target.value)}
                  placeholder="أحمد إبراهيم"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "الاسم بالانجليزي" : "English Name"}</label>
                <input
                  type="text"
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  placeholder="Ahmed Ibrahim"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "الدور والصلاحيات (Role)" : "User Role (RBAC)"}</label>
                <SearchableSelect
                  options={[
                    { id: "SUPER_ADMIN", label: "SUPER_ADMIN (مدير عام)" },
                    { id: "MANAGER", label: "MANAGER (مدير تنفيذي)" },
                    { id: "FINANCE", label: "FINANCE (محاسب)" },
                    { id: "LEGAL", label: "LEGAL (مستشار قانوني)" },
                    { id: "PROPERTY_MANAGER", label: "PROPERTY_MANAGER (مشرف عقارات)" },
                    { id: "DATA_ENTRY", label: "DATA_ENTRY (مدخل بيانات)" },
                  ]}
                  value={newRole}
                  onChange={(val) => setNewRole(val as UserRole)}
                  placeholder={language === "ar" ? "اختر الدور..." : "Select role..."}
                  searchPlaceholder={language === "ar" ? "ابحث بالدور..." : "Search role..."}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "كلمة المرور (Password)" : "Password"}</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Falcon@1234"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {language === "ar" ? "أدخل كلمة المرور التي يستطيع بها هذا المستخدم تسجيل الدخول" : "Set login password for this user"}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "رقم الهاتف" : "Phone"}</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {language === "ar" ? "إنشاء المستخدم" : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER DATA MODAL */}
      {userToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {language === "ar" ? "تعديل بيانات المستخدم" : "Edit User Details"}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">@{userToEdit.username}</p>
                </div>
              </div>
              <button onClick={() => setUserToEdit(null)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "اسم المستخدم (Username)" : "Username"}</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "البريد الإلكتروني" : "Email"}</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "الاسم بالعربي" : "Arabic Name"}</label>
                  <input
                    type="text"
                    required
                    value={editNameAr}
                    onChange={(e) => setEditNameAr(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "الاسم بالانجليزي" : "English Name"}</label>
                  <input
                    type="text"
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "الدور والصلاحيات" : "User Role"}</label>
                  <SearchableSelect
                    options={[
                      { id: "SUPER_ADMIN", label: "SUPER_ADMIN (مدير عام)" },
                      { id: "MANAGER", label: "MANAGER (مدير تنفيذي)" },
                      { id: "FINANCE", label: "FINANCE (محاسب)" },
                      { id: "LEGAL", label: "LEGAL (مستشار قانوني)" },
                      { id: "PROPERTY_MANAGER", label: "PROPERTY_MANAGER (مشرف عقارات)" },
                      { id: "DATA_ENTRY", label: "DATA_ENTRY (مدخل بيانات)" },
                    ]}
                    value={editRole}
                    onChange={(val) => setEditRole(val as UserRole)}
                    disabled={userToEdit.id === "usr-01" || userToEdit.email.toLowerCase() === "m_hamed@msn.com"}
                    placeholder={language === "ar" ? "اختر الدور..." : "Select role..."}
                    searchPlaceholder={language === "ar" ? "ابحث بالدور..." : "Search role..."}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "رقم الهاتف" : "Phone"}</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "كلمة المرور (اختياري لتحديثها)" : "Password (Optional)"}</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="اكتب كلمة سر جديدة إن أردت تغييرها"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {language === "ar" ? "حفظ التعديلات" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {createPortal(
        <AnimatePresence>
          {userToChangePassword && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setUserToChangePassword(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 space-y-5 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base">
                        {language === "ar" ? "تغيير كلمة السر" : "Change Password"}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold">
                        {userToChangePassword.nameAr} (@{userToChangePassword.username})
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setUserToChangePassword(null)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
                </div>

                <form onSubmit={handleSavePasswordChange} className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">{language === "ar" ? "كلمة المرور الجديدة" : "New Password"}</label>
                      <button
                        type="button"
                        onClick={() => setPassInput("Falcon@" + Date.now() % 10000)}
                        className="text-[11px] text-amber-700 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{language === "ar" ? "توليد كلمة سر عشوائية" : "Generate Random"}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassInput ? "text" : "password"}
                        required
                        value={passInput}
                        onChange={(e) => setPassInput(e.target.value)}
                        placeholder="Falcon@1234"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm pe-10 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassInput(!showPassInput)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                      {language === "ar" ? "قم بكتابة كلمة المرور الجديدة وسيقوم المستخدم باستعمالها للدخول" : "Type the new password for this user to login with"}
                    </p>
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setUserToChangePassword(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
                    >
                      {language === "ar" ? "إلغاء" : "Cancel"}
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Key className="w-4 h-4" />
                      <span>{language === "ar" ? "حفظ كلمة المرور" : "Save Password"}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {userToDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center mb-2">
              {language === "ar" ? "تأكيد حذف المستخدم" : "Confirm Delete User"}
            </h3>
            <p className="text-xs text-slate-600 text-center mb-6 leading-relaxed">
              {language === "ar"
                ? `هل أنت متأكد تماماً من رغبتك في حذف المستخدم (${userToDeleteConfirm.nameAr || userToDeleteConfirm.username}) نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to permanently delete user (${userToDeleteConfirm.nameEn || userToDeleteConfirm.username})? This action cannot be undone.`}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUserToDeleteConfirm(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteUser(userToDeleteConfirm.id);
                  if (res.success) {
                    showMsg("success", language === "ar" ? `تم حذف المستخدم ${userToDeleteConfirm.nameAr || userToDeleteConfirm.username} بنجاح` : `User ${userToDeleteConfirm.username} deleted successfully`);
                  } else {
                    showMsg("error", res.error || "Error deleting user");
                  }
                  setUserToDeleteConfirm(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
