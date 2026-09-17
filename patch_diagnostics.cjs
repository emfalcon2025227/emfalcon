const fs = require('fs');
let file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');

// Replace the manual firebase admin initialization with getAdminApp imported from server or we just fetch from admin sdk
// Wait, getAdminApp is in server.ts which isn't exported to centralConfigManager.ts
// But centralConfigManager.ts imports from firebase-admin.
// Let's rewrite the Firebase Admin test
const oldFirebaseTestRegex = /  \/\/ 2\. Firebase Admin, Auth & Firestore \(REAL TEST\)[\s\S]*?\/\/ 4\. Google OAuth & Redirect Match/m;

const newFirebaseTest = `  // 2. Firebase Admin, Auth & Firestore (REAL TEST)
  const tFirebaseStart = Date.now();
  let adminApp: any = null;
  try {
    const existingApps = getAdminApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
    } else {
      // Just check if we can initialize via ADC or Base64 as server.ts does
      if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
          const jsonStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
          const serviceAccount = JSON.parse(jsonStr);
          adminApp = initAdminApp({
            credential: adminCert(serviceAccount),
            projectId: serviceAccount.project_id || firebaseAppletConfig.projectId,
          });
      } else {
          adminApp = initAdminApp({
            credential: applicationDefault(),
            projectId: firebaseAppletConfig.projectId,
          });
      }
    }
    
    if (!adminApp) throw new Error("Firebase Admin SDK failed to initialize.");
    
    // Test Auth
    const auth = getAdminAuth(adminApp);
    await auth.listUsers(1);

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
      safeRecoveryActionAr: "تحقق من صلاحيات Base64 أو ADC",
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
  }

  // 4. Google OAuth & Redirect Match`;

file = file.replace(oldFirebaseTestRegex, newFirebaseTest);
fs.writeFileSync('src/server-utils/centralConfigManager.ts', file);
console.log("Patched diagnostics.");
