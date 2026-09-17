import { authenticatedFetch } from "../utils/apiClient";

export interface ConfigMatrixItem {
  id: string;
  service: string;
  category: "FIREBASE" | "GOOGLE_DRIVE" | "GEMINI" | "GMAIL_SMTP" | "WHATSAPP" | "SECURITY";
  key: string;
  labelAr: string;
  labelEn: string;
  type: "Secret" | "Non-Secret" | "ID" | "URL" | "Username" | "Host" | "Port" | "Protocol" | "Token";
  required: boolean;
  status: "NOT_CONFIGURED" | "CONFIGURED" | "CONNECTING" | "CONNECTED" | "REAUTH_REQUIRED" | "OFFLINE" | "ERROR";
  currentSource: "Server Environment" | "Secure Vault (.secrets.json)" | "Applet Config" | "Default Fallback";
  lastVerified?: string;
  isSecret: boolean;
  isConfigured: boolean;
  displayValue?: string;
  descriptionAr: string;
  descriptionEn: string;
  testAvailable: boolean;
}

export interface SystemConfigMatrixResponse {
  success: boolean;
  origin: string;
  calculatedCallbackUri: string;
  canonicalCallbackUri?: string;
  configuredRedirectUri: string;
  oauthRedirectUriUsed?: string;
  exactMatch?: boolean;
  oauthMatch: boolean;
  googleDrive: {
    connected: boolean;
    status: string;
    email?: string;
    rootFolderName: string;
    rootFolderId?: string;
    clientId: string;
    scopes: string[];
    canonicalRedirectUri?: string;
    configuredRedirectUri?: string;
    oauthRedirectUriUsed?: string;
    exactMatch?: boolean;
  };
  items: ConfigMatrixItem[];
}

export interface DiagnosticResult {
  serviceId: string;
  serviceNameAr: string;
  serviceNameEn: string;
  category: string;
  status: "PASS" | "FAIL" | "NOT_CONFIGURED" | "WARNING";
  latencyMs: number;
  lastChecked: string;
  messageAr: string;
  messageEn: string;
  safeRecoveryActionAr?: string;
  safeRecoveryActionEn?: string;
}

export interface SafeRepairResult {
  success: boolean;
  executionTimeMs: number;
  repairLogs: string[];
  diagnostics: DiagnosticResult[];
  messageAr: string;
  messageEn: string;
}

export interface ConfigAuditEntry {
  id: string;
  admin: string;
  action: string;
  provider: string;
  fieldName: string;
  timestamp: string;
  result: "SUCCESS" | "FAILED";
}

export async function fetchSystemConfigMatrix(): Promise<SystemConfigMatrixResponse> {
  const res = await authenticatedFetch("/api/admin/system-config");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch system config matrix (${res.status})`);
  }
  return res.json();
}

export async function saveSystemConfigUpdates(payload: {
  geminiApiKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  smtpUser?: string;
  gmailAppPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpEncryption?: string;
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappWabaId?: string;
  encryptionSecret?: string;
}): Promise<{ success: boolean; messageAr: string; messageEn: string; modifiedFields: string[] }> {
  const res = await authenticatedFetch("/api/admin/system-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to save configuration updates (${res.status})`);
  }
  return res.json();
}

export async function runAllSystemDiagnostics(): Promise<DiagnosticResult[]> {
  const res = await authenticatedFetch("/api/admin/diagnostics/run-all", {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Diagnostics failed to execute (${res.status})`);
  }
  const data = await res.json();
  return data.results || [];
}

export async function executeSafeRepair(): Promise<SafeRepairResult> {
  const res = await authenticatedFetch("/api/admin/diagnostics/safe-repair", {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Safe repair failed (${res.status})`);
  }
  return res.json();
}

export async function fetchConfigAuditLogs(): Promise<ConfigAuditEntry[]> {
  const res = await authenticatedFetch("/api/admin/system-config/audit-logs");
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({ logs: [] }));
  return data.logs || [];
}

export interface SmtpTestStep {
  name: string;
  status: "PASS" | "FAIL" | "PENDING" | "SKIPPED";
  details?: string;
  latency?: number;
}

export interface SmtpTestResult {
  success: boolean;
  status: "PASS" | "FAIL" | "NOT_CONFIGURED" | "ERROR";
  latency?: number;
  steps: SmtpTestStep[];
  safeErrorMessage?: string;
  repairInstructions?: string;
  lastCheckedAt?: string;
  smtpUser?: string;
  smtpHost?: string;
  smtpPort?: number;
}

export async function testSmtpConnection(): Promise<SmtpTestResult> {
  const res = await authenticatedFetch("/api/connections/test-smtp", {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      status: "FAIL",
      safeErrorMessage: errData.safeErrorMessage || errData.error || `HTTP ${res.status}`,
      repairInstructions: errData.repairInstructions || "التحقق من إعدادات البريد الإلكتروني في خادم النظام",
      steps: errData.steps || [
        { name: "HTTP Request", status: "FAIL", details: `Failed with HTTP status ${res.status}` }
      ]
    };
  }
  return res.json();
}

export async function testDriveConnection(): Promise<any> {
  const res = await authenticatedFetch("/api/integrations/google-drive/test", {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.safeErrorMessage || errData.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function downloadNonSecretConfigurationExport() {
  const res = await authenticatedFetch("/api/admin/system-config/export");
  if (!res.ok) {
    throw new Error("Failed to export configuration");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `emirates-falcon-system-config-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
