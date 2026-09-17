const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(`function getAdminApp() {
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
  }`, `function getAdminApp() {
  const existingApps = getAdminApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  // 1. Try ADC without early logic based on environment vars
  try {
    return initAdminApp({
      credential: applicationDefault(),
      projectId: firebaseAppletConfig.projectId,
    });
  } catch (e: any) {
    console.error("[Firebase Admin] ADC initialization failed or lacks permissions:", e.message);
  }`);

fs.writeFileSync('server.ts', file);
