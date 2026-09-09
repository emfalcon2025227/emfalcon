import React, { useState } from "react";
import { Clock, Play, CheckCircle2, AlertTriangle, Mail, ShieldCheck, RefreshCw } from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { runChequeDueDateBackgroundJob, ChequeBackgroundJobResult } from "../../services/chequeBackgroundJob";

export const ChequeBackgroundJobWidget: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { cheques, tenants, logAudit, updateCheque } = useData();

  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ChequeBackgroundJobResult | null>(null);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);

  const handleRunJob = async () => {
    setIsRunning(true);
    try {
      const result = await runChequeDueDateBackgroundJob(
        cheques,
        tenants,
        logAudit,
        (chequeId, lastReminderDate) => {
          updateCheque(chequeId, { lastReminderDate, reminderCount: 1 });
        }
      );
      setLastResult(result);
      setLastRunTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Background job execution error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {isAr ? "وظيفة فحص استحقاق الشيكات الآلية (Background Job)" : "Automated Cheque Due Date Job"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr 
                ? "تقوم بالتحقق يومياً من الشيكات المستحقة خلال 3 أيام وإرسال تنبيه بريد إلكتروني للمستأجر مع تسجيل السجلات في AuditLogs." 
                : "Runs daily to check cheques due in 3 days, emails tenants, and logs dispatches to AuditLogs."}
            </p>
          </div>
        </div>
        <button
          onClick={handleRunJob}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{isAr ? "جاري الفحص..." : "Running..."}</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>{isAr ? "تشغيل الفحص الآن" : "Run Job Now"}</span>
            </>
          )}
        </button>
      </div>

      {lastRunTime && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>{isAr ? `آخر تشغيل: ${lastRunTime}` : `Last run at: ${lastRunTime}`}</span>
          {lastResult && (
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {isAr 
                ? `تم فحص ${lastResult.checkedCount} | أرسلت ${lastResult.remindersSentCount} | فشلت ${lastResult.failedCount}` 
                : `Checked: ${lastResult.checkedCount} | Sent: ${lastResult.remindersSentCount} | Failed: ${lastResult.failedCount}`}
            </span>
          )}
        </div>
      )}

      {lastResult && lastResult.details.length > 0 && (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
          {lastResult.details.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                {item.status === "SENT" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {item.status === "FAILED" && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                {item.status === "SKIPPED" && <Clock className="w-4 h-4 text-slate-400" />}
                <span className="font-semibold text-slate-800 dark:text-slate-200">شيك #{item.chequeNumber}</span>
                <span className="text-slate-500">({item.tenantName})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{item.dueDate}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  item.status === "SENT" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" :
                  item.status === "FAILED" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400" :
                  "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
