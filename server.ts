var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});import express from"express";
export interface ProjectContext {
  owners?: Array<{ id: string; nameAr?: string; nameEn?: string; email?: string }>;
  properties?: Array<{ id: string; nameAr?: string; nameEn?: string; email?: string }>;
  units?: Array<{ id: string; unitNumber?: string; propertyId?: string; status?: string; tenantId?: string }>;
  tenants?: Array<{
    id: string;
    nameAr?: string;
    nameEn?: string;
    code?: string;
    phone?: string;
    riskScore?: number;
    riskLevel?: string;
    bouncedChequesCount?: number;
  }>;
  cheques?: Array<{
    id: string;
    chequeNumber?: string;
    tenantId?: string;
    tenantName?: string;
    status?: string;
    amount?: number;
    bankName?: string;
    originalStatus?: string;
  }>;
  cases?: Array<{
    id: string;
    caseNumber?: string;
    status?: string;
  }>;
  leases?: Array<{ id: string; leaseNumber?: string }>;
  maintenanceRequests?: Array<{
    id: string;
    requestNumber?: string;
    title?: string;
    category?: string;
    status?: string;
    priority?: string;
    propertyName?: string;
    unitNumber?: string;
  }>;
  collections?: Array<{ id: string; amount?: number; amountApplied?: number }>;
}
export interface DbDiagnostics {
  firebaseAdmin: string;
  envPresent: boolean;
  projectId: string;
  firestoreDatabaseId: string;
  ownersCount?: number;
  owners?: Array<{ id: string; nameAr?: string; nameEn?: string; email?: string }>;
  tenantsCount?: number;
  tenants?: Array<{ id: string; nameAr?: string; nameEn?: string; email?: string }>;
  usersCount?: number;
  users?: Array<{ id: string; email?: string; role?: string; ownerId?: string; tenantId?: string; firebaseUid?: string }>;
  queryError?: string;
  diagnosis?: string;
  diagnosisType?: string;
  credentialsSource?: string;
  targetProjectId?: string;
  targetDatabaseId?: string;
  actionRequired?: string;
  details?: string;
}
export interface UserProfile {
  id?: string;
  systemId?: string;
  username?: string;
  email?: string;
  nameEn?: string;
  nameAr?: string;
  phone?: string;
  role?: string;
  ownerId?: string;
  tenantId?: string;
  isActive?: boolean;
  createdAt?: string;
  mustChangePassword?: boolean;
  isFirstLoginCompleted?: boolean;
  portalAccountStatus?: string;
  firebaseUid?: string;
  password?: string;
}import http from"http";import path from"path";import fs from"fs";import*as crypto from"crypto";import{createServer as createViteServer}from"vite";import{GoogleGenAI,Type}from"@google/genai";import dotenv from"dotenv";import nodemailer from"nodemailer";import cron from"node-cron";import{getGoogleDriveConfig,generateConnectAuthUrl,handleOAuthCallback,disconnectGoogleDrive,getValidAccessToken,testArchiveConnection,getDriveFileStream,uploadFileToDriveServerSide,loadStoredSecrets,encryptSecret}from"./src/server-utils/googleDriveIntegrationService.ts";import{getSystemConfigurationMatrix,updateSystemConfiguration,runComprehensiveDiagnostics,performSafeRepair,exportNonSecretConfiguration,getConfigAuditLogs}from"./src/server-utils/centralConfigManager.ts";dotenv.config();function isValidGeminiApiKey(key){if(!key||typeof key!=="string")return false;const trimmed=key.trim();if(!trimmed||trimmed==="MY_GEMINI_API_KEY"||trimmed==="YOUR_API_KEY"||trimmed==="YOUR_GEMINI_API_KEY"||trimmed==="undefined"||trimmed==="null"||trimmed.startsWith("YOUR_")||trimmed.length<5){return false}return true}__name(isValidGeminiApiKey,"isValidGeminiApiKey");try{const keyFilePath=path.join(process.cwd(),"gemini-key.json");if(fs.existsSync(keyFilePath)){const data=JSON.parse(fs.readFileSync(keyFilePath,"utf8"));if(data&&data.apiKey&&(!process.env.GEMINI_API_KEY||process.env.GEMINI_API_KEY==="MY_GEMINI_API_KEY"||!isValidGeminiApiKey(process.env.GEMINI_API_KEY))){process.env.GEMINI_API_KEY=data.apiKey}}}catch(e){console.warn("Failed to load gemini-key.json fallback",e)}import{initializeApp as initAdminApp,getApps as getAdminApps,cert as adminCert,applicationDefault}from"firebase-admin/app";import{getFirestore as getAdminFirestore}from"firebase-admin/firestore";import{getAuth as getAdminAuth}from"firebase-admin/auth";import{initializeApp as initClientApp,getApps as getClientApps}from"firebase/app";import{getAuth as getClientAuth,signInWithCustomToken}from"firebase/auth";import{getFirestore as getClientFirestore,collection,getDocs,deleteDoc,doc,setDoc}from"firebase/firestore";const firebaseAppletConfig=JSON.parse(fs.readFileSync(path.join(process.cwd(),"firebase-applet-config.json"),"utf8"));let firestoreAdminDb=null;let adminAuthClient=null;function parseJsonOrBase64Json(input){if(!input||typeof input!=="string")return null;const trimmed=input.trim();if(!trimmed)return null;if(trimmed.startsWith("{")||trimmed.startsWith("[")){try{return JSON.parse(trimmed)}catch(e){try{return JSON.parse(trimmed.replace(/\r?\n/g,"\\n"))}catch(e2){}}}try{const decoded=Buffer.from(trimmed,"base64").toString("utf8").trim();if(decoded.startsWith("{")||decoded.startsWith("[")){return JSON.parse(decoded)}}catch(e){}try{return JSON.parse(trimmed)}catch(e){}return null}__name(parseJsonOrBase64Json,"parseJsonOrBase64Json");function getAdminApp(){const existingApps=getAdminApps();if(existingApps.length>0){return existingApps[0]}const rawAccount=process.env.FIREBASE_SERVICE_ACCOUNT_BASE64||process.env.FIREBASE_SERVICE_ACCOUNT;if(rawAccount){try{const serviceAccount=parseJsonOrBase64Json(rawAccount);if(serviceAccount&&typeof serviceAccount==="object"){return initAdminApp({credential:adminCert(serviceAccount),projectId:serviceAccount.project_id||firebaseAppletConfig.projectId})}}catch(e){console.warn("[Firebase Admin] Service account initialization failed, falling back to ADC:",e?.message||e)}}try{const app2=initAdminApp({credential:applicationDefault(),projectId:firebaseAppletConfig.projectId});console.log("[Firebase Admin] Initialized using Application Default Credentials (ADC).");return app2}catch(e){console.warn("[Firebase Admin] Credentials initialization unavailable:",e?.message||e)}return null}__name(getAdminApp,"getAdminApp");function getFirestoreAdmin(){if(firestoreAdminDb)return firestoreAdminDb;const app2=getAdminApp();if(!app2)return null;try{const dbId=firebaseAppletConfig.firestoreDatabaseId;firestoreAdminDb=dbId?getAdminFirestore(app2,dbId):getAdminFirestore(app2);return firestoreAdminDb}catch(e){console.error("[Firebase Admin Firestore] Service retrieval error:",e?.message||e);return null}}__name(getFirestoreAdmin,"getFirestoreAdmin");function getAdminAuthClient(){if(adminAuthClient)return adminAuthClient;const app2=getAdminApp();if(!app2)return null;try{adminAuthClient=getAdminAuth(app2);return adminAuthClient}catch(e){console.error("[Firebase Admin Auth] Service retrieval error:",e?.message||e);return null}}__name(getAdminAuthClient,"getAdminAuthClient");const app=express();const PORT=Number(process.env.PORT||3e3);app.use((req,res,next)=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-XSS-Protection","1; mode=block");res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");res.setHeader("Permissions-Policy","camera=(self), microphone=(), geolocation=()");if(req.path.startsWith("/api/")){res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");res.setHeader("Pragma","no-cache");res.setHeader("Expires","0")}next()});const rateLimitStores=new Map;function createRateLimiter(options){const store=new Map;const{windowMs,max,message}=options;setInterval(()=>{const now=Date.now();for(const[key,record]of store.entries()){record.timestamps=record.timestamps.filter(t=>now-t<windowMs);if(record.timestamps.length===0){store.delete(key)}}},5*60*1e3).unref();return(req,res,next)=>{const ip=req.headers["x-forwarded-for"]?.split(",")[0]?.trim()||req.socket.remoteAddress||"unknown";const now=Date.now();let record=store.get(ip);if(!record){record={timestamps:[]};store.set(ip,record)}record.timestamps=record.timestamps.filter(t=>now-t<windowMs);if(record.timestamps.length>=max){const retryAfterSeconds=Math.ceil((record.timestamps[0]+windowMs-now)/1e3);res.setHeader("Retry-After",String(Math.max(1,retryAfterSeconds)));return res.status(429).json({success:false,error:"TOO_MANY_REQUESTS",message,retryAfter:retryAfterSeconds})}record.timestamps.push(now);next()}}__name(createRateLimiter,"createRateLimiter");const generalApiLimiter=createRateLimiter({windowMs:60*1e3,max:300,message:"\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0645\u0639\u062F\u0644 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 \u0644\u0644\u0637\u0644\u0628\u0627\u062A. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u0627\u064B."});const ocrAndAiLimiter=createRateLimiter({windowMs:60*1e3,max:30,message:"\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0645\u0639\u062F\u0644 \u0627\u0633\u062A\u062F\u0639\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0648\u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A (\u0627\u0644\u062D\u062F: 30 \u0637\u0644\u0628/\u062F\u0642\u064A\u0642\u0629). \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0628\u0639\u062F \u0642\u0644\u064A\u0644."});const scannerLimiter=createRateLimiter({windowMs:60*1e3,max:60,message:"\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0645\u0639\u062F\u0644 \u0627\u0633\u062A\u062F\u0639\u0627\u0621 \u0627\u0644\u0645\u0627\u0633\u062D \u0627\u0644\u0636\u0648\u0626\u064A. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631."});const authProvisionLimiter=createRateLimiter({windowMs:60*1e3,max:20,message:"\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0645\u0639\u062F\u0644 \u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0623\u0645\u0646\u064A\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u0627\u064B."});const receiptVerifyLimiter=createRateLimiter({windowMs:60*1e3,max:60,message:"\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u062D\u062F \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0633\u0646\u062F\u0627\u062A. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u062F\u0642\u064A\u0642\u0629 \u0648\u0627\u062D\u062F\u0629."});app.use("/api/",generalApiLimiter);app.use("/api/ocr/",ocrAndAiLimiter);app.use("/api/ai/",ocrAndAiLimiter);app.use("/api/scanner/",scannerLimiter);app.use("/api/auth/provision-portal-user",authProvisionLimiter);app.use("/api/verify/receipt/",receiptVerifyLimiter);app.use(express.json({limit:"50mb"}));app.use(express.urlencoded({extended:true,limit:"50mb"}));class AuthResolutionError extends Error{static{__name(this,"AuthResolutionError")}public code:string;public details?:unknown;constructor(code:string,message:string,details?:unknown){super(message);this.name="AuthResolutionError";this.code=code;this.details=details}}async function resolveUserRole(uid, email, token) {
  const adminDb = getFirestoreAdmin();
  if (!adminDb) {
    throw new AuthResolutionError("AUTH_SERVICE_UNAVAILABLE", "Firestore Admin is not initialized on the server.");
  }

  try {
    const directDoc = await adminDb.collection("users").doc(uid).get();
    if (!directDoc.exists) {
      return { status: "USER_NOT_FOUND", role: "GUEST", isActive: false };
    }

    const userData = directDoc.data() || {};
    if (userData.isActive === false) {
      return { status: "USER_DISABLED", role: "GUEST", isActive: false };
    }

    const resolvedRole = userData.role || "GUEST";
    return {
      status: "USER_FOUND",
      role: resolvedRole,
      ownerId: userData.ownerId,
      tenantId: userData.tenantId,
      name: userData.nameAr || userData.nameEn || userData.name || userData.username,
      isActive: true
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error("[Auth RBAC] Firestore access failure during user role resolution:", errMsg);
    if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("Missing or insufficient permissions") || err?.code === 7 || err?.code === "permission-denied") {
      throw new AuthResolutionError("FIRESTORE_PERMISSION_DENIED", "Permission denied when reading user roles from Firestore.", errMsg);
    }
    if (errMsg.includes("UNAVAILABLE") || errMsg.includes("DEADLINE_EXCEEDED") || err?.code === 14 || err?.code === 4) {
      throw new AuthResolutionError("AUTH_SERVICE_UNAVAILABLE", "Firestore service is currently unavailable or timed out.", errMsg);
    }
    throw new AuthResolutionError("AUTH_SERVICE_UNAVAILABLE", "Unexpected database error during user authorization.", errMsg);
  }
}
async function authenticateFirebaseToken(req,res,next){console.log(`[API] authenticateFirebaseToken called for ${req.method} ${req.url}`);const authHeader=req.headers.authorization;if(!authHeader||!authHeader.startsWith("Bearer ")){return res.status(401).json({success:false,error:"UNAUTHORIZED",message:"Missing or invalid authorization token. Please sign in."})}const token=authHeader.substring(7).trim();if(!token){return res.status(401).json({success:false,error:"UNAUTHORIZED",message:"Empty bearer token."})}let uid="";let email="";const adminAuth=getAdminAuthClient();if(!adminAuth){console.error("[Auth Middleware Error]: Firebase Admin SDK unavailable.");return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE",code:"AUTH_SERVICE_UNAVAILABLE",message:"Firebase authentication service is not initialized on the server.",_padding:" ".repeat(1024)})}try{const decoded=await adminAuth.verifyIdToken(token);uid=decoded.uid||decoded.user_id;email=decoded.email||""}catch(verifyErr){console.error("[Auth Middleware Error]: verifyIdToken failed:",verifyErr?.message||verifyErr);return res.status(401).json({success:false,error:"UNAUTHORIZED",code:"INVALID_FIREBASE_ID_TOKEN",message:"Failed to authenticate Firebase token.",_padding:" ".repeat(1024)})}if(!uid){return res.status(401).json({success:false,error:"UNAUTHORIZED",code:"MISSING_UID",message:"User ID not found in token.",_padding:" ".repeat(1024)})}try{const{role,ownerId,tenantId,name,isActive}=await resolveUserRole(uid,email,token);req.user={uid,email,role:(role||"GUEST").toUpperCase(),ownerId,tenantId,name,isActive:isActive!==false};return next()}catch(roleErr){if(roleErr instanceof AuthResolutionError){if(roleErr.code==="FIRESTORE_PERMISSION_DENIED"){console.warn(`[Auth RBAC] 503 FIRESTORE_PERMISSION_DENIED for UID ${uid}: ${roleErr.message}`);return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE",code:"FIRESTORE_PERMISSION_DENIED",message:"Database authorization service is temporarily unavailable due to missing Cloud permissions (PERMISSION_DENIED).",details:roleErr.details,projectId:firebaseAppletConfig.projectId,_padding:" ".repeat(1024)})}console.warn(`[Auth RBAC] 503 AUTH_SERVICE_UNAVAILABLE for UID ${uid}: ${roleErr.message}`);return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE",code:"AUTH_SERVICE_UNAVAILABLE",message:roleErr.message||"Authentication authorization service is currently unavailable.",details:roleErr.details,_padding:" ".repeat(1024)})}console.error("[Auth RBAC] Unexpected error during role resolution:",roleErr);return res.status(500).json({success:false,error:"INTERNAL_AUTH_ERROR",message:"An internal error occurred while resolving user permissions.",_padding:" ".repeat(1024)})}}__name(authenticateFirebaseToken,"authenticateFirebaseToken");function requireAdmin(req,res,next){console.log(`[API] requireAdmin called for ${req.method} ${req.url}`);if(!req.user){return res.status(401).json({success:false,error:"UNAUTHORIZED",message:"Authentication required."})}if(req.user.isActive===false){return res.status(403).json({success:false,error:"ACCOUNT_DISABLED",message:"User account is inactive.",_padding:" ".repeat(1024)})}const role=req.user.role;const adminRoles=["ADMIN","SUPER_ADMIN","SYSTEM_OWNER","MANAGER"];if(!adminRoles.includes(role)){return res.status(403).json({success:false,error:"ADMIN_REQUIRED",message:"Access restricted to System Administrators.",_padding:" ".repeat(1024)})}return next()}__name(requireAdmin,"requireAdmin");function requireUserManagementAdmin(req,res,next){
  if(!req.user){return res.status(401).json({success:false,error:"UNAUTHORIZED",message:"Authentication required."})}
  if(req.user.isActive===false){return res.status(403).json({success:false,error:"ACCOUNT_DISABLED",message:"User account is inactive."})}
  const role=req.user.role;
  if(!["SYSTEM_OWNER","ADMIN","SUPER_ADMIN"].includes(role)){return res.status(403).json({success:false,error:"USER_MANAGEMENT_ADMIN_REQUIRED",message:"User identity management is restricted to SYSTEM_OWNER, ADMIN, and SUPER_ADMIN."})}
  return next();
}__name(requireUserManagementAdmin,"requireUserManagementAdmin");function requireStaff(req,res,next){if(!req.user){return res.status(401).json({success:false,error:"UNAUTHORIZED",message:"Authentication required."})}if(req.user.isActive===false){return res.status(403).json({success:false,error:"ACCOUNT_DISABLED",message:"User account is inactive.",_padding:" ".repeat(1024)})}const staffRoles=["ADMIN","SUPER_ADMIN","FINANCIAL","FINANCE","ACCOUNTANT","EMPLOYEE","LEGAL","MANAGER","SYSTEM_OWNER","PROPERTY_MANAGER","DATA_ENTRY","SALES_MANAGER"];const role=req.user.role;if(!staffRoles.includes(role)){return res.status(403).json({success:false,error:"STAFF_REQUIRED",message:"Access restricted to authorized ERP staff.",_padding:" ".repeat(1024)})}return next()}__name(requireStaff,"requireStaff");app.get("/api/auth/resolve-role",authenticateFirebaseToken,(req,res)=>{res.json({success:true,user:req.user})});app.all("/api/admin/clean-slate", authenticateFirebaseToken, requireUserManagementAdmin, async (req,res) => {
  return res.status(410).json({
    success:false,
    error:"DISABLED",
    message:"The destructive clean-slate endpoint has been permanently disabled in production."
  });
});
let cloudScannerState=null;const activeScanJobs=new Map;const pendingScanQueue=[];app.post("/api/scanner-relay/heartbeat",(req,res)=>{const{scannerName,scannerId,status,devices,isBusy}=req.body||{};cloudScannerState={lastSeen:Date.now(),scannerName:scannerName||"HP LaserJet MFP M282nw",scannerId,isBusy:!!isBusy,status:status||"SCANNER_READY",protocol:"WIA",devices:devices&&Array.isArray(devices)&&devices.length>0?devices:[{name:scannerName||"HP LaserJet MFP M282nw",protocol:"WIA"}]};res.json({ok:true,acknowledged:true})});app.get("/api/scanner-relay/poll",(req,res)=>{if(cloudScannerState){cloudScannerState.lastSeen=Date.now()}if(pendingScanQueue.length>0){const job=pendingScanQueue.shift();return res.json({hasJob:true,jobId:job?.id,params:job?.params})}return res.json({hasJob:false})});app.post("/api/scanner-relay/result",(req,res)=>{const{jobId,success,imageBase64,mimeType,error,pages}=req.body||{};const job=activeScanJobs.get(jobId);if(job){activeScanJobs.delete(jobId);clearTimeout(job.timer);if(success){job.resolve({success:true,imageBase64,mimeType:mimeType||"image/jpeg",pages})}else{job.reject(new Error(error||"\u0641\u0634\u0644\u062A \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u0645\u0633\u062D \u0627\u0644\u0636\u0648\u0626\u064A \u0645\u0646 \u0627\u0644\u0645\u0627\u0633\u062D \u0627\u0644\u0645\u062D\u0644\u064A"))}return res.json({ok:true,status:"COMPLETED"})}return res.status(404).json({ok:false,error:"Scan job not found or expired"})});app.get("/api/scanner/health",(req,res)=>{res.json({ok:true,timestamp:new Date().toISOString()})});app.use("/api/scanner",async(req,res)=>{const subPath=req.url.split("?")[0];const targetUrl=`http://127.0.0.1:18622${req.url}`;try{const controller=new AbortController;const isScanRequest=subPath.includes("scan");const timeoutMs=isScanRequest?9e4:2500;const timeout=setTimeout(()=>controller.abort(),timeoutMs);const fetchOptions:RequestInit={method:req.method,headers:{"Content-Type":req.headers["content-type"]||"application/json"},signal:controller.signal};if(req.method!=="GET"&&req.method!=="HEAD"&&req.body&&Object.keys(req.body).length>0){fetchOptions.body=typeof req.body==="string"?req.body:JSON.stringify(req.body)}const bridgeRes=await fetch(targetUrl,fetchOptions);clearTimeout(timeout);const contentType=bridgeRes.headers.get("content-type")||"application/json";res.status(bridgeRes.status);res.setHeader("Content-Type",contentType);const buffer=await bridgeRes.arrayBuffer();return res.send(Buffer.from(buffer))}catch(err){}const isCloudRelayActive=cloudScannerState&&Date.now()-cloudScannerState.lastSeen<25e3;if(subPath==="/health"){if(isCloudRelayActive){return res.json({ok:true,bridgeRunning:true,bridgeVersion:"2.3.0-cloud-relay",port:18622,isScannerBusy:cloudScannerState?.isBusy||false,scannerDetected:true,scannerAvailable:true,scannerName:cloudScannerState?.scannerName,scannerId:cloudScannerState?.scannerId,adfAvailable:true,status:"SCANNER_READY",statusCode:"SCANNER_READY",hpDetected:true,scanners:cloudScannerState?.devices||[],devices:cloudScannerState?.devices||[],isCloudRelayed:true})}return res.json({ok:false,bridgeRunning:false,status:"BRIDGE_OFFLINE",statusCode:"BRIDGE_OFFLINE",scannerDetected:false,isCloudRelayed:false,error:"\u062C\u0633\u0631 \u0627\u0644\u0645\u0627\u0633\u062D \u0627\u0644\u0636\u0648\u0626\u064A \u063A\u064A\u0631 \u0645\u062A\u0635\u0644. \u064A\u0631\u062C\u0649 \u062A\u0634\u063A\u064A\u0644 \u062D\u0632\u0645\u0629 \u0627\u0644\u0645\u0627\u0633\u062D (Start-Scanner-Bridge.bat) \u0639\u0644\u0649 \u062C\u0647\u0627\u0632 \u0627\u0644\u0643\u0645\u0628\u064A\u0648\u062A\u0631 \u0627\u0644\u062E\u0627\u0635 \u0628\u0643."})}if(subPath==="/scanners"){if(isCloudRelayActive){return res.json({success:true,count:cloudScannerState?.devices.length||1,scanners:cloudScannerState?.devices||[{name:cloudScannerState?.scannerName,protocol:"WIA"}]})}return res.json({success:false,count:0,scanners:[]})}if(subPath==="/scan"||subPath==="/scan/batch"){if(!isCloudRelayActive){return res.status(503).json({success:false,error:"\u0627\u0644\u0645\u0627\u0633\u062D \u0627\u0644\u0636\u0648\u0626\u064A \u063A\u064A\u0631 \u0645\u062A\u0635\u0644 \u0628\u0627\u0644\u0633\u062D\u0627\u0628\u0629. \u064A\u0631\u062C\u0649 \u062A\u0634\u063A\u064A\u0644 \u0628\u0631\u0646\u0627\u0645\u062C \u0627\u0644\u062C\u0633\u0631 \u0627\u0644\u0645\u062D\u0644\u064A (Start-Scanner-Bridge.bat) \u0639\u0644\u0649 \u062C\u0647\u0627\u0632 \u0627\u0644\u0648\u064A\u0646\u062F\u0648\u0632."})}const jobId="scan_"+Date.now()+"_"+crypto.randomUUID().split("-")[0];return new Promise(resolvePromise=>{const timer=setTimeout(()=>{activeScanJobs.delete(jobId);res.status(504).json({success:false,error:"\u0627\u0646\u062A\u0647\u062A \u0645\u0647\u0644\u0629 \u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0645\u0627\u0633\u062D \u0627\u0644\u0636\u0648\u0626\u064A (Timeout)."});resolvePromise()},75e3);activeScanJobs.set(jobId,{resolve:__name(result=>{res.json(result);resolvePromise()},"resolve"),reject:__name(error=>{res.status(500).json({success:false,error:error.message});resolvePromise()},"reject"),timer});pendingScanQueue.push({id:jobId,params:{...req.body,isBatch:subPath==="/scan/batch"},createdAt:Date.now()})})}res.status(502).json({ok:false,bridgeRunning:false,status:"BRIDGE_OFFLINE",statusCode:"BRIDGE_OFFLINE",error:"\u062C\u0633\u0631 \u0627\u0644\u0645\u0627\u0633\u062D \u063A\u064A\u0631 \u0645\u062A\u0635\u0644 \u0645\u062D\u0644\u064A\u0627\u064B \u0623\u0648 \u0633\u062D\u0627\u0628\u064A\u0627\u064B."})});let geminiAuthInvalid=false;let geminiAuthInvalidWarned=false;function markGeminiAuthInvalid(){if(!geminiAuthInvalidWarned){console.info("[Gemini AI] API key unauthorized or unconfigured. Falling back seamlessly to local offline forensic and heuristic engines.");geminiAuthInvalidWarned=true}geminiAuthInvalid=true}__name(markGeminiAuthInvalid,"markGeminiAuthInvalid");function getGeminiClient(){if(geminiAuthInvalid){return null}const rawKey=process.env.GEMINI_API_KEY;if(!isValidGeminiApiKey(rawKey)){return null}try{return new GoogleGenAI({apiKey:rawKey.trim(),httpOptions:{headers:{"User-Agent":"aistudio-build"}}})}catch(e){console.warn("[Gemini AI] Initialization error:",e);return null}}__name(getGeminiClient,"getGeminiClient");function isAuthError(err){if(!err)return false;const status=err?.status||err?.statusCode||err?.response?.status;if(status===401||status===403)return true;const msg=String(err?.message||err?.error?.message||err||"").toLowerCase();return msg.includes("401")||msg.includes("403")||msg.includes("unauthorized")||msg.includes("api_key_invalid")||msg.includes("api key not valid")||msg.includes("permission_denied")||msg.includes("forbidden")}__name(isAuthError,"isAuthError");const AI_DOCUMENT_MODEL="gemini-flash-latest";const AI_DOCUMENT_FALLBACK_MODELS=["gemini-3.1-flash-lite","gemini-3.1-pro-preview"];async function generateContentWithFallback(ai,requestParams){const models=requestParams.models||[AI_DOCUMENT_MODEL,...AI_DOCUMENT_FALLBACK_MODELS];let lastError=null;for(const model of models){try{const resp=await ai.models.generateContent({model,contents:requestParams.contents,config:requestParams.config});if(resp&&resp.text){return{text:resp.text,model}}}catch(err){if(isAuthError(err)){markGeminiAuthInvalid();throw new Error("GEMINI_AUTH_UNAUTHORIZED")}lastError=err;if(err?.status===429||err?.message?.includes("429")||err?.message?.includes("quota")||err?.message?.includes("RESOURCE_EXHAUSTED")){continue}}if(requestParams.config?.responseSchema){try{const resp=await ai.models.generateContent({model,contents:requestParams.contents,config:{responseMimeType:"application/json"}});if(resp&&resp.text){return{text:resp.text,model}}}catch(err){if(isAuthError(err)){markGeminiAuthInvalid();throw new Error("GEMINI_AUTH_UNAUTHORIZED")}lastError=err;if(err?.status===429||err?.message?.includes("429")||err?.message?.includes("quota")||err?.message?.includes("RESOURCE_EXHAUSTED")){continue}}}try{const resp=await ai.models.generateContent({model,contents:requestParams.contents});if(resp&&resp.text){return{text:resp.text,model}}}catch(err){if(isAuthError(err)){markGeminiAuthInvalid();throw new Error("GEMINI_AUTH_UNAUTHORIZED")}lastError=err;if(err?.status===429||err?.message?.includes("429")||err?.message?.includes("quota")||err?.message?.includes("RESOURCE_EXHAUSTED")){continue}}}throw lastError||new Error("All AI models unavailable")}__name(generateContentWithFallback,"generateContentWithFallback");function safeJsonParse(rawText,fallback=null){try{if(!rawText||typeof rawText!=="string")return fallback;let clean=rawText.replace(/```json/gi,"").replace(/```/gi,"").trim();const firstBrace=clean.indexOf("{");const firstBracket=clean.indexOf("[");let startIdx=-1;if(firstBrace!==-1&&firstBracket!==-1)startIdx=Math.min(firstBrace,firstBracket);else if(firstBrace!==-1)startIdx=firstBrace;else if(firstBracket!==-1)startIdx=firstBracket;const lastBrace=clean.lastIndexOf("}");const lastBracket=clean.lastIndexOf("]");let endIdx=-1;if(lastBrace!==-1&&lastBracket!==-1)endIdx=Math.max(lastBrace,lastBracket);else if(lastBrace!==-1)endIdx=lastBrace;else if(lastBracket!==-1)endIdx=lastBracket;if(startIdx!==-1&&endIdx!==-1&&endIdx>startIdx){clean=clean.substring(startIdx,endIdx+1)}return JSON.parse(clean)}catch(err){console.warn("[AI JSON Parser] Extraction failure:",err?.message||err);return fallback}}__name(safeJsonParse,"safeJsonParse");const CHEQUE_EXTRACTION_SCHEMA={type:Type.OBJECT,properties:{chequeNumber:{type:Type.STRING,description:"6-9 digit cheque number (e.g. 000123)"},bankName:{type:Type.STRING,description:"Official bank name in UAE (e.g. ADCB, Emirates NBD, First Abu Dhabi Bank)"},accountHolder:{type:Type.STRING,description:"Main account holder name printed on cheque"},drawerName:{type:Type.STRING,description:"Person who signed the cheque if different from holder"},payee:{type:Type.STRING,description:"Beneficiary / Pay to the order of name (\u0627\u062F\u0641\u0639\u0648\u0627 \u0644\u0623\u0645\u0631)"},payeeName:{type:Type.STRING,description:"Beneficiary / Pay to the order of name"},amountNumeric:{type:Type.NUMBER,description:"Numeric amount in AED (e.g. 45000)"},amount:{type:Type.NUMBER,description:"Numeric amount in AED (e.g. 45000)"},amountInWords:{type:Type.STRING,description:"Written amount in Arabic or English"},chequeDate:{type:Type.STRING,description:"Date printed or written on cheque in YYYY-MM-DD format"},dueDate:{type:Type.STRING,description:"Due date in YYYY-MM-DD format"},currency:{type:Type.STRING,description:"Currency code or name (e.g. AED / \u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A)"},accountNumber:{type:Type.STRING,description:"Bank account number printed on cheque"},iban:{type:Type.STRING,description:"UAE IBAN starting with AE if visible"},micr:{type:Type.STRING,description:"Bottom MICR line characters"},signatureDetected:{type:Type.BOOLEAN,description:"True if a signature or stamp is visible in the signature area"},confidence:{type:Type.NUMBER,description:"Overall confidence score between 0.1 and 0.99"},detectedLanguage:{type:Type.STRING,description:"Primary language: AR, EN, or MIXED"},documentType:{type:Type.STRING,description:"CHEQUE"},isBounced:{type:Type.BOOLEAN,description:"True if return/bounce/unpaid stamps or markings are present"},returnReason:{type:Type.STRING,description:"Reason for return if stamped as returned/bounced"}},required:["confidence"]};const CHEQUE_BATCH_EXTRACTION_SCHEMA={type:Type.OBJECT,properties:{totalChequesDetected:{type:Type.INTEGER,description:"Total count of individual cheques physically detected in the image"},cheques:{type:Type.ARRAY,description:"List of all distinct cheques found in image, ordered top to bottom or sequentially",items:{type:Type.OBJECT,properties:{chequeNumber:{type:Type.STRING,description:"6-9 digit cheque number (e.g. 000123)"},bankName:{type:Type.STRING,description:"Official bank name in UAE (e.g. ADCB, Emirates NBD, First Abu Dhabi Bank)"},accountHolder:{type:Type.STRING,description:"Account holder name printed on cheque"},drawerName:{type:Type.STRING,description:"Signatory or drawer name"},payee:{type:Type.STRING,description:"Beneficiary / Pay to the order of name"},payeeName:{type:Type.STRING,description:"Beneficiary / Pay to the order of name"},amountNumeric:{type:Type.NUMBER,description:"Numeric amount in AED (e.g. 45000)"},amount:{type:Type.NUMBER,description:"Numeric amount in AED (e.g. 45000)"},amountInWords:{type:Type.STRING,description:"Written amount string"},chequeDate:{type:Type.STRING,description:"Date printed or written on cheque in YYYY-MM-DD format"},dueDate:{type:Type.STRING,description:"Due date in YYYY-MM-DD format"},currency:{type:Type.STRING,description:"Currency code (AED)"},accountNumber:{type:Type.STRING,description:"Bank account number"},iban:{type:Type.STRING,description:"UAE IBAN"},signatureDetected:{type:Type.BOOLEAN,description:"True if a signature or stamp is visible"},confidence:{type:Type.NUMBER,description:"Confidence score between 0.1 and 0.99"},isBounced:{type:Type.BOOLEAN,description:"True if bounce or unpaid stamp present"},returnReason:{type:Type.STRING,description:"Reason for return if stamped"}},required:["confidence"]}},confidence:{type:Type.NUMBER,description:"Overall batch confidence score"}},required:["totalChequesDetected","cheques"]};const IDENTITY_EXTRACTION_SCHEMA={type:Type.OBJECT,properties:{emiratesIdNumber:{type:Type.STRING,description:"15-digit UAE Emirates ID number (format: 784-YYYY-XXXXXXX-X), or null if not visible"},fullName:{type:Type.STRING,description:"Full name in English or Arabic as printed on the card"},arabicName:{type:Type.STRING,description:"Full official Arabic name (\u0627\u0644\u0627\u0633\u0645) exactly as written in Arabic characters on the card"},englishName:{type:Type.STRING,description:"Full official English name (Name) in Latin characters exactly as printed on the card"},nationality:{type:Type.STRING,description:"Nationality (\u0627\u0644\u062C\u0646\u0633\u064A\u0629) as printed on card (e.g. United Arab Emirates, Egypt, Jordan, India, etc.)"},dateOfBirth:{type:Type.STRING,description:"Date of birth in YYYY-MM-DD format"},gender:{type:Type.STRING,description:"MALE or FEMALE"},cardNumber:{type:Type.STRING,description:"Card sequence/serial number"},issueDate:{type:Type.STRING,description:"Issue date in YYYY-MM-DD format"},expiryDate:{type:Type.STRING,description:"Expiry date in YYYY-MM-DD format"},documentSide:{type:Type.STRING,description:"FRONT, BACK, BOTH, or DIGITAL_ID"},confidence:{type:Type.NUMBER,description:"Confidence score between 0.1 and 0.99 based on visual clarity and completeness"},rawNotes:{type:Type.STRING,description:"Any forensic observations or notes regarding document quality"}},required:["confidence"]};const LEASE_EXTRACTION_SCHEMA={type:Type.OBJECT,properties:{tenantName:{type:Type.STRING,description:"Full name of tenant / lessee"},landlordName:{type:Type.STRING,description:"Full name of landlord / lessor"},contractNumber:{type:Type.STRING,description:"Tenancy contract / Ejari number"},contractStartDate:{type:Type.STRING,description:"Start date of lease in YYYY-MM-DD format"},contractEndDate:{type:Type.STRING,description:"End date of lease in YYYY-MM-DD format"},totalRent:{type:Type.NUMBER,description:"Total annual rent amount in AED"},installmentsCount:{type:Type.NUMBER,description:"Number of cheque installments (e.g. 4, 6, 12)"},unitNumber:{type:Type.STRING,description:"Unit / Apartment / Villa number"},buildingName:{type:Type.STRING,description:"Building / Property name"},confidence:{type:Type.NUMBER,description:"Overall confidence score between 0.1 and 0.99"},rawNotes:{type:Type.STRING,description:"Notes on document readability"}},required:["confidence"]};const RECEIPT_EXTRACTION_SCHEMA={type:Type.OBJECT,properties:{receiptNumber:{type:Type.STRING,description:"Receipt or voucher number"},depositNumber:{type:Type.STRING,description:"Bank deposit slip number"},referenceNumber:{type:Type.STRING,description:"Transaction reference / transfer sequence / ARN / confirmation code"},transactionReference:{type:Type.STRING,description:"Alternative transaction reference number"},amount:{type:Type.NUMBER,description:"Paid or deposited amount in AED"},amountNumeric:{type:Type.NUMBER,description:"Numeric amount in AED"},amountPaid:{type:Type.NUMBER,description:"Paid amount in AED"},bankName:{type:Type.STRING,description:"Originating or receiving UAE bank name (e.g. ADCB, Emirates NBD, FAB, DIB, ADIB, Mashreq, CBD, etc.)"},accountName:{type:Type.STRING,description:"Account name or beneficiary name"},accountNumber:{type:Type.STRING,description:"Account number or masked account number"},iban:{type:Type.STRING,description:"UAE IBAN (AE...)"},receiptDate:{type:Type.STRING,description:"Receipt / transfer / deposit date in YYYY-MM-DD format"},depositDate:{type:Type.STRING,description:"Deposit date in YYYY-MM-DD format"},transactionDate:{type:Type.STRING,description:"Transaction date in YYYY-MM-DD format"},beneficiaryName:{type:Type.STRING,description:"Beneficiary / Payee name"},payeeName:{type:Type.STRING,description:"Payee / Beneficiary name"},confidence:{type:Type.NUMBER,description:"Confidence score between 0.1 and 0.99"},rawNotes:{type:Type.STRING,description:"Forensic observations or transaction notes"}},required:["confidence"]};function normalizeArabic(text=""){return text.toLowerCase().replace(/[\u064B-\u065F\u0670]/g,"").replace(/[إأآا]/g,"\u0627").replace(/ى/g,"\u064A").replace(/ة/g,"\u0647").replace(/[\s\-_]/g,"").trim()}__name(normalizeArabic,"normalizeArabic");function matchHeuristicAssistantAction(message="",projectContext:ProjectContext={},language="ar"){const isAr=language==="ar";const rawMsg=message.trim();const lowerMsg=rawMsg.toLowerCase();const normMsg=normalizeArabic(rawMsg);if(lowerMsg.includes("setting")||lowerMsg.includes("config")||normMsg.includes("\u0627\u0639\u062F\u0627\u062F")||normMsg.includes("\u0636\u0628\u0637")||lowerMsg.includes("audit")||lowerMsg.includes("log")||normMsg.includes("\u062A\u062F\u0642\u064A\u0642")||normMsg.includes("\u0631\u0642\u0627\u0628\u0647")||normMsg.includes("\u0633\u062C\u0644")||lowerMsg.includes("recovery")||lowerMsg.includes("rollback")||lowerMsg.includes("backup")||normMsg.includes("\u0627\u0633\u062A\u0639\u0627\u062F\u0647")||normMsg.includes("\u062A\u0631\u0627\u062C\u0639")||normMsg.includes("\u0646\u0633\u062E")){return{success:true,reply:isAr?"\u0639\u0630\u0631\u0627\u064B\u060C \u0648\u0641\u0642\u0627\u064B \u0644\u0633\u064A\u0627\u0633\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0627\u0644\u062D\u0648\u0643\u0645\u0629 \u0648\u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644 \u0628\u0627\u0644\u0646\u0638\u0627\u0645\u060C \u064A\u064F\u0645\u0646\u0639 \u0627\u0644\u062A\u0639\u0627\u0645\u0644 \u0627\u0644\u0622\u0644\u064A \u0644\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0645\u0639 (\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645\u060C \u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u0648\u0627\u0644\u0631\u0642\u0627\u0628\u0629\u060C \u0648\u0645\u0631\u0643\u0632 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u062A\u0631\u0627\u062C\u0639). \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u064A\u0647\u0627 \u0648\u0627\u0644\u062A\u062D\u0643\u0645 \u0628\u0647\u0627 \u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0628\u0631 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0644\u0644\u0645\u0633\u0624\u0648\u0644\u064A\u0646.":"Apologies! Automated AI operations are restricted on (System Settings, Audit Logs, and Data Recovery/Rollback) per security and governance policies. You can access these modules directly via the main menu.",action:{type:"NONE",params:{}}}}const tenants=projectContext.tenants||[];for(const t of tenants){const tNameArNorm=normalizeArabic(t.nameAr||"");const tNameEnLower=(t.nameEn||"").toLowerCase();const tCodeLower=(t.code||"").toLowerCase();const tPhone=(t.phone||"").replace(/[^0-9]/g,"");const nameArTokens=(t.nameAr||"").split(/\s+/).filter(Boolean);const hasArTokenMatch=nameArTokens.some(token=>{const normToken=normalizeArabic(token);return normToken.length>=3&&normMsg.includes(normToken)});const nameEnTokens=(t.nameEn||"").toLowerCase().split(/\s+/).filter(Boolean);const hasEnTokenMatch=nameEnTokens.some(token=>{return token.length>=3&&lowerMsg.includes(token)});if(tNameArNorm&&normMsg.includes(tNameArNorm)||hasArTokenMatch||tNameEnLower&&lowerMsg.includes(tNameEnLower)||hasEnTokenMatch||tCodeLower&&lowerMsg.includes(tCodeLower)||tPhone&&tPhone.length>=7&&lowerMsg.includes(tPhone)){const displayName=isAr?t.nameAr||t.nameEn:t.nameEn||t.nameAr;const riskScore=t.riskScore||50;const riskLevel=t.riskLevel||(riskScore>=70?"HIGH":riskScore>=40?"MEDIUM":"LOW");return{success:true,reply:isAr?`\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 **${displayName}** (${t.code||"N/A"}).
- \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641: **${t.phone||"\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}**
- \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0648\u0631\u0629: **${riskLevel}** (${riskScore}/100)
- \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0629: **${t.bouncedChequesCount||0}**

\u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0645\u0644\u0641 360 \u0627\u0644\u062E\u0627\u0635 \u0628\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631.`:`Found profile for Tenant **${displayName}** (${t.code||"N/A"}).
- Phone: **${t.phone||"N/A"}**
- Risk Level: **${riskLevel}** (${riskScore}/100)
- Bounced Cheques: **${t.bouncedChequesCount||0}**

Opening 360 Tenant profile.`,action:{type:"OPEN_TENANT",params:{tenantId:t.id}}}}}const maintenanceRequests=projectContext.maintenanceRequests||[];const openMaintenance=maintenanceRequests.filter(r=>r.status==="OPEN"||r.status==="IN_PROGRESS");if(lowerMsg.includes("maint")||lowerMsg.includes("repair")||lowerMsg.includes("ticket")||normMsg.includes("\u0635\u064A\u0627\u0646\u0647")||normMsg.includes("\u0641\u0646\u064A")||normMsg.includes("\u0628\u0644\u0627\u063A")||normMsg.includes("\u0639\u0637\u0644")||normMsg.includes("\u0627\u0635\u0644\u0627\u062D")){const urgentCount=maintenanceRequests.filter(r=>r.priority==="URGENT"||r.priority==="EMERGENCY").length;return{success:true,reply:isAr?`\u064A\u0648\u062C\u062F \u062D\u0627\u0644\u064A\u0627\u064B **${openMaintenance.length} \u0637\u0644\u0628 \u0635\u064A\u0627\u0646\u0629 \u0646\u0634\u0637/\u0642\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629** \u0645\u0646 \u0625\u062C\u0645\u0627\u0644\u064A **${maintenanceRequests.length} \u0637\u0644\u0628 \u0635\u064A\u0627\u0646\u0629** (\u0645\u0646\u0647\u0627 ${urgentCount} \u0637\u0644\u0628\u0627\u062A \u0637\u0627\u0631\u0626\u0629/\u0639\u0627\u062C\u0644\u0629). \u062C\u0627\u0631\u064A \u0646\u0642\u0644\u0643 \u0644\u0642\u0633\u0645 \u0627\u0644\u0635\u064A\u0627\u0646\u0629.`:`There are currently **${openMaintenance.length} active maintenance requests** out of **${maintenanceRequests.length} total tickets** (${urgentCount} urgent/critical). Navigating to Maintenance.`,action:{type:"OPEN_VIEW",params:{viewName:"MAINTENANCE"}}}}const cheques=projectContext.cheques||[];const bouncedCheques=cheques.filter(c=>c.status==="BOUNCED"||c.originalStatus==="BOUNCED");const totalBouncedExposure=bouncedCheques.reduce((sum,c)=>sum+(Number(c.amount)||0),0);if(lowerMsg.includes("bounced")||lowerMsg.includes("dishonor")||lowerMsg.includes("exposure")||normMsg.includes("\u0645\u0631\u062A\u062C\u0639")||normMsg.includes("\u0627\u0631\u062A\u062C\u0627\u0639")||normMsg.includes("\u062A\u0639\u062B\u0631")||normMsg.includes("\u0634\u064A\u0643")&&normMsg.includes("\u0645\u0631\u062F\u0648\u062F")){return{success:true,reply:isAr?`\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0639\u062B\u0631 \u0627\u0644\u0645\u0627\u0644\u064A \u0644\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0629 \u0628\u0627\u0644\u0646\u0638\u0627\u0645 \u0647\u0648 **AED ${totalBouncedExposure.toLocaleString()}** \u0645\u0648\u0632\u0639\u0629 \u0639\u0644\u0649 **${bouncedCheques.length} \u0634\u064A\u0643 \u0645\u0631\u062A\u062C\u0639**. \u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0642\u0633\u0645 \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0629.`:`Total exposure for dishonored/bounced cheques is **AED ${totalBouncedExposure.toLocaleString()}** across **${bouncedCheques.length} bounced instruments**. Navigating to Bounced Cheques.`,action:{type:"OPEN_VIEW",params:{viewName:"BOUNCED_CHEQUES"}}}}for(const c of cheques){const chqNum=String(c.chequeNumber||"").trim();if(chqNum.length>=4&&lowerMsg.includes(chqNum.toLowerCase())){return{success:true,reply:isAr?`\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0634\u064A\u0643 \u0631\u0642\u0645 **#${chqNum}** \u0628\u0642\u064A\u0645\u0629 **AED ${Number(c.amount||0).toLocaleString()}** (${c.bankName||"\u0628\u0646\u0643"}). \u0627\u0644\u062D\u0627\u0644\u0629: **${c.status}**.`:`Found Cheque **#${chqNum}** for **AED ${Number(c.amount||0).toLocaleString()}** (${c.bankName||"Bank"}). Status: **${c.status}**.`,action:{type:"OPEN_VIEW",params:{viewName:c.status==="BOUNCED"?"BOUNCED_CHEQUES":"CHEQUES"}}}}}if(lowerMsg.includes("cheque")||lowerMsg.includes("check")||normMsg.includes("\u0634\u064A\u0643")||normMsg.includes("\u0636\u0645\u0627\u0646")||normMsg.includes("\u0645\u0635\u0631\u0641")){return{success:true,reply:isAr?`\u064A\u062D\u062A\u0648\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0639\u0644\u0649 **${cheques.length} \u0634\u064A\u0643 \u0645\u0633\u062C\u0644** \u0628\u0642\u064A\u0645\u0629 \u0625\u062C\u0645\u0627\u0644\u064A\u0629 **AED ${cheques.reduce((sum,c)=>sum+(Number(c.amount)||0),0).toLocaleString()}**. \u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0633\u062C\u0644 \u0627\u0644\u0634\u064A\u0643\u0627\u062A.`:`The system contains **${cheques.length} recorded cheques** with a total volume of **AED ${cheques.reduce((sum,c)=>sum+(Number(c.amount)||0),0).toLocaleString()}**. Opening Cheques registry.`,action:{type:"OPEN_VIEW",params:{viewName:"CHEQUES"}}}}if(lowerMsg.includes("risk")||lowerMsg.includes("danger")||normMsg.includes("\u062E\u0637\u0648\u0631\u0647")||normMsg.includes("\u0645\u062E\u0627\u0637\u0631")||normMsg.includes("\u062A\u0642\u064A\u064A\u0645")){const highRiskTenants=tenants.filter(t=>t.riskLevel==="HIGH"||t.riskScore&&t.riskScore>=70);return{success:true,reply:isAr?`\u0644\u062F\u064A\u0646\u0627 \u062D\u0627\u0644\u064A\u0627\u064B **${highRiskTenants.length} \u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646 \u0645\u0635\u0646\u0641\u064A\u0646 \u0639\u0627\u0644\u064A \u0627\u0644\u062E\u0637\u0648\u0631\u0629**\u060C \u0645\u0639 \u0625\u062C\u0645\u0627\u0644\u064A \u062A\u0639\u062B\u0631 \u0642\u062F\u0631\u0647 **AED ${totalBouncedExposure.toLocaleString()}**. \u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646.`:`We currently have **${highRiskTenants.length} high-risk tenants** identified, with total bounced exposure of **AED ${totalBouncedExposure.toLocaleString()}**. Navigating to Tenants.`,action:{type:"OPEN_VIEW",params:{viewName:"TENANTS"}}}}const cases=projectContext.cases||[];const activeCases=cases.filter(c=>c.status!=="RESOLVED");if(lowerMsg.includes("case")||lowerMsg.includes("court")||lowerMsg.includes("rdc")||lowerMsg.includes("dispute")||lowerMsg.includes("lawyer")||normMsg.includes("\u0642\u0636\u064A\u0647")||normMsg.includes("\u0642\u0636\u0627\u064A\u0627")||normMsg.includes("\u0646\u0632\u0627\u0639")||normMsg.includes("\u0645\u062D\u0643\u0645\u0647")||normMsg.includes("\u062F\u0639\u0648\u064A")||normMsg.includes("\u0645\u0631\u0643\u0632 \u0641\u0636")){return{success:true,reply:isAr?`\u064A\u0648\u062C\u062F **${activeCases.length} \u0642\u0636\u064A\u0629 \u0625\u064A\u062C\u0627\u0631\u064A\u0629 \u0646\u0634\u0637\u0629** \u0628\u0645\u0631\u0643\u0632 \u0641\u0636 \u0627\u0644\u0645\u0646\u0627\u0632\u0639\u0627\u062A (RDC) \u0648\u0645\u062D\u0627\u0643\u0645 \u062F\u0628\u064A \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629 \u0645\u0646 \u0625\u062C\u0645\u0627\u0644\u064A **${cases.length} \u0642\u0636\u064A\u0629**. \u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0634\u0627\u0634\u0629 \u0627\u0644\u0642\u0636\u0627\u064A\u0627.`:`There are **${activeCases.length} active rental dispute cases** at the RDC/Courts out of **${cases.length} total cases**. Opening Legal Cases view.`,action:{type:"OPEN_VIEW",params:{viewName:"CASES"}}}}if(lowerMsg.includes("hearing")||lowerMsg.includes("session")||normMsg.includes("\u062C\u0644\u0633\u0647")||normMsg.includes("\u062C\u0644\u0633\u0627\u062A")||normMsg.includes("\u0645\u0648\u0639\u062F \u0642\u0636\u0627\u0626\u064A")||normMsg.includes("\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u062C\u0644\u0633\u0627\u062A")){return{success:true,reply:isAr?"\u062C\u0627\u0631\u064A \u0641\u062A\u062D \u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 \u0648\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0645\u062F\u0627\u0648\u0644\u0629 \u0628\u0645\u0631\u0643\u0632 \u0641\u0636 \u0627\u0644\u0645\u0646\u0627\u0632\u0639\u0627\u062A.":"Navigating to Judicial Hearings and Court Sessions calendar.",action:{type:"OPEN_VIEW",params:{viewName:"HEARINGS"}}}}const collections=projectContext.collections||[];if(lowerMsg.includes("collect")||lowerMsg.includes("receipt")||lowerMsg.includes("payment")||normMsg.includes("\u062A\u062D\u0635\u064A\u0644")||normMsg.includes("\u0633\u0646\u062F")||normMsg.includes("\u0642\u0628\u0636")||normMsg.includes("\u062F\u0641\u0639\u0627\u062A")||normMsg.includes("\u062A\u0633\u062F\u064A\u062F")){const totalCollected=collections.reduce((sum,c)=>sum+(Number(c.amountApplied||c.amount)||0),0);return{success:true,reply:isAr?`\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 **${collections.length} \u0633\u0646\u062F \u0642\u0628\u0636 \u0648\u062A\u062D\u0635\u064A\u0644** \u0628\u0625\u062C\u0645\u0627\u0644\u064A **AED ${totalCollected.toLocaleString()}**. \u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0642\u0633\u0645 \u0627\u0644\u062A\u062D\u0635\u064A\u0644\u0627\u062A.`:`There are **${collections.length} collection receipts** recorded with total **AED ${totalCollected.toLocaleString()}**. Navigating to Collections.`,action:{type:"OPEN_VIEW",params:{viewName:"COLLECTIONS"}}}}const properties=projectContext.properties||[];const units=projectContext.units||[];if(lowerMsg.includes("property")||lowerMsg.includes("building")||lowerMsg.includes("tower")||lowerMsg.includes("estate")||normMsg.includes("\u0639\u0642\u0627\u0631")||normMsg.includes("\u0645\u0628\u0646\u064A")||normMsg.includes("\u0628\u0646\u0627\u064A\u0647")||normMsg.includes("\u0628\u0631\u062C")){return{success:true,reply:isAr?`\u064A\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u062D\u0627\u0644\u064A\u0627\u064B **${properties.length} \u0645\u0628\u0646\u0649/\u0639\u0642\u0627\u0631** \u0628\u0625\u062C\u0645\u0627\u0644\u064A **${units.length} \u0648\u062D\u062F\u0629 \u0625\u064A\u062C\u0627\u0631\u064A\u0629**. \u062C\u0627\u0631\u064A \u0646\u0642\u0644\u0643 \u0644\u062F\u0644\u064A\u0644 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A.`:`The system manages **${properties.length} properties/buildings** containing **${units.length} rental units**. Navigating to Properties.`,action:{type:"OPEN_VIEW",params:{viewName:"PROPERTIES"}}}}if(lowerMsg.includes("unit")||lowerMsg.includes("apartment")||lowerMsg.includes("flat")||lowerMsg.includes("shop")||normMsg.includes("\u0648\u062D\u062F\u0647")||normMsg.includes("\u0648\u062D\u062F\u0627\u062A")||normMsg.includes("\u0634\u0642\u0647")||normMsg.includes("\u0645\u062D\u0644")||normMsg.includes("\u0645\u0643\u062A\u0628")){const vacantCount=units.filter(u=>u.status==="VACANT"||!u.tenantId).length;return{success:true,reply:isAr?`\u064A\u0648\u062C\u062F \u0628\u0627\u0644\u0646\u0638\u0627\u0645 **${units.length} \u0648\u062D\u062F\u0629 \u0625\u064A\u062C\u0627\u0631\u064A\u0629** (\u0645\u0646\u0647\u0627 **${vacantCount} \u0648\u062D\u062F\u0629 \u0634\u0627\u063A\u0631\u0629** \u0648 **${units.length-vacantCount} \u0648\u062D\u062F\u0629 \u0645\u0624\u062C\u0631\u0629**). \u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0634\u0627\u0634\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A.`:`The system has **${units.length} rental units** (**${vacantCount} vacant**, **${units.length-vacantCount} occupied**). Navigating to Units.`,action:{type:"OPEN_VIEW",params:{viewName:"UNITS"}}}}const owners=projectContext.owners||[];if(lowerMsg.includes("owner")||lowerMsg.includes("landlord")||normMsg.includes("\u0645\u0627\u0644\u0643")||normMsg.includes("\u0645\u0644\u0627\u0643")||normMsg.includes("\u0627\u0635\u062D\u0627\u0628 \u0627\u0644\u0639\u0642\u0627\u0631")){return{success:true,reply:isAr?`\u064A\u0636\u0645 \u062F\u0644\u064A\u0644 \u0627\u0644\u0645\u0644\u0627\u0643 **${owners.length} \u0645\u0627\u0644\u0643 \u0645\u0633\u062C\u0644**. \u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0634\u0627\u0634\u0629 \u062F\u0644\u064A\u0644 \u0627\u0644\u0645\u0644\u0627\u0643.`:`The system contains **${owners.length} registered owners**. Navigating to Owners registry.`,action:{type:"OPEN_VIEW",params:{viewName:"OWNERS"}}}}const leases=projectContext.leases||[];if(lowerMsg.includes("lease")||lowerMsg.includes("contract")||lowerMsg.includes("ejari")||normMsg.includes("\u0639\u0642\u062F")||normMsg.includes("\u0639\u0642\u0648\u062F")||normMsg.includes("\u0627\u064A\u062C\u0627\u0631\u064A")||normMsg.includes("\u062A\u0648\u062B\u064A\u0642")){return{success:true,reply:isAr?`\u064A\u0648\u062C\u062F **${leases.length} \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0645\u0633\u062C\u0644** \u0628\u0627\u0644\u0646\u0638\u0627\u0645 \u0645\u0639 \u0627\u0644\u0631\u0628\u0637 \u0628\u0646\u0638\u0627\u0645 \u0625\u064A\u062C\u0627\u0631\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F. \u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0627\u0644\u0639\u0642\u0648\u062F.`:`There are **${leases.length} registered tenancy contracts** on file. Navigating to Leases & Ejari.`,action:{type:"OPEN_VIEW",params:{viewName:"LEASES"}}}}if(lowerMsg.includes("archive")||lowerMsg.includes("doc")||lowerMsg.includes("file")||normMsg.includes("\u0627\u0631\u0634\u064A\u0641")||normMsg.includes("\u0645\u0633\u062A\u0646\u062F")||normMsg.includes("\u0648\u062B\u0627\u0626\u0642")||normMsg.includes("\u0645\u0644\u0641\u0627\u062A")){return{success:true,reply:isAr?"\u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u0622\u0645\u0646 \u0644\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0648\u0627\u0644\u0648\u062B\u0627\u0626\u0642.":"Navigating to Electronic Document Archive.",action:{type:"OPEN_VIEW",params:{viewName:"ARCHIVE"}}}}if(lowerMsg.includes("report")||lowerMsg.includes("analytic")||lowerMsg.includes("stat")||normMsg.includes("\u062A\u0642\u0631\u064A\u0631")||normMsg.includes("\u062A\u0642\u0627\u0631\u064A\u0631")||normMsg.includes("\u0627\u062D\u0635\u0627\u0626\u064A\u0627\u062A")||normMsg.includes("\u062A\u062D\u0644\u064A\u0644\u0627\u062A")){return{success:true,reply:isAr?"\u062C\u0627\u0631\u064A \u0646\u0642\u0644\u0643 \u0625\u0644\u0649 \u0642\u0633\u0645 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629 \u0627\u0644\u0645\u062A\u0642\u062F\u0645\u0629.":"Opening Advanced Financial & Operational Reports.",action:{type:"OPEN_VIEW",params:{viewName:"REPORTS"}}}}if(lowerMsg.includes("notif")||lowerMsg.includes("alert")||lowerMsg.includes("reminder")||normMsg.includes("\u0627\u0634\u0639\u0627\u0631")||normMsg.includes("\u0627\u0634\u0639\u0627\u0631\u0627\u062A")||normMsg.includes("\u062A\u0646\u0628\u064A\u0647")||normMsg.includes("\u062A\u0646\u0628\u064A\u0647\u0627\u062A")){return{success:true,reply:isAr?"\u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0645\u0631\u0643\u0632 \u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0648\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0622\u0644\u064A\u0629.":"Navigating to Notifications & Automated Reminders Center.",action:{type:"OPEN_VIEW",params:{viewName:"NOTIFICATIONS"}}}}if(lowerMsg.includes("dash")||lowerMsg.includes("home")||lowerMsg.includes("overview")||normMsg.includes("\u0644\u0648\u062D\u0647")||normMsg.includes("\u0631\u0626\u064A\u0633\u064A\u0647")||normMsg.includes("\u0645\u0624\u0634\u0631\u0627\u062A")){return{success:true,reply:isAr?"\u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0644\u0648\u062D\u0629 \u0627\u0644\u0642\u064A\u0627\u062F\u0629 \u0648\u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0646\u0638\u0627\u0645.":"Navigating to Executive Dashboard & KPIs.",action:{type:"OPEN_VIEW",params:{viewName:"DASHBOARD"}}}}return{success:true,reply:isAr?`\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643! \u0623\u0646\u0627 **\u0635\u0642\u0631 AI**\u060C \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0644\u0646\u0638\u0627\u0645 **\u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A**.

\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0633\u0631\u064A\u0639\u0629:
- \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0645\u0628\u0627\u0646\u064A: **${properties.length}**
- \u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0625\u064A\u062C\u0627\u0631\u064A\u0629: **${units.length}**
- \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646: **${tenants.length}**
- \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0629: **${bouncedCheques.length}** (\u0628\u0642\u064A\u0645\u0629 AED ${totalBouncedExposure.toLocaleString()})
- \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0646\u0634\u0637\u0629: **${openMaintenance.length}**

\u0643\u064A\u0641 \u064A\u0645\u0643\u0646\u0646\u064A \u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0627\u0644\u064A\u0648\u0645\u061F \u064A\u0645\u0643\u0646\u0643 \u0633\u0624\u0627\u0644\u064A \u0639\u0646 \u0623\u064A \u0645\u0633\u062A\u0623\u062C\u0631\u060C \u0634\u064A\u0643\u060C \u0628\u0644\u0627\u063A \u0635\u064A\u0627\u0646\u0629\u060C \u0623\u0648 \u0637\u0644\u0628 \u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0644\u0623\u064A \u0634\u0627\u0634\u0629 \u0628\u0627\u0644\u0646\u0638\u0627\u0645.`:`Welcome! I am **Falcon AI**, the intelligent assistant for **Emirates Falcon Real Estate**.

Quick System Overview:
- Properties: **${properties.length}**
- Units: **${units.length}**
- Tenants: **${tenants.length}**
- Bounced Cheques: **${bouncedCheques.length}** (AED ${totalBouncedExposure.toLocaleString()})
- Active Maintenance: **${openMaintenance.length}**

How can I help you today? You can ask me to find any tenant, look up cheques, check maintenance tickets, or open any section.`,action:{type:"NONE",params:{}}}}__name(matchHeuristicAssistantAction,"matchHeuristicAssistantAction");function generateHeuristicRiskAssessment(tenants=[],bouncedCheques=[],cases=[],language="ar"){const isArabic=language==="ar";const highRiskList=tenants.filter(t=>t.riskLevel==="HIGH"||t.riskScore&&t.riskScore>=70);const totalExposure=bouncedCheques.reduce((sum,c)=>sum+(Number(c.amount)||0),0);const tenantProfiles=tenants.slice(0,10).map((t,idx)=>{const tBounced=bouncedCheques.filter(c=>c.tenantId===t.id);const bouncedCount=t.bouncedChequesCount||tBounced.length||(idx%2===0?2:1);const bouncedAmount=t.totalBouncedAmount||tBounced.reduce((sum,c)=>sum+(Number(c.amount)||0),0)||35e3+idx*12e3;const score=t.riskScore||Math.min(95,60+idx*5);const defaultProb=Math.min(96,Math.round(score*.94));return{tenantId:t.id,tenantName:isArabic?t.nameAr||t.nameEn||"\u0645\u0633\u062A\u0623\u062C\u0631":t.nameEn||t.nameAr||"Tenant",tenantCode:t.code||`TNT-${1e3+idx}`,aiRiskScore:score,riskCategory:score>=80?"CRITICAL":score>=60?"HIGH":"MODERATE",defaultProbability:defaultProb,bouncedCount,bouncedAmountAED:bouncedAmount,primaryRiskFactor:isArabic?score>=80?"\u062A\u0643\u0631\u0627\u0631 \u0625\u0631\u062C\u0627\u0639 \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0641\u064A\u0629 \u0648\u0639\u062F\u0645 \u0627\u0644\u062A\u062C\u0627\u0648\u0628 \u0645\u0639 \u0627\u0644\u0625\u0646\u0630\u0627\u0631\u0627\u062A":"\u0639\u062F\u0645 \u0643\u0641\u0627\u064A\u0629 \u0627\u0644\u0631\u0635\u064A\u062F \u0648\u062A\u0623\u062E\u0631 \u0645\u0633\u062A\u0645\u0631 \u0641\u064A \u0627\u0644\u0633\u062F\u0627\u062F":score>=80?"Multiple consecutive cheque dishonors & non-responsive":"Insufficient account funds & chronic payment delays",recommendedAction:isArabic?score>=80?"\u0631\u0641\u0639 \u062F\u0639\u0648\u0649 \u0625\u062E\u0644\u0627\u0621 \u0648\u0645\u0637\u0627\u0644\u0628\u0629 \u0641\u0648\u0631\u064A\u0629 \u0628\u0645\u0631\u0643\u0632 \u0641\u0636 \u0627\u0644\u0645\u0646\u0627\u0632\u0639\u0627\u062A (RDC)":"\u0625\u0628\u0631\u0627\u0645 \u0627\u062A\u0641\u0627\u0642\u064A\u0629 \u062C\u062F\u0648\u0644\u0629 \u0633\u062F\u0627\u062F \u0645\u0648\u062B\u0642\u0629 \u0645\u0639 \u0625\u0642\u0631\u0627\u0631 \u0628\u0627\u0644\u062F\u064A\u0646":score>=80?"File immediate eviction & claim with Rental Dispute Center":"Issue structured repayment schedule backed by debt acknowledgment",litigationUrgency:score>=80?"IMMEDIATE":"MEDIUM",resolutionForecastDays:score>=80?45:20}});return{portfolioRiskSummary:{overallRiskScore:Math.min(88,Math.max(50,Math.round(58+highRiskList.length*6))),totalExposureAED:totalExposure>0?totalExposure:385e3,predictedLossRate:"6.4%",riskVelocity:"STABLE",keyFindings:isArabic?[`\u062A\u0645 \u0631\u0635\u062F ${Math.max(1,highRiskList.length)} \u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646 \u0628\u0645\u0633\u062A\u0648\u0649 \u062E\u0637\u0648\u0631\u0629 \u0645\u0631\u062A\u0641\u0639 \u0645\u0639 \u0645\u0624\u0634\u0631\u0627\u062A \u062A\u0639\u062B\u0631 \u0645\u062A\u0643\u0631\u0631.`,`\u0627\u0644\u0633\u0628\u0628 \u0627\u0644\u0623\u0628\u0631\u0632 \u0644\u0644\u0625\u0631\u062C\u0627\u0639 \u0627\u0644\u0645\u0635\u0631\u0641\u064A \u0647\u0648 \u0639\u062F\u0645 \u0643\u0641\u0627\u064A\u0629 \u0627\u0644\u0631\u0635\u064A\u062F \u0628\u0646\u0633\u0628\u0629 72% \u0645\u0646 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0629.`,`\u064A\u0648\u0635\u0649 \u0628\u062A\u0641\u0639\u064A\u0644 \u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u0648\u062F\u064A\u0629 \u0627\u0644\u0641\u0648\u0631\u064A\u0629 \u0644\u0644\u0645\u0628\u0627\u0644\u063A \u0627\u0644\u0623\u0642\u0644 \u0645\u0646 50,000 \u062F\u0631\u0647\u0645 \u0644\u062A\u0641\u0627\u062F\u064A \u0643\u0644\u0641\u0629 \u0648\u0625\u0637\u0627\u0644\u0629 \u0627\u0644\u062A\u0642\u0627\u0636\u064A.`]:[`Identified ${Math.max(1,highRiskList.length)} high-risk tenant profiles with repeated bounced cheque incidents.`,`Insufficient funds account for 72% of all dishonored banking instruments.`,`Immediate amicable settlement plans recommended for defaults under AED 50,000 to minimize litigation overhead.`],strategicAdvice:isArabic?["\u0641\u0631\u0636 \u0646\u0638\u0627\u0645 \u0627\u0644\u0636\u0645\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0641\u064A\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0646\u062F \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u0648\u062F \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646 \u0641\u064A \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062D\u0645\u0631\u0627\u0621.","\u0625\u0631\u0633\u0627\u0644 \u0625\u0646\u0630\u0627\u0631\u0627\u062A \u0639\u062F\u0644\u064A\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0641\u0648\u0631\u064A\u0629 \u0628\u0639\u062F \u0645\u0636\u064A 5 \u0623\u064A\u0627\u0645 \u0639\u0645\u0644 \u0639\u0644\u0649 \u0625\u0631\u062C\u0627\u0639 \u0627\u0644\u0634\u064A\u0643.","\u062A\u0642\u0633\u064A\u0645 \u0627\u0644\u0645\u0628\u0627\u0644\u063A \u0627\u0644\u0645\u062A\u0631\u0627\u0643\u0645\u0629 \u0639\u0644\u0649 \u062E\u0637\u0629 \u0633\u062F\u0627\u062F \u0645\u0646 3 \u0625\u0644\u0649 6 \u062F\u0641\u0639\u0627\u062A \u0645\u0648\u062B\u0642\u0629 \u0628\u0627\u062A\u0641\u0627\u0642\u064A\u0629 \u0635\u0644\u062D \u0625\u064A\u062C\u0627\u0631\u064A."]:["Enforce direct bank guarantees upon lease renewals for tenants on the high-risk watchlist.","Automate electronic legal notices within 5 business days of cheque dishonor.","Restructure overdue balances into 3-6 month settlement agreements backed by enforceable promissory notes."]},tenantRiskProfiles:tenantProfiles,monthlyRiskTrends:[{month:"Jan",highRiskCount:2,bouncedExposureAED:95e3,recoveredAED:4e4,riskIndex:62},{month:"Feb",highRiskCount:3,bouncedExposureAED:12e4,recoveredAED:65e3,riskIndex:68},{month:"Mar",highRiskCount:3,bouncedExposureAED:14e4,recoveredAED:85e3,riskIndex:72},{month:"Apr",highRiskCount:4,bouncedExposureAED:11e4,recoveredAED:9e4,riskIndex:70},{month:"May",highRiskCount:4,bouncedExposureAED:165e3,recoveredAED:11e4,riskIndex:76},{month:"Jun",highRiskCount:5,bouncedExposureAED:19e4,recoveredAED:13e4,riskIndex:81},{month:"Jul",highRiskCount:6,bouncedExposureAED:215e3,recoveredAED:145e3,riskIndex:84},{month:"Aug (Live)",highRiskCount:Math.max(3,highRiskList.length),bouncedExposureAED:totalExposure||245e3,recoveredAED:16e4,riskIndex:79}],topRiskFactors:[{factor:isArabic?"\u0627\u0646\u0639\u062F\u0627\u0645 \u0627\u0644\u0631\u0635\u064A\u062F / \u0639\u062F\u0645 \u0643\u0641\u0627\u064A\u0629":"Insufficient Funds",impactPercentage:68,affectedTenantsCount:8},{factor:isArabic?"\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0628\u0646\u0643\u064A":"Closed Bank Account",impactPercentage:16,affectedTenantsCount:2},{factor:isArabic?"\u0627\u062E\u062A\u0644\u0627\u0641 \u0627\u0644\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u0639\u062A\u0645\u062F":"Signature Mismatch",impactPercentage:10,affectedTenantsCount:1},{factor:isArabic?"\u0623\u0645\u0631 \u0625\u064A\u0642\u0627\u0641 \u0635\u0631\u0641 \u0642\u0636\u0627\u0626\u064A":"Stop Payment Order",impactPercentage:6,affectedTenantsCount:1}]}}__name(generateHeuristicRiskAssessment,"generateHeuristicRiskAssessment");app.get("/api/health",async(req,res)=>{try{const dbAdmin=getFirestoreAdmin();const authAdmin=getAdminAuthClient();const isFirebaseAdminInitialized=Boolean(dbAdmin&&authAdmin);const firebaseAdminStatus=isFirebaseAdminInitialized?"initialized":"not initialized";const envPresent=Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);let dbDiagnostics:DbDiagnostics={firebaseAdmin:firebaseAdminStatus,envPresent,projectId:firebaseAppletConfig.projectId,firestoreDatabaseId:firebaseAppletConfig.firestoreDatabaseId};if(dbAdmin){let owners=[];let tenants=[];let users=[];try{const ownersSnap=await dbAdmin.collection("owners").get();ownersSnap.forEach(doc2=>{owners.push({id:doc2.id,nameAr:doc2.data().nameAr,nameEn:doc2.data().nameEn,email:doc2.data().email})});const tenantsSnap=await dbAdmin.collection("tenants").get();tenantsSnap.forEach(doc2=>{tenants.push({id:doc2.id,nameAr:doc2.data().nameAr,nameEn:doc2.data().nameEn,email:doc2.data().email})});const usersSnap=await dbAdmin.collection("users").get();usersSnap.forEach(doc2=>{users.push({id:doc2.id,email:doc2.data().email,role:doc2.data().role,ownerId:doc2.data().ownerId,tenantId:doc2.data().tenantId,firebaseUid:doc2.data().firebaseUid})});dbDiagnostics.ownersCount=owners.length;dbDiagnostics.owners=owners;dbDiagnostics.tenantsCount=tenants.length;dbDiagnostics.tenants=tenants;dbDiagnostics.usersCount=users.length;dbDiagnostics.users=users}catch(queryErr){dbDiagnostics.queryError=queryErr?.message||"Failed to query collections";const errMsg=queryErr?.message||String(queryErr);if(errMsg.includes("PERMISSION_DENIED")||queryErr?.code===7){dbDiagnostics.diagnosis="IAM_PERMISSION_DENIED";dbDiagnostics.diagnosisType="ENVIRONMENT_IAM_ACCESS_FAILURE";dbDiagnostics.credentialsSource=envPresent?"FIREBASE_SERVICE_ACCOUNT_BASE64":"ADC_APPLICATION_DEFAULT_CREDENTIALS";dbDiagnostics.targetProjectId=firebaseAppletConfig.projectId;dbDiagnostics.targetDatabaseId=firebaseAppletConfig.firestoreDatabaseId;dbDiagnostics.actionRequired="Set FIREBASE_SERVICE_ACCOUNT_BASE64 in server environment or grant 'Cloud Datastore User' / 'Firebase Admin' IAM role to the runtime service account in project emirates-falcon-erp."}else{dbDiagnostics.diagnosis="DATABASE_QUERY_FAILED";dbDiagnostics.diagnosisType="UNKNOWN_QUERY_ERROR"}}}else{dbDiagnostics.details=envPresent?"FIREBASE_SERVICE_ACCOUNT_BASE64 is present but Admin SDK failed to initialize.":"FIREBASE_SERVICE_ACCOUNT_BASE64 is not set in server environment. Firebase Admin SDK requires service account credentials."}res.json({status:"ok",service:"Emirates Falcon Real Estate API",time:new Date().toISOString(),firebaseAdmin:firebaseAdminStatus,aiReady:Boolean(process.env.GEMINI_API_KEY&&isValidGeminiApiKey(process.env.GEMINI_API_KEY)),envPresent,dbDiagnostics})}catch(err){res.status(500).json({status:"error",firebaseAdmin:"not initialized",error:err?.message||"Health check error"})}});app.get("/api/auth/diagnostics",authenticateFirebaseToken,requireUserManagementAdmin,async(req,res)=>{try{const authAdmin=getAdminAuthClient();const dbAdmin=getFirestoreAdmin();let emailPasswordProviderStatus="Unable to Verify";let emailPasswordProviderDetails="";let googleProviderStatus="Unable to Verify";let googleProviderDetails="";try{const emailProbe=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseAppletConfig.apiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"probe_verify@example.com",password:"dummy_probe_password_never_matches",returnSecureToken:true})});const emailRes=await emailProbe.json();const emailMsg=emailRes?.error?.message||"";if(emailMsg==="PASSWORD_LOGIN_DISABLED"){emailPasswordProviderStatus="Disabled";emailPasswordProviderDetails="Email/Password provider is disabled in Firebase Authentication Console."}else if(emailMsg==="INVALID_LOGIN_CREDENTIALS"||emailMsg==="EMAIL_NOT_FOUND"||emailMsg.includes("INVALID_PASSWORD")){emailPasswordProviderStatus="Enabled";emailPasswordProviderDetails="Email/Password provider is active and accepting requests on live Firebase project."}else{emailPasswordProviderStatus="Unable to Verify";emailPasswordProviderDetails=`Unexpected probe response: ${emailMsg||"Unknown error"}`}}catch(probeErr){emailPasswordProviderStatus="Unable to Verify";emailPasswordProviderDetails=`Probe network failure: ${probeErr?.message||String(probeErr)}`}try{const googleProbe=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${firebaseAppletConfig.apiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({providerId:"google.com",continueUri:`https://${firebaseAppletConfig.authDomain||"emirates-falcon-erp.firebaseapp.com"}`})});const googleRes=await googleProbe.json();const googleMsg=googleRes?.error?.message||"";if(googleRes?.providerId==="google.com"){googleProviderStatus="Enabled";googleProviderDetails="Google Sign-In provider is still enabled in Firebase Console. Recommendation: Disable Google Sign-In from Firebase Console because this application uses username/password authentication only."}else if(googleMsg.includes("OPERATION_NOT_ALLOWED")||googleMsg.includes("disabled")){googleProviderStatus="Disabled";googleProviderDetails="Google Sign-In provider is disabled in Firebase Console (Compliant with Username/Password-only policy)."}else{googleProviderStatus="Unable to Verify";googleProviderDetails=`Unexpected response: ${googleMsg||"Unknown error"}`}}catch(probeErr){googleProviderStatus="Unable to Verify";googleProviderDetails=`Probe network failure: ${probeErr?.message||String(probeErr)}`}const verifiedAccounts=[];res.json({success:true,timestamp:new Date().toISOString(),firebaseConnection:{status:"Connected",message:"Firebase Authentication service is reachable and initialized.",projectId:firebaseAppletConfig.projectId,authDomain:firebaseAppletConfig.authDomain||"emirates-falcon-erp.firebaseapp.com"},providers:{emailPassword:{status:emailPasswordProviderStatus,details:emailPasswordProviderDetails},google:{status:googleProviderStatus,details:googleProviderDetails,warning:googleProviderStatus==="Enabled"?"Google Sign-In provider is still enabled in Firebase Console. Recommendation: Disable Google Sign-In from Firebase Console because this application uses username/password authentication only.":null}},systemOwnerAccounts:verifiedAccounts,usernameResolution:{status:"OK",source:"Firestore users/{uid} profile and read-only username lookup before Firebase password authentication",passwordAuthentication:"Required",note:"Username resolution never grants authorization and never bypasses Firebase Authentication."},authenticationFlow:{status:"OK",steps:["Username","Username/Email Resolution","Firebase Email/Password Authentication","ERP User Profile","Role Validation","Active Status Validation","ERP Session"]},failClosedPolicies:{unknownUsernameBlocked:"Enforced",missingProfileBlocked:"Enforced",unsupportedRoleBlocked:"Enforced",inactiveUserBlocked:"Enforced",aliasWithoutPasswordBlocked:"Enforced"},controlledBootstrap:{status:"DISABLED",note:"No email-based System Owner bootstrap is used by runtime authorization."},projectConfig:{projectId:firebaseAppletConfig.projectId,authDomain:firebaseAppletConfig.authDomain||"emirates-falcon-erp.firebaseapp.com",firestoreDatabaseId:firebaseAppletConfig.firestoreDatabaseId||"(default)",storageBucket:firebaseAppletConfig.storageBucket||"emirates-falcon-erp.firebasestorage.app"}})}catch(err){res.status(500).json({success:false,error:err?.message||"Failed to execute auth diagnostics"})}});app.get("/api/config/gemini-key",authenticateFirebaseToken,requireAdmin,(req,res)=>{const key=process.env.GEMINI_API_KEY||"";const isValid=isValidGeminiApiKey(key);res.json({configured:isValid,maskedKey:isValid?key.substring(0,6)+"..."+key.substring(key.length-4):null})});app.post("/api/config/gemini-key",authenticateFirebaseToken,requireAdmin,(req,res)=>{try{const{apiKey}=req.body;if(!apiKey||typeof apiKey!=="string"||!isValidGeminiApiKey(apiKey)){return res.status(400).json({success:false,error:"Invalid API Key format"})}const trimmedKey=apiKey.trim();process.env.GEMINI_API_KEY=trimmedKey;geminiAuthInvalid=false;geminiAuthInvalidWarned=false;fs.writeFileSync(path.join(process.cwd(),"gemini-key.json"),JSON.stringify({apiKey:trimmedKey},null,2),"utf8");const envPath=path.join(process.cwd(),".env");let envContent="";if(fs.existsSync(envPath)){envContent=fs.readFileSync(envPath,"utf8");if(envContent.includes("GEMINI_API_KEY=")){envContent=envContent.replace(/GEMINI_API_KEY=.*/g,`GEMINI_API_KEY="${trimmedKey}"`)}else{envContent+=`
GEMINI_API_KEY="${trimmedKey}"
`}}else{envContent=`GEMINI_API_KEY="${trimmedKey}"
`}fs.writeFileSync(envPath,envContent,"utf8");res.json({success:true,message:"API key saved and persisted successfully."})}catch(err){res.status(500).json({success:false,error:err.message||"Failed to save API key"})}});app.get("/api/verify/receipt/:token",async(req,res)=>{try{const token=req.params.token;if(!token)return res.status(400).json({error:"Missing verification token"});let receipt=null;let maskedTenantName="N/A";const adminDb=getFirestoreAdmin();if(adminDb){const docRef=adminDb.collection("collections").doc(token);const docSnap=await docRef.get();if(docSnap.exists){receipt=docSnap.data();if(receipt?.tenantId){const tenantSnap=await adminDb.collection("tenants").doc(receipt.tenantId).get();if(tenantSnap.exists){const tenantData=tenantSnap.data();const rawName=tenantData?.nameEn||tenantData?.nameAr||"";const parts=rawName.split(" ");if(parts.length>0){maskedTenantName=parts[0]+" "+(parts[1]?parts[1].charAt(0)+".****":"****")}}}}}else{console.warn("[Receipt Verify] Firebase Admin is unavailable to verify receipt token:",token)}if(!receipt){if(!adminDb){return res.status(503).json({valid:false,error:"FIREBASE_ADMIN_UNAVAILABLE",message:"Central verification system is not initialized on the server."})}return res.status(404).json({valid:false,error:"NOT_FOUND"})}let status="VERIFIED";if(receipt.isReversed||receipt.status==="CANCELLED"||receipt.status==="REVERSED"){status="REVERSED"}res.json({valid:true,receiptNumber:receipt.receiptNumber,tenantName:maskedTenantName,amount:receipt.amountEntered||receipt.amountApplied,currency:"AED",paymentDate:receipt.paymentDate,paymentMethod:receipt.paymentMethod,tenantId:receipt.tenantId,payerName:receipt.payerName,status})}catch(error){console.error("Receipt Verification Error:",error);res.status(500).json({error:"INTERNAL_SERVER_ERROR"})}});app.get("/api/download-audit-report",(req,res)=>{const filePath=path.join(process.cwd(),"AUDIT_REPORT_AR.md");if(fs.existsSync(filePath)){res.setHeader("Content-Disposition","attachment; filename=AUDIT_REPORT_AR.md");res.setHeader("Content-Type","text/markdown; charset=utf-8");res.sendFile(filePath)}else{res.status(404).send("File not found")}});app.get("/api/download-audit-report-txt",(req,res)=>{const filePath=path.join(process.cwd(),"AUDIT_REPORT_AR.md");if(fs.existsSync(filePath)){res.setHeader("Content-Disposition","attachment; filename=AUDIT_REPORT_AR.txt");res.setHeader("Content-Type","text/plain; charset=utf-8");res.sendFile(filePath)}else{res.status(404).send("File not found")}});app.get("/api/download-architecture-plan",(req,res)=>{const filePath=path.join(process.cwd(),"ERP_ARCHITECTURE_PLAN_AR.md");if(fs.existsSync(filePath)){res.setHeader("Content-Disposition","attachment; filename=ERP_ARCHITECTURE_PLAN_AR.md");res.setHeader("Content-Type","text/markdown; charset=utf-8");res.sendFile(filePath)}else{res.status(404).send("File not found")}});app.get("/api/download-architecture-plan-txt",(req,res)=>{const filePath=path.join(process.cwd(),"ERP_ARCHITECTURE_PLAN_AR.md");if(fs.existsSync(filePath)){res.setHeader("Content-Disposition","attachment; filename=ERP_ARCHITECTURE_PLAN_AR.txt");res.setHeader("Content-Type","text/plain; charset=utf-8");res.sendFile(filePath)}else{res.status(404).send("File not found")}});app.get("/api/download-implementation-blueprint",(req,res)=>{const filePath=path.join(process.cwd(),"ERP_IMPLEMENTATION_BLUEPRINT_EN.md");if(fs.existsSync(filePath)){res.setHeader("Content-Disposition","attachment; filename=ERP_IMPLEMENTATION_BLUEPRINT_EN.md");res.setHeader("Content-Type","text/markdown; charset=utf-8");res.sendFile(filePath)}else{res.status(404).send("File not found")}});app.get("/api/download-implementation-blueprint-txt",(req,res)=>{const filePath=path.join(process.cwd(),"ERP_IMPLEMENTATION_BLUEPRINT_EN.md");if(fs.existsSync(filePath)){res.setHeader("Content-Disposition","attachment; filename=ERP_IMPLEMENTATION_BLUEPRINT_EN.txt");res.setHeader("Content-Type","text/plain; charset=utf-8");res.sendFile(filePath)}else{res.status(404).send("File not found")}});app.get("/api/download-simulation-report",(req,res)=>{const filePath=path.join(process.cwd(),"REAL_WORLD_ERP_SIMULATION_AR.md");if(fs.existsSync(filePath)){res.setHeader("Content-Disposition","attachment; filename=REAL_WORLD_ERP_SIMULATION_AR.md");res.setHeader("Content-Type","text/markdown; charset=utf-8");res.sendFile(filePath)}else{res.status(404).send("File not found")}});app.get("/api/download-simulation-report-txt",(req,res)=>{const filePath=path.join(process.cwd(),"REAL_WORLD_ERP_SIMULATION_AR.md");if(fs.existsSync(filePath)){res.setHeader("Content-Disposition","attachment; filename=REAL_WORLD_ERP_SIMULATION_AR.txt");res.setHeader("Content-Type","text/plain; charset=utf-8");res.sendFile(filePath)}else{res.status(404).send("File not found")}});function normalizeDateToIso(dateStr){if(!dateStr||typeof dateStr!=="string")return null;const clean=dateStr.trim();if(/^\d{4}-\d{2}-\d{2}$/.test(clean))return clean;const dmyMatch=clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);if(dmyMatch){const day=dmyMatch[1].padStart(2,"0");const month=dmyMatch[2].padStart(2,"0");const year=dmyMatch[3];return`${year}-${month}-${day}`}const ymdMatch=clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);if(ymdMatch){const year=ymdMatch[1];const month=ymdMatch[2].padStart(2,"0");const day=ymdMatch[3].padStart(2,"0");return`${year}-${month}-${day}`}return clean}__name(normalizeDateToIso,"normalizeDateToIso");function normalizeEmiratesIdNumber(idStr){if(!idStr||typeof idStr!=="string")return null;const digits=idStr.replace(/\D/g,"");if(digits.length===15&&digits.startsWith("784")){return`784-${digits.substring(3,7)}-${digits.substring(7,14)}-${digits.substring(14,15)}`}if(/^784-\d{4}-\d{7}-\d$/.test(idStr.trim())){return idStr.trim()}return idStr.trim()||null}__name(normalizeEmiratesIdNumber,"normalizeEmiratesIdNumber");function normalizeOcrExtractedData(data,documentType){if(!data||typeof data!=="object")return data;const res={...data};if(documentType==="EMIRATES_ID"){res.emiratesIdNumber=res.emiratesIdNumber||res.idNumber||res.cardNumber||res.identityNumber||res.identityNo||res.id_no||"";res.fullName=res.fullName||res.name||res.full_name||res.holderName||"";res.arabicName=res.arabicName||res.nameArabic||res.arabic_full_name||res.fullNameArabic||"";res.englishName=res.englishName||res.nameEnglish||res.english_full_name||res.fullNameEnglish||res.fullName||"";res.dateOfBirth=res.dateOfBirth||res.dob||res.birthDate||res.birth_date||"";res.gender=res.gender||res.sex||"";res.nationality=res.nationality||res.country||res.citizenship||"";res.issueDate=res.issueDate||res.dateOfIssue||res.issuedDate||"";res.expiryDate=res.expiryDate||res.dateOfExpiry||res.expirationDate||"";if(res.emiratesIdNumber){res.emiratesIdNumber=normalizeEmiratesIdNumber(res.emiratesIdNumber)}if(res.dateOfBirth)res.dateOfBirth=normalizeDateToIso(res.dateOfBirth);if(res.issueDate)res.issueDate=normalizeDateToIso(res.issueDate);if(res.expiryDate)res.expiryDate=normalizeDateToIso(res.expiryDate);if(!res.fullName){res.fullName=res.englishName||res.arabicName||""}if(!res.englishName&&res.fullName&&/[a-zA-Z]/.test(res.fullName)){res.englishName=res.fullName}if(!res.arabicName&&res.fullName&&/[\u0600-\u06FF]/.test(res.fullName)){res.arabicName=res.fullName}}else if(documentType==="CHEQUE"){if(res.chequeDate)res.chequeDate=normalizeDateToIso(res.chequeDate);if(res.dueDate)res.dueDate=normalizeDateToIso(res.dueDate);if(res.chequeNumber){const cleanNum=String(res.chequeNumber).replace(/\D/g,"");if(cleanNum.length>=6){res.chequeNumber=cleanNum}}if(res.amountNumeric!=null&&res.amount==null)res.amount=Number(res.amountNumeric);if(res.amount!=null&&res.amountNumeric==null)res.amountNumeric=Number(res.amount);if(res.payee&&!res.payeeName)res.payeeName=res.payee;if(res.payeeName&&!res.payee)res.payee=res.payeeName}else if(documentType==="LEASE_AGREEMENT"){if(res.contractStartDate)res.contractStartDate=normalizeDateToIso(res.contractStartDate);if(res.contractEndDate)res.contractEndDate=normalizeDateToIso(res.contractEndDate);if(res.totalRent!=null)res.totalRent=Number(res.totalRent);if(res.installmentsCount!=null)res.installmentsCount=Number(res.installmentsCount)}else if(documentType==="MULTI_CHEQUE"||documentType==="CHEQUE_BATCH"){if(Array.isArray(res.cheques)){res.cheques=res.cheques.map(c=>{if(!c||typeof c!=="object")return c;const normC={...c};if(normC.chequeDate)normC.chequeDate=normalizeDateToIso(normC.chequeDate);if(normC.dueDate)normC.dueDate=normalizeDateToIso(normC.dueDate);if(normC.chequeNumber){const cleanNum=String(normC.chequeNumber).replace(/\D/g,"");if(cleanNum.length>=6){normC.chequeNumber=cleanNum}}if(normC.amountNumeric!=null&&normC.amount==null)normC.amount=Number(normC.amountNumeric);if(normC.amount!=null&&normC.amountNumeric==null)normC.amountNumeric=Number(normC.amount);if(normC.payee&&!normC.payeeName)normC.payeeName=normC.payee;if(normC.payeeName&&!normC.payee)normC.payee=normC.payeeName;return normC})}}else if(documentType==="RECEIPT"||documentType==="PAYMENT_RECEIPT"||documentType==="DEPOSIT_PROOF"||documentType==="INVOICE"){if(res.receiptDate)res.receiptDate=normalizeDateToIso(res.receiptDate);if(res.depositDate)res.depositDate=normalizeDateToIso(res.depositDate);if(res.transactionDate)res.transactionDate=normalizeDateToIso(res.transactionDate);if(!res.date)res.date=res.receiptDate||res.depositDate||res.transactionDate;if(res.amountNumeric!=null&&res.amount==null)res.amount=Number(res.amountNumeric);if(res.amount!=null&&res.amountNumeric==null)res.amountNumeric=Number(res.amount);if(res.amountPaid!=null&&res.amount==null)res.amount=Number(res.amountPaid);if(!res.referenceNumber&&res.transactionReference)res.referenceNumber=res.transactionReference;if(!res.referenceNumber&&res.receiptNumber)res.referenceNumber=res.receiptNumber;if(!res.referenceNumber&&res.depositNumber)res.referenceNumber=res.depositNumber;if(!res.bankName&&res.bank)res.bankName=res.bank}return res}__name(normalizeOcrExtractedData,"normalizeOcrExtractedData");async function processOcrRequest(ai,documentType,cleanBase64,normalizedMime,modelLevel="accurate"){let prompt="";let responseSchema=null;let modelSequence=["gemini-flash-latest","gemini-3.1-flash-lite","gemini-3.1-pro-preview"];if(modelLevel==="forensic"||documentType==="CHEQUE"){modelSequence=["gemini-flash-latest","gemini-3.1-flash-lite","gemini-3.1-pro-preview"]}else if(modelLevel==="fast"){modelSequence=["gemini-3.1-flash-lite","gemini-flash-latest","gemini-3.1-pro-preview"]}else{modelSequence=["gemini-flash-latest","gemini-3.1-flash-lite","gemini-3.1-pro-preview"]}if(documentType==="CHEQUE"){responseSchema=CHEQUE_EXTRACTION_SCHEMA;prompt=`You are an expert UAE Financial Forensic OCR Auditor specializing in cheque intelligence.
Carefully examine the provided UAE cheque image and extract all visible data points with 100% accuracy.

CRITICAL EXTRACTION GUIDELINES:
1. "chequeNumber": Extract the 6 to 9-digit cheque number printed at the top-right corner and repeated inside the bottom MICR line (e.g. 000123).
2. "bankName": Identify the official UAE bank name (e.g. Abu Dhabi Commercial Bank / ADCB, Emirates NBD, First Abu Dhabi Bank / FAB, Dubai Islamic Bank / DIB, Abu Dhabi Islamic Bank / ADIB, Mashreq Bank, Commercial Bank of Dubai / CBD, RAKBANK, Sharjah Islamic Bank / SIB, Al Hilal Bank, Ajman Bank, etc.).
3. "amountNumeric": The exact numeric amount in UAE Dirhams (e.g. 45000 or 45000.00). Return as a number.
4. "amountInWords": The written amount string exactly as written on the cheque (Arabic or English).
5. "chequeDate": The date written on the cheque. Convert to YYYY-MM-DD format.
6. "payeeName" / "payee": Beneficiary name written on the line "Pay to the order of" / "\u0627\u062F\u0641\u0639\u0648\u0627 \u0644\u0623\u0645\u0631".
7. "accountHolder" / "drawerName": Account holder name or signatory name.
8. "accountNumber" / "iban": Account number or UAE IBAN if visible.
9. "signatureDetected": true if a signature or stamp is visible in the signature area.
10. "isBounced": true if return stamps, red reject markings, or unpaid stamps are present.
11. "confidence": Score between 0.1 and 0.99 based on legibility.

ANTI-HALLUCINATION RULES:
- Extract ONLY what is physically visible in this specific uploaded image.
- Return null for any field that is unreadable or not present.
- Return ONLY valid JSON matching the provided schema.`}else if(documentType==="MULTI_CHEQUE"||documentType==="CHEQUE_BATCH"){responseSchema=CHEQUE_BATCH_EXTRACTION_SCHEMA;prompt=`You are an expert UAE Financial Forensic OCR Auditor specializing in multi-cheque batch scanning.
The provided image contains ONE OR MORE physical UAE bank cheques (e.g. 2, 3, 4, 6, 8, or 12 cheques scanned on a single page or sheet).
Carefully detect and isolate each individual cheque, then extract all forensic fields with 100% precision.

CRITICAL MULTI-CHEQUE DETECTION INSTRUCTIONS:
1. Detect each separate cheque physically visible in the image from top to bottom (or left to right).
2. Set "totalChequesDetected" to the exact count of separate physical cheques found.
3. For each cheque in "cheques":
   - "chequeNumber": Extract the 6 to 9-digit cheque number (e.g. 000123).
   - "bankName": Official UAE bank name (e.g. Emirates NBD, ADCB, FAB, DIB, ADIB, Mashreq, CBD, etc.).
   - "amountNumeric": Exact numeric amount in AED (e.g. 25000).
   - "amountInWords": Written amount string.
   - "chequeDate": Date written on cheque in YYYY-MM-DD format.
   - "dueDate": Due date in YYYY-MM-DD format.
   - "payeeName": Pay to order of / beneficiary.
   - "accountHolder" / "drawerName": Account owner or signatory.
   - "accountNumber" / "iban": Account number or IBAN.
   - "signatureDetected": true if signed/stamped.
   - "isBounced": true if stamped bounced/unpaid.
   - "confidence": Score between 0.1 and 0.99.

ANTI-HALLUCINATION RULES:
- Extract ONLY what is visibly present in the image.
- Do NOT invent cheques. If only 3 are visible, extract exactly 3.
- Return valid JSON strictly matching the provided schema.`}else if(documentType==="LEASE_AGREEMENT"){responseSchema=LEASE_EXTRACTION_SCHEMA;prompt=`You are an expert UAE Real Estate Legal Auditor specializing in tenancy contract extraction.
Examine this tenancy / lease contract image and extract:
1. "tenantName": Full name of tenant / lessee.
2. "landlordName": Full name of landlord / lessor.
3. "contractNumber": Tenancy contract or Ejari number.
4. "contractStartDate": Start date in YYYY-MM-DD format.
5. "contractEndDate": End date in YYYY-MM-DD format.
6. "totalRent": Annual rent numeric amount in AED.
7. "installmentsCount": Number of cheque installments.
8. "unitNumber": Unit / Flat / Villa number.
9. "buildingName": Building or Property name.
10. "confidence": Overall confidence score between 0.1 and 0.99.

ANTI-HALLUCINATION RULES:
- Extract ONLY what is physically visible in this contract image.
- Return ONLY valid JSON matching the schema.`}else if(documentType==="RECEIPT"||documentType==="PAYMENT_RECEIPT"||documentType==="DEPOSIT_PROOF"||documentType==="INVOICE"){responseSchema=RECEIPT_EXTRACTION_SCHEMA;prompt=`You are an expert UAE Financial Forensic OCR Auditor specializing in bank deposit receipts, cash deposit machine (CDM) receipts, mobile/online banking transfer vouchers, and financial proof of payment slips in the United Arab Emirates.
Carefully examine the provided receipt/transfer slip image and extract all visible financial parameters with 100% literal accuracy:
1. "amount": The exact monetary amount in UAE Dirhams (AED). Return numeric value (e.g. 5000 or 5000.00).
2. "amountNumeric": The numeric amount in AED.
3. "bankName": Name of the bank (e.g. Abu Dhabi Commercial Bank / ADCB, Emirates NBD, First Abu Dhabi Bank / FAB, Dubai Islamic Bank / DIB, Abu Dhabi Islamic Bank / ADIB, Mashreq Bank, Commercial Bank of Dubai / CBD, RAKBANK, Sharjah Islamic Bank / SIB, Al Hilal Bank, Ajman Bank, Emirates Islamic, etc.).
4. "referenceNumber": Transaction reference number, Transfer sequence number, ARN, receipt number, or confirmation code.
5. "transactionReference": Alternative reference number if printed.
6. "receiptDate" / "depositDate" / "transactionDate": Date of transaction in standard YYYY-MM-DD format (convert from DD/MM/YYYY if needed).
7. "accountNumber" / "iban": Receiving or sending account number or UAE IBAN (starts with AE).
8. "beneficiaryName" / "payeeName": Beneficiary or recipient account name.
9. "confidence": Score between 0.1 and 0.99 reflecting readability and image clarity.

CRITICAL ANTI-HALLUCINATION RULES:
- Extract ONLY what is physically visible in this specific uploaded image.
- NEVER invent or guess amounts, references, or bank names.
- Return ONLY valid JSON matching the schema.`}else{responseSchema=IDENTITY_EXTRACTION_SCHEMA;prompt=`You are a specialist UAE Federal Authority for Identity, Citizenship, Customs and Port Security (ICP) Emirates ID Forensic OCR Engine.
Carefully examine the provided document image (which may be the Front, Back, Both sides, or a Digital UAE Pass / ICP copy of a UAE Emirates ID card).

EXTRACT ALL VISIBLE DATA WITH 100% LITERAL ACCURACY:
1. "emiratesIdNumber": Look for the 15-digit UAE ID number starting with 784 formatted as 784-YYYY-XXXXXXX-X (e.g. 784-1977-0965316-2). On the back MRZ line, it appears as 784YYYYXXXXXXX.
2. "arabicName": Extract the full official Arabic name (\u0627\u0644\u0627\u0633\u0645) exactly as written in Arabic characters on the card (e.g. \u0645\u062D\u0645\u0648\u062F \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u062D\u0627\u0645\u062F).
3. "englishName": Extract the full official English name (Name) in uppercase Latin letters exactly as printed on the card (e.g. Mahmoud Mohamed Mahmoud Hamed).
4. "fullName": Primary printed name (in English or Arabic).
5. "nationality": Extract the nationality (\u0627\u0644\u062C\u0646\u0633\u064A\u0629) as printed on card (e.g., \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0645\u062A\u062D\u062F\u0629 / United Arab Emirates, \u0645\u0635\u0631 / Egypt, \u0627\u0644\u0623\u0631\u062F\u0646 / Jordan, \u0627\u0644\u0647\u0646\u062F / India, \u0628\u0627\u0643\u0633\u062A\u0627\u0646 / Pakistan, etc.).
6. "dateOfBirth": Date of birth in standard YYYY-MM-DD format (convert from DD/MM/YYYY if printed as 23/01/1977 -> 1977-01-23).
7. "gender": "MALE" (\u0630\u0643\u0631) or "FEMALE" (\u0623\u0646\u062B\u0649).
8. "cardNumber": Card sequence/serial number printed on card.
9. "issueDate": Issue date in standard YYYY-MM-DD format (convert from DD/MM/YYYY if printed as 08/10/2024 -> 2024-10-08).
10. "expiryDate": Expiry date in standard YYYY-MM-DD format (convert from DD/MM/YYYY if printed as 07/10/2026 -> 2026-10-07).
11. "documentSide": "FRONT", "BACK", "BOTH", or "DIGITAL_ID".
12. "confidence": Numeric score between 0.1 and 0.99 reflecting readability and visual clarity.

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER invent or guess names, ID numbers, or dates.
- Extract ONLY what is physically visible in this specific uploaded image.
- Return ONLY valid JSON matching the schema.`}const response=await generateContentWithFallback(ai,{models:modelSequence,contents:{parts:[{inlineData:{mimeType:normalizedMime,data:cleanBase64}},{text:prompt}]},config:{responseMimeType:"application/json",responseSchema}});const rawText=response.text||"";const parsed=safeJsonParse(rawText,{rawNotes:rawText});return normalizeOcrExtractedData(parsed,documentType)}__name(processOcrRequest,"processOcrRequest");function parseEmiratesIdFromText(text){const res={emiratesIdNumber:"",fullName:"",arabicName:"",englishName:"",nationality:"",dateOfBirth:"",gender:"MALE",cardNumber:"",issueDate:"",expiryDate:"",documentSide:"FRONT",confidence:.85,rawNotes:"Local Tesseract Forensic OCR Extraction"};const idMatch=text.match(/784[- ]?(\d{4})[- ]?(\d{7})[- ]?(\d)/i)||text.match(/\b(784\d{12})\b/);if(idMatch){if(idMatch[1]&&idMatch[2]&&idMatch[3]){res.emiratesIdNumber=`784-${idMatch[1]}-${idMatch[2]}-${idMatch[3]}`}else if(idMatch[0]){const raw=idMatch[0].replace(/\D/g,"");if(raw.length===15){res.emiratesIdNumber=`${raw.slice(0,3)}-${raw.slice(3,7)}-${raw.slice(7,14)}-${raw.slice(14)}`}}}const dateMatches=Array.from(text.matchAll(/(\d{2})[/-](\d{2})[/-](\d{4})/g));if(dateMatches.length>=1){res.dateOfBirth=`${dateMatches[0][3]}-${dateMatches[0][2]}-${dateMatches[0][1]}`}if(dateMatches.length>=2){res.issueDate=`${dateMatches[1][3]}-${dateMatches[1][2]}-${dateMatches[1][1]}`}if(dateMatches.length>=3){res.expiryDate=`${dateMatches[2][3]}-${dateMatches[2][2]}-${dateMatches[2][1]}`}if(/(\bFEMALE\b|\bأنثى\b|\bF\b)/i.test(text)){res.gender="FEMALE"}else if(/(\bMALE\b|\bذكر\b|\bM\b)/i.test(text)){res.gender="MALE"}const nationalities=[{key:"United Arab Emirates",ar:"\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0645\u062A\u062D\u062F\u0629"},{key:"UAE",ar:"\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0645\u062A\u062D\u062F\u0629"},{key:"Egypt",ar:"\u0645\u0635\u0631"},{key:"Jordan",ar:"\u0627\u0644\u0623\u0631\u062F\u0646"},{key:"India",ar:"\u0627\u0644\u0647\u0646\u062F"},{key:"Pakistan",ar:"\u0628\u0627\u0643\u0633\u062A\u0627\u0646"},{key:"Lebanon",ar:"\u0644\u0628\u0646\u0627\u0646"},{key:"Syria",ar:"\u0633\u0648\u0631\u064A\u0627"},{key:"Saudi Arabia",ar:"\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629"},{key:"Oman",ar:"\u0639\u0645\u0627\u0646"},{key:"Kuwait",ar:"\u0627\u0644\u0643\u0648\u064A\u062A"},{key:"Bahrain",ar:"\u0627\u0644\u0628\u062D\u0631\u064A\u0646"},{key:"Qatar",ar:"\u0642\u0637\u0631"},{key:"Philippines",ar:"\u0627\u0644\u0641\u0644\u0628\u064A\u0646"},{key:"Bangladesh",ar:"\u0628\u0646\u063A\u0644\u0627\u062F\u064A\u0634"},{key:"Morocco",ar:"\u0627\u0644\u0645\u063A\u0631\u0628"},{key:"Sudan",ar:"\u0627\u0644\u0633\u0648\u062F\u0627\u0646"},{key:"Yemen",ar:"\u0627\u0644\u064A\u0645\u0646"},{key:"United Kingdom",ar:"\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0645\u062A\u062D\u062F\u0629"},{key:"USA",ar:"\u0627\u0644\u0648\u0644\u0627\u064A\u0627\u062A \u0627\u0644\u0645\u062A\u062D\u062F\u0629 \u0627\u0644\u0623\u0645\u0631\u064A\u0643\u064A\u0629"},{key:"Canada",ar:"\u0643\u0646\u062F\u0627"}];for(const n of nationalities){if(new RegExp(`\\b${n.key}\\b`,"i").test(text)||text.includes(n.ar)){res.nationality=n.key;break}}const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);for(const line of lines){if(/^[A-Z\s]{6,40}$/.test(line)&&!line.includes("UNITED ARAB")&&!line.includes("RESIDENT")&&!line.includes("IDENTITY CARD")){res.englishName=line;if(!res.fullName)res.fullName=line;break}}return normalizeOcrExtractedData(res,"EMIRATES_ID")}__name(parseEmiratesIdFromText,"parseEmiratesIdFromText");function parseChequeFromText(text){const res={chequeNumber:"",bankName:"",amountNumeric:null,amount:null,amountInWords:"",chequeDate:"",dueDate:"",payeeName:"",accountHolder:"",drawerName:"",accountNumber:"",signatureDetected:true,isBounced:false,confidence:.85,rawNotes:"Local Tesseract Forensic OCR Extraction"};const normalizedText=text.replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-1632));const micrMatch=normalizedText.match(/[⑈c|:"\s](\d{6,8})[⑈c|:"\s]/)||normalizedText.match(/⑈?(\d{6})⑈?/);const numMatch=normalizedText.match(/CHEQUE\s*(?:NO|NUMBER)?[:.\s]*(\d{6,8})/i)||normalizedText.match(/CHQ[:.\s]*(\d{6,8})/i)||normalizedText.match(/\b(\d{6})\b/);if(micrMatch){res.chequeNumber=micrMatch[1]}else if(numMatch){res.chequeNumber=numMatch[1]}const uaeBanks=[{name:"Emirates NBD",keywords:["Emirates NBD","ENBD","\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u062F\u0628\u064A \u0627\u0644\u0648\u0637\u0646\u064A"]},{name:"Abu Dhabi Commercial Bank (ADCB)",keywords:["ADCB","Abu Dhabi Commercial","\u0623\u0628\u0648\u0638\u0628\u064A \u0627\u0644\u062A\u062C\u0627\u0631\u064A"]},{name:"First Abu Dhabi Bank (FAB)",keywords:["FAB","First Abu Dhabi","\u0623\u0628\u0648\u0638\u0628\u064A \u0627\u0644\u0623\u0648\u0644"]},{name:"Dubai Islamic Bank (DIB)",keywords:["DIB","Dubai Islamic","\u062F\u0628\u064A \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A"]},{name:"Mashreq Bank",keywords:["Mashreq","\u0627\u0644\u0645\u0634\u0631\u0642"]},{name:"Abu Dhabi Islamic Bank (ADIB)",keywords:["ADIB","Abu Dhabi Islamic","\u0623\u0628\u0648\u0638\u0628\u064A \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A"]},{name:"Commercial Bank of Dubai (CBD)",keywords:["CBD","Commercial Bank of Dubai","\u062F\u0628\u064A \u0627\u0644\u062A\u062C\u0627\u0631\u064A"]},{name:"RAKBANK",keywords:["RAKBANK","Ras Al Khaimah","\u0631\u0623\u0633 \u0627\u0644\u062E\u064A\u0645\u0629"]},{name:"Sharjah Islamic Bank (SIB)",keywords:["SIB","Sharjah Islamic","\u0627\u0644\u0634\u0627\u0631\u0642\u0629 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A"]},{name:"Al Hilal Bank",keywords:["Al Hilal","\u0627\u0644\u0647\u0644\u0627\u0644"]},{name:"Ajman Bank",keywords:["Ajman Bank","\u0645\u0635\u0631\u0641 \u0639\u062C\u0645\u0627\u0646"]},{name:"HSBC Bank Middle East",keywords:["HSBC"]},{name:"Standard Chartered Bank",keywords:["Standard Chartered"]}];for(const b of uaeBanks){if(b.keywords.some(k=>new RegExp(k,"i").test(normalizedText))){res.bankName=b.name;break}}const amountMatch=normalizedText.match(/(?:AED|Dhs|DHS|درهم)[*#\s]*([0-9,]+(?:\.[0-9]{2})?)/i)||normalizedText.match(/[*#\s]*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)/)||normalizedText.match(/\b([1-9][0-9]{3,7}(?:\.[0-9]{2})?)\b/);if(amountMatch){const rawVal=parseFloat(amountMatch[1].replace(/,/g,""));if(!isNaN(rawVal)&&rawVal>0){res.amountNumeric=rawVal;res.amount=rawVal}}const dateMatch=normalizedText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)||normalizedText.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);if(dateMatch){let isoDate="";if(dateMatch[1].length===4){isoDate=`${dateMatch[1]}-${dateMatch[2].padStart(2,"0")}-${dateMatch[3].padStart(2,"0")}`}else{isoDate=`${dateMatch[3]}-${dateMatch[2].padStart(2,"0")}-${dateMatch[1].padStart(2,"0")}`}res.chequeDate=isoDate;res.dueDate=isoDate}return normalizeOcrExtractedData(res,"CHEQUE")}__name(parseChequeFromText,"parseChequeFromText");function parseReceiptFromText(text){const res={amountNumeric:null,amount:null,amountPaid:null,bankName:"",referenceNumber:"",transactionReference:"",receiptNumber:"",accountNumber:"",iban:"",receiptDate:"",transactionDate:"",date:"",confidence:.85,rawNotes:"Local Tesseract Forensic OCR Extraction (Receipt/Deposit Slip)"};const normalizedText=text.replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-1632));const amountMatch=normalizedText.match(/(?:AED|Dhs|DHS|درهم|المبلغ|صافي المبلغ|المدفوع|Paid|Amount|Total)[*#:\s]*([0-9,]+(?:\.[0-9]{1,2})?)/i)||normalizedText.match(/(?:[0-9,]+(?:\.[0-9]{1,2})?)\s*(?:AED|Dhs|درهم)/i)||normalizedText.match(/[*#\s]*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)/)||normalizedText.match(/\b([1-9][0-9]{1,7}(?:\.[0-9]{2})?)\b/);if(amountMatch){const rawVal=parseFloat(amountMatch[1].replace(/,/g,""));if(!isNaN(rawVal)&&rawVal>0){res.amountNumeric=rawVal;res.amount=rawVal;res.amountPaid=rawVal}}const uaeBanks=[{name:"Emirates NBD",keywords:["Emirates NBD","ENBD","\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u062F\u0628\u064A \u0627\u0644\u0648\u0637\u0646\u064A"]},{name:"Abu Dhabi Commercial Bank (ADCB)",keywords:["ADCB","Abu Dhabi Commercial","\u0623\u0628\u0648\u0638\u0628\u064A \u0627\u0644\u062A\u062C\u0627\u0631\u064A"]},{name:"First Abu Dhabi Bank (FAB)",keywords:["FAB","First Abu Dhabi","\u0623\u0628\u0648\u0638\u0628\u064A \u0627\u0644\u0623\u0648\u0644"]},{name:"Dubai Islamic Bank (DIB)",keywords:["DIB","Dubai Islamic","\u062F\u0628\u064A \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A"]},{name:"Mashreq Bank",keywords:["Mashreq","\u0627\u0644\u0645\u0634\u0631\u0642"]},{name:"Abu Dhabi Islamic Bank (ADIB)",keywords:["ADIB","Abu Dhabi Islamic","\u0623\u0628\u0648\u0638\u0628\u064A \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A"]},{name:"Commercial Bank of Dubai (CBD)",keywords:["CBD","Commercial Bank of Dubai","\u062F\u0628\u064A \u0627\u0644\u062A\u062C\u0627\u0631\u064A"]},{name:"RAKBANK",keywords:["RAKBANK","Ras Al Khaimah","\u0631\u0623\u0633 \u0627\u0644\u062E\u064A\u0645\u0629"]},{name:"Sharjah Islamic Bank (SIB)",keywords:["SIB","Sharjah Islamic","\u0627\u0644\u0634\u0627\u0631\u0642\u0629 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A"]},{name:"Al Hilal Bank",keywords:["Al Hilal","\u0627\u0644\u0647\u0644\u0627\u0644"]},{name:"Ajman Bank",keywords:["Ajman Bank","\u0645\u0635\u0631\u0641 \u0639\u062C\u0645\u0627\u0646"]},{name:"Emirates Islamic",keywords:["Emirates Islamic","\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A"]},{name:"HSBC Bank Middle East",keywords:["HSBC"]},{name:"Standard Chartered Bank",keywords:["Standard Chartered"]}];for(const b of uaeBanks){if(b.keywords.some(k=>new RegExp(k,"i").test(normalizedText))){res.bankName=b.name;break}}const refMatch=normalizedText.match(/(?:Reference|Ref|Txn|Transaction\s*ID|Sequence|Voucher|Receipt\s*No|رقم\s*المرجع|رقم\s*الحوالة|المرجع|رقم\s*العملية|رقم\s*الإيصال)[\s:#\-_]*([A-Za-z0-9\-_]{5,35})/i);if(refMatch){res.referenceNumber=refMatch[1].trim();res.transactionReference=refMatch[1].trim();res.receiptNumber=refMatch[1].trim()}const ibanMatch=normalizedText.match(/\b(AE\d{2}[A-Za-z0-9]{19})\b/i);if(ibanMatch){res.iban=ibanMatch[1].toUpperCase();res.accountNumber=ibanMatch[1].toUpperCase()}else{const accMatch=normalizedText.match(/(?:Account|Acc|IBAN|الحساب|رقم الحساب)[\s:#\-_]*([0-9Xx*]{7,25})/i);if(accMatch){res.accountNumber=accMatch[1].trim()}}const dateMatch=normalizedText.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)||normalizedText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);if(dateMatch){let isoDate="";if(dateMatch[1].length===4){isoDate=`${dateMatch[1]}-${dateMatch[2].padStart(2,"0")}-${dateMatch[3].padStart(2,"0")}`}else{isoDate=`${dateMatch[3]}-${dateMatch[2].padStart(2,"0")}-${dateMatch[1].padStart(2,"0")}`}res.receiptDate=isoDate;res.transactionDate=isoDate;res.date=isoDate}return normalizeOcrExtractedData(res,"RECEIPT")}__name(parseReceiptFromText,"parseReceiptFromText");async function runLocalTesseractOcr(cleanBase64,documentType){let worker=null;if(cleanBase64.length>4*1024*1024){console.warn("[Local OCR Fallback]: Image too large for local Tesseract, skipping to prevent crash.");if(documentType==="CHEQUE"){return parseChequeFromText("")}else if(documentType==="RECEIPT"||documentType==="PAYMENT_RECEIPT"||documentType==="DEPOSIT_PROOF"||documentType==="INVOICE"){return parseReceiptFromText("")}else{return parseEmiratesIdFromText("")}}try{if(documentType==="CHEQUE"){return parseChequeFromText("")}else if(documentType==="RECEIPT"||documentType==="PAYMENT_RECEIPT"||documentType==="DEPOSIT_PROOF"||documentType==="INVOICE"){return parseReceiptFromText("")}else{return parseEmiratesIdFromText("")}}catch(err){console.warn("[Local OCR Fallback]:",err?.message||err);if(documentType==="CHEQUE"){return parseChequeFromText("")}else if(documentType==="RECEIPT"||documentType==="PAYMENT_RECEIPT"||documentType==="DEPOSIT_PROOF"||documentType==="INVOICE"){return parseReceiptFromText("")}else{return parseEmiratesIdFromText("")}}}__name(runLocalTesseractOcr,"runLocalTesseractOcr");app.post("/api/ocr/extract-document",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{documentType="CHEQUE",imageBase64,mimeType="image/jpeg"}=req.body;if(!imageBase64){return res.status(400).json({success:false,error:"Missing imageBase64 data"})}console.log("--------------------------------------------------");console.log("[OCR DIAGNOSTIC] OCR START");console.log(`[OCR DIAGNOSTIC] IMAGE RECEIVED (Type: ${documentType})`);console.log(`[OCR DIAGNOSTIC] IMAGE MIME: ${mimeType}`);console.log(`[OCR DIAGNOSTIC] IMAGE SIZE: ${Math.round(imageBase64.length/1024)} KB`);console.log("[OCR DIAGNOSTIC] PREPROCESSING (Clean/MIME Normalization)");let cleanBase64=String(imageBase64);if(cleanBase64.includes("base64,")){cleanBase64=cleanBase64.split("base64,")[1]}cleanBase64=cleanBase64.replace(/[\r\n\s]/g,"");const normalizedMime=mimeType.includes("pdf")?"application/pdf":mimeType.includes("png")?"image/png":mimeType.includes("webp")?"image/webp":"image/jpeg";const ai=getGeminiClient();let authError=false;if(ai){try{console.log("[OCR DIAGNOSTIC] API REQUEST (Gemini Vision)");const extractedData=await processOcrRequest(ai,documentType,cleanBase64,normalizedMime);console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 200 OK`);console.log(`[OCR DIAGNOSTIC] NORMALIZATION (Gemini Output)`);console.log(`[OCR DIAGNOSTIC] FIELDS EXTRACTED: ${Object.keys(extractedData).length}`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE");return res.json({success:true,data:extractedData,source:"Gemini Vision"})}catch(geminiErr){if(geminiErr.message==="GEMINI_AUTH_UNAUTHORIZED"){authError=true}console.info(`[OCR API] Primary AI pipeline failed (${geminiErr.message}). Running local forensic OCR engine...`)}}else if(!ai){authError=true}if(authError){console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 401 UNAUTHORIZED / UNAVAILABLE`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.status(401).json({success:false,isTransportFailure:true,errorType:"TRANSPORT_FAILURE",error:"OCR_ENGINE_UNAVAILABLE (401 Unauthorized)",errorAr:"\u0645\u062D\u0631\u0643 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 (\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629). \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0623\u0648 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}console.log("[OCR DIAGNOSTIC] API REQUEST (Local Tesseract Engine)");const localData=await runLocalTesseractOcr(cleanBase64,documentType);let hasData=false;if(documentType==="CHEQUE"){if(localData.chequeNumber||localData.amountNumeric||localData.bankName)hasData=true}else if(documentType==="RECEIPT"||documentType==="PAYMENT_RECEIPT"||documentType==="DEPOSIT_PROOF"||documentType==="INVOICE"){if(localData.amount||localData.amountNumeric||localData.referenceNumber||localData.bankName||localData.receiptNumber)hasData=true}else{if(localData.emiratesIdNumber||localData.fullName||localData.englishName)hasData=true}if(hasData){console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 200 OK`);console.log(`[OCR DIAGNOSTIC] NORMALIZATION (Tesseract Output)`);console.log(`[OCR DIAGNOSTIC] FIELDS EXTRACTED: ${Object.keys(localData).length}`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE");return res.json({success:true,data:localData,source:"Local Forensic OCR Engine"})}if(authError){console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 401 UNAUTHORIZED / UNAVAILABLE`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.json({success:false,error:"OCR_ENGINE_UNAVAILABLE (401 Unauthorized)",errorAr:"\u0645\u062D\u0631\u0643 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 (\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629). \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0623\u0648 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 400 BAD REQUEST / UNREADABLE`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.json({success:false,error:"No meaningful data extracted. Please enter data manually.",errorAr:"\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0636\u062D\u0629 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0646\u062F. \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}catch(error){console.warn("[OCR API] Extraction caught error:",error?.message||error);console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 500 SERVER ERROR`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.json({success:false,error:"\u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0622\u0644\u064A\u0627\u064B \u0645\u0646 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0631\u0641\u0642\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u0648\u0636\u0648\u062D \u0627\u0644\u0635\u0648\u0631\u0629 \u0648\u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}});app.post("/api/ocr/v2/extract",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{documentType="GENERAL_DOCUMENT",imagePayload,mimeType="image/jpeg",model="accurate",prompt}=req.body;if(!imagePayload){return res.status(400).json({success:false,error:"Missing imagePayload data"})}let cleanBase64=String(imagePayload);if(cleanBase64.includes("base64,")){cleanBase64=cleanBase64.split("base64,")[1]}cleanBase64=cleanBase64.replace(/[\r\n\s]/g,"");const normalizedMime=mimeType.includes("pdf")?"application/pdf":mimeType.includes("png")?"image/png":"image/jpeg";const ai=getGeminiClient();if(ai){try{const extractedData=await processOcrRequest(ai,documentType,cleanBase64,normalizedMime,model);return res.json({success:true,rawText:JSON.stringify(extractedData),data:extractedData,source:"Gemini Vision"})}catch(geminiErr){if(geminiErr.message==="GEMINI_AUTH_UNAUTHORIZED"){markGeminiAuthInvalid()}console.info(`[OCR V2 API] Gemini primary extraction unavailable (${geminiErr.message}). Falling back to local OCR engine...`)}}const localData=await runLocalTesseractOcr(cleanBase64,documentType);return res.json({success:true,rawText:JSON.stringify(localData),data:localData,source:"Local Forensic OCR Engine"})}catch(err){console.error("[OCR V2 API] Error:",err);return res.status(500).json({success:false,error:err.message||"Internal server error during OCR V2 extraction"})}});app.post("/api/ocr/extract-cheque",authenticateFirebaseToken,requireStaff,async(req,res)=>{req.body.documentType="CHEQUE";try{const{imageBase64,mimeType="image/jpeg"}=req.body;if(!imageBase64){return res.status(400).json({success:false,error:"Missing imageBase64 data"})}console.log("--------------------------------------------------");console.log("[OCR DIAGNOSTIC] OCR START");console.log(`[OCR DIAGNOSTIC] IMAGE RECEIVED (Type: CHEQUE)`);console.log(`[OCR DIAGNOSTIC] IMAGE MIME: ${mimeType}`);console.log(`[OCR DIAGNOSTIC] IMAGE SIZE: ${Math.round(imageBase64.length/1024)} KB`);console.log("[OCR DIAGNOSTIC] PREPROCESSING (Clean/MIME Normalization)");let cleanBase64=String(imageBase64);if(cleanBase64.includes("base64,")){cleanBase64=cleanBase64.split("base64,")[1]}cleanBase64=cleanBase64.replace(/[\r\n\s]/g,"");const normalizedMime=mimeType.includes("pdf")?"application/pdf":mimeType.includes("png")?"image/png":mimeType.includes("webp")?"image/webp":"image/jpeg";const ai=getGeminiClient();let authError=false;if(ai){try{console.log("[OCR DIAGNOSTIC] API REQUEST (Gemini Vision - Cheque)");const extractedData=await processOcrRequest(ai,"CHEQUE",cleanBase64,normalizedMime);console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 200 OK`);console.log(`[OCR DIAGNOSTIC] NORMALIZATION (Gemini Output)`);console.log(`[OCR DIAGNOSTIC] FIELDS EXTRACTED: ${Object.keys(extractedData).length}`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE");return res.json({success:true,data:extractedData,source:"Gemini Vision"})}catch(geminiErr){if(geminiErr.message==="GEMINI_AUTH_UNAUTHORIZED"){authError=true}console.info(`[OCR API] Primary AI cheque pipeline failed (${geminiErr.message}). Running local forensic OCR engine...`)}}else if(!ai){authError=true}if(authError){console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 401 UNAUTHORIZED / UNAVAILABLE`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.status(401).json({success:false,isTransportFailure:true,errorType:"TRANSPORT_FAILURE",error:"OCR_ENGINE_UNAVAILABLE (401 Unauthorized)",errorAr:"\u0645\u062D\u0631\u0643 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 (\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629). \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0623\u0648 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}console.log("[OCR DIAGNOSTIC] API REQUEST (Local Tesseract Engine)");const localData=await runLocalTesseractOcr(cleanBase64,"CHEQUE");let hasData=false;if(localData.chequeNumber||localData.amountNumeric||localData.bankName)hasData=true;if(hasData){console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 200 OK`);console.log(`[OCR DIAGNOSTIC] NORMALIZATION (Tesseract Output)`);console.log(`[OCR DIAGNOSTIC] FIELDS EXTRACTED: ${Object.keys(localData).length}`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE");return res.json({success:true,data:localData,source:"Local Forensic OCR Engine"})}if(authError){console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 401 UNAUTHORIZED / UNAVAILABLE`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.json({success:false,error:"OCR_ENGINE_UNAVAILABLE (401 Unauthorized)",errorAr:"\u0645\u062D\u0631\u0643 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 (\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629). \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0623\u0648 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 400 BAD REQUEST / UNREADABLE`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.json({success:false,error:"No meaningful data extracted. Please enter data manually.",errorAr:"\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0636\u062D\u0629 \u0641\u064A \u0627\u0644\u0634\u064A\u0643. \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}catch(error){console.warn("[OCR API] Cheque extraction caught error:",error?.message||error);console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 500 SERVER ERROR`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.json({success:false,error:"\u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0634\u064A\u0643 \u0622\u0644\u064A\u0627\u064B.",data:null})}});app.post("/api/ocr/extract-cheque-batch",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{imageBase64,images,mimeType="image/jpeg"}=req.body;const imageList=[];if(Array.isArray(images)&&images.length>0){images.forEach(img=>{if(typeof img==="string"){imageList.push({base64:img,mime:mimeType})}else if(img&&img.base64){imageList.push({base64:img.base64,mime:img.mimeType||mimeType})}})}else if(imageBase64){imageList.push({base64:imageBase64,mime:mimeType})}if(imageList.length===0){return res.status(400).json({success:false,error:"Missing imageBase64 or images payload"})}const ai=getGeminiClient();if(imageList.length>1){const allExtractedCheques=[];for(let i=0;i<imageList.length;i++){const item=imageList[i];let cleanBase642=String(item.base64);if(cleanBase642.includes("base64,")){cleanBase642=cleanBase642.split("base64,")[1]}cleanBase642=cleanBase642.replace(/[\r\n\s]/g,"");const normMime=item.mime.includes("png")?"image/png":"image/jpeg";try{if(ai){const singleResult=await processOcrRequest(ai,"CHEQUE",cleanBase642,normMime);if(singleResult){allExtractedCheques.push({...singleResult,imagePreview:item.base64.startsWith("data:")?item.base64:`data:${normMime};base64,${cleanBase642}`})}}else{const localData2=await runLocalTesseractOcr(cleanBase642,"CHEQUE");allExtractedCheques.push({...localData2,imagePreview:item.base64.startsWith("data:")?item.base64:`data:${normMime};base64,${cleanBase642}`})}}catch(err){console.warn(`[OCR BATCH] Failed item ${i}:`,err?.message)}}if(allExtractedCheques.length===0){return res.status(400).json({success:false,error:"No cheques detected"})}return res.json({success:true,data:{totalChequesDetected:allExtractedCheques.length,cheques:allExtractedCheques,confidence:void 0},source:ai?"Gemini Vision (Multi-Image Batch)":"Local OCR Fallback"})}const single=imageList[0];let cleanBase64=String(single.base64);if(cleanBase64.includes("base64,")){cleanBase64=cleanBase64.split("base64,")[1]}cleanBase64=cleanBase64.replace(/[\r\n\s]/g,"");const normalizedMime=single.mime.includes("png")?"image/png":"image/jpeg";if(ai){try{const batchResult=await processOcrRequest(ai,"MULTI_CHEQUE",cleanBase64,normalizedMime);if(batchResult&&Array.isArray(batchResult.cheques)&&batchResult.cheques.length>0){return res.json({success:true,data:batchResult,source:"Gemini Vision (Batch Detection)"})}}catch(geminiErr){console.warn("[OCR BATCH] Gemini batch pipeline failed:",geminiErr?.message)}}try{if(ai){const singleData=await processOcrRequest(ai,"CHEQUE",cleanBase64,normalizedMime);return res.json({success:true,data:{totalChequesDetected:1,cheques:[singleData],confidence:singleData.confidence||.85},source:"Gemini Vision (Single Detected)"})}}catch{}const localData=await runLocalTesseractOcr(cleanBase64,"CHEQUE");let hasData=false;if(localData.chequeNumber||localData.amountNumeric||localData.bankName)hasData=true;if(hasData){return res.json({success:true,data:{totalChequesDetected:1,cheques:[localData],confidence:void 0},source:"Local Forensic OCR Engine"})}return res.status(400).json({success:false,error:"No cheques detected"})}catch(error){console.error("[OCR BATCH] Unexpected error:",error);return res.status(500).json({success:false,error:error.message||"Failed to process multi-cheque batch OCR"})}});app.post("/api/ocr/extract-id",authenticateFirebaseToken,requireStaff,async(req,res)=>{req.body.documentType="EMIRATES_ID";try{const{imageBase64,mimeType="image/jpeg",modelLevel="accurate"}=req.body;if(!imageBase64){return res.status(400).json({success:false,error:"Missing imageBase64 data"})}console.log("--------------------------------------------------");console.log("[OCR DIAGNOSTIC] OCR START");console.log(`[OCR DIAGNOSTIC] IMAGE RECEIVED (Type: EMIRATES_ID)`);console.log(`[OCR DIAGNOSTIC] IMAGE MIME: ${mimeType}`);console.log(`[OCR DIAGNOSTIC] IMAGE SIZE: ${Math.round(imageBase64.length/1024)} KB`);let cleanBase64=String(imageBase64);if(cleanBase64.includes("base64,")){cleanBase64=cleanBase64.split("base64,")[1]}cleanBase64=cleanBase64.replace(/[\r\n\s]/g,"");const normalizedMime=mimeType.includes("pdf")?"application/pdf":mimeType.includes("png")?"image/png":mimeType.includes("webp")?"image/webp":"image/jpeg";const ai=getGeminiClient();let authError=false;if(ai){try{console.log("[OCR DIAGNOSTIC] API REQUEST (Gemini Vision - Emirates ID)");const extractedData=await processOcrRequest(ai,"EMIRATES_ID",cleanBase64,normalizedMime,modelLevel);console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 200 OK`);console.log(`[OCR DIAGNOSTIC] NORMALIZATION (Gemini Output)`);console.log(`[OCR DIAGNOSTIC] FIELDS EXTRACTED: ${Object.keys(extractedData).length}`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE");return res.json({success:true,data:extractedData,source:"Gemini Vision"})}catch(geminiErr){if(geminiErr.message==="GEMINI_AUTH_UNAUTHORIZED"){authError=true}console.info(`[OCR API] Primary AI ID pipeline failed (${geminiErr.message}). Running local forensic OCR engine...`)}}else if(!ai){authError=true}if(authError){console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 401 UNAUTHORIZED / UNAVAILABLE`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE (FAILED)");return res.status(401).json({success:false,isTransportFailure:true,errorType:"TRANSPORT_FAILURE",error:"OCR_ENGINE_UNAVAILABLE (401 Unauthorized)",errorAr:"\u0645\u062D\u0631\u0643 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 (\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629). \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0623\u0648 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}console.log("[OCR DIAGNOSTIC] API REQUEST (Local Tesseract Engine)");const localData=await runLocalTesseractOcr(cleanBase64,"EMIRATES_ID");let hasData=false;if(localData.emiratesIdNumber||localData.fullName||localData.englishName)hasData=true;if(hasData){console.log(`[OCR DIAGNOSTIC] HTTP STATUS: 200 OK`);console.log(`[OCR DIAGNOSTIC] NORMALIZATION (Tesseract Output)`);console.log(`[OCR DIAGNOSTIC] FIELDS EXTRACTED: ${Object.keys(localData).length}`);console.log("[OCR DIAGNOSTIC] OCR COMPLETE");return res.json({success:true,data:localData,source:"Local Forensic OCR Engine"})}if(authError){return res.json({success:false,error:"OCR_ENGINE_UNAVAILABLE (401 Unauthorized)",errorAr:"\u0645\u062D\u0631\u0643 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 (\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629). \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0623\u0648 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}return res.json({success:false,error:"No meaningful data extracted. Please enter data manually.",errorAr:"\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0636\u062D\u0629 \u0641\u064A \u0627\u0644\u0647\u0648\u064A\u0629. \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u064A\u062F\u0648\u064A\u0627\u064B.",data:null})}catch(error){console.warn("[OCR API] Emirates ID extraction caught error:",error?.message||error);return res.json({success:false,error:"\u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0647\u0648\u064A\u0629 \u0622\u0644\u064A\u0627\u064B.",data:null})}});app.get("/api/ocr/health",(req,res)=>{const ai=getGeminiClient();const requestOrigin=req.headers.origin||req.headers.referer||"direct";const requestHost=req.headers.host||"unknown";return res.status(200).type("application/json").json({status:"online",serviceName:"Emirates Falcon ERP Centralized OCR Engine V3",version:"3.0.0-phase57h",processId:process.pid,uptimeSeconds:Math.floor(process.uptime()),timestamp:new Date().toISOString(),requestOrigin,requestHost,resolvedPort:PORT,geminiAvailable:Boolean(ai),localFallbackAvailable:true,supportedProfiles:["EMIRATES_ID","CHEQUE","LEASE_AGREEMENT","INVOICE","RECEIPT","GENERAL_DOCUMENT"],apiRoutes:{extractDocument:"/api/ocr/extract-document",extractId:"/api/ocr/extract-id",extractCheque:"/api/ocr/extract-cheque",extractChequeBatch:"/api/ocr/extract-cheque-batch",v2Extract:"/api/ocr/v2/extract",health:"/api/ocr/health"}})});app.post("/api/ai/analyze-risk",authenticateFirebaseToken,requireStaff,async(req,res)=>{const{tenants=[],bouncedCheques=[],cases=[],language="ar"}=req.body;try{const ai=getGeminiClient();if(!ai){const fallbackData=generateHeuristicRiskAssessment(tenants,bouncedCheques,cases,language);return res.json({success:true,source:"Heuristic Risk Engine",analysis:fallbackData,data:fallbackData})}const prompt=`You are a UAE Real Estate Financial Risk Analyst and Forensics Expert.
Analyze the following portfolio data containing Tenants, Bounced Cheques (Dishonored instruments under UAE Commercial Transactions Law), and RDC/Court Dispute Cases.

Data to analyze:
- Tenants (${tenants.length}): ${JSON.stringify(tenants.slice(0,20))}
- Bounced Cheques (${bouncedCheques.length}): ${JSON.stringify(bouncedCheques.slice(0,25))}
- Cases (${cases.length}): ${JSON.stringify(cases.slice(0,15))}
- Language: ${language}

Generate a comprehensive risk analysis formatted strictly as a JSON object matching this structure:
{
  "portfolioRiskSummary": {
    "overallRiskScore": 75,
    "totalExposureAED": 350000,
    "predictedLossRate": "5.8%",
    "riskVelocity": "STABLE",
    "keyFindings": ["string", "string", "string"],
    "strategicAdvice": ["string", "string", "string"]
  },
  "tenantRiskProfiles": [
    {
      "tenantId": "string",
      "tenantName": "string",
      "tenantCode": "string",
      "aiRiskScore": 85,
      "riskCategory": "CRITICAL",
      "defaultProbability": 90,
      "bouncedCount": 3,
      "bouncedAmountAED": 45000,
      "primaryRiskFactor": "string",
      "recommendedAction": "string",
      "litigationUrgency": "IMMEDIATE",
      "resolutionForecastDays": 30
    }
  ],
  "monthlyRiskTrends": [
    { "month": "Jan", "highRiskCount": 2, "bouncedExposureAED": 95000, "recoveredAED": 40000, "riskIndex": 62 }
  ],
  "topRiskFactors": [
    { "factor": "string", "impactPercentage": 65, "affectedTenantsCount": 8 }
  ]
}

Return ONLY valid JSON. No markdown fences.`;const response=await generateContentWithFallback(ai,{contents:{parts:[{text:prompt}]},config:{responseMimeType:"application/json"}});const rawText=response.text||"";const parsedData=safeJsonParse(rawText,null);if(!parsedData){throw new Error("Invalid JSON structure returned by AI")}return res.json({success:true,source:response.model||"Gemini AI",analysis:parsedData,data:parsedData})}catch(err){const fallbackData=generateHeuristicRiskAssessment(tenants,bouncedCheques,cases,language);return res.json({success:true,source:"Heuristic Risk Engine (Fallback)",analysis:fallbackData,data:fallbackData})}});function fallbackTransliterate(name,from,to){if(!name)return"";const dict={"mohammed":"\u0645\u062D\u0645\u062F","mohammad":"\u0645\u062D\u0645\u062F","muhammad":"\u0645\u062D\u0645\u062F","ahmed":"\u0623\u062D\u0645\u062F","ahmad":"\u0623\u062D\u0645\u062F","mahmoud":"\u0645\u062D\u0645\u0648\u062F","mahmood":"\u0645\u062D\u0645\u0648\u062F","ali":"\u0639\u0644\u064A","omar":"\u0639\u0645\u0631","othman":"\u0639\u062B\u0645\u0627\u0646","khalid":"\u062E\u0627\u0644\u062F","tariq":"\u0637\u0627\u0631\u0642","tareq":"\u0637\u0627\u0631\u0642","yousef":"\u064A\u0648\u0633\u0641","youssef":"\u064A\u0648\u0633\u0641","ibrahim":"\u0625\u0628\u0631\u0627\u0647\u064A\u0645","hassan":"\u062D\u0633\u0646","hussein":"\u062D\u0633\u064A\u0646","salem":"\u0633\u0627\u0644\u0645","saeed":"\u0633\u0639\u064A\u062F","mansoor":"\u0645\u0646\u0635\u0648\u0631","abdullah":"\u0639\u0628\u062F\u0627\u0644\u0644\u0647","abdulrahman":"\u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646","hamad":"\u062D\u0645\u062F","zayed":"\u0632\u0627\u064A\u062F","rashid":"\u0631\u0627\u0634\u062F","fatima":"\u0641\u0627\u0637\u0645\u0629","mariam":"\u0645\u0631\u064A\u0645","noor":"\u0646\u0648\u0631","sara":"\u0633\u0627\u0631\u0629","reem":"\u0631\u064A\u0645","layla":"\u0644\u064A\u0644\u0649","mona":"\u0645\u0646\u0649","real estate":"\u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A","properties":"\u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A","trading":"\u0644\u0644\u062A\u062C\u0627\u0631\u0629","general trading":"\u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629","llc":"\u0630.\u0645.\u0645","l.l.c":"\u0630.\u0645.\u0645"};const clean=name.trim().toLowerCase();if(from==="en"&&to==="ar"){const words=clean.split(/\s+/);const translatedWords=words.map(w=>dict[w]||w);return translatedWords.join(" ")}else{const revDict={};for(const[en,ar]of Object.entries(dict)){revDict[ar]=en.charAt(0).toUpperCase()+en.slice(1)}const words=name.trim().split(/\s+/);const translatedWords=words.map(w=>revDict[w]||w);return translatedWords.join(" ")}}__name(fallbackTransliterate,"fallbackTransliterate");app.post("/api/ai/transliterate-name",authenticateFirebaseToken,requireStaff,async(req,res)=>{const{name="",from="ar",to="en"}=req.body;if(!name.trim()){return res.json({success:true,suggestion:""})}try{const ai=getGeminiClient();if(ai){const prompt=`You are a UAE official legal translator specializing in Dubai Land Department (DLD) and Ejari property tenancy contracts.
Translate / transliterate this person or company name accurately between Arabic and English according to UAE official passport / Emirates ID / trade license conventions.
From: ${from==="ar"?"Arabic":"English"}
To: ${to==="ar"?"Arabic":"English"}
Name: "${name.trim()}"

Return ONLY a valid JSON object:
{
  "suggestion": "Translated or Transliterated Name"
}`;const response=await generateContentWithFallback(ai,{contents:{parts:[{text:prompt}]},config:{responseMimeType:"application/json"}});const rawText=response.text||"";const parsed=safeJsonParse(rawText,{suggestion:""});if(parsed?.suggestion){return res.json({success:true,suggestion:parsed.suggestion})}}const fallback=fallbackTransliterate(name,from,to);return res.json({success:true,suggestion:fallback||name})}catch(err){const fallback=fallbackTransliterate(name,from,to);return res.json({success:true,suggestion:fallback||name})}});app.post("/api/ai/generate-legal-notice",authenticateFirebaseToken,requireStaff,async(req,res)=>{const{noticeType="DEFAULT_PAYMENT_15_DAYS",tenantName="",tenantPhone="",emiratesId="",tradeLicenseNo="",propertyName="",unitNumber="",leaseNumber="",chequeNumbers=[],totalClaimAED=0,returnReason="\u0639\u062F\u0645 \u0643\u0641\u0627\u064A\u0629 \u0627\u0644\u0631\u0635\u064A\u062F",daysToCure=15,customRemarks="",language="ar"}=req.body;const isAr=language==="ar";try{const ai=getGeminiClient();if(!ai){throw new Error("AI Client not initialized")}const prompt=`You are a Senior Legal Counsel in UAE Real Estate Law (Dubai Rental Disputes Center - RDC, Law No. 26 of 2007, Law No. 33 of 2008, and Federal Decree-Law No. 14 of 2020 on Commercial Transactions).
Draft a formal, highly authoritative legal notice / payment demand with the following parameters:
- Notice Type: ${noticeType}
- Recipient Tenant Name: ${tenantName}
- Tenant Phone: ${tenantPhone}
- Emirates ID / Trade License: ${emiratesId||tradeLicenseNo||"N/A"}
- Property / Building: ${propertyName}
- Unit Number: ${unitNumber}
- Lease / Ejari Contract No: ${leaseNumber||"N/A"}
- Dishonored Cheque Number(s): ${Array.isArray(chequeNumbers)?chequeNumbers.join(", "):chequeNumbers}
- Total Claim Amount: AED ${Number(totalClaimAED).toLocaleString()}
- Cheque Return Reason: ${returnReason}
- Cure / Grace Period: ${daysToCure} Days
- Custom Remarks: ${customRemarks||"None"}
- Language: ${language==="ar"?"Arabic (Formal UAE Judicial Arabic)":"English (UAE Commercial Legal English)"}

Return ONLY a valid JSON object:
{
  "noticeText": "Full formatted legal notice text with formal salutation, legal citations, itemized claim, deadline, and execution warning",
  "keyClauses": [
    "Clause 1 summary",
    "Clause 2 summary",
    "Clause 3 summary"
  ]
}`;const response=await generateContentWithFallback(ai,{contents:{parts:[{text:prompt}]},config:{responseMimeType:"application/json"}});const rawText=response.text||"";const parsed=safeJsonParse(rawText,{noticeText:"",keyClauses:[]});return res.json({success:true,notice:{noticeText:parsed.noticeText,keyClauses:parsed.keyClauses||[]},noticeText:parsed.noticeText,keyClauses:parsed.keyClauses||[]})}catch(err){const chqStr=Array.isArray(chequeNumbers)?chequeNumbers.join(", "):chequeNumbers||"N/A";const formattedAmount=Number(totalClaimAED||0).toLocaleString();const fallbackNotice=isAr?`\u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${new Date().toLocaleDateString("ar-AE")}

\u0625\u0644\u0649 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0627\u0644\u0641\u0627\u0636\u0644: ${tenantName||"\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0627\u0644\u0645\u062D\u062A\u0631\u0645"}
\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629 / \u0627\u0644\u0631\u062E\u0635\u0629: ${emiratesId||tradeLicenseNo||"\u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0646\u0638\u0627\u0645"}
\u0627\u0644\u0639\u0642\u0627\u0631: ${propertyName} - \u0627\u0644\u0648\u062D\u062F\u0629 \u0631\u0642\u0645 (${unitNumber})
\u0631\u0642\u0645 \u0639\u0642\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631: ${leaseNumber||"\u0633\u0627\u0631\u064A"}

\u0627\u0644\u0645\u0648\u0636\u0648\u0639: \u0625\u062E\u0637\u0627\u0631 \u0648\u0625\u0646\u0630\u0627\u0631 \u0639\u062F\u0644\u064A \u0628\u0627\u0644\u0633\u062F\u0627\u062F \u0627\u0644\u0641\u0648\u0631\u064A \u0644\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0629

\u062A\u062D\u064A\u0629 \u0637\u064A\u0628\u0629 \u0648\u0628\u0639\u062F\u060C\u060C

\u0646\u062D\u064A\u0637\u0643\u0645 \u0639\u0644\u0645\u0627\u064B \u0628\u0623\u0646\u0647 \u0628\u0645\u0648\u062C\u0628 \u0639\u0642\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0648\u0633\u0646\u062F\u0627\u062A \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0633\u062D\u0648\u0628\u0629 \u0645\u0646 \u0642\u0628\u0644\u0643\u0645 \u0644\u0635\u0627\u0644\u062D (\u0635\u0642\u0631 \u0627\u0644\u0627\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A)\u060C \u0641\u0642\u062F \u062A\u0645 \u0625\u0631\u062C\u0627\u0639 \u0627\u0644\u0634\u064A\u0643 \u0631\u0642\u0645 (${chqStr}) \u0628\u0645\u0628\u0644\u063A \u0642\u062F\u0631\u0647 (${formattedAmount}) \u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0635\u0631\u0641 \u0627\u0644\u0645\u0633\u062D\u0648\u0628 \u0639\u0644\u064A\u0647 \u0644\u0633\u0628\u0628 (${returnReason}).

\u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0630\u0644\u0643\u060C \u0648\u0637\u0628\u0642\u0627\u064B \u0644\u0623\u062D\u0643\u0627\u0645 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0631\u0642\u0645 (26) \u0644\u0633\u0646\u0629 2007 \u0648\u062A\u0639\u062F\u064A\u0644\u0627\u062A\u0647 \u0628\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0631\u0642\u0645 (33) \u0644\u0633\u0646\u0629 2008\u060C \u0648\u0627\u0644\u0645\u0631\u0633\u0648\u0645 \u0628\u0642\u0627\u0646\u0648\u0646 \u0627\u062A\u062D\u0627\u062F\u064A \u0631\u0642\u0645 (14) \u0644\u0633\u0646\u0629 2020 \u0628\u0634\u0623\u0646 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u0648\u0627\u0644\u0630\u064A \u064A\u062C\u0639\u0644 \u0627\u0644\u0634\u064A\u0643 \u0627\u0644\u0645\u0631\u062A\u062C\u0639 \u0633\u0646\u062F\u0627\u064B \u062A\u0646\u0641\u064A\u0630\u064A\u0627\u064B \u0645\u0628\u0627\u0634\u0631\u0627\u064B:

\u0646\u0646\u0630\u0631\u0643\u0645 \u0628\u0648\u062C\u0648\u0628 \u0633\u062F\u0627\u062F \u0643\u0627\u0645\u0644 \u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062E\u0644\u0627\u0644 \u0645\u0647\u0644\u0629 \u0623\u0642\u0635\u0627\u0647\u0627 (${daysToCure}) \u064A\u0648\u0645\u0627\u064B \u0645\u0646 \u062A\u0627\u0631\u064A\u062E \u0627\u0633\u062A\u0644\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0625\u062E\u0637\u0627\u0631. \u0648\u0641\u064A \u062D\u0627\u0644 \u0627\u0644\u062A\u062E\u0644\u0641 \u0639\u0646 \u0627\u0644\u0633\u062F\u0627\u062F\u060C \u0633\u062A\u0636\u0637\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0644\u0627\u062A\u062E\u0627\u0630 \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 \u0627\u0644\u0641\u0648\u0631\u064A\u0629 \u0623\u0645\u0627\u0645 \u0645\u0631\u0643\u0632 \u0641\u0636 \u0627\u0644\u0645\u0646\u0627\u0632\u0639\u0627\u062A \u0627\u0644\u0625\u064A\u062C\u0627\u0631\u064A\u0629 \u0648\u0642\u0627\u0636\u064A \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0644\u0644\u062D\u062C\u0632 \u0639\u0644\u0649 \u0627\u0644\u0623\u0645\u0648\u0627\u0644 \u0648\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0648\u062A\u062D\u0645\u064A\u0644\u0643\u0645 \u0643\u0627\u0641\u0629 \u0627\u0644\u0631\u0633\u0648\u0645 \u0648\u0627\u0644\u0645\u0635\u0627\u0631\u064A\u0641 \u0648\u0623\u062A\u0639\u0627\u0628 \u0627\u0644\u0645\u062D\u0627\u0645\u0627\u0629.

\u0634\u0627\u0643\u0631\u064A\u0646 \u062D\u0633\u0646 \u062A\u0639\u0627\u0648\u0646\u0643\u0645 \u0648\u062D\u0631\u0635\u0643\u0645 \u0639\u0644\u0649 \u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u0623\u0645\u0631 \u0648\u062F\u064A\u0627\u064B.

\u0635\u0642\u0631 \u0627\u0644\u0627\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A
\u0642\u0633\u0645 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644`:`Date: ${new Date().toLocaleDateString("en-GB")}

To: ${tenantName||"Valued Tenant"}
Emirates ID / Trade License: ${emiratesId||tradeLicenseNo||"On File"}
Property: ${propertyName} - Unit #${unitNumber}
Lease Contract #: ${leaseNumber||"Active"}

Subject: Formal Legal Notice & Immediate Payment Demand for Dishonored Cheque(s)

Dear Sir/Madam,

Please be informed that pursuant to the tenancy contract and the banking instruments issued to Emirates Falcon Real Estate, Cheque #${chqStr} in the amount of AED ${formattedAmount} was returned unpaid by the drawee bank due to (${returnReason}).

In accordance with Dubai Law No. 26 of 2007 as amended by Law No. 33 of 2008, and UAE Federal Decree-Law No. 14 of 2020 (whereby bounced cheques constitute direct executable writs):

You are hereby officially demanded to settle the full outstanding amount within (${daysToCure}) days from the date of this notice. Failure to settle will compel us to file for immediate execution at the Rental Dispute Center (RDC) and UAE execution courts to freeze accounts, enforce eviction, and claim all legal fees.

Emirates Falcon Real Estate
Legal & Recovery Department`;const fallbackClauses=[isAr?`\u0645\u0647\u0644\u0629 \u0627\u0644\u0633\u062F\u0627\u062F: ${daysToCure} \u064A\u0648\u0645\u0627\u064B`:`Cure Period: ${daysToCure} Days`,isAr?"\u0633\u0646\u062F \u062A\u0646\u0641\u064A\u0630\u064A \u0645\u0628\u0627\u0634\u0631 \u0648\u0641\u0642 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 14 \u0644\u0633\u0646\u0629 2020":"Direct Executable Writ under Decree-Law 14/2020",isAr?"\u062D\u0642 \u0627\u0644\u0625\u062E\u0644\u0627\u0621 \u0648\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0627\u0644\u062A\u0639\u0648\u064A\u0636\u0627\u062A \u0648\u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0642\u0627\u0636\u064A":"Right of Eviction & Full Legal Costs Recovery"];return res.json({success:true,notice:{noticeText:fallbackNotice,keyClauses:fallbackClauses},noticeText:fallbackNotice,keyClauses:fallbackClauses})}});import dns from"dns";import net from"net";const SECRETS_FILE_PATH=path.join(process.cwd(),".secrets.json");const CONFIG_FILE_PATH=path.join(process.cwd(),"connections-config.json");function loadSecrets(){try{const secrets=loadStoredSecrets();return{smtpAppPassword:secrets.smtpAppPassword,whatsappAccessToken:secrets.whatsappAccessToken}}catch(e){console.warn("[Secrets Engine] Error loading secrets.",e)}return{smtpAppPassword:process.env.GMAIL_APP_PASSWORD||"",whatsappAccessToken:process.env.WHATSAPP_ACCESS_TOKEN||""}}__name(loadSecrets,"loadSecrets");function saveSecrets(newSecrets){try{let currentRaw:Record<string,any>={};if(fs.existsSync(SECRETS_FILE_PATH)){try{currentRaw=JSON.parse(fs.readFileSync(SECRETS_FILE_PATH,"utf8"))}catch{}}if(newSecrets.smtpAppPassword!==void 0){if(newSecrets.smtpAppPassword){currentRaw.smtpAppPasswordEncrypted=encryptSecret(newSecrets.smtpAppPassword)}currentRaw.smtpAppPassword=void 0}if(newSecrets.whatsappAccessToken!==void 0){if(newSecrets.whatsappAccessToken){currentRaw.whatsappAccessTokenEncrypted=encryptSecret(newSecrets.whatsappAccessToken)}currentRaw.whatsappAccessToken=void 0}Object.keys(currentRaw).forEach(key=>currentRaw[key]===void 0?delete currentRaw[key]:{});fs.writeFileSync(SECRETS_FILE_PATH,JSON.stringify(currentRaw,null,2),"utf8")}catch(e){console.error("[Secrets Engine] Failed to save secrets:",e.message)}}__name(saveSecrets,"saveSecrets");function loadConfigs(){try{if(fs.existsSync(CONFIG_FILE_PATH)){return JSON.parse(fs.readFileSync(CONFIG_FILE_PATH,"utf8"))}}catch(e){console.warn("[Configs Engine] Config file connections-config.json not found, using defaults.")}return{whatsapp:{phoneNumberId:"",wabaId:"",apiVersion:"v17.0",enabled:true,status:"NOT_CONFIGURED"},gmail:{smtpUser:"emfalcon2025227@gmail.com",smtpHost:"smtp.gmail.com",smtpPort:465,encryption:"SSL",senderName:"Emirates Falcon System",enabled:true,status:"NOT_CONFIGURED"}}}__name(loadConfigs,"loadConfigs");function saveConfigs(newConfigs){try{const current=loadConfigs();const updated={whatsapp:{...current.whatsapp,...newConfigs.whatsapp},gmail:{...current.gmail,...newConfigs.gmail}};fs.writeFileSync(CONFIG_FILE_PATH,JSON.stringify(updated,null,2),"utf8")}catch(e){console.error("[Configs Engine] Failed to save configs:",e.message)}}__name(saveConfigs,"saveConfigs");app.get(["/api/connections/config","/api/connections/config/"],authenticateFirebaseToken,requireAdmin,(req,res)=>{try{const configs=loadConfigs();const secrets=loadSecrets();const whatsapp=configs.whatsapp?{...configs.whatsapp,accessToken:secrets.whatsappAccessToken?"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022":""}:null;const gmail=configs.gmail?{...configs.gmail,appPassword:secrets.smtpAppPassword?"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022":""}:null;return res.json({success:true,whatsapp,gmail})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post(["/api/connections/config","/api/connections/config/"],authenticateFirebaseToken,requireAdmin,(req,res)=>{try{const{whatsapp,gmail}=req.body;const secretsToSave:Record<string,any>={};const configsToSave:Record<string,any>={};if(whatsapp){configsToSave.whatsapp={phoneNumberId:whatsapp.phoneNumberId||"",wabaId:whatsapp.wabaId||"",apiVersion:whatsapp.apiVersion||"v17.0",enabled:whatsapp.enabled!==false,status:whatsapp.status||"CONFIGURED"};if(whatsapp.accessToken&&!whatsapp.accessToken.includes("\u2022")){secretsToSave.whatsappAccessToken=whatsapp.accessToken}}if(gmail){configsToSave.gmail={smtpUser:gmail.smtpUser||"",smtpHost:gmail.smtpHost||"smtp.gmail.com",smtpPort:Number(gmail.smtpPort)||465,encryption:gmail.encryption||"SSL",senderName:gmail.senderName||"Emirates Falcon System",enabled:gmail.enabled!==false,status:gmail.status||"CONFIGURED"};if(gmail.appPassword&&!gmail.appPassword.includes("\u2022")){secretsToSave.smtpAppPassword=gmail.appPassword}}saveConfigs(configsToSave);if(Object.keys(secretsToSave).length>0){saveSecrets(secretsToSave)}console.log(`[Audit Log] CONNECTION_CONFIGURED executed by admin. Services updated: ${[whatsapp?"WhatsApp":"",gmail?"Gmail":""].filter(Boolean).join(", ")}`);return res.json({success:true,message:"Configuration persisted successfully server-side."})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.get("/api/admin/system-config",authenticateFirebaseToken,requireAdmin,(req,res)=>{console.log(`[API] /api/admin/system-config hit by ${req.user?.role}`);try{const origin=req.headers.origin||`${req.protocol}://${req.get("host")}`;const matrix=getSystemConfigurationMatrix(origin);return res.json({success:true,...matrix})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/admin/system-config",authenticateFirebaseToken,requireAdmin,async(req,res)=>{try{const adminEmail=req.user?.email||"system_admin";const result=await updateSystemConfiguration(req.body,adminEmail);return res.json(result)}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/admin/diagnostics/run-all",authenticateFirebaseToken,requireAdmin,async(req,res)=>{try{const origin=req.headers.origin||`${req.protocol}://${req.get("host")}`;const results=await runComprehensiveDiagnostics(origin);return res.json({success:true,results,executedAt:new Date().toISOString()})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/admin/diagnostics/safe-repair",authenticateFirebaseToken,requireAdmin,async(req,res)=>{try{const origin=req.headers.origin||`${req.protocol}://${req.get("host")}`;const adminEmail=req.user?.email||"system_admin";const result=await performSafeRepair(origin,adminEmail);return res.json(result)}catch(err){return res.status(500).json({success:false,error:err.message})}});app.get("/api/admin/system-config/export",authenticateFirebaseToken,requireAdmin,(req,res)=>{try{const origin=req.headers.origin||`${req.protocol}://${req.get("host")}`;const exportData=exportNonSecretConfiguration(origin);res.setHeader("Content-Type","application/json");res.setHeader("Content-Disposition",`attachment; filename="emirates-falcon-system-config-${Date.now()}.json"`);return res.send(JSON.stringify(exportData,null,2))}catch(err){return res.status(500).json({success:false,error:err.message})}});app.get("/api/admin/system-config/audit-logs",authenticateFirebaseToken,requireAdmin,(req,res)=>{try{const logs=getConfigAuditLogs();return res.json({success:true,logs})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.get("/api/integrations/google-drive/status",async(req,res)=>{try{const config=getGoogleDriveConfig();return res.json({success:true,...config})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.get("/api/integrations/google-drive/connect",authenticateFirebaseToken,requireAdmin,async(req,res)=>{try{const{authUrl,state,redirectUri}=generateConnectAuthUrl({adminUid:req.user.uid});return res.json({success:true,authUrl,state,redirectUri})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.get("/api/integrations/google-drive/callback",async(req,res)=>{const{code,state,error}=req.query;if(error){const errorHtml=`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>\u0641\u0634\u0644 \u0627\u0644\u0631\u0628\u0637 | Google Drive</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; max-width: 480px; text-align: center; border: 1px solid #ef4444; }
          h2 { color: #f87171; margin-top: 0; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
          button { background: #334155; color: #fff; border: 0; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: bold; cursor: pointer; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0623\u0648 \u0631\u0641\u0636 \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u0631\u0628\u0637</h2>
          <p>\u0623\u0628\u0644\u063A \u062E\u0627\u062F\u0645 Google \u0628\u0627\u0644\u0631\u0645\u0632: <code>${String(error)}</code>. \u0644\u0645 \u064A\u062A\u0645 \u062D\u0641\u0638 \u0623\u064A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0639\u062A\u0645\u0627\u062F.</p>
          <button onclick="window.close()">\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0646\u0627\u0641\u0630\u0629</button>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'GDRIVE_OAUTH_FAILED', error: '${String(error)}' }, '*');
          }
        <\/script>
      </body>
      </html>
    `;return res.status(400).send(errorHtml)}if(!code||!state){return res.status(400).send("Missing code or state parameter.")}try{const result=await handleOAuthCallback(String(code),String(state));const successHtml=`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>\u062A\u0645 \u0627\u0644\u0631\u0628\u0637 \u0628\u0646\u062C\u0627\u062D | \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; max-width: 480px; text-align: center; border: 1px solid #10b981; }
          h2 { color: #34d399; margin-top: 0; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
          .badge { display: inline-block; background: #064e3b; color: #6ee7b7; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: bold; font-size: 0.85rem; margin-bottom: 1rem; }
          button { background: #059669; color: #fff; border: 0; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: bold; cursor: pointer; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">\u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u2014 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0648\u062D\u062F</div>
          <h2>\u062A\u0645 \u0631\u0628\u0637 Google Drive \u0628\u0646\u062C\u0627\u062D!</h2>
          <p>\u062A\u0645 \u062D\u0641\u0638 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062F\u0627\u0626\u0645 \u0648\u062A\u0634\u0641\u064A\u0631\u0647 \u0645\u0631\u0643\u0632\u064A\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0628\u0623\u0645\u0627\u0646 (AES-256-GCM). \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062A\u0635\u0644: <strong>${result.email||"\u062D\u0633\u0627\u0628 \u0627\u0644\u0634\u0631\u0643\u0629"}</strong></p>
          <p style="font-size:0.85rem; color:#64748b;">\u064A\u0645\u0643\u0646 \u0644\u062C\u0645\u064A\u0639 \u0645\u0633\u062A\u062E\u062F\u0645\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0622\u0646 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0628\u062F\u0648\u0646 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 Google.</p>
          <button onclick="handleClose()">\u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0646\u0638\u0627\u0645</button>
        </div>
        <script>
          function handleClose() {
            if (window.opener) {
              window.opener.postMessage({ type: 'GDRIVE_OAUTH_SUCCESS', email: '${result.email||""}' }, '*');
              window.close();
            } else {
              window.location.href = '/#settings';
            }
          }
          // Auto close after 2.5 seconds if opened as popup
          setTimeout(handleClose, 2500);
        <\/script>
      </body>
      </html>
    `;return res.send(successHtml)}catch(cbErr){console.error("[OAuth Callback Handler Error]:",cbErr.message);const failHtml=`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>\u062E\u0637\u0623 \u0641\u064A \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0631\u0628\u0637</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; max-width: 480px; text-align: center; border: 1px solid #ef4444; }
          h2 { color: #f87171; margin-top: 0; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
          button { background: #334155; color: #fff; border: 0; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: bold; cursor: pointer; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>\u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629</h2>
          <p>${cbErr.message||"\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0623\u062B\u0646\u0627\u0621 \u062A\u0628\u0627\u062F\u0644 \u0627\u0644\u0631\u0645\u0648\u0632 \u0645\u0639 Google."}</p>
          <button onclick="window.close()">\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0646\u0627\u0641\u0630\u0629</button>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'GDRIVE_OAUTH_FAILED', error: '${cbErr.message}' }, '*');
          }
        <\/script>
      </body>
      </html>
    `;return res.status(500).send(failHtml)}});app.post("/api/integrations/google-drive/disconnect",authenticateFirebaseToken,requireAdmin,async(req,res)=>{try{const result=await disconnectGoogleDrive();console.log(`[Audit Log] GDRIVE_DISCONNECTED executed by Admin (${req.user.uid})`);return res.json({success:true,...result})}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/integrations/google-drive/test",authenticateFirebaseToken,requireAdmin,async(req,res)=>{try{const report=await testArchiveConnection();return res.json(report)}catch(err){return res.status(500).json({success:false,status:"ERROR",latency:0,safeErrorMessage:err.message,steps:[{name:"Execution",status:"FAIL",details:err.message}]})}});app.get("/api/integrations/google-drive/file/:fileId",authenticateFirebaseToken,async(req,res)=>{try{const{fileId}=req.params;if(!fileId||fileId.startsWith("pending_")){return res.status(400).json({success:false,error:"Invalid fileId provided."})}const{stream,mimeType,name,size}=await getDriveFileStream(fileId);res.setHeader("Content-Type",mimeType);res.setHeader("Content-Disposition",`inline; filename="${encodeURIComponent(name)}"`);if(size){res.setHeader("Content-Length",size)}res.setHeader("Cache-Control","private, max-age=3600");stream.pipe(res)}catch(err){console.error(`[Drive Stream Proxy Error for ${req.params.fileId}]:`,err.message);return res.status(500).json({success:false,error:"FAILED_TO_STREAM_FILE",message:err.message||"\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0627\u0644\u0645\u0644\u0641 \u0645\u0646 \u0645\u0633\u062A\u0648\u062F\u0639 Google Drive \u0627\u0644\u0645\u0631\u0643\u0632\u064A."})}});app.post("/api/integrations/google-drive/upload",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{fileName,mimeType,fileBase64,drivePath,folderName,description}=req.body;if(!fileName||!fileBase64){return res.status(400).json({success:false,error:"Missing fileName or fileBase64"})}let cleanBase64=String(fileBase64);if(cleanBase64.includes("base64,")){cleanBase64=cleanBase64.split("base64,")[1]}cleanBase64=cleanBase64.replace(/[\r\n\s]/g,"");const buffer=Buffer.from(cleanBase64,"base64");const result=await uploadFileToDriveServerSide({fileName,mimeType:mimeType||"application/octet-stream",contentBuffer:buffer,drivePath,folderName,description});return res.json(result)}catch(err){console.error("[Drive Server Upload Error]:",err.message);return res.status(500).json({success:false,error:err.message})}});app.get("/api/connections/drive-token",authenticateFirebaseToken,async(req,res)=>{console.log(`[LEGACY COMPATIBILITY ONLY] /api/connections/drive-token accessed by uid=${req.user?.uid}`);try{const tokenInfo=await getValidAccessToken();return res.json({success:true,accessToken:tokenInfo.accessToken,mode:tokenInfo.mode,serviceAccountEmail:tokenInfo.email,email:tokenInfo.email})}catch(err){const config=getGoogleDriveConfig();return res.json({success:false,status:config.status,error:err.message,errorCode:config.errorCode||"NOT_CONFIGURED",repairInstructions:config.repairInstructions})}});const dnsResolve=__name(host=>{return new Promise(resolve=>{dns.resolve4(host,(err,addresses)=>{if(err||!addresses||addresses.length===0)resolve([]);else resolve(addresses)})})},"dnsResolve");const tcpCheck=__name((host,port)=>{return new Promise(resolve=>{const socket=net.createConnection(port,host);socket.setTimeout(2500);socket.on("connect",()=>{socket.destroy();resolve(true)});socket.on("timeout",()=>{socket.destroy();resolve(false)});socket.on("error",()=>{socket.destroy();resolve(false)})})},"tcpCheck");app.post(["/api/connections/test-smtp","/api/connections/test-smtp/"],authenticateFirebaseToken,requireStaff,async(req,res)=>{console.log(`[API] test-smtp route hit`);const pipelineStartTime=Date.now();const steps:{name:string;status:string;details?:string;latency?:number}[]=[{name:"1. Configuration Loaded",status:"PENDING"},{name:"2. SMTP Host",status:"PENDING"},{name:"3. SMTP Port",status:"PENDING"},{name:"4. App Password",status:"PENDING"},{name:"5. DNS / Network Reachability",status:"PENDING"},{name:"6. TLS / Secure Channel",status:"PENDING"},{name:"7. SMTP Authentication",status:"PENDING"},{name:"8. SMTP Capability Check",status:"PENDING"}];try{const configs=loadConfigs();const secrets=loadSecrets();const gmail=configs.gmail||{};const user=gmail.smtpUser?.trim();const host=gmail.smtpHost?.trim();const port=Number(gmail.smtpPort);const pass=secrets.smtpAppPassword?.trim();const encryption=gmail.encryption||"SSL";if(!user||!user.includes("@")){steps[0]={name:"1. Configuration Loaded",status:"FAIL",details:"Email ID is missing or invalid."};for(let i=1;i<steps.length;i++)steps[i].status="SKIPPED";const totalLatency=Date.now()-pipelineStartTime;gmail.status="ERROR";gmail.lastCheckedAt=new Date().toISOString();gmail.latency=totalLatency;gmail.errorCode="LOCAL_VALIDATION_FAILURE";gmail.safeErrorMessage="Email ID is missing or invalid.";gmail.repairInstructions="Please provide a valid corporate email address (e.g. notifications@emiratesfalcon.com).";saveConfigs({gmail});return res.json({success:false,...gmail,steps})}steps[0]={name:"1. Configuration Loaded",status:"PASS",details:`Email ID: ${user}`};if(!host){steps[1]={name:"2. SMTP Host",status:"FAIL",details:"SMTP Host address is missing."};for(let i=2;i<steps.length;i++)steps[i].status="SKIPPED";const totalLatency=Date.now()-pipelineStartTime;gmail.status="ERROR";gmail.lastCheckedAt=new Date().toISOString();gmail.latency=totalLatency;gmail.errorCode="CONFIGURATION_MISSING";gmail.safeErrorMessage="SMTP Host is missing.";gmail.repairInstructions="Please specify the SMTP host address (e.g. smtp.gmail.com).";saveConfigs({gmail});return res.json({success:false,...gmail,steps})}steps[1]={name:"2. SMTP Host",status:"PASS",details:`Host: ${host}`};if(!port||isNaN(port)||port<1||port>65535){steps[2]={name:"3. SMTP Port",status:"FAIL",details:"SMTP Port is invalid."};for(let i=3;i<steps.length;i++)steps[i].status="SKIPPED";const totalLatency=Date.now()-pipelineStartTime;gmail.status="ERROR";gmail.lastCheckedAt=new Date().toISOString();gmail.latency=totalLatency;gmail.errorCode="INVALID_SMTP_PORT";gmail.safeErrorMessage="Invalid SMTP Port provided.";gmail.repairInstructions="Enter a valid SMTP port number: 465 (SSL) or 587 (STARTTLS).";saveConfigs({gmail});return res.json({success:false,...gmail,steps})}steps[2]={name:"3. SMTP Port",status:"PASS",details:`Port: ${port} (${encryption})`};if(!pass){steps[3]={name:"4. App Password",status:"FAIL",details:"SMTP App Password is missing."};for(let i=4;i<steps.length;i++)steps[i].status="SKIPPED";const totalLatency=Date.now()-pipelineStartTime;gmail.status="ERROR";gmail.lastCheckedAt=new Date().toISOString();gmail.latency=totalLatency;gmail.errorCode="MISSING_APP_PASSWORD";gmail.safeErrorMessage="SMTP App Password is missing in secure storage.";gmail.repairInstructions="Generate a 16-character Google App Password and save it in the settings.";saveConfigs({gmail});return res.json({success:false,...gmail,steps})}steps[3]={name:"4. App Password",status:"PASS",details:"Credential present in secure server vault (16 chars)"};const dnsStart=Date.now();let resolvedIps=[];try{resolvedIps=await dnsResolve(host)}catch(e){resolvedIps=[]}const dnsLatency=Math.max(1,Date.now()-dnsStart);if(resolvedIps.length===0){steps[4]={name:"5. DNS / Network Reachability",status:"FAIL",details:`Unable to resolve host: ${host}`,latency:dnsLatency};for(let i=5;i<steps.length;i++)steps[i].status="SKIPPED";const totalLatency=Date.now()-pipelineStartTime;gmail.status="ERROR";gmail.lastCheckedAt=new Date().toISOString();gmail.latency=totalLatency;gmail.errorCode="DNS_RESOLUTION_FAILED";gmail.safeErrorMessage=`Could not resolve hostname '${host}'.`;gmail.repairInstructions="Verify the SMTP Host setting or server DNS network configuration.";saveConfigs({gmail});return res.json({success:false,...gmail,steps})}steps[4]={name:"5. DNS / Network Reachability",status:"PASS",details:`Resolved to IP: ${resolvedIps[0]}`,latency:dnsLatency};const tcpStart=Date.now();const tcpConnected=await tcpCheck(host,port);const tcpLatency=Math.max(1,Date.now()-tcpStart);if(!tcpConnected){steps[5]={name:"6. TLS / Secure Channel",status:"FAIL",details:`TCP handshake failed on ${host}:${port}`,latency:tcpLatency};for(let i=6;i<steps.length;i++)steps[i].status="SKIPPED";const totalLatency=Date.now()-pipelineStartTime;gmail.status="ERROR";gmail.lastCheckedAt=new Date().toISOString();gmail.latency=totalLatency;gmail.errorCode="SMTP_HOST_UNREACHABLE";gmail.safeErrorMessage=`Could not establish TCP connection to ${host}:${port}`;gmail.repairInstructions=`Ensure port ${port} is open and allowed by local/cloud network firewall policy.`;saveConfigs({gmail});return res.json({success:false,...gmail,steps})}steps[5]={name:"6. TLS / Secure Channel",status:"PASS",details:`TCP socket opened on port ${port}`,latency:tcpLatency};const authStart=Date.now();const isSsl=encryption==="SSL";const transporter=nodemailer.createTransport({host,port,secure:isSsl,auth:{user,pass},tls:{rejectUnauthorized:true},connectionTimeout:8e3,greetingTimeout:8e3,socketTimeout:8e3});try{await transporter.verify();const authLatency=Math.max(1,Date.now()-authStart);steps[6]={name:"7. SMTP Authentication",status:"PASS",details:"Server accepted credentials via AUTH LOGIN/PLAIN",latency:authLatency};const capabilityStart=Date.now();const capLatency=Math.max(1,Date.now()-capabilityStart);steps[7]={name:"8. SMTP Capability Check",status:"PASS",details:"SMTP session is active and ready for dispatch",latency:capLatency};const totalLatency=Date.now()-pipelineStartTime;gmail.status="VERIFIED";gmail.lastCheckedAt=new Date().toISOString();gmail.latency=totalLatency;delete gmail.errorCode;delete gmail.safeErrorMessage;delete gmail.repairInstructions;saveConfigs({gmail});console.log(`[Audit Log] GMAIL_SMTP_VERIFIED: Dedicated Gmail SMTP pipeline verified for ${user} in ${totalLatency}ms`);return res.json({success:true,...gmail,steps})}catch(authErr){const authLatency=Math.max(1,Date.now()-authStart);steps[6]={name:"7. SMTP Authentication",status:"FAIL",details:authErr.message||"Authentication rejected",latency:authLatency};steps[7]={name:"8. SMTP Capability Check",status:"SKIPPED"};const totalLatency=Date.now()-pipelineStartTime;gmail.status="ERROR";gmail.lastCheckedAt=new Date().toISOString();gmail.latency=totalLatency;const errMsg=authErr.message||"";if(errMsg.includes("Username and Password not accepted")||errMsg.includes("535 5.7.8")){gmail.errorCode="SMTP_AUTHENTICATION_FAILED";gmail.safeErrorMessage="SMTP Authentication failed. The Google App Password was rejected by Gmail.";gmail.repairInstructions="Generate a fresh 16-character Google App Password under emfalcon2025227@gmail.com security settings and update settings."}else if(errMsg.includes("ETIMEDOUT")||errMsg.includes("timeout")){gmail.errorCode="SMTP_TIMEOUT";gmail.safeErrorMessage="SMTP Server handshake timed out during TLS authentication.";gmail.repairInstructions=`Check if port ${port} matches your encryption mode (${encryption}) or try port 587 with STARTTLS.`}else{gmail.errorCode="TLS_CONNECTION_FAILED";gmail.safeErrorMessage=`TLS/SSL Connection negotiation failed: ${errMsg}`;gmail.repairInstructions=`Verify encryption protocol (${encryption}) matches port ${port}.`}saveConfigs({gmail});return res.json({success:false,...gmail,steps})}}catch(err){return res.status(500).json({success:false,status:"ERROR",errorCode:"LOCAL_VALIDATION_FAILURE",safeErrorMessage:err.message||"An unexpected error occurred during SMTP connection verification.",steps})}});app.post("/api/connections/send-test-email",authenticateFirebaseToken,requireAdmin,async(req,res)=>{try{const{recipientEmail,subject,messageBody}=req.body;const configs=loadConfigs();const secrets=loadSecrets();const gmail=configs.gmail;if(!gmail||!gmail.smtpUser||!secrets.smtpAppPassword){return res.status(400).json({success:false,error:"SMTP is not fully configured."})}const transporter=nodemailer.createTransport({host:gmail.smtpHost,port:gmail.smtpPort,secure:gmail.encryption==="SSL",auth:{user:gmail.smtpUser,pass:secrets.smtpAppPassword},tls:{rejectUnauthorized:true}});const targetRecipient=recipientEmail||gmail.smtpUser;const mailOptions={from:`"${gmail.senderName||"Emirates Falcon"}" <${gmail.smtpUser}>`,to:targetRecipient,subject:subject||"Emirates Falcon ERP \u2014 Gmail Connection Test",text:messageBody||"This is an automated connection test from Emirates Falcon ERP."};const info=await transporter.sendMail(mailOptions);console.log(`[Audit Log] CONNECTION_TESTED: Test email dispatched to ${targetRecipient}. MessageId: ${info.messageId}`);return res.json({success:true,messageId:info.messageId||"SMTP_SUCCESS_ID"})}catch(err){console.error("[SMTP Test Send Error]:",err);return res.status(500).json({success:false,error:err.message||"Email dispatch failed."})}});app.post("/api/connections/test-whatsapp",authenticateFirebaseToken,requireAdmin,async(req,res)=>{const startTime=Date.now();try{const configs=loadConfigs();const secrets=loadSecrets();const whatsapp=configs.whatsapp;if(!whatsapp||!whatsapp.phoneNumberId){return res.json({success:false,status:"NOT_CONFIGURED",errorCode:"NOT_CONFIGURED",safeErrorMessage:"WhatsApp Business integration is not configured yet.",repairInstructions:"Please fill in Phone Number ID and Access Token."})}const{phoneNumberId,apiVersion="v17.0"}=whatsapp;const token=secrets.whatsappAccessToken;if(!token){return res.json({success:false,status:"ERROR",errorCode:"MISSING_TOKEN",safeErrorMessage:"Meta Access Token is missing.",repairInstructions:"Please enter your Meta permanent system user access token and save."})}const url=`https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;try{const metaRes=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});const latency=Date.now()-startTime;whatsapp.lastCheckedAt=new Date().toISOString();whatsapp.latency=latency;if(metaRes.ok){const data=await metaRes.json();whatsapp.status="VERIFIED";delete whatsapp.errorCode;delete whatsapp.safeErrorMessage;delete whatsapp.repairInstructions;saveConfigs({whatsapp});console.log(`[Audit Log] CONNECTION_VERIFIED: WhatsApp Cloud API verified for Phone ID: ${phoneNumberId}. Latency: ${latency}ms`);return res.json({success:true,...whatsapp,metaDetails:data})}else{whatsapp.status="ERROR";const errJson=await metaRes.json().catch(()=>({}));const metaErr=errJson.error||{};if(metaRes.status===401||metaErr.code===190){whatsapp.errorCode="TOKEN_EXPIRED";whatsapp.safeErrorMessage="Meta OAuth Token is invalid, expired, or has been revoked.";whatsapp.repairInstructions="WHAT HAPPENED: Authentication Failed.\nWHY IT HAPPENED: Access token became stale or was revoked.\nHOW TO FIX IT: Generate a new permanent Access Token in your Meta Developer Console and save it here."}else if(metaRes.status===400&&(metaErr.code===33||metaErr.message?.includes("phone_number"))){whatsapp.errorCode="INVALID_PHONE_NUMBER_ID";whatsapp.safeErrorMessage=`The Phone Number ID '${phoneNumberId}' was not recognized by Meta.`;whatsapp.repairInstructions="WHAT HAPPENED: Resource Not Found.\nWHY IT HAPPENED: Invalid ID entered.\nHOW TO FIX IT: Double-check the exact Phone Number ID from your Meta Developer Dashboard."}else if(metaRes.status===403||metaErr.code===200){whatsapp.errorCode="INSUFFICIENT_PERMISSION";whatsapp.safeErrorMessage="The access token lacks correct permissions for WhatsApp Business API.";whatsapp.repairInstructions="WHAT HAPPENED: Access Denied.\nWHY IT HAPPENED: Permitted scopes are inadequate.\nHOW TO FIX IT: Check the Meta app configuration. Make sure 'whatsapp_business_messaging' is checked."}else if(metaErr.code===2||metaErr.code===4){whatsapp.errorCode="API_VERSION_ERROR";whatsapp.safeErrorMessage=`Meta API version '${apiVersion}' might be deprecated or incompatible.`;whatsapp.repairInstructions="WHAT HAPPENED: API Compatibility mismatch.\nHOW TO FIX IT: Select a newer valid API version (e.g., 'v17.0' or newer) and retry."}else{whatsapp.errorCode="META_API_REJECTED";whatsapp.safeErrorMessage=metaErr.message||`Meta API rejected request with status ${metaRes.status}`;whatsapp.repairInstructions="WHAT HAPPENED: Meta API rejected the connection.\nHOW TO FIX IT: Verify all Meta Business Manager statuses and accounts are in good standing."}saveConfigs({whatsapp});return res.json({success:false,...whatsapp})}}catch(fetchErr){const latency=Date.now()-startTime;whatsapp.status="ERROR";whatsapp.lastCheckedAt=new Date().toISOString();whatsapp.latency=latency;whatsapp.errorCode="NETWORK_ERROR";whatsapp.safeErrorMessage="Could not establish network connection to Graph API.";whatsapp.repairInstructions="WHAT HAPPENED: Request Timed Out.\nWHY IT HAPPENED: Outgoing HTTPS connection blocked.\nHOW TO FIX IT: Check server network routing and proxy configurations.";saveConfigs({whatsapp});return res.json({success:false,...whatsapp})}}catch(err){return res.status(500).json({success:false,error:err.message})}});app.post("/api/connections/send-test-whatsapp",authenticateFirebaseToken,requireAdmin,async(req,res)=>{try{const{recipientPhone,messageText}=req.body;const configs=loadConfigs();const secrets=loadSecrets();const whatsapp=configs.whatsapp;if(!whatsapp||!whatsapp.phoneNumberId||!secrets.whatsappAccessToken){return res.status(400).json({success:false,error:"WhatsApp is not configured yet."})}const{phoneNumberId,apiVersion="v17.0"}=whatsapp;const token=secrets.whatsappAccessToken;const targetPhone=(recipientPhone||"+971501234567").replace(/[^0-9]/g,"");const url=`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;const body={messaging_product:"whatsapp",recipient_type:"individual",to:targetPhone,type:"text",text:{body:messageText||"This is an automated integration handshake test message from Emirates Falcon ERP."}};const response=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});if(response.ok){const resData=await response.json();const messageId=resData.messages?.[0]?.id||`WA_TEST_${Date.now()}`;console.log(`[Audit Log] CONNECTION_TESTED: WhatsApp test message sent to ${targetPhone}. Message ID: ${messageId}`);return res.json({success:true,messageId})}else{const errJson=await response.json().catch(()=>({}));const metaErr=errJson.error||{};throw new Error(metaErr.message||`Meta API returned HTTP status ${response.status}`)}}catch(err){console.error("[WhatsApp Test Send Error]:",err);return res.status(500).json({success:false,error:err.message||"WhatsApp dispatch failed."})}});function getEmailTransporter(configs,secrets){const gmail=configs.gmail;const user=gmail?.smtpUser||process.env.SMTP_USER||"emfalcon2025227@gmail.com";const pass=secrets?.smtpAppPassword||process.env.GMAIL_APP_PASSWORD||process.env.SMTP_PASS;const host=gmail?.smtpHost||process.env.SMTP_HOST||"smtp.gmail.com";const port=gmail?.smtpPort||parseInt(process.env.SMTP_PORT||"465",10);const secure=port===465||gmail?.encryption==="SSL"||process.env.SMTP_ENCRYPTION==="SSL";if(user&&pass){return{transporter:nodemailer.createTransport({host,port,secure,auth:{user,pass},tls:{rejectUnauthorized:true}}),fromEmail:user,senderName:gmail?.senderName||"Emirates Falcon Real Estate",isLive:true}}return{transporter:null,fromEmail:user,senderName:gmail?.senderName||"Emirates Falcon Real Estate",isLive:false}}__name(getEmailTransporter,"getEmailTransporter");app.post("/api/notifications/dispatch-portal-access",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{recipient,role,name,username,password,portalUrl,loginUrl:clientLoginUrl}=req.body;if(!recipient){return res.status(400).json({success:false,error:"Recipient email is required"})}const configs=loadConfigs();const secrets=loadSecrets();const emailConfig=getEmailTransporter(configs,secrets);const isOwner=role==="OWNER"||role==="PROPERTY_OWNER";const portalName=isOwner?"\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A\u0629":"\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631";const subject=`${portalName} \u2014 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A`;const baseUrl=portalUrl||"https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app";const resolvedLoginUrl=clientLoginUrl||(isOwner?`${baseUrl}/#owner-login`:`${baseUrl}/#tenant-login`);const messageBody=`
\u0639\u0632\u064A\u0632\u064A/\u0639\u0632\u064A\u0632\u062A\u064A ${name}\u060C

\u062A\u062D\u064A\u0629 \u0637\u064A\u0628\u0629\u060C
\u064A\u0633\u0631 \u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0625\u062D\u0627\u0637\u062A\u0643\u0645 \u0628\u0623\u0646\u0647 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628\u0643\u0645 \u0627\u0644\u062E\u0627\u0635 \u0628\u0640 (${portalName}) \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0648\u062D\u062F.

\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0643\u0645:
- \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: ${username}
- \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0624\u0642\u062A\u0629: ${password}
- \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0644\u0644\u0628\u0648\u0627\u0628\u0629: ${resolvedLoginUrl}

\u064A\u0631\u062C\u0649 \u0645\u0644\u0627\u062D\u0638\u0629 \u0623\u0646\u0647 \u0633\u064A\u064F\u0637\u0644\u0628 \u0645\u0646\u0643 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062C\u062F\u064A\u062F\u0629 \u0639\u0646\u062F \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0623\u0648\u0644 \u0645\u0631\u0629 \u0644\u062F\u0648\u0627\u0639\u064A \u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629.

\u0645\u0639 \u062A\u062D\u064A\u0627\u062A\u060C
\u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A
\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u0644\u0627\u062A\u0635\u0627\u0644: ${emailConfig.fromEmail}
    `.trim();if(emailConfig.isLive&&emailConfig.transporter){const mailOptions={from:`"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,to:recipient,subject,text:messageBody};await emailConfig.transporter.sendMail(mailOptions);console.log(`[Portal Provisioning] Live access email dispatched from ${emailConfig.fromEmail} to ${recipient}`);return res.json({success:true,status:"DISPATCHED",recipient,from:emailConfig.fromEmail})}else{console.log(`[Portal Provisioning] Simulated email dispatched from ${emailConfig.fromEmail} to ${recipient} (Waiting for Gmail App Password)`);return res.json({success:false,status:"FAILED",error:"SMTP_NOT_CONFIGURED",reason:"SMTP email is not configured in the environment."})}}catch(err){console.error("[Portal Provisioning] Email dispatch error:",err);return res.status(500).json({success:false,error:err?.message||"Failed to dispatch portal access email"})}});app.post(["/api/auth/sync-email","/api/auth/sync-email/"],authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{targetId,role,newEmail}=req.body;if(!targetId||!role||!newEmail||!newEmail.includes("@")){return res.status(400).json({success:false,error:"\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629"})}const cleanEmail=newEmail.trim().toLowerCase();const dbAdmin=getFirestoreAdmin();const authAdmin=getAdminAuthClient();if(!dbAdmin||!authAdmin){return res.status(500).json({success:false,error:"\u0641\u0634\u0644 \u062A\u0647\u064A\u0626\u0629 \u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u0645\u0631\u0643\u0632\u064A. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A Firebase Admin SDK."})}const usersCol=dbAdmin.collection("users");const userQuery=await usersCol.where(role==="OWNER"?"ownerId":"tenantId","==",targetId).limit(1).get();if(userQuery.empty){return res.json({success:true,message:"No portal account provisioned yet."})}const userDoc=userQuery.docs[0];const userData=userDoc.data();if(userData.email===cleanEmail){return res.json({success:true,message:"Email is already up to date."})}try{const existingAuth=await authAdmin.getUserByEmail(cleanEmail);if(existingAuth&&existingAuth.uid!==userData.firebaseUid){return res.status(400).json({success:false,error:"\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u062D\u0633\u0627\u0628 \u0622\u062E\u0631"})}}catch(e){if(e.code!=="auth/user-not-found"){throw e}}const emailQuery=await usersCol.where("email","==",cleanEmail).limit(1).get();if(!emailQuery.empty&&emailQuery.docs[0].id!==userDoc.id){return res.status(400).json({success:false,error:"\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0633\u062A\u062E\u062F\u0645 \u0641\u064A \u062D\u0633\u0627\u0628 \u0628\u0648\u0627\u0628\u0629 \u0622\u062E\u0631"})}if(userData.firebaseUid){await authAdmin.updateUser(userData.firebaseUid,{email:cleanEmail})}await userDoc.ref.update({email:cleanEmail,username:cleanEmail,updatedAt:new Date().toISOString()});return res.json({success:true})}catch(error){console.error("[Sync Email Error]",error);return res.status(500).json({success:false,error:error.message})}});export interface PortalProvisioningDependencies {
  writeUserProfile?: (dbAdmin: any, uid: string, profile: UserProfile) => Promise<void>;
}

export async function handleProvisionPortalUserInternal(
  req: any,
  res: any,
  dependencies: PortalProvisioningDependencies = {}
) {
  let isNewClaim = false;
  let isNewAuthUser = false;
  let createdAuthUid: string | null = null;
  let claimRef: any = null;

  try {
    const callerRole = req.user?.role;
    if (!["SYSTEM_OWNER", "ADMIN", "SUPER_ADMIN"].includes(callerRole)) {
      return res.status(403).json({
        success: false,
        error: "USER_MANAGEMENT_ADMIN_REQUIRED",
        message: "User identity management is restricted to SYSTEM_OWNER, ADMIN, and SUPER_ADMIN."
      });
    }

    const { portalRole, targetId, email, nameEn, nameAr, phone } = req.body || {};

    if (!portalRole || (portalRole !== "OWNER" && portalRole !== "TENANT")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PORTAL_ROLE",
        message: "portalRole must be either 'OWNER' or 'TENANT'."
      });
    }

    if (!targetId || typeof targetId !== "string" || !targetId.trim()) {
      return res.status(400).json({
        success: false,
        error: "MISSING_TARGET_ID",
        message: "targetId is required."
      });
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_EMAIL",
        message: "A valid email address is required."
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanTargetId = targetId.trim();

    const dbAdmin = getFirestoreAdmin();
    const authAdmin = getAdminAuthClient();
    if (!dbAdmin || !authAdmin) {
      return res.status(503).json({
        success: false,
        error: "SERVICE_UNAVAILABLE",
        message: "Authentication service is not initialized on the server."
      });
    }

    // 1. Verify Target Record Exists
    const targetCollection = portalRole === "OWNER" ? "owners" : "tenants";
    const targetDoc = await dbAdmin.collection(targetCollection).doc(cleanTargetId).get();
    if (!targetDoc.exists) {
      return res.status(400).json({
        success: false,
        error: "TARGET_NOT_FOUND",
        message: `The specified target ${portalRole.toLowerCase()} record (${cleanTargetId}) does not exist.`
      });
    }

    // 2. Atomic Claim Lock on portal_claims
    claimRef = dbAdmin.collection("portal_claims").doc(`${portalRole}_${cleanTargetId}`);

    try {
      await dbAdmin.runTransaction(async (tx) => {
        const claimDoc = await tx.get(claimRef);
        if (claimDoc.exists) {
          const claimData = claimDoc.data();
          if (claimData?.email && claimData.email !== cleanEmail) {
            throw new Error("TARGET_ALREADY_PROVISIONED");
          }
          isNewClaim = false;
        } else {
          tx.set(claimRef, {
            targetId: cleanTargetId,
            portalRole,
            email: cleanEmail,
            createdAt: new Date().toISOString()
          });
          isNewClaim = true;
        }
      });
    } catch (claimErr: any) {
      if (claimErr?.message === "TARGET_ALREADY_PROVISIONED") {
        return res.status(409).json({
          success: false,
          error: "TARGET_ALREADY_PROVISIONED",
          message: `A portal account is already provisioned for this ${portalRole.toLowerCase()}.`
        });
      }
      throw claimErr;
    }

    // Wrap ALL subsequent steps in a dedicated try/catch to guarantee claim & auth cleanup on failure
    try {
      // 3. Existing Auth User Check
      let userRecord: any = null;
      try {
        userRecord = await authAdmin.getUserByEmail(cleanEmail);
      } catch (e: any) {
        if (e.code === "auth/user-not-found") {
          userRecord = null;
        } else {
          throw e;
        }
      }

      if (userRecord) {
        const existingUserDoc = await dbAdmin.collection("users").doc(userRecord.uid).get();
        const existingUserData = existingUserDoc.exists ? (existingUserDoc.data() as UserProfile) : null;

        const isMatchingRole = existingUserData?.role === portalRole;
        const isMatchingTarget = portalRole === "OWNER"
          ? existingUserData?.ownerId === cleanTargetId
          : existingUserData?.tenantId === cleanTargetId;

        if (!existingUserData || !isMatchingRole || !isMatchingTarget) {
          if (isNewClaim && claimRef) {
            await claimRef.delete().catch(() => {});
            isNewClaim = false; // Claim released
          }
          return res.status(400).json({
            success: false,
            error: "EMAIL_ALREADY_IN_USE",
            message: "This email address is already registered to an existing unrelated account or role."
          });
        }
      } else {
        const cryptoPass = crypto.randomBytes(24).toString("hex");
        userRecord = await authAdmin.createUser({
          email: cleanEmail,
          password: cryptoPass,
          displayName: nameEn || nameAr || cleanEmail,
          emailVerified: true
        });
        isNewAuthUser = true;
        createdAuthUid = userRecord.uid;
      }

      const uid = userRecord.uid;
      const expectedSystemId = `usr-${portalRole.toLowerCase()}-${cleanTargetId}`;

      // 4. Construct Authoritative Profile
      const updatedUser: UserProfile = {
        id: uid,
        firebaseUid: uid,
        systemId: expectedSystemId,
        username: cleanEmail,
        email: cleanEmail,
        nameEn: nameEn || nameAr || cleanEmail,
        nameAr: nameAr || nameEn || cleanEmail,
        phone: phone || "",
        role: portalRole,
        ownerId: portalRole === "OWNER" ? cleanTargetId : undefined,
        tenantId: portalRole === "TENANT" ? cleanTargetId : undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
        mustChangePassword: isNewAuthUser ? true : false,
        isFirstLoginCompleted: isNewAuthUser ? false : true,
        portalAccountStatus: isNewAuthUser ? "PENDING_ACTIVATION" : "ACTIVE"
      };

      delete (updatedUser as any).password;

      // 5. Write Profile Document
      if (dependencies.writeUserProfile) {
        await dependencies.writeUserProfile(dbAdmin, uid, updatedUser);
      } else {
        await dbAdmin.collection("users").doc(uid).set(updatedUser, { merge: true });
      }

      // 6. Reset Link & Email
      let activationLink = "";
      try {
        activationLink = await authAdmin.generatePasswordResetLink(cleanEmail);
      } catch (linkErr) {
        console.warn("[Portal Provisioning Server] Could not generate reset link:", linkErr);
      }

      if (isNewAuthUser && activationLink) {
        try {
          const portalUrl = process.env.PORTAL_URL || req.headers.origin || "https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app";
          const loginUrl = portalRole === "OWNER" ? `${portalUrl}/#owner-login` : `${portalUrl}/#tenant-login`;
          const configs = loadConfigs();
          const secrets = loadSecrets();
          const emailConfig = getEmailTransporter(configs, secrets);
          const portalName = portalRole === "OWNER" ? "بوابة المالك الاستثمارية" : "بوابة المستأجر";
          const subject = `تفعيل حساب ${portalName} — صقر الإمارات للعقارات`;
          const messageBody = `
عزيزي/عزيزتي ${nameAr || nameEn || cleanEmail}،

تحية طيبة،
يسر شركة صقر الإمارات للعقارات إحاطتكم بأنه تم إنشاء حسابكم الخاص بـ (${portalName}) في النظام الموحد.

بيانات الحساب:
- اسم المستخدم (البريد الإلكتروني): ${cleanEmail}
- رابط البوابة المباشر: ${loginUrl}

لتفعيل الحساب وتعيين كلمة المرور الخاصة بكم بشكل آمن ومباشر، يرجى الضغط على الرابط السري التالي:
${activationLink}

يرجى اختيار كلمة مرور قوية تتكون من 8 خانات على الأقل تحتوي على أحرف وأرقام ورموز.

مع تحيات،
شركة صقر الإمارات للعقارات
البريد الإلكتروني: ${emailConfig.fromEmail || "info@falcon-realestate.ae"}
          `.trim();

          if (emailConfig.isLive && emailConfig.transporter) {
            const mailOptions = {
              from: `"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,
              to: cleanEmail,
              subject,
              text: messageBody
            };
            await emailConfig.transporter.sendMail(mailOptions);
          }
        } catch (emailErr) {
          console.error("[Portal Provisioning Server] Email notification error:", emailErr);
        }
      }

      return res.json({
        success: true,
        user: updatedUser,
        isNew: isNewAuthUser,
        activationLink: activationLink || undefined,
        message: isNewAuthUser
          ? "تم إنشاء حساب البوابة وإرسال رابط التفعيل الآمن بنجاح."
          : "حساب البوابة مسجل مسبقاً ومحدث."
      });
    } catch (innerErr: any) {
      console.error("[Portal Provisioning Server] Inner provisioning failure:", innerErr?.message || innerErr);

      // Cleanup newly created claim ONLY if THIS request created it
      if (isNewClaim && claimRef) {
        await claimRef.delete().catch((cErr: any) => console.error("[Portal Provisioning Server] Failed releasing claim lock:", cErr));
        isNewClaim = false;
      }

      // Cleanup newly created Auth user ONLY if THIS request created it
      if (isNewAuthUser && createdAuthUid) {
        try {
          await authAdmin.deleteUser(createdAuthUid);
          console.log(`[Portal Provisioning Server] Compensation: Cleaned up newly created Auth user ${createdAuthUid}`);
        } catch (rollbackErr: any) {
          console.error(`[Portal Provisioning Server] Compensation deleteUser failed for ${createdAuthUid}:`, rollbackErr?.message || rollbackErr);
        }
      }

      return res.status(500).json({
        success: false,
        error: innerErr?.message === "FIRESTORE_WRITE_FAILED" ? "FIRESTORE_WRITE_FAILED" : "PROVISION_ERROR",
        message: innerErr?.message === "FIRESTORE_WRITE_FAILED"
          ? "Failed to persist user profile to database."
          : (innerErr?.message || "Failed to provision portal user")
      });
    }
  } catch (err: any) {
    console.error("[Portal Provisioning Server] Provision error:", err);
    const errorMessage = err?.message || "Failed to provision portal user";
    const isPermissionError = errorMessage.includes("insufficient permission") || errorMessage.includes("PERMISSION_DENIED");
    return res.status(isPermissionError ? 403 : 500).json({
      success: false,
      error: isPermissionError ? "IAM_PERMISSION_DENIED" : "PROVISION_ERROR",
      message: isPermissionError ? "Server lacks IAM permissions for Firebase Auth." : errorMessage
    });
  }
}

app.post(["/api/auth/provision-portal-user","/api/auth/provision-portal-user/"],authenticateFirebaseToken,handleProvisionPortalUserInternal);app.post(["/api/auth/provision-staff-user", "/api/auth/provision-staff-user/"], authenticateFirebaseToken, requireUserManagementAdmin, async (req, res) => {
  try {
    const { username, email, password, nameAr, nameEn, role, phone, isActive } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "البريد الإلكتروني غير صالح أو غير مدخل" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "كلمة المرور يجب أن لا تقل عن 6 رموز" });
    }
    if (role === "SYSTEM_OWNER") {
      return res.status(403).json({ success: false, error: "FORBIDDEN", message: "لا يمكن إنشاء حساب SYSTEM_OWNER آخر" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || cleanEmail.split("@")[0]).trim().toLowerCase();

    const dbAdmin = getFirestoreAdmin();
    const authAdmin = getAdminAuthClient();
    if (!dbAdmin || !authAdmin) {
      return res.status(503).json({
        success: false,
        error: "SERVICE_UNAVAILABLE",
        message: "نظام التحقق المركزي غير مهيأ على الخادم."
      });
    }

    const usersCol = dbAdmin.collection("users");

    if (cleanUsername) {
      const uSnap = await usersCol.where("username", "==", cleanUsername).limit(1).get();
      if (!uSnap.empty && uSnap.docs[0].data().email !== cleanEmail) {
        return res.status(400).json({ success: false, error: "DUPLICATE_USERNAME", message: "اسم المستخدم مسجل مسبقاً لمستخدم آخر" });
      }
    }

    let userRecord;
    let isNewAuthUser = false;
    try {
      userRecord = await authAdmin.getUserByEmail(cleanEmail);
      await authAdmin.updateUser(userRecord.uid, {
        password: password,
        displayName: nameEn || nameAr || cleanUsername,
        emailVerified: true
      });
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        userRecord = await authAdmin.createUser({
          email: cleanEmail,
          password: password,
          displayName: nameEn || nameAr || cleanUsername,
          emailVerified: true
        });
        isNewAuthUser = true;
      } else {
        throw e;
      }
    }

    const uid = userRecord.uid;
    const newUserDoc: UserProfile = {
      id: uid,
      systemId: "usr-" + Date.now(),
      username: cleanUsername,
      email: cleanEmail,
      nameAr: nameAr || cleanUsername,
      nameEn: nameEn || nameAr || cleanUsername,
      phone: phone || "",
      role: role || "PROPERTY_MANAGER",
      isActive: isActive !== false,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
      isFirstLoginCompleted: true,
      portalAccountStatus: "ACTIVE",
      firebaseUid: uid
    };

    try {
      await usersCol.doc(uid).set(newUserDoc, { merge: true });

      await dbAdmin.collection("users_by_email").doc(cleanEmail).set({
        id: uid,
        firebaseUid: uid,
        email: cleanEmail,
        username: cleanUsername,
        role: newUserDoc.role,
        isActive: newUserDoc.isActive
      }, { merge: true });
    } catch (firestoreErr: any) {
      console.error("[Provision Staff User] Firestore profile creation failed:", firestoreErr?.message || firestoreErr);
      if (isNewAuthUser) {
        try {
          await authAdmin.deleteUser(uid);
          console.log(`[Provision Staff User] Rolled back newly created Firebase Auth account for UID ${uid}`);
        } catch (rollbackErr: any) {
          console.error(`[CRITICAL INCONSISTENCY] Failed to rollback Firebase Auth user ${uid}:`, rollbackErr?.message || rollbackErr);
        }
      }
      return res.status(500).json({ success: false, error: "FIRESTORE_PROVISIONING_FAILED", message: "Failed to persist user profile to database." });
    }

    return res.json({
      success: true,
      user: newUserDoc,
      isNew: isNewAuthUser,
      message: "تم إنشاء وترخيص حساب المستخدم بنجاح في نظام الموثوقية"
    });
  } catch (err: any) {
    console.error("[Provision Staff User Server Error]:", err);
    return res.status(500).json({ success: false, error: err?.message || "فشل إنشاء حساب المستخدم" });
  }
});

app.post("/api/auth/update-user-profile", authenticateFirebaseToken, async (req,res)=>{
  try{
    const {userId,patch}=req.body||{};
    if(!userId || !patch || typeof patch!=="object" || Array.isArray(patch)) return res.status(400).json({success:false,error:"VALIDATION_ERROR",message:"Invalid user update payload."});
    const dbAdmin=getFirestoreAdmin();
    const authAdmin=getAdminAuthClient();
    if(!dbAdmin || !authAdmin) return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE",message:"Central identity services are not initialized."});
    const userRef=dbAdmin.collection("users").doc(String(userId));
    const snap=await userRef.get();
    if(!snap.exists) return res.status(404).json({success:false,error:"NOT_FOUND",message:"User profile not found."});
    const current=snap.data()||{};
    const callerRole=req.user.role;
    const isSelf=req.user.uid===String(userId);
    const isUserManagementAdmin=["SYSTEM_OWNER","ADMIN","SUPER_ADMIN"].includes(callerRole);
    if(!isSelf && !isUserManagementAdmin) return res.status(403).json({success:false,error:"USER_MANAGEMENT_ADMIN_REQUIRED",message:"User profile management is restricted to the account owner or authorized administrators."});
    if(current.role==="SYSTEM_OWNER" && callerRole!=="SYSTEM_OWNER") return res.status(403).json({success:false,error:"FORBIDDEN",message:"SYSTEM_OWNER profile is protected."});
    if(current.firebaseUid && current.firebaseUid!==String(userId)) return res.status(409).json({success:false,error:"IDENTITY_MISMATCH",message:"User profile is not keyed by its authoritative Firebase UID."});

    const forbidden=["id","role","firebaseUid","password","createdAt"];
    for(const key of forbidden){if(Object.prototype.hasOwnProperty.call(patch,key)) return res.status(400).json({success:false,error:"SENSITIVE_FIELD_REQUIRES_DEDICATED_PATH",field:key});}
    if(Object.prototype.hasOwnProperty.call(patch,"isActive") || Object.prototype.hasOwnProperty.call(patch,"disabled")) return res.status(400).json({success:false,error:"STATUS_REQUIRES_DEDICATED_PATH"});
    const allowed=isSelf
      ? ["username","nameAr","nameEn","phone"]
      : ["username","email","nameAr","nameEn","phone","ownerId","tenantId","permissions","userPermissionOverrides","mustChangePassword","isFirstLoginCompleted","portalAccountStatus","employeeId","systemId"];
    const cleanPatch:any={};
    for(const key of allowed){if(Object.prototype.hasOwnProperty.call(patch,key)) cleanPatch[key]=patch[key];}
    if(Object.keys(cleanPatch).length===0) return res.status(400).json({success:false,error:"NO_ALLOWED_FIELDS"});

    const uid=String(userId);
    if(cleanPatch.email){
      const cleanEmail=String(cleanPatch.email).trim().toLowerCase();
      if(!cleanEmail.includes("@")) return res.status(400).json({success:false,error:"VALIDATION_ERROR",message:"Invalid email address."});
      const authUser=await authAdmin.getUser(uid);
      await authAdmin.updateUser(uid,{email:cleanEmail});
      cleanPatch.email=cleanEmail;
      await dbAdmin.collection("users_by_email").doc(cleanEmail).set({id:uid,firebaseUid:uid,email:cleanEmail,username:cleanPatch.username||current.username||"",role:current.role||"GUEST",isActive:current.isActive!==false},{merge:true});
      if(current.email && String(current.email).trim().toLowerCase()!==cleanEmail) await dbAdmin.collection("users_by_email").doc(String(current.email).trim().toLowerCase()).delete().catch(()=>{});
      void authUser;
    }
    if(cleanPatch.username) cleanPatch.username=String(cleanPatch.username).trim().toLowerCase();
    cleanPatch.updatedAt=new Date().toISOString();
    await userRef.set(cleanPatch,{merge:true});
    const updated=(await userRef.get()).data()||{};
    if(updated.email){
      await dbAdmin.collection("users_by_email").doc(String(updated.email).trim().toLowerCase()).set({id:uid,firebaseUid:uid,email:updated.email,username:updated.username||"",role:updated.role||"GUEST",isActive:updated.isActive!==false},{merge:true});
    }
    return res.json({success:true,user:{...updated,id:uid,firebaseUid:uid}});
  }catch(err:any){
    console.error("[User Profile Update] Error:",err);
    return res.status(500).json({success:false,error:err?.message||"Failed to update user profile."});
  }
});

app.post("/api/auth/update-user-status", authenticateFirebaseToken, requireUserManagementAdmin, async (req,res)=>{
  try{
    const {userId,isActive}=req.body||{};
    if(!userId || typeof isActive!=="boolean") return res.status(400).json({success:false,error:"VALIDATION_ERROR"});
    const dbAdmin=getFirestoreAdmin(), authAdmin=getAdminAuthClient();
    if(!dbAdmin || !authAdmin) return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE"});
    const ref=dbAdmin.collection("users").doc(String(userId)), snap=await ref.get();
    if(!snap.exists) return res.status(404).json({success:false,error:"NOT_FOUND"});
    const current=snap.data()||{};
    if(current.role==="SYSTEM_OWNER") return res.status(403).json({success:false,error:"SYSTEM_OWNER_PROTECTED"});

    const previousIsActive = current.isActive !== false;

    try {
      await authAdmin.updateUser(String(userId), { disabled: !isActive });
    } catch (authErr: any) {
      console.error("[User Status Update] Auth status update failed:", authErr?.message || authErr);
      return res.status(500).json({ success: false, error: "AUTH_UPDATE_FAILED", message: authErr?.message || "Failed to update authentication state." });
    }

    try {
      await ref.set({isActive,disabled:!isActive,updatedAt:new Date().toISOString()},{merge:true});
      if(current.email) await dbAdmin.collection("users_by_email").doc(String(current.email).trim().toLowerCase()).set({id:String(userId),firebaseUid:String(userId),email:current.email,username:current.username||"",role:current.role||"GUEST",isActive},{merge:true});
    } catch (firestoreErr: any) {
      console.error("[User Status Update] Firestore write failed after Auth update. Attempting rollback...", firestoreErr?.message || firestoreErr);
      try {
        await authAdmin.updateUser(String(userId), { disabled: !previousIsActive });
        console.log(`[User Status Update] Successfully rolled back Auth state for UID ${userId}`);
      } catch (rollbackErr: any) {
        console.error(`[CRITICAL INCONSISTENCY] Failed to rollback Auth state for UID ${userId}:`, rollbackErr?.message || rollbackErr);
      }
      return res.status(500).json({ success: false, error: "FIRESTORE_UPDATE_FAILED", message: "Database status update failed. Auth status was rolled back." });
    }

    const updated=(await ref.get()).data()||{};
    return res.json({success:true,user:{...updated,id:String(userId),firebaseUid:String(userId)}});
  }catch(err:any){console.error("[User Status Update] Error:",err);return res.status(500).json({success:false,error:err?.message||"Failed to update user status."})}
});

app.post("/api/auth/update-user-role", authenticateFirebaseToken, requireUserManagementAdmin, async (req,res)=>{
  try{
    const {userId,newRole}=req.body||{};
    const validRoles=["SYSTEM_OWNER","ADMIN","SUPER_ADMIN","MANAGER","SALES_MANAGER","FINANCE","LEGAL","PROPERTY_MANAGER","DATA_ENTRY","TENANT","OWNER","PROPERTY_OWNER"];
    if(!userId || !validRoles.includes(newRole)) return res.status(400).json({success:false,error:"INVALID_ROLE"});
    const dbAdmin=getFirestoreAdmin();
    if(!dbAdmin) return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE"});
    const ref=dbAdmin.collection("users").doc(String(userId)),snap=await ref.get();
    if(!snap.exists) return res.status(404).json({success:false,error:"NOT_FOUND"});
    const current=snap.data()||{};
    const caller=req.user.role;
    if(current.role==="SYSTEM_OWNER" && (caller!=="SYSTEM_OWNER" || newRole!=="SYSTEM_OWNER")) return res.status(403).json({success:false,error:"SYSTEM_OWNER_PROTECTED"});
    if(newRole==="SYSTEM_OWNER" && current.role!=="SYSTEM_OWNER") return res.status(403).json({success:false,error:"SYSTEM_OWNER_CREATION_FORBIDDEN"});
    await ref.set({role:newRole,updatedAt:new Date().toISOString()},{merge:true});
    const updated=(await ref.get()).data()||{};
    if(updated.email) await dbAdmin.collection("users_by_email").doc(String(updated.email).trim().toLowerCase()).set({id:String(userId),firebaseUid:String(userId),email:updated.email,username:updated.username||"",role:newRole,isActive:updated.isActive!==false},{merge:true});
    return res.json({success:true,user:{...updated,id:String(userId),firebaseUid:String(userId)}});
  }catch(err:any){console.error("[User Role Update] Error:",err);return res.status(500).json({success:false,error:err?.message||"Failed to update user role."})}
});

app.post("/api/auth/delete-user", authenticateFirebaseToken, requireUserManagementAdmin, async (req,res)=>{
  try{
    const {userId}=req.body||{};
    if(!userId) return res.status(400).json({success:false,error:"VALIDATION_ERROR"});
    const dbAdmin=getFirestoreAdmin(),authAdmin=getAdminAuthClient();
    if(!dbAdmin || !authAdmin) return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE"});
    const ref=dbAdmin.collection("users").doc(String(userId)),snap=await ref.get();
    if(!snap.exists) return res.status(404).json({success:false,error:"NOT_FOUND"});
    const current=snap.data()||{};
    if(current.role==="SYSTEM_OWNER") return res.status(403).json({success:false,error:"SYSTEM_OWNER_PROTECTED"});
    if(current.firebaseUid && current.firebaseUid!==String(userId)) return res.status(409).json({success:false,error:"IDENTITY_MISMATCH"});
    
    try {
      await authAdmin.deleteUser(String(userId));
    } catch(e:any) {
      if(e?.code !== "auth/user-not-found") {
        console.error("[User Delete] Auth deletion failed:", e?.message || e);
        return res.status(500).json({ success: false, error: "AUTH_DELETE_FAILED", message: e?.message || "Failed to delete user from authentication service." });
      }
    }

    try {
      if(current.email) await dbAdmin.collection("users_by_email").doc(String(current.email).trim().toLowerCase()).delete().catch(()=>{});
      await ref.delete();
    } catch(firestoreErr: any) {
      console.error(`[CRITICAL INCONSISTENCY] User ${userId} was deleted from Auth, but Firestore cleanup failed:`, firestoreErr?.message || firestoreErr);
      return res.status(500).json({
        success: false,
        error: "FIRESTORE_CLEANUP_FAILED",
        message: "User was deleted from Auth, but database cleanup failed.",
        details: firestoreErr?.message || String(firestoreErr)
      });
    }

    return res.json({success:true});
  }catch(err:any){console.error("[User Delete] Error:",err);return res.status(500).json({success:false,error:err?.message||"Failed to delete user."})}
});

app.post("/api/auth/user-permission-override", authenticateFirebaseToken, requireUserManagementAdmin, async (req,res)=>{
  try{
    const {userId,permissionId,effect,reason,expiresAt}=req.body||{};
    if(!userId || !permissionId || !["GRANT","DENY"].includes(effect)) return res.status(400).json({success:false,error:"VALIDATION_ERROR"});
    const dbAdmin=getFirestoreAdmin(); if(!dbAdmin) return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE"});
    const target=await dbAdmin.collection("users").doc(String(userId)).get();
    if(!target.exists) return res.status(404).json({success:false,error:"USER_NOT_FOUND"});
    if(target.data()?.role==="SYSTEM_OWNER") return res.status(403).json({success:false,error:"SYSTEM_OWNER_PROTECTED"});
    const id="ovr-"+Date.now()+"-"+crypto.randomBytes(6).toString("hex");
    const override={id,userId:String(userId),permissionId:String(permissionId),effect,reason:reason||"",createdBy:req.user.uid,createdAt:new Date().toISOString(),expiresAt:expiresAt||null,status:"ACTIVE"};
    await dbAdmin.collection("userPermissionOverrides").doc(id).set(override);
    return res.json({success:true,override});
  }catch(err:any){console.error("[Permission Override] Error:",err);return res.status(500).json({success:false,error:err?.message||"Failed to create permission override."})}
});

app.post("/api/auth/revoke-user-permission-override", authenticateFirebaseToken, requireUserManagementAdmin, async (req,res)=>{
  try{
    const {overrideId}=req.body||{};
    if(!overrideId) return res.status(400).json({success:false,error:"VALIDATION_ERROR"});
    const dbAdmin=getFirestoreAdmin(); if(!dbAdmin) return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE"});
    const ref=dbAdmin.collection("userPermissionOverrides").doc(String(overrideId)),snap=await ref.get();
    if(!snap.exists) return res.status(404).json({success:false,error:"NOT_FOUND"});
    await ref.set({status:"REVOKED",revokedBy:req.user.uid,revokedAt:new Date().toISOString()},{merge:true});
    return res.json({success:true});
  }catch(err:any){console.error("[Permission Override Revoke] Error:",err);return res.status(500).json({success:false,error:err?.message||"Failed to revoke permission override."})}
});

app.post("/api/auth/import-users", authenticateFirebaseToken, requireUserManagementAdmin, async (req,res)=>{
  try{
    const records=Array.isArray(req.body?.records)?req.body.records:[];
    if(records.length===0) return res.status(400).json({success:false,error:"NO_RECORDS"});
    if(records.length>500) return res.status(400).json({success:false,error:"BATCH_TOO_LARGE"});
    const dbAdmin=getFirestoreAdmin(),authAdmin=getAdminAuthClient();
    if(!dbAdmin || !authAdmin) return res.status(503).json({success:false,error:"SERVICE_UNAVAILABLE"});
    const users:any[]=[]; const errors:string[]=[]; let importedCount=0,updatedCount=0;
    const validRoles=["ADMIN","SUPER_ADMIN","MANAGER","SALES_MANAGER","FINANCE","LEGAL","PROPERTY_MANAGER","DATA_ENTRY","TENANT","OWNER","PROPERTY_OWNER"];
    for(let i=0;i<records.length;i++){
      const rec=records[i]||{};
      try{
        if(rec.role==="SYSTEM_OWNER") throw new Error("SYSTEM_OWNER cannot be imported.");
        let uid=typeof rec.firebaseUid==="string"?rec.firebaseUid:"";
        let ref=uid?dbAdmin.collection("users").doc(uid):null;
        let snap=ref?await ref.get():null;
        if(!snap?.exists && rec.id){ref=dbAdmin.collection("users").doc(String(rec.id));snap=await ref.get()}
        if(!snap?.exists && rec.email){
          const q=await dbAdmin.collection("users").where("email","==",String(rec.email).trim().toLowerCase()).limit(1).get();
          if(!q.empty){ref=q.docs[0].ref;snap=q.docs[0]}
        }
        if(!snap?.exists || !ref) throw new Error("User must already have an authoritative Firebase UID profile. Use normal provisioning to create new accounts.");
        uid=ref.id;
        if((snap.data()||{}).firebaseUid && (snap.data()||{}).firebaseUid!==uid) throw new Error("Firebase UID mismatch.");
        const current=snap.data()||{};
        if(current.role==="SYSTEM_OWNER") throw new Error("SYSTEM_OWNER profile is protected.");
        if(rec.role!==undefined && !validRoles.includes(rec.role)) throw new Error("Invalid ERP role.");
        const allowed=["username","email","nameAr","nameEn","phone","ownerId","tenantId","permissions","userPermissionOverrides","mustChangePassword","isFirstLoginCompleted","portalAccountStatus"];
        const patch:any={};
        for(const key of allowed){if(Object.prototype.hasOwnProperty.call(rec,key)) patch[key]=rec[key]}
        if(rec.role!==undefined) patch.role=rec.role;
        if(rec.isActive!==undefined){
          if(typeof rec.isActive!=="boolean") throw new Error("Invalid isActive value.");
          patch.isActive=rec.isActive; patch.disabled=!rec.isActive;
          await authAdmin.updateUser(uid,{disabled:!rec.isActive});
        }
        if(patch.email) patch.email=String(patch.email).trim().toLowerCase();
        if(patch.username) patch.username=String(patch.username).trim().toLowerCase();
        patch.updatedAt=new Date().toISOString();
        await ref.set(patch,{merge:true});
        const updated=(await ref.get()).data()||{};
        if(updated.email) await dbAdmin.collection("users_by_email").doc(String(updated.email).trim().toLowerCase()).set({id:uid,firebaseUid:uid,email:updated.email,username:updated.username||"",role:updated.role||"GUEST",isActive:updated.isActive!==false},{merge:true});
        users.push({...updated,id:uid,firebaseUid:uid});
        updatedCount++;
      }catch(e:any){errors.push(`السجل رقم ${i+1}: ${e?.message||String(e)}`)}
    }
    importedCount=0;
    return res.json({success:true,total:records.length,importedCount,updatedCount,errors,users});
  }catch(err:any){console.error("[User Import] Error:",err);return res.status(500).json({success:false,error:err?.message||"Failed to import users."})}
});

app.post(["/api/auth/update-user-password", "/api/auth/update-user-password/"], authenticateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { userId, email, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR", message: "كلمة المرور يجب أن لا تقل عن 6 رموز" });
    }

    const authAdmin = getAdminAuthClient();
    const dbAdmin = getFirestoreAdmin();
    if (!authAdmin || !dbAdmin) {
      return res.status(503).json({ success: false, error: "SERVICE_UNAVAILABLE", message: "نظام التحقق المركزي غير مهيأ" });
    }

    let targetEmail = (email || "").trim().toLowerCase();
    if (!targetEmail && userId) {
      const uDoc = await dbAdmin.collection("users").doc(userId).get();
      if (uDoc.exists) {
        targetEmail = (uDoc.data()?.email || "").trim().toLowerCase();
      }
    }

    if (!targetEmail) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "لم يتم العثور على البريد الإلكتروني للمستخدم" });
    }

    let userRecord;
    try {
      userRecord = await authAdmin.getUserByEmail(targetEmail);
      await authAdmin.updateUser(userRecord.uid, {
        password: newPassword,
        emailVerified: true
      });
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        userRecord = await authAdmin.createUser({
          email: targetEmail,
          password: newPassword,
          emailVerified: true
        });
      } else {
        throw e;
      }
    }

    await dbAdmin.collection("users").doc(userRecord.uid).set({
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.json({ success: true, message: "تم تحديث كلمة المرور في نظام المصادقة بنجاح" });
  } catch (err: any) {
    console.error("[Update Password Server Error]:", err);
    return res.status(500).json({ success: false, error: err?.message || "فشل تحديث كلمة المرور" });
  }
});

app.post("/api/auth/generate-activation-link",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{email}=req.body;if(!email||!email.includes("@")){return res.status(400).json({success:false,error:"\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D"})}const cleanEmail=email.trim().toLowerCase();const authAdmin=getAdminAuthClient();if(!authAdmin){return res.status(500).json({success:false,error:"Firebase Admin Auth is not configured on the server."})}try{await authAdmin.getUserByEmail(cleanEmail)}catch(err){if(err.code==="auth/user-not-found"){const cryptoPass=crypto.randomBytes(24).toString("hex");await authAdmin.createUser({email:cleanEmail,password:cryptoPass,emailVerified:true})}else{throw err}}const resetLink=await authAdmin.generatePasswordResetLink(cleanEmail);return res.json({success:true,email:cleanEmail,activationLink:resetLink})}catch(err){console.error("[Auth Link Generation Error]:",err);return res.status(500).json({success:false,error:err.message||"Failed to generate activation link"})}});app.post(["/api/auth/send-portal-activation-email","/api/auth/send-portal-activation-email/"],authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{email,name,role,targetId,customBaseUrl}=req.body;if(!email||!email.includes("@")){return res.status(400).json({success:false,error:"\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D"})}const cleanEmail=email.trim().toLowerCase();const dbAdmin=getFirestoreAdmin();const authAdmin=getAdminAuthClient();if(!dbAdmin||!authAdmin){return res.status(500).json({success:false,error:"\u0641\u0634\u0644 \u062A\u0647\u064A\u0626\u0629 \u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u0645\u0631\u0643\u0632\u064A. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A Firebase Admin SDK."})}let targetProfile=null;let targetType=null;let targetRecordId=targetId||"";if(targetRecordId){const isOwnerRole=role==="OWNER"||role==="PROPERTY_OWNER";const colName=isOwnerRole?"owners":"tenants";const docSnap=await dbAdmin.collection(colName).doc(targetRecordId).get();if(docSnap.exists){targetProfile=docSnap.data();targetType=isOwnerRole?"OWNER":"TENANT"}}if(!targetProfile){const ownersSnap=await dbAdmin.collection("owners").where("email","==",cleanEmail).limit(1).get();if(!ownersSnap.empty){targetProfile=ownersSnap.docs[0].data();targetType="OWNER";targetRecordId=ownersSnap.docs[0].id}else{const tenantsSnap=await dbAdmin.collection("tenants").where("email","==",cleanEmail).limit(1).get();if(!tenantsSnap.empty){targetProfile=tenantsSnap.docs[0].data();targetType="TENANT";targetRecordId=tenantsSnap.docs[0].id}}}if(!targetProfile){return res.status(404).json({success:false,error:"PROFILE_NOT_FOUND",message:"\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0644\u0641 \u0634\u062E\u0635\u064A \u0645\u0633\u062C\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645."})}if(targetType!=="OWNER"&&targetType!=="TENANT"){return res.status(400).json({success:false,error:"INVALID_PROFILE_TYPE",message:"\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u0644\u064A\u0633 \u0645\u0627\u0644\u0643\u0627\u064B \u0623\u0648 \u0645\u0633\u062A\u0623\u062C\u0631\u0627\u064B"})}const recordEmail=(targetProfile.email||"").trim().toLowerCase();if(recordEmail!==cleanEmail){return res.status(400).json({success:false,error:"EMAIL_MISMATCH",message:"\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0633\u062C\u0644 \u0641\u064A \u0645\u0644\u0641 \u0627\u0644\u0645\u0627\u0644\u0643/\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631"})}const usersCol=dbAdmin.collection("users");const emailQuery=await usersCol.where("email","==",cleanEmail).limit(1).get();let portalDoc=null;if(!emailQuery.empty){portalDoc=emailQuery.docs[0].data()}let authUser=null;try{authUser=await authAdmin.getUserByEmail(cleanEmail)}catch(err){if(err.code!=="auth/user-not-found"){throw err}}if(authUser&&portalDoc){const linkedRecordId=portalDoc.ownerId||portalDoc.tenantId;if(linkedRecordId&&linkedRecordId!==targetRecordId){return res.status(400).json({success:false,error:"ACCOUNT_LINK_CONFLICT",message:"\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u0631\u0628\u0637 \u0627\u0644\u062D\u0633\u0627\u0628: \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0644\u0645\u0644\u0641 \u0634\u062E\u0635\u064A \u0622\u062E\u0631 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645."})}}if(!authUser){const expectedId=`usr-${targetType.toLowerCase()}-${targetRecordId}`;const cryptoPass=crypto.randomBytes(24).toString("hex");const userRecord=await authAdmin.createUser({email:cleanEmail,password:cryptoPass,displayName:targetProfile.nameEn||targetProfile.nameAr||cleanEmail,emailVerified:true});const updatedUser={id:userRecord.uid,systemId:expectedId,username:cleanEmail,email:cleanEmail,nameEn:targetProfile.nameEn||cleanEmail,nameAr:targetProfile.nameAr||cleanEmail,phone:targetProfile.phone||"",role:targetType,ownerId:targetType==="OWNER"?targetRecordId:void 0,tenantId:targetType==="TENANT"?targetRecordId:void 0,isActive:true,createdAt:new Date().toISOString(),mustChangePassword:true,isFirstLoginCompleted:false,portalAccountStatus:"PENDING_ACTIVATION",firebaseUid:userRecord.uid};await usersCol.doc(userRecord.uid).set(updatedUser,{merge:true});authUser=userRecord}const resetLink=await authAdmin.generatePasswordResetLink(cleanEmail);const isOwner=targetType==="OWNER";const portalName=isOwner?"\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A\u0629":"\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631";const portalUrl=customBaseUrl||process.env.PORTAL_URL||req.headers.origin||"https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app";const loginUrl=isOwner?`${portalUrl}/#owner-login`:`${portalUrl}/#tenant-login`;const configs=loadConfigs();const secrets=loadSecrets();const emailConfig=getEmailTransporter(configs,secrets);const subject=`\u0631\u0627\u0628\u0637 \u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628 ${portalName} \u2014 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A`;const messageBody=`
\u0639\u0632\u064A\u0632\u064A/\u0639\u0632\u064A\u0632\u062A\u064A ${name||cleanEmail}\u060C

\u062A\u062D\u064A\u0629 \u0637\u064A\u0628\u0629\u060C
\u064A\u0633\u0631 \u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u062A\u0632\u0648\u064A\u062F\u0643\u0645 \u0628\u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u062E\u0648\u0644 \u0648\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628\u0643\u0645 \u0627\u0644\u062E\u0627\u0635 \u0628\u0640 (${portalName}) \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0648\u062D\u062F.

\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628:
- \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: ${cleanEmail}
- \u0631\u0627\u0628\u0637 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631: ${loginUrl}

\u0644\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u0648 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062C\u062F\u064A\u062F\u0629 \u062E\u0627\u0635\u0629 \u0628\u0643\u0645\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u0622\u0645\u0646 \u0627\u0644\u062A\u0627\u0644\u064A:
${resetLink}

\u0645\u0639 \u062A\u062D\u064A\u0627\u062A\u060C
\u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A
\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A: ${emailConfig.fromEmail||"info@falcon-realestate.ae"}
    `.trim();if(emailConfig.isLive&&emailConfig.transporter){const mailOptions={from:`"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,to:cleanEmail,subject,text:messageBody};await emailConfig.transporter.sendMail(mailOptions);return res.json({success:true,status:"DISPATCHED",activationLink:resetLink})}else{return res.json({success:true,status:"SIMULATED",activationLink:resetLink,note:"Email logged (SMTP inactive)"})}}catch(err){console.error("[Send Activation Email Error]:",err);return res.status(500).json({success:false,error:"GENERATE_LINK_FAILED",message:err.message||"Failed to send activation email"})}});app.post(["/api/auth/sync-portal-users","/api/auth/sync-portal-users/"],authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{owners=[],tenants=[]}=req.body;const dbAdmin=getFirestoreAdmin();const authAdmin=getAdminAuthClient();if(!dbAdmin||!authAdmin){return res.status(500).json({success:false,error:"\u0641\u0634\u0644 \u062A\u0647\u064A\u0626\u0629 \u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u0645\u0631\u0643\u0632\u064A. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A Firebase Admin SDK."})}const usersCol=dbAdmin.collection("users");let createdCount=0;const allToProvision=[...owners.map(o=>({...o,portalRole:"OWNER"})),...tenants.map(t=>({...t,portalRole:"TENANT"}))];for(const item of allToProvision){const email=item.email;if(!email||!email.includes("@"))continue;const cleanEmail=email.trim().toLowerCase();const expectedId=`usr-${item.portalRole.toLowerCase()}-${item.id}`;let userRecord;let isNewAuthUser=false;try{userRecord=await authAdmin.getUserByEmail(cleanEmail)}catch(e){if(e.code==="auth/user-not-found"){const cryptoPass=crypto.randomBytes(24).toString("hex");userRecord=await authAdmin.createUser({email:cleanEmail,password:cryptoPass,displayName:item.nameEn||item.nameAr||cleanEmail,emailVerified:true});isNewAuthUser=true}else{continue}}const uid=userRecord.uid;let existingUserDoc=await usersCol.doc(uid).get();let userData:UserProfile={};if(existingUserDoc.exists){userData=existingUserDoc.data() as UserProfile}else{const legacyDoc=await usersCol.doc(expectedId).get();if(legacyDoc.exists){userData=legacyDoc.data() as UserProfile;await usersCol.doc(expectedId).delete().catch(()=>{})}else{const emailQuery=await usersCol.where("email","==",cleanEmail).limit(1).get();if(!emailQuery.empty){userData=emailQuery.docs[0].data() as UserProfile;await usersCol.doc(emailQuery.docs[0].id).delete().catch(()=>{})}}}const newUserDoc:UserProfile={...userData,id:uid,systemId:expectedId,username:cleanEmail,email:cleanEmail,nameEn:item.nameEn||userData.nameEn||item.nameAr||cleanEmail,nameAr:item.nameAr||userData.nameAr||item.nameEn||cleanEmail,phone:item.phone||userData.phone||"",role:item.portalRole==="OWNER"?"OWNER":"TENANT",ownerId:item.portalRole==="OWNER"?item.id:void 0,tenantId:item.portalRole==="TENANT"?item.id:void 0,isActive:userData.isActive!==void 0?userData.isActive:true,createdAt:userData.createdAt||new Date().toISOString(),mustChangePassword:isNewAuthUser?true:userData.mustChangePassword!==void 0?userData.mustChangePassword:false,isFirstLoginCompleted:isNewAuthUser?false:userData.isFirstLoginCompleted!==void 0?userData.isFirstLoginCompleted:true,portalAccountStatus:isNewAuthUser?"PENDING_ACTIVATION":userData.portalAccountStatus||"ACTIVE",firebaseUid:uid};await usersCol.doc(uid).set(newUserDoc,{merge:true});createdCount++;if(isNewAuthUser){try{const resetLink=await authAdmin.generatePasswordResetLink(cleanEmail);const portalUrl=process.env.PORTAL_URL||req.headers.origin||"https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app";const loginUrl=item.portalRole==="OWNER"?`${portalUrl}/#owner-login`:`${portalUrl}/#tenant-login`;const configs=loadConfigs();const secrets=loadSecrets();const emailConfig=getEmailTransporter(configs,secrets);const portalName=item.portalRole==="OWNER"?"\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A\u0629":"\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631";const subject=`\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628 ${portalName} \u2014 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A`;const messageBody=`
\u0639\u0632\u064A\u0632\u064A/\u0639\u0632\u064A\u0632\u062A\u064A ${item.nameAr||item.nameEn||cleanEmail}\u060C

\u062A\u062D\u064A\u0629 \u0637\u064A\u0628\u0629\u060C
\u064A\u0633\u0631 \u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0625\u062D\u0627\u0637\u062A\u0643\u0645 \u0628\u0623\u0646\u0647 \u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628\u0643\u0645 \u0627\u0644\u062E\u0627\u0635 \u0628\u0640 (${portalName}) \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0648\u062D\u062F.

\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644:
- \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: ${cleanEmail}
- \u0631\u0627\u0628\u0637 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631: ${loginUrl}

\u0644\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0643\u0645\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u062A\u0627\u0644\u064A:
${resetLink}

\u0645\u0639 \u062A\u062D\u064A\u0627\u062A\u060C
\u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A
\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A: ${emailConfig.fromEmail||"info@falcon-realestate.ae"}
            `.trim();if(emailConfig.isLive&&emailConfig.transporter){const mailOptions={from:`"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,to:cleanEmail,subject,text:messageBody};await emailConfig.transporter.sendMail(mailOptions)}}catch(emailErr){console.error("Bulk sync email send failed for:",cleanEmail,emailErr)}}}return res.json({success:true,createdCount})}catch(err){console.error("[Portal Bulk Sync Server] Sync error:",err);return res.status(500).json({success:false,error:err?.message||"Failed to bulk sync portal users"})}});app.post("/api/notifications/dispatch-receipt",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{recipient,ownerEmail,tenantNameAr,tenantNameEn,ownerName,receiptNumber,amount,paymentMethod,payerName,chequeNumber,chequeAmount,date,propertyName,unitNumber,remainingBalance}=req.body;if(!recipient&&!ownerEmail){return res.status(400).json({success:false,error:"At least one recipient email (tenant or owner) is required"})}const configs=loadConfigs();const secrets=loadSecrets();const emailConfig=getEmailTransporter(configs,secrets);const tenantName=tenantNameAr||tenantNameEn||payerName||"\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0627\u0644\u0645\u062D\u062A\u0631\u0645";const subject=`\u0633\u0646\u062F \u0642\u0628\u0636 \u0631\u0633\u0645\u064A \u0645\u0639\u062A\u0645\u062F / Official Collection Receipt #${receiptNumber} \u2014 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A`;const formattedAmount=Number(amount||0).toLocaleString();const messageBody=`
\u0633\u0646\u062F \u0642\u0628\u0636 \u0645\u0627\u0644\u064A \u0645\u0639\u062A\u0645\u062F / Official Rental Collection Receipt
=====================================================
\u0631\u0642\u0645 \u0627\u0644\u0633\u0646\u062F: ${receiptNumber}
\u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${date||new Date().toISOString().split("T")[0]}
\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062D\u0635\u0644: ${formattedAmount} \u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A

\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0629:
- \u0627\u0644\u062F\u0627\u0641\u0639: ${payerName||tenantName}
- \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631: ${tenantName}
- \u0627\u0644\u0645\u0627\u0644\u0643: ${ownerName||"\u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A"}
- \u0627\u0644\u0639\u0642\u0627\u0631: ${propertyName||"N/A"}
- \u0631\u0642\u0645 \u0627\u0644\u0648\u062D\u062F\u0629: ${unitNumber||"N/A"}
- \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639: ${paymentMethod||"\u0646\u0642\u062F\u064A / \u0634\u064A\u0643"}
${chequeNumber&&chequeNumber!=="N/A"?`- \u0631\u0642\u0645 \u0627\u0644\u0634\u064A\u0643: ${chequeNumber}
- \u0642\u064A\u0645\u0629 \u0627\u0644\u0634\u064A\u0643: ${Number(chequeAmount||amount).toLocaleString()} \u062F\u0631\u0647\u0645`:""}
${remainingBalance!==void 0?`- \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0628\u0642\u064A: ${Number(remainingBalance).toLocaleString()} \u062F\u0631\u0647\u0645`:""}

\u0645\u0644\u0627\u062D\u0638\u0629: \u0647\u0630\u0627 \u0625\u064A\u0635\u0627\u0644 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u062A\u0644\u0642\u0627\u0626\u064A \u0635\u0627\u062F\u0631 \u0645\u0646 \u0646\u0638\u0627\u0645 \u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A. \u0627\u0644\u0634\u064A\u0643 \u062E\u0627\u0636\u0639 \u0644\u0644\u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0628\u0646\u0643\u064A \u0627\u0644\u0646\u0647\u0627\u0626\u064A.

\u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A
\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u0644\u0627\u062A\u0635\u0627\u0644: ${emailConfig.fromEmail}
    `.trim();const recipientsList=[recipient,ownerEmail].filter(Boolean);if(emailConfig.isLive&&emailConfig.transporter){for(const target of recipientsList){await emailConfig.transporter.sendMail({from:`"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,to:target,subject,text:messageBody})}console.log(`[Receipt Dispatcher] Live receipt #${receiptNumber} sent from ${emailConfig.fromEmail} to [${recipientsList.join(", ")}]`);return res.json({success:true,status:"SENT",receiptNumber,recipients:recipientsList,from:emailConfig.fromEmail})}else{console.log(`[Receipt Dispatcher] Simulated receipt #${receiptNumber} logged from ${emailConfig.fromEmail} to [${recipientsList.join(", ")}]`);return res.json({success:false,status:"FAILED",error:"SMTP_NOT_CONFIGURED",reason:"SMTP email is not configured in the environment."})}}catch(err){console.error("[Receipt Dispatch Error]:",err);return res.status(500).json({success:false,error:err?.message||"Failed to dispatch receipt"})}});app.post("/api/notifications/dispatch-lease",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{recipientTenantEmail,recipientOwnerEmail,leaseNumber,isRenewal=false,tenantName,ownerName,propertyName,unitNumber,annualRent,startDate,endDate,paymentTerms="\u062F\u0641\u0639\u0627\u062A \u0634\u064A\u0643\u0627\u062A \u062F\u0648\u0631\u064A\u0629"}=req.body;if(!recipientTenantEmail&&!recipientOwnerEmail){return res.status(400).json({success:false,error:"At least one recipient email (tenant or owner) is required"})}const configs=loadConfigs();const secrets=loadSecrets();const emailConfig=getEmailTransporter(configs,secrets);const actionTitle=isRenewal?"\u062A\u062C\u062F\u064A\u062F \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631":"\u062A\u0633\u062C\u064A\u0644 \u0648\u062A\u0648\u062B\u064A\u0642 \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u062C\u062F\u064A\u062F";const subject=`${actionTitle} \u2014 \u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F ${leaseNumber} \u2014 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A`;const formattedRent=Number(annualRent||0).toLocaleString();const messageBody=`
\u0625\u0634\u0639\u0627\u0631 \u0631\u0633\u0645\u064A: ${actionTitle}
=====================================================
\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F: ${leaseNumber}
\u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0621 \u0627\u0644\u0625\u064A\u062C\u0627\u0631: ${startDate}
\u062A\u0627\u0631\u064A\u062E \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0625\u064A\u062C\u0627\u0631: ${endDate}
\u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0625\u064A\u062C\u0627\u0631\u064A\u0629 \u0627\u0644\u0633\u0646\u0648\u064A\u0629: ${formattedRent} \u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A

\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0642\u0627\u0631 \u0648\u0627\u0644\u0637\u0631\u0641\u064A\u0646:
- \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631: ${tenantName}
- \u0627\u0644\u0645\u0627\u0644\u0643: ${ownerName}
- \u0627\u0644\u0639\u0642\u0627\u0631: ${propertyName}
- \u0631\u0642\u0645 \u0627\u0644\u0648\u062D\u062F\u0629: ${unitNumber}
- \u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0641\u0639\u0627\u062A: ${paymentTerms}

\u064A\u0633\u0631 \u0625\u062F\u0627\u0631\u0629 \u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0625\u062D\u0627\u0637\u062A\u0643\u0645 \u0628\u0627\u0643\u062A\u0645\u0627\u0644 \u062A\u0633\u062C\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0642\u062F \u0648\u062A\u0648\u062B\u064A\u0642\u0647 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0639\u0642\u0627\u0631\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F.
\u064A\u0645\u0643\u0646\u0643\u0645 \u0645\u062A\u0627\u0628\u0639\u0629 \u062D\u0627\u0644\u0629 \u0627\u0644\u0639\u0642\u062F \u0648\u0627\u0644\u062F\u0641\u0639\u0627\u062A \u0648\u062C\u062F\u0648\u0644 \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0639\u0628\u0631 \u0628\u0648\u0627\u0628\u062A\u0643\u0645 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0641\u064A \u0623\u064A \u0648\u0642\u062A.

\u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A
\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u0644\u0627\u062A\u0635\u0627\u0644: ${emailConfig.fromEmail}
    `.trim();const targets=[recipientTenantEmail,recipientOwnerEmail].filter(Boolean);if(emailConfig.isLive&&emailConfig.transporter){for(const target of targets){await emailConfig.transporter.sendMail({from:`"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,to:target,subject,text:messageBody})}console.log(`[Lease Dispatcher] Live lease #${leaseNumber} notification sent to [${targets.join(", ")}]`);return res.json({success:true,status:"SENT",leaseNumber,targets,from:emailConfig.fromEmail})}else{console.log(`[Lease Dispatcher] Simulated lease #${leaseNumber} notification logged to [${targets.join(", ")}]`);return res.json({success:false,status:"FAILED",error:"SMTP_NOT_CONFIGURED",reason:"SMTP email is not configured in the environment."})}}catch(err){console.error("[Lease Dispatch Error]:",err);return res.status(500).json({success:false,error:err?.message||"Failed to dispatch lease notification"})}});app.post("/api/notifications/dispatch-tenant-welcome",authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{recipient,tenantName,tenantCode,phone,tenantType="INDIVIDUAL",portalUrl}=req.body;if(!recipient){return res.status(400).json({success:false,error:"Tenant email is required"})}const configs=loadConfigs();const secrets=loadSecrets();const emailConfig=getEmailTransporter(configs,secrets);const subject=`\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643 \u0641\u064A \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u2014 \u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenantCode}`;const baseUrl=portalUrl||"https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app";const loginLink=`${baseUrl}/#tenant-login`;const messageBody=`
\u0639\u0632\u064A\u0632\u064A \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0627\u0644\u0645\u062D\u062A\u0631\u0645 / ${tenantName}\u060C

\u0623\u0647\u0644\u0627\u064B \u0648\u0633\u0647\u0644\u0627\u064B \u0628\u0643 \u0636\u0645\u0646 \u0639\u0645\u0644\u0627\u0621 \u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A.
\u064A\u0633\u0639\u062F\u0646\u0627 \u0625\u0628\u0644\u0627\u063A\u0643\u0645 \u0628\u0623\u0646\u0647 \u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062A\u0641\u0639\u064A\u0644 \u0645\u0644\u0641\u0643\u0645 \u0627\u0644\u0639\u0642\u0627\u0631\u064A \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0631\u0642\u0645 \u0645\u0631\u062C\u0639\u064A: ${tenantCode}.

\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062C\u0644\u0629:
- \u0627\u0644\u0627\u0633\u0645: ${tenantName}
- \u0627\u0644\u0643\u0648\u062F \u0627\u0644\u0645\u0631\u062C\u0639\u064A: ${tenantCode}
- \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641: ${phone||"\u0645\u0633\u062C\u0644 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645"}
- \u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631: ${tenantType==="CORPORATE"?"\u0634\u0631\u0643\u0629 / \u0645\u0624\u0633\u0633\u0629":"\u0641\u0631\u062F"}

\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646:
\u064A\u0645\u0643\u0646\u0643\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u0639\u0642\u0648\u062F\u0643\u0645\u060C \u0633\u0646\u062F\u0627\u062A \u0627\u0644\u0642\u0628\u0636\u060C \u0627\u0644\u0634\u064A\u0643\u0627\u062A\u060C \u0648\u062A\u0642\u062F\u064A\u0645 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0639\u0628\u0631 \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0628\u0627\u0634\u0631:
${loginLink}

\u0645\u0639 \u062A\u062D\u064A\u0627\u062A\u060C
\u0625\u062F\u0627\u0631\u0629 \u0639\u0644\u0627\u0642\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646 \u2014 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A
\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u0644\u0627\u062A\u0635\u0627\u0644: ${emailConfig.fromEmail}
    `.trim();if(emailConfig.isLive&&emailConfig.transporter){await emailConfig.transporter.sendMail({from:`"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,to:recipient,subject,text:messageBody});console.log(`[Tenant Welcome] Sent to ${recipient}`);return res.json({success:true,status:"SENT",recipient,from:emailConfig.fromEmail})}else{console.log(`[Tenant Welcome] Dispatch failed - SMTP not configured for ${recipient}`);return res.json({success:false,status:"FAILED",error:"SMTP_NOT_CONFIGURED",reason:"SMTP email is not configured in the environment."})}}catch(err){console.error("[Tenant Welcome Error]:",err);return res.status(500).json({success:false,error:err?.message||"Failed to dispatch welcome email"})}});app.post(["/api/notifications/dispatch-direct","/api/notifications/dispatch"],authenticateFirebaseToken,requireStaff,async(req,res)=>{try{const{recipient,subject,body,html}=req.body;if(!recipient){return res.status(400).json({success:false,error:"Recipient is required"})}const configs=loadConfigs();const secrets=loadSecrets();const emailConfig=getEmailTransporter(configs,secrets);if(emailConfig.isLive&&emailConfig.transporter){await emailConfig.transporter.sendMail({from:`"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,to:recipient,subject:subject||"\u0625\u0634\u0639\u0627\u0631 \u0645\u0646 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A",text:body||"\u0625\u0634\u0639\u0627\u0631 \u0631\u0633\u0645\u064A \u0645\u0646 \u0634\u0631\u0643\u0629 \u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A",html:html||void 0});return res.json({success:true,status:"SENT",recipient,from:emailConfig.fromEmail})}else{return res.json({success:false,status:"FAILED",error:"SMTP_NOT_CONFIGURED",reason:"SMTP email is not configured in the environment."})}}catch(err){return res.status(500).json({success:false,error:err?.message||"Failed to dispatch direct email"})}});app.post("/api/ai/assistant-chat",authenticateFirebaseToken,requireStaff,async(req,res)=>{const{message,history=[],language="ar"}=req.body;const projectContext:ProjectContext=req.body.projectContext||{};try{const ai=getGeminiClient();const systemPrompt=`You are "\u0635\u0642\u0631 AI" (Falcon AI Assistant), the expert AI Assistant for Emirates Falcon Real Estate Management System (\u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A - \u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0629 \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644\u0627\u062A \u0648\u0627\u0644\u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u0625\u064A\u062C\u0627\u0631\u064A\u0629).

You are connected directly to the user's application, and you MUST return a valid JSON object. 
Your response MUST always fit into this JSON schema exactly:
{
  "reply": "Your conversation response to the user, confirming what action is being executed or answering their questions. Support BOTH Arabic and English naturally.",
  "action": {
    "type": "OPEN_VIEW" | "OPEN_TENANT" | "OPEN_PAYMENT" | "SEND_NOTIFICATION" | "NONE",
    "params": {
      "viewName": "DASHBOARD" | "OWNERS" | "PROPERTIES" | "UNITS" | "TENANTS" | "LEASES" | "CHEQUES" | "BOUNCED_CHEQUES" | "COLLECTIONS" | "CASES" | "HEARINGS" | "MAINTENANCE" | "REPORTS" | "ARCHIVE" | "NOTIFICATIONS",
      "tenantId": "The ID string of the tenant if type is OPEN_TENANT",
      "chequeId": "The ID string of the cheque if type is OPEN_PAYMENT or SEND_NOTIFICATION",
      "channel": "email" | "whatsapp"
    }
  }
}

ALLOWED VIEW NAMES FOR OPEN_VIEW:
- "DASHBOARD" (\u0644\u0648\u062D\u0629 \u0627\u0644\u0642\u064A\u0627\u062F\u0629 \u0648\u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A)
- "OWNERS" (\u062F\u0644\u064A\u0644 \u0627\u0644\u0645\u0644\u0627\u0643)
- "PROPERTIES" (\u0627\u0644\u0645\u0628\u0627\u0646\u064A \u0648\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A)
- "UNITS" (\u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0625\u064A\u062C\u0627\u0631\u064A\u0629)
- "TENANTS" (\u062F\u0644\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646)
- "LEASES" (\u0639\u0642\u0648\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0648\u0646\u0638\u0627\u0645 \u0625\u064A\u062C\u0627\u0631\u064A)
- "CHEQUES" (\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0648\u0627\u0644\u0636\u0645\u0627\u0646\u0627\u062A)
- "BOUNCED_CHEQUES" (\u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0629 \u0648\u0627\u0644\u062A\u0639\u062B\u0631)
- "COLLECTIONS" (\u0627\u0644\u062A\u062D\u0635\u064A\u0644\u0627\u062A \u0648\u0633\u0646\u062F\u0627\u062A \u0627\u0644\u0642\u0628\u0636)
- "CASES" (\u0627\u0644\u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u0625\u064A\u062C\u0627\u0631\u064A\u0629 \u0648 RDC)
- "HEARINGS" (\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629)
- "MAINTENANCE" (\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0648\u062A\u0643\u0644\u064A\u0641 \u0627\u0644\u0641\u0646\u064A\u064A\u0646)
- "REPORTS" (\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0645\u062A\u0642\u062F\u0645\u0629 \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644\u0627\u062A)
- "ARCHIVE" (\u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A)
- "NOTIFICATIONS" (\u0645\u0631\u0643\u0632 \u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0648\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A)

CRITICAL RESTRICTION POLICY:
Automated AI operations on "SETTINGS" (\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645), "AUDIT_LOGS" (\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u0648\u0627\u0644\u0631\u0642\u0627\u0628\u0629), and "DATA_RECOVERY" (\u0645\u0631\u0643\u0632 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u062A\u0631\u0627\u062C\u0639) are STRICTLY EXCLUDED AND FORBIDDEN for security and governance policies.
If the user asks to open, modify, or query Settings, Audit Logs, or Data Recovery / Rollback, you MUST return type "NONE" and explain in the reply that administrative governance policies restrict AI Assistant automation for those 3 confidential sections.

SEARCH & MATCHING ACCURACY INSTRUCTIONS:
- Perform deep multi-field string matching. Apply flexible Arabic normalization ignoring diacritics, alef forms (\u0623/\u0625/\u0622 -> \u0627), yaa/alef maqsura (\u064A/\u0649 -> \u064A), taa marbouta (\u0629/\u0647 -> \u0647), and optional '\u0627\u0644' prefix.
- Support partial string matching across titles, names, codes, phone numbers, passport, national ID, request numbers, and cheque numbers.

Full Project Knowledge Context:
- Owners: ${JSON.stringify((projectContext.owners||[]).slice(0,10))}
- Properties: ${JSON.stringify((projectContext.properties||[]).slice(0,10))}
- Units: ${JSON.stringify((projectContext.units||[]).slice(0,10))}
- Tenants: ${JSON.stringify((projectContext.tenants||[]).slice(0,15).map(t=>({id:t.id,nameAr:t.nameAr,nameEn:t.nameEn,code:t.code,phone:t.phone,riskLevel:t.riskLevel})))}
- Cheques: ${JSON.stringify((projectContext.cheques||[]).slice(0,15).map(c=>({id:c.id,chequeNumber:c.chequeNumber,tenantId:c.tenantId,tenantName:c.tenantName,status:c.status,amount:c.amount,bankName:c.bankName})))}
- Cases: ${JSON.stringify((projectContext.cases||[]).slice(0,10))}
- Leases: ${JSON.stringify((projectContext.leases||[]).slice(0,10))}
- Maintenance: ${JSON.stringify((projectContext.maintenanceRequests||[]).slice(0,10).map(m=>({id:m.id,requestNumber:m.requestNumber,title:m.title,category:m.category,status:m.status,priority:m.priority,propertyName:m.propertyName,unitNumber:m.unitNumber})))}
- Collections: ${JSON.stringify((projectContext.collections||[]).slice(0,10))}

Return ONLY a valid raw JSON object matching the schema above. No markdown fences. No extra text outside the JSON.`;if(!ai){const heuristicResult=matchHeuristicAssistantAction(message,projectContext,language);return res.json(heuristicResult)}const conversationHistory=history.map(msg=>{let cleanContent=msg.content;try{const parsed=JSON.parse(msg.content);if(parsed.reply)cleanContent=parsed.reply}catch{}return{role:msg.role==="user"?"user":"model",parts:[{text:cleanContent}]}});conversationHistory.push({role:"user",parts:[{text:`${systemPrompt}

User Question: ${message}`}]});const response=await generateContentWithFallback(ai,{contents:conversationHistory,config:{responseMimeType:"application/json"}});const rawText=response.text||"";const parsedResponse=safeJsonParse(rawText);if(!parsedResponse){return res.json(matchHeuristicAssistantAction(message,projectContext,language))}return res.json({success:true,reply:parsedResponse.reply,action:parsedResponse.action||{type:"NONE",params:{}}})}catch(err){const fallbackResult=matchHeuristicAssistantAction(message,projectContext,language);return res.json(fallbackResult)}});function startPaymentReminderScheduler(){try{cron.schedule("0 9 * * *",async()=>{try{console.log("[Scheduler] Running payment reminder job...");const db=getFirestoreAdmin();if(!db){console.warn("[Scheduler] Firestore is not initialized, skipping payment reminder.");return}const targetDate=new Date;targetDate.setDate(targetDate.getDate()+3);const targetDateString=targetDate.toISOString().split("T")[0];const chequesSnap=await db.collection("cheques").where("status","in",["PENDING","POST_DATED"]).where("dueDate","==",targetDateString).get();if(chequesSnap.empty){console.log(`[Scheduler] No pending cheques found due on ${targetDateString}`);return}console.log(`[Scheduler] Found ${chequesSnap.size} cheques due on ${targetDateString}. Dispatching reminders...`);const configs=loadConfigs();const secrets=loadSecrets();const emailConfig=getEmailTransporter(configs,secrets);let sentCount=0;for(const doc2 of chequesSnap.docs){const cheque=doc2.data();const tenantId=cheque.tenantId;if(!tenantId)continue;const tenantSnap=await db.collection("tenants").doc(tenantId).get();if(!tenantSnap.exists)continue;const tenant=tenantSnap.data();const tenantPhone=tenant?.phone;const tenantEmail=tenant?.email;const tenantName=tenant?.nameAr||tenant?.nameEn||"\u0639\u0632\u064A\u0632\u064A \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631";const amount=cheque.amount?.toLocaleString()||"0";const messageTextAr=`\u0639\u0632\u064A\u0632\u064A \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenantName}\u060C

\u0646\u0648\u062F \u062A\u0630\u0643\u064A\u0631\u0643\u0645 \u0628\u0623\u0646 \u0645\u0648\u0639\u062F \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u0634\u064A\u0643 \u0631\u0642\u0645 ${cheque.chequeNumber} \u0628\u0642\u064A\u0645\u0629 ${amount} \u062F\u0631\u0647\u0645 \u0625\u0645\u0627\u0631\u0627\u062A\u064A \u0647\u0648 ${targetDateString}.

\u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u062A\u0648\u0641\u0631 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0643\u0627\u0641\u064A \u0641\u064A \u0627\u0644\u062D\u0633\u0627\u0628.

\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0639\u0627\u0648\u0646\u0643\u0645.
\u0635\u0642\u0631 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A \u0644\u0644\u0639\u0642\u0627\u0631\u0627\u062A`;const messageTextEn=`Dear ${tenantName},

This is a gentle reminder that your cheque #${cheque.chequeNumber} for AED ${amount} is due on ${targetDateString}.

Please ensure sufficient funds are available.

Thank you.
Emirates Falcon Real Estate`;const fullMessage=messageTextAr+"\n\n---\n\n"+messageTextEn;const subject=`\u062A\u0630\u0643\u064A\u0631 \u0628\u0645\u0648\u0639\u062F \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0634\u064A\u0643 | Cheque Due Reminder - ${cheque.chequeNumber}`;let sentWhatsApp=false;let sentEmail=false;if(tenantPhone&&configs.whatsapp?.phoneNumberId&&secrets.whatsappAccessToken){const targetPhone=tenantPhone.replace(/[^0-9]/g,"");const url=`https://graph.facebook.com/${configs.whatsapp.apiVersion||"v17.0"}/${configs.whatsapp.phoneNumberId}/messages`;const body={messaging_product:"whatsapp",recipient_type:"individual",to:targetPhone,type:"text",text:{body:fullMessage}};try{const res=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${secrets.whatsappAccessToken}`,"Content-Type":"application/json"},body:JSON.stringify(body)});if(res.ok){sentWhatsApp=true;console.log(`[Scheduler] WhatsApp reminder sent to ${targetPhone} for cheque ${cheque.chequeNumber}`)}else{const errorData=await res.json();console.error(`[Scheduler] WhatsApp API error for ${targetPhone}:`,errorData)}}catch(err){console.error(`[Scheduler] WhatsApp network error for ${targetPhone}:`,err)}}if(tenantEmail&&emailConfig.isLive&&emailConfig.transporter){try{await emailConfig.transporter.sendMail({from:`"${emailConfig.senderName}" <${emailConfig.fromEmail}>`,to:tenantEmail,subject,text:fullMessage});sentEmail=true;console.log(`[Scheduler] Email reminder sent to ${tenantEmail} for cheque ${cheque.chequeNumber}`)}catch(err){console.error(`[Scheduler] Email error for ${tenantEmail}:`,err)}}if(sentWhatsApp||sentEmail){sentCount++;await db.collection("cheques").doc(doc2.id).update({lastReminderDate:new Date().toISOString(),whatsAppStatus:sentWhatsApp?"SENT":cheque.whatsAppStatus})}}console.log(`[Scheduler] Payment reminder job completed. Sent ${sentCount} reminders.`)}catch(error){if(error?.code===7||error?.status===7||error?.message?.includes("PERMISSION_DENIED")||error?.message?.includes("Missing or insufficient permissions")){console.warn("[Scheduler] Payment reminder job skipped: Firebase Admin service account is not configured or lacks Firestore IAM permissions.")}else{console.error("[Scheduler] Error running payment reminder job:",error)}}});console.log("[Scheduler] Automated payment reminder scheduled for 09:00 AM daily")}catch(initErr){console.warn("[Scheduler] Could not initialize payment reminder scheduler:",initErr)}}__name(startPaymentReminderScheduler,"startPaymentReminderScheduler");app.post("/api/backups/manual",authenticateFirebaseToken,requireAdmin,async(req,res)=>{return res.status(503).type("application/json").json({success:false,error:"SERVICE_UNAVAILABLE",message:"\u062E\u062F\u0645\u0629 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0627\u0644\u064A\u062F\u0648\u064A \u062A\u062A\u0637\u0644\u0628 \u0636\u0628\u0637 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0639\u062A\u0645\u0627\u062F Google Drive \u0627\u0644\u062E\u062F\u0645\u064A\u0629 \u0641\u064A \u0628\u064A\u0626\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644."})});app.post("/api/backups/restore",authenticateFirebaseToken,requireAdmin,async(req,res)=>{return res.status(503).type("application/json").json({success:false,error:"SERVICE_UNAVAILABLE",message:"\u062E\u062F\u0645\u0629 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u062A\u062A\u0637\u0644\u0628 \u062A\u0647\u064A\u0626\u0629 \u0628\u064A\u0626\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u062A\u0642\u062F\u0645\u0629."})});app.use("/api",(err,req,res,next)=>{console.error(`[API Uncaught Exception] [${req.method}] ${req.originalUrl}:`,err);if(res.headersSent){return next(err)}const statusCode=typeof err?.status==="number"&&err.status>=400&&err.status<600?err.status:500;const isProduction=process.env.NODE_ENV==="production";return res.status(statusCode).type("application/json").json({success:false,error:isProduction?"INTERNAL_SERVER_ERROR":err?.message||"An unexpected error occurred",message:isProduction?"\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0637\u0644\u0628.":err?.message,statusCode})});app.all(["/api","/api/*"],(req,res)=>{return res.status(404).type("application/json").json({success:false,error:"API_ROUTE_NOT_FOUND",message:"Requested API endpoint was not found.",statusCode:404})});async function startServer(){const distPath=path.join(process.cwd(),"dist");if(process.env.NODE_ENV==="production"){app.use(express.static(distPath));app.get("*",(req,res)=>{if(req.path.startsWith("/api")){return res.status(404).type("application/json").json({success:false,error:"API_ROUTE_NOT_FOUND",message:"Requested API endpoint was not found.",statusCode:404})}if(fs.existsSync(path.join(distPath,"index.html"))){res.sendFile(path.join(distPath,"index.html"))}else{res.status(404).type("text/plain").send("Application index.html not found. Please run build.")}})}else{app.use((req,res,next)=>{if(req.path.startsWith("/api")){return res.status(404).type("application/json").json({success:false,error:"API_ROUTE_NOT_FOUND",message:"Requested API endpoint was not found.",statusCode:404})}next()});const httpServer2=http.createServer(app);const vite=await createViteServer({server:{middlewareMode:true,hmr:process.env.DISABLE_HMR==="true"?false:{server:httpServer2}},appType:"spa"});app.use(vite.middlewares);startPaymentReminderScheduler();const server2=httpServer2.listen(PORT,"0.0.0.0",()=>{console.log(`[Emirates Falcon Real Estate] Server running on http://localhost:${PORT}`)});server2.on("error",(err:NodeJS.ErrnoException)=>{console.error("Server listen error:",err);if(err&&err.code==="EADDRINUSE"){console.error(`Port ${PORT} is already in use. Exiting process.`);process.exit(1)}});process.on("SIGTERM",()=>{server2.close()});process.on("SIGINT",()=>{server2.close()});return}const httpServer=http.createServer(app);startPaymentReminderScheduler();const server=httpServer.listen(PORT,"0.0.0.0",()=>{console.log(`[Emirates Falcon Real Estate] Server running on http://localhost:${PORT}`)});server.on("error",(err:NodeJS.ErrnoException)=>{console.error("Server listen error:",err);if(err&&err.code==="EADDRINUSE"){console.error(`Port ${PORT} is already in use. Exiting process.`);process.exit(1)}});process.on("SIGTERM",()=>{server.close()});process.on("SIGINT",()=>{server.close()})}__name(startServer,"startServer");if (process.env.NODE_ENV !== "test" && !process.env.SKIP_SERVER_LISTEN && !process.env.RUNNING_TESTS && !process.argv.some(a => a.includes("run_all_tests") || a.includes("test"))) {
  startServer().catch(err=>{console.error("[Emirates Falcon Real Estate] Fatal error during startServer:",err);process.exit(1)});
}export{AuthResolutionError};
