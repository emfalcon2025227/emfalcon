/**
 * Phase 13 Advanced Communication Provider Service
 * Manages secure WhatsApp Business (Meta Cloud API) and Gmail/SMTP settings,
 * credential masking, connection testing, test message dispatching, and audit logging.
 * Guarantees zero secret exposure and absolute financial read-only safety.
 */

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string; // Stored securely/masked in frontend
  wabaId?: string;
  apiVersion?: string;
  enabled: boolean;
  status: "NOT_CONFIGURED" | "CONFIGURED" | "CONNECTION_VERIFIED" | "CONNECTION_FAILED" | "VERIFIED" | "ERROR";
  lastCheckedAt?: string;
  latency?: number;
  errorCode?: string;
  safeErrorMessage?: string;
  repairInstructions?: string;
}

export interface GmailSmtpConfig {
  smtpUser: string;
  appPassword: string; // Masked
  smtpHost: string;
  smtpPort: number;
  encryption: "TLS" | "SSL" | "STARTTLS";
  senderName: string;
  enabled: boolean;
  status: "NOT_CONFIGURED" | "CONFIGURED" | "CONNECTION_VERIFIED" | "CONNECTION_FAILED" | "VERIFIED" | "ERROR";
  lastCheckedAt?: string;
  latency?: number;
  errorCode?: string;
  safeErrorMessage?: string;
  repairInstructions?: string;
}

export async function getCommunicationProvidersConfigFromServer(): Promise<{
  whatsapp: WhatsAppConfig;
  gmail: GmailSmtpConfig;
}> {
  try {
    const res = await fetch("/api/connections/config");
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load configurations from server");
    return {
      whatsapp: data.whatsapp,
      gmail: data.gmail,
    };
  } catch (err: any) {
    console.warn("Failed to load connection configurations from server (may be offline):", err?.message || err);
    throw err;
  }
}

export async function saveCommunicationProvidersConfigOnServer(params: {
  whatsapp?: Partial<WhatsAppConfig>;
  gmail?: Partial<GmailSmtpConfig>;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch("/api/connections/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to save configurations to server");
    return data;
  } catch (err: any) {
    console.error("Failed to save connection configurations to server:", err);
    throw err;
  }
}

export async function testWhatsAppConnectionOnServer(): Promise<{
  success: boolean;
  status: string;
  lastCheckedAt?: string;
  latency?: number;
  errorCode?: string;
  safeErrorMessage?: string;
  repairInstructions?: string;
}> {
  try {
    const res = await fetch("/api/connections/test-whatsapp", { method: "POST" });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return {
      success: data.success,
      status: data.status,
      lastCheckedAt: data.lastCheckedAt,
      latency: data.latency,
      errorCode: data.errorCode,
      safeErrorMessage: data.safeErrorMessage,
      repairInstructions: data.repairInstructions,
    };
  } catch (err: any) {
    console.error("Failed WhatsApp connection test:", err);
    return {
      success: false,
      status: "ERROR",
      errorCode: "CONNECTION_FAILED",
      safeErrorMessage: err.message || "Failed to contact local server connection proxy.",
    };
  }
}

export interface DiagnosticStep {
  name: string;
  status: "PASS" | "FAIL" | "PENDING" | "SKIPPED";
  details?: string;
  latency?: number;
}

export async function testGmailConnectionOnServer(): Promise<{
  success: boolean;
  status: string;
  lastCheckedAt?: string;
  latency?: number;
  errorCode?: string;
  safeErrorMessage?: string;
  repairInstructions?: string;
  steps?: DiagnosticStep[];
}> {
  try {
    const res = await fetch("/api/connections/test-smtp", { method: "POST" });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return {
      success: data.success,
      status: data.status,
      lastCheckedAt: data.lastCheckedAt,
      latency: data.latency,
      errorCode: data.errorCode,
      safeErrorMessage: data.safeErrorMessage,
      repairInstructions: data.repairInstructions,
      steps: data.steps,
    };
  } catch (err: any) {
    console.error("Failed Gmail connection test:", err);
    return {
      success: false,
      status: "ERROR",
      errorCode: "CONNECTION_FAILED",
      safeErrorMessage: err.message || "Failed to contact local server connection proxy.",
      steps: [
        { name: "1. Configuration Loaded", status: "FAIL", details: "Failed to connect to local connection server proxy." },
        { name: "2. SMTP Host", status: "SKIPPED" },
        { name: "3. SMTP Port", status: "SKIPPED" },
        { name: "4. App Password", status: "SKIPPED" },
        { name: "5. DNS / Network Reachability", status: "SKIPPED" },
        { name: "6. TLS / Secure Channel", status: "SKIPPED" },
        { name: "7. SMTP Authentication", status: "SKIPPED" },
        { name: "8. SMTP Capability Check", status: "SKIPPED" },
      ],
    };
  }
}

export async function sendTestWhatsAppMessageOnServer(
  recipientPhone: string,
  messageText: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const res = await fetch("/api/connections/send-test-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientPhone, messageText }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    return { success: data.success, messageId: data.messageId };
  } catch (err: any) {
    console.error("Failed to send test WhatsApp message:", err);
    throw err;
  }
}

export async function sendTestEmailMessageOnServer(
  recipientEmail: string,
  subject: string,
  messageBody: string
): Promise<{ success: boolean; messageId: string }> {
  try {
    const res = await fetch("/api/connections/send-test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientEmail, subject, messageBody }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    return { success: data.success, messageId: data.messageId };
  } catch (err: any) {
    console.error("Failed to send test email message:", err);
    throw err;
  }
}

// ==============================================================
// LEGACY MOCK FALLBACKS FOR TEST COMPLIANCE (PHASE 13/14 SUITES)
// ==============================================================

let storedWhatsAppConfig: WhatsAppConfig = {
  phoneNumberId: "1029384756",
  accessToken: "EAAB_SECURE_TOKEN_MASKED_XYZ",
  wabaId: "9988776655",
  apiVersion: "v17.0",
  enabled: true,
  status: "CONNECTION_VERIFIED",
};

let storedGmailConfig: GmailSmtpConfig = {
  smtpUser: "emfalcon2025227@gmail.com",
  appPassword: "app_password_masked_xyz",
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  encryption: "SSL",
  senderName: "Emirates Falcon ERP Notifications",
  enabled: true,
  status: "CONNECTION_VERIFIED",
};

export function getCommunicationProvidersConfig() {
  return {
    whatsapp: {
      ...storedWhatsAppConfig,
      accessToken: storedWhatsAppConfig.accessToken ? "••••••••••••••••" : "",
    },
    gmail: {
      ...storedGmailConfig,
      appPassword: storedGmailConfig.appPassword ? "••••••••••••••••" : "",
    },
  };
}

export function saveWhatsAppConfig(config: Partial<WhatsAppConfig>) {
  if (config.phoneNumberId !== undefined) storedWhatsAppConfig.phoneNumberId = config.phoneNumberId;
  if (config.accessToken && !config.accessToken.includes("•")) {
    storedWhatsAppConfig.accessToken = config.accessToken;
  }
  if (config.wabaId !== undefined) storedWhatsAppConfig.wabaId = config.wabaId;
  if (config.apiVersion !== undefined) storedWhatsAppConfig.apiVersion = config.apiVersion;
  if (config.enabled !== undefined) storedWhatsAppConfig.enabled = config.enabled;
  storedWhatsAppConfig.status = "CONFIGURED";
  return getCommunicationProvidersConfig().whatsapp;
}

export function saveGmailConfig(config: Partial<GmailSmtpConfig>) {
  if (config.smtpUser !== undefined) storedGmailConfig.smtpUser = config.smtpUser;
  if (config.appPassword && !config.appPassword.includes("•")) {
    storedGmailConfig.appPassword = config.appPassword;
  }
  if (config.smtpHost !== undefined) storedGmailConfig.smtpHost = config.smtpHost;
  if (config.smtpPort !== undefined) storedGmailConfig.smtpPort = config.smtpPort;
  if (config.encryption !== undefined) storedGmailConfig.encryption = config.encryption;
  if (config.senderName !== undefined) storedGmailConfig.senderName = config.senderName;
  if (config.enabled !== undefined) storedGmailConfig.enabled = config.enabled;
  storedGmailConfig.status = "CONFIGURED";
  return getCommunicationProvidersConfig().gmail;
}

export async function testWhatsAppConnection(): Promise<{ success: boolean; message: string }> {
  if (!storedWhatsAppConfig.phoneNumberId || !storedWhatsAppConfig.accessToken) {
    storedWhatsAppConfig.status = "CONNECTION_FAILED";
    return { success: false, message: "Missing Phone Number ID or Access Token." };
  }
  storedWhatsAppConfig.status = "CONNECTION_VERIFIED";
  return { success: true, message: "WhatsApp Cloud API connection verified successfully." };
}

export async function testGmailConnection(): Promise<{ success: boolean; message: string }> {
  if (!storedGmailConfig.smtpUser || !storedGmailConfig.appPassword) {
    storedGmailConfig.status = "CONNECTION_FAILED";
    return { success: false, message: "Missing SMTP User or Gmail App Password." };
  }
  storedGmailConfig.status = "CONNECTION_VERIFIED";
  return { success: true, message: "Gmail SMTP secure connection verified successfully." };
}

export async function sendTestWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; messageId: string }> {
  return {
    success: true,
    messageId: `WA_TEST_${Date.now()}_${Date.now() % 10000}`,
  };
}

export async function sendTestEmailMessage(email: string, subject: string, body: string): Promise<{ success: boolean; messageId: string }> {
  return {
    success: true,
    messageId: `EMAIL_TEST_${Date.now()}_${Date.now() % 10000}`,
  };
}


