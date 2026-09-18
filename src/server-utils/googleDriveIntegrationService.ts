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

function getActiveEncryptionKey(): Buffer | null {
  if (process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.trim() !== "") {
    return crypto.createHash("sha256").update(process.env.ENCRYPTION_SECRET).digest();
  }
  return null;
}

function getLegacyEncryptionKeys(): Buffer[] {
  const keys: Buffer[] = [];
  if (process.env.FIREBASE_PROJECT_ID) {
    keys.push(crypto.createHash("sha256").update(process.env.FIREBASE_PROJECT_ID).digest());
  }
  keys.push(crypto.createHash("sha256").update("emirates-falcon-secure-gdrive-vault-2026").digest());
  return keys;
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const key = getActiveEncryptionKey();
  if (!key) {
    console.error("[Vault] ENCRYPTION_SECRET is missing. Cannot encrypt safely.");
    throw new Error("ENCRYPTION_SECRET is not configured. Cannot securely encrypt data.");
  }
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    return `enc_gcm_v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (err: any) {
    console.error("[Vault] Encryption error:", err.message);
    throw new Error("Encryption failed, halting to prevent plaintext exposure.");
  }
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc_gcm_v1:")) {
    // Legacy / unencrypted fallback
    return cipherText;
  }
  
  const keysToTry: Buffer[] = [];
  const active = getActiveEncryptionKey();
  if (active) keysToTry.push(active);
  keysToTry.push(...getLegacyEncryptionKeys());

  for (const key of keysToTry) {
    try {
      const parts = cipherText.split(":");
      if (parts.length !== 4) continue;
      const iv = Buffer.from(parts[1], "hex");
      const authTag = Buffer.from(parts[2], "hex");
      const encrypted = parts[3];
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (err: any) {
      // Ignore and try next key
    }
  }
  console.error("[Vault] Decryption failed for all available keys.");
  return "";
}

// ---------------------------------------------------------------------------
// 2. Secret & Config Persistence
// ---------------------------------------------------------------------------
interface StoredSecrets {
  smtpAppPassword?: string; // legacy plaintext
  whatsappAccessToken?: string; // legacy plaintext
  smtpAppPasswordEncrypted?: string;
  whatsappAccessTokenEncrypted?: string;
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
  let needsMigration = false;
  
  try {
    if (fs.existsSync(SECRETS_FILE_PATH)) {
      fileData = JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, "utf8"));
    }
  } catch (e: any) {
    console.warn("[Vault] Failed to read .secrets.json");
  }

  // Check if ENCRYPTION_SECRET is active
  const hasEncryptionKey = process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.trim() !== "";

  // Perform migration if we have plaintext fields and a valid key
  if (hasEncryptionKey && (fileData.smtpAppPassword || fileData.whatsappAccessToken)) {
    try {
      if (fileData.smtpAppPassword) {
        fileData.smtpAppPasswordEncrypted = encryptSecret(fileData.smtpAppPassword);
        delete fileData.smtpAppPassword;
        needsMigration = true;
      }
      if (fileData.whatsappAccessToken) {
        fileData.whatsappAccessTokenEncrypted = encryptSecret(fileData.whatsappAccessToken);
        delete fileData.whatsappAccessToken;
        needsMigration = true;
      }
      if (needsMigration) {
        fs.writeFileSync(SECRETS_FILE_PATH, JSON.stringify(fileData, null, 2), "utf8");
      }
    } catch (migErr) {
      console.warn("[Vault] Migration of legacy secrets failed. Key missing or invalid.");
    }
  }

  const refreshToken =
    decryptSecret(fileData.googleDriveRefreshTokenEncrypted || "") ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    "";

  const clientSecret =
    decryptSecret(fileData.googleClientSecretEncrypted || "") ||
    process.env.GOOGLE_CLIENT_SECRET ||
    "";

  const smtpAppPassword =
    decryptSecret(fileData.smtpAppPasswordEncrypted || "") ||
    fileData.smtpAppPassword || // legacy fallback in memory if key missing
    process.env.GMAIL_APP_PASSWORD ||
    "";

  const whatsappAccessToken =
    decryptSecret(fileData.whatsappAccessTokenEncrypted || "") ||
    fileData.whatsappAccessToken || // legacy fallback in memory if key missing
    process.env.WHATSAPP_ACCESS_TOKEN ||
    "";

  return {
    smtpAppPassword,
    whatsappAccessToken,
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
// 4. OAuth2 Client Factory & Canonical Redirect
// ---------------------------------------------------------------------------
export const CANONICAL_PUBLIC_APP_URL = "https://emfalcon.ai.studio";
export const FIXED_OAUTH_CALLBACK_PATH = "/api/integrations/google-drive/callback";
export const CANONICAL_OAUTH_REDIRECT_URI = `${CANONICAL_PUBLIC_APP_URL}${FIXED_OAUTH_CALLBACK_PATH}`;

export function getCanonicalRedirectUri(): string {
  const envVal = process.env.GOOGLE_REDIRECT_URI?.trim();
  return envVal || CANONICAL_OAUTH_REDIRECT_URI;
}

export function getOAuth2Client(customRedirectUri?: string) {
  const secrets = loadStoredSecrets();
  const config = getGoogleDriveConfig();

  const clientId = process.env.GOOGLE_CLIENT_ID || config.clientId || DEFAULT_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || secrets.googleClientSecret || "";
  const redirectUri = customRedirectUri || getCanonicalRedirectUri();

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ---------------------------------------------------------------------------
// 5. Connect Flow: Generate Auth URL
// ---------------------------------------------------------------------------
export function generateConnectAuthUrl(params: {
  adminUid: string;
  origin?: string;
  customRedirectUri?: string;
}): { authUrl: string; state: string; redirectUri: string } {
  // Always enforce trusted canonical redirect URI, preventing client host header poisoning
  const redirectUri = getCanonicalRedirectUri();

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
  // 1. State exists & valid
  if (!state || typeof state !== "string") {
    return {
      success: false,
      error: "INVALID_STATE",
    };
  }

  const stateRecord = pendingOAuthStates.get(state);
  if (!stateRecord) {
    return {
      success: false,
      error: "STATE_NOT_FOUND_OR_REUSED",
    };
  }

  // 2. Consume state immediately (One-time use / prevent replay attacks)
  pendingOAuthStates.delete(state);

  // 3. State expiration check (Max 10 minutes lifetime)
  const MAX_STATE_LIFETIME_MS = 10 * 60 * 1000;
  if (Date.now() - stateRecord.createdAt > MAX_STATE_LIFETIME_MS) {
    return {
      success: false,
      error: "STATE_EXPIRED",
    };
  }

  // 4. Validate redirect configuration matches canonical URI
  const canonicalRedirect = getCanonicalRedirectUri();
  if (stateRecord.redirectUri !== canonicalRedirect) {
    return {
      success: false,
      error: "REDIRECT_URI_MISMATCH",
    };
  }

  const oauth2Client = getOAuth2Client(stateRecord.redirectUri);

  try {
    // 5. Exchange authorization code
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

    // 6. Verify refresh token is returned
    const secrets = loadStoredSecrets();
    const effectiveRefreshToken = tokens.refresh_token || secrets.googleDriveRefreshToken;

    if (!effectiveRefreshToken) {
      return {
        success: false,
        error: "NO_REFRESH_TOKEN",
      };
    }

    // 7. Verify existing root folder "Emirates Falcon" in Drive (Strictly No Auto-Creation)
    let rootFolderId = "";
    try {
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      rootFolderId = await ensureDriveFolder(drive, "Emirates Falcon", "root");
    } catch (err: any) {
      console.error("[OAuth Callback] Root folder check failed:", err.message);
      return {
        success: false,
        error: "ROOT_FOLDER_NOT_FOUND",
      };
    }

    if (!rootFolderId) {
      return {
        success: false,
        error: "ROOT_FOLDER_NOT_FOUND",
      };
    }

    // 8. Encrypt & store refresh token server-side only upon full verification
    saveGoogleDriveSecrets({ refreshToken: effectiveRefreshToken });

    // 9. Update connection status to CONNECTED
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

  throw new Error(`ROOT_FOLDER_NOT_FOUND: The folder "${folderName}" was not found in Google Drive.`);
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
  // [LEGACY COMPATIBILITY ONLY] As per strict rules, Central OAuth must be the only active production path.
  // We do NOT use SA as an active fallback when OAuth fails or is missing.
  // Throw error requiring OAuth configuration.
  
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

  if (!hasOAuth) {
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
    // Only search, DO NOT CREATE
    const query = `name = '${rootFolderName}' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await driveClient.files.list({
      q: query,
      spaces: "drive",
      fields: "files(id, name)",
    });

    if (res.data.files && res.data.files.length > 0) {
      rootFolderId = res.data.files[0].id!;
      steps[3] = {
        name: "Root Archive Folder Check",
        status: "PASS",
        latency: Date.now() - t4,
        details: `المجلد الرئيسي موجود ومتاح: "${rootFolderName}" (${rootFolderId})`,
      };
    } else {
      steps[3] = {
        name: "Root Archive Folder Check",
        status: "FAIL",
        latency: Date.now() - t4,
        details: `ROOT_FOLDER_NOT_FOUND`,
      };
      return {
        success: false,
        status: "ERROR",
        latency: Date.now() - tStart,
        steps,
        safeErrorMessage: `مجلد الأرشيف الرئيسي (${rootFolderName}) غير موجود.`,
        repairInstructions: "يرجى إنشاء المجلد (Emirates Falcon) يدوياً في حساب Google Drive المركزي.",
      };
    }
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
  let fileList: any[] = [];
  try {
    const listRes = await driveClient.files.list({
      q: `'${rootFolderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      spaces: "drive",
      fields: "files(id, name, mimeType)",
      pageSize: 5,
    });

    fileList = listRes.data.files || [];
    
    // Test getting file metadata if files exist (Real Preview test)
    if (fileList.length > 0) {
      const testFileId = fileList[0].id;
      await driveClient.files.get({
        fileId: testFileId,
        fields: "id, name, mimeType, size",
      });
      
      steps[4] = {
        name: "Archive Readability",
        status: "PASS",
        latency: Date.now() - t5,
        details: `تم التحقق من قراءة محتويات المجلد واسترداد بيانات ملف موجود بنجاح (المحتويات المفهرسة: ${fileList.length} عنصر). لا يتم إنشاء ملفات وهمية.`,
      };
    } else {
      steps[4] = {
        name: "Archive Readability",
        status: "PASS",
        latency: Date.now() - t5,
        details: `تم التحقق من مجلد الأرشيف (فارغ حالياً، لا يوجد ملفات لاختبار التنزيل/المعاينة). لا يتم إنشاء ملفات وهمية.`,
      };
    }
  } catch (err: any) {
    steps[4] = {
      name: "Archive Readability",
      status: "FAIL",
      latency: Date.now() - t5,
      details: `فشل قراءة محتويات المجلد أو استرداد بيانات الملف: ${err.message}`,
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

// ---------------------------------------------------------------------------
// 10. File Streaming & Proxy Download
// ---------------------------------------------------------------------------
export async function getDriveFileStream(fileId: string): Promise<{
  stream: NodeJS.ReadableStream;
  mimeType: string;
  name: string;
  size?: number;
}> {
  const tokenInfo = await getValidAccessToken();
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: tokenInfo.accessToken });
  const drive = google.drive({ version: "v3", auth: oauth2 });

  const metaRes = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size",
  });

  const fileMeta = metaRes.data;
  const mimeType = fileMeta.mimeType || "application/octet-stream";
  const name = fileMeta.name || `file_${fileId}`;
  const size = fileMeta.size ? parseInt(String(fileMeta.size), 10) : undefined;

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );

  return {
    stream: res.data as any,
    mimeType,
    name,
    size,
  };
}

// Helper to ensure nested folder path in Drive
export async function ensureDrivePath(
  drive: any,
  drivePath: string,
  rootParentId: string = "root"
): Promise<string> {
  const parts = drivePath.split("/").filter(Boolean);
  let currentId = rootParentId;
  for (const part of parts) {
    currentId = await ensureDriveFolder(drive, part, currentId);
  }
  return currentId;
}

// ---------------------------------------------------------------------------
// 11. Server-Side File Upload to Central Drive
// ---------------------------------------------------------------------------
export async function uploadFileToDriveServerSide(params: {
  fileName: string;
  mimeType: string;
  contentBuffer: Buffer;
  drivePath?: string;
  folderName?: string;
  parentFolderId?: string;
  description?: string;
}): Promise<{
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  error?: string;
}> {
  try {
    const tokenInfo = await getValidAccessToken();
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: tokenInfo.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2 });

    const config = getGoogleDriveConfig();
    const rootId = config.rootFolderId || (await ensureDriveFolder(drive, "Emirates Falcon", "root"));

    let targetFolderId = params.parentFolderId || rootId;
    if (params.drivePath) {
      targetFolderId = await ensureDrivePath(drive, params.drivePath, rootId);
    } else if (params.folderName) {
      targetFolderId = await ensureDriveFolder(drive, params.folderName, rootId);
    }

    const { Readable } = await import("stream");
    const bufferStream = new Readable();
    bufferStream.push(params.contentBuffer);
    bufferStream.push(null);

    const res = await drive.files.create({
      requestBody: {
        name: params.fileName,
        mimeType: params.mimeType,
        parents: [targetFolderId],
        description: params.description,
      },
      media: {
        mimeType: params.mimeType,
        body: bufferStream,
      },
      fields: "id, name, webViewLink, webContentLink",
    });

    return {
      success: true,
      fileId: res.data.id || undefined,
      webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
      webContentLink: res.data.webContentLink || undefined,
    };
  } catch (err: any) {
    console.error("[Drive Server Upload Error]:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}
