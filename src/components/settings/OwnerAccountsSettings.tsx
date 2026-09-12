import React, { useState, useMemo } from "react";
import {
  Building2,
  Search,
  RefreshCw,
  Key,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Edit,
  Save,
  X,
  Sparkles,
  Lock,
  MessageCircle,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { User, Owner, PortalAccountStatus } from "../../types";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";
import {
  dispatchPortalAccessNotification,
  openWhatsAppDirect,
  formatWhatsAppPortalAccess,
} from "../../services/automatedEmailService";
import { QuickCommunicationButtons } from "../common/QuickCommunicationButtons";

export const OwnerAccountsSettings: React.FC = () => {
  const { language } = useLanguage();
  const { users, provisionPortalAccount, getPortalAccountInfo, syncPortalAccounts, resetUserPassword, updateUserStatus, updateUser } = useAuth();
  const { owners, tenants, updateOwner, logAudit } = useData();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Password reset modal state
  const [resetPassModal, setResetPassModal] = useState<{
    isOpen: boolean;
    ownerName: string;
    email: string;
    tempPass: string;
  }>({
    isOpen: false,
    ownerName: "",
    email: "",
    tempPass: "",
  });

  // Edit Owner Email modal
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Custom Password Change / Fixed Password Modal for Owner
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    owner: Owner | null;
    user: User | null;
    passwordInput: string;
    successMessage: string | null;
  }>({
    isOpen: false,
    owner: null,
    user: null,
    passwordInput: "Falcon@2025",
    successMessage: null,
  });

  // Send Email Modal State
  const [sendEmailModal, setSendEmailModal] = useState<{
    isOpen: boolean;
    owner: Owner | null;
    user: User | null;
    recipientEmail: string;
    emailSubject: string;
    emailBody: string;
    statusMessage: string | null;
  }>({
    isOpen: false,
    owner: null,
    user: null,
    recipientEmail: "",
    emailSubject: "",
    emailBody: "",
    statusMessage: null,
  });

  const handleOpenSendEmail = (owner: Owner, user: User | null) => {
    const email = owner.email || user?.username || "";
    let passwordVal = "Falcon@2025";
    try {
      if (user?.password) {
        passwordVal = atob(user.password);
      }
    } catch (e) {
      passwordVal = user?.password || "Falcon@2025";
    }

    const ownerName = language === "ar" ? owner.nameAr : owner.nameEn;
    const subject = language === "ar"
      ? `بيانات الدخول لبوابة الملاك - شركة صقر الإمارات للعقارات`
      : `Owner Portal Login Credentials - Emirates Falcon Real Estate`;

    const body = language === "ar"
      ? `عزيزي المالك المحترم / ${ownerName},\n\nيسرنا إحاطتكم علماً بأنه تم تفعيل حسابكم الخاص بـ "بوابة الملاك" في نظام شركة صقر الإمارات للعقارات.\n\nبيانات الدخول الخاصة بكم:\n- رابط البوابة: ${window.location.origin}\n- اسم المستخدم (البريد الإلكتروني): ${email}\n- كلمة المرور المؤقتة / المعتمدة: ${passwordVal}\n\nيرجى تسجيل الدخول وتغيير كلمة المرور الخاصة بكم عند الدخول الأول لدواعي الأمان.\n\nمع تحيات إدارة شركة صقر الإمارات للعقارات.`
      : `Dear Esteemed Owner / ${ownerName},\n\nWe are pleased to inform you that your Owner Portal account has been activated at Emirates Falcon Real Estate ERP.\n\nYour Login Credentials:\n- Portal URL: ${window.location.origin}\n- Username (Email): ${email}\n- Temporary / Approved Password: ${passwordVal}\n\nPlease login and update your password upon first entry for security purposes.\n\nBest regards,\nEmirates Falcon Real Estate Management.`;

    setSendEmailModal({
      isOpen: true,
      owner,
      user,
      recipientEmail: email,
      emailSubject: subject,
      emailBody: body,
      statusMessage: null,
    });
  };

  const handleExecuteSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendEmailModal.recipientEmail) return;

    try {
      const ownerName = language === "ar" ? sendEmailModal.owner?.nameAr || "" : sendEmailModal.owner?.nameEn || "";
      let passVal = "Falcon@2025";
      try {
        passVal = sendEmailModal.user?.password ? atob(sendEmailModal.user.password) : "Falcon@2025";
      } catch (e) {
        passVal = sendEmailModal.user?.password || "Falcon@2025";
      }

      const res = await dispatchPortalAccessNotification({
        recipient: sendEmailModal.recipientEmail,
        role: "OWNER",
        name: ownerName,
        username: sendEmailModal.user?.username || sendEmailModal.recipientEmail,
        password: passVal,
      });

      if (logAudit && sendEmailModal.owner) {
        logAudit("UPDATE", "OWNER", sendEmailModal.owner.id, sendEmailModal.owner.nameAr, `Automated dispatch of portal credentials to owner email: ${sendEmailModal.recipientEmail}`);
      }

      if (res.success) {
        setSendEmailModal(prev => ({
          ...prev,
          statusMessage: language === "ar" ? "✅ تم إرسال البريد الإلكتروني تلقائياً عبر النظام بنجاح!" : "✅ Email automatically sent via system successfully!",
        }));

        setTimeout(() => {
          setSendEmailModal({ isOpen: false, owner: null, user: null, recipientEmail: "", emailSubject: "", emailBody: "", statusMessage: null });
        }, 1800);
      } else {
        alert(res.error || "فشل إرسال البريد الإلكتروني");
      }
    } catch (err: any) {
      alert(err?.message || "خطأ أثناء إرسال البريد الإلكتروني");
    }
  };

  const handleSaveOwnerPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModal.user || !passwordModal.passwordInput.trim()) return;
    
    // Set custom fixed password (non-random, persistent)
    resetUserPassword(passwordModal.user.id, passwordModal.passwordInput.trim());
    
    updateUser(passwordModal.user.id, {
      isFirstLoginCompleted: true,
      portalAccountStatus: "ACTIVE",
    });

    setPasswordModal(prev => ({
      ...prev,
      successMessage: language === "ar" ? "✅ تم تحديث وتثبيت كلمة المرور بنجاح ولن يتم تغييرها عشوائياً." : "✅ Password updated and fixed successfully.",
    }));

    setTimeout(() => {
      setPasswordModal({ isOpen: false, owner: null, user: null, passwordInput: "Falcon@2025", successMessage: null });
    }, 1500);
  };

  const handleSyncAll = async () => {
    const createdCount = await syncPortalAccounts(owners, tenants);
    if (createdCount > 0) {
      setSyncFeedback(
        language === "ar"
          ? `تمت المزامنة بنجاح: تم إنشاء وتفعيل ${createdCount} حسابات بوابات جديدة تلقائياً`
          : `Sync complete: Automatically provisioned ${createdCount} new portal accounts`
      );
    } else {
      setSyncFeedback(
        language === "ar"
          ? "جميع الملاك والمستأجرين الذاتين للبريد الإلكتروني لديهم حسابات بوابات معرفة ومحدثة مسبقاً"
          : "All eligible owners & tenants already have provisioned portal accounts"
      );
    }
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const ownerAccountRows = useMemo(() => {
    return owners.map((owner) => {
      const info = getPortalAccountInfo(owner.id, "OWNER", owner.email);
      return {
        owner,
        info,
      };
    });
  }, [owners, users, getPortalAccountInfo]);

  const filteredRows = useMemo(() => {
    return ownerAccountRows.filter(({ owner, info }) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        owner.nameEn.toLowerCase().includes(search) ||
        owner.nameAr.includes(searchTerm) ||
        (owner.email || "").toLowerCase().includes(search) ||
        (owner.code || "").toLowerCase().includes(search);

      if (!matchesSearch) return false;

      if (statusFilter === "ALL") return true;
      return info.status === statusFilter;
    });
  }, [ownerAccountRows, searchTerm, statusFilter]);

  const handleResetPassword = (owner: Owner, user: User) => {
    const tempPass = resetUserPassword(user.id);
    // Mark mustChangePassword
    updateUser(user.id, {
      mustChangePassword: true,
      isFirstLoginCompleted: false,
      portalAccountStatus: "PENDING_ACTIVATION",
    });

    setResetPassModal({
      isOpen: true,
      ownerName: language === "ar" ? owner.nameAr : owner.nameEn,
      email: owner.email,
      tempPass,
    });
  };

  const handleToggleStatus = (user: User) => {
    updateUserStatus(user.id, !user.isActive);
  };

  const handleSaveEditEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editingOwner) return;

    if (!editEmail || !editEmail.includes("@")) {
      setEditError(language === "ar" ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email address");
      return;
    }

    // Update owner record
    updateOwner(editingOwner.id, { email: editEmail });

    // Provision / update portal account
    provisionPortalAccount({
      portalRole: "OWNER",
      targetId: editingOwner.id,
      email: editEmail,
      nameEn: editingOwner.nameEn,
      nameAr: editingOwner.nameAr,
      phone: editingOwner.phone,
    });

    setEditingOwner(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Re-sync Toolbar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-700" />
              <span>{language === "ar" ? "إدارة حسابات بوابات الملاك" : "Owner Portal Accounts"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar"
                ? "يتم إنشاء حسابات Portal تلقائياً فور توفر بريد إلكتروني صالح للمالك. اسم المستخدم هو البريد الإلكتروني نفسه."
                : "Portal accounts are auto-provisioned whenever a valid email exists. Username equals owner email."}
            </p>
          </div>

          <button
            onClick={handleSyncAll}
            className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-4 h-4 text-amber-200" />
            <span>{language === "ar" ? "إعادة مزامنة حسابات الملاك تلقائياً" : "Auto-Sync All Owner Portals"}</span>
          </button>
        </div>

        {syncFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "البحث باسم المالك، البريد، أو الكود..." : "Search by owner name, email, or code..."}
              className="w-full ps-9 pe-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                statusFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {language === "ar" ? "الكل" : "All"} ({ownerAccountRows.length})
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                statusFilter === "ACTIVE" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {language === "ar" ? "نشط" : "Active"}
            </button>
            <button
              onClick={() => setStatusFilter("PENDING_ACTIVATION")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                statusFilter === "PENDING_ACTIVATION" ? "bg-sky-600 text-white" : "bg-sky-50 text-sky-700 hover:bg-sky-100"
              }`}
            >
              {language === "ar" ? "قيد التفعيل" : "Pending Activation"}
            </button>
            <button
              onClick={() => setStatusFilter("NOT_PROVISIONED")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                statusFilter === "NOT_PROVISIONED" ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {language === "ar" ? "يلزم بريد" : "Email Required"}
            </button>
            <button
              onClick={() => setStatusFilter("SUSPENDED")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                statusFilter === "SUSPENDED" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              {language === "ar" ? "موقوف" : "Suspended"}
            </button>
          </div>
        </div>
      </div>

      {/* Owner Portal Accounts Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4 text-start">{language === "ar" ? "المالك والكود" : "Owner & Code"}</th>
                <th className="p-4 text-start">{language === "ar" ? "اسم المستخدم / البريد الإلكتروني" : "Username / Email"}</th>
                <th className="p-4 text-center">{language === "ar" ? "حالة حساب البوابة" : "Portal Account Status"}</th>
                <th className="p-4 text-center">{language === "ar" ? "أول دخول" : "First Login"}</th>
                <th className="p-4 text-center">{language === "ar" ? "آخر تسجيل دخول" : "Last Login"}</th>
                <th className="p-4 text-end">{language === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    {language === "ar" ? "لا توجد سجلات بوابات مطابقة للبحث" : "No matching owner portal accounts found"}
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ owner, info }) => (
                  <tr key={owner.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Owner & Code */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center justify-center font-black text-xs shrink-0">
                          {owner.code.slice(-3)}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-xs">
                            {language === "ar" ? owner.nameAr : owner.nameEn}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {owner.code} • {owner.phone || (language === "ar" ? "بدون هاتف" : "No Phone")}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email / Username */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-slate-800 font-bold">
                          {owner.email || (
                            <span className="text-slate-400 italic">
                              {language === "ar" ? "غير مدخل - يلزم بريد" : "Missing Email"}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${info.statusColorClass}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{language === "ar" ? info.statusLabelAr : info.statusLabelEn}</span>
                      </span>
                    </td>

                    {/* First Login Completed */}
                    <td className="p-4 text-center font-bold">
                      {info.isFirstLoginCompleted ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-[11px]">
                          {language === "ar" ? "مكتمل ✓" : "Completed ✓"}
                        </span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-[11px]">
                          {language === "ar" ? "لم يكتمل بعد" : "Not Yet"}
                        </span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="p-4 text-center text-slate-500 text-[11px] font-mono">
                      {info.lastLogin ? (
                        new Date(info.lastLogin).toLocaleString(language === "ar" ? "ar-AE" : "en-US", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      ) : (
                        <span className="text-slate-400 italic">
                          {language === "ar" ? "لم يسجل دخول بعد" : "Never logged in"}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Email button */}
                        <button
                          onClick={() => {
                            setEditingOwner(owner);
                            setEditEmail(owner.email || "");
                            setEditError(null);
                          }}
                          title={language === "ar" ? "تعديل البريد الإلكتروني" : "Edit Email"}
                          className="p-2 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Reset / Change Password Button */}
                        {info.user && (
                          <button
                            onClick={() => {
                              let existingPass = "Falcon@2025";
                              try {
                                if (info.user?.password) {
                                  existingPass = atob(info.user.password);
                                }
                              } catch (e) {
                                existingPass = info.user?.password || "Falcon@2025";
                              }
                              setPasswordModal({
                                isOpen: true,
                                owner,
                                user: info.user,
                                passwordInput: existingPass,
                                successMessage: null,
                              });
                            }}
                            title={language === "ar" ? "تعديل وتثبيت كلمة المرور" : "Change & Fix Password"}
                            className="p-2 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        )}

                        {/* Send Email Credentials Button */}
                        {info.user && (
                          <button
                            onClick={() => handleOpenSendEmail(owner, info.user)}
                            title={language === "ar" ? "إرسال بيانات الدخول عبر البريد الإلكتروني" : "Send Credentials via Email"}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}

                        {/* WhatsApp Credentials Direct Button */}
                        {info.user && owner.phone && (
                          <button
                            onClick={() => {
                              let passVal = "Falcon@2025";
                              try {
                                passVal = info.user?.password ? atob(info.user.password) : "Falcon@2025";
                              } catch (e) {
                                passVal = info.user?.password || "Falcon@2025";
                              }
                              const text = formatWhatsAppPortalAccess(
                                language === "ar" ? owner.nameAr : owner.nameEn,
                                "OWNER",
                                info.user.username,
                                passVal
                              );
                              openWhatsAppDirect(owner.phone, text);
                            }}
                            title={language === "ar" ? `إرسال بيانات الدخول عبر واتساب (${owner.phone})` : "Send Credentials via WhatsApp"}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Toggle Active / Suspend */}
                        {info.user && (
                          <button
                            onClick={() => handleToggleStatus(info.user!)}
                            title={info.user.isActive ? (language === "ar" ? "إيقاف الحساب" : "Suspend Account") : (language === "ar" ? "تفعيل الحساب" : "Activate Account")}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              info.user.isActive
                                ? "text-rose-600 hover:bg-rose-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {info.user.isActive ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Password Result Modal */}
      {resetPassModal.isOpen && (
        <Modal
          isOpen={resetPassModal.isOpen}
          onClose={() => setResetPassModal({ isOpen: false, ownerName: "", email: "", tempPass: "" })}
          title={language === "ar" ? "كلمة المرور المؤقتة لمالك العقار" : "Temporary Owner Password"}
        >
          <div className="space-y-5 p-2">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-2">
              <Key className="w-8 h-8 text-amber-700 mx-auto" />
              <h4 className="font-black text-slate-900 text-sm">{resetPassModal.ownerName}</h4>
              <p className="text-xs text-slate-600 font-mono">{resetPassModal.email}</p>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-center">
              <p className="text-xs text-amber-400 font-medium">
                {language === "ar" ? "كلمة المرور المؤقتة الجديدة:" : "New Temporary Password:"}
              </p>
              <p className="text-2xl font-mono font-black text-white tracking-widest selection:bg-amber-500">
                {resetPassModal.tempPass}
              </p>
              <p className="text-[11px] text-slate-400">
                {language === "ar"
                  ? "سيُطلب من المالك تغيير هذه كلمة المرور إجبارياً عند أول تسجيل دخول للبوابة."
                  : "The owner will be forced to set a new password upon first login."}
              </p>
            </div>

            <button
              onClick={() => setResetPassModal({ isOpen: false, ownerName: "", email: "", tempPass: "" })}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              {language === "ar" ? "إغلاق" : "Close"}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Email Modal */}
      {editingOwner && (
        <Modal
          isOpen={!!editingOwner}
          onClose={() => setEditingOwner(null)}
          title={language === "ar" ? "تعديل البريد الإلكتروني للمالك" : "Edit Owner Email"}
        >
          <form onSubmit={handleSaveEditEmail} className="space-y-4 p-2">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <p className="font-black text-slate-900">
                {language === "ar" ? editingOwner.nameAr : editingOwner.nameEn} ({editingOwner.code})
              </p>
              <p className="text-slate-500 mt-1">
                {language === "ar"
                  ? "تحديث البريد سيعيد ربط حساب البوابة بنفس البريد الإلكتروني فورياً."
                  : "Updating email will re-link the owner portal account immediately."}
              </p>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "البريد الإلكتروني الجديد" : "New Email Address"}
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingOwner(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{language === "ar" ? "حفظ وتحديث الحساب" : "Save & Update Account"}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Change & Fix Owner Password Modal */}
      {passwordModal.isOpen && passwordModal.owner && passwordModal.user && (
        <Modal
          isOpen={passwordModal.isOpen}
          onClose={() => setPasswordModal({ isOpen: false, owner: null, user: null, passwordInput: "Falcon@2025", successMessage: null })}
          title={language === "ar" ? `إدارة وتثبيت كلمة مرور المالك: ${language === "ar" ? passwordModal.owner.nameAr : passwordModal.owner.nameEn}` : `Manage & Fix Password for Owner`}
        >
          <form onSubmit={handleSaveOwnerPassword} className="space-y-4 p-2">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-1">
              <p className="font-black text-slate-900">
                {language === "ar" ? "اسم المستخدم (البريد الإلكتروني):" : "Username (Email):"} <span className="font-mono">{passwordModal.user.username}</span>
              </p>
              <p className="text-slate-600">
                {language === "ar"
                  ? "يمكنك تعيين كلمة مرور ثابتة ودائمة لهذا المالك، ولن يتم توليد كلمات سر عشوائية بعد الآن. سيتم الاحتفاظ بها دائماً."
                  : "You can set a fixed and permanent password for this owner. Random passwords will no longer be generated."}
              </p>
            </div>

            {passwordModal.successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{passwordModal.successMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "كلمة المرور الثابتة / المؤقتة المعتمدة" : "Fixed / Temporary Approved Password"}
              </label>
              <input
                type="text"
                value={passwordModal.passwordInput}
                onChange={(e) => setPasswordModal(prev => ({ ...prev, passwordInput: e.target.value }))}
                placeholder="Falcon@2025"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {language === "ar"
                  ? "يستطيع المالك الدخول بهذه الكلمة فوراً، أو تغييرها بنفسه عند أول دخول للبوابة لتصبح هي كلمة المرور الدائمة الخاصة به."
                  : "The owner can login immediately with this password, or change it upon first login to be their permanent password."}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPasswordModal({ isOpen: false, owner: null, user: null, passwordInput: "Falcon@2025", successMessage: null })}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{language === "ar" ? "حفظ وتثبيت كلمة المرور" : "Save & Fix Password"}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Send Email Credentials Modal */}
      {sendEmailModal.isOpen && sendEmailModal.owner && (
        <Modal
          isOpen={sendEmailModal.isOpen}
          onClose={() => setSendEmailModal({ isOpen: false, owner: null, user: null, recipientEmail: "", emailSubject: "", emailBody: "", statusMessage: null })}
          title={language === "ar" ? `إرسال بيانات الدخول للمالك: ${language === "ar" ? sendEmailModal.owner.nameAr : sendEmailModal.owner.nameEn}` : `Send Portal Credentials to Owner`}
        >
          <form onSubmit={handleExecuteSendEmail} className="space-y-4 p-2">
            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-xs space-y-1">
              <p className="font-black text-slate-900">
                {language === "ar" ? "البريد الإلكتروني المستلم:" : "Recipient Email:"} <span className="font-mono">{sendEmailModal.recipientEmail}</span>
              </p>
              <p className="text-slate-600">
                {language === "ar"
                  ? "سيتم إرسال رسالة بريد إلكتروني تحتوي على رابط البوابة، اسم المستخدم، وكلمة المرور المعتمدة للمالك."
                  : "An email containing the portal link, username, and approved password will be sent to the owner."}
              </p>
            </div>

            {sendEmailModal.statusMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{sendEmailModal.statusMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "عنوان البريد (Subject)" : "Email Subject"}
              </label>
              <input
                type="text"
                value={sendEmailModal.emailSubject}
                onChange={(e) => setSendEmailModal(prev => ({ ...prev, emailSubject: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "محتوى الرسالة (Message Body)" : "Email Message Body"}
              </label>
              <textarea
                rows={8}
                value={sendEmailModal.emailBody}
                onChange={(e) => setSendEmailModal(prev => ({ ...prev, emailBody: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono leading-relaxed focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSendEmailModal({ isOpen: false, owner: null, user: null, recipientEmail: "", emailSubject: "", emailBody: "", statusMessage: null })}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Mail className="w-4 h-4" />
                <span>{language === "ar" ? "إرسال البريد الإلكتروني الآن" : "Send Email Now"}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
