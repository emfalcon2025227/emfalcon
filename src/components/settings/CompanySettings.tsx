import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import {
  Save,
  Upload,
  Building2,
  Receipt,
  MapPin,
  Globe,
  Phone,
  Mail,
  CheckCircle2,
  Lock,
  FileText,
  Trash2,
  Eye,
  Star,
  Plus,
  AlertCircle,
  Clock,
  User,
  FileType,
  Sparkles,
  Database,
} from 'lucide-react';
import { CompanyLetterheadTemplate } from '../../types';
import { LetterheadPreviewModal } from './LetterheadPreviewModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { Badge } from '../common/Badge';

export function CompanySettings({ language }: { language: "ar" | "en" }) {
  const {
    companyProfile,
    updateCompanyProfile,
    addCompanyLetterheadTemplate,
    setActiveCompanyLetterhead,
    deleteCompanyLetterheadTemplate,
  } = useData();
  const { currentUser } = useAuth();

  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.role === 'SYSTEM_OWNER';

  const [formData, setFormData] = useState({
    nameAr: companyProfile?.nameAr || '',
    nameEn: companyProfile?.nameEn || '',
    vatTrn: companyProfile?.vatTrn || '',
    tradeLicenseNumber: companyProfile?.tradeLicenseNumber || companyProfile?.tradeLicenseNo || '',
    commercialRegisterNumber: companyProfile?.commercialRegisterNumber || companyProfile?.commercialRegisterNo || '',
    licenseExpiryDate: companyProfile?.licenseExpiryDate || '',
    address: companyProfile?.address || '',
    addressAr: companyProfile?.addressAr || companyProfile?.address || '',
    addressEn: companyProfile?.addressEn || companyProfile?.address || '',
    email: companyProfile?.email || '',
    phone: companyProfile?.phone || '',
    website: companyProfile?.website || '',
    logoUrl: companyProfile?.logoUrl || companyProfile?.logoBase64 || '',
    reportBackgroundUrl: companyProfile?.reportBackgroundUrl || '',
    reportBackgroundOpacity: companyProfile?.reportBackgroundOpacity ?? 0.15,
    customReportCss: companyProfile?.customReportCss || '',
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Letterhead Management States
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState<CompanyLetterheadTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<CompanyLetterheadTemplate | null>(null);
  const [letterheadError, setLetterheadError] = useState<string | null>(null);
  const [letterheadSuccess, setLetterheadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Gemini API Key Management States
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<{ configured: boolean; maskedKey: string | null } | null>(null);
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config/gemini-key')
      .then(res => res.json())
      .then(data => {
        if (data) setApiKeyStatus(data);
      })
      .catch(err => console.warn("Failed to fetch Gemini key status", err));
  }, []);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    try {
      const res = await fetch('/api/config/gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setApiKeyMessage(language === 'ar' ? "✅ تم تحديث وحفظ مفتاح Gemini API بنجاح ومزامنته تلقائياً مع النظام!" : "✅ Gemini API key updated and saved successfully!");
        setApiKeyInput('');
        const statusRes = await fetch('/api/config/gemini-key');
        const statusData = await statusRes.json();
        if (statusData) setApiKeyStatus(statusData);
      } else {
        setApiKeyMessage(data.error || "Failed to save API key");
      }
    } catch (err: any) {
      setApiKeyMessage(err.message || "Failed to save API key");
    }
  };

  // Sync state if companyProfile updates asynchronously from Firestore or LocalStorage
  useEffect(() => {
    if (companyProfile) {
      setFormData(prev => ({
        ...prev,
        nameAr: companyProfile.nameAr || prev.nameAr,
        nameEn: companyProfile.nameEn || prev.nameEn,
        vatTrn: companyProfile.vatTrn || prev.vatTrn,
        tradeLicenseNumber: companyProfile.tradeLicenseNumber || companyProfile.tradeLicenseNo || prev.tradeLicenseNumber,
        commercialRegisterNumber: companyProfile.commercialRegisterNumber || companyProfile.commercialRegisterNo || prev.commercialRegisterNumber,
        licenseExpiryDate: companyProfile.licenseExpiryDate || prev.licenseExpiryDate,
        address: companyProfile.address || prev.address,
        addressAr: companyProfile.addressAr || companyProfile.address || prev.addressAr,
        addressEn: companyProfile.addressEn || companyProfile.address || prev.addressEn,
        email: companyProfile.email || prev.email,
        phone: companyProfile.phone || prev.phone,
        website: companyProfile.website || prev.website,
        logoUrl: companyProfile.logoUrl || companyProfile.logoBase64 || prev.logoUrl,
      }));
    }
  }, [companyProfile]);

  const t = (ar: string, en: string) => language === 'ar' ? ar : en;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!isAdmin) return;
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (savedSuccess) setSavedSuccess(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawResult = event.target?.result as string;
        if (!rawResult) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 400; // max 400px logo dimension
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL("image/png");
            setFormData(prev => ({ ...prev, logoUrl: compressedDataUrl }));
          } else {
            setFormData(prev => ({ ...prev, logoUrl: rawResult }));
          }
          if (savedSuccess) setSavedSuccess(false);
        };
        img.onerror = () => {
          setFormData(prev => ({ ...prev, logoUrl: rawResult }));
          if (savedSuccess) setSavedSuccess(false);
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLetterheadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    setLetterheadError(null);
    setLetterheadSuccess(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedTypes.includes(file.type) && !['pdf', 'png', 'jpg', 'jpeg'].includes(extension)) {
      setLetterheadError(t('يرجى اختيار ملف بصيغة مدعومة (PDF, PNG, JPG)', 'Please select a supported file format (PDF, PNG, JPG)'));
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setLetterheadError(t('حجم الملف كبير جداً. الحد الأقصى المسموح به هو 15 ميجابايت.', 'File size too large. Maximum allowed size is 15MB.'));
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setLetterheadError(t('فشل قراءة الملف', 'Failed to read file'));
        setIsUploading(false);
        return;
      }

      const fileType = file.type.includes('pdf') || extension === 'pdf' ? 'pdf' : extension || 'png';

      const res = addCompanyLetterheadTemplate({
        fileName: file.name,
        fileType: fileType.toUpperCase(),
        fileSize: file.size,
        fileUrl: dataUrl,
        templateType: 'OFFICIAL_LETTERHEAD',
        isActive: false,
      });

      setIsUploading(false);

      if (res.success) {
        setLetterheadSuccess(t('تم رفع قالب الورقة الرسمية بنجاح!', 'Letterhead template uploaded successfully!'));
        setTimeout(() => setLetterheadSuccess(null), 4000);
        // Reset file input value
        e.target.value = '';
      } else {
        setLetterheadError(res.error || t('حدث خطأ أثناء حفظ القالب', 'Error saving letterhead template'));
      }
    };

    reader.onerror = () => {
      setIsUploading(false);
      setLetterheadError(t('فشل رفع الملف', 'Failed to upload file'));
    };

    reader.readAsDataURL(file);
  };

  const handleSetActiveLetterhead = (templateId: string) => {
    if (!isAdmin) return;
    setLetterheadError(null);
    setLetterheadSuccess(null);

    const res = setActiveCompanyLetterhead(templateId);
    if (res.success) {
      setLetterheadSuccess(t('تم اعتماد القالب المختار كقالب رسمي نشط!', 'Selected template set as active letterhead!'));
      setTimeout(() => setLetterheadSuccess(null), 4000);
    } else {
      setLetterheadError(res.error || t('فشل تغيير القالب النشط', 'Failed to set active letterhead'));
    }
  };

  const handleDeleteLetterheadConfirm = () => {
    if (!templateToDelete || !isAdmin) return;
    setLetterheadError(null);
    setLetterheadSuccess(null);

    const res = deleteCompanyLetterheadTemplate(templateToDelete.id);
    if (res.success) {
      setLetterheadSuccess(t('تم حذف قالب الورقة الرسمية بنجاح', 'Letterhead template deleted successfully'));
      setTimeout(() => setLetterheadSuccess(null), 4000);
    } else {
      setLetterheadError(res.error || t('فشل حذف القالب', 'Failed to delete template'));
    }
    setTemplateToDelete(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const normalizedData = {
      ...formData,
      address: formData.addressAr || formData.address,
      tradeLicenseNo: formData.tradeLicenseNumber,
      commercialRegisterNo: formData.commercialRegisterNumber,
      logoBase64: formData.logoUrl,
      logo: formData.logoUrl,
      reportBackgroundOpacity: Number(formData.reportBackgroundOpacity),
    };
    updateCompanyProfile(normalizedData as any);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const letterheadTemplates = companyProfile?.letterheadTemplates || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("ملف الشركة المركزي (Single Source of Truth)", "Central Company Profile")}</h2>
              <p className="text-sm text-slate-500">{t("إعدادات ومعلومات الشركة الموحدة لكافة أجزاء النظام والتقارير", "Central company settings used across system reports and documents")}</p>
            </div>
          </div>

          {!isAdmin && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-bold text-xs">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>{t("عرض فقط — يتطلب صلاحية مدير النظام للتعديل", "Read Only — Requires Administrator privileges")}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold text-xs animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t("تم حفظ إعدادات الشركة بنجاح وتحديث كافة التقارير!", "Company settings saved successfully!")}</span>
            </div>
          )}
        </div>

        {/* Firebase Persistence Guarantee Banner */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex items-start gap-3">
          <Database className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <span className="font-bold block mb-0.5">
              {t("حفظ سحابي دائم عبر قاعدة بيانات Firebase Firestore", "Permanent Cloud Storage via Firebase Firestore")}
            </span>
            {t(
              "جميع الملفات المرفوعة هنا (شعار الشركة وقوالب الأوراق الرسمية) تُحفظ بشكل دائم ومباشر في قاعدة بيانات Firebase السحابية (مجموعة settings، مستند companyProfile)، بحيث تظل محفوظة ومتاحة في كل الأوقات وعلى كافة الأجهزة والجلسات.",
              "All files uploaded here (company logo and official letterhead templates) are permanently and directly saved in the Firebase cloud database (settings/companyProfile), ensuring they remain available at all times across all devices and sessions."
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Logo Section */}
          <div className="flex items-start gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden relative group shrink-0">
              {formData.logoUrl ? (
                <img src={formData.logoUrl} alt="Company Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <Building2 className="w-8 h-8 text-slate-300" />
              )}
              {isAdmin && (
                <>
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <input 
                    id="company-logo-file-input"
                    type="file" 
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">{t("شعار الشركة", "Company Logo")}</h4>
              <p className="text-xs text-slate-500 mb-3">{t("يظهر الشعار في الهيدر والتقارير والسندات (PNG/JPEG)", "Logo displayed on header, reports and receipts")}</p>
              {isAdmin && (
                <button 
                  type="button" 
                  onClick={() => document.getElementById('company-logo-file-input')?.click()}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  {t("تغيير الشعار", "Change Logo")}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">{t("اسم الشركة (عربي)", "Company Name (Arabic)")}</label>
              <input
                type="text"
                name="nameAr"
                disabled={!isAdmin}
                value={formData.nameAr}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">{t("اسم الشركة (إنجليزي)", "Company Name (English)")}</label>
              <input
                type="text"
                name="nameEn"
                disabled={!isAdmin}
                value={formData.nameEn}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-left focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                {t("الرقم الضريبي (VAT TRN)", "VAT TRN")}
              </label>
              <input
                type="text"
                name="vatTrn"
                disabled={!isAdmin}
                value={formData.vatTrn}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>{t("رقم الرخصة التجارية (داخلي فقط)", "Trade License Number (Internal Only)")}</span>
                <span className="text-[10px] text-amber-700 font-normal">🔒 {t("محمي من الظهور", "Protected from export")}</span>
              </label>
              <input
                type="text"
                name="tradeLicenseNumber"
                disabled={!isAdmin}
                value={formData.tradeLicenseNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {t("محفوظ للاستخدام الداخلي فقط — لن يتم إظهاره في أي تقرير أو مستند أو مطبوعات للمستخدم.", "Saved for internal reference only — Never rendered on user-facing outputs or reports.")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">{t("رقم السجل التجاري", "Commercial Register")}</label>
              <input
                type="text"
                name="commercialRegisterNumber"
                disabled={!isAdmin}
                value={formData.commercialRegisterNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">{t("تاريخ انتهاء الرخصة", "License Expiry Date")}</label>
              <input
                type="date"
                name="licenseExpiryDate"
                disabled={!isAdmin}
                value={formData.licenseExpiryDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 mb-4">{t("بيانات التواصل والعناوين", "Contact & Addresses")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {t("رقم الهاتف", "Phone Number")}
                </label>
                <input
                  type="text"
                  name="phone"
                  disabled={!isAdmin}
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-left focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {t("البريد الإلكتروني", "Email Address")}
                </label>
                <input
                  type="email"
                  name="email"
                  disabled={!isAdmin}
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-left focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  {t("الموقع الإلكتروني", "Website")}
                </label>
                <input
                  type="text"
                  name="website"
                  disabled={!isAdmin}
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-left focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  dir="ltr"
                />
              </div>
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {t("العنوان (بالعربية)", "Company Address (Arabic)")}
                  </label>
                  <textarea
                    name="addressAr"
                    disabled={!isAdmin}
                    value={formData.addressAr}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {t("العنوان (بالإنجليزية)", "Company Address (English)")}
                  </label>
                  <textarea
                    name="addressEn"
                    disabled={!isAdmin}
                    value={formData.addressEn}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 text-xs text-left"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Global Report Customization */}
            <div className="pt-6 border-t border-slate-100 mt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                {t("تنسيق وتقارير النظام الشاملة (Global Report Styling)", "Global Report Styling & Layout")}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t("رابط خلفية التقارير (Report Background Image URL)", "Report Background Image URL")}
                  </label>
                  <p className="text-[10px] text-slate-500 mb-2">
                    {t("أدخل رابط صورة كخلفية موحدة للتقارير (Watermark/Background)", "Enter an image URL to be used as a uniform report background / watermark")}
                  </p>
                  <input
                    type="text"
                    name="reportBackgroundUrl"
                    disabled={!isAdmin}
                    value={formData.reportBackgroundUrl}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 text-sm text-left"
                    dir="ltr"
                    placeholder="https://example.com/watermark.png"
                  />
                </div>

                <div className="md:w-1/2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t("شفافية الخلفية (Background Opacity)", "Background Opacity")}
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      name="reportBackgroundOpacity"
                      min="0"
                      max="1"
                      step="0.05"
                      disabled={!isAdmin}
                      value={formData.reportBackgroundOpacity}
                      onChange={handleChange}
                      className="flex-1 cursor-pointer accent-blue-600 disabled:opacity-50"
                    />
                    <span className="text-xs font-bold text-slate-600 font-mono w-12 text-center bg-slate-100 py-1 rounded-md">
                      {Math.round(Number(formData.reportBackgroundOpacity) * 100)}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t("تنسيقات CSS مخصصة للتقارير (Custom CSS for Reports)", "Custom CSS for Reports")}
                  </label>
                  <p className="text-[10px] text-slate-500 mb-2">
                    {t("أضف أكواد CSS مخصصة لتعديل ألوان، مسافات، وهيكلية التقارير كما تريد", "Inject custom CSS to override colors, spacing, and structures across all printable reports")}
                  </p>
                  <textarea
                    name="customReportCss"
                    disabled={!isAdmin}
                    value={formData.customReportCss}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-xl resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 text-xs text-left"
                    dir="ltr"
                    placeholder="/* Example: Change header color */&#10;#report-print-area h1 { color: #1e3a8a !important; }"
                  />
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Save className="w-5 h-5" />
                <span>{t("حفظ إعدادات الشركة المركزية", "Save Central Company Profile")}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ========================================================================= */}
      {/* COMPANY LETTERHEAD MANAGEMENT SECTION (إدارة الورقة الرسمية للشركة) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {t("الورقة الرسمية للشركة (Company Letterhead)", "Company Letterhead Templates")}
                {companyProfile?.activeLetterheadId && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t("يوجد قالب نشط معتمد", "Active Template Configured")}
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-500">
                {t(
                  "إدارة وتفعيل قوالب الورقة الرسمية المعتمدة لاستخدامها كخلفية موحدة للتقارير والمراسلات الرسمية",
                  "Manage and set official active letterhead template for system reports and formal correspondence"
                )}
              </p>
            </div>
          </div>

          {/* Upload Button Header Action */}
          {isAdmin && (
            <div>
              <input
                id="company-letterhead-file-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={handleLetterheadUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploading}
                onClick={() => document.getElementById('company-letterhead-file-input')?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isUploading ? t("جاري الرفع...", "Uploading...") : t("رفع ورقة رسمية جديدة", "Upload New Letterhead")}</span>
              </button>
            </div>
          )}
        </div>

        {/* Feedback Alert Banners */}
        {letterheadSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{letterheadSuccess}</span>
          </div>
        )}

        {letterheadError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-medium text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{letterheadError}</span>
          </div>
        )}

        {/* Upload Dropzone / Quick Actions */}
        {isAdmin && (
          <div
            onClick={() => document.getElementById('company-letterhead-file-input')?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all group"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all mb-3 border border-slate-100">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">
              {t("اضغط هنا لرفع قالب ورقة رسمية للشركة", "Click here to upload a company letterhead template")}
            </h4>
            <p className="text-xs text-slate-500 mb-2">
              {t("يدعم ملفات PDF و صور PNG / JPG بدقة عالية (الحد الأقصى 15 ميجابايت)", "Supports PDF documents and high-res PNG / JPG images (Max 15MB)")}
            </p>
            <span className="inline-block text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg font-semibold">
              {t("سيتم الاحتفاظ بالأرشيف التاريخي لجميع القوالب المرفوعة دون حذف تلقائي", "All historical uploads are safely archived")}
            </span>
          </div>
        )}

        {/* Template List Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileType className="w-4 h-4 text-slate-500" />
              <span>{t("سجل قوالب الورقة الرسمية المرفوعة", "Uploaded Letterhead Templates Register")}</span>
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-mono">
                {letterheadTemplates.length}
              </span>
            </h3>
          </div>

          {letterheadTemplates.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">
                {t("لا توجد قوالب ورقة رسمية مرفوعة حالياً", "No letterhead templates uploaded yet")}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {t(
                  "قم برفع القالب الرسمي للشركة لاستخدامه في إنشاء وترويس خطابات الإخلاء والتقارير المالية والوثائق المعتمدة.",
                  "Upload the official company letterhead to brand eviction notices, financial reports, and official documents."
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {letterheadTemplates.map((template) => {
                const isActive = template.isActive || template.id === companyProfile?.activeLetterheadId;
                const isPdf = template.fileType.toLowerCase().includes('pdf') || template.fileUrl.startsWith('data:application/pdf');

                return (
                  <div
                    key={template.id}
                    className={`relative rounded-2xl border p-4 transition-all bg-white flex flex-col justify-between ${
                      isActive
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/10'
                        : 'border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    {/* Status Badge & Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isPdf ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-slate-900 truncate" title={template.fileName}>
                              {template.fileName}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="font-mono uppercase px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                                {template.fileType}
                              </span>
                              <span>•</span>
                              <span>{formatFileSize(template.fileSize)}</span>
                            </div>
                          </div>
                        </div>

                        {isActive ? (
                          <Badge variant="success" className="gap-1 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t("قالب نشط", "Active")}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="shrink-0 text-slate-500 bg-slate-100">
                            {t("غير نشط", "Inactive")}
                          </Badge>
                        )}
                      </div>

                      {/* Thumbnail / Document Preview Card */}
                      <div
                        onClick={() => setSelectedPreviewTemplate(template)}
                        className="w-full h-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative group cursor-pointer mb-3"
                      >
                        {isPdf ? (
                          <div className="text-center p-3">
                            <FileText className="w-10 h-10 text-rose-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-semibold text-slate-600 block">
                              {t("استعراض مستند PDF", "View PDF Document")}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={template.fileUrl}
                            alt={template.fileName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        )}

                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2">
                          <Eye className="w-4 h-4" />
                          <span>{t("معاينة القالب", "Preview")}</span>
                        </div>
                      </div>

                      {/* Upload Metadata Info */}
                      <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50/80 p-2.5 rounded-xl mb-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{t("تاريخ الرفع:", "Uploaded:")} {new Date(template.uploadedAt).toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-US')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{t("بواسطة:", "By:")} {template.uploadedByUserName || "مسؤول النظام"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewTemplate(template)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title={t("معاينة كاملة", "Full Preview")}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">{t("معاينة", "View")}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {!isActive && isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleSetActiveLetterhead(template.id)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>{t("اعتماد كقالب نشط", "Set Active")}</span>
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setTemplateToDelete(template)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={t("حذف القالب", "Delete Template")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* GEMINI AI API KEY CONFIGURATION CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-2xs mt-8">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {t("إعدادات مفتاح ذكاء Gemini الاصطناعي (Gemini API Key)", "Gemini AI API Key Configuration")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("تحديث وحفظ مفتاح Gemini API بشكل دائم وفوري في ملفات النظام وتخزين البيئة", "Update and permanently save your Gemini API key instantly in system storage")}
              </p>
            </div>
          </div>
          <Badge variant={apiKeyStatus?.configured ? "success" : "warning"} size="sm">
            {apiKeyStatus?.configured ? (t("المفتاح مفعل ونشط", "Active & Configured")) : (t("المفتاح غير مسجل", "Not Configured"))}
          </Badge>
        </div>

        {apiKeyMessage && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 flex items-center justify-between">
            <span>{apiKeyMessage}</span>
            <button onClick={() => setApiKeyMessage(null)} className="text-slate-500">✕</button>
          </div>
        )}

        <form onSubmit={handleSaveApiKey} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">
              {t("مفتاح Gemini API الحالي أو الجديد:", "Current or New Gemini API Key:")}
            </label>
            <div className="flex gap-3">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={apiKeyStatus?.maskedKey ? `مفتاح مسجل حالياً (${apiKeyStatus.maskedKey}) — أدخل مفتاح جديد للتحديث` : "أدخل مفتاح AQ.Ab8RN6..."}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{t("حفظ وتحديث فوري", "Save & Update Instantly")}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {t("سيتم تطبيق المفتاح وتحديثه تلقائياً في الخادم وتخزين البيئة دون الحاجة لإعادة تشغيل أو تدخل يدوي.", "The key will be applied and updated automatically in the server and environment without manual restart.")}
            </p>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Full Preview Modal */}
      <LetterheadPreviewModal
        isOpen={!!selectedPreviewTemplate}
        onClose={() => setSelectedPreviewTemplate(null)}
        template={selectedPreviewTemplate}
        onSetActive={handleSetActiveLetterhead}
        isAdmin={isAdmin}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        onConfirm={handleDeleteLetterheadConfirm}
        title={t("تأكيد حذف قالب الورقة الرسمية", "Confirm Letterhead Deletion")}
        warningMessage={
          templateToDelete?.isActive
            ? t(
                `تنبيه: القالب "${templateToDelete?.fileName}" هو القالب الرسمي النشط حالياً! هل أنت متاكد من رغبتك في حذفه؟ لن تتأثر المستندات والتقارير التاريخية المحفوظة مسبقاً.`,
                `Warning: "${templateToDelete?.fileName}" is currently the active letterhead template! Are you sure you want to delete it? Historical reports will remain intact.`
              )
            : t(
                `هل أنت متاكد من حذف قالب الورقة الرسمية "${templateToDelete?.fileName}"؟ سيتم تسجيل عملية الحذف في سجل التدقيق.`,
                `Are you sure you want to delete letterhead template "${templateToDelete?.fileName}"? This action will be recorded in audit logs.`
              )
        }
        itemName={templateToDelete?.fileName || ""}
      />
    </div>
  );
}



