import React, { useState, useEffect } from "react";
import {
  X,
  Wrench,
  AlertTriangle,
  Send,
  Paperclip,
  CheckCircle2,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { MaintenanceRequest } from "../../types";
import { DocumentUpload } from "../common/DocumentUpload";
import { DocumentOptimizationResult } from "../../types";

interface TenantUpdateMaintenanceModalProps {
  request: MaintenanceRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TenantUpdateMaintenanceModal: React.FC<TenantUpdateMaintenanceModalProps> = ({
  request,
  isOpen,
  onClose,
}) => {
  const { updateMaintenanceRequest } = useData();
  const { language } = useLanguage();
  const { currentUser } = useAuth();

  const [issueDescription, setIssueDescription] = useState("");
  const [newAttachments, setNewAttachments] = useState<DocumentOptimizationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setIssueDescription(request.issueDescription || "");
      setNewAttachments([]);
      setError(null);
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!issueDescription.trim()) {
      setError(
        language === "ar"
          ? "يرجى إدخال وصف المشكلة أو التحديث المطلوب"
          : "Please enter issue description or required update"
      );
      return;
    }

    const timestamp = new Date().toISOString();
    const existingAttachments = request.attachments || [];
    const addedAttachments = newAttachments.map((att, idx) => ({
      id: "att-" + Date.now() + "-" + idx,
      maintenanceRequestId: request.id,
      fileName: att.optimizedFileName || att.originalFileName,
      fileType: att.originalMimeType,
      fileSize: att.optimizedSizeBytes,
      fileUrl: att.dataUrl,
      uploadedAt: timestamp,
      uploadedBy: currentUser?.nameAr || currentUser?.nameEn || "المستأجر",
      category: "ISSUE_PHOTO" as const,
      notes: language === "ar" ? "تحديث مرفق بواسطة المستأجر" : "Tenant updated attachment",
    }));

    const timelineEvent = {
      id: "tl-" + Date.now(),
      eventType: "TENANT_UPDATED" as any,
      titleAr: "تعديل وإرسال الطلب من المستأجر",
      titleEn: "Request Updated & Resubmitted by Tenant",
      details: language === "ar"
        ? `قام المستأجر بتحديث بيانات ووصف طلب الصيانة وإعادة إرساله للموظف.`
        : `Tenant updated maintenance request details and resubmitted to staff.`,
      timestamp,
      userId: currentUser?.id || "tenant",
      userName: currentUser?.nameAr || currentUser?.nameEn || "المستأجر",
    };

    updateMaintenanceRequest(request.id, {
      issueDescription: issueDescription.trim(),
      status: "OPEN", // Route back to staff (Open status)
      returnReason: undefined, // Clear return reason
      attachments: [...existingAttachments, ...addedAttachments],
      timeline: [...(request.timeline || []), timelineEvent],
      updatedAt: timestamp,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {language === "ar" ? `تحديث طلب الصيانة #${request.requestNumber}` : `Update Maintenance Request #${request.requestNumber}`}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === "ar" ? "تعديل الملاحظات أو المرفقات وإعادة الإرسال للإدارة" : "Edit notes or attachments and resubmit to management"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Return Reason Banner */}
          {request.returnReason && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{language === "ar" ? "سبب الإرجاع من الإدارة:" : "Return Reason from Management:"}</span>
              </div>
              <p className="text-xs text-amber-800 font-medium leading-relaxed pl-6">
                {request.returnReason}
              </p>
            </div>
          )}

          {/* Issue Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">
              {language === "ar" ? "وصف طلب الصيانة وتحديثات التعديل" : "Maintenance Description & Update Notes"} <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder={language === "ar" ? "اكتب التعديلات أو التوضيح المطلوب بناءً على ملاحظات الإدارة..." : "Enter updates or clarifications based on management notes..."}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-medium"
              required
            />
          </div>

          {/* Attachment Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">
              {language === "ar" ? "إرفاق مستندات أو صور جديدة (يمكنك إرفاق عدة ملفات)" : "Attach New Documents or Photos (Multiple files allowed)"}
            </label>
            <DocumentUpload
              label={language === "ar" ? "اختر ملف أو صورة لإضافتها" : "Select file or photo to add"}
              onOptimized={(result) => {
                if (result) {
                  setNewAttachments((prev) => [...prev, result]);
                }
              }}
            />
            {newAttachments.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-[11px] font-bold text-slate-500">
                  {language === "ar" ? `الملفات المرفقة الجديدة (${newAttachments.length}):` : `New Attached Files (${newAttachments.length}):`}
                </p>
                {newAttachments.map((att, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold shadow-xs">
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{att.optimizedFileName || att.originalFileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewAttachments((prev) => prev.filter((_, i) => i !== index))}
                      className="w-6 h-6 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-all cursor-pointer shrink-0"
                      title={language === "ar" ? "حذف المرفق" : "Remove attachment"}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            {language === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{language === "ar" ? "إرسال إلى الموظف" : "Resubmit to Staff"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
