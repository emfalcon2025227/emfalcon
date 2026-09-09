import React, { useState } from "react";
import {
  MessageSquare,
  Phone,
  Mail,
  Plus,
  Search,
  Filter,
  User,
  Calendar,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { SearchableSelect } from "../common/SearchableSelect";
import { CollectionAction, CollectionActionType, CollectionActionStatus } from "../../types";

export const FollowUpSystem: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentUser } = useAuth();
  const { collectionActions, tenants, addCollectionAction, getTenantReceivablePosition } = useData();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [actionType, setActionType] = useState<CollectionActionType>("PHONE_CALL");
  const [actionStatus, setActionStatus] = useState<CollectionActionStatus>("COMPLETED");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");

  const handleAddAction = () => {
    if (!selectedTenantId) return;

    const pos = getTenantReceivablePosition(selectedTenantId);
    
    addCollectionAction({
      tenantId: selectedTenantId,
      leaseId: "", // Should be linked in real implementation
      ownerId: "", // Should be linked
      propertyId: "", // Should be linked
      outstandingAtTime: pos.outstanding,
      actionDate: new Date().toISOString().split("T")[0],
      actionType,
      status: actionStatus,
      result,
      notes,
      nextFollowUpDate: nextFollowUp || undefined,
      assignedEmployeeId: currentUser?.id || "sys",
      assignedEmployeeName: currentUser?.nameEn || "System User",
    });

    setIsAddModalOpen(false);
    setSelectedTenantId("");
    setResult("");
    setNotes("");
  };

  return (
    <div className="space-y-6">
      {/* List Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-emerald-600" />
          <span>{isAr ? "نظام متابعة التحصيل" : "Collection Follow-up System"}</span>
        </h3>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? "تسجيل إجراء متابعة" : "Record Follow-up"}</span>
        </button>
      </div>

      {/* History List */}
      <div className="space-y-4">
        {collectionActions.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p>{isAr ? "لا توجد إجراءات متابعة مسجلة" : "No follow-up actions recorded yet"}</p>
          </div>
        ) : (
          collectionActions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((action) => {
            const tenant = tenants.find((t) => t.id === action.tenantId);
            return (
              <div key={action.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-emerald-200 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                      {action.actionType === "PHONE_CALL" && <Phone className="w-6 h-6" />}
                      {action.actionType === "WHATSAPP" && <MessageCircle className="w-6 h-6" />}
                      {action.actionType === "EMAIL" && <Mail className="w-6 h-6" />}
                      {(action.actionType !== "PHONE_CALL" && action.actionType !== "WHATSAPP" && action.actionType !== "EMAIL") && <MessageSquare className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{action.actionType}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">#{action.actionNumber}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "Unknown Tenant"}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                         <div className="flex items-center gap-1 text-[10px] text-slate-500">
                           <Calendar className="w-3 h-3" />
                           <span>{new Date(action.actionDate).toLocaleDateString()}</span>
                         </div>
                         <div className="flex items-center gap-1 text-[10px] text-slate-500">
                           <User className="w-3 h-3" />
                           <span>{action.assignedEmployeeName}</span>
                         </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      action.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                      action.status === "FAILED" || action.status === "NO_RESPONSE" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    }`}>
                      {action.status}
                    </span>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      AED {action.outstandingAtTime.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{isAr ? "عند الإجراء" : "at time"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "النتيجة والملاحظات" : "Result & Notes"}</div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-emerald-600">{action.result || "---"}</span>: {action.notes}
                  </p>
                </div>

                {action.nextFollowUpDate && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-rose-600">
                    <Clock className="w-4 h-4" />
                    <span>{isAr ? "موعد المتابعة القادم: " : "Next Follow-up: "} {new Date(action.nextFollowUpDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add Follow-up */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Plus className="w-6 h-6 text-emerald-600" />
              <span>{isAr ? "تسجيل إجراء متابعة جديد" : "Record New Follow-up"}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "المستأجر" : "Tenant"}</label>
                <SearchableSelect
                  options={tenants.map((t) => ({
                    id: t.id,
                    label: isAr ? t.nameAr : t.nameEn,
                    subLabel: t.phone ? `${isAr ? "هاتف:" : "Phone:"} ${t.phone}` : undefined,
                    badge: t.phone ? `${isAr ? "معرّف:" : "ID:"} ${t.id}` : undefined,
                  }))}
                  value={selectedTenantId}
                  onChange={(val) => setSelectedTenantId(val)}
                  placeholder={isAr ? "اختر المستأجر..." : "Select tenant..."}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "نوع الإجراء" : "Action Type"}</label>
                  <SearchableSelect
                    options={[
                      { id: "PHONE_CALL", label: isAr ? "اتصال هاتف" : "Phone Call" },
                      { id: "WHATSAPP", label: isAr ? "واتساب" : "WhatsApp" },
                      { id: "EMAIL", label: isAr ? "بريد إلكتروني" : "Email" },
                      { id: "VISIT", label: isAr ? "زيارة ميدانية" : "Site Visit" },
                      { id: "NOTICE", label: isAr ? "إشعار رسمي" : "Official Notice" },
                    ]}
                    value={actionType}
                    onChange={(val) => setActionType(val as any)}
                    placeholder={isAr ? "نوع الإجراء..." : "Action type..."}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "الحالة" : "Status"}</label>
                  <SearchableSelect
                    options={[
                      { id: "COMPLETED", label: isAr ? "تم بنجاح" : "Completed" },
                      { id: "FAILED", label: isAr ? "فشل" : "Failed" },
                      { id: "NO_RESPONSE", label: isAr ? "لا يوجد رد" : "No Response" },
                      { id: "PROMISED", label: isAr ? "وعد بالسداد" : "Promised Pay" },
                    ]}
                    value={actionStatus}
                    onChange={(val) => setActionStatus(val as any)}
                    placeholder={isAr ? "الحالة..." : "Status..."}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "النتيجة الرئيسية" : "Main Result"}</label>
                <input
                  type="text"
                  placeholder={isAr ? "مثال: وعد بالدفع يوم الخميس" : "e.g. Promised to pay by Thursday"}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "ملاحظات تفصيلية" : "Detailed Notes"}</label>
                <textarea
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm h-24 resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "موعد المتابعة القادم (اختياري)" : "Next Follow-up Date (Optional)"}</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm"
                  value={nextFollowUp}
                  onChange={(e) => setNextFollowUp(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleAddAction}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                {isAr ? "حفظ الإجراء" : "Save Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
