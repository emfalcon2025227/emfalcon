import React from "react";
import { Move, Save, RotateCcw, X } from "lucide-react";
import { useLayout } from "../../context/LayoutContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

export const LayoutEditToggle: React.FC<{ formId?: string }> = ({ formId }) => {
  const { currentUser } = useAuth();
  const { isEditMode, toggleEditMode, saveLayout, resetLayout } = useLayout();
  const { language } = useLanguage();

  if (currentUser?.role !== "SUPER_ADMIN" && currentUser?.role !== "SYSTEM_OWNER") return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end print:hidden">
      {isEditMode && (
        <div className="flex flex-col gap-2 items-end mb-2 animate-in slide-in-from-bottom-4">
          {formId && (
            <>
              <button
                onClick={() => saveLayout(formId)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full shadow-lg transition-all text-sm font-bold"
              >
                <Save className="w-4 h-4" />
                <span>{language === "ar" ? "حفظ التخطيط" : "Save Layout"}</span>
              </button>
              <button
                onClick={() => resetLayout(formId)}
                className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-full shadow-lg transition-all text-sm font-bold"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{language === "ar" ? "إعادة تعيين" : "Reset Layout"}</span>
              </button>
            </>
          )}
        </div>
      )}
      
      <button
        onClick={toggleEditMode}
        className={`flex items-center gap-2 ${
          isEditMode ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-700 hover:bg-amber-800"
        } text-white px-4 py-3 rounded-full shadow-xl transition-all font-bold group`}
        title={isEditMode ? "Exit Edit Mode" : "Edit Layout Mode"}
      >
        {isEditMode ? (
          <>
            <X className="w-5 h-5" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300">
              {language === "ar" ? "إغلاق التعديل" : "Close Edit"}
            </span>
          </>
        ) : (
          <>
            <Move className="w-5 h-5" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300">
              {language === "ar" ? "تعديل التخطيط" : "Edit Layout"}
            </span>
          </>
        )}
      </button>
    </div>
  );
};
