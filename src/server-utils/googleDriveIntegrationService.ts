import fs from "fs";
import path from "path";
import * as crypto from "crypto";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

const SECRETS_FILE_PATH = path.join(process.cwd(), ".secrets.json");
const CONFIG_FILE_PATH = path.join(process.cwd(), "connections-config.json");

// Default Google OAuth Client ID if not set via environment
export const DEFAULT_GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "310777854048-e8nhqpo9ug8m0081r7vl7brpts9l7qr7.apps.googleusercontent.com";

// Standard Drive Scope: Minimally required scope for application files and folders
export const STANDARD_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export interface GoogleDriveConfig {
  connected: boolean;
  status: "NOT_CONFIGURED" | "CONNECTED" | "REAUTH_REQUIRED" | "ERROR" | "OFFLINE";
  email?: string;
  mode?: "OAUTH" | "SERVICE_ACCOUNT" | "NONE";
  clientId?: string;
  scope?: string;
  rootFolderName?: string;
  rootFolderId?: string;
  connectedAt?: string;
  lastCheckedAt?: string;
  latency?: number;
  errorCode?: string;
  safeErrorMessage?: string;
  repairInstructions?: string;
}

export interface DriveDiagnosticStep {
  name: string;
  status: "PASS" | "FAIL" | "PENDING";
  latency?: number;
  details?: string;
}

export interface DriveTestReport {
  success: boolean;
  status: "CONNECTED" | "REAUTH_REQUIRED" | "ERROR" | "NOT_CONFIGURED";
  latency: number;
  accountEmail?: string;
  rootFolderName?: string;
  rootFolderId?: string;
  storageQuota?: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
  };
  steps: DriveDiagnosticStep[];
  safeErrorMessage?: string;
  repairInstructions?: string;
}

// ---------------------------------------------------------------------------
// 1. Encryption & Decryption at Rest (AES-256-GCM)
// ---------------------------------------------------------------------------
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_SALT =
  process.env.ENCRYPTION_SECRET ||
  process.env.FIREBASE_PROJECT_ID ||
  "emirates-falcon-secure-gdrive-vault-2026";
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(ENCRYPTION_SALT)
  .digest();

export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    return `enc_gcm_v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (err: any) {
    console.error("[Vault] Encryption error:", err.message);
    return plainText;
  }
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc_gcm_v1:")) {
    // Legacy / unencrypted fallback
    return cipherText;
  }
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 4) return "";
    const iv = Buffer.from(parts[1], "hex");
    const authTag = Buffer.from(parts[2], "hex");
    const encrypted = parts[3];
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err: any) {
    console.error("[Vault] Decryption error:", err.message);
    return "";
  }
}

// ---------------------------------------------------------------------------
// 2. Secret & Config Persistence
// ---------------------------------------------------------------------------
interface StoredSecrets {
  smtpAppPassword?: string;
  whatsappAccessToken?: string;
  googleDriveRefreshTokenEncrypted?: string;
  googleClientSecretEncrypted?: string;
}

export function loadStoredSecrets(): {
  smtpAppPassword: string;
  whatsappAccessToken: string;
  googleDriveRefreshToken: string;
  googleClientSecret: string;
} {
  let fileData: StoredSecrets = {};
  try {
    if (fs.existsSync(SECRETS_FILE_PATH)) {
      fileData = JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, "utf8"));
    }
  } catch (e: any) {
    console.warn("[Vault] Failed to read .secrets.json:", e.message);
  }

  const refreshToken =
    decryptSecret(fileData.googleDriveRefreshTokenEncrypted || "") ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    "";

  const clientSecret =
    decryptSecret(fileData.googleClientSecretEncrypted || "") ||
    process.env.GOOGLE_CLIENT_SECRET ||
    "";

  return {
    smtpAppPassword: fileData.smtpAppPassword || process.env.GMAIL_APP_PASSWORD || "",
    whatsappAccessToken: fileData.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || "",
    googleDriveRefreshToken: refreshToken,
    googleClientSecret: clientSecret,
  };
}

export function saveGoogleDriveSecrets(secrets: {
  refreshToken?: string;
  clientSecret?: string;
}) {
  try {
    let current: StoredSecrets = {};
    if (fs.existsSync(SECRETS_FILE_PATH)) {
      try {
        current = JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, "utf8"));
      } catch {}
    }

    if (secrets.refreshToken !== undefined) {
      current.googleDriveRefreshTokenEncrypted = secrets.refreshToken
        ? encryptSecret(secrets.refreshToken)
        : "";
    }
    if (secrets.clientSecret !== undefined) {
      current.googleClientSecretEncrypted = secrets.clientSecret
        ? encryptSecret(secrets.clientSecret)
        : "";
    }

    fs.writeFileSync(SECRETS_FILE_PATH, JSON.stringify(current, null, 2), "utf8");
  } catch (e: any) {
    console.error("[Vault] Failed to write secrets file:", e.message);
  }
}

export function loadAllConfigs(): any {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf8"));
    }
  } catch (e) {
    console.warn("[Config] Failed to load connections-config.json");
  }
  return {};
}

export function getGoogleDriveConfig(): GoogleDriveConfig {
  const configs = loadAllConfigs();
  const drive = configs.googleDrive || {};
  return {
    connected: Boolean(drive.connected),
    status: drive.status || "NOT_CONFIGURED",
    email: drive.email || "",
    mode: drive.mode || "NONE",
    clientId: drive.clientId || DEFAULT_GOOGLE_CLIENT_ID,
    scope: drive.scope || STANDARD_DRIVE_SCOPE,
    rootFolderName: drive.rootFolderName || "Emirates Falcon",
    rootFolderId: drive.rootFolderId || "",
    connectedAt: drive.connectedAt,
    lastCheckedAt: drive.lastCheckedAt,
    latency: drive.latency,
    errorCode: drive.errorCode,
    safeErrorMessage: drive.safeErrorMessage,
    repairInstructions: drive.repairInstructions,
  };
}

export function updateGoogleDriveConfig(patch: Partial<GoogleDriveConfig>) {
  try {
    const currentConfigs = loadAllConfigs();
    const updatedDrive: GoogleDriveConfig = {
      ...(currentConfigs.googleDrive || {
        connected: false,
        status: "NOT_CONFIGURED",
        scope: STANDARD_DRIVE_SCOPE,
        rootFolderName: "Emirates Falcon",
      }),
      ...patch,
    };
    currentConfigs.googleDrive = updatedDrive;
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(currentConfigs, null, 2), "utf8");
    return updatedDrive;
  } catch (e: any) {
    console.error("[Config] Failed to save Google Drive config:", e.message);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 3. OAuth State & Anti-CSRF Protection
// ---------------------------------------------------------------------------
interface OAuthStateRecord {
  adminUid: string;
  redirectUri: string;
  createdAt: number;
}

const pendingOAuthStates = new Map<string, OAuthStateRecord>();

// Clean up states older than 15 minutes
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [state, rec] of pendingOAuthStates.entries()) {
    if (rec.createdAt < cutoff) {
      pendingOAuthStates.delete(state);
    }
  }
}, 60 * 1000);

// ---------------------------------------------------------------------------
// 4. OAuth2 Client Factory
// ---------------------------------------------------------------------------
export function getOAuth2Client(customRedirectUri?: string) {
  const secrets = loadStoredSecrets();
  const config = getGoogleDriveConfig();

  const clientId = process.env.GOOGLE_CLIENT_ID || config.clientId || DEFAULT_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || secrets.googleClientSecret || "";
  const redirectUri = customRedirectUri || process.env.GOOGLE_REDIRECT_URI || "";

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ---------------------------------------------------------------------------
// 5. Connect Flow: Generate Auth URL
// ---------------------------------------------------------------------------
export function generateConnectAuthUrl(params: {
  adminUid: string;
  origin: string;
  customRedirectUri?: string;
}): { authUrl: string; state: string; redirectUri: string } {
  const redirectUri =
    params.customRedirectUri ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${params.origin}/api/integrations/google-drive/callback`;

  const oauth2Client = getOAuth2Client(redirectUri);
  const state = crypto.randomBytes(32).toString("hex");

  pendingOAuthStates.set(state, {
    adminUid: params.adminUid,
    redirectUri,
    createdAt: Date.now(),
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // CRITICAL: forces refresh token to be returned every time
    scope: [STANDARD_DRIVE_SCOPE, "https://www.googleapis.com/auth/userinfo.email"],
    state,
  });

  return { authUrl, state, redirectUri };
}

// ---------------------------------------------------------------------------
// 6. Callback Flow: Code Exchange & Archive Initialization
// ---------------------------------------------------------------------------
export async function handleOAuthCallback(
  code: string,
  state: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  const stateRecord = pendingOAuthStates.get(state);
  if (!stateRecord) {
    return {
      success: false,
      error: "INVALID_STATE",
    };
  }

  // Consume state to prevent replay attacks
  pendingOAuthStates.delete(state);

  const oauth2Client = getOAuth2Client(stateRecord.redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let userEmail = "";
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      userEmail = userInfo.data.email || "";
    } catch (e: any) {
      console.warn("[OAuth Callback] Could not fetch userinfo:", e.message);
    }

    const secrets = loadStoredSecrets();
    const effectiveRefreshToken = tokens.refresh_token || secrets.googleDriveRefreshToken;

    if (!effectiveRefreshToken) {
      return {
        success: false,
        error: "NO_REFRESH_TOKEN",
      };
    }

    // Encrypt & store refresh token server-side
    saveGoogleDriveSecrets({ refreshToken: effectiveRefreshToken });

    // Initialize root folder "Emirates Falcon" in Drive
    let rootFolderId = "";
    try {
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      rootFolderId = await ensureDriveFolder(drive, "Emirates Falcon", "root");
    } catch (err: any) {
      console.warn("[OAuth Callback] Root folder check warning:", err.message);
    }

    // Update connection status
    updateGoogleDriveConfig({
      connected: true,
      status: "CONNECTED",
      email: userEmail,
      mode: "OAUTH",
      scope: tokens.scope || STANDARD_DRIVE_SCOPE,
      rootFolderName: "Emirates Falcon",
      rootFolderId,
      connectedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      errorCode: undefined,
      safeErrorMessage: undefined,
      repairInstructions: undefined,
    });

    return { success: true, email: userEmail };
  } catch (err: any) {
    console.error("[OAuth Callback] Token exchange failed:", err.message);
    return { success: false, error: err.message };
  }
}

// Helper to ensure Drive folder exists
export async function ensureDriveFolder(
  drive: any,
  folderName: string,
  parentId: string = "root"
): Promise<string> {
  const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
  const res = await drive.files.list({
    q: query,
    spaces: "drive",
    fields: "files(id, name)",
    pageSize: 1,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });

  return createRes.data.id;
}

// ---------------------------------------------------------------------------
// 7. Disconnect Flow
// ---------------------------------------------------------------------------
export async function disconnectGoogleDrive(): Promise<{ success: boolean; message: string }> {
  const secrets = loadStoredSecrets();
  if (secrets.googleDriveRefreshToken) {
    try {
      const oauth2Client = getOAuth2Client();
      await oauth2Client.revokeToken(secrets.googleDriveRefreshToken);
    } catch (e: any) {
      console.warn("[OAuth Disconnect] Token revocation warning:", e.message);
    }
  }

  // Clear secrets and reset config
  saveGoogleDriveSecrets({ refreshToken: "" });

  updateGoogleDriveConfig({
    connected: false,
    status: "NOT_CONFIGURED",
    email: undefined,
    mode: "NONE",
    rootFolderId: undefined,
    errorCode: undefined,
    safeErrorMessage: undefined,
    repairInstructions: undefined,
  });

  return { success: true, message: "Google Drive disconnected successfully." };
}

// ---------------------------------------------------------------------------
// 8. Access Token Resolver (OAuth Refresh Token or Service Account Fallback)
// ---------------------------------------------------------------------------
export async function getValidAccessToken(): Promise<{
  accessToken: string;
  email?: string;
  mode: "OAUTH" | "SERVICE_ACCOUNT";
}> {
  const secrets = loadStoredSecrets();
  const config = getGoogleDriveConfig();

  // Mode 1: Primary OAuth 2.0 with offline refresh token
  if (secrets.googleDriveRefreshToken) {
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: secrets.googleDriveRefreshToken,
      });

      const tokenResponse = await oauth2Client.getAccessToken();
      const accessToken = tokenResponse.token;

      if (accessToken) {
        return {
          accessToken,
          email: config.email,
          mode: "OAUTH",
        };
      }
    } catch (err: any) {
      console.error("[Token Resolver] OAuth refresh token failed:", err.message);
      if (
        err.message?.includes("invalid_grant") ||
        err.message?.includes("Token has been expired or revoked")
      ) {
        updateGoogleDriveConfig({
          status: "REAUTH_REQUIRED",
          errorCode: "INVALID_GRANT",
          safeErrorMessage: "انتهت صلاحية الربط أو تم إلغاؤها في حساب Google. يلزم إعادة الربط من قبل مسؤول النظام.",
          repairInstructions: "توجه إلى الإعدادات > تكامل Google Drive واضغط على 'إعادة الربط' لتحديث تفويض الشركة.",
        });
      }
      throw new Error("GOOGLE_DRIVE_REAUTH_REQUIRED");
    }
  }

  // Mode 2: Service Account Fallback (if configured in environment)
  const saBase64 =
    process.env.GDRIVE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (saBase64) {
    try {
      const serviceAccount = JSON.parse(Buffer.from(saBase64, "base64").toString("utf8"));
      const auth = new GoogleAuth({
        credentials: {
          client_email: serviceAccount.client_email,
          private_key: serviceAccount.private_key,
        },
        scopes: [STANDARD_DRIVE_SCOPE, "https://www.googleapis.com/auth/drive"],
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      if (token.token) {
        return {
          accessToken: token.token,
          email: serviceAccount.client_email,
          mode: "SERVICE_ACCOUNT",
        };
      }
    } catch (saErr: any) {
      console.warn("[Token Resolver] Service account fallback error:", saErr.message);
    }
  }

  throw new Error("GOOGLE_DRIVE_NOT_CONFIGURED");
}

// ---------------------------------------------------------------------------
// 9. Comprehensive Archive Connection Test (Section 16 Specification)
// ---------------------------------------------------------------------------
export async function testArchiveConnection(): Promise<DriveTestReport> {
  const steps: DriveDiagnosticStep[] = [
    { name: "OAuth Credentials Availability", status: "PENDING" },
    { name: "Token Refresh & Validity", status: "PENDING" },
    { name: "Drive API Reachability", status: "PENDING" },
    { name: "Root Archive Folder Check", status: "PENDING" },
    { name: "Archive Readability", status: "PENDING" },
  ];

  const tStart = Date.now();
  let tokenInfo: { accessToken: string; email?: string; mode: "OAUTH" | "SERVICE_ACCOUNT" } | null = null;

  // Step 1: Check credentials
  const t1 = Date.now();
  const secrets = loadStoredSecrets();
  const config = getGoogleDriveConfig();
  const hasOAuth = Boolean(secrets.googleDriveRefreshToken);
  const hasSA = Boolean(
    process.env.GDRIVE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  );

  if (!hasOAuth && !hasSA) {
    steps[0] = {
      name: "OAuth Credentials Availability",
      status: "FAIL",
      latency: Date.now() - t1,
      details: "لا توجد بيانات اعتماد مسجلة (OAuth Refresh Token أو Service Account غير مهيأ).",
    };
    return {
      success: false,
      status: "NOT_CONFIGURED",
      latency: Date.now() - tStart,
      steps,
      safeErrorMessage: "لم يتم ربط Google Drive بعد. يرجى تفعيل الربط من لوحة الإعدادات.",
      repairInstructions: "اضغط على زر 'ربط حساب Google Drive' للبدء في التفويض الأمني الموحد.",
    };
  }

  steps[0] = {
    name: "OAuth Credentials Availability",
    status: "PASS",
    latency: Date.now() - t1,
    details: hasOAuth ? `OAuth 2.0 Offline Token (${config.email || "Active"})` : "Service Account Vault",
  };

  // Step 2: Refresh access token
  const t2 = Date.now();
  try {
    tokenInfo = await getValidAccessToken();
    steps[1] = {
      name: "Token Refresh & Validity",
      status: "PASS",
      latency: Date.now() - t2,
      details: `تم إصدار Access Token صالح بنجاح عبر نمط ${tokenInfo.mode}`,
    };
  } catch (err: any) {
    steps[1] = {
      name: "Token Refresh & Validity",
      status: "FAIL",
      latency: Date.now() - t2,
      details: err.message,
    };
    const isReauth = err.message.includes("REAUTH");
    return {
      success: false,
      status: isReauth ? "REAUTH_REQUIRED" : "ERROR",
      latency: Date.now() - tStart,
      steps,
      safeErrorMessage: isReauth
        ? "انتهت صلاحية تفويض Google Drive للشركة. يلزم إعادة المصادقة."
        : "فشل استخراج رمز الوصول من Google.",
      repairInstructions: "اضغط على زر إعادة الربط لإعادة منح الصلاحية لخادم النظام.",
    };
  }

  // Step 3: Drive API Reachability & Quota
  const t3 = Date.now();
  let driveClient: any;
  let quota: any;
  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: tokenInfo.accessToken });
    driveClient = google.drive({ version: "v3", auth: oauth2 });

    const aboutRes = await driveClient.about.get({
      fields: "user,storageQuota",
    });

    quota = aboutRes.data.storageQuota;
    steps[2] = {
      name: "Drive API Reachability",
      status: "PASS",
      latency: Date.now() - t3,
      details: `Google Drive API v3 متصلة بنجاح (${aboutRes.data.user?.emailAddress || tokenInfo.email})`,
    };
  } catch (err: any) {
    steps[2] = {
      name: "Drive API Reachability",
      status: "FAIL",
      latency: Date.now() - t3,
      details: `تعذر الاتصال بـ Drive API: ${err.message}`,
    };
    return {
      success: false,
      status: "ERROR",
      latency: Date.now() - tStart,
      steps,
      safeErrorMessage: "تعذر الاتصال بخدمة Google Drive. تحقق من اتصال الشبكة وصلاحيات واجهة برمجة التطبيقات.",
    };
  }

  // Step 4: Root Archive Folder Check ("Emirates Falcon")
  const t4 = Date.now();
  let rootFolderId = config.rootFolderId || "";
  const rootFolderName = config.rootFolderName || "Emirates Falcon";
  try {
    rootFolderId = await ensureDriveFolder(driveClient, rootFolderName, "root");
    steps[3] = {
      name: "Root Archive Folder Check",
      status: "PASS",
      latency: Date.now() - t4,
      details: `المجلد الرئيسي موجود ومتاح: "${rootFolderName}" (${rootFolderId})`,
    };
  } catch (err: any) {
    steps[3] = {
      name: "Root Archive Folder Check",
      status: "FAIL",
      latency: Date.now() - t4,
      details: `تعذر التحقق من مجلد الأرشيف الرئيسي: ${err.message}`,
    };
    return {
      success: false,
      status: "ERROR",
      latency: Date.now() - tStart,
      steps,
      safeErrorMessage: `تعذر الوصول إلى مجلد الأرشيف الرئيسي (${rootFolderName}).`,
    };
  }

  // Step 5: Archive Readability (harmless list files within root folder, limit 5)
  const t5 = Date.now();
  try {
    const listRes = await driveClient.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      spaces: "drive",
      fields: "files(id, name, mimeType)",
      pageSize: 5,
    });

    const fileCount = listRes.data.files?.length || 0;
    steps[4] = {
      name: "Archive Readability",
      status: "PASS",
      latency: Date.now() - t5,
      details: `تم التحقق من قراءة محتويات المجلد بنجاح (المحتويات المفهرسة حالياً: ${fileCount} عنصر). تم التحقق بدون إنشاء ملفات تجريبية وهمية.`,
    };
  } catch (err: any) {
    steps[4] = {
      name: "Archive Readability",
      status: "FAIL",
      latency: Date.now() - t5,
      details: `فشل قراءة محتويات المجلد: ${err.message}`,
    };
    return {
      success: false,
      status: "ERROR",
      latency: Date.now() - tStart,
      steps,
      safeErrorMessage: "فشل التحقق من صلاحية قراءة الملفات في مجلد الأرشيف.",
    };
  }

  const totalLatency = Date.now() - tStart;

  // Persist updated verification state
  updateGoogleDriveConfig({
    connected: true,
    status: "CONNECTED",
    email: tokenInfo.email || config.email,
    mode: tokenInfo.mode,
    rootFolderId,
    lastCheckedAt: new Date().toISOString(),
    latency: totalLatency,
    errorCode: undefined,
    safeErrorMessage: undefined,
    repairInstructions: undefined,
  });

  return {
    success: true,
    status: "CONNECTED",
    latency: totalLatency,
    accountEmail: tokenInfo.email || config.email,
    rootFolderName,
    rootFolderId,
    storageQuota: quota
      ? {
          limit: quota.limit,
          usage: quota.usage,
          usageInDrive: quota.usageInDrive,
        }
      : undefined,
    steps,
  };
}
