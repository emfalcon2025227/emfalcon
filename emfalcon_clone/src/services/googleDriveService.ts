import { authenticatedFetch } from "../utils/apiClient";

let inMemoryAccessToken: string | null = null;
let tokenExpiresAt = 0;
let inMemoryEmail: string | null = null;
let inMemoryMode: string | null = null;

export interface CentralDriveStatus {
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

export const getCentralDriveStatus = async (): Promise<CentralDriveStatus> => {
  try {
    const res = await authenticatedFetch("/api/integrations/google-drive/status");
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn("Could not query central drive status:", err);
  }
  return {
    connected: false,
    status: "OFFLINE",
    safeErrorMessage: "تعذر الاتصال بخادم النظام.",
  };
};

export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  getCentralDriveStatus().then((status) => {
    if (status.connected && status.status === "CONNECTED") {
      getAccessToken().then((token) => {
        if (token && onAuthSuccess) {
          onAuthSuccess({ email: status.email || "Company Storage" }, token);
        } else if (onAuthFailure) {
          onAuthFailure();
        }
      });
    } else if (onAuthFailure) {
      onAuthFailure();
    }
  }).catch(() => {
    if (onAuthFailure) onAuthFailure();
  });

  return () => {};
};

export const googleQuickDirectConnect = (): { user: any; accessToken: string } => {
  throw new Error("Direct connect mockup removed. Use central Google Drive integration.");
};

export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  const token = await getAccessToken(true);
  if (token) {
    return {
      user: { email: inMemoryEmail || "Company Storage" },
      accessToken: token,
    };
  }
  return null;
};

export const getAccessToken = async (forceRefresh = false): Promise<string | null> => {
  const now = Date.now();
  if (!forceRefresh && inMemoryAccessToken && tokenExpiresAt > now + 60 * 1000) {
    return inMemoryAccessToken;
  }

  try {
    const res = await authenticatedFetch("/api/connections/drive-token");
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.accessToken) {
        inMemoryAccessToken = data.accessToken;
        // Access tokens typically expire in 3600 seconds
        tokenExpiresAt = now + 50 * 60 * 1000;
        inMemoryEmail = data.serviceAccountEmail || data.email || null;
        inMemoryMode = data.mode || null;
        return data.accessToken;
      }
    }
  } catch (err) {
    console.warn("Failed to retrieve central drive access token:", err);
  }
  return null;
};

export const getGoogleUser = (): any | null => {
  return inMemoryEmail ? { email: inMemoryEmail } : null;
};

export const googleLogout = async () => {
  inMemoryAccessToken = null;
  tokenExpiresAt = 0;
  inMemoryEmail = null;
  inMemoryMode = null;
};

export interface DriveDiagnosticStep {
  name: string;
  status: "PASS" | "FAIL" | "PENDING";
  latency?: number;
  details?: string;
}

export interface DriveDiagnosticReport {
  status: "NOT_CONFIGURED" | "CONNECTED" | "REAL_UPLOAD_VERIFIED" | "ERROR" | "REAUTH_REQUIRED";
  lastCheckedAt?: string;
  latency?: number;
  errorCode?: string;
  safeErrorMessage?: string;
  repairInstructions?: string;
  steps: DriveDiagnosticStep[];
  fileId?: string;
  folderId?: string;
  filePath?: string;
  uploadTime?: string;
  accountEmail?: string;
  rootFolderName?: string;
  rootFolderId?: string;
}

export const runComprehensiveGoogleDriveDiagnostics = async (): Promise<DriveDiagnosticReport> => {
  try {
    const res = await authenticatedFetch("/api/integrations/google-drive/test", {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        status: data.success ? "REAL_UPLOAD_VERIFIED" : (data.status || "ERROR"),
      };
    }
    const errData = await res.json().catch(() => ({}));
    return {
      status: "ERROR",
      safeErrorMessage: errData.error || errData.safeErrorMessage || "فشل تشخيص الاتصال بالخادم",
      steps: [
        { name: "Server Diagnostic", status: "FAIL", details: errData.error || "Server response not OK" }
      ]
    };
  } catch (e: any) {
    return {
      status: "ERROR",
      safeErrorMessage: e.message || "Network error while running diagnostics",
      steps: [
        { name: "Network Connection", status: "FAIL", details: e.message }
      ]
    };
  }
};


export const getOrCreateDriveFolder = async (
  folderName: string,
  accessToken: string,
  parentId: string = "root"
): Promise<string> => {
  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    )}&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
    const createUrl = "https://www.googleapis.com/drive/v3/files";
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    });
    const createData = await createRes.json();
    return createData.id;
  } catch (err) {
    return "root";
  }
};

export const getOrCreateDrivePath = async (
  drivePath: string,
  accessToken: string
): Promise<string> => {
  const parts = drivePath.split("/").filter(Boolean);
  let currentId = "root";
  for (const part of parts) {
    currentId = await getOrCreateDriveFolder(part, accessToken, currentId);
  }
  return currentId;
};

export const findExistingDriveFile = async (
  fileName: string,
  accessToken: string,
  parentId: string = "root"
): Promise<{ id: string; webViewLink?: string; webContentLink?: string } | null> => {
  try {
    const escapedName = fileName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const query = `name = '${escapedName}' and '${parentId}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink,webContentLink)&spaces=drive`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return {
          id: data.files[0].id,
          webViewLink: data.files[0].webViewLink,
          webContentLink: data.files[0].webContentLink,
        };
      }
    }
  } catch (e) {
    console.warn("Error checking for existing Drive file:", e);
  }
  return null;
};

export const uploadFileToGoogleDrive = async (params: {
  fileName: string;
  mimeType: string;
  base64OrBlobUrl: string;
  folderId?: string;
  folderName?: string;
  drivePath?: string;
  skipDuplicateCheck?: boolean;
  description?: string;
}): Promise<{
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  error?: string;
  isExisting?: boolean;
}> => {
  try {
    const token = await getAccessToken();
    if (!token) return { success: false, error: "NO_AUTH" };

    let folderId = params.folderId || "root";
    if (!params.folderId) {
      if (params.drivePath) folderId = await getOrCreateDrivePath(params.drivePath, token);
      else if (params.folderName) folderId = await getOrCreateDriveFolder(params.folderName, token);
    }

    if (!params.skipDuplicateCheck) {
      const existing = await findExistingDriveFile(params.fileName, token, folderId);
      if (existing) {
        return {
          success: true,
          fileId: existing.id,
          webViewLink: existing.webViewLink || `https://drive.google.com/file/d/${existing.id}/view`,
          webContentLink: existing.webContentLink,
          isExisting: true,
        };
      }
    }

    let fileBlob: Blob;
    if (params.base64OrBlobUrl.startsWith("data:")) {
      const arr = params.base64OrBlobUrl.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] || params.mimeType;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) { u8arr[n] = bstr.charCodeAt(n); }
      fileBlob = new Blob([u8arr], { type: mime });
    } else if (params.base64OrBlobUrl.startsWith("blob:")) {
      const response = await fetch(params.base64OrBlobUrl);
      fileBlob = await response.blob();
    } else {
      fileBlob = new Blob([params.base64OrBlobUrl], { type: params.mimeType });
    }

    const metadata: any = { name: params.fileName, mimeType: params.mimeType, description: params.description };
    if (folderId && folderId !== "root") metadata.parents = [folderId];

    const boundary = "-------" + crypto.randomUUID().split("-")[0] + Date.now().toString(36);
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelimiter = "\r\n--" + boundary + "--";
    const metadataPart = new Blob([
      delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + delimiter + "Content-Type: " + (params.mimeType || "application/octet-stream") + "\r\n\r\n"
    ], { type: "text/plain" });
    const closePart = new Blob([closeDelimiter], { type: "text/plain" });
    const multipartBlob = new Blob([metadataPart, fileBlob, closePart]);

    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink";
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBlob,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Upload failed with status ${res.status}`);
    }
    const resData = await res.json();
    return {
      success: true,
      fileId: resData.id,
      webViewLink: resData.webViewLink || `https://drive.google.com/file/d/${resData.id}/view`,
      webContentLink: resData.webContentLink,
    };
  } catch (err: any) {
    // Fallback: try server-side upload endpoint
    try {
      let base64 = params.base64OrBlobUrl;
      if (base64.startsWith("blob:")) {
        const resp = await fetch(base64);
        const b = await resp.blob();
        base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(b);
        });
      }
      const serverRes = await authenticatedFetch("/api/integrations/google-drive/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: params.fileName,
          mimeType: params.mimeType,
          fileBase64: base64,
          drivePath: params.drivePath,
          folderName: params.folderName,
          description: params.description,
        }),
      });
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData.success) {
          return serverData;
        }
      }
    } catch (serverErr) {
      console.warn("Server upload fallback failed:", serverErr);
    }
    return { success: false, error: err.message || "Failed to upload to Google Drive" };
  }
};

export const updateExistingDriveFile = async (params: {
  fileId: string;
  base64OrBlobUrl: string;
  mimeType?: string;
  newFileName?: string;
}): Promise<{
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  error?: string;
}> => {
  try {
    const token = await getAccessToken();
    if (!token) return { success: false, error: "NO_AUTH" };
    
    let fileBlob: Blob;
    const effectiveMime = params.mimeType || "image/jpeg";
    if (params.base64OrBlobUrl.startsWith("data:")) {
      const arr = params.base64OrBlobUrl.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] || effectiveMime;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) { u8arr[n] = bstr.charCodeAt(n); }
      fileBlob = new Blob([u8arr], { type: mime });
    } else if (params.base64OrBlobUrl.startsWith("blob:")) {
      const response = await fetch(params.base64OrBlobUrl);
      fileBlob = await response.blob();
    } else {
      fileBlob = new Blob([params.base64OrBlobUrl], { type: effectiveMime });
    }

    const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${params.fileId}?uploadType=media&fields=id,name,webViewLink,webContentLink`;
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": effectiveMime },
      body: fileBlob,
    });
    if (!res.ok) throw new Error(`Failed to update Drive file content (${res.status})`);
    const resData = await res.json();

    if (params.newFileName) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${params.fileId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: params.newFileName }),
      });
    }

    return {
      success: true,
      fileId: resData.id || params.fileId,
      webViewLink: resData.webViewLink || `https://drive.google.com/file/d/${params.fileId}/view`,
      webContentLink: resData.webContentLink,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update existing Drive file" };
  }
};

export const fetchDriveFileBlob = async (fileId: string): Promise<{ blob: Blob; url: string; mimeType: string } | null> => {
  if (!fileId || fileId.startsWith("pending_")) return null;

  // 1. Try server proxy endpoint (authenticated ERP user, zero Google credentials required on client)
  try {
    const proxyRes = await authenticatedFetch(`/api/integrations/google-drive/file/${fileId}`);
    if (proxyRes.ok) {
      const mimeType = proxyRes.headers.get("content-type") || "application/octet-stream";
      const blob = await proxyRes.blob();
      const typedBlob = new Blob([blob], { type: mimeType });
      return { blob: typedBlob, url: URL.createObjectURL(typedBlob), mimeType };
    }
  } catch (proxyErr) {
    console.warn("Proxy drive stream failed, attempting direct token fetch fallback:", proxyErr);
  }

  // 2. Direct client fallback if accessToken is active
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    let mimeType = "application/octet-stream";
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.mimeType) mimeType = meta.mimeType;
    }
    const mediaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!mediaRes.ok) return null;
    const blob = await mediaRes.blob();
    const typedBlob = new Blob([blob], { type: mimeType });
    return { blob: typedBlob, url: URL.createObjectURL(typedBlob), mimeType };
  } catch (error) {
    return null;
  }
};

