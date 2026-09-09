import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';

// @ts-ignore
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

let firebaseInitialized = false;

export function initFirebaseAdmin() {
    if (firebaseInitialized) return true;
    try {
        const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        if (!base64) {
            console.warn("[Backup] FIREBASE_SERVICE_ACCOUNT_BASE64 missing.");
            return false;
        }
        const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        initializeApp({ credential: cert(serviceAccount) });
        firebaseInitialized = true;
        return true;
    } catch (e) {
        console.error("[Backup] Failed to init Firebase Admin:", e);
        return false;
    }
}

async function getDriveService() {
    const base64 = process.env.GDRIVE_SERVICE_ACCOUNT_BASE64;
    if (base64) {
        const credentials = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.file']
        });
        return google.drive({ version: 'v3', auth });
    }
    throw new Error("No Google Drive server-side credentials found.");
}

async function getOrCreateDriveFolder(drive: any, folderName: string, parentId?: string) {
    const q = parentId 
        ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
    const res = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, name)' });
    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id;
    }
    const fileMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
        fileMetadata.parents = [parentId];
    }
    const folder = await drive.files.create({
        resource: fileMetadata,
        fields: 'id',
    });
    return folder.data.id;
}

export async function runBackup(backupType: 'SCHEDULED' | 'PRE_RESTORE' | 'MANUAL', slotIdentifier?: string): Promise<any> {
    if (!initFirebaseAdmin()) {
        throw new Error("Firebase Admin not configured.");
    }
    
    const db = getFirestore();
    
    if (slotIdentifier) {
        const existing = await db.collection("system_backups")
            .where("scheduledSlot", "==", slotIdentifier)
            .where("status", "==", "SUCCESS")
            .limit(1).get();
        if (!existing.empty) {
            console.log(`[Backup] Slot ${slotIdentifier} already completed successfully.`);
            return;
        }
    }

    const backupId = uuidv4();
    const startTime = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(startTime);
    const p = (type: string) => parts.find(x => x.type === type)?.value;
    const year = p('year') || 'YYYY';
    const month = p('month') || 'MM';
    const timeStr = `${year}-${month}-${p('day') || 'DD'}_${p('hour') || 'HH'}-${p('minute') || 'mm'}-${p('second') || 'ss'}`;
    
    const fileName = backupType === 'PRE_RESTORE' 
        ? `firebase_PreRestore_${timeStr}.zip`
        : `firebase_Data_${timeStr}.zip`;

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, fileName);

    const recordRef = db.collection("system_backups").doc(backupId);
    await recordRef.set({
        backupId,
        backupType,
        scheduledSlot: slotIdentifier || null,
        createdAt: startTime.toISOString(),
        status: 'IN_PROGRESS',
        fileName,
        timezone: 'Asia/Dubai',
        applicationName: 'Emirates Falcon ERP',
        applicationVersion: '1.0.0',
        backupSchemaVersion: '1.0'
    });

    try {
        const collections = await db.listCollections();
        let totalDocs = 0;
        const backupData: Record<string, any> = {};
        
        for (const col of collections) {
            const colName = col.id;
            backupData[colName] = [];
            const snap = await col.get();
            snap.forEach((doc: any) => {
                backupData[colName].push({ id: doc.id, data: doc.data() });
                totalDocs++;
            });
        }

        const metadata = {
            backupId, backupType, createdAt: startTime.toISOString(),
            timezone: 'Asia/Dubai', applicationName: 'Emirates Falcon ERP',
            applicationVersion: '1.0.0', backupSchemaVersion: '1.0',
            collectionCount: collections.length, documentCount: totalDocs, fileName
        };

        const output = fs.createWriteStream(zipPath);
        const archiverModule = require('archiver');
        const archive = archiverModule('zip', { zlib: { level: 9 } });
        
        const zipPromise = new Promise((resolve, reject) => {
            output.on('close', () => resolve(true));
            archive.on('error', (err: any) => reject(err));
        });
        
        archive.pipe(output);
        archive.append(JSON.stringify(backupData, null, 2), { name: 'data.json' });
        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
        await archive.finalize();
        await zipPromise;

        const fileBuffer = fs.readFileSync(zipPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const checksum = hashSum.digest('hex');
        const fileSize = fs.statSync(zipPath).size;

        const drive = await getDriveService();
        const rootFolderId = await getOrCreateDriveFolder(drive, 'Emirates Falcon ERP');
        const backupsFolderId = await getOrCreateDriveFolder(drive, 'Firebase Backups', rootFolderId);
        
        let targetFolderId = backupsFolderId;
        if (backupType === 'PRE_RESTORE') {
            targetFolderId = await getOrCreateDriveFolder(drive, 'Pre-Restore', backupsFolderId);
        } else {
            const yearFolderId = await getOrCreateDriveFolder(drive, year, backupsFolderId);
            targetFolderId = await getOrCreateDriveFolder(drive, month, yearFolderId);
        }

        const res = await drive.files.create({
            requestBody: { name: fileName, parents: [targetFolderId] },
            media: { mimeType: 'application/zip', body: fs.createReadStream(zipPath) },
            fields: 'id'
        });

        const driveFileId = res.data.id;

        await recordRef.update({
            status: 'SUCCESS', completedAt: new Date().toISOString(),
            googleDriveFileId: driveFileId, checksum, fileSize,
            collectionCount: collections.length, documentCount: totalDocs
        });
        
        fs.unlinkSync(zipPath);
        
        await db.collection("auditLogs").add({
            action: 'BACKUP_CREATED', module: 'SYSTEM', actor: 'SYSTEM', actorId: 'SYSTEM',
            details: `Backup ${backupId} completed. Docs: ${totalDocs}.`,
            metadata: { backupId, backupType, size: fileSize },
            timestamp: new Date().toISOString()
        });

        return { backupId, driveFileId, status: 'SUCCESS' };

    } catch (error: any) {
        console.error("[Backup] Failed:", error);
        await recordRef.update({
            status: 'FAILED', error: error.message || 'Unknown error',
            completedAt: new Date().toISOString()
        });
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        throw error;
    }
}

export async function runRestore(backupId: string, adminUserId: string, adminEmail: string) {
    if (!initFirebaseAdmin()) throw new Error("Firebase Admin not configured.");
    const db = getFirestore();

    const recordSnap = await db.collection("system_backups").doc(backupId).get();
    if (!recordSnap.exists) throw new Error("Backup record not found.");
    const record = recordSnap.data()!;
    
    if (record.status !== 'SUCCESS') throw new Error("Cannot restore from a failed backup.");
    if (!record.googleDriveFileId) throw new Error("Google Drive File ID missing.");

    console.log(`[Restore] Initiating Pre-Restore Backup...`);
    const preRestore = await runBackup('PRE_RESTORE');
    if (!preRestore || preRestore.status !== 'SUCCESS') {
        throw new Error("Pre-Restore backup failed. Aborting restore.");
    }
    
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, `restore_${backupId}.zip`);
    const extractPath = path.join(tmpDir, `restore_${backupId}_extracted`);
    
    const auditData = {
        action: 'RESTORE_EXECUTED', module: 'SYSTEM', actor: adminEmail, actorId: adminUserId,
        details: `Restore from backup ${backupId}`,
        metadata: { backupId, preRestoreId: preRestore.backupId },
        timestamp: new Date().toISOString()
    };

    try {
        const drive = await getDriveService();
        const res = await drive.files.get({ fileId: record.googleDriveFileId, alt: 'media' }, { responseType: 'stream' });
        
        const dest = fs.createWriteStream(zipPath);
        await new Promise((resolve, reject) => {
            res.data.on('end', () => resolve(true)).on('error', (err: any) => reject(err)).pipe(dest);
        });

        const fileBuffer = fs.readFileSync(zipPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const checksum = hashSum.digest('hex');
        if (checksum !== record.checksum) throw new Error("Checksum mismatch.");

        const unzipper = require('unzipper');
        await new Promise((resolve, reject) => {
            fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: extractPath }))
              .on('close', resolve).on('error', reject);
        });

        const dataPath = path.join(extractPath, 'data.json');
        if (!fs.existsSync(dataPath)) throw new Error("data.json not found.");
        
        const backupData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const SYSTEM_COLLECTIONS_TO_SKIP = ['users', 'auditLogs', 'system_backups', 'userPermissionOverrides'];
        
        for (const [colName, docs] of Object.entries(backupData)) {
            if (SYSTEM_COLLECTIONS_TO_SKIP.includes(colName)) continue;
            const docsArray = docs as any[];
            
            const batches = [];
            let currentBatch = db.batch();
            let opCount = 0;
            
            for (const item of docsArray) {
                const docRef = db.collection(colName).doc(item.id);
                currentBatch.set(docRef, item.data);
                opCount++;
                if (opCount === 400) {
                    batches.push(currentBatch);
                    currentBatch = db.batch();
                    opCount = 0;
                }
            }
            if (opCount > 0) batches.push(currentBatch);
            for (const b of batches) await b.commit();
        }

        await db.collection("auditLogs").add({ ...auditData, status: 'SUCCESS' });
        
        fs.unlinkSync(zipPath);
        fs.rmSync(extractPath, { recursive: true, force: true });
        return { status: 'SUCCESS', preRestoreId: preRestore.backupId };

    } catch (e: any) {
        console.error("[Restore] Failed:", e);
        await db.collection("auditLogs").add({ ...auditData, status: 'FAILED', error: e.message });
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
        throw e;
    }
}

export function startScheduler() {
    cron.schedule('0 15 * * *', () => {
        const d = new Date();
        const ymd = d.toISOString().split('T')[0];
        runBackup('SCHEDULED', `${ymd}_15`).catch(console.error);
    }, { timezone: 'Asia/Dubai' });

    cron.schedule('0 21 * * *', () => {
        const d = new Date();
        const ymd = d.toISOString().split('T')[0];
        runBackup('SCHEDULED', `${ymd}_21`).catch(console.error);
    }, { timezone: 'Asia/Dubai' });
    
    console.log("[Backup] Scheduler started for 03:00 PM and 09:00 PM Asia/Dubai");
}
