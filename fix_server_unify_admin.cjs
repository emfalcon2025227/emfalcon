const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

// Part 1: Unify getAdminApp and remove ADC implicit assumptions
file = file.replace(/function getAdminApp\(\) \{[\s\S]*?\/\/ 2\. FIREBASE_SERVICE_ACCOUNT_BASE64/m, `function getAdminApp() {
  const existingApps = getAdminApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  // ONLY use FIREBASE_SERVICE_ACCOUNT_BASE64 to guarantee production IAM permissions
  // ADC is structurally insufficient for Firebase Admin inside this restricted environment
  // 1. FIREBASE_SERVICE_ACCOUNT_BASE64`);

// Part 4: Remove manual JWT fallback from authenticateFirebaseToken
file = file.replace(/try \{[\s\S]*?decodedToken = await adminAuth\.verifyIdToken\(token\);[\s\S]*?\} catch \(err: any\) \{[\s\S]*?console\.warn\("\[Auth Middleware\] Token verification failed, falling back to manual decode:"[\s\S]*?const base64Url = token\.split\('\.'\)\[1\];[\s\S]*?decodedToken = JSON\.parse\(Buffer\.from\(base64Url, 'base64'\)\.toString\(\)\);[\s\S]*?\}/m, `try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err: any) {
      console.error("[Auth Middleware] Firebase ID token verification failed (STRICT MODE):", err.message);
      return res.status(401).json({ success: false, error: "AUTHENTICATION_FAILED", message: "Firebase ID token verification failed." });
    }`);

// Part 5: Remove hard-coded system owner bypass in resolveUserRole
file = file.replace(/export const resolveUserRole = async \(email: string \| null \| undefined, uid: string\): Promise<string> => \{[\s\S]*?\/\/ 1\. Hard-coded system owner bypass[\s\S]*?if \(email && \(email\.toLowerCase\(\) === "emfalcon2025227@gmail\.com" || email\.toLowerCase\(\) === "eng\.a\.samara@gmail\.com"\)\) \{[\s\S]*?return "SYSTEM_OWNER";[\s\S]*?\}[\s\S]*?\/\/ 2\. Firestore Lookup/m, `export const resolveUserRole = async (email: string | null | undefined, uid: string): Promise<string> => {
  // STRICT MODE: No hard-coded email bypass allowed.
  // 1. Firestore Lookup`);

fs.writeFileSync('server.ts', file);
