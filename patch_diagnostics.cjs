const fs = require('fs');
let file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');

const importRegex = /import firebaseAppletConfig from "\.\.\/\.\.\/firebase-applet-config\.json";/;
const replacementImport = `import firebaseAppletConfig from "../../firebase-applet-config.json";
import { initializeApp as initAdminApp, getApps as getAdminApps, cert as adminCert, applicationDefault } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import nodemailer from "nodemailer";`;

if (!file.includes("firebase-admin/app")) {
    file = file.replace(importRegex, replacementImport);
}

const runAllRegex = /\/\/ 2\. Firebase Admin & Auth[\s\S]*? \/\/ 3\. Firestore Database Connection[\s\S]*?messageEn: \`Firestore database \$\{firebaseAppletConfig\.firestoreDatabaseId\} online\`,\s*\}\);\s*\}/m;

const runAllReplacement = `// 2. Firebase Admin, Auth & Firestore (REAL TEST)
  const tFirebaseStart = Date.now();
  let firebaseAdminPass = false;
  let firestorePass = false;
  let adminApp: any = null;

  try {
    const existingApps = getAdminApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
    } else {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT) {
        try {
          adminApp = initAdminApp({
            credential: applicationDefault(),
            projectId: firebaseAppletConfig.projectId,
          });
        } catch (e: any) {}
      }
      if (!adminApp && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        try {
          const jsonStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
          const serviceAccount = JSON.parse(jsonStr);
          adminApp = initAdminApp({
            credential: adminCert(serviceAccount),
            projectId: serviceAccount.project_id || firebaseAppletConfig.projectId,
          });
        } catch (e: any) {}
      }
      if (!adminApp) {
        try {
          adminApp = initAdminApp({
            credential: applicationDefault(),
            projectId: firebaseAppletConfig.projectId,
          });
        } catch (e: any) {}
      }
    }

    if (!adminApp) throw new Error("Firebase Admin SDK failed to initialize - no valid credentials found (ADC, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_SERVICE_ACCOUNT_BASE64).");
    
    // Test Auth
    const auth = getAdminAuth(adminApp);
    // Simple fast read test for Auth if possible, but just initializing successfully with creds is a strong signal. We'll list one user to be sure.
    await auth.listUsers(1);
    firebaseAdminPass = true;

    results.push({
      serviceId: "FIREBASE_ADMIN",
      serviceNameAr: "نظام مصادقة Firebase وحساب الخدمة",
      serviceNameEn: "Firebase Admin & Auth Service",
      category: "Firebase",
      status: "PASS",
      latencyMs: Date.now() - tFirebaseStart,
      lastChecked: nowIso,
      messageAr: "تم التحقق من Firebase Admin و Auth بنجاح.",
      messageEn: "Firebase Admin Auth initialized and verified successfully.",
    });

  } catch (err: any) {
    results.push({
      serviceId: "FIREBASE_ADMIN",
      serviceNameAr: "نظام مصادقة Firebase وحساب الخدمة",
      serviceNameEn: "Firebase Admin & Auth Service",
      category: "Firebase",
      status: "FAIL",
      latencyMs: Date.now() - tFirebaseStart,
      lastChecked: nowIso,
      messageAr: \`تعذر تهيئة Firebase Admin أو مصادقته: \${err.message}\`,
      messageEn: \`Firebase Admin initialization/auth failed: \${err.message}\`,
      safeRecoveryActionAr: "تحقق من صلاحيات Base64 أو ADC (Default Credentials)",
      safeRecoveryActionEn: "Check Base64 permissions or ADC credentials",
    });
  }

  // 3. Firestore Database Connection
  const tFirestoreStart = Date.now();
  try {
    if (!adminApp) throw new Error("Cannot test Firestore without Firebase Admin SDK initialization.");
    const dbId = firebaseAppletConfig.firestoreDatabaseId;
    const db = dbId ? getAdminFirestore(adminApp, dbId) : getAdminFirestore(adminApp);
    
    // READ-ONLY TEST
    const testDoc = await db.collection("system_config").limit(1).get();
    
    results.push({
      serviceId: "FIRESTORE_DB",
      serviceNameAr: "قاعدة بيانات Firestore المركزية",
      serviceNameEn: "Firestore Database Connection",
      category: "Database",
      status: "PASS",
      latencyMs: Date.now() - tFirestoreStart,
      lastChecked: nowIso,
      messageAr: \`تم الاتصال بنجاح. القراءة من Firestore (Database ID: \${dbId || "(default)"}) تعمل بشكل سليم.\`,
      messageEn: \`Read test successful. Latency: \${Date.now() - tFirestoreStart}ms (Database ID: \${dbId || "(default)"})\`,
    });
  } catch(err: any) {
    results.push({
      serviceId: "FIRESTORE_DB",
      serviceNameAr: "قاعدة بيانات Firestore المركزية",
      serviceNameEn: "Firestore Database Connection",
      category: "Database",
      status: "FAIL",
      latencyMs: Date.now() - tFirestoreStart,
      lastChecked: nowIso,
      messageAr: \`فشل اختبار القراءة من Firestore: \${err.message}\`,
      messageEn: \`Firestore read test failed: \${err.message}\`,
    });
  }`;

file = file.replace(runAllRegex, runAllReplacement);
fs.writeFileSync('src/server-utils/centralConfigManager.ts', file);
console.log("Patched diagnostics for Firebase.");
