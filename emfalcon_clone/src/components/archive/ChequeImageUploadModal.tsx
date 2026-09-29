import React, { useState, useRef } from "react";
import {
  Upload,
  Image as ImageIcon,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  CreditCard,
  Building,
  User,
  DollarSign,
  Trash2,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { Cheque } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { getAccessToken } from "../../services/googleDriveService";

interface ChequeImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: Cheque | null;
}

export const ChequeImageUploadModal: React.FC<ChequeImageUploadModalProps> = ({
  isOpen,
  onClose,
  cheque,
}) => {
  const { language, t } = useLanguage();
  const { uploadChequeImage, deleteChequeImage, tenants, properties, units } = useData();
  const { hasPermission } = useAuth();
  
  const canDelete = hasPermission("DELETE_RECORDS");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [syncToDrive, setSyncToDrive] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize preview if cheque already has an image
  React.useEffect(() => {
    if (cheque) {
      setImagePreview(cheque.imageUrl || null);
      setDriveLink(cheque.driveWebViewLink || null);
      setUploadSuccess(false);
      setErrorMessage(null);
    }
  }, [cheque, isOpen]);

  if (!cheque) return null;

  const tenant = tenants.find((t) => t.id === cheque.tenantId);
  const prop = properties.find((p) => p.id === cheque.propertyId);
  const unit = units.find((u) => u.id === cheque.unitId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setErrorMessage(
        language === "ar"
          ? "يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP) أو PDF"
          : "Please select a valid image file (JPEG, PNG, WebP) or PDF"
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setErrorMessage(null);
      setUploadSuccess(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setErrorMessage(null);
      setUploadSuccess(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      setErrorMessage(
        language === "ar"
          ? "يرجى تحديد أو التقاط صورة الشيك أولاً"
          : "Please attach or select a cheque image first"
      );
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const res = await uploadChequeImage(cheque.id, imagePreview, syncToDrive);
      if (res.success) {
        setUploadSuccess(true);
        if (res.driveLink) {
          setDriveLink(res.driveLink);
        }
      } else {
        setErrorMessage(
          res.error === "NO_AUTH"
            ? language === "ar"
              ? "تم حفظ الصورة محلياً في الأرشيف. للمزامنة مع جوجل درايف يرجى تسجيل الدخول إلى Google أولاً."
              : "Image saved to local archive. Please sign in to Google to sync to Google Drive."
            : res.error || "Failed to upload image"
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        language === "ar"
          ? `تحميل وأرشفة صورة الشيك #${cheque.chequeNumber}`
          : `Upload & Archive Cheque Scan #${cheque.chequeNumber}`
      }
      subtitle={`${cheque.bankName} — AED ${cheque.amount.toLocaleString()}`}
      icon={<CreditCard className="w-5 h-5 text-amber-600" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Cheque Summary Card */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === "ar" ? "المستأجر / الساحب:" : "Tenant / Drawer:"}
            </span>
            <span className="font-bold text-slate-900 truncate block">
              {cheque.drawerName || (tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A")}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === "ar" ? "المبلغ المالي:" : "Amount:"}
            </span>
            <span className="font-mono font-bold text-amber-800 text-sm">
              AED {cheque.amount.toLocaleString()}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === "ar" ? "تاريخ الاستحقاق:" : "Due Date:"}
            </span>
            <span className="font-mono font-semibold text-slate-800">
              {cheque.dueDate}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === "ar" ? "العقار والوحدة:" : "Property / Unit:"}
            </span>
            <span className="font-semibold text-slate-800 truncate block">
              {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : ""} #{unit?.unitNumber}
            </span>
          </div>
        </div>

        {/* Existing Google Drive Link if already synced */}
        {driveLink && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">
                {language === "ar"
                  ? "هذا الشيك محفوظ ومؤرشف في Google Drive"
                  : "This cheque is synced to Google Drive"}
              </span>
            </div>
            <a
              href={driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-colors"
            >
              <span>{language === "ar" ? "فتح في Drive" : "Open in Drive"}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Upload Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/70 hover:bg-amber-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {imagePreview ? (
            <div className="space-y-2 w-full flex flex-col items-center">
              <div className="relative max-h-48 rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-white p-1">
                <img
                  src={imagePreview}
                  alt="Cheque Preview"
                  referrerPolicy="no-referrer"
                  className="max-h-44 object-contain rounded-lg"
                />
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (window.confirm(language === "ar" ? "هل أنت متأكد من حذف صورة الشيك؟" : "Are you sure you want to delete the cheque image?")) {
                        deleteChequeImage(cheque.id);
                        setImagePreview(null);
                        setDriveLink(null);
                      }
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-100/90 hover:bg-red-200 text-red-600 rounded-lg backdrop-blur-sm transition-colors shadow-sm"
                    title={language === "ar" ? "حذف المرفق" : "Delete Attachment"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-semibold">
                {language === "ar" ? "انقر لتغيير الصورة أو استبدالها" : "Click to change or replace image"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-800 text-sm">
                {language === "ar"
                  ? "اسحب وأفلت صورة الشيك هنا أو انقر للاختيار"
                  : "Drag & drop cheque scan here or click to browse"}
              </p>
              <p className="text-[11px] text-slate-400">
                {language === "ar"
                  ? "يدعم صيغ JPG, PNG, WEBP, PDF عالية الدقة"
                  : "Supports high-resolution JPG, PNG, WEBP, and PDF"}
              </p>
            </div>
          )}
        </div>

        {/* Sync to Google Drive Toggle */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 block text-xs">
                {language === "ar" ? "تخزين ومزامنة في Google Drive" : "Store & Sync to Google Drive"}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {language === "ar"
                  ? "حفظ نسخة رقمية آمنة في مجلد Emirates Falcon / Cheques"
                  : "Save a digital copy directly to Emirates Falcon / Cheques folder"}
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={syncToDrive}
            onChange={(e) => setSyncToDrive(e.target.checked)}
            className="w-4 h-4 text-amber-600 rounded-sm focus:ring-amber-500 cursor-pointer"
          />
        </div>

        {/* Status Alerts */}
        {uploadSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">
              {language === "ar"
                ? "تم حفظ وأرشفة صورة الشيك بنجاح في الأرشيف الإلكتروني"
                : "Cheque scan successfully uploaded and archived"}
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            {language === "ar" ? "إغلاق" : "Close"}
          </button>

          <button
            type="submit"
            disabled={isUploading || !imagePreview}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            {isUploading ? (
              <span>{language === "ar" ? "جاري الرفع والأرشفة..." : "Uploading & Syncing..."}</span>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>{language === "ar" ? "حفظ وأرشفة الشيك" : "Save & Archive Cheque"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
