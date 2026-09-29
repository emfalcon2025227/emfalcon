import React, { useState } from "react";
import { MessageSquare, Save, Settings2, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { MessageTemplate } from "../../types";

export const MessageTemplatesSettings: React.FC = () => {
  const { t, language } = useLanguage();
  const { messageTemplates, updateMessageTemplate } = useData();
  const [activeTemplateId, setActiveTemplateId] = useState<string>(messageTemplates[0]?.id || "");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const activeTemplate = messageTemplates.find(t => t.id === activeTemplateId);

  const handleSave = () => {
    setSaveFeedback(language === "ar" ? "تم حفظ قالب الرسالة بنجاح" : "Template saved successfully");
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
      <div>
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          {language === "ar" ? "إعدادات قوالب الرسائل التلقائية" : "Automated Message Templates"}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {language === "ar" 
            ? "قم بإدارة نصوص التنبيهات للشيكات والعقود والتي يتم إرسالها تلقائياً للمستأجرين." 
            : "Manage alert texts for cheques and leases automatically sent to tenants."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-full sm:w-1/3 border-e border-slate-100 pe-0 sm:pe-4 space-y-2">
          {messageTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => setActiveTemplateId(template.id)}
              className={`w-full text-start p-3 rounded-xl transition-colors text-xs font-bold ${
                activeTemplateId === template.id
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent"
              }`}
            >
              {language === "ar" ? template.nameAr : template.nameEn}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-2/3 space-y-4">
          {activeTemplate && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "نص الرسالة (عربي)" : "Message Body (Arabic)"}
                </label>
                <textarea
                  rows={4}
                  value={activeTemplate.bodyAr}
                  onChange={(e) => updateMessageTemplate(activeTemplate.id, { bodyAr: e.target.value })}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl leading-relaxed text-slate-800 focus:ring-emerald-500 focus:border-emerald-500"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "نص الرسالة (إنجليزي)" : "Message Body (English)"}
                </label>
                <textarea
                  rows={4}
                  value={activeTemplate.bodyEn}
                  onChange={(e) => updateMessageTemplate(activeTemplate.id, { bodyEn: e.target.value })}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl leading-relaxed text-slate-800 focus:ring-emerald-500 focus:border-emerald-500"
                  dir="ltr"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 mb-2">
                  {language === "ar" ? "المتغيرات المتاحة للاستخدام:" : "Available variables:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeTemplate.variables.map((v) => (
                    <code key={v} className="bg-white px-1.5 py-0.5 rounded text-[10px] text-emerald-700 border border-emerald-100 font-mono">
                      {v}
                    </code>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {saveFeedback ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {saveFeedback}
                  </span>
                ) : (
                  <div />
                )}
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{language === "ar" ? "حفظ التغييرات" : "Save Changes"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
