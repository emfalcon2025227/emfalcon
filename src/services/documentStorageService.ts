import { doc, setDoc, collection, query, where, getDocs, limit, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  ElectronicArchiveItem, 
  DocumentCategory, 
  DocumentOptimizationProfile 
} from "../types";
import { optimizeDocument, getStandardDrivePath } from "./documentOptimizer";
import { uploadFileToGoogleDrive, updateExistingDriveFile, fetchDriveFileBlob, getAccessToken } from "./googleDriveService";

export interface DocumentUploadOptions {
  category: DocumentCategory;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  documentType?: string;
  parentDocumentId?: string;
  batchId?: string;
  sourceRegion?: { x: number; y: number; width: number; height: number };
  updateDriveFileId?: string;
  policy?: "SINGLE" | "MULTIPLE" | "REPLACEABLE" | "VERSIONED";
  description?: string;
  profile?: DocumentOptimizationProfile;
  tags?: string[];
  uploadedByUserId?: string;
  uploadedByName?: string;
}

export class DocumentStorageService {
  private static inFlightUploads = new Map<string, Promise<ElectronicArchiveItem>>();
  private static inMemoryDataCache = new Map<string, string>();

  static setCachedDataUrl(key: string, dataUrl: string) {
    if (!key || !dataUrl) return;
    this.inMemoryDataCache.set(key, dataUrl);
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(`ef_doc_cache_${key}`, dataUrl);
      }
    } catch {}
  }

  static getCachedDataUrl(key: string): string | null {
    if (!key) return null;
    if (this.inMemoryDataCache.has(key)) return this.inMemoryDataCache.get(key) || null;
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const fromSession = window.sessionStorage.getItem(`ef_doc_cache_${key}`);
        if (fromSession) {
          this.inMemoryDataCache.set(key, fromSession);
          return fromSession;
        }
      }
      if (typeof window !== "undefined" && window.localStorage) {
        const pending = window.localStorage.getItem("emirates_falcon_pending_sync");
        if (pending) {
          const list: any[] = JSON.parse(pending);
          const found = list.find((item) => item.id === key || item.fileHash === key || item.fileName === key);
          if (found && found.dataUrl) {
            this.inMemoryDataCache.set(key, found.dataUrl);
            return found.dataUrl;
          }
        }
      }
    } catch {}
    return null;
  }

  static async downloadArchiveItem(item: any): Promise<boolean> {
    try {
      const fileName = item.fileName || "document.pdf";
      let dataUrl = item.previewUrl;
      if (!dataUrl || (!dataUrl.startsWith("data:") && !dataUrl.startsWith("blob:") && !dataUrl.startsWith("http"))) {
        dataUrl =
          (item.id ? this.getCachedDataUrl(item.id) : null) ||
          (item.fileHash ? this.getCachedDataUrl(item.fileHash) : null) ||
          (item.fileName ? this.getCachedDataUrl(item.fileName) : null) ||
          undefined;
      }

      if (dataUrl) {
        const anchor = document.createElement("a");
        anchor.href = dataUrl;
        anchor.download = fileName;
        anchor.target = "_blank";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return true;
      }

      if (item.driveFileId && !item.driveFileId.startsWith("pending_sync_")) {
        const result = await fetchDriveFileBlob(item.driveFileId);
        if (result && result.url) {
          const anchor = document.createElement("a");
          anchor.href = result.url;
          anchor.download = fileName;
          anchor.target = "_blank";
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          setTimeout(() => URL.revokeObjectURL(result.url), 30000);
          return true;
        }
      }

      if (item.driveWebViewLink) {
        window.open(item.driveWebViewLink, "_blank", "noopener,noreferrer");
        return true;
      }

      alert(`لم يتم العثور على الملف الثنائي محلياً أو في Google Drive للوثيقة: ${fileName}`);
      return false;
    } catch (err) {
      console.error("Failed to download document:", err);
      alert("حدث خطأ أثناء تنزيل الملف.");
      return false;
    }
  }

  static async calculateHashFromDataUrl(dataUrl: string): Promise<string> {
    try {
      const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      const msgUint8 = new TextEncoder().encode(dataUrl);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  }

  private static logAudit(eventType: string, details: Record<string, any>) {
    console.log(`[ERP_DOCUMENT_AUDIT] ${eventType}:`, details);
  }

  static async uploadAndArchive(source: string | File, options: DocumentUploadOptions): Promise<ElectronicArchiveItem> {
    let file: File;
    if (typeof source === "string") {
      const res = await fetch(source);
      const blob = await res.blob();
      file = new File([blob], options.fileName, { type: options.mimeType });
    } else {
      file = source;
    }

    const optimizationProfile = options.profile || this.mapCategoryToProfile(options.category);
    const optimized = await optimizeDocument(file, optimizationProfile, "OPTIMIZED_ONLY");

    if (optimized.error) {
      throw new Error(`Optimization failed: ${optimized.error}. Upload aborted.`);
    }

    const fileHash = await this.calculateHashFromDataUrl(optimized.dataUrl);
    const operationKey = `${fileHash}_${options.entityType}_${options.entityId}_${options.category}`;

    if (this.inFlightUploads.has(operationKey)) {
      this.logAudit("DOCUMENT_UPLOAD_DEDUPLICATED", { reason: "concurrentUpload", operationKey });
      return await this.inFlightUploads.get(operationKey)!;
    }

    const uploadPromise = this.executeUploadPipeline({
      operationKey,
      fileHash,
      fileName: optimized.optimizedFileName,
      mimeType: optimized.optimizedMimeType,
      sizeBytes: optimized.optimizedSizeBytes,
      dataUrl: optimized.dataUrl,
      options,
    });

    this.inFlightUploads.set(operationKey, uploadPromise);
    try {
      return await uploadPromise;
    } finally {
      this.inFlightUploads.delete(operationKey);
    }
  }

  static async syncExistingArchiveItem(item: ElectronicArchiveItem, providedDataUrl?: string): Promise<ElectronicArchiveItem> {
    let dataUrl = providedDataUrl || item.previewUrl;
    if (!dataUrl || (!dataUrl.startsWith("data:") && !dataUrl.startsWith("blob:") && !dataUrl.startsWith("http"))) {
      dataUrl = this.getCachedDataUrl(item.id) || this.getCachedDataUrl(item.fileHash || "") || this.getCachedDataUrl(item.fileName) || undefined;
    }

    if (!dataUrl) {
      throw new Error("No binary data available for sync");
    }

    const fileHash = item.fileHash || await this.calculateHashFromDataUrl(dataUrl);
    const operationKey = `${fileHash}_${item.entityType}_${item.entityId}_${item.category}`;

    if (this.inFlightUploads.has(operationKey)) {
      this.logAudit("DOCUMENT_UPLOAD_DEDUPLICATED", { reason: "concurrentUpload", operationKey });
      return await this.inFlightUploads.get(operationKey)!;
    }

    const uploadPromise = this.executeUploadPipeline({
      operationKey,
      fileHash,
      fileName: item.fileName,
      mimeType: item.fileType || "application/octet-stream",
      sizeBytes: item.fileSize || 0,
      dataUrl,
      existingItem: item,
      options: {
        category: item.category as DocumentCategory,
        entityType: item.entityType || "",
        entityId: item.entityId || item.recordId,
        fileName: item.fileName,
        mimeType: item.fileType || "application/octet-stream",
        tags: item.tags,
        uploadedByUserId: item.uploadedByUserId,
        uploadedByName: item.uploadedByName,
      }
    });

    this.inFlightUploads.set(operationKey, uploadPromise);
    try {
      return await uploadPromise;
    } finally {
      this.inFlightUploads.delete(operationKey);
    }
  }

  private static async executeUploadPipeline(params: {
    operationKey: string;
    fileHash: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
    options: DocumentUploadOptions;
    existingItem?: ElectronicArchiveItem;
  }): Promise<ElectronicArchiveItem> {
    const { operationKey, fileHash, fileName, mimeType, sizeBytes, dataUrl, options } = params;
    
    // 1. Check existing Firestore archive for idempotency
    try {
      const archiveCol = collection(db, "archive");
      const q = query(archiveCol, where("fileHash", "==", fileHash), where("entityId", "==", options.entityId));
      const querySnap = await getDocs(q);
      
      const matchedDoc = querySnap.docs.find((d: any) => d.data().category === options.category);
      if (matchedDoc) {
        const existingDoc = matchedDoc.data() as ElectronicArchiveItem;
        
        // CASE A: Already fully synced
        if (existingDoc.syncStatus === "SYNCED" && existingDoc.driveFileId && !existingDoc.driveFileId.startsWith("pending_")) {
          this.logAudit("DOCUMENT_UPLOAD_DEDUPLICATED", { reason: "existingArchiveRecord", operationKey, driveFileId: existingDoc.driveFileId });
          return existingDoc;
        }

        // CASE B: Has valid driveFileId but Firestore says it's not SYNCED (Firestore failed previously)
        if (existingDoc.driveFileId && !existingDoc.driveFileId.startsWith("pending_")) {
          this.logAudit("DOCUMENT_UPLOAD_DEDUPLICATED", { reason: "existingDriveFileId", operationKey, driveFileId: existingDoc.driveFileId });
          const updatedDoc = { ...existingDoc, syncStatus: "SYNCED" as const, driveSyncedAt: new Date().toISOString() };
          await setDoc(matchedDoc.ref, updatedDoc);
          return updatedDoc;
        }

        // CASE C: Needs Drive upload (offline -> online transition)
        params.existingItem = existingDoc;
      }
    } catch (err) {
      console.warn("Deduplication query check encountered error:", err);
    }

    // Cache DataURL locally
    if (dataUrl) {
      const tempId = params.existingItem?.id || operationKey;
      this.setCachedDataUrl(tempId, dataUrl);
      this.setCachedDataUrl(fileHash, dataUrl);
    }

    const token = await getAccessToken();
    const drivePath = getStandardDrivePath(options.category, options.entityType, options.entityId);

    let driveFileId = options.updateDriveFileId || params.existingItem?.driveFileId;
    let driveWebViewLink = params.existingItem?.driveWebViewLink;
    let syncStatus: "SYNCED" | "PENDING_DRIVE_SYNC" | "REQUIRES_RETRY" | "FAILED" = "PENDING_DRIVE_SYNC";

    // 2. Upload or Update in Google Drive if we have a token
    if (token) {
      if (driveFileId && !driveFileId.startsWith("pending_")) {
        // If file content needs updating in place on Google Drive
        this.logAudit("DOCUMENT_UPDATE_STARTED", { driveFileId, fileName, operationKey });
        const updateResult = await updateExistingDriveFile({
          fileId: driveFileId,
          base64OrBlobUrl: dataUrl,
          mimeType,
          newFileName: fileName,
        });

        if (updateResult.success) {
          driveFileId = updateResult.fileId || driveFileId;
          driveWebViewLink = updateResult.webViewLink || driveWebViewLink;
          syncStatus = "SYNCED";
          this.logAudit("DOCUMENT_UPDATE_SUCCEEDED", { driveFileId, operationKey });
        } else {
          // If update failed
          syncStatus = "REQUIRES_RETRY"; 
          this.logAudit("DOCUMENT_UPDATE_FAILED", { error: updateResult.error, operationKey });
        }
      } else {
        this.logAudit("DOCUMENT_UPLOAD_STARTED", { fileName, operationKey });
        const driveResult = await uploadFileToGoogleDrive({
          fileName,
          mimeType,
          base64OrBlobUrl: dataUrl,
          drivePath,
          description: options.description || `Uploaded via Emirates Falcon ERP - ${options.category}`,
          skipDuplicateCheck: false, // Extra safety: verify folder content in Google Drive before creating
        });

        if (driveResult.success && driveResult.fileId) {
          driveFileId = driveResult.fileId;
          driveWebViewLink = driveResult.webViewLink;
          syncStatus = "SYNCED";
          this.logAudit("DOCUMENT_UPLOAD_SUCCEEDED", { driveFileId, operationKey });
        } else {
          syncStatus = "FAILED";
          this.logAudit("DOCUMENT_UPLOAD_FAILED", { error: driveResult.error, operationKey });
        }
      }
    } else {
      this.logAudit("DOCUMENT_UPLOAD_DEFERRED", { reason: "OFFLINE_OR_UNAUTHENTICATED", operationKey });
    }

    if (!driveFileId || driveFileId.startsWith("pending_")) {
      driveFileId = `pending_sync_${fileHash.substring(0, 12)}`;
    }

    // 3. Register or Update in Firestore
    const archiveRef = params.existingItem ? doc(db, "archive", params.existingItem.id) : doc(collection(db, "archive"));
    
    const archiveItem: ElectronicArchiveItem = {
      ...(params.existingItem || {}),
      id: archiveRef.id,
      fileName,
      category: options.category,
      documentType: options.documentType || (options.category as string),
      recordId: options.entityId, // legacy support
      recordTitle: `${options.entityType}: ${options.entityId}`,
      fileType: mimeType,
      fileSize: sizeBytes,
      fileHash,
      isPrivate: false,
      storagePath: drivePath + fileName,
      uploadedByUserId: options.uploadedByUserId || params.existingItem?.uploadedByUserId,
      uploadedByName: options.uploadedByName || params.existingItem?.uploadedByName,
      downloadToken: params.existingItem?.downloadToken || crypto.randomUUID().split("-")[0],
      previewUrl: "", // strictly no base64 in firestore
      tags: options.tags || params.existingItem?.tags || [],
      entityType: options.entityType,
      entityId: options.entityId,
      uploadDate: params.existingItem?.uploadDate || new Date().toISOString(),
      driveFileId,
      cloudFileId: driveFileId,
      driveWebViewLink: driveWebViewLink || "",
      driveSyncedAt: syncStatus === "SYNCED" ? new Date().toISOString() : undefined,
      parentDocumentId: options.parentDocumentId || params.existingItem?.parentDocumentId,
      batchId: options.batchId || params.existingItem?.batchId,
      sourceRegion: options.sourceRegion || params.existingItem?.sourceRegion,
      policy: options.policy || params.existingItem?.policy || "MULTIPLE",
      createdAt: params.existingItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus,
    };

    const cleanArchiveItem = Object.fromEntries(Object.entries(archiveItem).filter(([_, v]) => v !== undefined)) as any;

    try {
      await setDoc(archiveRef, cleanArchiveItem);
      this.logAudit("DOCUMENT_METADATA_REGISTERED", { archiveId: archiveItem.id, syncStatus, operationKey });

      if (syncStatus === "PENDING_DRIVE_SYNC") {
        this.queueForLocalRetry({ ...archiveItem, dataUrl });
      }
    } catch (firestoreError) {
      console.error("Firestore metadata registration failed:", firestoreError);
      const failedItem = { ...archiveItem, syncStatus: "REQUIRES_RETRY" as const };
      this.queueForLocalRetry({ ...failedItem, dataUrl });
      return failedItem;
    }

    return archiveItem;
  }

  private static queueForLocalRetry(item: any) {
    try {
      const stored = localStorage.getItem("emirates_falcon_pending_sync");
      let list: any[] = stored ? JSON.parse(stored) : [];
      // Remove any existing entry for this hash to avoid dupes in queue
      list = list.filter(i => i.fileHash !== item.fileHash);
      list.push(item);
      localStorage.setItem("emirates_falcon_pending_sync", JSON.stringify(list));
    } catch (err) {
      console.warn("Failed to queue pending sync:", err);
    }
  }

  static async retryPendingSyncs(): Promise<number> {
    try {
      const stored = localStorage.getItem("emirates_falcon_pending_sync");
      if (!stored) return 0;
      const list: any[] = JSON.parse(stored);
      if (list.length === 0) return 0;

      const remaining: any[] = [];
      let successCount = 0;

      for (const item of list) {
        try {
          // Re-enter the canonical pipeline
          await this.syncExistingArchiveItem(item, item.dataUrl);
          successCount++;
        } catch (err) {
          console.error(`Failed to retry sync for item ${item.id}:`, err);
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem("emirates_falcon_pending_sync", JSON.stringify(remaining));
      } else {
        localStorage.removeItem("emirates_falcon_pending_sync");
      }

      return successCount;
    } catch (error) {
      console.error("Error retrying pending syncs:", error);
      return 0;
    }
  }

  static async getPreviewBlob(driveFileId: string) {
    return await fetchDriveFileBlob(driveFileId);
  }

  private static mapCategoryToProfile(category: DocumentCategory): DocumentOptimizationProfile {
    switch (category) {
      case "CHEQUES":
      case "CHEQUE":
        return "CHEQUE";
      case "EMIRATES_ID":
      case "PASSPORT":
      case "VISA":
      case "TRADE_LICENSE":
      case "TITLE_DEED":
        return "LEGAL_DOCUMENT";
      case "MAINTENANCE":
        return "MAINTENANCE_INVOICE";
      default:
        return "STANDARD";
    }
  }
}
