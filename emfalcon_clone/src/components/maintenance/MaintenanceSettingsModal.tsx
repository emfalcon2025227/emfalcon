import React, { useState } from "react";
import {
  X,
  Settings,
  Clock,
  DollarSign,
  Layers,
  Plus,
  Trash2,
  Bell,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { CostBearer, MaintenanceSettings } from "../../types";
import { SearchableSelect } from "../common/SearchableSelect";

interface MaintenanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MaintenanceSettingsModal: React.FC<MaintenanceSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { maintenanceSettings, updateMaintenanceSettings } = useData();
  const { t, language } = useLanguage();

  const [delayedDays, setDelayedDays] = useState<number>(
    maintenanceSettings?.delayedDaysThreshold || 5
  );
  const [defaultBearer, setDefaultBearer] = useState<CostBearer>(
    maintenanceSettings?.defaultCostBearer || "OWNER"
  );
  const [slaHours, setSlaHours] = useState({
    LOW: maintenanceSettings?.slaHoursByPriority?.LOW || 72,
    NORMAL: maintenanceSettings?.slaHoursByPriority?.NORMAL || 48,
    HIGH: maintenanceSettings?.slaHoursByPriority?.HIGH || 24,
    URGENT: maintenanceSettings?.slaHoursByPriority?.URGENT || 6,
  });
  const [autoNotify, setAutoNotify] = useState<boolean>(
    maintenanceSettings?.autoNotifyTenantOnStatusChange ?? true
  );

  // New Category State
  const [categories, setCategories] = useState(
    maintenanceSettings?.categories || []
  );
  const [newCatAr, setNewCatAr] = useState("");
  const [newCatEn, setNewCatEn] = useState("");

  if (!isOpen) return null;

  const handleAddCategory = () => {
    if (!newCatAr.trim() && !newCatEn.trim()) return;
    const newCat = {
      id: `CAT_${Date.now()}`,
      nameAr: newCatAr.trim() || newCatEn.trim(),
      nameEn: newCatEn.trim() || newCatAr.trim(),
    };
    setCategories([...categories, newCat]);
    setNewCatAr("");
    setNewCatEn("");
  };

  const handleRemoveCategory = (catId: string) => {
    setCategories(categories.filter((c) => c.id !== catId));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMaintenanceSettings({
      delayedDaysThreshold: delayedDays,
      defaultCostBearer: defaultBearer,
      slaHoursByPriority: slaHours,
      autoNotifyTenantOnStatusChange: autoNotify,
      categories,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div
        id="maintenance-settings-modal"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {t("maintSettings")}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === "ar"
                  ? "تهيئة مدد الاستجابة ومتحمل التكلفة والتصنيفات"
                  : "Configure SLAs, cost bearers & categories"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Section 1: SLA & Delay Threshold */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>
                {language === "ar"
                  ? "اتفاقيات مستوى الخدمة ومؤشرات التأخير (SLA)"
                  : "SLA & Delay Thresholds"}
              </span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t("maintDelayedThresholdDays")}
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={delayedDays}
                onChange={(e) => setDelayedDays(parseInt(e.target.value) || 5)}
                className="w-full sm:w-48 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {language === "ar"
                  ? "سيتم تصنيف أي طلب صيانة غير منجز تجاوز هذه المدة كطلب متأخر في اللوحة."
                  : "Requests exceeding this duration without completion are flagged as delayed."}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-rose-700 mb-1">
                  {t("maintPriority_URGENT")} (ساعات)
                </label>
                <input
                  type="number"
                  min="1"
                  value={slaHours.URGENT}
                  onChange={(e) =>
                    setSlaHours({ ...slaHours, URGENT: parseInt(e.target.value) || 6 })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-rose-200 text-xs font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-700 mb-1">
                  {t("maintPriority_HIGH")} (ساعات)
                </label>
                <input
                  type="number"
                  min="1"
                  value={slaHours.HIGH}
                  onChange={(e) =>
                    setSlaHours({ ...slaHours, HIGH: parseInt(e.target.value) || 24 })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-sky-700 mb-1">
                  {t("maintPriority_NORMAL")} (ساعات)
                </label>
                <input
                  type="number"
                  min="1"
                  value={slaHours.NORMAL}
                  onChange={(e) =>
                    setSlaHours({ ...slaHours, NORMAL: parseInt(e.target.value) || 48 })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-sky-200 text-xs font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t("maintPriority_LOW")} (ساعات)
                </label>
                <input
                  type="number"
                  min="1"
                  value={slaHours.LOW}
                  onChange={(e) =>
                    setSlaHours({ ...slaHours, LOW: parseInt(e.target.value) || 72 })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Default Cost Bearer */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>
                {language === "ar"
                  ? "الطرف الافتراضي المتحمل للتكلفة"
                  : "Default Cost Bearer"}
              </span>
            </h3>

            <SearchableSelect
              label={language === "ar" ? "الطرف الافتراضي المتحمل للتكلفة" : "Default Cost Bearer"}
              options={[
                { id: "OWNER", label: t("maintBearerOwner"), subLabel: "Owner" },
                { id: "TENANT", label: t("maintBearerTenant"), subLabel: "Tenant" },
                { id: "MANAGEMENT", label: t("maintBearerManagement"), subLabel: "Management Co." },
                { id: "PER_CONTRACT", label: t("maintBearerPerContract"), subLabel: "Per Lease Rules" },
              ]}
              value={defaultBearer}
              onChange={(val) => setDefaultBearer(val as CostBearer)}
              placeholder={language === "ar" ? "-- اختر المتحمل الافتراضي --" : "-- Select Bearer --"}
              searchPlaceholder={language === "ar" ? "ابحث بنوع الطرف..." : "Search bearer..."}
            />
          </div>

          {/* Section 3: Categories Management */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <span>{t("maintManageCategories")}</span>
            </h3>

            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span
                  key={cat.id}
                  className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-2 shadow-2xs"
                >
                  <span>{cat.nameAr}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat.id)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newCatAr}
                onChange={(e) => setNewCatAr(e.target.value)}
                placeholder="اسم التصنيف بالعربية (مثل: عوازل أسطح)"
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === "ar" ? "إضافة" : "Add"}</span>
              </button>
            </div>
          </div>

          {/* Section 4: Notifications Toggle */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {language === "ar"
                    ? "إشعار المستأجر تلقائياً عند تحديث حالة الطلب"
                    : "Auto-notify tenant on status changes"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === "ar"
                    ? "إرسال إشعار WhatsApp وتحديثات تلقائية"
                    : "Send automatic WhatsApp notifications"}
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={autoNotify}
              onChange={(e) => setAutoNotify(e.target.checked)}
              className="w-5 h-5 rounded text-amber-500 cursor-pointer"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs cursor-pointer"
            >
              {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
