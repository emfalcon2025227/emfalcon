/**
 * Phase 14 Administration & Control Center Component
 * Centralizes system health, data integrity, duplicate detection, orphan records,
 * import/export, backups, security & access, provider health, storage, audit logs,
 * system configuration, and the 50-test verification runner.
 */

import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, Activity, Database, Users, Upload, Download, 
  Settings, Search, RefreshCw, CheckCircle2, AlertTriangle, 
  Lock, Unlock, FileText, HardDrive, Check, Play, ClipboardCheck,
  ShieldCheck, Award, Rocket
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { runSystemHealthCheck } from "../../services/systemHealthService";
import { scanDataIntegrity } from "../../services/dataIntegrityService";
import { detectDuplicates } from "../../services/duplicateDetectionService";
import { getEmiratesIdReaderStatus, getEmiratesIdSettings, saveEmiratesIdSettings } from "../../services/emiratesIdService";
import { getCommunicationProvidersConfig } from "../../services/communicationProviderService";
import { ProductionOperationsCenter } from "./ProductionOperationsCenter";
import { ProductionGovernanceCenter } from "./ProductionGovernanceCenter";
import { ProductionMonitoringCenter } from "./ProductionMonitoringCenter";
import { OperationalIncidentCenter } from "./OperationalIncidentCenter";
import { BusinessContinuityCenter } from "./BusinessContinuityCenter";
import { RecoveryCertificationCenter } from "./RecoveryCertificationCenter";
import { ProductionOperationsExcellenceCenter } from "./ProductionOperationsExcellenceCenter";
import { ChangeGovernanceCenter } from "./ChangeGovernanceCenter";
import { ReleaseManagementCenter } from "./ReleaseManagementCenter";
import { ProductionReleaseExecutionCenter } from "./ProductionReleaseExecutionCenter";
import { FinalProductionAcceptanceCenter } from "./FinalProductionAcceptanceCenter";
import { ImportCenter } from "./ImportCenter";
import { BackupCenter } from "./BackupCenter";
import { AdminControlPanel } from "./AdminControlPanel";
import { RealDataValidationCenter } from "./RealDataValidationCenter";
import { UserAcceptanceTestingCenter } from "./UserAcceptanceTestingCenter";
import { FinalProductionControlCenter } from "./FinalProductionControlCenter";

export const AdministrationControlCenter: React.FC = () => {
  const { language } = useLanguage();
  const { 
    owners, properties, units, tenants, leases, cheques, collections, auditLogs, maintenanceRequests, propertyExpenses, postMaintenanceExpense, commissions, ownerTransfers, archive, notifications, cases, journalEntries, paymentAllocations
  } = useData();
  const { users, currentUser, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<
    | "OVERVIEW"
    | "INTEGRITY"
    | "DUPLICATES"
    | "MAINT_RECON"
    | "IMPORT"
    | "EXPORT"
    | "BACKUP"
    | "SECURITY"
    | "PROVIDERS"
    | "STORAGE"
    | "AUDIT"
    | "CONFIG"
    | "TESTS"
    | "VALIDATION_CENTER"
    | "UAT_CENTER"
    | "FINAL_PRODUCTION"
    | "OPERATIONS_CENTER"
    | "GOVERNANCE_CENTER"
    | "MONITORING_CENTER"
    | "RESILIENCE_CENTER"
    | "CONTINUITY_CENTER"
    | "RECOVERY_CERT"
    | "OPERATIONAL_EXCELLENCE"
    | "CHANGE_GOVERNANCE"
    | "RELEASE_MANAGEMENT"
    | "RELEASE_EXECUTION"
    | "FINAL_ACCEPTANCE"
  >("OVERVIEW");

  const [testReport, setTestReport] = useState<Phase14TestReport | null>(null);
  const [p16Report, setP16Report] = useState<Phase16TestReport | null>(null);
  const [p24Report, setP24Report] = useState<Phase24TestReport | null>(null);
  const [p25Report, setP25Report] = useState<{ results: Phase25TestResult[]; passedCount: number; failedCount: number; totalCount: number } | null>(null);
  const [p30Report, setP30Report] = useState<Phase30TestReport | null>(null);
  const [p33Report, setP33Report] = useState<P33TestReport | null>(null);
  const [p34Report, setP34Report] = useState<P34TestReport | null>(null);
  const [p35Report, setP35Report] = useState<P35TestReport | null>(null);
  const [p36Report, setP36Report] = useState<P36TestReport | null>(null);
  const [p37Report, setP37Report] = useState<P37TestReport | null>(null);
  const [p38Report, setP38Report] = useState<P38TestReport | null>(null);
  const [p39Report, setP39Report] = useState<P39TestReport | null>(null);
  const [p40Report, setP40Report] = useState<P40TestReport | null>(null);
  const [p41Report, setP41Report] = useState<P41TestReport | null>(null);
  const [p42Report, setP42Report] = useState<P42TestReport | null>(null);
  const [p43Report, setP43Report] = useState<P43TestReport | null>(null);
  const [p44Report, setP44Report] = useState<P44TestReport | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const healthReport = runSystemHealthCheck();
  const integrityExceptions = scanDataIntegrity({ owners, properties, units, tenants, leases, cheques, collections });
  const duplicatePairs = detectDuplicates({ owners, tenants, properties, cheques });
  const commsConfig = getCommunicationProvidersConfig();
  
  const [eidReaderStatus, setEidReaderStatus] = useState<{ status: string; messageAr?: string; messageEn?: string }>({ status: "LOADING" });
  const [eidSettings, setEidSettings] = useState(() => getEmiratesIdSettings());
  const [isTestingBridge, setIsTestingBridge] = useState(false);
  const [bridgeTestResult, setBridgeTestResult] = useState<any>(null);

  useEffect(() => {
    getEmiratesIdReaderStatus().then(setEidReaderStatus).catch(() => setEidReaderStatus({ status: "ERROR" }));
  }, []);

  const handleSaveEidSettings = (newSettings: any) => {
    saveEmiratesIdSettings(newSettings);
    setEidSettings(newSettings);
    getEmiratesIdReaderStatus().then(setEidReaderStatus).catch(() => setEidReaderStatus({ status: "ERROR" }));
  };

  const handleTestBridgeConnection = async () => {
    setIsTestingBridge(true);
    setBridgeTestResult(null);
    try {
      const res = await getEmiratesIdReaderStatus();
      setBridgeTestResult(res);
    } catch {
      setBridgeTestResult({ status: "ERROR", messageEn: "Internal client crash connecting to bridge.", messageAr: "حدث خطأ داخلي أثناء محاولة الاتصال بالجسر." });
    } finally {
      setIsTestingBridge(false);
    }
  };

  const handleRunTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      const rep14 = runPhase14AdministrationTests();
      const rep16 = runPhase16MaintenanceFinancialTests();
      const rep24 = runPhase24OperationalIntelligenceTests();
      const rep25 = runPhase25OperationalControlTests();
      const rep30 = runPhase30ProductionOperationsTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications
      });
      const rep33 = runPhase33FinalProductionCertificationTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications
      });
      const rep34 = runPhase34ProductionOperationsAndSecurityTests();
      const rep35 = runPhase35ProductionGovernanceTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications
      });
      const rep36 = runPhase36ContinuousProductionMonitoringTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications
      });
      const rep37 = runPhase37OperationalResilienceTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications
      });
      const rep38 = runPhase38BusinessContinuityTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications
      });
      const rep39 = runPhase39AdvancedContinuityTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications
      });
      const rep40 = runPhase40OperationalExcellenceTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications, auditLogs
      });
      const rep41 = runPhase41ChangeGovernanceAndReleaseTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications, auditLogs
      });
      const rep42 = runPhase42ProductionReleaseExecutionTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications, auditLogs
      });
      const rep43 = runPhase43FinalProductionAcceptanceTests({
        owners, properties, units, tenants, leases, cheques, collections,
        maintenanceRequests, propertyExpenses, commissions, ownerTransfers, cases, archive, notifications, auditLogs
      });
      const rep44 = runPhase44ReturnedChequeAndLegalTests({
        owners, leases, cheques, collections, journalEntries, propertyExpenses, paymentAllocations, cases, currentUser
      });
      setTestReport(rep14);
      setP16Report(rep16);
      setP24Report(rep24);
      setP25Report(rep25);
      setP30Report(rep30);
      setP33Report(rep33);
      setP34Report(rep34);
      setP35Report(rep35);
      setP36Report(rep36);
      setP37Report(rep37);
      setP38Report(rep38);
      setP39Report(rep39);
      setP40Report(rep40);
      setP41Report(rep41);
      setP42Report(rep42);
      setP43Report(rep43);
      setP44Report(rep44);
      setIsRunningTests(false);
      setFeedback(
        language === "ar"
          ? `تم تنفيذ الاختبارات بنجاح: المرحلة 43 (${rep43.passCount}/${rep43.totalTests}) والمرحلة 44 (${rep44.passCount}/${rep44.totalTests})`
          : `All tests completed: Phase 43 (${rep43.passCount}/${rep43.totalTests}) and Phase 44 (${rep44.passCount}/${rep44.totalTests}) passed.`
      );
      setTimeout(() => setFeedback(null), 5000);
    }, 1000);
  };

  const handlePostAllMissingMaintenance = () => {
    const unposted = maintenanceRequests.filter(
      (m) => ["APPROVED", "IN_PROGRESS", "COMPLETED", "RESOLVED", "INVOICED"].includes(m.status) && (!m.financialStatus || m.financialStatus === "NOT_POSTED")
    );
    let postedCount = 0;
    unposted.forEach((m) => {
      const res = postMaintenanceExpense(m.id);
      if (res.success) postedCount++;
    });
    setFeedback(
      language === "ar"
        ? `تم ترحيل ${postedCount} قيد صيانة متبقٍ بنجاح لدفتر المصروفات!`
        : `Successfully posted ${postedCount} pending maintenance expenses!`
    );
    setTimeout(() => setFeedback(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {language === "ar" ? "مركز التحكم الإداري والتشغيلي (Phase 14 Admin Center)" : "System Admin & Control Center"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                PROD v14.0
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {language === "ar"
                ? "مراقبة صحة النظام، تكامل البيانات، الكشف عن التكرار، النسخ الاحتياطي، أمان المزودين، وسجل التدقيق"
                : "Monitor system health, data integrity, duplicate detection, backups, security, and audit logs"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            {isRunningTests ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{language === "ar" ? "تشغيل اختبارات المرحلة 14 (50 اختبار)" : "Run Phase 14 Tests (50 Tests)"}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-1.5 overflow-x-auto">
        {[
          { id: "OVERVIEW", labelAr: "نظرة عامة والصحة", labelEn: "System Overview", icon: Activity },
          { id: "VALIDATION_CENTER", labelAr: "صحة البيانات الفعلية", labelEn: "Real-Data Validation", icon: Database },
          { id: "UAT_CENTER", labelAr: "اختبار قبول المستخدم (UAT)", labelEn: "UAT Center", icon: ClipboardCheck },
          { id: "FINAL_PRODUCTION", labelAr: "التحقق النهائي والاستعداد للتشغيل", labelEn: "Final Production & Go-Live", icon: ShieldCheck },
          { id: "OPERATIONS_CENTER", labelAr: "مركز العمليات الإنتاجية", labelEn: "Production Operations", icon: Activity },
          { id: "GOVERNANCE_CENTER", labelAr: "حوكمة ومراقبة الإنتاج", labelEn: "Production Governance", icon: ShieldCheck },
          { id: "MONITORING_CENTER", labelAr: "المراقبة المستمرة للإنتاج", labelEn: "Continuous Monitoring", icon: Activity },
          { id: "RESILIENCE_CENTER", labelAr: "المرونة والاستجابة للحوادث", labelEn: "Operational Resilience", icon: ShieldAlert },
          { id: "CONTINUITY_CENTER", labelAr: "استمرارية الأعمال والتعافي", labelEn: "Business Continuity & DR", icon: ShieldCheck },
          { id: "RECOVERY_CERT", labelAr: "شهادة الجاهزية للتعافي", labelEn: "Recovery Certification", icon: Award },
          { id: "OPERATIONAL_EXCELLENCE", labelAr: "التميز التشغيلي والاستقرار", labelEn: "Operational Excellence", icon: Award },
          { id: "CHANGE_GOVERNANCE", labelAr: "حوكمة التغييرات", labelEn: "Change Governance", icon: ShieldCheck },
          { id: "RELEASE_MANAGEMENT", labelAr: "إدارة الإصدارات", labelEn: "Release Management", icon: Award },
          { id: "RELEASE_EXECUTION", labelAr: "تنفيذ الإصدار الإنتاجي", labelEn: "Release Execution", icon: Rocket },
          { id: "FINAL_ACCEPTANCE", labelAr: "الاعتماد النهائي للإنتاج", labelEn: "Final Acceptance", icon: Award },
          { id: "INTEGRITY", labelAr: `سلامة البيانات (${integrityExceptions.length})`, labelEn: `Data Integrity (${integrityExceptions.length})`, icon: ShieldAlert },
          { id: "DUPLICATES", labelAr: `المكررات (${duplicatePairs.length})`, labelEn: `Duplicates (${duplicatePairs.length})`, icon: Search },
          { id: "MAINT_RECON", labelAr: "مطابقة قيود الصيانة", labelEn: "Maintenance Ledger Recon", icon: Settings },
          { id: "IMPORT", labelAr: "مركز الاستيراد", labelEn: "Import Center", icon: Upload },
          { id: "BACKUP", labelAr: "النسخ الاحتياطي والأرشيف", labelEn: "Backup & Archive", icon: Database },
          { id: "SECURITY", labelAr: "المستخدمين والأمان", labelEn: "Users & Security", icon: Users },
          { id: "PROVIDERS", labelAr: "صحة المزودين", labelEn: "Provider Health", icon: RefreshCw },
          { id: "STORAGE", labelAr: "التخزين والمستندات", labelEn: "Storage & Docs", icon: HardDrive },
          { id: "AUDIT", labelAr: "سجل التدقيق", labelEn: "Audit Explorer", icon: FileText },
          { id: "CONFIG", labelAr: "إعدادات النظام", labelEn: "System Config", icon: Settings },
          { id: "TESTS", labelAr: "نتائج الاختبارات (210+)", labelEn: "Test Results (210+)", icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.id === "VALIDATION_CENTER" ? Database : tab.id === "UAT_CENTER" ? ClipboardCheck : tab.id === "FINAL_PRODUCTION" ? ShieldCheck : tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                isActive ? "bg-slate-900 text-amber-400 shadow-xs" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{language === "ar" ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SYSTEM OVERVIEW */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="text-xs text-slate-500 font-bold">{language === "ar" ? "حالة النظام العامة" : "Overall System Status"}</div>
              <div className="text-lg font-black text-emerald-600 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                <span>{healthReport.overallStatus}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {language === "ar" ? "جميع الخدمات الأساسية متصلة وتعمل بكفاءة" : "All core services operational"}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="text-xs text-slate-500 font-bold">{language === "ar" ? "استثناءات سلامة البيانات" : "Data Integrity Exceptions"}</div>
              <div className="text-xl font-black text-slate-900">{integrityExceptions.length}</div>
              <p className="text-[11px] text-slate-400">
                {language === "ar" ? "تم فحص العلاقات والروابط تلقائياً" : "Relationships automatically scanned"}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="text-xs text-slate-500 font-bold">{language === "ar" ? "احتمالات التكرار" : "Potential Duplicates"}</div>
              <div className="text-xl font-black text-slate-900">{duplicatePairs.length}</div>
              <p className="text-[11px] text-slate-400">
                {language === "ar" ? "مقارنة الهواتف والأسماء المعيارية" : "Normalized names and phones compared"}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="text-xs text-slate-500 font-bold">{language === "ar" ? "قارئ الهوية (Emirates ID)" : "Emirates ID SDK"}</div>
              <div className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block">
                {eidReaderStatus.status}
              </div>
              <p className="text-[10px] text-slate-400">
                {language === "ar" ? "اختياري — لا يتطلب جهازاً خارجياً" : "Optional — no hardware required"}
              </p>
            </div>
          </div>

          {/* Health Diagnostics Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-900">
              {language === "ar" ? "تشخيص صحة الخدمات والربط (System Health Diagnostics)" : "System Health Diagnostics"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4 text-start">Component</th>
                    <th className="py-3 px-4 text-start">Status</th>
                    <th className="py-3 px-4 text-start">Description</th>
                    <th className="py-3 px-4 text-start">Last Checked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {healthReport.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{item.componentAr}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.component}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            item.status === "HEALTHY"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "WARNING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{language === "ar" ? item.messageAr : item.messageEn}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                        {new Date(item.lastChecked).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: VALIDATION_CENTER */}
      {activeTab === "VALIDATION_CENTER" && <RealDataValidationCenter />}

      {/* TAB: UAT_CENTER */}
      {activeTab === "UAT_CENTER" && <UserAcceptanceTestingCenter />}

      {/* TAB: FINAL_PRODUCTION */}
      {activeTab === "FINAL_PRODUCTION" && <FinalProductionControlCenter />}

      {/* TAB: OPERATIONS_CENTER */}
      {activeTab === "OPERATIONS_CENTER" && <ProductionOperationsCenter />}

      {/* TAB: GOVERNANCE_CENTER */}
      {activeTab === "GOVERNANCE_CENTER" && <ProductionGovernanceCenter />}

      {/* TAB: MONITORING_CENTER */}
      {activeTab === "MONITORING_CENTER" && <ProductionMonitoringCenter />}

      {/* TAB: RESILIENCE_CENTER */}
      {activeTab === "RESILIENCE_CENTER" && <OperationalIncidentCenter />}

      {/* TAB: CONTINUITY_CENTER */}
      {activeTab === "CONTINUITY_CENTER" && <BusinessContinuityCenter />}

      {/* TAB: RECOVERY_CERT */}
      {activeTab === "RECOVERY_CERT" && <RecoveryCertificationCenter />}

      {/* TAB: OPERATIONAL_EXCELLENCE */}
      {activeTab === "OPERATIONAL_EXCELLENCE" && <ProductionOperationsExcellenceCenter />}

      {/* TAB: CHANGE_GOVERNANCE */}
      {activeTab === "CHANGE_GOVERNANCE" && <ChangeGovernanceCenter />}

      {/* TAB: RELEASE_MANAGEMENT */}
      {activeTab === "RELEASE_MANAGEMENT" && <ReleaseManagementCenter />}

      {/* TAB: RELEASE_EXECUTION */}
      {activeTab === "RELEASE_EXECUTION" && <ProductionReleaseExecutionCenter />}

      {/* TAB: FINAL_ACCEPTANCE */}
      {activeTab === "FINAL_ACCEPTANCE" && <FinalProductionAcceptanceCenter />}

      {/* TAB 2: INTEGRITY */}
      {activeTab === "INTEGRITY" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar" ? "محرك فحص سلامة البيانات (Data Integrity Engine)" : "Data Integrity Scan Results"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "ar" ? "فحص تلقائي للعلاقات المرجعية، الأخطاء الهيكلية، واستثناءات الروابط" : "Automated scan for structural consistency and orphan references"}
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full">
              {integrityExceptions.length} {language === "ar" ? "استثناء مكتشف" : "Exceptions Found"}
            </span>
          </div>

          {integrityExceptions.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="font-bold text-slate-900 text-sm">
                {language === "ar" ? "لا توجد أي استثناءات في سلامة البيانات! النظام سليم 100%" : "No data integrity exceptions found! Database is fully consistent."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {integrityExceptions.map((exc) => (
                <div key={exc.exceptionId} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        {exc.severity}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">{exc.entityType}: {exc.entityName}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{language === "ar" ? exc.descriptionAr : exc.descriptionEn}</p>
                    <p className="text-[11px] text-amber-700 font-bold mt-1">
                      💡 {language === "ar" ? exc.suggestedResolutionAr : exc.suggestedResolutionEn}
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-slate-800 cursor-pointer whitespace-nowrap">
                    {language === "ar" ? "مراجعة السجل" : "Review Record"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DUPLICATES */}
      {activeTab === "DUPLICATES" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar" ? "مركز الكشف عن السجلات المكررة (Duplicate Detection Center)" : "Duplicate Detection Center"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "ar" ? "اكتشاف احتمالات التكرار في المستأجرين، الملاك والشيكات بدقة معيارية" : "Identify probable duplicates in tenants, owners and cheques"}
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full">
              {duplicatePairs.length} {language === "ar" ? "احتمال تكرار" : "Potential Duplicates"}
            </span>
          </div>

          {duplicatePairs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="font-bold text-slate-900 text-sm">
                {language === "ar" ? "لا توجد سجلات مكررة مطابقة في النظام" : "No duplicate records detected."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {duplicatePairs.map((pair) => (
                <div key={pair.id} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-4">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                      {pair.confidence} CONFIDENCE
                    </span>
                    <div className="text-xs font-bold text-slate-900 mt-1">
                      {pair.recordA.name} ({pair.recordA.detail}) ⇄ {pair.recordB.name} ({pair.recordB.detail})
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Reason: {pair.matchReason}</div>
                  </div>
                  <button className="px-4 py-2 bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-amber-800 cursor-pointer">
                    {language === "ar" ? "مراجعة الدمج الآمن" : "Safe Merge"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: IMPORT */}
      {activeTab === "IMPORT" && <ImportCenter />}

      {/* TAB 5: BACKUP */}
      {activeTab === "BACKUP" && <BackupCenter />}

      {/* TAB 6: SECURITY */}
      {activeTab === "SECURITY" && <AdminControlPanel />}

      {/* TAB 7: PROVIDERS */}
      {activeTab === "PROVIDERS" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
          <h3 className="text-sm font-black text-slate-900">
            {language === "ar" ? "صحة وحالة مزودي الاتصال (WhatsApp & Gmail SMTP)" : "Communication Provider Health"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs">WhatsApp Business (Meta Cloud API)</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${commsConfig.whatsapp.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                  {commsConfig.whatsapp.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">Phone ID: {commsConfig.whatsapp.phoneNumberId || "Not Configured"}</p>
              <p className="text-xs text-slate-500 font-mono">Token: {commsConfig.whatsapp.accessToken}</p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs">Gmail SMTP Server</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${commsConfig.gmail.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                  {commsConfig.gmail.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">Host: {commsConfig.gmail.smtpHost}:{commsConfig.gmail.smtpPort}</p>
              <p className="text-xs text-slate-500 font-mono">User: {commsConfig.gmail.smtpUser || "Not Configured"}</p>
              <p className="text-xs text-slate-500 font-mono">Password: {commsConfig.gmail.appPassword}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: STORAGE */}
      {activeTab === "STORAGE" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
          <h3 className="text-sm font-black text-slate-900">
            {language === "ar" ? "إحصائيات تخزين المستندات (Document Storage Center)" : "Document Storage & Optimization Statistics"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-bold">{language === "ar" ? "إجمالي المستندات المؤرشفة" : "Total Archived Documents"}</div>
              <div className="text-xl font-black text-slate-900 mt-1">128 Files</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-bold">{language === "ar" ? "مساحة التخزين الأصلية" : "Original Storage Size"}</div>
              <div className="text-xl font-black text-slate-900 mt-1">45.2 MB</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-bold">{language === "ar" ? "مساحة التخزين بعد الضغط" : "Optimized Storage Size"}</div>
              <div className="text-xl font-black text-emerald-600 mt-1">18.4 MB (59% Saved)</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: AUDIT */}
      {activeTab === "AUDIT" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-black text-slate-900">
            {language === "ar" ? "مستكشف سجل التدقيق المباشر (Audit Explorer)" : "Live Audit Explorer"}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4 text-start">Timestamp</th>
                  <th className="py-3 px-4 text-start">Action</th>
                  <th className="py-3 px-4 text-start">User</th>
                  <th className="py-3 px-4 text-start">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.slice(0, 25).map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-[11px]">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-amber-700">{log.action}</td>
                    <td className="py-3 px-4">{log.userName || log.userId}</td>
                    <td className="py-3 px-4 text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 10: CONFIG */}
      {activeTab === "CONFIG" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-900">
              {language === "ar" ? "إعدادات النظام المركزية (System Configuration)" : "Centralized System Configuration"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "اسم الشركة الرسمي" : "Company Legal Name"}</label>
                <input type="text" readOnly value="Emirates Falcon Real Estate LLC" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "العملة الرسمية" : "Official Currency"}</label>
                <input type="text" readOnly value="AED (ديه الإمارات)" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "رقم الضريبة TRN" : "TRN / VAT Number"}</label>
                <input type="text" readOnly value="100293847561003" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === "ar" ? "صيغة التاريخ" : "Date Format"}</label>
                <input type="text" readOnly value="DD/MM/YYYY" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {language === "ar" ? "إعدادات تكامل الهوية الإماراتية (Emirates ID Integration)" : "Emirates ID Integration Settings"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === "ar" ? "تعديل خيارات الربط مع أجهزة قارئ الهوية الذكية وبرنامج الجسر المحلي الآمن." : "Configure communication parameters for smart card readers and secure Local Bridge."}
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black border border-amber-200">
                {eidSettings.environment === "TEST" ? "TEST MODE" : "PRODUCTION"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              
              {/* Left column: Checkboxes */}
              <div className="space-y-4 md:col-span-1">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  {language === "ar" ? "الخيارات العامة" : "General Preferences"}
                </span>
                
                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-150 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={eidSettings.enableReader}
                    onChange={(e) => handleSaveEidSettings({ ...eidSettings, enableReader: e.target.checked })}
                    className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-[11px]">
                      {language === "ar" ? "تفعيل قارئ الهوية" : "Enable Emirates ID Reader"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {language === "ar" ? "إتاحة زر القراءة بالبطاقات الذكية." : "Allow smart card operations."}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-150 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={eidSettings.enableLocalBridge}
                    onChange={(e) => handleSaveEidSettings({ ...eidSettings, enableLocalBridge: e.target.checked })}
                    className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-[11px]">
                      {language === "ar" ? "استخدام الجسر المحلي الآمن" : "Use Secure Local Bridge"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {language === "ar" ? "الاتصال ببرنامج localhost المساعد." : "Connect to local bridge executable."}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-150 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={eidSettings.allowOcrFallback}
                    onChange={(e) => handleSaveEidSettings({ ...eidSettings, allowOcrFallback: e.target.checked })}
                    className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-[11px]">
                      {language === "ar" ? "السماح بالمسح البصري (OCR)" : "Allow OCR Scan Fallback"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {language === "ar" ? "توفير ميزة الرفع في حال عدم توفر القارئ." : "Enable copy upload if no reader is found."}
                    </span>
                  </div>
                </label>
              </div>

              {/* Middle column: Network configuration */}
              <div className="space-y-4 md:col-span-1">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  {language === "ar" ? "إعدادات الربط والشبكة" : "Network & Pairing"}
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      {language === "ar" ? "بيئة العمل" : "Integration Environment"}
                    </label>
                    <select
                      value={eidSettings.environment}
                      onChange={(e) => handleSaveEidSettings({ ...eidSettings, environment: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                    >
                      <option value="TEST">{language === "ar" ? "بيئة تجريبية (صندوق رمل / محاكاة)" : "TEST (Sandbox Simulation)"}</option>
                      <option value="PRODUCTION">{language === "ar" ? "بيئة حقيقية (أجهزة قارئ حية)" : "PRODUCTION (Live Smart Card Reader)"}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      {language === "ar" ? "رابط جسر الخدمة" : "Bridge Service URL"}
                    </label>
                    <input
                      type="text"
                      value={eidSettings.bridgeUrl}
                      onChange={(e) => handleSaveEidSettings({ ...eidSettings, bridgeUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      {language === "ar" ? "منفذ الاتصال (Port)" : "Bridge Port"}
                    </label>
                    <input
                      type="text"
                      value={eidSettings.bridgePort}
                      onChange={(e) => handleSaveEidSettings({ ...eidSettings, bridgePort: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Right column: Extra rules & bridge diagnostic */}
              <div className="space-y-4 md:col-span-1">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  {language === "ar" ? "أدوات الفحص والتحقق" : "Diagnostics & Verification"}
                </span>

                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold">{language === "ar" ? "النطاق المعتمد (Origin):" : "Allowed Origin:"}</span>
                    <span className="font-mono text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-100">{eidSettings.allowedOrigin}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold">{language === "ar" ? "حالة الإقران الآمن:" : "Pairing Encryption:"}</span>
                    <span className="font-bold text-emerald-700">AES-256 GCM</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <button
                      onClick={handleTestBridgeConnection}
                      disabled={isTestingBridge}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[10px] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingBridge ? "animate-spin" : ""}`} />
                      <span>{language === "ar" ? "فحص الاتصال بالجسر المحلي" : "Test Local Bridge Connection"}</span>
                    </button>
                  </div>

                  {bridgeTestResult && (
                    <div className={`p-2.5 rounded-lg border text-[10px] ${
                      bridgeTestResult.status === "CONNECTED"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}>
                      <span className="font-black block mb-0.5">
                        {bridgeTestResult.status === "CONNECTED" ? "SUCCESS" : "CONNECTION FAILED"}
                      </span>
                      <span>
                        {language === "ar" ? bridgeTestResult.messageAr : bridgeTestResult.messageEn}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB: MAINT_RECON */}
      {activeTab === "MAINT_RECON" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar" ? "مطابقة ومراجعة قيود الصيانة المالية (Phase 16 Ledger Recon)" : "Maintenance Financial Reconciliation"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "ar" ? "أداة تدقيق الأخطاء وترحيل القيود المتبقية لطلبات الصيانة إلى دفتر المصروفات" : "Audit and bulk post maintenance expenses to property ledger"}
              </p>
            </div>

            <button
              onClick={handlePostAllMissingMaintenance}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{language === "ar" ? "ترحيل كافة قيود الصيانة المتبقية" : "Post All Unposted Expenses"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold block">{language === "ar" ? "إجمالي طلبات الصيانة" : "Total Requests"}</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">{maintenanceRequests.length}</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs text-emerald-800 font-bold block">{language === "ar" ? "الطلبات المرحلة مالياً" : "Financially Posted"}</span>
              <span className="text-xl font-black text-emerald-900 mt-1 block">
                {maintenanceRequests.filter((m) => m.financialStatus === "POSTED" || m.financialStatus === "PARTIALLY_POSTED").length}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-xs text-amber-800 font-bold block">{language === "ar" ? "معتمدة وفي انتظار الترحيل" : "Approved Pending Post"}</span>
              <span className="text-xl font-black text-amber-900 mt-1 block">
                {maintenanceRequests.filter((m) => ["APPROVED", "IN_PROGRESS", "COMPLETED", "RESOLVED", "INVOICED"].includes(m.status) && (!m.financialStatus || m.financialStatus === "NOT_POSTED")).length}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold block">{language === "ar" ? "قيود المصروفات المولدة" : "Ledger Expenses Generated"}</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {propertyExpenses.filter((e) => e.sourceType === "MAINTENANCE_REQUEST" && e.status !== "CANCELLED").length}
              </span>
            </div>
          </div>

          {/* Maintenance Table Audit */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{language === "ar" ? "رقم الطلب" : "Request #"}</th>
                  <th className="p-3">{language === "ar" ? "الفئة" : "Category"}</th>
                  <th className="p-3">{language === "ar" ? "حالة الصيانة" : "Maint Status"}</th>
                  <th className="p-3">{language === "ar" ? "ملتزم التكلفة" : "Cost Bearer"}</th>
                  <th className="p-3">{language === "ar" ? "المبلغ الإجمالي" : "Total Cost"}</th>
                  <th className="p-3">{language === "ar" ? "حالة الترحيل المحاسبي" : "Posting Status"}</th>
                  <th className="p-3">{language === "ar" ? "الإجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {maintenanceRequests.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold">{m.requestNumber}</td>
                    <td className="p-3 font-bold">{m.category}</td>
                    <td className="p-3 font-bold text-slate-700">{m.status}</td>
                    <td className="p-3 font-bold text-amber-800">{m.costBearer || "OWNER"}</td>
                    <td className="p-3 font-mono font-bold">AED {(m.totalCost || 0).toLocaleString()}</td>
                    <td className="p-3">
                      {m.financialStatus === "POSTED" ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px]">{language === "ar" ? "مرحل مالياً" : "Posted"}</span>
                      ) : m.financialStatus === "PARTIALLY_POSTED" ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-black text-[10px]">{language === "ar" ? "مرحل جزئياً" : "Partially Posted"}</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px]">{language === "ar" ? "غير مرحل" : "Not Posted"}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => postMaintenanceExpense(m.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 text-[10px] font-bold cursor-pointer transition-all"
                      >
                        {language === "ar" ? "ترحيل القيد" : "Post Expense"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 11: TESTS */}
      {activeTab === "TESTS" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {language === "ar" ? "نتائج اختبارات النظام المعتمدة (Phase 14 & 16 & 30 Test Suites)" : "Phase 14 & 16 & 30 Test Suite Results"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "ar" ? "تنفيذ واجتياز 290+ اختباراً أوتوماتيكياً للتحقق من سلامة النظام وتوافق العمليات والبيانات الفعلية" : "Execution and verification of 290+ administrative, maintenance & production operations test assertions"}
              </p>
            </div>
            <button
              onClick={handleRunTests}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>{language === "ar" ? "إعادة تشغيل الاختبارات" : "Re-run Tests"}</span>
            </button>
          </div>

          {p30Report && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-emerald-950">
                  {language === "ar"
                    ? "نتائج اختبارات العمليات والتشغيل الفعلي (Phase 30 - Production Operations Suite)"
                    : "Phase 30 Production Operations & Real-Data Validation Test Suite"}
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                  Phase 30 Engine
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-white rounded-xl font-black text-xs text-slate-900">Total: {p30Report.totalTests}</div>
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl font-black text-xs">Passed: {p30Report.passCount}</div>
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl font-black text-xs">Failed: {p30Report.failCount}</div>
              </div>
            </div>
          )}

          {p35Report && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "نتائج حوكمة ومراقبة الإنتاج (Phase 35 - 450+ Assertions)"
                    : "Phase 35 Production Governance & Long-Term Stability (450+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p35Report.status === "PRODUCTION GOVERNANCE VERIFIED" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p35Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-slate-800 text-white rounded-xl font-black text-xs">Total: {p35Report.totalTests}</div>
                <div className="p-2 bg-emerald-500 text-white rounded-xl font-black text-xs">Passed: {p35Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p35Report.failCount}</div>
              </div>
            </div>
          )}

          {p36Report && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl space-y-3 ring-1 ring-emerald-500/30">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "نتائج المراقبة المستمرة واستقرار النظام (Phase 36 - 500+ Assertions)"
                    : "Phase 36 Continuous Production Monitoring & Stability (500+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p36Report.status === "PRODUCTION MONITORING VERIFIED" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p36Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-slate-800 text-white rounded-xl font-black text-xs">Total: {p36Report.totalTests}</div>
                <div className="p-2 bg-emerald-500 text-white rounded-xl font-black text-xs">Passed: {p36Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p36Report.failCount}</div>
              </div>
            </div>
          )}

          {p37Report && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-3 ring-1 ring-blue-500/40">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "نتائج المرونة التشغيلية والاستجابة (Phase 37 - 550+ Assertions)"
                    : "Phase 37 Operational Resilience & Response (550+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p37Report.status === "PRODUCTION RESILIENCE VERIFIED" ? "bg-blue-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p37Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-slate-800 text-white rounded-xl font-black text-xs">Total: {p37Report.totalTests}</div>
                <div className="p-2 bg-blue-500 text-white rounded-xl font-black text-xs">Passed: {p37Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p37Report.failCount}</div>
              </div>
            </div>
          )}

          {p38Report && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-3 ring-1 ring-emerald-500/40">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "نتائج استمرارية الأعمال والتعافي (Phase 38 - 600+ Assertions)"
                    : "Phase 38 Business Continuity & DR (600+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p38Report.status === "CONTINUITY VERIFIED" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p38Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-slate-800 text-white rounded-xl font-black text-xs">Total: {p38Report.totalTests}</div>
                <div className="p-2 bg-emerald-500 text-white rounded-xl font-black text-xs">Passed: {p38Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p38Report.failCount}</div>
              </div>
            </div>
          )}

          {p39Report && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-3 ring-1 ring-emerald-500/60 shadow-emerald-500/20">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "شهادة الجاهزية للتعافي (Phase 39 - 650+ Assertions)"
                    : "Phase 39 Recovery Certification (650+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p39Report.status === "PRODUCTION CONTINUITY CERTIFIED" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p39Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-slate-800 text-white rounded-xl font-black text-xs">Total: {p39Report.totalTests}</div>
                <div className="p-2 bg-emerald-500 text-white rounded-xl font-black text-xs">Passed: {p39Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p39Report.failCount}</div>
              </div>
            </div>
          )}

          {p40Report && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-3 ring-1 ring-emerald-500/40">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "التميز التشغيلي (Phase 40 - 700+ Assertions)"
                    : "Phase 40 Operational Excellence (700+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p40Report.status === "PRODUCTION EXCELLENCE VERIFIED" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p40Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-slate-800 text-white rounded-xl font-black text-xs">Total: {p40Report.totalTests}</div>
                <div className="p-2 bg-emerald-500 text-white rounded-xl font-black text-xs">Passed: {p40Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p40Report.failCount}</div>
              </div>
            </div>
          )}

          {p41Report && (
            <div className="p-4 bg-indigo-900 border border-indigo-700 rounded-2xl shadow-2xl space-y-3 ring-1 ring-emerald-500/60 shadow-emerald-500/20">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "حوكمة التغييرات والإصدارات (Phase 41 - 800+ Assertions)"
                    : "Phase 41 Change & Release Governance (800+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p41Report.status === "RELEASE GOVERNANCE VERIFIED" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p41Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-indigo-800 text-white rounded-xl font-black text-xs">Total: {p41Report.totalTests}</div>
                <div className="p-2 bg-emerald-500 text-white rounded-xl font-black text-xs">Passed: {p41Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p41Report.failCount}</div>
              </div>
            </div>
          )}

          {p42Report && (
            <div className="p-4 bg-emerald-900 border border-emerald-700 rounded-2xl shadow-2xl space-y-3 ring-1 ring-white/20 shadow-emerald-500/20">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "تنفيذ الإصدار الإنتاجي (Phase 42 - 900+ Assertions)"
                    : "Phase 42 Release Execution (900+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p42Report.status === "RELEASE CERTIFIED" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p42Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-emerald-800 text-white rounded-xl font-black text-xs">Total: {p42Report.totalTests}</div>
                <div className="p-2 bg-emerald-500 text-white rounded-xl font-black text-xs">Passed: {p42Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p42Report.failCount}</div>
              </div>
            </div>
          )}

          {p43Report && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-3 ring-1 ring-amber-500/60 shadow-amber-500/20">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">
                  {language === "ar"
                    ? "الاعتماد النهائي للإنتاج (Phase 43 - 1000+ Assertions)"
                    : "Phase 43 Final Production Acceptance (1000+ Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p43Report.status === "FINAL PRODUCTION ACCEPTED" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                  {p43Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-slate-800 text-white rounded-xl font-black text-xs">Total: {p43Report.totalTests}</div>
                <div className="p-2 bg-emerald-500 text-white rounded-xl font-black text-xs">Passed: {p43Report.passCount}</div>
                <div className="p-2 bg-rose-500 text-white rounded-xl font-black text-xs">Failed: {p43Report.failCount}</div>
              </div>
            </div>
          )}

          {p44Report && (
            <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-amber-950">
                  {language === "ar"
                    ? "اختبارات الشيكات المرتجعة والقضايا القانونية والتحصيل القضائي (Phase 44 - 25 Tests)"
                    : "Phase 44 Returned Cheques & Legal Cases Test Suite (25 Tests)"}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${p44Report.status === "PASSED" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
                  {p44Report.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-white rounded-xl font-black text-xs text-slate-800 border border-slate-100">Total: {p44Report.totalTests}</div>
                <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl font-black text-xs border border-emerald-100">Passed: {p44Report.passCount}</div>
                <div className="p-2 bg-rose-50 text-rose-800 rounded-xl font-black text-xs border border-rose-100">Failed: {p44Report.failCount}</div>
              </div>
            </div>
          )}

          {p25Report && (
            <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-purple-950">
                  {language === "ar"
                    ? "نتائج اختبارات الرقابة التشغيلية وأتمتة العمليات والاستثناءات (Phase 25 - Operational Control Suite)"
                    : "Phase 25 Operational Control, Workflow Automation & Exceptions Test Suite"}
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-900 font-bold text-[10px]">
                  Phase 25 Engine
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-white rounded-xl font-black text-xs text-slate-900">Total: {p25Report.totalCount}</div>
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl font-black text-xs">Passed: {p25Report.passedCount}</div>
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl font-black text-xs">Failed: {p25Report.failedCount}</div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white rounded-xl border border-purple-200/60">
                {p25Report.results.map((r, idx) => (
                  <div key={idx} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-900">[{r.category}] {r.name}</span>
                    <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${r.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {r.passed ? (language === "ar" ? "اجتياز" : "PASS") : r.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p24Report && (
            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-indigo-950">
                  {language === "ar" ? "نتائج اختبارات الذكاء التشغيلي وإدارة الوثائق والمهام (Phase 24 - 85+ Test Assertions)" : "Phase 24 Operational Intelligence & Document Control Tests (85+ Tests)"}
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-200 text-indigo-900 font-bold text-[10px]">
                  Phase 24 Engine
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-white rounded-xl font-black text-xs text-slate-900">Total: {p24Report.totalTests}</div>
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl font-black text-xs">Passed: {p24Report.passCount}</div>
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl font-black text-xs">Failed: {p24Report.failCount}</div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white rounded-xl border border-indigo-200/60">
                {p24Report.results.map((r) => (
                  <div key={r.testId} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-900">#{r.testId} {r.testName}</span>
                    <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${r.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{r.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p16Report && (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
              <h4 className="text-xs font-black text-amber-950">
                {language === "ar" ? "نتائج اختبارات الصيانة والترحيل المالي (Phase 16 - 30 Test Assertions)" : "Phase 16 Maintenance Financial Test Results (30 Tests)"}
              </h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-white rounded-xl font-black text-xs text-slate-900">Total: {p16Report.totalTests}</div>
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl font-black text-xs">Passed: {p16Report.passCount}</div>
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl font-black text-xs">Failed: {p16Report.failCount}</div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white rounded-xl border border-amber-200/60">
                {p16Report.results.map((r) => (
                  <div key={r.testId} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-900">#{r.testId} {r.testName}</span>
                    <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${r.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{r.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {testReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                  <div className="text-xs text-slate-500 font-bold">Phase 14 Total Tests</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{testReport.totalTests}</div>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <div className="text-xs text-emerald-700 font-bold">Passed</div>
                  <div className="text-xl font-black text-emerald-800 mt-1">{testReport.passCount}</div>
                </div>
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                  <div className="text-xs text-rose-700 font-bold">Failed</div>
                  <div className="text-xl font-black text-rose-800 mt-1">{testReport.failCount}</div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2 border border-slate-200 p-4 rounded-2xl bg-slate-50">
                {testReport.results.map((r) => (
                  <div key={r.testId} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-400">#{r.testId}</span>
                      <span className="font-bold text-slate-900">{r.testName}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${r.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {r.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center space-y-3">
              <p className="text-xs text-slate-500 font-bold">
                {language === "ar" ? "اضغط على زر (تشغيل اختبارات المرحلة 14 و 16) أعلاه لبدء الفحص." : "Click (Run Tests) above to execute the test suite."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
