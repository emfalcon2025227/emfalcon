import React, { useState, useMemo } from "react";
import { 
  UserPlus, 
  Search, 
  Trash2, 
  Edit, 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  Mail, 
  Phone, 
  User as UserIcon,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  MessageCircle
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { User, Tenant } from "../../types";
import { Badge } from "../common/Badge";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import {
  dispatchPortalAccessNotification,
  openWhatsAppDirect,
  formatWhatsAppPortalAccess,
} from "../../services/automatedEmailService";
import { QuickCommunicationButtons } from "../common/QuickCommunicationButtons";

export const TenantAccountsSettings: React.FC = () => {
  const { language } = useLanguage();
  const { users, createUser, updateUser, deleteUser, resetUserPassword, syncPortalAccounts } = useAuth();
  const { tenants, properties, units, owners, leases } = useData();

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "tenant@123",
    phone: "",
    tenantId: "",
    isActive: true
  });

  const selectedTenantInfo = useMemo(() => {
    if (!formData.tenantId) return null;
    const tnt = tenants.find(t => t.id === formData.tenantId);
    if (!tnt) return null;

    const activeLease = leases.find(l => l.tenantId === tnt.id && l.contractStatus === "ACTIVE");
    const unit = activeLease ? units.find(u => u.id === activeLease.unitId) : null;
    const property = activeLease ? properties.find(p => p.id === activeLease.propertyId) : null;
    const owner = property ? owners.find(o => o.id === property.ownerId) : null;

    return {
      name: language === "ar" ? tnt.nameAr : tnt.nameEn,
      unit: unit ? unit.unitNumber : (language === "ar" ? "غير محدد" : "Not set"),
      property: property ? (language === "ar" ? property.nameAr : property.nameEn) : (language === "ar" ? "غير محدد" : "Not set"),
      owner: owner ? (language === "ar" ? owner.nameAr : owner.nameEn) : (language === "ar" ? "غير محدد" : "Not set"),
    };
  }, [formData.tenantId, tenants, units, properties, owners, leases, language]);

  const tenantUsers = useMemo(() => {
    return users.filter(u => u.role === "TENANT").filter(u => {
      const search = searchTerm.toLowerCase();
      return (
        u.username.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        u.nameEn.toLowerCase().includes(search) ||
        u.nameAr.includes(searchTerm)
      );
    });
  }, [users, searchTerm]);

  const tenantOptions: SearchableOption[] = useMemo(() => {
    return tenants.map(t => ({
      id: t.id,
      label: language === "ar" ? t.nameAr : t.nameEn,
      subLabel: t.code,
      badge: t.type === "CORPORATE" ? (language === "ar" ? "شركة" : "Corporate") : (language === "ar" ? "فرد" : "Individual")
    }));
  }, [tenants, language]);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: "", // Don't show password
        phone: user.phone || "",
        tenantId: user.tenantId || "",
        isActive: user.isActive
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        email: "",
        password: "tenant@123",
        phone: "",
        tenantId: "",
        isActive: true
      });
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.tenantId) {
      setError(language === "ar" ? "يرجى اختيار المستأجر المرتبط بالحساب" : "Please select the tenant associated with this account");
      return;
    }

    const cleanEmail = formData.email.trim();
    const cleanPhone = formData.phone.trim();

    if (!cleanEmail) {
      setError(language === "ar" ? "البريد الإلكتروني مطلوب" : "Email is required");
      return;
    }

    if (editingUser) {
      const selectedTenant = tenants.find(t => t.id === formData.tenantId);
      const updateData: any = {
        username: cleanEmail, // Set username to email
        email: cleanEmail,
        nameEn: selectedTenant?.nameEn || editingUser.nameEn,
        nameAr: selectedTenant?.nameAr || editingUser.nameAr,
        phone: cleanPhone,
        tenantId: formData.tenantId,
        isActive: formData.isActive
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      updateUser(editingUser.id, updateData);
      setSuccess(language === "ar" ? "تم تحديث الحساب بنجاح" : "Account updated successfully");
    } else {
      const selectedTenant = tenants.find(t => t.id === formData.tenantId);
      const res = createUser({
        username: cleanEmail, // Set username to email
        email: cleanEmail,
        nameEn: selectedTenant?.nameEn || "",
        nameAr: selectedTenant?.nameAr || "",
        password: formData.password || "tenant@123",
        phone: cleanPhone,
        tenantId: formData.tenantId,
        role: "TENANT",
        isActive: true
      });

      if (!res.success) {
        setError(res.error || "Error");
        return;
      }

      // Automatically dispatch credentials email
      dispatchPortalAccessNotification({
        recipient: cleanEmail,
        role: "TENANT",
        name: selectedTenant?.nameAr || selectedTenant?.nameEn || cleanEmail,
        username: cleanEmail,
        password: formData.password || "tenant@123",
      }).catch(console.error);

      setSuccess(language === "ar" ? "تم إنشاء الحساب وإرسال بيانات الدخول إلى البريد الإلكتروني تلقائياً" : "Account created and credentials emailed automatically");
    }

    setIsModalOpen(false);
    setTimeout(() => setSuccess(null), 3500);
  };

  const handleDelete = (userId: string) => {
    if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذا الحساب؟" : "Are you sure you want to delete this account?")) {
      const res = deleteUser(userId);
      if (res.success) {
        setSuccess(language === "ar" ? "تم حذف الحساب بنجاح" : "Account deleted successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.error || "Error");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === "ar" ? "ابحث عن حساب مستأجر..." : "Search tenant accounts..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              const count = syncPortalAccounts(owners, tenants);
              setSuccess(
                count > 0
                  ? (language === "ar" ? `تمت المزامنة: تم إنشاء ${count} حسابات بوابة جديدة للمستأجرين` : `Sync complete: Created ${count} new tenant portal accounts`)
                  : (language === "ar" ? "جميع المستأجرين المؤهلين لديهم حسابات بوابات مسبقاً" : "All eligible tenants already have portal accounts")
              );
              setTimeout(() => setSuccess(null), 4000);
            }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>{language === "ar" ? "مزامنة حسابات المستأجرين تلقائياً" : "Auto-Sync Tenant Portals"}</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-900/10 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>{language === "ar" ? "إنشاء حساب جديد" : "Create New Account"}</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{success}</span>
        </div>
      )}

      {/* User Grid/List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenantUsers.map(user => {
          const tenant = tenants.find(t => t.id === user.tenantId);
          return (
            <div key={user.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden group hover:border-amber-300 transition-all">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${user.isActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <h4 className="text-xs font-black text-slate-900 truncate">
                      {language === "ar" ? user.nameAr : user.nameEn}
                    </h4>
                  </div>
                </div>
                <Badge variant={user.isActive ? "success" : "neutral"} size="sm">
                  {user.isActive ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "معطل" : "Inactive")}
                </Badge>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{user.phone || (language === "ar" ? "غير متوفر" : "N/A")}</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-1">
                    {language === "ar" ? "المستأجر المرتبط" : "Linked Tenant"}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-100">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span className="truncate">{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : (language === "ar" ? "غير مرتبط" : "Not Linked")}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 flex items-center justify-between gap-2 border-t border-slate-100">
                <QuickCommunicationButtons
                  emailRecipient={user.email}
                  emailLabel={language === "ar" ? "إرسال الدخول" : "Email Access"}
                  phone={user.phone}
                  whatsAppLabel={language === "ar" ? "واتساب" : "WhatsApp"}
                  whatsAppText={formatWhatsAppPortalAccess(
                    language === "ar" ? user.nameAr || user.nameEn : user.nameEn || user.nameAr,
                    "TENANT",
                    user.username
                  )}
                  onSendEmail={() =>
                    dispatchPortalAccessNotification({
                      recipient: user.email,
                      role: "TENANT",
                      name: language === "ar" ? user.nameAr || user.nameEn : user.nameEn || user.nameAr,
                      username: user.username,
                    })
                  }
                  size="sm"
                  showLabels={false}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenModal(user)}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                    title={language === "ar" ? "تعديل" : "Edit"}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title={language === "ar" ? "حذف" : "Delete"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {tenantUsers.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <UserIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400 italic">
              {language === "ar" ? "لا توجد حسابات مستأجرين متطابقة مع البحث" : "No tenant accounts found matching search"}
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                {editingUser ? <Edit className="w-4 h-4 text-amber-600" /> : <UserPlus className="w-4 h-4 text-amber-600" />}
                {editingUser 
                  ? (language === "ar" ? "تعديل حساب مستأجر" : "Edit Tenant Account")
                  : (language === "ar" ? "إنشاء حساب مستأجر جديد" : "Create New Tenant Account")}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-[11px] font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <SearchableSelect
                    label={language === "ar" ? "المستأجر المرتبط" : "Linked Tenant"}
                    options={tenantOptions}
                    value={formData.tenantId}
                    onChange={(val) => {
                      const selectedTenant = tenants.find(t => t.id === val);
                      setFormData({ 
                        ...formData, 
                        tenantId: val,
                        phone: selectedTenant?.phone || formData.phone,
                        email: selectedTenant?.email || formData.email,
                        username: selectedTenant?.email || formData.email
                      });
                    }}
                    required
                    placeholder={language === "ar" ? "اختر المستأجر..." : "Select tenant..."}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    {language === "ar" ? "رقم الهاتف" : "Phone Number"}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all"
                  />
                </div>
              </div>

              {selectedTenantInfo && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {language === "ar" ? "تفاصيل المستأجر المختارة" : "Selected Tenant Details"}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">{language === "ar" ? "الاسم" : "Name"}</p>
                      <p className="text-xs font-black text-slate-900">{selectedTenantInfo.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">{language === "ar" ? "الوحدة" : "Unit"}</p>
                      <p className="text-xs font-black text-slate-900">{selectedTenantInfo.unit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">{language === "ar" ? "العقار" : "Property"}</p>
                      <p className="text-xs font-black text-slate-900">{selectedTenantInfo.property}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">{language === "ar" ? "المالك" : "Owner"}</p>
                      <p className="text-xs font-black text-slate-900">{selectedTenantInfo.owner}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  {language === "ar" ? "البريد الإلكتروني (يستخدم لتسجيل الدخول)" : "Email (Used for Login)"} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value, username: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  {editingUser 
                    ? (language === "ar" ? "كلمة المرور (اتركه فارغاً للحفاظ على الحالية)" : "Password (Leave blank to keep current)") 
                    : (language === "ar" ? "كلمة المرور الافتراضية" : "Default Password")}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "••••••••" : "tenant@123"}
                    className={`w-full pr-10 pl-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none transition-all font-mono ${
                      editingUser ? "bg-slate-50 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600" : "bg-slate-100 text-slate-500"
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-600 bg-slate-100 border-slate-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="isActive" className="text-xs font-bold text-slate-700">
                  {language === "ar" ? "الحساب نشط (يمكنه تسجيل الدخول)" : "Account is active (can log in)"}
                </label>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-xs shadow-lg shadow-amber-900/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingUser ? (language === "ar" ? "تحديث الحساب" : "Update Account") : (language === "ar" ? "إنشاء الحساب" : "Create Account")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
