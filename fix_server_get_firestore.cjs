const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(`function getFirestoreAdmin() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT && !process.env.GCP_PROJECT) return null;
  if (!firestoreAdminDb) {
    try {
      const app = getAdminApp();
      firestoreAdminDb = getAdminFirestore(app);
      if (firebaseAppletConfig.databaseId) {
        firestoreAdminDb.settings({ databaseId: firebaseAppletConfig.databaseId });
      }
    } catch (e: any) {
      console.error("[Firestore] Admin init error:", e.message);
      return null;
    }
  }
  return firestoreAdminDb;
}`, `function getFirestoreAdmin() {
  if (!firestoreAdminDb) {
    try {
      const app = getAdminApp();
      if (!app) return null;
      firestoreAdminDb = getAdminFirestore(app);
      if (firebaseAppletConfig.databaseId) {
        firestoreAdminDb.settings({ databaseId: firebaseAppletConfig.databaseId });
      }
    } catch (e: any) {
      console.error("[Firestore] Admin init error:", e.message);
      return null;
    }
  }
  return firestoreAdminDb;
}`);

file = file.replace(`function getAdminAuthClient() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT && !process.env.GCP_PROJECT) return null;
  if (!adminAuthClient) {
    try {
      const app = getAdminApp();
      adminAuthClient = getAdminAuth(app);
    } catch (e: any) {
      console.error("[Firebase Auth] Admin init error:", e.message);
      return null;
    }
  }
  return adminAuthClient;
}`, `function getAdminAuthClient() {
  if (!adminAuthClient) {
    try {
      const app = getAdminApp();
      if (!app) return null;
      adminAuthClient = getAdminAuth(app);
    } catch (e: any) {
      console.error("[Firebase Auth] Admin init error:", e.message);
      return null;
    }
  }
  return adminAuthClient;
}`);

fs.writeFileSync('server.ts', file);
