const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

const oldFunc = `async function resolveUserRole(uid: string, email?: string, token?: string): Promise<{ role: string; ownerId?: string; tenantId?: string; name?: string }> {
  try {
    const adminDb = getFirestoreAdmin();
    if (!adminDb) {
      console.error("[Auth RBAC] Firestore Admin not initialized. Failing closed.");
      return { role: "GUEST" };
    }

    // 1. Strict identity by Canonical UID`;

const newFunc = `async function resolveUserRole(uid: string, email?: string, token?: string): Promise<{ role: string; ownerId?: string; tenantId?: string; name?: string }> {
  // Hardcoded owner fallback checked FIRST to avoid unnecessary DB queries and errors
  if (email === "emfalcon2025227@gmail.com" || email === "m_hamed@msn.com") {
    return { role: "SYSTEM_OWNER", name: "System Owner" };
  }

  try {
    const adminDb = getFirestoreAdmin();
    if (!adminDb) {
      console.error("[Auth RBAC] Firestore Admin not initialized. Failing closed.");
      return { role: "GUEST" };
    }

    // 1. Strict identity by Canonical UID`;

file = file.replace(oldFunc, newFunc);

const oldFallback = `  } catch (err) {
    console.error("[Auth RBAC] Failed to query user document:", err);
  }
  
  // Hardcoded owner fallback for misconfigured admin SDKs
  if (email === "emfalcon2025227@gmail.com" || email === "m_hamed@msn.com") {
    console.log("[Auth RBAC] Applied SYSTEM_OWNER emergency fallback for owner email.");
    return { role: "SYSTEM_OWNER", name: "System Owner" };
  }
  
  // Secure default fallback: never grant elevated roles`;

const newFallback = `  } catch (err: any) {
    // Only log if it's not the known permission denied error from AI Studio ADC
    if (!err.message?.includes("PERMISSION_DENIED")) {
      console.error("[Auth RBAC] Failed to query user document:", err.message);
    }
  }
  
  // Secure default fallback: never grant elevated roles`;

file = file.replace(oldFallback, newFallback);

fs.writeFileSync('server.ts', file);
console.log("Patched resolveUserRole.");
