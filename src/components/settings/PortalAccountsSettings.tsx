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
  Lock,
  User as UserIcon,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { User, Owner, Tenant, PortalAccountStatus } from "../../types";
import { Badge } from "../common/Badge";
import { Modal } from "../common/Modal";
import { QuickCommunicationButtons } from "../common/QuickCommunicationButtons";
import { getAuthToken } from "../../utils/apiClient";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";

export const PortalAccountsSettings: React.FC = () => {
  const [portalRoleFilter, setPortalRoleFilter] = useState<"ALL" | "OWNER" | "TENANT">("ALL");

  const { language } = useLanguage();
  const { users, provisionPortalAccount, getPortalAccountInfo, syncPortalAccounts, updateUserStatus, updateUser } = useAuth();
  const { owners, tenants, updateOwner, updateTenant, logAudit } = useData();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Send Activation modal state
  const [sendActivationModal, setSendActivationModal] = useState<{
    isOpen: boolean;
    name: string;
    email: string;
    targetId: string;
    sending: boolean;
    error: string | null;
    success: boolean;
    activationLink?: string | null;
  }>({
    isOpen: false,
    name: "",
    email: "",
    targetId: "",
    sending: false,
    error: null,
    success: false,
    activationLink: null
  });

  const [editingEmailTarget, setEditingEmailTarget] = useState<Owner | Tenant | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const handleSyncAll = async () => {
    setSyncFeedback(language === "ar" ? "جاري المزامنة مع النظام المركزي..." : "Syncing with central system...");
    try {
      await syncPortalAccounts(owners, tenants);
      setSyncFeedback(language === "ar" ? "تمت المزامنة بنجاح!" : "Synchronization completed successfully!");
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      setSyncFeedback(language === "ar" ? `خطأ: ${err.message}` : `Error: ${err.message}`);
    }
  };

  
  const accountRows = useMemo(() => {
    let combined = [];
    if (portalRoleFilter === "ALL" || portalRoleFilter === "OWNER") {
      owners.forEach(o => combined.push({ record: o, portalRole: "OWNER" as const, email: o.email }));
    }
    if (portalRoleFilter === "ALL" || portalRoleFilter === "TENANT") {
      tenants.forEach(t => combined.push({ record: t, portalRole: "TENANT" as const, email: t.email }));
    }
    return combined.map((item) => {
      const info = getPortalAccountInfo(item.record.id, item.portalRole, item.email);
      return { ...item, info };
    }).sort((a, b) => {
      const order: Record<string, number> = { NOT_PROVISIONED: 1, PENDING_ACTIVATION: 2, SUSPENDED: 3, ACTIVE: 4, UNKNOWN: 5 };
      return (order[a.info.status as string] ?? 99) - (order[b.info.status as string] ?? 99);
    });
  }, [owners, tenants, portalRoleFilter, users, getPortalAccountInfo]);


  const filteredRows = useMemo(() => {
    return accountRows.filter(({ record, info, email }) => {
      const isMatch = matchAnyArabicSearch(
        [
          record.nameAr,
          record.nameEn,
          email,
          record.code,
          record.phone
        ],
        searchTerm
      );

      if (!isMatch) return false;
      if (statusFilter === "ALL") return true;
      return info.status === statusFilter;
    });
  }, [accountRows, searchTerm, statusFilter]);

  const handleSendActivation = async (targetId: string, name: string, email: string, portalRole: "OWNER" | "TENANT") => {
    setSendActivationModal({ isOpen: true, name, email, targetId, sending: true, error: null, success: false, activationLink: null });

    try {
      // First ensure the account is provisioned
      const provRes = await provisionPortalAccount({
        portalRole,
        targetId,
        email,
        nameEn: name,
        nameAr: name,
        phone: ""
      });

      if (!provRes.success) {
         setSendActivationModal(prev => ({ ...prev, sending: false, error: provRes.message || provRes.error }));
         return;
      }

      // Now dispatch the secure activation link
      const token = await getAuthToken();
      const res = await fetch("/api/auth/send-portal-activation-email", { credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          email,
          name,
          role: portalRole,
          targetId
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setSendActivationModal(prev => ({ 
          ...prev, 
          sending: false, 
          success: true, 
          activationLink: data.activationLink 
        }));
        logAudit("UPDATE", portalRole, targetId, name, `Dispatched secure portal activation link to ${email}`);
        if (data.status === "DISPATCHED") {
          setTimeout(() => setSendActivationModal(prev => ({ ...prev, isOpen: false })), 2000);
        }
      } else {
        setSendActivationModal(prev => ({ ...prev, sending: false, error: data.error || "Failed to send link" }));
      }
    } catch (err: any) {
      setSendActivationModal(prev => ({ ...prev, sending: false, error: err.message }));
    }
  };

  const handleToggleStatus = (user: User) => {
    updateUserStatus(user.id, !user.isActive);
  };

  const handleSaveEditEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editingEmailTarget) return;

    if (!editEmail || !editEmail.includes("@")) {
      setEditError(language === "ar" ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email address");
      return;
    }

    const isOwner = owners.some(o => o.id === editingEmailTarget.id);
    const portalRole = isOwner ? "OWNER" : "TENANT";

    // Attempt to sync email securely
    if (editEmail !== editingEmailTarget.email) {
       try {
         const token = await getAuthToken();
         const res = await fetch("/api/auth/sync-email", { credentials: "include",
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             Authorization: `Bearer ${token || ""}`,
           },
           body: JSON.stringify({
             targetId: editingEmailTarget.id,
             role: portalRole,
             newEmail: editEmail,
           }),
         });
         const data = await res.json();
         if (!data.success) {
            setEditError(data.error || (language === "ar" ? "فشلت مزامنة البريد الإلكتروني." : "Failed to sync email."));
            return;
         }
       } catch (e: any) {
         setEditError(e.message);
         return;
       }
    }

    if (portalRole === "OWNER") {
      updateOwner(editingEmailTarget.id, { email: editEmail });
    } else {
      updateTenant(editingEmailTarget.id, { email: editEmail });
    }

    setEditingEmailTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              {portalRoleFilter === "OWNER" ? (
                <Building2 className="w-5 h-5 text-amber-700" />
              ) : portalRoleFilter === "TENANT" ? (
                <UserIcon className="w-5 h-5 text-blue-700" />
              ) : (
                <Building2 className="w-5 h-5 text-indigo-700" />
              )}
              <span>
                {language === "ar" 
                  ? (portalRoleFilter === "OWNER" 
                      ? "إدارة حسابات بوابات الملاك" 
                      : portalRoleFilter === "TENANT" 
                        ? "إدارة حسابات بوابات المستأجرين" 
                        : "إدارة حسابات بوابات الملاك والمستأجرين") 
                  : (portalRoleFilter === "OWNER" 
                      ? "Owner Portal Accounts" 
                      : portalRoleFilter === "TENANT" 
                        ? "Tenant Portal Accounts" 
                        : "Owner & Tenant Portal Accounts")}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar"
                ? "يتم إنشاء حسابات Portal تلقائياً فور توفر بريد إلكتروني صالح. اسم المستخدم هو البريد الإلكتروني نفسه."
                : "Portal accounts are auto-provisioned whenever a valid email exists. Username equals the email address."}
            </p>
          </div>

          <button
            onClick={handleSyncAll}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-4 h-4 text-slate-200" />
            <span>{language === "ar" ? "إعادة مزامنة الحسابات تلقائياً" : "Auto-Sync All Portals"}</span>
          </button>
        </div>

        {syncFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "ابحث بالاسم، الكود، أو البريد..." : "Search by name, code, or email..."}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full md:w-auto">
            {(["ALL", "NOT_PROVISIONED", "PENDING_ACTIVATION", "ACTIVE", "SUSPENDED", "INVALID_EMAIL"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                  statusFilter === status
                    ? "bg-slate-800 text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRows.map(({ record, info, email, portalRole }) => {
          const isNotProvisioned = info.status === "NOT_PROVISIONED";
          const isInvalid = !email || !email.includes("@");
          const isPending = info.status === "PENDING_ACTIVATION";
          const isSuspended = info.status === "SUSPENDED";
          const isActive = info.status === "ACTIVE";

          return (
            <div
              key={record.id}
              className={`bg-white rounded-3xl border shadow-2xs overflow-hidden transition-all flex flex-col ${
                isInvalid ? "border-red-200 bg-red-50/30" : "border-slate-200/60 hover:border-slate-300"
              }`}
            >
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{language === "ar" ? record.nameAr : record.nameEn}</h4>
                    <span className="text-xs text-slate-500 font-mono mt-0.5 block">{record.code}</span>
                  </div>
                  <Badge
                    variant={
                      isInvalid ? "danger" : isNotProvisioned ? "default" : isSuspended ? "danger" : isPending ? "warning" : "success"
                    }
                  >
                    {language === "ar" ? info.statusLabelAr : info.statusLabelEn}
                  </Badge>
                </div>

                <div className="space-y-3 mt-4">
                  {/* Email row with inline edit button */}
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 group">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className={`text-xs truncate ${email ? "text-slate-700 font-medium" : "text-slate-400 italic"}`}>
                        {email || (language === "ar" ? "لا يوجد بريد إلكتروني" : "No email")}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setEditingEmailTarget(record);
                        setEditEmail(email || "");
                        setEditError(null);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-all shrink-0 cursor-pointer"
                      title={language === "ar" ? "تعديل البريد" : "Edit Email"}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {info.user && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <UserCheck className="w-4 h-4 text-emerald-500" />
                      <span>
                        {language === "ar" ? "حساب البوابة مفعل" : "Portal account provisioned"}
                        <span className="block font-mono text-[10px] text-slate-400 mt-0.5">{info.user.id}</span>
                      </span>
                    </div>
                  )}

                  {isInvalid && (
                    <div className="flex flex-col gap-1 p-2 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {language === "ar" ? "البريد غير صالح" : "Invalid Email Address"}
                      </div>
                      <span className="opacity-90">{language === "ar" ? "البريد الإلكتروني غير صالح أو غير مكتمل" : "The email address is invalid or incomplete"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  {(!email || isInvalid) ? (
                    <button
                      onClick={() => {
                        setEditingEmailTarget(record);
                        setEditEmail(email || "");
                        setEditError(null);
                      }}
                      className="flex-1 px-3 py-2 text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {language === "ar" ? "إضافة بريد لتمكين البوابة" : "Add Email to Enable"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSendActivation(record.id, language === "ar" ? record.nameAr : record.nameEn, email, portalRole)}
                        className="flex-1 px-3 py-2 text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                        {language === "ar" 
                          ? (info.user ? "إرسال رابط استعادة الوصول" : "إرسال رابط التفعيل والإعداد")
                          : (info.user ? "Send Password Reset Link" : "Send Secure Setup Link")}
                      </button>
                    </>
                  )}
                </div>

                {info.user && (
                  <button
                    onClick={() => handleToggleStatus(info.user!)}
                    title={info.user.isActive ? (language === "ar" ? "إيقاف الحساب" : "Suspend Account") : (language === "ar" ? "تفعيل الحساب" : "Activate Account")}
                    className={`p-2 rounded-xl transition-all flex items-center justify-center border cursor-pointer ${
                      info.user.isActive
                        ? "bg-white border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {info.user.isActive ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredRows.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
            {language === "ar" ? "لم يتم العثور على حسابات مطابقة" : "No matching portal accounts found"}
          </div>
        )}
      </div>

      {/* Edit Email Modal */}
      <Modal
        isOpen={!!editingEmailTarget}
        onClose={() => setEditingEmailTarget(null)}
        title={language === "ar" ? "تحديث البريد الإلكتروني" : "Update Email Address"}
        size="md"
      >
        {editingEmailTarget && (
          <form onSubmit={handleSaveEditEmail} className="p-6 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-4">
              <h4 className="text-amber-900 font-bold text-sm mb-1">
                {language === "ar" ? "تنبيه تغيير البريد الإلكتروني" : "Email Change Notice"}
              </h4>
              <p className="text-amber-800 text-xs">
                {language === "ar"
                  ? "تغيير البريد الإلكتروني هنا سيقوم بتغيير اسم المستخدم لحساب البوابة تلقائياً وسيحتاج إلى تسجيل الدخول بالبريد الجديد."
                  : "Changing the email here will instantly update the portal account username and Firebase authentication identity."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {language === "ar" ? "البريد الإلكتروني الجديد" : "New Email Address"}
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-left"
                dir="ltr"
                placeholder="name@example.com"
                autoFocus
              />
            </div>
            {editError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingEmailTarget(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-amber-700 text-white hover:bg-amber-800 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Save className="w-4 h-4" />
                <span>{language === "ar" ? "حفظ التغييرات" : "Save Changes"}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Send Activation Modal */}
      <Modal
        isOpen={sendActivationModal.isOpen}
        onClose={() => !sendActivationModal.sending && setSendActivationModal(prev => ({ ...prev, isOpen: false }))}
        title={language === "ar" ? "إرسال رابط التفعيل" : "Send Activation Link"}
        size="md"
      >
        <div className="p-6 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <Mail className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-lg">
              {language === "ar" ? "سيتم إرسال رابط تفعيل آمن" : "Secure Activation Link"}
            </h4>
            <p className="text-sm text-slate-500">
              {language === "ar" 
                ? `سيتم إرسال رابط آمن إلى البريد الإلكتروني (${sendActivationModal.email}) ليتمكن من إعداد كلمة المرور الخاصة به وتفعيل الحساب.`
                : `A secure link will be sent to (${sendActivationModal.email}) allowing them to securely set their password and activate.`}
            </p>
          </div>

          {sendActivationModal.error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{sendActivationModal.error}</span>
            </div>
          )}

          {sendActivationModal.success && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>{language === "ar" ? "تم توليد وتجهيز حساب البوابة بنجاح!" : "Portal account ready successfully!"}</span>
              </div>
              
              {sendActivationModal.activationLink && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-start">
                  <span className="text-xs font-bold text-slate-500 block">
                    {language === "ar" ? "رابط التفعيل وتعيين كلمة المرور السري:" : "Secure Password Setup & Activation Link:"}
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={sendActivationModal.activationLink}
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(sendActivationModal.activationLink || "");
                        alert(language === "ar" ? "تم نسخ الرابط السري بنجاح!" : "Secure link copied successfully!");
                      }}
                      className="px-3 py-1.5 bg-amber-500 text-white font-bold text-xs rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      {language === "ar" ? "نسخ" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-center gap-2 mt-4">
             {sendActivationModal.sending && (
                <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                   <RefreshCw className="w-4 h-4 animate-spin" />
                   {language === "ar" ? "جاري الإرسال..." : "Dispatching..."}
                </div>
             )}
             {!sendActivationModal.sending && !sendActivationModal.success && (
               <button
                 type="button"
                 onClick={() => setSendActivationModal(prev => ({ ...prev, isOpen: false }))}
                 className="px-6 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl transition-all cursor-pointer"
               >
                 {language === "ar" ? "إغلاق" : "Close"}
               </button>
             )}
             {!sendActivationModal.sending && sendActivationModal.success && (
               <button
                 type="button"
                 onClick={() => setSendActivationModal(prev => ({ ...prev, isOpen: false }))}
                 className="px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-xl transition-all cursor-pointer"
               >
                 {language === "ar" ? "تم" : "Done"}
               </button>
             )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
