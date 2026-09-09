
import React, { useState, useEffect } from "react";
import { Database, ShieldCheck, Download, Upload, CheckCircle2, Cloud, RefreshCw, AlertTriangle, AlertCircle } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { auth, db } from "../../lib/firebase";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";

export const BackupCenter: React.FC = () => {
  const { language } = useLanguage();
  
  const [backups, setBackups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [selectedBackup, setSelectedBackup] = useState<any | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "system_backups"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bks: any[] = [];
      snapshot.forEach(doc => {
        bks.push({ id: doc.id, ...doc.data() });
      });
      setBackups(bks);
    });
    return () => unsubscribe();
  }, []);

  const handleManualBackup = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setBackupSuccess(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/backups/manual", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      setBackupSuccess(
        language === "ar" 
        ? "تم إنشاء نسخة احتياطية يدوية بنجاح ورفعها لـ Google Drive." 
        : "Manual backup created and uploaded to Google Drive successfully."
      );
      setTimeout(() => setBackupSuccess(null), 5000);
    } catch (e: any) {
      setErrorMsg(e.message);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup || restoreConfirmText !== 'RESTORE') return;
    
    setIsRestoring(true);
    setErrorMsg(null);
    setBackupSuccess(null);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ backupId: selectedBackup.id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      setBackupSuccess(
        language === "ar" 
        ? `تمت استعادة النسخة الاحتياطية بنجاح. نسخة قبل الاستعادة: ${data.result.preRestoreId}` 
        : `Restore successful. Pre-Restore Backup ID: ${data.result.preRestoreId}`
      );
      setSelectedBackup(null);
      setRestoreConfirmText("");
      setTimeout(() => setBackupSuccess(null), 10000);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-600" />
            <span>{language === "ar" ? "مركز النسخ الاحتياطي والأرشيف الآمن (Backup Center)" : "Secure Backup & Archive Center"}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "إنشاء حزم النسخ الاحتياطي الهيكلي، التحقق من التشفير والتكامل، والأرشفة التلقائية في سحب Google Drive"
              : "Create structured system backups, verify integrity checksums, and archive directly to Google Drive."}
          </p>
        </div>
      </div>

      {backupSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{backupSuccess}</span>
        </div>
      )}
      
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 text-xs font-bold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {selectedBackup ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-3xl space-y-4">
           <div className="flex items-start gap-3 text-red-700">
             <AlertTriangle className="w-6 h-6 flex-shrink-0" />
             <div>
                <h4 className="font-bold text-sm">
                  {language === "ar" ? "تحذير: استعادة قاعدة البيانات" : "WARNING: Database Restore"}
                </h4>
                <p className="text-xs mt-1 leading-relaxed">
                  {language === "ar"
                    ? "أنت على وشك استعادة نسخة احتياطية سابقة. سيؤدي هذا الإجراء إلى استبدال البيانات الحالية. سيتم إنشاء نسخة احتياطية (Pre-Restore) تلقائياً قبل بدء الاستعادة للحماية. لتأكيد الاستعادة، يرجى كتابة كلمة RESTORE أدناه."
                    : "You are about to restore a previous backup. This will overwrite current data. A pre-restore backup will be created automatically. Type RESTORE to confirm."}
                </p>
             </div>
           </div>
           
           <div className="bg-white p-4 rounded-xl border border-red-100 text-xs grid grid-cols-2 gap-4">
              <div><span className="font-bold text-slate-500">Backup ID:</span> <span className="font-mono text-slate-900">{selectedBackup.id}</span></div>
              <div><span className="font-bold text-slate-500">File Name:</span> <span className="font-mono text-slate-900">{selectedBackup.fileName}</span></div>
              <div><span className="font-bold text-slate-500">Date:</span> <span className="font-mono text-slate-900">{new Date(selectedBackup.createdAt).toLocaleString()}</span></div>
              <div><span className="font-bold text-slate-500">Docs / Colls:</span> <span className="font-mono text-slate-900">{selectedBackup.documentCount} / {selectedBackup.collectionCount}</span></div>
           </div>

           <div className="mt-4">
              <input
                 type="text"
                 placeholder="RESTORE"
                 value={restoreConfirmText}
                 onChange={(e) => setRestoreConfirmText(e.target.value)}
                 className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-bold text-center mb-4"
              />
              <div className="flex gap-4">
                <button
                    onClick={() => { setSelectedBackup(null); setRestoreConfirmText(""); }}
                    className="flex-1 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
                >
                    {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                    onClick={handleRestore}
                    disabled={restoreConfirmText !== 'RESTORE' || isRestoring}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                    {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{language === "ar" ? "تأكيد الاستعادة" : "Confirm Restore"}</span>
                </button>
              </div>
           </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
            <button
              onClick={handleManualBackup}
              disabled={isLoading}
              className="py-3 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              <span>{language === "ar" ? "إنشاء نسخة احتياطية يدوية" : "Create Manual Backup"}</span>
            </button>
        </div>
      )}

      {/* Backup History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs p-6 space-y-4">
        <h4 className="font-black text-slate-900 text-sm">
          {language === "ar" ? "سجل النسخ الاحتياطية" : "Backup History"}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4 text-start">Date & Time</th>
                <th className="py-3 px-4 text-start">Type</th>
                <th className="py-3 px-4 text-start">Status</th>
                <th className="py-3 px-4 text-start">Size (KB)</th>
                <th className="py-3 px-4 text-start">Docs</th>
                <th className="py-3 px-4 text-start">Drive ID</th>
                <th className="py-3 px-4 text-start">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {backups.map(bk => (
                <tr key={bk.id}>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{new Date(bk.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">
                     <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-800 font-bold text-[10px]">
                        {bk.backupType}
                     </span>
                  </td>
                  <td className="py-3 px-4">
                    {bk.status === 'SUCCESS' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">SUCCESS</span>
                    ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800">{bk.status}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{bk.fileSize ? Math.round(bk.fileSize / 1024) : '-'}</td>
                  <td className="py-3 px-4">{bk.documentCount || '-'}</td>
                  <td className="py-3 px-4 font-mono text-[10px]">{bk.googleDriveFileId || '-'}</td>
                  <td className="py-3 px-4">
                     {bk.status === 'SUCCESS' && bk.backupType !== 'PRE_RESTORE' && (
                        <button
                          onClick={() => setSelectedBackup(bk)}
                          className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-lg transition-colors"
                        >
                           Restore
                        </button>
                     )}
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                 <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">No backups found</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
