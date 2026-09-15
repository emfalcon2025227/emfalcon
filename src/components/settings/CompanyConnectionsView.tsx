/**
 * Emirates Falcon ERP — Phase 57-K Connection Center
 * Secure unified admin panel for Google Drive, Meta WhatsApp Business API, and Gmail/SMTP.
 * Includes interactive health monitoring, automatic error diagnostics, and safe, non-destructive test triggers.
 */

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Mail,
  ShieldCheck,
  CheckCircle2,
  CheckCircle,
  MinusCircle,
  AlertTriangle,
  Key,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  HardDrive,
  Play,
  XCircle,
  Clock,
  Info,
  Check,
  AlertCircle,
  X,
  Database,
  Printer,
  Download,
  Copy,
  Zap,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  getCommunicationProvidersConfigFromServer,
  saveCommunicationProvidersConfigOnServer,
  testWhatsAppConnectionOnServer,
  testGmailConnectionOnServer,
  sendTestWhatsAppMessageOnServer,
  sendTestEmailMessageOnServer,
  WhatsAppConfig,
  GmailSmtpConfig,
  DiagnosticStep,
} from "../../services/communicationProviderService";
import {
  runComprehensiveGoogleDriveDiagnostics,
  googleLogout,
  getCentralDriveStatus,
  CentralDriveStatus,
  DriveDiagnosticReport,
  DriveDiagnosticStep,
} from "../../services/googleDriveService";
import { authenticatedFetch } from "../../utils/apiClient";
import { downloadDriveStartupBat } from "../../services/driveStartupBatchGenerator";
import { scannerService } from "../../services/scannerService";
import {
  downloadHPBridgeBatchLauncher,
  downloadHPBridgePs1Script,
  getPowerShellOneLiner,
} from "../../services/hpScannerBridgeGenerator";

export const CompanyConnectionsView: React.FC = () => {
  const { language } = useLanguage();
  const { currentUser } = useAuth();

  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  // Administrative check
  const isAdmin =
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "MANAGER" ||
    currentUser?.role === "SYSTEM_OWNER";

  // Google Drive Connection State
  const [driveReport, setDriveReport] = useState<DriveDiagnosticReport | null>(null);
  const [centralDriveStatus, setCentralDriveStatus] = useState<CentralDriveStatus | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(false);

  // Scanner Bridge State
  const [scannerBridgeStatus, setScannerBridgeStatus] = useState<{
    running: boolean;
    scanners: any[];
    hpDetected: boolean;
    hpDeviceName?: string;
  }>({
    running: false,
    scanners: [],
    hpDetected: false,
  });
  const [scannerTesting, setScannerTesting] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [scannerPortInput, setScannerPortInput] = useState<string>(String(scannerService.getPort()));

  const handleSaveScannerPort = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = scannerPortInput.trim();
    const portNum = trimmed === "" ? 18622 : parseInt(trimmed, 10);
    scannerService.setPort(portNum);
    setScannerPortInput(String(scannerService.getPort()));
    addLog(t(`تم تحديث منفذ الماسح المحلي إلى: ${scannerService.getPort()}`, `Scanner bridge port updated to: ${scannerService.getPort()}`));
    setStatusFeedback({
      type: "success",
      text: t(`تم حفظ المنفذ ${scannerService.getPort()} بنجاح.`, `Port ${scannerService.getPort()} saved successfully.`),
    });
    checkScannerBridge();
  };

  // WhatsApp Configuration
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>({
    phoneNumberId: "",
    accessToken: "",
    wabaId: "",
    apiVersion: "v17.0",
    enabled: true,
    status: "NOT_CONFIGURED",
  });

  // Gmail / SMTP Configuration
  const [gmailConfig, setGmailConfig] = useState<GmailSmtpConfig>({
    smtpUser: "emfalcon2025227@gmail.com",
    appPassword: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    encryption: "SSL",
    senderName: "",
    enabled: true,
    status: "NOT_CONFIGURED",
  });

  const [gmailSteps, setGmailSteps] = useState<DiagnosticStep[]>([
    { name: "1. Configuration Loaded", status: "PENDING" },
    { name: "2. SMTP Host", status: "PENDING" },
    { name: "3. SMTP Port", status: "PENDING" },
    { name: "4. App Password", status: "PENDING" },
    { name: "5. DNS / Network Reachability", status: "PENDING" },
    { name: "6. TLS / Secure Channel", status: "PENDING" },
    { name: "7. SMTP Authentication", status: "PENDING" },
    { name: "8. SMTP Capability Check", status: "PENDING" },
  ]);

  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);
  const [showGmailPassword, setShowGmailPassword] = useState(false);

  // Connection diagnostics log for terminal simulation
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  // Testing & message dispatch states
  const [testPhone, setTestPhone] = useState("+971501234567");
  const [testEmail, setTestEmail] = useState("emfalcon2025227@gmail.com");
  const [testMessage, setTestMessage] = useState(
    "Emirates Falcon ERP Automated Integration Handshake Test"
  );

  const [statusFeedback, setStatusFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [domainHelpModal, setDomainHelpModal] = useState<{
    isOpen: boolean;
    domain: string;
    copied: boolean;
  }>({
    isOpen: false,
    domain: typeof window !== "undefined" ? window.location.hostname : "",
    copied: false,
  });

  const [isCommsTesting, setIsCommsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDiagnosticLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 24)]);
  };

  const loadAllConfigs = async () => {
    try {
      const data = await getCommunicationProvidersConfigFromServer();
      if (data.whatsapp) {
        setWhatsappConfig(data.whatsapp);
      }
      if (data.gmail) {
        setGmailConfig(data.gmail);
      }
      addLog(t("تم تحميل إعدادات الأنظمة بنجاح من الخادم.", "Loaded system configurations from server successfully."));
    } catch (err: any) {
      addLog(t(`فشل تحميل الإعدادات: ${err.message}`, `Failed to load configurations: ${err.message}`));
    }

    // Run active Google Drive connection diagnostics
    runDriveDiagnostics();
    checkScannerBridge();
  };

  const checkScannerBridge = async () => {
    setScannerTesting(true);
    const currentPort = scannerService.getPort();
    addLog(t(`جاري فحص حالة جسر الماسح الضوئي المحلي (Port ${currentPort})...`, `Checking Local Scanner Bridge (Port ${currentPort})...`));
    try {
      const status = await scannerService.checkBridgeStatus();
      setScannerBridgeStatus(status);
      if (status.running) {
        addLog(
          t(
            `تم الاتصال بنجاح بجسر الماسح الضوئي. الأجهزة المكتشفة: ${status.scanners.length > 0 ? status.scanners.map((s: any) => s.name).join(", ") : "جاهز"}`,
            `Connected to scanner bridge. Scanners: ${status.scanners.length > 0 ? status.scanners.map((s: any) => s.name).join(", ") : "Ready"}`
          )
        );
      } else {
        addLog(
          t(
            `خدمة الماسح الضوئي المحلي غير متصلة حالياً على المنفذ ${currentPort}.`,
            `Local Scanner Bridge is offline on port ${currentPort}.`
          )
        );
      }
    } catch (e: any) {
      addLog(t(`خطأ فحص الماسح الضوئي: ${e.message}`, `Scanner test error: ${e.message}`));
    } finally {
      setScannerTesting(false);
    }
  };

  const loadDriveStatus = async () => {
    try {
      const status = await getCentralDriveStatus();
      setCentralDriveStatus(status);
      return status;
    } catch (e) {
      console.warn("Could not load central drive status:", e);
      return null;
    }
  };

  const runDriveDiagnostics = async () => {
    setDriveLoading(true);
    addLog(t("جاري تشغيل الفحص التفصيلي (10 خطوات) لـ Google Drive عبر الخادم المركزي...", "Starting 10-step server-side Google Drive diagnostics..."));
    try {
      const [report, status] = await Promise.all([
        runComprehensiveGoogleDriveDiagnostics(),
        loadDriveStatus(),
      ]);
      setDriveReport(report);
      
      if (report.status === "REAL_UPLOAD_VERIFIED" || report.status === "CONNECTED") {
        addLog(
          t(
            `نجح فحص Google Drive المركزي! الحساب: ${report.accountEmail || status?.email || "موثق"}. المجلد: ${status?.rootFolderName || "EMIRATES_FALCON_ARCHIVE"}`,
            `Google Drive passed diagnostics! Account: ${report.accountEmail || status?.email || "Verified"}. Folder: ${status?.rootFolderName || "EMIRATES_FALCON_ARCHIVE"}`
          )
        );
      } else {
        addLog(
          t(
            `نتيجة فحص Google Drive: ${report.status}. التفاصيل: ${report.safeErrorMessage || "فحص غير مكتمل"}`,
            `Google Drive check status: ${report.status}. Details: ${report.safeErrorMessage || "Incomplete"}`
          )
        );
      }
    } catch (e: any) {
      addLog(`Failed to run Google Drive diagnostics: ${e.message}`);
    } finally {
      setDriveLoading(false);
    }
  };

  useEffect(() => {
    loadAllConfigs();
    addLog(t("تم تشغيل لوحة التحكم والتحقق من الأنظمة بنجاح.", "Connection center initialized successfully."));
  }, []);

  const handleGoogleAuth = async () => {
    if (!isAdmin) {
      alert(t("فقط مسؤولو النظام مخولون بربط وتفويض مساحة التخزين المركزية.", "Only administrators can configure central company cloud storage."));
      return;
    }

    setDriveLoading(true);
    addLog(t("طلب رابط تفويض Google Drive الموحد من الخادم...", "Requesting Central Google Drive OAuth authorization link from server..."));
    try {
      const res = await authenticatedFetch("/api/integrations/google-drive/connect");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate authorization URL");
      }
      const data = await res.json();
      if (!data.authUrl) throw new Error("No authorization URL returned by server");

      addLog(t("فتح نافذة تفويض Google بحساب الشركة...", "Opening Google OAuth consent window..."));

      // Set up message listener for popup callback
      const onMessage = async (evt: MessageEvent) => {
        if (evt.data?.type === "GDRIVE_OAUTH_SUCCESS") {
          window.removeEventListener("message", onMessage);
          addLog(t(`تم الربط بنجاح بحساب: ${evt.data.email || "حساب الشركة"}`, `Connected successfully to account: ${evt.data.email || "Company Account"}`));
          setStatusFeedback({
            type: "success",
            text: t("تم ربط Google Drive بنجاح وتشفير رمز التحديث على الخادم! جاري تشغيل الفحص الأمني...", "Google Drive connected and token encrypted server-side! Running diagnostic check..."),
          });
          await runDriveDiagnostics();
        } else if (evt.data?.type === "GDRIVE_OAUTH_FAILED") {
          window.removeEventListener("message", onMessage);
          addLog(t(`فشل الربط: ${evt.data.error || "تم الرفض"}`, `OAuth failed: ${evt.data.error}`));
          setStatusFeedback({
            type: "error",
            text: t("تعذر إكمال تفويض Google.", "Google authorization could not be completed."),
          });
        }
      };
      window.addEventListener("message", onMessage);

      // Open popup
      const popup = window.open(
        data.authUrl,
        "GoogleDriveCentralAuth",
        "width=600,height=700,status=no,toolbar=no,menubar=no"
      );
      if (!popup) {
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      addLog(t(`فشلت مصادقة Google: ${error.message}`, `Google authentication failed: ${error.message}`));
      setStatusFeedback({
        type: "error",
        text: error.message || t("فشلت عملية المصادقة. يرجى مراجعة إعدادات متصفحك.", "Authentication failed. Please check browser configurations."),
      });
    } finally {
      setDriveLoading(false);
    }
  };

  const handleGoogleDeauth = async () => {
    if (!isAdmin) return;
    setDriveLoading(true);
    addLog(t("جاري قطع الاتصال وإزالة صلاحيات Google OAuth المشفرة من الخادم...", "Disconnecting and clearing encrypted Google Drive tokens on server..."));
    try {
      const res = await authenticatedFetch("/api/integrations/google-drive/disconnect", {
        method: "POST",
      });
      if (res.ok) {
        await googleLogout();
        setDriveReport(null);
        setCentralDriveStatus(null);
        addLog(t("تم فصل الاتصال بمستودع Google Drive للشركة وإلغاء الرموز المشفرة بنجاح.", "Company Google Drive storage disconnected and encrypted tokens purged."));
        setStatusFeedback({
          type: "info",
          text: t("تم إلغاء ربط Google Drive بنجاح.", "Google Drive disconnected successfully."),
        });
        await runDriveDiagnostics();
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to disconnect Google Drive");
      }
    } catch (error: any) {
      addLog(`Disconnect error: ${error.message}`);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleRepairSafeIssues = async () => {
    setIsRepairing(true);
    addLog(t("بدء عملية الإصلاح الذاتي الآمن لمستودع Google Drive...", "Starting safe auto-repair for Google Drive..."));
    try {
      // 1. Purge client-side memory tokens
      await googleLogout();
      addLog(t("1. تم تنظيف الرموز المؤقتة في المتصفح.", "1. Temporary memory tokens purged."));
      
      // 2. Query token endpoint to force server-side validation/refresh
      const tokenRes = await authenticatedFetch("/api/connections/drive-token");
      if (tokenRes.ok) {
        addLog(t("2. تم الاتصال بنجاح بخادم النظام والتحقق من الرمز المركزي.", "2. Server token verified successfully."));
      }
      
      // 3. Re-run comprehensive diagnostics
      addLog(t("3. جاري إعادة اختبار جميع قنوات الرفع والتحقق الفوقي...", "3. Re-testing drive upload & verification pipeline..."));
      await runDriveDiagnostics();
      
      setStatusFeedback({
        type: "success",
        text: t("اكتملت عملية الفحص والإصلاح الذاتي بنجاح.", "Safe repair and diagnostic check completed successfully."),
      });
    } catch (err: any) {
      addLog(t(`فشل الإصلاح: ${err.message}`, `Repair failed: ${err.message}`));
      setStatusFeedback({
        type: "error",
        text: t("تعذر إكمال الإصلاح الآمن: " + err.message, "Could not complete repair: " + err.message),
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleSaveConfig = async (service: "whatsapp" | "gmail", e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    addLog(t(`جاري حفظ وتشفير إعدادات ${service === 'whatsapp' ? 'واتساب' : 'خادم البريد'} على الخادم...`, `Saving and encrypting ${service === 'whatsapp' ? 'WhatsApp' : 'SMTP'} settings on server...`));
    try {
      const payload = service === "whatsapp" 
        ? { whatsapp: whatsappConfig }
        : { gmail: gmailConfig };

      await saveCommunicationProvidersConfigOnServer(payload);
      addLog(t(`تم حفظ إعدادات ${service === 'whatsapp' ? 'واتساب للأعمال' : 'خادم Gmail SMTP'} بنجاح وأصبحت جاهزة للتشغيل.`, `Saved ${service === 'whatsapp' ? 'WhatsApp' : 'Gmail SMTP'} settings successfully on server.`));
      setStatusFeedback({
        type: "success",
        text: t("تم حفظ التعديلات وحفظها بصورة آمنة على الخادم.", "Configurations updated and saved securely on server."),
      });
      
      // Reload configurations
      const data = await getCommunicationProvidersConfigFromServer();
      if (data.whatsapp) setWhatsappConfig(data.whatsapp);
      if (data.gmail) setGmailConfig(data.gmail);

    } catch (err: any) {
      addLog(t(`فشل حفظ الإعدادات: ${err.message}`, `Failed to save configurations: ${err.message}`));
      setStatusFeedback({
        type: "error",
        text: t("فشل حفظ التعديلات على الخادم.", "Failed to save configurations on server."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setIsCommsTesting(true);
    addLog(t("بدء مصافحة الاتصال الحقيقية مع Meta API لقنوات واتساب...", "Initiating real connection handshake with Meta API for WhatsApp..."));
    try {
      const res = await testWhatsAppConnectionOnServer();
      setWhatsappConfig((prev) => ({
        ...prev,
        status: res.status as any,
        lastCheckedAt: res.lastCheckedAt,
        latency: res.latency,
        errorCode: res.errorCode,
        safeErrorMessage: res.safeErrorMessage,
        repairInstructions: res.repairInstructions,
      }));

      if (res.success) {
        addLog(t(`نجحت مصافحة Meta Graph API بنجاح! زمن الاستجابة: ${res.latency}ms`, `Meta Graph API connection handshake succeeded! Latency: ${res.latency}ms`));
        
        // Now send test message
        addLog(t(`جاري إرسال رسالة اختبارية للرقم ${testPhone}...`, `Dispatching test message to ${testPhone}...`));
        const sendRes = await sendTestWhatsAppMessageOnServer(testPhone, testMessage);
        
        addLog(t(`تم إرسال رسالة واتساب الاختبارية بنجاح! معرّف الرسالة: ${sendRes.messageId}`, `WhatsApp test message dispatched successfully! Message ID: ${sendRes.messageId}`));
        setStatusFeedback({
          type: "success",
          text: t("تم التحقق من ربط واتساب وإرسال الرسالة الاختبارية بنجاح!", "WhatsApp connection verified and test message sent successfully!"),
        });
      } else {
        addLog(t(`فشلت مصافحة واتساب: [${res.errorCode}] ${res.safeErrorMessage}`, `WhatsApp handshake failed: [${res.errorCode}] ${res.safeErrorMessage}`));
        setStatusFeedback({
          type: "error",
          text: t("فشل التحقق من ربط واتساب. يرجى مراجعة دليل الإصلاح أدناه.", "WhatsApp verification failed. Review repair guide below."),
        });
      }
    } catch (err: any) {
      addLog(`WhatsApp Test Error: ${err.message}`);
    } finally {
      setIsCommsTesting(false);
    }
  };

  const handleTestGmail = async () => {
    setIsCommsTesting(true);
    addLog(t("جاري تشغيل خطة التشخيص الفوري لخادم البريد Gmail SMTP (8 خطوات)...", "Starting 8-step Gmail SMTP connection diagnostic pipeline..."));
    try {
      const res = await testGmailConnectionOnServer();
      setGmailConfig((prev) => ({
        ...prev,
        status: res.status as any,
        lastCheckedAt: res.lastCheckedAt,
        latency: res.latency,
        errorCode: res.errorCode,
        safeErrorMessage: res.safeErrorMessage,
        repairInstructions: res.repairInstructions,
      }));

      if (res.steps && res.steps.length > 0) {
        setGmailSteps(res.steps);
      }

      if (res.success) {
        addLog(t(`نجح فحص خط تشخيص Gmail SMTP بالكامل! زمن الاستجابة الإجمالي: ${res.latency}ms`, `Gmail SMTP diagnostic pipeline passed! Total latency: ${res.latency}ms`));
        setStatusFeedback({
          type: "success",
          text: t("تم التحقق من ربط خادم البريد Gmail SMTP واجتياز جميع خطط الفحص والتشخيص المخصص بنجاح!", "Gmail SMTP connection verified and all 8 diagnostic steps passed successfully!"),
        });
      } else {
        addLog(t(`فشل فحص خادم البريد: [${res.errorCode}] ${res.safeErrorMessage}`, `Gmail SMTP diagnostic failed: [${res.errorCode}] ${res.safeErrorMessage}`));
        setStatusFeedback({
          type: "error",
          text: t("فشل التحقق من خادم البريد الإلكتروني. راجع دليل الإصلاح أدناه.", "Gmail SMTP connection failed. Review repair guide below."),
        });
      }
    } catch (err: any) {
      addLog(`SMTP Test Error: ${err.message}`);
    } finally {
      setIsCommsTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      setStatusFeedback({
        type: "error",
        text: t("يرجى إدخال عنوان بريد إلكتروني صحيح لإرسال الرسالة الاختبارية.", "Please enter a valid recipient email address for test message."),
      });
      return;
    }

    setIsCommsTesting(true);
    addLog(t(`جاري إرسال بريد إلكتروني اختباري إلى ${testEmail}...`, `Dispatching test email message to ${testEmail}...`));
    try {
      const sendRes = await sendTestEmailMessageOnServer(
        testEmail,
        "Emirates Falcon ERP — Gmail Connection Test",
        "This is an automated connection test from Emirates Falcon ERP."
      );

      if (sendRes.success) {
        addLog(t(`تم إرسال بريد الاختبار بنجاح! معرّف الرسالة: ${sendRes.messageId}`, `Test email dispatched successfully! Message ID: ${sendRes.messageId}`));
        setStatusFeedback({
          type: "success",
          text: t(`تم إرسال البريد الاختباري بنجاح إلى ${testEmail}! معرّف الرسالة: ${sendRes.messageId}`, `Test email sent successfully to ${testEmail}! Message ID: ${sendRes.messageId}`),
        });
      } else {
        addLog(t("فشل إرسال البريد الاختباري.", "Test email dispatch failed."));
        setStatusFeedback({
          type: "error",
          text: t("فشل إرسال البريد الاختباري. يرجى مراجعة إعدادات الخادم أولاً.", "Failed to send test email. Please verify SMTP settings first."),
        });
      }
    } catch (err: any) {
      addLog(`Send Test Email Error: ${err.message}`);
      setStatusFeedback({
        type: "error",
        text: t(`خطأ في إرسال البريد الاختباري: ${err.message}`, `Test email dispatch error: ${err.message}`),
      });
    } finally {
      setIsCommsTesting(false);
    }
  };

  const handleTestAllConnections = async () => {
    setDriveLoading(true);
    setIsCommsTesting(true);
    addLog(t("بدء تشغيل الفحص والتشخيص الشامل لكافة خدمات الربط الخارجية...", "Initiating global comprehensive health check for all integrations..."));
    
    try {
      // 1. Google Drive Diagnostics
      await runDriveDiagnostics();
      
      // 2. WhatsApp Handshake
      const waDiag = await testWhatsAppConnectionOnServer();
      setWhatsappConfig((prev) => ({
        ...prev,
        status: waDiag.status as any,
        lastCheckedAt: waDiag.lastCheckedAt,
        latency: waDiag.latency,
        errorCode: waDiag.errorCode,
        safeErrorMessage: waDiag.safeErrorMessage,
        repairInstructions: waDiag.repairInstructions,
      }));

      // 3. SMTP Handshake
      const mailDiag = await testGmailConnectionOnServer();
      setGmailConfig((prev) => ({
        ...prev,
        status: mailDiag.status as any,
        lastCheckedAt: mailDiag.lastCheckedAt,
        latency: mailDiag.latency,
        errorCode: mailDiag.errorCode,
        safeErrorMessage: mailDiag.safeErrorMessage,
        repairInstructions: mailDiag.repairInstructions,
      }));
      if (mailDiag.steps && mailDiag.steps.length > 0) {
        setGmailSteps(mailDiag.steps);
      }

      addLog(t("اكتمل فحص الامتثال والاتصال العام بنجاح لكافة المنصات.", "Global systems handshake scan complete."));
      setStatusFeedback({
        type: "success",
        text: t("اكتمل فحص الأنظمة والاتصال بنجاح. راجع سجل الفحص.", "Comprehensive diagnostic check complete. Review logs below."),
      });
    } catch (e: any) {
      addLog(`Global diagnostic failed: ${e.message}`);
    } finally {
      setDriveLoading(false);
      setIsCommsTesting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "REAL_UPLOAD_VERIFIED":
      case "VERIFIED":
      case "CONNECTION_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
            <Check className="w-3 h-3" />
            <span>{t("مؤكد ومتصل", "VERIFIED")}</span>
          </span>
        );
      case "CONFIGURED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
            <Info className="w-3 h-3" />
            <span>{t("مهيأ للاتصال", "CONFIGURED")}</span>
          </span>
        );
      case "ERROR":
      case "CONNECTION_FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
            <X className="w-3 h-3" />
            <span>{t("فشل الاتصال", "ERROR")}</span>
          </span>
        );
      case "REAUTH_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
            <AlertCircle className="w-3 h-3" />
            <span>{t("تطلب تجديد الإذن", "REAUTH REQUIRED")}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-800">
            <span>{t("غير مهيأ", "NOT CONFIG")}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5.5 h-5.5 text-amber-700" />
            <span>
              {t("مركز الاتصالات والربط للشركة", "Company Connection Center")}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {t(
              "إدارة مركزية موحدة لـ Google Drive، إشعارات WhatsApp وبوابة البريد الإلكتروني. مخصصة لمسؤولي النظام فقط لضمان سلامة الإرسال وأرشفة المستندات دون تخزين سري غير آمن.",
              "One-time secure configuration and live diagnostics for company storage, automated WhatsApp billing, and corporate email systems."
            )}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleTestAllConnections}
            disabled={driveLoading || isCommsTesting}
            className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(driveLoading || isCommsTesting) ? "animate-spin" : ""}`} />
            <span>{t("اختبار جميع خدمات الربط", "Test All Connections")}</span>
          </button>
        )}
      </div>

      {statusFeedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between border ${
            statusFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : statusFeedback.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : statusFeedback.type === "error" ? (
              <XCircle className="w-4 h-4 text-rose-600" />
            ) : (
              <Info className="w-4 h-4 text-blue-600" />
            )}
            <span>{statusFeedback.text}</span>
          </div>
          <button
            onClick={() => setStatusFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid of Connections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Google Drive Storage */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Google Drive</h4>
                  <p className="text-[11px] text-slate-400">{t("مستودع الأرشيف الإلكتروني المركزي الموحد", "Central Document Repository")}</p>
                </div>
              </div>

              {driveReport ? (
                renderStatusBadge(driveReport.status)
              ) : centralDriveStatus?.connected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("متصل مركزياً", "Centrally Connected")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                  {t("غير متصل", "Disconnected")}
                </span>
              )}
            </div>

            {/* Diagnostic Details */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500 pb-1.5 border-b border-slate-150">
                <span>{t("الحساب الموثق للشركة:", "Company Account:")}</span>
                <span className="font-bold text-slate-800 font-mono text-[11px]">
                  {centralDriveStatus?.email || driveReport?.accountEmail || "emfalcon2025227@gmail.com"}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-500 pb-1.5 border-b border-slate-150">
                <span>{t("المجلد الجذري للأرشيف:", "Root Archive Folder:")}</span>
                <span className="font-bold text-amber-900 font-mono text-[11px] flex items-center gap-1">
                  <span>{centralDriveStatus?.rootFolderName || "EMIRATES_FALCON_ARCHIVE"}</span>
                  {centralDriveStatus?.rootFolderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${centralDriveStatus.rootFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                      title={t("فتح المجلد في Google Drive", "Open folder in Google Drive")}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </span>
              </div>
              
              {/* Detailed 10 Steps Checklist */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="block text-[11px] font-bold text-slate-600">
                    {t("خطوات التحقق الأمني المالي (10 خطوات):", "Verification Security Checklist (10 Steps):")}
                  </span>
                  {driveReport && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {driveReport.steps.filter(s => s.status === "PASS").length} / {driveReport.steps.length}
                    </span>
                  )}
                </div>
                {driveReport?.steps ? (
                  <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                    {driveReport.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[10px]">
                        {step.status === "PASS" ? (
                          <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                        ) : step.status === "FAIL" ? (
                          <X className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0 mx-1" />
                        )}
                        <div className="flex-1">
                          <span className={`font-medium ${step.status === "PASS" ? "text-slate-800" : step.status === "FAIL" ? "text-rose-700 font-bold" : "text-slate-400"}`}>
                            {step.name}
                          </span>
                          {step.latency !== undefined && (
                            <span className="text-[9px] text-slate-400 ml-1">
                              ({step.latency}ms)
                            </span>
                          )}
                          {step.details && step.status !== "PASS" && (
                            <p className="text-[9px] text-slate-500 mt-0.5 font-sans leading-tight">
                              {step.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">
                    {t("انقر فوق فحص أو تفعيل لاختبار سلامة مستودع الأرشفة المركزي.", "Click check or activate to verify central storage integrity.")}
                  </p>
                )}
              </div>

              {driveReport && (
                <div className="pt-2 border-t border-slate-200 space-y-1 text-[10px]">
                  <div className="flex justify-between text-slate-400 font-mono">
                    <span>{t("زمن فحص الرفع:", "Upload Latency:")}</span>
                    <span className="text-slate-700 font-bold">{driveReport.latency ? `${driveReport.latency} ms` : "—"}</span>
                  </div>
                  {driveReport.fileId && (
                    <div className="flex flex-col text-slate-400 font-mono pt-1">
                      <span>{t("معرّف وثيقة الاختبار:", "Test File ID:")}</span>
                      <span className="text-slate-700 font-bold truncate break-all">{driveReport.fileId}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Note on Central Architecture */}
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 leading-relaxed flex gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{t("ربط لمرة واحدة (One-Time Setup):", "One-Time Central Setup:")}</span>
                <p className="mt-0.5 text-[10px] text-amber-800">
                  {t(
                    "يتم حفظ وتشفير رمز الوصول على الخادم بشكل آمن (AES-256). لا يحتاج أي مالك أو مستأجر أو موظف لإجراء مصادقة Google لاستخدام الأرشيف الإلكتروني.",
                    "Access tokens are securely encrypted server-side (AES-256). No owner, tenant, or staff needs to sign into Google to use the archive."
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100">
            {centralDriveStatus?.connected || driveReport?.status === "REAL_UPLOAD_VERIFIED" ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={runDriveDiagnostics}
                  disabled={driveLoading || isRepairing}
                  className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${driveLoading ? "animate-spin" : ""}`} />
                  <span>{t("إعادة تشغيل فحص الـ 10 خطوات", "Run 10-Step Diagnostics")}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRepairSafeIssues}
                    disabled={isRepairing || driveLoading}
                    className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title={t("إصلاح الرموز وإعادة المزامنة التلقائية", "Auto-repair tokens and sync")}
                  >
                    <Zap className={`w-3.5 h-3.5 ${isRepairing ? "animate-spin text-amber-600" : "text-blue-600"}`} />
                    <span>{isRepairing ? t("جاري الإصلاح...", "Repairing...") : t("إصلاح آمن", "Safe Repair")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadDriveStartupBat()}
                    className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title={t("تحميل أداة الفحص التلقائي لويندوز", "Download Windows auto-check batch tool")}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t("تنزيل ملف .bat", "Download .bat")}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setShowStartupModal(true)}
                    className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
                  >
                    {t("تعليمات بدء التشغيل مع ويندوز", "Windows Startup Guide")}
                  </button>

                  <button
                    type="button"
                    onClick={handleGoogleDeauth}
                    disabled={driveLoading || isRepairing}
                    className="text-rose-600 hover:text-rose-800 font-bold transition-colors cursor-pointer"
                  >
                    {t("قطع الاتصال", "Disconnect")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={driveLoading || isRepairing}
                  className="w-full py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-amber-700/10"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{t("ربط حساب Google Drive للشركة (مرة واحدة)", "Connect Company Google Drive (One-Time)")}</span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={runDriveDiagnostics}
                    disabled={driveLoading || isRepairing}
                    className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${driveLoading ? "animate-spin" : ""}`} />
                    <span>{t("فحص الحالة", "Check Status")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadDriveStartupBat()}
                    className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-slate-500" />
                    <span>{t("تنزيل .bat", "Download .bat")}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: WhatsApp API */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-100">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">WhatsApp API</h4>
                  <p className="text-[11px] text-slate-400">Meta Cloud / WABA Portal</p>
                </div>
              </div>

              {renderStatusBadge(whatsappConfig.status)}
            </div>

            <form onSubmit={(e) => handleSaveConfig("whatsapp", e)} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {t("معرّف رقم الهاتف (Phone Number ID)", "Phone Number ID")}
                </label>
                <input
                  type="text"
                  disabled={!isAdmin || isSaving}
                  value={whatsappConfig.phoneNumberId}
                  onChange={(e) =>
                    setWhatsappConfig({ ...whatsappConfig, phoneNumberId: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-amber-500/10 focus:outline-none"
                  placeholder="e.g. 1029384756"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {t("رمز الوصول الموثق لشركة ميتا (Meta OAuth Access Token)", "Meta Access Token")}
                </label>
                <div className="relative">
                  <input
                    type={showWhatsAppToken ? "text" : "password"}
                    disabled={!isAdmin || isSaving}
                    value={whatsappConfig.accessToken}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, accessToken: e.target.value })
                    }
                    placeholder={whatsappConfig.accessToken ? "••••••••••••••••" : t("أدخل رمز Meta المميز", "Enter Meta Token")}
                    className="w-full pl-3 pr-10 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-amber-500/10 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppToken(!showWhatsAppToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showWhatsAppToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">WABA ID</label>
                  <input
                    type="text"
                    disabled={!isAdmin || isSaving}
                    value={whatsappConfig.wabaId || ""}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, wabaId: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    placeholder="e.g. 9988776655"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">API Version</label>
                  <input
                    type="text"
                    disabled={!isAdmin || isSaving}
                    value={whatsappConfig.apiVersion || "v17.0"}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, apiVersion: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    placeholder="v17.0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || isSaving}
                    checked={whatsappConfig.enabled}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })
                    }
                    className="w-3.5 h-3.5 rounded text-amber-700 focus:ring-amber-500"
                  />
                  <span className="text-[11px] font-bold text-slate-700">
                    {t("تفعيل إشعارات واتساب الآلية", "Enable Notifications")}
                  </span>
                </label>

                {isAdmin && (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : t("حفظ الإعدادات", "Save config")}
                  </button>
                )}
              </div>
            </form>

            {/* Error Repair Center - WhatsApp */}
            {whatsappConfig.status === "ERROR" && whatsappConfig.errorCode && (
              <div className="p-3 bg-rose-50 border border-rose-150 rounded-2xl text-[11px] text-rose-800 space-y-1 leading-normal">
                <div className="flex items-center gap-1.5 font-bold text-rose-900">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span>{t("مركز إصلاح أخطاء الربط الفوري:", "Instant Connection Repair:")}</span>
                </div>
                <p className="text-[10px] text-rose-700 leading-normal">
                  <span className="font-bold underline">{t("نوع الخطأ:", "Error Type:")}</span> {whatsappConfig.errorCode}<br/>
                  <span className="font-bold underline">{t("الوصف:", "Description:")}</span> {whatsappConfig.safeErrorMessage}
                </p>
                <div className="text-[9px] bg-white border border-rose-100 p-2 rounded-xl mt-1 text-slate-700 whitespace-pre-wrap font-sans">
                  {whatsappConfig.repairInstructions}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 text-xs">
            <h5 className="font-bold text-slate-800">
              {t("اختبار الارتباط المباشر وإرسال رسالة", "Trigger Communication Test")}
            </h5>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+971501234567"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
              />
              <button
                onClick={handleTestWhatsApp}
                disabled={isCommsTesting}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{t("فحص وإرسال", "Send")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: SMTP Mail server */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold border border-indigo-100">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Gmail SMTP</h4>
                  <p className="text-[11px] text-slate-400">Secure SMTP Dispatcher</p>
                </div>
              </div>

              {renderStatusBadge(gmailConfig.status)}
            </div>

            <form onSubmit={(e) => handleSaveConfig("gmail", e)} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {t("اسم مستخدم SMTP (البريد الإلكتروني للشركة)", "SMTP User (Email)")}
                </label>
                <input
                  type="email"
                  disabled={!isAdmin || isSaving}
                  value={gmailConfig.smtpUser}
                  onChange={(e) => setGmailConfig({ ...gmailConfig, smtpUser: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-amber-500/10 focus:outline-none"
                  placeholder="emfalcon2025227@gmail.com"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {t("كلمة مرور التطبيق لـ Google (SMTP App Password)", "Gmail App Password")}
                </label>
                <div className="relative">
                  <input
                    type={showGmailPassword ? "text" : "password"}
                    disabled={!isAdmin || isSaving}
                    value={gmailConfig.appPassword}
                    onChange={(e) => setGmailConfig({ ...gmailConfig, appPassword: e.target.value })}
                    placeholder={gmailConfig.appPassword ? "••••••••••••••••" : t("أدخل كلمة المرور ذات الـ 16 حرفاً", "Enter 16-char App Password")}
                    className="w-full pl-3 pr-10 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-amber-500/10 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowGmailPassword(!showGmailPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showGmailPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Host</label>
                  <input
                    type="text"
                    disabled={!isAdmin || isSaving}
                    value={gmailConfig.smtpHost}
                    onChange={(e) => setGmailConfig({ ...gmailConfig, smtpHost: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Port</label>
                  <input
                    type="number"
                    disabled={!isAdmin || isSaving}
                    value={gmailConfig.smtpPort}
                    onChange={(e) =>
                      setGmailConfig({ ...gmailConfig, smtpPort: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    placeholder="465"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || isSaving}
                    checked={gmailConfig.enabled}
                    onChange={(e) => setGmailConfig({ ...gmailConfig, enabled: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-700 focus:ring-amber-500"
                  />
                  <span className="text-[11px] font-bold text-slate-700">
                    {t("تفعيل إشعارات البريد الآلية", "Enable Notifications")}
                  </span>
                </label>

                {isAdmin && (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : t("حفظ الإعدادات", "Save config")}
                  </button>
                )}
              </div>
            </form>

            {/* 8-Step Gmail Diagnostic Pipeline Steps */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>{t("خطوات تشخيص خادم البريد Gmail SMTP (8 خطوات):", "Gmail SMTP Diagnostic Pipeline:")}</span>
                {gmailConfig.latency ? (
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {gmailConfig.latency}ms
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {gmailSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl text-[10px] bg-slate-50 border border-slate-200/60"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {step.status === "PASS" && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      {step.status === "FAIL" && <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      {step.status === "PENDING" && <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {step.status === "SKIPPED" && <MinusCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span className="font-medium text-slate-700 truncate">{step.name}</span>
                    </div>
                    {step.latency ? (
                      <span className="font-mono text-[9px] text-slate-500 shrink-0 ml-1">{step.latency}ms</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Error Repair Center - SMTP */}
            {gmailConfig.status === "ERROR" && gmailConfig.errorCode && (
              <div className="p-3 bg-rose-50 border border-rose-150 rounded-2xl text-[11px] text-rose-800 space-y-2 leading-normal">
                <div className="flex items-center justify-between font-bold text-rose-900">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>{t("مركز إصلاح أخطاء خادم البريد:", "Instant Mail Server Repair:")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestGmail}
                    disabled={isCommsTesting}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isCommsTesting ? "animate-spin" : ""}`} />
                    <span>{t("إعادة المحاولة", "Retry Diagnostic")}</span>
                  </button>
                </div>
                <p className="text-[10px] text-rose-700 leading-normal">
                  <span className="font-bold underline">{t("نوع الخطأ:", "Error Type:")}</span> {gmailConfig.errorCode}<br/>
                  <span className="font-bold underline">{t("الوصف:", "Description:")}</span> {gmailConfig.safeErrorMessage}
                </p>
                <div className="text-[9px] bg-white border border-rose-100 p-2 rounded-xl text-slate-700 font-sans leading-relaxed">
                  {gmailConfig.repairInstructions}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-slate-800">
                {t("اختبار اتصال خادم البريد", "Gmail Connection Test")}
              </h5>
              <button
                type="button"
                onClick={handleTestGmail}
                disabled={isCommsTesting}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                <span>{t("تشغيل خطة التشخيص (8 خطوات)", "Run Diagnostics (8 steps)")}</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="block text-[10px] font-bold text-slate-500">
                {t("إرسال رسالة اختبارية اختيارية (انقر زر الإرسال صراحة):", "Optional Test Email Dispatch:")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="emfalcon2025227@gmail.com"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={isCommsTesting}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Send className="w-3 h-3" />
                  <span>{t("إرسال بريد اختباري", "Send Test Email")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: HP COLOR LASERJET PRO MFP SCANNER BRIDGE */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all col-span-1 lg:col-span-3">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <Printer className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-slate-900">
                      {t("ربط ماسح HP Color LaserJet Pro MFP M282nw المباشر", "HP Color LaserJet Pro MFP M282nw Direct Scanner Bridge")}
                    </h4>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                      WIA / TWAIN / eSCL
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t(
                      `محرك المسح الضوئي المباشر للشيكات والمستندات وعقود الإيجار من المتصفح عبر المنفذ المحلي ${scannerService.getPort()}`,
                      `Direct hardware scan bridge for cheques, tenant IDs, and contracts over local port ${scannerService.getPort()}`
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {scannerBridgeStatus.running ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {t(`الجسر المحلي متصل (المنفذ ${scannerService.getPort()})`, `Bridge Online (Port ${scannerService.getPort()})`)}
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {t(`الجسر المحلي غير مشغل (${scannerService.getPort()})`, `Bridge Offline (${scannerService.getPort()})`)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {t("حالة التوصيل والمنفذ", "Port Status")}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-blue-600">127.0.0.1:{scannerService.getPort()}</span>
                </div>
                <form onSubmit={handleSaveScannerPort} className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      placeholder="18622"
                      value={scannerPortInput}
                      onChange={(e) => setScannerPortInput(e.target.value)}
                      className="w-24 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title={t("اتركه فارغاً لاستخدام المنفذ الافتراضي 18622", "Leave blank for default port 18622")}
                    />
                    <button
                      type="submit"
                      className="flex-1 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      {t("حفظ المنفذ", "Save Port")}
                    </button>
                  </div>
                </form>
                <p className="text-[11px] text-slate-500">
                  {t("يعمل الجسر كخادم HTTP خفيف مشفر للتواصل مع برامج تشغيل WIA/TWAIN لطابعات HP.", "Runs a lightweight HTTP daemon to interface with native HP WIA drivers.")}
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={checkScannerBridge}
                    disabled={scannerTesting}
                    className="w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scannerTesting ? "animate-spin" : ""}`} />
                    <span>{t("فحص اتصال الماسح الآن", "Test Connection Now")}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {t("أداة التشغيل السريع المحدثة", "Quick Launcher (.bat / .ps1)")}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600">Single File Hybrid</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t("ملف تنفيذي ذاتي الاحتواء مع نظام حماية الإغلاق الفعلي والتشغيل بنقرة واحدة.", "Self-contained hybrid script with crash prevention and direct execution.")}
                </p>
                <div className="pt-1 flex flex-col gap-2">
                  <a
                    href="/api/scanner/download-package"
                    download="Emirates-Falcon-Scanner-Bridge.zip"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t("تنزيل حزمة الماسح الكاملة (ZIP) للأونلاين", "Download Full Cloud Package (.zip)")}</span>
                  </a>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => downloadHPBridgeBatchLauncher()}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t("تنزيل Start-HP-Scanner.bat", "Download .bat")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadHPBridgePs1Script()}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title={t("تنزيل سكريبت PowerShell المباشر", "Download .ps1")}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.ps1</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {t("الأجهزة المتوافقة المكتشفة", "Compatible Hardware")}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600">HP LaserJet Series</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate" title={scannerBridgeStatus.hpDeviceName || "HP Color LaserJet Pro MFP M282nw"}>
                  {scannerBridgeStatus.hpDeviceName || t("جاهز للاستخدام مع M282nw / M283 / M280", "Ready for M282nw / M283 / M280")}
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getPowerShellOneLiner());
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 3000);
                    }}
                    className="w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? t("تم نسخ الأمر!", "Copied!") : t("نسخ أمر PowerShell المباشر", "Copy PowerShell Command")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Connection Log Simulator (Terminal Panel) */}
      <div className="bg-slate-900 text-slate-200 rounded-3xl p-6 border border-slate-800 shadow-lg font-mono">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            </div>
            <span className="text-xs font-bold text-slate-400 pl-2">
              {t("سجل الامتثال والتشخيص الفوري", "System Connection Diagnostics Console")}
            </span>
          </div>
          <button
            onClick={() => setDiagnosticLogs([])}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            {t("مسح سجل الكونسول", "Clear Console")}
          </button>
        </div>

        <div className="space-y-1.5 text-xs max-h-56 overflow-y-auto custom-scrollbar leading-relaxed">
          {diagnosticLogs.length === 0 ? (
            <div className="text-slate-500 italic py-2">
              {t("لا توجد أحداث اتصال حالياً. انقر فوق اختبار الأنظمة لتسجيل الحركات والمصافحات المباشرة.", "Console ready. Trigger diagnostic checks to inspect network handshakes.")}
            </div>
          ) : (
            diagnosticLogs.map((log, index) => (
              <div key={index} className="hover:bg-slate-800/50 px-1.5 py-1 rounded transition-all border-b border-slate-800/20 text-slate-300">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Firebase Unauthorized Domain Modal & Guide */}
      {domainHelpModal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 relative">
            <button
              type="button"
              onClick={() => setDomainHelpModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-4 start-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  {t("تصريح النطاق في Firebase Authentication", "Authorize Domain in Firebase Console")}
                </h4>
                <p className="text-xs text-slate-500">
                  {t("حل خطأ (auth/unauthorized-domain)", "Resolve (auth/unauthorized-domain)")}
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2 leading-relaxed">
              <p>
                {t(
                  "تفرض جوجل وفيربيس حماية أمنية تمنع تسجيل الدخول إلا من النطاقات المعتمدة صراحة في لوحة التحكم.",
                  "Google & Firebase enforce security rules allowing sign-ins only from whitelisted authorized domains."
                )}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                {t("النطاق المطلوب إضافته (Current Domain):", "Domain to Add:")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={domainHelpModal.domain}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(domainHelpModal.domain);
                    setDomainHelpModal(prev => ({ ...prev, copied: true }));
                    setTimeout(() => setDomainHelpModal(prev => ({ ...prev, copied: false })), 3000);
                  }}
                  className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  {domainHelpModal.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{domainHelpModal.copied ? t("تم النسخ!", "Copied!") : t("نسخ النطاق", "Copy")}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-700" />
                <span>{t("خطوات الإضافة السريعة في Firebase:", "Quick Steps in Firebase Console:")}</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 pt-1 leading-normal">
                <li>{t("افتح وحدة تحكم Firebase (Firebase Console).", "Open Firebase Console.")}</li>
                <li>{t("اختر مشروع التطبيق (gen-lang-client-0196715356).", "Select project: gen-lang-client-0196715356.")}</li>
                <li>{t("انتقل إلى Authentication > ثم الإعدادات Settings > ثم النطاقات المصرح بها (Authorized domains).", "Go to Authentication > Settings > Authorized domains.")}</li>
                <li>{t("انقر على إضافة نطاق (Add domain) والصق النطاق المنسوخ أعلاه أو أضف run.app.", "Click 'Add domain' and paste the copied domain, or add run.app.")}</li>
              </ol>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDomainHelpModal(prev => ({ ...prev, isOpen: false }));
                  handleGoogleAuth();
                }}
                className="flex-1 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t("إعادة محاولة الربط الآن", "Retry Sign-In Now")}</span>
              </button>
              <button
                type="button"
                onClick={() => setDomainHelpModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {t("إغلاق", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Windows Startup Folder Instructions Modal */}
      {showStartupModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 relative">
            <button
              type="button"
              onClick={() => setShowStartupModal(false)}
              className="absolute top-4 start-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  {t("تشغيل الفحص تلقائياً مع بدء تشغيل ويندوز", "Automate Verification on Windows Startup")}
                </h4>
                <p className="text-xs text-slate-500">
                  {t("دليل تفعيل EmiratesFalcon-GDrive-Startup.bat", "Setup Guide for Startup Auto-Check")}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <span className="font-bold text-slate-900 block">
                  {t("الخطوة 1: تنزيل أداة التشخيص (.bat)", "Step 1: Download the Batch Script")}
                </span>
                <p className="text-slate-600">
                  {t("انقر أدناه لتنزيل ملف التشغيل المباشر الخاص بشركة صقر الإمارات:", "Click below to download the official automation batch file:")}
                </p>
                <button
                  type="button"
                  onClick={() => downloadDriveStartupBat()}
                  className="mt-1 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t("تنزيل EmiratesFalcon-GDrive-Startup.bat", "Download EmiratesFalcon-GDrive-Startup.bat")}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <span className="font-bold text-slate-900 block">
                  {t("الخطوة 2: فتح مجلد بدء التشغيل في ويندوز", "Step 2: Open Windows Startup Folder")}
                </span>
                <p className="text-slate-600">
                  {t("اضغط على مفتاحي Win + R على لوحة المفاتيح واكتب الأمر التالي:", "Press Win + R, then type and run:")}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="text"
                    readOnly
                    value="shell:startup"
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-xl select-all font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("shell:startup");
                      alert(t("تم نسخ الأمر shell:startup", "Copied shell:startup"));
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("نسخ", "Copy")}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1 text-emerald-900">
                <span className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {t("الخطوة 3: النقل والتشغيل الدائم", "Step 3: Paste and Done")}
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {t(
                    "انقل الملف الذي تم تنزيله إلى المجلد المفتوح. سيقوم ويندوز بفحص مستودع Google Drive والتأكد من استجابة الخادم المركزي عند كل إقلاع للجهاز.",
                    "Paste the downloaded file into the folder. Windows will automatically run the connectivity diagnostic on every computer boot."
                  )}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStartupModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {t("تم وفهمت الطريقة", "Done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
