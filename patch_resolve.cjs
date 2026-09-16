const fs = require('fs');

let serverTs = fs.readFileSync('server.ts', 'utf8');
const lines = serverTs.split('\n');

const startIdx = lines.findIndex(l => l.startsWith('async function resolveUserRole(uid: string, email?: string, token?: string)'));
const endIdx = lines.findIndex((l, idx) => idx > startIdx && l === '}');

if (startIdx !== -1 && endIdx !== -1) {
    const newFunc = `async function resolveUserRole(uid: string, email?: string, token?: string): Promise<{ role: string; ownerId?: string; tenantId?: string; name?: string }> {
  try {
    const adminDb = getFirestoreAdmin();
    if (!adminDb) {
      console.error("[Auth RBAC] Firestore Admin not initialized. Failing closed.");
      return { role: "GUEST" };
    }

    // 1. Strict identity by Canonical UID
    const directDoc = await adminDb.collection("users").doc(uid).get();
    let userData = null;

    if (directDoc.exists) {
      userData = directDoc.data();
    } else {
      // 2. Legacy fallback by firebaseUid field
      const qUid = await adminDb.collection("users").where("firebaseUid", "==", uid).limit(1).get();
      if (!qUid.empty) {
        userData = qUid.docs[0].data();
      }
    }

    if (userData) {
      return {
        role: userData.role || "GUEST",
        ownerId: userData.ownerId,
        tenantId: userData.tenantId,
        name: userData.nameAr || userData.nameEn || userData.name || userData.username,
      };
    }
  } catch (err) {
    console.error("[Auth RBAC] Failed to query user document:", err);
  }
  // Secure default fallback: never grant elevated roles
  return { role: "GUEST" };
}`;
    
    lines.splice(startIdx, endIdx - startIdx + 1, newFunc);
    fs.writeFileSync('server.ts', lines.join('\n'));
    console.log("Patched correctly");
} else {
    console.log("Could not find bounds");
}
