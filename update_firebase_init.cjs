const fs = require('fs');

let file = fs.readFileSync('server.ts', 'utf8');

// Replace getAdminApp
const oldGetAdminApp = /function getAdminApp\(\) \{[\s\S]*?\n\}/;
const newGetAdminApp = `function getAdminApp() {
  const existingApps = getAdminApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  // 1. ADC / GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT) {
    try {
      return initAdminApp({
        credential: applicationDefault(),
        projectId: firebaseAppletConfig.projectId,
      });
    } catch (e: any) {
      console.error("[Firebase Admin] ADC initialization failed:", e.message);
    }
  }

  // 2. FIREBASE_SERVICE_ACCOUNT_BASE64
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    try {
      const jsonStr = Buffer.from(base64, "base64").toString("utf8");
      const serviceAccount = JSON.parse(jsonStr);
      return initAdminApp({
        credential: adminCert(serviceAccount),
        projectId: serviceAccount.project_id || firebaseAppletConfig.projectId,
      });
    } catch (e: any) {
      console.error("[Firebase Admin] Service account initialization error:", e?.message || e);
    }
  }

  // 3. Fallback (Compute Engine ADC fallback if possible)
  try {
     return initAdminApp({
        credential: applicationDefault(),
        projectId: firebaseAppletConfig.projectId,
     });
  } catch(e: any) {
     console.error("[Firebase Admin] Final fallback failed:", e.message);
  }

  throw new Error("No valid Firebase Admin credentials found.");
}`;

file = file.replace(oldGetAdminApp, newGetAdminApp);

fs.writeFileSync('server.ts', file);
console.log("Updated getAdminApp.");
